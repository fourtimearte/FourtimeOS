import { tabela } from '@shared/supabase'
import type { Aviso, Etapa, Pedido } from './tipos'

/* ==========================================================================
   A conversa da produção com o Supabase.

   O pedido tem DOIS estados, e eles não são o mesmo (migração 020):

     estado   o ciclo do pedido      aprovado, produção, pronto, enviado...
     etapa    o posto dentro da fábrica   corte, subli, dtf... finalizado

   Daqui só se mexe na ETAPA e no que a fábrica decide: o dia planejado, a
   data de entrega, o aviso. O estado do pedido anda sozinho por gatilho no
   banco, e é de propósito: quem arrasta um cartão para Finalizado não deveria
   precisar lembrar de mudar mais nada, e uma tela que precisa lembrar é uma
   tela que um dia esquece.
   ========================================================================== */

type LinhaDaFabrica = {
  id: string
  numero: string
  cliente: string
  vendedor: string
  departamento: string
  etapa: Etapa
  etapa_em: string
  entrega_em: string | null
  planejado_em: string | null
  planejamento_manual: boolean
  aviso: Aviso
  pecas: number
  layouts: number
  tecnicas: string[]
  total: number
  pecas_subli: number
  pecas_personalizadas: number
  valor_subli: number
  valor_personalizado: number
  fechado_em: string | null
  teste: boolean
  cotacao_id: string | null
}

const COLUNAS =
  'id,numero,cliente,vendedor,departamento,etapa,etapa_em,entrega_em,planejado_em,' +
  'planejamento_manual,aviso,pecas,layouts,tecnicas,total,pecas_subli,' +
  'pecas_personalizadas,valor_subli,valor_personalizado,fechado_em,teste,cotacao_id'

function deLinha(l: LinhaDaFabrica): Pedido {
  return {
    id: l.id,
    numero: l.numero,
    cotacaoId: l.cotacao_id ?? '',
    cliente: l.cliente ?? '',
    vendedor: l.vendedor ?? '',
    departamento: l.departamento ?? '',
    etapa: l.etapa,
    entregaEm: l.entrega_em ?? '',
    pecas: Number(l.pecas) || 0,
    layouts: Number(l.layouts) || 0,
    /* O banco guarda a técnica como texto porque a lista de técnicas é do
       domínio e não do banco: acrescentar uma técnica não deveria pedir uma
       migração. O tipo volta a valer aqui, na porta. */
    tecnicas: (l.tecnicas ?? []) as Pedido['tecnicas'],
    planejadoEm: l.planejado_em ?? '',
    planejamentoManual: !!l.planejamento_manual,
    fechadoEm: (l.fechado_em ?? '').slice(0, 10),
    aviso: (l.aviso ?? '') as Aviso,
    atualizadoEm: l.etapa_em,
    pecasSubli: Number(l.pecas_subli) || 0,
    pecasPersonalizadas: Number(l.pecas_personalizadas) || 0,
    valorSubli: Number(l.valor_subli) || 0,
    valorPersonalizado: Number(l.valor_personalizado) || 0,
    total: Number(l.total) || 0,
    teste: !!l.teste,
  }
}

/* Os que estão na fábrica agora: tudo que ainda não saiu.

   "Finalizado" continua aparecendo de propósito. Ele é o fim da linha DENTRO da
   fábrica, e não o fim do pedido: a peça está pronta e ainda está lá, esperando
   alguém despachar. Sumir do quadro no instante em que é embalada é como o
   pedido pronto vira pedido esquecido. */
export async function carregarPedidos(): Promise<Pedido[]> {
  const linhas = await tabela<LinhaDaFabrica[]>(
    `pedido_na_fabrica?select=${COLUNAS}&estado=in.(aprovado,producao,pronto)` +
      '&order=entrega_em.asc.nullslast,numero.asc',
  )
  return linhas.map(deLinha)
}

/** Tudo, inclusive o que já saiu. É o que o relatório mensal soma. */
export async function carregarTodosOsPedidos(): Promise<Pedido[]> {
  const linhas = await tabela<LinhaDaFabrica[]>(
    `pedido_na_fabrica?select=${COLUNAS}&order=fechado_em.desc.nullslast,numero.desc`,
  )
  return linhas.map(deLinha)
}

export async function acharPedido(id: string): Promise<Pedido | null> {
  if (!id) return null
  const linhas = await tabela<LinhaDaFabrica[]>(
    `pedido_na_fabrica?select=${COLUNAS}&id=eq.${encodeURIComponent(id)}`,
  )
  return linhas.length ? deLinha(linhas[0]) : null
}

/* Cada mexida manda SÓ o campo que mudou.

   Trocar a etapa enquanto outra pessoa corrige a data de entrega do mesmo
   pedido não pode desfazer a correção dela, e mandar o objeto inteiro é
   exatamente o que faria isso. Num quadro que a fábrica inteira arrasta ao
   mesmo tempo, isso não é hipótese: é terça-feira. */
async function mexer(id: string, corpo: Record<string, unknown>): Promise<Pedido | null> {
  await tabela(`pedido?id=eq.${encodeURIComponent(id)}`, { metodo: 'PATCH', corpo })
  return acharPedido(id)
}

export function moverEtapa(id: string, etapa: Etapa) {
  return mexer(id, { etapa })
}

/* Planejar a mão marca o planejamento como manual, e isso importa: o dia
   escolhido por uma pessoa não pode ser reescrito por um cálculo automático
   depois. Quem planejou sabia de algo que a conta não sabe. */
export function planejarPara(id: string, dia: string) {
  return mexer(id, { planejado_em: dia || null, planejamento_manual: true })
}

export function mudarEntrega(id: string, dia: string) {
  return mexer(id, { data_de_envio: dia || null })
}

export function mudarAviso(id: string, aviso: Aviso) {
  return mexer(id, { aviso })
}
