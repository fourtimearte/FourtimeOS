import { chamar, tabela } from '@shared/supabase'
import { semAcento } from '@shared/formatar'
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

