/* ==========================================================================
   A conversa do banco de dados da fábrica com o Supabase.

   Quem pode mexer é admin e gerente, e quem decide isso é a regra de acesso
   escrita nas tabelas. Aqui não tem nenhuma trava: se um vendedor chamar
   apagarReferencia na marra, o banco devolve "seu acesso não permite fazer
   isso" e nada acontece. A tela esconde os botões por educação, não por
   segurança.
   ========================================================================== */

import { tabela } from '@shared/supabase'
import type {
  Banco,
  CorDeImpressao,
  CorDeTecido,
  Grupo,
  ItemDeLista,
  Problema,
  Referencia,
  Tecido,
  TipoDeLista,
} from './tipos'

const GRUPO = 'select=cod,nome,ordem&order=ordem.asc'

/* Tudo de uma vez. São nove pedidos pequenos em paralelo, e não nove telas de
   carregamento em fila: o banco inteiro tem menos de mil linhas. */
export async function carregarBanco(): Promise<Banco> {
  const [
    gruposDeReferencia,
    gruposDeTecido,
    gruposDeCor,
    referencias,
    tecidos,
    coresDeTecido,
    coresDeImpressao,
    listas,
    problemas,
  ] = await Promise.all([
    tabela<Grupo[]>(`grupo_de_referencia?${GRUPO}`),
    tabela<Grupo[]>(`grupo_de_tecido?${GRUPO}`),
    tabela<Grupo[]>(`grupo_de_cor?${GRUPO}`),
    tabela<Referencia[]>(
      'referencia?select=id,cod,nome,grupo,genero,ordem,ativo&order=cod.asc,nome.asc',
    ),
    tabela<Tecido[]>('tecido?select=id,nome,grupo,ordem,ativo&order=ordem.asc,nome.asc'),
    tabela<CorDeTecido[]>(
      'cor_de_tecido?select=id,nome,hex,grupo,ordem,ativo&order=ordem.asc,nome.asc',
    ),
    tabela<CorDeImpressao[]>(
      'cor_de_impressao?select=codigo,tecnica,numero,hex,nome&order=tecnica.asc,numero.asc',
    ),
    tabela<ItemDeLista[]>('lista_do_cabecalho?select=tipo,valor,ordem,ativo&order=ordem.asc'),
    tabela<Problema[]>('referencia_com_problema?select=id,cod,nome,problema'),
  ])

  return {
    gruposDeReferencia,
    gruposDeTecido,
    gruposDeCor,
    referencias,
    tecidos,
    coresDeTecido,
    coresDeImpressao,
    listas,
    problemas,
  }
}

function um<T>(linhas: T[]): T {
  if (!linhas || linhas.length === 0) throw new Error('O banco aceitou mas não devolveu a linha.')
  return linhas[0]
}

/* --- referência ----------------------------------------------------------- */

export async function criarReferencia(entrada: {
  cod: string
  nome: string
  grupo: string | null
  genero: string
}): Promise<Referencia> {
  const linhas = await tabela<Referencia[]>('referencia', {
    metodo: 'POST',
    devolver: true,
    corpo: [{ ...entrada, nome: entrada.nome.trim() }],
  })
  return um(linhas)
}

export async function renomearReferencia(id: string, nome: string): Promise<Referencia> {
  const linhas = await tabela<Referencia[]>(`referencia?id=eq.${id}`, {
    metodo: 'PATCH',
    devolver: true,
    corpo: { nome: nome.trim() },
  })
  return um(linhas)
}

export async function apagarReferencia(id: string): Promise<void> {
  await tabela<void>(`referencia?id=eq.${id}`, { metodo: 'DELETE' })
}

/* --- tecido --------------------------------------------------------------- */

export async function criarTecido(nome: string, grupo: string | null): Promise<Tecido> {
  const linhas = await tabela<Tecido[]>('tecido', {
    metodo: 'POST',
    devolver: true,
    corpo: [{ nome: nome.trim(), grupo }],
  })
  return um(linhas)
}

export async function renomearTecido(id: string, nome: string): Promise<Tecido> {
  const linhas = await tabela<Tecido[]>(`tecido?id=eq.${id}`, {
    metodo: 'PATCH',
    devolver: true,
    corpo: { nome: nome.trim() },
  })
  return um(linhas)
}

export async function apagarTecido(id: string): Promise<void> {
  await tabela<void>(`tecido?id=eq.${id}`, { metodo: 'DELETE' })
}

/* --- cor de tecido -------------------------------------------------------- */

export async function criarCorDeTecido(entrada: {
  nome: string
  hex: string
  grupo: string | null
}): Promise<CorDeTecido> {
  const linhas = await tabela<CorDeTecido[]>('cor_de_tecido', {
    metodo: 'POST',
    devolver: true,
    corpo: [{ ...entrada, nome: entrada.nome.trim(), hex: entrada.hex.toUpperCase() }],
  })
  return um(linhas)
}

export async function mudarCorDeTecido(
  id: string,
  mudanca: Partial<Pick<CorDeTecido, 'nome' | 'hex' | 'grupo'>>,
): Promise<CorDeTecido> {
  const linhas = await tabela<CorDeTecido[]>(`cor_de_tecido?id=eq.${id}`, {
    metodo: 'PATCH',
    devolver: true,
    corpo: mudanca,
  })
  return um(linhas)
}

export async function apagarCorDeTecido(id: string): Promise<void> {
  await tabela<void>(`cor_de_tecido?id=eq.${id}`, { metodo: 'DELETE' })
}

/* --- cor de impressão -----------------------------------------------------
   Só o nome. Não existe criar nem apagar de propósito: o número é a tabela da
   máquina, e ela não muda porque alguém mexeu numa tela. */

export async function renomearCorDeImpressao(
  codigo: string,
  nome: string,
): Promise<CorDeImpressao> {
  const linhas = await tabela<CorDeImpressao[]>(
    `cor_de_impressao?codigo=eq.${encodeURIComponent(codigo)}`,
    { metodo: 'PATCH', devolver: true, corpo: { nome: nome.trim() } },
  )
  return um(linhas)
}

/* --- as listas do cabeçalho ----------------------------------------------
   A chave é (tipo, valor). Renomear é apagar e criar de novo, e por isso a
   tela avisa que o orçamento antigo continua com o texto que tinha: ele
   guarda o texto, não um vínculo. */

export async function criarItemDeLista(tipo: TipoDeLista, valor: string): Promise<ItemDeLista> {
  const linhas = await tabela<ItemDeLista[]>('lista_do_cabecalho', {
    metodo: 'POST',
    devolver: true,
    corpo: [{ tipo, valor: valor.trim() }],
  })
  return um(linhas)
}

export async function apagarItemDeLista(tipo: TipoDeLista, valor: string): Promise<void> {
  await tabela<void>(
    `lista_do_cabecalho?tipo=eq.${tipo}&valor=eq.${encodeURIComponent(valor)}`,
    { metodo: 'DELETE' },
  )
}

export async function renomearItemDeLista(
  tipo: TipoDeLista,
  de: string,
  para: string,
): Promise<ItemDeLista> {
  const novo = await criarItemDeLista(tipo, para)
  await apagarItemDeLista(tipo, de)
  return novo
}
