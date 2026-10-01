import { useEffect, useState } from 'react'
import { Esqueleto, Modal, Vazio } from '@ds'
import { LayoutDeLeitura, type Bloco } from '@dominio/layout'
import { acharCotacao } from '@dominio/cotacao'
import {
  NOME_DA_TECNICA,
  cotacaoDoPedido,
  type FatiaNoQuadro,
  type PedidoNoTrilho,
  type Rota,
} from '@dominio/producao'
import { GraficoDoPedido } from './grafico'
import { Fechar, Mestre, entregaEmTexto } from './pecas-do-modal'
import './cartao-aberto.css'

/* ==========================================================================
   O PEDIDO INTEIRO, aberto pelo "Abrir o pedido" do trilho, do jeito do
   wireframe de 01/10/2026.

   ELE NÃO É O CARTÃO ABERTO COM OUTRO NOME, e a diferença é a pergunta. O
   cartão aberto é a tela de quem trabalha num posto: os layouts daquela
   técnica, a ação, a conversa. Este é a tela de quem olha o pedido: o gráfico
   de onde cada layout está, em cima, e todos os layouts embaixo, em duas
   colunas iguais. Nenhum botão mexe na fábrica.

   OS LAYOUTS SE REPARTEM EM DUAS COLUNAS na ordem da folha: L-01 e L-03 de
   um lado, L-02 e L-04 do outro, como o wireframe desenha. Cada coluna tem a
   largura de uma metade do cartão aberto, e por isso o layout fica idêntico
   nas duas telas.

   SEM VALOR, sempre. Isto é chão de fábrica (claude/REGRA-COM-VALOR-E-SEM-
   VALOR.md).
   ========================================================================== */

export function PedidoAberto({
  pedido,
  fatias,
  rotas,
  aoFechar,
}: {
  pedido: PedidoNoTrilho
  fatias: FatiaNoQuadro[]
  rotas: Rota[]
  aoFechar: () => void
}) {
  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [lendo, setLendo] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    setLendo(true)
    setBlocos([])
    setErro('')
    cotacaoDoPedido(pedido.id)
      .then((id) => (id ? acharCotacao(id) : null))
      .then((c) => {
        if (!vivo) return
        setBlocos((c?.produtos ?? []).map((p) => p.bloco))
        if (!c) setErro('Este pedido não aponta para nenhuma cotação.')
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Não consegui ler os layouts deste pedido.'))
      .finally(() => vivo && setLendo(false))
    return () => {
      vivo = false
    }
  }, [pedido.id])

  /* a técnica de cada layout vem da fatia que carrega ele */
  const tecnicaDe = (n: number) => {
    const f = fatias.find((x) => x.layouts.includes(n))
    return f ? (NOME_DA_TECNICA[f.tecnica] ?? f.tecnica) : undefined
  }

  const entrega = entregaEmTexto(pedido.entregaEm)
  const esquerda = blocos.filter((_, i) => i % 2 === 0)
  const direita = blocos.filter((_, i) => i % 2 === 1)

  return (
    <Modal aberto cheio solto aoFechar={aoFechar}>
      <div className="ca">
        <header className="ca-topo pi-topo">
          <div className="ca-titulo">
            <div className="ca-linha1">
              <b className="ca-numero">{pedido.numero}</b>
              <span className="ca-nome">{pedido.nome || pedido.cliente}</span>
              {pedido.marcas.map((m) => (
                <Mestre key={m}>{m}</Mestre>
              ))}
            </div>
            <div className="ca-meta">
              <span>
                Cliente <b>{pedido.cliente || 'sem cliente'}</b>
              </span>
              <span>
                Entrega <b className={entrega.perto ? 'perto' : ''}>{entrega.texto}</b>
              </span>
              <span>
                <b>{pedido.pecas} peças</b> em {blocos.length || '...'}{' '}
                {blocos.length === 1 ? 'layout' : 'layouts'} e {fatias.length}{' '}
                {fatias.length === 1 ? 'cartão' : 'cartões'} no quadro
              </span>
              <span>esta tela não mostra valor</span>
            </div>
          </div>
          <Fechar aoFechar={aoFechar} />
        </header>

        <div className="pi-grafico">
          <GraficoDoPedido fatias={fatias} rotas={rotas} tamanho="grande" />
        </div>

        {lendo ? (
          <div className="ca-corpo">
            <div className="ca-esq">
              <Esqueleto altura={300} />
            </div>
            <div className="ca-outro">
              <Esqueleto altura={300} />
            </div>
          </div>
        ) : erro || !blocos.length ? (
          <div className="pi-vazio">
            <Vazio
              titulo={erro ? 'Não consegui abrir os layouts' : 'Esta cotação não tem layout'}
              texto={erro || 'O pedido existe e desceu para o quadro, mas a cotação dele não tem nenhum produto.'}
            />
          </div>
        ) : (
          <div className="ca-corpo">
            <div className="ca-esq">
              {esquerda.map((b) => (
                <LayoutDeLeitura key={b.id} bloco={b} tecnica={tecnicaDe(b.n)} />
              ))}
            </div>
            <div className="ca-outro">
              {direita.map((b) => (
                <LayoutDeLeitura key={b.id} bloco={b} tecnica={tecnicaDe(b.n)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
