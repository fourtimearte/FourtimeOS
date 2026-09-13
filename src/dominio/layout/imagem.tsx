import { useRef, useState } from 'react'
import { avisar } from '@ds'
import './layout.css'

/* ==========================================================================
   A caixa de imagem, com o nome da arte.

   Tres jeitos de por a imagem, porque na fabrica cada um faz de um jeito:
   arrastar o arquivo, colar da area de transferencia (o mais usado: recorta a
   arte no Illustrator e cola aqui), ou clicar e escolher.

   O NOME DA ARTE NAO E UM CAMPO. Na v3.375 ele nunca foi digitado a mao: era
   um botao de lupa que procurava o arquivo da arte, e esse botao esta
   desligado la ate hoje. Aqui ele sai tambem, e volta quando a busca existir.
   O nome continua vivo no bloco (e ele que vai amarrar o layout ao arquivo no
   Drive), so nao tem mais campo para ser digitado.

   A imagem vive como data URL dentro do proprio documento. Isso engorda o
   .cft, e e de proposito enquanto nao existe servidor de arquivo: um .cft
   mandado por e-mail tem que abrir com as imagens do outro lado.
   ========================================================================== */

const LIMITE = 3 * 1024 * 1024

export function CaixaDeImagem({
  imagem,
  arte,
  aoMudarImagem,
  leitura,
}: {
  imagem: string
  /** o nome do arquivo da arte. Hoje so serve de texto alternativo da imagem */
  arte: string
  aoMudarImagem?: (dataUrl: string) => void
  leitura?: boolean
}) {
  const [sobre, setSobre] = useState(false)
  const [ampliada, setAmpliada] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  function ler(f: File | null | undefined) {
    if (!f || !aoMudarImagem) return
    if (!f.type.startsWith('image/')) {
      avisar('Isso não é uma imagem', 'warn')
      return
    }
    if (f.size > LIMITE) {
      avisar('Imagem acima de 3 MB. Salve em JPG antes de colar.', 'warn')
      return
    }
    const leitor = new FileReader()
    leitor.onload = () => aoMudarImagem(String(leitor.result))
    leitor.readAsDataURL(f)
  }

  return (
    <div className="img-caixa">
      <div
        className={['img-area', sobre ? 'sobre' : '', imagem ? 'tem' : ''].filter(Boolean).join(' ')}
        onDragOver={(e) => {
          if (leitura) return
          e.preventDefault()
          setSobre(true)
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          if (leitura) return
          e.preventDefault()
          setSobre(false)
          ler(e.dataTransfer.files?.[0])
        }}
        onPaste={(e) => {
          if (leitura) return
          /* DataTransferItemList nao e uma lista comum: nao da para espalhar
             nem usar find, so andar pelo indice */
          const itens = e.clipboardData.items
          for (let i = 0; i < itens.length; i++) {
            if (itens[i].type.startsWith('image/')) {
              ler(itens[i].getAsFile())
              break
            }
          }
        }}
        tabIndex={leitura ? -1 : 0}
        role={leitura ? undefined : 'button'}
        onClick={() => {
          if (leitura) setAmpliada(!!imagem)
          else if (imagem) setAmpliada(true)
          else arquivo.current?.click()
        }}
      >
        {imagem ? (
          <img src={imagem} alt={arte || 'arte do produto'} />
        ) : (
          <span className="img-convite">
            Arraste, cole ou clique
            <small>A arte aparece aqui do lado do tamanho e do valor</small>
          </span>
        )}
        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => ler(e.target.files?.[0])}
        />
      </div>

      {imagem && !leitura ? (
        <div className="img-acoes">
          <button type="button" className="img-bt" onClick={() => arquivo.current?.click()}>
            Trocar
          </button>
          <button type="button" className="img-bt risco" onClick={() => aoMudarImagem?.('')}>
            Remover
          </button>
        </div>
      ) : null}

      {ampliada ? (
        <div className="img-lupa" role="presentation" onClick={() => setAmpliada(false)}>
          <img src={imagem} alt={arte || 'arte do produto'} />
        </div>
      ) : null}
    </div>
  )
}
