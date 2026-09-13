/* ==========================================================================
   A compressao da imagem do layout, portada da v3.375.

   Uma foto de celular tem de 3 a 8 MB. Em base64 ela entra no documento, nos
   cinquenta passos do historico e no arquivo salvo. Com vinte layouts isso
   vira dezenas de megas circulando a cada tecla digitada, e foi exatamente a
   causa da lentidao que a v3.316 foi consertar.

   As tres regras sao da v3.375 e nao sao chute:

     teto de 2560 px de altura   o dobro do que a impressao A4 exige
     WebP com qualidade 92       diferenca imperceptivel no olho
     so acima de 700 KB          quem ja chegou leve nao vale o esforco

   Nunca AUMENTA: uma arte pequena passa reta. E se a conversao engordar o
   arquivo, o que acontece com arte chapada de poucas cores, o original fica.
   ========================================================================== */

export const IMG_MAX_ALTURA = 2560
export const IMG_QUALIDADE = 0.92
export const IMG_LIMITE_BYTES = 700 * 1024

/* o tempo de guarda existe porque um arquivo corrompido pode nunca disparar
   nem onload nem onerror, e ali a promessa ficaria pendurada para sempre */
const TEMPO_LIMITE = 20000

/** o peso real, em bytes, por tras de um data URL em base64 */
export function pesoDoDataUrl(src: string): number {
  const i = String(src || '').indexOf(',')
  return i < 0 ? 0 : Math.round((src.length - i - 1) * 0.75)
}

export function jaEstaLeve(src: string): boolean {
  return pesoDoDataUrl(src) <= IMG_LIMITE_BYTES
}

let webp: boolean | null = null
function suportaWebp(): boolean {
  if (webp !== null) return webp
  try {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    webp = c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webp = false
  }
  return webp
}

export function comprimeImagem(src: string): Promise<string> {
  return new Promise((ok, erro) => {
    let fim = false
    const relogio = setTimeout(() => {
      if (fim) return
      fim = true
      erro(new Error('tempo esgotado'))
    }, TEMPO_LIMITE)
    const encerra =
      <T extends unknown[]>(fn: (...a: T) => void) =>
      (...a: T) => {
        if (fim) return
        fim = true
        clearTimeout(relogio)
        fn(...a)
      }
    const pronto = encerra(ok as (v: string) => void)
    const falhou = encerra(erro as (e: Error) => void)

    const im = new Image()
    im.onload = () => {
      try {
        const h = Math.min(IMG_MAX_ALTURA, im.naturalHeight)
        const w = Math.max(1, Math.round((im.naturalWidth * h) / im.naturalHeight))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const cx = c.getContext('2d')
        if (!cx) return falhou(new Error('sem canvas'))
        cx.imageSmoothingEnabled = true
        cx.imageSmoothingQuality = 'high'
        cx.drawImage(im, 0, 0, w, h)
        pronto(c.toDataURL(suportaWebp() ? 'image/webp' : 'image/jpeg', IMG_QUALIDADE))
      } catch (e) {
        falhou(e instanceof Error ? e : new Error('falhou'))
      }
    }
    im.onerror = () => falhou(new Error('imagem inválida'))
    im.src = src
  })
}

/* A porta de entrada: devolve a imagem pronta para guardar. Quem chama nao
   precisa saber de nada disto, so dar await. */
export async function prepararImagem(src: string): Promise<string> {
  if (!/^data:image\//.test(src)) return src
  if (jaEstaLeve(src)) return src
  try {
    const nova = await comprimeImagem(src)
    /* so troca se realmente encolheu: arte chapada de poucas cores incha em
       WebP, e devolver a versao maior seria o contrario do objetivo */
    return nova && nova.length < src.length ? nova : src
  } catch {
    return src
  }
}
