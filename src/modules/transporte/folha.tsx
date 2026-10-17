import { lerNumero } from '@shared'
import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import {
  AreaTexto,
  Botao,
  Campo,
  CampoDeData,
  Entrada,
  Gaveta,
  Marcacao,
  Segmentado,
  Seletor,
  avisar,
  useRascunho,
} from '@ds'
import { fornecedoresParaOEstoque } from '@dominio/fornecedor'
import {
  FORMA_DE_COSTUME,
  FORMAS,
  MEIOS,
  MOTIVOS,
  NOME_DA_FORMA,
  NOME_DO_MEIO,
  PAGO_NA_HORA,
  lancarTransporte,
  pedidosParaOTransporte,
  type Forma,
  type Lancamento,
  type Meio,
  type Motivo,
  type PedidoDaEntrega,
  type QuemPaga,
  type Transportador,
} from '@dominio/transporte'
import { chaveDoDia, diaEMes, dinheiro } from './apoio'

/* ==========================================================================
   A folha de lançar transporte.

   A ordem dos campos é a ordem em que a pessoa sabe as coisas: como foi,
   quem levou, para quê, quanto, quem pagou e como.

   O TIPO JÁ ARRUMA O RESTO. Escolher Uber deixa o cartão marcado e a corrida
   como paga, porque Uber se paga na hora. Escolher Motoboy deixa a corrida
   em aberto, para acertar depois. Tudo pode ser mudado à mão.

   DOIS FRETES NUM LANÇAMENTO (079, respostas de 14/10/2026). O FRETE DO
   ENVIO é o da empresa que leva (Correios, Latam, a transportadora), com
   quem pagou: a Fourtime ou o cliente. O FRETE DE COLETA, que é opcional, é
   quem levou até o ponto de despacho: o motoboy que deixa as caixas nos
   Correios. Cada um com o seu valor e o seu pago.

   VÁRIOS PEDIDOS POR ENTREGA, com o "+": cada um mostra número, cliente e a
   data de entrega combinada.

   O QUE NÃO FOI LANÇADO FICA GUARDADO NO NAVEGADOR (Kit de Comportamento,
   item 11): fechar a folha sem querer não perde nada. Cancelar descarta.
   ========================================================================== */

export type InicioDoLancamento = {
  editar?: Lancamento
  meio?: Meio
  transportadorId?: string
  motivo?: Motivo
}

const NOME_CURTO_DO_MOTIVO: Record<Motivo, string> = { entrega: 'Entrega', busca: 'Busca', outro: 'Outro' }

type Form = {
  meio: Meio
  quemId: string
  motivo: Motivo
  pedidos: string[]
  fornecedor: string
  destino: string
  dia: string
  valor: string
  forma: Forma
  pago: boolean
  fretePagoPor: QuemPaga
  observacao: string
  coleta: { quemId: string; valor: string; forma: Forma; pago: boolean } | null
}

const lerValor = (v: string) => {
  const n = lerNumero(v)
  return n != null && Number.isFinite(n) ? n : null
}
const escreverValor = (n: number) => String(n).replace('.', ',')

function formDe(inicio: InicioDoLancamento, transportadores: Transportador[], hoje: Date): Form {
  const e = inicio.editar
  const m = e?.meio ?? inicio.meio ?? 'motoboy'
  const candidatos = transportadores.filter((t) => t.meio === m)
  return {
    meio: m,
    quemId: e?.transportadorId ?? inicio.transportadorId ?? (candidatos.length === 1 ? candidatos[0].id : ''),
    motivo: e?.motivo ?? inicio.motivo ?? 'entrega',
    pedidos: e?.pedidos.length ? e.pedidos.map((p) => p.numero) : e?.pedido ? [e.pedido] : [''],
    fornecedor: e?.fornecedorId ?? '',
    destino: e?.destino ?? '',
    dia: e ? chaveDoDia(e.quando) : chaveDoDia(hoje.toISOString()),
    valor: e ? (e.fretePagoPor === 'cliente' && !e.valor ? '' : escreverValor(e.valor)) : '',
    forma: e?.forma ?? FORMA_DE_COSTUME[m],
    pago: e?.pago ?? PAGO_NA_HORA[m],
    fretePagoPor: e?.fretePagoPor ?? 'fourtime',
    observacao: e?.observacao ?? '',
    coleta: e?.coleta
      ? {
          quemId: e.coleta.transportadorId,
          valor: escreverValor(e.coleta.valor),
          forma: e.coleta.forma,
          pago: e.coleta.pago,
        }
      : null,
  }
}

export function FolhaDeLancamento({
  inicio,
  transportadores,
  hoje,
  aoFechar,
  aoLancado,
}: {
  inicio: InicioDoLancamento | null
  transportadores: Transportador[]
  hoje: Date
  aoFechar: () => void
  aoLancado: () => Promise<void>
}) {
  const [base, setBase] = useState<Form | null>(null)
  const [f, setF] = useState<Form | null>(null)
  const [gravando, setGravando] = useState(false)

  const [pedidos, setPedidos] = useState<PedidoDaEntrega[]>([])
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([])

  const mudar = (parte: Partial<Form>) => setF((x) => (x ? { ...x, ...parte } : x))

  /* a folha se arruma toda vez que abre */
  useEffect(() => {
    if (!inicio) {
      setBase(null)
      setF(null)
      return
    }
    const novo = formDe(inicio, transportadores, hoje)
    setBase(novo)
    setF(novo)
    /* as duas listas são apoio: nenhuma das duas falha para fora */
    void pedidosParaOTransporte().then(setPedidos)
    void fornecedoresParaOEstoque().then((r) =>
      setFornecedores(r.fornecedores.map((x) => ({ id: x.id, nome: x.nome }))),
    )
  }, [inicio, transportadores, hoje])

  const sujo = !!f && !!base && JSON.stringify(f) !== JSON.stringify(base)
  const rascunho = useRascunho<Form | null>({
    chave: 'transporte:' + (inicio?.editar?.id ?? 'novo'),
    ligado: !!inicio && !!f,
    valor: f,
    sujo,
    base: inicio?.editar ?? null,
    aoVoltar: (r) => {
      if (r.valor) setF(r.valor)
    },
    aoDescartar: () => setF(base),
  })

  const doMeio = useMemo(() => (f ? transportadores.filter((t) => t.meio === f.meio) : []), [transportadores, f])
  /* a coleta é quem leva até o despacho: motoboy, Uber e táxi primeiro */
  const daColeta = useMemo(
    () =>
      [...transportadores].sort(
        (a, b) => MEIOS.indexOf(a.meio) - MEIOS.indexOf(b.meio) || a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    [transportadores],
  )

  if (!f) {
    return (
      <Gaveta aberto={false} aoFechar={aoFechar} titulo="Lançar transporte">
        {null}
      </Gaveta>
    )
  }

  function trocarMeio(m: Meio) {
    const candidatos = transportadores.filter((t) => t.meio === m)
    mudar({
      meio: m,
      quemId: candidatos.length === 1 ? candidatos[0].id : '',
      forma: FORMA_DE_COSTUME[m],
      pago: PAGO_NA_HORA[m],
    })
  }

  const numero = lerValor(f.valor)
  const doCliente = f.motivo === 'entrega' && f.fretePagoPor === 'cliente'
  const valorOk = doCliente ? numero === null || numero >= 0 : numero !== null && numero > 0
  const coletaNumero = f.coleta ? lerValor(f.coleta.valor) : null
  const coletaOk = !f.coleta || f.motivo !== 'entrega' || (!!f.coleta.quemId && coletaNumero !== null && coletaNumero > 0)
  const valido = !!f.quemId && valorOk && !!f.dia && coletaOk

  function fechar() {
    /* fechar sem querer guarda o rascunho; quem descarta é o Cancelar */
    aoFechar()
  }
  function cancelar() {
    rascunho.limpar()
    aoFechar()
  }

  async function gravar() {
    if (!f || !valido) return
    setGravando(true)
    try {
      const agora = new Date()
      const editando = inicio?.editar
      /* a hora é a de agora quando o dia é hoje; lançamento de outro dia vai ao meio-dia */
      const quando =
        editando && chaveDoDia(editando.quando) === f.dia
          ? editando.quando
          : f.dia === chaveDoDia(agora.toISOString())
            ? agora.toISOString()
            : new Date(`${f.dia}T12:00:00`).toISOString()
      const entrega = f.motivo === 'entrega'
      await lancarTransporte({
        id: editando?.id,
        quando,
        transportadorId: f.quemId,
        motivo: f.motivo,
        pedidos: entrega ? f.pedidos.filter(Boolean) : [],
        fornecedorId: f.motivo === 'busca' ? f.fornecedor : '',
        destino: f.destino.trim(),
        valor: numero ?? 0,
        forma: f.forma,
        pago: f.pago,
        observacao: f.observacao.trim(),
        fretePagoPor: entrega ? f.fretePagoPor : 'fourtime',
        coleta:
          entrega && f.coleta && coletaNumero
            ? { transportadorId: f.coleta.quemId, valor: coletaNumero, forma: f.coleta.forma, pago: f.coleta.pago }
            : null,
      })
      rascunho.limpar()
      const total = (doCliente ? 0 : numero ?? 0) + (entrega && f.coleta ? coletaNumero ?? 0 : 0)
      avisar(editando ? 'Lançamento corrigido.' : `Transporte de ${dinheiro(total)} lançado.`, 'ok')
      await aoLancado()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui lançar.', 'brand')
    } finally {
      setGravando(false)
    }
  }

  const editando = !!inicio?.editar
  const total = (doCliente ? 0 : numero ?? 0) + (f.motivo === 'entrega' && f.coleta ? coletaNumero ?? 0 : 0)

  /* os pedidos já escolhidos não aparecem de novo nas outras linhas */
  const opcoesDoPedido = (atual: string) =>
    pedidos
      .filter((p) => p.numero === atual || !f.pedidos.includes(p.numero))
      .map((p) => ({
        valor: p.numero,
        rotulo: [p.numero, p.cliente, p.entrega ? `entrega ${diaEMes(p.entrega + 'T12:00:00')}` : '']
          .filter(Boolean)
          .join(' · '),
      }))

  return (
    <Gaveta
      aberto={!!inicio}
      aoFechar={fechar}
      titulo={editando ? 'Editar lançamento' : 'Lançar transporte'}
      pe={
        <>
          <Botao onClick={cancelar}>Cancelar</Botao>
          <Botao tom="primario" onClick={gravar} disabled={!valido || gravando} carregando={gravando}>
            {gravando
              ? 'Gravando'
              : editando
                ? 'Salvar'
                : total > 0
                  ? `Lançar ${dinheiro(total)}`
                  : 'Lançar transporte'}
          </Botao>
        </>
      }
    >
      <div className="pilha solta">
        <div className="tp-folha-titulo">Frete do envio</div>

        <div className="tp-dois-iguais">
          <Campo rotulo="Tipo">
            <Seletor
              campo
              bloco
              valor={f.meio}
              opcoes={MEIOS.map((m) => ({ valor: m, rotulo: NOME_DO_MEIO[m] }))}
              aoEscolher={(v) => trocarMeio((v || 'motoboy') as Meio)}
              vazio="Escolha o tipo"
            />
          </Campo>
          <Campo
            rotulo="Empresa ou quem levou"
            dica={
              doMeio.length === 0
                ? `Nenhum cadastro de ${NOME_DO_MEIO[f.meio].toLowerCase()} ainda. Cadastre em Quem transporta.`
                : undefined
            }
          >
            <Seletor
              campo
              bloco
              comBusca={doMeio.length > 6}
              valor={f.quemId}
              opcoes={doMeio.map((t) => ({ valor: t.id, rotulo: t.nome }))}
              aoEscolher={(v) => mudar({ quemId: v })}
              vazio={f.meio === 'motoboy' ? 'Escolha o motoboy' : 'Escolha'}
            />
          </Campo>
        </div>

        <Campo rotulo="Para quê">
          <Segmentado
            className="tp-seg-cheio"
            valor={f.motivo}
            aoMudar={(m) => mudar({ motivo: m })}
            opcoes={MOTIVOS.map((m) => ({ valor: m, rotulo: NOME_CURTO_DO_MOTIVO[m] }))}
          />
        </Campo>

        {f.motivo === 'entrega' ? (
          <Campo rotulo={f.pedidos.length > 1 ? 'Pedidos' : 'Pedido'} dica="O gasto entra na conta do pedido no relatório.">
            <div className="pilha">
              {f.pedidos.map((num, i) => (
                <div key={i} className="tp-pedido-linha">
                  <Seletor
                    campo
                    bloco
                    comBusca
                    valor={num}
                    opcoes={opcoesDoPedido(num)}
                    aoEscolher={(v) => mudar({ pedidos: f.pedidos.map((x, j) => (j === i ? v : x)) })}
                    vazio="Sem pedido"
                  />
                  {f.pedidos.length > 1 ? (
                    <button
                      type="button"
                      className="tp-tirar"
                      aria-label={`Tirar ${num || 'esta linha'}`}
                      onClick={() => mudar({ pedidos: f.pedidos.filter((_, j) => j !== i) })}
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
              ))}
              <span className="fileira">
                <Botao
                  tamanho="sm"
                  disabled={!f.pedidos[f.pedidos.length - 1]}
                  onClick={() => mudar({ pedidos: [...f.pedidos, ''] })}
                >
                  <Plus size={14} weight="bold" />
                  Outro pedido na mesma entrega
                </Botao>
              </span>
            </div>
          </Campo>
        ) : f.motivo === 'busca' ? (
          <Campo rotulo="De qual fornecedor" dica="Quem vendeu o material que foi buscado.">
            <Seletor
              campo
              bloco
              comBusca
              valor={f.fornecedor}
              opcoes={fornecedores.map((x) => ({ valor: x.id, rotulo: x.nome }))}
              aoEscolher={(v) => mudar({ fornecedor: v })}
              vazio="Sem fornecedor"
            />
          </Campo>
        ) : null}

        <Campo rotulo={f.motivo === 'busca' ? 'De onde veio' : 'Para onde foi'}>
          <Entrada
            value={f.destino}
            onChange={(e) => mudar({ destino: e.currentTarget.value })}
            placeholder="Setor Bueno, Goiânia"
          />
        </Campo>

        {f.motivo === 'entrega' ? (
          <Campo rotulo="Quem pagou o frete">
            <Segmentado
              className="tp-seg-cheio"
              valor={f.fretePagoPor}
              aoMudar={(v) => mudar({ fretePagoPor: v })}
              opcoes={[
                { valor: 'fourtime', rotulo: 'Fourtime' },
                { valor: 'cliente', rotulo: 'Cliente' },
              ]}
            />
          </Campo>
        ) : null}

        <div className="tp-dois-campos">
          <Campo rotulo="Dia">
            <CampoDeData bloco valor={f.dia} aoMudar={(v) => mudar({ dia: v })} />
          </Campo>
          <Campo
            rotulo={doCliente ? 'Valor, se souber' : 'Valor, em reais'}
            erro={f.valor.trim() !== '' && !valorOk}
          >
            <Entrada
              inputMode="decimal"
              value={f.valor}
              onChange={(e) => mudar({ valor: e.currentTarget.value })}
              placeholder="0,00"
              aria-label="Valor do envio"
            />
          </Campo>
        </div>

        {doCliente ? (
          <p className="tp-ajuda">Fica registrado no lançamento, mas não entra no gasto da Fourtime nem em A pagar.</p>
        ) : (
          <div className="pilha">
            <Campo rotulo="Como foi pago">
              <Segmentado
                className="tp-seg-cheio"
                valor={f.forma}
                aoMudar={(v) => mudar({ forma: v })}
                opcoes={FORMAS.map((x) => ({ valor: x, rotulo: NOME_DA_FORMA[x] }))}
              />
            </Campo>
            <Marcacao checked={f.pago} onChange={(e) => mudar({ pago: e.currentTarget.checked })}>
              Já está pago
            </Marcacao>
            <p className="tp-ajuda">
              {f.pago
                ? 'Entra no gasto do mês e não aparece em A pagar.'
                : 'Fica em A pagar até alguém acertar. É o caso do motoboy que recebe no fim da semana e do boleto da transportadora.'}
            </p>
          </div>
        )}

        {f.motivo === 'entrega' ? (
          f.coleta ? (
            <div className="pilha tp-coleta">
              <div className="tp-folha-titulo fileira entre">
                <span>Frete de coleta</span>
                <Botao tamanho="sm" onClick={() => mudar({ coleta: null })}>
                  Tirar a coleta
                </Botao>
              </div>
              <p className="tp-ajuda">Quem levou até o ponto de despacho, como o motoboy que deixa as caixas nos Correios.</p>
              <div className="tp-dois-campos">
                <Campo rotulo="Quem levou">
                  <Seletor
                    campo
                    bloco
                    comBusca={daColeta.length > 6}
                    valor={f.coleta.quemId}
                    opcoes={daColeta.map((t) => ({ valor: t.id, rotulo: `${t.nome} · ${NOME_DO_MEIO[t.meio]}` }))}
                    aoEscolher={(v) => {
                      const t = transportadores.find((x) => x.id === v)
                      mudar({
                        coleta: f.coleta && {
                          ...f.coleta,
                          quemId: v,
                          ...(t ? { forma: FORMA_DE_COSTUME[t.meio], pago: PAGO_NA_HORA[t.meio] } : {}),
                        },
                      })
                    }}
                    vazio="Escolha"
                  />
                </Campo>
                <Campo
                  rotulo="Valor"
                  erro={f.coleta.valor.trim() !== '' && (coletaNumero === null || coletaNumero <= 0)}
                >
                  <Entrada
                    inputMode="decimal"
                    value={f.coleta.valor}
                    onChange={(e) => mudar({ coleta: f.coleta && { ...f.coleta, valor: e.currentTarget.value } })}
                    placeholder="0,00"
                    aria-label="Valor da coleta"
                  />
                </Campo>
              </div>
              <Segmentado
                className="tp-seg-cheio"
                valor={f.coleta.forma}
                aoMudar={(v) => mudar({ coleta: f.coleta && { ...f.coleta, forma: v } })}
                opcoes={FORMAS.map((x) => ({ valor: x, rotulo: NOME_DA_FORMA[x] }))}
              />
              <Marcacao
                checked={f.coleta.pago}
                onChange={(e) => mudar({ coleta: f.coleta && { ...f.coleta, pago: e.currentTarget.checked } })}
              >
                A coleta já está paga
              </Marcacao>
            </div>
          ) : (
            <span className="fileira">
              <Botao
                tamanho="sm"
                onClick={() => {
                  const moto = transportadores.filter((t) => t.meio === 'motoboy')
                  mudar({
                    coleta: { quemId: moto.length === 1 ? moto[0].id : '', valor: '', forma: 'pix', pago: false },
                  })
                }}
              >
                <Plus size={14} weight="bold" />
                Frete de coleta
              </Botao>
            </span>
          )
        ) : null}

        <Campo rotulo="Observação">
          <AreaTexto
            rows={2}
            value={f.observacao}
            onChange={(e) => mudar({ observacao: e.currentTarget.value })}
            placeholder="O número da nota ou do recibo, por exemplo"
          />
        </Campo>
      </div>
    </Gaveta>
  )
}
