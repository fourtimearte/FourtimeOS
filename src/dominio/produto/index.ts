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
import {
  codigoCurto,
  tamanhosDaReferencia,
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

/** O molde da referência, em SVG. Nulo: ainda não tem. */
export async function carregarMolde(referenciaId: string): Promise<string | null> {
  const linhas = await tabela<{ svg: string }[]>(
    `molde_da_referencia?select=svg&referencia_id=eq.${referenciaId}&tamanho=eq.`,
  )
  return linhas.length ? linhas[0].svg : null
}

/** Troca o molde. Texto vazio tira o molde. Devolve se a referência ficou com molde. */
export function salvarMolde(referenciaId: string, svg: string): Promise<boolean> {
  return chamar<boolean>('salvar_molde_da_referencia', { p_referencia: referenciaId, p_svg: svg })
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
    'peca_do_kit_na_lista?select=kit_id,kit_cod,kit_nome,referencia_id,cod,nome,genero,detalhes,tamanhos,papel,tecidos,design,etiqueta,etiqueta_onde,observacao' +
      `&kit_id=eq.${kitId}&order=ordem.asc`,
  )
  return linhas.map(l => ({
    referenciaId: l.referencia_id,
    cod: l.cod,
    nome: l.nome,
    genero: l.genero,
    detalhes: l.detalhes ?? {},
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

/** Cria o kit (sem id) ou salva a ficha dele. Devolve o id do kit. */
export function salvarKit(kitId: string | null, kit: Kit): Promise<string> {
  return chamar<string>('salvar_kit', { p_kit: kitId, p_ficha: kitParaOBanco(kit) })
}
