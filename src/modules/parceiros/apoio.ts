import { formatarDinheiroExato } from '@shared'

/* As frases da página de Parceiros. Tudo puro. */

export const dinheiro = (v: number) => formatarDinheiroExato(v)

export const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)
