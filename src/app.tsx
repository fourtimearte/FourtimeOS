import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  Buildings,
  CalendarCheck,
  ChartBar,
  ClipboardText,
  Database,
  DotsThree,
  Factory,
  Gear,
  House,
  Kanban,
  ListChecks,
  Moon,
  Package,
  Palette,
  Receipt,
  SignOut,
  Sun,
  TShirt,
  UserCircle,
  Users,
  UsersThree,
} from '@phosphor-icons/react'
import {
  aplicarTema,
  Avatar,
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
import {
  fotoDe,
  iniciaisDe,
  NOME_DO_PAPEL,
  podeVer,
  useSessao,
} from '@dominio/sessao'
import type { Painel, Pessoa } from '@dominio/sessao'
import { paginasEscondidas } from '@dominio/regulagem'
import { ESTAGIO_FECHADO, carregarLeads } from '@dominio/funil'
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
     em contador de menu e pior que contador nenhum

     Ele comeca em zero e aparece quando a conta chega. Zero nao e mentira: e o
     menu dizendo que ainda nao sabe, e o contador so e desenhado quando ha
     numero. Segurar o menu inteiro esperando uma consulta seria trocar o que a
     pessoa quer, que e navegar, por um numero que ela talvez nem olhe. */
  const [leadsAtivos, setLeadsAtivos] = useState(0)
  useEffect(() => {
    if (!pessoa) return
    let vivo = true
    carregarLeads()
      .then((l) => vivo && setLeadsAtivos(l.filter((x) => !ESTAGIO_FECHADO.includes(x.estagio)).length))
      .catch(() => {
        /* o menu nao e o lugar de gritar que o banco caiu: a tela que a pessoa
           abrir vai dizer isso com todas as letras */
      })
    return () => {
      vivo = false
    }
  }, [pessoa])

  /* Os doze destinos do v5, na ordem e com os nomes dele. O Design System e a
     unica linha que nao esta no mockup: ele e ferramenta nossa, e sem ele o
     /kit fica inalcancavel pelo menu. */
  /* Cada item sabe de qual painel ele e. A pessoa so ve o que o papel dela
     alcanca, e quem resolve essa lista e o banco: aqui so filtra.

     Isto e arrumacao, nao tranca. Quem protege o dado e a regra de acesso das
     tabelas la no banco. Esconder o item evita que a pessoa esbarre no que nao
     e dela, e nada alem disso. */
  type Item = Omit<ItemDeNavegacao, 'filhos'> & { chave: Painel; filhos?: Item[] }

  const todas: { titulo: string; itens: Item[] }[] = [
    /* O Início não pertence a nenhuma família: ele é a porta de entrada, e a
       tela que ele abre vai ser diferente para cada papel. Título de seção em
       cima de um item só seria um rótulo explicando o óbvio. */
    {
      titulo: '',
      itens: [{ chave: 'inicio', para: '/', rotulo: 'Início', icone: <House {...icone} /> }],
    },
    {
      titulo: 'Comercial',
      itens: [
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
        /* O PCP ABRE A PRODUÇÃO, e não a ficha. Ele é o portão: o pedido
           aparece no chão de fábrica porque o PCP liberou, e não porque
           alguém aprovou a venda. Um menu que começa pela ficha conta a
           história na ordem errada. */
        {
          chave: 'pcp',
          para: '/pcp',
          rotulo: 'PCP',
          icone: <ListChecks {...icone} />,
        },
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
      ],
    },
    /* Materiais não é produção: produção é o que acontece com o pedido, e
       material é o que a fábrica tem. A ficha técnica diz de que a peça é
       feita e o estoque diz quanto disso existe. As duas respondem à mesma
       pergunta, e quem procura uma procura a outra logo em seguida. */
    {
      titulo: 'Materiais',
      itens: [
        {
          chave: 'produtos',
          para: '/produtos',
          rotulo: 'Fichas técnicas',
          icone: <TShirt {...icone} />,
        },
        { chave: 'estoque', para: '/estoque', rotulo: 'Estoque', icone: <Package {...icone} /> },
      ],
    },
  ]

  /* Configurações não entra em nenhuma seção: ela mora colada no pé do menu,
     encostada em quem está usando o sistema, que é onde toda pessoa já
     aprendeu a procurar. Banco de dados e Design System moraram soltos na
     lista enquanto não tinham casa, e agora têm: os dois são cadastro do
     sistema, e cadastro do sistema é configuração. */
  const configuracoes: Item = {
    chave: 'config',
    para: '/config',
    rotulo: 'Configurações',
    icone: <Gear {...icone} />,
    contagem: naFila || undefined,
    filhos: [
      {
        chave: 'config',
        para: '/config',
        rotulo: 'Pessoas',
        icone: <UsersThree size={18} />,
        ativo: local.pathname === '/config',
      },
      {
        chave: 'banco',
        para: '/banco',
        rotulo: 'Banco de dados',
        icone: <Database size={18} />,
      },
      {
        chave: 'config',
        para: '/config/empresa',
        rotulo: 'Empresa',
        icone: <Buildings size={18} />,
        ativo: local.pathname === '/config/empresa',
      },
      {
        chave: 'kit',
        para: '/kit',
        rotulo: 'Design System',
        icone: <Palette size={18} />,
      },
    ],
  }

  const posso = (chave: Painel) => !!pessoa && podeVer(pessoa, chave)

  /* AS PAGINAS GUARDADAS.

     Duas peneiras diferentes, e elas nao se misturam: `posso` responde "esta
     pessoa tem acesso a isto", e `escondidas` responde "a empresa decidiu que
     esta pagina nao esta em uso". A primeira e por pessoa e a segunda e por
     empresa, e juntar as duas num campo so seria o comeco de alguem perder o
     acesso porque outra pessoa guardou uma pagina.

     Enquanto a lista nao chega do banco, nada some: menu a mais incomoda,
     menu a menos e gente sem conseguir trabalhar. */
  const [escondidas, setEscondidas] = useState<Set<string>>(new Set())
  useEffect(() => {
    let vivo = true
    void paginasEscondidas().then((p) => {
      if (vivo) setEscondidas(new Set(p))
    })
    return () => {
      vivo = false
    }
  }, [])

  /* Secao sem nenhum item vira titulo solto pairando sobre nada, entao ela
     some junto. */
  const secoes: SecaoDeNavegacao[] = todas
    .map((s) => ({
      titulo: s.titulo,
      itens: s.itens.filter((i) => posso(i.chave) && !escondidas.has(i.chave)),
    }))
    .filter((s) => s.itens.length > 0)

  /* Uma arvore sem nenhum galho que a pessoa alcance nao vira item vazio no
     pe do menu: ela some inteira. */
  const meusFilhos = (configuracoes.filhos ?? []).filter((f) => posso(f.chave))
  const ramoDeConfig = meusFilhos.length > 0 ? { ...configuracoes, filhos: meusFilhos } : undefined

  /* A barra de baixo é o menu inteiro, e não cinco telas escolhidas a dedo.
     Cada categoria abre as telas dela para cima, perto do polegar. O Início
     não abre nada porque não tem nada dentro: ele é uma tela só.

     Os três pontos guardam o que não é navegação de trabalho: o próprio
     perfil, as subpáginas de Configurações e a saída. */
  const ICONE_DA_SECAO: Record<string, ReactNode> = {
    Comercial: <Receipt size={21} />,
    Produção: <Factory size={21} />,
    Gestão: <ChartBar size={21} />,
    Materiais: <Package size={21} />,
  }

  const maisNoPe: Item[] = [
    { chave: 'inicio', para: '/perfil', rotulo: 'Meu perfil', icone: <UserCircle size={20} /> },
    ...meusFilhos,
  ]

  const rodapeNav: ItemDeNavegacao[] = [
    ...secoes.map((s) =>
      s.titulo === ''
        ? { para: '/', rotulo: 'Início', icone: <House size={21} /> }
        : {
            para: '#' + s.titulo,
            rotulo: s.titulo,
            icone: ICONE_DA_SECAO[s.titulo] ?? <House size={21} />,
            filhos: s.itens,
          },
    ),
    {
      para: '#mais',
      rotulo: 'Mais',
      icone: <DotsThree size={24} />,
      filhos: [
        ...maisNoPe,
        {
          para: '#sair',
          rotulo: 'Sair',
          icone: <SignOut size={20} />,
          acao: () => {
            void sair()
          },
        },
      ],
    },
  ]

  const itensDaBusca: ItemBusca[] = [
    ...secoes.flatMap((s) => s.itens),
    ...meusFilhos,
  ].map((i) => ({
    id: i.para,
    grupo: 'Telas',
    titulo: i.rotulo,
    lado: 'ir para',
    aoEscolher: () => navegar(i.para),
  }))

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
        ramoDoPe={ramoDeConfig}
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
            {/* Quem está usando o sistema mora no pé do menu, com nome e papel
                à vista. A bolinha aqui em cima era a segunda vez que a mesma
                coisa aparecia na mesma tela, e a pior das duas. */}
            <button type="button" className="bt-icone" aria-label="Avisos" title="Avisos">
              <Bell size={20} />
              <span className="sinal" />
            </button>
          </>
        }
        peDoLado={
          pessoa ? (
            /* Quem está usando o sistema fica no pé do menu, e não só numa
               bolinha no canto do topo: o papel manda no que a pessoa vê, e ela
               precisa poder conferir de relance com que crachá entrou. */
            <div className="lado-eu-linha">
              <Link to="/perfil" className="lado-eu" title="Meu perfil">
                <Avatar iniciais={iniciaisDe(pessoa.nome)} foto={fotoDe(pessoa)} tamanho={34} />
                <div>
                  <b>{pessoa.nome}</b>
                  <span>{NOME_DO_PAPEL[pessoa.papel]}</span>
                </div>
              </Link>
              <span className="lado-risco" aria-hidden="true" />
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
            </div>
          ) : null
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
