import { useRef, useState } from 'react'
import { avisar } from '@ds'
import './layout.css'

/* ==========================================================================
   A caixa de imagem, com o nome da arte.

   Tres jeitos de por a imagem, porque na fabrica cada um faz de um jeito:
   arrastar o arquivo, colar da area de transferencia (o mais usado: recorta a
   arte no Illustrator e cola aqui), ou clicar e escolher.

   O nome da arte fica COLADO na imagem, e nao num campo solto do formulario,
   porque e ele que liga o bloco ao arquivo de arte no servidor. Separado, ele
   some.

   A imagem vive como data URL dentro do proprio documento. Isso engorda o
   .cft, e e de proposito enquanto nao existe servidor de arquivo: um .cft
   mandado por e-mail tem que abrir com as imagens do outro lado.
   ========================================================================== */

const LIMITE = 3 * 1024 * 1024

export function CaixaDeImagem({
  imagem,
  arte,
  aoMudarImagem,
  aoMudarArte,
  leitura,
}: {
  imagem: string
  arte: string
  aoMudarImagem?: (dataUrl: string) => void
  aoMudarArte?: (nome: string) => void
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

      <label className="img-arte">
        <span className="lb">ARTE</span>
        {leitura ? (
          <span className="v">{arte || 'sem nome'}</span>
        ) : (
          <input
            value={arte}
            placeholder="nome do arquivo da arte"
            onChange={(e) => aoMudarArte?.(e.target.value)}
          />
        )}
      </label>

      {ampliada ? (
        <div className="img-lupa" role="presentation" onClick={() => setAmpliada(false)}>
          <img src={imagem} alt={arte || 'arte do produto'} />
        </div>
      ) : null}
    </div>
  )
}
