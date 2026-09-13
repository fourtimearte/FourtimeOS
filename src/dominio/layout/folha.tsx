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
/**
 * @param maximo quantos blocos cabem numa folha, no maximo, mesmo que a
 *   altura permitisse mais. A cotacao usa 2: dois layouts por folha e uma
 *   regra que o vendedor decora, em vez de um numero que muda a cada foto
 *   colada. Sem ele, a altura sozinha decide, que e o que a ficha quer.
 */
export function usarPaginacao(
  blocos: BlocoDaFolha[],
  alturaUtil: number,
  chave: string,
  maximo = Infinity,
) {
  const medidor = useRef<HTMLDivElement>(null)
  const [paginas, setPaginas] = useState<BlocoDaFolha[][]>([blocos])
  const [medido, setMedido] = useState(false)
  const ultima = useRef('')
  /* o contador existe so para pedir um desenho novo quando o medidor muda de
     tamanho sozinho, sem o React ter mexido em nada. Ver o observador abaixo.
     O valor dele nao e lido em lugar nenhum: o que importa e a re-renderizacao
     que ele provoca, e e por isso que ele nao entra em nenhuma conta. */
  const [, setTique] = useState(0)

  const marca = chave + '|' + alturaUtil + '|' + maximo

  /* A IMAGEM CHEGA DEPOIS. Esta foi a armadilha mais cara desta parte: a
     medicao roda no primeiro desenho, e nesse instante as imagens do
     documento ainda nao foram decodificadas, entao cada bloco mede a altura
     que tem SEM a arte. A conta da pagina saia certa para um documento que
     nao existe, e ninguem percebia, porque quando a folha aparecia na tela ela
     ja estava com as imagens e com a divisao errada congelada.

     Decodificar uma imagem nao e um evento do React: nenhuma re-renderizacao
     acontece, e sem isto a medicao nunca seria refeita. O observador avisa. */
  useEffect(() => {
    const caixa = medidor.current
    if (!caixa || typeof ResizeObserver === 'undefined') return
    const olho = new ResizeObserver(() => setTique((t) => t + 1))
    for (const filho of [...caixa.children]) olho.observe(filho)
    return () => olho.disconnect()
  }, [blocos.length])

  /* SEM LISTA DE DEPENDENCIAS, de proposito. Quem decide se ha trabalho a
     fazer e a ASSINATURA: a marca mais as alturas medidas agora. Enquanto ela
     nao muda, o efeito sai sem tocar em estado nenhum, entao rodar a cada
     desenho nao custa nem gera laco. Uma lista de dependencias aqui teria que
     adivinhar quando uma imagem terminou de carregar, que e justamente o que
     nao da para adivinhar. */
  useLayoutEffect(() => {
    const caixa = medidor.current
    if (!caixa) return
    const filhos = [...caixa.children] as HTMLElement[]
    if (filhos.length !== blocos.length) return

    const alturas = filhos.map((f) => f.getBoundingClientRect().height)
    const assinatura = marca + '|' + alturas.map((h) => Math.round(h)).join(',')
    if (ultima.current === assinatura) return

    const saida: BlocoDaFolha[][] = []
    let atual: BlocoDaFolha[] = []
    let soma = 0

    blocos.forEach((b, i) => {
      const h = alturas[i]
      /* bloco maior que a folha inteira nao tem como caber: ele vai sozinho
         numa pagina e transborda, o que e feio mas visivel. Sumir seria pior */
      if (atual.length && (soma + h > alturaUtil || atual.length >= maximo)) {
        saida.push(atual)
        atual = []
        soma = 0
      }
      atual.push(b)
      soma += h
    })
    if (atual.length) saida.push(atual)
    ultima.current = assinatura
    setPaginas(saida)
    setMedido(true)
  })

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
    <div className="fl-medidor papel" ref={aoMedir} aria-hidden="true">
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
    <section className="fl papel">
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
  const pilha = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const [altura, setAltura] = useState<number | undefined>(undefined)
  const [recuo, setRecuo] = useState(0)

  /* A folha tem largura fixa em milimetros. Quando a tela e menor que ela, o
     jeito de nao empurrar a pagina para o lado e encolher o DESENHO, e nao
     apertar o documento: o que sai na impressora tem que ser o que se ve.

     Encolher com transform tem um porem que custa uma tela feia: o desenho
     encolhe e o espaco que ele ocupava NAO. No celular sobrava meia tela de
     branco embaixo das folhas. Por isso a altura da caixa e acertada na mao,
     pela altura de verdade da pilha vezes a escala. */
  useEffect(() => {
    const medir = () => {
      const largura = caixa.current?.clientWidth ?? LARGURA_DA_FOLHA
      const e = Math.min(1, largura / LARGURA_DA_FOLHA)
      setEscala(e)
      const h = pilha.current?.scrollHeight ?? 0
      setAltura(h ? Math.ceil(h * e) : undefined)
      /* A folha fica no meio do palco.

         Ela e escalada a partir do canto de cima a esquerda, entao sozinha ela
         encosta na borda esquerda e deixa o resto da tela vazio a direita, que
         e o que acontecia num monitor largo depois que a pagina perdeu o teto
         de 1320 px. O recuo e a metade do que sobra: com a tela menor que a
         folha ele da zero e nada muda. */
      setRecuo(Math.max(0, Math.round((largura - LARGURA_DA_FOLHA * e) / 2)))
    }
    medir()
    window.addEventListener('resize', medir)
    const obs = new ResizeObserver(medir)
    if (pilha.current) obs.observe(pilha.current)
    return () => {
      window.removeEventListener('resize', medir)
      obs.disconnect()
    }
  }, [])

  return (
    <div className="fl-palco" ref={caixa} style={{ height: altura }}>
      <div
        className="fl-pilha"
        ref={pilha}
        style={{
          transform: 'scale(' + escala + ')',
          width: LARGURA_DA_FOLHA,
          marginLeft: recuo,
        }}
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
