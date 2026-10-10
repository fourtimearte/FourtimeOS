import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DotsThree, Flask, GearSix, Plus, Trash, X } from '@phosphor-icons/react'
import { Botao, Flutuante, MenuDeContexto } from '@ds'
import { carregarCotacoes, type CotacaoNaLista } from '@dominio/cotacao'
import './cotacao.css'

/* ==========================================================================
   A FILEIRA DAS COTAÇÕES ABERTAS, embaixo do cabeçalho do editor.

   À esquerda, as abas no segmentado (decisão 135), uma por cotação aberta
   neste navegador, com o X na aberta e o + que volta à lista para abrir outra.
   As que não cabem na largura vão para os três pontos do fim da caixa
   (decisão 138): a aberta nunca se esconde, e escolhida no menu ela toma o
   último lugar.

   À direita, os três pontos das ações da cotação (o Apagar mora aqui, longe
   da mão, e sempre pergunta antes: decisão 156) e a engrenagem que só o
   administrador vê, com o Kit de teste dentro.

   "Aberta" é deste navegador, como as abas de um programa: abrir uma cotação
   põe ela na frente da fila, o X tira. Guardado no armazenamento do
   navegador, e se ele falhar a fila vale só nesta visita.
   ========================================================================== */

const CHAVE = 'ft.cotacoes.abertas'
const MAX = 8

function lerAbertas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}
function gravarAbertas(ids: string[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ids.slice(0, MAX)))
  } catch {
    /* sem armazenamento: a fila vale só nesta visita */
  }
}

/** Abrir uma cotação: ela vai para a frente da fila, se ainda não estiver nela. */
export function marcarAberta(id: string) {
  const l = lerAbertas()
  if (!l.includes(id)) gravarAbertas([id, ...l])
}

const nomeDaAba = (x: CotacaoNaLista) => (x.clienteNome || x.numero).split(' ').slice(0, 2).join(' ')

export function AbasDoEditor({
  atual,
  admin,
  ensaio,
  aoIr,
  aoLista,
  aoApagar,
  aoKitDeTeste,
}: {
  atual: string
  admin: boolean
  ensaio: boolean
  aoIr: (id: string) => void
  aoLista: () => void
  aoApagar: () => void
  aoKitDeTeste: () => void
}) {
  const [ids, setIds] = useState<string[]>(() => {
    marcarAberta(atual)
    return lerAbertas()
  })
  const [nomes, setNomes] = useState<Map<string, CotacaoNaLista>>(new Map())

  useEffect(() => {
    marcarAberta(atual)
    setIds(lerAbertas())
  }, [atual])

  /* os nomes vêm da VIEW, sem o corpo: desenhar seis nomes não pode baixar as
     imagens dos layouts de seis orçamentos */
  useEffect(() => {
    let vivo = true
    carregarCotacoes()
      .then((l) => {
        if (!vivo) return
        const m = new Map(l.map((x) => [x.id, x]))
        setNomes(m)
        /* cotação apagada por outra pessoa sai da fila sozinha */
        const vivas = lerAbertas().filter((id) => m.has(id) || id === atual)
        gravarAbertas(vivas)
        setIds(vivas)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [atual])

  function fechar(id: string) {
    const resto = ids.filter((x) => x !== id)
    gravarAbertas(resto)
    setIds(resto)
    if (id === atual) {
      if (resto.length) aoIr(resto[0])
      else aoLista()
    }
  }

  const abas = ids.map((id) => ({ id, nome: nomes.get(id) ? nomeDaAba(nomes.get(id)!) : '...' }))

  return (
    <div className="ct-faixa">
      <AbasQueCabem abas={abas} atual={atual} aoIr={aoIr} aoFechar={fechar} aoLista={aoLista} />
      <div className="ct-faixa-fim">
        <MaisAcoes aoApagar={aoApagar} />
        {admin ? <Engrenagem ensaio={ensaio} aoKitDeTeste={aoKitDeTeste} /> : null}
      </div>
    </div>
  )
}

/* AS ABAS QUE CABEM. Uma fileira escondida mede a largura natural de cada aba;
   ficam à mostra as que cabem, na ordem, e as outras vão para os três pontos.
   A aberta nunca se esconde: se ela não coube, toma o último lugar. */
function AbasQueCabem({
  abas,
  atual,
  aoIr,
  aoFechar,
  aoLista,
}: {
  abas: { id: string; nome: string }[]
  atual: string
  aoIr: (id: string) => void
  aoFechar: (id: string) => void
  aoLista: () => void
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const medidor = useRef<HTMLDivElement>(null)
  const seg = useRef<HTMLDivElement>(null)
  const btMais = useRef<HTMLButtonElement>(null)
  const [cabem, setCabem] = useState(abas.length)
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null)
  const [menu, setMenu] = useState(false)

  useLayoutEffect(() => {
    const cx = caixa.current
    const md = medidor.current
    if (!cx || !md) return
    const medir = () => {
      const larguras = [...md.children].map((b) => (b as HTMLElement).offsetWidth)
      /* o que sobra da caixa: o + de abrir outra (40), o vão dele (8), o recheio
         do segmentado (8) e, se faltar lugar, o botão dos três pontos (36) */
      const livre = cx.clientWidth - 48 - 8
      let usado = 0
      let n = 0
      for (const w of larguras) {
        if (usado + w + (n ? 4 : 0) > livre - (n + 1 < larguras.length ? 36 : 0)) break
        usado += w + (n ? 4 : 0)
        n++
      }
      setCabem(Math.max(1, n))
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(cx)
    return () => obs.disconnect()
  }, [abas])

  let vistas = abas.slice(0, cabem)
  if (!vistas.some((a) => a.id === atual)) {
    const aberta = abas.find((a) => a.id === atual)
    if (aberta) vistas = [...vistas.slice(0, Math.max(0, cabem - 1)), aberta]
  }
  const escondidas = abas.filter((a) => !vistas.includes(a))

  useLayoutEffect(() => {
    const s = seg.current
    const b = s?.querySelector<HTMLElement>('[aria-selected="true"]')
    setInd(b ? { x: b.offsetLeft, w: b.offsetWidth } : null)
  }, [vistas.map((v) => v.id + v.nome).join(), atual])

  const aba = (a: { id: string; nome: string }, medir = false) => {
    const ligada = a.id === atual
    return (
      <button
        key={a.id}
        type="button"
        role="tab"
        aria-selected={medir ? undefined : ligada}
        tabIndex={medir ? -1 : undefined}
        className={ligada ? 'ligado ct-doc' : 'ct-doc'}
        onClick={medir ? undefined : () => !ligada && aoIr(a.id)}
        onKeyDown={medir ? undefined : (e) => e.key === 'Delete' && aoFechar(a.id)}
      >
        {a.nome}
        {ligada ? (
          <span
            className="ct-doc-x"
            aria-hidden="true"
            title="Fechar esta aba (Delete)"
            onClick={(e) => {
              e.stopPropagation()
              if (!medir) aoFechar(a.id)
            }}
          >
            <X size={12} />
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div className="ct-docs" ref={caixa}>
      <div className="seg ct-docs-seg" ref={seg} role="tablist" aria-label="Cotações abertas">
        {ind ? <span className="ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} /> : null}
        {vistas.map((a) => aba(a))}
        {escondidas.length ? (
          <button ref={btMais} type="button" className="ct-doc-mais" aria-label={'Mais ' + escondidas.length + ' cotações abertas'} title="Outras cotações abertas" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <DotsThree size={18} weight="bold" />
          </button>
        ) : null}
      </div>
      <Botao tom="limpo" tamanho="sm" icone aria-label="Abrir outra cotação" title="Abrir outra cotação" onClick={aoLista}>
        <Plus size={16} />
      </Botao>
      <MenuDeContexto
        aberto={menu}
        ancora={btMais}
        aoFechar={() => setMenu(false)}
        itens={escondidas.map((a) => ({ rotulo: a.nome, aoEscolher: () => aoIr(a.id) }))}
      />
      {/* a fileira escondida que mede: as mesmas abas, sem ninguém ver */}
      <div className="ct-docs-regua" aria-hidden="true">
        <div className="seg ct-docs-seg" ref={medidor}>
          {abas.map((a) => aba(a, true))}
        </div>
      </div>
    </div>
  )
}

function MaisAcoes({ aoApagar }: { aoApagar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const bt = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={bt}
        type="button"
        className="btn btn-limpo sm icone"
        aria-label="Mais ações da cotação"
        title="Mais ações"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <DotsThree size={18} weight="bold" />
      </button>
      <Flutuante aberto={aberto} ancora={bt} aoFechar={() => setAberto(false)} opcoes={{ alinhar: 'direita' }}>
        <div className="mn-lista ct-menu">
          <button
            type="button"
            className="mn-item ct-menu-risco"
            onClick={() => {
              setAberto(false)
              aoApagar()
            }}
          >
            <Trash size={16} />
            <span className="nm">Apagar cotação</span>
          </button>
        </div>
      </Flutuante>
    </>
  )
}

/* A ENGRENAGEM DO ADMINISTRADOR (item 35 (j) do 12): o vendedor não vê. Por
   enquanto ela guarda o Kit de teste, que só funciona com o sistema em ensaio. */
function Engrenagem({ ensaio, aoKitDeTeste }: { ensaio: boolean; aoKitDeTeste: () => void }) {
  const [aberto, setAberto] = useState(false)
  const bt = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={bt}
        type="button"
        className="btn btn-contorno sm icone"
        aria-label="Ferramentas do administrador"
        title="Ferramentas do administrador"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <GearSix size={17} />
      </button>
      <Flutuante aberto={aberto} ancora={bt} aoFechar={() => setAberto(false)} opcoes={{ alinhar: 'direita' }}>
        <div className="mn-lista ct-menu">
          <span className="ct-menu-rot">Só o administrador vê</span>
          <button
            type="button"
            className="mn-item"
            disabled={!ensaio}
            title={ensaio ? undefined : 'O kit de teste só monta com o sistema em ensaio'}
            onClick={() => {
              setAberto(false)
              aoKitDeTeste()
            }}
          >
            <Flask size={16} />
            <span className="nm">Kit de teste</span>
          </button>
        </div>
      </Flutuante>
    </>
  )
}
