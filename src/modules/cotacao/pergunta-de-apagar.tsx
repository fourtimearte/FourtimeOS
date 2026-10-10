import { Trash } from '@phosphor-icons/react'
import { Botao, Modal } from '@ds'
import { pecasDaCotacao, totalDaCotacao, type Cotacao } from '@dominio/cotacao'
import './cotacao.css'

/* A PERGUNTA ANTES DE APAGAR (decisão 156). "Apagar cotação" nunca apaga no
   primeiro clique: abre esta caixa, desenhada (nunca o confirm do navegador),
   com o que vai embora escrito, para a pessoa reconhecer a cotação antes de
   confirmar. O foco nasce no Cancelar: Enter por reflexo não apaga nada. */
export function PerguntaDeApagar({
  aberto,
  c,
  apagando,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean
  c: Cotacao
  apagando: boolean
  aoConfirmar: () => void
  aoFechar: () => void
}) {
  const total = totalDaCotacao(c).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Apagar esta cotação?"
      pe={
        <>
          <Botao tom="contorno" onClick={aoFechar} data-foco-inicial="">
            Cancelar
          </Botao>
          <Botao tom="perigo" onClick={aoConfirmar} disabled={apagando}>
            <Trash size={17} />
            Apagar cotação
          </Botao>
        </>
      }
    >
      <div className="ct-apagar">
        <p>Ela some da lista de cotações e das abas abertas de todo mundo.</p>
        <dl className="ct-apagar-qual">
          <dt>Cotação</dt>
          <dd>{c.numero}</dd>
          <dt>Cliente</dt>
          <dd>{c.cliente.nome || 'sem cliente'}</dd>
          <dt>Layouts</dt>
          <dd>
            {c.produtos.length} · {pecasDaCotacao(c)} peças
          </dd>
          <dt>Total</dt>
          <dd>{total}</dd>
        </dl>
      </div>
    </Modal>
  )
}
