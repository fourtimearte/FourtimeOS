import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Hand, PaperPlaneRight, Plus } from '@phosphor-icons/react'
import { Botao, Entrada, Esqueleto, Etiqueta, Modal, PilulaTecnica, Selo, Vazio, avisar } from '@ds'
import {
  CaixaDeImagem,
  GradeDeTamanhos,
  ModuloDeLayout,
  type Bloco,
} from '@dominio/layout'
import { acharCotacao, type Cotacao } from '@dominio/cotacao'
import {
  NOME_DA_TECNICA,
  carregarALinhaDoTempo,
  comentarNoCartao,
  cotacaoDoPedido,
  nomeDoPosto,
  paradoHa,
  pegarOCartao,
  porATag,
  rotaDe,
  soltarOCartao,
  tagValeNoPosto,
  tirarATag,
  tomDaMarca,
  type EventoDoCartao,
  type FatiaNoQuadro,
  type Rota,
  type Tag,
} from '@dominio/producao'
import './cartao-aberto.css'

/* ==========================================================================
   O cartão aberto.

   Duas colunas. A ESQUERDA É O PEDIDO SEM VALOR: cabeçalho, uma linha só de
   tags e anexos, e os layouts. A DIREITA É O QUE MUDA A FÁBRICA: quem está
   com o cartão, Terminei e Travou, a rota, e a conversa.

   OS LAYOUTS SÃO O MÓDULO DO EDITOR DE COTAÇÃO, em modo leitura, e não uma
   versão resumida. É o mesmo ModuloDeLayout que a ficha de produção usa desde
   a fusão: ele já sabe vários tecidos com a cor de cada um, as fileiras de
   etiqueta, técnica e acabamento, a grade sem valor e a observação. Uma versão
   própria aqui seria a terceira maneira de desenhar a mesma peça, e no dia em
   que a fábrica mudasse alguma coisa, duas delas ficariam mentindo.

   O BLOCO PRETO DA AÇÃO FICA NO TOPO DA DIREITA, e não no rodapé. Ele é a
   única coisa desta tela inteira que muda o estado da fábrica; todo o resto é
   leitura. O que muda o mundo não fica embaixo de uma rolagem.
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

  return (
    <Modal
      aberto
      gigante
      solto
      aoFechar={aoFechar}
      topo={
        <div className="ca-topo">
          <div className="ca-titulo">
            <b>{fatia.numero}</b>
            <span className="ca-nome">{fatia.nome}</span>
            <PilulaTecnica tecnica={fatia.tecnica} tamanho="sm">
              {NOME_DA_TECNICA[fatia.tecnica] ?? fatia.tecnica}
            </PilulaTecnica>
            <Selo tom="info">{nomeDoPosto(fatia.etapa)}</Selo>
            {fatia.teste ? <Selo tom="warn">teste</Selo> : null}
          </div>
          <div className="ca-linhas">
            <span>
              <i>Cliente</i> {fatia.cliente || 'sem cliente'}
            </span>
            {fatia.vendedor ? (
              <span>
                <i>Vendedor</i> {fatia.vendedor}
              </span>
            ) : null}
            <span>
              <i>Entrega</i> {fatia.entregaEm ? dataCurta(fatia.entregaEm) : 'sem data'}
            </span>
            <span>
              <i>Nesta fatia</i> {fatia.pecas} peças, {blocos.length}{' '}
              {blocos.length === 1 ? 'layout' : 'layouts'}
            </span>
            <span className="ca-sem-valor">esta tela não mostra valor</span>
          </div>
        </div>
      }
    >
      <div className="ca-corpo">
        {/* ---------------- esquerda: o pedido ---------------- */}
        <div className="ca-esq">
          <div className="ca-faixa">
            {fatia.marcas.map((m) => (
              <Etiqueta key={m} mestre tom={tomDaMarca(m)}>
                {m}
              </Etiqueta>
            ))}
            {fatia.marcas.length ? <span className="ca-risco" /> : null}

            {fatia.tags.map((chave) => {
              const t = tags.find((x) => x.chave === chave)
              return (
                <Etiqueta
                  key={chave}
                  tom={t?.tom ?? 'cinza'}
                  aoTirar={podeMover ? () => void mexer(() => tirarATag(fatia.id, chave)) : undefined}
                >
                  {t?.nome ?? chave}
                </Etiqueta>
              )
            })}

            {podeMover ? (
              <Botao
                tamanho="sm"
                tom="contorno"
                onClick={() => setEscolhendo((x) => !x)}
                aria-expanded={escolhendo}
              >
                <Plus size={14} weight="bold" />
                tag
              </Botao>
            ) : null}

            <span className="ca-empurra" />
            <span className="ca-anexos">anexos vêm da cotação, no passo do Drive</span>
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
                      !vale
                        ? 'não vale em ' + nomeDoPosto(fatia.etapa)
                        : ja
                          ? 'já está neste cartão'
                          : undefined
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

          <div className="ca-layouts">
            {erro ? (
              <Vazio titulo="Não consegui ler os layouts" texto={erro} />
            ) : carregando ? (
              <>
                <Esqueleto altura={200} />
                <Esqueleto altura={200} />
              </>
            ) : !blocos.length ? (
              <Vazio
                titulo="Este cartão não tem layout"
                texto="A cotação que virou este pedido não tem bloco nenhum nesta técnica."
              />
            ) : (
              blocos.map((b) => (
                <section className="ca-layout" key={b.id}>
                  <ModuloDeLayout
                    bloco={b}
                    aoMudar={() => {}}
                    leitura
                    semValor
                    arte={<CaixaDeImagem leitura imagem={b.imagem} arte={b.arte} />}
                    tabela={<GradeDeTamanhos leitura faixa={b.faixa} grade={b.grade} />}
                  />
                </section>
              ))
            )}
          </div>
        </div>

        {/* ---------------- direita: o que muda a fábrica ---------------- */}
        <div className="ca-dir">
          <div className="ca-acao">
            <div className="ca-mao">
              {fatia.pegoPor ? (
                <>
                  <b>{naMinhaMao ? 'Está na sua mão' : fatia.pegoPorNome + ' pegou'}</b>
                  <span>
                    em {nomeDoPosto(fatia.etapa)} há {desde(fatia.pegoEm)}
                  </span>
                </>
              ) : (
                <>
                  <b>Na fila</b>
                  <span>
                    esperando há {desde(fatia.etapaEm)} em {nomeDoPosto(fatia.etapa)}
                  </span>
                </>
              )}
            </div>

            <div className="ca-botoes">
              {podeMover ? (
                naMinhaMao ? (
                  <Botao tom="contorno" onClick={() => void mexer(() => soltarOCartao(fatia.id))}>
                    Soltar
                  </Botao>
                ) : (
                  <Botao tom="contorno" onClick={() => void mexer(() => pegarOCartao(fatia.id))}>
                    <Hand size={16} weight="bold" />
                    Peguei
                  </Botao>
                )
              ) : null}

              {podeMover && proximo ? (
                <Botao tom="primario" className="ca-terminei" onClick={aoTerminar}>
                  Terminei
                  <ArrowRight size={16} weight="bold" />
                </Botao>
              ) : null}
            </div>

            {proximo ? (
              <p className="ca-proximo">o próximo posto da rota é {nomeDoPosto(proximo)}</p>
            ) : (
              <p className="ca-proximo">este é o fim da rota desta técnica</p>
            )}
          </div>

          {/* A ROTA INTEIRA, com o de agora em destaque. Ela responde a
              pergunta que o operador faz sem falar: quanto falta. */}
          <div className="ca-rota">
            <span className="ca-rot">A rota desta fatia</span>
            <div className="ca-trilho">
              {rota.map((p, i) => (
                <span
                  key={p}
                  className={
                    p === fatia.etapa ? 'ca-passo agora' : i < ondeEstou ? 'ca-passo andou' : 'ca-passo'
                  }
                  title={nomeDoPosto(p)}
                />
              ))}
            </div>
            <div className="ca-pontas">
              <span>{nomeDoPosto(rota[0] ?? fatia.etapa)}</span>
              <b>{nomeDoPosto(fatia.etapa)}</b>
              <span>{nomeDoPosto(rota[rota.length - 1] ?? fatia.etapa)}</span>
            </div>
          </div>

          {/* A CONVERSA E O HISTÓRICO NA MESMA LINHA DO TEMPO, e não em duas
              abas. Um comentário lido sem saber que o cartão mudou de posto
              três minutos antes é meio comentário. */}
          <div className="ca-conversa">
            <span className="ca-rot">Conversa e histórico</span>
            <div className="ca-fila">
              {!linha.length ? (
                <p className="ca-nada">nada aconteceu com este cartão ainda</p>
              ) : (
                linha.map((e) => <Evento key={e.id} evento={e} />)
              )}
            </div>
            {podeMover ? (
              <div className="ca-escrever">
                <Entrada
                  className="ca-campo"
                  value={recado}
                  onChange={(e) => setRecado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void enviar()
                  }}
                  placeholder="Escrever para a equipe"
                  aria-label="Escrever para a equipe"
                />
                <Botao
                  tom="forte"
                  icone
                  aria-label="Enviar o recado"
                  disabled={recado.trim().length < 2 || enviando}
                  onClick={() => void enviar()}
                >
                  <PaperPlaneRight size={16} weight="bold" />
                </Botao>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
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
            <b>{evento.quemNome || 'alguém'}</b> {quando(evento.em)}
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
        {frase(evento)} <i>{quando(evento.em)}</i>
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

function dataCurta(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
