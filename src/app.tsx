import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarCheck,
  ChartBar,
  ClipboardText,
  Database,
  DotsThree,
  Factory,
  Gear,
  House,
  Kanban,
  Moon,
  Package,
  Palette,
  Receipt,
  SignOut,
  Sun,
  TShirt,
  Users,
} from '@phosphor-icons/react'
import {
  aplicarTema,
  BuscaGlobal,
  Casca,
  PilhaDeRecados,
  RedeDeSeguranca,
  temaAtual,
  usarAtalhoDaBusca,
  type ItemBusca,
  type ItemDeNavegacao,
  type SecaoDeNavegacao,
  type Tema,
} from '@ds'
import { iniciaisDe, primeiroNome, useSessao } from '@dominio/sessao'
import { ESTAGIO_FECHADO, listarLeads } from '@dominio/funil'

/* Esta e a raiz que monta o sistema: o unico lugar que conhece a casca, o
   roteador e a lista de modulos ao mesmo tempo. A casca em si nao sabe o que e
   cotacao nem o que e kanban: ela recebe a lista pronta. */
export function App() {
  const navegar = useNavigate()
  const local = useLocation()
  const { estado, sair } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const [encolhida, setEncolhida] = useState(() => {
    try {
      return localStorage.getItem('ft.menu') === 'encolhido'
    } catch {
      return false
    }
  })
  const [tema, setTema] = useState<Tema>(() => temaAtual())
  const [busca, setBusca] = useState(false)
  usarAtalhoDaBusca(useCallback(() => setBusca(true), []))

  useEffect(() => {
    try {
      localStorage.setItem('ft.menu', encolhida ? 'encolhido' : 'aberto')
    } catch {
      /* armazenamento bloqueado: vale so nesta aba */
    }
  }, [encolhida])

  /* o kit tem o seu proprio controle de tema: ao voltar de la, o icone do topo
     precisa concordar com o que esta na tela */
  useEffect(() => {
    setTema(temaAtual())
  }, [local.pathname])

  function trocarTema() {
    const novo: Tema = tema === 'dark' ? 'light' : 'dark'
    setTema(novo)
    aplicarTema(novo)
  }

  const ligado = (para: string) =>
    para === '/' ? local.pathname === '/' : local.pathname.startsWith(para)

  const icone = { size: 20, weight: 'regular' as const }

  /* o contador do funil e o do v5: leads que ainda andam. Os do kanban e do
     estoque so aparecem quando os modulos existirem, porque numero inventado
     em contador de menu e pior que contador nenhum */
  const leadsAtivos = listarLeads().filter((l) => !ESTAGIO_FECHADO.includes(l.estagio)).length

  /* Os doze destinos do v5, na ordem e com os nomes dele. O Design System e a
     unica linha que nao esta no mockup: ele e ferramenta nossa, e sem ele o
     /kit fica inalcancavel pelo menu. */
  const secoes: SecaoDeNavegacao[] = [
    {
      titulo: 'Comercial',
      itens: [
        { para: '/', rotulo: 'Início', icone: <House {...icone} /> },
        {
          para: '/funil',
          rotulo: 'Funil e WhatsApp',
          icone: <Kanban {...icone} />,
          contagem: leadsAtivos || undefined,
        },
        { para: '/clientes', rotulo: 'Clientes', icone: <Users {...icone} /> },
        { para: '/cotacao', rotulo: 'Cotação de venda', icone: <Receipt {...icone} /> },
      ],
    },
    {
      titulo: 'Produção',
      itens: [
        { para: '/ficha', rotulo: 'Ficha de produção', icone: <ClipboardText {...icone} /> },
        { para: '/kanban', rotulo: 'Kanban de produção', icone: <Factory {...icone} /> },
        { para: '/produtos', rotulo: 'Fichas técnicas', icone: <TShirt {...icone} /> },
        { para: '/estoque', rotulo: 'Estoque', icone: <Package {...icone} /> },
      ],
    },
    {
      titulo: 'Gestão',
      itens: [
        { para: '/atividades', rotulo: 'Painel de atividades', icone: <CalendarCheck {...icone} /> },
        { para: '/relatorio', rotulo: 'Relatório mensal', icone: <ChartBar {...icone} /> },
        { para: '/banco', rotulo: 'Banco de dados', icone: <Database {...icone} /> },
        { para: '/config', rotulo: 'Configurações', icone: <Gear {...icone} /> },
        { para: '/kit', rotulo: 'Design System', icone: <Palette {...icone} /> },
      ],
    },
  ]

  /* cinco destinos na barra de baixo, os mesmos do v5 */
  const rodapeNav: ItemDeNavegacao[] = [
    { para: '/', rotulo: 'Início', icone: <House size={22} /> },
    { para: '/funil', rotulo: 'Vendas', icone: <Kanban size={22} /> },
    { para: '/kanban', rotulo: 'Produção', icone: <Factory size={22} /> },
    { para: '/atividades', rotulo: 'Semana', icone: <CalendarCheck size={22} /> },
    { para: '/config', rotulo: 'Mais', icone: <DotsThree size={22} /> },
  ]

  const itensDaBusca: ItemBusca[] = secoes.flatMap((s) =>
    s.itens.map((i) => ({
      id: i.para,
      grupo: 'Telas',
      titulo: i.rotulo,
      lado: 'ir para',
      aoEscolher: () => navegar(i.para),
    })),
  )

  return (
    <>
      <Casca
        encolhida={encolhida}
        aoEncolher={() => setEncolhida((e) => !e)}
        secoes={secoes}
        rodapeNav={rodapeNav}
        ligado={ligado}
        Link={Link}
        aoAbrirBusca={() => setBusca(true)}
        acoesDoTopo={
          <>
            <button
              type="button"
              className="bt-icone"
              onClick={trocarTema}
              aria-label={tema === 'dark' ? 'Ir para o tema Gelo' : 'Ir para o tema Grafite'}
              title={tema === 'dark' ? 'Tema Gelo' : 'Tema Grafite'}
            >
              {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button type="button" className="bt-icone" aria-label="Avisos" title="Avisos">
              <Bell size={20} />
              <span className="sinal" />
            </button>
            <button
              type="button"
              className="pessoa"
              title={pessoa ? `${pessoa.nome} · sair` : 'Sair'}
              aria-label={pessoa ? `${primeiroNome(pessoa.nome)}, sair do sistema` : 'Sair'}
              onClick={() => {
                void sair()
              }}
            >
              {pessoa ? iniciaisDe(pessoa.nome) : '··'}
            </button>
          </>
        }
        rodapeDoLado={
          <button
            type="button"
            className="bt-icone"
            aria-label="Sair"
            title="Sair"
            onClick={() => {
              void sair()
            }}
          >
            <SignOut size={18} />
          </button>
        }
      >
        {/* a rede fica DENTRO da casca: quando uma tela cai, o menu continua
            de pe e da para ir para outro lugar sem recarregar nada */}
        <RedeDeSeguranca aoVoltar={() => navegar('/')}>
          <Outlet />
        </RedeDeSeguranca>
      </Casca>

      <BuscaGlobal aberto={busca} aoFechar={() => setBusca(false)} itens={itensDaBusca} />
      <PilhaDeRecados />
    </>
  )
}
