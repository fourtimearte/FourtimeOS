import { useEffect, useState } from 'react'
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
            Passo 5 em andamento. Já nasceram aqui: botão, chip, campo, busca, marcação, escolha,
            interruptor, segmentado, cartão, selo, tag e as pílulas de técnica. Faltam tabela,
            modal, folha lateral, toast, busca global e os cinco menus do módulo.
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
        </div>
      </div>
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
