import { CaretRight } from '@phosphor-icons/react'
import { nomeInteiro, quantoNaUnidade, type GrupoNaArvore } from '@dominio/estoque'
import { fornecedorDoGrupo, plural, type Fornecimento } from './apoio'
import { Codigo } from './arvore'
import { VaoDoMaterial } from './vao'

/* ==========================================================================
   A prateleira de tecidos, pela mesma hierarquia da árvore.

   Grupo fechado mostra um vão miúdo por cor, para o olho passar por todos os
   grupos de uma vez. Grupo aberto mostra um bloco por tecido, com um vão alto
   por cor: a altura é o que tem livre contra o dobro do mínimo, e o risco do
   meio é o mínimo. Clicar num bloco escolhe o tecido.

   Ela fica debaixo das três colunas baixas, na largura das três (pedido do
   Henrique no comentário do wireframe, 04/10/2026).
   ========================================================================== */
export function PrateleiraDeTecidos({
  grupos,
  fornecimento,
  abertos,
  aoAbrir,
  aoEscolher,
  celular,
}: {
  grupos: GrupoNaArvore[]
  fornecimento: Fornecimento
  abertos: Set<string>
  aoAbrir: (cod: string) => void
  aoEscolher: (chave: string) => void
  celular: boolean
}) {
  if (!grupos.length) return null
  const algumAberto = grupos.some(g => abertos.has(g.cod))
  return (
    <section className="cartao em-col em-estante" data-estante="">
      <div className="em-topo">
        <h3 className="cartao-titulo">
          <span className="marca" />A prateleira de tecidos
        </h3>
        <span className="em-topo-nota">
          {!algumAberto
            ? celular
              ? 'toque num grupo para abrir'
              : 'todos os grupos fechados · clique num grupo para abrir'
            : celular
              ? 'a altura é o livre · o risco é o mínimo'
              : 'por grupo e por tecido · a altura é o que tem livre · o risco é o mínimo'}
        </span>
      </div>
      {grupos.map(g => {
        const aberto = abertos.has(g.cod)
        return (
          <div key={g.cod || 'sem-tipo'} className="em-gaveta">
            <button
              type="button"
              className={aberto ? 'em-g aberto' : 'em-g'}
              aria-expanded={aberto}
              data-grupo={g.nome}
              onClick={() => aoAbrir(g.cod)}
            >
              <CaretRight
                size={14}
                weight="bold"
                className={aberto ? 'em-seta aberta' : 'em-seta'}
              />
              <Codigo cod={g.cod} />
              <b>{g.nome}</b>
              {aberto ? null : (
                <span className="em-minis">
                  {g.tecidos.flatMap(t =>
                    t.cores.map(m => (
                      <VaoDoMaterial key={m.id} m={m} mini titulo={nomeInteiro(m)} />
                    )),
                  )}
                </span>
              )}
              <span className="em-conta">{plural(g.cores, 'cor', 'cores')}</span>
              <span className={g.paraComprar ? 'em-alerta' : 'em-alerta nada'}>
                <i />
                {g.paraComprar}
              </span>
            </button>
            {aberto ? (
              <div className="em-tabuas em-dentro">
                {g.tecidos.map(t => {
                  const f = fornecedorDoGrupo(t.doEstoque, fornecimento)
                  return (
                    <button
                      type="button"
                      key={t.chave}
                      className="em-tabua"
                      data-tabua={t.nome}
                      onClick={() => aoEscolher(t.chave)}
                    >
                      <span className="em-tabua-nome">
                        <b>{t.nome}</b>
                        {f ? (
                          <small>{f.nome}</small>
                        ) : fornecimento.disponivel ? (
                          <small className="em-falta">falta escolher o fornecedor</small>
                        ) : null}
                      </span>
                      {/* cada cor é uma coluna (o vão e o número embaixo), e as colunas
                          quebram de linha: um tecido de vinte cores não empurra a
                          página para o lado */}
                      <span className="em-tabua-vaos">
                        {t.cores.map(m => (
                          <span key={m.id} className="em-vao-col">
                            <span className="em-vao-pe">
                              <VaoDoMaterial m={m} titulo={nomeInteiro(m)} />
                            </span>
                            <b className={m.livre < m.minimo ? 'pouco' : ''}>
                              {quantoNaUnidade(m.livre, m.unidade)}
                            </b>
                          </span>
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
