import type { ReactNode } from 'react'
import { CaretRight, Plus } from '@phosphor-icons/react'
import { Botao, Nivel, Segmentado, Vazio } from '@ds'
import {
  CATEGORIAS,
  nivel,
  nomeNoGrupo,
  quantoNaUnidade,
  somaPorUnidade,
  type Categoria,
  type GrupoDeItens,
  type GrupoNaArvore,
  type Material,
  type TecidoNaArvore,
} from '@dominio/estoque'
import {
  fornecedorDoGrupo,
  fornecedorDoMaterial,
  fornecedorProprio,
  lugaresDe,
  plural,
  type Fornecimento,
  type Guardado,
} from './apoio'
import { EtiquetaDoLugar } from './frente'
import { Bola } from './vao'

/* ==========================================================================
   A primeira coluna: as três abas e a sanfona.

   Tecido, Aviamentos e Insumo não se misturam mais: cada um é uma aba, e
   Tecido é a da frente. Dentro, a hierarquia do catálogo, tudo em sanfona: o
   grupo (com o código, como ALG e PIQ), os tecidos do grupo e as cores de
   cada tecido. Aviamento e insumo têm dois degraus: o grupo e o item.

   ABRIR NÃO É ESCOLHER. A seta abre e fecha a gaveta; o clique no nome do
   tecido ou na cor escolhe, e aí o lado direito da página vira a ficha. Dá
   para abrir três tecidos e comparar as cores sem sair da visão geral.

   O TECIDO DO CATÁLOGO APARECE MESMO SEM ESTOQUE (04/10/2026): apagado, com
   "sem estoque" e o atalho "Nova cor". Ele não tem seta, porque não há cor
   para abrir; o nome abre a ficha dele, que convida a cadastrar a primeira.
   ========================================================================== */

export const NOME_DA_ABA: Record<Categoria, string> = {
  tecido: 'Tecido',
  aviamento: 'Aviamentos',
  insumo: 'Insumo',
}

/** a chave de um material escolhido, para não confundir com a do tecido */
export const chaveDoMaterial = (id: string) => 'material:' + id

function Alerta({ n }: { n: number }) {
  return (
    <span
      className={n ? 'em-alerta' : 'em-alerta nada'}
      aria-label={n ? n + ' para comprar' : undefined}
    >
      <i />
      {n}
    </span>
  )
}

function Seta({ aberto }: { aberto: boolean }) {
  return <CaretRight size={14} weight="bold" className={aberto ? 'em-seta aberta' : 'em-seta'} />
}

/** o código do grupo de tecido: ALG, PIQ, ou S/T quando o tecido não tem tipo */
export function Codigo({ cod }: { cod: string }) {
  return <span className={cod ? 'em-cod' : 'em-cod sem'}>{cod || 'S/T'}</span>
}

/* A linha de uma cor ou de um item: a bola, o nome, o fornecedor quando é
   outro, o lugar, a barra de nível e o livre. */
export function LinhaDoMaterial({
  m,
  nome,
  apoio,
  guardado,
  escolhido,
  comBola,
  aoEscolher,
}: {
  m: Material
  nome: string
  apoio?: ReactNode
  guardado: Guardado
  escolhido: boolean
  comBola: boolean
  aoEscolher: () => void
}) {
  const comprar = m.livre < m.minimo
  const lugar = lugaresDe(guardado, m.id)[0]
  return (
    <button
      type="button"
      className={['em-c', comBola ? '' : 'em-item', escolhido ? 'em-sel' : '']
        .filter(Boolean)
        .join(' ')}
      aria-pressed={escolhido}
      data-material={m.nome}
      onClick={aoEscolher}
    >
      {comBola ? <Bola cor={m.corHex} /> : null}
      <span className="em-nomes">
        <b>{nome}</b>
        {apoio}
      </span>
      {guardado.planta ? (
        <EtiquetaDoLugar movel={lugar?.movel} lugar={lugar?.lugar} semIcone />
      ) : null}
      <Nivel
        fixa
        valor={nivel(m)}
        cor={comprar ? 'var(--brand)' : 'var(--ink)'}
        titulo={`livre ${quantoNaUnidade(m.livre, m.unidade)} de um mínimo de ${quantoNaUnidade(m.minimo, m.unidade)}`}
      />
      <span className={comprar ? 'em-q pouco' : 'em-q'}>{quantoNaUnidade(m.livre, m.unidade)}</span>
    </button>
  )
}

export function Arvore({
  categoria,
  aoTrocarCategoria,
  contagem,
  tecidos,
  itens,
  fornecimento,
  guardado,
  abertos,
  aoAbrir,
  escolhido,
  aoEscolher,
  buscando,
  podeEditar,
  aoNovaCor,
}: {
  categoria: Categoria
  aoTrocarCategoria: (c: Categoria) => void
  /** quantos materiais em cada aba, já com a busca aplicada */
  contagem: Record<Categoria, number>
  tecidos: GrupoNaArvore[]
  /** os grupos da aba de aviamento ou de insumo que está à vista */
  itens: GrupoDeItens[]
  fornecimento: Fornecimento
  guardado: Guardado
  /** as gavetas abertas: g:<código>, t:<chave do tecido>, i:<chave do grupo> */
  abertos: Set<string>
  aoAbrir: (chave: string) => void
  escolhido: string
  aoEscolher: (chave: string) => void
  buscando: boolean
  podeEditar: boolean
  /** cadastrar a primeira cor de um tecido que ainda não tem estoque */
  aoNovaCor: (t: TecidoNaArvore) => void
}) {
  const vazio = categoria === 'tecido' ? tecidos.length === 0 : itens.length === 0

  return (
    <section className="cartao em-col em-arvore" data-arvore="">
      <div className="em-abas">
        <Segmentado
          className="em-seg"
          valor={categoria}
          aoMudar={aoTrocarCategoria}
          opcoes={CATEGORIAS.map(c => ({
            valor: c,
            rotulo: (
              <>
                {NOME_DA_ABA[c]} <small>{contagem[c]}</small>
              </>
            ),
          }))}
        />
      </div>

      {vazio ? (
        <Vazio
          titulo={buscando ? 'Nada com esse nome nesta aba' : 'Nada cadastrado nesta aba'}
          texto={
            buscando
              ? 'A busca procura pelo nome, pela malha, pela cor, pelo grupo e pelo fornecedor.'
              : 'O que for cadastrado como ' +
                NOME_DA_ABA[categoria].toLowerCase() +
                ' aparece aqui.'
          }
        />
      ) : categoria === 'tecido' ? (
        tecidos.map(g => {
          const aberto = abertos.has('g:' + g.cod)
          return (
            <div key={g.cod || 'sem-tipo'} className="em-gaveta">
              <button
                type="button"
                className={aberto ? 'em-g aberto' : 'em-g'}
                aria-expanded={aberto}
                data-grupo={g.nome}
                onClick={() => aoAbrir('g:' + g.cod)}
              >
                <Seta aberto={aberto} />
                <Codigo cod={g.cod} />
                <b>{g.nome}</b>
                <span className="em-conta">
                  {plural(g.tecidos.length, 'tecido', 'tecidos')} ·{' '}
                  {g.cores ? plural(g.cores, 'cor', 'cores') : 'sem estoque'}
                </span>
                <Alerta n={g.paraComprar} />
              </button>
              {aberto ? (
                <div className="em-dentro">
                  {g.tecidos.map(t =>
                    t.cores.length ? (
                      <Tecido
                        key={t.chave}
                        t={t}
                        aberto={abertos.has('t:' + t.chave)}
                        fornecimento={fornecimento}
                        guardado={guardado}
                        escolhido={escolhido}
                        aoAbrir={() => aoAbrir('t:' + t.chave)}
                        aoEscolher={aoEscolher}
                      />
                    ) : (
                      <TecidoSemEstoque
                        key={t.chave}
                        t={t}
                        escolhido={escolhido === t.chave}
                        aoEscolher={() => aoEscolher(t.chave)}
                        aoNovaCor={podeEditar ? () => aoNovaCor(t) : undefined}
                      />
                    ),
                  )}
                </div>
              ) : null}
            </div>
          )
        })
      ) : (
        itens.map(g => {
          const aberto = abertos.has('i:' + g.chave)
          return (
            <div key={g.chave} className="em-gaveta">
              <button
                type="button"
                className={aberto ? 'em-g aberto' : 'em-g'}
                aria-expanded={aberto}
                data-grupo={g.nome}
                onClick={() => aoAbrir('i:' + g.chave)}
              >
                <Seta aberto={aberto} />
                <b>{g.nome}</b>
                <span className="em-conta">{plural(g.itens.length, 'item', 'itens')}</span>
                <Alerta n={g.paraComprar} />
              </button>
              {aberto ? (
                <div className="em-cores em-dentro">
                  {g.itens.map(m => {
                    const f = fornecedorDoMaterial(m, fornecimento)
                    return (
                      <LinhaDoMaterial
                        key={m.id}
                        m={m}
                        nome={m.nome}
                        comBola={false}
                        guardado={guardado}
                        escolhido={escolhido === chaveDoMaterial(m.id)}
                        aoEscolher={() => aoEscolher(chaveDoMaterial(m.id))}
                        apoio={
                          f ? (
                            <small>{f.nome}</small>
                          ) : fornecimento.disponivel ? (
                            <small className="em-falta">falta escolher o fornecedor</small>
                          ) : null
                        }
                      />
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })
      )}
    </section>
  )
}

/* O tecido do catálogo que ainda não tem cor nenhuma no estoque: sem seta (não
   há o que abrir), o nome apagado e "sem estoque" embaixo. O nome abre a ficha
   e, para quem edita, "Nova cor" cadastra a primeira já neste tecido. */
function TecidoSemEstoque({
  t,
  escolhido,
  aoEscolher,
  aoNovaCor,
}: {
  t: TecidoNaArvore
  escolhido: boolean
  aoEscolher: () => void
  aoNovaCor?: () => void
}) {
  return (
    <div
      className={escolhido ? 'em-t em-sem em-sel' : 'em-t em-sem'}
      data-tecido={t.nome}
      data-sem-estoque=""
    >
      <span className="em-t-seta" aria-hidden="true" />
      <button type="button" className="em-t-nome" aria-pressed={escolhido} onClick={aoEscolher}>
        <span className="em-nomes">
          <b>{t.nome}</b>
          <small>sem estoque</small>
        </span>
      </button>
      {aoNovaCor ? (
        <Botao
          tamanho="sm"
          className="em-t-nova"
          aria-label={'Nova cor de ' + t.nome}
          onClick={aoNovaCor}
        >
          <Plus size={14} weight="bold" aria-hidden="true" />
          Nova cor
        </Botao>
      ) : null}
    </div>
  )
}

/* O tecido: a seta abre as cores, e o nome escolhe o tecido. São dois botões
   lado a lado, e não um dentro do outro. */
function Tecido({
  t,
  aberto,
  fornecimento,
  guardado,
  escolhido,
  aoAbrir,
  aoEscolher,
}: {
  t: TecidoNaArvore
  aberto: boolean
  fornecimento: Fornecimento
  guardado: Guardado
  escolhido: string
  aoAbrir: () => void
  aoEscolher: (chave: string) => void
}) {
  const doTecido = fornecedorDoGrupo(t.doEstoque, fornecimento)
  const deOutro = t.cores.filter(m => fornecedorProprio(m, doTecido, fornecimento)).length
  const eu = escolhido === t.chave
  return (
    <>
      <div className={eu ? 'em-t em-sel' : 'em-t'} data-tecido={t.nome}>
        <button
          type="button"
          className="em-t-seta"
          aria-expanded={aberto}
          aria-label={(aberto ? 'Fechar as cores de ' : 'Abrir as cores de ') + t.nome}
          onClick={aoAbrir}
        >
          <Seta aberto={aberto} />
        </button>
        <button
          type="button"
          className="em-t-nome"
          aria-pressed={eu}
          onClick={() => aoEscolher(t.chave)}
        >
          <span className="em-nomes">
            <b>{t.nome}</b>
            {doTecido ? (
              <small>
                {doTecido.nome}
                {deOutro ? ' · ' + plural(deOutro, 'cor de outro', 'cores de outro') : ''}
              </small>
            ) : fornecimento.disponivel ? (
              <small className="em-falta">falta escolher o fornecedor</small>
            ) : null}
          </span>
          <span className="em-fim">
            <b>{somaPorUnidade(t.cores, 'livre')}</b>
            <small>{plural(t.cores.length, 'cor', 'cores')}</small>
          </span>
          <Alerta n={t.paraComprar} />
        </button>
      </div>
      {aberto ? (
        <div className="em-cores em-dentro">
          {t.cores.map(m => {
            const dele = fornecedorProprio(m, doTecido, fornecimento)
            return (
              <LinhaDoMaterial
                key={m.id}
                m={m}
                nome={nomeNoGrupo(m)}
                comBola
                guardado={guardado}
                escolhido={escolhido === chaveDoMaterial(m.id)}
                aoEscolher={() => aoEscolher(chaveDoMaterial(m.id))}
                apoio={dele ? <small>{dele.nome}</small> : null}
              />
            )
          })}
        </div>
      ) : null}
    </>
  )
}
