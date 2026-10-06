import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ArrowsOut, Scissors, UploadSimple } from '@phosphor-icons/react'
import { Botao, TituloCartao, avisar, type IconeDoPacote } from '@ds'
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

/** O desenho do molde, sobre o papel. Com `aoAmpliar`, ele é um botão que abre a tela cheia. */
export function DesenhoDoMolde({
  svg,
  nome,
  rotulo = 'Molde',
  aoAmpliar,
}: {
  svg: string
  nome: string
  /** o que o desenho é, para o texto de quem não vê: "Molde", "Desenho do kit" */
  rotulo?: string
  aoAmpliar?: () => void
}) {
  const imagem = <img className="pd-molde" src={moldeComoImagem(svg)} alt={rotulo + ' de ' + nome} />
  return (
    <div className="pd-molde-caixa">
      {aoAmpliar ? (
        <button
          type="button"
          className="pd-molde-botao"
          data-ampliar-o-molde=""
          aria-label={'Abrir o molde de ' + nome + ' em tela cheia, com as medidas'}
          onClick={aoAmpliar}
        >
          {imagem}
          <span className="pd-molde-lupa" aria-hidden="true">
            <ArrowsOut size={14} />
            Tela cheia, com as medidas
          </span>
        </button>
      ) : (
        imagem
      )}
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
  titulo = 'Molde',
  icone = Scissors,
  nome,
  svg,
  partes,
  podeEditar,
  enviando,
  aoTrocar,
  vazio = 'Esta peça ainda não tem o desenho do molde.',
  soltar,
  nota = 'O desenho é um SVG tirado do molde no Affinity. Trocar o arquivo troca o desenho aqui.',
  aoAmpliar,
}: {
  /** o mesmo cartão serve ao desenho do kit, com outro título e outras frases */
  titulo?: string
  icone?: IconeDoPacote
  nome: string
  svg: string | null
  partes: Parte[]
  podeEditar: boolean
  enviando: boolean
  aoTrocar: (svg: string) => void
  vazio?: string
  soltar?: string
  nota?: string
  /** tocar no desenho abre a tela cheia com as medidas (só o molde da referência tem) */
  aoAmpliar?: () => void
}) {
  const arquivo = usarArquivoDoMolde(aoTrocar)
  return (
    <section className="cartao pd-col" data-cartao="molde">
      <div className="pd-topo">
        <TituloCartao icone={icone}>{titulo}</TituloCartao>
        {podeEditar && svg ? (
          <Botao tamanho="sm" carregando={enviando} onClick={arquivo.abrir}>
            <UploadSimple size={14} aria-hidden="true" />
            Trocar o SVG
          </Botao>
        ) : null}
      </div>
      <div className="pd-corpo" {...(podeEditar && svg ? arquivo.zona : {})}>
        {svg ? (
          <DesenhoDoMolde svg={svg} nome={nome} rotulo={titulo} aoAmpliar={aoAmpliar} />
        ) : podeEditar ? (
          <SoltarOMolde arquivo={arquivo} texto={soltar} />
        ) : (
          <div className="pd-solta">
            <span>{vazio}</span>
          </div>
        )}
        <PartesDoMolde partes={partes} />
        <p className="pd-nota">{nota}</p>
        {podeEditar ? arquivo.campo : null}
      </div>
    </section>
  )
}
