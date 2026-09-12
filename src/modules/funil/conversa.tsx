import { useState } from 'react'
import { Botao, Campo, Entrada, Gaveta, Selo, Seletor, avisar } from '@ds'
import {
  ESTAGIOS,
  NOME_DA_ORIGEM,
  NOME_DO_ESTAGIO,
  RESPOSTAS,
  diasParado,
  esquecido,
  formatarDinheiro,
  linkDoWhatsApp,
  preencher,
  salvarLead,
  type Estagio,
  type Lead,
  type Origem,
} from '@dominio/funil'

/* ==========================================================================
   A conversa do lead.

   Ela abre em folha lateral e nao em modal: quem responde um lead quer poder
   olhar o quadro do lado, e o modal tampa o quadro.

   As respostas rapidas existem porque o que esfria um lead nao e o preco: e a
   demora em mandar a primeira frase. Elas nao enviam sozinhas; elas escrevem a
   frase no campo, com o nome ja trocado, para a pessoa ler antes de mandar.
   ========================================================================== */

const ESTAGIO_OPCOES = ESTAGIOS.map((e) => ({ valor: e, rotulo: NOME_DO_ESTAGIO[e] }))
const ORIGEM_OPCOES = (Object.keys(NOME_DA_ORIGEM) as Origem[]).map((o) => ({
  valor: o,
  rotulo: NOME_DA_ORIGEM[o],
}))

const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function Conversa({
  lead,
  aoFechar,
  aoSalvar,
  aoAbrirCotacao,
  aoMontarCotacao,
}: {
  lead: Lead | null
  aoFechar: () => void
  aoSalvar: (l: Lead) => void
  aoAbrirCotacao: (id: string) => void
  aoMontarCotacao: (l: Lead) => void
}) {
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(false)

  if (!lead) return null
  const l = lead

  const mudar = (parte: Partial<Lead>) => aoSalvar(salvarLead({ ...l, ...parte }))

  function registrar(quem: 'nos' | 'cliente') {
    const t = texto.trim()
    if (!t) {
      avisar('Escreva alguma coisa antes de registrar', 'warn')
      return
    }
    mudar({
      conversa: [
        ...l.conversa,
        { id: 'M' + Date.now(), quem, texto: t, em: new Date().toISOString() },
      ],
    })
    setTexto('')
  }

  const parado = diasParado(l)

  return (
    <Gaveta
      aberto
      aoFechar={aoFechar}
      titulo={l.nome}
      pe={
        <>
          <Botao
            tom="wa"
            onClick={() => {
              const msg = texto.trim() || preencher(RESPOSTAS[0].texto, l)
              window.open(linkDoWhatsApp(l, msg), '_blank', 'noopener')
              /* abrir o WhatsApp e mexer no lead: o relogio zera */
              mudar({
                conversa: [
                  ...l.conversa,
                  { id: 'M' + Date.now(), quem: 'nos', texto: msg, em: new Date().toISOString() },
                ],
              })
              setTexto('')
            }}
          >
            Abrir no WhatsApp
          </Botao>
          <Botao tom="contorno" onClick={() => registrar('cliente')}>
            Anotar resposta dele
          </Botao>
          <Botao tom="forte" onClick={aoFechar}>
            Fechar
          </Botao>
        </>
      }
    >
      <div className="fn-cab">
        <Selo tom={l.estagio === 'ganho' ? 'ok' : l.estagio === 'perdido' ? 'brand' : 'info'}>
          {NOME_DO_ESTAGIO[l.estagio]}
        </Selo>
        <span className={esquecido(l) ? 'fn-dias grita' : 'fn-dias'}>
          {parado === 0 ? 'mexido hoje' : 'parado há ' + parado + ' dias'}
        </span>
      </div>

      <div className="fn-form">
        <Campo rotulo="Situação">
          <Seletor
            bloco
            campo
            valor={l.estagio}
            opcoes={ESTAGIO_OPCOES}
            vazio="Novo"
            aoEscolher={(v) => mudar({ estagio: (v || 'novo') as Estagio })}
          />
        </Campo>
        <Campo rotulo="Origem">
          <Seletor
            bloco
            campo
            valor={l.origem}
            opcoes={ORIGEM_OPCOES}
            vazio="Outro"
            aoEscolher={(v) => mudar({ origem: (v || 'outro') as Origem })}
          />
        </Campo>
      </div>

      {editando ? (
        <div className="fn-form">
          <Campo rotulo="Contato">
            <Entrada value={l.contato} onChange={(e) => mudar({ contato: e.target.value })} />
          </Campo>
          <Campo rotulo="Telefone" dica="Com DDD, só os números">
            <Entrada value={l.telefone} onChange={(e) => mudar({ telefone: e.target.value })} />
          </Campo>
          <Campo rotulo="Cidade">
            <Entrada value={l.cidade} onChange={(e) => mudar({ cidade: e.target.value })} />
          </Campo>
          <Campo rotulo="Vendedor">
            <Entrada value={l.vendedor} onChange={(e) => mudar({ vendedor: e.target.value })} />
          </Campo>
          <Campo rotulo="Peças, por alto">
            <Entrada
              inputMode="numeric"
              value={l.pecas || ''}
              onChange={(e) => mudar({ pecas: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
          </Campo>
          <Campo rotulo="Valor, por alto">
            <Entrada
              inputMode="numeric"
              value={l.valor || ''}
              onChange={(e) => mudar({ valor: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
          </Campo>
        </div>
      ) : (
        <dl className="fn-dados">
          <dt>Contato</dt>
          <dd>{l.contato || 'não preenchido'}</dd>
          <dt>Telefone</dt>
          <dd>{l.telefone || 'não preenchido'}</dd>
          <dt>Cidade</dt>
          <dd>{l.cidade || 'não preenchida'}</dd>
          <dt>Vendedor</dt>
          <dd>{l.vendedor || 'sem dono'}</dd>
          <dt>Conversa vale</dt>
          <dd>
            {l.pecas} peças · {formatarDinheiro(l.valor)}
          </dd>
        </dl>
      )}

      <button type="button" className="fn-editar" onClick={() => setEditando((x) => !x)}>
        {editando ? 'Pronto' : 'Editar os dados'}
      </button>

      <div className="fn-ligacao">
        {l.cotacao ? (
          <Botao tom="contorno" onClick={() => aoAbrirCotacao(l.cotacao)}>
            Abrir a cotação deste lead
          </Botao>
        ) : (
          <Botao tom="contorno" onClick={() => aoMontarCotacao(l)}>
            Montar a cotação deste lead
          </Botao>
        )}
      </div>

      <h3 className="fn-h">Conversa</h3>
      <div className="fn-linha-do-tempo">
        {l.conversa.map((m) => (
          <div key={m.id} className={m.quem === 'nos' ? 'fn-msg nos' : 'fn-msg'}>
            <p>{m.texto}</p>
            <span>{hora(m.em)}</span>
          </div>
        ))}
        {!l.conversa.length ? <p className="fn-vazio">nada dito ainda</p> : null}
      </div>

      <h3 className="fn-h">Respostas rápidas</h3>
      <div className="fn-respostas">
        {RESPOSTAS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="fn-resposta"
            onClick={() => setTexto(preencher(r.texto, l))}
          >
            {r.titulo}
          </button>
        ))}
      </div>

      <Campo rotulo="O que vai ser dito" dica="Nada é enviado sozinho: leia antes de mandar">
        <textarea
          className="entrada fn-escrever"
          rows={4}
          value={texto}
          placeholder="Escreva ou escolha uma resposta rápida"
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
    </Gaveta>
  )
}
