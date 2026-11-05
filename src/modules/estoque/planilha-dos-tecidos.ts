import { lugarPorExtenso } from '@dominio/deposito'
import {
  arvoreDeTecidos,
  composicaoPorExtenso,
  fichaQueVale,
  gruposDoEstoque,
  rendimento,
  type Hierarquia,
  type Material,
} from '@dominio/estoque'
import { cuidadosEmOrdem } from '@dominio/estoque/cuidados'
import { baixarArquivo, planilhaXlsx, type AbaDaPlanilha } from '@shared/planilha'
import { fornecedorDoMaterial, lugaresDe, type Fornecimento, type Guardado } from './apoio'

/* ==========================================================================
   A planilha do estoque de tecidos (pedido do Henrique de 05/11/2026: "quero
   também poder baixar um XLS com todo o estoque de tecidos").

   Duas abas:
     Cores    uma linha por cor no estoque, com a ficha que vale para ela (a
              própria ou a do tecido, 087) e os números da prateleira
     Tecidos  uma linha por tecido do catálogo, com a ficha do tecido e o
              total das cores

   Os números vão como número, para somar no Excel. A unidade vai na coluna
   ao lado, porque um tecido pode estar em kg e outro em metro.
   ========================================================================== */

const frases = (cods: string[]) =>
  cuidadosEmOrdem(cods)
    .map(c => c.frase)
    .join('; ')

const ouNada = (n: number) => (n > 0 ? n : null)
const arredondar = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas

export function abasDosTecidos(
  materiais: Material[],
  hierarquia: Hierarquia,
  fornecimento: Fornecimento,
  guardado: Guardado,
): AbaDaPlanilha[] {
  const arvore = arvoreDeTecidos(gruposDoEstoque(materiais), hierarquia, () => true)

  const cores: AbaDaPlanilha = {
    nome: 'Cores',
    colunas: [
      { titulo: 'Grupo', largura: 16 },
      { titulo: 'Tecido', largura: 34 },
      { titulo: 'Cor', largura: 20 },
      { titulo: 'Composição', largura: 30 },
      { titulo: 'Ficha da cor', largura: 14 },
      { titulo: 'Gramatura (g/m²)', largura: 16 },
      { titulo: 'Largura (m)', largura: 12 },
      { titulo: 'Rendimento (m por kg)', largura: 20 },
      { titulo: 'Cuidados', largura: 60 },
      { titulo: 'Cuidados a confirmar', largura: 40 },
      { titulo: 'Fornecedor', largura: 24 },
      { titulo: 'Na prateleira', largura: 14 },
      { titulo: 'Reservado', largura: 12 },
      { titulo: 'Livre', largura: 12 },
      { titulo: 'Mínimo', largura: 12 },
      { titulo: 'Unidade', largura: 10 },
      { titulo: 'Onde fica', largura: 26 },
    ],
    linhas: [],
  }
  const tecidos: AbaDaPlanilha = {
    nome: 'Tecidos',
    colunas: [
      { titulo: 'Grupo', largura: 16 },
      { titulo: 'Tecido', largura: 34 },
      { titulo: 'Composição', largura: 30 },
      { titulo: 'Gramatura (g/m²)', largura: 16 },
      { titulo: 'Largura (m)', largura: 12 },
      { titulo: 'Rendimento (m por kg)', largura: 20 },
      { titulo: 'Cuidados', largura: 60 },
      { titulo: 'Cuidados a confirmar', largura: 40 },
      { titulo: 'Cores no estoque', largura: 18 },
      { titulo: 'Cores com ficha própria', largura: 22 },
      { titulo: 'Na prateleira (kg)', largura: 18 },
      { titulo: 'Livre (kg)', largura: 12 },
    ],
    linhas: [],
  }

  for (const g of arvore) {
    for (const t of g.tecidos) {
      const r = rendimento(t.gramatura, t.largura)
      const emKg = t.cores.filter(m => m.unidade === 'kg')
      tecidos.linhas.push([
        g.nome,
        t.nome,
        composicaoPorExtenso(t.ficha.composicao),
        ouNada(t.gramatura),
        ouNada(t.largura),
        r > 0 ? arredondar(r, 1) : null,
        frases(t.ficha.cuidados),
        frases(t.ficha.aConfirmar),
        t.cores.length,
        t.cores.filter(m => m.composicao.length > 0 || m.cuidados.length > 0).length,
        emKg.length ? arredondar(emKg.reduce((s, m) => s + m.saldo, 0)) : null,
        emKg.length ? arredondar(emKg.reduce((s, m) => s + m.livre, 0)) : null,
      ])
      for (const m of t.cores) {
        const f = fichaQueVale(m, hierarquia.fichaNoBanco ? t.ficha : undefined)
        const gramatura = m.gramatura || t.gramatura
        const largura = m.largura || t.largura
        const rc = rendimento(gramatura, largura)
        const lugar = lugaresDe(guardado, m.id)[0]
        const propria = [f.composicaoDaCor ? 'composição' : '', f.cuidadosDaCor ? 'cuidados' : '']
          .filter(Boolean)
          .join(' e ')
        cores.linhas.push([
          g.nome,
          t.nome,
          m.cor || m.nome,
          composicaoPorExtenso(f.composicao),
          propria || null,
          ouNada(gramatura),
          ouNada(largura),
          rc > 0 ? arredondar(rc, 1) : null,
          frases(f.cuidados),
          frases(f.aConfirmar),
          fornecedorDoMaterial(m, fornecimento)?.nome ?? '',
          arredondar(m.saldo),
          arredondar(m.reservado),
          arredondar(m.livre),
          arredondar(m.minimo),
          m.unidade,
          lugar ? lugarPorExtenso(lugar.movel, lugar.lugar.vao, lugar.lugar.nivel) : m.ondeFica,
        ])
      }
    }
  }
  return [cores, tecidos]
}

export function baixarPlanilhaDosTecidos(
  materiais: Material[],
  hierarquia: Hierarquia,
  fornecimento: Fornecimento,
  guardado: Guardado,
): void {
  const hoje = new Date()
  const dia = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, '0'),
    String(hoje.getDate()).padStart(2, '0'),
  ].join('-')
  baixarArquivo(
    planilhaXlsx(abasDosTecidos(materiais, hierarquia, fornecimento, guardado)),
    `estoque-de-tecidos-${dia}.xlsx`,
  )
}
