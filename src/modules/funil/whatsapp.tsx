import { useEffect, useMemo, useRef, useState } from 'react'
import { versaoDaExtensao } from '@shared'
import { ESTAGIO_FECHADO, type Estagio, type Lead } from '@dominio/funil'
import { AvisoDaExtensao } from './barra'
import { PainelAoLado, type Escrita, type Eu } from './painel'

/* ==========================================================================
   O WHATSAPP DENTRO DO FOURTIME OS (pranchas 131 a 133).

   O quadro mostra o WhatsApp Web de verdade do vendedor: as conversas, as
   fotos, os audios e os videos continuam no WhatsApp, e nada disso passa
   pelo servidor da Fourtime. Quem deixa o WhatsApp abrir aqui dentro e a
   extensao Fourtime OS, so para o endereco do sistema; sem ela, o WhatsApp
   recusa o quadro e a pagina explica como instalar.

   A primeira vez naquele computador, o proprio WhatsApp mostra o QR Code
   aqui dentro (prancha 133). E mais um aparelho conectado, e o login fica
   separado da aba comum do WhatsApp.

   O RESTO DA TELA e o painel ao lado (painel.tsx, pranchas 150 a 152): o lead
   do telefone da conversa aberta e as abas Atendimento, Cliente e Funil.
   Quem conta qual conversa esta aberta e a extensao, por mensagem entre
   janelas, e so o telefone: o texto das mensagens nao sai do WhatsApp. A
   mensagem rapida vai no sentido contrario: a pagina pede, a extensao
   escreve na conversa aberta e envia (0.4.0).

   O QUADRO NAO E DESMONTADO ao voltar para o quadro do funil: so fica
   escondido. Recarregar o WhatsApp a cada troca custaria segundos e, sem a
   extensao pegar o link, a conversa aberta.
   ========================================================================== */

const WHATSAPP = 'https://web.whatsapp.com'
const fim = (t: string) => t.replace(/\D/g, '').slice(-8)

export type PedidoDeConversa = { telefone: string; texto: string; marca: number }

export function PainelDoWhatsApp({
  visivel,
  leads,
  pedido,
  podeMexer,
  relogio,
  aoAbrirNoQuadro,
  aoMontarCotacao,
  aoAbrirCotacao,
  aoMover,
  aoCriarLead,
  aoVirarCliente,
  aoAbrirCliente,
  aoEditar,
  aoRegistrar,
  eu,
}: {
  visivel: boolean
  leads: Lead[]
  /** um pedido de abrir conversa vindo do quadro (o botao do WhatsApp) */
  pedido: PedidoDeConversa | null
  podeMexer: boolean
  relogio: number
  aoAbrirNoQuadro: (l: Lead) => void
  aoMontarCotacao: (l: Lead) => void
  aoAbrirCotacao: (id: string) => void
  aoMover: (id: string, e: Estagio) => void
  aoCriarLead: (telefone: string) => void
  aoVirarCliente: (l: Lead) => void
  aoAbrirCliente: (id: string) => void
  aoEditar: (l: Lead) => void
  aoRegistrar: (l: Lead, texto: string) => void
  eu: Eu
}) {
  const quadro = useRef<HTMLIFrameElement>(null)
  const [pronto, setPronto] = useState(false)
  const [conversa, setConversa] = useState<{ jid: string; telefone: string }>({ jid: '', telefone: '' })
  const [recarregou, setRecarregou] = useState(false)
  const extensao = versaoDaExtensao()

  /* o que a extensao conta, e so dela: a origem e a janela do quadro */
  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== WHATSAPP || e.source !== quadro.current?.contentWindow) return
      const d = e.data as { fourtime?: string; tipo?: string; jid?: string; telefone?: string; jeito?: string }
      if (!d || d.fourtime !== 'whatsapp') return
      if (d.tipo === 'pronto') setPronto(true)
      if (d.tipo === 'conversa') setConversa({ jid: String(d.jid ?? ''), telefone: String(d.telefone ?? '') })
      if (d.tipo === 'abriu') setRecarregou(d.jeito === 'recarregando')
      if (d.tipo === 'escreveu') {
        const r = d as unknown as Escrita & { marca?: number }
        const esperando = escritas.current.get(Number(r.marca))
        if (esperando) {
          escritas.current.delete(Number(r.marca))
          esperando({ ok: !!r.ok, enviado: !!r.enviado, motivo: r.motivo })
        }
      }
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [])

  /* ESCREVER (E ENVIAR) NA CONVERSA ABERTA: a extensao responde com a mesma
     marca. Sem resposta em 2,5 s, a extensao e de antes da 0.4.0, que nao
     sabe escrever: o painel cai no jeito antigo (abrir com o texto). */
  const escritas = useRef(new Map<number, (r: Escrita) => void>())
  const escrever = (texto: string, enviar: boolean) =>
    new Promise<Escrita>((resolver) => {
      const marca = Date.now() + Math.random()
      escritas.current.set(marca, resolver)
      quadro.current?.contentWindow?.postMessage(
        { fourtime: 'pedido', tipo: 'escrever', telefone: conversa.telefone, texto, enviar, marca },
        WHATSAPP,
      )
      setTimeout(() => {
        if (!escritas.current.has(marca)) return
        escritas.current.delete(marca)
        resolver({ ok: false, motivo: 'extensao-antiga' })
      }, 2500)
    })

  const pedir = (telefone: string, texto = '') =>
    quadro.current?.contentWindow?.postMessage({ fourtime: 'pedido', tipo: 'abrir', telefone, texto }, WHATSAPP)

  /* O TEMA DO FOURTIME OS VAI PARA DENTRO: a extensao pinta o WhatsApp de
     Gelo ou de Grafite (whatsapp.css), e repinta quando o tema da pagina muda */
  useEffect(() => {
    if (!pronto) return
    const contar = () =>
      quadro.current?.contentWindow?.postMessage(
        { fourtime: 'pedido', tipo: 'tema', tema: document.documentElement.getAttribute('data-theme') || 'light' },
        WHATSAPP,
      )
    contar()
    const vigia = new MutationObserver(contar)
    vigia.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => vigia.disconnect()
  }, [pronto])

  /* o pedido do quadro vai para o WhatsApp assim que ele estiver de pe */
  const ultimoPedido = useRef(0)
  useEffect(() => {
    if (!pedido || !pronto || pedido.marca === ultimoPedido.current) return
    ultimoPedido.current = pedido.marca
    pedir(pedido.telefone, pedido.texto)
  }, [pedido, pronto])

  const lead = useMemo(() => {
    if (!conversa.telefone) return null
    const doTelefone = leads.filter((l) => fim(l.telefone) === fim(conversa.telefone))
    return doTelefone.find((l) => !ESTAGIO_FECHADO.includes(l.estagio)) ?? doTelefone[0] ?? null
  }, [leads, conversa.telefone])

  if (!extensao) return visivel ? <AvisoDaExtensao fixo /> : null

  return (
    <div className={visivel ? 'fn-wa' : 'fn-wa fn-guardado'} aria-hidden={!visivel}>
      <section className="fn-wa-quadro" aria-label="WhatsApp Web">
        <iframe
          ref={quadro}
          className="fn-wa-frame"
          src={WHATSAPP + '/'}
          title="WhatsApp Web"
          allow="clipboard-read; clipboard-write; microphone; camera; autoplay; fullscreen"
        />
      </section>

      <PainelAoLado
        lead={lead}
        conversa={conversa}
        pronto={pronto}
        recarregou={recarregou}
        leads={leads}
        relogio={relogio}
        podeMexer={podeMexer}
        eu={eu}
        pedir={pedir}
        escrever={escrever}
        aoAbrirNoQuadro={aoAbrirNoQuadro}
        aoMontarCotacao={aoMontarCotacao}
        aoAbrirCotacao={aoAbrirCotacao}
        aoMover={aoMover}
        aoCriarLead={aoCriarLead}
        aoVirarCliente={aoVirarCliente}
        aoAbrirCliente={aoAbrirCliente}
        aoEditar={aoEditar}
        aoRegistrar={aoRegistrar}
      />
    </div>
  )
}
