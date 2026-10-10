import type { CSSProperties } from 'react'
import { Buildings, CalendarBlank, CreditCard, Hourglass, Package, Tag, Truck, WhatsappLogo } from '@phosphor-icons/react'
import { LogoFourtime, type IconeDoPacote } from '@ds'
import { EMPRESA } from '@dominio/empresa'
import {
  NOME_DO_ESTADO_DA_COTACAO,
  pecasDaCotacao,
  pecasDoProduto,
  subtotal,
  totalDaCotacao,
  totalDoProduto,
  valorDoAjuste,
  type Cotacao,
} from '@dominio/cotacao'
import './documento.css'

/* ==========================================================================
   A PÁGINA 1 DA FOLHA NO TEMPLATE PADRÃO (FOURTIME OS - 14, seção 4).

   O Henrique escolheu peça por peça no protótipo "Folha A4" e fechou o padrão
   em 10/10/2026: CAB 4, RES 22, COND 2, INF 2, ACE 2 e PE 1, em Roboto. Aqui
   mora UM desenho por parte, o do padrão, e não os vinte do protótipo: a
   biblioteca era para escolher, e escolha feita não vira opção na tela.

   A linguagem é uma só (seção 3 do 14): título de seção de 8 px com o risco
   até a margem, rótulo de 7,5 px cinza, valor de 10,5 px em negrito, total de
   13 px; caixa com canto de 4 px; risco fino de 1 px cinza. Cor só como sinal.

   O código de referência é o do protótipo, em /home/claude/wire-fichas/a4n
   (p1.js e papel.css). As classes daqui são as de lá com o prefixo dc-.
   ========================================================================== */

const n2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const reais = (v: number) => 'R$ ' + n2(v)
const pecas = (n: number) => n + (n === 1 ? ' peça' : ' peças')

/* A DATA SEM FUSO. '2026-10-20' lido como Date é meia-noite em Greenwich, que
   em Goiânia ainda é o dia 19: a validade sairia um dia antes no papel. Data
   sem hora se lê pelos números; só a com hora passa pelo relógio. */
export function dataCurta(iso: string): string {
  if (!iso) return ''
  const so = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (so) return so[3] + '/' + so[2] + '/' + so[1]
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

/* quantas colunas uma faixa de n campos usa, até o teto: quatro ou menos
   ficam numa fileira só; até oito, duas fileiras iguais; mais, o teto */
const colunasDe = (n: number, teto: number) => Math.max(1, Math.min(teto, n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : teto))

const pedidoDe = (c: Cotacao) => c.aprovacao?.pedido || c.producao.pedido

/* ==========================================================================
   OS CAMPOS DO CABEÇALHO, na ordem da seção 2 do 14.

   Com valor: cliente, CPF ou CNPJ, cotação, pedido, vendedor, contato,
   situação, prazo, pagamento e total. Sem valor: cliente, CPF ou CNPJ,
   cotação, pedido, vendedor, contato, departamento, embalagem, data de envio e
   peças. A cotação sai da faixa e vira o número grande à direita.

   O pedido só aparece na folha com valor depois que existe: antes do sim do
   cliente ele não tem número, e um "-" ali parece esquecimento. Na folha da
   produção ele fica sempre, porque é a chave do pedido lá na fábrica, e a
   falta dele é justamente o que alguém precisa ver.
   ========================================================================== */
export type CampoDaFolha = { k: string; r: string; v: string; forte?: boolean }

export function camposDoCabecalho(c: Cotacao, comValor: boolean): CampoDaFolha[] {
  const pd = pedidoDe(c)
  if (comValor) {
    return [
      { k: 'cliente', r: 'Cliente', v: c.cliente.nome },
      { k: 'cnpj', r: 'CPF ou CNPJ', v: c.cliente.documento },
      ...(pd ? [{ k: 'pd', r: 'Pedido', v: pd }] : []),
      { k: 'vendedor', r: 'Vendedor', v: c.vendedor },
      { k: 'contato', r: 'Contato', v: c.cliente.contato },
      { k: 'situacao', r: 'Situação', v: NOME_DO_ESTADO_DA_COTACAO[c.estado] },
      { k: 'prazo', r: 'Prazo', v: c.informe.prazo },
      { k: 'pagamento', r: 'Pagamento', v: c.informe.pagamento },
      { k: 'total', r: 'Total', v: reais(totalDaCotacao(c)), forte: true },
    ]
  }
  return [
    { k: 'cliente', r: 'Cliente', v: c.cliente.nome },
    { k: 'cnpj', r: 'CPF ou CNPJ', v: c.cliente.documento },
    { k: 'pd', r: 'Pedido', v: pd },
    { k: 'vendedor', r: 'Vendedor', v: c.vendedor },
    { k: 'contato', r: 'Contato', v: c.cliente.contato },
    { k: 'departamento', r: 'Departamento', v: c.producao.departamento },
    { k: 'embalagem', r: 'Embalagem', v: c.producao.embalagem },
    { k: 'envio', r: 'Data de envio', v: dataCurta(c.producao.dataDeEnvio) },
    { k: 'pecas', r: 'Peças', v: String(pecasDaCotacao(c)), forte: true },
  ]
}

function Rotulo({ children }: { children: string }) {
  return <span className="dc-r">{children}</span>
}

function Titulo({ children }: { children: string }) {
  return (
    <h3 className="dc-t">
      <span>{children}</span>
    </h3>
  )
}

/* ==========================================================================
   1. CABEÇALHO 4, "número grande à direita": a marca à esquerda e o número da
   cotação grande à direita; os outros campos numa faixa entre dois riscos.
   ========================================================================== */
export function CabecalhoDaPaginaUm({ cotacao: c, comValor }: { cotacao: Cotacao; comValor: boolean }) {
  const campos = camposDoCabecalho(c, comValor)
  return (
    <div className="dc-n">
      <div className="dc-topo">
        <div className="dc-marca">
          <LogoFourtime altura={22} titulo="Fourtime" />
          {EMPRESA.descricao ? <small>{EMPRESA.descricao}</small> : null}
        </div>
        <div className="dc-numg">
          <Rotulo>{comValor ? 'Cotação' : 'Folha da produção'}</Rotulo>
          <b>{c.numero}</b>
          {c.criadaEm ? <small>criada em {dataCurta(c.criadaEm)}</small> : null}
        </div>
      </div>
      <div className="dc-campos" style={{ '--dc-c': colunasDe(campos.length, 5) } as CSSProperties}>
        {campos.map((x) => (
          <div key={x.k} className={x.forte ? 'dc-cel dc-cel-forte' : 'dc-cel'}>
            <Rotulo>{x.r}</Rotulo>
            <b>{x.v || '-'}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==========================================================================
   2. RESUMO 22, "faixa com gênero, sem referência": uma linha por layout, o
   número só de borda, a tag do gênero, o nome sem a referência na frente e o
   valor em negrito; os totais numa faixa de células, o total em tinta.

   Acima de 10 layouts o resumo vira DUAS tabelas lado a lado (pedido dele:
   "20 layouts não cabem numa coluna"). Ali o preço por peça sai, porque a
   coluna pela metade não comporta seis colunas, e o nome corta com
   reticência em vez de quebrar a linha.
   ========================================================================== */
const GENERO: Record<string, [string, string]> = {
  masculino: ['Masculino', 'dc-gen dc-gen-m'],
  feminino: ['Feminino', 'dc-gen dc-gen-f'],
  infantil: ['Infantil', 'dc-gen dc-gen-i'],
}

export const CORTE_DO_RESUMO = 10

export function ResumoDaPaginaUm({ cotacao: c, comValor }: { cotacao: Cotacao; comValor: boolean }) {
  const linhas = c.produtos.map((p) => {
    const n = pecasDoProduto(p)
    const total = totalDoProduto(p)
    return {
      id: p.bloco.id,
      num: String(p.bloco.n).padStart(2, '0'),
      nome: p.bloco.nomeDaReferencia || p.bloco.referencia || p.bloco.arte || 'Layout sem referência',
      genero: GENERO[p.bloco.genero],
      pecas: n,
      porPeca: n ? total / n : 0,
      total,
    }
  })
  const dois = linhas.length > CORTE_DO_RESUMO
  const comPorPeca = comValor && !dois

  const tabela = (lista: typeof linhas) => (
    <table className="dc-tab">
      <thead>
        <tr>
          <th>Layout</th>
          <th>Produto</th>
          <th>Gênero</th>
          <th className="dc-nd">Peças</th>
          {comPorPeca ? <th className="dc-nd">Por peça</th> : null}
          {comValor ? <th className="dc-nd">Valor</th> : null}
        </tr>
      </thead>
      <tbody>
        {lista.map((l) => (
          <tr key={l.id}>
            <td className="dc-tab-n">
              <span className="dc-num">{l.num}</span>
            </td>
            <td className="dc-tab-prod">{l.nome}</td>
            <td>{l.genero ? <span className={l.genero[1]}>{l.genero[0]}</span> : null}</td>
            <td className="dc-nd">{l.pecas}</td>
            {comPorPeca ? <td className="dc-nd">{reais(l.porPeca)}</td> : null}
            {comValor ? <td className="dc-nd dc-tab-b">{reais(l.total)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  )

  /* OS TOTAIS EM FAIXA. Uma célula por ajuste, e não uma de "desconto" fixa:
     a cotação pode ter acréscimo, desconto, os dois, ou nenhum. Sem ajuste, a
     célula do subtotal sai, porque ela repetiria o total ao lado. */
  const base = subtotal(c)
  const ajustes = comValor ? c.ajustes : []
  const celulas: { r: string; v: string }[] = comValor
    ? [
        { r: 'Peças', v: String(pecasDaCotacao(c)) },
        ...(ajustes.length ? [{ r: 'Subtotal', v: reais(base) }] : []),
        ...ajustes.map((a) => {
          const v = valorDoAjuste(a, base)
          const nome = a.descricao ? a.descricao.charAt(0).toUpperCase() + a.descricao.slice(1) : v < 0 ? 'Desconto' : 'Acréscimo'
          return {
            r: nome + (a.tipo === 'porcento' ? ' (' + Math.abs(a.valor).toLocaleString('pt-BR') + '%)' : ''),
            v: (v < 0 ? '- ' : '+ ') + reais(Math.abs(v)),
          }
        }),
      ]
    : []
  const metade = Math.ceil(linhas.length / 2)

  return (
    <section className="dc-n">
      <Titulo>{comValor ? 'Resumo do orçamento' : 'Resumo do pedido'}</Titulo>
      {dois ? (
        <div className="dc-duas">
          {tabela(linhas.slice(0, metade))}
          {tabela(linhas.slice(metade))}
        </div>
      ) : (
        tabela(linhas)
      )}
      <div className="dc-tf" style={{ '--dc-c': celulas.length + 1 } as CSSProperties}>
        {celulas.map((x) => (
          <div key={x.r}>
            <Rotulo>{x.r}</Rotulo>
            <b>{x.v}</b>
          </div>
        ))}
        <div className="dc-tf-tinta">
          <Rotulo>{comValor ? 'Total' : 'Peças'}</Rotulo>
          <b>{comValor ? reais(totalDaCotacao(c)) : pecasDaCotacao(c)}</b>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   3. CONDIÇÕES 2, "linha com ícones": numa linha só, separadas por riscos
   verticais, com o ícone vermelho solto.

   REGRA DE SISTEMA (seção 2 do 14): as condições não repetem o que o
   cabeçalho já mostra, e somem se nada sobrar. Com o prazo e o pagamento no
   cabeçalho, sobram o envio, a tabela e a validade; na folha da produção,
   sobram o prazo e o envio.
   ========================================================================== */
type Condicao = { k: string; r: string; v: string; icone: IconeDoPacote }

export function condicoesDaFolha(c: Cotacao, comValor: boolean): Condicao[] {
  const todas: Condicao[] = comValor
    ? [
        { k: 'prazo', r: 'Prazo de produção', v: c.informe.prazo, icone: Hourglass },
        { k: 'pagamento', r: 'Pagamento', v: c.informe.pagamento, icone: CreditCard },
        { k: 'entrega', r: 'Envio', v: c.informe.entrega, icone: Truck },
        { k: 'tabela', r: 'Tabela de preço', v: c.informe.tabelaDePreco, icone: Tag },
        { k: 'vale', r: 'Validade desta proposta', v: dataCurta(c.validaAte), icone: CalendarBlank },
      ]
    : [
        { k: 'prazo', r: 'Prazo de produção', v: c.informe.prazo, icone: Hourglass },
        { k: 'entrega', r: 'Envio', v: c.informe.entrega, icone: Truck },
        { k: 'envio', r: 'Data de envio', v: dataCurta(c.producao.dataDeEnvio), icone: CalendarBlank },
        { k: 'embalagem', r: 'Embalagem', v: c.producao.embalagem, icone: Package },
        { k: 'departamento', r: 'Departamento', v: c.producao.departamento, icone: Buildings },
      ]
  const noTopo = new Set(camposDoCabecalho(c, comValor).map((x) => x.k))
  return todas.filter((x) => !noTopo.has(x.k) && x.v)
}

export function CondicoesDaPaginaUm({ cotacao: c, comValor }: { cotacao: Cotacao; comValor: boolean }) {
  const itens = condicoesDaFolha(c, comValor)
  if (!itens.length) return null
  return (
    <section className="dc-n">
      <Titulo>Condições</Titulo>
      <div className="dc-cond" style={{ '--dc-c': itens.length } as CSSProperties}>
        {itens.map((x) => (
          <div key={x.k}>
            <span className="dc-ic">
              <x.icone size={13} />
            </span>
            <span>
              <Rotulo>{x.r}</Rotulo>
              <b>{x.v}</b>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ==========================================================================
   4. INFORMES 2, "numerados": duas colunas numeradas, o número em negrito.

   O padrão pede o título dividido "Sobre a produção | Termos". Hoje os
   informes da cotação são UMA lista só, sem dizer de qual grupo cada um é, e
   adivinhar pelo texto seria inventar. Então a lista corre em duas colunas,
   numerada de ponta a ponta, sob um título só. O grupo de cada informe é a
   pergunta que ficou para o Henrique (doc 12, item 41).
   ========================================================================== */
export function InformesDaPaginaUm({ cotacao: c, comValor }: { cotacao: Cotacao; comValor: boolean }) {
  const lista = c.informes.filter((x) => x.noDocumento && x.texto.trim())
  if (!lista.length) return null
  const metade = lista.length > 3 ? Math.ceil(lista.length / 2) : lista.length
  const colunas = [lista.slice(0, metade), lista.slice(metade)].filter((l) => l.length)
  return (
    <section className="dc-n">
      <Titulo>{comValor ? 'Informes e termos' : 'Informes à produção'}</Titulo>
      <div className="dc-inf" style={{ '--dc-c': colunas.length } as CSSProperties}>
        {colunas.map((col, k) => (
          <ol key={k}>
            {col.map((x, i) => (
              <li key={x.id}>
                <i className="dc-no">{(k ? metade : 0) + i + 1}</i>
                <span>{x.texto}</span>
              </li>
            ))}
          </ol>
        ))}
      </div>
    </section>
  )
}

/* ==========================================================================
   5. ACEITE 2, "lado a lado": o WhatsApp à esquerda e a assinatura à direita,
   na mesma altura. Só na folha com valor: quem corta não assina proposta.
   ========================================================================== */
export function AceiteDaPaginaUm({ cotacao: c }: { cotacao: Cotacao }) {
  return (
    <section className="dc-n">
      <Titulo>Aprovação</Titulo>
      <div className="dc-ace">
        <div className="dc-wa">
          <WhatsappLogo size={18} />
          <p>
            Para aprovar, responda <b>SIM</b> no WhatsApp da Fourtime, citando a cotação <b>{c.numero}</b>. A
            resposta vale como aprovação desta folha.
          </p>
        </div>
        <div className="dc-caixa">
          <div className="dc-ass">
            <div className="dc-as">
              <i />
              <small>{c.cliente.nome || 'Cliente'}</small>
            </div>
            <div className="dc-as">
              <i />
              <small>Data</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   6. RODAPÉ 1, "risco e duas pontas", em TODA página: a Fourtime, a cidade e
   o CNPJ à esquerda; as peças, o total e a página à direita. O total vai em
   todas, como o 14 pede: a folha solta precisa dizer de que pedido ela é.
   ========================================================================== */
export function RodapeDaFolhaNova({
  cotacao: c,
  comValor,
  numero,
  de,
}: {
  cotacao: Cotacao
  comValor: boolean
  numero: number
  de: number
}) {
  const cidade = [EMPRESA.cidade, EMPRESA.uf].filter(Boolean).join(', ')
  const conta = pecas(pecasDaCotacao(c)) + (comValor ? ' · ' + reais(totalDaCotacao(c)) : '')
  return (
    <div className="dc-n dc-pe">
      <span>
        <b>{EMPRESA.nome}</b>
        {cidade ? ' · ' + cidade : ''}
        {EMPRESA.cnpj ? ' · CNPJ ' + EMPRESA.cnpj : ''}
      </span>
      <span>
        <b>{conta}</b> · página {numero} de {de}
      </span>
    </div>
  )
}
