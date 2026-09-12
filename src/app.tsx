import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ClipboardText,
  Factory,
  Funnel,
  House,
  Moon,
  Package,
  Palette,
  Receipt,
  SignOut,
  Sun,
  Users,
} from '@phosphor-icons/react'
import {
  aplicarTema,
  BuscaGlobal,
  Casca,
  PilhaDeRecados,
  temaAtual,
  usarAtalhoDaBusca,
  type ItemBusca,
  type ItemDeNavegacao,
  type SecaoDeNavegacao,
  type Tema,
} from '@ds'
import { sair } from '@dominio/sessao'

/* Esta e a raiz que monta o sistema: o unico lugar que conhece a casca, o
   roteador e a lista de modulos ao mesmo tempo. A casca em si nao sabe o que e
   cotacao nem o que e kanban: ela recebe a lista pronta. */
export function App() {
  const navegar = useNavigate()
  const local = useLocation()
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

  const secoes: SecaoDeNavegacao[] = [
    {
      titulo: 'Comercial',
      itens: [
        { para: '/', rotulo: 'Início', icone: <House {...icone} /> },
        { para: '/funil', rotulo: 'Funil de vendas', icone: <Funnel {...icone} /> },
        { para: '/clientes', rotulo: 'Clientes', icone: <Users {...icone} /> },
        { para: '/cotacao', rotulo: 'Cotação', icone: <Receipt {...icone} /> },
      ],
    },
    {
      titulo: 'Produção',
      itens: [
        { para: '/ficha', rotulo: 'Ficha de produção', icone: <ClipboardText {...icone} /> },
        { para: '/kanban', rotulo: 'Produção MARK42', icone: <Factory {...icone} /> },
        { para: '/estoque', rotulo: 'Estoque', icone: <Package {...icone} /> },
      ],
    },
    {
      titulo: 'Sistema',
      itens: [{ para: '/kit', rotulo: 'Design System', icone: <Palette {...icone} /> }],
    },
  ]

  /* cinco destinos na barra de baixo: os que a fabrica abre todo dia */
  const rodapeNav: ItemDeNavegacao[] = [
    { para: '/', rotulo: 'Início', icone: <House size={22} /> },
    { para: '/funil', rotulo: 'Funil', icone: <Funnel size={22} /> },
    { para: '/cotacao', rotulo: 'Cotação', icone: <Receipt size={22} /> },
    { para: '/kanban', rotulo: 'Produção', icone: <Factory size={22} /> },
    { para: '/estoque', rotulo: 'Estoque', icone: <Package size={22} /> },
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
              title="Sair"
              aria-label="Sair"
              onClick={() => {
                sair()
                navegar('/entrar', { replace: true })
              }}
            >
              AD
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
              sair()
              navegar('/entrar', { replace: true })
            }}
          >
            <SignOut size={18} />
          </button>
        }
      >
        <Outlet />
      </Casca>

      <BuscaGlobal aberto={busca} aoFechar={() => setBusca(false)} itens={itensDaBusca} />
      <PilhaDeRecados />
    </>
  )
}
