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

  /* o pedido do quadro vai para o WhatsApp assim que ele estiver de pe */
  const ultimoPedido = useRef(0)
  useEffect(() => {
    if (!pedido || !pronto || pedido.marca === ultimoPedido.current) return
    ultimoPedido.current = pedido.marca
    quadro.current?.contentWindow?.postMessage(
      { fourtime: 'pedido', tipo: 'abrir', telefone: pedido.telefone, texto: pedido.texto },
      WHATSAPP,
    )
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
        <header className="fn-wa-faixa">
          <span className={pronto ? 'fn-wa-ponto ligado' : 'fn-wa-ponto'} aria-hidden="true" />
          <b>WhatsApp</b>
          <small>
            {pronto
              ? 'o WhatsApp Web de verdade, aberto aqui dentro'
              : 'abrindo o WhatsApp Web... na primeira vez, escaneie o QR Code com o celular'}
          </small>
          {recarregou ? <small className="fn-wa-nota">trocou de conversa recarregando</small> : null}
        </header>
        <iframe
          ref={quadro}
          className="fn-wa-frame"
          src={WHATSAPP + '/'}
          title="WhatsApp Web"
          allow="clipboard-read; clipboard-write; microphone; camera; autoplay; fullscreen"
        />
      </section>

      <aside className="fn-wa-lado" aria-label="O lead desta conversa">
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
      </aside>
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
}: {
  lead: Lead
  podeMexer: boolean
  relogio: number
  aoAbrirNoQuadro: (l: Lead) => void
  aoMontarCotacao: (l: Lead) => void
  aoAbrirCotacao: (id: string) => void
  aoMover: (id: string, e: Estagio) => void
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
