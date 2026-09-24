import { useEffect, useState } from 'react'
import { Esqueleto, Modal, Vazio } from '@ds'
import { CaixaDeImagem, GradeDeTamanhos, ModuloDeLayout } from '@dominio/layout'
import { acharCotacao, type Cotacao } from '@dominio/cotacao'
import {
  BlocoDaFatia,
  cotacaoDoPedido,
  quemSeguraOPedido,
  type FatiaNoQuadro,
  type PedidoNoTrilho,
  type Rota,
} from '@dominio/producao'
import './cartao-aberto.css'
import './pedido-aberto.css'

/* ==========================================================================
   O PEDIDO INTEIRO, aberto do trilho de entregas.

   ELE NÃO É O CARTÃO ABERTO COM OUTRO NOME, e a diferença é a pergunta.

   O cartão aberto é a tela de QUEM TRABALHA naquele posto: ele mostra os
   layouts DAQUELA técnica, porque é o que está na mesa da pessoa, e ao lado
   traz a ação, a conversa e o Terminei. É uma tela de fazer.

   Este aqui é a tela de QUEM OLHA O PEDIDO: todos os layouts de todas as
   técnicas juntos, e no topo onde cada fatia está. É uma tela de conferir, e
   por isso não tem nenhum botão que mexa na fábrica. Quem quer mexer abre o
   cartão do posto, que é onde a responsabilidade mora.

   OS LAYOUTS VÊM TODOS, SEM FILTRO. No cartão a fatia diz qual técnica está na
   mão daquele posto; aqui não existe fatia escolhida, e filtrar por alguma
   seria esconder justamente o layout que a pessoa abriu o pedido para ver.

   SEM VALOR, sempre. Isto é chão de fábrica, e a regra está em
   claude/REGRA-COM-VALOR-E-SEM-VALOR.md.
   ========================================================================== */

export function PedidoAberto({
  pedido,
  fatias,
  rotas,
  aoFechar,
}: {
  pedido: PedidoNoTrilho
  /* as fatias DESTE pedido, já filtradas pela tela: ela tem a lista inteira e
     não faz sentido cada modal refiltrar a mesma coisa */
  fatias: FatiaNoQuadro[]
  rotas: Rota[]
  aoFechar: () => void
}) {
  const [cotacao, setCotacao] = useState<Cotacao | null>(null)
  const [lendo, setLendo] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    setLendo(true)
    setCotacao(null)
    setErro('')
    cotacaoDoPedido(pedido.id)
      .then((id) => (id ? acharCotacao(id) : null))
      .then((c) => {
        if (!vivo) return
        setCotacao(c)
        if (!c) setErro('Este pedido não aponta para nenhuma cotação.')
      })
      .catch((e) => {
        if (!vivo) return
        setErro(e instanceof Error ? e.message : 'Não consegui ler os layouts deste pedido.')
      })
      .finally(() => vivo && setLendo(false))
    return () => {
      vivo = false
    }
  }, [pedido.id])

  const segura = rotas.length ? quemSeguraOPedido(rotas, fatias) : ''
  const blocos = cotacao?.produtos.map((p) => p.bloco) ?? []

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      gigante
      titulo={pedido.numero + ' · ' + (pedido.nome || pedido.cliente)}
    >
      <p className="pa-sub">
        <b>{pedido.cliente}</b>
        <i>·</i>
        {pedido.pecas} peças
        <i>·</i>
        {blocos.length} {blocos.length === 1 ? 'layout' : 'layouts'}
        <i>·</i>
        {fatias.length} {fatias.length === 1 ? 'cartão no quadro' : 'cartões no quadro'}
        <span className="pa-sem-valor">esta tela não mostra valor</span>
      </p>

      {/* ONDE CADA PARTE ESTÁ, EM CIMA DOS LAYOUTS.

          Em cima e não embaixo: a pessoa abre este pedido porque viu a data de
          entrega no trilho, e a primeira pergunta depois da data é o que está
          segurando. Os layouts respondem a segunda, que é o que é a peça. */}
      <section className="pa-onde">
        {fatias.map((f) => (
          <BlocoDaFatia key={f.id} fatia={f} rotas={rotas} segurando={f.id === segura} />
        ))}
      </section>

      <h3 className="pa-titulo">
        {blocos.length === 1 ? 'O layout do pedido' : 'Os ' + blocos.length + ' layouts do pedido'}
      </h3>

      {lendo ? (
        <>
          <Esqueleto altura={220} />
          <Esqueleto altura={220} />
        </>
      ) : null}

      {!lendo && erro ? <Vazio titulo="Não consegui abrir os layouts" texto={erro} /> : null}

      {!lendo && !erro && !blocos.length ? (
        <Vazio
          titulo="Esta cotação não tem layout"
          texto="O pedido existe e desceu para o quadro, mas a cotação dele não tem nenhum produto."
        />
      ) : null}

      <div className="pa-layouts">
        {blocos.map((b) => (
          <div className="ca-layout" key={b.id}>
            <ModuloDeLayout
              bloco={b}
              aoMudar={() => {}}
              leitura
              semValor
              arte={<CaixaDeImagem leitura imagem={b.imagem} arte={b.arte} />}
              tabela={<GradeDeTamanhos leitura faixa={b.faixa} grade={b.grade} />}
            />
          </div>
        ))}
      </div>
    </Modal>
  )
}
