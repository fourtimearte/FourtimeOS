import { useEffect, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { LogoFourtime } from './marca'

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
  /** quando o item nao e destino, e sim a raiz de uma arvore que abre abaixo */
  filhos?: ItemDeNavegacao[]
  /** quando o item faz alguma coisa em vez de levar a algum lugar */
  acao?: () => void
}

export type SecaoDeNavegacao = { titulo: string; itens: ItemDeNavegacao[] }

type TipoDeLink = (p: { to: string; className?: string; children: ReactNode }) => ReactNode

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
  ramoDoPe,
  peDoLado,
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
  Link: TipoDeLink
  aoAbrirBusca: () => void
  acoesDoTopo?: ReactNode
  /** a arvore que mora colada no pe do menu e abre para cima */
  ramoDoPe?: ItemDeNavegacao
  /** o pe do menu lateral: quem esta usando, e o que ele faz daqui */
  peDoLado?: ReactNode
  children: ReactNode
}) {
  /* Dois cliques no trilho abrem e fecham o menu. So no vazio dele: dois
     cliques num item sao dois cliques num item, e nao um pedido de encolher. */
  function doisCliquesNoTrilho(e: MouseEvent<HTMLElement>) {
    const alvo = e.target as HTMLElement | null
    if (alvo && alvo.closest('a, button, input, [role="button"]')) return
    aoEncolher()
  }

  return (
    <div className={['casca', encolhida ? 'encolhida' : ''].filter(Boolean).join(' ')}>
      <nav className="lado" aria-label="Menu do sistema" onDoubleClick={doisCliquesNoTrilho}>
        {/* O F vermelho e o botao do trilho. Ele ja estava no canto onde a mao
            procura, e um segundo botao so para encolher era um botao a mais
            disputando o mesmo canto. */}
        <div className="marca">
          <button
            type="button"
            className="logo"
            onClick={aoEncolher}
            aria-label={encolhida ? 'Abrir o menu' : 'Encolher o menu'}
            title={encolhida ? 'Abrir o menu' : 'Encolher o menu'}
            aria-expanded={!encolhida}
          >
            F
          </button>
          <Link to="/" className="marca-nome" aria-label="Fourtime OS">
            <LogoFourtime altura={15} titulo="Fourtime" />
            <span className="os">OS</span>
          </Link>
        </div>

        {secoes.map((s) => (
          <div key={s.titulo || 'sem-titulo'}>
            {/* Uma secao sem titulo existe: o Inicio nao pertence a nenhuma
                familia, ele e a porta de entrada. Titulo em cima de um item
                so seria um rotulo explicando uma coisa obvia. */}
            {s.titulo ? <div className="secao">{s.titulo}</div> : null}
            {s.itens.map((i) =>
              i.filhos && i.filhos.length > 0 ? (
                <Ramo
                  key={i.para}
                  item={i}
                  filhos={i.filhos}
                  ligado={ligado}
                  Link={Link}
                  encolhida={encolhida}
                  aoEncolher={aoEncolher}
                />
              ) : (
                <ItemDoMenu key={i.para} item={i} ligado={ligado} Link={Link} />
              ),
            )}
          </div>
        ))}

        {/* Configuracoes fica colada no pe, que e onde ela mora em todo
            sistema que a pessoa ja usou, e a arvore dela abre para cima
            porque abaixo dela so tem o pe. */}
        {ramoDoPe && ramoDoPe.filhos && ramoDoPe.filhos.length > 0 ? (
          <div className="lado-fim">
            <Ramo
              item={ramoDoPe}
              filhos={ramoDoPe.filhos}
              ligado={ligado}
              Link={Link}
              encolhida={encolhida}
              aoEncolher={aoEncolher}
              paraCima
            />
          </div>
        ) : null}

        {peDoLado ? <div className="lado-pe">{peDoLado}</div> : null}
      </nav>

      <header className="topo">
        {/* A LOGO NO LUGAR DO PONTO. O quadradinho vermelho era um substituto
            da marca enquanto ela não existia no código; agora ela existe. */}
        <Link to="/" className="marca" aria-label="Fourtime OS">
          <LogoFourtime altura={14} titulo="Fourtime" />
          <span className="os">OS</span>
        </Link>
        <button type="button" className="busca-atalho" onClick={aoAbrirBusca}>
          Buscar pedido, cliente ou referência
          <span className="tecla">ctrl K</span>
        </button>
        {acoesDoTopo}
      </header>

      <main className="vista">{children}</main>

      <BarraDeBaixo itens={rodapeNav} ligado={ligado} Link={Link} />
    </div>
  )
}

/* --- a barra de baixo, no celular ----------------------------------------
   No computador o menu inteiro cabe na lateral. No celular nao cabe, e por
   isso a barra de baixo deixou de ser cinco telas escolhidas a dedo e virou
   as proprias categorias: Inicio, Comercial, Producao, Gestao, Materiais e os
   tres pontos. Tocar numa categoria abre as telas dela para cima, perto do
   polegar, em vez de mandar a pessoa para uma tela que talvez nao fosse a que
   ela queria. */
function BarraDeBaixo({
  itens,
  ligado,
  Link,
}: {
  itens: ItemDeNavegacao[]
  ligado: (para: string) => boolean
  Link: TipoDeLink
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  const categoria = itens.find((i) => i.para === aberta) ?? null

  /* Quem esta dentro de uma categoria ganha a marca na barra, mesmo sem a
     arvore aberta: a barra continua dizendo onde a pessoa esta. */
  const dentro = (i: ItemDeNavegacao) =>
    i.filhos && i.filhos.length > 0
      ? i.filhos.some((f) => f.ativo ?? ligado(f.para))
      : (i.ativo ?? ligado(i.para))

  return (
    <>
      {categoria ? (
        <>
          <div className="pe-veu" onClick={() => setAberta(null)} aria-hidden="true" />
          <div
            className="pe-arvore"
            role="menu"
            aria-label={categoria.rotulo}
            /* o Link chega de fora sem onClick, entao quem fecha a arvore e o
               clique subindo: se ele passou por dentro de um link, foi embora */
            onClick={(e) => {
              const alvo = e.target as HTMLElement | null
              if (alvo && alvo.closest('a')) setAberta(null)
            }}
          >
            <b>{categoria.rotulo}</b>
            {(categoria.filhos ?? []).map((f) =>
              f.acao ? (
                <button
                  key={f.para}
                  type="button"
                  className="pe-item"
                  onClick={() => {
                    setAberta(null)
                    f.acao?.()
                  }}
                >
                  {f.icone}
                  <span>{f.rotulo}</span>
                </button>
              ) : (
                <Link
                  key={f.para}
                  to={f.para}
                  className={
                    (f.ativo ?? ligado(f.para)) ? 'pe-item ligado' : 'pe-item'
                  }
                >
                  {f.icone}
                  <span>{f.rotulo}</span>
                </Link>
              ),
            )}
          </div>
        </>
      ) : null}

      <nav className="rodape-nav" aria-label="Navegação principal">
        {itens.map((i) =>
          i.filhos && i.filhos.length > 0 ? (
            <button
              key={i.para}
              type="button"
              className={
                [dentro(i) ? 'ligado' : '', aberta === i.para ? 'aberta' : '']
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              aria-expanded={aberta === i.para}
              onClick={() => setAberta((a) => (a === i.para ? null : i.para))}
            >
              {i.icone}
              <span>{i.rotulo}</span>
            </button>
          ) : (
            <Link
              key={i.para}
              to={i.para}
              className={dentro(i) ? 'ligado' : undefined}
            >
              {i.icone}
              <span>{i.rotulo}</span>
            </Link>
          ),
        )}
      </nav>
    </>
  )
}

function ItemDoMenu({
  item,
  ligado,
  Link,
  filho,
}: {
  item: ItemDeNavegacao
  ligado: (para: string) => boolean
  Link: TipoDeLink
  filho?: boolean
}) {
  return (
    <Link
      to={item.para}
      /* O item selecionado e o mesmo cartao de tinta da decisao 9, com a cor
         mae grafite: o mesmo do cartao heroi do inicio. Ele leva as classes do
         Design System em vez de repetir o degrade aqui, senao a aparencia
         passaria a existir em dois lugares. */
      className={[
        'item',
        filho ? 'filho' : '',
        ...(item.ativo ?? ligado(item.para) ? ['ligado', 'luz', 'tinta', 'm-grafite'] : []),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {item.icone}
      <span className="rotulo">{item.rotulo}</span>
      {item.contagem != null ? (
        <span className={['cnt', item.aviso ? 'aviso' : ''].filter(Boolean).join(' ')}>
          {item.contagem}
        </span>
      ) : null}
    </Link>
  )
}

/* --- o item que abre uma arvore abaixo ------------------------------------
   Ele nao e destino: e a raiz. Clicar abre e fecha a lista dos filhos, e
   estando num dos filhos ele ja nasce aberto, se nao a pessoa teria que abrir
   a arvore toda vez para descobrir onde ela esta. */
function Ramo({
  item,
  filhos,
  ligado,
  Link,
  encolhida,
  aoEncolher,
  paraCima,
}: {
  item: ItemDeNavegacao
  filhos: ItemDeNavegacao[]
  ligado: (para: string) => boolean
  Link: TipoDeLink
  encolhida: boolean
  aoEncolher: () => void
  /** a arvore abre acima do item, para quando ele mora no pe do menu */
  paraCima?: boolean
}) {
  const dentro = filhos.some((f) => f.ativo ?? ligado(f.para))
  const [aberto, setAberto] = useState(dentro)

  useEffect(() => {
    if (dentro) setAberto(true)
  }, [dentro])

  /* Com o menu em trilho nao cabe arvore nenhuma: o clique abre o menu e a
     arvore junto, que e o que a pessoa queria ver. */
  function clicar() {
    if (encolhida) {
      aoEncolher()
      setAberto(true)
      return
    }
    setAberto((a) => !a)
  }

  const galho = aberto ? (
    <div className={paraCima ? 'galho para-cima' : 'galho'}>
      {filhos.map((f) => (
        <ItemDoMenu key={f.para} item={f} ligado={ligado} Link={Link} filho />
      ))}
    </div>
  ) : null

  const botao = (
    <button
      type="button"
      className={['item', 'ramo', dentro ? 'dentro' : ''].filter(Boolean).join(' ')}
      onClick={clicar}
      aria-expanded={aberto && !encolhida}
    >
      {item.icone}
      <span className="rotulo">{item.rotulo}</span>
      {item.contagem != null ? (
        <span className={['cnt', item.aviso ? 'aviso' : ''].filter(Boolean).join(' ')}>
          {item.contagem}
        </span>
      ) : null}
      <span
        className={aberto !== !!paraCima ? 'galho-seta virada' : 'galho-seta'}
        aria-hidden="true"
      >
        <SetaDeGalho />
      </span>
    </button>
  )

  return paraCima ? (
    <>
      {galho}
      {botao}
    </>
  ) : (
    <>
      {botao}
      {galho}
    </>
  )
}

function SetaDeGalho() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m8 10 4 4 4-4"
        stroke="currentColor"
        strokeWidth="2"
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
