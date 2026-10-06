import { useLayoutEffect, useState, type RefObject } from 'react'

export const plural = (n: number, um: string, muitos: string) => n + ' ' + (n === 1 ? um : muitos)

/** A largura de uma caixa, medida de novo cada vez que ela muda.

    A tabela por tamanho tem dez colunas. Numa caixa estreita ela não encolhe:
    ela DEITA, com um tamanho por linha. Isso é mudança de estrutura, e não de
    medida, e quem decide é a largura da caixa, e não a da janela: a mesma
    tabela vive na coluna larga do computador e na coluna de 360 px do tablet. */
export function usarLargura(ref: RefObject<HTMLElement | null>): number {
  const [largura, setLargura] = useState(0)
  /* antes de pintar, para a tabela não nascer em pé e deitar um instante depois */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setLargura(el.clientWidth)
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return largura
}

/** Abaixo disto a tabela por tamanho fica em pé: um tamanho por linha. */
export const LARGURA_DA_TABELA_DEITADA = 620

/** Lê um arquivo de texto escolhido pela pessoa. */
export function lerArquivoDeTexto(arquivo: File): Promise<string> {
  return new Promise((certo, errado) => {
    const leitor = new FileReader()
    leitor.onload = () => certo(typeof leitor.result === 'string' ? leitor.result : '')
    leitor.onerror = () => errado(new Error('Não consegui ler o arquivo.'))
    leitor.readAsText(arquivo)
  })
}
