import { useEffect, useMemo, useRef, useState } from 'react'
import { Kanban } from '@phosphor-icons/react'
import { Botao, Seletor } from '@ds'
import { formatarTelefone, versaoDaExtensao } from '@shared'
import {
  ESTAGIOS,
  ESTAGIO_FECHADO,
  NOME_DO_ESTAGIO,
  fichaDoSite,
  minutosDesde,
  nomeDoLead,
  semResposta,
  seloDaOrigem,
  tempoCurto,
  temFichaDoSite,
  type Estagio,
  type Lead,
} from '@dominio/funil'
import { AvisoDaExtensao } from './barra'

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

   A COLUNA DA DIREITA e o lead do telefone da conversa aberta. Quem conta qual
   conversa esta aberta e a extensao, por mensagem entre janelas, e so o
   telefone: o texto das mensagens nao sai do WhatsApp.

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
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [])

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

  /* A COLUNA NUNCA FICA VAZIA (pedido do Henrique, 12/10/2026): quem esta
     esperando resposta e quem chegou pelo site, a um clique de abrir a
     conversa no WhatsApp ao lado. O lead da conversa aberta sai das listas. */
  const esperando = leads
    .filter((l) => l.id !== lead?.id && l.telefone && semResposta(l, relogio))
    .sort((a, b) => minutosDesde(b.ultimaMsgEm, relogio) - minutosDesde(a.ultimaMsgEm, relogio))
    .slice(0, 8)
  const doSite = leads
    .filter((l) => l.id !== lead?.id && l.telefone && l.origem === 'site-chat' && l.estagio === 'novo')
    .filter((l) => !esperando.includes(l))
    .slice(0, 6)
  const comPais = (t: string) => {
    const n = t.replace(/\D/g, '')
    return n.startsWith('55') ? n : '55' + n
  }

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

      <aside className="fn-wa-lado" aria-label="O lead desta conversa">
        {/* o estado do WhatsApp, que antes era uma faixa escura em cima dele */}
        <p className="fn-wa-status">
          <span className={pronto ? 'fn-wa-ponto ligado' : 'fn-wa-ponto'} aria-hidden="true" />
          {pronto ? 'WhatsApp aberto aqui dentro' : 'Abrindo o WhatsApp... na primeira vez, escaneie o QR Code'}
          {recarregou ? <small>trocou de conversa recarregando</small> : null}
        </p>
        {!conversa.jid && !conversa.telefone ? (
          <p className="fn-in-vazio">Abra uma conversa no WhatsApp e o lead dela aparece aqui.</p>
        ) : conversa.jid.endsWith('@g.us') ? (
          <p className="fn-in-vazio">Grupo não é lead. A extensão não lê grupos.</p>
        ) : !conversa.telefone ? (
          <p className="fn-in-vazio">O WhatsApp não mostrou o número desta conversa.</p>
        ) : lead ? (
          <LadoDoLead
            lead={lead}
            podeMexer={podeMexer}
            relogio={relogio}
            aoAbrirNoQuadro={aoAbrirNoQuadro}
            aoMontarCotacao={aoMontarCotacao}
            aoAbrirCotacao={aoAbrirCotacao}
            aoMover={aoMover}
            aoVirarCliente={aoVirarCliente}
            aoAbrirCliente={aoAbrirCliente}
          />
        ) : (
          <div className="pilha fn-wa-bloco">
            <span className="fn-wa-rot">{formatarTelefone(conversa.telefone.replace(/^55/, ''))}</span>
            <h2 className="fn-wa-nome">Não é lead nem cliente</h2>
            <p className="fn-wa-apoio">Conversa de fora do funil. Nada dela é registrado.</p>
            {podeMexer ? (
              <Botao tom="contorno" onClick={() => aoCriarLead(conversa.telefone)}>
                Criar lead com este telefone
              </Botao>
            ) : null}
          </div>
        )}

        {esperando.length ? (
          <ListaDeConversas
            titulo="Esperando resposta"
            leads={esperando}
            relogio={relogio}
            atrasado
            aoAbrir={(l) => pedir(comPais(l.telefone))}
          />
        ) : null}
        {doSite.length ? (
          <ListaDeConversas
            titulo="Novos do site"
            leads={doSite}
            relogio={relogio}
            aoAbrir={(l) => pedir(comPais(l.telefone))}
          />
        ) : null}
      </aside>
    </div>
  )
}

function ListaDeConversas({
  titulo,
  leads,
  relogio,
  atrasado,
  aoAbrir,
}: {
  titulo: string
  leads: Lead[]
  relogio: number
  atrasado?: boolean
  aoAbrir: (l: Lead) => void
}) {
  return (
    <div className="pilha fn-wa-bloco">
      <span className="fn-wa-rot">
        {titulo} <span className="fn-seg-n">{leads.length}</span>
      </span>
      <ul className="fn-wa-lista">
        {leads.map((l) => (
          <li key={l.id}>
            <button type="button" className="fn-wa-item" onClick={() => aoAbrir(l)} title="Abrir a conversa no WhatsApp">
              <span className="corta">{nomeDoLead(l)}</span>
              <small className={atrasado ? 'fn-tempo atrasado' : 'fn-tempo'}>
                {l.ultimaMsgEm ? 'há ' + tempoCurto(minutosDesde(l.ultimaMsgEm, relogio)) : ''}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LadoDoLead({
  lead: l,
  podeMexer,
  relogio,
  aoAbrirNoQuadro,
  aoMontarCotacao,
  aoAbrirCotacao,
  aoMover,
  aoVirarCliente,
  aoAbrirCliente,
}: {
  lead: Lead
  podeMexer: boolean
  relogio: number
  aoAbrirNoQuadro: (l: Lead) => void
  aoMontarCotacao: (l: Lead) => void
  aoAbrirCotacao: (id: string) => void
  aoMover: (id: string, e: Estagio) => void
  aoVirarCliente: (l: Lead) => void
  aoAbrirCliente: (id: string) => void
}) {
  const pedido = temFichaDoSite(l) ? fichaDoSite(l).find((b) => b.titulo === 'O pedido') : undefined
  return (
    <>
      <div className="pilha fn-wa-bloco">
        <span className="fn-wa-rot">Desta conversa, no Fourtime OS</span>
        <h2 className="fn-wa-nome">{nomeDoLead(l)}</h2>
        <span className="fn-wa-apoio">
          {[l.contato, formatarTelefone(l.telefone)].filter(Boolean).join(' · ')}
        </span>
        <span className="fn-etapa">
          <span className="nome">{NOME_DO_ESTAGIO[l.estagio]}</span>
          {seloDaOrigem(l) ? <span className="fn-origem">{seloDaOrigem(l)}</span> : null}
          {l.prioridade ? <span className="fn-origem prioridade">PRIORIDADE</span> : null}
          {l.teste ? <span className="fn-origem teste">TESTE</span> : null}
        </span>
      </div>

      <div className="pilha fn-wa-bloco">
        <dl className="pilha fn-wa-dl">
          <div className="fn-ficha-linha">
            <dt>Vendedor</dt>
            <dd>{l.vendedorNome || 'sem dono'}</dd>
          </div>
          {l.ultimaMsgEm ? (
            <div className="fn-ficha-linha">
              <dt>{semResposta(l, relogio) ? 'Esperando' : 'Última fala'}</dt>
              <dd className={semResposta(l, relogio) ? 'fn-tempo atrasado' : ''}>
                há {tempoCurto(minutosDesde(l.ultimaMsgEm, relogio))}
              </dd>
            </div>
          ) : null}
        </dl>
        {podeMexer ? (
          <Seletor
            campo
            rotulo="ETAPA"
            valor={l.estagio}
            vazio={NOME_DO_ESTAGIO[l.estagio]}
            opcoes={ESTAGIOS.map((e) => ({ valor: e, rotulo: NOME_DO_ESTAGIO[e] }))}
            aoEscolher={(e) => e && e !== l.estagio && aoMover(l.id, e as Estagio)}
          />
        ) : null}
        <div className="fileira">
          {l.cotacao ? (
            <Botao tom="primario" onClick={() => aoAbrirCotacao(l.cotacao)}>
              Ver cotação
            </Botao>
          ) : (
            <Botao tom="primario" onClick={() => aoMontarCotacao(l)}>
              Montar cotação
            </Botao>
          )}
          {l.clienteId ? (
            <Botao tom="contorno" onClick={() => aoAbrirCliente(l.clienteId)}>
              Ver cliente
            </Botao>
          ) : (
            <Botao tom="contorno" onClick={() => aoVirarCliente(l)}>
              Cadastrar cliente
            </Botao>
          )}
          <Botao tom="contorno" onClick={() => aoAbrirNoQuadro(l)}>
            <Kanban size={17} />
            Abrir no quadro
          </Botao>
        </div>
      </div>

      {pedido && pedido.linhas.length ? (
        <div className="pilha fn-wa-bloco">
          <span className="fn-wa-rot">O pedido do site</span>
          <dl className="pilha fn-wa-dl">
            {pedido.linhas.map((x) => (
              <div key={x.rotulo} className="fn-ficha-linha">
                <dt>{x.rotulo}</dt>
                <dd>{x.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="pilha fn-wa-bloco">
        <p className="fn-wa-apoio">
          A foto, o áudio e o vídeo ficam no WhatsApp. Para mandar uma arte para o pedido, baixe do
          WhatsApp e anexe na cotação.
        </p>
      </div>
    </>
  )
}
