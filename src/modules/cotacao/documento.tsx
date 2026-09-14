import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Aviso, Botao, LogoFourtime, Pagina, Segmentado, Vazio } from '@ds'
import { EMPRESA, empresaAConferir } from '@dominio/empresa'
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
import {
  NOME_DO_ESTADO_DA_COTACAO,
  acharCotacao,
  pecasDaCotacao,
  pecasDoProduto,
  precoMedioPorPeca,
  subtotal,
  totalDaCotacao,
  totalDoProduto,
  valorDoAjuste,
  type Cotacao,
  type ProdutoCotado,
} from '@dominio/cotacao'
import './documento.css'

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
const ALTURA_COM_CABECALHO = 806

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')

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

export function DocumentoDaCotacao({ para = 'cliente' }: { para?: DestinoDaFolha }) {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const c = acharCotacao(id)
  /* o destino so decide o COMECO. Daqui para frente quem manda e o botao */
  const [comValor, setComValor] = useState(para !== 'producao')

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
     sozinha passa de uma folha. Entao eles sao tres blocos que paginam entre
     si (a tabela, as condicoes com os informes, e o aceite), e os layouts so
     comecam na folha seguinte a ultima folha de dados. No caso normal isso da
     exatamente o que foi pedido: dados na 1, layouts da 2 em diante.

     Os dados sao medidos contra a altura da folha COM cabecalho, mesmo nas
     folhas de dados que nao tem cabecalho. Perde-se um dedo de papel na
     segunda folha de dados, que quase nunca existe, e em troca nenhuma
     medicao pode cortar. Errar sobrando e um espaco em branco; errar
     faltando e uma clausula pela metade.
     ========================================================================== */
  const chave =
    (c?.id ?? '') + ':' + (c?.alteradaEm ?? '') + ':' + (c?.produtos.length ?? 0) + ':' + comValor

  const blocosDeDados: BlocoDaFolha[] = useMemo(
    () =>
      c
        ? [
            { id: 'd-tabela', conteudo: <ResumoDoPedido cotacao={c} comValor={comValor} /> },
            { id: 'd-condicoes', conteudo: <Condicoes cotacao={c} comValor={comValor} /> },
            ...(comValor ? [{ id: 'd-aceite', conteudo: <Aceite cotacao={c} /> }] : []),
          ]
        : [],
    [c, comValor],
  )

  const blocosDeLayout: BlocoDaFolha[] = useMemo(
    () =>
      c
        ? c.produtos.map((p) => ({
            id: p.bloco.id,
            conteudo: <ProdutoNaFolha produto={p} comValor={comValor} />,
          }))
        : [],
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

  if (!c) {
    return (
      <Pagina acima="Comercial" titulo="Cotação não encontrada">
        <Vazio
          titulo="Esta cotação não existe mais"
          texto="Volte para a lista e escolha outra."
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
      titulo={
        (para === 'producao' ? 'Folha da produção ' : 'Folha do cliente ') + c.numero
      }
      sub={
        (para === 'producao'
          ? 'O que vai para o chão de fábrica, do jeito que sai na impressora. '
          : 'O que o cliente recebe, do jeito que sai na impressora. ') +
        folhas.length +
        (folhas.length === 1 ? ' página.' : ' páginas.')
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
              cabecalho={
                folha.comCabecalho ? <Cabecalho cotacao={c} comValor={comValor} /> : undefined
              }
              rodape={<RodapeDaEmpresa cotacao={c} primeira={i === 0} comValor={comValor} />}
            >
              {folha.blocos.map((b) => (
                <div key={b.id}>{b.conteudo}</div>
              ))}
            </Folha>
          ))}
        </Palco>
      </div>
    </Pagina>
  )
}

/* --- o cabecalho: quatro colunas por tres fileiras -----------------------
   A logo ocupa a coluna 1 nas duas primeiras fileiras. O rotulo fica EM CIMA
   do valor, e nao ao lado: com o rotulo ao lado, Cliente, CNPJ e Pagamento
   cortavam com reticencia. As tres fileiras tem a mesma altura, entao a
   altura do cabecalho nao depende do conteudo e a conta da quebra de pagina
   continua sendo uma conta fixa. */
function Cabecalho({ cotacao, comValor }: { cotacao: Cotacao; comValor: boolean }) {
  const c = cotacao
  return (
    <div className="dc-cab">
      <div className="dc-logo">
        {/* A LOGO DE VERDADE, e não mais a palavra FOURTIME escrita à mão. O
            "TIME" herda a cor do texto da folha, que é quase preto: no papel
            a marca sai nas duas cores certas sem variante nenhuma. */}
        <LogoFourtime altura="5.2mm" titulo="Fourtime" />
        <span className="dc-marca-sub">{EMPRESA.descricao}</span>
      </div>
      <Celula rotulo="Cliente" valor={c.cliente.nome} />
      <Celula rotulo="CPF ou CNPJ" valor={c.cliente.documento} />
      <Celula rotulo="Cotação nº" valor={c.numero} />
      <Celula rotulo="Vendedor" valor={c.vendedor} />
      <Celula rotulo="Contato" valor={c.cliente.contato} />
      <Celula rotulo="Vale até" valor={data(c.validaAte)} />
      <Celula rotulo="Situação" valor={NOME_DO_ESTADO_DA_COTACAO[c.estado]} />
      <Celula rotulo="Prazo" valor={c.informe.prazo} />
      <Celula rotulo="Pagamento" valor={c.informe.pagamento} />
      {/* a ultima celula da grade nao pode sumir: as tres fileiras tem altura
          fixa e e nela que a conta da quebra de pagina se apoia. Sem valor ela
          troca de conteudo, e passa a dizer o numero que a fabrica confere */}
      {comValor ? (
        <Celula rotulo="Total" valor={dinheiro(totalDaCotacao(c))} forte />
      ) : (
        <Celula rotulo="Peças" valor={String(pecasDaCotacao(c))} forte />
      )}
    </div>
  )
}

function Celula({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={forte ? 'dc-cel forte' : 'dc-cel'}>
      <span className="dc-rot">{rotulo}</span>
      <span className="dc-val">{valor || '-'}</span>
    </div>
  )
}

function RodapeDaEmpresa({
  cotacao,
  primeira,
  comValor,
}: {
  cotacao: Cotacao
  primeira: boolean
  comValor: boolean
}) {
  return (
    <div className="dc-pe">
      <span>
        <b>{EMPRESA.nome}</b> · {EMPRESA.endereco} · {EMPRESA.cidade}, {EMPRESA.uf} · CNPJ{' '}
        {EMPRESA.cnpj}
      </span>
      {/* o total em reais so na primeira folha: nas seguintes ele apareceria
          solto, sem o que o explica, e ja houve confusao com isso */}
      {primeira ? (
        <span className="dc-pe-total">
          {pecasDaCotacao(cotacao)} peças
          {comValor ? <> · {dinheiro(totalDaCotacao(cotacao))}</> : null}
        </span>
      ) : null}
    </div>
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

function Par({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </>
  )
}

/* --- os tres blocos da folha de dados -------------------------------------
   Eram um so, e um bloco so nao pagina: ou cabia inteiro ou saia serrado. O
   kit de teste mostrou o corte com seis layouts, que e um pedido pequeno.

   Divididos assim, os tres paginam entre si, e o corte, quando existir, cai
   ENTRE um bloco e outro em vez de no meio de uma clausula. A ordem e a da
   leitura: o que foi pedido, em que condicoes, e onde assinar. */

function ResumoDoPedido({ cotacao, comValor }: { cotacao: Cotacao; comValor: boolean }) {
  const c = cotacao
  const base = subtotal(c)
  return (
    <section className="dc-resumo">
      <h3 className="dc-h">{comValor ? 'Resumo do orçamento' : 'Resumo do pedido'}</h3>

      {/* UMA FILEIRA POR LAYOUT, e o numero do layout na frente. Ele e a
          unica coisa que amarra esta tabela as folhas de tras: quem le
          "L-07 faltou" precisa achar o L-07 sem contar folha. A grade saiu
          da linha: ela esta desenhada inteira, tamanho por tamanho, na folha
          do proprio layout, e repetida aqui em texto corrido so gastava a
          largura que o nome do produto precisava. */}
      <table className="dc-tab">
        <thead>
          <tr>
            <th className="dc-col-l">Layout</th>
            <th>Produto</th>
            <th className="num">Total de peças</th>
            {comValor ? <th className="num">Preço total</th> : null}
          </tr>
        </thead>
        <tbody>
          {c.produtos.map((p) => (
            <tr key={p.bloco.id}>
              <td className="dc-col-l">L-{String(p.bloco.n).padStart(2, '0')}</td>
              <td>
                <b>{p.bloco.referencia}</b> {p.bloco.nomeDaReferencia}
              </td>
              <td className="num">{pecasDoProduto(p)}</td>
              {comValor ? <td className="num">{dinheiro(totalDoProduto(p))}</td> : null}
            </tr>
          ))}
        </tbody>
        {/* SEM VALOR O RODAPE DA TABELA E SO A CONTA DE PECAS. Ajuste e total
            sao conversa de venda, e nao existem para quem corta. */}
        <tfoot>
          <tr className={comValor ? undefined : 'dc-total'}>
            <td colSpan={2}>{comValor ? 'Subtotal' : 'Total de peças'}</td>
            <td className="num">{pecasDaCotacao(c)}</td>
            {comValor ? <td className="num">{dinheiro(base)}</td> : null}
          </tr>
          {comValor
            ? c.ajustes.map((a) => (
                <tr key={a.id}>
                  <td colSpan={3}>
                    {a.descricao || 'Ajuste'}
                    {a.tipo === 'porcento' ? ' (' + a.valor + '%)' : ''}
                  </td>
                  <td className="num">{dinheiro(valorDoAjuste(a, base))}</td>
                </tr>
              ))
            : null}
          {comValor ? (
            <tr className="dc-total">
              <td colSpan={2}>Total</td>
              <td className="num">{dinheiro(precoMedioPorPeca(c))} por peça</td>
              <td className="num">{dinheiro(totalDaCotacao(c))}</td>
            </tr>
          ) : null}
        </tfoot>
      </table>
    </section>
  )
}

function Condicoes({ cotacao, comValor }: { cotacao: Cotacao; comValor: boolean }) {
  const c = cotacao
  const informes = c.informes.filter((x) => x.noDocumento)
  return (
    <section className="dc-resumo">
      <dl className="dc-informe">
        <Par rotulo="Prazo de produção" valor={c.informe.prazo} />
        {comValor ? <Par rotulo="Pagamento" valor={c.informe.pagamento} /> : null}
        <Par rotulo="Envio" valor={c.informe.entrega} />
        {comValor ? <Par rotulo="Tabela de preço" valor={c.informe.tabelaDePreco} /> : null}
        {comValor ? <Par rotulo="Validade desta proposta" valor={data(c.validaAte)} /> : null}
        {!comValor ? <Par rotulo="Pedido" valor={c.producao.pedido} /> : null}
        {!comValor ? <Par rotulo="Departamento" valor={c.producao.departamento} /> : null}
        {!comValor ? <Par rotulo="Embalagem" valor={c.producao.embalagem} /> : null}
      </dl>

      {/* Os informes que o vendedor deixou marcados. Os desmarcados ficam
          guardados na cotação e não aparecem aqui: o PDF é o que o cliente
          recebe, e ele só mostra o que foi escolhido para ele. */}
      {informes.length ? (
        <section className="dc-informes">
          <h3>Informes sobre a produção</h3>
          <ol>
            {informes.map((x) => (
              <li key={x.id}>{x.texto}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </section>
  )
}

/* O ACEITE E DA VENDA. Quem corta nao assina proposta, e uma linha de
   assinatura na folha do galpao so confunde quem le: por isso ele nem entra
   na lista de blocos quando a folha e sem valor. */
function Aceite({ cotacao }: { cotacao: Cotacao }) {
  const c = cotacao
  return (
    <div className="dc-aceite">
      <p>
        A produção começa depois da aprovação da arte e do pagamento combinado acima. Grade e
        quantidade valem como estão nesta folha: mudança depois da aprovação pode mudar prazo e
        valor.
      </p>
      <div className="dc-assinaturas">
        <span>
          <i />
          {c.cliente.nome || 'Cliente'}
        </span>
        <span>
          <i />
          Fourtime · {c.vendedor || 'vendedor'}
        </span>
        <span>
          <i />
          Data
        </span>
      </div>
    </div>
  )
}
