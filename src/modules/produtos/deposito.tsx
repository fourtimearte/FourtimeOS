import { useEffect, useMemo, useState } from 'react'
import { ArrowLineDown, MapPin, Package, Warning } from '@phosphor-icons/react'
import { Botao, Campo, Chip, Entrada, Kpi, Modal, Segmentado, Seletor, Vazio, avisar } from '@ds'
import {
  COLUNAS_DO_DEPOSITO,
  NOME_DA_ORIGEM_DA_PECA,
  baixaPossivel,
  carregarDeposito,
  darBaixaDePecas,
  diasGuardado,
  DIAS_PARADA,
  guardarPecas,
  loteInfantil,
  lotesVivos,
  mudarLugarDoLote,
  noFiltro,
  resumoDoDeposito,
  tamanhosDaReferencia,
  textoDaOrigem,
  totalDoLote,
  type FiltroDoDeposito,
  type GrupoDeReferencia,
  type LoteDePecas,
  type OrigemDaPeca,
  type ReferenciaNaFicha,
} from '@dominio/produto'

/* ==========================================================================
   A ABA DEPOSITO DAS FICHAS TECNICAS (prancha 63; banco 073, 12/10/2026).

   As pecas prontas guardadas: a pronta entrega, a sobra de pedido e o
   mostruario, por tamanho e com o lugar de cada lote. A grade adulta e a
   infantil dividem as colunas (PP com 2A, P com 4A...); o numero do lote
   infantil sai em vermelho claro, na linha de baixo do cabecalho.
   No celular cada lote vira um cartao com a grade em texto.
   ========================================================================== */

const FILTROS: { valor: FiltroDoDeposito; rotulo: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'pronta', rotulo: 'Pronta entrega' },
  { valor: 'sobra', rotulo: 'Sobra de pedido' },
  { valor: 'mostruario', rotulo: 'Mostruário' },
  { valor: 'sem-lugar', rotulo: 'Sem lugar' },
]

const GENERO: Record<string, string> = { M: 'masculino', F: 'feminino', C: 'infantil', U: 'unissex' }

const MOTIVOS = ['Vendida', 'Entregue num pedido', 'Mostruário emprestado', 'Perdida ou com defeito']

const lotes = (n: number) => (n === 1 ? '1 lote' : n + ' lotes')
const pecas = (n: number) => (n === 1 ? '1 peça' : n + ' peças')

export type AcaoDoDeposito = '' | 'guardar' | 'baixa'

export function Deposito({
  referencias,
  grupos,
  podeEditar,
  celular,
  acao,
  aoFecharAcao,
  aoMudar,
}: {
  referencias: ReferenciaNaFicha[]
  grupos: GrupoDeReferencia[]
  podeEditar: boolean
  celular: boolean
  /** o botao do topo da pagina (Guardar pecas, Dar baixa) */
  acao: AcaoDoDeposito
  aoFecharAcao: () => void
  /** a pagina relê o que mostra na ficha da peca (Prontas no deposito) */
  aoMudar?: (l: LoteDePecas[]) => void
}) {
  const [todos, setTodos] = useState<LoteDePecas[] | null | undefined>(undefined)
  const [filtro, setFiltro] = useState<FiltroDoDeposito>('tudo')
  const [baixaDe, setBaixaDe] = useState<LoteDePecas | null>(null)
  const [lugarDe, setLugarDe] = useState<LoteDePecas | null>(null)
  const hoje = useMemo(() => new Date(), [])

  async function reler() {
    try {
      const l = await carregarDeposito()
      setTodos(l)
      if (l) aoMudar?.(l)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui ler o depósito.', 'warn')
      setTodos(null)
    }
  }
  useEffect(() => {
    void reler()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (todos === undefined) return <section className="cartao pd-quadro"><p className="pd-nota pd-dp-espera">Lendo o depósito...</p></section>
  if (todos === null)
    return (
      <section className="cartao pd-quadro" data-deposito="sem-banco">
        <Vazio titulo="O depósito de peças prontas espera o banco" texto="Falta rodar a migração 073 no banco para guardar e dar baixa nas peças prontas." />
      </section>
    )

  const vivos = lotesVivos(todos)
  const resumo = resumoDoDeposito(todos, hoje)
  const vistos = vivos.filter((l) => noFiltro(l, filtro))
  const porId = new Map(referencias.map((r) => [r.id, r]))
  const nomeDoGrupo = new Map(grupos.map((g) => [g.cod, g.nome]))
  /* agrupado pelo grupo da referencia, na ordem do catalogo */
  const ordemDoGrupo = new Map(grupos.map((g) => [g.cod, g.ordem]))
  const porGrupo = new Map<string, LoteDePecas[]>()
  vistos.forEach((l) => {
    const g = porId.get(l.referenciaId)?.grupo ?? (l.cod.match(/^FT-(\d{3})/)?.[1] || 'sem grupo')
    if (!porGrupo.has(g)) porGrupo.set(g, [])
    porGrupo.get(g)!.push(l)
  })
  const blocos = [...porGrupo.entries()].sort((a, b) => (ordemDoGrupo.get(a[0]) ?? 999) - (ordemDoGrupo.get(b[0]) ?? 999) || a[0].localeCompare(b[0]))

  return (
    <>
      <div className="fila-kpi pd-dp-kpis">
        <Kpi rotulo="Peças prontas" valor={resumo.pecas} unidade="pçs" sub="guardadas no depósito" />
        <Kpi rotulo="Referências" valor={resumo.referencias} sub="com peça pronta" />
        <Kpi rotulo="Sem lugar marcado" valor={resumo.semLugar} unidade={resumo.semLugar === 1 ? 'lote' : 'lotes'} aviso={resumo.semLugar > 0} sub={resumo.semLugar ? 'ninguém sabe onde estão' : 'todos têm lugar'} />
        <Kpi rotulo="Paradas" valor={resumo.paradas} unidade="pçs" sub={`guardadas há mais de ${DIAS_PARADA} dias`} />
      </div>

      <div className="fileira miuda pd-dp-filtros" role="group" aria-label="O que mostrar">
        {FILTROS.map((f) => (
          <Chip key={f.valor} ligado={filtro === f.valor} aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>
            {f.rotulo} <span className="pd-chip-n">{resumo.porFiltro[f.valor]}</span>
          </Chip>
        ))}
      </div>

      <section className="cartao pd-quadro pd-dp" data-deposito="">
        {!vivos.length ? (
          <Vazio
            titulo="Nenhuma peça pronta guardada"
            texto="A pronta entrega, a sobra de pedido e o mostruário entram por Guardar peças, com a grade e o lugar."
          />
        ) : !vistos.length ? (
          <Vazio titulo="Nada neste filtro" texto="Troque o filtro de cima." />
        ) : celular ? (
          <div className="pd-dp-cartoes">
            {blocos.map(([g, ls]) => (
              <div key={g} className="pilha pd-dp-bloco">
                <p className="pd-dp-g">
                  <b>{g}</b> {nomeDoGrupo.get(g) ?? ''}
                </p>
                {ls.map((l) => (
                  <article key={l.id} className="pd-dp-cartao" data-lote={l.id}>
                    <b>{l.nome}</b>
                    <small>
                      {l.cor || 'sem cor'} · {textoDaOrigem(l)}
                    </small>
                    <span className="pd-dp-grade-txt">
                      {Object.entries(l.grade)
                        .filter(([, n]) => n > 0)
                        .map(([t, n]) => t + ' ' + n)
                        .join(' · ')}
                    </span>
                    <span className="fileira entre">
                      <span className={l.onde ? 'pd-dp-onde' : 'pd-dp-onde pd-dp-sem'}>
                        <MapPin size={14} /> {l.onde || 'sem lugar'}
                      </span>
                      <b>{pecas(totalDoLote(l))}</b>
                    </span>
                    {podeEditar ? (
                      <span className="fileira miuda">
                        <Botao tom="contorno" tamanho="sm" onClick={() => setLugarDe(l)}>
                          Lugar
                        </Botao>
                        <Botao tom="contorno" tamanho="sm" onClick={() => setBaixaDe(l)}>
                          Dar baixa
                        </Botao>
                      </span>
                    ) : null}
                  </article>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="pd-dp-rolo">
            <table className="pd-dp-tab">
              <thead>
                <tr>
                  <th className="pd-dp-peca">Peça</th>
                  <th className="pd-dp-cor">Cor ou estampa</th>
                  {COLUNAS_DO_DEPOSITO.map(([a, i]) => (
                    <th key={a} className="pd-dp-t">
                      <span>{a}</span>
                      <small>{i}</small>
                    </th>
                  ))}
                  <th className="pd-dp-tot">Total</th>
                  <th className="pd-dp-onde-c">Onde fica</th>
                  {podeEditar ? <th className="pd-dp-acao" aria-label="Dar baixa" /> : null}
                </tr>
              </thead>
              {blocos.map(([g, ls]) => (
                <tbody key={g}>
                  <tr className="pd-dp-gl">
                    <td colSpan={COLUNAS_DO_DEPOSITO.length + (podeEditar ? 5 : 4)}>
                      <b>{g}</b> {nomeDoGrupo.get(g) ?? ''}
                      <small>
                        {pecas(ls.reduce((s, l) => s + totalDoLote(l), 0))} em {lotes(ls.length)}
                      </small>
                    </td>
                  </tr>
                  {ls.map((l) => {
                    const infantil = loteInfantil(l)
                    const r = porId.get(l.referenciaId)
                    const parado = diasGuardado(l, hoje) > DIAS_PARADA
                    return (
                      <tr key={l.id} data-lote={l.id}>
                        <td className="pd-dp-peca">
                          <b>{l.nome}</b>
                          <small>
                            {l.cod.replace(/^FT-/, '')}
                            {r?.genero ? ' · ' + (GENERO[r.genero] ?? r.genero) : ''}
                          </small>
                        </td>
                        <td className="pd-dp-cor">
                          <b>{l.cor || '-'}</b>
                          <small>
                            {textoDaOrigem(l)}
                            {parado ? ' · parada' : ''}
                          </small>
                        </td>
                        {COLUNAS_DO_DEPOSITO.map(([a, i]) => {
                          const n = infantil ? (i ? l.grade[i] ?? 0 : 0) : l.grade[a] ?? 0
                          return (
                            <td key={a} className={infantil && n ? 'pd-dp-t pd-dp-inf' : 'pd-dp-t'}>
                              {n || '·'}
                            </td>
                          )
                        })}
                        <td className="pd-dp-tot">{totalDoLote(l)}</td>
                        <td className="pd-dp-onde-c">
                          {podeEditar ? (
                            <button type="button" className={l.onde ? 'pd-dp-onde' : 'pd-dp-onde pd-dp-sem'} onClick={() => setLugarDe(l)}>
                              {l.onde || 'sem lugar'}
                            </button>
                          ) : (
                            <span className={l.onde ? 'pd-dp-onde' : 'pd-dp-onde pd-dp-sem'}>{l.onde || 'sem lugar'}</span>
                          )}
                        </td>
                        {podeEditar ? (
                          <td className="pd-dp-acao">
                            <Botao tom="limpo" tamanho="sm" icone aria-label={'Dar baixa em ' + l.nome + ' ' + l.cor} onClick={() => setBaixaDe(l)}>
                              <ArrowLineDown size={16} />
                            </Botao>
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
            <p className="pd-nota pd-dp-legenda">
              <span className="pd-dp-inf">2A</span> Peça infantil usa a mesma linha da grade: o número em vermelho claro vale para o tamanho de baixo do cabeçalho (2A a 14A).
            </p>
          </div>
        )}
      </section>

      <GuardarPecas
        aberto={acao === 'guardar'}
        referencias={referencias}
        aoFechar={aoFecharAcao}
        aoGuardar={() => {
          aoFecharAcao()
          void reler()
        }}
      />
      <DarBaixa
        lote={baixaDe ?? (acao === 'baixa' ? null : undefined)}
        lotes={vivos}
        aoFechar={() => {
          setBaixaDe(null)
          aoFecharAcao()
        }}
        aoDar={() => {
          setBaixaDe(null)
          aoFecharAcao()
          void reler()
        }}
      />
      <MudarLugar
        lote={lugarDe}
        aoFechar={() => setLugarDe(null)}
        aoMudar={() => {
          setLugarDe(null)
          void reler()
        }}
      />
    </>
  )
}

/* --- guardar pecas ------------------------------------------------------------ */
function GuardarPecas({
  aberto,
  referencias,
  aoFechar,
  aoGuardar,
}: {
  aberto: boolean
  referencias: ReferenciaNaFicha[]
  aoFechar: () => void
  aoGuardar: () => void
}) {
  const [refId, setRefId] = useState('')
  const [cor, setCor] = useState('')
  const [origem, setOrigem] = useState<OrigemDaPeca>('pronta')
  const [pedido, setPedido] = useState('')
  const [grade, setGrade] = useState<Record<string, string>>({})
  const [onde, setOnde] = useState('')
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setRefId('')
    setCor('')
    setOrigem('pronta')
    setPedido('')
    setGrade({})
    setOnde('')
    setErro('')
    setGravando(false)
  }, [aberto])

  const ref = referencias.find((r) => r.id === refId)
  const tamanhos = ref ? tamanhosDaReferencia(ref) : []
  const numeros = Object.fromEntries(Object.entries(grade).map(([t, v]) => [t, Number(v) || 0]))
  const total = Object.values(numeros).reduce((s, n) => s + n, 0)

  async function guardar() {
    if (!ref) return setErro('Escolha a peça.')
    if (!total) return setErro('Escreva quantas peças de cada tamanho.')
    if (origem === 'sobra' && !pedido.trim()) return setErro('Diga de qual pedido sobrou.')
    setErro('')
    setGravando(true)
    try {
      await guardarPecas({ referenciaId: ref.id, cor, origem, pedido, grade: numeros, onde })
      avisar(pecas(total) + ' de ' + ref.nome + ' guardadas no depósito.', 'ok')
      aoGuardar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui guardar as peças.')
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Guardar peças prontas"
      largo
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" disabled={gravando} carregando={gravando} onClick={() => void guardar()}>
            <Package size={16} weight="bold" />
            Guardar {total ? pecas(total) : 'as peças'}
          </Botao>
        </>
      }
    >
      <div className="pilha pd-dp-form">
        <Campo rotulo="Peça">
          <Seletor
            campo
            bloco
            valor={refId}
            vazio="Escolher a referência"
            opcoes={referencias.filter((r) => r.ativo).map((r) => ({ valor: r.id, rotulo: r.cod.replace(/^FT-/, '') + ' · ' + r.nome }))}
            aoEscolher={(v) => {
              setRefId(v)
              setGrade({})
            }}
          />
        </Campo>
        <div className="pd-dp-dois">
          <Campo rotulo="Cor ou estampa">
            <Entrada value={cor} maxLength={80} placeholder="Ex.: Preto, Estampa Atlético" onChange={(e) => setCor(e.target.value)} />
          </Campo>
          <Campo rotulo="Onde fica" dica="O lugar no depósito: prateleira, nível">
            <Entrada value={onde} maxLength={60} placeholder="Ex.: P2 · B3" onChange={(e) => setOnde(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="De onde veio">
          <Segmentado<OrigemDaPeca>
            valor={origem}
            aoMudar={setOrigem}
            opcoes={(Object.keys(NOME_DA_ORIGEM_DA_PECA) as OrigemDaPeca[]).map((o) => ({ valor: o, rotulo: NOME_DA_ORIGEM_DA_PECA[o] }))}
          />
        </Campo>
        {origem === 'sobra' ? (
          <Campo rotulo="Sobrou de qual pedido">
            <Entrada value={pedido} maxLength={40} placeholder="Ex.: PD-0398" onChange={(e) => setPedido(e.target.value)} />
          </Campo>
        ) : null}
        {ref ? (
          <Campo rotulo={'Peças por tamanho' + (total ? ' · ' + pecas(total) : '')}>
            <div className="pd-dp-grade">
              {tamanhos.map((t) => (
                <label key={t} className="pd-dp-cel">
                  <span>{t}</span>
                  <Entrada
                    inputMode="numeric"
                    aria-label={'Peças no tamanho ' + t}
                    value={grade[t] ?? ''}
                    onChange={(e) => setGrade({ ...grade, [t]: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  />
                </label>
              ))}
            </div>
          </Campo>
        ) : (
          <p className="pd-nota">Escolha a peça para aparecerem os tamanhos dela.</p>
        )}
        {erro ? (
          <p className="pd-dp-erro" role="alert">
            <Warning size={16} weight="bold" /> {erro}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

/* --- dar baixa ---------------------------------------------------------------- */
function DarBaixa({
  lote: inicial,
  lotes: vivos,
  aoFechar,
  aoDar,
}: {
  /** undefined: fechado; null: aberto pelo topo, escolhe o lote */
  lote: LoteDePecas | null | undefined
  lotes: LoteDePecas[]
  aoFechar: () => void
  aoDar: () => void
}) {
  const [loteId, setLoteId] = useState('')
  const [sai, setSai] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)
  const aberto = inicial !== undefined

  useEffect(() => {
    if (!aberto) return
    setLoteId(inicial?.id ?? '')
    setSai({})
    setMotivo('')
    setErro('')
    setGravando(false)
  }, [aberto, inicial])

  const l = vivos.find((x) => x.id === loteId) ?? null
  const numeros = Object.fromEntries(Object.entries(sai).map(([t, v]) => [t, Number(v) || 0]))
  const total = Object.values(numeros).reduce((s, n) => s + n, 0)

  async function dar() {
    if (!l) return setErro('Escolha o lote.')
    const falha = baixaPossivel(l, numeros)
    if (falha) return setErro(falha)
    if (!motivo.trim()) return setErro('Diga para onde as peças foram.')
    setErro('')
    setGravando(true)
    try {
      await darBaixaDePecas(l.id, numeros, motivo)
      avisar(pecas(total) + ' de ' + l.nome + ' saíram do depósito.', 'ok')
      aoDar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui dar baixa.')
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Dar baixa no depósito"
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="forte" disabled={gravando} carregando={gravando} onClick={() => void dar()}>
            <ArrowLineDown size={16} weight="bold" />
            Tirar {total ? pecas(total) : 'as peças'}
          </Botao>
        </>
      }
    >
      <div className="pilha pd-dp-form">
        {inicial ? (
          <p className="pd-dp-qual">
            <b>{inicial.nome}</b> · {inicial.cor || 'sem cor'} · {textoDaOrigem(inicial)}
          </p>
        ) : (
          <Campo rotulo="Lote">
            <Seletor
              campo
              bloco
              valor={loteId}
              vazio="Escolher o lote"
              opcoes={vivos.map((x) => ({ valor: x.id, rotulo: `${x.nome} · ${x.cor || 'sem cor'} · ${textoDaOrigem(x)} · ${pecas(totalDoLote(x))}` }))}
              aoEscolher={(v) => {
                setLoteId(v)
                setSai({})
              }}
            />
          </Campo>
        )}
        {l ? (
          <Campo rotulo={'Quantas saem' + (total ? ' · ' + pecas(total) : '')}>
            <div className="pd-dp-grade">
              {Object.entries(l.grade)
                .filter(([, n]) => n > 0)
                .map(([t, n]) => (
                  <label key={t} className="pd-dp-cel">
                    <span>
                      {t} <small>de {n}</small>
                    </span>
                    <Entrada
                      inputMode="numeric"
                      aria-label={'Saem no tamanho ' + t}
                      value={sai[t] ?? ''}
                      onChange={(e) => setSai({ ...sai, [t]: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    />
                  </label>
                ))}
            </div>
          </Campo>
        ) : null}
        <Campo rotulo="Para onde foram">
          <Entrada value={motivo} maxLength={200} placeholder="Ex.: vendida no balcão" onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <div className="fileira miuda">
          {MOTIVOS.map((m) => (
            <Chip key={m} tamanho="sm" ligado={motivo === m} onClick={() => setMotivo(m)}>
              {m}
            </Chip>
          ))}
        </div>
        {erro ? (
          <p className="pd-dp-erro" role="alert">
            <Warning size={16} weight="bold" /> {erro}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

/* --- mudar o lugar ------------------------------------------------------------ */
function MudarLugar({ lote, aoFechar, aoMudar }: { lote: LoteDePecas | null; aoFechar: () => void; aoMudar: () => void }) {
  const [onde, setOnde] = useState('')
  const [gravando, setGravando] = useState(false)
  useEffect(() => {
    setOnde(lote?.onde ?? '')
    setGravando(false)
  }, [lote])
  async function gravar() {
    if (!lote) return
    setGravando(true)
    try {
      await mudarLugarDoLote(lote.id, onde)
      avisar(onde.trim() ? 'O lote agora fica em ' + onde.trim() + '.' : 'O lote ficou sem lugar.', 'ok')
      aoMudar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui mudar o lugar.', 'warn')
      setGravando(false)
    }
  }
  return (
    <Modal
      aberto={!!lote}
      aoFechar={aoFechar}
      titulo="Onde fica este lote"
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="forte" disabled={gravando} carregando={gravando} onClick={() => void gravar()}>
            Gravar o lugar
          </Botao>
        </>
      }
    >
      <div className="pilha pd-dp-form">
        <p className="pd-dp-qual">
          <b>{lote?.nome}</b> · {lote?.cor || 'sem cor'} · {lote ? pecas(totalDoLote(lote)) : ''}
        </p>
        <Campo rotulo="Onde fica" dica="Prateleira e nível, como está marcado no depósito">
          <Entrada value={onde} maxLength={60} placeholder="Ex.: P2 · B3" autoFocus onChange={(e) => setOnde(e.target.value)} />
        </Campo>
      </div>
    </Modal>
  )
}
