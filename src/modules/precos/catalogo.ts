import { useEffect, useState } from 'react'
import {
  carregarKits,
  carregarReferencias,
  type GrupoDeReferencia,
  type KitNaLista,
  type ReferenciaNaFicha,
} from '@dominio/produto'
import type { Contexto, ItemDaTabela, TabelaDePreco } from '@dominio/preco'

/** uma linha da grade: o item da tabela com o nome e o grupo da ficha técnica */
export type LinhaDaGrade = {
  item: ItemDaTabela
  nome: string
  sub: string
  grupo: string
  grupoCod: string
}

/* ==========================================================================
   O CATÁLOGO: as referências e os kits da ficha técnica, que é de onde a
   tabela tira o código, o nome e o grupo de cada item. A tabela guarda só o
   código: renomear a peça na ficha técnica renomeia na tabela também.
   ========================================================================== */

export type Catalogo = {
  grupos: GrupoDeReferencia[]
  referencias: ReferenciaNaFicha[]
  kits: KitNaLista[]
}

const VAZIO: Catalogo = { grupos: [], referencias: [], kits: [] }

const NOME_DO_GENERO: Record<string, string> = {
  M: 'Masculina',
  F: 'Feminina',
  C: 'Infantil',
  U: 'Unissex',
}

export function usarCatalogo(): { catalogo: Catalogo; lendo: boolean } {
  const [catalogo, setCatalogo] = useState<Catalogo>(VAZIO)
  const [lendo, setLendo] = useState(true)
  useEffect(() => {
    let vivo = true
    Promise.all([carregarReferencias().catch(() => ({ grupos: [], referencias: [] })), carregarKits().catch(() => [])])
      .then(([r, kits]) => vivo && setCatalogo({ grupos: r.grupos, referencias: r.referencias, kits }))
      .finally(() => vivo && setLendo(false))
    return () => {
      vivo = false
    }
  }, [])
  return { catalogo, lendo }
}

export function contextoDe(tabela: TabelaDePreco, catalogo: Catalogo): Contexto {
  return {
    achar: (c) => tabela.itens.find((i) => i.codigo === c),
    pecasDoKit: (c) => catalogo.kits.find((k) => k.cod === c)?.pecasCod ?? [],
  }
}

/* A linha de cada item, na ordem do catálogo: os grupos da ficha técnica, e
   os kits por último. Código que saiu do catálogo continua, em "Fora do
   catálogo", para ninguém perder um preço sem ver. */
export function linhasDe(tabela: TabelaDePreco, catalogo: Catalogo): LinhaDaGrade[] {
  const nomeDoGrupo = (cod: string | null) =>
    catalogo.grupos.find((g) => g.cod === cod)?.nome ?? (cod || 'Sem grupo')
  const ordemDoGrupo = (cod: string | null) => catalogo.grupos.find((g) => g.cod === cod)?.ordem ?? 999
  const linhas = tabela.itens.map((item): LinhaDaGrade & { ordem: number } => {
    if (item.tipo === 'kit') {
      const k = catalogo.kits.find((x) => x.cod === item.codigo)
      return {
        item,
        nome: k?.nome ?? item.codigo,
        sub: k ? k.pecasCod.join(' + ') + (item.base == null ? ' · soma das peças' : '') : 'fora do catálogo',
        grupo: k ? 'Kits' : 'Fora do catálogo',
        grupoCod: k ? 'KIT' : '',
        ordem: k ? 1000 : 2000,
      }
    }
    const r = catalogo.referencias.find((x) => x.cod === item.codigo)
    return {
      item,
      nome: r?.nome ?? item.codigo,
      sub: r ? NOME_DO_GENERO[r.genero] ?? '' : 'fora do catálogo',
      grupo: r ? nomeDoGrupo(r.grupo) : 'Fora do catálogo',
      grupoCod: r ? (r.grupo ?? '') : '',
      ordem: r ? ordemDoGrupo(r.grupo) : 2000,
    }
  })
  return linhas
    .sort((a, b) => a.ordem - b.ordem || a.grupo.localeCompare(b.grupo) || a.item.codigo.localeCompare(b.item.codigo))
    .map((l) => ({ item: l.item, nome: l.nome, sub: l.sub, grupo: l.grupo, grupoCod: l.grupoCod }))
}

/** O que ainda pode entrar na tabela: referências e kits que ela não tem. */
export function foraDaTabela(tabela: TabelaDePreco, catalogo: Catalogo): { valor: string; rotulo: string }[] {
  const tem = new Set(tabela.itens.map((i) => i.codigo))
  return [
    ...catalogo.referencias.filter((r) => !tem.has(r.cod)).map((r) => ({ valor: 'r:' + r.cod, rotulo: r.cod + ' · ' + r.nome })),
    ...catalogo.kits.filter((k) => !tem.has(k.cod)).map((k) => ({ valor: 'k:' + k.cod, rotulo: k.cod + ' · ' + k.nome + ' (kit)' })),
  ]
}

export function itemNovo(valor: string, faixas: number): ItemDaTabela {
  const tipo = valor.startsWith('k:') ? 'kit' : 'referencia'
  return { codigo: valor.slice(2), tipo, base: null, precos: Array.from({ length: faixas }, () => null) }
}

/* --- O CATÁLOGO AGRUPADO (pranchas 140 e 142) -------------------------------
   Os grupos da ficha técnica, na ordem dela, cada um com o código na caixa
   (010, 020...), e os kits por último, no grupo KIT. A referência do grupo
   KIT é o próprio kit (vem de catalogo.kits), e não entra duas vezes. A
   referência desligada só aparece se já estiver na tabela. */
export type PecaDoCatalogo = { codigo: string; tipo: 'referencia' | 'kit'; nome: string; sub: string }
export type GrupoDoCatalogo = { cod: string; nome: string; pecas: PecaDoCatalogo[] }

export function gruposDoCatalogo(catalogo: Catalogo, naTabela: Set<string> = new Set()): GrupoDoCatalogo[] {
  const grupos = [...catalogo.grupos].filter((g) => g.cod !== 'KIT').sort((a, b) => a.ordem - b.ordem)
  const refs = catalogo.referencias.filter((r) => r.grupo !== 'KIT' && (r.ativo || naTabela.has(r.cod)) && r.cod)
  const peca = (r: (typeof refs)[number]): PecaDoCatalogo => ({
    codigo: r.cod,
    tipo: 'referencia',
    nome: r.nome,
    sub: NOME_DO_GENERO[r.genero] ?? '',
  })
  const out: GrupoDoCatalogo[] = grupos
    .map((g) => ({ cod: g.cod, nome: g.nome, pecas: refs.filter((r) => r.grupo === g.cod).sort((a, b) => a.ordem - b.ordem || a.cod.localeCompare(b.cod)).map(peca) }))
    .filter((g) => g.pecas.length)
  const semGrupo = refs.filter((r) => !r.grupo || !grupos.some((g) => g.cod === r.grupo))
  if (semGrupo.length) out.push({ cod: 'sem', nome: 'Sem grupo', pecas: semGrupo.map(peca) })
  const kits = catalogo.kits.filter((k) => k.ativo || naTabela.has(k.cod))
  if (kits.length)
    out.push({
      cod: 'KIT',
      nome: 'Kits',
      pecas: kits.map((k) => ({ codigo: k.cod, tipo: 'kit', nome: k.nome, sub: k.pecasCod.join(' + ') })),
    })
  return out
}

/** A busca acha pelo código (com ou sem FT-), pelo nome e pelo grupo. */
export function achaNaBusca(busca: string, ...partes: string[]): boolean {
  const b = semAcentoNem(busca)
  if (!b) return true
  const alvo = semAcentoNem(partes.join(' '))
  return b.split(' ').every((pedaco) => alvo.includes(pedaco))
}

function semAcentoNem(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
