import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { Botao, Pagina, Vazio, avisar } from '@ds'
import { cotacaoNovaDaCasa, proximoNumero, salvarCotacao } from '@dominio/cotacao'
import { pode, souAdmin, useSessao } from '@dominio/sessao'
import {
  ESTAGIO_FECHADO,
  carregarConversa,
  carregarLeads,
  emMil,
  filtrarLeads,
  leadEmBranco,
  leadViraCliente,
  marcarLido,
  moverLead,
  nomeDoLead,
  registrarMensagem,
  salvarLead,
  semResposta,
  type Estagio,
  type FiltroDoFunil,
  type Lead,
  type Mensagem,
  type QuemVer,
} from '@dominio/funil'
import { AvisoDaExtensao, BarraDoFunil, vendedoresDosLeads } from './barra'
import { EditarLead } from './editar'
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

  /* QUEM PODE MEXER. O funil era a unica tela do sistema sem nenhuma checagem:
     quem nao podia arrastava o cartao, via ele pular e via ele voltar quando o
     banco recusava. O RLS sempre segurou, entao nunca foi buraco de seguranca;
     era a tela deixando a pessoa errar para desfazer na frente dela.

     APAGAR E DO ADMIN, e nao de quem edita. A politica da 011 diz isso e o
     motivo esta escrito la: o lead leva a conversa inteira junto, com os
     audios, e quem apaga por engano nao tem como trazer de volta. */
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null
  const podeMexer = !!eu && pode(eu, 'funil', 'editar')
  const podeApagar = souAdmin(eu)

  /* null = fechado. O lead em branco tem id vazio, entao criar e editar sao o
     mesmo formulario. */
  const [editando, setEditando] = useState<Lead | null>(null)

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

  /* ?lead=<id> ABRE AQUELE LEAD. E por onde a coluna lateral da extensao, no
     WhatsApp, traz o vendedor para o cartao da conversa que ele esta lendo.
     O parametro sai da barra depois de usado, senao fechar o inbox e o React
     redesenhar abriria o mesmo lead de novo (o mesmo cuidado de ?abrir= nos
     clientes). */
  const [parametros, setParametros] = useSearchParams()
  const pedidoDeLead = parametros.get('lead') ?? ''
  useEffect(() => {
    if (!pedidoDeLead || carregando) return
    if (leads.some((l) => l.id === pedidoDeLead)) setAbertoId(pedidoDeLead)
    else avisar('Esse lead não está no seu funil', 'warn')
    setParametros(
      (p) => {
        p.delete('lead')
        return p
      },
      { replace: true },
    )
  }, [pedidoDeLead, carregando, leads, setParametros])

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

  /* O FILTRO DO TOPO (prancha 125). "Meus" e o comeco de quem tem lead; quem
     nao tem nenhum (o admin que so olha, o vendedor novo) comeca em "Todos",
     senao abriria o funil num quadro vazio sem entender por que. */
  const [filtro, setFiltro] = useState<Omit<FiltroDoFunil, 'eu' | 'quem'> & { quem: QuemVer | '' }>({
    quem: '',
    busca: '',
    origem: '',
    vendedor: '',
  })
  const contas = useMemo(
    () => ({
      meus: eu ? leads.filter((l) => l.vendedorId === eu.id).length : 0,
      todos: leads.length,
      esperando: leads.filter((l) => semResposta(l, agora)).length,
    }),
    [leads, eu, agora],
  )
  const filtroValendo: FiltroDoFunil = {
    ...filtro,
    eu: eu?.id ?? '',
    quem: filtro.quem || (contas.meus ? 'meus' : 'todos'),
  }
  const visiveis = filtrarLeads(leads, filtroValendo, agora)
  const vendedores = useMemo(() => vendedoresDosLeads(leads), [leads])
  const filtrando = !!(filtro.busca.trim() || filtro.origem || filtro.vendedor)

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
    /* o dono do lead é o vendedor; lead sem dono fica com quem montou */
    const c = await cotacaoNovaDaCasa(await proximoNumero(), eu ? { id: eu.id, nome: eu.nome } : null)
    /* o vendedor sai do banco, e nao de um nome escrito a mao: se ele nao
       estiver na lista, o campo da cotacao abre vazio */
    if (l.vendedorNome) {
      c.vendedor = l.vendedorNome
      c.vendedorId = l.vendedorId || undefined
    }
    c.cliente = {
      ...c.cliente,
      id: l.clienteId,
      nome: l.nomeLivre,
      contato: l.contato,
      telefone: l.telefone,
    }
    /* O LEAD ENTRA NA COTACAO, e e por isso que ela nasce ligada a ele: e essa
       ligacao que faz a venda ser creditada a pessoa certa la no fim, quando o
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

  /* O LEAD VIRA CLIENTE, e depois a tela de clientes abre naquele cliente.

     A funcao do banco e de 11/09 e ficou parada duas semanas atras de um botao
     que avisava "entra junto com o Supabase". Ela ja fazia tudo: achava o
     cliente que ja existe pela chave do nome em vez de criar o segundo, passava
     a carteira ao vendedor do lead e ligava os dois.

     `?abrir=` em vez de rota nova: o destino nao e uma tela de cliente, e a
     LISTA com aquele cliente aberto. Uma rota /clientes/:id prometeria uma
     pagina propria que nao existe, e quem fechasse a ficha cairia numa tela em
     branco em vez de voltar para a lista. */
  async function virarCliente(l: Lead) {
    try {
      const id = await leadViraCliente(l.id)
      await recarregar()
      avisar(nomeDoLead(l) + ' agora tem cadastro de cliente', 'ok')
      navegar('/clientes?abrir=' + encodeURIComponent(id))
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui criar o cliente', 'warn')
    }
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
      titulo="Funil e WhatsApp"
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
        <>
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
          {/* A AÇÃO PRINCIPAL É VERMELHA E VEM POR ÚLTIMO, como manda o V7.
              Enquanto o WhatsApp oficial não entra, é por aqui que a conversa
              que chegou no celular de alguém entra no sistema. */}
          {podeMexer ? (
            <Botao tom="primario" onClick={() => setEditando(leadEmBranco())}>
              <Plus size={17} weight="bold" />
              Novo lead
            </Botao>
          ) : null}
        </>
      }
    >
      <AvisoDaExtensao />

      {!falha && !carregando && leads.length ? (
        <BarraDoFunil
          filtro={filtroValendo}
          aoMudar={(m) => setFiltro((f) => ({ ...f, ...m }))}
          contas={contas}
          vendedores={vendedores}
        />
      ) : null}

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
        <>
          {/* O FILTRO QUE NAO ACHOU NADA DIZ ISSO, em vez de mostrar seis
              colunas vazias que parecem um funil sem lead nenhum. */}
          {leads.length && !visiveis.length ? (
            <Vazio
              titulo={filtroValendo.quem === 'esperando' && !filtrando ? 'Ninguém esperando resposta' : 'Nada com esse filtro'}
              texto={
                filtroValendo.quem === 'meus' && !filtrando
                  ? 'Nenhum lead seu no funil. Os de todo mundo estão em Todos.'
                  : 'Troque o filtro para ver os outros leads.'
              }
              acao={
                <Botao tom="contorno" onClick={() => setFiltro({ quem: 'todos', busca: '', origem: '', vendedor: '' })}>
                  Ver todos
                </Botao>
              }
            />
          ) : null}
          <Quadro
            leads={visiveis}
            aberto={abertoId}
            podeMexer={podeMexer}
            aoMover={mover}
            aoAbrir={abrir}
            aoEditar={(l) => setEditando(l)}
            relogio={agora}
          />
        </>
      )}

      <EditarLead
        lead={editando}
        podeApagar={podeApagar}
        aoFechar={() => setEditando(null)}
        aoSalvar={(l) => {
          setEditando(null)
          void recarregar()
          /* O lead novo abre a conversa na hora. Criar um lead e ter que
             procurar ele na coluna para poder responder seria duas ações para
             uma intenção só. */
          setAbertoId(l.id)
        }}
        aoApagar={(id) => {
          setEditando(null)
          if (abertoId === id) setAbertoId('')
          void recarregar()
        }}
      />

      <Inbox
        lead={aberto}
        conversa={conversa}
        carregandoConversa={carregandoConversa}
        podeMexer={podeMexer}
        aoEditar={(l) => setEditando(l)}
        aoFechar={() => setAbertoId('')}
        aoAbrirCliente={(id) => navegar('/clientes?abrir=' + encodeURIComponent(id))}
        aoVirarCliente={(l) => void virarCliente(l)}
        aoAbrirCotacao={(id) => navegar('/cotacao/' + id)}
        aoMontarCotacao={(l) => void montarCotacao(l)}
        aoRegistrar={(l, texto) => void registrar(l, texto)}
      />
    </Pagina>
  )
}
