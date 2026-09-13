import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { abrirDica, fecharDica, Flutuante, semAcento } from './flutuante'
import type { Tecnica } from './superficie'

/* ==========================================================================
   Os cinco menus do modulo de layout.

   Eles sao genericos de proposito: as listas chegam por propriedade. O banco
   de verdade mora fora do ds/, porque o Design System nao pode conhecer o
   dominio. O que esta aqui e a mecanica: camada do topo, largura medida pela
   lista, busca sem acento, Enter escolhe o primeiro, Esc fecha sem mudar nada.
   ========================================================================== */

type Base = {
  aberto: boolean
  ancora: RefObject<HTMLElement | null>
  aoFechar: () => void
}

/* --- pecas comuns -------------------------------------------------------- */
function Lupa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function CampoDeBusca({
  valor,
  aoMudar,
  convite,
  campo,
  aoEnter,
}: {
  valor: string
  aoMudar: (v: string) => void
  convite: string
  campo: RefObject<HTMLInputElement | null>
  aoEnter?: () => void
}) {
  return (
    <div className={['mn-busca', valor ? 'tem' : ''].filter(Boolean).join(' ')}>
      <Lupa />
      <input
        ref={campo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={convite}
        aria-label={convite}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && aoEnter) {
            e.preventDefault()
            aoEnter()
          }
        }}
      />
      <button
        type="button"
        className="mn-limpa"
        aria-label="Limpar a busca"
        onClick={() => aoMudar('')}
      >
        &times;
      </button>
    </div>
  )
}

/* foco na busca ao abrir */
function useFocoAoAbrir(
  aberto: boolean,
  campo: RefObject<HTMLInputElement | null>,
  limpar: () => void,
) {
  useEffect(() => {
    if (!aberto) return
    limpar()
    const t = setTimeout(() => campo.current?.focus(), 20)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])
}

const COR_GENERO: Record<string, string> = {
  masculino: 'var(--gen-m)',
  feminino: 'var(--gen-f)',
  infantil: 'var(--gen-i)',
  '': 'var(--border-2)',
}

const SETA = '▼'
const VISTO = '✓'

/* --- 1. menu de referencia ---------------------------------------------- */
export type Referencia = { cod: string; nome: string; genero: string; categoria: string }

export function MenuReferencia({
  aberto,
  ancora,
  aoFechar,
  refs,
  categorias,
  ordem,
  valor,
  aoEscolher,
  aoCriar,
}: Base & {
  refs: Referencia[]
  categorias: Record<string, string>
  ordem: string[]
  valor?: string
  aoEscolher: (r: Referencia) => void
  aoCriar?: (texto: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [abertos, setAbertos] = useState<string[]>([])
  const campo = useRef<HTMLInputElement>(null)
  useFocoAoAbrir(aberto, campo, () => setBusca(''))

  const b = semAcento(busca.trim())
  const achados = useMemo(
    () => (b ? refs.filter((r) => semAcento(r.cod + ' ' + r.nome).includes(b)) : refs),
    [refs, b],
  )

  const grupos = useMemo(
    () =>
      ordem
        .map((c) => ({
          cod: c,
          nome: categorias[c] ?? c,
          itens: achados.filter((r) => r.categoria === c),
        }))
        .filter((g) => g.itens.length),
    [ordem, categorias, achados],
  )

  /* buscando, o grupo com resultado abre sozinho; parado, abre o da escolhida */
  const grupoDaEscolhida = refs.find((r) => r.cod === valor)?.categoria
  const efetivos = b ? grupos.map((g) => g.cod) : [...abertos, grupoDaEscolhida ?? '']

  return (
    <Flutuante
      aberto={aberto}
      ancora={ancora}
      aoFechar={aoFechar}
      opcoes={{ centro: true, maior: true, medirPelaLista: true }}
      versao={b + '|' + efetivos.join(',')}
    >
      <div className="mn-topo">
        <CampoDeBusca
          valor={busca}
          aoMudar={setBusca}
          convite="Buscar referência ou código"
          campo={campo}
          aoEnter={() => {
            const primeira = grupos[0]?.itens[0]
            if (primeira) {
              aoEscolher(primeira)
              aoFechar()
            }
          }}
        />
      </div>

      <div className="mn-lista">
        {grupos.length === 0 ? (
          <div className="mn-vazio">Nenhuma referência com esse nome</div>
        ) : (
          grupos.map((g) => {
            const temEscolhida = g.itens.some((r) => r.cod === valor)
            const generos = [...new Set(g.itens.map((r) => r.genero))]
            const abertoG = efetivos.includes(g.cod)
            return (
              <div
                key={g.cod}
                className={['mn-g', abertoG ? 'aberto' : ''].filter(Boolean).join(' ')}
              >
                <button
                  type="button"
                  className="mn-grupo"
                  onClick={() =>
                    setAbertos((a) =>
                      a.includes(g.cod) ? a.filter((x) => x !== g.cod) : [...a, g.cod],
                    )
                  }
                >
                  <span className="mn-tarjas">
                    {generos.map((x) => (
                      <i key={x} style={{ '--c': COR_GENERO[x] } as CSSProperties} />
                    ))}
                  </span>
                  <span className="nm">{g.nome}</span>
                  {temEscolhida ? <span className="marca" /> : null}
                  <span className="qt">{g.itens.length}</span>
                  <span className="seta">{SETA}</span>
                </button>
                <div className="mn-corpo">
                  {g.itens.map((r) => (
                    <button
                      type="button"
                      key={r.cod}
                      className={['mn-ref', r.cod === valor ? 'on' : ''].filter(Boolean).join(' ')}
                      onClick={() => {
                        aoEscolher(r)
                        aoFechar()
                      }}
                      onMouseEnter={(e) =>
                        abrirDica(e.currentTarget, '<b>' + r.cod + '</b>' + r.nome)
                      }
                      onMouseLeave={fecharDica}
                    >
                      <span
                        className="tarja"
                        style={{ '--g': COR_GENERO[r.genero] } as CSSProperties}
                      />
                      <span className="cod">{r.cod}</span>
                      <span className="nm">{r.nome}</span>
                      <span className="ok">{VISTO}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}

        {busca.trim() && aoCriar ? (
          <button
            type="button"
            className="mn-item mn-novo"
            onClick={() => {
              aoCriar(busca.trim())
              aoFechar()
            }}
          >
            usar &ldquo;{busca.trim()}&rdquo;
          </button>
        ) : null}
      </div>
    </Flutuante>
  )
}

/* As bolinhas de genero vivem na ponta do campo, nao dentro do menu. O estado e
   lido em CSS do data-genero do proprio combo, sem estado em JavaScript. */
export function BolinhasDeGenero({
  genero,
  aoEscolher,
}: {
  genero: string
  aoEscolher: (g: string) => void
}) {
  const bolas: [string, string, string][] = [
    ['g-0', '', 'Sem gênero'],
    ['g-M', 'masculino', 'Masculino'],
    ['g-F', 'feminino', 'Feminino'],
    ['g-C', 'infantil', 'Infantil'],
  ]
  return (
    <span className="ref-gen" data-genero={genero}>
      {bolas.map(([cls, g, titulo]) => (
        <button
          key={cls}
          type="button"
          className={'ref-gen-bt ' + cls}
          style={{ '--g': COR_GENERO[g] } as CSSProperties}
          title={titulo}
          aria-label={titulo}
          onClick={() => aoEscolher(g)}
        />
      ))}
    </span>
  )
}

/* --- 2. menu de tecido --------------------------------------------------- */
export type TipoDeTecido = { cod: string; nome: string; itens: string[] }

export function MenuTecido({
  aberto,
  ancora,
  aoFechar,
  tipos,
  valor,
  aoEscolher,
  aoCriar,
}: Base & {
  tipos: TipoDeTecido[]
  valor?: string
  aoEscolher: (nome: string) => void
  aoCriar?: (texto: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [abertos, setAbertos] = useState<string[]>([])
  const campo = useRef<HTMLInputElement>(null)
  useFocoAoAbrir(aberto, campo, () => setBusca(''))

  const b = semAcento(busca.trim())
  /* a busca casa tambem com o nome do tipo: viscose traz as duas viscoses */
  const grupos = useMemo(
    () =>
      tipos
        .map((t) => {
          const tipoBate = b !== '' && semAcento(t.nome).includes(b)
          return {
            ...t,
            itens: b && !tipoBate ? t.itens.filter((n) => semAcento(n).includes(b)) : t.itens,
          }
        })
        .filter((t) => t.itens.length),
    [tipos, b],
  )

  const tipoDaEscolhida = tipos.find((t) => t.itens.includes(valor ?? ''))?.cod
  const efetivos = b ? grupos.map((g) => g.cod) : [...abertos, tipoDaEscolhida ?? ' ']

  return (
    <Flutuante
      aberto={aberto}
      ancora={ancora}
      aoFechar={aoFechar}
      opcoes={{ centro: true, maior: true, medirPelaLista: true }}
      versao={b + '|' + efetivos.join(',')}
    >
      <div className="mn-topo">
        <CampoDeBusca
          valor={busca}
          aoMudar={setBusca}
          convite="Buscar tecido ou tipo"
          campo={campo}
          aoEnter={() => {
            const primeiro = grupos[0]?.itens[0]
            if (primeiro) {
              aoEscolher(primeiro)
              aoFechar()
            }
          }}
        />
      </div>

      <div className="mn-lista">
        {grupos.length === 0 ? (
          <div className="mn-vazio">Nenhum tecido com esse nome</div>
        ) : (
          grupos.map((t) => {
            const abertoG = efetivos.includes(t.cod)
            return (
              <div
                key={t.cod || 'sem'}
                className={['mn-g', abertoG ? 'aberto' : ''].filter(Boolean).join(' ')}
              >
                <button
                  type="button"
                  className="mn-grupo"
                  onClick={() =>
                    setAbertos((a) =>
                      a.includes(t.cod) ? a.filter((x) => x !== t.cod) : [...a, t.cod],
                    )
                  }
                >
                  {t.cod ? <span className="past">{t.cod}</span> : null}
                  <span className="nm">{t.nome}</span>
                  {t.itens.includes(valor ?? '') ? <span className="marca" /> : null}
                  <span className="qt">{t.itens.length}</span>
                  <span className="seta">{SETA}</span>
                </button>
                <div className="mn-corpo">
                  {t.itens.map((n) => (
                    <button
                      type="button"
                      key={n}
                      className={['mn-tec', n === valor ? 'on' : ''].filter(Boolean).join(' ')}
                      onClick={() => {
                        aoEscolher(n)
                        aoFechar()
                      }}
                    >
                      <span className="nm">{n}</span>
                      <span className="ok">{VISTO}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}

        {busca.trim() && aoCriar ? (
          <button
            type="button"
            className="mn-item mn-novo"
            onClick={() => {
              aoCriar(busca.trim())
              aoFechar()
            }}
          >
            usar &ldquo;{busca.trim()}&rdquo;
          </button>
        ) : null}
      </div>
    </Flutuante>
  )
}

/* --- 3. menu de cor de tecido ------------------------------------------- */
export type GrupoDeCor = { cod: string; nome: string; cores: [string, string][] }

export function MenuCorDeTecido({
  aberto,
  ancora,
  aoFechar,
  grupos,
  valor,
  aoEscolher,
  aoLimpar,
}: Base & {
  grupos: GrupoDeCor[]
  valor?: string
  aoEscolher: (nome: string, hex: string) => void
  aoLimpar?: () => void
}) {
  const [busca, setBusca] = useState('')
  const [abertos, setAbertos] = useState<string[]>([])
  const campo = useRef<HTMLInputElement>(null)
  useFocoAoAbrir(aberto, campo, () => setBusca(''))

  const b = semAcento(busca.trim())
  const achados = useMemo(
    () =>
      grupos
        .map((g) => ({
          ...g,
          cores: b ? g.cores.filter((c) => semAcento(c[0]).includes(b)) : g.cores,
        }))
        .filter((g) => g.cores.length),
    [grupos, b],
  )
  const total = grupos.reduce((s, g) => s + g.cores.length, 0)
  const grupoDaEscolhida = grupos.find((g) => g.cores.some((c) => c[0] === valor))?.cod
  const efetivos = b ? achados.map((g) => g.cod) : [...abertos, grupoDaEscolhida ?? ' ']

  return (
    <Flutuante
      aberto={aberto}
      ancora={ancora}
      aoFechar={aoFechar}
      opcoes={{ maior: true, largura: 300 }}
      versao={b + '|' + efetivos.join(',')}
    >
      <div className="mn-topo">
        <CampoDeBusca valor={busca} aoMudar={setBusca} convite="Buscar cor" campo={campo} />
      </div>

      <div className="mn-lista">
        {!b ? (
          <button
            type="button"
            className="mn-subli"
            onClick={() => {
              aoEscolher('SUBLIMAÇÃO', '')
              aoFechar()
            }}
          >
            <span className="arco" />
            <span className="tx">
              <b>SUBLIMAÇÃO</b>
              <span>a cor vem da arte, não do tecido</span>
            </span>
          </button>
        ) : null}

        {achados.length === 0 ? (
          <div className="mn-vazio">Nenhuma cor com esse nome</div>
        ) : (
          achados.map((g) => {
            const abertoG = efetivos.includes(g.cod)
            /* cinco amostras colhidas espalhadas pela lista, para mostrar a
               amplitude do tom em vez das cinco primeiras, que sao parecidas */
            const passo = Math.max(1, Math.floor(g.cores.length / 5))
            const mostra = [0, 1, 2, 3, 4].map(
              (i) => g.cores[Math.min(i * passo, g.cores.length - 1)],
            )
            return (
              <div
                key={g.cod}
                className={['mn-g', abertoG ? 'aberto' : ''].filter(Boolean).join(' ')}
              >
                <button
                  type="button"
                  className="mn-grupo"
                  onClick={() =>
                    setAbertos((a) =>
                      a.includes(g.cod) ? a.filter((x) => x !== g.cod) : [...a, g.cod],
                    )
                  }
                >
                  <span className="mn-amostras">
                    {mostra.map((c, i) => (
                      <i key={i} style={{ '--c': c[1] } as CSSProperties} />
                    ))}
                  </span>
                  <span className="nm">{g.nome}</span>
                  {g.cores.some((c) => c[0] === valor) ? <span className="marca" /> : null}
                  <span className="qt">{g.cores.length}</span>
                  <span className="seta">{SETA}</span>
                </button>
                <div className="mn-corpo">
                  {g.cores.map((c) => (
                    <button
                      type="button"
                      key={c[0]}
                      className={['mn-item', c[0] === valor ? 'on' : ''].filter(Boolean).join(' ')}
                      onClick={() => {
                        aoEscolher(c[0], c[1])
                        aoFechar()
                      }}
                    >
                      <span className="qd" style={{ '--cor': c[1] } as CSSProperties} />
                      <span className="nm">{c[0]}</span>
                      <span className="ok">{VISTO}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="mn-pe">
        <span>{total} cores</span>
        {aoLimpar ? (
          <button
            type="button"
            onClick={() => {
              aoLimpar()
              aoFechar()
            }}
          >
            limpar cor
          </button>
        ) : null}
      </div>
    </Flutuante>
  )
}

/* --- 4. menu de tecnica -------------------------------------------------- */
export type SecaoDeTecnica = { titulo: string; itens: { nome: string; cor: string }[] }

/* Multipla escolha, e vale ao FECHAR o menu, nao a cada clique: quem marca
   quatro tecnicas nao quer quatro redesenhos do cartao no meio do caminho. */
export function MenuTecnica({
  aberto,
  ancora,
  aoFechar,
  secoes,
  marcadas,
  aoAplicar,
}: Base & {
  secoes: SecaoDeTecnica[]
  marcadas: string[]
  aoAplicar: (marcadas: string[]) => void
}) {
  const [rascunho, setRascunho] = useState<string[]>(marcadas)
  useEffect(() => {
    if (aberto) setRascunho(marcadas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  function fechar() {
    aoAplicar(rascunho)
    aoFechar()
  }

  return (
    <Flutuante
      aberto={aberto}
      ancora={ancora}
      aoFechar={fechar}
      opcoes={{ maior: true, largura: 300 }}
      versao={rascunho.join(',')}
    >
      <div className="mn-lista" style={{ padding: 0 }}>
        {secoes.map((s) => (
          <div className="mn-secao" key={s.titulo}>
            <div className="mn-sep">{s.titulo}</div>
            <div className="mn-chips">
              {s.itens.map((i) => (
                <button
                  type="button"
                  key={i.nome}
                  className={['mn-chip', rascunho.includes(i.nome) ? 'sel' : '']
                    .filter(Boolean)
                    .join(' ')}
                  style={{ '--c': i.cor } as CSSProperties}
                  onClick={() =>
                    setRascunho((r) =>
                      r.includes(i.nome) ? r.filter((x) => x !== i.nome) : [...r, i.nome],
                    )
                  }
                >
                  <span className="pt" />
                  {i.nome}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mn-dica">Vale ao fechar o menu.</div>
    </Flutuante>
  )
}

/* --- 5. menu de codigo de cor -------------------------------------------- */
export type AbaDeCores = { id: string; rotulo: string; cor: string; cores: [string, string][] }

/* O menu NAO fecha ao escolher: quem lanca seis cores de uma arte nao reabre o
   menu seis vezes. Clique numa nao marcada lanca, clique numa marcada remove. */
export function MenuCodigoDeCor({
  aberto,
  ancora,
  aoFechar,
  abas,
  noLayout,
  aoAlternar,
}: Base & {
  abas: AbaDeCores[]
  noLayout: string[]
  aoAlternar: (codigo: string, hex: string, aba: string) => void
}) {
  const [aba, setAba] = useState(abas[0]?.id ?? '')
  const [busca, setBusca] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  useFocoAoAbrir(aberto, campo, () => setBusca(''))

  const atual = abas.find((a) => a.id === aba) ?? abas[0]
  /* busca numerica que aceita 7 para achar 007: tira o S dos dois lados e
     compara por texto ou por numero */
  const achadas = useMemo(() => {
    const t = busca.trim().replace(/^s/i, '')
    if (!atual) return []
    if (!t) return atual.cores
    const n = Number(t)
    return atual.cores.filter((c) => {
      const limpo = c[0].replace(/^S/i, '')
      return limpo.includes(t) || (!Number.isNaN(n) && Number(limpo) === n)
    })
  }, [atual, busca])

  return (
    <Flutuante
      aberto={aberto}
      ancora={ancora}
      aoFechar={aoFechar}
      opcoes={{ maior: true, largura: 286 }}
      versao={aba + '|' + busca + '|' + noLayout.join(',')}
    >
      <div className="mn-topo">
        <div className="mn-abas">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              className={a.id === aba ? 'on' : ''}
              onClick={() => setAba(a.id)}
            >
              <span className="pt" style={{ '--g': a.cor } as CSSProperties} />
              {a.rotulo}
            </button>
          ))}
        </div>
        <CampoDeBusca valor={busca} aoMudar={setBusca} convite="Número da cor" campo={campo} />
      </div>

      {achadas.length === 0 ? (
        <div className="mn-vazio">Nenhum código com esse número</div>
      ) : (
        <div className="mn-grade">
          {achadas.map((c) => (
            <button
              type="button"
              key={c[0]}
              className={['mn-cod', noLayout.includes(c[0]) ? 'ja' : ''].filter(Boolean).join(' ')}
              onClick={() => aoAlternar(c[0], c[1], aba)}
              title={noLayout.includes(c[0]) ? 'Clique de novo para tirar' : 'Lançar no layout'}
            >
              <span className="am" style={{ '--cor': c[1] } as CSSProperties} />
              <span className="cd">{c[0]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mn-pe">
        <span>{noLayout.length} no layout</span>
        <button type="button" onClick={aoFechar}>
          pronto
        </button>
      </div>
    </Flutuante>
  )
}

/* --- menu de contexto do botao direito ---------------------------------- */
export type ItemDeContexto = { rotulo: string; risco?: boolean; aoEscolher: () => void }

export function MenuDeContexto({
  aberto,
  ancora,
  aoFechar,
  cabecalho,
  itens,
}: Base & { cabecalho?: ReactNode; itens: ItemDeContexto[] }) {
  return (
    <Flutuante
      aberto={aberto}
      ancora={ancora}
      aoFechar={aoFechar}
      className="mn-ctx"
      opcoes={{ maior: true }}
    >
      {cabecalho ? <div className="mn-cab">{cabecalho}</div> : null}
      {itens.map((i) => (
        <button
          type="button"
          key={i.rotulo}
          className={['mn-item', i.risco ? 'risco' : ''].filter(Boolean).join(' ')}
          onClick={() => {
            i.aoEscolher()
            aoFechar()
          }}
        >
          {i.rotulo}
        </button>
      ))}
    </Flutuante>
  )
}

/* --- a faixa de cores C1 ------------------------------------------------- */
export function estiloDaTecnica(t: Tecnica): CSSProperties {
  return {
    '--tc': 'var(--tec-' + t + ')',
    '--tv': 'var(--tec-' + t + '-vivo)',
    '--ts': 'var(--tec-' + t + '-soft)',
    '--tf': 'var(--tec-' + t + '-fg)',
  } as CSSProperties
}

/* Caixa no tom claro da tecnica com barra de 3 px na cor cheia a esquerda,
   pilula presa no alto a esquerda, fio vertical, e as cores quebrando por
   dentro. Cada ficha tem 70 px fixos: o codigo tem sempre tres caracteres,
   entao nao existe motivo para uma ser mais larga que a outra, e assim as
   linhas formam grade perfeita.

   A pilula nao tem X. No lugar do X mora o mais, que abre o menu de codigo de
   cor. Apagar e botao direito, na pilula ou na cor.

   Na folha A4 e no arquivo do cliente a faixa vira a opcao B: sem tingimento,
   sem barra lateral, so borda de 1 px, e sem o mais. */
export function FaixaDeCores({
  tecnica,
  rotulo,
  cores,
  aoAdicionar,
  aoAbrirMenuDaPilula,
  aoAbrirMenuDaCor,
  impressao,
}: {
  tecnica: Tecnica
  rotulo: string
  cores: { cod: string; hex: string }[]
  aoAdicionar?: (ancora: HTMLElement) => void
  aoAbrirMenuDaPilula?: (ancora: HTMLElement) => void
  aoAbrirMenuDaCor?: (ancora: HTMLElement, cod: string) => void
  impressao?: boolean
}) {
  /* A trilha colorida nao e decoracao: ela diz "aqui dentro moram codigos de
     cor". So DTF e sublimacao lancam codigo, e so depois que a primeira cor
     entrou. Etiqueta, gola, bordado e acabamento sao pilula seca, sem caixa.
     Na folha A4 vale a opcao B: borda de 1 px e nada de tingimento. */
  const comTrilha = (tecnica === 'dtf' || tecnica === 'subli') && cores.length > 0
  const classe = ['fx', impressao ? 'fx-b' : comTrilha ? 'trilha' : 'seca'].join(' ')
  const temMais = !!aoAdicionar && !impressao
  return (
    <div className={classe} style={estiloDaTecnica(tecnica)}>
      <div className="c1">
        <span
          className={temMais ? 'tec com-mais' : 'tec'}
          onContextMenu={(e) => {
            if (!aoAbrirMenuDaPilula) return
            e.preventDefault()
            aoAbrirMenuDaPilula(e.currentTarget)
          }}
        >
          {rotulo}
          {temMais ? (
            <button
              type="button"
              className="mais"
              aria-label="Acrescentar cor"
              onClick={(e) => {
                e.stopPropagation()
                aoAdicionar(e.currentTarget)
              }}
            >
              +
            </button>
          ) : null}
        </span>
        {cores.length ? <span className="sep" /> : null}
        <span className="bandeja">
          {cores.map((c) => (
            <span
              className="cor"
              key={c.cod}
              onContextMenu={(e) => {
                if (!aoAbrirMenuDaCor) return
                e.preventDefault()
                aoAbrirMenuDaCor(e.currentTarget, c.cod)
              }}
            >
              <span className="am" style={{ '--cor': c.hex } as CSSProperties} />
              <span className="cod">{c.cod}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
