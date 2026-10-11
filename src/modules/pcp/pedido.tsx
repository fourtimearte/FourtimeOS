import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUUpLeft,
  Check,
  CheckCircle,
  Circle,
  Clock,
  Printer,
  Stamp,
  X,
} from '@phosphor-icons/react'
import { AreaTexto, Botao, Segmentado, Selo, TituloCartao, avisar } from '@ds'
import { acharCotacao, type Cotacao } from '@dominio/cotacao'
import { carregarMaterialDosLayouts, carregarReservasDoPedido } from '@dominio/estoque'
import { carregarFichasPorCodigo } from '@dominio/produto'
import {
  abrirNoPcp,
  compararOsComponentes,
  desmarcarDoPcp,
  devolverAoVendedor,
  devolverDoPcp,
  marcarParaAprovacao,
  voltarAConferir,
  type ConsumoParaComparar,
  type FichaParaComparar,
  type PedidoLiberado,
  type ReservaParaComparar,
  type PedidoNoPcp,
} from '@dominio/producao'
import { ModalDaFolha } from '@modules/cotacao'
import { dataCurta, emDias, quando, temFalta } from './fila'
import { CartaoDaComparacao } from './comparacao'
import { CartaoDaConversa } from './conversa'
import { CartaoDoLayoutNoPcp, CartaoDoOrcamento } from './orcamento'

/* ==========================================================================
   O PEDIDO ESCOLHIDO NO PCP (pranchas 88 e 89).

   Parte P1 (11/10/2026): o cabeçalho (o estado, o pedido e a cotação, o
   cliente, a linha das peças e da entrega, Abrir a folha e Fechar) e as
   APROVAÇÕES, as duas, nesta ordem: 1. o PCP marca como conferido ou devolve
   ao vendedor; 2. o diretor aprova para a produção ou devolve ao PCP. A
   parte P2 põe o orçamento e os layouts no meio, e a P3 a comparação dos
   componentes.

   ABRIR É CONFERIR. A primeira pessoa que pode marcar e abre o pedido fica
   sendo quem confere ("Bruna está conferindo desde hoje, 09:05"); quem só
   olha não muda nada.
   ========================================================================== */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function dinheiro(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function estadoDoPedido(p: PedidoNoPcp): { texto: string; tom: 'info' | 'warn' | 'ok' | 'brand' } {
  if (p.comOVendedor) return { texto: 'com o vendedor', tom: 'brand' }
  if (p.marcado) return { texto: 'esperando o diretor', tom: 'warn' }
  return { texto: 'conferindo', tom: 'info' }
}

function Cabecalho({
  numero,
  cotacao,
  selo,
  cliente,
  linha,
  aoAbrirAFolha,
  aoFechar,
}: {
  numero: string
  cotacao: string
  selo: { texto: string; tom: 'info' | 'warn' | 'ok' | 'brand' | 'neutro' }
  cliente: string
  linha: string
  aoAbrirAFolha?: () => void
  aoFechar: () => void
}) {
  return (
    <header className="pc-ped-topo">
      <div className="pc-ped-tit">
        <span className="pc-ped-caminho">
          <Selo tom={selo.tom}>{selo.texto}</Selo>
          <span>
            {numero}
            {cotacao ? ' › ' + cotacao : ''}
          </span>
        </span>
        <h2>{cliente || 'sem cliente'}</h2>
        <small>{linha}</small>
      </div>
      <div className="fileira">
        {aoAbrirAFolha ? (
          <Botao tom="contorno" onClick={aoAbrirAFolha}>
            <Printer size={17} />
            Abrir a folha
          </Botao>
        ) : null}
        <Botao tom="contorno" onClick={aoFechar}>
          <X size={17} />
          Fechar
        </Botao>
      </div>
    </header>
  )
}

function linhaDoPedido(p: {
  pecas: number
  layouts: number
  total: number
  entregaEm: string
}): string {
  const d = emDias(p.entregaEm)
  return (
    `${p.pecas} peças · ${plural(p.layouts, 'layout', 'layouts')} · ${dinheiro(p.total)} · ` +
    (p.entregaEm ? `entrega ${dataCurta(p.entregaEm)}, ${d.texto}` : 'sem data de entrega')
  )
}

export function PedidoAberto({
  p,
  eu,
  euId,
  doPcp,
  podeMarcar,
  podeDevolverAoVendedor,
  podeAprovar,
  aoMexer,
  aoAprovar,
  aoContar,
  aoFechar,
}: {
  p: PedidoNoPcp
  /** o nome de quem está olhando, para "Henrique decide" */
  eu: string
  euId: string
  /** vê a página do PCP: conversa com qualquer pessoa */
  doPcp: boolean
  podeMarcar: boolean
  podeDevolverAoVendedor: boolean
  podeAprovar: boolean
  aoMexer: () => Promise<unknown>
  aoAprovar: (p: PedidoNoPcp) => void
  /** quantas diferenças a comparação achou, para a fila e os números */
  aoContar?: (id: string, diferencas: number) => void
  aoFechar: () => void
}) {
  const [folha, setFolha] = useState(false)
  const [ocupado, setOcupado] = useState('')
  /* qual devolução está aberta: ao vendedor (do PCP) ou ao PCP (do diretor) */
  const [devolvendo, setDevolvendo] = useState<'' | 'vendedor' | 'pcp'>('')
  const [motivo, setMotivo] = useState('')
  const abriu = useRef('')
  /* undefined: lendo; null: não achou */
  const [cotacao, setCotacao] = useState<Cotacao | null | undefined>(undefined)
  /* no celular e no tablet, uma parte por vez (pranchas 91 e 92) */
  const [aba, setAba] = useState<'conferencia' | 'orcamento' | 'conversa'>(
    /* quem não confere (o vendedor que chegou pelo sino) começa pela conversa */
    doPcp ? 'conferencia' : 'conversa',
  )
  const [mensagens, setMensagens] = useState(0)

  useEffect(() => {
    let vivo = true
    setCotacao(undefined)
    if (!p.cotacaoId) {
      setCotacao(null)
      return
    }
    acharCotacao(p.cotacaoId)
      .then(c => vivo && setCotacao(c ?? null))
      .catch(() => vivo && setCotacao(null))
    return () => {
      vivo = false
    }
  }, [p.cotacaoId])

  /* O QUE A COMPARAÇÃO LÊ ALÉM DA COTAÇÃO: a ficha de cada referência, o
     material de cada layout (062) e o que saiu da prateleira */
  const [fichas, setFichas] = useState<Map<string, FichaParaComparar> | undefined>(undefined)
  const [consumo, setConsumo] = useState<ConsumoParaComparar[] | null | undefined>(undefined)
  const [reservas, setReservas] = useState<ReservaParaComparar[] | undefined>(undefined)

  useEffect(() => {
    if (!cotacao) return
    let vivo = true
    const cods = cotacao.produtos.map(x => x.bloco.referencia || '')
    void carregarFichasPorCodigo(cods)
      .catch(() => [])
      .then(l => vivo && setFichas(new Map(l.map(f => [f.cod, f]))))
    void carregarMaterialDosLayouts(p.id)
      .catch(() => null)
      .then(c => vivo && setConsumo(c))
    void carregarReservasDoPedido(p.id)
      .catch(() => [])
      .then(r => vivo && setReservas(r))
    return () => {
      vivo = false
    }
  }, [cotacao, p.id])

  const comparacao = useMemo(() => {
    if (cotacao === null) return null
    if (!cotacao || !fichas || consumo === undefined || !reservas) return undefined
    return compararOsComponentes({ cotacao, fichas, consumo, reservas })
  }, [cotacao, fichas, consumo, reservas])
  const diferencas = (comparacao ?? []).reduce((s, l) => s + l.diferencas, 0)

  useEffect(() => {
    if (comparacao) aoContar?.(p.id, diferencas)
  }, [comparacao, diferencas, p.id, aoContar])

  /* ABRIR É CONFERIR: uma vez por pedido, e só para quem pode marcar */
  useEffect(() => {
    if (abriu.current === p.id) return
    abriu.current = p.id
    if (!podeMarcar || p.marcado || p.comOVendedor || p.conferindoPor) return
    void abrirNoPcp(p.id).then(ok => (ok ? aoMexer() : null))
  }, [p.id, p.marcado, p.comOVendedor, p.conferindoPor, podeMarcar, aoMexer])

  async function fazer(chave: string, acao: () => Promise<void>, recado: string) {
    setOcupado(chave)
    try {
      await acao()
      setDevolvendo('')
      setMotivo('')
      await aoMexer()
      avisar(recado, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não deu certo.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  const falta = temFalta(p)
  const textoDoPcp = p.comOVendedor
    ? `Devolvido ao vendedor${p.vendedor ? ' (' + p.vendedor + ')' : ''} por ${p.vendedorPor || 'alguém'}, ${quando(p.vendedorEm)}.`
    : p.marcado
      ? `Conferido por ${p.marcadoPor || 'alguém'}, ${quando(p.marcadoEm)}.` +
        (falta ? ' Desce com falta de material.' : '')
      : p.conferindoPor
        ? `${p.conferindoPor} está conferindo desde ${quando(p.conferindoEm)}.` +
          (falta ? ' A separação deixou falta de material.' : '')
        : 'Ainda não aberto por quem confere.' +
          (falta ? ' A separação deixou falta de material.' : '')
  /* a conta da comparação entra na frase de quem confere, e não na do diretor */
  const textoDasDiferencas =
    !p.marcado && !p.comOVendedor && diferencas
      ? ` Há ${diferencas} ${diferencas === 1 ? 'diferença aberta' : 'diferenças abertas'}.`
      : ''

  const formulario = (
    para: 'vendedor' | 'pcp',
    enviar: () => void,
    dica: string,
    rotulo: string,
  ) =>
    devolvendo === para ? (
      <div className="pc-devolve">
        <AreaTexto
          value={motivo}
          rows={3}
          aria-label="Motivo da devolução"
          placeholder={dica}
          onChange={e => setMotivo(e.currentTarget.value)}
          autoFocus
        />
        <div className="fileira">
          <Botao
            tom="primario"
            carregando={ocupado === para}
            disabled={motivo.trim().length < 3 || !!ocupado}
            onClick={enviar}
          >
            <ArrowUUpLeft size={16} />
            {rotulo}
          </Botao>
          <Botao tom="limpo" onClick={() => setDevolvendo('')}>
            Cancelar
          </Botao>
        </div>
      </div>
    ) : null

  return (
    <div className="pc-aberto pc-ped" data-aba={aba}>
      <div className="pc-ped-meio">
        <Cabecalho
          numero={p.numero}
          cotacao={p.cotacaoNumero}
          selo={estadoDoPedido(p)}
          cliente={p.cliente}
          linha={linhaDoPedido(p)}
          aoAbrirAFolha={p.cotacaoId ? () => setFolha(true) : undefined}
          aoFechar={aoFechar}
        />
        <Segmentado
          className="pc-ped-abas"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            {
              valor: 'conferencia',
              rotulo: <>Conferência {diferencas ? <small>{diferencas}</small> : null}</>,
            },
            { valor: 'orcamento', rotulo: 'Orçamento' },
            {
              valor: 'conversa',
              rotulo: <>Conversa {mensagens ? <small>{mensagens}</small> : null}</>,
            },
          ]}
        />
        <div className="pc-ped-orcamento">
          <CartaoDoOrcamento c={cotacao} vendedor={p.vendedor} />
          {cotacao
            ? cotacao.produtos
                .filter(x => !x.bloco.informacoes)
                .map((x, i) => <CartaoDoLayoutNoPcp key={x.bloco.n || i} p={x} />)
            : null}
        </div>
      </div>
      <div className="pc-ped-lado">
        <section className="cartao pc-aprovacoes" aria-label="Aprovações">
          <header className="pc-cab">
            <TituloCartao icone={Stamp}>Aprovações</TituloCartao>
            <span className="pc-cab-apoio">
              {p.marcado ? 'falta a do diretor' : 'as duas, nesta ordem'}
            </span>
          </header>

          {/* 1. O PCP */}
          <div className={'pc-passo' + (p.marcado ? ' feito' : '')} data-passo="pcp">
            {p.marcado ? (
              <CheckCircle size={20} className="pc-ic" aria-hidden="true" />
            ) : (
              <Clock size={20} className="pc-ic" aria-hidden="true" />
            )}
            <div className="pilha pc-passo-meio">
              <b>1. PCP</b>
              <p className="pc-apoio">
                {textoDoPcp}
                {textoDasDiferencas}
              </p>
              {p.comOVendedor ? <p className="pc-motivo">{p.vendedorMotivo}</p> : null}
              {!p.marcado && !p.comOVendedor && p.devolvidoMotivo ? (
                <p className="pc-motivo">
                  Devolvido pelo diretor{p.devolvidoPor ? ' (' + p.devolvidoPor + ')' : ''}:{' '}
                  {p.devolvidoMotivo}
                </p>
              ) : null}

              {p.comOVendedor && podeMarcar ? (
                <div className="fileira">
                  <Botao
                    tom="forte"
                    carregando={ocupado === 'voltar'}
                    disabled={!!ocupado}
                    onClick={() =>
                      void fazer(
                        'voltar',
                        () => voltarAConferir(p.id),
                        `${p.numero} voltou para Conferindo.`,
                      )
                    }
                  >
                    <ArrowUUpLeft size={16} />
                    Voltar a conferir
                  </Botao>
                </div>
              ) : null}

              {!p.marcado &&
              !p.comOVendedor &&
              (podeMarcar || podeDevolverAoVendedor) &&
              devolvendo !== 'vendedor' ? (
                <div className="fileira pc-passo-botoes">
                  {podeMarcar ? (
                    <Botao
                      tom="forte"
                      carregando={ocupado === 'marcar'}
                      disabled={!!ocupado}
                      onClick={() =>
                        void fazer(
                          'marcar',
                          () => marcarParaAprovacao(p.id),
                          `${p.numero} foi para a mesa do diretor.`,
                        )
                      }
                    >
                      <Check size={16} />
                      Marcar como conferido
                    </Botao>
                  ) : null}
                  {podeDevolverAoVendedor ? (
                    <Botao
                      tom="contorno"
                      disabled={!!ocupado}
                      onClick={() => setDevolvendo('vendedor')}
                    >
                      <ArrowUUpLeft size={16} />
                      Devolver ao vendedor
                    </Botao>
                  ) : null}
                </div>
              ) : null}
              {formulario(
                'vendedor',
                () =>
                  void fazer(
                    'vendedor',
                    () => devolverAoVendedor(p.id, motivo),
                    `${p.numero} está nos Devolvidos, com o motivo para o vendedor.`,
                  ),
                'O L-03 está sem etiqueta. É a Eti. Fourtime, igual às outras duas?',
                'Devolver com este motivo',
              )}
            </div>
          </div>

          {/* 2. O DIRETOR */}
          <div className={'pc-passo' + (p.marcado ? '' : ' fechado')} data-passo="diretor">
            <Circle size={20} className="pc-ic" aria-hidden="true" />
            <div className="pilha pc-passo-meio">
              <b>2. Diretor</b>
              <p className="pc-apoio">
                {!p.marcado
                  ? 'Só abre depois que o PCP marcar.'
                  : `${podeAprovar && eu ? eu : 'O diretor'} decide. Aprovar cria as fatias no kanban e põe o pedido na produção.`}
              </p>
              {p.marcado && (podeAprovar || podeMarcar) && devolvendo !== 'pcp' ? (
                <div className="fileira pc-passo-botoes">
                  {podeAprovar ? (
                    <Botao tom="primario" disabled={!!ocupado} onClick={() => aoAprovar(p)}>
                      <Check size={16} />
                      Aprovar para a produção
                    </Botao>
                  ) : null}
                  {podeAprovar ? (
                    <Botao tom="contorno" disabled={!!ocupado} onClick={() => setDevolvendo('pcp')}>
                      <ArrowUUpLeft size={16} />
                      Devolver ao PCP
                    </Botao>
                  ) : null}
                  {podeMarcar ? (
                    <Botao
                      tom="limpo"
                      carregando={ocupado === 'desmarcar'}
                      disabled={!!ocupado}
                      onClick={() =>
                        void fazer(
                          'desmarcar',
                          () => desmarcarDoPcp(p.id),
                          `A marca de ${p.numero} saiu.`,
                        )
                      }
                    >
                      Tirar a marca
                    </Botao>
                  ) : null}
                </div>
              ) : null}
              {formulario(
                'pcp',
                () =>
                  void fazer(
                    'pcp',
                    () => devolverDoPcp(p.id, motivo),
                    `${p.numero} voltou ao PCP com o motivo escrito.`,
                  ),
                'Falta confirmar a malha com o cliente antes de cortar.',
                'Devolver ao PCP com este motivo',
              )}
            </div>
          </div>
        </section>
        <CartaoDaComparacao layouts={comparacao} aceitas={p.marcado} />
      </div>
      <div className="pc-ped-conversa">
        <CartaoDaConversa p={p} eu={{ id: euId, nome: eu }} doPcp={doPcp} aoContar={setMensagens} />
      </div>

      {folha ? (
        <ModalDaFolha
          cotacaoId={p.cotacaoId}
          numeroDoPedido={p.numero}
          aoFechar={() => setFolha(false)}
        />
      ) : null}
    </div>
  )
}

const NOME_DO_ESTADO: Record<string, string> = {
  producao: 'na produção',
  pronto: 'pronto',
  enviado: 'enviado',
  entregue: 'entregue',
}

/* o que já passou pelo portão: só para ler */
export function LiberadoAberto({ p, aoFechar }: { p: PedidoLiberado; aoFechar: () => void }) {
  const [folha, setFolha] = useState(false)
  return (
    <div className="pc-aberto">
      <Cabecalho
        numero={p.numero}
        cotacao=""
        selo={{ texto: NOME_DO_ESTADO[p.estado] ?? p.estado, tom: 'ok' }}
        cliente={p.cliente}
        linha={linhaDoPedido(p)}
        aoAbrirAFolha={p.cotacaoId ? () => setFolha(true) : undefined}
        aoFechar={aoFechar}
      />
      <section className="cartao pc-aprovacoes" aria-label="Aprovações">
        <header className="pc-cab">
          <TituloCartao icone={Stamp}>Aprovações</TituloCartao>
          <span className="pc-cab-apoio">as duas feitas</span>
        </header>
        <div className="pc-passo feito">
          <CheckCircle size={20} className="pc-ic" aria-hidden="true" />
          <div className="pilha pc-passo-meio">
            <b>1. PCP</b>
            <p className="pc-apoio">
              {p.marcadoPor ? 'Conferido por ' + p.marcadoPor + '.' : 'Conferido pelo PCP.'}
            </p>
          </div>
        </div>
        <div className="pc-passo feito">
          <CheckCircle size={20} className="pc-ic" aria-hidden="true" />
          <div className="pilha pc-passo-meio">
            <b>2. Diretor</b>
            <p className="pc-apoio">
              {p.liberadoPor
                ? `Aprovado por ${p.liberadoPor}, ${quando(p.liberadoEm)}.`
                : `Desceu para a fábrica em ${dataCurta(p.liberadoEm)}, antes de o sistema guardar quem aprovou.`}
              {p.aviso === 'falta-material' ? ' Desceu com falta de material.' : ''}
            </p>
          </div>
        </div>
      </section>
      {folha ? (
        <ModalDaFolha
          cotacaoId={p.cotacaoId}
          numeroDoPedido={p.numero}
          aoFechar={() => setFolha(false)}
        />
      ) : null}
    </div>
  )
}
