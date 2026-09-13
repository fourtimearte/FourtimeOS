import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, FileText, FloppyDisk, Plus, Trash, WhatsappLogo, X } from '@phosphor-icons/react'
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Entrada,
  Pagina,
  Segmentado,
  Selo,
  Seletor,
  Vazio,
  avisar,
} from '@ds'
import {
  CaixaDeImagem,
  ModuloDeLayout,
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
  salvarCotacao,
  subtotal,
  totalDaCotacao,
  totalDoProduto,
  valorDoAjuste,
  type Ajuste,
  type Cotacao,
  type EstadoDaCotacao,
  type InformeDoDocumento,
  type ProdutoCotado,
} from '@dominio/cotacao'
import { CabecalhoDoPedido } from './cabecalho-do-pedido'
import './cotacao.css'

/* ==========================================================================
   O editor de cotacao, no arranjo do mockup v5.

   Duas colunas: a cotacao inteira a esquerda, e a direita uma coluna fixa de
   300 px com o resumo, o que o documento vai ter e os tres botoes que fecham
   a venda. A coluna da direita nao rola junto: quem esta mexendo em preco na
   linha 40 precisa ver o total sem subir a pagina, porque e olhando o total
   que se decide o desconto.

   Cada produto e um cartao: selo P-01 e referencia em cima, imagem a esquerda,
   os oito campos do produto a direita, e a tabela de tamanhos embaixo,
   atravessando as duas colunas.

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

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataCurta = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')

/* A porta: acha a cotacao e some do caminho. Quem edita e o Editor logo
   abaixo, e ele so nasce com uma cotacao na mao. */
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

  return <Editor key={original.id} inicial={original} />
}

function Editor({ inicial }: { inicial: Cotacao }) {
  const navegar = useNavigate()
  const [c, setC] = useState<Cotacao>(inicial)
  const [sujo, setSujo] = useState(false)
  const [podeColar, setPodeColar] = useState(() => temCopia())
  /* o R$ some da tela inteira quando a cotacao vai ser mostrada ao cliente
     no balcao antes de fechar o preco */
  const [comDinheiro, setComDinheiro] = useState(true)
  const [confirmando, setConfirmando] = useState(false)

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
      produtos: c.produtos
        .filter((_, k) => k !== i)
        .map((p, k) => ({ ...p, bloco: { ...p.bloco, n: k + 1 } })),
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

  function verDocumento() {
    salvarCotacao(c)
    setSujo(false)
    navegar('/cotacao/' + c.id + '/folha')
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

  function mudarInforme(id: string, troca: (x: InformeDoDocumento) => InformeDoDocumento) {
    mudar({ informes: c.informes.map((x) => (x.id === id ? troca(x) : x)) })
  }

  const base = subtotal(c)
  const ajustes = totalDaCotacao(c) - base
  const total = base + ajustes
  const pecas = pecasDaCotacao(c)
  const fechada = travada(c)
  const noDocumento = c.informes.filter((x) => x.noDocumento).length
  /* pagina 1, dois produtos por folha, e a folha do resumo geral */
  const paginas = 1 + Math.ceil(c.produtos.length / 2) + 1

  const rs = (v: number) => (comDinheiro ? dinheiro(v) : '· · ·')

  return (
    <Pagina
      acima="Comercial · cotação de venda"
      titulo={
        <span className="ct-titulo">
          Cotação {c.numero}
          {sujo ? <span className="ct-sujo">não salva</span> : null}
        </span>
      }
      sub={
        <>
          {c.cliente.nome || 'sem cliente ainda'} · criada em {dataCurta(c.criadaEm)} ·{' '}
          <Selo tom={TOM_DO_ESTADO[c.estado]}>{NOME_DO_ESTADO_DA_COTACAO[c.estado]}</Selo> · o
          cliente recebe só o documento (PDF)
        </>
      }
      acoes={
        <>
          <Botao tom="contorno" onClick={salvar}>
            <FloppyDisk size={17} />
            Salvar
          </Botao>
          <Botao tom="contorno" onClick={verDocumento}>
            <FileText size={17} />
            PDF
          </Botao>
          {!fechada ? (
            <Botao tom="wa" onClick={enviar}>
              <WhatsappLogo size={17} />
              Enviar
            </Botao>
          ) : null}
          {!fechada && c.produtos.length ? (
            <Botao tom="primario" onClick={dizerSim}>
              <Check size={17} />
              Aprovar e gerar ficha
            </Botao>
          ) : null}
        </>
      }
    >
      {/* --- a barra de abas do v5 --- */}
      <BarraDoEditor
        atual={c.id}
        comDinheiro={comDinheiro}
        aoTrocarDinheiro={() => setComDinheiro((v) => !v)}
        aoIr={(id) => navegar('/cotacao/' + id)}
        aoVerDocumento={verDocumento}
      />

      {fechada && c.aprovacao ? (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Aviso tom="ok" titulo={'Aprovada, e virou o pedido ' + c.aprovacao.pedido}>
            {c.aprovacao.quem} registrou o sim em{' '}
            {new Date(c.aprovacao.em).toLocaleString('pt-BR')}, sobre o envio {c.aprovacao.versao}.
            A grade e os valores estão travados a partir daqui: a produção já corta por eles, e
            mudar quantidade depois do corte é o jeito clássico de sobrar pano e faltar peça. Se o
            cliente mudar de ideia, o caminho é uma cotação nova.
          </Aviso>
        </div>
      ) : null}

      <div className="ct-editor">
        <div className="ct-coluna">
          <CabecalhoDoPedido c={c} mudar={mudar} travado={fechada} />

          {/* --- os informes --- */}
          <section className="cartao ct-cartao">
            <header className="ct-cab">
              <h3>Informes sobre a produção</h3>
              <span>página 1 do documento · desmarcar tira do PDF</span>
            </header>
            <div className="ct-informes">
              {c.informes.map((x) => (
                <div className={x.noDocumento ? 'ct-informe' : 'ct-informe fora'} key={x.id}>
                  <button
                    type="button"
                    className="ct-marca"
                    role="switch"
                    aria-checked={x.noDocumento}
                    aria-label={x.noDocumento ? 'Tirar do PDF' : 'Pôr no PDF'}
                    title={x.noDocumento ? 'Sai no PDF. Clique para tirar.' : 'Fora do PDF. Clique para pôr.'}
                    onClick={() => mudarInforme(x.id, (i) => ({ ...i, noDocumento: !i.noDocumento }))}
                  >
                    {x.noDocumento ? <Check size={13} weight="bold" /> : null}
                  </button>
                  <AreaTexto
                    rows={2}
                    value={x.texto}
                    aria-label="Texto do informe"
                    onChange={(e) => mudarInforme(x.id, (i) => ({ ...i, texto: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="ct-tira"
                    aria-label="Apagar o informe"
                    title="Apagar o informe"
                    onClick={() => mudar({ informes: c.informes.filter((i) => i.id !== x.id) })}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <Botao
                tom="limpo"
                tamanho="sm"
                onClick={() =>
                  mudar({
                    informes: [
                      ...c.informes,
                      {
                        id: 'IF' + Math.random().toString(36).slice(2, 7),
                        texto: '',
                        noDocumento: true,
                      },
                    ],
                  })
                }
              >
                <Plus size={15} />
                Adicionar informe
              </Botao>
            </div>
          </section>

          <p className="ct-eyebrow">Produtos cotados</p>

          {c.produtos.map((p, i) => (
            <Produto
              key={p.bloco.id}
              produto={p}
              travado={fechada}
              comDinheiro={comDinheiro}
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
          ) : !fechada ? (
            <div className="ct-mais">
              <button type="button" className="ct-mais-bt" onClick={novoProduto}>
                <Plus size={17} />
                Adicionar mais um produto
              </button>
              {podeColar ? (
                <Botao tom="limpo" tamanho="sm" onClick={colar}>
                  Colar layout
                </Botao>
              ) : null}
            </div>
          ) : null}

          {/* --- ajustes --- */}
          {c.produtos.length ? (
            <section className="cartao ct-cartao">
              <header className="ct-cab">
                <h3>Ajustes no valor</h3>
                <span>do documento, não de um produto</span>
              </header>
              {c.ajustes.length ? (
                <div className="ct-ajustes">
                  {c.ajustes.map((a) => (
                    <LinhaDeAjuste
                      key={a.id}
                      ajuste={a}
                      travado={fechada}
                      base={base}
                      comDinheiro={comDinheiro}
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
              {!fechada ? (
                <Botao
                  tom="limpo"
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
                  <Plus size={15} />
                  Adicionar ajuste
                </Botao>
              ) : null}
              <p className="ct-nada">
                Ajuste em por cento vale sempre sobre o subtotal, nunca sobre o total já ajustado.
                Dois descontos de 10 por cento tiram 20, e não 19.
              </p>
            </section>
          ) : null}

          {c.enviadas.length ? (
            <section className="cartao ct-cartao">
              <header className="ct-cab">
                <h3>O que já foi enviado</h3>
                <span>o valor de cada envio fica congelado como saiu</span>
              </header>
              <div className="ct-envios">
                {c.enviadas.map((e) => (
                  <div
                    key={e.numero}
                    className={c.aprovacao?.versao === e.numero ? 'ct-envio valeu' : 'ct-envio'}
                  >
                    <b>Envio {e.numero}</b>
                    <span>{new Date(e.data).toLocaleString('pt-BR')}</span>
                    <span>{e.pecas ? e.pecas + ' peças' : 'peças não gravadas'}</span>
                    <span className="ct-envio-total">{rs(e.total)}</span>
                    {c.aprovacao?.versao === e.numero ? (
                      <span className="ct-envio-selo">aprovado</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* --- a coluna fixa da direita --- */}
        <aside className="ct-lado">
          <section className="cartao ct-cartao ct-resumo">
            <header className="ct-cab">
              <h3>Resumo da cotação</h3>
            </header>
            <div className="ct-linha">
              <span>Produtos</span>
              <b>{c.produtos.length}</b>
            </div>
            <div className="ct-linha">
              <span>Peças</span>
              <b>{pecas}</b>
            </div>
            <div className="ct-linha">
              <span>Subtotal</span>
              <b>{rs(base)}</b>
            </div>
            <div className="ct-linha">
              <span>Ajustes</span>
              <b>{comDinheiro ? (ajustes < 0 ? '- ' : '+ ') + dinheiro(Math.abs(ajustes)) : '· · ·'}</b>
            </div>
            <div className="ct-linha grande">
              <span>Total</span>
              <b>{rs(total)}</b>
            </div>
            <p className="ct-miudo">
              Entrada 50%: <b>{rs(total / 2)}</b> · média por peça{' '}
              <b>{rs(pecas ? total / pecas : 0)}</b>
            </p>
          </section>

          <section className="cartao ct-cartao">
            <header className="ct-cab">
              <h3>Documento</h3>
            </header>
            <p className="ct-nada">
              Página 1: cabeçalho e informes. Um bloco por produto: imagem, detalhes e tabela de
              tamanhos. Última página: tabela geral sem imagens.
            </p>
            <div className="ct-tags">
              <span>{paginas} páginas</span>
              <span>{noDocumento} informes</span>
              <span>sem rota de produção</span>
            </div>
          </section>

          <div className="ct-lado-bts">
            {!fechada && c.produtos.length ? (
              <Botao tom="primario" bloco onClick={dizerSim}>
                <Check size={17} />
                Aprovar e gerar ficha
              </Botao>
            ) : null}
            {!fechada ? (
              <Botao tom="wa" bloco onClick={enviar}>
                <WhatsappLogo size={17} />
                Enviar por WhatsApp
              </Botao>
            ) : null}
            <Botao tom="contorno" bloco onClick={verDocumento}>
              <FileText size={17} />
              Ver documento
            </Botao>
            <Botao tom="contorno" bloco onClick={baixar}>
              Baixar .cft
            </Botao>
            <Botao
              tom={confirmando ? 'perigo' : 'limpo'}
              bloco
              onClick={() => (confirmando ? apagar() : setConfirmando(true))}
              onBlur={() => setConfirmando(false)}
            >
              {confirmando ? 'Confirmar que apaga' : 'Apagar cotação'}
            </Botao>
          </div>
        </aside>
      </div>
    </Pagina>
  )
}

/* --- a barra de abas, o Editor/Documento e o R$ ---------------------------
   As abas sao as cotacoes abertas. No v5 elas vivem entre o titulo e o
   conteudo, e e ali que fazem sentido: quem atende tres clientes ao mesmo
   tempo troca de aba, nao volta para a lista. */
function BarraDoEditor({
  atual,
  comDinheiro,
  aoTrocarDinheiro,
  aoIr,
  aoVerDocumento,
}: {
  atual: string
  comDinheiro: boolean
  aoTrocarDinheiro: () => void
  aoIr: (id: string) => void
  aoVerDocumento: () => void
}) {
  const abertas = listarCotacoes().slice(0, 6)
  return (
    <div className="ct-barra">
      <div className="ct-abas">
        {abertas.map((x) => (
          <button
            type="button"
            key={x.id}
            className={x.id === atual ? 'ct-aba ligada' : 'ct-aba'}
            onClick={() => aoIr(x.id)}
          >
            {(x.cliente.nome || x.numero).split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>
      <span className="ct-empurra" />
      <Segmentado
        valor="editor"
        opcoes={[
          { valor: 'editor', rotulo: 'Editor' },
          { valor: 'documento', rotulo: 'Documento' },
        ]}
        aoMudar={(v) => {
          if (v === 'documento') aoVerDocumento()
        }}
      />
      <button
        type="button"
        className={comDinheiro ? 'ct-chip' : 'ct-chip ligado'}
        onClick={aoTrocarDinheiro}
        title="Esconde todo valor da tela, para mostrar a cotação ao cliente antes de fechar o preço"
      >
        {comDinheiro ? 'R$ visível' : 'R$ oculto'}
      </button>
    </div>
  )
}

/* --- um produto: selo, referencia, imagem, campos e grade ---------------- */
function Produto({
  produto,
  travado,
  comDinheiro,
  aoMudarBloco,
  aoMudarProduto,
  aoCopiar,
  aoRemover,
}: {
  produto: ProdutoCotado
  travado?: boolean
  comDinheiro: boolean
  aoMudarBloco: (b: Bloco) => void
  aoMudarProduto: (troca: (p: ProdutoCotado) => ProdutoCotado) => void
  aoCopiar: () => void
  aoRemover: () => void
}) {
  const b = produto.bloco
  /* O SELO SAIU DAQUI. O módulo desenha o dele a partir do `bloco.n`, e desde
     a fusão o produto da cotação e o layout da ficha são a mesma peça: dois
     números para a mesma coisa era o que fazia o vendedor falar em P-02 e a
     produção em L-02 sobre a mesma camiseta. */
  const acoes = (
    <span className="ct-produto-bts">
      <button type="button" className="ct-bt-icone" onClick={aoCopiar} title="Duplicar produto">
        <Copy size={17} />
      </button>
      {!travado ? (
        <button
          type="button"
          className="ct-bt-icone risco"
          onClick={aoRemover}
          title="Remover produto"
        >
          <Trash size={17} />
        </button>
      ) : null}
    </span>
  )

  /* O MÓDULO DE LAYOUT DA v3.375 É O MESMO DOS DOIS LADOS desde a fusão. Ele
     traz consigo o que a cotação não tinha: vários tecidos com a cor de cada
     um, o cartão de design com as fileiras de etiqueta, técnica e acabamento,
     e a observação em texto rico. Ver o comentário do topo deste arquivo. */
  return (
    <section className="cartao ct-produto">
      {/* O MIOLO EXISTE POR CAUSA DA MARGEM. O corpo antigo do produto era um
          .ct-produto-corpo, e era ELE que tinha o respiro de 20px. Quando o
          corpo virou o modulo de layout, o respiro foi junto e o modulo passou
          a encostar nas quatro bordas do cartao, enquanto todos os outros
          cartoes da tela seguiam com 20px. O rodape fica de fora porque ele e
          uma faixa que atravessa o cartao inteiro e tem o respiro dele. */}
      <div className="ct-produto-miolo">
        <ModuloDeLayout
          bloco={b}
          aoMudar={aoMudarBloco}
          leitura={travado}
          semValor={!comDinheiro}
          acoes={acoes}
          arte={
            <CaixaDeImagem
              leitura={travado}
              imagem={b.imagem}
              arte={b.arte}
              aoMudarImagem={(img) => aoMudarBloco({ ...b, imagem: img })}
            />
          }
          tabela={
            <>
              {!travado ? (
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
            ) : null}
            <GradeDeTamanhos
              leitura={travado}
              faixa={b.faixa}
              grade={b.grade}
              aoMudar={travado ? undefined : (g: Grade) => aoMudarBloco({ ...b, grade: g })}
              aoTrocarFaixa={travado ? undefined : (f: Faixa) => aoMudarBloco({ ...b, faixa: f })}
              precoBase={comDinheiro ? produto.precoBase : undefined}
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
          </>
        }
          pe={<SobreAPeca bloco={b} travado={travado} />}
        />
      </div>
      <footer className="ct-produto-pe">
        <span className="ct-selo-conta">
          {pecasDoProduto(produto)} peças
          {comDinheiro ? ' · ' + dinheiro(totalDoProduto(produto)) : ''}
        </span>
      </footer>
    </section>
  )
}

/* --- os campos sobre a peça ----------------------------------------------
   PROVISÓRIO, E DE PROPÓSITO. O Henrique ainda não decidiu se estes atributos
   ficam como pílula ou como dropdown, e o encaixe existe para a decisão poder
   ser tomada olhando para a tela, e não para uma descrição.

   Eles NÃO guardam um dado novo: apontam para os mesmos campos que os cartões
   de tecido e design já mostram logo acima. Duas formas de mexer na mesma
   coisa é aceitável enquanto se escolhe uma; duas cópias do mesmo dado nunca
   seria, porque uma delas começaria a mentir no dia seguinte. */
function SobreAPeca({ bloco, travado }: { bloco: Bloco; travado?: boolean }) {
  const tecido = bloco.tecidos[0]
  const tecnicas = bloco.design.map((d) => d.tag)
  const cores = bloco.design.reduce((n, d) => n + d.cores.length, 0)

  const itens = [
    ['Tecido', bloco.tecidos.length > 1 ? bloco.tecidos.length + ' tecidos' : tecido?.nome || ''],
    ['Cor do tecido', bloco.tecidos.length > 1 ? 'por tecido' : tecido?.cor || ''],
    ['Técnica de estampa', tecnicas.length ? tecnicas.join(' + ') : ''],
    ['Cores da estampa', cores ? cores + (cores === 1 ? ' código' : ' códigos') : ''],
    ['Gênero', bloco.genero],
    ['Grade', bloco.faixa === 'infantil' ? 'Infantil' : 'Adulto'],
  ] as const

  return (
    <div className="ct-sobre">
      <span className="ct-sobre-rot">Sobre a peça</span>
      <div className="ct-sobre-itens">
        {itens.map(([rotulo, valor]) => (
          <span key={rotulo} className={valor ? 'ct-atributo' : 'ct-atributo ct-sem'}>
            <b>{rotulo}</b>
            {valor || 'a definir'}
          </span>
        ))}
      </div>
      {travado ? null : (
        <p className="ct-sobre-nota">
          Provisório: estes atributos leem o que já foi escolhido nos cartões acima. Falta decidir
          se aqui eles viram pílula ou campo com lista.
        </p>
      )}
    </div>
  )
}

/* --- uma linha de ajuste ------------------------------------------------- */
function LinhaDeAjuste({
  ajuste,
  base,
  travado,
  comDinheiro,
  aoMudar,
  aoRemover,
}: {
  ajuste: Ajuste
  base: number
  travado?: boolean
  comDinheiro: boolean
  aoMudar: (a: Ajuste) => void
  aoRemover: () => void
}) {
  const soma = ajuste.valor >= 0
  const conta = comDinheiro ? dinheiro(valorDoAjuste(ajuste, base)) : '· · ·'

  if (travado) {
    return (
      <div className="ct-ajuste travado">
        <span className="ct-sinal parado">{soma ? '+' : '−'}</span>
        <span>
          {Math.abs(ajuste.valor)}
          {ajuste.tipo === 'porcento' ? '%' : ' reais'}
        </span>
        <span className="ct-ajuste-motivo-lido">{ajuste.descricao || 'sem motivo escrito'}</span>
        <span className="ct-ajuste-conta">{conta}</span>
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
      <span className="ct-ajuste-conta">{conta}</span>
      <button type="button" className="ct-bt-icone risco" onClick={aoRemover} title="Remover ajuste">
        <X size={16} />
      </button>
    </div>
  )
}
