import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Botao, Modal } from '@ds'
import { versaoDaExtensao } from '@shared'
import { registrarConversaDoWhatsApp, registrarErroDaExtensao, semRegistro, type MensagemLida } from '@dominio/funil'
import './funil.css'

/* ==========================================================================
   O WHATSAPP QUE NAO RECARREGA (13/10/2026).

   O QUADRO MORAVA DENTRO DA PAGINA DO FUNIL. Trocar de pagina no Fourtime OS
   desmontava o Funil, e o quadro ia junto: ao voltar, o WhatsApp abria do
   zero (o "atualiza toda vez que mudo de pagina" que o Henrique viu). Um
   iframe nao pode mudar de lugar na pagina sem recarregar, entao ele nao
   pode morar em pagina nenhuma.

   AGORA ELE MORA NA CASCA, que nunca sai da tela enquanto a pessoa esta
   dentro do sistema. O Funil so marca o LUGAR onde ele aparece (o retangulo
   com borda), e a casca desenha o WhatsApp em cima desse lugar, seguindo o
   tamanho e a posicao dele. Fora do Funil, ou no modo Quadro, o WhatsApp fica
   ligado e escondido, do mesmo tamanho: volta na hora, com a conversa aberta.

   Ele so liga na primeira vez que alguem entra no modo WhatsApp, e desliga ao
   sair do sistema (a casca sai junto). O que a extensao conta (pronto, a
   conversa aberta, a resposta do escrever) tambem mora aqui: a pagina do
   Funil nasce de novo, e o WhatsApp nao avisa "pronto" duas vezes.
   ========================================================================== */

export const WHATSAPP = 'https://web.whatsapp.com'

/** a resposta da extensao ao escrever na conversa aberta */
export type Escrita = { ok: boolean; enviado?: boolean; motivo?: string }

export type Conversa = { jid: string; telefone: string; nome: string; aberta: boolean }

export type ModoDoFunil = 'quadro' | 'whatsapp'

type WhatsAppVivo = {
  ligado: boolean
  ligar: () => void
  /** o modo em que a pessoa deixou o Funil: volta nele ao voltar para a pagina */
  modo: ModoDoFunil
  guardarModo: (m: ModoDoFunil) => void
  /** o retangulo da pagina onde o WhatsApp aparece; null esconde */
  mostrarEm: (lugar: HTMLElement | null) => void
  pronto: boolean
  conversa: Conversa
  recarregou: boolean
  pedir: (telefone: string, texto?: string) => void
  escrever: (texto: string, enviar: boolean) => Promise<Escrita>
  /** W3: le a conversa aberta (so se for esta) e grava no lead o que e novo.
      Devolve quantas entraram, ou null quando nao deu para registrar. */
  registrar: (leadId: string, jid: string) => Promise<number | null>
  /** o que o registro ja fez nesta visita: quantas gravou e se esta parado */
  registro: { gravadas: number; parado: boolean }
}

const SEM_CONVERSA: Conversa = { jid: '', telefone: '', nome: '', aberta: false }

/* sem a casca por perto (uma pagina montada sozinha num teste) o WhatsApp nao
   liga, e nada quebra */
const Contexto = createContext<WhatsAppVivo>({
  ligado: false,
  ligar: () => {},
  modo: 'quadro',
  guardarModo: () => {},
  mostrarEm: () => {},
  pronto: false,
  conversa: SEM_CONVERSA,
  recarregou: false,
  pedir: () => {},
  escrever: async () => ({ ok: false, motivo: 'sem-quadro' }),
  registrar: async () => null,
  registro: { gravadas: 0, parado: false },
})

export const useWhatsApp = () => useContext(Contexto)

export function ProvedorDoWhatsApp({ children }: { children: ReactNode }) {
  const [ligado, setLigado] = useState(false)
  /* O MODO DO FUNIL MORA AQUI (13/10/2026, pedido do Henrique): quem estava no
     WhatsApp, vai a outra pagina e volta, cai direto no WhatsApp. So enquanto a
     pagina do sistema esta aberta: recarregar ou entrar de novo abre no Quadro,
     como ele pediu em 12/10/2026 (nada guardado no navegador). */
  const [modo, guardarModo] = useState<ModoDoFunil>('quadro')
  const [lugar, setLugar] = useState<HTMLElement | null>(null)
  const quadro = useRef<HTMLIFrameElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const [pronto, setPronto] = useState(false)
  const [conversa, setConversa] = useState<Conversa>(SEM_CONVERSA)
  const [recarregou, setRecarregou] = useState(false)
  const conversaAgora = useRef(conversa)
  conversaAgora.current = conversa
  const escritas = useRef(new Map<number, (r: Escrita) => void>())
  const leituras = useRef(new Map<number, (r: MensagemLida[] | null) => void>())
  /* o que ja foi gravado nesta visita, para nao mandar de novo a cada leitura */
  const jaGravadas = useRef(new Set<string>())
  const [registro, setRegistro] = useState({ gravadas: 0, parado: false })
  const parado = useRef(false)
  /* o PDF que o WhatsApp quis abrir, no visor desta pagina */
  const [arquivo, setArquivo] = useState<{ url: string; nome: string } | null>(null)
  const fecharArquivo = useCallback(() => {
    setArquivo((antes) => {
      if (antes) URL.revokeObjectURL(antes.url)
      return null
    })
  }, [])

  const contarOTema = useCallback(() => {
    quadro.current?.contentWindow?.postMessage(
      { fourtime: 'pedido', tipo: 'tema', tema: document.documentElement.getAttribute('data-theme') || 'light' },
      WHATSAPP,
    )
  }, [])

  /* o que a extensao conta, e so dela: a origem e a janela do quadro */
  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== WHATSAPP || !quadro.current || e.source !== quadro.current.contentWindow) return
      const d = e.data as { fourtime?: string; tipo?: string; jid?: string; telefone?: string; jeito?: string }
      if (!d || d.fourtime !== 'whatsapp') return
      if (d.tipo === 'pronto') {
        /* O DIARIO DAS CARGAS (13/10/2026): cada vez que o WhatsApp de dentro
           nasce, fica anotado quando e como (navigate, reload), e o console
           diz. Em window.__ftWhatsApp, para achar quem recarrega o WhatsApp
           sem ninguem pedir. A primeira carga e a normal. */
        const x = d as { carga?: string; endereco?: string; versao?: string }
        const diario = ((window as unknown as { __ftWhatsApp?: { cargas: unknown[] } }).__ftWhatsApp ??= { cargas: [] })
        diario.cargas.push({ em: new Date().toISOString(), carga: String(x.carga ?? ''), endereco: String(x.endereco ?? ''), versao: String(x.versao ?? ''), visivel: document.visibilityState })
        if (diario.cargas.length > 1) console.info('[fourtime] o WhatsApp de dentro carregou de novo', diario.cargas[diario.cargas.length - 1])
        setPronto(true)
        /* o quadro que RECARREGOU (a troca de conversa pelo endereco) nasce sem
           o tema: ele vai de novo a cada "pronto", e nao so no primeiro */
        contarOTema()
      }
      /* a 0.4.1 conta tambem se ha uma conversa aberta (aberta), mesmo quando o
         WhatsApp nao mostra o numero; a de antes, so o jid e o telefone */
      if (d.tipo === 'conversa') {
        const x = d as { jid?: string; telefone?: string; nome?: string; aberta?: boolean }
        const jid = String(x.jid ?? '')
        const telefone = String(x.telefone ?? '')
        setConversa({ jid, telefone, nome: String(x.nome ?? ''), aberta: x.aberta ?? !!(jid || telefone) })
      }
      if (d.tipo === 'abriu') setRecarregou(d.jeito === 'recarregando')
      /* O ARQUIVO QUE O WHATSAPP QUIS ABRIR OU BAIXAR (extensao 0.6.3): o
         blob do iframe nao vale aqui fora, entao a extensao manda os bytes.
         Baixar vai pela pagina de cima, onde o Chrome deixa (e pergunta
         quando sao varios); abrir PDF mostra no visor desta pagina. */
      if (d.tipo === 'arquivo') {
        const x = d as unknown as { acao?: string; nome?: string; mime?: string; dados?: ArrayBuffer }
        if (!(x.dados instanceof ArrayBuffer)) return
        const nome = String(x.nome || 'arquivo')
        const pdf = /pdf/i.test(String(x.mime)) || /\.pdf$/i.test(nome)
        const mime = pdf ? 'application/pdf' : String(x.mime || 'application/octet-stream')
        const url = URL.createObjectURL(new Blob([x.dados], { type: mime }))
        if (x.acao === 'baixar') {
          baixarDaqui(url, nome)
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
        } else if (pdf) {
          setArquivo((antes) => {
            if (antes) URL.revokeObjectURL(antes.url)
            return { url, nome: /\.pdf$/i.test(nome) ? nome : nome + '.pdf' }
          })
        } else {
          const janela = window.open(url, '_blank')
          if (!janela) baixarDaqui(url, nome)
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
        }
      }
      /* O VIGIA: a extensao nao achou o que procura no WhatsApp. A pagina
         grava com a entrada de quem esta usando (so o esqueleto, sem texto) */
      if (d.tipo === 'erro') {
        const x = d as unknown as { versao?: string; onde?: string; oque?: string; estrutura?: unknown }
        void registrarErroDaExtensao({ versao: String(x.versao ?? ''), onde: String(x.onde ?? ''), oque: String(x.oque ?? ''), estrutura: x.estrutura ?? null })
      }
      if (d.tipo === 'mensagens') {
        const r = d as unknown as { marca?: number; ok?: boolean; mensagens?: MensagemLida[] }
        const esperando = leituras.current.get(Number(r.marca))
        if (esperando) {
          leituras.current.delete(Number(r.marca))
          esperando(r.ok && Array.isArray(r.mensagens) ? r.mensagens : null)
        }
      }
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
  }, [contarOTema])

  /* O TEMA DO FOURTIME OS VAI PARA DENTRO: a extensao pinta o WhatsApp de
     Gelo ou de Grafite (whatsapp.css), e repinta quando o tema da pagina muda */
  useEffect(() => {
    if (!pronto) return
    contarOTema()
    const vigia = new MutationObserver(contarOTema)
    vigia.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => vigia.disconnect()
  }, [pronto, contarOTema])

  /* ESCREVER (E ENVIAR) NA CONVERSA ABERTA: a extensao responde com a mesma
     marca. Sem resposta em 2,5 s, a extensao e de antes da 0.4.0, que nao
     sabe escrever: o painel cai no jeito antigo (abrir com o texto). */
  const escrever = useCallback(
    (texto: string, enviar: boolean) =>
      new Promise<Escrita>((resolver) => {
        const marca = Date.now() + Math.random()
        const { jid, telefone } = conversaAgora.current
        escritas.current.set(marca, resolver)
        quadro.current?.contentWindow?.postMessage(
          { fourtime: 'pedido', tipo: 'escrever', jid, telefone, texto, enviar, marca },
          WHATSAPP,
        )
        setTimeout(() => {
          if (!escritas.current.has(marca)) return
          escritas.current.delete(marca)
          resolver({ ok: false, motivo: 'extensao-antiga' })
        }, 2500)
      }),
    [],
  )

  const pedir = useCallback((telefone: string, texto = '') => {
    quadro.current?.contentWindow?.postMessage({ fourtime: 'pedido', tipo: 'abrir', telefone, texto }, WHATSAPP)
  }, [])

  /* W3, O REGISTRO NO LEAD: pede a extensao as mensagens da conversa aberta
     (ela confere se a aberta e mesmo esta) e grava so as que ainda nao foram.
     Sem a 078 no banco, para de tentar e o painel diz. */
  const registrar = useCallback(async (leadId: string, jid: string): Promise<number | null> => {
    if (parado.current || !leadId || !jid || !quadro.current?.contentWindow) return null
    const lidas = await new Promise<MensagemLida[] | null>((resolver) => {
      const marca = Date.now() + Math.random()
      leituras.current.set(marca, resolver)
      quadro.current?.contentWindow?.postMessage({ fourtime: 'pedido', tipo: 'ler-mensagens', jid, marca }, WHATSAPP)
      setTimeout(() => {
        if (!leituras.current.has(marca)) return
        leituras.current.delete(marca)
        resolver(null)
      }, 2500)
    })
    if (!lidas) return null
    const novas = lidas.filter((m) => m && m.id && !jaGravadas.current.has(m.id))
    if (!novas.length) return 0
    try {
      const n = await registrarConversaDoWhatsApp(leadId, novas)
      novas.forEach((m) => jaGravadas.current.add(m.id))
      if (n) setRegistro((r) => ({ ...r, gravadas: r.gravadas + n }))
      return n
    } catch (e) {
      if (semRegistro(e)) {
        parado.current = true
        setRegistro((r) => ({ ...r, parado: true }))
      }
      return null
    }
  }, [])

  const ligar = useCallback(() => setLigado(true), [])

  /* SEGUIR O LUGAR. A cada quadro de desenho, enquanto ha lugar marcado, o
     WhatsApp copia a posicao e o tamanho do lado de dentro da borda dele. So
     escreve quando muda. Sem lugar, ele fica escondido e do mesmo tamanho, com
     posicao fixa (escondido e fixo, ele nao aumenta a rolagem da pagina). */
  useLayoutEffect(() => {
    const c = caixa.current
    if (!c) return
    if (!lugar) {
      c.classList.remove('na-pagina')
      return
    }
    c.classList.add('na-pagina')
    let ultimo = ''
    let pedido = 0
    const seguir = () => {
      const r = lugar.getBoundingClientRect()
      const x = Math.round(r.left + window.scrollX + lugar.clientLeft)
      const y = Math.round(r.top + window.scrollY + lugar.clientTop)
      const chave = x + '|' + y + '|' + lugar.clientWidth + '|' + lugar.clientHeight
      if (chave !== ultimo) {
        ultimo = chave
        c.style.left = x + 'px'
        c.style.top = y + 'px'
        c.style.width = lugar.clientWidth + 'px'
        c.style.height = lugar.clientHeight + 'px'
      }
      pedido = requestAnimationFrame(seguir)
    }
    seguir()
    return () => cancelAnimationFrame(pedido)
  }, [lugar, ligado])

  const valor = useMemo<WhatsAppVivo>(
    () => ({ ligado, ligar, modo, guardarModo, mostrarEm: setLugar, pronto, conversa, recarregou, pedir, escrever, registrar, registro }),
    [ligado, ligar, modo, pronto, conversa, recarregou, pedir, escrever, registrar, registro],
  )

  return (
    <Contexto.Provider value={valor}>
      {children}
      {ligado && versaoDaExtensao()
        ? createPortal(
            <div ref={caixa} className="fn-wa-vivo" aria-hidden={!lugar}>
              <iframe
                ref={quadro}
                className="fn-wa-frame"
                src={WHATSAPP + '/'}
                title="WhatsApp Web"
                tabIndex={lugar ? undefined : -1}
                allow="clipboard-read; clipboard-write; microphone; camera; autoplay; fullscreen"
              />
            </div>,
            document.body,
          )
        : null}
      <Modal
        aberto={!!arquivo}
        aoFechar={fecharArquivo}
        titulo={arquivo?.nome ?? ''}
        cheio
        solto
        pe={
          arquivo ? (
            <>
              <Botao onClick={() => window.open(arquivo.url, '_blank')}>Abrir em outra aba</Botao>
              <Botao tom="primario" onClick={() => baixarDaqui(arquivo.url, arquivo.nome)}>
                Baixar
              </Botao>
            </>
          ) : undefined
        }
      >
        {arquivo ? <iframe className="fn-wa-pdf" src={arquivo.url} title={arquivo.nome} /> : null}
      </Modal>
    </Contexto.Provider>
  )
}

/** Baixa pela pagina do Fourtime OS (e nao pelo iframe do WhatsApp). */
function baixarDaqui(url: string, nome: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
}
