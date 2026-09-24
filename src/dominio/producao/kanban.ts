import type { Tecnica } from '@ds'
import { tabela } from '@shared/supabase'
import { POSTO } from './tipos'
import type { Etapa } from './tipos'

/* ==========================================================================
   O quadro MARK45.

   O CARTÃO NÃO É O PEDIDO, É UMA FATIA: pedido mais técnica. Um pedido com
   layouts em sublimação e DTF vira dois cartões, cada um com o seu ritmo,
   porque eles não andam juntos: a sublimação imprime antes de cortar e o DTF
   corta antes de imprimir.

   CADA TÉCNICA TEM A SUA ROTA, e ela não é um caminho só. A fatia de
   sublimação passa por impressão, calandra e corte, nessa ordem; a de DTF
   passa por corte, DTF e prensa. Por isso um cartão não pode cair em qualquer
   coluna: ele só anda pelos postos que a rota dele conhece, e é o banco que
   recusa o resto.
   ========================================================================== */

export type FatiaNoQuadro = {
  id: string
  pedidoId: string
  numero: string
  /* o nome que a fabrica da ao pedido. Vazio no banco, a view ja cai para o
     nome do cliente, entao aqui ele nunca vem em branco por engano */
  nome: string
  cliente: string
  /* o ID do cliente, para achar os pedidos anteriores dele sem casar por
     texto. Entrou nas views na migracao 040. */
  clienteId: string
  vendedor: string
  tecnica: Tecnica
  etapa: Etapa
  etapaEm: string
  fechadoEm: string
  layouts: number[]
  pecas: number
  entregaEm: string
  aviso: string
  estado: string
  teste: boolean
  /* as tags mestre, lidas da cotacao na hora: elas valem para o pedido
     inteiro e em todo posto */
  marcas: string[]
  /* as tags do posto postas neste cartao */
  tags: string[]
  pegoPor: string
  pegoPorNome: string
  pegoEm: string
  falas: number
  /* QUANTOS ANEXOS, e ele é zero até o Drive entrar.

     O ícone de clipe no cartão já existe e já sabe se esconder quando não há
     anexo nenhum, que é o estado de hoje. Deixar o número de fora agora seria
     ter que mexer no cartão de novo no dia do Drive; deixar o ícone aceso sem
     anexo seria um clipe que não abre nada, que é pior. */
  anexos: number
}

type LinhaDaFatia = {
  id: string
  pedido_id: string
  numero: string
  nome: string
  cliente: string
  cliente_id: string | null
  vendedor: string
  tecnica: Tecnica
  etapa: Etapa
  etapa_em: string
  fechado_em: string | null
  layouts: number[] | null
  pecas: number
  entrega_em: string | null
  aviso: string
  estado: string
  teste: boolean
  marcas: string[] | null
  tags: string[] | null
  pego_por: string | null
  pego_por_nome: string | null
  pego_em: string | null
  falas: number | null
}

function deLinhaDaFatia(l: LinhaDaFatia): FatiaNoQuadro {
  return {
    id: l.id,
    pedidoId: l.pedido_id,
    numero: l.numero,
    nome: l.nome || l.cliente || '',
    cliente: l.cliente || '',
    clienteId: l.cliente_id ?? '',
    vendedor: l.vendedor || '',
    tecnica: l.tecnica,
    etapa: l.etapa,
    etapaEm: l.etapa_em,
    fechadoEm: l.fechado_em ?? '',
    layouts: l.layouts ?? [],
    pecas: Number(l.pecas) || 0,
    entregaEm: l.entrega_em ?? '',
    aviso: l.aviso || '',
    estado: l.estado,
    teste: !!l.teste,
    marcas: l.marcas ?? [],
    tags: l.tags ?? [],
    pegoPor: l.pego_por ?? '',
    pegoPorNome: l.pego_por_nome || '',
    pegoEm: l.pego_em ?? '',
    falas: Number(l.falas) || 0,
    anexos: 0,
  }
}

export async function carregarOQuadro(): Promise<FatiaNoQuadro[]> {
  const linhas = await tabela<LinhaDaFatia[]>(
    'fatia_na_fabrica?select=*&estado=in.(producao,pronto)&order=entrega_em.asc.nullslast,numero.asc',
  )
  return linhas.map(deLinhaDaFatia)
}

/* AS FATIAS DE UM PEDIDO SÓ, SEM FILTRO DE ESTADO.

   O quadro pede as que estão em produção porque é isso que o quadro desenha.
   O modal da timeline pergunta outra coisa: onde foi parar cada pedaço DESTE
   pedido. Filtrar por estado aqui abriria um modal vazio justamente no pedido
   que já terminou, que é quando alguém abre a timeline para conferir quando é
   que cada parte ficou pronta. */
export async function carregarAsFatiasDoPedido(pedidoId: string): Promise<FatiaNoQuadro[]> {
  if (!pedidoId) return []
  const linhas = await tabela<LinhaDaFatia[]>(
    `fatia_na_fabrica?select=*&pedido_id=eq.${encodeURIComponent(pedidoId)}&order=tecnica.asc`,
  )
  return linhas.map(deLinhaDaFatia)
}

export type Rota = { tecnica: string; ordem: number; posto: Etapa }

export async function carregarAsRotas(): Promise<Rota[]> {
  return tabela<Rota[]>('rota_da_tecnica?select=tecnica,ordem,posto&order=tecnica.asc,ordem.asc')
}

/** Os postos por onde esta técnica passa, na ordem. */
export function rotaDe(rotas: Rota[], tecnica: string): Etapa[] {
  return rotas
    .filter((r) => r.tecnica === tecnica)
    .sort((a, b) => a.ordem - b.ordem)
    .map((r) => r.posto)
}

/* O posto seguinte e o anterior DENTRO DA ROTA DELA. Não existe "o próximo
   posto" sozinho: o que vem depois do corte depende da técnica. */
export function vizinhoNaRota(
  rotas: Rota[],
  tecnica: string,
  etapa: Etapa,
  passo: 1 | -1,
): Etapa | null {
  const r = rotaDe(rotas, tecnica)
  const i = r.indexOf(etapa)
  if (i < 0) return null
  const alvo = r[i + passo]
  return alvo ?? null
}

export function estaNaRota(rotas: Rota[], tecnica: string, etapa: Etapa): boolean {
  return rotaDe(rotas, tecnica).includes(etapa)
}

/** Move a fatia. O gatilho da 023 recusa posto fora da rota. */
export async function moverAFatia(id: string, etapa: Etapa): Promise<void> {
  await tabela(`fatia?id=eq.${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    corpo: { etapa },
  })
}

/** As colunas do quadro, na ordem do chão de fábrica. */
export const COLUNAS: Etapa[] = [
  'corte',
  'subli',
  'dtf',
  'prensa',
  'silk',
  'bordado',
  'calandra',
  'futurize',
  'conferencia',
  'cd-costura',
  'costura',
  'embalagem',
  'finalizado',
]

export function nomeDoPosto(e: Etapa): string {
  return POSTO[e]?.nome ?? e
}

export function corDoPosto(e: Etapa): string {
  return POSTO[e]?.cor ?? 'var(--border-2)'
}

/* HÁ QUANTO TEMPO ESTE CARTÃO NÃO ANDA. É a pergunta que o quadro existe para
   responder de longe: um cartão parado há quatro dias no mesmo posto é o que
   está segurando a entrega. */
export function paradoHa(iso: string): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}

/* QUANTOS POSTOS AINDA FALTAM PARA ESTA FATIA CHEGAR NO FIM DA ROTA.

   É a medida honesta de atraso entre duas técnicas, e não o nome do posto. Um
   cartão em Costura pela rota de DTF e um cartão em Costura pela rota de subli
   não estão no mesmo lugar da vida: as rotas têm tamanhos diferentes, e é
   quanto falta que diz qual das duas segura a entrega.

   Fora da rota devolve -1, e quem chama trata isso como "não sei dizer". Vale
   zero e vale como pronto seriam as duas mentiras fáceis aqui. */
export function faltamPostos(rotas: Rota[], tecnica: string, etapa: Etapa): number {
  const r = rotaDe(rotas, tecnica)
  const i = r.indexOf(etapa)
  if (i < 0) return -1
  return r.length - 1 - i
}

/* QUAL FATIA ESTÁ SEGURANDO O PEDIDO.

   A regra é a de 21/09, a mesma que decide a tag do painel: a do trabalho mais
   atrasado, quer dizer, a que está mais longe do fim da rota dela. Mostrar a
   mais adiantada seria uma mentira que a tela conta sozinha: a linha diria
   "Embalagem" com metade do pedido no corte.

   Empate vai para a que está parada há mais tempo, porque entre dois pedaços
   igualmente longe do fim, quem não anda há quatro dias é o problema. */
export function quemSeguraOPedido(rotas: Rota[], fatias: FatiaNoQuadro[]): string {
  const correndo = fatias.filter((f) => f.etapa !== 'finalizado')
  if (!correndo.length) return ''
  let melhor = correndo[0]
  let falta = faltamPostos(rotas, melhor.tecnica, melhor.etapa)
  for (const f of correndo.slice(1)) {
    const x = faltamPostos(rotas, f.tecnica, f.etapa)
    if (x > falta || (x === falta && paradoHa(f.etapaEm) > paradoHa(melhor.etapaEm))) {
      melhor = f
      falta = x
    }
  }
  return melhor.id
}

/* ==========================================================================
   O TRILHO DE ENTREGAS: os PEDIDOS que estão no quadro, por data.

   Ele nasce das fatias que o quadro já carregou, e não de uma consulta nova.
   Isso é decisão e não economia: o trilho e o quadro têm que concordar sempre.
   Vindo de consultas diferentes, bastaria meio segundo entre as duas para o
   trilho mostrar um pedido que não tem cartão nenhum, ou esconder um que tem,
   e o destaque apontaria para o vazio.

   O pedido finalizado por inteiro sai do trilho. Ele continua no quadro, na
   última coluna, porque lá ele é peça pronta esperando despacho; no trilho ele
   seria uma data de entrega que já não pergunta nada.
   ========================================================================== */
export type PedidoNoTrilho = {
  id: string
  numero: string
  nome: string
  cliente: string
  entregaEm: string
  pecas: number
  fatias: number
  teste: boolean
  marcas: string[]
}

export function pedidosDoQuadro(fatias: FatiaNoQuadro[]): PedidoNoTrilho[] {
  const m = new Map<string, PedidoNoTrilho>()
  for (const f of fatias) {
    const p = m.get(f.pedidoId)
    if (p) {
      p.pecas += f.pecas
      p.fatias += 1
      /* as marcas são do PEDIDO e vêm repetidas em cada fatia dele */
      for (const x of f.marcas) if (!p.marcas.includes(x)) p.marcas.push(x)
    } else {
      m.set(f.pedidoId, {
        id: f.pedidoId,
        numero: f.numero,
        nome: f.nome,
        cliente: f.cliente,
        entregaEm: f.entregaEm,
        pecas: f.pecas,
        fatias: 1,
        teste: f.teste,
        marcas: [...f.marcas],
      })
    }
  }

  const correndo = new Set(fatias.filter((f) => f.etapa !== 'finalizado').map((f) => f.pedidoId))

  /* SEM DATA VAI PARA O FIM, e não para o começo. Data vazia ordenada como
     texto vazio sobe ao topo e empurra para baixo justamente o que tem prazo,
     que é o que o trilho existe para mostrar. */
  return [...m.values()]
    .filter((p) => correndo.has(p.id))
    .sort((a, b) => {
      if (!a.entregaEm && !b.entregaEm) return a.numero.localeCompare(b.numero)
      if (!a.entregaEm) return 1
      if (!b.entregaEm) return -1
      return a.entregaEm.localeCompare(b.entregaEm) || a.numero.localeCompare(b.numero)
    })
}

/* QUANTOS DIAS FALTAM PARA A ENTREGA. Negativo é atraso.

   A conta é em DIA de calendário, e não em horas: "entrega amanhã" tem que
   continuar dizendo 1 às oito da manhã e às seis da tarde. Contar por hora
   faria o mesmo pedido dizer 1 de manhã e 0 à tarde. */
export function diasParaAEntrega(iso: string, hoje = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((d.getTime() - base.getTime()) / 86400000)
}
