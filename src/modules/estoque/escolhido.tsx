import { Plus } from '@phosphor-icons/react'
import { Botao, TituloCartao } from '@ds'
import {
  NOME_DA_CATEGORIA,
  NOME_DO_MOTIVO,
  nomeNoGrupo,
  quantoNaUnidade,
  soONumero,
  type GrupoDoEstoque,
  type Material,
  type Movimento,
  type ReservaEmAberto,
} from '@dominio/estoque'
import type { Fornecedor } from '@dominio/fornecedor'
import { diaEMes, diaMesEAno, linhaDoMovimento, plural, porQue, quandoFoi, quantoMexeu } from './apoio'
import { Bola, VaoDoMaterial } from './vao'

/* ==========================================================================
   Um material escolhido: uma caixa para cada coisa.

   O nome e os botões, a etiqueta do fornecedor, uma caixa por cor (ou por
   item do grupo) com o vão e o número que importa, e embaixo o que andou e o
   que os pedidos seguram.

   O NÚMERO GRANDE É O LIVRE, e não o que está na prateleira: a pergunta de
   quem compra é o que sobra depois da reserva. O que está na prateleira e o
   que está reservado ficam na linha miúda, que é a conta do número grande.
   ========================================================================== */

/** "4 cores · 81 kg livres · 10 kg reservados para pedidos" */
export function resumoDoGrupo(g: GrupoDoEstoque): string {
  const partes = [
    g.categoria === 'tecido'
      ? plural(g.itens.length, 'cor', 'cores')
      : plural(g.itens.length, 'material', 'materiais'),
  ]
  if (g.unidade) {
    partes.push(quantoNaUnidade(g.livre, g.unidade) + (g.livre === 1 ? ' livre' : ' livres'))
    partes.push(
      g.reservado > 0
        ? quantoNaUnidade(g.reservado, g.unidade) + ' reservados para pedidos'
        : 'nada reservado',
    )
  }
  return partes.join(' · ')
}

export function rotuloDeNovoItem(g: GrupoDoEstoque): string {
  return g.categoria === 'tecido' ? 'Nova cor' : 'Novo material'
}

export function MaterialEscolhido({
  grupo,
  fornecedor,
  temFornecedores,
  ultimaEntrada,
  movimentos,
  reservas,
  podeEditar,
  estreita,
  aoMovimentar,
  aoNovoItem,
  aoEditar,
  aoVerFornecedor,
  aoVerMovimentos,
}: {
  grupo: GrupoDoEstoque
  fornecedor: Fornecedor | null
  /** falso enquanto a lista de fornecedores não existe no banco */
  temFornecedores: boolean
  /** a última entrada deste grupo, em ISO, ou vazio */
  ultimaEntrada: string
  movimentos: Movimento[]
  reservas: ReservaEmAberto[]
  podeEditar: boolean
  /** tela estreita: os movimentos viram linhas de duas alturas */
  estreita: boolean
  aoMovimentar: (m: Material) => void
  aoNovoItem: () => void
  aoEditar: () => void
  aoVerFornecedor: () => void
  aoVerMovimentos: () => void
}) {
  const porId = new Map(grupo.itens.map((m) => [m.id, m]))
  const reservadoTotal = reservas.reduce((s, r) => s + r.quantidade, 0)
  const pedidos = new Set(reservas.map((r) => r.pedidoId)).size
  const ehTecido = grupo.categoria === 'tecido'

  return (
    <>
      <div className="es-fila">
        <section className="cartao es-nome">
          <div className="es-nome-texto">
            <span className="es-sobre">{NOME_DA_CATEGORIA[grupo.categoria]}</span>
            <h2>{grupo.nome}</h2>
            <p>{resumoDoGrupo(grupo)}</p>
          </div>
          {podeEditar ? (
            <div className="es-nome-botoes">
              <Botao onClick={aoNovoItem}>{rotuloDeNovoItem(grupo)}</Botao>
              <Botao onClick={aoEditar}>{ehTecido ? 'Editar tecido' : 'Editar grupo'}</Botao>
            </div>
          ) : null}
        </section>

        {temFornecedores ? (
          <section className="es-cinza es-fornecedor">
            <div className="es-fornecedor-texto">
              <span className="es-sobre">Fornecedor</span>
              {fornecedor ? (
                <>
                  <b>{fornecedor.nome}</b>
                  <small>
                    {ultimaEntrada ? 'última entrada em ' + diaMesEAno(ultimaEntrada) : 'nenhuma entrada ainda'}
                  </small>
                </>
              ) : (
                <>
                  <b className="es-falta">Falta escolher</b>
                  <small>a entrada de material pergunta de quem veio</small>
                </>
              )}
            </div>
            {fornecedor ? (
              <Botao onClick={aoVerFornecedor}>Ver fornecedor</Botao>
            ) : podeEditar ? (
              <Botao onClick={aoEditar}>Escolher</Botao>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="es-cores">
        {grupo.itens.map((m) => {
          const comprar = m.livre < m.minimo
          return (
            <section key={m.id} className="cartao es-cor">
              <VaoDoMaterial m={m} />
              {m.minimo > 0 ? (
                <span className="es-etiqueta-minimo">mínimo {quantoNaUnidade(m.minimo, m.unidade)}</span>
              ) : null}
              {comprar ? <span className="es-etiqueta-comprar">comprar</span> : null}
              <div className="es-cor-corpo">
                <span className="es-cor-nome">{nomeNoGrupo(m)}</span>
                <span className="es-cor-livre">
                  <b className={comprar ? 'es-pouco' : ''}>{soONumero(m.livre, m.unidade)}</b>
                  {m.unidade} {m.livre === 1 ? 'livre' : 'livres'}
                </span>
                <span className="es-cor-conta">
                  {quantoNaUnidade(m.saldo, m.unidade)} na prateleira ·{' '}
                  {m.reservado > 0
                    ? quantoNaUnidade(m.reservado, m.unidade) + ' reservados'
                    : 'nada reservado'}
                  {m.reservaSemConsumo ? <span className="es-alerta"> · reserva sem consumo cadastrado</span> : null}
                  {m.ondeFica ? ' · ' + m.ondeFica : ''}
                </span>
                {podeEditar ? (
                  <div className="es-cor-botao">
                    <Botao bloco onClick={() => aoMovimentar(m)}>
                      Movimentar
                    </Botao>
                  </div>
                ) : null}
              </div>
            </section>
          )
        })}
        {podeEditar && !ehTecido ? (
          <button type="button" className="es-cor-nova" onClick={aoNovoItem}>
            <Plus size={20} />
            Novo material neste grupo
          </button>
        ) : null}
      </div>

      <div className="es-fila">
        <section className="cartao es-caixa es-cresce-caixa">
          <div className="es-caixa-topo">
            <TituloCartao>
              {ehTecido ? 'Últimos movimentos deste tecido' : 'Últimos movimentos deste grupo'}
            </TituloCartao>
            <button type="button" className="es-ver-todos" onClick={aoVerMovimentos}>
              Ver todos
            </button>
          </div>
          {movimentos.length === 0 ? (
            <p className="es-sem-linhas">Nada entrou nem saiu ainda.</p>
          ) : (
            movimentos.slice(0, 5).map((v) => {
              const m = porId.get(v.materialId)
              if (estreita) {
                return (
                  <div key={v.id} className="es-linha">
                    <Bola cor={m?.corHex} />
                    <span className="es-texto">
                      <b>{m ? nomeNoGrupo(m) : v.material}</b>
                      <small>{linhaDoMovimento(v)}</small>
                    </span>
                    <span className="es-valor">{quantoMexeu(v)}</span>
                  </div>
                )
              }
              return (
                <div key={v.id} className="es-mov">
                  <span className="es-mov-quando">{quandoFoi(v.quando)}</span>
                  <span>{NOME_DO_MOTIVO[v.motivo]}</span>
                  <span className="es-mov-cor">
                    <Bola cor={m?.corHex} pequena />
                    <span>{m ? nomeNoGrupo(m) : v.material}</span>
                  </span>
                  <span className="es-mov-quanto">{quantoMexeu(v)}</span>
                  <span className="es-mov-obs">{porQue(v)}</span>
                </div>
              )
            })
          )}
        </section>

        <section className="cartao es-caixa es-reservado">
          <div className="es-caixa-topo">
            <TituloCartao>Reservado para pedidos</TituloCartao>
            {reservas.length > 0 && grupo.unidade ? (
              <span className="es-caixa-nota">
                {quantoNaUnidade(reservadoTotal, grupo.unidade)} em {plural(pedidos, 'pedido', 'pedidos')}
              </span>
            ) : null}
          </div>
          {reservas.length === 0 ? (
            <p className="es-sem-linhas">
              {grupo.reservado > 0 ? 'Há reserva, e a lista dos pedidos não veio.' : 'Nada reservado.'}
            </p>
          ) : (
            reservas.slice(0, 6).map((r) => {
              const m = porId.get(r.materialId)
              return (
                <div key={r.id} className="es-linha">
                  <Bola cor={m?.corHex} />
                  <span className="es-texto">
                    <b>
                      {r.pedido}
                      {m ? ' · ' + nomeNoGrupo(m) : ''}
                    </b>
                    <small>
                      {r.entrega ? 'entrega em ' + diaEMes(r.entrega + 'T12:00:00') : 'sem data de entrega'}
                      {r.semConsumo ? ' · sem consumo cadastrado' : ''}
                    </small>
                  </span>
                  <span className="es-valor">{quantoNaUnidade(r.quantidade, r.unidade)}</span>
                </div>
              )
            })
          )}
        </section>
      </div>
    </>
  )
}
