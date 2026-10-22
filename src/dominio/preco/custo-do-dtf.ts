import { tabela } from '@shared/supabase'
import { CUSTO_DO_DTF_PADRAO, type CustoDoDtf } from './adicionais'

/* ==========================================================================
   ONDE MORA O CUSTO DO DTF (22/10/2026): na regulagem, como o preço do metro
   da calculadora de Ferramentas, que é a mesma chave (`dtf.metro`). Vale
   para a fábrica inteira: todo aprovado lê, só o administrador muda (a regra
   da regulagem, 013). Chave que o banco ainda não tem vale o padrão.
   ========================================================================== */

const CHAVES = { metro: 'dtf.metro', largura: 'dtf.largura', aproveitamento: 'dtf.aproveitamento' } as const

const numero = (v: string | undefined) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function lerCustoDoDtf(): Promise<CustoDoDtf> {
  const linhas = await tabela<{ chave: string; valor: string }[]>(
    'regulagem?select=chave,valor&chave=in.(' + Object.values(CHAVES).join(',') + ')',
  )
  const de = (k: keyof CustoDoDtf) => numero(linhas.find((l) => l.chave === CHAVES[k])?.valor) ?? CUSTO_DO_DTF_PADRAO[k]
  return { metro: de('metro'), largura: de('largura'), aproveitamento: Math.min(100, de('aproveitamento')) }
}

/** Grava os três números. Só o admin passa pela regra de acesso do banco. */
export async function gravarCustoDoDtf(c: CustoDoDtf): Promise<CustoDoDtf> {
  if (!(c.metro > 0 && c.largura > 0 && c.aproveitamento > 0 && c.aproveitamento <= 100)) throw new Error('Os três números precisam ser maiores que zero, e o aproveitamento no máximo 100%.')
  const notas = {
    metro: 'preco do metro de DTF, em reais, tudo incluido',
    largura: 'largura do filme de DTF, em cm',
    aproveitamento: 'quanto do filme de DTF vira estampa, em por cento',
  }
  const linhas = await tabela<{ chave: string }[]>('regulagem?on_conflict=chave', {
    metodo: 'POST',
    mesclar: true,
    devolver: true,
    corpo: (Object.keys(CHAVES) as (keyof CustoDoDtf)[]).map((k) => ({
      chave: CHAVES[k],
      valor: k === 'metro' ? c.metro.toFixed(2) : String(c[k]),
      nota: notas[k],
    })),
  })
  /* a linha que volta é a prova de que gravou: a regra que recusa em silêncio pareceria sucesso */
  if (linhas.length < 3) throw new Error('O banco não confirmou a gravação: só o administrador muda o custo do DTF.')
  return c
}
