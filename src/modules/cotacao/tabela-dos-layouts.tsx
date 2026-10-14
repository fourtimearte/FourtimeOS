import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as EventoDeTecla } from 'react'
import { CaretDown, Check, Plus, Table, Warning, X } from '@phosphor-icons/react'
import { Flutuante, Marcacao, MenuTecidoECor, TituloCartao } from '@ds'
import {
  comEtiqueta,
  etiquetaDoDesign,
  hexDoBanco,
  type Bloco,
  type EtiquetaDoLayout,
  type TecidoDoBloco,
} from '@dominio/layout'
import {
  SEM_TABELA,
  pecasDoProduto,
  totalDoProduto,
  type Cotacao,
  type ProdutoCotado,
} from '@dominio/cotacao'
import { faltaNoLayout } from './coluna-dos-layouts'
import { TECNICAS, desligarTecnica, ligarTecnica, rotuloDaTecnica } from './design-do-layout'
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
  const limpo = t
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!limpo.trim()) return null
  const v = Number(limpo)
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
}

/* O PREÇO ESCRITO NA TABELA É O PREÇO DO LAYOUT INTEIRO: vale para todos
   os tamanhos. Ele deixa de seguir tabela, e saem junto o plus e o infantil
   que a tabela tinha dado e o preço próprio de cada tamanho escrito na grade.
   Sem isso a célula mostrava 55 e o subtotal continuava contando 62. */
const comPrecoEscrito = (p: ProdutoCotado, v: number): ProdutoCotado => ({
  ...p,
  precoBase: v,
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

  const marcar = (id: string, sim: boolean) =>
    setMarcados(m => {
      const n = new Set(m)
      if (sim) n.add(id)
      else n.delete(id)
      return n
    })
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

      <div className="ct-tb-rolo">
        <table className="ct-tb-tab">
          <thead>
            <tr>
              <th className="ct-tb-ck ct-tb-x-ck">
                {!travado ? (
                  <Marcacao
                    aria-label="Marcar todos"
                    checked={todasMarcadas}
                    meio={!todasMarcadas && marcadas.length > 0}
                    onChange={() =>
                      setMarcados(
                        todasMarcadas ? new Set() : new Set(linhas.map(({ p }) => p.bloco.id)),
                      )
                    }
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
                <tr key={b.id} className={marcado ? 'ct-tb-marcada' : undefined}>
                  <td className="ct-tb-ck ct-tb-x-ck">
                    {!travado ? (
                      <Marcacao
                        aria-label={'Marcar ' + codigoDoLayout(b.n)}
                        checked={marcado}
                        onChange={e => marcar(b.id, e.target.checked)}
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
}: {
  balao: Balao
  produtos: ProdutoCotado[]
  indicesMarcados: number[]
  aoMudarBloco: (i: number, b: Bloco) => void
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
          <EditorDoDesign bloco={p.bloco} travado={false} aoMudar={b => aoMudarBloco(balao.i, b)} />
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
    <div className="ct-tb-balao">
      <p className="ct-tb-balao-t">Técnicas dos {blocos.length} marcados</p>
      <div className="ct-chaves ct-chaves-5">
        {TECNICAS.map(t => {
          const todos = blocos.every(b => b.design.some(d => d.tag === t.tag))
          return (
            <Chave
              key={t.tag}
              tom={t.tom}
              ligada={todos}
              travado={false}
              rotulo={t.rotulo}
              titulo={todos ? 'Desligar em todos os marcados' : 'Ligar em todos os marcados'}
              aoAlternar={() =>
                indicesMarcados.forEach(i => {
                  const x = produtos[i]?.bloco
                  if (!x) return
                  const tem = x.design.some(d => d.tag === t.tag)
                  if (todos) aoMudarBloco(i, { ...x, design: desligarTecnica(x.design, t) })
                  else if (!tem) aoMudarBloco(i, { ...x, design: ligarTecnica(x.design, t) })
                })
              }
            />
          )
        })}
      </div>
      <p className="ct-tb-balao-nota">
        As cores de cada layout continuam as dele: elas mudam no balão do design da linha.
      </p>
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
}: {
  p: ProdutoCotado
  travado: boolean
  refEl: (el: HTMLInputElement | null) => void
  aoMudar: (v: number) => void
  aoDescer: () => void
}) {
  const [texto, setTexto] = useState<string | null>(null)
  const gravar = () => {
    if (texto == null) return
    const v = lerPreco(texto)
    setTexto(null)
    if (v != null && v !== p.precoBase) aoMudar(v)
  }
  const tecla = (e: EventoDeTecla<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      gravar()
      aoDescer()
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
          value={texto ?? n2(p.precoBase)}
          onFocus={e => {
            setTexto(n2(p.precoBase))
            e.currentTarget.select()
          }}
          onChange={e => setTexto(e.target.value)}
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
