import { Etiqueta } from '@ds'
import {
  diasParaAEntrega,
  tomDaMarca,
  type PedidoNoTrilho,
} from '@dominio/producao'

/* ==========================================================================
   O TRILHO DE ENTREGAS.

   O quadro responde "onde está cada pedaço". Ele não responde "o que sai
   primeiro", e essa é a pergunta com que a fábrica começa o dia. Antes deste
   trilho, responder ela era varrer treze colunas com o olho somando datas de
   cabeça.

   UM CARTÃO POR PEDIDO, e não por fatia. O quadro já é por fatia de propósito,
   porque a sublimação e o DTF do mesmo pedido andam em ritmos diferentes. Aqui
   é o contrário: quem entrega entrega o pedido inteiro, e um pedido que virasse
   dois cartões no trilho seria a mesma data escrita duas vezes.

   NÃO DIZ ONDE O PEDIDO ESTÁ, de propósito. Uma linha miúda com "subli:
   Calandra · DTF: Corte" repetiria em texto o que o destaque mostra no quadro
   em cores, e texto em cartão pequeno é o que se lê por último. Quem quer saber
   onde está clica, e o quadro acende.
   ========================================================================== */

export function Trilho({
  pedidos,
  aceso,
  aoEscolher,
}: {
  pedidos: PedidoNoTrilho[]
  aceso: string
  aoEscolher: (p: PedidoNoTrilho) => void
}) {
  if (!pedidos.length) {
    return (
      <div className="kb-trilho-vazio">
        Nenhum pedido correndo. O trilho enche quando o diretor aprova a produção, no PCP.
      </div>
    )
  }

  return (
    <div className="kb-trilho" role="list" aria-label="Pedidos por data de entrega">
      {pedidos.map((p) => (
        <CartaoDoTrilho
          key={p.id}
          pedido={p}
          aceso={aceso === p.id}
          apagado={!!aceso && aceso !== p.id}
          aoEscolher={() => aoEscolher(p)}
        />
      ))}
    </div>
  )
}

function CartaoDoTrilho({
  pedido: p,
  aceso,
  apagado,
  aoEscolher,
}: {
  pedido: PedidoNoTrilho
  aceso: boolean
  apagado: boolean
  aoEscolher: () => void
}) {
  const dias = diasParaAEntrega(p.entregaEm)
  const atrasado = dias !== null && dias < 0
  const aperta = dias !== null && dias >= 0 && dias <= 3

  return (
    <button
      type="button"
      role="listitem"
      className={['kb-tr', aceso ? 'aceso' : '', apagado ? 'apagado' : ''].filter(Boolean).join(' ')}
      aria-pressed={aceso}
      title={
        aceso
          ? 'Clique de novo para tirar o destaque do quadro'
          : 'Abrir o pedido e acender os cartões dele no quadro'
      }
      onClick={aoEscolher}
    >
      <span className="kb-tr-topo">
        <b>{p.numero}</b>
        {/* A DATA É A RAZÃO DE ELE EXISTIR, então ela é o que tem cor. O
            vermelho aqui é o único vermelho do trilho, e quer dizer atraso,
            que é o que a marca quer dizer no V7. */}
        <span
          className={['kb-tr-prazo', atrasado ? 'atrasado' : aperta ? 'aperta' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {dias === null
            ? 'sem data'
            : dias < 0
              ? Math.abs(dias) + (dias === -1 ? ' dia atrás' : ' dias atrás')
              : dias === 0
                ? 'hoje'
                : dias === 1
                  ? 'amanhã'
                  : 'em ' + dias + ' dias'}
        </span>
      </span>

      <span className="kb-tr-nome">{p.nome || p.cliente}</span>

      {p.marcas.length ? (
        <span className="kb-tr-marcas">
          {p.marcas.map((m) => (
            <Etiqueta key={m} mestre pequena tom={tomDaMarca(m)}>
              {m}
            </Etiqueta>
          ))}
        </span>
      ) : null}

      <span className="kb-tr-pe">
        <span>{p.pecas} pçs</span>
        <span>
          {p.fatias} {p.fatias === 1 ? 'cartão' : 'cartões'}
        </span>
      </span>
    </button>
  )
}
