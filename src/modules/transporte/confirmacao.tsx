import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CaretRight, Check, LockSimple, Paperclip, WhatsappLogo, X } from '@phosphor-icons/react'
import {
  AreaTexto,
  Botao,
  Campo,
  Entrada,
  Gaveta,
  Segmentado,
  Vazio,
  avisar,
  useRascunho,
} from '@ds'
import {
  NOME_DE_QUEM_PAGA,
  PASSOS_DO_FRETE,
  PROXIMO_PASSO,
  aConfirmar,
  abrirComprovante,
  anexarComprovante,
  andarOFrete,
  nomeDoEnvio,
  salvarFrete,
  situacaoDoFrete,
  type FreteDoPedido,
  type PassoDoFrete,
  type QuemPagaOFrete,
} from '@dominio/transporte'
import { diaEMes, dinheiro, plural, quandoFoi } from './apoio'

/* ==========================================================================
   A aba CONFIRMAÇÃO DO FRETE (080, wireframe aprovado em 14/10/2026).

   Uma linha por pedido que ainda vai sair, agrupada pela data de entrega
   combinada. A logística fala com o cliente, recebe o comprovante do frete
   pago antes e passa ao financeiro: três passos, cada um com quem e quando.
   O pedido escolhido abre ao lado (no celular, numa folha), com o valor pago,
   o comprovante e o botão do próximo passo.
   ========================================================================== */

const TOM: Record<'ok' | 'warn' | 'info' | 'mudo', string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  info: 'var(--info)',
  mudo: 'var(--text-3)',
}

export function SituacaoDoFrete({ f }: { f: FreteDoPedido }) {
  const s = situacaoDoFrete(f)
  return (
    <span className="tp-situacao" style={{ '--c': TOM[s.tom] } as CSSProperties}>
      <i />
      {s.texto}
    </span>
  )
}

export function PassosDoFrete({ passo }: { passo: PassoDoFrete }) {
  return (
    <span className="tp-passos" aria-label={`Passo ${passo} de 3`}>
      {PASSOS_DO_FRETE.map((t, i) => (
        <Fragment key={t}>
          {i ? <span className="tp-passo-liga" aria-hidden="true" /> : null}
          <span className={i < passo ? 'tp-passo feito' : i === passo ? 'tp-passo agora' : 'tp-passo'}>
            {i < passo ? <Check size={12} weight="bold" /> : null}
            {t}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

/** "Hoje, quarta 14 de outubro" a partir de AAAA-MM-DD; sem data, "Sem data de entrega". */
function diaDaEntrega(iso: string | null, hoje: Date): string {
  if (!iso) return 'Sem data de entrega'
  const d = new Date(iso + 'T12:00:00')
  const meio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((meio(d) - meio(hoje)) / 86400000)
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '')
  const resto = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  if (dias === 0) return `Hoje, ${semana} ${resto}`
  if (dias === 1) return `Amanhã, ${semana} ${resto}`
  if (dias < 0) return `Atrasado, ${resto}`
  return `${semana[0].toUpperCase()}${semana.slice(1)}, ${resto}`
}

export function ConfirmacaoDoFrete({
  fretes,
  todos,
  hoje,
  podeEditar,
  larga,
  estreita,
  aoMudar,
  aoConversar,
}: {
  /** os fretes já filtrados pela barra */
  fretes: FreteDoPedido[]
  /** todos, para o resumo */
  todos: FreteDoPedido[]
  hoje: Date
  podeEditar: boolean
  larga: boolean
  estreita: boolean
  aoMudar: () => Promise<void>
  aoConversar: (f: FreteDoPedido) => void
}) {
  const [aberto, setAberto] = useState('')
  const escolhido = todos.find((f) => f.pedidoId === aberto) ?? null
  const noLado = larga && !!escolhido

  /* uma faixa por data de entrega, na ordem que a lista já vem */
  const dias = useMemo(() => {
    const mapa = new Map<string, FreteDoPedido[]>()
    fretes.forEach((f) => {
      const k = f.entregaEm ?? ''
      mapa.set(k, [...(mapa.get(k) ?? []), f])
    })
    return [...mapa.entries()]
  }, [fretes])

  const faltam = todos.filter(aConfirmar)
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const urgentes = faltam.filter((f) => f.entregaEm && f.entregaEm <= hojeIso)

  const ficha = escolhido ? (
    <FichaDoFrete
      key={escolhido.pedidoId}
      f={escolhido}
      hoje={hoje}
      podeEditar={podeEditar}
      naFolha={!larga}
      aoFechar={() => setAberto('')}
      aoMudar={aoMudar}
      aoConversar={() => aoConversar(escolhido)}
    />
  ) : null

  return (
    <div className="tp-duas">
      <section className="cartao tp-quadro">
        {todos.length === 0 ? (
          <Vazio
            titulo="Nenhum pedido para sair"
            texto="Os pedidos aprovados entram aqui, pela data de entrega, até serem enviados."
          />
        ) : fretes.length === 0 ? (
          <Vazio titulo="Nada neste filtro" texto="Nenhum pedido combina com o que está escolhido." />
        ) : estreita ? (
          <div className="tp-dias">
            {dias.map(([dia, doDia]) => (
              <Fragment key={dia || 'sem'}>
                <div className="tp-faixa">
                  <b>{diaDaEntrega(dia || null, hoje)}</b>
                  <span>{plural(doDia.length, 'pedido', 'pedidos')}</span>
                </div>
                {doDia.map((f) => (
                  <button key={f.pedidoId} type="button" className="tp-item" onClick={() => setAberto(f.pedidoId)}>
                    <span className="tp-nome">
                      <b>
                        {f.numero} · {f.cliente}
                      </b>
                      <small>{[nomeDoEnvio(f.envio), NOME_DE_QUEM_PAGA[f.quemPaga]].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="tp-item-fim">
                      <b>{f.valorCombinado != null ? dinheiro(f.valorCombinado) : ''}</b>
                      <SituacaoDoFrete f={f} />
                    </span>
                  </button>
                ))}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="tabela-rola">
            <table className="tabela tp-tabela">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th className="tp-some-medio">Envio</th>
                  <th>Quem paga o frete</th>
                  <th className="dir">Frete</th>
                  <th className="tp-some-medio">Confirmação</th>
                  <th>Situação</th>
                  <th className="tp-some-estreito" aria-label="Abrir" />
                </tr>
              </thead>
              <tbody>
                {dias.map(([dia, doDia]) => (
                  <Fragment key={dia || 'sem'}>
                    <tr className="grupo">
                      <td colSpan={7}>
                        <span className="tp-grupo">
                          <b>{diaDaEntrega(dia || null, hoje)}</b>
                          <span>{plural(doDia.length, 'pedido', 'pedidos')}</span>
                        </span>
                      </td>
                    </tr>
                    {doDia.map((f) => (
                      <tr
                        key={f.pedidoId}
                        className={f.pedidoId === aberto ? 'tp-linha marcada' : 'tp-linha'}
                        onClick={() => setAberto(f.pedidoId === aberto && noLado ? '' : f.pedidoId)}
                      >
                        <td>
                          <span className="tp-nome">
                            <b>{f.numero}</b>
                            <small>{f.cliente}</small>
                          </span>
                        </td>
                        <td className="tp-some-medio">{nomeDoEnvio(f.envio) || <span className="tp-falta">não escrito</span>}</td>
                        <td>
                          <span className={f.quemPaga === 'cliente' ? 'tp-paga cliente' : 'tp-paga'}>
                            {NOME_DE_QUEM_PAGA[f.quemPaga]}
                          </span>
                        </td>
                        <td className="dir tp-numero-forte">
                          {f.valorCombinado != null ? dinheiro(f.valorCombinado) : <span className="tp-falta">a combinar</span>}
                        </td>
                        <td className="tp-some-medio">
                          {f.quemPaga === 'cliente' ? <PassosDoFrete passo={f.passo} /> : <span className="tp-falta">não precisa</span>}
                        </td>
                        <td>
                          <SituacaoDoFrete f={f} />
                        </td>
                        <td className="tp-some-estreito">
                          <span className="tp-direita">
                            <CaretRight size={16} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="tp-lado">
        {noLado ? (
          ficha
        ) : (
          <section className="cartao tp-heroi">
            <span className={faltam.length ? 'tp-heroi-numero tp-alerta' : 'tp-heroi-numero'}>{faltam.length}</span>
            <div>
              <h2>{faltam.length === 1 ? 'frete do cliente a confirmar' : 'fretes do cliente a confirmar'}</h2>
              <p>
                {urgentes.length
                  ? `${plural(urgentes.length, 'entrega', 'entregas')} para hoje ou atrasada${urgentes.length === 1 ? '' : 's'} ainda sem confirmação.`
                  : faltam.length
                    ? 'Nenhum deles entrega hoje.'
                    : 'Tudo confirmado.'}
              </p>
            </div>
          </section>
        )}
      </div>

      <Gaveta
        aberto={!!escolhido && !larga}
        aoFechar={() => setAberto('')}
        titulo={escolhido ? `${escolhido.numero} · ${escolhido.cliente}` : ''}
      >
        <div className="tp-na-folha">{!larga ? ficha : null}</div>
      </Gaveta>
    </div>
  )
}

type Form = { quemPaga: QuemPagaOFrete; envio: string; combinado: string; pago: string; observacao: string }

const escrever = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))
const ler = (t: string): number | null | undefined => {
  if (!t.trim()) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function FichaDoFrete({
  f,
  hoje,
  podeEditar,
  naFolha,
  aoFechar,
  aoMudar,
  aoConversar,
}: {
  f: FreteDoPedido
  hoje: Date
  podeEditar: boolean
  naFolha: boolean
  aoFechar: () => void
  aoMudar: () => Promise<void>
  aoConversar: () => void
}) {
  const base = useMemo<Form>(
    () => ({
      quemPaga: f.quemPaga,
      envio: f.envio,
      combinado: escrever(f.valorCombinado),
      pago: escrever(f.valorPago),
      observacao: f.observacao,
    }),
    [f],
  )
  const [form, setForm] = useState<Form>(base)
  useEffect(() => setForm(base), [base])
  const [gravando, setGravando] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  const sujo = JSON.stringify(form) !== JSON.stringify(base)
  const rascunho = useRascunho<Form>({
    chave: 'frete:' + f.pedidoId,
    ligado: podeEditar,
    valor: form,
    sujo,
    base,
    aoVoltar: (r) => setForm(r.valor),
    aoDescartar: () => setForm(base),
  })

  const combinado = ler(form.combinado)
  const pago = ler(form.pago)
  const valido = combinado !== undefined && pago !== undefined
  const doCliente = form.quemPaga === 'cliente'
  const diferenca = doCliente && combinado != null && pago != null ? pago - combinado : 0

  async function salvar(): Promise<boolean> {
    if (!valido) return false
    try {
      await salvarFrete({
        pedidoId: f.pedidoId,
        quemPaga: form.quemPaga,
        envio: form.envio,
        valorCombinado: combinado ?? null,
        valorPago: pago ?? null,
        observacao: form.observacao,
      })
      rascunho.limpar()
      return true
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar o frete.', 'brand')
      return false
    }
  }

  async function andar(passo: PassoDoFrete) {
    setGravando(true)
    try {
      if (sujo && !(await salvar())) return
      await andarOFrete(f.pedidoId, passo)
      avisar(passo === 3 ? `Frete do ${f.numero} confirmado. O pedido pode sair.` : `${f.numero}: ${PASSOS_DO_FRETE[passo - 1] ?? 'passo'} anotado.`, 'ok')
      await aoMudar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui andar o passo.', 'brand')
    } finally {
      setGravando(false)
    }
  }

  async function gravar() {
    setGravando(true)
    try {
      if (await salvar()) {
        avisar(`Frete do ${f.numero} gravado.`, 'ok')
        await aoMudar()
      }
    } finally {
      setGravando(false)
    }
  }

  async function anexar(arq: File | undefined) {
    if (!arq) return
    setGravando(true)
    try {
      if (sujo && !(await salvar())) return
      await anexarComprovante(f.pedidoId, arq)
      avisar('Comprovante anexado. Conta como recebido.', 'ok')
      await aoMudar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui anexar o comprovante.', 'brand')
    } finally {
      setGravando(false)
      if (arquivo.current) arquivo.current.value = ''
    }
  }

  const passoDoProximo = (f.passo + 1) as PassoDoFrete
  const quemQuando = [
    f.pedidoEm ? `pedido ${quandoFoi(f.pedidoEm, hoje)}${f.pedidoPor ? ' por ' + f.pedidoPor : ''}` : '',
    f.recebidoEm ? `comprovante ${quandoFoi(f.recebidoEm, hoje)}${f.recebidoPor ? ' por ' + f.recebidoPor : ''}` : '',
    f.confirmadoEm ? `confirmado ${quandoFoi(f.confirmadoEm, hoje)}${f.confirmadoPor ? ' por ' + f.confirmadoPor : ''}` : '',
  ].filter(Boolean)

  const botoes = (
    <>
      {f.telefone ? (
        <Botao onClick={aoConversar}>
          <WhatsappLogo size={16} />
          Conversa
        </Botao>
      ) : null}
      {podeEditar && f.passo > 0 ? (
        <Botao disabled={gravando} onClick={() => void andar((f.passo - 1) as PassoDoFrete)}>
          Voltar um passo
        </Botao>
      ) : null}
      {podeEditar && sujo ? (
        <Botao className="tp-empurra" tom="primario" disabled={!valido || gravando} carregando={gravando} onClick={() => void gravar()}>
          Salvar
        </Botao>
      ) : podeEditar && doCliente && f.passo < 3 ? (
        <Botao
          className="tp-empurra"
          tom="primario"
          disabled={gravando}
          carregando={gravando}
          onClick={() => void andar(passoDoProximo)}
        >
          {PROXIMO_PASSO[f.passo as 0 | 1 | 2]}
        </Botao>
      ) : null}
    </>
  )

  return (
    <section className={naFolha ? 'tp-ficha-frete' : 'cartao tp-ficha tp-ficha-frete'}>
      {naFolha ? null : (
        <div className="tp-ficha-topo">
          <div>
            <SituacaoDoFrete f={f} />
            <h2>
              {f.numero} · {f.cliente}
            </h2>
            <p>
              {[
                f.entregaEm ? `Entrega ${diaEMes(f.entregaEm + 'T12:00:00')}` : 'Sem data de entrega',
                nomeDoEnvio(f.envio),
                f.estado === 'pronto' ? 'PRONTO' : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button type="button" className="tp-fechar" aria-label="Fechar" onClick={aoFechar}>
            <X size={18} />
          </button>
        </div>
      )}
      <div className="tp-ficha-corpo pilha solta">
        <Campo rotulo="Quem paga o frete">
          <Segmentado
            className="tp-seg-cheio"
            valor={form.quemPaga}
            aoMudar={(v) => podeEditar && setForm({ ...form, quemPaga: v })}
            opcoes={[
              { valor: 'cliente', rotulo: 'Cliente' },
              { valor: 'fourtime', rotulo: 'Fourtime' },
              { valor: 'sem_frete', rotulo: 'Sem frete' },
            ]}
          />
        </Campo>
        <Campo rotulo="Envio" dica="Como vai: Correios SEDEX, Jadlog, motoboy. Vem da cotação.">
          <Entrada
            value={form.envio}
            readOnly={!podeEditar}
            onChange={(e) => setForm({ ...form, envio: e.currentTarget.value })}
            placeholder="Correios SEDEX"
          />
        </Campo>
        {form.quemPaga !== 'sem_frete' ? (
          <div className="tp-dois-iguais">
            <Campo rotulo="Frete combinado" erro={combinado === undefined}>
              <Entrada
                inputMode="decimal"
                value={form.combinado}
                readOnly={!podeEditar}
                onChange={(e) => setForm({ ...form, combinado: e.currentTarget.value })}
                placeholder="0,00"
                aria-label="Frete combinado"
              />
            </Campo>
            {doCliente ? (
              <Campo rotulo="Valor que o cliente pagou" erro={pago === undefined}>
                <Entrada
                  inputMode="decimal"
                  value={form.pago}
                  readOnly={!podeEditar}
                  onChange={(e) => setForm({ ...form, pago: e.currentTarget.value })}
                  placeholder="0,00"
                  aria-label="Valor que o cliente pagou"
                />
              </Campo>
            ) : null}
          </div>
        ) : null}
        {diferenca ? (
          <p className="tp-ajuda">
            {diferenca < 0
              ? `O cliente pagou ${dinheiro(-diferenca)} a menos que o combinado.`
              : `O cliente pagou ${dinheiro(diferenca)} a mais que o combinado.`}
          </p>
        ) : null}

        {doCliente ? (
          <>
            <div className="tp-comprovante">
              <Paperclip size={18} />
              {f.comprovante ? (
                <button
                  type="button"
                  className="tp-link"
                  onClick={() =>
                    void abrirComprovante(f.comprovante!).catch((e: unknown) =>
                      avisar(e instanceof Error ? e.message : 'Não consegui abrir.', 'brand'),
                    )
                  }
                >
                  {f.comprovanteNome || 'comprovante'}
                </button>
              ) : (
                <span className="tp-falta">Sem comprovante</span>
              )}
              {podeEditar ? (
                <>
                  <input
                    ref={arquivo}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    hidden
                    aria-label="Arquivo do comprovante"
                    onChange={(e) => void anexar(e.currentTarget.files?.[0])}
                  />
                  <Botao tamanho="sm" className="tp-empurra" disabled={gravando} onClick={() => arquivo.current?.click()}>
                    {f.comprovante ? 'Trocar' : 'Anexar'}
                  </Botao>
                </>
              ) : null}
            </div>
            <div className="pilha">
              <span className="tp-folha-titulo">Passos</span>
              <PassosDoFrete passo={f.passo} />
              {quemQuando.length ? <p className="tp-ajuda">{quemQuando.join(', ')}.</p> : null}
            </div>
            {f.passo < 3 ? (
              <div className="tp-trava">
                <LockSimple size={18} />
                <span>
                  <b>Não sai para envio até o financeiro confirmar.</b> O pedido pode ficar PRONTO, mas não passa a
                  ENVIADO enquanto este frete não estiver confirmado.
                </span>
              </div>
            ) : null}
          </>
        ) : null}

        <Campo rotulo="Observação">
          <AreaTexto
            rows={2}
            value={form.observacao}
            readOnly={!podeEditar}
            onChange={(e) => setForm({ ...form, observacao: e.currentTarget.value })}
            placeholder="Combinado por telefone, desconto no frete, o que for"
          />
        </Campo>
      </div>
      <div className={naFolha ? 'tp-ficha-pe tp-pe-da-folha' : 'tp-ficha-pe'}>{botoes}</div>
    </section>
  )
}
