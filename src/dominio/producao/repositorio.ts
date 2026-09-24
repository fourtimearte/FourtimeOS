import { chamar, tabela } from '@shared/supabase'
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
  tag: string | null
  fatias_abertas: string | null
}

const COLUNAS =
  'id,numero,cliente,vendedor,departamento,etapa,etapa_em,entrega_em,planejado_em,' +
  'planejamento_manual,aviso,pecas,layouts,tecnicas,total,pecas_subli,' +
  'pecas_personalizadas,valor_subli,valor_personalizado,fechado_em,teste,cotacao_id,' +
  'tag,fatias_abertas'

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
    fechadoEm: diaLocal(l.fechado_em),
    aviso: (l.aviso ?? '') as Aviso,
    /* A TAG E DERIVADA, e vem pronta do banco. Ela e o trabalho mais atrasado
       do pedido, agrupado em familia quando ha mais de um correndo: um pedido
       com subli na costura e DTF na impressao mostra Impressao, porque e isso
       que esta segurando a entrega. Vazia enquanto o PCP nao liberou, porque
       ai nao ha fatia nenhuma e nao ha o que dizer. */
    tag: l.tag ?? '',
    /* o que a tag esconde, para o passar o mouse e para o modal da timeline:
       "subli:costura, dtf:dtf" */
    fatiasAbertas: l.fatias_abertas ?? '',
    atualizadoEm: l.etapa_em,
    pecasSubli: Number(l.pecas_subli) || 0,
    pecasPersonalizadas: Number(l.pecas_personalizadas) || 0,
    valorSubli: Number(l.valor_subli) || 0,
    valorPersonalizado: Number(l.valor_personalizado) || 0,
    total: Number(l.total) || 0,
    teste: !!l.teste,
  }
}

/* ---------- o dia em que aquilo aconteceu, no fuso da fábrica -----------

   `fechado_em` é timestamptz e chega em UTC. Cortar os dez primeiros
   caracteres do texto parecia inofensivo e é um erro de um dia esperando
   acontecer: Goiânia é UTC-3, então tudo que a fábrica aponta a partir das
   21h já está no dia seguinte em UTC. O turno da noite de sexta cairia no
   sábado, e uma sexta apontada às 21h30 apareceria na semana certa por
   sorte, mas um sábado às 21h30 pularia para o domingo e, dali, para a
   semana seguinte inteira.

   Convertendo para Date e lendo o calendário local, o dia é o dia que a
   pessoa viveu, que é o único que interessa a esta conta. */
function diaLocal(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return d.getFullYear() + '-' + m + '-' + dia
}

/* Os que estão na fábrica agora: tudo que ainda não saiu.

   "Finalizado" continua aparecendo de propósito. Ele é o fim da linha DENTRO da
   fábrica, e não o fim do pedido: a peça está pronta e ainda está lá, esperando
   alguém despachar. Sumir do quadro no instante em que é embalada é como o
   pedido pronto vira pedido esquecido.

   "APROVADO" SAIU DA LISTA EM 24/09, e esta é a mudança que vale explicar.

   Enquanto o portão do PCP não existia, `aprovado` era o mais perto de "está
   na fábrica" que o dado sabia dizer, e o painel usava isso por falta de coisa
   melhor. Agora existe: o pedido só vira `producao` quando o diretor aprova, e
   é a aprovação dele que cria a fatia no quadro. Um pedido aprovado em venda e
   parado na separação ou na mesa do PCP não tem cartão nenhum no chão de
   fábrica, então contá-lo aqui enchia a semana de peças que ninguém está
   produzindo.

   Isso não é cosmético: a saturação do topo e a cor de cada dia saem dessa
   soma, e a pergunta que esta tela existe para responder é justamente se a
   semana cabe. Uma semana que parece cheia por causa de oito pedidos que nem
   desceram faz o operador empurrar trabalho de verdade para a semana seguinte.
   O pedido não some do sistema: ele está no PCP, que é a tela onde ele espera
   e onde alguém precisa olhar para ele. */
export async function carregarPedidos(): Promise<Pedido[]> {
  const linhas = await tabela<LinhaDaFabrica[]>(
    `pedido_na_fabrica?select=${COLUNAS}&estado=in.(producao,pronto)` +
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

/* --- mover o pedido pelo caminho -----------------------------------------
   funil -> cotacao -> PEDIDO -> separacao -> PCP -> kanban

   Quem valida a passagem e o papel e o GATILHO no banco, e nao esta funcao:
   assim a mesma regra vale para o botao, para o arrastar do kanban, para o
   ensaio e para um PATCH direto no PostgREST. O que mora aqui e so o verbo,
   para a tela poder dizer "mandar para o PCP" em vez de escrever uma coluna.

   A migracao e a 022. A tabela de quem pode cada passagem esta la, e a mesma
   `quem_pode_a_passagem` pode ser chamada pela tela antes de desenhar o
   botao, quando as telas dos passos 8 e 9 existirem. */
export type PassoDoPedido =
  | 'aprovado'
  | 'separacao'
  | 'pcp'
  | 'producao'
  | 'pronto'
  | 'enviado'
  | 'entregue'
  | 'cancelado'

export async function moverPedido(id: string, para: PassoDoPedido): Promise<void> {
  await chamar('mover_pedido', { p_pedido: id, p_para: para })
}

/* --- o portao do PCP ------------------------------------------------------
   As fatias vao PRONTAS daqui, como os numeros da fabrica na aprovacao, e pelo
   mesmo motivo: quem sabe ler um bloco de layout, o que e uma tag de design e
   como uma grade vira peca e o dominio, onde isso ja esta escrito e conferido.
   `fatiasDaCotacao` monta a lista; o banco acha o primeiro posto de cada rota,
   escreve tudo de uma vez e passa o pedido para producao. */
export async function liberarParaProducao(
  id: string,
  fatias: { tecnica: string; layouts: number[]; pecas: number }[],
): Promise<void> {
  await chamar('liberar_para_producao', { p_pedido: id, p_fatias: fatias })
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

/* ---------- finalizar numa data escolhida a mao --------------------------

   O caso real: o pedido ficou pronto na sexta, ninguem apontou, a semana
   virou e ele reapareceu na segunda. O operador sabe que ele nao e desta
   semana. Marcar a etapa como finalizada hoje o ancoraria em HOJE, e a
   semana passada continuaria com um buraco.

   Por isso os dois campos vao juntos numa gravacao so. O gatilho do banco
   (acertar_etapa_do_pedido) so carimba `fechado_em := now()` quando ele
   chega nulo; mandando a data junto, ela e respeitada.

   Uma vez feito isso, o pedido sai desta semana e volta para a semana em que
   ficou pronto, sozinho, porque a colocacao le `fechado_em` primeiro. */
export function finalizarEm(id: string, dia: string) {
  return mexer(id, { etapa: 'finalizado', fechado_em: dia || null })
}

/* Tirar de finalizado. Nao precisa mexer em `fechado_em`: o mesmo gatilho o
   zera sozinho quando a etapa deixa de ser finalizado, e duplicar essa regra
   aqui seria o tipo de coisa que um dia discorda do banco. */
export function reabrir(id: string, etapa: Etapa) {
  return mexer(id, { etapa })
}
