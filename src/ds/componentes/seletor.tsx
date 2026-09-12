import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Flutuante, semAcento } from './flutuante'

export type OpcaoDoSeletor = { valor: string; rotulo: string; contagem?: number }

/* ==========================================================================
   O seletor: o dropdown proprio do sistema.

   Nunca um <select> do navegador, como manda a regra 5 do V7. Ele vive na
   camada do topo, entao nunca nasce cortado dentro de um cartao, e a largura
   vem da lista. Quando tem mais de dez opcoes ele ganha busca sozinho, porque
   lista longa sem busca e so uma lista longa.
   ========================================================================== */
export function Seletor({
  rotulo,
  valor,
  opcoes,
  aoEscolher,
  vazio = 'Todos',
  tamanho = 'md',
  bloco,
  campo,
  comBusca,
}: {
  /** o rotulo miudo dentro do botao, tipo VENDEDOR */
  rotulo?: string
  valor: string
  opcoes: OpcaoDoSeletor[]
  aoEscolher: (v: string) => void
  /** o texto quando nada esta escolhido, que tambem e a opcao de limpar */
  vazio?: string
  tamanho?: 'sm' | 'md'
  bloco?: boolean
  /** dentro de um formulario, e nao numa barra de filtro: campo preenchido e
      so um campo preenchido, entao ele nao fica preto */
  campo?: boolean
  comBusca?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const bt = useRef<HTMLButtonElement>(null)

  const escolhida = opcoes.find((o) => o.valor === valor)
  const mostraBusca = comBusca ?? opcoes.length > 10
  const b = semAcento(busca.trim())
  const lista = b ? opcoes.filter((o) => semAcento(o.rotulo).includes(b)) : opcoes

  function fechar() {
    setAberto(false)
    setBusca('')
  }

  return (
    <span
      className={[
        'sel',
        tamanho === 'sm' ? 'sm' : '',
        bloco ? 'bloco' : '',
        campo ? 'campo' : '',
        aberto ? 'aberto' : '',
        valor ? 'marcado' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button ref={bt} type="button" className="cb" onClick={() => setAberto((a) => !a)}>
        {rotulo ? <span className="lb">{rotulo}</span> : null}
        <span className="v">{escolhida ? escolhida.rotulo : vazio}</span>
        <span className="seta">▼</span>
      </button>

      <Flutuante
        aberto={aberto}
        ancora={bt}
        aoFechar={fechar}
        opcoes={{ maior: true, medirPelaLista: true }}
        versao={b}
      >
        {mostraBusca ? (
          <div className="mn-topo">
            <div className={['mn-busca', busca ? 'tem' : ''].filter(Boolean).join(' ')}>
              <Lupa />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar"
                aria-label="Buscar"
              />
              <button
                type="button"
                className="mn-limpa"
                aria-label="Limpar a busca"
                onClick={() => setBusca('')}
              >
                &times;
              </button>
            </div>
          </div>
        ) : null}

        <div className="mn-lista">
          <button
            type="button"
            className={['mn-item', !valor ? 'on' : ''].filter(Boolean).join(' ')}
            onClick={() => {
              aoEscolher('')
              fechar()
            }}
          >
            <span className="nm">{vazio}</span>
            <span className="ok">✓</span>
          </button>
          {lista.length === 0 ? (
            <div className="mn-vazio">Nada com esse nome</div>
          ) : (
            lista.map((o) => (
              <button
                type="button"
                key={o.valor}
                className={['mn-item', o.valor === valor ? 'on' : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  aoEscolher(o.valor)
                  fechar()
                }}
              >
                <span className="nm">{o.rotulo}</span>
                {o.contagem != null ? (
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>
                    {o.contagem}
                  </span>
                ) : null}
                <span className="ok">✓</span>
              </button>
            ))
          )}
        </div>
      </Flutuante>
    </span>
  )
}

function Lupa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

/* --- paginador ----------------------------------------------------------- */
/* Mostra no maximo sete botoes: primeira, a vizinhanca da atual, e ultima.
   O resto vira reticencia, para a fileira nao crescer com a tabela. */
export function Paginador({
  pagina,
  paginas,
  total,
  porPagina,
  aoIr,
}: {
  pagina: number
  paginas: number
  total: number
  porPagina: number
  aoIr: (p: number) => void
}) {
  if (paginas <= 1) {
    return (
      <div className="pag">
        <span className="conta">
          {total} {total === 1 ? 'resultado' : 'resultados'}
        </span>
      </div>
    )
  }

  const de = (pagina - 1) * porPagina + 1
  const ate = Math.min(pagina * porPagina, total)
  const numeros: (number | 'mais')[] = []
  for (let i = 1; i <= paginas; i++) {
    if (i === 1 || i === paginas || Math.abs(i - pagina) <= 1) numeros.push(i)
    else if (numeros[numeros.length - 1] !== 'mais') numeros.push('mais')
  }

  return (
    <div className="pag">
      <span className="conta">
        {de} a {ate} de {total}
      </span>
      <span className="meio">
        <button type="button" onClick={() => aoIr(pagina - 1)} disabled={pagina === 1}>
          anterior
        </button>
        {numeros.map((n, i) =>
          n === 'mais' ? (
            <span className="reticencia" key={'m' + i}>
              ...
            </span>
          ) : (
            <button
              type="button"
              key={n}
              className={n === pagina ? 'ligado' : ''}
              onClick={() => aoIr(n)}
              aria-current={n === pagina ? 'page' : undefined}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" onClick={() => aoIr(pagina + 1)} disabled={pagina === paginas}>
          próxima
        </button>
      </span>
    </div>
  )
}

/* --- KPI: o numero que se clica ----------------------------------------- */
export function Kpi({
  rotulo,
  valor,
  unidade,
  sub,
  ligado,
  aviso,
  aoClicar,
}: {
  rotulo: ReactNode
  valor: ReactNode
  unidade?: string
  sub?: ReactNode
  ligado?: boolean
  aviso?: boolean
  aoClicar?: () => void
}) {
  const classes = ['kpi', aoClicar ? 'clicavel' : '', ligado ? 'ligado' : '', aviso ? 'aviso' : '']
    .filter(Boolean)
    .join(' ')
  /* Valor comprido, tipo dinheiro, nao pode empurrar o cartao para fora da
     fileira: ele diminui de corpo em vez de estourar. O numero nunca quebra em
     duas linhas nem vira reticencia, porque KPI cortado mente. */
  const comprido = (typeof valor === 'string' || typeof valor === 'number') &&
    String(valor).length + (unidade?.length ?? 0) > 9
  const dentro = (
    <>
      <span className="rot">{rotulo}</span>
      <span className={comprido ? 'val longo' : 'val'}>
        {valor}
        {unidade ? <small>{unidade}</small> : null}
      </span>
      {sub ? <span className="sub">{sub}</span> : null}
    </>
  )
  if (!aoClicar) return <div className={classes}>{dentro}</div>
  return (
    <button type="button" className={classes} onClick={aoClicar} aria-pressed={ligado}>
      {dentro}
    </button>
  )
}
