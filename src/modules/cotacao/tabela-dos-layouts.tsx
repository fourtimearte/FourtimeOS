import { lerNumero } from '@shared'
import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as EventoDeTecla } from 'react'
import { CaretDown, Check, Plus, Table, Warning, X } from '@phosphor-icons/react'
import {
  Flutuante,
  Marcacao,
  MenuCodigoDeCor,
  MenuTecidoECor,
  TituloCartao,
  useSelecaoDeLinhas,
} from '@ds'
import {
  comEtiqueta,
  etiquetaDoDesign,
  hexDoBanco,
  usarAbasDeCor,
  type Bloco,
  type Design,
  type EtiquetaDoLayout,
  type TecidoDoBloco,
} from '@dominio/layout'
import {
  SEM_TABELA,
  pecasDoProduto,
  tabelaDoLayout,
  totalDoProduto,
  type Cotacao,
  type ProdutoCotado,
} from '@dominio/cotacao'
import { faltaNoLayout } from './coluna-dos-layouts'
import { MenuDoAplique } from './menu-do-aplique'
import {
  TECNICAS,
  desligarTecnica,
  dicaDoMenu,
  quantidadeDe,
  ligarTecnica,
  rotuloDaTecnica,
  tirarCor,
  type DaTecnica,
} from './design-do-layout'
import { SeletorDoModo, type ModoDoEditor } from './modo-do-editor'
import { Chave, ChavesDaEtiqueta, EditorDoDesign } from './pecas-da-ficha'
import { PrecoDoLayout, usarTabelasDaCotacao } from './tabelas-da-cotacao'
import { usarTecidosDoEstoque } from './usar-tecidos-do-estoque'
import './cotacao.css'

/* ==========================================================================
   O MODO TABELA DO EDITOR (14/10/2026, wireframe "Modo tabela da cotação").

   Uma linha por layout: a miniatura da arte, o layout, o gênero, o tecido, a
   etiqueta, o design, as peças, o preço por peça, a tabela de preço, o
   subtotal e o que falta. Tecido, etiqueta, design, preço e tabela mudam na
   própria célula; a etiqueta e o design abrem num balão com as MESMAS peças
   da ficha do layout (pecas-da-ficha.tsx).

   Marcar linhas abre a barra do lote: tecido, etiqueta, técnicas, preço e
   tabela valem para todas as marcadas de uma vez.

   Clicar na miniatura volta para o modo Lista já naquele layout.
   ========================================================================== */

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const n2 = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const codigoDoLayout = (n: number) => 'L-' + String(n).padStart(2, '0')

function lerPreco(t: string): number | null {
  const v = lerNumero(t.replace(/[^\d,.-]/g, ''))
  return v != null && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
}

/* O PREÇO ESCRITO NA TABELA É O PREÇO DO LAYOUT INTEIRO: vale para todos
   os tamanhos. Ele deixa de seguir tabela, e saem junto o plus e o infantil
   que a tabela tinha dado e o preço próprio de cada tamanho escrito na grade.
   Sem isso a célula mostrava 55 e o subtotal continuava contando 62. */
/* Desde a 083 o preço mostrado é a peça mais os adicionais; o layout que
   deixa de seguir tabela só guarda o DTF escrito na metragem, e por isso a
   peça fica com o resto. */
const metragemDe = (p: ProdutoCotado) => p.bloco.design.find((d) => d.tecnica === 'dtf')?.dtfPorPeca ?? 0
const precoDoLayoutInteiro = (p: ProdutoCotado) => Math.round((p.precoBase + (p.adicional ?? 0)) * 100) / 100
const comPrecoEscrito = (p: ProdutoCotado, v: number): ProdutoCotado => ({
  ...p,
  precoBase: Math.max(0, Math.round((v - metragemDe(p)) * 100) / 100),
  tabelaId: SEM_TABELA,
  precoDaTabela: undefined,
  precoPorTamanho: {},
})

const GENERO: Record<string, [string, string]> = {
  masculino: ['Masc', 'ct-tb-g-masc'],
  feminino: ['Fem', 'ct-tb-g-fem'],
  infantil: ['Inf', 'ct-tb-g-inf'],
}

type Balao =
  { tipo: 'etiqueta' | 'design'; i: number } | { tipo: 'lote-etiqueta' | 'lote-tecnicas' }

export function TabelaDosLayouts({
  cotacao,
  produtos,
  travado,
  modo,
  aoMudarModo,
  aoMudarProduto,
  aoAbrir,
  aoAdicionar,
}: {
  cotacao: Cotacao
  produtos: ProdutoCotado[]
  travado: boolean
  modo: ModoDoEditor
  aoMudarModo: (m: ModoDoEditor) => void
  aoMudarProduto: (i: number, troca: (p: ProdutoCotado) => ProdutoCotado) => void
  /** volta para o modo Lista com este layout aberto */
  aoAbrir: (i: number) => void
  aoAdicionar: () => void
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [soFalta, setSoFalta] = useState(false)
  const [balao, setBalao] = useState<Balao | null>(null)
  const ancoraDoBalao = useRef<HTMLElement | null>(null)
  /* o tecido: de uma linha (o índice) ou do lote (-1) */
  const [tecidoDe, setTecidoDe] = useState<number | null>(null)
  const ancoraDoTecido = useRef<HTMLElement | null>(null)
  const doEstoque = usarTecidosDoEstoque()
  const { todas, semBanco } = usarTabelasDaCotacao()
  const comTabela = !semBanco && todas.length > 0
  const precos = useRef<(HTMLInputElement | null)[]>([])

  const pecas = produtos.reduce((s, p) => s + pecasDoProduto(p), 0)
  const valor = produtos.reduce((s, p) => s + totalDoProduto(p), 0)
  const comFalta = produtos.filter(p => faltaNoLayout(p.bloco).length).length
  const linhas = produtos
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !soFalta || faltaNoLayout(p.bloco).length)
  /* o que sumiu da cotação sai da marcação */
  const ids = new Set(produtos.map(p => p.bloco.id))
  const marcadas = [...marcados].filter(id => ids.has(id))
  const indicesMarcados = produtos
    .map((p, i) => (marcados.has(p.bloco.id) ? i : -1))
    .filter(i => i >= 0)
  const primeiro = indicesMarcados.length ? produtos[indicesMarcados[0]] : null
  const todasMarcadas = linhas.length > 0 && linhas.every(({ p }) => marcados.has(p.bloco.id))

  /* a seleção do Kit de Comportamento: caixa, clique, Ctrl, Shift, Esc e Ctrl+A */
  const selecao = useSelecaoDeLinhas(
    linhas.map(({ p }) => p.bloco.id),
    marcados,
    novos => setMarcados(new Set(novos)),
  )
  const noLote = (troca: (p: ProdutoCotado) => ProdutoCotado) =>
    indicesMarcados.forEach(i => aoMudarProduto(i, troca))
  const mudarBloco = (i: number, b: Bloco) => aoMudarProduto(i, x => ({ ...x, bloco: b }))

  const abrirBalao = (b: Balao, el: HTMLElement) => {
    ancoraDoBalao.current = el
    setBalao(b)
  }

  function escolherTecido(novo: TecidoDoBloco) {
    if (tecidoDe == null) return
    if (tecidoDe < 0) {
      noLote(x => ({ ...x, bloco: { ...x.bloco, tecidos: [novo] } }))
      return
    }
    /* na linha, o tecido escolhido troca o primeiro e os outros ficam */
    aoMudarProduto(tecidoDe, x => ({
      ...x,
      bloco: { ...x.bloco, tecidos: [novo, ...x.bloco.tecidos.slice(1)] },
    }))
  }

  const tecidoNoMenu =
    tecidoDe != null && tecidoDe >= 0 ? produtos[tecidoDe]?.bloco.tecidos[0] : undefined

  return (
    <section className="cartao ct-tb">
      <header className="ct-tb-cab">
        <TituloCartao icone={Table}>Layouts</TituloCartao>
        <span className="ct-tb-conta">
          {produtos.length} {produtos.length === 1 ? 'layout' : 'layouts'} · {pecas} peças ·{' '}
          {dinheiro(valor)}
        </span>
        <SeletorDoModo modo={modo} aoMudar={aoMudarModo} />
      </header>

      {marcadas.length && !travado ? (
        <div className="ct-tb-lote" role="toolbar" aria-label="Mudar os layouts marcados">
          <span className="ct-tb-lote-q">
            <b>{marcadas.length}</b>
            {marcadas.length === 1 ? 'layout marcado' : 'layouts marcados'}
          </span>
          <button
            type="button"
            className="btn btn-contorno sm"
            onClick={e => {
              ancoraDoTecido.current = e.currentTarget
              setTecidoDe(-1)
            }}
          >
            Tecido
            <CaretDown size={14} />
          </button>
          <button
            type="button"
            className="btn btn-contorno sm"
            onClick={e => abrirBalao({ tipo: 'lote-etiqueta' }, e.currentTarget)}
          >
            Etiqueta
            <CaretDown size={14} />
          </button>
          <button
            type="button"
            className="btn btn-contorno sm"
            onClick={e => abrirBalao({ tipo: 'lote-tecnicas' }, e.currentTarget)}
          >
            Técnicas
            <CaretDown size={14} />
          </button>
          <PrecoDoLote aoAplicar={v => noLote(x => comPrecoEscrito(x, v))} />
          {comTabela && primeiro ? (
            <PrecoDoLayout
              c={cotacao}
              produto={primeiro}
              travado={false}
              compacto
              aoMudar={tabelaId => noLote(x => ({ ...x, tabelaId }))}
            />
          ) : null}
          <button
            type="button"
            className="btn btn-contorno sm icone ct-tb-lote-fim"
            aria-label="Desmarcar todos"
            title="Desmarcar todos"
            onClick={() => setMarcados(new Set())}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="ct-tb-ctl">
          <button
            type="button"
            className={soFalta ? 'ct-tb-filtro ligado' : 'ct-tb-filtro'}
            aria-pressed={soFalta}
            disabled={!comFalta && !soFalta}
            onClick={() => setSoFalta(x => !x)}
          >
            {soFalta ? <Check size={14} weight="bold" /> : null}
            Só o que falta preencher
            <em>{comFalta}</em>
          </button>
          {!travado ? (
            <button type="button" className="btn btn-contorno sm ct-tb-mais" onClick={aoAdicionar}>
              <Plus size={16} />
              Adicionar layout
            </button>
          ) : null}
        </div>
      )}

      <div className="ct-tb-rolo" onKeyDown={travado ? undefined : selecao.naTecla}>
        <table className="ct-tb-tab">
          <thead>
            <tr>
              <th className="ct-tb-ck ct-tb-x-ck">
                {!travado ? (
                  <Marcacao
                    aria-label="Marcar todos"
                    checked={todasMarcadas}
                    meio={!todasMarcadas && marcadas.length > 0}
                    onChange={() => selecao.todas(!todasMarcadas)}
                  />
                ) : null}
              </th>
              <th>Arte</th>
              <th>Layout</th>
              <th className="ct-tb-x-gen">Gênero</th>
              <th className="ct-tb-x-tec">Tecido</th>
              <th className="ct-tb-x-eti">Etiqueta</th>
              <th className="ct-tb-x-des">Design</th>
              <th className="ct-tb-num ct-tb-x-pc">Peças</th>
              <th>Preço por peça</th>
              {comTabela ? <th className="ct-tb-x-tab">Tabela de preço</th> : null}
              <th className="ct-tb-num ct-tb-x-sub">Subtotal</th>
              <th>
                <span className="ct-tb-x-rot">Conferência</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ p, i }, k) => {
              const b = p.bloco
              const falta = faltaNoLayout(b)
              const marcado = marcados.has(b.id)
              const tc = b.tecidos[0]
              const g = GENERO[b.genero]
              return (
                <tr
                  key={b.id}
                  className={marcado ? 'ct-tb-marcada' : undefined}
                  aria-selected={marcado}
                  onClick={travado ? undefined : e => selecao.naLinha(b.id, e)}
                >
                  <td className="ct-tb-ck ct-tb-x-ck">
                    {!travado ? (
                      <Marcacao
                        aria-label={'Marcar ' + codigoDoLayout(b.n)}
                        checked={marcado}
                        onChange={() => {}}
                        onClick={e => selecao.naCaixa(b.id, e)}
                      />
                    ) : null}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ct-tb-mini"
                      title={'Abrir o ' + codigoDoLayout(b.n) + ' no modo Lista'}
                      aria-label={'Abrir o ' + codigoDoLayout(b.n) + ' no modo Lista'}
                      onClick={() => aoAbrir(i)}
                    >
                      {b.imagem ? <img src={b.imagem} alt="" /> : <span>sem arte</span>}
                    </button>
                  </td>
                  <td className="ct-tb-ly">
                    <b>
                      {codigoDoLayout(b.n)} ·{' '}
                      {b.nomeDaReferencia || b.referencia || 'sem referência'}
                    </b>
                    <small>
                      {b.referencia || 'sem código'}
                      <span className="ct-tb-so-cel"> · {pecasDoProduto(p)} pçs</span>
                    </small>
                  </td>
                  <td className="ct-tb-x-gen">
                    {g ? (
                      <span className={'ct-tb-gen ' + g[1]}>{g[0]}</span>
                    ) : (
                      <small className="ct-tb-nada">sem</small>
                    )}
                  </td>
                  <td className="ct-tb-x-tec">
                    <button
                      type="button"
                      className="ct-tb-cel ct-tb-tecido"
                      disabled={travado}
                      onClick={e => {
                        ancoraDoTecido.current = e.currentTarget
                        setTecidoDe(i)
                      }}
                    >
                      {tc && tc.nome ? (
                        <>
                          <i
                            className="ct-tb-sw"
                            style={tc.hex ? ({ '--cor': tc.hex } as CSSProperties) : undefined}
                          />
                          <span className="ct-tb-txt">
                            <b>{tc.nome}</b>
                            <small>
                              {tc.cor || 'sem cor'}
                              {b.tecidos.length > 1 ? ` · mais ${b.tecidos.length - 1}` : ''}
                            </small>
                          </span>
                        </>
                      ) : (
                        <span className="ct-tb-nada">
                          <Plus size={13} />
                          tecido
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="ct-tb-x-eti">
                    <button
                      type="button"
                      className="ct-tb-cel"
                      disabled={travado}
                      onClick={e => abrirBalao({ tipo: 'etiqueta', i }, e.currentTarget)}
                    >
                      <EtiquetaNaCelula b={b} />
                    </button>
                  </td>
                  <td className="ct-tb-x-des">
                    <button
                      type="button"
                      className="ct-tb-cel"
                      disabled={travado}
                      onClick={e => abrirBalao({ tipo: 'design', i }, e.currentTarget)}
                    >
                      <DesignNaCelula b={b} />
                    </button>
                  </td>
                  <td className="ct-tb-num ct-tb-x-pc">
                    <b>{pecasDoProduto(p)}</b>
                  </td>
                  <td>
                    <CampoDoPreco
                      p={p}
                      travado={travado}
                      refEl={el => {
                        precos.current[k] = el
                      }}
                      aoMudar={v => aoMudarProduto(i, x => comPrecoEscrito(x, v))}
                      aoDescer={() => precos.current[k + 1]?.focus()}
                      aoSubir={() => precos.current[k - 1]?.focus()}
                      aoColar={valores =>
                        valores.forEach((v, j) => {
                          const alvo = linhas[k + j]
                          if (alvo) aoMudarProduto(alvo.i, x => comPrecoEscrito(x, v))
                        })
                      }
                    />
                  </td>
                  {comTabela ? (
                    <td className="ct-tb-x-tab">
                      <PrecoDoLayout
                        c={cotacao}
                        produto={p}
                        travado={travado}
                        compacto
                        aoMudar={tabelaId => aoMudarProduto(i, x => ({ ...x, tabelaId }))}
                      />
                    </td>
                  ) : null}
                  <td className="ct-tb-num ct-tb-x-sub">
                    <b>{dinheiro(totalDoProduto(p))}</b>
                  </td>
                  <td>
                    {falta.length ? (
                      <span className="ct-tb-placa" title={falta.join(', ')}>
                        <Warning size={14} weight="fill" />
                        <span>{falta.join(', ')}</span>
                      </span>
                    ) : (
                      <span className="ct-tb-ok" title="Tudo preenchido">
                        <Check size={16} weight="bold" />
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="ct-tb-x-ck" />
              <td colSpan={2}>
                {linhas.length === produtos.length
                  ? `${produtos.length} ${produtos.length === 1 ? 'layout' : 'layouts'}`
                  : `${linhas.length} de ${produtos.length} layouts`}
              </td>
              <td className="ct-tb-x-gen" />
              <td className="ct-tb-x-tec" />
              <td className="ct-tb-x-eti" />
              <td className="ct-tb-x-des" />
              <td className="ct-tb-num ct-tb-x-pc">
                <b>{linhas.reduce((s, { p }) => s + pecasDoProduto(p), 0)}</b>
              </td>
              <td />
              {comTabela ? <td className="ct-tb-x-tab" /> : null}
              <td className="ct-tb-num ct-tb-x-sub">
                <b>{dinheiro(linhas.reduce((s, { p }) => s + totalDoProduto(p), 0))}</b>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <MenuTecidoECor
        aberto={tecidoDe != null}
        ancora={ancoraDoTecido}
        aoFechar={() => setTecidoDe(null)}
        grupos={doEstoque.grupos}
        tecido={tecidoNoMenu?.nome ?? ''}
        cor={tecidoNoMenu?.cor ?? ''}
        semTecidos={
          doEstoque.fase === 'falhou'
            ? 'Não consegui ler o estoque: ' + doEstoque.falha
            : doEstoque.fase === 'pronto'
              ? 'Nenhum tecido com cor cadastrada no Estoque'
              : 'Carregando os tecidos do estoque...'
        }
        aoEscolher={(t, c) =>
          escolherTecido({ nome: t.nome, cor: c.nome, hex: c.hex, materialId: c.id })
        }
      />

      <Flutuante
        aberto={!!balao}
        ancora={ancoraDoBalao}
        aoFechar={() => setBalao(null)}
        opcoes={{ alinhar: 'esquerda' }}
        versao={balao && 'i' in balao ? produtos[balao.i]?.bloco.design : marcadas.length}
      >
        {balao ? (
          <ConteudoDoBalao
            balao={balao}
            produtos={produtos}
            indicesMarcados={indicesMarcados}
            aoMudarBloco={mudarBloco}
            tabelaDe={i => (produtos[i] ? tabelaDoLayout(cotacao, produtos[i]) : '')}
          />
        ) : null}
      </Flutuante>
    </section>
  )
}

function ConteudoDoBalao({
  balao,
  produtos,
  indicesMarcados,
  aoMudarBloco,
  tabelaDe,
}: {
  balao: Balao
  produtos: ProdutoCotado[]
  indicesMarcados: number[]
  aoMudarBloco: (i: number, b: Bloco) => void
  /** a tabela de preço do layout i (as opções do Patch e do Bordado) */
  tabelaDe: (i: number) => string
}) {
  if (balao.tipo === 'etiqueta' || balao.tipo === 'design') {
    const p = produtos[balao.i]
    if (!p) return null
    return (
      <div className="ct-tb-balao">
        <p className="ct-tb-balao-t">
          {balao.tipo === 'etiqueta' ? 'Etiqueta' : 'Design'} do {codigoDoLayout(p.bloco.n)}
        </p>
        {balao.tipo === 'etiqueta' ? (
          <ChavesDaEtiqueta
            bloco={p.bloco}
            travado={false}
            aoMudar={b => aoMudarBloco(balao.i, b)}
          />
        ) : (
          <EditorDoDesign bloco={p.bloco} travado={false} aoMudar={b => aoMudarBloco(balao.i, b)} tabelaId={tabelaDe(balao.i)} />
        )}
      </div>
    )
  }
  const blocos = indicesMarcados.map(i => produtos[i]?.bloco).filter((b): b is Bloco => !!b)
  if (!blocos.length) return null
  if (balao.tipo === 'lote-etiqueta') {
    /* o primeiro marcado mostra o estado; o que se escolhe vale para todos */
    const aplicar = (b: Bloco) => {
      const e: EtiquetaDoLayout = etiquetaDoDesign(b.design)
      indicesMarcados.forEach(i => {
        const x = produtos[i]?.bloco
        if (x) aoMudarBloco(i, { ...x, design: comEtiqueta(x.design, e) })
      })
    }
    return (
      <div className="ct-tb-balao">
        <p className="ct-tb-balao-t">Etiqueta dos {blocos.length} marcados</p>
        <ChavesDaEtiqueta bloco={blocos[0]} travado={false} aoMudar={aplicar} />
      </div>
    )
  }
  return (
    <DesignDoLote
      blocos={blocos}
      indices={indicesMarcados}
      produtos={produtos}
      aoMudarBloco={aoMudarBloco}
      tabelas={indicesMarcados.map(tabelaDe)}
    />
  )
}

/* O DESIGN DOS MARCADOS DE UMA VEZ (14/10/2026: "cores devem ser possível de
   selecionar no modo bulk edit de vários de uma vez só"). As mesmas peças do
   design da ficha, valendo para todos os marcados:
   - o interruptor está ligado quando TODOS têm a técnica; o clique desliga
     em todos ou liga nos que faltam;
   - a paleta de Sub e de DTF mostra a soma das cores dos marcados; a cor que
     só parte deles tem vem tracejada, com a conta (3/7);
   - escolher uma cor na paleta põe ela em todos (ligando a técnica onde
     faltava); a que todos já têm sai de todos;
   - o botão direito em cima da cor tira de todos, como na ficha;
   - o botão direito no Bordado e no Patch escolhe P, M ou G para todos. */
function DesignDoLote({
  blocos,
  indices,
  produtos,
  aoMudarBloco,
  tabelas,
}: {
  blocos: Bloco[]
  indices: number[]
  produtos: ProdutoCotado[]
  aoMudarBloco: (i: number, b: Bloco) => void
  /** as tabelas de preço dos marcados (as opções do Patch e do Bordado) */
  tabelas: string[]
}) {
  const coresDoBanco = usarAbasDeCor()
  const [paleta, setPaleta] = useState<DaTecnica | null>(null)
  const ancora = useRef<HTMLElement | null>(null)
  const [doTamanho, setDoTamanho] = useState<DaTecnica | null>(null)
  const ancoraDoTamanho = useRef<HTMLElement | null>(null)
  const n = blocos.length

  /* muda o design de cada marcado; quem não muda não é tocado */
  const emTodos = (troca: (design: Design[]) => Design[]) =>
    indices.forEach(i => {
      const x = produtos[i]?.bloco
      if (!x) return
      const novo = troca(x.design)
      if (novo !== x.design) aoMudarBloco(i, { ...x, design: novo })
    })
  const tem = (b: Bloco, t: DaTecnica) => b.design.some(d => d.tag === t.tag)
  const temCor = (b: Bloco, t: DaTecnica, cod: string) =>
    !!b.design.find(d => d.tag === t.tag)?.cores.some(c => c.cod === cod)

  /* põe a cor em todos (ligando a técnica onde faltava) ou tira de todos */
  const porCor = (t: DaTecnica, cod: string, hex: string, sim: boolean) =>
    emTodos(design => {
      if (!sim)
        return design.some(d => d.tag === t.tag && d.cores.some(c => c.cod === cod))
          ? tirarCor(design, t.tag, cod)
          : design
      const ligado = design.some(d => d.tag === t.tag) ? design : ligarTecnica(design, t)
      return ligado.some(d => d.tag === t.tag && d.cores.some(c => c.cod === cod))
        ? ligado
        : ligado.map(d => (d.tag === t.tag ? { ...d, cores: [...d.cores, { cod, hex }] } : d))
    })

  const comCor = TECNICAS.filter(t => t.cor && blocos.some(b => tem(b, t)))
  /* a soma das cores dos marcados, na ordem em que aparecem */
  const coresDe = (t: DaTecnica) => {
    const vistas = new Map<string, { cod: string; hex: string; quantos: number }>()
    for (const b of blocos)
      for (const c of b.design.find(d => d.tag === t.tag)?.cores ?? []) {
        const v = vistas.get(c.cod)
        if (v) v.quantos += 1
        else vistas.set(c.cod, { cod: c.cod, hex: c.hex, quantos: 1 })
      }
    return [...vistas.values()]
  }
  const abrirPaleta = (t: DaTecnica, el: HTMLElement) => {
    ancora.current = el
    setPaleta(t)
  }
  /* o que todos os marcados têm igual no aplique, para o rótulo do
     interruptor e para o menu do botão direito */
  const comum = (t: DaTecnica) => {
    const ds = blocos.map(b => b.design.find(d => d.tag === t.tag))
    const igual = (f: (d: (typeof ds)[number]) => string | number) => {
      const vs = ds.map(f)
      return vs.every(v => v === vs[0]) ? vs[0] : null
    }
    return {
      tamanho: String(igual(d => d?.tamanho ?? '') ?? ''),
      tipo: String(igual(d => d?.tipoDePatch ?? '') ?? ''),
      quantidade: igual(d => quantidadeDe(d)) as number | null,
      design: ds.every(Boolean) ? ds[0] : undefined,
    }
  }

  return (
    <div className="ct-tb-balao">
      <p className="ct-tb-balao-t">Design dos {n} marcados</p>
      <div className="ct-chaves ct-chaves-5">
        {TECNICAS.map(t => {
          const todos = blocos.every(b => tem(b, t))
          const c = t.menu ? comum(t) : null
          const igual = c?.design
            ? { ...c.design, tamanho: c.tamanho as Design['tamanho'], tipoDePatch: (c.tipo || undefined) as Design['tipoDePatch'], quantidade: c.quantidade ?? undefined }
            : undefined
          return (
            <Chave
              key={t.tag}
              tom={t.tom}
              ligada={todos}
              travado={false}
              rotulo={rotuloDaTecnica(t, igual)}
              titulo={
                (todos ? 'Desligar em todos os marcados' : 'Ligar em todos os marcados') +
                (t.menu ? '. ' + dicaDoMenu(t) + ' para todos' : '')
              }
              aoAlternar={() =>
                emTodos(design =>
                  todos
                    ? desligarTecnica(design, t)
                    : design.some(d => d.tag === t.tag)
                      ? design
                      : ligarTecnica(design, t),
                )
              }
              aoMenu={
                t.menu
                  ? el => {
                      ancoraDoTamanho.current = el
                      setDoTamanho(t)
                    }
                  : undefined
              }
            />
          )
        })}
      </div>
      {comCor.length ? (
        <div className="ct-paletas">
          {comCor.map(t => (
            <div key={t.tag} className={'ct-paleta ' + t.tom}>
              <span className="ct-paleta-nome">{t.rotulo}</span>
              {coresDe(t).map(c => {
                const parcial = c.quantos < n
                return (
                  <button
                    key={c.cod}
                    type="button"
                    className={parcial ? 'ct-cartao-cor ct-cartao-parcial' : 'ct-cartao-cor'}
                    title={
                      'Cor ' +
                      c.cod +
                      (parcial ? ` em ${c.quantos} de ${n} marcados` : ' em todos os marcados') +
                      ': clique para abrir a paleta, botão direito tira de todos'
                    }
                    onContextMenu={e => {
                      e.preventDefault()
                      porCor(t, c.cod, c.hex, false)
                    }}
                    onClick={e => abrirPaleta(t, e.currentTarget)}
                  >
                    <i style={{ '--cor': hexDoBanco(c.cod, c.hex) } as CSSProperties} />
                    <b>{c.cod}</b>
                    {parcial ? (
                      <em className="ct-cartao-conta">
                        {c.quantos}/{n}
                      </em>
                    ) : null}
                  </button>
                )
              })}
              <button
                type="button"
                className="ct-cartao-cor ct-cartao-mais"
                aria-label={'Acrescentar cor em ' + t.rotulo + ' nos marcados'}
                title="Acrescentar cor em todos os marcados"
                onClick={e => abrirPaleta(t, e.currentTarget)}
              >
                <Plus size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <MenuCodigoDeCor
        aberto={!!paleta}
        ancora={ancora}
        aoFechar={() => setPaleta(null)}
        abas={coresDoBanco.abas.filter(a => !paleta || a.id === paleta.aba)}
        semCores={
          coresDoBanco.fase === 'falhou'
            ? 'Não consegui ler as cores do banco: ' + coresDoBanco.falha
            : 'Carregando as cores do banco...'
        }
        /* marcada na paleta é a cor que TODOS os marcados já têm */
        noLayout={
          paleta
            ? coresDe(paleta)
                .filter(c => c.quantos === n)
                .map(c => c.cod)
            : []
        }
        aoAlternar={(cod, hex) => {
          if (!paleta) return
          porCor(paleta, cod, hex, !blocos.every(b => temCor(b, paleta, cod)))
        }}
      />
      <MenuDoAplique
        t={doTamanho}
        ancora={ancoraDoTamanho}
        aoFechar={() => setDoTamanho(null)}
        atual={doTamanho ? comum(doTamanho) : { tamanho: '', tipo: '', quantidade: 1 }}
        aplicar={muda => emTodos(muda)}
        nosMarcados={n}
        tabelas={tabelas}
      />
    </div>
  )
}

function EtiquetaNaCelula({ b }: { b: Bloco }) {
  const e = etiquetaDoDesign(b.design)
  if (!e.tipo)
    return (
      <span className="ct-tb-nada">
        <Plus size={13} />
        etiqueta
      </span>
    )
  const tec =
    e.tecnica === 'sub'
      ? ['Sub', 'ct-ch-subli']
      : e.tecnica === 'dtf'
        ? ['DTF', 'ct-ch-dtf']
        : e.tecnica === 'silk'
          ? ['Silk', 'ct-ch-silk']
          : null
  return (
    <span className="ct-tb-pils">
      <span
        className={
          'ct-chave ct-chave-on ' + (e.tipo === 'fourtime' ? 'ct-ch-fourtime' : 'ct-ch-cliente')
        }
      >
        {e.tipo === 'fourtime' ? 'Fourtime' : 'Cliente'}
      </span>
      {tec ? <span className={'ct-chave ct-chave-on ' + tec[1]}>{tec[0]}</span> : null}
    </span>
  )
}

function DesignNaCelula({ b }: { b: Bloco }) {
  const ligadas = TECNICAS.filter(t => b.design.some(d => d.tag === t.tag))
  if (!ligadas.length)
    return (
      <span className="ct-tb-nada">
        <Plus size={13} />
        técnica
      </span>
    )
  return (
    <span className="ct-tb-pils">
      {ligadas.map(t => {
        const d = b.design.find(x => x.tag === t.tag)!
        return (
          <span key={t.tag} className={'ct-tb-tec ' + t.tom}>
            <span className={'ct-chave ct-chave-on ' + t.tom}>{rotuloDaTecnica(t, d)}</span>
            {d.cores.map(c => (
              <span key={c.cod} className="ct-tb-cq" title={'Cor ' + c.cod}>
                <i style={{ '--cor': hexDoBanco(c.cod, c.hex) } as CSSProperties} />
                <b>{c.cod}</b>
              </span>
            ))}
          </span>
        )
      })}
    </span>
  )
}

function CampoDoPreco({
  p,
  travado,
  refEl,
  aoMudar,
  aoDescer,
  aoSubir,
  aoColar,
}: {
  p: ProdutoCotado
  travado: boolean
  refEl: (el: HTMLInputElement | null) => void
  aoMudar: (v: number) => void
  aoDescer: () => void
  aoSubir: () => void
  /** um bloco colado da planilha: um preço por linha, desta para baixo */
  aoColar: (valores: number[]) => void
}) {
  const [texto, setTexto] = useState<string | null>(null)
  const gravar = () => {
    if (texto == null) return
    const v = lerPreco(texto)
    setTexto(null)
    if (v != null && v !== precoDoLayoutInteiro(p)) aoMudar(v)
  }
  const tecla = (e: EventoDeTecla<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      gravar()
      if (e.shiftKey) aoSubir()
      else aoDescer()
    }
    if (e.key === 'Escape') {
      setTexto(null)
      e.currentTarget.blur()
    }
  }
  return (
    <span className="ct-tb-preco-cel">
      <label className="ct-tb-preco">
        <span>R$</span>
        <input
          ref={refEl}
          inputMode="decimal"
          disabled={travado}
          aria-label={'Preço por peça do ' + codigoDoLayout(p.bloco.n)}
          value={texto ?? n2(precoDoLayoutInteiro(p))}
          onFocus={e => {
            setTexto(n2(precoDoLayoutInteiro(p)))
            e.currentTarget.select()
          }}
          onChange={e => setTexto(e.target.value)}
          onPaste={e => {
            /* colar uma coluna da planilha preenche desta linha para baixo */
            const linhas = e.clipboardData
              .getData('text')
              .split(/\r?\n/)
              .filter(x => x.trim() !== '')
            if (linhas.length < 2) return
            e.preventDefault()
            const valores = linhas.map(x => lerPreco(x.split('\t')[0]))
            if (valores.some(v => v == null)) return
            setTexto(null)
            aoColar(valores as number[])
            e.currentTarget.blur()
          }}
          onBlur={gravar}
          onKeyDown={tecla}
        />
      </label>
    </span>
  )
}

function PrecoDoLote({ aoAplicar }: { aoAplicar: (v: number) => void }) {
  const [texto, setTexto] = useState('')
  const aplicar = () => {
    const v = lerPreco(texto)
    if (v == null) return
    aoAplicar(v)
    setTexto('')
  }
  return (
    <span className="ct-tb-lote-preco">
      <label className="ct-tb-preco">
        <span>R$</span>
        <input
          inputMode="decimal"
          aria-label="Preço por peça dos marcados"
          placeholder="Preço"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') aplicar()
          }}
        />
      </label>
      <button
        type="button"
        className="btn btn-contorno sm"
        disabled={lerPreco(texto) == null}
        onClick={aplicar}
      >
        Aplicar preço
      </button>
    </span>
  )
}
