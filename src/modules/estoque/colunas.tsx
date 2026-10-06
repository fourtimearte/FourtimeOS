import type { ReactNode } from 'react'
import { type IconeDoPacote, TituloCartao } from '@ds'
import { ArrowsDownUp, ListChecks, ShoppingCart } from '@phosphor-icons/react'
import {
  faltaDoMaterial,
  quantoNaUnidade,
  type Material,
  type Movimento,
  type PedidoNaSeparacao,
} from '@dominio/estoque'
import {
  diaEMes,
  fornecedorDoMaterial,
  linhaDoMovimento,
  plural,
  quantoMexeu,
  type Fornecimento,
} from './apoio'
import { Bola } from './vao'

/* ==========================================================================
   As três colunas da direita: para separação, para comprar e últimos
   movimentos.

   SÃO BAIXAS DE PROPÓSITO (pedido do Henrique, 04/10/2026). Cada uma mostra o
   começo da lista, rola pela roda do mouse sem barra de rolagem à vista, e
   termina num "Ver mais" que leva ao lugar onde a lista está inteira. Assim a
   prateleira de tecidos cabe debaixo das três sem a página virar um rolo.

   No celular cada uma vira uma tela inteira, escolhida nos chips do topo, e
   aí a caixa tem a altura do que ela guarda.
   ========================================================================== */

/** o nome do material em duas linhas: o tecido em cima e a cor embaixo */
function DoisNomes({ m, nome }: { m?: Material; nome: string }) {
  if (m && m.categoria === 'tecido' && m.tecido) {
    return (
      <>
        <b>{m.tecido}</b>
        <small className="em-cor">{m.cor}</small>
      </>
    )
  }
  return <b>{m?.nome ?? nome}</b>
}

export function Coluna({
  titulo,
  icone,
  direita,
  verMais,
  aoVerMais,
  inteira,
  nome,
  children,
}: {
  titulo: string
  icone: IconeDoPacote
  direita?: ReactNode
  /** o texto do pé; sem ele a caixa não tem pé */
  verMais?: string
  aoVerMais?: () => void
  /** a caixa com a altura do conteúdo: é a do celular */
  inteira?: boolean
  /** como a caixa se chama para o teste e para o leitor de tela */
  nome: string
  children: ReactNode
}) {
  return (
    <section className={inteira ? 'cartao em-col' : 'cartao em-col em-curta'} data-coluna={nome}>
      <div className="em-topo">
        <TituloCartao icone={icone}>{titulo}</TituloCartao>
        {direita}
      </div>
      {/* a caixa que rola recebe o foco do teclado: sem isso, quem não usa o
          mouse não alcança o que está abaixo da dobra */}
      <div
        className="em-rolagem"
        tabIndex={inteira ? undefined : 0}
        role="group"
        aria-label={titulo}
      >
        {children}
      </div>
      {verMais && aoVerMais ? (
        <button type="button" className="em-pe" onClick={aoVerMais}>
          {verMais}
        </button>
      ) : null}
    </section>
  )
}

/* --- para separação ---------------------------------------------------------
   Os pedidos que esperam material, na ordem da entrega. A linha não abre para
   baixo (pedido do Henrique, 05/10/2026): o clique leva à página Separação, já
   naquele pedido, que é onde o material dele se vê e se separa. */
export function ParaSeparacao({
  fila,
  podeSeparar,
  inteira,
  aoAbrir,
  aoVerMais,
}: {
  fila: PedidoNaSeparacao[]
  /** a pessoa enxerga a página Separação */
  podeSeparar: boolean
  inteira?: boolean
  aoAbrir: (p: PedidoNaSeparacao) => void
  aoVerMais: () => void
}) {
  return (
    <Coluna
      nome="separacao"
      titulo="Para separação"
      icone={ListChecks}
      inteira={inteira}
      direita={<span className="em-topo-n">{plural(fila.length, 'pedido', 'pedidos')}</span>}
      verMais={
        podeSeparar && fila.length
          ? `Ver mais · ${fila.length === 1 ? 'o pedido' : 'os ' + fila.length} na Separação`
          : undefined
      }
      aoVerMais={aoVerMais}
    >
      {fila.length === 0 ? (
        <p className="em-sem-linhas">Nenhum pedido esperando material.</p>
      ) : (
        fila.map(p => {
          const dentro = (
            <>
              <span className="em-txt">
                <b>{p.numero}</b>
                <small>{p.cliente || 'sem cliente'}</small>
                <small>
                  {plural(p.pecas, 'pç', 'pçs')} ·{' '}
                  {p.entregaEm
                    ? 'entrega ' + diaEMes(p.entregaEm + 'T12:00:00')
                    : 'sem data de entrega'}
                </small>
              </span>
              <span className="em-val">
                {p.separados} de {p.materiais}
                {p.naoCobre > 0 ? (
                  <small className="pouco">falta tecido</small>
                ) : p.tudoSeparado ? (
                  <small>separado</small>
                ) : p.semConsumo > 0 ? (
                  <small>sem consumo</small>
                ) : (
                  <small>para separar</small>
                )}
              </span>
            </>
          )
          /* quem não enxerga a Separação vê a fila, sem o clique que daria numa
             página fechada para ele */
          return podeSeparar ? (
            <button
              type="button"
              key={p.id}
              className="em-lin"
              data-pedido={p.numero}
              title={'Abrir o pedido ' + p.numero + ' na Separação'}
              onClick={() => aoAbrir(p)}
            >
              {dentro}
            </button>
          ) : (
            <div key={p.id} className="em-lin" data-pedido={p.numero}>
              {dentro}
            </div>
          )
        })
      )}
    </Coluna>
  )
}

/* --- para comprar ------------------------------------------------------------ */
export function ParaComprar({
  comprar,
  fornecimento,
  inteira,
  aoEscolher,
  aoVerMais,
}: {
  /** já na ordem da urgência */
  comprar: Material[]
  fornecimento: Fornecimento
  inteira?: boolean
  aoEscolher: (m: Material) => void
  aoVerMais?: () => void
}) {
  return (
    <Coluna
      nome="comprar"
      titulo="Para comprar"
      icone={ShoppingCart}
      inteira={inteira}
      direita={
        comprar.length ? (
          /* na caixa estreita (tela de 1366 e de 1440) a frase inteira encostava
             na borda: ali fica só a conta, como no "13 pedidos" da caixa ao lado */
          <span className="em-topo-n alerta" title={`${comprar.length} abaixo do mínimo`}>
            <span className="em-topo-longo">{comprar.length} abaixo do mínimo</span>
            <span className="em-topo-breve">
              {plural(comprar.length, 'material', 'materiais')}
            </span>
          </span>
        ) : undefined
      }
      verMais={
        comprar.length && aoVerMais
          ? `Ver mais · ${comprar.length === 1 ? 'o material' : 'os ' + comprar.length} para comprar`
          : undefined
      }
      aoVerMais={aoVerMais}
    >
      {comprar.length === 0 ? (
        <p className="em-sem-linhas">Nenhum material abaixo do mínimo.</p>
      ) : (
        comprar.map(m => {
          const f = fornecedorDoMaterial(m, fornecimento)
          return (
            <button
              key={m.id}
              type="button"
              className="em-lin"
              data-material={m.nome}
              onClick={() => aoEscolher(m)}
            >
              <Bola cor={m.corHex} />
              <span className="em-txt">
                <DoisNomes m={m} nome={m.nome} />
                <small>
                  tem {quantoNaUnidade(m.livre, m.unidade)} · mínimo{' '}
                  {quantoNaUnidade(m.minimo, m.unidade)}
                </small>
                {f ? (
                  <small>{f.nome}</small>
                ) : fornecimento.disponivel ? (
                  <small className="em-falta">falta escolher o fornecedor</small>
                ) : null}
              </span>
              <span className="em-val pouco">
                {quantoNaUnidade(faltaDoMaterial(m), m.unidade)}
                <small>{faltaDoMaterial(m) === 1 ? 'falta' : 'faltam'}</small>
              </span>
            </button>
          )
        })
      )}
    </Coluna>
  )
}

/* --- últimos movimentos ------------------------------------------------------- */
const MOVIMENTOS_NA_COLUNA = 20

export function UltimosMovimentos({
  movimentos,
  materiais,
  inteira,
  aoVerMais,
}: {
  movimentos: Movimento[]
  materiais: Material[]
  inteira?: boolean
  aoVerMais: () => void
}) {
  const porId = new Map(materiais.map(m => [m.id, m]))
  return (
    <Coluna
      nome="movimentos"
      titulo="Últimos movimentos"
      icone={ArrowsDownUp}
      inteira={inteira}
      verMais={movimentos.length ? 'Ver mais · todas as movimentações' : undefined}
      aoVerMais={aoVerMais}
    >
      {movimentos.length === 0 ? (
        <p className="em-sem-linhas">Nenhuma entrada, saída ou ajuste registrado ainda.</p>
      ) : (
        movimentos.slice(0, MOVIMENTOS_NA_COLUNA).map(v => (
          <div key={v.id} className="em-lin">
            <span className="em-txt">
              {v.categoria === 'tecido' && v.tecido ? (
                <>
                  <b>{v.tecido}</b>
                  <small className="em-cor">{v.cor}</small>
                </>
              ) : (
                <DoisNomes m={porId.get(v.materialId)} nome={v.material} />
              )}
              <small>{linhaDoMovimento(v)}</small>
            </span>
            <span className={v.quantidade > 0 ? 'em-val entrou' : 'em-val'}>{quantoMexeu(v)}</span>
          </div>
        ))
      )}
    </Coluna>
  )
}
