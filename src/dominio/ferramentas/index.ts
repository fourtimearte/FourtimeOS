import { tabela } from '@shared/supabase'

/* ==========================================================================
   AS FERRAMENTAS.

   Contas soltas que a fábrica faz o dia inteiro e que não pertencem a pedido
   nenhum. A primeira é o custo do DTF por metragem.

   ELAS NÃO GRAVAM NADA DO QUE SE DIGITA. A medida, o preço manual e o
   resultado vivem só na tela e somem quando a pessoa sai dela. O único número
   que mora no banco é o preço do metro que o administrador define em
   Configurações, porque esse vale para a fábrica inteira: guardado por
   navegador, cada computador cobraria um DTF diferente.

   ELE MORA NA REGULAGEM, e não numa tabela própria. A regulagem já é o lugar
   das decisões que valem para o sistema inteiro, já tem a regra certa (todo
   aprovado lê, só o admin muda) e já carimba a data da mudança. Uma tabela
   nova para guardar um número só seria uma migração a mais sem ganho nenhum.
   ========================================================================== */

/** O preço de hoje, 29/09/2026. Vale enquanto ninguém gravou outro. */
export const PRECO_DO_METRO_PADRAO = 60

const CHAVE = 'dtf.metro'

export type PrecoDoMetro = {
  preco: number
  /** falso quando o banco ainda não tem linha e o número é o padrão */
  gravado: boolean
  atualizadoEm: string | null
}

export async function lerPrecoDoMetro(): Promise<PrecoDoMetro> {
  const linhas = await tabela<{ valor: string; atualizado_em: string }[]>(
    'regulagem?select=valor,atualizado_em&chave=eq.' + CHAVE,
  )
  const n = lerNumero(linhas[0]?.valor ?? '')
  if (!linhas.length || n === null || Number.isNaN(n) || n <= 0) {
    return { preco: PRECO_DO_METRO_PADRAO, gravado: false, atualizadoEm: null }
  }
  return { preco: n, gravado: true, atualizadoEm: linhas[0].atualizado_em }
}

/** Grava o preço do metro. Só o admin passa pela regra de acesso do banco. */
export async function gravarPrecoDoMetro(preco: number): Promise<PrecoDoMetro> {
  if (!(preco > 0)) throw new Error('O preço do metro precisa ser maior que zero.')
  /* devolver: a linha que volta é a prova de que gravou. Sem ela, uma regra
     de acesso que recusa em silêncio pareceria sucesso na tela. */
  const linhas = await tabela<{ valor: string; atualizado_em: string }[]>(
    'regulagem?on_conflict=chave',
    {
      metodo: 'POST',
      mesclar: true,
      devolver: true,
      corpo: {
        chave: CHAVE,
        valor: preco.toFixed(2),
        nota: 'preco do metro de DTF, em reais, usado pela calculadora de Ferramentas',
      },
    },
  )
  if (!linhas.length) throw new Error('O banco não confirmou a gravação.')
  return { preco, gravado: true, atualizadoEm: linhas[0].atualizado_em }
}

/* ==========================================================================
   A CONTA
   ========================================================================== */

/* O NÚMERO DIGITADO DO JEITO BRASILEIRO. "2,16", "2.16", "1.250,50" e "60"
   são todos números para quem está no galpão, e a calculadora não pode
   responder "valor inválido" para nenhum deles.

   Com vírgula, a vírgula é o decimal e os pontos são milhar. Sem vírgula, um
   ponto só é decimal: ninguém escreve "2.16" querendo dizer duzentos e
   dezesseis metros. Vazio devolve nulo, que é diferente de zero: campo em
   branco não é erro, é campo que a pessoa ainda não preencheu. */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!t) return null
  let limpo: string
  if (t.includes(',')) limpo = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1) limpo = t.replace(/\./g, '')
  else limpo = t
  if (!/^\d*\.?\d*$/.test(limpo) || limpo === '.') return NaN
  return Number(limpo)
}

export type ContaDoDtf = {
  /** o comprimento inteiro, em centímetros, já somado metro com centímetro */
  centimetros: number
  metros: number
  custo: number
  /** a mesma conta partida: os metros inteiros e a sobra */
  custoDosInteiros: number
  custoDaSobra: number
}

/* CENTÍMETRO É A UNIDADE DA CONTA, e não o metro. 2 m e 16 cm viram 216 cm,
   e 216 × 60 / 100 dá 129,60 sem a sujeira de ponto flutuante que 2.16 × 60
   carregaria. O centavo é arredondado uma vez só, no fim. */
export function contaDoDtf(metros: number, centimetros: number, precoDoMetro: number): ContaDoDtf {
  const cm = Math.max(0, Math.round((metros * 100 + centimetros) * 100) / 100)
  const centavos = (x: number) => Math.round(x * 100) / 100
  const inteiros = Math.floor(cm / 100)
  /* a sobra sai da subtração, e não de uma conta própria: assim as duas
     linhas do resultado somam exatamente o total, centavo por centavo */
  const custoDosInteiros = centavos(inteiros * precoDoMetro)
  const custo = centavos((cm * precoDoMetro) / 100)
  return {
    centimetros: cm,
    metros: cm / 100,
    custo,
    custoDosInteiros,
    custoDaSobra: centavos(custo - custoDosInteiros),
  }
}

/** "2 m e 16 cm", "80 cm", "3 m". Do jeito que se fala no balcão. */
export function metragemPorExtenso(centimetros: number): string {
  const m = Math.floor(centimetros / 100)
  const cm = Math.round((centimetros - m * 100) * 10) / 10
  const cmTexto = String(cm).replace('.', ',')
  if (!m) return cmTexto + ' cm'
  if (!cm) return m + ' m'
  return m + ' m e ' + cmTexto + ' cm'
}
