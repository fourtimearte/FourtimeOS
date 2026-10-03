import { Fragment } from 'react'
import { Tag, Vazio } from '@ds'
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
   ========================================================================== */
export type Agrupar = 'dia' | 'material'

export function Movimentacoes({
  movimentos,
  agrupar,
  estreita,
  haMovimentos,
}: {
  movimentos: Movimento[]
  agrupar: Agrupar
  estreita: boolean
  haMovimentos: boolean
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
            <th>Pedido</th>
            <th>Fornecedor</th>
            <th>Quem</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <Fragment key={g.chave}>
              <tr className="grupo">
                <td colSpan={8}>
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
                  <td>{v.pedido ? <Tag>{v.pedido}</Tag> : ''}</td>
                  <td>{v.fornecedor}</td>
                  <td className="es-apoio">{v.quem || 'sistema'}</td>
                  <td className="es-apoio">{v.observacao === 'separação do pedido' ? '' : v.observacao}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
