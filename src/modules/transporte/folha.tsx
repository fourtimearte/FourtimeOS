import { useEffect, useMemo, useState } from 'react'
import { AreaTexto, Botao, Campo, CampoDeData, Entrada, Gaveta, Marcacao, Segmentado, Seletor, avisar } from '@ds'
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
  type Transportador,
} from '@dominio/transporte'
import { chaveDoDia, dinheiro } from './apoio'

/* ==========================================================================
   A folha de lançar transporte.

   Uma corrida, um lançamento. A ordem dos campos é a ordem em que a pessoa
   sabe as coisas: como foi, quem levou, para quê, quanto, e como pagou.

   O MEIO JÁ ARRUMA O RESTO. Escolher Uber deixa o cartão marcado e a corrida
   como paga, porque Uber se paga na hora. Escolher Motoboy deixa a corrida
   em aberto, para acertar depois. Tudo pode ser mudado à mão.
   ========================================================================== */

export type InicioDoLancamento = {
  editar?: Lancamento
  meio?: Meio
  transportadorId?: string
  motivo?: Motivo
}

const NOME_CURTO_DO_MOTIVO: Record<Motivo, string> = { entrega: 'Entrega', busca: 'Busca', outro: 'Outro' }

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
  const [meio, setMeio] = useState<Meio>('motoboy')
  const [quemId, setQuemId] = useState('')
  const [motivo, setMotivo] = useState<Motivo>('entrega')
  const [pedido, setPedido] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [destino, setDestino] = useState('')
  const [dia, setDia] = useState('')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState<Forma>('pix')
  const [pago, setPago] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [gravando, setGravando] = useState(false)

  const [pedidos, setPedidos] = useState<{ numero: string; cliente: string }[]>([])
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([])

  const doMeio = useMemo(() => transportadores.filter((t) => t.meio === meio), [transportadores, meio])

  /* a folha se arruma toda vez que abre */
  useEffect(() => {
    if (!inicio) return
    const e = inicio.editar
    const m = e?.meio ?? inicio.meio ?? 'motoboy'
    const candidatos = transportadores.filter((t) => t.meio === m)
    setMeio(m)
    setQuemId(e?.transportadorId ?? inicio.transportadorId ?? (candidatos.length === 1 ? candidatos[0].id : ''))
    setMotivo(e?.motivo ?? inicio.motivo ?? 'entrega')
    setPedido(e?.pedido ?? '')
    setFornecedor(e?.fornecedorId ?? '')
    setDestino(e?.destino ?? '')
    setDia(e ? chaveDoDia(e.quando) : chaveDoDia(hoje.toISOString()))
    setValor(e ? String(e.valor).replace('.', ',') : '')
    setForma(e?.forma ?? FORMA_DE_COSTUME[m])
    setPago(e?.pago ?? PAGO_NA_HORA[m])
    setObservacao(e?.observacao ?? '')
    /* as duas listas são apoio: nenhuma das duas falha para fora */
    void pedidosParaOTransporte().then(setPedidos)
    void fornecedoresParaOEstoque().then((r) =>
      setFornecedores(r.fornecedores.map((f) => ({ id: f.id, nome: f.nome }))),
    )
  }, [inicio, transportadores, hoje])

  function trocarMeio(m: Meio) {
    const candidatos = transportadores.filter((t) => t.meio === m)
    setMeio(m)
    setQuemId(candidatos.length === 1 ? candidatos[0].id : '')
    setForma(FORMA_DE_COSTUME[m])
    setPago(PAGO_NA_HORA[m])
  }

  const numero = (() => {
    const n = Number(valor.replace(/\./g, '').replace(',', '.'))
    return valor.trim() !== '' && Number.isFinite(n) ? n : null
  })()
  const valido = !!quemId && numero !== null && numero > 0 && !!dia

  async function gravar() {
    if (!valido || numero === null) return
    setGravando(true)
    try {
      const agora = new Date()
      const editando = inicio?.editar
      /* a hora é a de agora quando o dia é hoje; lançamento de outro dia vai ao meio-dia */
      const quando = editando && chaveDoDia(editando.quando) === dia
        ? editando.quando
        : dia === chaveDoDia(agora.toISOString())
          ? agora.toISOString()
          : new Date(`${dia}T12:00:00`).toISOString()
      await lancarTransporte({
        id: editando?.id,
        quando,
        transportadorId: quemId,
        motivo,
        pedido: motivo === 'entrega' ? pedido : '',
        fornecedorId: motivo === 'busca' ? fornecedor : '',
        destino: destino.trim(),
        valor: numero,
        forma,
        pago,
        observacao: observacao.trim(),
      })
      avisar(editando ? 'Lançamento corrigido.' : `Transporte de ${dinheiro(numero)} lançado.`, 'ok')
      await aoLancado()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui lançar.', 'brand')
    } finally {
      setGravando(false)
    }
  }

  const editando = !!inicio?.editar

  return (
    <Gaveta
      aberto={!!inicio}
      aoFechar={aoFechar}
      titulo={editando ? 'Editar lançamento' : 'Lançar transporte'}
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="primario" onClick={gravar} disabled={!valido || gravando} carregando={gravando}>
            {gravando
              ? 'Gravando'
              : editando
                ? 'Salvar'
                : numero && numero > 0
                  ? `Lançar ${dinheiro(numero)}`
                  : 'Lançar transporte'}
          </Botao>
        </>
      }
    >
      <div className="pilha solta">
        <Campo rotulo="Como foi">
          <Segmentado
            className="tp-seg-cheio"
            valor={meio}
            aoMudar={trocarMeio}
            opcoes={MEIOS.map((m) => ({ valor: m, rotulo: NOME_DO_MEIO[m] }))}
          />
        </Campo>

        <Campo
          rotulo="Quem levou"
          dica={
            doMeio.length === 0
              ? `Nenhum cadastro de ${NOME_DO_MEIO[meio].toLowerCase()} ainda. Cadastre em Quem transporta.`
              : undefined
          }
        >
          <Seletor
            campo
            bloco
            comBusca={doMeio.length > 6}
            valor={quemId}
            opcoes={doMeio.map((t) => ({ valor: t.id, rotulo: t.nome }))}
            aoEscolher={setQuemId}
            vazio={`Escolha ${meio === 'transportadora' ? 'a transportadora' : meio === 'motoboy' ? 'o motoboy' : 'quem levou'}`}
          />
        </Campo>

        <Campo rotulo="Para quê">
          <Segmentado
            className="tp-seg-cheio"
            valor={motivo}
            aoMudar={setMotivo}
            opcoes={MOTIVOS.map((m) => ({ valor: m, rotulo: NOME_CURTO_DO_MOTIVO[m] }))}
          />
        </Campo>

        {motivo === 'entrega' ? (
          <Campo rotulo="Pedido" dica="O gasto entra na conta do pedido no relatório.">
            <Seletor
              campo
              bloco
              comBusca
              valor={pedido}
              opcoes={pedidos.map((p) => ({ valor: p.numero, rotulo: [p.numero, p.cliente].filter(Boolean).join(' · ') }))}
              aoEscolher={setPedido}
              vazio="Sem pedido"
            />
          </Campo>
        ) : motivo === 'busca' ? (
          <Campo rotulo="De qual fornecedor" dica="Quem vendeu o material que foi buscado.">
            <Seletor
              campo
              bloco
              comBusca
              valor={fornecedor}
              opcoes={fornecedores.map((f) => ({ valor: f.id, rotulo: f.nome }))}
              aoEscolher={setFornecedor}
              vazio="Sem fornecedor"
            />
          </Campo>
        ) : null}

        <Campo rotulo={motivo === 'busca' ? 'De onde veio' : 'Para onde foi'}>
          <Entrada
            value={destino}
            onChange={(e) => setDestino(e.currentTarget.value)}
            placeholder="Setor Bueno, Goiânia"
          />
        </Campo>

        <div className="tp-dois-campos">
          <Campo rotulo="Dia">
            <CampoDeData bloco valor={dia} aoMudar={setDia} />
          </Campo>
          <Campo rotulo="Valor, em reais" erro={valor.trim() !== '' && (numero === null || numero <= 0)}>
            <Entrada
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.currentTarget.value)}
              placeholder="0,00"
              aria-label="Valor"
            />
          </Campo>
        </div>

        <div className="pilha">
          <Campo rotulo="Como foi pago">
            <Segmentado
              className="tp-seg-cheio"
              valor={forma}
              aoMudar={setForma}
              opcoes={FORMAS.map((f) => ({ valor: f, rotulo: NOME_DA_FORMA[f] }))}
            />
          </Campo>
          <Marcacao checked={pago} onChange={(e) => setPago(e.currentTarget.checked)}>
            Já está pago
          </Marcacao>
          <p className="tp-ajuda">
            {pago
              ? 'Entra no gasto do mês e não aparece em A pagar.'
              : 'Fica em A pagar até alguém acertar. É o caso do motoboy que recebe no fim da semana e do boleto da transportadora.'}
          </p>
        </div>

        <Campo rotulo="Observação">
          <AreaTexto
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.currentTarget.value)}
            placeholder="O número da nota ou do recibo, por exemplo"
          />
        </Campo>
      </div>
    </Gaveta>
  )
}
