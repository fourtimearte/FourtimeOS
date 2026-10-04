import { chamar, tabela } from '@shared/supabase'
import {
  duasCasas,
  nomeDoVao,
  type Lugar,
  type Movel,
  type Planta,
  type TipoDeMovel,
} from './planta'

/* ==========================================================================
   O depósito (047).

   O material dizia onde estava num texto livre. Agora o depósito é desenhado:
   o chão, as prateleiras, os paletes e a escada, e cada material aponta para
   um lugar do desenho. Esta pasta lê e grava; a conta mora em planta.ts, que
   não conhece o banco.

   O DESENHO É GRAVADO INTEIRO. O editor mexe numa cópia, e o Salvar manda a
   cópia toda para salvar_deposito, que troca tudo de uma vez. Nada do que a
   pessoa arrasta vale para o Estoque antes disso.
   ========================================================================== */

export * from './planta'

/** onde um material está, do jeito que a view entrega */
export type LugarDoMaterial = Lugar & {
  id: string
  materialId: string
  tipo: 'prateleira' | 'palete'
  /** o nome do móvel: "D", "P07" */
  movel: string
  /** o nome do vão: "D2"; vazio no palete */
  vaoNome: string
  /** "D2-3", "D2" ou "P07" */
  codigo: string
  principal: boolean
}

type LinhaDoDeposito = {
  id: string
  nome: string
  largura: number | string
  fundo: number | string
}

type LinhaDoMovel = {
  id: string
  tipo: TipoDeMovel
  nome: string
  uso: string | null
  x: number | string
  y: number | string
  largura: number | string
  fundo: number | string
  em_pe: boolean
  vaos: number
  niveis: number
  nomes_dos_vaos: string[] | null
  grade: string | null
}

type LinhaDoLugar = {
  id: string
  material_id: string
  movel_id: string
  tipo: 'prateleira' | 'palete'
  movel: string
  vao: number | null
  vao_nome: string | null
  nivel: number | null
  principal: boolean
  codigo: string
}

/* numeric chega como texto no JSON (ver dominio/estoque) */
function numero(v: number | string | null): number {
  return typeof v === 'number' ? v : Number(v ?? 0) || 0
}

function deLinha(l: LinhaDoMovel): Movel {
  return {
    id: l.id,
    tipo: l.tipo,
    nome: l.nome,
    uso: l.uso ?? '',
    x: numero(l.x),
    y: numero(l.y),
    largura: numero(l.largura),
    fundo: numero(l.fundo),
    emPe: !!l.em_pe,
    vaos: l.vaos || 1,
    niveis: l.niveis || 1,
    nomesDosVaos: l.nomes_dos_vaos ?? [],
    grade: l.grade ?? '',
  }
}

/* O DEPÓSITO PODE AINDA NÃO EXISTIR: a tela nasce antes do desenho. Aí a
   leitura devolve null e a tela convida a desenhar. Erro de leitura sobe como
   erro: quem chama (a tela do Estoque) lê o depósito à parte, para um
   problema aqui não derrubar a lista de materiais. */
export async function carregarDeposito(): Promise<Planta | null> {
  const chaos = await tabela<LinhaDoDeposito[]>(
    'deposito?select=id,nome,largura,fundo&order=criado_em.asc,id.asc&limit=1',
  )
  const chao = chaos[0]
  if (!chao) return null
  const moveis = await tabela<LinhaDoMovel[]>(
    `movel_do_deposito?select=id,tipo,nome,uso,x,y,largura,fundo,em_pe,vaos,niveis,nomes_dos_vaos,grade&deposito_id=eq.${chao.id}&order=nome.asc`,
  )
  return {
    id: chao.id,
    nome: chao.nome,
    largura: numero(chao.largura),
    fundo: numero(chao.fundo),
    moveis: moveis.map(deLinha),
  }
}

export async function carregarLugares(): Promise<LugarDoMaterial[]> {
  const linhas = await tabela<LinhaDoLugar[]>(
    'lugar_do_material_na_lista?select=id,material_id,movel_id,tipo,movel,vao,vao_nome,nivel,principal,codigo&order=principal.desc,criado_em.asc',
  )
  return linhas.map(l => ({
    id: l.id,
    materialId: l.material_id,
    movelId: l.movel_id,
    tipo: l.tipo,
    movel: l.movel,
    vao: l.vao,
    vaoNome: l.vao_nome ?? '',
    nivel: l.nivel,
    principal: l.principal,
    codigo: l.codigo,
  }))
}

/* SALVAR O DESENHO. `soltar` é a confirmação de quem leu o aviso: os
   materiais que ficariam num lugar que deixou de existir ficam sem lugar. Sem
   ela o banco recusa, mesmo que a tela tenha esquecido de perguntar. */
export async function salvarDeposito(planta: Planta, soltar: boolean): Promise<void> {
  await chamar('salvar_deposito', {
    p_planta: {
      nome: planta.nome.trim(),
      largura: duasCasas(planta.largura),
      fundo: duasCasas(planta.fundo),
      moveis: planta.moveis.map(m => ({
        id: m.id,
        tipo: m.tipo,
        nome: m.nome.trim(),
        uso: m.uso.trim(),
        x: duasCasas(m.x),
        y: duasCasas(m.y),
        largura: duasCasas(m.largura),
        fundo: duasCasas(m.fundo),
        em_pe: m.emPe,
        vaos: m.tipo === 'prateleira' ? m.vaos : 1,
        niveis: m.tipo === 'prateleira' ? m.niveis : 1,
        nomes_dos_vaos:
          m.tipo === 'prateleira'
            ? Array.from({ length: m.vaos }, (_, i) => nomeDoVao(m, i + 1))
            : [],
        grade: m.tipo === 'palete' ? m.grade || null : null,
      })),
    },
    p_soltar: soltar,
  })
}

/* MARCAR ONDE ESTÁ. Troca todos os lugares dos materiais pelos da lista, na
   ordem: o primeiro é o principal. Lista vazia tira o lugar. */
export async function definirLugares(materiais: string[], lugares: Lugar[]): Promise<void> {
  await chamar('definir_lugares', {
    p_materiais: materiais,
    p_lugares: lugares.map(l => ({ movel: l.movelId, vao: l.vao, nivel: l.nivel })),
  })
}

/** os lugares de um material, o principal primeiro */
export function lugaresDoMaterial(
  lugares: LugarDoMaterial[],
  materialId: string,
): LugarDoMaterial[] {
  return lugares
    .filter(l => l.materialId === materialId)
    .sort((a, b) => Number(b.principal) - Number(a.principal))
}
