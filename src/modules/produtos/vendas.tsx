import { useCallback, useEffect, useState } from 'react'
import { ChipTecnica } from '@ds'
import { quandoFoi } from '@shared'
import {
  NOME_DA_TECNICA,
  TODOS_OS_TAMANHOS,
  carregarFatiasDosLayouts,
  carregarLayoutsVendidos,
  carregarPecasDosKits,
  codigoCurto,
  type FatiaDoLayout,
  type LayoutVendido,
  type PecasDosKits,
  type TecnicaDoKit,
} from '@dominio/produto'
import './vendas.css'

/* ==========================================================================
   O que o Movimento, as Estatísticas e as fichas dividem: a leitura dos
   layouts dos pedidos e as pecinhas que escrevem uma grade, as técnicas e um
   número de peças.

   A LEITURA É UMA SÓ, feita quando a página abre, e serve às quatro telas:
   a árvore (quanto cada peça vendeu no mês), a visão geral, o Movimento e as
   Estatísticas. Ela é apoio: se falhar, as fichas continuam de pé, e só o
   que depende de venda diz que não conseguiu ler.
   ========================================================================== */

export type Vendas = {
  layouts: LayoutVendido[]
  fatias: FatiaDoLayout[]
  kits: PecasDosKits
}

const dia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Lê os layouts de dois anos (o período de um ano compara com o ano anterior) e as fatias dos últimos meses. */
export function usarVendas(hoje: Date): { vendas: Vendas | null; erro: string; lendo: boolean; reler: () => void } {
  const [vendas, setVendas] = useState<Vendas | null>(null)
  const [erro, setErro] = useState('')
  const [lendo, setLendo] = useState(true)

  const ler = useCallback(async () => {
    setLendo(true)
    try {
      const [layouts, fatias, kits] = await Promise.all([
        carregarLayoutsVendidos(dia(new Date(hoje.getFullYear(), hoje.getMonth() - 23, 1))),
        /* o Movimento mostra quatro meses; um dia de folga cobre o fuso */
        carregarFatiasDosLayouts(dia(new Date(hoje.getFullYear(), hoje.getMonth() - 3, 0))),
        carregarPecasDosKits(),
      ])
      setVendas({ layouts, fatias, kits })
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler as vendas.')
    } finally {
      setLendo(false)
    }
  }, [hoje])

  useEffect(() => {
    void ler()
  }, [ler])

  return { vendas, erro, lendo, reler: () => void ler() }
}

/** 1.284, com o ponto do milhar. */
export const numero = (n: number) => Math.round(n).toLocaleString('pt-BR')

/** "412 pçs", "89 kits", "1 kit". */
export const emPecas = (n: number) => numero(n) + ' pçs'
export const emKits = (n: number) => numero(n) + (n === 1 ? ' kit' : ' kits')
export const emUnidades = (n: number, kit: boolean) => (kit ? emKits(n) : emPecas(n))

/** "hoje, 14:10", "ontem, 16:42", "02/10, 15:30". */
export const quandoFicou = (iso: string, hoje: Date) => (iso ? quandoFoi(iso, hoje).replace(' às ', ', ') : '')

/* Onde o layout está, na língua da fábrica. A preposição muda com o posto, e
   "na Corte" seria a tela falando errado. */
const NO_POSTO: Record<string, string> = {
  corte: 'no corte',
  subli: 'na impressão da sublimação',
  dtf: 'na impressão do DTF',
  prensa: 'na prensa do DTF',
  silk: 'no silk',
  bordado: 'no bordado',
  calandra: 'na calandra',
  futurize: 'na Futurize',
  conferencia: 'na conferência',
  'cd-costura': 'no Cd costura',
  costura: 'na costura',
  embalagem: 'na embalagem',
}
export const ondeEsta = (x: { pronto: boolean; etapa: string }) =>
  x.pronto ? 'pronto' : (NO_POSTO[x.etapa] ?? (x.etapa || 'na fábrica'))

/** O código que a tela mostra debaixo do nome: o curto da peça, ou os das peças do kit. */
export function codigosDe(l: LayoutVendido, kits: PecasDosKits): string {
  if (l.kit && l.referenciaId && kits[l.referenciaId]?.length) {
    return kits[l.referenciaId].map(p => codigoCurto(p.cod)).join(' + ')
  }
  if (l.referencia) return codigoCurto(l.referencia)
  return l.referenciaId ? '' : 'fora do catálogo'
}

/** A grade em linha: P 10 · M 32 · G 30, na ordem da fábrica. */
export function Gradinha({ grade }: { grade: Record<string, number> }) {
  const conhecidos = TODOS_OS_TAMANHOS.filter(t => (grade[t] ?? 0) > 0)
  const outros = Object.keys(grade)
    .filter(t => !TODOS_OS_TAMANHOS.includes(t) && grade[t] > 0)
    .sort()
  return (
    <span className="pd-gradinha">
      {[...conhecidos, ...outros].map(t => (
        <span key={t}>
          {t} <b>{numero(grade[t])}</b>
        </span>
      ))}
    </span>
  )
}

const ehTecnica = (t: string): t is TecnicaDoKit => t in NOME_DA_TECNICA

/** As técnicas de produção do layout, em pílulas. Peça lisa não tem nenhuma. */
export function Tecnicas({ tecnicas }: { tecnicas: string[] }) {
  const conhecidas = tecnicas.filter(ehTecnica)
  if (!conhecidas.length) return <span className="pd-apoio">sem design</span>
  return (
    <span className="pd-tecnicas">
      {conhecidas.map(t => (
        <ChipTecnica tecnica={t} key={t}>
          {NOME_DA_TECNICA[t]}
        </ChipTecnica>
      ))}
    </span>
  )
}

/** "Sublimação e Patch": as técnicas em palavras, para a linha de apoio. */
export function tecnicasEmPalavras(tecnicas: string[]): string {
  const nomes = Object.keys(NOME_DA_TECNICA)
    .filter(t => tecnicas.includes(t))
    .map(t => NOME_DA_TECNICA[t as TecnicaDoKit])
  if (nomes.length <= 1) return nomes[0] ?? ''
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]
}
