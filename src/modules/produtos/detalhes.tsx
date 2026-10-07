import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { DotsSixVertical, Plus, Trash } from '@phosphor-icons/react'
import { Botao, Entrada, LINHA_ESCOLHIDA, Modal, Seletor, avisar } from '@ds'
import {
  DETALHES,
  PLURAL_DO_DETALHE,
  abrirListas,
  adicionarItemDeDetalhe,
  carregarListasDeDetalhe,
  comItemNovo,
  fecharListas,
  listaMudou,
  listasMudaram,
  listasVazias,
  nomeNaLista,
  opcoesDoDetalhe,
  quemUsa,
  salvarListasDeDetalhe,
  type ChaveDeDetalhe,
  type ItemDeDetalhe,
  type ListasDeDetalhe,
  type ListasParaOBanco,
  type RascunhoDasListas,
  type Renome,
} from '@dominio/produto'
import { plural } from './apoio'

/* ==========================================================================
   OS DETALHES DA PEÇA EM LISTA (pranchas 113 e 114, de 07/10/2026).

   Três peças, usadas pelo editor da referência e pelo editor do kit:

   usarListasDeDetalhe  lê as cinco listas do banco e guarda qual delas o
                        editor está mostrando
   SeletorDeDetalhe     o seletor do Design System com a lista de um detalhe.
                        Escreveu um nome que não existe? Aparece "Adicionar", o
                        item entra na lista NA HORA e já fica escolhido
   EditorDasListas      a caixa com as cinco listas: acrescentar, mudar o nome,
                        mudar a ordem e tirar

   O QUE FICA GUARDADO NA FICHA É O TEXTO. Por isso o texto de antes das
   listas continua aparecendo no seletor, marcado como "fora da lista", e tirar
   um item da lista não apaga nada de ficha nenhuma.
   ========================================================================== */

/** As listas, lidas uma vez ao abrir o editor. Se a leitura cair, as listas
    ficam vazias e os seletores mostram só o que a ficha já diz: a tela não cai
    por causa de uma lista de apoio. */
export function usarListasDeDetalhe() {
  const [listas, setListas] = useState<ListasDeDetalhe>(listasVazias)
  /** a lista que o editor está mostrando; nula, o editor está fechado */
  const [editando, setEditando] = useState<ChaveDeDetalhe | null>(null)

  const reler = useCallback(async () => {
    try {
      setListas(await carregarListasDeDetalhe())
    } catch {
      /* fica com o que tinha */
    }
  }, [])
  useEffect(() => {
    void reler()
  }, [reler])

  /** Põe o item na lista e devolve o nome como ficou guardado. Vazio se não deu. */
  const adicionar = useCallback(
    async (detalhe: ChaveDeDetalhe, nome: string): Promise<string> => {
      const limpo = nome.trim()
      if (!limpo) return ''
      try {
        await adicionarItemDeDetalhe(detalhe, limpo)
        const novas = await carregarListasDeDetalhe()
        setListas(novas)
        return nomeNaLista(novas[detalhe], limpo)
      } catch (e) {
        avisar(e instanceof Error ? e.message : 'Não consegui pôr o item na lista.', 'brand')
        return ''
      }
    },
    [],
  )

  return { listas, reler, adicionar, editando, setEditando }
}

export function SeletorDeDetalhe({
  detalhe,
  nome,
  valor,
  lista,
  vazio,
  aoEscolher,
  aoCriar,
  aoEditarALista,
}: {
  detalhe: ChaveDeDetalhe
  /** "Gola", para o rótulo de quem lê a tela com leitor */
  nome: string
  valor: string
  lista: ItemDeDetalhe[]
  /** o que o seletor diz quando nada foi escolhido, e que também é a opção de limpar */
  vazio: string
  aoEscolher: (texto: string) => void
  /** escreveu um nome que não existe: põe na lista e escolhe */
  aoCriar: (texto: string) => void
  aoEditarALista: () => void
}) {
  return (
    <span data-detalhe={detalhe} aria-label={nome}>
      <Seletor
        campo
        bloco
        valor={valor}
        opcoes={opcoesDoDetalhe(lista, valor)}
        aoEscolher={aoEscolher}
        vazio={vazio}
        aoCriar={aoCriar}
        pe={{
          texto: plural(lista.length, 'item', 'itens'),
          rotulo: `Editar a lista de ${PLURAL_DO_DETALHE[detalhe]}`,
          aoClicar: aoEditarALista,
        }}
      />
    </span>
  )
}

export function EditorDasListas({
  aberta,
  listas,
  aoFechar,
  aoSalvo,
}: {
  /** a lista que abre à mostra; nula, a caixa está fechada */
  aberta: ChaveDeDetalhe | null
  listas: ListasDeDetalhe
  aoFechar: () => void
  /** salvou: a tela relê as listas e acerta os nomes que mudaram */
  aoSalvo: (renomes: Renome[]) => Promise<void> | void
}) {
  const [rasc, setRasc] = useState<RascunhoDasListas>(() => abrirListas(listas))
  const [qual, setQual] = useState<ChaveDeDetalhe>(aberta ?? 'gola')
  const [novo, setNovo] = useState('')
  const [gravando, setGravando] = useState(false)

  /* cada vez que a caixa abre, ela começa do que está no banco */
  useEffect(() => {
    if (!aberta) return
    setRasc(abrirListas(listas))
    setQual(aberta)
    setNovo('')
    /* só ao abrir: as listas relidas com a caixa aberta não apagam o que está sendo digitado */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta])

  const itens = rasc[qual]
  const nomeDaLista = DETALHES.find(d => d.chave === qual)?.nome ?? ''
  const mudou = listasMudaram(listas, rasc)

  const mudarLista = (lista: RascunhoDasListas[ChaveDeDetalhe]) =>
    setRasc(atual => ({ ...atual, [qual]: lista }))

  function adicionar() {
    const n = novo.trim()
    if (!n) return
    const depois = comItemNovo(itens, n)
    if (depois === itens) {
      avisar(`"${n}" já está na lista de ${PLURAL_DO_DETALHE[qual]}.`, 'warn')
      return
    }
    mudarLista(depois)
    setNovo('')
  }

  /* Pelo teclado, a linha muda de lugar e a alça tem de continuar com o foco:
     senão a segunda seta não acha ninguém. Nem todo navegador guarda o foco de
     um elemento que é tirado e posto de volta na página, então quem devolve é
     a caixa, depois de desenhar. */
  const caixaDosItens = useRef<HTMLDivElement>(null)
  const focoEm = useRef<number | null>(null)
  useEffect(() => {
    if (focoEm.current === null) return
    const alca = caixaDosItens.current?.querySelector<HTMLElement>(
      `[data-item-da-lista="${focoEm.current}"] button`,
    )
    focoEm.current = null
    if (alca && document.activeElement !== alca) alca.focus()
  })
  function mover(de: number, para: number) {
    if (para < 0 || para >= itens.length || de === para) return
    const lista = [...itens]
    const [i] = lista.splice(de, 1)
    lista.splice(para, 0, i)
    focoEm.current = i.chave
    mudarLista(lista)
  }

  /* O arrasto pela alça, igual ao da tabela de medidas: enquanto o ponteiro
     passa por cima de outra linha, o item vai para o lugar dela. Quem ouve o
     movimento é a janela, porque a linha que muda de lugar perde o ponteiro. */
  const [presa, setPresa] = useState<number | null>(null)
  const largar = useRef<(() => void) | null>(null)
  useEffect(() => () => largar.current?.(), [])
  function pegar(e: PointerEvent<HTMLButtonElement>, chave: number) {
    if (e.button !== 0) return
    largar.current?.()
    setPresa(chave)
    const lista = qual
    const aoMover = (ev: globalThis.PointerEvent) => {
      const alvo = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-item-da-lista]')
      if (!alvo) return
      setRasc(atual => {
        const daVez = atual[lista]
        const de = daVez.findIndex(i => i.chave === chave)
        const para = daVez.findIndex(i => String(i.chave) === alvo.dataset.itemDaLista)
        if (de < 0 || para < 0 || de === para) return atual
        const nova = [...daVez]
        const [i] = nova.splice(de, 1)
        nova.splice(para, 0, i)
        return { ...atual, [lista]: nova }
      })
    }
    const aoLargar = () => {
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoLargar)
      window.removeEventListener('pointercancel', aoLargar)
      largar.current = null
      setPresa(null)
    }
    largar.current = aoLargar
    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoLargar)
    window.addEventListener('pointercancel', aoLargar)
  }

  async function salvar() {
    if (gravando) return
    const fechado = fecharListas(rasc)
    if (!fechado.listas) {
      setQual(fechado.onde)
      avisar(fechado.erro, 'brand')
      return
    }
    /* o que mudou de nome, para a ficha aberta acertar o texto dela */
    const renomes: Renome[] = []
    for (const d of DETALHES)
      for (const antes of listas[d.chave]) {
        const depois = rasc[d.chave].find(i => i.id === antes.id)
        if (depois && depois.nome.trim() !== antes.nome)
          renomes.push({ detalhe: d.chave, de: antes.nome, para: depois.nome.trim() })
      }
    /* SÓ VAI A LISTA QUE MUDOU. O banco troca a lista inteira que recebe, e
       tira dela o que não veio: mandar as cinco apagaria o item que outra
       pessoa acabou de pôr numa lista em que ninguém mexeu aqui. */
    const mudadas: Partial<ListasParaOBanco> = {}
    for (const d of DETALHES)
      if (listaMudou(listas[d.chave], rasc[d.chave])) mudadas[d.chave] = fechado.listas[d.chave]
    setGravando(true)
    try {
      await salvarListasDeDetalhe(mudadas)
      avisar('Listas salvas.', 'ok')
      await aoSalvo(renomes)
      aoFechar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar as listas.', 'brand')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto={!!aberta}
      aoFechar={aoFechar}
      titulo="Listas dos detalhes de peça"
      largo
      solto
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="primario" onClick={() => void salvar()} disabled={!mudou || gravando}>
            {gravando ? 'Salvando' : 'Salvar as listas'}
          </Botao>
        </>
      }
    >
      <div className="pd-lo" data-listas="">
        <div className="pd-lo-esq">
          {DETALHES.map(d => (
            <button
              type="button"
              key={d.chave}
              className={d.chave === qual ? 'pd-lo-d on ' + LINHA_ESCOLHIDA : 'pd-lo-d'}
              aria-pressed={d.chave === qual}
              onClick={() => {
                setQual(d.chave)
                setNovo('')
              }}
            >
              <b>{d.nome}</b>
              <small>{plural(rasc[d.chave].length, 'item', 'itens')}</small>
            </button>
          ))}
        </div>

        <div className="pd-lo-dir">
          <div className="pd-lo-cab">
            <b>{nomeDaLista}</b>
            <small>
              {itens.length
                ? `${plural(itens.length, 'item', 'itens')} · arraste pela alça para mudar a ordem`
                : 'nenhum item ainda'}
            </small>
          </div>

          <div className="pd-lo-itens" ref={caixaDosItens}>
            {itens.length === 0 ? (
              <p className="pd-lo-vazia">
                Esta lista está vazia. Escreva o primeiro item no campo abaixo e clique em
                Adicionar.
              </p>
            ) : null}
            {itens.map((i, n) => (
              <div
                key={i.chave}
                data-item-da-lista={i.chave}
                className={[
                  'pd-lo-l',
                  i.id ? '' : 'novo',
                  presa === i.chave ? 'presa' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className="pd-pega"
                  aria-label={
                    'Mudar a ordem de ' + (i.nome || 'item') + '. Arraste, ou use as setas para cima e para baixo.'
                  }
                  onPointerDown={e => pegar(e, i.chave)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      mover(n, n - 1)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      mover(n, n + 1)
                    }
                  }}
                >
                  <DotsSixVertical size={16} weight="bold" aria-hidden="true" />
                </button>
                <Entrada
                  tamanho="sm"
                  value={i.nome}
                  maxLength={200}
                  aria-label="Nome do item"
                  onChange={e =>
                    mudarLista(
                      itens.map(x => (x.chave === i.chave ? { ...x, nome: e.currentTarget.value } : x)),
                    )
                  }
                />
                <small>{i.id ? quemUsa(i) : 'novo · ainda sem uso'}</small>
                <Botao
                  tom="limpo"
                  tamanho="sm"
                  icone
                  aria-label={`Tirar ${i.nome || 'item'} da lista`}
                  title="Tirar da lista"
                  onClick={() => mudarLista(itens.filter(x => x.chave !== i.chave))}
                >
                  <Trash size={16} aria-hidden="true" />
                </Botao>
              </div>
            ))}
          </div>

          <div className="pd-lo-novo">
            <Entrada
              value={novo}
              maxLength={200}
              placeholder={`Item novo de ${nomeDaLista.toLowerCase()}`}
              aria-label="Item novo"
              onChange={e => setNovo(e.currentTarget.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  adicionar()
                }
              }}
            />
            <Botao tom="forte" onClick={adicionar} disabled={!novo.trim()}>
              <Plus size={16} aria-hidden="true" />
              Adicionar
            </Botao>
          </div>

          <ul className="pd-lo-regras">
            <li>
              <b>Mudar o nome</b> muda também nas referências e nos kits que usam o item.
            </li>
            <li>
              <b>Tirar da lista</b> não apaga nada das fichas: nelas o texto continua, e o item só
              deixa de aparecer para escolher.
            </li>
            <li>
              <b>A ordem</b> daqui é a ordem em que os itens aparecem na lista.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}
