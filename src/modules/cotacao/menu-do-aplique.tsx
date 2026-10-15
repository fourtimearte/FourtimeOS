import type { RefObject } from 'react'
import { Minus, Plus } from '@phosphor-icons/react'
import { MenuDeContexto } from '@ds'
import type { Design } from '@dominio/layout'
import {
  TAMANHOS_DE_APLIQUE,
  TIPOS_DE_PATCH,
  comQuantidade,
  comTamanho,
  comTipoDePatch,
  type DaTecnica,
} from './design-do-layout'

/* ==========================================================================
   O BOTÃO DIREITO NO INTERRUPTOR DO BORDADO E DO PATCH, um só para a ficha
   do layout e para o lote da tabela.

   O bordado escolhe o tamanho: P, M ou G. O patch (16/10/2026, pedido do
   Henrique) escolhe o tipo, Liso, Relevo ou 3D, e quantos patches vão em
   cada peça. O preço a somar por patch vai morar na tabela de preço.
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
}: {
  t: DaTecnica | null
  ancora: RefObject<HTMLElement | null>
  aoFechar: () => void
  atual: AtualDoAplique
  /** aplica a mudança no design (de um layout ou de todos os marcados) */
  aplicar: (muda: (design: Design[]) => Design[]) => void
  /** o lote diz em quantos vale */
  nosMarcados?: number
}) {
  const onde = nosMarcados ? ' nos ' + nosMarcados + ' marcados' : ''
  const patch = t?.menu === 'patch'
  const itens = !t
    ? []
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
        t && patch ? (
          <div className="ct-qtd-patch" data-quantidade-de-patches>
            <span className="ct-qtd-patch-rot">Patches por peça</span>
            <button
              type="button"
              className="btn btn-contorno sm icone"
              aria-label="Um patch a menos"
              disabled={q === 1}
              onClick={() => aplicar(d => comQuantidade(d, t, (q ?? 2) - 1))}
            >
              <Minus size={14} weight="bold" />
            </button>
            <b className="ct-qtd-patch-n" aria-live="polite">
              {q ?? 'vários'}
            </b>
            <button
              type="button"
              className="btn btn-contorno sm icone"
              aria-label="Um patch a mais"
              disabled={q === 20}
              onClick={() => aplicar(d => comQuantidade(d, t, (q ?? 1) + 1))}
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
        ) : null
      }
    />
  )
}
