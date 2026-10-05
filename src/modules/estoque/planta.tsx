import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as EventoDePonteiro, ReactNode, RefObject } from 'react'
import {
  celulasDoMovel,
  contornoDaGrade,
  gradeDosPaletes,
  metros,
  type Celula,
  type Movel,
  type Planta,
} from '@dominio/deposito'

/* ==========================================================================
   A planta do depósito, vista de cima.

   É um desenho em SVG medido em metros e mostrado em pixels: `escala` é
   quantos pixels vale um metro, e sai da largura que o desenho tem para
   ocupar. O mesmo desenho serve ao mapa, à planta miúda da ficha, à caixa de
   marcar o lugar e ao editor: o que muda é o que cada lugar mostra e o que
   acontece no clique.

   COR SÓ QUANDO SIGNIFICA. Lugar com material é cinza, vazio é branco. O
   aberto é preto (a seleção do sistema) e o procurado é vermelho. O aviso de
   compra é um ponto no canto, e não o lugar inteiro pintado.
   ========================================================================== */

export type EstadoDoLugar = 'vazio' | 'tem' | 'aberto' | 'achado' | 'apagado'

export type Ocupacao = Map<string, { quantos: number; comprar: boolean }>

/** as margens do desenho, em pixels: o que sobra em volta do chão para as medidas */
function margens(medidas: boolean) {
  return medidas
    ? { esquerda: 30, cima: 10, direita: 10, baixo: 34 }
    : { esquerda: 6, cima: 6, direita: 6, baixo: 6 }
}

/* A LARGURA QUE O DESENHO TEM PARA OCUPAR. O SVG é desenhado em pixels de
   verdade (e não esticado por viewBox) para a letra e o traço terem sempre o
   mesmo tamanho, no computador e no celular. */
export function usarLarguraDe<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    const no = ref.current
    if (!no) return
    const medir = () => setLargura(Math.floor(no.getBoundingClientRect().width))
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const olho = new ResizeObserver(medir)
    olho.observe(no)
    return () => olho.disconnect()
  }, [])
  return [ref, largura]
}

export function escalaQueCabe(
  planta: Pick<Planta, 'largura'>,
  larguraDisponivel: number,
  medidas: boolean,
  maxima: number,
): number {
  const m = margens(medidas)
  if (larguraDisponivel <= 0) return 0
  return Math.max(
    4,
    Math.min(maxima, (larguraDisponivel - m.esquerda - m.direita) / planta.largura),
  )
}

type PropsDoDesenho = {
  planta: Planta
  escala: number
  /** nomes dos lugares e das prateleiras, a escala de 1 m e as medidas do chão */
  medidas?: boolean
  /** o que cada lugar mostra; quem não está aqui é desenhado vazio */
  estados?: Map<string, EstadoDoLugar>
  /** o ponto vermelho do "tem item para comprar" */
  comprar?: Set<string>
  /** os marcadores numerados, na ordem: a chave do lugar */
  marcadores?: string[]
  aoAbrir?: (c: Celula) => void
  /** para o leitor de tela: quantos materiais há em cada lugar */
  ocupacao?: Ocupacao
  /** o texto no meio do chão vazio */
  aviso?: [string, string]
  /** o editor desenha por cima: seleção, alças, a peça que está sendo arrastada */
  porCima?: ReactNode
  /** o editor escuta o ponteiro no desenho inteiro */
  aoApertar?: (e: EventoDePonteiro<SVGSVGElement>) => void
  aoMover?: (e: EventoDePonteiro<SVGSVGElement>) => void
  aoSoltar?: (e: EventoDePonteiro<SVGSVGElement>) => void
  /** no editor cada peça é um alvo inteiro, e não lugar por lugar */
  aoPegarMovel?: (m: Movel, e: EventoDePonteiro<SVGGElement>) => void
  aoTeclarNoMovel?: (m: Movel, e: KeyboardEvent<SVGGElement>) => void
  /** as peças escolhidas no editor (pretas) */
  escolhidos?: Set<string>
  rotulo?: string
}

/** o lado mínimo do alvo de toque, em pixels */
const ALVO = 44

export function DesenhoDaPlanta({
  planta,
  escala: S,
  medidas = true,
  estados,
  comprar,
  marcadores,
  aoAbrir,
  ocupacao,
  aviso,
  porCima,
  aoApertar,
  aoMover,
  aoSoltar,
  aoPegarMovel,
  aoTeclarNoMovel,
  escolhidos,
  rotulo,
}: PropsDoDesenho) {
  const m = margens(medidas)
  const L = planta.largura
  const A = planta.fundo
  const W = Math.round(L * S + m.esquerda + m.direita)
  const H = Math.round(A * S + m.cima + m.baixo)
  const X = (v: number) => m.esquerda + v * S
  const Y = (v: number) => m.cima + v * S
  const fonte = Math.max(8.5, Math.min(11.5, S * 0.3))
  const comNomes = medidas && S >= 26
  const editando = !!aoPegarMovel

  const estadoDe = (c: Celula): EstadoDoLugar => estados?.get(c.chave) ?? 'vazio'

  function lugar(c: Celula, mv: Movel) {
    /* no editor a peça escolhida fica preta; as outras continuam dizendo se têm material */
    const estado = editando && escolhidos?.has(mv.id) ? 'aberto' : estadoDe(c)
    const quantos = ocupacao?.get(c.chave)?.quantos ?? 0
    const x = X(c.x)
    const y = Y(c.y)
    const w = c.largura * S
    const h = c.fundo * S
    const dentro = c.tipo === 'prateleira' ? 1.5 : 0
    const clicavel = !!aoAbrir && !editando
    /* o alvo de toque nunca é menor que 44 px: a prateleira fina e o palete
       pequeno ganham um retângulo invisível em volta */
    const aw = Math.max(w, ALVO)
    const ah = Math.max(h, ALVO)
    const precisaComprar = comprar?.has(c.chave) && (estado === 'tem' || estado === 'aberto')
    const r = Math.max(2.2, Math.min(3.5, S * 0.085))
    return (
      <g
        key={c.chave}
        className={['dp-lugar', estado, clicavel ? 'clica' : ''].filter(Boolean).join(' ')}
        data-lugar={c.nome}
        {...(clicavel
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-pressed': estado === 'aberto',
              'aria-label':
                (c.tipo === 'palete' ? 'Palete ' : 'Vão ') +
                c.nome +
                (quantos
                  ? ', ' + quantos + (quantos === 1 ? ' material' : ' materiais')
                  : ', vazio'),
              onClick: () => aoAbrir(c),
              onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  aoAbrir(c)
                }
              },
            }
          : {})}
      >
        <rect
          className="dp-caixa"
          x={x + dentro}
          y={y + dentro}
          width={Math.max(1, w - 2 * dentro)}
          height={Math.max(1, h - 2 * dentro)}
          rx={3}
        />
        {c.tipo === 'palete' && S >= 14
          ? [0.25, 0.5, 0.75].map(k => (
              <line
                key={k}
                className="dp-ripa"
                x1={x + w * k}
                y1={y + 2}
                x2={x + w * k}
                y2={y + h - 2}
              />
            ))
          : null}
        {comNomes ? (
          <>
            {c.tipo === 'palete' ? (
              <rect
                className="dp-fundo-do-nome"
                x={x + w / 2 - fonte * 1.25}
                y={y + h / 2 - fonte * 0.75}
                width={fonte * 2.5}
                height={fonte * 1.5}
                rx={3}
              />
            ) : null}
            <text
              className="dp-nome"
              x={x + w / 2}
              y={y + h / 2 + fonte * 0.36}
              textAnchor="middle"
              fontSize={fonte}
            >
              {c.nome}
            </text>
          </>
        ) : null}
        {precisaComprar ? (
          <circle className="dp-comprar" cx={x + w - r - 3.5} cy={y + r + 3.5} r={r} />
        ) : null}
        {clicavel ? (
          <rect
            className="dp-alvo"
            x={x + w / 2 - aw / 2}
            y={y + h / 2 - ah / 2}
            width={aw}
            height={ah}
          />
        ) : null}
      </g>
    )
  }

  function movel(mv: Movel) {
    const x = X(mv.x)
    const y = Y(mv.y)
    const w = mv.largura * S
    const h = mv.fundo * S
    const pegar = aoPegarMovel
      ? {
          tabIndex: 0,
          role: 'button',
          'aria-label': mv.nome,
          'aria-pressed': !!escolhidos?.has(mv.id),
          onPointerDown: (e: EventoDePonteiro<SVGGElement>) => aoPegarMovel(mv, e),
          onKeyDown: aoTeclarNoMovel
            ? (e: KeyboardEvent<SVGGElement>) => aoTeclarNoMovel(mv, e)
            : undefined,
        }
      : {}
    const classe = [
      'dp-movel',
      mv.tipo,
      editando ? 'pega' : '',
      escolhidos?.has(mv.id) ? 'escolhido' : '',
    ]
      .filter(Boolean)
      .join(' ')

    if (mv.tipo === 'escada') {
      const deLado = mv.largura >= mv.fundo
      const comprimento = deLado ? mv.largura : mv.fundo
      const degraus = Math.max(2, Math.round(comprimento / 0.4))
      const riscos = []
      for (let k = 1; k < degraus; k++) {
        const t = k / degraus
        riscos.push(
          deLado ? (
            <line key={k} className="dp-degrau" x1={x + w * t} y1={y} x2={x + w * t} y2={y + h} />
          ) : (
            <line key={k} className="dp-degrau" x1={x} y1={y + h * t} x2={x + w} y2={y + h * t} />
          ),
        )
      }
      /* O NOME DA ESCADA FICA EM CIMA DELA, MAS NUNCA EM CIMA DE OUTRA PEÇA.
         A prateleira encostada na escada escondia a metade do nome. Ele anda
         para a direita até livrar quem está na faixa; se a faixa não tem
         espaço (ou a escada está colada na parede de cima), ele entra na
         escada, com um contorno da cor do piso que abre os riscos dos degraus. */
      const comprimentoDoNome = (mv.nome.length * 7 + 12) / S
      let livre = mv.x
      for (let volta = 0; volta < 3; volta++) {
        for (const o of planta.moveis) {
          if (o.id === mv.id) continue
          const naFaixa = o.y < mv.y && o.y + o.fundo > mv.y - 24 / S
          if (naFaixa && o.x < livre + comprimentoDoNome && o.x + o.largura > livre) {
            livre = o.x + o.largura + 0.1
          }
        }
      }
      const dentro =
        deLado && (mv.y < 0.6 || livre + comprimentoDoNome > Math.max(mv.x + mv.largura, L))
      const p = Math.min(S * 0.35, 14)
      const a = Math.min(S * 0.22, 8)
      const seta = deLado
        ? `M ${x + p} ${y + h / 2} H ${x + w - p} m ${-a} ${-a * 0.75} l ${a} ${a * 0.75} l ${-a} ${a * 0.75}`
        : `M ${x + w / 2} ${y + p} V ${y + h - p} m ${-a * 0.75} ${-a} l ${a * 0.75} ${a} l ${a * 0.75} ${-a}`
      return (
        <g key={mv.id} className={classe} data-movel={mv.nome} {...pegar}>
          <rect className="dp-escada" x={x} y={y} width={w} height={h} />
          {riscos}
          <path className="dp-seta" d={seta} />
          {comNomes ? (
            <text
              className={dentro ? 'dp-legenda forte no-piso' : 'dp-legenda forte'}
              x={dentro ? x + 7 : deLado ? X(livre) + 6 : x + w + 8}
              y={dentro ? y + 16 : deLado ? y - 7 : y + 12}
              fontSize={12}
            >
              {mv.nome}
            </text>
          ) : null}
        </g>
      )
    }

    if (mv.tipo === 'porta') {
      return (
        <g key={mv.id} className={classe} data-movel={mv.nome} {...pegar}>
          <rect className="dp-porta" x={x} y={y} width={w} height={h} />
          {comNomes ? (
            <text
              className="dp-legenda forte"
              x={x + w / 2}
              y={mv.y + mv.fundo > A - 0.5 ? y - 7 : y + h + 15}
              textAnchor="middle"
              fontSize={12}
            >
              {mv.nome}
            </text>
          ) : null}
        </g>
      )
    }

    if (mv.tipo === 'palete') {
      return (
        <g key={mv.id} className={classe} data-movel={mv.nome} {...pegar}>
          {celulasDoMovel(mv).map(c => lugar(c, mv))}
        </g>
      )
    }

    /* a prateleira: a moldura e os vãos dentro dela */
    const texto = 'Prateleira ' + mv.nome + (mv.uso ? ' · ' + mv.uso : '')
    let legenda: ReactNode = null
    /* a prateleira escolhida mostra as medidas em volta: a legenda sai para não brigar com elas */
    if (comNomes && !escolhidos?.has(mv.id)) {
      if (mv.emPe) {
        const naDireita = mv.x + mv.largura > L - 1
        const tx = naDireita ? x - 10 : x + w + 14
        const ty = y + h / 2
        legenda = (
          <text
            className="dp-legenda"
            x={tx}
            y={ty}
            textAnchor="middle"
            fontSize={11}
            transform={`rotate(-90 ${tx} ${ty})`}
          >
            {texto}
          </text>
        )
      } else {
        const embaixo = mv.y < 1
        legenda = (
          <text className="dp-legenda" x={x + 2} y={embaixo ? y + h + 16 : y - 8} fontSize={11}>
            {texto}
          </text>
        )
      }
    }
    return (
      <g key={mv.id} className={classe} data-movel={mv.nome} {...pegar}>
        <rect className="dp-moldura" x={x - 1.5} y={y - 1.5} width={w + 3} height={h + 3} rx={5} />
        {celulasDoMovel(mv).map(c => lugar(c, mv))}
        {legenda}
      </g>
    )
  }

  /* a ordem do desenho: escada e porta embaixo, depois prateleiras e paletes */
  const ordem: Record<Movel['tipo'], number> = { escada: 0, porta: 1, prateleira: 2, palete: 3 }
  const emOrdem = [...planta.moveis].sort((a, b) => ordem[a.tipo] - ordem[b.tipo])
  const celulas = new Map(planta.moveis.flatMap(mv => celulasDoMovel(mv)).map(c => [c.chave, c]))
  const idDaGrade = 'dp-grade-' + Math.round(S * 100)

  return (
    <svg
      className={editando ? 'dp-planta editando' : 'dp-planta'}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={
        rotulo ?? `Planta do depósito vista de cima, ${metros(L)} por ${metros(A)} metros`
      }
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
    >
      <defs>
        <pattern
          id={idDaGrade}
          width={S}
          height={S}
          patternUnits="userSpaceOnUse"
          x={m.esquerda}
          y={m.cima}
        >
          <path className="dp-quadricula" d={`M ${S} 0 L 0 0 0 ${S}`} />
        </pattern>
      </defs>
      <rect className="dp-chao" x={X(0)} y={Y(0)} width={L * S} height={A * S} />
      <rect x={X(0)} y={Y(0)} width={L * S} height={A * S} fill={`url(#${idDaGrade})`} />
      <rect className="dp-parede" x={X(0)} y={Y(0)} width={L * S} height={A * S} />
      {emOrdem.map(movel)}
      {aviso ? (
        <>
          <text
            className="dp-aviso"
            x={X(L / 2)}
            y={Y(A / 2) - 11}
            textAnchor="middle"
            fontSize={15}
          >
            {aviso[0]}
          </text>
          <text
            className="dp-aviso leve"
            x={X(L / 2)}
            y={Y(A / 2) + 11}
            textAnchor="middle"
            fontSize={13}
          >
            {aviso[1]}
          </text>
        </>
      ) : null}
      {medidas ? (
        <>
          <text
            className="dp-medida"
            x={m.esquerda - 12}
            y={Y(A / 2)}
            textAnchor="middle"
            fontSize={11}
            transform={`rotate(-90 ${m.esquerda - 12} ${Y(A / 2)})`}
          >
            {metros(A)} m
          </text>
          <text className="dp-medida" x={X(L) - 2} y={Y(A) + 20} textAnchor="end" fontSize={11}>
            {metros(L)} m
          </text>
          <path className="dp-regua" d={`M ${X(0)} ${Y(A) + 12} v 6 h ${S} v -6`} />
          <text className="dp-medida" x={X(0) + S + 6} y={Y(A) + 20} fontSize={11}>
            1 m
          </text>
        </>
      ) : null}
      {(marcadores ?? []).map((chave, i) => {
        const c = celulas.get(chave)
        if (!c) return null
        const r = S >= 30 ? 10 : 8
        return (
          <g
            key={chave}
            className="dp-marcador"
            style={{ transformOrigin: `${X(c.x) + 1}px ${Y(c.y) + 1}px` }}
          >
            <circle cx={X(c.x) + 1} cy={Y(c.y) + 1} r={r} />
            <text x={X(c.x) + 1} y={Y(c.y) + 1 + r * 0.38} textAnchor="middle" fontSize={r * 1.1}>
              {i + 1}
            </text>
          </g>
        )
      })}
      {porCima}
    </svg>
  )
}

/* ---------- o desenho que se ajusta à largura ------------------------------ */

export function PlantaDoDeposito({
  maxima = 56,
  className = '',
  ...resto
}: Omit<PropsDoDesenho, 'escala'> & { maxima?: number; className?: string }) {
  const [ref, largura] = usarLarguraDe<HTMLDivElement>()
  const S = escalaQueCabe(resto.planta, largura, resto.medidas ?? true, maxima)
  return (
    <div ref={ref} className={['dp-moldura-da-planta', className].filter(Boolean).join(' ')}>
      {S > 0 ? <DesenhoDaPlanta {...resto} escala={S} /> : null}
    </div>
  )
}

/* ---------- o que o editor desenha por cima -------------------------------- */

/** as alças de um retângulo: os quatro cantos e o meio dos dois lados compridos */
export type Alca = { hx: -1 | 0 | 1; hy: -1 | 0 | 1 }

export function alcasDoRetangulo(largura: number, fundo: number): Alca[] {
  const cantos: Alca[] = [
    { hx: -1, hy: -1 },
    { hx: 1, hy: -1 },
    { hx: -1, hy: 1 },
    { hx: 1, hy: 1 },
  ]
  return largura >= fundo
    ? [...cantos, { hx: 0, hy: -1 }, { hx: 0, hy: 1 }]
    : [...cantos, { hx: -1, hy: 0 }, { hx: 1, hy: 0 }]
}

export function SelecaoDoMovel({
  movel,
  escala: S,
  medidas = true,
  aoPegarAlca,
}: {
  movel: Movel
  escala: number
  medidas?: boolean
  aoPegarAlca: (a: Alca, e: EventoDePonteiro<SVGRectElement>) => void
}) {
  const m = margens(medidas)
  const x = m.esquerda + movel.x * S
  const y = m.cima + movel.y * S
  const w = movel.largura * S
  const h = movel.fundo * S
  return (
    <g className="dp-selecao">
      <rect className="dp-contorno" x={x - 5} y={y - 5} width={w + 10} height={h + 10} rx={7} />
      <text className="dp-cota" x={x + w / 2} y={y - 14} textAnchor="middle" fontSize={12}>
        {metros(movel.largura)} m
      </text>
      <text className="dp-cota" x={x + w + 16} y={y + h / 2 + 4} fontSize={12}>
        {metros(movel.fundo)} m
      </text>
      {alcasDoRetangulo(movel.largura, movel.fundo).map(a => {
        const ax = x + (a.hx === -1 ? -5 : a.hx === 1 ? w + 5 : w / 2)
        const ay = y + (a.hy === -1 ? -5 : a.hy === 1 ? h + 5 : h / 2)
        const cursor =
          a.hx === 0
            ? 'ns-resize'
            : a.hy === 0
              ? 'ew-resize'
              : a.hx === a.hy
                ? 'nwse-resize'
                : 'nesw-resize'
        return (
          <g key={a.hx + ':' + a.hy} style={{ cursor }}>
            <rect className="dp-alca" x={ax - 5} y={ay - 5} width={10} height={10} rx={2} />
            {/* o alvo é maior que a alça: 10 px ninguém acerta com o dedo */}
            <rect
              className="dp-alvo"
              x={ax - 14}
              y={ay - 14}
              width={28}
              height={28}
              onPointerDown={e => aoPegarAlca(a, e)}
            />
          </g>
        )
      })}
    </g>
  )
}

export function SelecaoDaGrade({
  planta,
  gradeId,
  escala: S,
  medidas = true,
  aoPegarCanto,
}: {
  planta: Planta
  gradeId: string
  escala: number
  medidas?: boolean
  aoPegarCanto: (a: Alca, e: EventoDePonteiro<SVGRectElement>) => void
}) {
  const g = gradeDosPaletes(planta, gradeId)
  if (!g) return null
  const m = margens(medidas)
  const c = contornoDaGrade(g)
  const x = m.esquerda + c.x * S
  const y = m.cima + c.y * S
  const w = c.largura * S
  const h = c.fundo * S
  const passoX = metros(g.largura + g.espacoX)
  const passoY = metros(g.fundo + g.espacoY)
  const aCada =
    passoX === passoY || g.fileiras === 1
      ? `a cada ${passoX} m`
      : g.colunas === 1
        ? `a cada ${passoY} m`
        : `colunas a cada ${passoX} m, fileiras a cada ${passoY} m`
  const texto = `${g.fileiras} ${g.fileiras === 1 ? 'fileira' : 'fileiras'} por ${g.colunas} ${g.colunas === 1 ? 'coluna' : 'colunas'}, ${aCada}`
  const cantos: Alca[] = [
    { hx: -1, hy: -1 },
    { hx: 1, hy: -1 },
    { hx: -1, hy: 1 },
    { hx: 1, hy: 1 },
  ]
  return (
    <g className="dp-selecao">
      <rect
        className="dp-contorno tracejado"
        x={x - 8}
        y={y - 8}
        width={w + 16}
        height={h + 16}
        rx={7}
      />
      <rect
        className="dp-fundo-da-cota"
        x={x + w - texto.length * 6.4 - 4}
        y={y + h + 14}
        width={texto.length * 6.4 + 12}
        height={22}
        rx={5}
      />
      <text className="dp-cota" x={x + w + 2} y={y + h + 30} textAnchor="end" fontSize={12}>
        {texto}
      </text>
      {cantos.map(a => {
        const ax = x + (a.hx === -1 ? -8 : w + 8)
        const ay = y + (a.hy === -1 ? -8 : h + 8)
        return (
          <g
            key={a.hx + ':' + a.hy}
            style={{ cursor: a.hx === a.hy ? 'nwse-resize' : 'nesw-resize' }}
          >
            <rect className="dp-alca" x={ax - 5} y={ay - 5} width={10} height={10} rx={2} />
            <rect
              className="dp-alvo"
              x={ax - 14}
              y={ay - 14}
              width={28}
              height={28}
              onPointerDown={e => aoPegarCanto(a, e)}
            />
          </g>
        )
      })}
    </g>
  )
}

/** de pixel do desenho para metro do chão */
export function metrosDoPonteiro(
  e: { clientX: number; clientY: number },
  svg: SVGSVGElement,
  escala: number,
  medidas = true,
): { x: number; y: number } {
  const caixa = svg.getBoundingClientRect()
  const m = margens(medidas)
  return {
    x: (e.clientX - caixa.left - m.esquerda) / escala,
    y: (e.clientY - caixa.top - m.cima) / escala,
  }
}
