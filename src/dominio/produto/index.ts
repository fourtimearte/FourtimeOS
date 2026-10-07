import { chamar, tabela } from '@shared/supabase'
import { semAcento } from '@shared/formatar'
import {
  kitParaOBanco,
  type DesignDaPeca,
  type EtiquetaDoKit,
  type Kit,
  type KitDaReferencia,
  type KitNaLista,
  type PecaDoKit,
  type TecidoDaPeca,
} from './kit'
import { emListas, type ItemDeDetalhe, type ListasDeDetalhe, type ListasParaOBanco } from './listas'
import type { FatiaDoLayout, LayoutVendido, PecasDosKits } from './vendas'
import {
  codigoCurto,
  tamanhosDaReferencia,
  type ChaveDeDetalhe,
  type Detalhes,
  type Ficha,
  type GrupoDeReferencia,
  type MaterialDoEstoque,
  type ReferenciaNaFicha,
  type TecidoDeConta,
  type UnidadeDaParte,
} from './contas'

/* A porta da frente do domínio. As contas, os tipos e o rascunho moram em
   contas.ts, que não conhece o banco nem o navegador e por isso roda sozinho
   na conferência (sh testes/produto.sh). Aqui fica o que fala com o banco. */
export * from './contas'
export * from './kit'
export * from './listas'
export * from './molde'
export * from './vendas'

/* --- a busca ----------------------------------------------------------------- */

/** A referência casa com o que foi digitado: pelo nome, pelo código inteiro ou pelo curto. */
export function casaComABusca(r: { nome: string; cod: string }, busca: string): boolean {
  const termo = semAcento(busca.trim()).toLowerCase()
  if (!termo) return true
  return (
    semAcento(r.nome).toLowerCase().includes(termo) ||
    r.cod.toLowerCase().includes(termo) ||
    codigoCurto(r.cod).toLowerCase().includes(termo)
  )
}

/* --- o banco ------------------------------------------------------------------ */

type LinhaDaLista = {
  id: string
  cod: string
  nome: string
  grupo: string | null
  genero: string
  ordem: number
  ativo: boolean
  detalhes: Detalhes | null
  observacao: string | null
  tamanhos: string[] | null
  ficha_em: string | null
  medidas: number
  partes_com_tecido: number
  materiais: number
  tem_molde: boolean
}

const daLista = (l: LinhaDaLista): ReferenciaNaFicha => ({
  id: l.id,
  cod: l.cod,
  nome: l.nome,
  grupo: l.grupo,
  genero: l.genero,
  ordem: l.ordem,
  ativo: l.ativo,
  detalhes: l.detalhes ?? {},
  observacao: l.observacao ?? '',
  tamanhos: l.tamanhos ?? [],
  fichaEm: l.ficha_em,
  medidas: l.medidas,
  partesComTecido: l.partes_com_tecido,
  materiais: l.materiais,
  temMolde: l.tem_molde,
})

const COLUNAS_DA_LISTA =
  'id,cod,nome,grupo,genero,ordem,ativo,detalhes,observacao,tamanhos,ficha_em,medidas,partes_com_tecido,materiais,tem_molde'

/** Os grupos e as referências, para a sanfona. Só as ativas. */
export async function carregarReferencias(): Promise<{
  grupos: GrupoDeReferencia[]
  referencias: ReferenciaNaFicha[]
}> {
  const [grupos, linhas] = await Promise.all([
    tabela<GrupoDeReferencia[]>('grupo_de_referencia?select=cod,nome,ordem&order=ordem.asc'),
    tabela<LinhaDaLista[]>(
      `referencia_na_ficha?select=${COLUNAS_DA_LISTA}&ativo=is.true&order=cod.asc,nome.asc`,
    ),
  ])
  return { grupos, referencias: linhas.map(daLista) }
}

/** Uma referência só, depois de salvar: a lista troca a linha dela sem ler tudo de novo. */
export async function carregarReferencia(id: string): Promise<ReferenciaNaFicha | null> {
  const linhas = await tabela<LinhaDaLista[]>(
    `referencia_na_ficha?select=${COLUNAS_DA_LISTA}&id=eq.${id}`,
  )
  return linhas.length ? daLista(linhas[0]) : null
}

/** A ficha inteira de uma referência. */
export async function carregarFicha(r: ReferenciaNaFicha): Promise<Ficha> {
  const [medidas, partes, materiais] = await Promise.all([
    tabela<{ nome: string; como_medir: string; valores: Record<string, number> | null }[]>(
      `medida_da_referencia?select=nome,como_medir,valores&referencia_id=eq.${r.id}&order=ordem.asc`,
    ),
    tabela<
      {
        nome: string
        vezes: number
        unidade: UnidadeDaParte
        quantidades: Record<string, number> | null
      }[]
    >(
      `parte_da_referencia?select=nome,vezes,unidade,quantidades&referencia_id=eq.${r.id}&order=ordem.asc`,
    ),
    tabela<{ material_id: string | null; nome: string; quantidade: number; unidade: string }[]>(
      `material_da_referencia?select=material_id,nome,quantidade,unidade&referencia_id=eq.${r.id}&order=ordem.asc`,
    ),
  ])
  return {
    nome: r.nome,
    detalhes: { ...r.detalhes },
    observacao: r.observacao,
    tamanhos: tamanhosDaReferencia(r),
    medidas: medidas.map(m => ({ nome: m.nome, comoMedir: m.como_medir, valores: m.valores ?? {} })),
    partes: partes.map(p => ({
      nome: p.nome,
      vezes: p.vezes,
      unidade: p.unidade,
      quantidades: p.quantidades ?? {},
    })),
    materiais: materiais.map(m => ({
      materialId: m.material_id,
      nome: m.nome,
      quantidade: Number(m.quantidade),
      unidade: m.unidade,
    })),
  }
}

/** Salva a ficha inteira. Devolve quando ela foi salva. */
export function salvarFicha(referenciaId: string, f: Ficha): Promise<string> {
  return chamar<string>('salvar_ficha_da_referencia', {
    p_referencia: referenciaId,
    p_ficha: {
      nome: f.nome.trim(),
      detalhes: f.detalhes,
      observacao: f.observacao,
      tamanhos: f.tamanhos,
      medidas: f.medidas.map(m => ({ nome: m.nome, como_medir: m.comoMedir, valores: m.valores })),
      partes: f.partes.map(p => ({
        nome: p.nome,
        vezes: p.vezes,
        unidade: p.unidade,
        quantidades: p.quantidades,
      })),
      materiais: f.materiais.map(m => ({
        material_id: m.materialId,
        nome: m.nome,
        quantidade: m.quantidade,
        unidade: m.unidade,
      })),
    },
  })
}

/** O molde da referência, em SVG. Nulo: ainda não tem.
    Sem tamanho é o molde geral da peça; com tamanho, o molde daquele tamanho. */
export async function carregarMolde(referenciaId: string, tamanho = ''): Promise<string | null> {
  const linhas = await tabela<{ svg: string }[]>(
    `molde_da_referencia?select=svg&referencia_id=eq.${referenciaId}&tamanho=eq.${encodeURIComponent(tamanho)}`,
  )
  return linhas.length ? linhas[0].svg : null
}

/** Troca o molde. Texto vazio tira o molde. Devolve se a referência ficou com molde.
    Trocar o desenho derruba a escala acertada: ela era do arquivo antigo. */
export function salvarMolde(referenciaId: string, svg: string, tamanho = ''): Promise<boolean> {
  return chamar<boolean>('salvar_molde_da_referencia', {
    p_referencia: referenciaId,
    p_svg: svg,
    /* o molde geral vai sem o tamanho, como sempre foi */
    ...(tamanho ? { p_tamanho: tamanho } : {}),
  })
}

/** Que moldes a referência tem (o geral é o de tamanho vazio) e a escala acertada de cada um.
    Sem o desenho: é a lista leve que a tela cheia lê antes de buscar o SVG de um tamanho. */
export async function carregarEscalasDoMolde(
  referenciaId: string,
): Promise<{ tamanho: string; cmPorUnidade: number | null }[]> {
  const linhas = await tabela<{ tamanho: string; cm_por_unidade: number | string | null }[]>(
    `molde_da_referencia?select=tamanho,cm_por_unidade&referencia_id=eq.${referenciaId}`,
  )
  return linhas.map(l => ({
    tamanho: l.tamanho,
    cmPorUnidade: l.cm_por_unidade === null || l.cm_por_unidade === '' ? null : Number(l.cm_por_unidade),
  }))
}

/** Guarda quantos centímetros vale uma unidade do desenho. Nulo tira a escala acertada. */
export function acertarEscalaDoMolde(
  referenciaId: string,
  cmPorUnidade: number | null,
  tamanho = '',
): Promise<number | null> {
  return chamar<number | null>('acertar_escala_do_molde', {
    p_referencia: referenciaId,
    p_cm_por_unidade: cmPorUnidade,
    p_tamanho: tamanho,
  })
}

/** Os tecidos do catálogo, com a largura e a gramatura, para a conta de metro e de grama. */
export async function carregarTecidosDeConta(): Promise<TecidoDeConta[]> {
  const linhas = await tabela<
    { id: string; nome: string; gramatura: number | string | null; largura: number | string | null }[]
  >('tecido?select=id,nome,gramatura,largura&ativo=is.true&order=ordem.asc,nome.asc')
  /* o banco pode devolver o número com casas como texto ("180.00"): aqui ele vira número */
  const numero = (v: number | string | null) => (v === null || v === '' ? null : Number(v))
  return linhas.map(l => ({
    id: l.id,
    nome: l.nome,
    gramatura: numero(l.gramatura),
    largura: numero(l.largura),
  }))
}

/** Os aviamentos e insumos do Estoque, para escolher na ficha. */
export function carregarMateriaisDeAviamento(): Promise<MaterialDoEstoque[]> {
  return tabela<MaterialDoEstoque[]>(
    'material?select=id,nome,categoria,unidade,grupo&categoria=in.(aviamento,insumo)&ativo=is.true&order=nome.asc',
  )
}

/* --- os kits ------------------------------------------------------------------- */

type LinhaDoKit = {
  id: string
  cod: string
  nome: string
  genero: string
  ativo: boolean
  ficha_em: string | null
  pecas: number
  pecas_cod: string[] | null
  pecas_sem_tecido: number
  pecas_sem_etiqueta: number
  tem_desenho: boolean
}

const doKit = (l: LinhaDoKit): KitNaLista => ({
  id: l.id,
  cod: l.cod,
  nome: l.nome,
  genero: l.genero,
  ativo: l.ativo,
  fichaEm: l.ficha_em,
  pecas: l.pecas,
  pecasCod: l.pecas_cod ?? [],
  pecasSemTecido: l.pecas_sem_tecido,
  pecasSemEtiqueta: l.pecas_sem_etiqueta,
  temDesenho: l.tem_desenho,
})

const COLUNAS_DO_KIT =
  'id,cod,nome,genero,ativo,ficha_em,pecas,pecas_cod,pecas_sem_tecido,pecas_sem_etiqueta,tem_desenho'

/** Os kits, para a aba. Só os ativos. */
export async function carregarKits(): Promise<KitNaLista[]> {
  const linhas = await tabela<LinhaDoKit[]>(
    `kit_na_ficha?select=${COLUNAS_DO_KIT}&ativo=is.true&order=nome.asc`,
  )
  return linhas.map(doKit)
}

type LinhaDaPeca = {
  kit_id: string
  kit_cod: string
  kit_nome: string
  referencia_id: string
  cod: string
  nome: string
  genero: string
  detalhes: Detalhes | null
  /* da 058: banco de antes dela não manda, e vale vazio */
  detalhes_do_kit?: Detalhes | null
  tamanhos: string[] | null
  papel: string
  tecidos: { parte: string; tecido_id: string; tecido?: string }[] | null
  design: DesignDaPeca[] | null
  etiqueta: EtiquetaDoKit
  etiqueta_onde: string
  observacao: string
}

/** As peças de um kit, na ordem dele, cada uma com a ficha de fabricação. */
export async function carregarPecasDoKit(kitId: string): Promise<PecaDoKit[]> {
  const linhas = await tabela<LinhaDaPeca[]>(
    'peca_do_kit_na_lista?select=kit_id,kit_cod,kit_nome,referencia_id,cod,nome,genero,detalhes,detalhes_do_kit,tamanhos,papel,tecidos,design,etiqueta,etiqueta_onde,observacao' +
      `&kit_id=eq.${kitId}&order=ordem.asc`,
  )
  return linhas.map(l => ({
    referenciaId: l.referencia_id,
    cod: l.cod,
    nome: l.nome,
    genero: l.genero,
    detalhes: l.detalhes ?? {},
    detalhesDoKit: l.detalhes_do_kit ?? {},
    tamanhos: l.tamanhos ?? [],
    papel: l.papel,
    tecidos: (l.tecidos ?? []).map(
      (t): TecidoDaPeca => ({ parte: t.parte, tecidoId: t.tecido_id, tecido: t.tecido ?? '' }),
    ),
    design: l.design ?? [],
    etiqueta: l.etiqueta,
    etiquetaOnde: l.etiqueta_onde,
    observacao: l.observacao,
  }))
}

/** Os kits em que uma referência entra. */
export async function carregarKitsDaReferencia(referenciaId: string): Promise<KitDaReferencia[]> {
  const linhas = await tabela<{ kit_id: string; kit_cod: string; kit_nome: string; papel: string }[]>(
    `peca_do_kit_na_lista?select=kit_id,kit_cod,kit_nome,papel&referencia_id=eq.${referenciaId}&kit_ativo=is.true&order=kit_nome.asc`,
  )
  return linhas.map(l => ({ kitId: l.kit_id, kitCod: l.kit_cod, kitNome: l.kit_nome, papel: l.papel }))
}

/* --- as listas dos detalhes da peça (058) ---------------------------------------- */

type LinhaDoItem = {
  id: string
  detalhe: ChaveDeDetalhe
  nome: string
  ordem: number | string
  referencias: number | string | null
  kits: number | string | null
}

/** As cinco listas (gola, manga, punho, barra e costura), cada uma na ordem dela. */
export async function carregarListasDeDetalhe(): Promise<ListasDeDetalhe> {
  const linhas = await tabela<LinhaDoItem[]>(
    'item_de_detalhe_na_lista?select=id,detalhe,nome,ordem,referencias,kits&order=detalhe.asc,ordem.asc,nome.asc',
  )
  return emListas(
    linhas.map(
      (l): ItemDeDetalhe => ({
        id: l.id,
        detalhe: l.detalhe,
        nome: l.nome,
        ordem: Number(l.ordem) || 0,
        referencias: Number(l.referencias) || 0,
        kits: Number(l.kits) || 0,
      }),
    ),
  )
}

/** Põe um item no fim da lista de um detalhe. Se o nome já existe, escrito de
    outro jeito, o banco devolve o que já existe. */
export function adicionarItemDeDetalhe(detalhe: ChaveDeDetalhe, nome: string): Promise<string> {
  return chamar<string>('adicionar_item_de_detalhe', { p_detalhe: detalhe, p_nome: nome.trim() })
}

/** Salva as listas pelo editor: cada uma inteira e na ordem. Mudar o nome de um
    item muda o texto nas referências e nos kits que o usam; tirar não apaga nada.
    A lista que não vai fica como está no banco. */
export function salvarListasDeDetalhe(listas: Partial<ListasParaOBanco>): Promise<number> {
  return chamar<number>('salvar_listas_de_detalhe', { p_listas: listas })
}

/** Cria o kit (sem id) ou salva a ficha dele. Devolve o id do kit. */
export function salvarKit(kitId: string | null, kit: Kit): Promise<string> {
  return chamar<string>('salvar_kit', { p_kit: kitId, p_ficha: kitParaOBanco(kit) })
}

/* --- o movimento e as vendas ------------------------------------------------------
   A tela lê os layouts dos pedidos (a cópia da migração 053), as fatias do
   kanban e as peças de cada kit, e quem soma é vendas.ts. */

const DE_CADA_VEZ = 1000

/** Lê a lista inteira, de mil em mil: o banco devolve no máximo mil linhas por vez, e
    uma lista cortada em silêncio daria uma soma errada sem ninguém ver.
    O caminho precisa trazer uma ordem que não empata. */
async function lerTudo<T>(caminho: string): Promise<T[]> {
  const tudo: T[] = []
  for (let de = 0; ; de += DE_CADA_VEZ) {
    const parte = await tabela<T[]>(`${caminho}&limit=${DE_CADA_VEZ}&offset=${de}`)
    tudo.push(...parte)
    if (parte.length < DE_CADA_VEZ) return tudo
  }
}

type LinhaDoLayout = {
  pedido_id: string
  numero: string
  cliente: string | null
  estado: string
  etapa: string
  etapa_em: string | null
  aprovado_em: string | null
  fechado_em: string | null
  teste: boolean | null
  ordem: number
  layout: number
  referencia: string | null
  nome: string | null
  arte: string | null
  grade: Record<string, number> | null
  pecas: number
  tecnicas: string[] | null
  referencia_id: string | null
  kit: boolean | null
}

/** Os layouts dos pedidos aprovados de `desde` (um dia, AAAA-MM-DD) para cá. Pedido cancelado não vem. */
export async function carregarLayoutsVendidos(desde: string): Promise<LayoutVendido[]> {
  const linhas = await lerTudo<LinhaDoLayout>(
    'layout_na_fabrica?select=pedido_id,numero,cliente,estado,etapa,etapa_em,aprovado_em,fechado_em,teste,ordem,layout,referencia,nome,arte,grade,pecas,tecnicas,referencia_id,kit' +
      `&aprovado_em=gte.${desde}&order=pedido_id.asc,ordem.asc`,
  )
  return linhas.map(l => ({
    pedidoId: l.pedido_id,
    numero: l.numero,
    cliente: l.cliente ?? '',
    estado: l.estado,
    etapa: l.etapa,
    etapaEm: l.etapa_em ?? '',
    aprovadoEm: l.aprovado_em ?? '',
    fechadoEm: l.fechado_em ?? '',
    teste: !!l.teste,
    ordem: l.ordem,
    layout: l.layout,
    referencia: l.referencia ?? '',
    nome: l.nome ?? '',
    arte: l.arte ?? '',
    grade: l.grade ?? {},
    pecas: Number(l.pecas) || 0,
    tecnicas: l.tecnicas ?? [],
    referenciaId: l.referencia_id,
    kit: !!l.kit,
  }))
}

/** As fatias do kanban que dizem onde cada layout está: as abertas, e as que fecharam de `desde` (AAAA-MM-DD) para cá. */
export async function carregarFatiasDosLayouts(desde: string): Promise<FatiaDoLayout[]> {
  const linhas = await lerTudo<{
    pedido_id: string
    tecnica: string
    etapa: string
    etapa_em: string | null
    fechado_em: string | null
    layouts: number[] | null
  }>(
    'fatia_na_fabrica?select=pedido_id,tecnica,etapa,etapa_em,fechado_em,layouts&estado=in.(producao,pronto,enviado,entregue)' +
      `&or=(fechado_em.is.null,fechado_em.gte.${desde})&order=id.asc`,
  )
  return linhas.map(f => ({
    pedidoId: f.pedido_id,
    tecnica: f.tecnica,
    etapa: f.etapa,
    etapaEm: f.etapa_em ?? '',
    fechadoEm: f.fechado_em ?? '',
    layouts: f.layouts ?? [],
  }))
}

/** As peças de cada kit, pelo id do kit. Entram os kits arquivados: a venda antiga deles continua valendo. */
export async function carregarPecasDosKits(): Promise<PecasDosKits> {
  const linhas = await lerTudo<{ kit_id: string; referencia_id: string; cod: string; nome: string }>(
    'peca_do_kit_na_lista?select=kit_id,referencia_id,cod,nome&order=kit_id.asc,ordem.asc',
  )
  const kits: PecasDosKits = {}
  for (const l of linhas) (kits[l.kit_id] ??= []).push({ referenciaId: l.referencia_id, cod: l.cod, nome: l.nome })
  return kits
}
