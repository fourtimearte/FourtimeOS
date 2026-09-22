import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle, Info, Warning } from '@phosphor-icons/react'
import { Botao, Esqueleto, Modal, Vazio, avisar } from '@ds'
import {
  conferirASaida,
  nomeDoPosto,
  pontosDeAtencao,
  type Conferencia,
  type FatiaNoQuadro,
} from '@dominio/producao'
import './cartao-aberto.css'

/* ==========================================================================
   A confirmação do Terminei.

   TERMINAR NUNCA É UM TOQUE SÓ. Antes de o cartão andar, o banco diz o que
   sabe, e a tela desenha. Verde é o que está certo, amarelo é o que a máquina
   não pode decidir sozinha, azul é o que é bom saber e não impede.

   QUEM DECIDE O QUE ENTRA NESTA LISTA É O BANCO, na função conferir_a_saida.
   Se a regra morasse aqui, o mesmo Terminei dado por um PATCH direto no
   PostgREST passaria sem conferir coisa nenhuma, e a conferência viraria um
   enfeite que só a tela respeita.

   NENHUM DOS AVISOS TRAVA. Travar é papel do gatilho da rota, e um aviso que
   também tranca ensina a pessoa a não ler: ela aprende que o botão só funciona
   quando a tela está toda verde, e passa a caçar o verde em vez de ler o
   amarelo.
   ========================================================================== */

export function ConfirmarSaida({
  fatia,
  aoFechar,
  aoConfirmar,
}: {
  fatia: FatiaNoQuadro
  aoFechar: () => void
  aoConfirmar: () => void
}) {
  const [conf, setConf] = useState<Conferencia | null>(null)
  const [erro, setErro] = useState('')
  const [indo, setIndo] = useState(false)

  useEffect(() => {
    let vivo = true
    conferirASaida(fatia.id)
      .then((c) => vivo && setConf(c))
      .catch(
        (e) => vivo && setErro(e instanceof Error ? e.message : 'Não consegui conferir a saída.'),
      )
    return () => {
      vivo = false
    }
  }, [fatia.id])

  async function confirmar() {
    if (indo) return
    setIndo(true)
    try {
      aoConfirmar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui mover o cartão.', 'brand')
      setIndo(false)
    }
  }

  const atencao = conf ? pontosDeAtencao(conf) : 0

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Terminar o ${fatia.numero} em ${nomeDoPosto(fatia.etapa)}?`}
      pe={
        <>
          <Botao tom="contorno" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao tom="primario" disabled={indo || !conf} onClick={() => void confirmar()}>
            {atencao ? 'Terminar assim mesmo' : 'Sim, terminei'}
            <ArrowRight size={16} weight="bold" />
          </Botao>
        </>
      }
    >
      <p className="cs-sub">
        {fatia.nome}, {fatia.pecas} peças
      </p>

      {erro ? (
        <Vazio titulo="Não consegui conferir" texto={erro} />
      ) : !conf ? (
        <>
          <Esqueleto altura={44} />
          <Esqueleto altura={44} />
        </>
      ) : (
        <div className="cs-itens">
          {conf.itens.map((i, n) => (
            <div className={'cs-item cs-' + i.tom} key={n}>
              {i.tom === 'ok' ? (
                <CheckCircle size={20} weight="bold" />
              ) : i.tom === 'atencao' ? (
                <Warning size={20} weight="bold" />
              ) : (
                <Info size={20} weight="bold" />
              )}
              <div>
                <b>{i.titulo}</b>
                <span>{i.linha}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {conf ? (
        <div className="cs-destino">
          <div>
            <span className="cs-rot">vai para</span>
            <b>{conf.proximo ? nomeDoPosto(conf.proximo) : 'o fim da rota'}</b>
          </div>
          <ArrowRight size={22} weight="bold" />
          <div className="cs-dir">
            <span className="cs-rot">sai de</span>
            <b>{nomeDoPosto(conf.posto)}</b>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
