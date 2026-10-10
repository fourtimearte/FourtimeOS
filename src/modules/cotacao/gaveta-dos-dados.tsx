import { useEffect, useRef, useState } from 'react'
import { CaretUp, CheckCircle, ClipboardText, Percent } from '@phosphor-icons/react'
import { avisar, Botao } from '@ds'
import type { Cotacao } from '@dominio/cotacao'
import { OQueAFabricaPrecisaSaber, OQueFoiCombinado, QuemCompra } from './cabecalho-do-pedido'
import { AjustesNoValor, OQueJaFoiEnviado } from './fechamento'
import type { Porta } from './topo-do-editor'
import './cotacao.css'

/* ==========================================================================
   A GAVETA DE DADOS DO PEDIDO E DO FECHAMENTO (pranchas 124 e 124b,
   escolhidas em 11/10/2026 no lugar do modal da decisão 161).

   Clicar numa das duas portas do cabeçalho abre a gaveta logo abaixo dele,
   antes das abas das cotações: ela desce e empurra as abas e o editor para
   baixo. Nada fica por cima. A outra porta troca o conteúdo sem fechar; a
   mesma porta, o Fechar e o Esc recolhem.

   Ela trabalha num RASCUNHO, como o modal trabalhava: o que se digita aqui só
   vale para a cotação no Concluir. Clicar fora não fecha (a gaveta antiga
   fechava num clique de raspão e levava junto o que tinha sido digitado). E
   recolher com mudança não concluída pede um segundo clique: o primeiro
   avisa.

   O Concluir não grava no banco: ele devolve o rascunho para o editor, que
   fica "não salva" até o Salvar, como qualquer outra mudança da tela.

   O movimento é o do sistema: a caixa entra com opacidade e um deslize curto
   (só transform e opacity), e a página desce de uma vez.
   ========================================================================== */
export function GavetaDosDados({
  porta,
  c,
  travado,
  pedidoDeRecolher,
  aoConcluir,
  aoFechar,
}: {
  porta: Porta
  c: Cotacao
  travado?: boolean
  /** muda a cada clique na porta que já está aberta: recolhe, com o mesmo cuidado do Fechar */
  pedidoDeRecolher: number
  aoConcluir: (rascunho: Cotacao) => void
  aoFechar: () => void
}) {
  const aberta = porta !== ''
  const [r, setR] = useState<Cotacao>(c)
  const [mexeu, setMexeu] = useState(false)
  const [avisou, setAvisou] = useState(false)
  /* o rascunho nasce de novo a cada abertura, do que está na tela agora;
     trocar de porta com a gaveta aberta mantém o rascunho */
  useEffect(() => {
    if (!aberta) return
    setR(c)
    setMexeu(false)
    setAvisou(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta])
  const mudar = (parte: Partial<Cotacao>) => {
    setR((x) => ({ ...x, ...parte }))
    setMexeu(true)
    setAvisou(false)
  }

  function recolher() {
    if (mexeu && !avisou) {
      setAvisou(true)
      avisar('Há mudanças não concluídas. Concluir aplica; recolher de novo descarta.', 'warn')
      return
    }
    aoFechar()
  }
  const recolherRef = useRef(recolher)
  recolherRef.current = recolher
  /* a mesma porta clicada de novo */
  const primeiro = useRef(pedidoDeRecolher)
  useEffect(() => {
    if (pedidoDeRecolher === primeiro.current) return
    primeiro.current = pedidoDeRecolher
    recolherRef.current()
  }, [pedidoDeRecolher])

  useEffect(() => {
    if (!aberta) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      /* Esc dentro de um menu aberto fecha o menu, e não a gaveta */
      try {
        if (document.querySelector('[popover]:popover-open')) return
      } catch {
        /* navegador sem :popover-open: segue */
      }
      recolherRef.current()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberta])

  /* a caixa ganha o foco ao abrir, para o Tab começar dentro dela */
  const caixa = useRef<HTMLElement>(null)
  useEffect(() => {
    if (aberta) caixa.current?.focus({ preventScroll: true })
  }, [porta, aberta])

  if (!aberta) return null
  const dados = porta === 'dados'

  return (
    <section
      ref={caixa}
      tabIndex={-1}
      className="ct-gav"
      data-qual={porta}
      role="region"
      aria-label={dados ? 'Dados do pedido' : 'Fechamento'}
    >
      <header className="ct-gav-topo">
        <div className="ct-gav-tit">
          <span className="ct-gav-ic" aria-hidden="true">
            {dados ? <ClipboardText size={20} weight="duotone" /> : <Percent size={20} weight="duotone" />}
          </span>
          <h2>{dados ? 'Dados do pedido' : 'Fechamento'}</h2>
          <small>
            {dados
              ? 'Vão para o cabeçalho da página 1 da folha e para a ficha da produção.'
              : 'Ajustes e envios: o que vale para o documento inteiro. Os informes e termos são os da casa.'}
          </small>
        </div>
        <div className="ct-gav-botoes">
          <Botao tom="contorno" onClick={recolher}>
            <CaretUp size={17} />
            Fechar
          </Botao>
          <Botao tom="primario" onClick={() => aoConcluir(mexeu ? r : c)}>
            <CheckCircle size={17} />
            Concluir
          </Botao>
        </div>
      </header>
      {dados ? (
        <div className="ct-gav-cartoes tres">
          <QuemCompra c={r} mudar={mudar} travado={travado} />
          <OQueFoiCombinado c={r} mudar={mudar} travado={travado} />
          <OQueAFabricaPrecisaSaber c={r} mudar={mudar} />
        </div>
      ) : (
        <div className="ct-gav-cartoes dois">
          <AjustesNoValor c={r} mudar={mudar} travado={travado} />
          <OQueJaFoiEnviado c={r} />
        </div>
      )}
    </section>
  )
}

export type { Porta }
