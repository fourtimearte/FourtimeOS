import { tamanhosNaOrdem, totalDaGrade } from '../layout/grade'
import type { Bloco, Design, Tecnica } from '../layout/bloco'
import {
  etiquetaDoDesign,
  NOME_DA_TECNICA_DA_ETIQUETA,
  NOME_DO_TIPO,
  type EtiquetaDoLayout,
} from '../layout/etiqueta'
import { fatiasDaCotacao } from '../cotacao/fabrica'
import type { Cotacao } from '../cotacao/tipos'

/* ==========================================================================
   A COMPARAÇÃO DOS COMPONENTES (prancha 88, parte P3 do PCP).

   Para cada layout, o que o ORÇAMENTO diz de um lado e o que a FICHA
   TÉCNICA, a SEPARAÇÃO e a PRODUÇÃO dizem do outro, em seis linhas:
   referência, cada tecido, design, etiqueta, grade e arte. Cada linha confere
   ou não confere; "aviso" é o que não dá para conferir (a ficha em branco, o
   tecido sem consumo) e não conta como diferença.

   É CONTA PURA: recebe o que já foi lido e devolve o resultado, sem banco e
   sem tela, para a prova rodar em node (npm run contas). As entradas de
   material e de ficha têm tipo próprio aqui, com só o que a conta usa.
   ========================================================================== */

export type EstadoDaLinha = 'ok' | 'diferenca' | 'aviso'

export type LinhaDaComparacao = {
  chave: string
  titulo: string
  estado: EstadoDaLinha
  /** rótulo miúdo (orçamento, ficha técnica, separação, produção, os outros) e o texto */
  lados: { rotulo: string; texto: string; alerta?: boolean }[]
}

export type ComparacaoDoLayout = {
  n: number
  nome: string
  linhas: LinhaDaComparacao[]
  /** quantas linhas conferem, de quantas */
  confere: number
  total: number
  diferencas: number
}

/** o que a conta usa da ficha técnica de uma referência */
export type FichaParaComparar = {
  cod: string
  fichaEm: string | null
  tamanhos: string[]
  medidas: number
  partesComTecido: number
  temMolde: boolean
}

/** o consumo de um material num layout (062) */
export type ConsumoParaComparar = {
  ordem: number
  materialId: string
  material: string
  quantidade: number
  unidade: string
  semConsumo: boolean
}

/** a reserva do material no pedido inteiro */
export type ReservaParaComparar = {
  materialId: string
  quantidade: number
  unidade: string
  baixada: boolean
  separado: number
  semConsumo: boolean
}

const NOME_DA_TECNICA: Partial<Record<Tecnica, string>> = {
  subli: 'Sublimação',
  dtf: 'DTF',
  silk: 'Silk',
  bordado: 'Bordado',
  patch: 'Patch',
}

/** "1,3 kg", "0,46 kg", "12 un": a casa decimal só quando existe */
export function quanto(q: number, unidade: string): string {
  return q.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' ' + unidade
}

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1]
}

const L = (n: number) => 'L-' + String(n).padStart(2, '0')

function nomeDaEtiqueta(e: EtiquetaDoLayout): string {
  if (!e.tipo) return 'sem etiqueta'
  return (
    'Eti. ' +
    NOME_DO_TIPO[e.tipo] +
    (e.tecnica ? ' em ' + NOME_DA_TECNICA_DA_ETIQUETA[e.tecnica] : '')
  )
}

function designDoOrcamento(design: Design[]): string {
  const tecnicas = design.filter(d => d.tecnica !== 'etiqueta')
  if (!tecnicas.length) return 'sem técnica'
  return tecnicas
    .map(d =>
      d.cores.length && (d.tecnica === 'subli' || d.tecnica === 'dtf')
        ? `${d.tag}, ${d.cores.length} ${d.cores.length === 1 ? 'cor' : 'cores'}`
        : d.tag,
    )
    .join(' · ')
}

const minusculo = (s: string) => s.trim().toLocaleLowerCase('pt-BR')

export function compararOsComponentes(entrada: {
  cotacao: Cotacao
  /** a ficha de cada referência, pelo código; o código que não está aqui não foi achado */
  fichas: Map<string, FichaParaComparar>
  /** null: a 062 não rodou, e a separação não tem o material por layout */
  consumo: ConsumoParaComparar[] | null
  reservas: ReservaParaComparar[]
}): ComparacaoDoLayout[] {
  const { cotacao, fichas, consumo, reservas } = entrada
  const produtos = cotacao.produtos.filter(p => !p.bloco.informacoes)
  const fatias = fatiasDaCotacao(cotacao)
  const etiquetas = produtos.map(p => ({ n: p.bloco.n, e: etiquetaDoDesign(p.bloco.design) }))

  return produtos.map((p, i) => {
    const b: Bloco = p.bloco
    const ordem = b.n || i + 1
    const linhas: LinhaDaComparacao[] = []

    /* 1. a referência, contra o catálogo e a ficha */
    const cod = (b.referencia || '').trim()
    const ficha = cod ? fichas.get(cod) : undefined
    if (!cod) {
      linhas.push({
        chave: 'referencia',
        titulo: 'Referência',
        estado: 'diferenca',
        lados: [{ rotulo: 'orçamento', texto: 'sem referência', alerta: true }],
      })
    } else if (!ficha) {
      linhas.push({
        chave: 'referencia',
        titulo: 'Referência',
        estado: 'diferenca',
        lados: [
          { rotulo: 'orçamento', texto: cod },
          { rotulo: 'ficha técnica', texto: 'não está no catálogo', alerta: true },
        ],
      })
    } else if (!ficha.fichaEm) {
      linhas.push({
        chave: 'referencia',
        titulo: 'Referência',
        estado: 'aviso',
        lados: [
          { rotulo: 'orçamento', texto: cod },
          { rotulo: 'ficha técnica', texto: 'em branco: ninguém preencheu a ficha' },
        ],
      })
    } else {
      const tem = [
        ficha.temMolde ? 'molde' : '',
        ficha.medidas ? 'medidas' : '',
        ficha.partesComTecido ? 'tecido' : '',
      ].filter(Boolean)
      const falta = [
        !ficha.temMolde ? 'molde' : '',
        !ficha.medidas ? 'medidas' : '',
        !ficha.partesComTecido ? 'tecido' : '',
      ].filter(Boolean)
      linhas.push({
        chave: 'referencia',
        titulo: 'Referência',
        estado: falta.length ? 'aviso' : 'ok',
        lados: [
          { rotulo: 'orçamento', texto: cod },
          {
            rotulo: 'ficha técnica',
            texto: falta.length
              ? tem.length
                ? `tem ${lista(tem)}; falta ${lista(falta)}`
                : `falta ${lista(falta)}`
              : 'completa: molde, medidas e tecido',
          },
        ],
      })
    }

    /* 2. cada tecido, contra o que a ficha pede e o que saiu da prateleira */
    b.tecidos.forEach((t, k) => {
      const titulo = b.tecidos.length > 1 ? `Tecido ${k + 1}` : 'Tecido'
      const doOrcamento = t.nome + (t.cor && t.cor !== 'sem cor' ? ' · ' + t.cor : '')
      const lados: LinhaDaComparacao['lados'] = [
        { rotulo: 'orçamento', texto: doOrcamento || 'sem tecido' },
      ]
      if (consumo === null) {
        lados.push({ rotulo: 'separação', texto: 'o banco ainda não tem o material por layout' })
        linhas.push({ chave: 'tecido-' + k, titulo, estado: 'aviso', lados })
        return
      }
      const nomeDoMaterial = minusculo(doOrcamento)
      const c = consumo.find(
        x =>
          x.ordem === ordem &&
          ((t.materialId && x.materialId === t.materialId) ||
            minusculo(x.material) === nomeDoMaterial),
      )
      if (!c) {
        lados.push({ rotulo: 'separação', texto: 'nenhum material do Estoque para este tecido' })
        linhas.push({ chave: 'tecido-' + k, titulo, estado: 'aviso', lados })
        return
      }
      if (c.semConsumo) {
        lados.push({ rotulo: 'ficha técnica', texto: 'sem consumo cadastrado' })
        linhas.push({ chave: 'tecido-' + k, titulo, estado: 'aviso', lados })
        return
      }
      lados.push({ rotulo: 'ficha técnica', texto: 'pede ' + quanto(c.quantidade, c.unidade) })
      const r = reservas.find(x => x.materialId === c.materialId)
      if (!r || !r.baixada) {
        lados.push({ rotulo: 'separação', texto: 'não saiu da prateleira', alerta: true })
        linhas.push({ chave: 'tecido-' + k, titulo, estado: 'diferenca', lados })
        return
      }
      /* a reserva é do pedido inteiro: a falta do material é a do pedido */
      const falta = r.quantidade - r.separado
      if (falta > 0.0005) {
        lados.push({
          rotulo: 'separação',
          texto: `saiu ${quanto(r.separado, r.unidade)} · falta ${quanto(falta, r.unidade)}`,
          alerta: true,
        })
        linhas.push({ chave: 'tecido-' + k, titulo, estado: 'diferenca', lados })
        return
      }
      lados.push({
        rotulo: 'separação',
        texto: `saiu ${quanto(r.separado, r.unidade)}, o que a ficha pede`,
      })
      linhas.push({ chave: 'tecido-' + k, titulo, estado: 'ok', lados })
    })
    if (!b.tecidos.length) {
      linhas.push({
        chave: 'tecido',
        titulo: 'Tecido',
        estado: 'diferenca',
        lados: [{ rotulo: 'orçamento', texto: 'sem tecido', alerta: true }],
      })
    }

    /* 3. o design, contra as fatias que vão nascer no kanban */
    const minhas = fatias
      .filter(f => f.layouts.includes(b.n))
      .map(f => NOME_DA_TECNICA[f.tecnica] ?? f.tecnica)
    linhas.push({
      chave: 'design',
      titulo: 'Design',
      estado: minhas.length ? 'ok' : 'diferenca',
      lados: [
        { rotulo: 'orçamento', texto: designDoOrcamento(b.design), alerta: !minhas.length },
        {
          rotulo: 'produção',
          texto: minhas.length
            ? `vira ${minhas.length} ${minhas.length === 1 ? 'fatia' : 'fatias'}: ${lista(minhas)}`
            : 'nenhuma técnica: não nasce fatia no kanban',
          alerta: !minhas.length,
        },
      ],
    })

    /* 4. a etiqueta, contra a dos outros layouts: sem etiqueta é diferença;
       diferente de dois ou mais que concordam entre si é aviso (um layout
       de etiqueta do cliente ao lado de um da Fourtime pode ser de propósito) */
    const eu = etiquetaDoDesign(b.design)
    const outros = etiquetas.filter(x => x.n !== b.n && x.e.tipo)
    const iguais = (a: EtiquetaDoLayout, c: EtiquetaDoLayout) =>
      a.tipo === c.tipo && a.tecnica === c.tecnica
    const comoOsOutros = outros.length ? outros.every(x => iguais(x.e, outros[0].e)) : false
    const ladosEti: LinhaDaComparacao['lados'] = [
      { rotulo: 'orçamento', texto: nomeDaEtiqueta(eu), alerta: !eu.tipo },
    ]
    if (outros.length) {
      ladosEti.push({
        rotulo: 'os outros',
        texto: comoOsOutros
          ? `${lista(outros.map(x => L(x.n)))} ${outros.length === 1 ? 'leva' : 'levam'} ${nomeDaEtiqueta(outros[0].e)}`
          : outros.map(x => `${L(x.n)} ${nomeDaEtiqueta(x.e)}`).join(' · '),
      })
    }
    linhas.push({
      chave: 'etiqueta',
      titulo: 'Etiqueta',
      estado: !eu.tipo
        ? 'diferenca'
        : outros.length >= 2 && comoOsOutros && !iguais(eu, outros[0].e)
          ? 'aviso'
          : 'ok',
      lados: ladosEti,
    })

    /* 5. a grade, contra os tamanhos da ficha */
    const pecas = totalDaGrade(b.grade)
    const tamanhos = tamanhosNaOrdem(b.faixa, b.grade).filter(t => (b.grade[t] ?? 0) > 0)
    const ladosGrade: LinhaDaComparacao['lados'] = [
      {
        rotulo: 'orçamento',
        texto: pecas
          ? `${pecas} ${pecas === 1 ? 'peça' : 'peças'}: ${tamanhos.map(t => `${t} ${b.grade[t]}`).join(', ')}`
          : 'sem grade',
        alerta: !pecas,
      },
    ]
    let estadoGrade: EstadoDaLinha = pecas ? 'ok' : 'diferenca'
    if (pecas && ficha) {
      if (!ficha.tamanhos.length) {
        ladosGrade.push({ rotulo: 'ficha técnica', texto: 'não diz os tamanhos' })
        estadoGrade = 'aviso'
      } else {
        const fora = tamanhos.filter(t => !ficha.tamanhos.includes(t))
        ladosGrade.push(
          fora.length
            ? { rotulo: 'ficha técnica', texto: `não tem ${lista(fora)}`, alerta: true }
            : {
                rotulo: 'ficha técnica',
                texto:
                  tamanhos.length === 1
                    ? 'o tamanho existe'
                    : `os ${tamanhos.length} tamanhos existem`,
              },
        )
        if (fora.length) estadoGrade = 'diferenca'
      }
    }
    linhas.push({ chave: 'grade', titulo: 'Grade', estado: estadoGrade, lados: ladosGrade })

    /* 6. a arte */
    linhas.push({
      chave: 'arte',
      titulo: 'Arte',
      estado: b.imagem ? 'ok' : 'diferenca',
      lados: [
        {
          rotulo: 'orçamento',
          texto: b.imagem ? 'arte no orçamento' : 'sem arte',
          alerta: !b.imagem,
        },
      ],
    })

    return {
      n: b.n,
      nome: b.nomeDaReferencia || cod || 'sem referência',
      linhas,
      confere: linhas.filter(l => l.estado === 'ok').length,
      total: linhas.length,
      diferencas: linhas.filter(l => l.estado === 'diferenca').length,
    }
  })
}
