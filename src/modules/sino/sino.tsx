import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUUpLeft, Bell, ChatCircleText, Globe, Package, Truck, UserSwitch, Warning } from '@phosphor-icons/react'
import { Flutuante } from '@ds'
import { carregarMeusAvisos, lerAvisos, type AvisoDoSino } from '@dominio/sino'
import './sino.css'

/* ==========================================================================
   O SINO DO TOPO (064; parte P4 do PCP).

   Até aqui era um botão com uma bolinha vermelha acesa para sempre. Agora a
   bolinha só acende quando há aviso não lido, e o botão abre a lista: a
   mensagem nova na conversa de um pedido e o pedido que o PCP devolveu ao
   vendedor. Clicar num aviso leva ao pedido e marca como lido.

   O sino relê sozinho a cada minuto, ao voltar para a aba e ao trocar de
   página. Antes da 064 o banco não tem avisos: o sino fica apagado e diz
   isso ao abrir.
   ========================================================================== */

const RELER_A_CADA = 60000

function quando(iso: string, agora = new Date()): string {
  const d = new Date(iso)
  const min = Math.round((agora.getTime() - d.getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === agora.toDateString()) return 'hoje, ' + hora
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + hora
}

export function Sino() {
  const navegar = useNavigate()
  const local = useLocation()
  const bt = useRef<HTMLButtonElement>(null)
  const [aberto, setAberto] = useState(false)
  /* undefined: lendo; null: a 064 não rodou */
  const [avisos, setAvisos] = useState<AvisoDoSino[] | null | undefined>(undefined)

  const ler = useCallback(async () => {
    try {
      setAvisos(await carregarMeusAvisos())
    } catch {
      setAvisos(a => a ?? [])
    }
  }, [])

  useEffect(() => {
    void ler()
    const t = window.setInterval(() => void ler(), RELER_A_CADA)
    const voltar = () => document.visibilityState === 'visible' && void ler()
    document.addEventListener('visibilitychange', voltar)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', voltar)
    }
  }, [ler])

  useEffect(() => {
    void ler()
  }, [local.pathname, ler])

  const naoLidos = (avisos ?? []).filter(a => !a.lido)

  async function abrirAviso(a: AvisoDoSino) {
    setAberto(false)
    if (!a.lido) {
      setAvisos(l => l?.map(x => (x.id === a.id ? { ...x, lido: true } : x)))
      void lerAvisos([a.id]).catch(() => null)
    }
    if (a.link) navegar(a.link)
  }

  async function lerTodos() {
    setAvisos(l => l?.map(x => ({ ...x, lido: true })))
    await lerAvisos().catch(() => null)
  }

  return (
    <>
      <button
        ref={bt}
        type="button"
        className="bt-icone"
        aria-label={naoLidos.length ? `Avisos, ${naoLidos.length} sem ler` : 'Avisos'}
        title="Avisos"
        aria-expanded={aberto}
        onClick={() => {
          setAberto(x => !x)
          void ler()
        }}
      >
        <Bell size={20} />
        {naoLidos.length ? <span className="sinal" data-sino-sinal="" /> : null}
      </button>
      <Flutuante
        aberto={aberto}
        ancora={bt}
        aoFechar={() => setAberto(false)}
        opcoes={{ alinhar: 'direita', largura: 380 }}
      >
        <div className="sn-caixa">
          <header className="sn-topo">
            <b>Avisos</b>
            {naoLidos.length ? (
              <button type="button" className="sn-ler" onClick={() => void lerTodos()}>
                Marcar tudo como lido
              </button>
            ) : null}
          </header>
          {avisos === undefined ? (
            <p className="sn-nada">Lendo os avisos.</p>
          ) : avisos === null ? (
            <p className="sn-nada">
              O sino ainda não está ligado no banco: falta rodar a migração 064.
            </p>
          ) : !avisos.length ? (
            <p className="sn-nada">
              Nenhum aviso. Aparece aqui a conversa de um pedido com você, o lead que passar a
              ser seu, a cotação aprovada e o pedido pronto para enviar.
            </p>
          ) : (
            <div className="mn-lista sn-lista">
              {avisos.map(a => (
                <button
                  key={a.id}
                  type="button"
                  className={a.lido ? 'sn-item' : 'sn-item sn-novo'}
                  data-aviso={a.tipo}
                  onClick={() => void abrirAviso(a)}
                >
                  <span className="sn-ic" aria-hidden="true">
                    {a.tipo === 'devolvido' ? (
                      <ArrowUUpLeft size={17} />
                    ) : a.tipo === 'lead' ? (
                      <Globe size={17} />
                    ) : a.tipo === 'dono' ? (
                      <UserSwitch size={17} />
                    ) : a.tipo === 'pedido' ? (
                      <Package size={17} />
                    ) : a.tipo === 'pronto' ? (
                      <Truck size={17} />
                    ) : a.tipo === 'travou' ? (
                      <Warning size={17} />
                    ) : (
                      <ChatCircleText size={17} />
                    )}
                  </span>
                  <span className="sn-meio">
                    <span className="sn-texto">{a.texto}</span>
                    <small>
                      {a.deNome ? a.deNome + ' · ' : ''}
                      {quando(a.criadoEm)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Flutuante>
    </>
  )
}
