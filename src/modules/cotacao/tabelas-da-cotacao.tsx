import { createContext, useContext, useEffect, useState } from 'react'
import { Seletor } from '@ds'
import { carregarKits } from '@dominio/produto'
import { carregarTabelasDePreco, tabelasParaEscolher, type OpcaoDeExtra, type TabelaDePreco } from '@dominio/preco'
import {
  SEM_TABELA,
  type Cotacao,
  type ProdutoCotado,
} from '@dominio/cotacao'

/* ==========================================================================
   AS TABELAS DE PREÇO DENTRO DO EDITOR (068, prancha 137).

   O editor lê as tabelas uma vez e passa por contexto: o cabeçalho escolhe a
   tabela da cotação, cada layout escolhe a dele, e a grade mostra de onde o
   preço veio. Antes da 068, a lista fica vazia e o cabeçalho volta para a
   lista de nomes de antes: nada quebra.
   ========================================================================== */

export type TabelasDaCotacao = {
  todas: TabelaDePreco[]
  /** as que esta pessoa pode escolher (ativas; a "só gerente" só para chefia) */
  escolhiveis: TabelaDePreco[]
  semBanco: boolean
  pecasDoKit: (codigo: string) => string[]
}

const VAZIO: TabelasDaCotacao = { todas: [], escolhiveis: [], semBanco: true, pecasDoKit: () => [] }

export const ContextoDasTabelas = createContext<TabelasDaCotacao>(VAZIO)

export function usarTabelasDaCotacao(): TabelasDaCotacao {
  return useContext(ContextoDasTabelas)
}

/* AS OPÇÕES DO PATCH E DO BORDADO, como a tabela de preço chama (aba
   Extras, 083): o tipo do patch e o tamanho do bordado que o botão direito
   oferece. Com vários layouts marcados em tabelas diferentes, a soma das
   opções, sem repetir id (o preço é achado pelo id, na tabela de cada um). */
export function opcoesDoAplique(todas: TabelaDePreco[], ids: string[], tecnica: 'patch' | 'bordado'): OpcaoDeExtra[] {
  const vistas = new Map<string, OpcaoDeExtra>()
  for (const id of new Set(ids)) {
    const ex = todas.find((t) => t.id === id)?.adicionais.extras.find((e) => e.tecnica === tecnica)
    for (const o of ex?.opcoes ?? []) if (o.id && o.nome && !vistas.has(o.id)) vistas.set(o.id, o)
  }
  return [...vistas.values()]
}

/** Lê as tabelas e as peças dos kits, uma vez por editor. */
export function usarCarregarTabelas(chefia: boolean): TabelasDaCotacao {
  const [valor, setValor] = useState<TabelasDaCotacao>(VAZIO)
  useEffect(() => {
    let vivo = true
    Promise.all([
      carregarTabelasDePreco().catch(() => ({ tabelas: [] as TabelaDePreco[], semBanco: true })),
      carregarKits().catch(() => []),
    ]).then(([r, kits]) => {
      if (!vivo) return
      const pecas = new Map(kits.map((k) => [k.cod, k.pecasCod]))
      setValor({
        todas: r.tabelas,
        escolhiveis: tabelasParaEscolher(r.tabelas, chefia),
        semBanco: r.semBanco,
        pecasDoKit: (c) => pecas.get(c) ?? [],
      })
    })
    return () => {
      vivo = false
    }
  }, [chefia])
  return valor
}

/* O PREÇO DESTE LAYOUT: segue a tabela da cotação, segue outra tabela, ou
   não segue tabela nenhuma (o preço é o escrito por alguém). O seletor mora no
   cabeçalho do cartão da grade, à esquerda de Adulta e Infantil (14/10/2026).
   A frase de onde o número veio e a nota da grade saíram a pedido (14/10). */
export function PrecoDoLayout({
  c,
  produto,
  travado,
  aoMudar,
  compacto,
}: {
  c: Cotacao
  produto: ProdutoCotado
  travado: boolean
  aoMudar: (tabelaId: string) => void
  /** na tabela do editor: sem o rótulo PREÇO e na altura de ação de linha */
  compacto?: boolean
}) {
  const { todas, escolhiveis, semBanco } = usarTabelasDaCotacao()
  if (semBanco || !todas.length || travado) return null
  const daCotacao = todas.find((t) => t.id === c.informe.tabelaDePrecoId)
  const valor = produto.tabelaId || ''
  const opcoes = [
    { valor: '', rotulo: 'Da cotação' + (daCotacao ? ` (${daCotacao.nome})` : ', sem tabela') },
    ...escolhiveis.filter((t) => t.id !== c.informe.tabelaDePrecoId).map((t) => ({ valor: t.id, rotulo: t.nome })),
    { valor: SEM_TABELA, rotulo: 'Sem tabela: o preço escrito' },
  ]
  /* a tabela escolhida antes pode ter sido arquivada: ela continua na lista
     enquanto o layout apontar para ela */
  const atual = todas.find((t) => t.id === valor)
  if (atual && !opcoes.some((o) => o.valor === valor)) opcoes.push({ valor, rotulo: atual.nome })
  return (
    <span className="ct-preco-do-layout">
      <Seletor
        rotulo={compacto ? undefined : 'PREÇO'}
        tamanho={compacto ? 'sm' : 'md'}
        valor={valor}
        vazio={opcoes[0].rotulo}
        opcoes={opcoes.slice(1)}
        aoEscolher={aoMudar}
      />
    </span>
  )
}
