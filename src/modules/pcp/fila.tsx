import type { ReactNode } from 'react'
import {
  ArrowUUpLeft,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  WarningCircle,
} from '@phosphor-icons/react'
import { LINHA_ESCOLHIDA, type IconeDoPacote } from '@ds'
import { diasAte, type PedidoLiberado, type PedidoNoPcp } from '@dominio/producao'

/* ==========================================================================
   A FILA DO PCP (prancha 87): os pedidos do portão em dois grupos, Conferindo
   (com o PCP) e Esperando o diretor (já conferidos), cada linha com um ícone
   do que está acontecendo, o cliente, o pedido e as peças, uma linha que diz
   em que pé está, e a entrega.

   A LINHA DIZ O QUE IMPORTA PRIMEIRO. Devolvido pelo diretor e falta de
   material ficam em vermelho na frente de quem está conferindo, porque é o
   que muda a decisão; "ainda não aberto" é o que sobra quando nada aconteceu.
   ========================================================================== */

export function dataCurta(iso: string): string {
  if (!iso) return 'sem data'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** a hora de um carimbo: "hoje, 09:05", "ontem, 17:40" ou "06/10, 09:05" */
export function quando(iso: string, agora = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dia = (x: Date) => x.toLocaleDateString('pt-BR')
  const ontem = new Date(agora)
  ontem.setDate(agora.getDate() - 1)
  if (dia(d) === dia(agora)) return 'hoje, ' + hora
  if (dia(d) === dia(ontem)) return 'ontem, ' + hora
  return dataCurta(iso) + ', ' + hora
}

/** "em 6 dias", "hoje", "amanhã", "2 dias atrasado" */
export function emDias(iso: string): { texto: string; perto: boolean; atrasado: boolean } {
  const d = diasAte(iso)
  if (d === null) return { texto: 'sem data', perto: false, atrasado: false }
  if (d < 0)
    return { texto: `${-d} ${-d === 1 ? 'dia' : 'dias'} atrasado`, perto: true, atrasado: true }
  if (d === 0) return { texto: 'hoje', perto: true, atrasado: false }
  if (d === 1) return { texto: 'amanhã', perto: true, atrasado: false }
  return { texto: `em ${d} dias`, perto: d <= 7, atrasado: false }
}

export const temFalta = (p: PedidoNoPcp) => p.faltando > 0 || p.aviso === 'falta-material'

/** em que pé está: o ícone, a linha e se é vermelho */
/** diferencas: o que a comparação achou quando o pedido foi aberto nesta visita */
export function situacao(
  p: PedidoNoPcp,
  diferencas = 0,
): { icone: IconeDoPacote; linha: string; alerta: boolean } {
  if (p.comOVendedor) {
    return {
      icone: ArrowUUpLeft,
      linha: 'com ' + (p.vendedor || 'o vendedor') + ': ' + p.vendedorMotivo,
      alerta: true,
    }
  }
  if (p.marcado)
    return {
      icone: CheckCircle,
      linha: 'conferido por ' + (p.marcadoPor || 'alguém'),
      alerta: false,
    }
  if (p.devolvidoMotivo)
    return { icone: WarningCircle, linha: 'devolvido pelo diretor', alerta: true }
  if (diferencas)
    return {
      icone: WarningCircle,
      linha: diferencas === 1 ? '1 diferença' : diferencas + ' diferenças',
      alerta: true,
    }
  if (temFalta(p))
    return { icone: WarningCircle, linha: 'desce com falta de material', alerta: true }
  if (p.conferindoPor)
    return { icone: MagnifyingGlass, linha: 'com ' + p.conferindoPor, alerta: false }
  return { icone: Clock, linha: 'ainda não aberto', alerta: false }
}

export function LinhaDoPcp({
  p,
  diferencas,
  escolhido,
  aoEscolher,
}: {
  p: PedidoNoPcp
  diferencas?: number
  escolhido: boolean
  aoEscolher: () => void
}) {
  const s = situacao(p, diferencas)
  const Icone = s.icone
  const perto = emDias(p.entregaEm).perto
  return (
    <button
      type="button"
      data-pedido={p.numero}
      className={escolhido ? 'pc-item escolhido ' + LINHA_ESCOLHIDA : 'pc-item'}
      aria-pressed={escolhido}
      onClick={aoEscolher}
    >
      <span className={s.alerta ? 'pc-ic alerta' : 'pc-ic'} aria-hidden="true">
        <Icone size={19} />
      </span>
      <span className="pc-item-meio">
        <b className="pc-cliente">{p.cliente || 'sem cliente'}</b>
        <small>
          {p.numero} · {p.pecas} pçs
        </small>
        <small className={s.alerta ? 'pc-alerta pc-corta' : 'pc-corta'}>{s.linha}</small>
      </span>
      <span className="pc-item-fim">
        <b className={perto ? 'pc-perto' : undefined}>{dataCurta(p.entregaEm)}</b>
        <small>entrega</small>
      </span>
    </button>
  )
}

const NOME_DO_ESTADO: Record<string, string> = {
  producao: 'na produção',
  pronto: 'pronto',
  enviado: 'enviado',
  entregue: 'entregue',
}

export function LinhaDoLiberado({
  p,
  escolhido,
  aoEscolher,
}: {
  p: PedidoLiberado
  escolhido: boolean
  aoEscolher: () => void
}) {
  return (
    <button
      type="button"
      data-pedido={p.numero}
      className={escolhido ? 'pc-item escolhido ' + LINHA_ESCOLHIDA : 'pc-item'}
      aria-pressed={escolhido}
      onClick={aoEscolher}
    >
      <CheckCircle size={19} className="pc-ic" aria-hidden="true" />
      <span className="pc-item-meio">
        <b className="pc-cliente">{p.cliente || 'sem cliente'}</b>
        <small>
          {p.numero} · {p.pecas} pçs · {NOME_DO_ESTADO[p.estado] ?? p.estado}
        </small>
        <small className="pc-corta">
          {p.liberadoPor ? 'aprovado por ' + p.liberadoPor : 'aprovado antes do registro'}
        </small>
      </span>
      <span className="pc-item-fim">
        <b>{dataCurta(p.liberadoEm)}</b>
        <small>liberado</small>
      </span>
    </button>
  )
}

export function GrupoDaFila({
  nome,
  apoio,
  children,
}: {
  nome: string
  apoio: string
  children: ReactNode
}) {
  return (
    <div className="pc-grupo">
      <div className="pc-g">
        {nome}
        <small>{apoio}</small>
      </div>
      {children}
    </div>
  )
}
