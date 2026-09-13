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
  UserCircle,
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
import { fotoDe, iniciaisDe, podeVer, primeiroNome, useSessao } from '@dominio/sessao'
import type { Painel, Pessoa } from '@dominio/sessao'
import { ESTAGIO_FECHADO, listarLeads } from '@dominio/funil'
import { contarEsperando } from '@dominio/equipe'

/* Esta e a raiz que monta o sistema: o unico lugar que conhece a casca, o
   roteador e a lista de modulos ao mesmo tempo. A casca em si nao sabe o que e
   cotacao nem o que e kanban: ela recebe a lista pronta. */
export function App() {
  const navegar = useNavigate()
  const local = useLocation()
  const { estado, sair } = useSessao()
  const pessoa: Pessoa | null = estado.fase === 'dentro' ? estado.pessoa : null
  const [encolhida, setEncolhida] = useState(() => {
    try {
      return localStorage.getItem('ft.menu') === 'encolhido'
    } catch {
      return false
    }
  })
  const [tema, setTema] = useState<Tema>(() => temaAtual())
  const [naFila, setNaFila] = useState(0)
  const [busca, setBusca] = useState(false)
  usarAtalhoDaBusca(useCallback(() => setBusca(true), []))

  useEffect(() => {
    try {
      localStorage.setItem('ft.menu', encolhida ? 'encolhido' : 'aberto')
    } catch {
      /* armazenamento bloqueado: vale so nesta aba */
    }
  }, [encolhida])

  /* Quantas contas estao esperando aprovacao.

     So o admin ve, e so ele consegue ler essa contagem: para qualquer outro
     papel a regra de acesso devolve so a propria linha. Sem este numero no
     menu, uma conta nova ficaria esperando ate a pessoa reclamar, porque
     ninguem abre Configuracoes todo dia para conferir. Reconta a cada troca de
     tela, que e barato e mantem o numero honesto depois de aprovar alguem. */
  const souAdmin = pessoa?.papel === 'admin'
  useEffect(() => {
    if (!souAdmin) {
      setNaFila(0)
      return
    }
    let cancelado = false
    void contarEsperando()
      .then((n) => {
        if (!cancelado) setNaFila(n)
      })
      .catch(() => {
        /* numero de menu nao vale uma tela de erro */
      })
    return () => {
      cancelado = true
    }
  }, [souAdmin, local.pathname])

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
  /* Cada item sabe de qual painel ele e. A pessoa so ve o que o papel dela
     alcanca, e quem resolve essa lista e o banco: aqui so filtra.

     Isto e arrumacao, nao tranca. Quem protege o dado e a regra de acesso das
     tabelas la no banco. Esconder o item evita que a pessoa esbarre no que nao
     e dela, e nada alem disso. */
  type Item = ItemDeNavegacao & { chave: Painel }

  const todas: { titulo: string; itens: Item[] }[] = [
    {
      titulo: 'Comercial',
      itens: [
        { chave: 'inicio', para: '/', rotulo: 'Início', icone: <House {...icone} /> },
        {
          chave: 'funil',
          para: '/funil',
          rotulo: 'Funil e WhatsApp',
          icone: <Kanban {...icone} />,
          contagem: leadsAtivos || undefined,
        },
        { chave: 'clientes', para: '/clientes', rotulo: 'Clientes', icone: <Users {...icone} /> },
        {
          chave: 'cotacao',
          para: '/cotacao',
          rotulo: 'Cotação de venda',
          icone: <Receipt {...icone} />,
        },
      ],
    },
    {
      titulo: 'Produção',
      itens: [
        {
          chave: 'ficha',
          para: '/ficha',
          rotulo: 'Ficha de produção',
          icone: <ClipboardText {...icone} />,
        },
        {
          chave: 'kanban',
          para: '/kanban',
          rotulo: 'Kanban de produção',
          icone: <Factory {...icone} />,
        },
        { chave: 'produtos', para: '/produtos', rotulo: 'Fichas técnicas', icone: <TShirt {...icone} /> },
        { chave: 'estoque', para: '/estoque', rotulo: 'Estoque', icone: <Package {...icone} /> },
      ],
    },
    {
      titulo: 'Gestão',
      itens: [
        {
          chave: 'atividades',
          para: '/atividades',
          rotulo: 'Painel de atividades',
          icone: <CalendarCheck {...icone} />,
        },
        {
          chave: 'relatorio',
          para: '/relatorio',
          rotulo: 'Relatório mensal',
          icone: <ChartBar {...icone} />,
        },
        { chave: 'banco', para: '/banco', rotulo: 'Banco de dados', icone: <Database {...icone} /> },
        {
          chave: 'config',
          para: '/config',
          rotulo: 'Configurações',
          icone: <Gear {...icone} />,
          contagem: naFila || undefined,
        },
        { chave: 'kit', para: '/kit', rotulo: 'Design System', icone: <Palette {...icone} /> },
      ],
    },
  ]

  const posso = (chave: Painel) => !!pessoa && podeVer(pessoa, chave)

  /* Secao sem nenhum item vira titulo solto pairando sobre nada, entao ela
     some junto. */
  const secoes: SecaoDeNavegacao[] = todas
    .map((s) => ({ titulo: s.titulo, itens: s.itens.filter((i) => posso(i.chave)) }))
    .filter((s) => s.itens.length > 0)

  /* cinco destinos na barra de baixo, os mesmos do v5 */
  const rodapeTodos: Item[] = [
    { chave: 'inicio', para: '/', rotulo: 'Início', icone: <House size={22} /> },
    { chave: 'funil', para: '/funil', rotulo: 'Vendas', icone: <Kanban size={22} /> },
    { chave: 'kanban', para: '/kanban', rotulo: 'Produção', icone: <Factory size={22} /> },
    { chave: 'atividades', para: '/atividades', rotulo: 'Semana', icone: <CalendarCheck size={22} /> },
    { chave: 'config', para: '/config', rotulo: 'Mais', icone: <DotsThree size={22} /> },
  ]

  /* No celular a barra de baixo nunca fica vazia: quem ainda nao foi aprovado
     tem pelo menos o proprio perfil para onde ir. */
  const rodapeNav: ItemDeNavegacao[] = rodapeTodos.filter((i) => posso(i.chave))
  if (rodapeNav.length === 0) {
    rodapeNav.push({ para: '/perfil', rotulo: 'Perfil', icone: <UserCircle size={22} /> })
  }

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
              title={pessoa ? `${pessoa.nome} · meu perfil` : 'Meu perfil'}
              aria-label={
                pessoa ? `${primeiroNome(pessoa.nome)}, abrir meu perfil` : 'Meu perfil'
              }
              onClick={() => navegar('/perfil')}
            >
              {pessoa && fotoDe(pessoa) ? (
                <img src={fotoDe(pessoa) ?? ''} alt="" />
              ) : pessoa ? (
                iniciaisDe(pessoa.nome)
              ) : (
                '··'
              )}
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
