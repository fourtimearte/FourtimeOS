import { TituloCartao } from '@ds'
import {
  abaixoDoMinimo,
  chaveDoGrupo,
  faltaDoMaterial,
  nomeInteiro,
  quantoNaUnidade,
  type GrupoDoEstoque,
  type Material,
  type Movimento,
} from '@dominio/estoque'
import {
  fornecedorDoGrupo,
  fornecedorDoMaterial,
  idsDosFornecedores,
  linhaDoMovimento,
  materialDoMovimento,
  quantoMexeu,
  type Fornecimento,
} from './apoio'
import { Bola, VaoDoMaterial } from './vao'

/* ==========================================================================
   A visão geral: o que a tela mostra enquanto nada foi escolhido.

   Ela responde, nesta ordem, às três perguntas de quem abre o estoque: o que
   falta comprar, o que andou, e como está a prateleira de tecidos.
   ========================================================================== */
export function VisaoGeral({
  materiais,
  grupos,
  movimentos,
  fornecimento,
  aoEscolher,
  aoVerMovimentos,
}: {
  materiais: Material[]
  grupos: GrupoDoEstoque[]
  movimentos: Movimento[]
  fornecimento: Fornecimento
  aoEscolher: (chave: string) => void
  aoVerMovimentos: () => void
}) {
  const baixo = abaixoDoMinimo(materiais)
  /* quem falta mais, em proporção ao próprio mínimo, sobe: 3 kg de um mínimo
     de 20 é mais urgente que 40 un de um mínimo de 60 */
  const comprar = [...baixo].sort(
    (a, b) => a.livre / (a.minimo || 1) - b.livre / (b.minimo || 1),
  )
  const comReserva = materiais.filter((m) => m.reservado > 0 || m.pedidosReservando > 0).length
  const semFornecedor = materiais.filter(
    (m) => idsDosFornecedores(fornecimento.ligacoes, m.id).length === 0,
  ).length
  const corte = Date.now() - 7 * 86400000
  const naSemana = movimentos.filter((v) => new Date(v.quando).getTime() >= corte).length
  const tecidos = grupos.filter((g) => g.categoria === 'tecido')

  return (
    <>
      <div className="es-fila">
        <section className="cartao es-heroi">
          <b className={baixo.length ? 'es-heroi-numero' : 'es-heroi-numero em-dia'}>{baixo.length}</b>
          <div className="es-texto">
            <span className="es-sobre">Visão geral</span>
            <h2>
              {baixo.length === 1 ? 'material para comprar' : 'materiais para comprar'}
            </h2>
            <p>Escolha um material na lista para ver as cores, o fornecedor e movimentar.</p>
          </div>
        </section>
        <div className="es-cinza es-numero">
          <b>{materiais.length}</b>
          <span>{materiais.length === 1 ? 'material no estoque' : 'materiais no estoque'}</span>
        </div>
        <div className="es-cinza es-numero">
          <b>{comReserva}</b>
          <span>com reserva de pedido</span>
        </div>
        {fornecimento.disponivel ? (
          <div className="es-cinza es-numero">
            <b>{semFornecedor}</b>
            <span>sem fornecedor</span>
          </div>
        ) : (
          <div className="es-cinza es-numero">
            <b>{naSemana}</b>
            <span>movimentos na semana</span>
          </div>
        )}
      </div>

      <div className="es-metades">
        <section className="cartao es-caixa">
          <div className="es-caixa-topo">
            <TituloCartao>Para comprar</TituloCartao>
            <span className="es-caixa-nota">abaixo do mínimo</span>
          </div>
          {comprar.length === 0 ? (
            <p className="es-sem-linhas">Nenhum material abaixo do mínimo.</p>
          ) : (
            comprar.slice(0, 6).map((m) => {
              const f = fornecedorDoMaterial(m, fornecimento)
              return (
                <button
                  type="button"
                  key={m.id}
                  className="es-linha"
                  onClick={() => aoEscolher(chaveDoGrupo(m))}
                >
                  <Bola cor={m.corHex} />
                  <span className="es-texto">
                    <b>{nomeInteiro(m)}</b>
                    <small>
                      {[
                        f?.nome,
                        'tem ' + quantoNaUnidade(m.livre, m.unidade),
                        'mínimo ' + quantoNaUnidade(m.minimo, m.unidade),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <span className="es-valor es-pouco">
                    faltam {quantoNaUnidade(faltaDoMaterial(m), m.unidade)}
                  </span>
                </button>
              )
            })
          )}
        </section>

        <section className="cartao es-caixa">
          <div className="es-caixa-topo">
            <TituloCartao>Últimos movimentos</TituloCartao>
            <button type="button" className="es-ver-todos" onClick={aoVerMovimentos}>
              Ver todos
            </button>
          </div>
          {movimentos.length === 0 ? (
            <p className="es-sem-linhas">Nenhuma entrada, saída ou ajuste registrado ainda.</p>
          ) : (
            movimentos.slice(0, Math.max(4, Math.min(6, comprar.length))).map((v) => (
              <div key={v.id} className="es-linha">
                <span className="es-texto">
                  <b>{materialDoMovimento(v)}</b>
                  <small>{linhaDoMovimento(v)}</small>
                </span>
                <span className={v.quantidade < 0 ? 'es-valor' : 'es-valor es-entrou'}>{quantoMexeu(v)}</span>
              </div>
            ))
          )}
        </section>
      </div>

      {tecidos.length > 0 ? (
        <section className="cartao es-caixa">
          <div className="es-caixa-topo">
            <TituloCartao>A prateleira de tecidos</TituloCartao>
            <span className="es-caixa-nota">
              <span className="es-so-largo">a altura do tecido é o que tem livre · o risco é o mínimo</span>
              <span className="es-so-estreito">arraste para o lado</span>
            </span>
          </div>
          <div className="es-prateleira">
            {tecidos.map((g) => {
              const f = fornecedorDoGrupo(g, fornecimento)
              return (
                <button type="button" key={g.chave} className="es-tabua" onClick={() => aoEscolher(g.chave)}>
                  <span className="es-tabua-nome">
                    <b>{g.nome}</b>
                    {f ? <small>{f.nome}</small> : null}
                  </span>
                  <span className="es-tabua-vaos">
                    {g.itens.map((m) => (
                      <VaoDoMaterial key={m.id} m={m} titulo={nomeInteiro(m)} />
                    ))}
                  </span>
                  <span className="es-tabua-numeros">
                    {g.itens.map((m) => (
                      <b key={m.id} className={m.livre < m.minimo ? 'es-pouco' : ''}>
                        {quantoNaUnidade(m.livre, m.unidade)}
                      </b>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}
    </>
  )
}
