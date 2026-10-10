import {
  ArrowLeft,
  ArrowLineDown,
  Check,
  CheckCircle,
  ClipboardText,
  FileText,
  FloppyDisk,
  Percent,
  Printer,
  WhatsappLogo,
} from '@phosphor-icons/react'
import { Botao, LINHA_ESCOLHIDA, Selo, type IconeDoPacote } from '@ds'
import {
  NOME_DO_ESTADO_DA_COTACAO,
  pecasDaCotacao,
  subtotal,
  totalDaCotacao,
  valorDoAjuste,
  type Cotacao,
  type EstadoDaCotacao,
} from '@dominio/cotacao'
import { dadosCompletos } from './cabecalho-do-pedido'
import './cotacao.css'

/* ==========================================================================
   O CABEÇALHO DO EDITOR: o resumo no lugar do título (desenho J, decisão
   163) e os botões em duas fileiras (decisão 159).

   Da esquerda para a direita: a seta de voltar às cotações; o azulejo da
   cotação (número, cliente, data e o estado); um cartão de células que começa
   com as duas PORTAS grandes, Dados do pedido e Fechamento (cada uma abre o
   modal da decisão 161 e fica em tinta enquanto ele está aberto); e as
   células Layouts, Subtotal e Total. Tudo em 84 px de altura, a mesma dos
   botões em duas fileiras ao lado.

   O título "Cotação CO2026-0131" deixou de existir: o azulejo diz a mesma
   coisa em menos altura, e o espaço ganho vira o resumo que antes morava na
   coluna da direita, de onde o vendedor precisava tirar o olho do layout.
   ========================================================================== */

const TOM_DO_ESTADO: Record<EstadoDaCotacao, 'neutro' | 'info' | 'ok' | 'warn' | 'brand'> = {
  rascunho: 'neutro',
  enviada: 'info',
  aprovada: 'ok',
  recusada: 'brand',
  vencida: 'warn',
}

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataCurta = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')
const diaEMes = (iso: string) => (iso ? new Date(iso + (iso.length === 10 ? 'T12:00' : '')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '')
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export type Porta = '' | 'dados' | 'fechamento'

/** O que a célula do subtotal diz embaixo: o desconto que tirou dele. */
function apoioDoSubtotal(c: Cotacao): string {
  const base = subtotal(c)
  const ajustes = c.ajustes.filter((a) => a.valor)
  if (!ajustes.length) return 'sem ajuste'
  const soma = totalDaCotacao(c) - base
  const sinal = soma < 0 ? '- ' : '+ '
  if (ajustes.length === 1) {
    const a = ajustes[0]
    const nome = a.descricao.trim() || (a.valor < 0 ? 'desconto' : 'acréscimo')
    const quanto = a.tipo === 'porcento' ? ' ' + Math.abs(a.valor) + '%' : ''
    return `${nome}${quanto}: ${sinal}${dinheiro(Math.abs(valorDoAjuste(a, base)))}`
  }
  return `${ajustes.length} ajustes: ${sinal}${dinheiro(Math.abs(soma))}`
}

function textoDosAjustes(c: Cotacao): string {
  const d = c.ajustes.filter((a) => a.valor < 0).length
  const m = c.ajustes.filter((a) => a.valor > 0).length
  if (!d && !m) return 'nenhum ajuste'
  return [d ? plural(d, 'desconto', 'descontos') : '', m ? plural(m, 'acréscimo', 'acréscimos') : ''].filter(Boolean).join(' · ')
}

export function TopoDoEditor({
  c,
  sujo,
  porta,
  gravando,
  fechada,
  aoVoltar,
  aoAbrir,
  aoImprimir,
  aoAprovar,
  aoFolhaDaProducao,
  aoEnviar,
  aoSalvar,
  aoSalvarEBaixar,
}: {
  c: Cotacao
  sujo: boolean
  porta: Porta
  gravando: boolean
  fechada: boolean
  aoVoltar: () => void
  aoAbrir: (p: Exclude<Porta, ''>) => void
  aoImprimir: () => void
  aoAprovar: () => void
  aoFolhaDaProducao: () => void
  aoEnviar: () => void
  aoSalvar: () => void
  aoSalvarEBaixar: () => void
}) {
  const total = totalDaCotacao(c)
  const pecas = pecasDaCotacao(c)
  const informes = c.informes.filter((i) => i.noDocumento).length
  const completo = dadosCompletos(c)
  const quem = [c.vendedor, c.validaAte ? 'vale até ' + diaEMes(c.validaAte) : ''].filter(Boolean).join(' · ')

  return (
    <div className="ct-topo">
      <div className="ct-cb">
        <button type="button" className="ct-cb-tile ct-cb-volta" aria-label="Voltar às cotações" title="Voltar às cotações" onClick={aoVoltar}>
          <ArrowLeft size={18} />
        </button>
        <div className="ct-cb-tile ct-cb-id">
          <span className="ct-cb-sobre">
            Cotação
            <Selo tom={TOM_DO_ESTADO[c.estado]}>{NOME_DO_ESTADO_DA_COTACAO[c.estado]}</Selo>
          </span>
          <span className="ct-cb-pilha">
            <b className="ct-cb-v">{c.numero}</b>
            <small className="ct-cb-s">
              {c.cliente.nome || 'sem cliente ainda'} · criada em {dataCurta(c.criadaEm)}
            </small>
          </span>
        </div>
        <div className="cartao ct-cb-cels">
          <div className="ct-cb-cel ct-cb-portas">
            <PortaDoTopo
              icone={ClipboardText}
              titulo="Dados do pedido"
              aberta={porta === 'dados'}
              ok={completo}
              linhas={[c.cliente.nome || 'sem cliente ainda', quem || 'falta vendedor e validade']}
              aoAbrir={() => aoAbrir('dados')}
            />
            <PortaDoTopo
              icone={Percent}
              titulo="Fechamento"
              aberta={porta === 'fechamento'}
              linhas={[textoDosAjustes(c), plural(informes, 'informe', 'informes') + ' · ' + plural(c.enviadas.length, 'envio', 'envios')]}
              aoAbrir={() => aoAbrir('fechamento')}
            />
          </div>
          <div className="ct-cb-cel">
            <span className="ct-cb-sobre">Layouts</span>
            <b className="ct-cb-v">{c.produtos.length}</b>
            <small className="ct-cb-s">{plural(pecas, 'peça', 'peças')}</small>
          </div>
          <div className="ct-cb-cel">
            <span className="ct-cb-sobre">Subtotal</span>
            <b className="ct-cb-v">{dinheiro(subtotal(c))}</b>
            <small className="ct-cb-s">{apoioDoSubtotal(c)}</small>
          </div>
          <div className="ct-cb-cel ct-cb-tot">
            <span className="ct-cb-sobre">Total</span>
            <b className="ct-cb-v">{dinheiro(total)}</b>
            <small className="ct-cb-s">entrada 50%: {dinheiro(total / 2)}</small>
          </div>
        </div>
      </div>

      {/* OS QUATRO BOTÕES, EM DUAS FILEIRAS (decisão 159): Imprimir e Aprovar em
          cima, Enviar e Salvar embaixo, em duas colunas da mesma largura. Depois
          do sim o Aprovar dá lugar à Folha da produção, que só existe a partir
          dali, e o Enviar fica parado: o que o cliente recebeu já foi aprovado. */}
      <div className="ct-bts">
        <Botao tom="contorno" onClick={aoImprimir}>
          <Printer size={17} />
          Imprimir
        </Botao>
        {fechada ? (
          <Botao tom="contorno" onClick={aoFolhaDaProducao}>
            <FileText size={17} />
            Folha da produção
          </Botao>
        ) : (
          <Botao tom="primario" onClick={aoAprovar} disabled={!c.produtos.length || gravando}>
            <Check size={17} />
            Aprovar e gerar ficha
          </Botao>
        )}
        <Botao tom="wa" onClick={aoEnviar} disabled={fechada || gravando} title={fechada ? 'A cotação já foi aprovada' : undefined}>
          <WhatsappLogo size={17} />
          Enviar ao cliente
        </Botao>
        {/* O SALVAR COM A SETA (decisão 155): o botão salva; a seta salva e
            baixa o .cft, direto, sem abrir menu. O ponto vermelho diz que há
            mudança que ainda não foi para o banco. */}
        <span className="ct-salvar">
          <Botao tom="contorno" onClick={aoSalvar} disabled={gravando} aria-label={sujo ? 'Salvar, há mudança não salva' : 'Salvar'} title={sujo ? 'Há mudança não salva' : 'Tudo salvo'}>
            {sujo ? <span className="ct-ponto-sujo" aria-hidden="true" /> : <FloppyDisk size={17} />}
            Salvar
          </Botao>
          <Botao tom="contorno" icone onClick={aoSalvarEBaixar} disabled={gravando} aria-label="Salvar e baixar o .cft" title="Salvar e baixar o .cft">
            <ArrowLineDown size={17} />
          </Botao>
        </span>
      </div>
    </div>
  )
}

function PortaDoTopo({
  icone: Icone,
  titulo,
  linhas,
  aberta,
  ok,
  aoAbrir,
}: {
  icone: IconeDoPacote
  titulo: string
  linhas: [string, string]
  aberta: boolean
  ok?: boolean
  aoAbrir: () => void
}) {
  return (
    <button type="button" className={aberta ? 'ct-porta ct-porta-aberta ' + LINHA_ESCOLHIDA : 'ct-porta'} aria-haspopup="dialog" aria-expanded={aberta} onClick={aoAbrir}>
      <span className="ct-porta-ic">
        <Icone size={18} />
      </span>
      <b>{titulo}</b>
      <span className="ct-porta-fim">
        {ok ? (
          <span className="ct-porta-ok" title="Tudo preenchido">
            <CheckCircle size={15} />
          </span>
        ) : null}
      </span>
      <small>{linhas[0]}</small>
      <small>{linhas[1]}</small>
    </button>
  )
}
