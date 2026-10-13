import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { versaoDaExtensao } from '@shared'
import { ESTAGIO_FECHADO, type Estagio, type Lead } from '@dominio/funil'
import { AvisoDaExtensao } from './barra'
import { PainelAoLado, type Eu } from './painel'
import { useWhatsApp } from './whatsapp-vivo'

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

   O QUADRO NAO E DESMONTADO nem ao voltar para o quadro do funil nem ao
   trocar de pagina: ele mora na casca (whatsapp-vivo.tsx, 13/10/2026), e
   aqui fica so o lugar onde ele aparece. Recarregar o WhatsApp a cada troca
   custaria segundos e a conversa aberta.
   ========================================================================== */

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
  aoRegistrar: (l: Lead, texto: string) => void
  eu: Eu
}) {
  const { mostrarEm, pronto, conversa, recarregou, pedir, escrever } = useWhatsApp()
  const extensao = versaoDaExtensao()

  /* O LUGAR DO WHATSAPP NESTA PAGINA. O WhatsApp mesmo mora na casca
     (whatsapp-vivo.tsx) e aparece em cima deste retangulo enquanto o modo
     WhatsApp esta na frente. Sair da pagina so tira o lugar: ele fica ligado. */
  const lugar = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    mostrarEm(visivel ? lugar.current : null)
    return () => mostrarEm(null)
  }, [visivel, mostrarEm, extensao])

  /* o pedido do quadro vai para o WhatsApp assim que ele estiver de pe */
  const ultimoPedido = useRef(0)
  useEffect(() => {
    if (!pedido || !pronto || pedido.marca === ultimoPedido.current) return
    ultimoPedido.current = pedido.marca
    pedir(pedido.telefone, pedido.texto)
  }, [pedido, pronto, pedir])

  const lead = useMemo(() => {
    if (!conversa.telefone) return null
    const doTelefone = leads.filter((l) => fim(l.telefone) === fim(conversa.telefone))
    return doTelefone.find((l) => !ESTAGIO_FECHADO.includes(l.estagio)) ?? doTelefone[0] ?? null
  }, [leads, conversa.telefone])

  if (!extensao) return visivel ? <AvisoDaExtensao fixo /> : null

  return (
    <div className={visivel ? 'fn-wa' : 'fn-wa fn-guardado'} aria-hidden={!visivel}>
      <section ref={lugar} className="fn-wa-quadro" aria-label="WhatsApp Web" />

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
        aoRegistrar={aoRegistrar}
      />
    </div>
  )
}
