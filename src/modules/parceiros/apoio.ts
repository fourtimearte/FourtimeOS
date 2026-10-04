import { formatarDinheiroExato, formatarNumeroExato, lerMes, MES_LONGO } from '@shared'
import type { SomaDoParceiro } from '@dominio/parceiro'

/* As frases e as contas de tela da página de Parceiros. Tudo puro. */

export const dinheiro = (v: number) => formatarDinheiroExato(v)

/** "1.559,40": o dinheiro sem o R$, para a coluna estreita do celular. */
export const semCifrao = (v: number) => formatarNumeroExato(v)

export const inteiro = (v: number) => v.toLocaleString('pt-BR')

export const plural = (n: number, um: string, varios: string) =>
  n === 1 ? `1 ${um}` : `${n} ${varios}`

/** "outubro". */
export const mesSozinho = (chave: string) => MES_LONGO[lerMes(chave).mes]

/** "out". */
export const mesCurto = (chave: string) => mesSozinho(chave).slice(0, 3)

/** "out/26". */
export const mesCurtoComAno = (chave: string) =>
  `${mesCurto(chave)}/${String(lerMes(chave).ano).slice(2)}`

const maiuscula = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}`

/** "Maio a outubro de 2026", "Novembro de 2025 a outubro de 2026". */
export function intervaloDosMeses(meses: string[]): string {
  const de = meses[0]
  const ate = meses[meses.length - 1]
  const anoDe = lerMes(de).ano
  const anoAte = lerMes(ate).ano
  if (de === ate) return `${maiuscula(mesSozinho(ate))} de ${anoAte}`
  const inicio = anoDe === anoAte ? mesSozinho(de) : `${mesSozinho(de)} de ${anoDe}`
  return `${maiuscula(inicio)} a ${mesSozinho(ate)} de ${anoAte}`
}

/** A parte do parceiro numa soma. Quando nenhuma peça tinha acordo no dia da
    venda, não há número para mostrar: a tela diz "sem acordo". */
export function parteNaTela(s: SomaDoParceiro, formato: (v: number) => string = dinheiro): string {
  return s.pecas > 0 && s.semAcordo === s.pecas ? 'sem acordo' : formato(s.parte)
}

/** A linha de apoio de uma parte: só existe quando PARTE das peças ficou sem
    acordo, porque aí o número aparece e não conta a história inteira. */
export function faltaDeAcordo(s: SomaDoParceiro): string {
  return s.semAcordo > 0 && s.semAcordo < s.pecas
    ? plural(s.semAcordo, 'peça sem acordo', 'peças sem acordo')
    : ''
}

/* ---------- o eixo do gráfico ---------------------------------------------- */

/** O degrau do eixo: três degraus cobrem o maior valor, em número redondo. É a
    mesma conta do gráfico da página do parceiro, na loja. */
export function degrauDoEixo(maior: number, minimo: number): number {
  if (!(maior > 0)) return minimo
  const bruto = maior / 3
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)))
  const fator = bruto / potencia
  const redondo = fator <= 1 ? 1 : fator <= 2 ? 2 : fator <= 5 ? 5 : 10
  return Math.max(minimo, redondo * potencia)
}

/** "0", "500", "2 mil", "1,5 mil". */
export function rotuloDoEixo(v: number, emDinheiro: boolean): string {
  if (!emDinheiro || v < 1000) return inteiro(v)
  return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
}
