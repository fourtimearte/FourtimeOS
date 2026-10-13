import { tabela } from '@shared/supabase'

/* ==========================================================================
   O QUE CADA UM VENDEU (views da 018 e da 019, item 6 da lista de 12/10/2026).

   A venda conta no MES EM QUE O CLIENTE APROVOU (aprovado_em, no horario de
   Brasilia), e nao no mes em que a fabrica fechou o pedido, que e o que o
   relatorio de pedidos soma. As duas perguntas sao diferentes: "quanto se
   vendeu em outubro" e "quanto a fabrica entregou em outubro".

   A REGRA DE QUEM VE MORA NA VIEW: o administrador ve todo mundo; o vendedor
   ve so o que e dele. A tela nao filtra nada por papel.
   ========================================================================== */

export type VendaDoMes = {
  /** 2026-10-01 */
  mes: string
  vendedorId: string
  vendedor: string
  pedidos: number
  pecas: number
  vendido: number
}

type LinhaDoMes = {
  mes: string
  vendedor_id: string | null
  vendedor_nome: string | null
  pedidos: number
  pecas: number | null
  vendido: number | string | null
}

/** Os meses de um ano, de todo mundo que a pessoa pode ver. */
export async function carregarVendaPorMes(ano: number): Promise<VendaDoMes[]> {
  const linhas = await tabela<LinhaDoMes[]>(
    `venda_por_mes?select=mes,vendedor_id,vendedor_nome,pedidos,pecas,vendido&mes=gte.${ano}-01-01&mes=lt.${ano + 1}-01-01`,
  )
  return linhas.map((l) => ({
    mes: l.mes,
    vendedorId: l.vendedor_id ?? '',
    vendedor: (l.vendedor_nome ?? '').trim() || '(sem vendedor)',
    pedidos: Number(l.pedidos) || 0,
    pecas: Number(l.pecas) || 0,
    vendido: Number(l.vendido) || 0,
  }))
}

export type LinhaDeVendedor = { vendedor: string; pedidos: number; pecas: number; vendido: number; parte: number }

/** Soma os meses escolhidos por vendedor, do que mais vendeu para o que menos. */
export function somarPorVendedor(vendas: VendaDoMes[], meses: number[]): LinhaDeVendedor[] {
  const mapa = new Map<string, LinhaDeVendedor>()
  for (const v of vendas) {
    const m = Number(v.mes.slice(5, 7)) - 1
    if (!meses.includes(m)) continue
    const chave = v.vendedorId || v.vendedor
    const atual = mapa.get(chave) ?? { vendedor: v.vendedor, pedidos: 0, pecas: 0, vendido: 0, parte: 0 }
    atual.pedidos += v.pedidos
    atual.pecas += v.pecas
    atual.vendido += v.vendido
    mapa.set(chave, atual)
  }
  const lista = [...mapa.values()]
  const total = lista.reduce((s, x) => s + x.vendido, 0)
  lista.forEach((x) => (x.parte = total ? x.vendido / total : 0))
  return lista.sort((a, b) => b.vendido - a.vendido || a.vendedor.localeCompare(b.vendedor))
}

export type CotacaoSemVendedor = { id: string; numero: string; cliente: string; total: number; estado: string }

/* AS COTACOES ABERTAS SEM VENDEDOR (017). Sem vendedor, a venda que sair
   delas cai em "(sem vendedor)" e nao conta para ninguem. A view so mostra as
   que ainda podem virar pedido. */
export async function carregarCotacoesSemVendedor(): Promise<CotacaoSemVendedor[]> {
  const linhas = await tabela<{ id: string; numero: string; cliente_nome: string | null; total: number | string | null; estado: string }[]>(
    'cotacao_sem_vendedor?select=id,numero,cliente_nome,total,estado&order=numero.desc',
  )
  return linhas.map((l) => ({ id: l.id, numero: l.numero, cliente: l.cliente_nome ?? '', total: Number(l.total) || 0, estado: l.estado }))
}
