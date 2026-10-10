import { useEffect, useState } from 'react'
import { CheckCircle, ClipboardText, Percent } from '@phosphor-icons/react'
import { Botao, Modal, TituloCartao } from '@ds'
import type { Cotacao } from '@dominio/cotacao'
import { OQueAFabricaPrecisaSaber, OQueFoiCombinado, QuemCompra } from './cabecalho-do-pedido'
import { AjustesNoValor, InformesDaProducao, OQueJaFoiEnviado } from './fechamento'
import './cotacao.css'

/* ==========================================================================
   O MODAL DE DADOS DO PEDIDO E FECHAMENTO (decisão 161, modelo B).

   Clicar em "Dados do pedido" ou em "Fechamento", no cabeçalho do editor,
   abre este modal com a tela esmaecida: tudo do pedido à esquerda, tudo do
   fechamento à direita, meio a meio, com um risco no meio.

   Ele trabalha num RASCUNHO. O que a pessoa digita aqui só vale para a
   cotação no Concluir; o Cancelar, o X e o Esc devolvem tudo como estava ao
   abrir. Clicar fora NÃO fecha: a gaveta antiga fechava num clique de raspão
   e levava junto o que tinha sido digitado (era o defeito que ele apontou).

   O Concluir não grava no banco: ele devolve o rascunho para o editor, que
   fica "não salva" até o Salvar, como qualquer outra mudança da tela.
   ========================================================================== */
export function ModalDosDados({
  aberto,
  c,
  travado,
  aoConcluir,
  aoFechar,
}: {
  aberto: boolean
  c: Cotacao
  travado?: boolean
  aoConcluir: (rascunho: Cotacao) => void
  aoFechar: () => void
}) {
  const [r, setR] = useState<Cotacao>(c)
  /* o rascunho nasce de novo a cada abertura, do que está na tela agora */
  useEffect(() => {
    if (aberto) setR(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])
  const mudar = (parte: Partial<Cotacao>) => setR((x) => ({ ...x, ...parte }))

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      tela
      fechaFora={false}
      topo={
        <h2 className="ct-md-topo">
          Dados do pedido e fechamento
          <small>
            {c.numero}
            {c.cliente.nome ? ' · ' + c.cliente.nome : ''}
          </small>
        </h2>
      }
      pe={
        <>
          <Botao tom="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" onClick={() => aoConcluir(r)}>
            <CheckCircle size={17} />
            Concluir
          </Botao>
        </>
      }
    >
      <div className="ct-md">
        <div className="ct-md-metade">
          <div className="ct-md-tit">
            <TituloCartao icone={ClipboardText}>Dados do pedido</TituloCartao>
            <p>Vão para o cabeçalho da página 1 da folha e para a ficha da produção.</p>
          </div>
          <div className="ct-md-par">
            <QuemCompra c={r} mudar={mudar} travado={travado} />
            <OQueFoiCombinado c={r} mudar={mudar} travado={travado} />
          </div>
          <OQueAFabricaPrecisaSaber c={r} mudar={mudar} />
        </div>
        <div className="ct-md-metade">
          <div className="ct-md-tit">
            <TituloCartao icone={Percent}>Fechamento</TituloCartao>
            <p>Ajustes, informes e envios: o que vale para o documento inteiro, e não para um layout.</p>
          </div>
          <div className="ct-md-par">
            <AjustesNoValor c={r} mudar={mudar} travado={travado} />
            <InformesDaProducao c={r} mudar={mudar} />
          </div>
          <OQueJaFoiEnviado c={r} />
        </div>
      </div>
    </Modal>
  )
}
