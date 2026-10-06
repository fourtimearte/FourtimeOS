import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Scissors, UploadSimple } from '@phosphor-icons/react'
import { Botao, TituloCartao, avisar } from '@ds'
import { erroNoMolde, moldeComoImagem, type Parte } from '@dominio/produto'
import { lerArquivoDeTexto } from './apoio'

/* ==========================================================================
   O molde: o desenho em SVG, tirado do Affinity.

   O SVG É MOSTRADO COMO IMAGEM, e nunca colado dentro da página. Colado, o
   que estivesse escrito dentro dele rodaria com o acesso de quem está
   olhando; como imagem, o navegador só desenha. O arquivo ainda é conferido
   antes de subir (aqui) e antes de entrar (no banco).

   O DESENHO FICA SOBRE PAPEL BRANCO NOS DOIS TEMAS. O molde vem do Affinity
   com traço preto, e traço preto sobre o cartão do Grafite some.
   ========================================================================== */

/** O arquivo do molde chegando: pelo botão ou solto em cima da caixa. */
export function usarArquivoDoMolde(aoEscolher: (svg: string) => void) {
  const entrada = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)

  async function receber(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      const texto = (await lerArquivoDeTexto(arquivo)).trim()
      const erro = erroNoMolde(texto)
      if (erro) {
        avisar(erro, 'warn', 7)
        return
      }
      aoEscolher(texto)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui ler o arquivo.', 'warn')
    }
  }

  const campo = (
    <input
      ref={entrada}
      type="file"
      accept=".svg,image/svg+xml"
      hidden
      data-arquivo-do-molde=""
      onChange={e => {
        void receber(e.currentTarget.files?.[0])
        /* o mesmo arquivo escolhido de novo tem de avisar de novo */
        e.currentTarget.value = ''
      }}
    />
  )
  const zona = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setSobre(true)
    },
    onDragLeave: () => setSobre(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setSobre(false)
      void receber(e.dataTransfer.files[0])
    },
  }
  return { campo, abrir: () => entrada.current?.click(), zona, sobre }
}

/** O desenho do molde, sobre o papel. */
export function DesenhoDoMolde({ svg, nome }: { svg: string; nome: string }) {
  return (
    <div className="pd-molde-caixa">
      <img className="pd-molde" src={moldeComoImagem(svg)} alt={'Molde de ' + nome} />
    </div>
  )
}

/** A caixa que recebe o arquivo, para quem pode trocar o molde. */
export function SoltarOMolde({
  arquivo,
  baixa,
  texto = 'Solte aqui o SVG do molde, ou',
}: {
  arquivo: ReturnType<typeof usarArquivoDoMolde>
  /** a versão de uma linha, debaixo do desenho que já existe */
  baixa?: boolean
  texto?: string
}) {
  return (
    <div
      className={['pd-solta', baixa ? 'baixa' : '', arquivo.sobre ? 'sobre' : ''].filter(Boolean).join(' ')}
      {...arquivo.zona}
    >
      <UploadSimple size={20} aria-hidden="true" />
      <span>{texto}</span>
      <Botao tamanho="sm" onClick={arquivo.abrir}>
        Escolher o arquivo
      </Botao>
    </div>
  )
}

/** As partes do molde, em etiquetas: "Frente 1x", "Manga 2x". */
export function PartesDoMolde({ partes, acao }: { partes: Parte[]; acao?: ReactNode }) {
  if (!partes.length && !acao) return null
  return (
    <div className="pd-partes">
      {partes.map(p => (
        <span className="pd-tag" key={p.nome}>
          {p.nome} {p.vezes}x
        </span>
      ))}
      {acao}
    </div>
  )
}

/* O cartão do molde na ficha. Quem pode editar troca o arquivo daqui mesmo,
   sem abrir o editor: é a troca mais comum, e ela não mexe em mais nada. */
export function CartaoDoMolde({
  nome,
  svg,
  partes,
  podeEditar,
  enviando,
  aoTrocar,
}: {
  nome: string
  svg: string | null
  partes: Parte[]
  podeEditar: boolean
  enviando: boolean
  aoTrocar: (svg: string) => void
}) {
  const arquivo = usarArquivoDoMolde(aoTrocar)
  return (
    <section className="cartao pd-col" data-cartao="molde">
      <div className="pd-topo">
        <TituloCartao icone={Scissors}>Molde</TituloCartao>
        {podeEditar && svg ? (
          <Botao tamanho="sm" carregando={enviando} onClick={arquivo.abrir}>
            <UploadSimple size={14} aria-hidden="true" />
            Trocar o SVG
          </Botao>
        ) : null}
      </div>
      <div className="pd-corpo" {...(podeEditar && svg ? arquivo.zona : {})}>
        {svg ? (
          <DesenhoDoMolde svg={svg} nome={nome} />
        ) : podeEditar ? (
          <SoltarOMolde arquivo={arquivo} />
        ) : (
          <div className="pd-solta">
            <span>Esta peça ainda não tem o desenho do molde.</span>
          </div>
        )}
        <PartesDoMolde partes={partes} />
        <p className="pd-nota">
          O desenho é um SVG tirado do molde no Affinity. Trocar o arquivo troca o desenho aqui.
        </p>
        {podeEditar ? arquivo.campo : null}
      </div>
    </section>
  )
}
