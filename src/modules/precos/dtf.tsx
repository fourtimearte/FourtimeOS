import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy, Plus, Trash } from '@phosphor-icons/react'
import { Botao, CampoDeCelula, Campo, Entrada, PerguntaDeApagar, Segmentado, Seletor, Vazio, avisar, usarEdicaoDeCelulas } from '@ds'
import {
  CamisaDoDtf,
  CamisasDoDtf,
  custoDaCombinacao,
  custoDoTamanho,
  medidaDoTamanho,
  segueOCusto,
  type CustoDoDtf,
  nomeDaCombinacao,
  novoId,
  type CombinacaoDeDtf,
  type TabelaDePreco,
  type TamanhoDeDtf,
} from '@dominio/preco'
import { AbaTamanhos, comTamanhos } from './dtf-tamanhos'
import { FaixaDoCusto, dinheiro, usarCustoDoDtf } from './dtf-custo'

/* ==========================================================================
   A ABA DTF (083, tela 4 do wireframe de 16/10/2026): o editor de
   combinações. À esquerda as combinações da tabela, cada uma com o desenho
   de onde vai o DTF e o preço por peça; à direita a escolhida. Clicar na
   camisa, ou na lista das posições, liga e desliga. O nome se escreve
   sozinho enquanto ninguém mexer nele.

   O DTF por quantidade fica de fora até a página especial dele.

   22/10/2026: a aba ganhou a outra metade, os TAMANHOS (dtf-tamanhos.tsx).
   Primeiro se criam os tamanhos da tabela (nome, lado, medida, lugar), e as
   combinações se montam com eles. A troca fica no alto da coluna da lista.
   ========================================================================== */

type Parte = 'combinacoes' | 'tamanhos'

const moeda = (v: number | null) => (v == null ? 'sem preço' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export function AbaDtf({
  tabela,
  outras,
  podeMexer,
  souAdmin = false,
  mudar,
}: {
  tabela: TabelaDePreco
  outras: TabelaDePreco[]
  podeMexer: boolean
  souAdmin?: boolean
  mudar: (f: (x: TabelaDePreco) => TabelaDePreco) => void
}) {
  const [parte, setParte] = useState<Parte>('combinacoes')
  const { custo, setCusto, falha } = usarCustoDoDtf()
  /* o custo novo da fábrica: as combinações desta tabela que seguiam o custo
     velho passam a seguir o novo (o preço escrito à mão não muda) */
  function aoGravarCusto(novo: CustoDoDtf) {
    const velho = custo
    setCusto(novo)
    if (podeMexer) mudar((x) => ({ ...x, adicionais: comTamanhos(x.adicionais, x.adicionais.tamanhosDtf, novo, velho) }))
  }
  const rodape = <FaixaDoCusto custo={custo} falha={falha} souAdmin={souAdmin} aoGravar={aoGravarCusto} />
  const topo = (
    <div className="pr-dtf-parte">
      <Segmentado<Parte>
        valor={parte}
        aoMudar={setParte}
        opcoes={[
          { valor: 'combinacoes', rotulo: <span className="pr-seg">Combinações<em className="pr-conta">{tabela.adicionais.dtf.length}</em></span> },
          { valor: 'tamanhos', rotulo: <span className="pr-seg">Tamanhos<em className="pr-conta">{tabela.adicionais.tamanhosDtf.length}</em></span> },
        ]}
      />
    </div>
  )
  return parte === 'tamanhos' ? (
    <AbaTamanhos tabela={tabela} podeMexer={podeMexer} mudar={mudar} topo={topo} rodape={rodape} custo={custo} aoUsar={() => setParte('combinacoes')} />
  ) : (
    <AbaCombinacoes
      tabela={tabela}
      outras={outras}
      podeMexer={podeMexer}
      mudar={mudar}
      topo={topo}
      rodape={rodape}
      custo={custo}
      aoTamanhos={() => setParte('tamanhos')}
    />
  )
}

function AbaCombinacoes({
  tabela,
  outras,
  podeMexer,
  mudar,
  topo,
  rodape,
  custo,
  aoTamanhos,
}: {
  tabela: TabelaDePreco
  outras: TabelaDePreco[]
  podeMexer: boolean
  mudar: (f: (x: TabelaDePreco) => TabelaDePreco) => void
  topo: ReactNode
  rodape: ReactNode
  custo: CustoDoDtf
  aoTamanhos: () => void
}) {
  const combos = tabela.adicionais.dtf
  const tamanhos = tabela.adicionais.tamanhosDtf
  const nomeDe = (posicoes: string[]) => nomeDaCombinacao(posicoes, tamanhos)
  const custoDe = (posicoes: string[]) => custoDaCombinacao(posicoes, tamanhos, custo)
  const [escolhida, setEscolhida] = useState(combos[0]?.id ?? '')
  const [apagando, setApagando] = useState(false)
  /* o cartão do tamanho com o mouse (ou o foco) em cima: só ele mostra o
     tracejado na camisa; o resto da camisa fica limpo */
  const [sobre, setSobre] = useState<string | undefined>()
  const grupos = tabela.adicionais.gruposDtf
  const [copiarDe, setCopiarDe] = useState('')
  const atual = combos.find((c) => c.id === escolhida) ?? combos[0]
  const mudarCombos = (f: (cs: CombinacaoDeDtf[]) => CombinacaoDeDtf[]) => mudar((x) => ({ ...x, adicionais: { ...x.adicionais, dtf: f(x.adicionais.dtf) } }))
  const mudarAtual = (f: (c: CombinacaoDeDtf) => CombinacaoDeDtf) => atual && mudarCombos((cs) => cs.map((c) => (c.id === atual.id ? f(c) : c)))
  const comDtf = outras.filter((o) => o.adicionais.dtf.length)

  const edicao = usarEdicaoDeCelulas({
    ordem: atual ? [atual.id] : [],
    colunas: 1,
    valorDe: () => atual?.valor ?? null,
    aoEscrever: (_id, _c, v) => mudarAtual((c) => ({ ...c, valor: v })),
    aoColar: () => {},
  })

  function alternar(pos: string) {
    if (!podeMexer) return
    mudarAtual((c) => {
      const posicoes = c.posicoes.includes(pos) ? c.posicoes.filter((p) => p !== pos) : [...c.posicoes, pos]
      /* o nome e o preço acompanham os tamanhos enquanto ninguém escreveu outro */
      const nome = c.nome === nomeDe(c.posicoes) ? nomeDe(posicoes) : c.nome
      const valor = segueOCusto(c.valor, custoDe(c.posicoes)) ? custoDe(posicoes) : c.valor
      return { ...c, posicoes, nome, valor }
    })
  }

  function nova() {
    const id = novoId('dtf-', combos.map((c) => c.id))
    /* começa no Peito grande quando a tabela tem; senão, no primeiro tamanho */
    const primeiro = tamanhos.find((t) => t.id === 'peito-grande') ?? tamanhos[0]
    const posicoes = primeiro ? [primeiro.id] : []
    /* nasce com o preço da calculadora: o custo dos tamanhos ligados */
    mudarCombos((cs) => [...cs, { id, nome: nomeDe(posicoes), posicoes, valor: custoDe(posicoes) }])
    setEscolhida(id)
    setApagando(false)
  }

  function copiar() {
    const o = outras.find((x) => x.id === copiarDe)
    if (!o) return
    const usados = combos.map((c) => c.id)
    /* os tamanhos que as combinações copiadas usam e esta tabela não tem vêm junto */
    const meus = new Set(tamanhos.map((t) => t.id))
    const precisa = new Set(o.adicionais.dtf.flatMap((c) => c.posicoes))
    const vindos: TamanhoDeDtf[] = o.adicionais.tamanhosDtf.filter((t) => precisa.has(t.id) && !meus.has(t.id)).map((t) => ({ ...t }))
    const novas = o.adicionais.dtf
      .filter((c) => !combos.some((x) => x.nome.toLowerCase() === c.nome.toLowerCase()))
      .map((c) => {
        const id = novoId('dtf-', usados)
        usados.push(id)
        return { ...c, id, posicoes: [...c.posicoes] }
      })
    mudar((x) => ({ ...x, adicionais: { ...x.adicionais, dtf: [...x.adicionais.dtf, ...novas], tamanhosDtf: [...x.adicionais.tamanhosDtf, ...vindos] } }))
    setCopiarDe('')
    const comTam = vindos.length ? ` (e ${vindos.length === 1 ? '1 tamanho' : vindos.length + ' tamanhos'})` : ''
    avisar(novas.length ? `${novas.length} ${novas.length === 1 ? 'combinação veio' : 'combinações vieram'} da ${o.nome}${comTam}` : 'Esta tabela já tem as combinações da ' + o.nome, 'ok')
  }

  return (
    <div className="pr-dtf">
      <div className="pr-dtf-l">
        {topo}
        <div className="pr-dtf-cab">
          <b>
            {combos.length} {combos.length === 1 ? 'combinação' : 'combinações'}
          </b>
          {podeMexer ? (
            <Botao tom="contorno" tamanho="sm" onClick={nova}>
              <Plus size={15} />
              Nova combinação
            </Botao>
          ) : null}
        </div>
        <div className="pr-dtf-lista" role="list" aria-label="As combinações de DTF">
          {combos.map((c) => (
            <button
              type="button"
              role="listitem"
              key={c.id}
              className={'pr-dtf-item' + (c.id === atual?.id ? ' ligado' : '')}
              aria-current={c.id === atual?.id}
              onClick={() => {
                setEscolhida(c.id)
                setApagando(false)
              }}
            >
              <CamisasDoDtf ligadas={c.posicoes} tamanhos={tamanhos} />
              <span className="pilha">
                <b className="corta">{c.nome || 'Sem nome'}</b>
                <small>
                  {c.posicoes.length} {c.posicoes.length === 1 ? 'tamanho' : 'tamanhos'}
                </small>
              </span>
              <span className={'pr-dtf-preco' + (c.valor == null ? ' falta' : '')}>{moeda(c.valor)}</span>
            </button>
          ))}
        </div>
        {podeMexer && comDtf.length ? (
          <div className="fileira pr-dtf-copiar">
            <Seletor
              rotulo="COPIAR DE"
              valor={copiarDe}
              vazio="Outra tabela"
              opcoes={comDtf.map((o) => ({ valor: o.id, rotulo: `${o.nome} (${o.adicionais.dtf.length})` }))}
              aoEscolher={setCopiarDe}
            />
            <Botao tom="contorno" tamanho="sm" disabled={!copiarDe} onClick={copiar}>
              <Copy size={15} />
              Copiar
            </Botao>
          </div>
        ) : null}
        {rodape}
      </div>

      {!atual ? (
        <div className="pr-dtf-r">
          <Vazio
            titulo="Nenhuma combinação ainda"
            texto={podeMexer ? 'Crie a primeira em Nova combinação: os tamanhos na camisa e o preço por peça.' : 'Quando houver, ela aparece aqui.'}
          />
        </div>
      ) : (
        <div className="pr-dtf-r pilha">
          <div className="pr-dtf-campos">
            <Campo rotulo="Nome da combinação" dica={atual.nome === nomeDe(atual.posicoes) ? 'Escreve-se sozinho pelos tamanhos' : undefined}>
              <Entrada value={atual.nome} disabled={!podeMexer} onChange={(e) => mudarAtual((c) => ({ ...c, nome: e.target.value }))} />
            </Campo>
            <div className="campo">
              <span className="campo-rotulo">Custo do DTF</span>
              <span className="pr-tam-custo" aria-live="polite">
                {custoDe(atual.posicoes) == null ? 'sem tamanho' : dinheiro(custoDe(atual.posicoes)!)}
              </span>
            </div>
            <div className="campo">
              <span className="campo-rotulo">Preço por peça</span>
              <CampoDeCelula
                id={atual.id}
                coluna={0}
                valor={atual.valor}
                estado={atual.valor == null ? 'vazio' : 'base'}
                texto={atual.valor == null ? 'sem preço' : undefined}
                rotulo={'Preço por peça da ' + atual.nome}
                podeMexer={podeMexer}
                edicao={edicao}
              />
              <DiferencaDoCusto valor={atual.valor} custo={custoDe(atual.posicoes)} podeMexer={podeMexer} aoUsar={(v) => mudarAtual((c) => ({ ...c, valor: v }))} />
            </div>
          </div>
          <div className="pr-dtf-camisas">
            {(['frente', 'costas'] as const).map((lado) => (
              <figure key={lado} className="pr-dtf-camisa">
                <CamisaDoDtf lado={lado} ligadas={atual.posicoes} tamanhos={tamanhos} destaque={sobre} aoAlternar={podeMexer ? alternar : undefined} />
                <figcaption>{lado === 'frente' ? 'Frente' : 'Costas'}</figcaption>
              </figure>
            ))}
          </div>
          <span className="fileira entre">
            <span className="pr-sobre">Os tamanhos · clique para ligar</span>
            {podeMexer ? (
              <Botao tom="limpo" tamanho="sm" onClick={aoTamanhos}>
                Mudar os tamanhos
              </Botao>
            ) : null}
          </span>
          {!tamanhos.length ? <p className="pr-tam-uso nenhum">Esta tabela não tem tamanhos de DTF. Crie em Tamanhos, e eles aparecem aqui.</p> : null}
          {/* os tamanhos em cartões, separados pelos grupos da aba Tamanhos */}
          {[{ id: '', nome: '' }, ...grupos].map((g) => {
            const deles = tamanhos.filter((t) => (t.grupo || '') === g.id)
            if (!deles.length) return null
            return (
              <div key={g.id || 'soltos'} className="pilha pr-dtf-pos-grupo">
                {g.id ? <span className="pr-dtf-pos-titulo">{g.nome || 'Sem nome'}</span> : null}
                <div className="pr-dtf-pos">
                  {deles.map((p) => {
                    const on = atual.posicoes.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={'pr-dtf-p' + (on ? ' ligado' : '')}
                        aria-pressed={on}
                        disabled={!podeMexer}
                        onClick={() => alternar(p.id)}
                        onMouseEnter={() => setSobre(p.id)}
                        onMouseLeave={() => setSobre(undefined)}
                        onFocus={() => setSobre(p.id)}
                        onBlur={() => setSobre(undefined)}
                      >
                        <span className="pr-dtf-ck" aria-hidden="true">
                          {on ? <Check size={14} weight="bold" /> : null}
                        </span>
                        <span className="pilha">
                          <b>{p.nome}</b>
                          <small>
                            {medidaDoTamanho(p)} · {p.lado} · {dinheiro(custoDoTamanho(p, custo))}
                          </small>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {podeMexer ? (
            apagando ? (
              <PerguntaDeApagar
                aoManter={() => setApagando(false)}
                aoApagar={() => {
                  mudarCombos((cs) => cs.filter((c) => c.id !== atual.id))
                  setApagando(false)
                  setEscolhida('')
                }}
              >
                Apagar a combinação <b>{atual.nome}</b>? O layout que usa ela fica pedindo outro DTF.
              </PerguntaDeApagar>
            ) : (
              <div className="fileira fim">
                <Botao tom="contorno" tamanho="sm" onClick={() => setApagando(true)}>
                  <Trash size={15} />
                  Apagar a combinação
                </Botao>
              </div>
            )
          ) : null}
        </div>
      )}
    </div>
  )
}

/** O preço contra o custo: igual (segue sozinho), acima (quanto ganha) ou
    abaixo (em vermelho), com o atalho de voltar ao custo. */
function DiferencaDoCusto({ valor, custo, podeMexer, aoUsar }: { valor: number | null; custo: number | null; podeMexer: boolean; aoUsar: (v: number) => void }) {
  if (custo == null) return null
  if (valor != null && segueOCusto(valor, custo)) return <span className="pr-dtf-dif">É o custo: acompanha os tamanhos</span>
  const dif = valor == null ? null : Math.round((valor - custo) * 100) / 100
  return (
    <span className={'pr-dtf-dif fileira miuda' + (dif != null && dif < 0 ? ' abaixo' : '')}>
      {dif == null ? 'Sem preço' : dif < 0 ? dinheiro(-dif) + ' abaixo do custo' : dinheiro(dif) + ' acima do custo'}
      {podeMexer ? (
        <button type="button" className="pr-dtf-usar" onClick={() => aoUsar(custo)}>
          Usar o custo
        </button>
      ) : null}
    </span>
  )
}
