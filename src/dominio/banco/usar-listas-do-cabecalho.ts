import { useEffect, useSyncExternalStore } from 'react'
import { tabela } from '@shared/supabase'
import { DEPARTAMENTOS, EMBALAGENS, ENTREGAS, PAGAMENTOS } from './dados'

/* ==========================================================================
   AS LISTAS DO CABEÇALHO DO ORÇAMENTO, LIDAS DO BANCO (lista_do_cabecalho,
   Configurações > Banco de dados > Cabeçalho).

   ATÉ 11/10/2026 o editor lia as listas fixas de dados.ts: o que se
   acrescentava, mudava ou desativava em Configurações não chegava nos Dados
   do pedido. Agora o menu mostra só as ATIVAS, na ordem do banco.

   O que já está gravado numa cotação e saiu da lista continua nela: quem
   abre a cotação vê o valor, e ele aparece no menu marcado como fora da
   lista. Apagar um item da lista não reescreve o que foi combinado com o
   cliente.

   Lidas a cada vez que o editor abre (o Banco de dados pode ter mudado na
   mesma visita), mas o menu nunca espera: enquanto a leitura não volta, ele
   usa o que já tinha, e na primeira vez as listas de partida de dados.ts.

   Vendedor não mora mais aqui: o vendedor é a pessoa (usar-vendedores).
   ========================================================================== */

export type ListasDoCabecalho = {
  pagamento: string[]
  entrega: string[]
  embalagem: string[]
  departamento: string[]
  /** 'codigo' enquanto o banco não respondeu: são as listas de partida */
  de: 'codigo' | 'banco'
}

const PARTIDA: ListasDoCabecalho = {
  pagamento: PAGAMENTOS,
  entrega: ENTREGAS,
  embalagem: EMBALAGENS,
  departamento: DEPARTAMENTOS,
  de: 'codigo',
}

type Linha = { tipo: string; valor: string; ordem: number; ativo: boolean }

let estado: ListasDoCabecalho = PARTIDA
let lendo: Promise<ListasDoCabecalho> | null = null
const ouvintes = new Set<() => void>()

/** lê de novo do banco; quem chama recebe as listas, e a tela se redesenha */
export function carregarListasDoCabecalho(): Promise<ListasDoCabecalho> {
  if (lendo) return lendo
  lendo = tabela<Linha[]>('lista_do_cabecalho?select=tipo,valor,ordem,ativo&ativo=is.true&order=ordem.asc,valor.asc')
    .then((linhas) => {
      const de = (t: string) => linhas.filter((l) => l.tipo === t).map((l) => l.valor)
      estado = { pagamento: de('pagamento'), entrega: de('entrega'), embalagem: de('embalagem'), departamento: de('departamento'), de: 'banco' }
      ouvintes.forEach((o) => o())
      return estado
    })
    .catch(() => estado)
    .finally(() => {
      lendo = null
    })
  return lendo
}

const assinar = (o: () => void) => {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}

/** as listas do cabeçalho; a cada montagem pede uma leitura nova ao banco */
export function usarListasDoCabecalho(): ListasDoCabecalho {
  useEffect(() => {
    void carregarListasDoCabecalho()
  }, [])
  return useSyncExternalStore(assinar, () => estado, () => estado)
}

/** o valor gravado entra na lista mesmo se saiu do banco, para não sumir do campo */
export function comOValorAtual(lista: string[], atual: string): { valor: string; rotulo: string }[] {
  const opcoes = lista.map((x) => ({ valor: x, rotulo: x }))
  if (atual && !lista.includes(atual)) opcoes.push({ valor: atual, rotulo: atual + ' (fora da lista)' })
  return opcoes
}
