import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso, Botao, Pagina, avisar } from '@ds'
import { cotacaoEmBranco, proximoNumero, salvarCotacao } from '@dominio/cotacao'
import {
  DADO_DE_EXEMPLO,
  ESTAGIO_FECHADO,
  emMil,
  listarLeads,
  marcarLido,
  moverLead,
  salvarLead,
  semResposta,
  type Estagio,
  type Lead,
} from '@dominio/funil'
import { Inbox } from './inbox'
import { Quadro } from './quadro'
import './funil.css'

/* ==========================================================================
   Funil e WhatsApp.

   O arranjo e o do v5: o quadro a esquerda, o inbox fixo a direita a partir
   de 1280 px, e os numeros do topo numa linha so, sem cartao de KPI. O titulo
   da tela e "Funil de vendas"; "Funil e WhatsApp" e o nome no menu.
   ========================================================================== */

export function TelaFunil() {
  const navegar = useNavigate()
  const [versao, setVersao] = useState(0)
  const leads = useMemo(() => listarLeads(), [versao])
  const [abertoId, setAbertoId] = useState(leads[0]?.id ?? '')

  const aberto = leads.find((l) => l.id === abertoId) ?? leads[0] ?? null

  const resumo = useMemo(() => {
    const ativos = leads.filter((l) => !ESTAGIO_FECHADO.includes(l.estagio))
    return {
      ativos: ativos.length,
      valor: ativos.reduce((s, l) => s + l.valor, 0),
      calados: leads.filter(semResposta).length,
      naoLidas: leads.reduce((s, l) => s + l.novo, 0),
    }
  }, [leads])

  const mexeu = () => setVersao((v) => v + 1)

  function abrir(l: Lead) {
    setAbertoId(l.id)
    if (l.novo) {
      marcarLido(l.id)
      mexeu()
    }
  }

  function mover(id: string, estagio: Estagio) {
    moverLead(id, estagio)
    mexeu()
    if (estagio === 'fechado') {
      avisar('Fechado. A cotação aprovada vira ficha de produção na fase 2.', 'ok')
    }
  }

  /* A cotacao nasce do lead com o que ja se sabe, e o lead passa a apontar
     para ela. E aqui que o funil encosta na cotacao, e so aqui. */
  function montarCotacao(l: Lead) {
    const c = cotacaoEmBranco(proximoNumero())
    c.vendedor = 'Carla'
    c.cliente = {
      ...c.cliente,
      id: l.clienteId,
      nome: l.nomeLivre,
      contato: l.contato,
      telefone: l.telefone,
    }
    salvarCotacao(c)
    salvarLead({
      ...l,
      cotacao: c.id,
      estagio: l.estagio === 'novo' || l.estagio === 'atendimento' ? 'cotacao' : l.estagio,
    })
    mexeu()
    avisar('Cotação ' + c.numero + ' criada a partir do lead', 'ok')
    navegar('/cotacao/' + c.id)
  }

  /* o que foi mandado pelo WhatsApp entra na conversa, senao o funil mente
     sobre quem falou por ultimo */
  function registrar(l: Lead, texto: string) {
    salvarLead({
      ...l,
      msg: texto,
      min: 0,
      novo: 0,
      conversa: [
        ...l.conversa,
        { id: 'm' + Date.now(), quem: 'nos', texto, min: 0, lida: false },
      ],
    })
    mexeu()
  }

  return (
    <Pagina
      acima="Comercial"
      titulo="Funil de vendas"
      sub={
        resumo.ativos +
        ' leads ativos · ' +
        emMil(resumo.valor) +
        ' em negociação · ' +
        resumo.calados +
        ' sem resposta há mais de 1 h'
      }
      acoes={
        <Botao
          tom="wa"
          onClick={() => {
            const primeiro = leads.find((l) => l.novo) ?? leads[0]
            if (primeiro) abrir(primeiro)
          }}
        >
          Inbox
          {resumo.naoLidas ? <span className="fn-novo no-botao">{resumo.naoLidas}</span> : null}
        </Botao>
      }
    >
      {DADO_DE_EXEMPLO ? (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Aviso tom="info" titulo="Estes leads são inventados">
            São os mesmos oito do mockup, com os mesmos textos e valores, para dar para conferir a
            tela contra o desenho. O botão do WhatsApp é de verdade: ele abre a conversa com o texto
            pronto, e nada sai sem você mandar.
          </Aviso>
        </div>
      ) : null}

      <div className="fn-tela">
        <div className="fn-esquerda">
          <Quadro leads={leads} aberto={abertoId} aoMover={mover} aoAbrir={abrir} />
        </div>
        <Inbox
          lead={aberto}
          aoAbrirCliente={() => navegar('/clientes')}
          aoAbrirCotacao={(id) => navegar('/cotacao/' + id)}
          aoMontarCotacao={montarCotacao}
          aoRegistrar={registrar}
        />
      </div>
    </Pagina>
  )
}
