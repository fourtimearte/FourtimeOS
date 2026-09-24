import { useEffect, useState } from 'react'
import { Botao, avisar } from '@ds'
import { formatarTelefone } from '@shared'
import {
  RESPOSTAS,
  iniciais,
  janelaApertada,
  janelaDaConversa,
  linkDoWhatsApp,
  nomeDoLead,
  minutosDesde,
  preencher,
  tempoCurto,
  type Lead,
  type Mensagem,
} from '@dominio/funil'

/* ==========================================================================
   O inbox do WhatsApp, colado no funil.

   No v5 ele nao e uma gaveta que abre e fecha: ele fica ali, a direita, o
   tempo todo, e trocar de lead so troca o que ele mostra. E de proposito, e e
   a diferenca entre um quadro de CRM e a tela onde a pessoa realmente
   trabalha: quem responde WhatsApp o dia inteiro nao quer abrir e fechar nada.

   Nada e enviado daqui. O botao abre a conversa no WhatsApp com o texto
   pronto, que foi a decisao 1 do passo 1: wa.me agora, API oficial depois.
   ========================================================================== */

export function Inbox({
  lead,
  aoFechar,
  aoAbrirCliente,
  aoVirarCliente,
  aoAbrirCotacao,
  aoMontarCotacao,
  aoRegistrar,
  conversa,
  carregandoConversa,
}: {
  lead: Lead | null
  /* A conversa vem de cima, e não de dentro. O quadro já carrega os cartões;
     a troca de mensagens é uma segunda leitura que só acontece quando esta
     gaveta abre, e quem decide quando ela abre é a tela. */
  conversa: Mensagem[]
  carregandoConversa: boolean
  aoFechar: () => void
  aoAbrirCliente: (id: string) => void
  aoVirarCliente: (l: Lead) => void
  aoAbrirCotacao: (numero: string) => void
  aoMontarCotacao: (l: Lead) => void
  aoRegistrar: (l: Lead, texto: string) => void
}) {
  const [texto, setTexto] = useState('')

  /* trocar de lead limpa o que estava escrito: mandar para o errado e o tipo
     de erro que nao tem desfazer */
  useEffect(() => {
    setTexto('')
  }, [lead?.id])

  /* Esc fecha, como qualquer coisa que abre por cima */
  useEffect(() => {
    if (!lead) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [lead, aoFechar])

  if (!lead) return null

  const l = lead

  return (
    <aside className="fn-inbox">
      <header className="fn-in-topo">
        <span className="fn-avatar">{iniciais(nomeDoLead(l))}</span>
        <span className="fn-in-quem">
          <b>{nomeDoLead(l)}</b>
          <small>
            {formatarTelefone(l.telefone)}
            {l.contato ? ' · ' + l.contato : ''}
          </small>
        </span>
        <button type="button" className="fn-in-fechar" onClick={aoFechar} aria-label="Fechar a conversa" title="Fechar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* A JANELA DE 24 HORAS MORA AQUI, e nao no cartao do quadro.

          Ela responde uma pergunta que so existe na hora de escrever, e o
          quadro ja carrega numero, nome, tag, mensagem, valor e tempo. Mais uma
          pilula la seria uma informacao que nao muda nada enquanto o olho varre
          a coluna.

          E ela NAO TRANCA o envio. Hoje a mensagem sai pelo WhatsApp da propria
          pessoa, onde a regra das 24 horas nao existe: ela e da API oficial.
          Trancar agora seria inventar uma trava que a Meta nao aplica neste
          caminho, e ensinar a equipe a ignorar o aviso antes do dia em que ele
          passa a valer. */}
      <Janela lead={l} />

      <div className="fn-in-msgs">
        {carregandoConversa ? (
          <p className="fn-in-vazio">Buscando a conversa...</p>
        ) : conversa.length ? (
          conversa.map((m) => (
            <div key={m.id} className={m.quem === 'nos' ? 'fn-balao nos' : 'fn-balao'}>
              {m.texto}
              <time>
                {m.quem === 'nos' && m.lida ? 'lida' : 'há ' + tempoCurto(minutosDesde(m.em))}
              </time>
            </div>
          ))
        ) : (
          <p className="fn-in-vazio">
            Nenhuma mensagem registrada ainda. O que você mandar por aqui fica gravado na
            conversa.
          </p>
        )}
      </div>

      <div className="fn-in-rapidas">
        {RESPOSTAS.map((r) => (
          <button key={r.id} type="button" onClick={() => setTexto(preencher(r.texto, l))}>
            {r.titulo}
          </button>
        ))}
      </div>

      <div className="fn-in-escrever">
        <input
          className="entrada"
          value={texto}
          placeholder="Escreva uma mensagem"
          onChange={(e) => setTexto(e.target.value)}
        />
        <button
          type="button"
          className="fn-in-enviar"
          aria-label="Abrir no WhatsApp com este texto"
          title="Abrir no WhatsApp com este texto"
          onClick={() => {
            const t = texto.trim()
            if (!t) {
              avisar('Escreva ou escolha uma resposta rápida antes', 'warn')
              return
            }
            window.open(linkDoWhatsApp(l, t), '_blank', 'noopener')
            aoRegistrar(l, t)
            setTexto('')
          }}
        >
          <Aviao />
        </button>
      </div>

      <div className="fn-in-acoes">
        {l.clienteId ? (
          <Botao tom="contorno" tamanho="sm" bloco onClick={() => aoAbrirCliente(l.clienteId)}>
            Ver cliente
          </Botao>
        ) : (
          <Botao tom="contorno" tamanho="sm" bloco onClick={() => aoVirarCliente(l)}>
            Criar cliente
          </Botao>
        )}
        {l.cotacao ? (
          <Botao tom="primario" tamanho="sm" bloco onClick={() => aoAbrirCotacao(l.cotacao)}>
            Ver cotação
          </Botao>
        ) : (
          <Botao tom="primario" tamanho="sm" bloco onClick={() => aoMontarCotacao(l)}>
            Criar cotação
          </Botao>
        )}
      </div>
    </aside>
  )
}

/* --- a faixa da janela ---------------------------------------------------- */
function Janela({ lead }: { lead: Lead }) {
  const j = janelaDaConversa(lead)
  /* Lead que nunca recebeu fala de cliente nunca teve janela. Desenhar "sem
     janela" seria ocupar uma faixa para dizer que nada aconteceu. */
  if (j.estado === 'sem') return null

  const quanto = tempoCurto(j.minutos)
  return (
    <p className={'fn-janela ' + (j.estado === 'fechada' ? 'fechada' : janelaApertada(j) ? 'aperta' : '')}>
      <Ampulheta />
      {j.estado === 'aberta' ? (
        <>
          <b>A janela fecha em {quanto}</b>
          <span>contando da última mensagem do cliente</span>
        </>
      ) : (
        <>
          <b>Janela fechada há {quanto}</b>
          <span>pela API oficial só valeria modelo aprovado; pelo WhatsApp normal, manda</span>
        </>
      )}
    </p>
  )
}

function Ampulheta() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3h10M7 21h10M8 3v3.2a4 4 0 0 0 1.5 3.1L12 12l-2.5 2.7A4 4 0 0 0 8 17.8V21M16 3v3.2a4 4 0 0 1-1.5 3.1L12 12l2.5 2.7a4 4 0 0 1 1.5 3.1V21"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Aviao() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}
