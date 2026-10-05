import { Fragment } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { Vazio } from '@ds'
import { NOME_DO_MOTIVO, type Movimento } from '@dominio/estoque'
import {
  chaveDoDia,
  diaPorExtenso,
  hora,
  linhaDoMovimento,
  materialDoMovimento,
  plural,
  quandoFoi,
  quantoMexeu,
} from './apoio'
import { Bola } from './vao'

/* ==========================================================================
   As movimentações: o razão do estoque.

   POR DIA é a pergunta "o que aconteceu hoje": uma faixa por dia, a hora na
   primeira coluna. POR MATERIAL é a pergunta "por que o saldo deste é o que
   é": uma faixa por material, com o dia e a hora juntos.

   No celular a tabela vira lista de duas linhas, porque oito colunas em 390
   px seriam oito colunas que ninguém lê.

   A COLUNA "POR QUÊ" (pedido do Henrique, 05/10/2026) diz por que o material
   mexeu: em qual pedido ele saiu, de quem veio, ou o que a pessoa escreveu no
   ajuste. O pedido é um botão, que abre a Separação naquele pedido.
   ========================================================================== */
export type Agrupar = 'dia' | 'material'

/** o que dizer quando o movimento não tem pedido nem observação */
function semPorQue(v: Movimento): string {
  if (v.motivo === 'entrada') return v.fornecedor ? 'compra' : 'entrada sem nota'
  if (v.motivo === 'ajuste') return 'contagem'
  if (v.motivo === 'saida') return 'saída sem pedido'
  return ''
}

export function Movimentacoes({
  movimentos,
  agrupar,
  estreita,
  haMovimentos,
  aoAbrirPedido,
}: {
  movimentos: Movimento[]
  agrupar: Agrupar
  estreita: boolean
  haMovimentos: boolean
  /** abre a Separação no pedido; ausente para quem não enxerga a Separação */
  aoAbrirPedido?: (pedidoId: string) => void
}) {
  if (!movimentos.length) {
    return haMovimentos ? (
      <Vazio titulo="Nada neste filtro" texto="Nenhum movimento combina com o que está escolhido." />
    ) : (
      <Vazio titulo="Razão vazio" texto="Nenhuma entrada, saída ou ajuste registrado ainda." />
    )
  }

  const grupos: { chave: string; titulo: string; itens: Movimento[] }[] = []
  for (const v of movimentos) {
    const chave = agrupar === 'dia' ? chaveDoDia(v.quando) : v.materialId
    let g = grupos.find((x) => x.chave === chave)
    if (!g) {
      g = { chave, titulo: agrupar === 'dia' ? diaPorExtenso(v.quando) : materialDoMovimento(v), itens: [] }
      grupos.push(g)
    }
    g.itens.push(v)
  }
  if (agrupar === 'material') grupos.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))

  /* o pedido do movimento: um botão quando dá para abrir, texto quando não dá */
  const pedidoDe = (v: Movimento) =>
    !v.pedido ? null : aoAbrirPedido && v.pedidoId ? (
      <button
        type="button"
        className="es-pedido"
        title={'Abrir o pedido ' + v.pedido + ' na Separação'}
        onClick={() => aoAbrirPedido(v.pedidoId)}
      >
        pedido {v.pedido}
        <ArrowSquareOut size={13} aria-hidden="true" />
      </button>
    ) : (
      <b className="es-pedido-nome">pedido {v.pedido}</b>
    )

  if (estreita) {
    return (
      <>
        {grupos.map((g) => (
          <Fragment key={g.chave}>
            <div className="es-faixa">
              {g.titulo}
              <span>{plural(g.itens.length, 'movimento', 'movimentos')}</span>
            </div>
            {g.itens.map((v) => (
              <div key={v.id} className="es-linha">
                <Bola cor={v.corHex} />
                <span className="es-texto">
                  <b>{agrupar === 'dia' ? materialDoMovimento(v) : NOME_DO_MOTIVO[v.motivo]}</b>
                  <small>{linhaDoMovimento(v)}</small>
                  {aoAbrirPedido && v.pedidoId && v.pedido ? pedidoDe(v) : null}
                </span>
                <span className={v.quantidade < 0 ? 'es-valor' : 'es-valor es-entrou'}>{quantoMexeu(v)}</span>
              </div>
            ))}
          </Fragment>
        ))}
      </>
    )
  }

  return (
    <div className="tabela-rola">
      <table className="tabela es-tabela">
        <thead>
          <tr>
            <th>{agrupar === 'dia' ? 'Hora' : 'Quando'}</th>
            <th>Motivo</th>
            <th>Material</th>
            <th className="dir">Quanto</th>
            <th>Por quê</th>
            <th>Fornecedor</th>
            <th>Quem</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <Fragment key={g.chave}>
              <tr className="grupo">
                <td colSpan={7}>
                  <span className="es-grupo-nome">
                    <b>{g.titulo}</b>
                    {plural(g.itens.length, 'movimento', 'movimentos')}
                  </span>
                </td>
              </tr>
              {g.itens.map((v) => (
                <tr key={v.id}>
                  <td className="es-apoio">{agrupar === 'dia' ? hora(v.quando) : quandoFoi(v.quando)}</td>
                  <td>{NOME_DO_MOTIVO[v.motivo]}</td>
                  <td>
                    <span className="es-celula">
                      <Bola cor={v.corHex} pequena />
                      <b>{materialDoMovimento(v)}</b>
                    </span>
                  </td>
                  <td className="dir">
                    <b className={v.quantidade < 0 ? '' : 'es-entrou'}>{quantoMexeu(v)}</b>
                  </td>
                  <td>
                    <span className="es-porque" data-porque="">
                      {pedidoDe(v)}
                      {v.observacao && v.observacao !== 'separação do pedido' ? (
                        <span>{v.observacao}</span>
                      ) : !v.pedido ? (
                        <span className="es-apoio">{semPorQue(v)}</span>
                      ) : null}
                    </span>
                  </td>
                  <td>{v.fornecedor}</td>
                  <td className="es-apoio">{v.quem || 'sistema'}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
