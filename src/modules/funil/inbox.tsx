import { useEffect, useState } from 'react'
import { Botao, avisar } from '@ds'
import { formatarTelefone } from '@shared'
import {
  RESPOSTAS,
  iniciais,
  linkDoWhatsApp,
  nomeDoLead,
  preencher,
  tempoCurto,
  type Lead,
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
  aoAbrirCliente,
  aoAbrirCotacao,
  aoMontarCotacao,
  aoRegistrar,
}: {
  lead: Lead | null
  aoAbrirCliente: (id: string) => void
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

  if (!lead) {
    return (
      <aside className="fn-inbox vazio">
        <p>Escolha um lead no quadro para ver a conversa.</p>
      </aside>
    )
  }

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
      </header>

      <div className="fn-in-msgs">
        {l.conversa.map((m) => (
          <div key={m.id} className={m.quem === 'nos' ? 'fn-balao nos' : 'fn-balao'}>
            {m.texto}
            <time>{m.quem === 'nos' && m.lida ? 'lida' : 'há ' + tempoCurto(m.min)}</time>
          </div>
        ))}
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
            Cliente
          </Botao>
        ) : (
          <Botao
            tom="contorno"
            tamanho="sm"
            bloco
            onClick={() => avisar('Criar cliente a partir do lead entra junto com o Supabase', 'info')}
          >
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
