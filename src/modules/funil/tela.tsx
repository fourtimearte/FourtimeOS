import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao, Pagina, Vazio, avisar } from '@ds'
import { VENDEDORES } from '@dominio/banco'
import { cotacaoEmBranco, proximoNumero, salvarCotacao } from '@dominio/cotacao'
import {
  ESTAGIO_FECHADO,
  carregarConversa,
  carregarLeads,
  emMil,
  marcarLido,
  moverLead,
  registrarMensagem,
  salvarLead,
  semResposta,
  type Estagio,
  type Lead,
  type Mensagem,
} from '@dominio/funil'
import { Inbox } from './inbox'
import { Quadro } from './quadro'
import './funil.css'

/* ==========================================================================
   Funil e WhatsApp.

   O arranjo e o do v5: o quadro a esquerda, o inbox fixo a direita a partir
   de 1280 px, e os numeros do topo numa linha so, sem cartao de KPI. O titulo
   da tela e "Funil de vendas"; "Funil e WhatsApp" e o nome no menu.

   DUAS LEITURAS, E NAO UMA. O quadro carrega os cartoes; a conversa de UM lead
   e buscada quando alguem abre o inbox. O motivo esta em dominio/funil: trazer
   a troca de mensagens de todo mundo para desenhar cem trechos de uma linha
   seria pagar o audio de cada conversa para mostrar texto.

   O RELOGIO ANDA SOZINHO. Cada minuto a tela se redesenha, porque "47 min sem
   resposta" e uma frase que envelhece: sem isso, o cartao que dizia 47 min as
   nove da manha continuaria dizendo 47 min ao meio-dia.
   ========================================================================== */

const UM_MINUTO = 60_000

export function TelaFunil() {
  const navegar = useNavigate()

  const [leads, setLeads] = useState<Lead[]>([])
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')

  /* Comeca fechado: o quadro e a tela, e a conversa so aparece quando alguem
     clica num cartao para conversar. Enquanto ela nao abre, o kanban ocupa a
     largura inteira. */
  const [abertoId, setAbertoId] = useState('')
  const [conversa, setConversa] = useState<Mensagem[]>([])
  const [carregandoConversa, setCarregandoConversa] = useState(false)

  /* O relogio da tela. Ele nao busca nada: so faz a conta do tempo ser refeita,
     porque o que envelhece e a leitura do relogio, e nao o dado. */
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), UM_MINUTO)
    return () => clearInterval(t)
  }, [])

  const recarregar = useCallback(async () => {
    try {
      setLeads(await carregarLeads())
      setFalha('')
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui carregar o funil.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const aberto = leads.find((l) => l.id === abertoId) ?? null

  /* A conversa segue o cartao aberto. Trocar de cartao esvazia antes de buscar:
     mostrar a conversa do lead anterior enquanto a nova carrega e o jeito
     classico de alguem responder a pessoa errada. */
  useEffect(() => {
    if (!abertoId) {
      setConversa([])
      return
    }
    let vivo = true
    setConversa([])
    setCarregandoConversa(true)
    carregarConversa(abertoId)
      .then((c) => vivo && setConversa(c))
      .catch(() => vivo && setConversa([]))
      .finally(() => vivo && setCarregandoConversa(false))
    return () => {
      vivo = false
    }
  }, [abertoId])

  const resumo = useMemo(() => {
    const ativos = leads.filter((l) => !ESTAGIO_FECHADO.includes(l.estagio))
    return {
      ativos: ativos.length,
      valor: ativos.reduce((s, l) => s + l.valor, 0),
      calados: leads.filter((l) => semResposta(l, agora)).length,
      naoLidas: leads.reduce((s, l) => s + l.novo, 0),
    }
  }, [leads, agora])

  function abrir(l: Lead) {
    setAbertoId(l.id)
    if (!l.novo) return
    /* O contador vermelho some na hora, e a gravacao vai atras. Abrir uma
       conversa e ler: fazer a pessoa esperar o banco para o numero sumir seria
       cobrar meio segundo por um clique que ela vai dar cem vezes por dia. */
    setLeads((atuais) => atuais.map((x) => (x.id === l.id ? { ...x, novo: 0 } : x)))
    marcarLido(l.id).catch(() => void recarregar())
  }

  async function mover(id: string, estagio: Estagio) {
    const antes = leads
    setLeads((atuais) =>
      atuais.map((x) => (x.id === id ? { ...x, estagio, novo: 0 } : x)),
    )
    try {
      const salvo = await moverLead(id, estagio)
      if (salvo) setLeads((atuais) => atuais.map((x) => (x.id === id ? salvo : x)))
      if (estagio === 'fechado') {
        avisar('Fechado. A cotação aprovada vira ficha de produção na fase 2.', 'ok')
      }
    } catch (e) {
      /* O cartao volta para a coluna de onde saiu. Deixar ele na coluna nova
         depois de o banco recusar seria a tela mentindo sobre onde o lead
         esta, e num quadro que a equipe inteira olha isso vira briga. */
      setLeads(antes)
      avisar(e instanceof Error ? e.message : 'Não consegui mover o lead', 'warn')
    }
  }

  /* A cotacao nasce do lead com o que ja se sabe, e o lead passa a apontar
     para ela. E aqui que o funil encosta na cotacao, e so aqui. */
  async function montarCotacao(l: Lead) {
    const c = cotacaoEmBranco(await proximoNumero())
    /* o vendedor sai do banco, e nao de um nome escrito a mao: se ele nao
       estiver na lista, o campo da cotacao abre vazio */
    c.vendedor = l.vendedorNome || VENDEDORES[0]
    c.cliente = {
      ...c.cliente,
      id: l.clienteId,
      nome: l.nomeLivre,
      contato: l.contato,
      telefone: l.telefone,
    }
    /* O LEAD ENTRA NA COTACAO, e e por isso que ela nasce ligada a ele: e essa
       ligacao que faz a comissao chegar na pessoa certa la no fim, quando o
       pedido for aprovado. */
    let salva
    try {
      salva = await salvarCotacao(c, { leadId: l.id })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui criar a cotação', 'warn')
      return
    }
    try {
      await salvarLead({
        ...l,
        estagio: l.estagio === 'novo' || l.estagio === 'atendimento' ? 'cotacao' : l.estagio,
      })
      await recarregar()
    } catch {
      /* a cotacao ja existe; o estagio do lead pode ser arrastado a mao */
    }
    avisar('Cotação ' + salva.numero + ' criada a partir do lead', 'ok')
    navegar('/cotacao/' + salva.id)
  }

  /* o que foi mandado pelo WhatsApp entra na conversa, senao o funil mente
     sobre quem falou por ultimo */
  async function registrar(l: Lead, texto: string) {
    try {
      setConversa(await registrarMensagem(l.id, texto))
      await recarregar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui registrar a mensagem', 'warn')
    }
  }

  return (
    <Pagina
      acima="Comercial"
      titulo="Funil de vendas"
      sub={
        carregando
          ? 'Carregando o funil...'
          : resumo.ativos +
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
          disabled={!leads.length}
        >
          Inbox
          {resumo.naoLidas ? <span className="fn-novo no-botao">{resumo.naoLidas}</span> : null}
        </Botao>
      }
    >
      {falha ? (
        <Vazio
          titulo="Não consegui carregar o funil"
          texto={falha}
          acao={
            <Botao
              tom="forte"
              onClick={() => {
                setCarregando(true)
                void recarregar()
              }}
            >
              Tentar de novo
            </Botao>
          }
        />
      ) : (
        <Quadro leads={leads} aberto={abertoId} aoMover={mover} aoAbrir={abrir} relogio={agora} />
      )}

      <Inbox
        lead={aberto}
        conversa={conversa}
        carregandoConversa={carregandoConversa}
        aoFechar={() => setAbertoId('')}
        aoAbrirCliente={() => navegar('/clientes')}
        aoAbrirCotacao={(id) => navegar('/cotacao/' + id)}
        aoMontarCotacao={(l) => void montarCotacao(l)}
        aoRegistrar={(l, texto) => void registrar(l, texto)}
      />
    </Pagina>
  )
}
