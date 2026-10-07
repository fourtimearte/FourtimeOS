import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Flutuante, semAcento } from './flutuante'

export type OpcaoDoSeletor = {
  valor: string
  rotulo: string
  contagem?: number
  /* A PÍLULA É DA OPÇÃO, E NÃO DO SELETOR. Algumas listas do banco não são
     texto solto: departamento é uma família de técnica, e a cor diz qual
     antes de alguém ler a palavra. Quando a opção traz as duas cores, o
     rótulo é desenhado dentro de uma pílula clara, no botão e na lista.

     O `rotulo` continua sendo TEXTO de propósito: é por ele que a busca do
     seletor filtra, e uma busca que não acha "bordado" porque o rótulo virou
     um elemento seria um defeito escondido atrás de uma cor bonita. */
  pilula?: { fundo: string; texto: string }
}

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
  cor,
  comBusca,
  aoCriar,
  buscaDica,
  pe,
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
  /* A cor do que esta escolhido, para o seletor que E o estado da coisa e nao
     um filtro sobre ela. A etapa do pedido e o caso: "Silk" em laranja e
     "Costura" em cinza se acham de longe numa lista de sessenta linhas, e o
     nome sozinho, todo do mesmo cinza, nao se acha. Recebe uma cor pronta do
     dominio (var(--tec-silk-vivo) e afins), porque quem sabe a cor de um posto
     e a producao, nao o Design System. */
  cor?: string
  comBusca?: boolean
  /* A LISTA QUE ACEITA ITEM NOVO. Com isto a busca fica sempre à mostra, e
     quando o que foi escrito não é o nome de nenhuma opção aparece a linha
     "Adicionar", que devolve o texto. Quem grava o item e escolhe o valor é
     quem usa o seletor: aqui só se pergunta. Nasceu com as listas dos detalhes
     de peça (gola, manga, punho), que são do usuário e crescem no uso. */
  aoCriar?: (texto: string) => void
  /** o que a busca diz antes de alguém escrever */
  buscaDica?: string
  /** o pé do menu: uma frase curta à esquerda e uma ação à direita */
  pe?: { texto?: string; rotulo: string; aoClicar: () => void }
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const bt = useRef<HTMLButtonElement>(null)

  const escolhida = opcoes.find((o) => o.valor === valor)
  const mostraBusca = aoCriar ? true : (comBusca ?? opcoes.length > 10)
  const b = semAcento(busca.trim())
  const lista = b ? opcoes.filter((o) => semAcento(o.rotulo).includes(b)) : opcoes
  /* o que foi escrito já é o nome de uma opção? então não há o que adicionar */
  const jaExiste = b ? opcoes.find((o) => semAcento(o.rotulo.trim()) === b) : undefined
  const podeCriar = !!aoCriar && !!b && !jaExiste

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
        cor ? 'tom' : '',
        aberto ? 'aberto' : '',
        valor ? 'marcado' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={cor ? ({ '--tom': cor } as CSSProperties) : undefined}
    >
      <button ref={bt} type="button" className="cb" onClick={() => setAberto((a) => !a)}>
        {rotulo ? <span className="lb">{rotulo}</span> : null}
        {escolhida?.pilula ? (
          <span
            className="v pilula"
            style={{ background: escolhida.pilula.fundo, color: escolhida.pilula.texto }}
          >
            {escolhida.rotulo}
          </span>
        ) : (
          <span className="v">{escolhida ? escolhida.rotulo : vazio}</span>
        )}
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
                onKeyDown={(e) => {
                  /* Enter na lista que aceita item novo: escolhe o que tem
                     esse nome, ou adiciona o que foi escrito */
                  if (e.key !== 'Enter' || !aoCriar || !b) return
                  e.preventDefault()
                  if (jaExiste) aoEscolher(jaExiste.valor)
                  else aoCriar(busca.trim())
                  fechar()
                }}
                placeholder={buscaDica ?? (aoCriar ? 'Buscar, ou escrever um item novo' : 'Buscar')}
                aria-label={buscaDica ?? (aoCriar ? 'Buscar, ou escrever um item novo' : 'Buscar')}
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

        {/* O SELETOR MORA DENTRO DE UM <label> (o Campo). Um clique num botão
            de dentro do rótulo não aciona o rótulo, mas só enquanto o botão
            está lá: a linha "Adicionar" some da tela no mesmo clique, o
            navegador já não a acha dentro do rótulo, aciona o rótulo, o rótulo
            clica no botão do seletor, e o menu que acabou de fechar abre de
            novo. Dizer que o clique já foi tratado corta isso na raiz, para
            qualquer linha da lista. */}
        <div className="mn-lista" onClick={(e) => e.preventDefault()}>
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
            podeCriar ? null : <div className="mn-vazio">Nada com esse nome</div>
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
                {o.pilula ? (
                  <span
                    className="nm pilula"
                    style={{ background: o.pilula.fundo, color: o.pilula.texto }}
                  >
                    {o.rotulo}
                  </span>
                ) : (
                  <span className="nm">{o.rotulo}</span>
                )}
                {o.contagem != null ? (
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>
                    {o.contagem}
                  </span>
                ) : null}
                <span className="ok">✓</span>
              </button>
            ))
          )}
          {podeCriar ? (
            <button
              type="button"
              className="mn-item mn-novo"
              data-criar=""
              onClick={() => {
                aoCriar?.(busca.trim())
                fechar()
              }}
            >
              <Mais />
              <span className="nm">
                Adicionar <b>"{busca.trim()}"</b> à lista
              </span>
            </button>
          ) : null}
        </div>
        {pe ? (
          <div className="mn-pe">
            <span>{pe.texto ?? ''}</span>
            <button
              type="button"
              onClick={() => {
                fechar()
                pe.aoClicar()
              }}
            >
              {pe.rotulo}
            </button>
          </div>
        ) : null}
      </Flutuante>
    </span>
  )
}

function Mais() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
  tinta,
  mae,
  aoClicar,
}: {
  rotulo: ReactNode
  valor: ReactNode
  unidade?: string
  sub?: ReactNode
  ligado?: boolean
  aviso?: boolean
  /* O cartao de tinta do inicio. UM por tela, e nunca o de aviso: tinta diz
     onde voce esta, aviso diz o que aconteceu, e as duas coisas juntas no
     mesmo cartao fazem as duas sumirem. */
  tinta?: boolean
  mae?: 'grafite' | 'dtf' | 'subli' | 'silk' | 'bordado' | 'patch'
  aoClicar?: () => void
}) {
  const classes = [
    'kpi',
    aoClicar ? 'clicavel' : '',
    ligado ? 'ligado' : '',
    aviso ? 'aviso' : '',
    tinta && !aviso ? 'tinta' : '',
    tinta && !aviso ? 'm-' + (mae ?? 'grafite') : '',
  ]
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
