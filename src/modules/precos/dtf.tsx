import { useState } from 'react'
import { Check, Copy, Plus, Trash } from '@phosphor-icons/react'
import { Botao, CampoDeCelula, Campo, Entrada, Seletor, Vazio, avisar, usarEdicaoDeCelulas } from '@ds'
import {
  CamisaDoDtf,
  CamisasDoDtf,
  POSICOES_DE_DTF,
  nomeDaCombinacao,
  novoId,
  type CombinacaoDeDtf,
  type TabelaDePreco,
} from '@dominio/preco'

/* ==========================================================================
   A ABA DTF (083, tela 4 do wireframe de 16/10/2026): o editor de
   combinações. À esquerda as combinações da tabela, cada uma com o desenho
   de onde vai o DTF e o preço por peça; à direita a escolhida. Clicar na
   camisa, ou na lista das posições, liga e desliga. O nome se escreve
   sozinho enquanto ninguém mexer nele.

   O DTF por quantidade fica de fora até a página especial dele.
   ========================================================================== */

const moeda = (v: number | null) => (v == null ? 'sem preço' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export function AbaDtf({
  tabela,
  outras,
  podeMexer,
  mudar,
}: {
  tabela: TabelaDePreco
  outras: TabelaDePreco[]
  podeMexer: boolean
  mudar: (f: (x: TabelaDePreco) => TabelaDePreco) => void
}) {
  const combos = tabela.adicionais.dtf
  const [escolhida, setEscolhida] = useState(combos[0]?.id ?? '')
  const [apagando, setApagando] = useState(false)
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
      /* o nome acompanha as posições enquanto ninguém escreveu outro */
      const nome = c.nome === nomeDaCombinacao(c.posicoes) ? nomeDaCombinacao(posicoes) : c.nome
      return { ...c, posicoes, nome }
    })
  }

  function nova() {
    const id = novoId('dtf-', combos.map((c) => c.id))
    mudarCombos((cs) => [...cs, { id, nome: nomeDaCombinacao(['peito-grande']), posicoes: ['peito-grande'], valor: null }])
    setEscolhida(id)
    setApagando(false)
  }

  function copiar() {
    const o = outras.find((x) => x.id === copiarDe)
    if (!o) return
    const usados = combos.map((c) => c.id)
    const novas = o.adicionais.dtf
      .filter((c) => !combos.some((x) => x.nome.toLowerCase() === c.nome.toLowerCase()))
      .map((c) => {
        const id = novoId('dtf-', usados)
        usados.push(id)
        return { ...c, id, posicoes: [...c.posicoes] }
      })
    mudarCombos((cs) => [...cs, ...novas])
    setCopiarDe('')
    avisar(novas.length ? `${novas.length} ${novas.length === 1 ? 'combinação veio' : 'combinações vieram'} da ${o.nome}` : 'Esta tabela já tem as combinações da ' + o.nome, 'ok')
  }

  return (
    <div className="pr-dtf">
      <div className="pr-dtf-l">
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
              <CamisasDoDtf ligadas={c.posicoes} />
              <span className="pilha">
                <b className="corta">{c.nome || 'Sem nome'}</b>
                <small>
                  {c.posicoes.length} {c.posicoes.length === 1 ? 'posição' : 'posições'}
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
      </div>

      {!atual ? (
        <div className="pr-dtf-r">
          <Vazio
            titulo="Nenhuma combinação ainda"
            texto={podeMexer ? 'Crie a primeira em Nova combinação: as posições na camisa e o preço por peça.' : 'Quando houver, ela aparece aqui.'}
          />
        </div>
      ) : (
        <div className="pr-dtf-r pilha">
          <div className="pr-dtf-campos">
            <Campo rotulo="Nome da combinação" dica={atual.nome === nomeDaCombinacao(atual.posicoes) ? 'Escreve-se sozinho pelas posições' : undefined}>
              <Entrada value={atual.nome} disabled={!podeMexer} onChange={(e) => mudarAtual((c) => ({ ...c, nome: e.target.value }))} />
            </Campo>
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
            </div>
          </div>
          <div className="pr-dtf-camisas">
            {(['frente', 'costas'] as const).map((lado) => (
              <figure key={lado} className="pr-dtf-camisa">
                <CamisaDoDtf lado={lado} ligadas={atual.posicoes} aoAlternar={podeMexer ? alternar : undefined} />
                <figcaption>{lado === 'frente' ? 'Frente' : 'Costas'}</figcaption>
              </figure>
            ))}
          </div>
          <span className="pr-sobre">As posições · clique na camisa ou aqui</span>
          <div className="pr-dtf-pos">
            {POSICOES_DE_DTF.map((p) => {
              const on = atual.posicoes.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={'pr-dtf-p' + (on ? ' ligado' : '')}
                  aria-pressed={on}
                  disabled={!podeMexer}
                  onClick={() => alternar(p.id)}
                >
                  <span className="pr-dtf-ck" aria-hidden="true">
                    {on ? <Check size={14} weight="bold" /> : null}
                  </span>
                  <span className="pilha">
                    <b>{p.nome}</b>
                    <small>
                      {p.medida} · {p.lado}
                    </small>
                  </span>
                </button>
              )
            })}
          </div>
          {podeMexer ? (
            apagando ? (
              <div className="pr-ex-pergunta" role="alert">
                <span>
                  Apagar a combinação <b>{atual.nome}</b>? O layout que usa ela fica pedindo outro DTF.
                </span>
                <span className="fileira">
                  <Botao tom="contorno" tamanho="sm" onClick={() => setApagando(false)}>
                    Manter
                  </Botao>
                  <Botao
                    tom="perigo"
                    tamanho="sm"
                    onClick={() => {
                      mudarCombos((cs) => cs.filter((c) => c.id !== atual.id))
                      setApagando(false)
                      setEscolhida('')
                    }}
                  >
                    Apagar
                  </Botao>
                </span>
              </div>
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
