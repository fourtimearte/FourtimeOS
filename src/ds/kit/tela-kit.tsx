import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Botao, Chip } from '../componentes/botao'
import {
  AreaTexto,
  Busca,
  Campo,
  Entrada,
  Escolha,
  Interruptor,
  Marcacao,
  Segmentado,
} from '../componentes/formulario'
import { BuscaGlobal, usarAtalhoDaBusca, type ItemBusca } from '../componentes/busca-global'
import { Aviso, Esqueleto, Vazio } from '../componentes/estado'
import { avisar, PilhaDeRecados } from '../componentes/recados'
import { Gaveta, Modal } from '../componentes/sobreposicao'
import { Tabela, type Coluna } from '../componentes/tabela'
import {
  Amostra,
  Cartao,
  ChipTecnica,
  PilulaTecnica,
  Selo,
  Tag,
  TituloCartao,
  type Tecnica,
} from '../componentes/superficie'
import { aplicarTema, temaAtual, temaGuardado, type Tema } from './tema'
import './kit.css'

const SECOES: [string, string][] = [
  ['cor', 'Cor'],
  ['tecnicas', 'Técnicas'],
  ['medida', 'Medida'],
  ['tipografia', 'Tipografia'],
  ['botoes', 'Botões'],
  ['chips', 'Chips'],
  ['campos', 'Campos'],
  ['marcacao', 'Marcação'],
  ['segmentado', 'Segmentado'],
  ['cartoes', 'Cartões'],
  ['selos', 'Selos e tags'],
  ['tabela', 'Tabela'],
  ['sobreposicoes', 'Modal e gaveta'],
  ['recados', 'Recados'],
  ['buscaglobal', 'Busca global'],
  ['estados', 'Vazio, esqueleto e aviso'],
]

/* A rota /kit: a página viva do Design System. Nenhum componente aparece numa
   tela do sistema antes de nascer aqui, com todos os seus estados e nos dois
   temas. É isso que impede o kit de virar uma cópia do app. */
export function TelaKit() {
  const [tema, setTema] = useState<Tema>(() => temaGuardado() ?? temaAtual())
  const [secao, setSecao] = useState('cor')

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  useEffect(() => {
    const alvos = SECOES.map(([id]) => document.getElementById(id)).filter(
      (e): e is HTMLElement => !!e,
    )
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visivel) setSecao(visivel.target.id)
      },
      { rootMargin: '-70px 0px -65% 0px', threshold: 0 },
    )
    alvos.forEach((a) => obs.observe(a))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="kit">
      <header className="kit-topo">
        <span className="kit-selo">V7</span>
        <div>
          <h1>Design System Fourtime</h1>
          <p>A fonte única de aparência do sistema</p>
        </div>
        <div className="kit-empurra" />
        <div className="kit-tema" role="group" aria-label="Tema">
          <button
            type="button"
            className={tema === 'light' ? 'ligado' : ''}
            onClick={() => setTema('light')}
          >
            Gelo
          </button>
          <button
            type="button"
            className={tema === 'dark' ? 'ligado' : ''}
            onClick={() => setTema('dark')}
          >
            Grafite
          </button>
        </div>
      </header>

      <div className="kit-casca">
        <nav className="kit-rail" aria-label="Seções do kit">
          <b>Seções</b>
          {SECOES.map(([id, nome]) => (
            <a key={id} href={`#${id}`} className={secao === id ? 'ligado' : ''}>
              <i />
              {nome}
            </a>
          ))}
        </nav>

        <div className="kit-corpo">
          <p className="kit-aviso">
            <i />
            Passo 5, segunda leva. Já nasceram aqui: botão, chip, campo, busca, marcação, escolha,
            interruptor, segmentado, cartão, selo, tag, pílulas de técnica, tabela, modal, folha
            lateral, recados, busca global, estado vazio, esqueleto e aviso. Faltam os cinco menus
            do módulo, que vêm sozinhos na última leva.
          </p>

          <Secao
            id="cor"
            titulo="Superfície e texto"
            texto="A base industrial minimalista: superfície clara sobre cinza, borda de 1 px, sombra baixa. Troque para Grafite no topo e confira que nada some."
          >
            <Cores nomes={BASE} />
            <h3 className="kit-nota" style={{ marginTop: 'var(--sp-6)' }}>
              Acento
            </h3>
            <Cores nomes={ACENTO} />
            <h3 className="kit-nota" style={{ marginTop: 'var(--sp-6)' }}>
              Cor com significado
            </h3>
            <Cores nomes={SINAIS} />
          </Secao>

          <Secao
            id="tecnicas"
            titulo="Técnicas"
            texto="A matiz é o vocabulário da fábrica e não muda. O tom é acabamento. A pílula sólida carrega texto branco, o chip suave é leitura, e o ponto é a versão viva. A mesma cor no editor, no cartão e no kanban."
          >
            <div className="kit-bancada">
              <span className="kit-nota">Pílula sólida</span>
              {TECNICAS.map(([t, r]) => (
                <PilulaTecnica key={t} tecnica={t}>
                  {r}
                </PilulaTecnica>
              ))}
            </div>
            <div className="kit-bancada">
              <span className="kit-nota">Chip de leitura</span>
              {TECNICAS.map(([t, r]) => (
                <ChipTecnica key={t} tecnica={t}>
                  {r}
                </ChipTecnica>
              ))}
            </div>
            <div className="kit-bancada">
              <span className="kit-nota">Tamanhos, e o mais que acrescenta cor</span>
              <PilulaTecnica tecnica="dtf" tamanho="sm">
                DTF
              </PilulaTecnica>
              <PilulaTecnica tecnica="dtf">DTF</PilulaTecnica>
              <PilulaTecnica tecnica="dtf" tamanho="lg">
                DTF
              </PilulaTecnica>
              <PilulaTecnica tecnica="subli" aoAdicionar={() => {}}>
                SUB
              </PilulaTecnica>
              <span className="kit-nota" style={{ marginTop: 'var(--sp-3)' }}>
                Para remover é botão direito na pílula ou na cor, nunca um X
              </span>
            </div>
          </Secao>

          <Secao
            id="medida"
            titulo="Medida"
            texto="Respiro é regra, não gosto: o sistema roda em celular e tablet no galpão. Alvo de toque mínimo de 44 px, botão de 40 px, folga de 10 px entre botões."
          >
            <div className="kit-bancada">
              {RAIOS.map(([nome, v]) => (
                <div className="kit-medida" key={nome || 'base'}>
                  <i
                    style={{
                      width: 66,
                      height: 44,
                      borderRadius: `var(--radius${nome ? '-' + nome : ''})`,
                    }}
                  />
                  <b>{nome || 'base'}</b>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <div className="kit-bancada">
              {ESPACOS.map(([n, v]) => (
                <div className="kit-medida" key={n}>
                  <i style={{ width: `var(--sp-${n})`, height: 44, borderRadius: 2 }} />
                  <b>sp-{n}</b>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </Secao>

          <Secao
            id="tipografia"
            titulo="Tipografia"
            texto="Urbanist na interface. Roboto só no papel, na folha A4 do relatório, que é outra peça de propósito."
          >
            <div className="kit-bancada coluna">
              {TIPOS.map(([texto, css, nota]) => (
                <div className="kit-tipo-linha" key={nota}>
                  <span style={{ font: css }}>{texto}</span>
                  <small>{nota}</small>
                </div>
              ))}
            </div>
          </Secao>

          <Secao
            id="botoes"
            titulo="Botões"
            texto="O tom diz o peso da ação, não o gosto. Primário é a ação principal, forte é o preto que confirma, contorno é a secundária, limpo é a terciária, perigo é o que não volta atrás."
          >
            <div className="kit-bancada">
              <span className="kit-nota">Tons</span>
              <Botao tom="primario">Salvar cotação</Botao>
              <Botao tom="forte">Aprovar</Botao>
              <Botao tom="contorno">Duplicar</Botao>
              <Botao tom="limpo">Cancelar</Botao>
              <Botao tom="perigo">Excluir</Botao>
              <Botao tom="wa">WhatsApp</Botao>
            </div>
            <div className="kit-bancada">
              <span className="kit-nota">Tamanhos</span>
              <Botao tom="primario" tamanho="sm">
                Miúdo, 34
              </Botao>
              <Botao tom="primario">Padrão, 40</Botao>
              <Botao tom="primario" tamanho="lg">
                Grande, 48
              </Botao>
              <Botao tom="contorno" icone aria-label="Mais">
                +
              </Botao>
            </div>
            <div className="kit-bancada">
              <span className="kit-nota">Estados</span>
              <Botao tom="primario" disabled>
                Desligado
              </Botao>
              <Botao tom="primario" carregando>
                Enviando
              </Botao>
              <Botao tom="contorno" carregando>
                Enviando
              </Botao>
              <Botao tom="forte" bloco style={{ maxWidth: 260 }}>
                Bloco, largura toda
              </Botao>
            </div>
          </Secao>

          <Secao
            id="chips"
            titulo="Chips"
            texto="Filtro que liga e desliga. Ligado ele fica preto, porque preto é seleção no V7 e nenhuma terceira cor de marca existe."
          >
            <div className="kit-bancada">
              <ChipsDemo />
            </div>
          </Secao>

          <Secao
            id="campos"
            titulo="Campos"
            texto="Nenhum elemento padrão do navegador: o campo tem foco desenhado, o amarelo do preenchimento automático não aparece, e o erro é borda mais anel, nunca só texto."
          >
            <div className="kit-bancada grade">
              <Campo rotulo="Cliente" dica="Como aparece na cotação">
                <Entrada placeholder="Colégio Delta" />
              </Campo>
              <Campo rotulo="Referência" dica="Não encontrada no banco" erro>
                <Entrada defaultValue="F4R 999 M" />
              </Campo>
              <Campo rotulo="Código, só leitura">
                <Entrada readOnly defaultValue="2481" />
              </Campo>
              <Campo rotulo="Campo desligado">
                <Entrada disabled placeholder="sem edição" />
              </Campo>
              <Campo rotulo="Miúdo, 34">
                <Entrada tamanho="sm" placeholder="quantidade" />
              </Campo>
              <Campo rotulo="Busca">
                <Busca placeholder="Buscar pedido, cliente ou referência" />
              </Campo>
            </div>
            <div className="kit-bancada coluna">
              <Campo rotulo="Observação da produção" dica="Vai para a ficha, não para a cotação">
                <AreaTexto placeholder="Gola em ribana, punho reforçado" />
              </Campo>
            </div>
          </Secao>

          <Secao
            id="marcacao"
            titulo="Marcação, escolha e interruptor"
            texto="Desenhados aqui, do zero. O visto é riscado na hora, o meio marcado existe para lista com parte selecionada, e o interruptor confirma em verde porque ele diz ligado, não ação."
          >
            <div className="kit-bancada">
              <MarcacaoDemo />
            </div>
          </Secao>

          <Secao
            id="segmentado"
            titulo="Segmentado"
            texto="Para trocar de visão sem sair do lugar. O indicador desliza com mola, e a medida vem do próprio botão ativo, então texto de qualquer tamanho continua certo."
          >
            <div className="kit-bancada">
              <SegmentadoDemo />
            </div>
          </Secao>

          <Secao
            id="cartoes"
            titulo="Cartões"
            texto="Superfície branca sobre cinza, borda de 1 px, sombra baixa. O cartão clicável sobe dois pixels e ganha sombra: é o único lugar onde a superfície se mexe."
          >
            <div className="kit-bancada grade">
              <Cartao>
                <TituloCartao>Pedido 2.481</TituloCartao>
                <p style={{ color: 'var(--text-2)', margin: 'var(--sp-3) 0 0' }}>
                  Cartão parado. Ele não reage ao ponteiro porque não leva a lugar nenhum.
                </p>
              </Cartao>
              <Cartao clicavel>
                <TituloCartao>Colégio Delta</TituloCartao>
                <p style={{ color: 'var(--text-2)', margin: 'var(--sp-3) 0 0' }}>
                  Cartão clicável. Passe o ponteiro: ele sobe dois pixels.
                </p>
              </Cartao>
            </div>
          </Secao>

          <Secao
            id="selos"
            titulo="Selos, tags e amostras"
            texto="Selo é estado, tag é rótulo. A tarja de gênero da referência tem fundo próprio, e a amostra de cor mostra xadrez quando ainda não tem cor escolhida."
          >
            <div className="kit-bancada">
              <span className="kit-nota">Selo, por tom e forma</span>
              <Selo tom="ok">Aprovado</Selo>
              <Selo tom="warn">Aguardando</Selo>
              <Selo tom="info">Em produção</Selo>
              <Selo tom="brand">Atrasado</Selo>
              <Selo tom="ok" forma="solido">
                Pago
              </Selo>
              <Selo forma="forte">Selecionado</Selo>
              <Selo tom="brand" forma="contorno">
                Urgente
              </Selo>
            </div>
            <div className="kit-bancada">
              <span className="kit-nota">Tag e tarja de gênero</span>
              <Tag>Malha dry</Tag>
              <Tag genero="masculino">Masculino</Tag>
              <Tag genero="feminino">Feminino</Tag>
              <Tag genero="infantil">Infantil</Tag>
            </div>
            <div className="kit-bancada">
              <span className="kit-nota">Amostra de cor</span>
              <Amostra cor="var(--tec-dtf)" />
              <Amostra cor="var(--brand)" />
              <Amostra cor="#F4D03F" />
              <Amostra />
              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                a última é a cor ainda não escolhida
              </span>
            </div>
          </Secao>
          <Secao
            id="tabela"
            titulo="Tabela"
            texto="Rola na horizontal dentro da própria caixa, então no celular ela não empurra a página inteira para o lado. Cabeçalho que ordena, número à direita com dígito de largura fixa, e a linha de total com peso maior."
          >
            <div className="kit-bancada" style={{ display: 'block', padding: 0 }}>
              <TabelaDemo />
            </div>
          </Secao>

          <Secao
            id="sobreposicoes"
            titulo="Modal e folha lateral"
            texto="As duas usam a camada do topo do navegador, acima de qualquer corte e de qualquer empilhamento. Foco preso dentro, Esc para sair, clique no escuro fecha. No celular as duas viram folha de baixo, que é onde o polegar alcança."
          >
            <div className="kit-bancada">
              <SobreposicaoDemo />
            </div>
          </Secao>

          <Secao
            id="recados"
            titulo="Recados"
            texto="O aviso que aparece no canto e some sozinho. Serve para confirmar o que acabou de acontecer, nunca para pedir decisão: decisão é modal."
          >
            <div className="kit-bancada">
              <Botao onClick={() => avisar('Cotação salva')}>Salvar</Botao>
              <Botao onClick={() => avisar('Pedido aprovado', 'ok')}>Aprovar</Botao>
              <Botao onClick={() => avisar('Estoque de malha dry abaixo do mínimo', 'warn')}>
                Estoque baixo
              </Botao>
              <Botao onClick={() => avisar('Importação do Bling terminada', 'info')}>Importar</Botao>
            </div>
          </Secao>

          <Secao
            id="buscaglobal"
            titulo="Busca global"
            texto="Abre com Ctrl K, ou Cmd K no Mac. Anda com as setas, escolhe com Enter, sai com Esc. Ela some assim que escolhe: nunca fica no meio do caminho."
          >
            <div className="kit-bancada">
              <BuscaDemo />
            </div>
          </Secao>

          <Secao
            id="estados"
            titulo="Vazio, esqueleto e aviso"
            texto="Lista vazia num galpão costuma ser dúvida, não descanso: o vazio diz o que aconteceu e qual é a saída. O esqueleto ocupa o lugar exato do conteúdo, para a tela não pular quando o dado chega."
          >
            <div className="kit-bancada coluna">
              <Aviso tom="brand" titulo="Três pedidos passaram da data">
                Eles continuam no kanban, mas já contam como atraso no relatório do mês.
              </Aviso>
              <Aviso tom="ok" titulo="Tudo em dia">
                Nenhum pedido atrasado nesta semana.
              </Aviso>
              <Aviso tom="warn">Malha dry preta abaixo do mínimo: restam 12 kg.</Aviso>
              <Aviso tom="info">A importação do Bling roda uma vez, e depois o sistema é a fonte.</Aviso>
            </div>
            <div className="kit-bancada" style={{ display: 'block' }}>
              <span className="kit-nota">Esqueleto</span>
              <div style={{ display: 'grid', gap: 'var(--sp-3)', maxWidth: 460 }}>
                <Esqueleto largura="42%" altura={18} />
                <Esqueleto />
                <Esqueleto largura="78%" />
                <Esqueleto largura="60%" />
              </div>
            </div>
            <div className="kit-bancada" style={{ display: 'block' }}>
              <span className="kit-nota">Vazio</span>
              <Vazio
                titulo="Nenhuma cotação neste filtro"
                texto="Tire o filtro de atraso ou mude o período para ver o resto."
                acao={<Botao tom="forte">Limpar filtros</Botao>}
              />
            </div>
          </Secao>
        </div>
      </div>
      <PilhaDeRecados />
    </div>
  )
}

/* --- demonstrações com estado ------------------------------------------- */
function ChipsDemo() {
  const [ligados, setLigados] = useState<string[]>(['dtf'])
  const alterna = (v: string) =>
    setLigados((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]))
  return (
    <>
      <span className="kit-nota">Clique para ligar e desligar</span>
      <Chip ligado={ligados.includes('todos')} onClick={() => alterna('todos')}>
        Todos
      </Chip>
      <Chip
        ligado={ligados.includes('dtf')}
        cor="var(--tec-dtf-vivo)"
        onClick={() => alterna('dtf')}
      >
        DTF
      </Chip>
      <Chip
        ligado={ligados.includes('subli')}
        cor="var(--tec-subli-vivo)"
        onClick={() => alterna('subli')}
      >
        Sublimação
      </Chip>
      <Chip
        ligado={ligados.includes('atraso')}
        cor="var(--brand)"
        onClick={() => alterna('atraso')}
      >
        Atrasados
      </Chip>
      <Chip tamanho="sm" ligado={ligados.includes('mes')} onClick={() => alterna('mes')}>
        Este mês
      </Chip>
    </>
  )
}

function MarcacaoDemo() {
  const [a, setA] = useState(true)
  const [b, setB] = useState(false)
  const [via, setVia] = useState('wa')
  const [aviso, setAviso] = useState(true)
  return (
    <>
      <Marcacao checked={a} onChange={(e) => setA(e.target.checked)}>
        Incluir frete
      </Marcacao>
      <Marcacao checked={b} onChange={(e) => setB(e.target.checked)}>
        Peça piloto
      </Marcacao>
      <Marcacao meio readOnly checked={false}>
        Parte da lista
      </Marcacao>
      <Marcacao disabled>Desligada</Marcacao>
      <span style={{ width: '100%' }} />
      <Escolha name="envio" checked={via === 'wa'} onChange={() => setVia('wa')}>
        WhatsApp
      </Escolha>
      <Escolha name="envio" checked={via === 'email'} onChange={() => setVia('email')}>
        E-mail
      </Escolha>
      <span style={{ width: '100%' }} />
      <Interruptor ligado={aviso} aoMudar={setAviso} rotulo="Avisar o cliente quando aprovar" />
    </>
  )
}

function SegmentadoDemo() {
  const [visao, setVisao] = useState<'lista' | 'grade' | 'kanban'>('lista')
  const [periodo, setPeriodo] = useState<'7' | '30' | 'tudo'>('30')
  return (
    <>
      <Segmentado
        valor={visao}
        aoMudar={setVisao}
        opcoes={[
          { valor: 'lista', rotulo: 'Lista' },
          { valor: 'grade', rotulo: 'Grade' },
          { valor: 'kanban', rotulo: 'Kanban' },
        ]}
      />
      <Segmentado
        valor={periodo}
        aoMudar={setPeriodo}
        opcoes={[
          { valor: '7', rotulo: '7 dias' },
          { valor: '30', rotulo: '30 dias' },
          { valor: 'tudo', rotulo: 'Tudo' },
        ]}
      />
    </>
  )
}

type LinhaDemo = {
  id: string
  pedido: string
  cliente: string
  tecnica: Tecnica
  pecas: number
  valor: number
}

const LINHAS: LinhaDemo[] = [
  { id: '2481', pedido: '2.481', cliente: 'Colégio Delta', tecnica: 'dtf', pecas: 120, valor: 7440 },
  { id: '2480', pedido: '2.480', cliente: 'Academia Pulse', tecnica: 'subli', pecas: 64, valor: 5120 },
  { id: '2479', pedido: '2.479', cliente: 'Time Aurora', tecnica: 'silk', pecas: 210, valor: 9870 },
  { id: '2478', pedido: '2.478', cliente: 'Prefeitura de Goiânia', tecnica: 'bordado', pecas: 45, valor: 3150 },
]

const dinheiro = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function TabelaDemo() {
  const [marcada, setMarcada] = useState<string[]>(['2480'])
  const colunas: Coluna<LinhaDemo>[] = [
    {
      chave: 'pedido',
      titulo: 'Pedido',
      ordenarPor: (l) => l.pedido,
      celula: (l) => <b>{l.pedido}</b>,
    },
    {
      chave: 'cliente',
      titulo: 'Cliente',
      ordenarPor: (l) => l.cliente,
      celula: (l) => l.cliente,
    },
    {
      chave: 'tecnica',
      titulo: 'Técnica',
      celula: (l) => <PilulaTecnica tecnica={l.tecnica}>{l.tecnica.toUpperCase()}</PilulaTecnica>,
    },
    {
      chave: 'pecas',
      titulo: 'Peças',
      numero: true,
      ordenarPor: (l) => l.pecas,
      celula: (l) => l.pecas,
    },
    {
      chave: 'valor',
      titulo: 'Valor',
      numero: true,
      ordenarPor: (l) => l.valor,
      celula: (l) => dinheiro(l.valor),
    },
  ]
  return (
    <Tabela
      colunas={colunas}
      linhas={LINHAS}
      chaveDaLinha={(l) => l.id}
      marcadas={marcada}
      aoClicarNaLinha={(l) => setMarcada((m) => (m.includes(l.id) ? [] : [l.id]))}
      total={[
        'Total',
        '',
        '',
        LINHAS.reduce((s, l) => s + l.pecas, 0),
        dinheiro(LINHAS.reduce((s, l) => s + l.valor, 0)),
      ]}
    />
  )
}

function SobreposicaoDemo() {
  const [modal, setModal] = useState(false)
  const [gaveta, setGaveta] = useState(false)
  return (
    <>
      <Botao tom="forte" onClick={() => setModal(true)}>
        Abrir modal
      </Botao>
      <Botao tom="contorno" onClick={() => setGaveta(true)}>
        Abrir folha lateral
      </Botao>

      <Modal
        aberto={modal}
        aoFechar={() => setModal(false)}
        titulo="Aprovar a cotação 2.481"
        pe={
          <>
            <Botao tom="limpo" onClick={() => setModal(false)}>
              Cancelar
            </Botao>
            <Botao
              tom="primario"
              onClick={() => {
                setModal(false)
                avisar('Cotação 2.481 aprovada', 'ok')
              }}
            >
              Aprovar
            </Botao>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-2)' }}>
          Aprovar gera um rascunho de ficha de produção e avisa o cliente pelo WhatsApp. Dá para
          desfazer enquanto ninguém tiver aberto a ficha.
        </p>
      </Modal>

      <Gaveta
        aberto={gaveta}
        aoFechar={() => setGaveta(false)}
        titulo="Colégio Delta"
        pe={
          <Botao tom="forte" onClick={() => setGaveta(false)}>
            Fechar
          </Botao>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <Campo rotulo="Contato">
            <Entrada defaultValue="Marcela, compras" />
          </Campo>
          <Campo rotulo="Telefone">
            <Entrada defaultValue="(62) 99999-0000" />
          </Campo>
          <div style={{ display: 'flex', gap: 'var(--gap-btn)', flexWrap: 'wrap' }}>
            <Selo tom="ok">Cliente ativo</Selo>
            <Selo tom="info">14 pedidos</Selo>
          </div>
        </div>
      </Gaveta>
    </>
  )
}

function BuscaDemo() {
  const [aberta, setAberta] = useState(false)
  usarAtalhoDaBusca(useCallback(() => setAberta(true), []))
  const itens: ItemBusca[] = [
    { id: '1', grupo: 'Pedidos', titulo: '2.481 . Colégio Delta', lado: '120 peças', aoEscolher: () => avisar('Abriria o pedido 2.481') },
    { id: '2', grupo: 'Pedidos', titulo: '2.480 . Academia Pulse', lado: '64 peças', aoEscolher: () => avisar('Abriria o pedido 2.480') },
    { id: '3', grupo: 'Clientes', titulo: 'Colégio Delta', lado: 'Goiânia', aoEscolher: () => avisar('Abriria o cliente') },
    { id: '4', grupo: 'Telas', titulo: 'Kanban de produção', termos: 'mark42 producao', lado: 'ir para', aoEscolher: () => avisar('Iria para o kanban') },
    { id: '5', grupo: 'Telas', titulo: 'Estoque', termos: 'malha insumo', lado: 'ir para', aoEscolher: () => avisar('Iria para o estoque') },
  ]
  return (
    <>
      <Botao tom="contorno" onClick={() => setAberta(true)}>
        Abrir a busca
      </Botao>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
        ou <span className="tecla">ctrl</span> <span className="tecla">K</span>
      </span>
      <BuscaGlobal aberto={aberta} aoFechar={() => setAberta(false)} itens={itens} />
    </>
  )
}

/* --- peças da própria página -------------------------------------------- */
function Secao({
  id,
  titulo,
  texto,
  children,
}: {
  id: string
  titulo: string
  texto: string
  children: ReactNode
}) {
  return (
    <section className="kit-sec" id={id}>
      <h2>{titulo}</h2>
      <p>{texto}</p>
      {children}
    </section>
  )
}

function Cores({ nomes }: { nomes: [string, string][] }) {
  return (
    <div className="kit-cores">
      {nomes.map(([token, uso]) => (
        <div className="kit-cor" key={token}>
          <div className="kit-amostra" style={{ background: `var(${token})` }} />
          <b>{token}</b>
          <span>{uso}</span>
        </div>
      ))}
    </div>
  )
}

const BASE: [string, string][] = [
  ['--bg', 'fundo da página'],
  ['--surface', 'cartão, barra, menu'],
  ['--surface-2', 'campo, controle'],
  ['--surface-3', 'estado apertado'],
  ['--border', 'borda de 1 px'],
  ['--border-2', 'borda em destaque'],
  ['--text', 'texto principal'],
  ['--text-2', 'texto de apoio'],
  ['--text-3', 'rótulo miúdo'],
]

const ACENTO: [string, string][] = [
  ['--brand', 'ação e atraso'],
  ['--brand-hover', 'ação sob o dedo'],
  ['--brand-soft', 'fundo do aviso'],
  ['--brand-text', 'texto sobre o suave'],
  ['--ink', 'seleção e botão forte'],
  ['--ink-soft', 'anel de foco'],
]

const SINAIS: [string, string][] = [
  ['--ok', 'confirmado'],
  ['--warn', 'atenção'],
  ['--info', 'informação'],
  ['--wa', 'WhatsApp'],
]

const TECNICAS: [Tecnica, string][] = [
  ['dtf', 'DTF'],
  ['subli', 'SUB'],
  ['silk', 'SILK'],
  ['patch', 'PATCH'],
  ['bordado', 'BORDADO'],
  ['gola', 'GOLA'],
  ['ribana', 'RIBANA'],
  ['etiqueta', 'ETIQUETA'],
]

const RAIOS: [string, string][] = [
  ['xs', '5px'],
  ['sm', '7px'],
  ['', '10px'],
  ['lg', '14px'],
  ['xl', '18px'],
]

const ESPACOS: [string, string][] = [
  ['1', '4px'],
  ['2', '8px'],
  ['3', '12px'],
  ['4', '16px'],
  ['5', '20px'],
  ['6', '24px'],
  ['8', '32px'],
]

const TIPOS: [string, string, string][] = [
  ['Fourtime OS', '600 32px/1.15 var(--font)', '600 . 32px . título de tela'],
  ['Pedido 2.481, Colégio Delta', '600 20px/1.25 var(--font)', '600 . 20px . título de cartão'],
  ['Camiseta dry masculina, gola careca', '400 14.5px/1.5 var(--font)', '400 . 14.5px . corpo'],
  ['CONFECÇÃO', '800 11.5px/1 var(--font)', '800 . 11.5px . rótulo miúdo'],
]
