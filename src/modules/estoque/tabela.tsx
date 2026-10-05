import { Fragment, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { Vazio } from '@ds'
import {
  CATEGORIAS,
  NOME_DA_CATEGORIA,
  NOME_DA_SITUACAO_DO_MATERIAL,
  nomeNoGrupo,
  quantoNaUnidade,
  situacaoDoMaterial,
  type Categoria,
  type GrupoDoEstoque,
  type Material,
} from '@dominio/estoque'
import { fornecedorDoGrupo, fornecedorDoMaterial, plural, type Fornecimento } from './apoio'
import { Bola } from './vao'

/* ==========================================================================
   A tabela de materiais.

   Cinco colunas e três degraus de cinza: a faixa da categoria, a faixa da
   malha (um tom mais clara) e as cores dela em branco. Malha de uma cor só e
   material sem grupo não ganham faixa: viram uma linha direta, porque faixa
   em cima de uma linha só é um título explicando o óbvio.

   CLICAR NUMA LINHA DE MATERIAL ABRE O MOVIMENTO, que é o que se faz com um
   material numa tabela. Clicar numa faixa abre ou recolhe o que está embaixo.

   AS FAIXAS NASCEM FECHADAS (pedido do Henrique, 05/10/2026): a tabela abre
   com as três categorias, e quem abre é a pessoa. Com busca ou filtro ligado
   tudo o que sobrou vem aberto, porque aí o que sobrou é a resposta.
   ========================================================================== */

const COR_DA_SITUACAO = { comprar: 'var(--brand)', perto: 'var(--warn)', 'em-dia': '' } as const

function Situacao({ m }: { m: Material }) {
  const s = situacaoDoMaterial(m)
  if (s === 'em-dia') return <span className="es-situacao calma">{NOME_DA_SITUACAO_DO_MATERIAL[s]}</span>
  return (
    <span
      className={s === 'comprar' ? 'es-situacao comprar' : 'es-situacao'}
      style={{ '--c': COR_DA_SITUACAO[s] } as CSSProperties}
    >
      <i />
      {NOME_DA_SITUACAO_DO_MATERIAL[s]}
    </span>
  )
}

function ParaComprar({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="es-situacao comprar" style={{ '--c': 'var(--brand)' } as CSSProperties}>
      <i />
      {n} para comprar
    </span>
  )
}

function reservaEmPalavras(m: Material): string {
  if (m.reservado <= 0) return ''
  return `${quantoNaUnidade(m.reservado, m.unidade)} reservados para ${plural(m.pedidosReservando, 'pedido', 'pedidos')}`
}

export function TabelaDeMateriais({
  grupos,
  fornecimento,
  haMateriais,
  filtrando,
  aoAbrir,
}: {
  grupos: GrupoDoEstoque[]
  fornecimento: Fornecimento
  /** existe material no estoque, mesmo que o filtro não mostre nenhum */
  haMateriais: boolean
  /** há busca ou filtro ligado: aí as faixas vêm abertas */
  filtrando: boolean
  aoAbrir: (m: Material) => void
}) {
  /* o que a pessoa virou: sem filtro são as faixas que ela abriu, com filtro
     são as que ela fechou. Trocar de um para o outro começa do zero. */
  const [viradas, setViradas] = useState<Set<string>>(new Set())
  useEffect(() => setViradas(new Set()), [filtrando])
  const estaAberta = (chave: string) => viradas.has(chave) !== filtrando
  const virar = (chave: string) =>
    setViradas((antes) => {
      const novo = new Set(antes)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })

  if (!grupos.length) {
    return haMateriais ? (
      <Vazio titulo="Nada neste filtro" texto="Nenhum material combina com o que está escolhido." />
    ) : (
      <Vazio
        titulo="Nenhum material cadastrado"
        texto="O estoque nasce vazio. Cadastre a malha, o aviamento e o insumo que a fábrica guarda."
      />
    )
  }

  const linhaDoMaterial = (m: Material, dentroDeGrupo: boolean, fornecedor: string) => (
    <tr key={m.id} className="es-folha" onClick={() => aoAbrir(m)}>
      <td className={dentroDeGrupo ? 'es-recuo' : ''}>
        <span className="es-celula">
          <Bola cor={m.corHex} />
          <b>{dentroDeGrupo ? nomeNoGrupo(m) : m.categoria === 'tecido' ? m.tecido || m.nome : m.nome}</b>
          {!dentroDeGrupo && m.categoria === 'tecido' && m.cor ? <small>{m.cor}</small> : null}
          {reservaEmPalavras(m) ? <small>{reservaEmPalavras(m)}</small> : null}
        </span>
      </td>
      <td>{dentroDeGrupo ? '' : fornecedor}</td>
      <td className="dir">
        <b className={m.livre < m.minimo ? 'es-pouco' : ''}>{quantoNaUnidade(m.livre, m.unidade)}</b>
      </td>
      <td className="dir es-apoio">{quantoNaUnidade(m.minimo, m.unidade)}</td>
      <td>
        <Situacao m={m} />
      </td>
      <td>
        <span className="es-direita">
          <CaretRight size={16} className="es-chevron" />
        </span>
      </td>
    </tr>
  )

  return (
    <div className="tabela-rola">
      <table className="tabela es-tabela">
        <thead>
          <tr>
            <th>Material</th>
            <th>Fornecedor</th>
            <th className="dir">Livre</th>
            <th className="dir">Mínimo</th>
            <th>Situação</th>
            <th aria-label="Abrir" />
          </tr>
        </thead>
        <tbody>
          {CATEGORIAS.map((categoria: Categoria) => {
            const daCategoria = grupos.filter((g) => g.categoria === categoria)
            if (!daCategoria.length) return null
            const itens = daCategoria.reduce((s, g) => s + g.itens.length, 0)
            const comprar = daCategoria.reduce((s, g) => s + g.paraComprar, 0)
            const chave = 'cat:' + categoria
            const fechada = !estaAberta(chave)
            return (
              <Fragment key={categoria}>
                <tr
                  className="grupo es-recolhe"
                  data-faixa={NOME_DA_CATEGORIA[categoria]}
                  aria-expanded={!fechada}
                  onClick={() => virar(chave)}
                >
                  <td colSpan={4}>
                    <span className="es-grupo-nome">
                      {fechada ? <CaretRight size={14} /> : <CaretDown size={14} />}
                      <b>{NOME_DA_CATEGORIA[categoria]}</b>
                      {categoria === 'tecido'
                        ? `${plural(daCategoria.length, 'malha', 'malhas')}, ${plural(itens, 'cor', 'cores')}`
                        : plural(itens, 'material', 'materiais')}
                    </span>
                  </td>
                  <td colSpan={2}>
                    <ParaComprar n={comprar} />
                  </td>
                </tr>
                {fechada
                  ? null
                  : daCategoria.map((g) => {
                      const f = fornecedorDoGrupo(g, fornecimento)
                      const semGrupo = g.itens.length === 1
                      if (semGrupo) {
                        const m = g.itens[0]
                        return linhaDoMaterial(m, false, fornecedorDoMaterial(m, fornecimento)?.nome ?? '')
                      }
                      const aberta = estaAberta(g.chave)
                      return (
                        <Fragment key={g.chave}>
                          <tr className="es-malha es-recolhe" onClick={() => virar(g.chave)}>
                            <td>
                              <span className="es-celula">
                                {aberta ? <CaretDown size={14} /> : <CaretRight size={14} />}
                                <b>{g.nome}</b>
                                <small>
                                  {categoria === 'tecido'
                                    ? plural(g.itens.length, 'cor', 'cores')
                                    : plural(g.itens.length, 'material', 'materiais')}
                                </small>
                              </span>
                            </td>
                            <td>{f?.nome ?? ''}</td>
                            <td className="dir es-apoio">
                              {g.unidade ? quantoNaUnidade(g.livre, g.unidade) : ''}
                            </td>
                            <td />
                            <td colSpan={2}>
                              <ParaComprar n={g.paraComprar} />
                            </td>
                          </tr>
                          {aberta ? g.itens.map((m) => linhaDoMaterial(m, true, '')) : null}
                        </Fragment>
                      )
                    })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
