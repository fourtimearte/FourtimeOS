import { chamar, tabela } from '@shared/supabase'

/* ==========================================================================
   A separação.

   A reserva (026) diz o que um pedido aprovado comprometeu. A separação PESA
   E GUARDA (081, resposta do Henrique em 14/10/2026): anota quanto pesou, e o
   material segue reservado pelo peso. O que não foi pesado vira um aviso que
   viaja com o pedido até o PCP.

   A BAIXA NO ESTOQUE é no PRIMEIRO POSTO: quando o PCP libera e os cartões
   nascem no kanban, o peso anotado sai da prateleira (e, do que ninguém
   pesou, sai o que estava reservado). Pesar MENOS do que foi reservado
   devolve a diferença para o livre na hora.
   ========================================================================== */

export type EstadoDaSeparacao = 'aprovado' | 'separacao'

export type PedidoNaSeparacao = {
  id: string
  numero: string
  cliente: string
  estado: EstadoDaSeparacao
  aviso: string
  pecas: number
  entregaEm: string
  departamento: string
  /** quantos materiais o pedido reserva */
  materiais: number
  /** quantos já saíram da prateleira */
  separados: number
  /** quantos o sistema não consegue dimensionar */
  semConsumo: number
  /** quantos a prateleira não cobre */
  naoCobre: number
  tudoSeparado: boolean
  /** a cotação de onde o pedido veio (061); vazio antes dela rodar */
  cotacaoId: string
  layouts: number
  vendedor: string
}

type LinhaDaFila = {
  id: string
  numero: string
  cliente: string
  estado: EstadoDaSeparacao
  aviso: string
  pecas: number
  entrega_em: string | null
  departamento: string
  materiais: number | string
  separados: number | string
  sem_consumo: number | string
  nao_cobre: number | string
  tudo_separado: boolean
  cotacao_id?: string | null
  layouts?: number | string | null
  vendedor_nome?: string | null
}

const COLUNAS =
  'id,numero,cliente,estado,aviso,pecas,entrega_em,departamento,' +
  'materiais,separados,sem_consumo,nao_cobre,tudo_separado'

function inteiro(v: number | string): number {
  return typeof v === 'number' ? v : Number(v) || 0
}

/* A ordem é a da entrega, e não a da aprovação: quem separa atende primeiro o
   que sai primeiro. Pedido sem data de entrega vai para o fim, porque ele não
   tem como disputar posição com quem tem prazo. */
export async function carregarFilaDaSeparacao(): Promise<PedidoNaSeparacao[]> {
  /* as colunas da 061 vêm junto; antes dela rodar, a fila lê as de sempre e o
     cabeçalho fica sem vendedor e sem layouts, em vez de a página quebrar */
  const ordem = '&order=entrega_em.asc.nullslast,numero.asc'
  const linhas = await tabela<LinhaDaFila[]>(
    `pedido_na_separacao?select=${COLUNAS},cotacao_id,layouts,vendedor_nome${ordem}`,
  ).catch(() => tabela<LinhaDaFila[]>(`pedido_na_separacao?select=${COLUNAS}${ordem}`))
  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero,
    cliente: l.cliente ?? '',
    estado: l.estado,
    aviso: l.aviso ?? '',
    pecas: Number(l.pecas) || 0,
    entregaEm: l.entrega_em ?? '',
    departamento: l.departamento ?? '',
    materiais: inteiro(l.materiais),
    separados: inteiro(l.separados),
    semConsumo: inteiro(l.sem_consumo),
    naoCobre: inteiro(l.nao_cobre),
    tudoSeparado: !!l.tudo_separado,
    cotacaoId: l.cotacao_id ?? '',
    layouts: inteiro(l.layouts ?? 0),
    vendedor: l.vendedor_nome ?? '',
  }))
}

/* ==========================================================================
   A SOMA DA FILA (061, prancha 82): o que a fila inteira ainda vai tirar de
   cada material, contra a prateleira. "depois" negativo é falta.
   ========================================================================== */
export type MaterialDaFila = {
  materialId: string
  material: string
  categoria: string
  unidade: string
  corHex: string
  ondeFica: string
  saldo: number
  pede: number
  pedidos: number
  semConsumo: number
  depois: number
  /** os pedidos que pedem o material, pela ordem da entrega */
  numeros: string[]
}

type LinhaDoMaterialDaFila = {
  material_id: string
  material: string
  categoria: string
  unidade: string
  cor_hex: string | null
  onde_fica: string | null
  saldo: number | string
  pede: number | string
  pedidos: number | string
  sem_consumo: number | string
  depois: number | string
  numeros: string[] | null
}

const real = (v: number | string | null | undefined) => (typeof v === 'number' ? v : Number(v ?? 0) || 0)

/** null quando a view ainda não existe (a 061 não rodou) */
export async function carregarMaterialDaFila(): Promise<MaterialDaFila[] | null> {
  try {
    const linhas = await tabela<LinhaDoMaterialDaFila[]>('material_da_fila?select=*&order=depois.asc,material.asc')
    return linhas.map((l) => ({
      materialId: l.material_id,
      material: l.material,
      categoria: l.categoria ?? '',
      unidade: l.unidade ?? '',
      corHex: l.cor_hex ?? '',
      ondeFica: l.onde_fica ?? '',
      saldo: real(l.saldo),
      pede: real(l.pede),
      pedidos: inteiro(l.pedidos),
      semConsumo: inteiro(l.sem_consumo),
      depois: real(l.depois),
      numeros: Array.isArray(l.numeros) ? l.numeros : [],
    }))
  } catch (e) {
    const recado = e instanceof Error ? e.message : String(e)
    if (/Não encontrei|schema cache|material_da_fila/i.test(recado)) return null
    throw e
  }
}

/* ==========================================================================
   AS CONCLUÍDAS (061): os pedidos que já passaram pela separação.
   ========================================================================== */
export type PedidoSeparado = {
  id: string
  numero: string
  cliente: string
  estado: string
  aviso: string
  pecas: number
  layouts: number
  entregaEm: string
  cotacaoId: string
  materiais: number
  separados: number
  separadoEm: string
}

type LinhaDoSeparado = {
  id: string
  numero: string
  cliente: string
  estado: string
  aviso: string | null
  pecas: number
  layouts: number | string | null
  entrega_em: string | null
  cotacao_id: string | null
  materiais: number | string
  separados: number | string
  separado_em: string | null
}

/** null quando a view ainda não existe (a 061 não rodou) */
export async function carregarSeparados(limite = 60): Promise<PedidoSeparado[] | null> {
  try {
    const linhas = await tabela<LinhaDoSeparado[]>(
      `pedido_separado?select=*&order=separado_em.desc.nullslast,numero.desc&limit=${limite}`,
    )
    return linhas.map((l) => ({
      id: l.id,
      numero: l.numero,
      cliente: l.cliente ?? '',
      estado: l.estado,
      aviso: l.aviso ?? '',
      pecas: Number(l.pecas) || 0,
      layouts: inteiro(l.layouts ?? 0),
      entregaEm: l.entrega_em ?? '',
      cotacaoId: l.cotacao_id ?? '',
      materiais: inteiro(l.materiais),
      separados: inteiro(l.separados),
      separadoEm: l.separado_em ?? '',
    }))
  } catch (e) {
    const recado = e instanceof Error ? e.message : String(e)
    if (/Não encontrei|schema cache|pedido_separado/i.test(recado)) return null
    throw e
  }
}

/* A MINIATURA DA FILA: a arte do primeiro layout de cada cotação. Só aquele
   pedaço do corpo vem (o PostgREST corta o JSON no caminho pedido), e não as
   imagens de todos os layouts: a fila tem que abrir rápido. */
export async function carregarMiniaturas(cotacoes: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(cotacoes.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))]
  if (!ids.length) return new Map()
  const linhas = await tabela<{ id: string; imagem: string | null }[]>(
    `cotacao?select=id,imagem:corpo->produtos->0->bloco->>imagem&id=in.(${ids.join(',')})`,
  ).catch(() => [])
  return new Map(linhas.filter((l) => l.imagem).map((l) => [l.id, l.imagem as string]))
}

/* Marca que alguém começou. Serve para a fila não parecer parada enquanto uma
   pessoa está no meio dela com o carrinho, e é o degrau que a trava da 022
   exige antes do PCP. */
export async function comecarASeparacao(pedidoId: string): Promise<void> {
  await chamar('mover_pedido', { p_pedido: pedidoId, p_para: 'separacao' })
}

/* A quantidade vem de quem pesou, e não da conta. A reserva já vem escrita no
   campo, mas quem separa confirma ou corrige: a reserva é uma conta e a
   separação é uma pesagem, e quando as duas discordam quem está certo é a
   balança. */
export async function separarMaterial(
  reservaId: string,
  quantidade: number,
  observacao = '',
): Promise<void> {
  await chamar('separar_material', {
    p_reserva: reservaId,
    p_quantidade: quantidade,
    p_observacao: observacao,
  })
}

/* Desfazer é uma devolução, com linha própria no razão. Apagar o movimento
   original deixaria o saldo certo e a história errada, e é a história que
   responde por que o saldo é esse. */
export async function desfazerASeparacao(reservaId: string): Promise<void> {
  await chamar('desfazer_a_separacao', { p_reserva: reservaId })
}

/* Move o pedido para o PCP e carimba a falta. Não exige que tudo tenha saído:
   exigir isso pararia a fábrica no dia em que faltasse meio quilo de malha, e
   quem decide se o pedido desce assim é o PCP. Devolve o recado pronto. */
export async function concluirASeparacao(pedidoId: string): Promise<string> {
  return chamar<string>('concluir_a_separacao', { p_pedido: pedidoId })
}

/* ==========================================================================
   O MATERIAL DE CADA LAYOUT (062, prancha 83): o que cada layout do pedido
   pede de cada material, com a explicação da conta ("Tecido · a peça
   inteira · 8,0 m² pela ficha", "Aviamento · 0,02 cone por peça").
   ========================================================================== */
export type MaterialDoLayout = {
  /** a posição do layout no orçamento, começando em 1 */
  ordem: number
  materialId: string
  material: string
  categoria: string
  corHex: string
  quantidade: number
  unidade: string
  semConsumo: boolean
  como: string
}

type LinhaDoConsumo = {
  ordem: number
  material_id: string
  quantidade: number | string
  unidade: string
  sem_consumo: boolean
  como: string
  material: { nome: string; categoria: string; cor_de_tecido: { hex: string } | null } | null
}

/** null quando a tabela ainda não existe (a 062 não rodou) */
export async function carregarMaterialDosLayouts(pedidoId: string): Promise<MaterialDoLayout[] | null> {
  try {
    const linhas = await tabela<LinhaDoConsumo[]>(
      'consumo_do_layout?select=ordem,material_id,quantidade,unidade,sem_consumo,como,' +
        'material(nome,categoria,cor_de_tecido(hex))&pedido_id=eq.' +
        encodeURIComponent(pedidoId) +
        '&order=ordem.asc',
    )
    const ordemDaCategoria: Record<string, number> = { tecido: 0, aviamento: 1, insumo: 2 }
    return linhas
      .map((l) => ({
        ordem: l.ordem,
        materialId: l.material_id,
        material: l.material?.nome ?? 'material apagado',
        categoria: l.material?.categoria ?? '',
        corHex: l.material?.cor_de_tecido?.hex ?? '',
        quantidade: real(l.quantidade),
        unidade: l.unidade ?? '',
        semConsumo: !!l.sem_consumo,
        como: l.como ?? '',
      }))
      .sort((a, b) => a.ordem - b.ordem || (ordemDaCategoria[a.categoria] ?? 9) - (ordemDaCategoria[b.categoria] ?? 9) || a.material.localeCompare(b.material, 'pt-BR'))
  } catch (e) {
    const recado = e instanceof Error ? e.message : String(e)
    if (/Não encontrei|schema cache|consumo_do_layout/i.test(recado)) return null
    throw e
  }
}

/* ONDE FICA CADA MATERIAL (Soma de tudo, prancha 83): o lugar principal no
   depósito (047) e, sem ele, o texto livre do cadastro (041). Quem separa
   anda até lá com o carrinho. */
export async function carregarOndeFica(materiais: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(materiais.filter(Boolean))]
  if (!ids.length) return new Map()
  const lista = ids.map(encodeURIComponent).join(',')
  const [lugares, cadastros] = await Promise.all([
    tabela<{ material_id: string; codigo: string | null; principal: boolean }[]>(
      `lugar_do_material_na_lista?select=material_id,codigo,principal&material_id=in.(${lista})&order=principal.desc`,
    ).catch(() => []),
    tabela<{ id: string; onde_fica: string | null }[]>(`material?select=id,onde_fica&id=in.(${lista})`).catch(() => []),
  ])
  const onde = new Map<string, string>()
  for (const c of cadastros) if (c.onde_fica) onde.set(c.id, c.onde_fica)
  for (const l of [...lugares].reverse()) if (l.codigo) onde.set(l.material_id, l.codigo)
  return onde
}
