/* ==========================================================================
   O texto que cabe na forma.

   No desenho do depósito o nome fica SEMPRE dentro da forma dele (pedido do
   Henrique de 06/10/2026: os paletes tinham nome de tecido, "POLIAMIDA FUR C/
   ELASTANO", e o nome saía do quadrado e caía em cima do vizinho). O SVG não
   quebra linha sozinho, então a conta é feita aqui: quebrar o texto em linhas
   que cabem na largura e escolher a maior letra em que todas as linhas cabem
   na altura.

   Este arquivo não mede letra: quem mede é o navegador. Ele recebe a régua
   (`medir`), e por isso o teste roda sem navegador, com uma régua de mentira.

   A ORDEM DO QUE CEDE: primeiro a letra diminui, até a menor que ainda se lê;
   só depois o texto é cortado, com reticências, e quem chama fica sabendo
   (`cortado`) para pôr o nome inteiro na dica.
   ========================================================================== */

/** quanto mede o texto, em pixels, numa letra daquele tamanho */
export type Regua = (texto: string, fonte: number) => number

export type TextoQueCabe = {
  fonte: number
  linhas: string[]
  /** a linha mais comprida, em pixels */
  largura: number
  /** a altura das linhas juntas, em pixels */
  altura: number
  /** não coube nem na menor letra: a última linha termina em reticências */
  cortado: boolean
}

/** a altura de uma linha, em relação ao tamanho da letra */
export const ENTRELINHA = 1.16

/** os tamanhos de letra a tentar, do maior para o menor, de meio em meio pixel */
export function tamanhosDeLetra(maior: number, menor: number): number[] {
  const saida: number[] = []
  for (let f = maior; f > menor + 0.001; f -= 0.5) saida.push(Math.round(f * 2) / 2)
  saida.push(menor)
  return saida
}

/** corta a palavra que sozinha não cabe na largura: o pedaço que cabe, e o resto */
function partirPalavra(palavra: string, largura: number, fonte: number, medir: Regua): string[] {
  const pedacos: string[] = []
  let resto = palavra
  while (resto.length > 1 && medir(resto, fonte) > largura) {
    let n = resto.length - 1
    while (n > 1 && medir(resto.slice(0, n), fonte) > largura) n--
    pedacos.push(resto.slice(0, n))
    resto = resto.slice(n)
  }
  pedacos.push(resto)
  return pedacos
}

/* QUEBRAR EM LINHAS. A quebra é no espaço. Palavra que sozinha passa da
   largura é partida no meio: é feio, mas fica dentro da forma, e a letra menor
   é tentada antes disso por quem chama. */
export function quebrarEmLinhas(
  texto: string,
  largura: number,
  fonte: number,
  medir: Regua,
): string[] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let linha = ''
  for (const p of palavras) {
    const junto = linha ? linha + ' ' + p : p
    if (medir(junto, fonte) <= largura) {
      linha = junto
      continue
    }
    if (linha) linhas.push(linha)
    if (medir(p, fonte) <= largura) {
      linha = p
      continue
    }
    const pedacos = partirPalavra(p, largura, fonte, medir)
    linhas.push(...pedacos.slice(0, -1))
    linha = pedacos[pedacos.length - 1]
  }
  if (linha) linhas.push(linha)
  return linhas
}

/** alguma palavra precisou ser partida no meio para caber? */
export function partiuPalavra(texto: string, largura: number, fonte: number, medir: Regua): boolean {
  return texto
    .trim()
    .split(/\s+/)
    .some(p => medir(p, fonte) > largura)
}

function comReticencias(linha: string, largura: number, fonte: number, medir: Regua): string {
  let t = linha.replace(/\s+$/, '')
  while (t.length > 1 && medir(t + '…', fonte) > largura) t = t.slice(0, -1)
  return t + '…'
}

/* A MAIOR LETRA EM QUE O TEXTO CABE NA CAIXA.

   `cabe` é a pergunta a mais de quem chama: no palete o nome divide o
   quadrado com a referência, e a linha de cima do nome não pode cair em cima
   dela. Ela recebe as linhas e a letra, e devolve se serve.

   `semPartir` prefere a letra menor a partir uma palavra no meio: "AVIAMEN /
   TOS" só aparece quando nem na menor letra a palavra cabe inteira. */
export function caberNaCaixa(
  texto: string,
  opcoes: {
    largura: number
    altura: number
    /** do maior para o menor */
    fontes: number[]
    medir: Regua
    entrelinha?: number
    cabe?: (linhas: string[], fonte: number) => boolean
    semPartir?: boolean
  },
): TextoQueCabe {
  const { largura, altura, fontes, medir } = opcoes
  const entre = opcoes.entrelinha ?? ENTRELINHA
  const limpo = texto.trim().replace(/\s+/g, ' ')
  const menor = fontes[fontes.length - 1]
  const pronto = (fonte: number, linhas: string[], cortado: boolean): TextoQueCabe => ({
    fonte,
    linhas,
    largura: linhas.reduce((m, l) => Math.max(m, medir(l, fonte)), 0),
    altura: linhas.length * fonte * entre,
    cortado,
  })
  if (!limpo || largura <= 0 || altura <= 0) return pronto(menor, [], false)

  const tentar = (podePartir: boolean): TextoQueCabe | null => {
    for (const fonte of fontes) {
      if (!podePartir && partiuPalavra(limpo, largura, fonte, medir)) continue
      const linhas = quebrarEmLinhas(limpo, largura, fonte, medir)
      if (linhas.length * fonte * entre > altura + 0.01) continue
      if (opcoes.cabe && !opcoes.cabe(linhas, fonte)) continue
      return pronto(fonte, linhas, false)
    }
    return null
  }
  const achado = (opcoes.semPartir ? tentar(false) : null) ?? tentar(true)
  if (achado) return achado

  /* não coube nem na menor letra: ficam as linhas que cabem, e a última diz que há mais */
  const todas = quebrarEmLinhas(limpo, largura, menor, medir)
  let quantas = Math.max(1, Math.floor((altura + 0.01) / (menor * entre)))
  while (quantas > 1 && opcoes.cabe && !opcoes.cabe(todas.slice(0, quantas), menor)) quantas--
  if (todas.length <= quantas) return pronto(menor, todas, false)
  const ficam = todas.slice(0, quantas)
  ficam[quantas - 1] = comReticencias(ficam[quantas - 1], largura, menor, medir)
  return pronto(menor, ficam, true)
}
