import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  diasParaAEntrega,
  type FatiaNoQuadro,
  type PedidoNoTrilho,
  type Rota,
} from '@dominio/producao'
import { GraficoDoPedido } from './grafico'
import { SetaDireita, SetaEsquerda } from './setas'

/* ==========================================================================
   O TRILHO DE ENTREGAS, do jeito do wireframe de 01/10/2026.

   OS PEDIDOS VÊM SEPARADOS POR DATA, na ordem: atrasados, hoje, amanhã e os
   dias seguintes, cada grupo com o rótulo em cima. A pergunta da manhã é "o
   que sai primeiro", e a resposta é a ordem da esquerda para a direita.

   SEM BARRA DE ROLAGEM, COM SETAS. Pedido do Henrique: a barra do sistema é
   o elemento padrão do navegador que o V7 proíbe, e num trilho de cartões ela
   é uma tira cinza que ninguém usa. As setas andam 300px por toque.

   O CARTÃO É UMA SANFONA. Fechado ele tem 156px com número, prazo, nome e
   peças; aberto ele cresce para 580px, fica escuro como o cartão escolhido do
   quadro, e mostra o gráfico de onde cada layout está. Abrir acende os
   cartões dele no quadro; o "Abrir o pedido" leva para o pedido inteiro.
   ========================================================================== */

const PASSO = 300
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

type Grupo = { chave: string; rotulo: string; data: string; tom: '' | 'atraso' | 'perto'; pedidos: PedidoNoTrilho[] }

function dataCurta(iso: string) {
  const [, m, d] = iso.split('-')
  return d + '/' + m
}

function agrupar(pedidos: PedidoNoTrilho[]): Grupo[] {
  const grupos: Grupo[] = []
  for (const p of pedidos) {
    const chave = p.entregaEm || 'sem-data'
    let g = grupos.find((x) => x.chave === chave)
    if (!g) {
      const dias = diasParaAEntrega(p.entregaEm)
      const dia = p.entregaEm ? new Date(p.entregaEm + 'T12:00:00').getDay() : 0
      g =
        dias === null
          ? { chave, rotulo: 'Sem data', data: '', tom: '', pedidos: [] }
          : dias < 0
            ? { chave, rotulo: 'Atrasado', data: dataCurta(p.entregaEm), tom: 'atraso', pedidos: [] }
            : dias === 0
              ? { chave, rotulo: 'Hoje', data: DIAS_CURTOS[dia] + ' ' + dataCurta(p.entregaEm), tom: 'perto', pedidos: [] }
              : dias === 1
                ? { chave, rotulo: 'Amanhã', data: DIAS_CURTOS[dia] + ' ' + dataCurta(p.entregaEm), tom: 'perto', pedidos: [] }
                : { chave, rotulo: DIAS[dia], data: dataCurta(p.entregaEm), tom: '', pedidos: [] }
      grupos.push(g)
    }
    g.pedidos.push(p)
  }
  return grupos
}

function prazo(iso: string) {
  const dias = diasParaAEntrega(iso)
  if (dias === null) return 'sem data'
  if (dias < 0) return Math.abs(dias) + (dias === -1 ? ' dia atrás' : ' dias atrás')
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return 'em ' + dias + ' dias'
}

export function Trilho({
  pedidos,
  fatias,
  rotas,
  aceso,
  aoEscolher,
  aoAbrirPedido,
}: {
  pedidos: PedidoNoTrilho[]
  fatias: FatiaNoQuadro[]
  rotas: Rota[]
  aceso: string
  aoEscolher: (p: PedidoNoTrilho) => void
  aoAbrirPedido: (p: PedidoNoTrilho) => void
}) {
  const janela = useRef<HTMLDivElement>(null)
  const fita = useRef<HTMLDivElement>(null)
  const [desvio, setDesvio] = useState(0)
  const [maximo, setMaximo] = useState(0)

  /* QUANTO A FITA PASSA DA JANELA. Medido, e não calculado: o cartão aberto
     muda a largura, o menu lateral encolhe e abre, e a conta de cabeça erraria
     em pelo menos um desses. */
  useLayoutEffect(() => {
    const medir = () => {
      const j = janela.current
      const f = fita.current
      if (!j || !f) return
      const m = Math.max(0, f.scrollWidth - j.clientWidth)
      setMaximo(m)
      setDesvio((d) => Math.min(d, m))
    }
    medir()
    const ro = new ResizeObserver(medir)
    if (janela.current) ro.observe(janela.current)
    if (fita.current) ro.observe(fita.current)
    return () => ro.disconnect()
  }, [pedidos.length, aceso])

  /* O CARTÃO QUE ABRE TEM QUE FICAR À VISTA. Ele cresce para 580px, e sem
     isto metade do gráfico podia nascer fora da janela, do lado das setas. */
  useEffect(() => {
    if (!aceso) return
    const j = janela.current
    const el = fita.current?.querySelector<HTMLElement>(`[data-pedido="${aceso}"]`)
    if (!j || !el) return
    const x = el.offsetLeft
    const w = el.offsetWidth
    setDesvio((d) => {
      if (x < d) return x
      if (x + w > d + j.clientWidth) return x + w - j.clientWidth
      return d
    })
  }, [aceso])

  if (!pedidos.length) {
    return (
      <div className="kb-trilho">
        <p className="kb-trilho-vazio">
          Nenhum pedido correndo. O trilho enche quando o diretor aprova a produção, no PCP.
        </p>
      </div>
    )
  }

  const grupos = agrupar(pedidos)

  return (
    <div className="kb-trilho">
      <button
        type="button"
        className="kb-seta"
        aria-label="Pedidos anteriores"
        disabled={desvio <= 0}
        onClick={() => setDesvio((d) => Math.max(0, d - PASSO))}
      >
        <SetaEsquerda />
      </button>

      <div className="kb-trilho-janela" ref={janela}>
        <div
          className="kb-trilho-fita"
          ref={fita}
          role="list"
          aria-label="Pedidos por data de entrega"
          style={{ transform: `translateX(${-desvio}px)` }}
        >
          {grupos.map((g) => (
            <div key={g.chave} className="kb-dia">
              <div className={g.tom ? 'kb-dia-rot ' + g.tom : 'kb-dia-rot'}>
                {g.rotulo}
                {g.data ? <span>{g.data}</span> : null}
              </div>
              <div className="kb-dia-cartoes">
                {g.pedidos.map((p) => {
                  const aberto = aceso === p.id
                  const atrasado = (diasParaAEntrega(p.entregaEm) ?? 0) < 0
                  return (
                    <div
                      key={p.id}
                      role="listitem"
                      data-pedido={p.id}
                      className={[
                        'kb-tr',
                        aberto ? 'aberto' : '',
                        aceso && !aberto ? 'apagado' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="kb-tr-esq">
                        <button
                          type="button"
                          className="kb-tr-bt"
                          aria-expanded={aberto}
                          title={
                            aberto
                              ? 'Fechar e tirar o destaque do quadro'
                              : 'Ver onde cada layout está e acender os cartões no quadro'
                          }
                          onClick={() => aoEscolher(p)}
                        >
                          <span className="kb-tr-topo">
                            <b>{p.numero}</b>
                            <span className={atrasado ? 'kb-tr-prazo atrasado' : 'kb-tr-prazo'}>
                              {prazo(p.entregaEm)}
                            </span>
                          </span>
                          <span className="kb-tr-nome">{p.nome || p.cliente}</span>
                        </button>
                        <span className="kb-tr-pe">
                          <span>{p.pecas} pçs</span>
                          {aberto ? (
                            <button
                              type="button"
                              className="kb-tr-abrir"
                              onClick={() => aoAbrirPedido(p)}
                            >
                              Abrir o pedido
                            </button>
                          ) : p.marcas.length ? (
                            <span>{p.marcas.join(' · ')}</span>
                          ) : null}
                        </span>
                      </div>

                      {aberto ? (
                        <div className="kb-tr-grafico">
                          <GraficoDoPedido
                            fatias={fatias.filter((f) => f.pedidoId === p.id)}
                            rotas={rotas}
                            tamanho="mini"
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="kb-seta"
        aria-label="Próximos pedidos"
        disabled={desvio >= maximo}
        onClick={() => setDesvio((d) => Math.min(maximo, d + PASSO))}
      >
        <SetaDireita />
      </button>
    </div>
  )
}
