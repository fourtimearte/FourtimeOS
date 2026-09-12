import type { ReactNode } from 'react'

export type ItemDeNavegacao = {
  para: string
  rotulo: string
  icone: ReactNode
  /** contagem na ponta do item, quando ela ajuda a decidir onde ir */
  contagem?: number
  /** contagem em vermelho: atraso, coisa parada */
  aviso?: boolean
  /** quando a rota atual conta como este item */
  ativo?: boolean
}

export type SecaoDeNavegacao = { titulo: string; itens: ItemDeNavegacao[] }

/* ==========================================================================
   A casca do sistema.

   Ela e generica: as secoes e os itens chegam por propriedade, porque o ds/
   nao pode saber o que e cotacao nem o que e kanban. Quem monta a lista e a
   raiz do app.

   No computador, menu lateral que encolhe para so icones. No celular, barra de
   baixo com cinco destinos, que e onde o polegar alcanca. O cabecalho e o
   mesmo nos dois.
   ========================================================================== */
export function Casca({
  encolhida,
  aoEncolher,
  secoes,
  rodapeNav,
  ligado,
  Link,
  aoAbrirBusca,
  acoesDoTopo,
  rodapeDoLado,
  children,
}: {
  encolhida: boolean
  aoEncolher: () => void
  secoes: SecaoDeNavegacao[]
  /** os cinco destinos da barra de baixo, no celular */
  rodapeNav: ItemDeNavegacao[]
  /** diz se um caminho e o atual */
  ligado: (para: string) => boolean
  /** o Link do roteador, injetado para o ds nao depender dele */
  Link: (p: { to: string; className?: string; children: ReactNode }) => ReactNode
  aoAbrirBusca: () => void
  acoesDoTopo?: ReactNode
  rodapeDoLado?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={['casca', encolhida ? 'encolhida' : ''].filter(Boolean).join(' ')}>
      <nav className="lado" aria-label="Menu do sistema">
        <Link to="/" className="marca">
          <span className="logo">F</span>
          <span>Fourtime OS</span>
        </Link>

        {secoes.map((s) => (
          <div key={s.titulo}>
            <div className="secao">{s.titulo}</div>
            {s.itens.map((i) => (
              <Link
                key={i.para}
                to={i.para}
                className={['item', i.ativo ?? ligado(i.para) ? 'ligado' : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {i.icone}
                <span className="rotulo">{i.rotulo}</span>
                {i.contagem != null ? (
                  <span className={['cnt', i.aviso ? 'aviso' : ''].filter(Boolean).join(' ')}>
                    {i.contagem}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ))}

        <div className="rodape">
          <button
            type="button"
            className="bt-icone"
            onClick={aoEncolher}
            aria-label={encolhida ? 'Abrir o menu' : 'Encolher o menu'}
            title={encolhida ? 'Abrir o menu' : 'Encolher o menu'}
          >
            <Seta virada={encolhida} />
          </button>
          {rodapeDoLado}
        </div>
      </nav>

      <header className="topo">
        <Link to="/" className="marca">
          <span className="ponto" />
          <span>Fourtime OS</span>
        </Link>
        <button type="button" className="busca-atalho" onClick={aoAbrirBusca}>
          Buscar pedido, cliente ou referência
          <span className="tecla">ctrl K</span>
        </button>
        {acoesDoTopo}
      </header>

      <main className="vista">{children}</main>

      <nav className="rodape-nav" aria-label="Navegação principal">
        {rodapeNav.map((i) => (
          <Link
            key={i.para}
            to={i.para}
            className={i.ativo ?? ligado(i.para) ? 'ligado' : ''}
          >
            {i.icone}
            <span>{i.rotulo}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

function Seta({ virada }: { virada: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transform: virada ? 'rotate(180deg)' : undefined }}
    >
      <path
        d="M14.5 6 8.5 12l6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* --- o cabecalho de cada pagina ------------------------------------------ */
export function Pagina({
  acima,
  titulo,
  sub,
  acoes,
  children,
}: {
  acima?: ReactNode
  titulo: ReactNode
  sub?: ReactNode
  acoes?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          {acima ? <p className="acima">{acima}</p> : null}
          <h1>{titulo}</h1>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
        {acoes ? <div style={{ display: 'flex', gap: 'var(--gap-btn)', flexWrap: 'wrap' }}>{acoes}</div> : null}
      </div>
      {children}
    </div>
  )
}
