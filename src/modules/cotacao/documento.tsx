import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Aviso, Botao, Esqueleto, Pagina, Segmentado, Vazio } from '@ds'
import { empresaAConferir } from '@dominio/empresa'
import {
  CaixaDeImagem,
  Folha,
  Medidor,
  GradeDeTamanhos,
  ModuloDeLayout,
  Palco,
  compactarPalco,
  imprimir,
  usarPaginacao,
  type BlocoDaFolha,
} from '@dominio/layout'
import { pecasDoProduto, totalDoProduto, type Cotacao, type ProdutoCotado } from '@dominio/cotacao'
import './documento.css'
import {
  AceiteDaPaginaUm,
  CabecalhoDaPaginaUm,
  CondicoesDaPaginaUm,
  InformesDaPaginaUm,
  ResumoDaPaginaUm,
  RodapeDaFolhaNova,
  condicoesDaFolha,
} from './pagina-um'
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

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
  comValor,
  aoContar,
}: {
  cotacao: Cotacao
  comValor: boolean
  aoContar?: (paginas: number) => void
}) {

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
  const chave = c.id + ':' + c.alteradaEm + ':' + c.produtos.length + ':' + comValor

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
    return [
      parte('d-tabela', <ResumoDaPaginaUm cotacao={c} comValor={comValor} />),
      ...(condicoesDaFolha(c, comValor).length
        ? [parte('d-condicoes', <CondicoesDaPaginaUm cotacao={c} comValor={comValor} />)]
        : []),
      ...(c.informes.some((x) => x.noDocumento && x.texto.trim())
        ? [parte('d-informes', <InformesDaPaginaUm cotacao={c} comValor={comValor} />)]
        : []),
      ...(comValor ? [parte('d-aceite', <AceiteDaPaginaUm cotacao={c} />)] : []),
    ]
  }, [c, comValor])

  const blocosDeLayout: BlocoDaFolha[] = useMemo(
    () =>
      c.produtos.map((p) => ({
        id: p.bloco.id,
        conteudo: <ProdutoNaFolha produto={p} comValor={comValor} />,
      })),
    [c, comValor],
  )

  const [altoComCab, setAltoComCab] = useState(ALTURA_COM_CABECALHO)
  const dados = usarPaginacao(blocosDeDados, altoComCab, 'dados:' + chave)

  /* OS LAYOUTS NÃO SÃO MEDIDOS: eles são CONTADOS. Dois por folha, sempre,
     qualquer que seja a combinação. Quando os dois não cabem em 297 mm, quem
     resolve é a compressão vertical, e não a paginação: a folha aperta até
     caber. Ver dominio/layout/compactar.ts para a ordem de quem cede. */
  const folhasDeLayout: BlocoDaFolha[][] = []
  for (let i = 0; i < blocosDeLayout.length; i += LAYOUTS_POR_FOLHA) {
    folhasDeLayout.push(blocosDeLayout.slice(i, i + LAYOUTS_POR_FOLHA))
  }

  const folhas = [
    ...dados.paginas.map((blocos, i) => ({ blocos, comCabecalho: i === 0 })),
    ...folhasDeLayout.map((blocos) => ({ blocos, comCabecalho: false })),
  ].filter((f) => f.blocos.length)

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

  /* A COMPRESSÃO RODA DEPOIS DE TODO DESENHO, e não uma vez só. Trocar com
     valor por sem valor, acrescentar um produto ou uma imagem terminar de
     carregar muda a altura de todas as folhas, e uma folha que passou a caber
     folgada não pode continuar com a tabela espremida do desenho anterior.
     A própria função devolve o estado limpo antes de apertar, então rodar de
     novo sem necessidade não custa nada além de uma medição. */
  useEffect(() => {
    const p = palco.current
    if (!p) return
    compactarPalco(p)
    /* E DE NOVO QUANDO A ARTE CHEGAR. Decodificar imagem não é evento do
       React: a altura da folha muda sem nenhuma re-renderização acontecer, e
       sem isto a folha ficaria apertada pela medida de quando a arte ainda
       não existia. */
    let vivo = true
    const artes = [...p.querySelectorAll('img')].filter((im) => !im.complete)
    if (!artes.length) return
    Promise.all(artes.map((im) => im.decode().catch(() => undefined))).then(() => {
      if (vivo) compactarPalco(p)
    })
    return () => {
      vivo = false
    }
  })

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
        <Palco>
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
                folha.comCabecalho ? <CabecalhoDaPaginaUm cotacao={c} comValor={comValor} /> : undefined
              }
              rodape={(n, de) => <RodapeDaFolhaNova cotacao={c} comValor={comValor} numero={n} de={de} />}
            >
              {folha.blocos.map((b) => (
                <div key={b.id}>{b.conteudo}</div>
              ))}
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
  /* o destino so decide o COMECO. Daqui para frente quem manda e o botao */
  const [comValor, setComValor] = useState(para !== 'producao')
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

  return (
    <Pagina
      acima={
        <button type="button" className="ct-volta" onClick={() => navegar('/cotacao/' + c.id)}>
          Voltar ao editor
        </button>
      }
      titulo={(para === 'producao' ? 'Folha da produção ' : 'Folha do cliente ') + c.numero}
      sub={
        (para === 'producao'
          ? 'O que vai para o chão de fábrica, do jeito que sai na impressora. '
          : 'O que o cliente recebe, do jeito que sai na impressora. ') +
        paginas +
        (paginas === 1 ? ' página.' : ' páginas.')
      }
      acoes={
        <>
          {/* O DESTINO JA DECIDIU, E ESTE BOTAO E SO PARA A IMPRESSAO. Ele nao
              muda para onde a folha vai nem o que foi enviado: muda o papel
              que sai agora da impressora. */}
          <Segmentado
            valor={comValor ? 'com' : 'sem'}
            opcoes={[
              { valor: 'com', rotulo: 'Com valor' },
              { valor: 'sem', rotulo: 'Sem valor' },
            ]}
            aoMudar={(v) => setComValor(v === 'com')}
          />
          <Botao tom="contorno" onClick={() => navegar('/cotacao/' + c.id)}>
            Editar
          </Botao>
          <Botao tom="primario" onClick={imprimir}>
            Imprimir ou salvar em PDF
          </Botao>
        </>
      }
    >
      <FolhaDaCotacao cotacao={c} comValor={comValor} aoContar={contar} />
    </Pagina>
  )
}

/* --- um produto na folha -------------------------------------------------
   O MESMO MODULO DA TELA, EM LEITURA. Nao e economia de codigo: e a promessa
   de que o que o cliente le no papel e o que o vendedor viu na tela. Duas
   montagens diferentes para a mesma peca e como nasce a cotacao que "na tela
   estava certo".

   A ARTE MANDA NO PAPEL. Quem confere um uniforme impresso olha a estampa
   primeiro, e por isso a coluna da arte fica com 1.7 contra 1.3 da ficha, que
   e a conta da v3.375: mais da metade da largura da folha. O bloco compacto
   que morava aqui dava 48 mm de arte numa folha de 190 mm, e ninguem conferia
   estampa nenhuma naquele selo. A medida esta no CSS, em .fl .mod. */
function ProdutoNaFolha({ produto, comValor }: { produto: ProdutoCotado; comValor: boolean }) {
  const b = produto.bloco
  return (
    <ModuloDeLayout
      bloco={b}
      aoMudar={() => {}}
      leitura
      semValor={!comValor}
      arte={<CaixaDeImagem imagem={b.imagem} arte={b.arte} leitura />}
      tabela={
        <GradeDeTamanhos
          leitura
          faixa={b.faixa}
          grade={b.grade}
          precoBase={comValor ? produto.precoBase : undefined}
          precoPorTamanho={produto.precoPorTamanho}
        />
      }
      pe={
        <div className="dc-prod-soma">
          {pecasDoProduto(produto)} peças
          {comValor ? (
            <>
              {' · '}
              <b>{dinheiro(totalDoProduto(produto))}</b>
            </>
          ) : null}
        </div>
      }
    />
  )
}
