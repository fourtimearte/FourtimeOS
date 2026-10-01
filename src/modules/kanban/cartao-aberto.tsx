import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Esqueleto, Etiqueta, Modal, Vazio, avisar } from '@ds'
import { LayoutDeLeitura, type Bloco } from '@dominio/layout'
import { acharCotacao, type Cotacao } from '@dominio/cotacao'
import { ModalDaFolha } from '@modules/cotacao'
import {
  NOME_DA_TECNICA,
  buscarPedidosParaComparar,
  corDoPosto,
  carregarALinhaDoTempo,
  comentarNoCartao,
  cotacaoDoPedido,
  nomeDoPosto,
  pedidosDoCliente,
  paradoHa,
  pegarOCartao,
  porATag,
  rotaDe,
  soltarOCartao,
  tagValeNoPosto,
  tirarATag,
  type EventoDoCartao,
  type FatiaNoQuadro,
  type PedidoParaComparar,
  type Rota,
  type Tag,
} from '@dominio/producao'
import {
  Fechar,
  IconeEnviar,
  IconeLupa,
  IconeMais,
  IconeSeta,
  IconeTroca,
  IconeX,
  Mestre,
  Rotulo,
  entregaEmTexto,
} from './pecas-do-modal'
import './cartao-aberto.css'

/* ==========================================================================
   O cartão aberto, do jeito do wireframe de 01/10/2026.

   A TELA QUASE INTEIRA, EM DUAS METADES IGUAIS. A esquerda é o pedido sem
   valor: os layouts. A direita se parte em duas: a ação e a rota de um lado,
   a conversa e os últimos pedidos do cliente do outro.

   AS METADES SÃO IGUAIS DE PROPÓSITO, e é isso que faz o comparar funcionar:
   comparar troca a metade da direita pelos layouts do outro pedido, e os dois
   ficam com exatamente a mesma largura. Em 1080p cada metade dá 856px de
   layout, e o layout inteiro cabe lado a lado.

   OS LAYOUTS SÃO O DESENHO DO WIREFRAME, e não mais o módulo do editor de
   cotação. Decisão do Henrique em 01/10, que trocou a de 22/09: o desenho
   limpo, só com linhas finas, ganhou. Ele mora em @dominio/layout como
   LayoutDeLeitura.

   A AÇÃO FICA NO TOPO DA DIREITA, e não no rodapé. Ela é a única coisa desta
   tela inteira que muda o estado da fábrica; todo o resto é leitura.
   ========================================================================== */

export function CartaoAberto({
  fatia,
  rotas,
  tags,
  podeMover,
  euId,
  aoFechar,
  aoTerminar,
  aoMexer,
}: {
  fatia: FatiaNoQuadro
  rotas: Rota[]
  tags: Tag[]
  podeMover: boolean
  euId: string
  aoFechar: () => void
  aoTerminar: () => void
  aoMexer: () => void
}) {
  const [cotacao, setCotacao] = useState<Cotacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [linha, setLinha] = useState<EventoDoCartao[]>([])
  const [recado, setRecado] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [escolhendo, setEscolhendo] = useState(false)

  /* A COMPARAÇÃO. Ela guarda o pedido escolhido e os blocos dele, e enquanto
     estiver de pé o cartão troca de forma: as duas colunas passam a ser os
     layouts dos DOIS pedidos, e a ação, a rota e a conversa saem de cena.

     Elas saem porque comparar é uma coisa só. Deixar o Terminei aceso ao lado
     de um pedido entregue em julho é um convite a terminar o pedido errado. */
  const [comparado, setComparado] = useState<PedidoParaComparar | null>(null)
  const [blocosDele, setBlocosDele] = useState<Bloco[]>([])
  const [lendoDele, setLendoDele] = useState(false)
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<PedidoParaComparar[]>([])

  const naMinhaMao = !!fatia.pegoPor && fatia.pegoPor === euId
  const rota = rotaDe(rotas, fatia.tecnica)
  const ondeEstou = rota.indexOf(fatia.etapa)
  const proximo = ondeEstou >= 0 ? (rota[ondeEstou + 1] ?? null) : null

  const lerALinha = useCallback(async () => {
    try {
      setLinha(await carregarALinhaDoTempo(fatia.id))
    } catch {
      /* a conversa falhando não pode derrubar o cartão: o operador abriu para
         ver o layout, e ver o layout não depende de ler comentário */
    }
  }, [fatia.id])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro('')
    cotacaoDoPedido(fatia.pedidoId)
      .then((id) => (id ? acharCotacao(id) : null))
      .then((c) => {
        if (!vivo) return
        setCotacao(c)
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Não consegui ler os layouts.'))
      .finally(() => vivo && setCarregando(false))
    void lerALinha()
    return () => {
      vivo = false
    }
  }, [fatia.pedidoId, lerALinha])

  /* A BUSCA ESPERA A PESSOA PARAR DE DIGITAR. Sem os 300 ms, cada letra vira
     uma viagem ao banco, e a resposta da letra anterior chega depois e pisa na
     lista certa: quem digita rápido vê o resultado de PD-01 enquanto já
     escreveu PD-013. */
  useEffect(() => {
    if (termo.trim().length < 2) {
      setAchados([])
      return
    }
    let vivo = true
    const t = setTimeout(() => {
      buscarPedidosParaComparar(termo, fatia.pedidoId)
        .then((r) => vivo && setAchados(r))
        .catch(() => vivo && setAchados([]))
    }, 300)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [termo, fatia.pedidoId])

  /* ---------- OS ULTIMOS PEDIDOS DO MESMO CLIENTE ----------

     A pergunta que quem confere faz antes de qualquer outra: como foi o do ano
     passado? A cor bateu, a gola era essa, a grade era essa. Hoje essa resposta
     mora na cabeca de quem esta ha mais tempo na casa, e some junto com a
     pessoa.

     Ela carrega uma vez, quando o cartao abre, e nao a cada digitacao como a
     busca do comparar: a lista nao depende do que se digita, ela depende de
     quem e o cliente. */
  const [doCliente, setDoCliente] = useState<PedidoParaComparar[]>([])
  const [lendoDoCliente, setLendoDoCliente] = useState(false)
  /* o pedido antigo aberto numa folha propria, por cima desta */
  const [emFolha, setEmFolha] = useState<PedidoParaComparar | null>(null)

  useEffect(() => {
    if (!fatia.clienteId) {
      setDoCliente([])
      return
    }
    let vivo = true
    setLendoDoCliente(true)
    pedidosDoCliente(fatia.clienteId, fatia.pedidoId)
      .then((l) => vivo && setDoCliente(l))
      .catch(() => vivo && setDoCliente([]))
      .finally(() => vivo && setLendoDoCliente(false))
    return () => {
      vivo = false
    }
  }, [fatia.clienteId, fatia.pedidoId])

  async function comparar(p: PedidoParaComparar) {
    setComparado(p)
    setAchados([])
    setTermo('')
    setBlocosDele([])
    if (!p.cotacaoId) return
    setLendoDele(true)
    try {
      const c = await acharCotacao(p.cotacaoId)
      /* AQUI VÊM TODOS OS LAYOUTS, e não só os de uma técnica. O pedido
         comparado não tem fatia aberta nenhuma: ele não está no chão de
         fábrica, e escolher uma técnica dele seria inventar um recorte que
         não existe. */
      setBlocosDele((c?.produtos ?? []).map((x) => x.bloco))
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui ler o outro pedido.', 'brand')
      setComparado(null)
    } finally {
      setLendoDele(false)
    }
  }

  /* OS LAYOUTS DESTA FATIA, e não os do pedido inteiro. A fatia guarda os
     números dos blocos que passam por esta técnica; os outros estão no cartão
     da outra técnica, e mostrar os dois aqui faria a costura procurar uma peça
     que está no bordado. */
  const blocos: Bloco[] = (cotacao?.produtos ?? [])
    .map((p) => p.bloco)
    .filter((b) => !fatia.layouts.length || fatia.layouts.includes(b.n))

  async function mexer(oQue: () => Promise<unknown>) {
    try {
      await oQue()
      await lerALinha()
      aoMexer()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'O banco recusou.', 'brand')
    }
  }

  async function enviar() {
    const texto = recado.trim()
    if (texto.length < 2 || enviando) return
    setEnviando(true)
    try {
      await comentarNoCartao(fatia.id, texto)
      setRecado('')
      await lerALinha()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui enviar.', 'brand')
    } finally {
      setEnviando(false)
    }
  }

  const postas = new Set(fatia.tags)
  const disponiveis = tags.filter((t) => t.ativa)
  const entrega = entregaEmTexto(fatia.entregaEm)
  const tecnica = NOME_DA_TECNICA[fatia.tecnica] ?? fatia.tecnica

  return (
    <Modal aberto cheio solto aoFechar={aoFechar}>
      <div className="ca" tabIndex={-1} data-foco-inicial>
        {/* ---------------- o cabeçalho ---------------- */}
        <header className="ca-topo">
          <div className="ca-titulo">
            <div className="ca-linha1">
              <b className="ca-numero">{fatia.numero}</b>
              <span className="ca-nome">{fatia.nome}</span>
              <span
                className="ca-onde"
                style={{ '--c': corDoPosto(fatia.etapa) } as CSSProperties}
              >
                {tecnica} · em {nomeDoPosto(fatia.etapa)}
              </span>
              {fatia.teste ? <span className="ca-onde sem-ponto">teste</span> : null}
            </div>
            <div className="ca-meta">
              <span>
                Cliente <b>{fatia.cliente || 'sem cliente'}</b>
              </span>
              {fatia.vendedor ? (
                <span>
                  Vendedor <b>{fatia.vendedor}</b>
                </span>
              ) : null}
              <span>
                Entrega <b className={entrega.perto ? 'perto' : ''}>{entrega.texto}</b>
              </span>
              <span>
                Nesta fatia{' '}
                <b>
                  {fatia.pecas} peças, {blocos.length} {blocos.length === 1 ? 'layout' : 'layouts'}
                </b>
              </span>
            </div>
          </div>

          {/* A BUSCA MORA NO CABEÇALHO DO CARTÃO, e é isso que faz ela não
              ficar travada pelo modal: quem está com um pedido na frente e
              quer conferir contra o do ano passado não pode ter que fechar o
              que está olhando para procurar o outro. */}
          {comparado ? (
            <button type="button" className="ca-fechar-comp" onClick={() => setComparado(null)}>
              <IconeX tamanho={14} />
              Fechar a comparação
            </button>
          ) : (
            <div className="ca-caixa-busca">
              <label className="ca-busca">
                <IconeLupa />
                <input
                  type="search"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Comparar com outro pedido"
                  aria-label="Buscar outro pedido para comparar"
                />
              </label>
              {achados.length ? (
                <ul className="ca-achados">
                  {achados.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => void comparar(p)}>
                        <b>{p.numero}</b>
                        <span className="n">{p.nome}</span>
                        <span className="e">{p.estado}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : termo.trim().length >= 2 ? (
                <p className="ca-sem-achado">nenhum pedido com esse texto</p>
              ) : null}
            </div>
          )}

          <Fechar aoFechar={aoFechar} />
        </header>

        {/* ---------------- a linha das tags ---------------- */}
        <div className="ca-tags">
          {fatia.marcas.map((m) => (
            <Mestre key={m}>{m}</Mestre>
          ))}
          {fatia.marcas.length ? <span className="ca-risco" /> : null}

          {fatia.tags.map((chave) => {
            const t = tags.find((x) => x.chave === chave)
            return (
              <span key={chave} className="ca-tag">
                {t?.nome ?? chave}
                {podeMover ? (
                  <button
                    type="button"
                    aria-label={'Tirar a tag ' + (t?.nome ?? chave)}
                    onClick={() => void mexer(() => tirarATag(fatia.id, chave))}
                  >
                    <IconeX tamanho={12} />
                  </button>
                ) : null}
              </span>
            )
          })}

          {podeMover ? (
            <button
              type="button"
              className="ca-mais-tag"
              onClick={() => setEscolhendo((x) => !x)}
              aria-expanded={escolhendo}
            >
              + tag
            </button>
          ) : null}

          <span className="ca-empurra" />
          <span className="ca-sem-valor">esta tela não mostra valor</span>
        </div>

        {/* AS TAGS QUE O POSTO NÃO USA APARECEM APAGADAS, e não somem.
            Mostrar em cinza ensina que a tag existe; esconder faz a pessoa
            achar que ela foi apagada e ir procurar em Configurações. */}
        {escolhendo ? (
          <div className="ca-escolher">
            {disponiveis.map((t) => {
              const vale = tagValeNoPosto(t, fatia.etapa)
              const ja = postas.has(t.chave)
              return (
                <Etiqueta
                  key={t.chave}
                  tom={t.tom}
                  fora={!vale}
                  desligada={!vale || ja}
                  title={
                    !vale ? 'não vale em ' + nomeDoPosto(fatia.etapa) : ja ? 'já está neste cartão' : undefined
                  }
                  aoClicar={() => {
                    setEscolhendo(false)
                    void mexer(() => porATag(fatia.id, t.chave))
                  }}
                >
                  {t.nome}
                </Etiqueta>
              )
            })}
          </div>
        ) : null}

        {/* ---------------- as duas metades ---------------- */}
        <div className={comparado ? 'ca-corpo comparando' : 'ca-corpo'}>
          <div className="ca-esq">
            {comparado ? (
              <TopoDaColuna
                numero={fatia.numero}
                nome={fatia.nome}
                quando={'em produção · entrega ' + (fatia.entregaEm ? entrega.texto.split(', ').pop() : 'sem data')}
              />
            ) : null}
            {erro ? (
              <Vazio titulo="Não consegui ler os layouts" texto={erro} />
            ) : carregando ? (
              <>
                <Esqueleto altura={300} />
                <Esqueleto altura={300} />
              </>
            ) : !blocos.length ? (
              <Vazio
                titulo="Este cartão não tem layout"
                texto="A cotação que virou este pedido não tem bloco nenhum nesta técnica."
              />
            ) : (
              blocos.map((b) => (
                <LayoutDeLeitura key={b.id} bloco={b} tecnica={tecnica} />
              ))
            )}
          </div>

          {/* ---------------- direita, comparando: o outro pedido ----------- */}
          {comparado ? (
            <div className="ca-outro">
              <TopoDaColuna
                numero={comparado.numero}
                nome={comparado.nome || comparado.cliente}
                quando={
                  comparado.estado +
                  (comparado.entregaEm ? ' · ' + comparado.entregaEm.split('-').reverse().join('/') : '')
                }
              />
              {lendoDele ? (
                <>
                  <Esqueleto altura={300} />
                  <Esqueleto altura={300} />
                </>
              ) : !blocosDele.length ? (
                <Vazio titulo="Este pedido não tem layout" texto="A cotação dele não guardou bloco nenhum." />
              ) : (
                blocosDele.map((b) => (
                  <LayoutDeLeitura key={b.id} bloco={b} />
                ))
              )}
            </div>
          ) : (
            /* ---------------- direita: o que muda a fábrica ---------------- */
            <div className="ca-dir">
              <div className="ca-dir-col">
                <section className="ca-acao">
                  <div className="ca-mao">
                    <span className="ca-avatar">
                      {fatia.pegoPor ? iniciais(fatia.pegoPorNome) : '?'}
                    </span>
                    <div>
                      <b>
                        {fatia.pegoPor
                          ? naMinhaMao
                            ? 'Está na sua mão'
                            : 'Está com ' + (fatia.pegoPorNome || 'alguém')
                          : 'Na fila'}
                      </b>
                      <span>
                        {fatia.pegoPor
                          ? 'em ' + nomeDoPosto(fatia.etapa) + ' ' + quando(fatia.pegoEm)
                          : 'esperando ' + quando(fatia.etapaEm) + ' em ' + nomeDoPosto(fatia.etapa)}
                      </span>
                    </div>
                  </div>

                  {podeMover ? (
                    <div className="ca-botoes">
                      {naMinhaMao ? (
                        <button
                          type="button"
                          className="ca-bt"
                          onClick={() => void mexer(() => soltarOCartao(fatia.id))}
                        >
                          Soltar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ca-bt"
                          onClick={() => void mexer(() => pegarOCartao(fatia.id))}
                        >
                          Peguei
                        </button>
                      )}
                      {proximo ? (
                        <button type="button" className="ca-bt forte" onClick={aoTerminar}>
                          Terminei
                          <IconeSeta />
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <span className="ca-proximo">
                    {proximo ? (
                      <>
                        depois vai para <b>{nomeDoPosto(proximo)}</b>
                      </>
                    ) : (
                      'este é o fim da rota desta técnica'
                    )}
                  </span>
                </section>

                {/* A ROTA INTEIRA, de cima para baixo, com o de agora em
                    destaque. Ela responde a pergunta que o operador faz sem
                    falar: quanto falta. */}
                <section className="ca-rota">
                  <Rotulo>A rota desta fatia</Rotulo>
                  <ol className="ca-passos">
                    {rota.map((p, i) => {
                      const estado = p === fatia.etapa ? 'agora' : i < ondeEstou ? 'feito' : 'falta'
                      return (
                        <li key={p} className={'ca-passo ' + estado}>
                          <span className="ca-passo-ponto">
                            <span />
                          </span>
                          <span className="ca-passo-nome">{nomeDoPosto(p)}</span>
                          {estado === 'agora' ? <span className="ca-passo-lado">agora</span> : null}
                        </li>
                      )
                    })}
                  </ol>
                </section>
              </div>

              <div className="ca-dir-col">
                {/* A CONVERSA E O HISTÓRICO NA MESMA LINHA DO TEMPO, e não em
                    duas abas. Um comentário lido sem saber que o cartão mudou
                    de posto três minutos antes é meio comentário. */}
                <section className="ca-conversa">
                  <Rotulo>Conversa e histórico</Rotulo>
                  {!linha.length ? (
                    <p className="ca-nada">nada aconteceu com este cartão ainda</p>
                  ) : (
                    linha.map((e) => <Evento key={e.id} evento={e} />)
                  )}
                  {podeMover ? (
                    <div className="ca-escrever">
                      <input
                        className="ca-campo"
                        value={recado}
                        onChange={(e) => setRecado(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void enviar()
                        }}
                        placeholder="Escrever para a equipe"
                        aria-label="Escrever para a equipe"
                      />
                      <button
                        type="button"
                        className="ca-enviar"
                        aria-label="Enviar o recado"
                        disabled={recado.trim().length < 2 || enviando}
                        onClick={() => void enviar()}
                      >
                        <IconeEnviar />
                      </button>
                    </div>
                  ) : null}
                </section>

                {/* OS ÚLTIMOS PEDIDOS DO CLIENTE, abaixo da conversa: a conversa
                    é sobre ESTE cartão, agora, e é ela que a pessoa veio ler.
                    COMPARAR põe os layouts do antigo ao lado dos deste; ABRIR
                    traz a folha inteira do antigo por cima. */}
                <section className="ca-historico">
                  <Rotulo>Últimos pedidos do cliente</Rotulo>
                  {lendoDoCliente ? (
                    <p className="ca-nada">procurando...</p>
                  ) : !fatia.clienteId ? (
                    <p className="ca-nada">
                      este pedido não está ligado a um cliente cadastrado, então não dá para achar os
                      anteriores dele
                    </p>
                  ) : !doCliente.length ? (
                    <p className="ca-nada">é o primeiro pedido deste cliente no sistema</p>
                  ) : (
                    <ul className="ca-antigos">
                      {doCliente.map((p) => (
                        <li key={p.id} className="ca-antigo">
                          <span className="ca-antigo-quem">
                            <b>{p.numero}</b>
                            <small>
                              {p.nome || p.cliente}
                              {p.entregaEm ? ' · ' + p.entregaEm.split('-').reverse().join('/') : ''}
                            </small>
                          </span>
                          <span className="ca-antigo-botoes">
                            <button
                              type="button"
                              title={'Pôr os layouts do ' + p.numero + ' ao lado destes'}
                              aria-label={'Comparar com ' + p.numero}
                              onClick={() => void comparar(p)}
                            >
                              <IconeTroca />
                            </button>
                            <button
                              type="button"
                              title={'Abrir a folha do ' + p.numero + ' por cima'}
                              aria-label={'Abrir ' + p.numero}
                              onClick={() => setEmFolha(p)}
                            >
                              <IconeMais />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      {emFolha ? (
        <ModalDaFolha
          cotacaoId={emFolha.cotacaoId}
          numeroDoPedido={emFolha.numero}
          aoFechar={() => setEmFolha(null)}
        />
      ) : null}
    </Modal>
  )
}

/* O topo de cada metade enquanto se compara: número, nome, e de que época */
function TopoDaColuna({ numero, nome, quando: q }: { numero: string; nome: string; quando: string }) {
  return (
    <div className="ca-coltopo">
      <b>{numero}</b>
      <span>{nome}</span>
      <span className="ca-empurra" />
      <small>{q}</small>
    </div>
  )
}

/* --- um item da linha do tempo -------------------------------------------
   A FALA TEM BALÃO, O FATO NÃO. Dar a mesma forma para os dois faria o
   "saiu de Cd costura para Costura" parecer alguém falando, e a primeira
   pessoa a responder um evento do sistema ia descobrir isso do jeito ruim. */
function Evento({ evento }: { evento: EventoDoCartao }) {
  if (evento.tipo === 'fala') {
    return (
      <div className="ca-fala">
        <span className="ca-quem">{iniciais(evento.quemNome)}</span>
        <div>
          <p className="ca-cabeca">
            <b>{evento.quemNome || 'alguém'}</b> <span>{quando(evento.em)}</span>
          </p>
          <p className="ca-balao">{evento.texto}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="ca-fato">
      <span className="ca-ponto" />
      <p>
        {frase(evento)} · {desde(evento.em)}
      </p>
    </div>
  )
}

function frase(e: EventoDoCartao): string {
  const quem = e.quemNome || 'alguém'
  if (e.tipo === 'posto') return `Andou de ${e.texto}, por ${quem}`
  if (e.tipo === 'tag') return `${quem} ${e.texto}`
  if (e.tipo === 'pegou') return `${quem} pegou o cartão`
  if (e.tipo === 'soltou') return `${quem} soltou o cartão`
  return e.texto || 'o cartão nasceu'
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return '?'
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

/* "HÁ AGORA" NÃO É PORTUGUÊS. O desde() devolve só a medida, e quem monta a
   frase é esta função: ou "agora", ou "há tanto tempo". Sem ela a linha do
   tempo dizia "Henrique pôs montagem há agora" no instante em que a pessoa
   punha a tag, que é exatamente o momento em que ela está olhando. */
function quando(iso: string): string {
  const q = desde(iso)
  return q === 'agora' ? 'agora' : 'há ' + q
}

/* O tempo em palavra, e não em data. "há 26 min" responde a pergunta que a
   fábrica faz; "22/09 14:03" obriga a pessoa a fazer a conta de cabeça. */
function desde(iso: string): string {
  if (!iso) return 'pouco'
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = paradoHa(iso)
  return `${d} dia${d === 1 ? '' : 's'}`
}
