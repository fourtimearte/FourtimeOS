/* Encolher a foto antes de subir.

   Uma foto tirada com a camera do tablet tem entre 4 e 8 MB e uns 4000 pixels
   de lado. Ela vai virar uma bolinha de 32 pixels no topo da tela. Subir o
   arquivo inteiro gastaria o plano, encheria o balde e deixaria toda tela
   esperando por uma imagem que ninguem vai ver do tamanho que ela tem.

   Corta no quadrado do meio e reduz, aqui no navegador, antes de mandar. O que
   sobe tem uns 20 KB. */

const QUALIDADE = 0.85

/* A foto do celular quase sempre vem com a orientacao guardada de lado, num
   pedaco de informacao separado da imagem (o EXIF). Desenhar no canvas sem
   olhar isso e como o rosto sai deitado, que e um defeito que aparece na
   primeira vez que alguem usa. createImageBitmap sabe respeitar; quando o
   navegador nao tiver, cai no caminho do <img>, que os navegadores atuais ja
   endireitam sozinhos. */
async function abrir(arquivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    return await new Promise<HTMLImageElement>((pronto, falhou) => {
      const url = URL.createObjectURL(arquivo)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        pronto(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        falhou(new Error('Não consegui abrir essa imagem.'))
      }
      img.src = url
    })
  }
}

export async function quadradoPequeno(arquivo: Blob, lado = 256): Promise<Blob> {
  const fonte = await abrir(arquivo)
  const larguraCrua = 'width' in fonte ? fonte.width : 0
  const alturaCrua = 'height' in fonte ? fonte.height : 0
  if (!larguraCrua || !alturaCrua) throw new Error('Não consegui abrir essa imagem.')

  /* o quadrado do meio: e onde o rosto costuma estar numa foto de pessoa */
  const corte = Math.min(larguraCrua, alturaCrua)
  const x = (larguraCrua - corte) / 2
  const y = (alturaCrua - corte) / 2

  const tela = document.createElement('canvas')
  tela.width = lado
  tela.height = lado
  const pincel = tela.getContext('2d')
  if (!pincel) throw new Error('Este navegador não consegue preparar a imagem.')
  pincel.imageSmoothingQuality = 'high'
  pincel.drawImage(fonte, x, y, corte, corte, 0, 0, lado, lado)
  if ('close' in fonte) fonte.close()

  const pedaco = await new Promise<Blob | null>((pronto) =>
    tela.toBlob(pronto, 'image/jpeg', QUALIDADE),
  )
  if (!pedaco) throw new Error('Não consegui preparar a imagem.')
  return pedaco
}
