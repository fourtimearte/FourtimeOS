import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { WhatsappLogo } from '@phosphor-icons/react'
import { Botao, TituloCartao, avisar } from '@ds'
import { abrirNoWhatsApp, versaoDaExtensao } from '@shared'
import { AvisoDaExtensao, useWhatsApp } from '@modules/funil'
import {
  camposVaziosDaLogistica,
  carregarMensagensDaLogistica,
  nomeDoEnvio,
  preencherDaLogistica,
  prontosParaEnvio,
  telefoneComPais,
  type FreteDoPedido,
  type MensagemDaLogistica,
} from '@dominio/transporte'
import { diaEMes, quandoFoi } from './apoio'
import { SituacaoDoFrete } from './confirmacao'

/* ==========================================================================
   A aba WHATSAPP da logística (080, wireframe aprovado em 14/10/2026).

   O mesmo WhatsApp da página dos vendedores: ele mora na casca
   (funil/whatsapp-vivo.tsx) e aparece por cima do quadro desta aba. O número
   é o da logística, porque é o WhatsApp Web aberto naquele computador.

   À DIREITA, duas colunas: os pedidos PRONTOS, na ordem em que foram
   liberados para envio, com a data de entrega; e as mensagens rápidas da
   logística. Clicar num cartão abre a conversa daquele cliente, e as
   mensagens passam a usar os dados dele.

   SEM A EXTENSÃO (ou no celular), o quadro vira o aviso de como instalar, e
   o cartão e o Enviar abrem o WhatsApp numa aba nova, com o texto pronto.
   ========================================================================== */

export function WhatsAppDaLogistica({
  fretes,
  hoje,
  pedidoInicial,
}: {
  fretes: FreteDoPedido[]
  hoje: Date
  /** o pedido que veio da Confirmação do frete, pelo botão Conversa */
  pedidoInicial: { id: string; marca: number } | null
}) {
  const { ligar, mostrarEm, pronto, pedir, escrever } = useWhatsApp()
  const extensao = versaoDaExtensao()
  const lugar = useRef<HTMLElement>(null)

  /* o WhatsApp sobe quando a aba abre, e o lugar some quando ela sai */
  useEffect(() => {
    if (extensao) ligar()
  }, [extensao, ligar])
  useLayoutEffect(() => {
    mostrarEm(extensao ? lugar.current : null)
    return () => mostrarEm(null)
  }, [extensao, mostrarEm])

  const prontos = useMemo(() => prontosParaEnvio(fretes), [fretes])
  const [escolhidoId, setEscolhidoId] = useState(pedidoInicial?.id ?? '')
  const escolhido = fretes.find((f) => f.pedidoId === escolhidoId) ?? null

  const [mensagens, setMensagens] = useState<MensagemDaLogistica[] | null>(null)
  useEffect(() => {
    void carregarMensagensDaLogistica().then(setMensagens)
  }, [])

  /* o pedido que veio de fora abre a conversa assim que o WhatsApp estiver de pé */
  const ultimo = useRef(0)
  useEffect(() => {
    if (!pedidoInicial || pedidoInicial.marca === ultimo.current) return
    const f = fretes.find((x) => x.pedidoId === pedidoInicial.id)
    if (!f) return
    if (extensao && !pronto) return
    ultimo.current = pedidoInicial.marca
    setEscolhidoId(f.pedidoId)
    abrirConversa(f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoInicial, pronto, extensao, fretes])

  function abrirConversa(f: FreteDoPedido, texto = '') {
    const tel = telefoneComPais(f.telefone)
    if (!tel) {
      avisar(`O ${f.numero} não tem telefone do cliente. Escreva na ficha do cliente.`, 'warn')
      return
    }
    if (extensao && pronto) pedir(tel, texto)
    else abrirNoWhatsApp(tel, texto)
  }

  function escolher(f: FreteDoPedido) {
    setEscolhidoId(f.pedidoId)
    abrirConversa(f)
  }

  async function enviar(m: MensagemDaLogistica) {
    const texto = preencherDaLogistica(m.texto, escolhido)
    const faltam = camposVaziosDaLogistica(m.texto, escolhido)
    if (!extensao || !pronto) {
      if (escolhido) abrirConversa(escolhido, texto)
      return
    }
    const r = await escrever(texto, faltam.length === 0)
    if (r.ok && r.enviado) avisar(`Mensagem enviada${escolhido ? ' para ' + escolhido.cliente : ''}.`, 'ok')
    else if (r.ok) avisar(`Escrevi na conversa, falta: ${faltam.join(', ')}. Complete e envie.`, 'warn')
    else if (r.motivo === 'extensao-antiga' && escolhido) pedir(telefoneComPais(escolhido.telefone), texto)
    else avisar('Abra uma conversa no WhatsApp antes de enviar.', 'warn')
  }

  /* as mensagens agrupadas, na ordem em que vêm */
  const grupos = useMemo(() => {
    const mapa = new Map<string, MensagemDaLogistica[]>()
    ;(mensagens ?? []).forEach((m) => mapa.set(m.grupo, [...(mapa.get(m.grupo) ?? []), m]))
    return [...mapa.entries()]
  }, [mensagens])

  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  return (
    <div className={extensao ? 'tp-wa' : 'tp-wa sem-quadro'}>
      {extensao ? (
        <section ref={lugar} className="tp-wa-quadro" aria-label="WhatsApp Web" />
      ) : (
        <div className="tp-wa-aviso">
          <AvisoDaExtensao fixo />
        </div>
      )}

      <section className="cartao tp-wa-coluna" aria-label="Prontos para envio">
        <div className="tp-caixa-topo">
          <TituloCartao icone={WhatsappLogo}>Prontos para envio</TituloCartao>
          <span className="tp-caixa-nota">na ordem da liberação</span>
        </div>
        <div className="tp-wa-lista">
          {prontos.length === 0 ? (
            <p className="tp-vazio-dentro">Nenhum pedido PRONTO agora. Eles entram aqui quando a produção termina.</p>
          ) : (
            prontos.map((f, i) => {
              const tarde = !!f.entregaEm && f.entregaEm <= hojeIso
              return (
                <button
                  key={f.pedidoId}
                  type="button"
                  className={f.pedidoId === escolhidoId ? 'tp-pronto marcado' : 'tp-pronto'}
                  onClick={() => escolher(f)}
                >
                  <span className="tp-pronto-l1">
                    <span className="tp-ordem">{i + 1}</span>
                    <b>{f.numero}</b>
                    <WhatsappLogo size={16} className="tp-pronto-wa" />
                  </span>
                  <span className="tp-pronto-cliente">{f.cliente}</span>
                  <span className="tp-pronto-meta">
                    {f.liberadoEm ? <span>Liberado {quandoFoi(f.liberadoEm, hoje)}</span> : null}
                    <span className={tarde ? 'tp-tarde' : ''}>
                      {f.entregaEm ? `Entrega ${diaEMes(f.entregaEm + 'T12:00:00')}` : 'Sem data de entrega'}
                    </span>
                  </span>
                  <span className="tp-pronto-meta">
                    {nomeDoEnvio(f.envio) ? <span>{nomeDoEnvio(f.envio)}</span> : null}
                    <SituacaoDoFrete f={f} />
                  </span>
                </button>
              )
            })
          )}
        </div>
      </section>

      <section className="cartao tp-wa-coluna" aria-label="Mensagens rápidas">
        <div className="tp-caixa-topo">
          <TituloCartao icone={WhatsappLogo}>Mensagens rápidas</TituloCartao>
          <span className="tp-caixa-nota">{escolhido ? escolhido.numero : 'escolha um pedido'}</span>
        </div>
        <div className="tp-wa-lista">
          {mensagens === null ? null : grupos.length === 0 ? (
            <p className="tp-vazio-dentro">As mensagens da logística chegam com a migração 080.</p>
          ) : (
            grupos.map(([g, ms]) => (
              <div key={g} className="pilha">
                <span className="tp-folha-titulo">{g}</span>
                {ms.map((m) => (
                  <article key={m.id} className="tp-rapida">
                    <b>{m.titulo}</b>
                    <p>{escolhido ? preencherDaLogistica(m.texto, escolhido) : m.texto}</p>
                    <Botao tamanho="sm" className="tp-rapida-enviar" disabled={!escolhido} onClick={() => void enviar(m)}>
                      Enviar
                    </Botao>
                  </article>
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
