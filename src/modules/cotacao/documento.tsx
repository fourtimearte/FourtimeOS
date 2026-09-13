import { useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Aviso, Botao, FaixaDeCores, Pagina, Vazio } from '@ds'
import { EMPRESA, EMPRESA_A_CONFERIR } from '@dominio/empresa'
import {
  Folha,
  GradeDeTamanhos,
  Palco,
  gradeEmTexto,
  imprimir,
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

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')

export function DocumentoDaCotacao() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const c = acharCotacao(id)

  /* A PAGINACAO AQUI E UMA REGRA, E NAO UMA MEDICAO.

     A folha 1 e sempre a das informacoes: resumo, condicoes, informes legais
     e o aceite. Os layouts comecam na folha 2, DOIS POR FOLHA. Foi assim que
     o Henrique pediu, e a regra e melhor que a regua neste caso: com medicao,
     um layout com observacao comprida empurraria o vizinho para a folha
     seguinte e o PDF de um mesmo pedido mudaria de numero de paginas a cada
     linha digitada. Com a regra, o cliente sabe que a folha 3 tem os layouts
     3 e 4, e a producao sabe onde procurar.

     O que a regra NAO resolve e um layout que nao caiba em meia folha. Esse e
     o trabalho de apertar o conteudo, que ainda nao existe e esta anotado. */
  const paginas: BlocoDaFolha[][] = useMemo(() => {
    if (!c) return []
    const folhas: BlocoDaFolha[][] = [[{ id: 'resumo', conteudo: <Resumo cotacao={c} /> }]]
    for (let i = 0; i < c.produtos.length; i += LAYOUTS_POR_FOLHA) {
      folhas.push(
        c.produtos.slice(i, i + LAYOUTS_POR_FOLHA).map((p) => ({
          id: p.bloco.id,
          conteudo: <ProdutoNaFolha produto={p} />,
        })),
      )
    }
    return folhas
  }, [c])

  const palco = useRef<HTMLDivElement>(null)

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
      titulo={'Folha da cotação ' + c.numero}
      sub={'O que o cliente recebe, do jeito que sai na impressora. ' + paginas.length + (paginas.length === 1 ? ' página.' : ' páginas.')}
      acoes={
        <>
          <Botao tom="contorno" onClick={() => navegar('/cotacao/' + c.id)}>
            Editar
          </Botao>
          <Botao tom="primario" onClick={imprimir}>
            Imprimir ou salvar em PDF
          </Botao>
        </>
      }
    >
      {EMPRESA_A_CONFERIR ? (
        <div className="fl-nao-imprime" style={{ marginBottom: 'var(--sp-5)' }}>
          <Aviso tom="warn" titulo="O rodapé ainda está com dados de molde">
            Endereço e CNPJ da Fourtime ainda não foram preenchidos no sistema. Eles aparecem no
            rodapé de toda folha impressa, então preencha antes de mandar esta cotação para um
            cliente de verdade.
          </Aviso>
        </div>
      ) : null}

      <div ref={palco}>
      <Palco>
        {paginas.map((pagina, i) => (
          <Folha
            key={i}
            numero={i + 1}
            de={paginas.length}
            cabecalho={<Cabecalho cotacao={c} />}
            rodape={<RodapeDaEmpresa cotacao={c} primeira={i === 0} />}
          >
            {pagina.map((b) => (
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
function Cabecalho({ cotacao }: { cotacao: Cotacao }) {
  const c = cotacao
  return (
    <div className="dc-cab">
      <div className="dc-logo">
        <span className="dc-marca">FOURTIME</span>
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
      <Celula rotulo="Total" valor={dinheiro(totalDaCotacao(c))} forte />
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

function RodapeDaEmpresa({ cotacao, primeira }: { cotacao: Cotacao; primeira: boolean }) {
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
          {pecasDaCotacao(cotacao)} peças · {dinheiro(totalDaCotacao(cotacao))}
        </span>
      ) : null}
    </div>
  )
}

/* --- um produto na folha ------------------------------------------------- */
function ProdutoNaFolha({ produto }: { produto: ProdutoCotado }) {
  const b = produto.bloco
  const tecido = b.tecidos[0]
  return (
    <article className="dc-prod">
      <div className="dc-prod-img">
        {b.imagem ? (
          <img src={b.imagem} alt={b.arte || b.referencia} />
        ) : (
          <span className="dc-sem-img">sem imagem</span>
        )}
        {b.arte ? <span className="dc-arte">{b.arte}</span> : null}
      </div>

      <div className="dc-prod-dados">
        <h3 className="dc-prod-titulo">
          <span className="dc-n">{b.n}</span>
          {b.referencia} {b.nomeDaReferencia}
        </h3>
        <dl className="dc-lista">
          {tecido?.nome ? <Par rotulo="Tecido" valor={tecido.nome} /> : null}
          {tecido?.cor ? <Par rotulo="Cor" valor={tecido.cor} /> : null}
          {b.genero ? <Par rotulo="Gênero" valor={b.genero} /> : null}
          <Par rotulo="Grade" valor={gradeEmTexto(b.faixa, b.grade)} />
        </dl>
        {b.design.length ? (
          <div className="dc-faixas">
            {b.design.map((d) => (
              <FaixaDeCores key={d.tag} tecnica={d.tecnica} rotulo={d.tag} cores={d.cores} impressao />
            ))}
          </div>
        ) : null}
        {/* já saneada na porta de entrada do bloco (migrarBloco), e só pode
            conter cor, marca-texto e quebra de linha */}
        {b.observacao ? (
          <p className="dc-obs rico" dangerouslySetInnerHTML={{ __html: b.observacao }} />
        ) : null}
      </div>

      <div className="dc-prod-tabela">
        <GradeDeTamanhos
          leitura
          faixa={b.faixa}
          grade={b.grade}
          precoBase={produto.precoBase}
          precoPorTamanho={produto.precoPorTamanho}
        />
        <div className="dc-prod-soma">
          {pecasDoProduto(produto)} peças · <b>{dinheiro(totalDoProduto(produto))}</b>
        </div>
      </div>
    </article>
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

/* --- o resumo geral, com o aceite ---------------------------------------- */
function Resumo({ cotacao }: { cotacao: Cotacao }) {
  const c = cotacao
  const base = subtotal(c)
  const informes = c.informes.filter((x) => x.noDocumento)
  return (
    <section className="dc-resumo">
      <h3 className="dc-h">Resumo do orçamento</h3>

      <table className="dc-tab">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Grade</th>
            <th className="num">Peças</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {c.produtos.map((p) => (
            <tr key={p.bloco.id}>
              <td>
                <b>{p.bloco.referencia}</b> {p.bloco.nomeDaReferencia}
              </td>
              <td className="dc-grade-linha">{gradeEmTexto(p.bloco.faixa, p.bloco.grade)}</td>
              <td className="num">{pecasDoProduto(p)}</td>
              <td className="num">{dinheiro(totalDoProduto(p))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Subtotal</td>
            <td className="num">{pecasDaCotacao(c)}</td>
            <td className="num">{dinheiro(base)}</td>
          </tr>
          {c.ajustes.map((a) => (
            <tr key={a.id}>
              <td colSpan={3}>
                {a.descricao || 'Ajuste'}
                {a.tipo === 'porcento' ? ' (' + a.valor + '%)' : ''}
              </td>
              <td className="num">{dinheiro(valorDoAjuste(a, base))}</td>
            </tr>
          ))}
          <tr className="dc-total">
            <td colSpan={2}>Total</td>
            <td className="num">{dinheiro(precoMedioPorPeca(c))} por peça</td>
            <td className="num">{dinheiro(totalDaCotacao(c))}</td>
          </tr>
        </tfoot>
      </table>

      <dl className="dc-informe">
        <Par rotulo="Prazo de produção" valor={c.informe.prazo} />
        <Par rotulo="Pagamento" valor={c.informe.pagamento} />
        <Par rotulo="Envio" valor={c.informe.entrega} />
        <Par rotulo="Tabela de preço" valor={c.informe.tabelaDePreco} />
        <Par rotulo="Validade desta proposta" valor={data(c.validaAte)} />
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
    </section>
  )
}
