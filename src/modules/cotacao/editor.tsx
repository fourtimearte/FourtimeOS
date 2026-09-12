import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  CampoDeData,
  Entrada,
  Pagina,
  Selo,
  Seletor,
  Vazio,
  avisar,
} from '@ds'
import {
  CaixaDeImagem,
  FileiraDoLayout,
  FileiraEmLeitura,
  GradeDeTamanhos,
  blocoEmBranco,
  colarBloco,
  copiarBloco,
  temCopia,
  type Bloco,
  type Faixa,
  type Grade,
} from '@dominio/layout'
import {
  NOME_DO_ESTADO_DA_COTACAO,
  acharCotacao,
  apagarCotacao,
  aprovar,
  baixarCft,
  listarCotacoes,
  numeroDePedido,
  registrarEnvio,
  travada,
  pecasDaCotacao,
  pecasDoProduto,
  precoMedioPorPeca,
  salvarCotacao,
  subtotal,
  totalDaCotacao,
  totalDoProduto,
  valorDoAjuste,
  type Ajuste,
  type Cotacao,
  type EstadoDaCotacao,
  type ProdutoCotado,
} from '@dominio/cotacao'
import './cotacao.css'

/* ==========================================================================
   O editor de cotacao.

   O arranjo e o que o Henrique pediu e esta no plano do passo 15: imagem a
   esquerda, detalhes tecnicos em dropdown a direita, e a tabela de tamanho,
   valor e total atravessando as duas colunas. A ficha de producao, na fase 2,
   usa as MESMAS pecas num arranjo diferente: imagem a esquerda e uma coluna de
   cartoes a direita. E por isso que as pecas moram em dominio/layout e nao
   aqui dentro.

   Salvar e explicito, nao automatico: o vendedor precisa poder mexer no preco,
   olhar, e desistir.
   ========================================================================== */

const TOM_DO_ESTADO: Record<EstadoDaCotacao, 'neutro' | 'info' | 'ok' | 'warn' | 'brand'> = {
  rascunho: 'neutro',
  enviada: 'info',
  aprovada: 'ok',
  recusada: 'brand',
  vencida: 'warn',
}

const ESTADOS = (Object.keys(NOME_DO_ESTADO_DA_COTACAO) as EstadoDaCotacao[]).map((e) => ({
  valor: e,
  rotulo: NOME_DO_ESTADO_DA_COTACAO[e],
}))

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/* A porta: acha a cotacao e some do caminho.

   Quem edita e o Editor logo abaixo, e ele so nasce com uma cotacao na mao.
   Separar os dois nao e capricho: enquanto o editor aceitava uma cotacao que
   podia ser nula, cada funcao dentro dele precisava perguntar de novo se ela
   existia, e o compilador reclamava com razao. Com a porta na frente, o nulo
   acaba aqui e nao atravessa o arquivo inteiro. */
export function EditorDeCotacao() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const original = acharCotacao(id)

  if (!original) {
    return (
      <Pagina acima="Comercial" titulo="Cotação não encontrada">
        <Vazio
          titulo="Esta cotação não existe mais"
          texto="Ela pode ter sido apagada nesta mesma aba. Volte para a lista e escolha outra."
          acao={
            <Botao tom="primario" onClick={() => navegar('/cotacao')}>
              Voltar para a lista
            </Botao>
          }
        />
      </Pagina>
    )
  }

  /* a chave troca o editor inteiro quando muda de cotacao: nenhum rascunho de
     uma sobra dentro da outra */
  return <Editor key={original.id} inicial={original} />
}

function Editor({ inicial }: { inicial: Cotacao }) {
  const navegar = useNavigate()
  const [c, setC] = useState<Cotacao>(inicial)
  const [sujo, setSujo] = useState(false)
  const [podeColar, setPodeColar] = useState(() => temCopia())
  /* apagar pede confirmacao no proprio botao: o sistema nao usa caixa de
     dialogo do navegador em lugar nenhum */
  const [confirmando, setConfirmando] = useState(false)

  /* avisa antes de fechar a aba com mudanca nao salva */
  useEffect(() => {
    if (!sujo) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  const mudar = (parte: Partial<Cotacao>) => {
    setC((x) => ({ ...x, ...parte }))
    setSujo(true)
  }

  const mudarProduto = (i: number, troca: (p: ProdutoCotado) => ProdutoCotado) =>
    mudar({ produtos: c.produtos.map((p, k) => (k === i ? troca(p) : p)) })

  const mudarBloco = (i: number, b: Bloco) => mudarProduto(i, (p) => ({ ...p, bloco: b }))

  function novoProduto() {
    mudar({
      produtos: [
        ...c.produtos,
        { bloco: blocoEmBranco(c.produtos.length + 1), precoPorTamanho: {}, precoBase: 0 },
      ],
    })
  }

  function colar() {
    const b = colarBloco(c.produtos.length + 1)
    if (!b) {
      avisar('Nada copiado ainda. Use Copiar layout num produto primeiro.', 'warn')
      return
    }
    mudar({ produtos: [...c.produtos, { bloco: b, precoPorTamanho: {}, precoBase: 0 }] })
    avisar('Layout colado como produto ' + (c.produtos.length + 1), 'ok')
  }

  function removerProduto(i: number) {
    mudar({
      produtos: c.produtos.filter((_, k) => k !== i).map((p, k) => ({ ...p, bloco: { ...p.bloco, n: k + 1 } })),
    })
  }

  function salvar() {
    salvarCotacao(c)
    setSujo(false)
    avisar('Cotação ' + c.numero + ' salva', 'ok')
  }

  function baixar() {
    salvarCotacao(c)
    setSujo(false)
    baixarCft(c)
  }

  function apagar() {
    apagarCotacao(c.id)
    avisar('Cotação ' + c.numero + ' apagada', 'ok')
    navegar('/cotacao')
  }

  /* Enviar grava o que saiu. O total vai congelado junto, e nao recalculado
     depois: a conversa tres semanas depois e sobre o numero que o cliente viu,
     e nao sobre o de hoje. */
  function enviar() {
    const nova = registrarEnvio(c, c.cliente.contato || c.cliente.nome, '')
    setC(nova)
    salvarCotacao(nova)
    setSujo(false)
    avisar('Envio ' + nova.enviadas.length + ' registrado. Agora mande o PDF para o cliente.', 'ok')
  }

  function dizerSim() {
    const pedido = numeroDePedido(
      listarCotacoes()
        .map((x) => x.aprovacao?.pedido ?? '')
        .filter(Boolean),
    )
    const nova = aprovar(c, pedido, c.vendedor || 'admin')
    setC(nova)
    salvarCotacao(nova)
    setSujo(false)
    avisar('Pedido ' + pedido + ' gerado. A grade está travada a partir de agora.', 'ok')
  }

  const base = subtotal(c)
  const total = totalDaCotacao(c)
  const fechada = travada(c)

  return (
    <Pagina
      acima={
        <button type="button" className="ct-volta" onClick={() => navegar('/cotacao')}>
          Cotação de venda
        </button>
      }
      titulo={
        <span className="ct-titulo">
          {c.numero}
          <Selo tom={TOM_DO_ESTADO[c.estado]}>{NOME_DO_ESTADO_DA_COTACAO[c.estado]}</Selo>
          {sujo ? <span className="ct-sujo">não salva</span> : null}
        </span>
      }
      sub={c.cliente.nome || 'sem cliente ainda'}
      acoes={
        <>
          <Botao
            tom={confirmando ? 'perigo' : 'limpo'}
            onClick={() => (confirmando ? apagar() : setConfirmando(true))}
            onBlur={() => setConfirmando(false)}
          >
            {confirmando ? 'Confirmar' : 'Apagar'}
          </Botao>
          <Botao tom="contorno" onClick={baixar}>
            Baixar .cft
          </Botao>
          <Botao tom="contorno" onClick={() => { salvar(); navegar('/cotacao/' + c.id + '/folha') }}>
            Ver a folha
          </Botao>
          {!fechada ? (
            <Botao tom="contorno" onClick={enviar}>
              Registrar envio
            </Botao>
          ) : null}
          {!fechada && c.produtos.length ? (
            <Botao tom="forte" onClick={dizerSim}>
              Cliente aprovou
            </Botao>
          ) : null}
          <Botao tom="primario" onClick={salvar}>
            Salvar
          </Botao>
        </>
      }
    >
      {fechada && c.aprovacao ? (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <Aviso tom="ok" titulo={'Aprovada, e virou o pedido ' + c.aprovacao.pedido}>
            {c.vendedor ? c.aprovacao.quem : 'Alguém'} registrou o sim em{' '}
            {new Date(c.aprovacao.em).toLocaleString('pt-BR')}, sobre o envio{' '}
            {c.aprovacao.versao}. A grade e os valores estão travados a partir daqui: a produção já
            corta por eles, e mudar quantidade depois do corte é o jeito clássico de sobrar pano e
            faltar peça. Se o cliente mudar de ideia, o caminho é uma cotação nova.
          </Aviso>
        </div>
      ) : null}

      {/* --- o cabecalho do documento --- */}
      <section className="ct-bloco">
        <h3 className="ct-h">Quem recebe</h3>
        <div className="ct-form">
          <Campo rotulo="Cliente" className="col-2">
            <Entrada
              value={c.cliente.nome}
              placeholder="Nome como sai na proposta"
              onChange={(e) => mudar({ cliente: { ...c.cliente, nome: e.target.value } })}
            />
          </Campo>
          <Campo rotulo="Contato">
            <Entrada
              value={c.cliente.contato}
              onChange={(e) => mudar({ cliente: { ...c.cliente, contato: e.target.value } })}
            />
          </Campo>
          <Campo rotulo="Cidade">
            <Entrada
              value={c.cliente.cidade}
              onChange={(e) => mudar({ cliente: { ...c.cliente, cidade: e.target.value } })}
            />
          </Campo>
          <Campo rotulo="Vendedor">
            <Entrada value={c.vendedor} onChange={(e) => mudar({ vendedor: e.target.value })} />
          </Campo>
          <Campo rotulo="Vale até">
            <CampoDeData bloco valor={c.validaAte} aoMudar={(d) => mudar({ validaAte: d })} />
          </Campo>
          <Campo rotulo="Situação">
            <Seletor
              bloco
              campo
              valor={c.estado}
              opcoes={ESTADOS}
              vazio="Rascunho"
              aoEscolher={(v) => mudar({ estado: (v || 'rascunho') as EstadoDaCotacao })}
            />
          </Campo>
        </div>
      </section>

      <section className="ct-bloco">
        <h3 className="ct-h">Informes de produção</h3>
        <div className="ct-form">
          <Campo rotulo="Prazo">
            <Entrada
              value={c.informe.prazo}
              onChange={(e) => mudar({ informe: { ...c.informe, prazo: e.target.value } })}
            />
          </Campo>
          <Campo rotulo="Entrega">
            <Entrada
              value={c.informe.entrega}
              onChange={(e) => mudar({ informe: { ...c.informe, entrega: e.target.value } })}
            />
          </Campo>
          <Campo rotulo="Pagamento" className="col-2">
            <Entrada
              value={c.informe.pagamento}
              onChange={(e) => mudar({ informe: { ...c.informe, pagamento: e.target.value } })}
            />
          </Campo>
          <Campo rotulo="Observação" className="col-2">
            <AreaTexto
              rows={2}
              value={c.informe.observacao}
              onChange={(e) => mudar({ informe: { ...c.informe, observacao: e.target.value } })}
            />
          </Campo>
        </div>
      </section>

      {/* --- os produtos --- */}
      {c.produtos.map((p, i) => (
        <Produto
          key={p.bloco.id}
          produto={p}
          travado={fechada}
          aoMudarBloco={(b) => mudarBloco(i, b)}
          aoMudarProduto={(troca) => mudarProduto(i, troca)}
          aoCopiar={() => {
            copiarBloco(p.bloco)
            setPodeColar(true)
            avisar('Layout copiado. Use Colar layout para repetir.', 'ok')
          }}
          aoRemover={() => removerProduto(i)}
        />
      ))}

      {!c.produtos.length ? (
        <Vazio
          titulo="Nenhum produto ainda"
          texto="Um produto é uma peça: referência, tecido, arte e grade de tamanhos."
          acao={
            <Botao tom="primario" onClick={novoProduto}>
              Primeiro produto
            </Botao>
          }
        />
      ) : (
        !fechada ? (
          <div className="ct-acoes-produto">
            <Botao tom="contorno" onClick={novoProduto}>
              Mais um produto
            </Botao>
            {podeColar ? (
              <Botao tom="limpo" onClick={colar}>
                Colar layout
              </Botao>
            ) : null}
          </div>
        ) : null
      )}

      {/* --- os ajustes e o fechamento --- */}
      {c.produtos.length ? (
        <section className="ct-bloco">
          <h3 className="ct-h">Ajustes no valor</h3>
          {c.ajustes.length ? (
            <div className="ct-ajustes">
              {c.ajustes.map((a) => (
                <LinhaDeAjuste
                  key={a.id}
                  ajuste={a}
                  travado={fechada}
                  base={base}
                  aoMudar={(novo) =>
                    mudar({ ajustes: c.ajustes.map((x) => (x.id === a.id ? novo : x)) })
                  }
                  aoRemover={() => mudar({ ajustes: c.ajustes.filter((x) => x.id !== a.id) })}
                />
              ))}
            </div>
          ) : (
            <p className="ct-nada">
              Nenhum desconto nem acréscimo. O total é a soma dos produtos.
            </p>
          )}
          {fechada ? null : (
          <div className="ct-acoes-produto">
            <Botao
              tom="contorno"
              tamanho="sm"
              onClick={() =>
                mudar({
                  ajustes: [
                    ...c.ajustes,
                    {
                      id: 'AJ' + Math.random().toString(36).slice(2, 7),
                      descricao: '',
                      tipo: 'porcento',
                      valor: 0,
                    },
                  ],
                })
              }
            >
              Mais um ajuste
            </Botao>
          </div>
          )}

          <div className="ct-fecha">
            <div>
              <span className="rot">Peças</span>
              <b>{pecasDaCotacao(c)}</b>
            </div>
            <div>
              <span className="rot">Subtotal</span>
              <b>{dinheiro(base)}</b>
            </div>
            <div>
              <span className="rot">Média por peça</span>
              <b>{dinheiro(precoMedioPorPeca(c))}</b>
            </div>
            <div className="forte">
              <span className="rot">Total</span>
              <b>{dinheiro(total)}</b>
            </div>
          </div>

          {c.enviadas.length ? (
            <div className="ct-envios">
              <h4>O que já foi enviado</h4>
              {c.enviadas.map((e) => (
                <div key={e.numero} className={c.aprovacao?.versao === e.numero ? 'ct-envio valeu' : 'ct-envio'}>
                  <b>Envio {e.numero}</b>
                  <span>{new Date(e.data).toLocaleString('pt-BR')}</span>
                  <span>{e.pecas ? e.pecas + ' peças' : 'peças não gravadas'}</span>
                  <span className="ct-envio-total">{dinheiro(e.total)}</span>
                  {c.aprovacao?.versao === e.numero ? <span className="ct-envio-selo">aprovado</span> : null}
                </div>
              ))}
              <p className="ct-nada">
                O valor de cada envio fica congelado como saiu. Ele não é recalculado quando o preço
                muda depois, porque a conversa com o cliente é sobre o número que ele viu.
              </p>
            </div>
          ) : null}

          <Aviso tom="info" titulo="Como o por cento é calculado">
            Ajuste em por cento vale sempre sobre o subtotal, nunca sobre o total já ajustado. Dois
            descontos de 10 por cento tiram 20, e não 19.
          </Aviso>
        </section>
      ) : null}
    </Pagina>
  )
}

/* --- um produto: imagem a esquerda, tecnica a direita, grade atravessando -- */
function Produto({
  produto,
  travado,
  aoMudarBloco,
  aoMudarProduto,
  aoCopiar,
  aoRemover,
}: {
  produto: ProdutoCotado
  travado?: boolean
  aoMudarBloco: (b: Bloco) => void
  aoMudarProduto: (troca: (p: ProdutoCotado) => ProdutoCotado) => void
  aoCopiar: () => void
  aoRemover: () => void
}) {
  const b = produto.bloco
  return (
    <section className="ct-produto">
      <header className="ct-produto-topo">
        <span className="ct-n">{b.n}</span>
        <b>{b.referencia || 'produto sem referência'}</b>
        <span className="ct-produto-resumo">
          {pecasDoProduto(produto)} peças · {dinheiro(totalDoProduto(produto))}
        </span>
        <span className="ct-produto-bts">
          <button type="button" className="img-bt" onClick={aoCopiar}>
            Copiar layout
          </button>
          {!travado ? (
            <button type="button" className="img-bt risco" onClick={aoRemover}>
              Remover
            </button>
          ) : null}
        </span>
      </header>

      <div className="ct-produto-corpo">
        <div className="ct-esq">
          <CaixaDeImagem
            leitura={travado}
            imagem={b.imagem}
            arte={b.arte}
            aoMudarImagem={(img) => aoMudarBloco({ ...b, imagem: img })}
            aoMudarArte={(arte) => aoMudarBloco({ ...b, arte })}
          />
        </div>

        <div className="ct-dir">
          {travado ? <FileiraEmLeitura bloco={b} /> : <FileiraDoLayout bloco={b} aoMudar={aoMudarBloco} />}
          <Campo rotulo="Observação do produto">
            <AreaTexto
              rows={3}
              value={b.observacao}
              placeholder="O que a produção precisa saber sobre esta peça"
              onChange={(e) => aoMudarBloco({ ...b, observacao: e.target.value })}
            />
          </Campo>
        </div>

        <div className="ct-grade">
          {travado ? null : (
          <div className="ct-preco-base">
            <Campo rotulo="Valor base" dica="Vale para todo tamanho sem valor próprio">
              <Entrada
                inputMode="decimal"
                value={produto.precoBase ? String(produto.precoBase) : ''}
                placeholder="0,00"
                onChange={(e) =>
                  aoMudarProduto((p) => ({
                    ...p,
                    precoBase: Number(e.target.value.replace(',', '.')) || 0,
                  }))
                }
              />
            </Campo>
          </div>
          )}
          <GradeDeTamanhos
            leitura={travado}
            faixa={b.faixa}
            grade={b.grade}
            aoMudar={travado ? undefined : (g: Grade) => aoMudarBloco({ ...b, grade: g })}
            aoTrocarFaixa={travado ? undefined : (f: Faixa) => aoMudarBloco({ ...b, faixa: f })}
            precoBase={produto.precoBase}
            precoPorTamanho={produto.precoPorTamanho}
            aoMudarPreco={(tamanho, valor) =>
              aoMudarProduto((p) => {
                const novo = { ...p.precoPorTamanho }
                if (valor === null) delete novo[tamanho]
                else novo[tamanho] = valor
                return { ...p, precoPorTamanho: novo }
              })
            }
          />
        </div>
      </div>
    </section>
  )
}

/* --- uma linha de ajuste ------------------------------------------------- */
function LinhaDeAjuste({
  ajuste,
  base,
  travado,
  aoMudar,
  aoRemover,
}: {
  ajuste: Ajuste
  base: number
  travado?: boolean
  aoMudar: (a: Ajuste) => void
  aoRemover: () => void
}) {
  const soma = ajuste.valor >= 0

  if (travado) {
    return (
      <div className="ct-ajuste travado">
        <span className="ct-sinal parado">{soma ? '+' : '−'}</span>
        <span>
          {Math.abs(ajuste.valor)}
          {ajuste.tipo === 'porcento' ? '%' : ' reais'}
        </span>
        <span className="ct-ajuste-motivo-lido">{ajuste.descricao || 'sem motivo escrito'}</span>
        <span className="ct-ajuste-conta">{dinheiro(valorDoAjuste(ajuste, base))}</span>
      </div>
    )
  }

  return (
    <div className="ct-ajuste">
      <button
        type="button"
        className="ct-sinal"
        onClick={() => aoMudar({ ...ajuste, valor: -ajuste.valor })}
        aria-label={soma ? 'Virar desconto' : 'Virar acréscimo'}
        title={soma ? 'Acréscimo. Clique para virar desconto.' : 'Desconto. Clique para virar acréscimo.'}
      >
        {soma ? '+' : '−'}
      </button>
      <input
        className="ct-ajuste-valor"
        inputMode="decimal"
        value={Math.abs(ajuste.valor) || ''}
        placeholder="0"
        onChange={(e) => {
          const n = Math.abs(Number(e.target.value.replace(',', '.')) || 0)
          aoMudar({ ...ajuste, valor: soma ? n : -n })
        }}
        aria-label="Valor do ajuste"
      />
      <Seletor
        tamanho="sm"
        valor={ajuste.tipo}
        opcoes={[
          { valor: 'porcento', rotulo: '%' },
          { valor: 'reais', rotulo: 'R$' },
        ]}
        vazio="%"
        aoEscolher={(v) => aoMudar({ ...ajuste, tipo: (v || 'porcento') as Ajuste['tipo'] })}
      />
      <input
        className="ct-ajuste-motivo"
        value={ajuste.descricao}
        placeholder="Motivo do ajuste"
        onChange={(e) => aoMudar({ ...ajuste, descricao: e.target.value })}
        aria-label="Motivo do ajuste"
      />
      <span className="ct-ajuste-conta">{dinheiro(valorDoAjuste(ajuste, base))}</span>
      <button type="button" className="img-bt risco" onClick={aoRemover}>
        Remover
      </button>
    </div>
  )
}
