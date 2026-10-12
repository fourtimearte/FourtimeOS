import { useEffect, useState } from 'react'
import { CheckCircle, PaperPlaneTilt, ArrowCounterClockwise, Prohibit } from '@phosphor-icons/react'
import { Botao, Modal, avisar } from '@ds'
import { carregarAcoesDosPapeis, podeAAcao } from '@dominio/acessos'
import { avisoDoCaminho, botoesDoCaminho, moverPedido, type BotaoDoCaminho, type PassoDoPedido } from '@dominio/producao'
import { useSessao } from '@dominio/sessao'

/* ==========================================================================
   OS BOTOES DO FIM DO CAMINHO: Marcar como enviado, Marcar como entregue,
   Voltar um passo e Cancelar o pedido (12/10/2026).

   Quais botoes um pedido mostra vem de `botoesDoCaminho`; quem ve cada um vem
   da matriz de acoes do banco (Configuracoes, Acessos). Esconder o botao e
   educacao: quem decide de verdade e o gatilho da 022, que recusa a passagem
   de quem nao pode. Se a matriz nao carregar, os botoes aparecem e o banco
   responde.
   ========================================================================== */

const ICONE: Record<BotaoDoCaminho['acao'], typeof CheckCircle> = {
  'pedido.enviar': PaperPlaneTilt,
  'pedido.entregar': CheckCircle,
  'pedido.voltar': ArrowCounterClockwise,
  'pedido.cancelar': Prohibit,
}

/** O que o meu papel pode fazer no caminho do pedido. */
export function usarAcoesDoCaminho(): (acao: string) => boolean {
  const { estado } = useSessao()
  const papel = estado.fase === 'dentro' ? estado.pessoa.papel : ''
  const [quem, setQuem] = useState<Set<string> | null | 'falhou'>(null)
  useEffect(() => {
    let vivo = true
    carregarAcoesDosPapeis()
      .then((s) => vivo && setQuem(s))
      .catch(() => vivo && setQuem('falhou'))
    return () => {
      vivo = false
    }
  }, [])
  return (acao) => (quem === 'falhou' ? true : !!quem && !!papel && podeAAcao(quem, papel, acao))
}

export function BotoesDoCaminho({
  pedido,
  tamanho,
  soOPrincipal = false,
  aoMudar,
}: {
  pedido: { id: string; numero: string; estado: PassoDoPedido }
  tamanho?: 'sm'
  /** na lista, so o passo para a frente; voltar e cancelar ficam na cotacao aberta */
  soOPrincipal?: boolean
  aoMudar: (para: PassoDoPedido) => void
}) {
  const pode = usarAcoesDoCaminho()
  const [indo, setIndo] = useState('')
  const [perguntando, setPerguntando] = useState<BotaoDoCaminho | null>(null)
  const botoes = botoesDoCaminho(pedido.estado)
    .filter((b) => pode(b.acao))
    .filter((b) => !soOPrincipal || b.tom === 'forte')
  if (!botoes.length) return null

  async function ir(b: BotaoDoCaminho) {
    setPerguntando(null)
    setIndo(b.para)
    try {
      await moverPedido(pedido.id, b.para)
      avisar(avisoDoCaminho(pedido.numero, b.para), 'ok')
      aoMudar(b.para)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui mudar o pedido de passo.', 'warn')
    } finally {
      setIndo('')
    }
  }

  return (
    <>
      {botoes.map((b) => {
        const Icone = ICONE[b.acao]
        return (
          <Botao
            key={b.para}
            tom={b.tom === 'perigo' ? 'limpo' : b.tom}
            tamanho={tamanho}
            carregando={indo === b.para}
            disabled={!!indo}
            onClick={() => (b.pergunta ? setPerguntando(b) : void ir(b))}
          >
            <Icone size={16} weight="bold" />
            {b.rotulo}
          </Botao>
        )
      })}
      <Modal
        aberto={!!perguntando}
        aoFechar={() => setPerguntando(null)}
        titulo={'Cancelar o pedido ' + pedido.numero + '?'}
        pe={
          <>
            <Botao tom="limpo" onClick={() => setPerguntando(null)}>
              Não cancelar
            </Botao>
            <Botao tom="perigo" onClick={() => perguntando && void ir(perguntando)}>
              Cancelar o pedido
            </Botao>
          </>
        }
      >
        <p>{perguntando?.pergunta}</p>
      </Modal>
    </>
  )
}
