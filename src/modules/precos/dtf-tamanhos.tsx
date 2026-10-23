import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { ArrowsClockwise, CopySimple, DotsSixVertical, FolderSimplePlus, Plus, Trash } from '@phosphor-icons/react'
import { Botao, Campo, Chip, Entrada, PerguntaDeApagar, Segmentado, Seletor, Vazio, avisar, lerNumero } from '@ds'
import { dinheiro } from './dtf-custo'
import {
  CamisaDoDtf,
  CamisaDosTamanhos,
  MEDIDAS_PRONTAS,
  centroQueCabe,
  custoDaCombinacao,
  custoDoTamanho,
  medidaDoTamanho,
  naOrdemDosGrupos,
  segueOCusto,
  nomeDaCombinacao,
  novoId,
  type Adicionais,
  type CustoDoDtf,
  type GrupoDeDtf,
  type LadoDaCamisa,
  type MudancaDoTamanho,
  type TabelaDePreco,
  type TamanhoDeDtf,
} from '@dominio/preco'

/* ==========================================================================
   OS TAMANHOS DE DTF (pedido dele em 22/10/2026: "preciso poder criar
   tamanhos de DTF, depois combiná-los para criar os templates com preço;
   faça como um editor mesmo").

   Cada tabela tem os seus. Um tamanho é o nome, o lado da camisa, a medida
   em cm e o lugar no desenho. Na camisa, o escolhido se arrasta e o canto
   mede; nos campos, a medida se escreve; as medidas prontas (A3, A4...) se
   clicam. As combinações (a outra metade da aba) se montam com eles.
   ========================================================================== */

/** Troca os tamanhos e mantém as combinações de pé: o tamanho apagado sai
    delas, e o nome que se escrevia sozinho continua se escrevendo. */
export function comTamanhos(a: Adicionais, novos: TamanhoDeDtf[], custo?: CustoDoDtf, custoVelho: CustoDoDtf | undefined = custo): Adicionais {
  const ids = new Set(novos.map(t => t.id))
  return {
    ...a,
    tamanhosDtf: novos,
    dtf: a.dtf.map(c => {
      const posicoes = c.posicoes.filter(p => ids.has(p))
      const nome = c.nome === nomeDaCombinacao(c.posicoes, a.tamanhosDtf) ? nomeDaCombinacao(posicoes, novos) : c.nome
      /* o preço que seguia o custo continua seguindo: a medida mudou, o custo também */
      const segue = custo && custoVelho && c.valor != null && segueOCusto(c.valor, custoDaCombinacao(c.posicoes, a.tamanhosDtf, custoVelho))
      const valor = segue ? custoDaCombinacao(posicoes, novos, custo) : c.valor
      return { ...c, posicoes, nome, valor }
    }),
  }
}

const cm = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** O número em cm: escreve à vontade, grava no Enter ou ao sair. */
function CampoCm({ valor, rotulo, podeMexer, aoMudar }: { valor: number; rotulo: string; podeMexer: boolean; aoMudar: (v: number) => void }) {
  const [texto, setTexto] = useState(cm(valor))
  useEffect(() => setTexto(cm(valor)), [valor])
  const gravar = () => {
    const n = lerNumero(texto)
    if (n != null && Number.isFinite(n) && n > 0 && n <= 120) {
      const v = Math.round(n * 10) / 10
      if (v !== valor) aoMudar(v)
      setTexto(cm(v))
    } else setTexto(cm(valor))
  }
  return (
    <Campo rotulo={rotulo}>
      <span className="pr-cm">
        <Entrada
          value={texto}
          inputMode="decimal"
          disabled={!podeMexer}
          aria-label={rotulo + ' em centímetros'}
          onChange={e => setTexto(e.target.value)}
          onFocus={e => e.currentTarget.select()}
          onBlur={gravar}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              gravar()
            } else if (e.key === 'Escape') setTexto(cm(valor))
          }}
        />
        <small>cm</small>
      </span>
    </Campo>
  )
}

export function AbaTamanhos({
  tabela,
  podeMexer,
  mudar,
  topo,
  rodape,
  custo,
  aoUsar,
}: {
  tabela: TabelaDePreco
  podeMexer: boolean
  mudar: (f: (x: TabelaDePreco) => TabelaDePreco) => void
  /** a troca entre Tamanhos e Combinações, no alto da coluna da lista */
  topo: ReactNode
  /** a calculadora do custo, no pé da coluna da lista */
  rodape: ReactNode
  custo: CustoDoDtf
  /** levar para as combinações */
  aoUsar: () => void
}) {
  const tamanhos = tabela.adicionais.tamanhosDtf
  const grupos = tabela.adicionais.gruposDtf
  const [escolhido, setEscolhido] = useState(tamanhos[0]?.id ?? '')
  /* o tamanho da lista com o mouse em cima: a camisa grande mostra o lugar dele */
  const [sobre, setSobre] = useState<string | undefined>()
  const [apagando, setApagando] = useState(false)
  const atual = tamanhos.find(t => t.id === escolhido) ?? tamanhos[0]
  const usaram = (id: string) => tabela.adicionais.dtf.filter(c => c.posicoes.includes(id))

  /* toda mudança volta na ordem da tela: sem grupo primeiro, depois grupo a grupo */
  const mudarTamanhos = (f: (ts: TamanhoDeDtf[]) => TamanhoDeDtf[]) =>
    mudar(x => ({ ...x, adicionais: comTamanhos(x.adicionais, naOrdemDosGrupos(f(x.adicionais.tamanhosDtf), x.adicionais.gruposDtf), custo) }))
  const mudarGrupos = (f: (gs: GrupoDeDtf[]) => GrupoDeDtf[]) =>
    mudar(x => {
      const gruposDtf = f(x.adicionais.gruposDtf)
      return { ...x, adicionais: comTamanhos({ ...x.adicionais, gruposDtf }, naOrdemDosGrupos(x.adicionais.tamanhosDtf, gruposDtf), custo) }
    })
  const mudarUm = (id: string, m: Partial<TamanhoDeDtf>) =>
    mudarTamanhos(ts =>
      ts.map(t => {
        if (t.id !== id) return t
        const novo = { ...t, ...m }
        /* a medida nova pode não caber no lugar de antes: o centro se ajeita */
        return { ...novo, ...centroQueCabe(novo, novo.x, novo.y) }
      }),
    )

  /* A ORDEM DA LISTA (pedido dele em 22/10/2026: "alça de pegar e arrastar
     para eu organizar essa lista"). É a ordem dos tamanhos da tabela, a mesma
     das combinações e do nome que se escreve sozinho. Pela alça, arrastando
     (quem ouve é a janela, porque a linha que muda de lugar perde o ponteiro),
     ou pelo teclado, com as setas, e o foco fica na alça. */
  const focoNaAlca = useRef<string | null>(null)
  useEffect(() => {
    if (!focoNaAlca.current) return
    const alca = document.querySelector<HTMLButtonElement>(`[data-tamanho="${focoNaAlca.current}"] .pr-tam-pega`)
    focoNaAlca.current = null
    if (alca && document.activeElement !== alca) alca.focus()
  })
  const levar = (ts: TamanhoDeDtf[], id: string, para: number) => {
    const de = ts.findIndex(t => t.id === id)
    if (de < 0 || para < 0 || para >= ts.length || para === de) return ts
    const nova = [...ts]
    const [x] = nova.splice(de, 1)
    nova.splice(para, 0, x)
    return nova
  }
  /* pelo teclado: dentro do grupo troca de lugar; na beira do grupo, passa
     para o grupo vizinho (a ordem da tela o põe na ponta certa) */
  function mover(id: string, passo: number) {
    mudarTamanhos(ts => {
      const i = ts.findIndex(t => t.id === id)
      const viz = ts[i + passo]
      if (i < 0 || !viz) return ts
      if ((viz.grupo || '') === (ts[i].grupo || '')) return levar(ts, id, i + passo)
      return ts.map(t => (t.id === id ? { ...t, grupo: viz.grupo || '' } : t))
    })
    focoNaAlca.current = id
  }
  /* arrastando: em cima de outro tamanho, vai para o lugar dele e para o grupo
     dele; em cima da caixa de um grupo (o título ou o vazio), vai para o fim
     dela */
  function largarSobre(id: string, ev: globalThis.PointerEvent) {
    const el = document.elementFromPoint(ev.clientX, ev.clientY)
    const alvo = el?.closest<HTMLElement>('[data-tamanho]')?.dataset.tamanho
    if (alvo && alvo !== id) {
      mudarTamanhos(ts => {
        const g = ts.find(t => t.id === alvo)?.grupo || ''
        const comGrupo = ts.map(t => (t.id === id ? { ...t, grupo: g } : t))
        return levar(
          comGrupo,
          id,
          comGrupo.findIndex(t => t.id === alvo),
        )
      })
      return
    }
    if (alvo) return
    const caixa = el?.closest<HTMLElement>('[data-grupo]')
    if (!caixa) return
    const g = caixa.dataset.grupo || ''
    mudarTamanhos(ts => {
      const t = ts.find(x => x.id === id)
      if (!t || (t.grupo || '') === g) return ts
      return [...ts.filter(x => x.id !== id), { ...t, grupo: g }]
    })
  }
  const [presa, setPresa] = useState<string | null>(null)
  const largar = useRef<(() => void) | null>(null)
  useEffect(() => () => largar.current?.(), [])
  function pegar(e: PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return
    e.preventDefault()
    largar.current?.()
    setPresa(id)
    const aoMover = (ev: globalThis.PointerEvent) => largarSobre(id, ev)
    const aoLargar = () => {
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoLargar)
      window.removeEventListener('pointercancel', aoLargar)
      largar.current = null
      setPresa(null)
    }
    largar.current = aoLargar
    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoLargar)
    window.addEventListener('pointercancel', aoLargar)
  }

  function escolher(id: string) {
    setEscolhido(id)
    setApagando(false)
  }

  function novo() {
    const id = novoId(
      'tam-',
      tamanhos.map(t => t.id),
    )
    const lado: LadoDaCamisa = atual?.lado ?? 'frente'
    let n = tamanhos.length + 1
    while (tamanhos.some(t => t.nome === 'Tamanho ' + n)) n++
    /* nasce no grupo do tamanho escolhido */
    mudarTamanhos(ts => [...ts, { id, nome: 'Tamanho ' + n, lado, largura: 10, altura: 10, x: 50, y: 45, grupo: atual?.grupo || '' }])
    escolher(id)
  }

  /* OS GRUPOS: uma caixa na lista, com o nome que se escreve no título */
  const focoNoGrupo = useRef<string | null>(null)
  useEffect(() => {
    if (!focoNoGrupo.current) return
    const campo = document.querySelector<HTMLInputElement>(`[data-grupo="${focoNoGrupo.current}"] .pr-tam-grupo-nome`)
    focoNoGrupo.current = null
    campo?.focus()
    campo?.select()
  })
  function novoGrupo() {
    const id = novoId(
      'grupo-',
      grupos.map(g => g.id),
    )
    let n = grupos.length + 1
    while (grupos.some(g => g.nome === 'Grupo ' + n)) n++
    mudarGrupos(gs => [...gs, { id, nome: 'Grupo ' + n }])
    focoNoGrupo.current = id
  }
  function apagarGrupo(g: GrupoDeDtf) {
    const n = tamanhos.filter(t => t.grupo === g.id).length
    mudarGrupos(gs => gs.filter(x => x.id !== g.id))
    avisar(`Grupo ${g.nome || 'sem nome'} apagado` + (n ? `: ${n === 1 ? 'o tamanho ficou' : 'os ' + n + ' tamanhos ficaram'} sem grupo` : ''), 'ok')
  }

  function duplicar() {
    if (!atual) return
    const id = novoId(
      'tam-',
      tamanhos.map(t => t.id),
    )
    const copia = { ...atual, id, nome: atual.nome + ' (cópia)' }
    mudarTamanhos(ts => [...ts, { ...copia, ...centroQueCabe(copia, atual.x + 4, atual.y + 4) }])
    escolher(id)
  }

  const soltos = tamanhos.filter(t => !t.grupo)
  const linha = (t: TamanhoDeDtf) => {
    const n = usaram(t.id).length
    return (
      <div
        role="listitem"
        key={t.id}
        data-tamanho={t.id}
        className={'pr-tam-fila' + (t.id === atual?.id ? ' ligado' : '') + (presa === t.id ? ' presa' : '')}
        onMouseEnter={() => setSobre(t.id)}
        onMouseLeave={() => setSobre(undefined)}
      >
        {podeMexer ? (
          <button
            type="button"
            className="pr-tam-pega"
            aria-label={'Mudar a ordem de ' + (t.nome || 'sem nome') + '. Arraste, ou use as setas para cima e para baixo.'}
            title="Arraste para mudar a ordem"
            onPointerDown={e => pegar(e, t.id)}
            onKeyDown={e => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                mover(t.id, e.key === 'ArrowUp' ? -1 : 1)
              }
            }}
          >
            <DotsSixVertical size={16} weight="bold" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          className={'pr-dtf-item' + (t.id === atual?.id ? ' ligado' : '')}
          aria-current={t.id === atual?.id}
          onClick={() => escolher(t.id)}
        >
          <span className="dtf-par">
            <CamisaDoDtf lado={t.lado} ligadas={[t.id]} tamanhos={tamanhos} />
          </span>
          <span className="pilha">
            <b className="corta">{t.nome || 'Sem nome'}</b>
            <small>
              {medidaDoTamanho(t)} · {t.lado}
            </small>
          </span>
          <span className="pilha pr-dtf-item-fim">
            <span className="pr-dtf-preco">{dinheiro(custoDoTamanho(t, custo))}</span>
            <span className={'pr-dtf-uso' + (n ? '' : ' nenhum')}>{n ? `em ${n}` : 'sem uso'}</span>
          </span>
        </button>
      </div>
    )
  }

  const lista = (
    <div className="pr-dtf-l">
      {topo}
      <div className="pr-dtf-cab">
        <b>
          {tamanhos.length} {tamanhos.length === 1 ? 'tamanho' : 'tamanhos'}
        </b>
        {podeMexer ? (
          <span className="fileira">
            <Botao tom="contorno" tamanho="sm" onClick={novoGrupo} title="Uma caixa para juntar tamanhos">
              <FolderSimplePlus size={15} />
              Grupo
            </Botao>
            <Botao tom="contorno" tamanho="sm" onClick={novo}>
              <Plus size={15} />
              Novo tamanho
            </Botao>
          </span>
        ) : null}
      </div>
      <div className="pr-dtf-lista">
        <div className="pr-tam-soltos" role="list" aria-label="Os tamanhos sem grupo" data-grupo="">
          {soltos.map(linha)}
          {presa && grupos.length && !soltos.length ? <div className="pr-tam-vazio">Solte aqui para tirar do grupo</div> : null}
        </div>
        {grupos.map(g => {
          const dele = tamanhos.filter(t => t.grupo === g.id)
          return (
            <section key={g.id} className="pr-tam-grupo" data-grupo={g.id}>
              <div className="pr-tam-grupo-cab">
                <input
                  className="pr-tam-grupo-nome"
                  value={g.nome}
                  readOnly={!podeMexer}
                  placeholder="Nome do grupo"
                  aria-label="Nome do grupo"
                  onChange={e => mudarGrupos(gs => gs.map(x => (x.id === g.id ? { ...x, nome: e.target.value } : x)))}
                />
                <small>{dele.length}</small>
                {podeMexer ? (
                  <button
                    type="button"
                    className="pr-tam-grupo-x"
                    aria-label={'Apagar o grupo ' + (g.nome || 'sem nome')}
                    title="Apagar o grupo (os tamanhos ficam)"
                    onClick={() => apagarGrupo(g)}
                  >
                    <Trash size={15} />
                  </button>
                ) : null}
              </div>
              <div role="list" aria-label={'Os tamanhos do grupo ' + (g.nome || 'sem nome')}>
                {dele.map(linha)}
              </div>
              {!dele.length ? <div className="pr-tam-vazio">Arraste tamanhos para cá, ou escolha o grupo no tamanho</div> : null}
            </section>
          )
        })}
      </div>
      {rodape}
    </div>
  )

  if (!atual)
    return (
      <div className="pr-dtf">
        {lista}
        <div className="pr-dtf-r">
          <Vazio
            titulo="Nenhum tamanho ainda"
            texto={podeMexer ? 'Crie o primeiro em Novo tamanho: o nome, a medida em cm e o lugar na camisa.' : 'Quando houver, ele aparece aqui.'}
          />
        </div>
      </div>
    )

  const combos = usaram(atual.id)
  /* a medida pronta vale em pé ou deitada: o chip acende nas duas */
  const pronta = MEDIDAS_PRONTAS.find(
    m => (m.largura === atual.largura && m.altura === atual.altura) || (m.largura === atual.altura && m.altura === atual.largura),
  )
  const deitado = atual.largura > atual.altura
  const posicao = atual.largura === atual.altura ? 'Quadrado' : deitado ? 'Deitado' : 'Em pé'
  const girar = () => mudarUm(atual.id, { largura: atual.altura, altura: atual.largura })
  /* a medida pronta entra na posição em que o DTF já está: deitado continua deitado */
  const usarPronta = (m: { largura: number; altura: number }) => {
    const [a, b] = [Math.min(m.largura, m.altura), Math.max(m.largura, m.altura)]
    mudarUm(atual.id, deitado ? { largura: b, altura: a } : { largura: a, altura: b })
  }
  return (
    <div className="pr-dtf">
      {lista}
      <div className="pr-dtf-r pilha">
        <div className="pr-tam-campos">
          <Campo rotulo="Nome do tamanho">
            <Entrada value={atual.nome} disabled={!podeMexer} onChange={e => mudarUm(atual.id, { nome: e.target.value })} />
          </Campo>
          <div className="campo">
            <span className="campo-rotulo">Lado</span>
            {podeMexer ? (
              <Segmentado<LadoDaCamisa>
                valor={atual.lado}
                aoMudar={lado => mudarUm(atual.id, { lado })}
                opcoes={[
                  { valor: 'frente', rotulo: 'Frente' },
                  { valor: 'costas', rotulo: 'Costas' },
                ]}
              />
            ) : (
              <b>{atual.lado === 'frente' ? 'Frente' : 'Costas'}</b>
            )}
          </div>
          {grupos.length ? (
            <div className="campo">
              <span className="campo-rotulo">Grupo</span>
              {podeMexer ? (
                <Seletor
                  campo
                  valor={atual.grupo || ''}
                  vazio="Sem grupo"
                  opcoes={grupos.map(g => ({ valor: g.id, rotulo: g.nome || 'Sem nome' }))}
                  aoEscolher={g => mudarUm(atual.id, { grupo: g })}
                />
              ) : (
                <b>{grupos.find(g => g.id === atual.grupo)?.nome || 'Sem grupo'}</b>
              )}
            </div>
          ) : null}
        </div>

        <div className="pr-tam-corpo">
          <figure className="pr-dtf-camisa pr-tam-camisa">
            <CamisaDosTamanhos
              lado={atual.lado}
              tamanhos={tamanhos}
              escolhido={atual.id}
              aoEscolher={escolher}
              destaque={sobre}
              aoMudar={podeMexer ? (id: string, m: MudancaDoTamanho) => mudarUm(id, m) : undefined}
            />
            <figcaption>
              {atual.lado === 'frente' ? 'Frente' : 'Costas'}
              {podeMexer ? <small>Arraste para mudar o lugar; o canto muda a medida; a bolinha (ou R) gira</small> : null}
            </figcaption>
          </figure>

          <div className="pilha pr-tam-medida">
            <span className="fileira entre">
              <span className="pr-sobre">A medida</span>
              <span className={'pr-tam-pos' + (deitado ? ' deitado' : '')}>{posicao}</span>
            </span>
            <div className="pr-tam-linha">
              <CampoCm valor={atual.largura} rotulo="Largura" podeMexer={podeMexer} aoMudar={largura => mudarUm(atual.id, { largura })} />
              <CampoCm valor={atual.altura} rotulo="Altura" podeMexer={podeMexer} aoMudar={altura => mudarUm(atual.id, { altura })} />
              {/* a calculadora: o custo deste tamanho, sozinho, pela área e pelo custo do cm² */}
              <div className="campo">
                <span className="campo-rotulo">Custo</span>
                <span
                  className="pr-tam-custo"
                  aria-live="polite"
                  title={medidaDoTamanho(atual) + ' = ' + Math.round(atual.largura * atual.altura * 10) / 10 + ' cm²'}
                >
                  {dinheiro(custoDoTamanho(atual, custo))}
                </span>
              </div>
              {podeMexer ? (
                <Botao tom="contorno" title="Trocar a largura pela altura" disabled={atual.largura === atual.altura} onClick={girar}>
                  <ArrowsClockwise size={16} />
                  Girar
                </Botao>
              ) : null}
            </div>
            {podeMexer ? (
              <>
                <span className="pr-sobre">Medidas prontas</span>
                <div className="fileira miuda">
                  {MEDIDAS_PRONTAS.map(m => (
                    <Chip key={m.nome} tamanho="sm" ligado={pronta?.nome === m.nome} title={medidaDoTamanho(m)} onClick={() => usarPronta(m)}>
                      {m.nome}
                    </Chip>
                  ))}
                </div>
              </>
            ) : null}
            <span className="pr-sobre">Nas combinações</span>
            {combos.length ? (
              <p className="pr-tam-uso">{combos.map(c => c.nome).join('; ')}</p>
            ) : (
              <p className="pr-tam-uso nenhum">Ainda em nenhuma combinação.</p>
            )}
            <div className="fileira">
              <Botao tom="contorno" tamanho="sm" onClick={aoUsar}>
                Montar as combinações
              </Botao>
            </div>
          </div>
        </div>

        {podeMexer ? (
          apagando ? (
            <PerguntaDeApagar
              aoManter={() => setApagando(false)}
              aoApagar={() => {
                mudarTamanhos(ts => ts.filter(t => t.id !== atual.id))
                setApagando(false)
                setEscolhido('')
              }}
            >
              Apagar o tamanho <b>{atual.nome}</b>?
              {combos.length
                ? ` Ele sai de ${combos.length === 1 ? '1 combinação' : combos.length + ' combinações'}: ${combos.map(c => c.nome).join('; ')}.`
                : ''}
            </PerguntaDeApagar>
          ) : (
            <div className="fileira fim">
              <Botao tom="contorno" tamanho="sm" onClick={duplicar}>
                <CopySimple size={15} />
                Duplicar
              </Botao>
              <Botao tom="contorno" tamanho="sm" onClick={() => setApagando(true)}>
                <Trash size={15} />
                Apagar o tamanho
              </Botao>
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}
