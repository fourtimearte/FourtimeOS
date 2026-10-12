import { chamar, tabela } from '@shared/supabase'
import {
  FAIXAS_PADRAO,
  REGRAS_PADRAO,
  type Arredondar,
  type Faixa,
  type ItemDaTabela,
  type RegrasDaTabela,
  type SituacaoDaTabela,
  type TabelaDePreco,
} from './tipos'

/* ==========================================================================
   A conversa das tabelas de preço com o banco (068).

   ANTES DA 068 RODAR, a tabela não existe e o PostgREST responde 404. Aí a
   leitura devolve `semBanco: true` e a tela diz o que falta, em vez de cair
   ou de guardar preço no navegador: preço guardado num navegador só seria uma
   segunda tabela que ninguém mais vê.
   ========================================================================== */

type LinhaDaTabela = {
  id: string
  nome: string
  situacao: SituacaoDaTabela
  padrao: boolean
  vale_ate: string | null
  so_gerente: boolean
  faixas: { de: number; ate: number | null }[] | null
  regras: Record<string, unknown> | null
  itens: { codigo: string; tipo: string; base: number | null; precos: (number | null)[] | null }[] | null
  observacao: string | null
  teste: boolean
  atualizado_em: string
}

const COLUNAS = 'id,nome,situacao,padrao,vale_ate,so_gerente,faixas,regras,itens,observacao,teste,atualizado_em'

const num = (v: unknown, reserva: number) => (typeof v === 'number' && Number.isFinite(v) ? v : reserva)

function regrasDe(r: Record<string, unknown> | null): RegrasDaTabela {
  const x = r ?? {}
  const arr = String(x.arredondar ?? REGRAS_PADRAO.arredondar)
  return {
    passoPct: num(x.passo_pct, REGRAS_PADRAO.passoPct),
    arredondar: (arr === '90' || arr === '00' ? arr : '') as Arredondar,
    plusReais: num(x.plus_reais, REGRAS_PADRAO.plusReais),
    infantilPct: num(x.infantil_pct, REGRAS_PADRAO.infantilPct),
    kitPct: num(x.kit_pct, REGRAS_PADRAO.kitPct),
  }
}

function deLinha(l: LinhaDaTabela): TabelaDePreco {
  const faixas: Faixa[] = (l.faixas && l.faixas.length ? l.faixas : FAIXAS_PADRAO).map((f) => ({
    de: Number(f.de) || 0,
    ate: f.ate == null ? null : Number(f.ate),
  }))
  return {
    id: l.id,
    nome: l.nome,
    situacao: l.situacao,
    padrao: l.padrao,
    valeAte: l.vale_ate ?? '',
    soGerente: l.so_gerente,
    faixas,
    regras: regrasDe(l.regras),
    itens: (l.itens ?? []).map(
      (i): ItemDaTabela => ({
        codigo: String(i.codigo ?? ''),
        tipo: i.tipo === 'kit' ? 'kit' : 'referencia',
        base: i.base == null ? null : Number(i.base),
        precos: faixas.map((_, k) => {
          const v = i.precos?.[k]
          return v == null ? null : Number(v)
        }),
      }),
    ),
    observacao: l.observacao ?? '',
    teste: l.teste,
    atualizadoEm: l.atualizado_em,
  }
}

function paraLinha(t: TabelaDePreco) {
  return {
    nome: t.nome.trim(),
    situacao: t.situacao,
    vale_ate: t.valeAte || null,
    so_gerente: t.soGerente,
    faixas: t.faixas,
    regras: {
      passo_pct: t.regras.passoPct,
      arredondar: t.regras.arredondar,
      plus_reais: t.regras.plusReais,
      infantil_pct: t.regras.infantilPct,
      kit_pct: t.regras.kitPct,
    },
    itens: t.itens.map((i) => ({
      codigo: i.codigo,
      tipo: i.tipo,
      base: i.base,
      precos: t.faixas.map((_, k) => i.precos[k] ?? null),
    })),
    observacao: t.observacao,
  }
}

const semATabela = (e: unknown) =>
  e instanceof Error && /Não encontrei|schema cache|tabela_de_preco|PGRST205|42P01/i.test(e.message)

/** Todas as tabelas, inclusive as arquivadas (a tela separa). */
export async function carregarTabelasDePreco(): Promise<{ tabelas: TabelaDePreco[]; semBanco: boolean }> {
  try {
    const linhas = await tabela<LinhaDaTabela[]>(`tabela_de_preco?select=${COLUNAS}&order=nome.asc`)
    return { tabelas: linhas.map(deLinha), semBanco: false }
  } catch (e) {
    if (semATabela(e)) return { tabelas: [], semBanco: true }
    throw e
  }
}

/** Cria (sem id) ou grava (com id) a tabela inteira, e devolve como ficou. */
export async function salvarTabelaDePreco(t: TabelaDePreco): Promise<TabelaDePreco> {
  if (t.id) {
    const linhas = await tabela<LinhaDaTabela[]>(`tabela_de_preco?id=eq.${encodeURIComponent(t.id)}&select=${COLUNAS}`, {
      metodo: 'PATCH',
      corpo: paraLinha(t),
      devolver: true,
    })
    if (!linhas[0]) throw new Error('Seu acesso não permite mudar tabela de preço.')
    return deLinha(linhas[0])
  }
  const linhas = await tabela<LinhaDaTabela[]>(`tabela_de_preco?select=${COLUNAS}`, {
    metodo: 'POST',
    corpo: [paraLinha(t)],
    devolver: true,
  })
  if (!linhas[0]) throw new Error('O banco aceitou mas não devolveu a tabela.')
  return deLinha(linhas[0])
}

/** A padrão troca no banco, numa chamada só (a velha deixa de ser). */
export async function tornarPadrao(id: string): Promise<void> {
  await chamar('tabela_de_preco_padrao', { p_id: id })
}
