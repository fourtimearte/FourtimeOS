import { useEffect, useRef, useState } from 'react'
import { VisorDeImagem, avisar } from '@ds'
import { IMG_LIMITE_BYTES, pesoDoDataUrl, prepararImagem } from './compressao'
import './layout.css'

/* ==========================================================================
   A caixa de imagem do layout.

   Quatro jeitos de por a arte, porque na fabrica cada um faz de um jeito:
   arrastar o arquivo, colar com Ctrl+V, clicar e escolher, ou colar com a
   caixa nem sequer focada, que e o gesto mais usado de todos. Quem recorta a
   arte no Illustrator volta para o navegador e aperta Ctrl+V sem clicar em
   nada primeiro: por isso o colar tambem escuta a janela enquanto o ponteiro
   estiver sobre a caixa.

   O NOME DA ARTE NAO E UM CAMPO. Na v3.375 ele nunca foi digitado a mao: era
   um botao de lupa que procurava o arquivo da arte, e esse botao esta
   desligado la ate hoje. Aqui ele sai tambem, e volta quando a busca existir.
   O nome continua vivo no bloco (e ele que vai amarrar o layout ao arquivo no
   Drive), so nao tem mais campo para ser digitado.

   TODA IMAGEM PASSA PELA COMPRESSAO ANTES DE SER GUARDADA. Ver compressao.ts
   para o porque: em base64 uma foto de celular circula inteira a cada tecla
   digitada, e com vinte layouts isso e o que travava o editor.

   A imagem vive como data URL dentro do proprio documento. Isso engorda o
   arquivo, e e de proposito enquanto nao existe a ponte com o Drive: um
   arquivo mandado por e-mail tem que abrir com as imagens do outro lado.
   ========================================================================== */

/* o teto de entrada e generoso porque a compressao vem logo depois: o que
   interessa barrar e o arquivo que o navegador nem conseguiria ler */
const LIMITE = 24 * 1024 * 1024

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
  /* A PREVIA E LOCAL DE PROPOSITO. A versao pesada aparece na tela na hora,
     mas NAO entra no documento: so a leve e guardada. Guardar as duas daria
     dois passos de historico para uma colagem so, e o Ctrl+Z devolveria a
     foto de oito megas que a compressao acabou de tirar da frente. */
  const [previa, setPrevia] = useState('')
  const arquivo = useRef<HTMLInputElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const dentro = useRef(false)

  async function guardar(dataUrl: string) {
    if (!aoMudarImagem) return
    if (pesoDoDataUrl(dataUrl) <= IMG_LIMITE_BYTES) {
      aoMudarImagem(dataUrl)
      return
    }
    setPrevia(dataUrl)
    const leve = await prepararImagem(dataUrl)
    aoMudarImagem(leve)
    setPrevia('')
  }

  const naTela = previa || imagem

  function ler(f: File | null | undefined) {
    if (!f || !aoMudarImagem) return
    if (!f.type.startsWith('image/')) {
      avisar('Isso não é uma imagem', 'warn')
      return
    }
    if (f.size > LIMITE) {
      avisar('Imagem acima de 24 MB. Salve em JPG antes de colar.', 'warn')
      return
    }
    const leitor = new FileReader()
    leitor.onload = () => guardar(String(leitor.result))
    leitor.readAsDataURL(f)
  }

  function daAreaDeTransferencia(dados: DataTransfer | null) {
    if (!dados) return false
    /* DataTransferItemList nao e uma lista comum: nao da para espalhar nem
       usar find, so andar pelo indice */
    const itens = dados.items
    for (let i = 0; i < itens.length; i++) {
      if (itens[i].type.startsWith('image/')) {
        ler(itens[i].getAsFile())
        return true
      }
    }
    return false
  }

  /* COLAR SEM TER CLICADO NA CAIXA. O onPaste do elemento so dispara quando o
     foco esta nele, e ninguem clica antes de apertar Ctrl+V. Enquanto o
     ponteiro estiver sobre a caixa, ela e a dona do colar. */
  useEffect(() => {
    if (leitura || !aoMudarImagem) return
    const naColagem = (e: ClipboardEvent) => {
      if (!dentro.current) return
      const alvo = document.activeElement
      /* quem esta digitando num campo esta colando texto, e nao arte */
      if (alvo instanceof HTMLElement && alvo.closest('input, textarea, [contenteditable="true"]')) {
        return
      }
      if (daAreaDeTransferencia(e.clipboardData)) e.preventDefault()
    }
    document.addEventListener('paste', naColagem)
    return () => document.removeEventListener('paste', naColagem)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [leitura, aoMudarImagem])

  return (
    <div className="img-caixa">
      <div
        ref={area}
        className={['img-area', sobre ? 'sobre' : '', naTela ? 'tem' : '', leitura ? 'lendo' : '']
          .filter(Boolean)
          .join(' ')}
        onPointerEnter={() => (dentro.current = true)}
        onPointerLeave={() => (dentro.current = false)}
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
          if (daAreaDeTransferencia(e.clipboardData)) e.preventDefault()
        }}
        tabIndex={leitura ? -1 : 0}
        role={leitura ? undefined : 'button'}
        onClick={() => {
          if (naTela) setAmpliada(true)
          else if (!leitura) arquivo.current?.click()
        }}
      >
        {naTela ? (
          <img src={naTela} alt={arte || 'arte do produto'} />
        ) : leitura ? (
          /* EM LEITURA O CONVITE NÃO VALE. "Arraste, cole ou clique" numa
             folha impressa é uma instrução para alguém que está segurando
             papel: o que a fábrica precisa saber ali é que a arte falta. */
          <span className="img-sem">sem imagem</span>
        ) : (
          <span className="img-convite">
            Arraste, cole ou clique
            <small>A arte aparece aqui do lado do tamanho e do valor</small>
          </span>
        )}
        {previa ? <span className="img-tratando">aliviando a imagem...</span> : null}
        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => ler(e.target.files?.[0])}
        />
      </div>

      {naTela && !leitura ? (
        <div className="img-acoes">
          <button type="button" className="img-bt" onClick={() => arquivo.current?.click()}>
            Trocar
          </button>
          <button type="button" className="img-bt risco" onClick={() => aoMudarImagem?.('')}>
            Remover
          </button>
        </div>
      ) : null}

      {ampliada && naTela ? (
        <VisorDeImagem src={naTela} nome={arte || 'arte'} aoFechar={() => setAmpliada(false)} />
      ) : null}
    </div>
  )
}
