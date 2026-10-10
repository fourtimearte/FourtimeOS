import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PencilSimple, Printer } from '@phosphor-icons/react'
import { Aviso, Botao, Esqueleto, Pagina, Seletor, Vazio } from '@ds'
import { empresaAConferir } from '@dominio/empresa'
import {
  Folha,
  Medidor,
  Palco,
  imprimir,
  usarCoresDeImpressao,
  usarPaginacao,
  type BlocoDaFolha,
} from '@dominio/layout'
import type { Cotacao, VistaDaFolha } from '@dominio/cotacao'
import './documento.css'
import {
  AceiteDaPaginaUm,
  CabecalhoDaPaginaUm,
  CondicoesDaPaginaUm,
  InformesDaPaginaUm,
  ResumoDaPaginaUm,
  RodapeDaFolhaNova,
  condicoesDaFolha,
  informesNaFolha,
} from './pagina-um'
import {
  LARGURA_DA_COLUNA,
  LARGURA_DA_PAGINA,
  ModuloNaFolha,
  PISO_DA_ARTE,
  alturaNaturalDaArte,
  encaixarArtes,
  usarConstrucoes,
  usarImagens,
  usarModoDaFolha,
  type ModoDaFolha,
} from './paginas-de-layout'
import {
  BarraDoPreset,
  ModalDoPreset,
  PerguntaDeApagarPreset,
  PresetsNoTopo,
  usarPresetsDaFolha,
} from './presets-da-folha'
import { usarCotacao } from './usar-cotacao'

/* ==========================================================================
   O documento A4 da cotacao.

   Tres partes, na ordem em que o cliente le: o cabecalho com quem compra e o
   que foi combinado, os produtos um a um com imagem e valor, e o resumo geral
   com o aceite. O resumo nao leva imagem, de proposito: ele e a folha que a
   pessoa assina, e imagem ali so atrapalha.

   A folha e a peca de dominio/layout. Aqui dentro so mora o ARRANJO da
   cotacao, que e a parte que a ficha de producao vai fazer diferente.
   ========================================================================== */

/* O palpite inicial: a folha inteira menos margem, cabecalho e rodape, por
   alto. Ele serve so para o primeiro desenho; logo depois o corpo da primeira
   folha e MEDIDO e o numero certo toma o lugar. Palpite de altura e o jeito
   classico de perder a ultima linha de cada pagina. */
/* DOIS LAYOUTS POR FOLHA, a partir da folha 2. Ver o comentario da paginacao
   dentro do componente: aqui e regra, e nao medicao. */
const LAYOUTS_POR_FOLHA = 2

/* O PALPITE INICIAL DA ALTURA UTIL, em pixel de papel a 96 dpi.

   A folha tem 297 mm e 12 mm de margem de cada lado, o que deixa 273 mm de
   corpo; o rodape come uns 12 mm. Sobram 261 mm, que sao 984 px. O cabecalho
   tem altura FIXA por construcao (tres fileiras de mesma altura, ver o
   comentario do Cabecalho) e mede 178 px, o que deixa 806 px de corpo na
   folha 1. So os DADOS usam este numero: os layouts sao contados, e nao
   medidos.

   Sao palpites, e nao verdades: logo depois do primeiro desenho as duas
   alturas sao MEDIDAS na folha de verdade e tomam o lugar destes numeros.
   Palpite de altura sem medicao depois e o jeito classico de perder a ultima
   linha de cada pagina. */
/* A FOLHA NOVA (parte 5, 10/10/2026): 1123 px menos 45 em cima e 28
   embaixo, menos uns 30 do rodapé e uns 150 do cabeçalho 4 com o vão de 16,
   dá perto de 880. Continua sendo só o primeiro palpite. */
const ALTURA_COM_CABECALHO = 880

/* A FOLHA NA PÁGINA DE IMPRESSÃO passa do tamanho real quando a coluna
   deixa: até 1000 px de papel (wireframe 121, "uma largura boa"). O papel
   continua o mesmo, 794 px a 96 dpi; só a tela amplia. */
const TETO_DA_FOLHA_LARGA = 1000 / 794


/* ==========================================================================
   PARA QUEM A FOLHA VAI, E POR QUE ISSO DECIDE O DINHEIRO.

   Com valor e sem valor nunca foram gosto: sao dois leitores. O cliente
   precisa da tabela inteira, com o valor de cada tamanho, porque e nisso que
   ele diz sim. O chao de fabrica nao pode receber valor nenhum, porque preco
   de venda no galpao vira assunto de corredor.

   Entao o DESTINO decide, e nao a memoria de quem clicou: a folha do cliente
   nasce com valor e a folha da producao nasce sem, sempre, sem ninguem
   precisar lembrar. A IMPRESSAO e a unica excecao, e e do Henrique: ali ele
   troca com um toque, porque as vezes a folha do cliente vai para o arquivo
   sem preco, e as vezes a da producao vai junto do financeiro.
   ========================================================================== */
export type DestinoDaFolha = 'cliente' | 'producao'

/* ==========================================================================
   A FOLHA SEM A PAGINA EM VOLTA.

   Ela nasceu em 24/09, quando o PCP passou a abrir a folha num modal em vez de
   sair da tela. Antes disso a folha e a pagina eram a mesma peca, e ver a
   folha custava perder a fila, o pedido escolhido e a rolagem: quem confere
   quinze pedidos abria e voltava quinze vezes.

   Aqui dentro mora tudo que a folha precisa para existir: a paginacao, a
   medicao das duas alturas, a compressao e o desenho. O que fica de fora e o
   que e da PAGINA: titulo, o segmentado de com valor e sem valor, e os botoes.
   Quem monta a folha decide onde esses controles ficam, e no modal eles ficam
   no rodape dele.

   `aoContar` existe porque o numero de paginas so se sabe DEPOIS de paginar, e
   quem escreve "3 paginas" no subtitulo esta do lado de fora. Devolver por
   retorno obrigaria a paginar duas vezes.
   ========================================================================== */
export function FolhaDaCotacao({
  cotacao: c,
  vista,
  modo = 'dupla',
  largura = 'tela',
  aoContar,
}: {
  cotacao: Cotacao
  /** o que o preset de impressão manda sair: valor, campos do cabeçalho e módulos de fora */
  vista: VistaDaFolha
  /** dois layouts por página, ou um por página inteira (FOURTIME OS - 14) */
  modo?: ModoDaFolha
  /** 'larga': a coluna da página de impressão, onde a folha pode passar do tamanho real */
  largura?: 'tela' | 'larga'
  aoContar?: (paginas: number) => void
}) {
  const comValor = vista.valor
  const { campos, fora } = vista
  /* as cores de impressão do banco: o cartão de cada código na ficha do
     layout sai na cor de verdade, e não no hex guardado no dia em que foi
     lançado (hexDoBanco) */
  usarCoresDeImpressao()
  const tem = (k: string) => !fora.includes(k)

  /* ==========================================================================
     A PAGINACAO: uma regra para os layouts, uma regua para os dados.

     OS LAYOUTS seguem a REGRA: no maximo dois por folha. A regra vale mais
     que a regua aqui, porque com medicao pura um layout de observacao
     comprida empurraria o vizinho e o PDF do mesmo pedido mudaria de numero
     de paginas a cada linha digitada. Com dois por folha, o cliente sabe que
     a folha 3 tem os layouts 3 e 4, e a producao sabe onde procurar.

     Mas a regra sozinha CORTAVA. O kit de teste mostrou na primeira rodada:
     duas artes em retrato, com tabela de seis tamanhos cada, nao cabem numa
     folha, e a segunda saia serrada no meio da tabela. Entao a regra ganhou
     um teto de altura: cabem dois SE couberem dois, e um quando nao couberem.
     Foi o que o Henrique autorizou ao dizer "1 ou 2 layouts".

     OS DADOS seguem a REGUA, e nao a regra. A folha 1 e a dos dados, e o que
     a enche e o numero de layouts: com vinte layouts a tabela de resumo
     sozinha passa de uma folha. Entao eles sao quatro blocos que paginam entre
     si (a tabela, as condicoes, os informes e o aceite), e os layouts so
     comecam na folha seguinte a ultima folha de dados. No caso normal isso da
     exatamente o que foi pedido: dados na 1, layouts da 2 em diante.

     Os dados sao medidos contra a altura da folha COM cabecalho, mesmo nas
     folhas de dados que nao tem cabecalho. Perde-se um dedo de papel na
     segunda folha de dados, que quase nunca existe, e em troca nenhuma
     medicao pode cortar. Errar sobrando e um espaco em branco; errar
     faltando e uma clausula pela metade.
     ========================================================================== */
  const chave =
    c.id + ':' + c.alteradaEm + ':' + c.produtos.length + ':' + comValor + ':' + campos.join(',') + ':' + fora.join(',')

  /* A PÁGINA 1 DO TEMPLATE PADRÃO (FOURTIME OS - 14, seção 4), em quatro
     blocos que paginam entre si: o resumo, as condições, os informes e o
     aceite. Cada um vem embrulhado em dc-parte, que carrega os 16 px até o
     próximo DENTRO do bloco: margem não entra na altura medida, e o vão que
     não é medido é o vão que empurra a última linha para fora da folha.
     Condição que sobra vazia (tudo já está no cabeçalho) não vira bloco. */
  const blocosDeDados: BlocoDaFolha[] = useMemo(() => {
    const parte = (id: string, conteudo: ReactNode): BlocoDaFolha => ({
      id,
      conteudo: <div className="dc-parte">{conteudo}</div>,
    })
    const sai = (k: string) => !fora.includes(k)
    return [
      ...(sai('res') ? [parte('d-tabela', <ResumoDaPaginaUm cotacao={c} comValor={comValor} />)] : []),
      ...(sai('cond') && condicoesDaFolha(c, comValor, campos).length
        ? [parte('d-condicoes', <CondicoesDaPaginaUm cotacao={c} comValor={comValor} campos={campos} />)]
        : []),
      ...(sai('inf') && informesNaFolha(c, comValor).length
        ? [parte('d-informes', <InformesDaPaginaUm cotacao={c} comValor={comValor} />)]
        : []),
      ...(comValor && sai('ace') ? [parte('d-aceite', <AceiteDaPaginaUm cotacao={c} />)] : []),
    ]
  }, [c, comValor, campos, fora])

  /* O QUE CADA MÓDULO PRECISA DE FORA: a construção de cada código e o
     tamanho de cada arte. Chegam depois do primeiro desenho. */
  const construcoes = usarConstrucoes(c.produtos.map((p) => p.bloco.referencia))
  const imagens = usarImagens(c.produtos.map((p) => p.bloco.imagem))
  const larguraDaArte = modo === 'dupla' ? LARGURA_DA_COLUNA : LARGURA_DA_PAGINA
  const natural = (id: string) => {
    const b = c.produtos.find((p) => p.bloco.id === id)?.bloco
    return b ? alturaNaturalDaArte(b, imagens[b.imagem], larguraDaArte, tem('dest')) : 0
  }
  /* a altura da arte que o encaixe tirou de cada layout, por id */
  const [apertos, setApertos] = useState<Record<string, number>>({})

  const blocosDeLayout: BlocoDaFolha[] = c.produtos.map((p) => ({
    id: p.bloco.id,
    conteudo: (
      <ModuloNaFolha
        produto={p}
        comValor={comValor}
        modo={modo}
        construcao={construcoes[p.bloco.referencia.trim()]}
        imagem={imagens[p.bloco.imagem]}
        alturaDaArte={apertos[p.bloco.id] ?? natural(p.bloco.id)}
        fora={fora}
      />
    ),
  }))

  const [altoComCab, setAltoComCab] = useState(ALTURA_COM_CABECALHO)
  const dados = usarPaginacao(blocosDeDados, altoComCab, 'dados:' + chave)

  /* OS LAYOUTS NÃO SÃO MEDIDOS: eles são CONTADOS. Dois por folha (ou um, na
     página inteira), qualquer que seja a combinação. Quando não cabem em 297
     mm, quem cede é a ARTE, até o piso (o encaixe, mais abaixo), e não a
     paginação: o cliente sabe que a folha 3 tem os layouts 3 e 4. */
  const porFolha = modo === 'dupla' ? LAYOUTS_POR_FOLHA : 1
  const folhasDeLayout: BlocoDaFolha[][] = []
  for (let i = 0; i < blocosDeLayout.length; i += porFolha) {
    folhasDeLayout.push(blocosDeLayout.slice(i, i + porFolha))
  }

  /* O CABEÇALHO SAI SEMPRE, mesmo com o preset tirando tudo da página 1: ele
     é quem diz de que cotação o papel é. Sem bloco de dados, a folha 1 fica
     só com ele. */
  const paginasDeDados = dados.paginas.some((p) => p.length) ? dados.paginas : [[]]
  const folhas = [
    ...paginasDeDados.map((blocos, i) => ({ blocos, comCabecalho: i === 0, layouts: false })),
    ...folhasDeLayout.map((blocos) => ({ blocos, comCabecalho: false, layouts: true })),
  ].filter((f) => f.blocos.length || f.comCabecalho)

  /* Quem escreve "3 paginas" esta do lado de fora, e o numero so existe
     depois de paginar. Efeito e nao retorno: contar durante o desenho faria o
     pai redesenhar no meio do desenho do filho. */
  useEffect(() => {
    aoContar?.(folhas.length)
  }, [folhas.length, aoContar])

  const palco = useRef<HTMLDivElement>(null)

  /* AS DUAS ALTURAS, MEDIDAS NA FOLHA DE VERDADE. clientHeight e nao
     getBoundingClientRect: o palco encolhe a folha com transform quando a
     tela e estreita, e o retangulo sairia encolhido junto. A conta da pagina
     e em milimetro de papel, e nao em pixel de tela. */
  useEffect(() => {
    const fls = [...(palco.current?.querySelectorAll('.fl') ?? [])]
    const f = fls.find((x) => !!x.querySelector('.fl-topo'))
    const corpo = f?.querySelector('.fl-corpo')
    const comCab = corpo instanceof HTMLElement ? corpo.clientHeight : 0
    if (comCab > 200 && Math.abs(comCab - altoComCab) > 2) setAltoComCab(comCab)
  })

  /* O ENCAIXE RODA DEPOIS DE TODO DESENHO, e não uma vez só: a construção
     que chega, a arte que carrega e a troca de com valor por sem valor mudam
     a altura de cada módulo. Ele só mexe no estado quando alguma arte muda
     de altura, então rodar de novo à toa custa só uma medição. Ver
     encaixarArtes, em paginas-de-layout.tsx. */
  const ultimo = useRef({ apertos, natural, piso: PISO_DA_ARTE[modo] })
  ultimo.current = { apertos, natural, piso: PISO_DA_ARTE[modo] }
  const encaixar = useCallback(() => {
    const p = palco.current
    if (!p) return
    const { apertos: a, natural: n, piso } = ultimo.current
    const novo = encaixarArtes(p, a, n, piso)
    if (novo) setApertos(novo)
  }, [])
  useEffect(() => {
    encaixar()
  })
  /* E QUANDO UM MÓDULO MUDA DE TAMANHO SOZINHO: a fonte que chega, a pílula
     que deita, a imagem que decodifica. Nada disso desenha a folha de novo,
     e sem o observador a coluna ficava passando da folha até o próximo
     desenho, que podia não vir. */
  /* Um encaixe por quadro, no máximo, e só quando a ALTURA de algum módulo
     mudou: trocar o zoom da folha (a janela que muda de tamanho) também
     avisa o observador, e ali nada mudou no papel. */
  const nModulos = c.produtos.length
  useEffect(() => {
    const p = palco.current
    if (!p || typeof ResizeObserver === 'undefined') return
    const alturas = new WeakMap<Element, number>()
    let pedido = 0
    const olho = new ResizeObserver((mudas) => {
      let mudou = false
      for (const m of mudas) {
        const h = (m.target as HTMLElement).offsetHeight
        if (alturas.get(m.target) !== h) {
          alturas.set(m.target, h)
          mudou = true
        }
      }
      if (mudou && !pedido) {
        pedido = requestAnimationFrame(() => {
          pedido = 0
          encaixar()
        })
      }
    })
    for (const m of p.querySelectorAll('.fl .dc-mod')) olho.observe(m)
    return () => {
      if (pedido) cancelAnimationFrame(pedido)
      olho.disconnect()
    }
  }, [encaixar, nModulos, folhas.length])

  return (
    <>
      {empresaAConferir() ? (
        <div className="fl-nao-imprime" style={{ marginBottom: 'var(--sp-5)' }}>
          <Aviso tom="warn" titulo="O rodapé ainda está com dados de molde">
            Os dados da empresa ainda não foram preenchidos, e eles saem no rodapé de toda folha
            impressa. Preencha em Configurações · Empresa antes de mandar esta cotação para um
            cliente de verdade.
          </Aviso>
        </div>
      ) : null}

      {/* A AREA DE MEDICAO DOS DADOS. Ela desenha de verdade, com a largura
          de verdade, fora da vista: o que nao e desenhado nao tem altura para
          medir. Some na impressao. Os LAYOUTS nao passam por aqui: eles sao
          contados, dois por folha, e quem resolve o espaco e a compressao. */}
      <Medidor aoMedir={dados.medidor} blocos={blocosDeDados} />

      <div ref={palco}>
        <Palco zoom teto={largura === 'larga' ? TETO_DA_FOLHA_LARGA : 1}>
          {folhas.map((folha, i) => (
            /* O CABECALHO E DA PRIMEIRA FOLHA, E SO DELA.

               A folha 1 e a folha dos dados: e ali que estao quem compra, o
               que foi combinado e o resumo de todos os layouts. Daí em diante
               so existem layouts, e repetir o cabecalho em cada folha era
               gastar 30 mm de papel para dizer de novo o que ja foi dito uma
               vez. Esses 30 mm sao o que faltava para a arte ter tamanho de
               conferencia. O rodape fica em todas: ele e quem diz de que
               documento aquela folha solta veio. */
            <Folha
              key={i}
              numero={i + 1}
              de={folhas.length}
              classe="fl-nova"
              cabecalho={
                folha.comCabecalho ? (
                  <CabecalhoDaPaginaUm cotacao={c} comValor={comValor} campos={campos} />
                ) : undefined
              }
              rodape={(n, de) => <RodapeDaFolhaNova cotacao={c} comValor={comValor} numero={n} de={de} />}
            >
              {folha.layouts ? (
                <div className={modo === 'dupla' ? 'dc-dupla' : 'dc-uma'}>
                  {folha.blocos.map((b) => (
                    <div key={b.id}>{b.conteudo}</div>
                  ))}
                </div>
              ) : (
                folha.blocos.map((b) => <div key={b.id}>{b.conteudo}</div>)
              )}
            </Folha>
          ))}
        </Palco>
      </div>
    </>
  )
}

/* ==========================================================================
   A folha como PAGINA: a rota /cotacao/:id/folha e a /producao.
   ========================================================================== */
export function DocumentoDaCotacao({ para = 'cliente' }: { para?: DestinoDaFolha }) {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const { cotacao: c, carregando, falha } = usarCotacao(id)
  /* O PRESET decide o que sai no papel: com valor ou sem, os campos do
     cabeçalho e os módulos. O destino só decide qual abre primeiro (o Cliente
     na folha do cliente, o Produção na da produção, ou o que alguém marcou
     para abrir ali). Ver presets-da-folha.tsx. */
  const [busca] = useSearchParams()
  const presets = usarPresetsDaFolha(para, busca.get('preset') ?? '')
  const [janela, setJanela] = useState<'' | 'novo' | 'editar' | 'apagar'>('')
  /* 2 por página ou 1 por página NÃO é do preset: decide-se na hora */
  const [modo, setModo] = usarModoDaFolha()
  const [paginas, setPaginas] = useState(0)
  const contar = useCallback((n: number) => setPaginas(n), [])

  if (carregando) {
    return (
      <Pagina acima="Comercial" titulo="Abrindo a folha...">
        <Esqueleto altura={420} />
      </Pagina>
    )
  }

  if (!c) {
    return (
      <Pagina acima="Comercial" titulo={falha ? 'Não consegui abrir' : 'Cotação não encontrada'}>
        <Vazio
          titulo={falha ? 'Não consegui abrir esta cotação' : 'Esta cotação não existe mais'}
          texto={falha || 'Ela pode ter sido apagada por outra pessoa.'}
          acao={
            <Botao tom="primario" onClick={() => navegar('/cotacao')}>
              Voltar para a lista
            </Botao>
          }
        />
      </Pagina>
    )
  }

  const nomeDoPreset = presets.escolhido.nome
  return (
    <Pagina
      acima={
        <button type="button" className="ct-volta" onClick={() => navegar('/cotacao/' + c.id)}>
          Voltar ao editor
        </button>
      }
      titulo={(para === 'producao' ? 'Folha da produção ' : 'Folha do cliente ') + c.numero}
      sub={
        <>
          Com o preset <b>{nomeDoPreset}</b>
          {presets.mudou.length ? ', mudado nesta impressão' : ''}. {paginas} {paginas === 1 ? 'página' : 'páginas'}.
        </>
      }
      acoes={
        <>
          <PresetsNoTopo p={presets} aoNovo={() => setJanela('novo')} />
          {/* o vazio do seletor é o padrão: 2 por página (FOURTIME OS - 14) */}
          <Seletor
            rotulo="LAYOUTS"
            valor={modo === 'cheia' ? 'cheia' : ''}
            vazio="2 por página"
            opcoes={[{ valor: 'cheia', rotulo: '1 por página' }]}
            aoEscolher={(v) => setModo(v === 'cheia' ? 'cheia' : 'dupla')}
          />
          <Botao tom="contorno" onClick={() => navegar('/cotacao/' + c.id)}>
            <PencilSimple size={17} />
            Editar
          </Botao>
          <Botao tom="primario" onClick={imprimir}>
            <Printer size={17} />
            Imprimir ou salvar em PDF
          </Botao>
        </>
      }
    >
      <div className="ct-pr-caixa">
        <div className="ct-pr-tela">
          <div className="ct-pr-folhas">
            <FolhaDaCotacao
              key={modo}
              cotacao={c}
              vista={presets.vista}
              modo={modo}
              largura="larga"
              aoContar={contar}
            />
          </div>
          <BarraDoPreset
            p={presets}
            numero={c.numero}
            aoNovo={() => setJanela('novo')}
            aoEditar={() => setJanela('editar')}
            aoApagar={() => setJanela('apagar')}
          />
        </div>
      </div>
      {janela === 'novo' || janela === 'editar' ? (
        <ModalDoPreset modo={janela} p={presets} aoFechar={() => setJanela('')} />
      ) : null}
      {janela === 'apagar' ? <PerguntaDeApagarPreset p={presets} aoFechar={() => setJanela('')} /> : null}
    </Pagina>
  )
}
