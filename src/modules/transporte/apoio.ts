import { formatarDinheiroExato } from '@shared'

/* As frases e as datas da página de Transporte. Tudo puro. */

export const MES_LONGO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const DIA_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export const dinheiro = (v: number) => formatarDinheiroExato(v)

/** O dinheiro sem os centavos quando eles são zero: cabe melhor no número grande. */
export function dinheiroCurto(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const chaveDoDia = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const diaEMes = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** "Hoje, sexta 23 de outubro", "Ontem, quinta 22 de outubro", "Quarta, 21 de outubro". */
export function diaPorExtenso(iso: string, hoje = new Date()): string {
  const d = new Date(iso)
  const meio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((meio(hoje) - meio(d)) / 86400000)
  const semana = DIA_DA_SEMANA[d.getDay()]
  const resto = `${d.getDate()} de ${MES_LONGO[d.getMonth()]}`
  if (dias === 0) return `Hoje, ${semana} ${resto}`
  if (dias === 1) return `Ontem, ${semana} ${resto}`
  return `${semana[0].toUpperCase()}${semana.slice(1)}, ${resto}`
}

/** "hoje às 14:10", "ontem às 09:30", "21/10 às 16:02". */
export function quandoFoi(iso: string, hoje = new Date()): string {
  const d = new Date(iso)
  const meio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((meio(hoje) - meio(d)) / 86400000)
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : diaEMes(iso)
  return `${quando} às ${hora(iso)}`
}

export const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

/** "2026-10" vira { ano: 2026, mes: 9 }. */
export function lerMes(chave: string): { ano: number; mes: number } {
  const [a, m] = chave.split('-').map(Number)
  return { ano: a, mes: m - 1 }
}
export const chaveDoMes = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, '0')}`

export function mesAnterior(chave: string): string {
  const { ano, mes } = lerMes(chave)
  return mes === 0 ? chaveDoMes(ano - 1, 11) : chaveDoMes(ano, mes - 1)
}

export function nomeDoMes(chave: string): string {
  const { ano, mes } = lerMes(chave)
  return `${MES_LONGO[mes][0].toUpperCase()}${MES_LONGO[mes].slice(1)} de ${ano}`
}

/** Os seis últimos meses, do atual para trás. */
export function ultimosMeses(hoje = new Date(), quantos = 6): string[] {
  const lista: string[] = []
  let ano = hoje.getFullYear()
  let mes = hoje.getMonth()
  for (let i = 0; i < quantos; i++) {
    lista.push(chaveDoMes(ano, mes))
    if (mes === 0) {
      ano -= 1
      mes = 11
    } else mes -= 1
  }
  return lista
}
