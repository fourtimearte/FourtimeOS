import type { RefObject } from 'react'
import { MenuDeContexto, Passo } from '@ds'
import type { Design } from '@dominio/layout'
import {
  TAMANHOS_DE_APLIQUE,
  TIPOS_DE_PATCH,
  comOpcaoDoAplique,
  comQuantidade,
  comTamanho,
  comTipoDePatch,
  type DaTecnica,
} from './design-do-layout'
import { opcoesDoAplique, usarTabelasDaCotacao } from './tabelas-da-cotacao'

/* ==========================================================================
   O BOTÃO DIREITO NO INTERRUPTOR DO BORDADO E DO PATCH, um só para a ficha
   do layout e para o lote da tabela.

   O bordado escolhe o tamanho: P, M ou G. O patch (16/10/2026, pedido do
   Henrique) escolhe o tipo, Liso, Relevo ou 3D. Os dois escolhem quantos vão
   em cada peça (o Passo do Design System); o preço de cada um mora na aba
   Extras da tabela de preço (083).

   AS OPÇÕES SÃO AS DA TABELA (23/10/2026, pedido do Henrique): o menu lista
   o que a aba Extras da tabela de preço do layout tem, com o nome e a medida
   de lá, e não mais a lista fixa. Uma opção nova criada na tabela aparece
   aqui sem mexer em código, e o que se escolhe é o id que a conta procura.
   Sem tabela no layout (ou sem opção nela), vale a lista fixa de antes.
   ========================================================================== */

export type AtualDoAplique = {
  tamanho: string
  tipo: string
  /** null quando os marcados do lote têm quantidades diferentes */
  quantidade: number | null
}

export function MenuDoAplique({
  t,
  ancora,
  aoFechar,
  atual,
  aplicar,
  nosMarcados,
  tabelas,
}: {
  t: DaTecnica | null
  ancora: RefObject<HTMLElement | null>
  aoFechar: () => void
  atual: AtualDoAplique
  /** aplica a mudança no design (de um layout ou de todos os marcados) */
  aplicar: (muda: (design: Design[]) => Design[]) => void
  /** o lote diz em quantos vale */
  nosMarcados?: number
  /** as tabelas de preço dos layouts que o menu muda (uma na ficha, as dos marcados no lote) */
  tabelas?: string[]
}) {
  const { todas } = usarTabelasDaCotacao()
  const onde = nosMarcados ? ' nos ' + nosMarcados + ' marcados' : ''
  const patch = t?.menu === 'patch'
  const daTabela = t ? opcoesDoAplique(todas, tabelas ?? [], patch ? 'patch' : 'bordado') : []
  const escolhido = patch ? atual.tipo : atual.tamanho
  const itens = !t
    ? []
    : daTabela.length
      ? [
          ...daTabela.map(o => ({
            rotulo: o.medida ? `${o.nome}  ${o.medida}` : o.nome,
            on: escolhido === o.id,
            aoEscolher: () => aplicar(d => comOpcaoDoAplique(d, t, o.id, o.nome)),
          })),
          ...(escolhido || nosMarcados
            ? [
                {
                  rotulo: patch ? 'Sem tipo' : 'Sem tamanho',
                  aoEscolher: () => aplicar(d => (patch ? comTipoDePatch(d, t, '') : comTamanho(d, t, ''))),
                },
              ]
            : []),
        ]
      : patch
        ? [
            ...TIPOS_DE_PATCH.map(x => ({
              rotulo: x.nome,
              on: atual.tipo === x.valor,
              aoEscolher: () => aplicar(d => comTipoDePatch(d, t, x.valor)),
            })),
            ...(atual.tipo || nosMarcados
              ? [{ rotulo: 'Sem tipo', aoEscolher: () => aplicar(d => comTipoDePatch(d, t, '')) }]
              : []),
          ]
        : [
            ...TAMANHOS_DE_APLIQUE.map(x => ({
              rotulo: `${x.valor}  ${x.nome}`,
              on: atual.tamanho === x.valor,
              aoEscolher: () => aplicar(d => comTamanho(d, t, x.valor)),
            })),
            ...(atual.tamanho || nosMarcados
              ? [{ rotulo: 'Sem tamanho', aoEscolher: () => aplicar(d => comTamanho(d, t, '')) }]
              : []),
          ]
  const q = atual.quantidade
  return (
    <MenuDeContexto
      aberto={!!t}
      ancora={ancora}
      aoFechar={aoFechar}
      cabecalho={t ? (patch ? 'Tipo do patch' : 'Tamanho do ' + t.rotulo.toLowerCase()) + onde : null}
      itens={itens}
      extra={
        t ? (
          <div className="ct-qtd-patch" data-quantidade-de-patches>
            <span className="ct-qtd-patch-rot">{patch ? 'Patches por peça' : 'Bordados por peça'}</span>
            <Passo
              valor={q}
              rotulo={patch ? 'patches por peça' : 'bordados por peça'}
              aoMudar={n => aplicar(d => comQuantidade(d, t, n))}
            />
          </div>
        ) : null
      }
    />
  )
}
