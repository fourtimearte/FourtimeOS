import type { Cliente } from './tipos'

/* ==========================================================================
   O historico de pedidos do cliente.

   Como o modulo de pedido ainda nao existe, isto aqui monta um historico de
   exemplo a partir do proprio cliente, sempre igual para o mesmo cliente (o
   sorteio parte do id, nao do relogio), para a ficha nao mudar de conteudo a
   cada vez que abre.

   Quando o pedido de verdade existir, este arquivo vira uma consulta e a ficha
   nao muda.
   ========================================================================== */

export type EstadoDoPedido = 'aprovado' | 'producao' | 'entregue' | 'cancelado'

export const NOME_DO_ESTADO: Record<EstadoDoPedido, string> = {
  aprovado: 'Aprovado',
  producao: 'Em produção',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export type Pedido = {
  numero: string
  data: string
  pecas: number
  valor: number
  estado: EstadoDoPedido
  resumo: string
}

/* sorteio que sempre da o mesmo resultado para a mesma semente */
function sorteio(semente: number) {
  let x = semente
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

const PECAS = ['Camiseta dry', 'Baby look', 'Raglan', 'Moletom canguru', 'Regata', 'Polo', 'Shorts']
const TECNICAS = ['DTF', 'sublimação', 'silk', 'bordado']

export function pedidosDoCliente(c: Cliente): Pedido[] {
  if (!c.pedidos) return []
  const n = Number(c.id.replace(/\D/g, '')) || 1
  const r = sorteio(n * 7919)
  const fim = c.ultimoPedido ? new Date(c.ultimoPedido) : new Date()
  const media = c.pedidos ? c.total / c.pedidos : 0

  const lista: Pedido[] = []
  let dia = new Date(fim)
  for (let i = 0; i < c.pedidos; i++) {
    const pecas = Math.max(8, Math.round(20 + r() * 190))
    const valor = Math.max(300, Math.round(media * (0.6 + r() * 0.8)))
    const estado: EstadoDoPedido =
      i === 0 ? (r() > 0.55 ? 'producao' : 'aprovado') : r() > 0.06 ? 'entregue' : 'cancelado'
    lista.push({
      numero: 'PD' + String(4000 + n * 13 + i * 7).padStart(6, '0'),
      data: dia.toISOString().slice(0, 10),
      pecas,
      valor,
      estado,
      resumo:
        PECAS[Math.floor(r() * PECAS.length)] + ' em ' + TECNICAS[Math.floor(r() * TECNICAS.length)],
    })
    dia = new Date(dia.getTime() - (18 + Math.round(r() * 70)) * 24 * 60 * 60 * 1000)
  }
  return lista
}

/* ==========================================================================
   Transportadora por faixa de CEP.

   A faixa abaixo e de exemplo e vai virar cadastro no sistema. O que importa
   agora e a regra: quem decide a transportadora e o CEP, nao a cidade, porque
   cidade grande tem faixa propria e entrega propria so vale em parte dela.
   ========================================================================== */

export type Transportadora = { nome: string; prazo: string }

const FAIXAS: { de: number; ate: number; nome: string; prazo: string }[] = [
  { de: 74000000, ate: 74999999, nome: 'Entrega própria', prazo: 'no mesmo dia' },
  { de: 75000000, ate: 76799999, nome: 'Rodoviário Goiás', prazo: '1 a 2 dias úteis' },
  { de: 72800000, ate: 72999999, nome: 'Rodoviário Goiás', prazo: '1 a 2 dias úteis' },
  { de: 70000000, ate: 72799999, nome: 'Expresso Brasília', prazo: '2 dias úteis' },
  { de: 30000000, ate: 39999999, nome: 'Minas Log', prazo: '3 a 4 dias úteis' },
  { de: 1000000, ate: 19999999, nome: 'Paulista Cargas', prazo: '3 a 5 dias úteis' },
]

export function transportadoraPorCep(cep: string): Transportadora {
  const n = Number(cep.replace(/\D/g, ''))
  if (!n) return { nome: 'Sem CEP', prazo: 'preencha para saber a faixa' }
  const f = FAIXAS.find((x) => n >= x.de && n <= x.ate)
  return f ? { nome: f.nome, prazo: f.prazo } : { nome: 'Correios', prazo: '5 a 9 dias úteis' }
}

export function formatarCep(cep: string) {
  const n = cep.replace(/\D/g, '')
  return n.length === 8 ? n.replace(/(\d{5})(\d{3})/, '$1-$2') : cep
}
