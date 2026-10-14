import type { Bloco, FabricacaoDaPeca } from '@dominio/layout'
import { DETALHES, type ConstrucaoDoLayout } from '@dominio/produto'

/* ==========================================================================
   A FABRICAÇÃO DA PEÇA COM O QUE O LAYOUT TROCOU (14/10/2026).

   A ficha técnica diz como a peça é feita; o layout pode trocar qualquer
   campo só para ele (bloco.fabricacao, por código da peça), e tem duas
   escolhas rápidas: a gola de tecido ou de ribana, e a costura com trançador.
   Um lugar só faz a conta, e o editor, a folha A4 e quem mais mostrar a
   fabricação leem daqui: o que a tela mostra é o que sai no papel.
   ========================================================================== */

export type ChaveDaFabricacao = 'gola' | 'manga' | 'punho' | 'barra' | 'costura'

export type CampoDaFabricacao = {
  chave: ChaveDaFabricacao
  nome: string
  /** o texto que vale: o do layout, ou o da ficha */
  texto: string
  /** o texto da ficha, para o "voltar ao da ficha" */
  daFicha: string
  /** o layout trocou este campo (o texto ou a escolha rápida) */
  trocado: boolean
}

/** O texto da gola com a escolha rápida: "Redonda, gola de tecido". */
function golaCom(texto: string, de: FabricacaoDaPeca['gola']): string {
  if (!de) return texto
  const [cabeca, ...resto] = texto.split(',')
  const sobra = resto.join(',').trim()
  const fim = de === 'tecido' ? 'gola de tecido' : /ribana/i.test(sobra) ? sobra : 'gola de ribana'
  return cabeca.trim() ? `${cabeca.trim()}, ${fim}` : fim.charAt(0).toUpperCase() + fim.slice(1)
}

/** A costura com o trançador: "Overloque de 4 fios, com trançador". */
function costuraCom(texto: string, trancador: boolean | undefined): string {
  if (!trancador || /trançador/i.test(texto)) return texto
  return texto.trim() ? `${texto.trim()}, com trançador` : 'Com trançador'
}

/** Os cinco campos de uma peça, com o que o layout trocou por cima da ficha. */
export function camposDaFabricacao(
  detalhesDaFicha: Partial<Record<string, string>>,
  fab: FabricacaoDaPeca | undefined,
): CampoDaFabricacao[] {
  return DETALHES.map((d) => {
    const chave = d.chave as ChaveDaFabricacao
    const daFicha = (detalhesDaFicha[chave] ?? '').trim()
    const escrito = fab?.detalhes?.[chave]
    let texto = (escrito ?? daFicha).trim()
    let trocado = escrito != null
    if (chave === 'gola' && fab?.gola) {
      texto = golaCom(texto, fab.gola)
      trocado = true
    }
    if (chave === 'costura' && fab?.trancador) {
      texto = costuraCom(texto, true)
      trocado = true
    }
    return { chave, nome: d.nome, texto, daFicha, trocado }
  })
}

/** A construção lida da ficha, com os detalhes de cada peça já trocados pelo
    layout: é o que a folha A4 usa. */
export function construcaoDoLayout(c: ConstrucaoDoLayout, b: Bloco): ConstrucaoDoLayout {
  if (!b.fabricacao || !Object.keys(b.fabricacao).length) return c
  return {
    ...c,
    pecas: c.pecas.map((p) => {
      const fab = b.fabricacao?.[p.cod]
      if (!fab) return p
      const detalhes = { ...p.detalhes }
      for (const campo of camposDaFabricacao(p.detalhes, fab)) detalhes[campo.chave] = campo.texto
      return { ...p, detalhes }
    }),
  }
}

/** Troca uma parte da fabricação de uma peça no bloco; o que fica vazio sai. */
export function comFabricacao(b: Bloco, cod: string, troca: (f: FabricacaoDaPeca) => FabricacaoDaPeca): Bloco {
  const atual = b.fabricacao?.[cod] ?? {}
  const nova = troca({ ...atual, detalhes: { ...atual.detalhes } })
  const detalhes = Object.fromEntries(Object.entries(nova.detalhes ?? {}).filter(([, v]) => v != null))
  const limpa: FabricacaoDaPeca = {
    ...(Object.keys(detalhes).length ? { detalhes } : {}),
    ...(nova.gola ? { gola: nova.gola } : {}),
    ...(nova.trancador ? { trancador: true } : {}),
  }
  const resto = { ...(b.fabricacao ?? {}) }
  if (Object.keys(limpa).length) resto[cod] = limpa
  else delete resto[cod]
  return { ...b, fabricacao: Object.keys(resto).length ? resto : undefined }
}
