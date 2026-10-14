import { createContext, useContext, useEffect, useState } from 'react'
import { Seletor } from '@ds'
import { carregarKits } from '@dominio/produto'
import { carregarTabelasDePreco, tabelasParaEscolher, type TabelaDePreco } from '@dominio/preco'
import {
  SEM_TABELA,
  origemDoPreco,
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
   cabeçalho do cartão da grade, à esquerda de Adulta e Infantil (14/10/2026);
   a frase de onde o número veio fica embaixo da grade (OrigemDoPreco). */
export function PrecoDoLayout({
  c,
  produto,
  travado,
  aoMudar,
}: {
  c: Cotacao
  produto: ProdutoCotado
  travado: boolean
  aoMudar: (tabelaId: string) => void
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
      <Seletor rotulo="PREÇO" valor={valor} vazio={opcoes[0].rotulo} opcoes={opcoes.slice(1)} aoEscolher={aoMudar} />
    </span>
  )
}

/** A frase de onde o preço do layout veio, embaixo da grade. */
export function OrigemDoPreco({ c, produto }: { c: Cotacao; produto: ProdutoCotado }) {
  const { todas, semBanco } = usarTabelasDaCotacao()
  if (semBanco || !todas.length) return null
  const valor = produto.tabelaId || ''
  const origem = origemDoPreco(c, produto, todas)
  return (
    <p className="ct-preco-origem">
      {origem
        ? `Valores da ${origem.tabela}, faixa ${origem.faixa} peças`
        : valor === SEM_TABELA
          ? 'O preço é o escrito na grade'
          : produto.bloco.referencia.trim()
            ? 'Esta referência não está na tabela: o preço é o escrito na grade'
            : 'Sem referência: o preço é o escrito na grade'}
    </p>
  )
}
