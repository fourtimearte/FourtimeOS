import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import './folha.css'

/* ==========================================================================
   A folha A4.

   Peca compartilhada: a cotacao imprime nela hoje, a ficha de producao vai
   imprimir nela na fase 2. O que ela sabe fazer e uma coisa so, e e a mais
   chata de todas: dividir um monte de blocos em paginas de 297 mm sem cortar
   nenhum deles no meio.

   A PAGINACAO E MEDIDA, NAO ESTIMADA.
   Cada bloco e desenhado primeiro numa area invisivel do lado de fora, a
   altura de verdade e lida dali, e so entao os blocos sao distribuidos. Chutar
   altura por numero de linhas funciona ate o dia em que um nome de referencia
   quebra em duas linhas, e ai a ultima linha da folha some sem erro nenhum.

   O que ja custou caro uma vez, e esta escrito no relatorio do A4 no projeto:
   o rodape precisa nascer inteiro ANTES de qualquer bloco entrar. Quando ele
   nascia depois, crescia uns 30 px, espremia o corpo no mesmo tanto, e a
   ultima linha sumia dentro do overflow. A regua tem que existir inteira
   antes de alguem medir por ela.
   ========================================================================== */

/* A4 em pixels de tela, a 96 dpi: 210 mm = 793,7 px, 297 mm = 1122,5 px. */
export const LARGURA_DA_FOLHA = 794
export const ALTURA_DA_FOLHA = 1123

export type BlocoDaFolha = {
  id: string
  /** o que vai desenhado na folha */
  conteudo: ReactNode
  /** blocos com a mesma amarra nunca se separam em paginas diferentes */
  amarra?: string
}

/** Distribui os blocos em paginas, medindo cada um de verdade.

    `chave` e o que diz que o conteudo mudou de verdade. Sem ela a medicao
    rodaria a cada desenho, porque a lista de blocos e um array novo toda vez,
    e o React nunca pararia de remedir. */
export function usarPaginacao(blocos: BlocoDaFolha[], alturaUtil: number, chave: string) {
  const medidor = useRef<HTMLDivElement>(null)
  const [paginas, setPaginas] = useState<BlocoDaFolha[][]>([blocos])
  const [medido, setMedido] = useState(false)
  const ultima = useRef('')

  const marca = chave + '|' + alturaUtil

  useLayoutEffect(() => {
    if (ultima.current === marca) return
    const caixa = medidor.current
    if (!caixa) return
    const filhos = [...caixa.children] as HTMLElement[]
    if (filhos.length !== blocos.length) return

    const alturas = filhos.map((f) => f.getBoundingClientRect().height)
    const saida: BlocoDaFolha[][] = []
    let atual: BlocoDaFolha[] = []
    let soma = 0

    blocos.forEach((b, i) => {
      const h = alturas[i]
      /* bloco maior que a folha inteira nao tem como caber: ele vai sozinho
         numa pagina e transborda, o que e feio mas visivel. Sumir seria pior */
      if (atual.length && soma + h > alturaUtil) {
        saida.push(atual)
        atual = []
        soma = 0
      }
      atual.push(b)
      soma += h
    })
    if (atual.length) saida.push(atual)
    ultima.current = marca
    setPaginas(saida)
    setMedido(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca])

  return { medidor, paginas, medido }
}

/** A area invisivel onde os blocos sao desenhados para serem medidos. */
export function Medidor({
  aoMedir,
  blocos,
}: {
  aoMedir: RefObject<HTMLDivElement | null>
  blocos: BlocoDaFolha[]
}) {
  return (
    <div className="fl-medidor" ref={aoMedir} aria-hidden="true">
      {blocos.map((b) => (
        <div key={b.id}>{b.conteudo}</div>
      ))}
    </div>
  )
}

export function Folha({
  cabecalho,
  rodape,
  numero,
  de,
  children,
}: {
  cabecalho?: ReactNode
  rodape?: ReactNode
  numero: number
  de: number
  children: ReactNode
}) {
  return (
    <section className="fl">
      {cabecalho ? <header className="fl-topo">{cabecalho}</header> : null}
      <div className="fl-corpo">{children}</div>
      <footer className="fl-pe">
        {rodape}
        <span className="fl-num">
          página {numero} de {de}
        </span>
      </footer>
    </section>
  )
}

/* --- o palco: as folhas na tela, com zoom ------------------------------- */

export function Palco({ children }: { children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)

  /* a folha tem largura fixa em milimetros. Quando a tela e menor que ela, o
     jeito de nao empurrar a pagina para o lado e encolher o desenho, e nao
     apertar o documento: o que sai na impressora tem que ser o que se ve */
  useEffect(() => {
    const medir = () => {
      const largura = caixa.current?.clientWidth ?? LARGURA_DA_FOLHA
      setEscala(Math.min(1, largura / LARGURA_DA_FOLHA))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  return (
    <div className="fl-palco" ref={caixa}>
      <div
        className="fl-pilha"
        style={{ transform: 'scale(' + escala + ')', width: LARGURA_DA_FOLHA }}
      >
        {children}
      </div>
    </div>
  )
}

export function imprimir() {
  document.body.classList.add('imprimindo')
  const limpar = () => {
    document.body.classList.remove('imprimindo')
    window.removeEventListener('afterprint', limpar)
  }
  window.addEventListener('afterprint', limpar)
  window.print()
  /* navegador que nao dispara afterprint nao pode deixar a tela travada */
  setTimeout(limpar, 4000)
}
