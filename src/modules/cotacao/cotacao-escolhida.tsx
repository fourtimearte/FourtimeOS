import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  ClipboardText,
  Clock,
  Copy,
  PaperPlaneTilt,
  PencilSimple,
  Path,
  Printer,
  Receipt,
  Stack,
  X,
} from '@phosphor-icons/react'
import { Amostra, Botao, ChipTecnica, Esqueleto, TituloCartao, Vazio, avisar, type Tecnica } from '@ds'
import { gradeEmTexto } from '@dominio/layout'
import {
  pecasDaCotacao,
  pecasDoProduto,
  passoDoCaminho,
  pedidoDaCotacao,
  proximoNumero,
  salvarCotacao,
  subtotal,
  totalDaCotacao,
  totalDoProduto,
  valorDoAjuste,
  type Cotacao,
  type PedidoDaCotacao,
} from '@dominio/cotacao'
import { usarCotacao } from './usar-cotacao'
import './cotacao.css'

/* ==========================================================================
   73. A COTAÇÃO ESCOLHIDA, ao lado da lista.

   Em cima, só os botões (Folha A4, Duplicar, Abrir no editor, Fechar): o
   bloco com o estado, o número e o cliente saiu a pedido dele (prancha 73,
   08/10/2026), porque a linha escolhida da lista ao lado já diz quem é.
   Depois, o resumo e os dados do pedido lado a lado, os layouts em linha, e
   na última fileira o caminho do pedido e o que já foi enviado.
   ========================================================================== */

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ddmm = (iso: string) => {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!d) return ''
  if (iso.length === 10) return d[3] + '/' + d[2]
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
const TECNICAS_COM_PILULA = new Set(['subli', 'dtf', 'silk', 'bordado', 'patch'])
const NOME_DA_TECNICA: Record<string, string> = { subli: 'Subli', dtf: 'DTF', silk: 'Silk', bordado: 'Bordado', patch: 'Patch' }

export function CotacaoEscolhida({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const navegar = useNavigate()
  const { cotacao: c, carregando, falha } = usarCotacao(id)
  const [pedido, setPedido] = useState<PedidoDaCotacao | null>(null)
  const aprovada = c?.estado === 'aprovada'

  useEffect(() => {
    let vivo = true
    setPedido(null)
    if (!aprovada) return
    pedidoDaCotacao(id)
      .then((p) => vivo && setPedido(p))
      .catch(() => vivo && setPedido(null))
    return () => {
      vivo = false
    }
  }, [id, aprovada])

  /* DUPLICAR: uma cotação nova, com número novo, em rascunho, sem os envios
     e sem a aprovação da original. O resto (cliente, layouts, condições) vem
     igual, que é para isso que se duplica. */
  async function duplicar(orig: Cotacao) {
    try {
      const agora = new Date().toISOString()
      const nova: Cotacao = {
        ...orig,
        id: '',
        numero: await proximoNumero(),
        estado: 'rascunho',
        criadaEm: agora,
        alteradaEm: agora,
        enviadas: [],
        aprovacao: null,
        producao: { ...orig.producao, pedido: '' },
      }
      const salva = await salvarCotacao(nova)
      avisar('Cotação ' + salva.numero + ' criada a partir da ' + orig.numero, 'ok')
      navegar('/cotacao/' + salva.id)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui duplicar a cotação', 'warn')
    }
  }

  const botoes = (
    <div className="ct-es-topo">
      <Botao tom="contorno" className="ct-es-voltar" onClick={aoFechar}>
        <ArrowLeft size={16} weight="bold" />
        Voltar à lista
      </Botao>
      <div className="fileira ct-es-botoes">
        <Botao tom="contorno" onClick={() => navegar('/cotacao/' + id + '/folha')} disabled={!c}>
          <Printer size={16} weight="bold" />
          Folha A4
        </Botao>
        <Botao tom="contorno" onClick={() => c && void duplicar(c)} disabled={!c}>
          <Copy size={16} weight="bold" />
          Duplicar
        </Botao>
        <Botao tom="forte" onClick={() => navegar('/cotacao/' + id)}>
          <PencilSimple size={16} weight="bold" />
          Abrir no editor
        </Botao>
        <Botao tom="contorno" className="ct-es-fechar" onClick={aoFechar}>
          <X size={16} weight="bold" />
          Fechar
        </Botao>
      </div>
    </div>
  )

  if (carregando && !c) {
    return (
      <div className="ct-es">
        {botoes}
        <Esqueleto altura={420} />
      </div>
    )
  }
  if (!c) {
    return (
      <div className="ct-es">
        {botoes}
        <Vazio titulo={falha ? 'Não consegui abrir esta cotação' : 'Esta cotação não existe mais'} texto={falha || 'Ela pode ter sido apagada por outra pessoa.'} />
      </div>
    )
  }

  const base = subtotal(c)
  const total = totalDaCotacao(c)
  const pecas = pecasDaCotacao(c)
  const ultimoEnvio = c.enviadas[c.enviadas.length - 1]
  const agora = passoDoCaminho(c.estado, pedido)
  const PASSOS: [string, string][] = [
    [
      'Cotação',
      c.estado === 'rascunho'
        ? 'ainda não saiu para o cliente'
        : c.estado === 'enviada'
          ? (ultimoEnvio ? 'enviada em ' + ddmm(ultimoEnvio.data) + ', ' : '') + 'esperando o cliente aprovar'
          : c.estado === 'aprovada'
            ? 'aprovada' + (c.aprovacao?.em ? ' em ' + ddmm(c.aprovacao.em) : '') + (pedido ? ', pedido ' + pedido.numero : '')
            : c.estado === 'recusada'
              ? 'o cliente recusou'
              : 'passou da validade',
    ],
    ['Separação', 'o material sai da prateleira, layout por layout'],
    ['PCP', 'confere o orçamento, e o diretor aprova'],
    ['Produção', 'as fatias entram no kanban'],
  ]

  return (
    <div className="ct-es">
      {botoes}
      <div className="ct-lt-dois">
        <section className="cartao ct-lt-cartao">
          <header className="ct-lt-cab">
            <TituloCartao icone={Receipt}>Resumo da cotação</TituloCartao>
          </header>
          <div className="ct-es-contas">
            <div className="ct-es-linha">
              <span>Layouts</span>
              <b>{c.produtos.length}</b>
            </div>
            <div className="ct-es-linha">
              <span>Peças</span>
              <b>{pecas}</b>
            </div>
            <div className="ct-es-linha">
              <span>Subtotal</span>
              <b>{reais(base)}</b>
            </div>
            {c.ajustes.map((a) => {
              const v = valorDoAjuste(a, base)
              return (
                <div key={a.id} className="ct-es-linha">
                  <span>
                    {a.descricao ? a.descricao.charAt(0).toUpperCase() + a.descricao.slice(1) : v < 0 ? 'Desconto' : 'Acréscimo'}
                    {a.tipo === 'porcento' ? ', ' + Math.abs(a.valor).toLocaleString('pt-BR') + '%' : ''}
                  </span>
                  <b>{(v < 0 ? '- ' : '+ ') + reais(Math.abs(v))}</b>
                </div>
              )
            })}
            <div className="ct-es-linha ct-es-total">
              <span>Total</span>
              <b>{reais(total)}</b>
            </div>
            <p className="ct-es-miudo">
              Entrada 50%: <b>{reais(total / 2)}</b>
              {pecas ? (
                <>
                  {' · média por peça '}
                  <b>{reais(total / pecas)}</b>
                </>
              ) : null}
            </p>
          </div>
        </section>
        <section className="cartao ct-lt-cartao">
          <header className="ct-lt-cab">
            <TituloCartao icone={ClipboardText}>Dados do pedido</TituloCartao>
          </header>
          <dl className="ct-es-dados">
            {(
              [
                ['Contato', c.cliente.contato, c.cliente.telefone],
                ['Pagamento', c.informe.pagamento, ''],
                ['Entrega', c.informe.entrega, c.producao.dataDeEnvio ? 'envio em ' + ddmm(c.producao.dataDeEnvio) : ''],
                ['Prazo', c.informe.prazo, ''],
                ['Tabela', c.informe.tabelaDePreco, ''],
                ['Observação', c.producao.observacao, ''],
              ] as [string, string, string][]
            ).map(([r, v, s]) => (
              <div key={r}>
                <dt>{r}</dt>
                <dd>
                  <b>{v || '-'}</b>
                  {s ? <small>{s}</small> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="cartao ct-lt-cartao">
        <header className="ct-lt-cab">
          <TituloCartao icone={Stack}>Layouts do orçamento</TituloCartao>
          <span className="ct-lt-nota">
            {c.produtos.length} {c.produtos.length === 1 ? 'layout' : 'layouts'} · {pecas} peças
          </span>
        </header>
        {c.produtos.length ? (
          c.produtos.map((p) => {
            const b = p.bloco
            const tecs = [...new Set(b.design.map((d) => d.tecnica).filter((t) => TECNICAS_COM_PILULA.has(t)))]
            return (
              <div key={b.id} className="ct-es-lay">
                <span className="ct-es-arte">
                  {b.imagem ? <img src={b.imagem} alt={'Arte do layout ' + b.n} /> : <small>sem arte</small>}
                </span>
                <span className="ct-es-lay-nome">
                  <b>
                    L-{String(b.n).padStart(2, '0')} · {b.nomeDaReferencia || b.arte || 'sem referência'}
                  </b>
                  <small>{b.referencia || 'sem código'}</small>
                  <small className="ct-es-tecidos">
                    {b.tecidos
                      .filter((t) => t.nome)
                      .map((t, i) => (
                        <span key={i}>
                          <Amostra cor={t.hex} />
                          {t.nome}
                          {t.cor ? ' · ' + t.cor : ''}
                        </span>
                      ))}
                  </small>
                </span>
                <span className="ct-es-lay-meio">
                  <span className="fileira miuda">
                    {tecs.map((t) => (
                      <ChipTecnica key={t} tecnica={t as Tecnica}>
                        {NOME_DA_TECNICA[t]}
                      </ChipTecnica>
                    ))}
                  </span>
                  <small>{gradeEmTexto(b.faixa, b.grade) || 'grade vazia'}</small>
                </span>
                <span className="ct-es-lay-fim">
                  <b>{reais(totalDoProduto(p))}</b>
                  <small>{pecasDoProduto(p)} pçs</small>
                </span>
              </div>
            )
          })
        ) : (
          <p className="ct-lt-vazio">Esta cotação ainda não tem layout.</p>
        )}
      </section>

      <div className="ct-lt-dois ct-es-fim">
        <section className="cartao ct-lt-cartao">
          <header className="ct-lt-cab">
            <TituloCartao icone={Path}>Caminho do pedido</TituloCartao>
            <span className="ct-lt-nota">{aprovada ? 'onde ele está agora' : 'depois de aprovada'}</span>
          </header>
          <ol className="ct-es-passos">
            {PASSOS.map(([nome, texto], i) => {
              const feito = i < agora || (agora === 4 && i === 3)
              const estaAqui = i === agora && agora < 4
              return (
                <li key={nome} className={feito ? 'ct-es-passo ct-es-feito' : estaAqui ? 'ct-es-passo ct-es-agora' : 'ct-es-passo'}>
                  {feito ? <CheckCircle size={18} weight="fill" /> : estaAqui ? <Clock size={18} weight="bold" /> : <Circle size={18} />}
                  <b>{nome}</b>
                  <small>{i === 0 ? texto : estaAqui && pedido ? 'o pedido ' + pedido.numero + ' está aqui' : texto}</small>
                </li>
              )
            })}
          </ol>
        </section>
        <section className="cartao ct-lt-cartao">
          <header className="ct-lt-cab">
            <TituloCartao icone={PaperPlaneTilt}>O que já foi enviado</TituloCartao>
            <span className="ct-lt-nota">o valor de cada envio fica como saiu</span>
          </header>
          {c.enviadas.length ? (
            [...c.enviadas].reverse().map((e) => (
              <div key={e.numero} className="ct-es-envio">
                <span>
                  <b>
                    Envio {e.numero}
                    {e.para ? ' · para ' + e.para : ''}
                  </b>
                  <small>
                    {new Date(e.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {e.pecas} peças
                  </small>
                </span>
                <b>{reais(e.total)}</b>
              </div>
            ))
          ) : (
            <p className="ct-lt-vazio">Ainda não saiu para o cliente.</p>
          )}
        </section>
      </div>
    </div>
  )
}
