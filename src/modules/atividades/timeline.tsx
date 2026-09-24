import { useEffect, useState } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { Botao, Esqueleto, Modal, Vazio } from '@ds'
import {
  BlocoDaFatia,
  carregarAsFatiasDoPedido,
  carregarAsRotas,
  quemSeguraOPedido,
  type FatiaNoQuadro,
  type Pedido,
  type Rota,
} from '@dominio/producao'
import './timeline.css'

/* ==========================================================================
   O modal da timeline do painel de atividades.

   ELE É O QUE TORNA HONESTA A COLUNA "ATUALIZAÇÃO". O painel mostra UM posto
   por pedido, e o pedido quase nunca está num posto só: ele foi fatiado por
   técnica lá no PCP, e cada fatia anda no ritmo dela. A coluna mostra a fatia
   mais atrasada, que é a resposta certa para a pergunta "o que está segurando
   a entrega", e é uma resposta que esconde as outras.

   Colapsar só é honesto quando existe um jeito de abrir, e o jeito precisa
   estar onde a pergunta nasce. Por isso o botão fica na própria linha.

   A TIMELINE É POR FATIA, E NÃO POR LAYOUT. O desenho de 21/09 dizia "uma
   timeline por layout", e o kanban de 22/09 decidiu que o cartão é por técnica
   com os layouts juntos. Dois layouts de DTF do mesmo pedido estão no mesmo
   cartão, sempre, no mesmo posto: desenhar duas timelines idênticas para eles
   seria inventar uma diferença que a fábrica não tem. Cada bloco diz quais
   layouts estão dentro dele, que é a informação que faltava.
   ========================================================================== */

export function ModalDaTimeline({
  pedido,
  aoFechar,
}: {
  pedido: Pedido
  aoFechar: () => void
}) {
  const navegar = useNavigate()
  const [fatias, setFatias] = useState<FatiaNoQuadro[] | null>(null)
  const [rotas, setRotas] = useState<Rota[]>([])
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    Promise.all([carregarAsFatiasDoPedido(pedido.id), carregarAsRotas()])
      .then(([f, r]) => {
        if (!vivo) return
        setFatias(f)
        setRotas(r)
      })
      .catch((e) => {
        if (!vivo) return
        setFatias([])
        setErro(e instanceof Error ? e.message : 'Não consegui ler as fatias deste pedido.')
      })
    return () => {
      vivo = false
    }
  }, [pedido.id])

  const segura = fatias && rotas.length ? quemSeguraOPedido(rotas, fatias) : ''
  const prontas = fatias ? fatias.filter((f) => f.etapa === 'finalizado').length : 0

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largo
      titulo={`${pedido.numero}, onde está cada parte`}
      pe={
        <>
          <Botao tom="contorno" onClick={aoFechar}>
            Fechar
          </Botao>
          <Botao tom="forte" onClick={() => navegar('/kanban')}>
            Abrir no quadro
            <ArrowSquareOut size={16} weight="bold" />
          </Botao>
        </>
      }
    >
      <p className="tl-sub">
        <b>{pedido.cliente}</b>
        <i>·</i>
        {pedido.pecas} peças
        <i>·</i>
        {/* "0 finalizadas" nao e informacao, e ruido: ele ocupa a linha para
            dizer que nada aconteceu. So aparece quando ha o que contar. */}
        {fatias
          ? (fatias.length === 1 ? '1 fatia no quadro' : fatias.length + ' fatias no quadro') +
            (prontas
              ? ', ' + prontas + ' finalizada' + (prontas === 1 ? '' : 's')
              : '')
          : 'lendo o quadro...'}
      </p>

      {erro ? <Vazio titulo="Não consegui ler o quadro" texto={erro} /> : null}

      {!fatias && !erro ? (
        <>
          <Esqueleto altura={120} />
          <Esqueleto altura={120} />
        </>
      ) : null}

      {/* O PEDIDO SEM FATIA NENHUMA NÃO É UM ERRO, É UM ESTADO.

          Ele existe de verdade: o pedido foi aprovado em venda e ainda não
          passou pelo portão do PCP, então nunca teve cartão. Desenhar um vazio
          genérico aqui faria parecer que a consulta falhou, e a pessoa iria
          procurar defeito no sistema em vez de procurar o pedido no PCP. */}
      {fatias && !fatias.length && !erro ? (
        <Vazio
          titulo="Este pedido ainda não desceu para o quadro"
          texto="As fatias nascem quando o diretor aprova a produção, na tela do PCP. Até lá o pedido não tem cartão em posto nenhum."
        />
      ) : null}

      {fatias?.map((f) => (
        <BlocoDaFatia key={f.id} fatia={f} rotas={rotas} segurando={f.id === segura} />
      ))}
    </Modal>
  )
}
