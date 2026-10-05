import { Fragment, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CaretRight, MapPin, X } from '@phosphor-icons/react'
import { Botao, Chip, Marcacao, Segmentado, Vazio } from '@ds'
import {
  CATEGORIAS,
  NOME_DA_SITUACAO_DO_MATERIAL,
  arvoreDeTecidos,
  gruposDeItens,
  gruposDoEstoque,
  nomeInteiro,
  nomeNoGrupo,
  quantoNaUnidade,
  situacaoDoMaterial,
  type Categoria,
  type Hierarquia,
  type Material,
} from '@dominio/estoque'
import {
  fornecedorDoGrupo,
  fornecedorDoMaterial,
  idsDosFornecedores,
  lugaresDe,
  plural,
  type Fornecimento,
  type Guardado,
} from './apoio'
import { Codigo, NOME_DA_ABA } from './arvore'
import { temFicha } from './ficha-tecnica'
import { EtiquetaDoLugar } from './frente'
import { Bola } from './vao'

/* ==========================================================================
   A tabela de materiais, em sanfona, com a seleção e o lote.

   É a prancha 41 do wireframe: as mesmas três abas da árvore, o grupo de
   tecido, o tecido e a cor em três degraus, e uma caixa de marcar em cada
   linha. Marcar o tecido marca as cores dele; marcar o grupo marca tudo.

   COM ALGUMA COISA MARCADA, a faixa preta aparece com o que dá para fazer de
   uma vez: o fornecedor, o mínimo, a ficha técnica e o lugar no depósito. É o
   "em bulk pelo método tabela" que o Henrique pediu (05/10/2026): trinta
   cores ganham a mesma ficha num gesto só.

   AS FAIXAS NASCEM FECHADAS (pedido dele no mesmo dia). Com busca ou filtro
   ligado, o que sobrou vem aberto, porque aí o que sobrou é a resposta.

   A TABELA É DO QUE HÁ NO ESTOQUE. O tecido do catálogo que ainda não tem cor
   nenhuma aparece na árvore da Lista, que é onde se cadastra a primeira.
   ========================================================================== */

export type FiltroDaTabela = '' | 'comprar' | 'sem-fornecedor' | 'sem-lugar' | 'sem-ficha'

/** o que a faixa de lote sabe fazer, e que a página executa */
export type AcaoDoLote = 'fornecedor' | 'minimo' | 'ficha' | 'lugar'

const COR_DA_SITUACAO = { comprar: 'var(--brand)', perto: 'var(--warn)', 'em-dia': '' } as const

function Situacao({ m }: { m: Material }) {
  const s = situacaoDoMaterial(m)
  if (s === 'em-dia')
    return <span className="es-situacao calma">{NOME_DA_SITUACAO_DO_MATERIAL[s]}</span>
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

/** a soma de uma coluna, só quando todos usam a mesma unidade */
function soma(itens: Material[], de: (m: Material) => number): string {
  if (!itens.length) return ''
  const unidade = itens[0].unidade
  if (itens.some(m => m.unidade !== unidade)) return ''
  return quantoNaUnidade(
    itens.reduce((s, m) => s + de(m), 0),
    unidade,
  )
}

type Faixa = {
  chave: string
  /** o código do grupo de tecido; ausente no grupo de aviamento e de insumo */
  cod?: string
  nome: string
  /** os tecidos do grupo; vazio quando a faixa é de itens */
  filhas: { chave: string; nome: string; itens: Material[] }[]
  itens: Material[]
}

export function TabelaDeMateriais({
  filtrados,
  haMateriais,
  termo,
  hierarquia,
  fornecimento,
  guardado,
  categoria,
  aoTrocarCategoria,
  filtro,
  aoFiltrar,
  podeEditar,
  aoAbrir,
  aoLote,
}: {
  /** os materiais que combinam com a busca */
  filtrados: Material[]
  /** existe material no estoque, mesmo que a busca não mostre nenhum */
  haMateriais: boolean
  termo: string
  hierarquia: Hierarquia
  fornecimento: Fornecimento
  guardado: Guardado
  categoria: Categoria
  aoTrocarCategoria: (c: Categoria) => void
  filtro: FiltroDaTabela
  aoFiltrar: (f: FiltroDaTabela) => void
  podeEditar: boolean
  /** abre a ficha do material, na Lista */
  aoAbrir: (m: Material) => void
  aoLote: (acao: AcaoDoLote, materiais: Material[]) => void
}) {
  const passa = useMemo(() => {
    const semFornecedor = (m: Material) =>
      idsDosFornecedores(fornecimento.ligacoes, m.id).length === 0
    const semLugar = (m: Material) => lugaresDe(guardado, m.id).length === 0
    return {
      comprar: (m: Material) => m.livre < m.minimo,
      'sem-fornecedor': semFornecedor,
      'sem-lugar': semLugar,
      'sem-ficha': (m: Material) => m.categoria === 'tecido' && !temFicha(m),
    }
  }, [fornecimento.ligacoes, guardado])

  const daAba = useMemo(
    () => filtrados.filter(m => m.categoria === categoria),
    [filtrados, categoria],
  )
  const linhas = useMemo(
    () => (filtro ? daAba.filter(passa[filtro]) : daAba),
    [daAba, filtro, passa],
  )
  const conta = useMemo(() => {
    const c: Record<Categoria, number> = { tecido: 0, aviamento: 0, insumo: 0 }
    for (const m of filtrados) if (!filtro || passa[filtro](m)) c[m.categoria] += 1
    return c
  }, [filtrados, filtro, passa])

  /* a busca e o filtro levam para a aba onde acharam, como na árvore */
  useEffect(() => {
    if ((!termo && !filtro) || conta[categoria] > 0) return
    const outra = CATEGORIAS.find(c => conta[c] > 0)
    if (outra) aoTrocarCategoria(outra)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, filtro, conta])

  const faixas = useMemo<Faixa[]>(() => {
    const grupos = gruposDoEstoque(linhas)
    if (categoria === 'tecido') {
      return arvoreDeTecidos(grupos, hierarquia).map(g => ({
        chave: 'g:' + g.cod,
        cod: g.cod,
        nome: g.nome,
        filhas: g.tecidos.map(t => ({ chave: 't:' + t.chave, nome: t.nome, itens: t.cores })),
        itens: g.tecidos.flatMap(t => t.cores),
      }))
    }
    return gruposDeItens(grupos, categoria).map(g => ({
      chave: 'i:' + g.chave,
      nome: g.nome,
      filhas: [],
      itens: g.itens,
    }))
  }, [linhas, categoria, hierarquia])

  /* --- abrir e fechar ---------------------------------------------------------
     Sem busca nem filtro, valem as faixas que a pessoa abriu. Com um dos dois,
     tudo vem aberto, e valem as que ela fechou. */
  const filtrando = !!termo || !!filtro
  const [viradas, setViradas] = useState<Set<string>>(new Set())
  useEffect(() => setViradas(new Set()), [filtrando])
  const aberta = (chave: string) => viradas.has(chave) !== filtrando
  const virar = (chave: string) =>
    setViradas(antes => {
      const novo = new Set(antes)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })

  /* --- a seleção ----------------------------------------------------------------
     Guarda os ids dos materiais. Quem sai da vista (troca de aba, de filtro, de
     busca) sai da seleção: lote em cima do que a pessoa não está vendo é o
     jeito de mudar trinta cores sem querer. */
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const aVista = useMemo(() => new Set(linhas.map(m => m.id)), [linhas])
  useEffect(() => {
    setMarcados(antes => {
      const fica = [...antes].filter(id => aVista.has(id))
      return fica.length === antes.size ? antes : new Set(fica)
    })
  }, [aVista])
  const marcar = (itens: Material[], ligar: boolean) =>
    setMarcados(antes => {
      const novo = new Set(antes)
      for (const m of itens) {
        if (ligar) novo.add(m.id)
        else novo.delete(m.id)
      }
      return novo
    })
  const quantos = (itens: Material[]) => itens.filter(m => marcados.has(m.id)).length
  const escolhidos = useMemo(() => linhas.filter(m => marcados.has(m.id)), [linhas, marcados])

  /* A caixa de marcar de uma linha. A célula segura o clique: sem isso ele
     sobe para a linha, que abre a faixa (ou marca a cor de novo, e desfaz). */
  const caixa = (itens: Material[], rotulo: string, cabeca = false) => {
    if (!podeEditar) return null
    const n = quantos(itens)
    const marcacao = (
      <Marcacao
        checked={n > 0 && n === itens.length}
        meio={n > 0 && n < itens.length}
        aria-label={rotulo}
        onChange={e => marcar(itens, e.currentTarget.checked)}
      />
    )
    return cabeca ? (
      <th className="es-ck">{marcacao}</th>
    ) : (
      <td className="es-ck" onClick={e => e.stopPropagation()}>
        {marcacao}
      </td>
    )
  }

  /* o resumo da faixa preta: "6 cores de PIQUET COM ELASTANO e 2 de DRYFIT" */
  const resumo = useMemo(() => {
    if (!escolhidos.length) return ''
    const porGrupo = new Map<string, number>()
    for (const m of escolhidos) {
      const nome = m.categoria === 'tecido' ? m.tecido || m.nome : m.grupo || 'sem grupo'
      porGrupo.set(nome, (porGrupo.get(nome) ?? 0) + 1)
    }
    const partes = [...porGrupo.entries()].map(([nome, n], i) =>
      i === 0
        ? `${plural(n, categoria === 'tecido' ? 'cor' : 'item', categoria === 'tecido' ? 'cores' : 'itens')} de ${nome}`
        : `${n} de ${nome}`,
    )
    if (partes.length <= 2) return partes.join(' e ')
    return partes.slice(0, 2).join(', ') + ' e de mais ' + (partes.length - 2)
  }, [escolhidos, categoria])

  const chips: { valor: FiltroDaTabela; nome: string; cor?: string }[] = [
    { valor: 'comprar', nome: 'Para comprar', cor: 'var(--brand)' },
    ...(fornecimento.disponivel
      ? [{ valor: 'sem-fornecedor' as const, nome: 'Sem fornecedor' }]
      : []),
    ...(guardado.planta ? [{ valor: 'sem-lugar' as const, nome: 'Sem lugar marcado' }] : []),
    ...(categoria === 'tecido' ? [{ valor: 'sem-ficha' as const, nome: 'Sem ficha técnica' }] : []),
  ]
  const contaDoChip = (f: Exclude<FiltroDaTabela, ''>) => daAba.filter(passa[f]).length

  const linhaDoMaterial = (m: Material, degrau: 1 | 2, doTecido: string) => {
    const dele = fornecedorDoMaterial(m, fornecimento)
    const lugar = lugaresDe(guardado, m.id)[0]
    const pouco = m.livre < m.minimo
    const marcado = marcados.has(m.id)
    return (
      <tr
        key={m.id}
        className={marcado ? 'es-folha marcada' : 'es-folha'}
        data-material={m.nome}
        onClick={podeEditar ? () => marcar([m], !marcado) : () => aoAbrir(m)}
      >
        {caixa([m], 'Marcar ' + nomeInteiro(m))}
        <td className={degrau === 2 ? 'es-degrau-2' : 'es-degrau-1'}>
          <span className="es-celula">
            <Bola cor={m.corHex} />
            <b>{nomeNoGrupo(m)}</b>
          </span>
        </td>
        <td>
          {!fornecimento.disponivel ? (
            ''
          ) : dele ? (
            /* o fornecedor igual ao do tecido vem apagado; o que é só desta cor,
               na tinta cheia, para o olho achar a exceção */
            <span
              className={dele.id === doTecido ? 'es-apoio' : 'es-forn'}
              title={
                doTecido && dele.id !== doTecido
                  ? dele.nome + ': só esta cor vem deste fornecedor'
                  : dele.nome
              }
            >
              {dele.nome}
            </span>
          ) : (
            <span className="es-falta">falta escolher</span>
          )}
        </td>
        {guardado.planta ? (
          <td className="es-some-2">
            <EtiquetaDoLugar movel={lugar?.movel} lugar={lugar?.lugar} />
          </td>
        ) : null}
        <td className="dir">
          <b className={pouco ? 'es-pouco' : ''}>{quantoNaUnidade(m.livre, m.unidade)}</b>
        </td>
        <td className="dir es-apoio es-some-1">{quantoNaUnidade(m.saldo, m.unidade)}</td>
        <td className="dir es-apoio es-some-1">
          {m.reservado > 0 ? quantoNaUnidade(m.reservado, m.unidade) : ''}
        </td>
        <td className="dir es-apoio">{quantoNaUnidade(m.minimo, m.unidade)}</td>
        <td>
          <span className="es-fim-da-linha">
            <Situacao m={m} />
            <button
              type="button"
              className="es-abrir"
              aria-label={'Abrir a ficha de ' + nomeInteiro(m)}
              title="Abrir a ficha"
              onClick={e => {
                e.stopPropagation()
                aoAbrir(m)
              }}
            >
              <CaretRight size={16} />
            </button>
          </span>
        </td>
      </tr>
    )
  }

  const linhaDaFaixa = (
    chave: string,
    degrau: 0 | 1,
    texto: string,
    nome: ReactNode,
    itens: Material[],
    apoio: string,
  ) => {
    const ab = aberta(chave)
    const f = fornecedorDoGrupo({ itens }, fornecimento)
    const quem = new Set(itens.flatMap(m => idsDosFornecedores(fornecimento.ligacoes, m.id)))
    const lugares = [
      ...new Set(
        itens.flatMap(m => {
          const l = lugaresDe(guardado, m.id)[0]
          return l ? [l.movel.nome] : []
        }),
      ),
    ]
    return (
      <tr
        key={chave}
        className={degrau === 0 ? 'grupo es-do-grupo es-recolhe' : 'es-malha es-recolhe'}
        data-faixa={texto}
        aria-expanded={ab}
        onClick={() => virar(chave)}
      >
        {caixa(itens, 'Marcar tudo de ' + texto)}
        <td className={degrau === 1 ? 'es-degrau-1' : ''}>
          <span className="es-celula">
            <CaretRight size={14} weight="bold" className={ab ? 'em-seta aberta' : 'em-seta'} />
            {nome}
            <small>{apoio}</small>
          </span>
        </td>
        <td>
          {!fornecimento.disponivel ? (
            ''
          ) : degrau === 0 ? (
            <span className="es-apoio">
              {quem.size ? plural(quem.size, 'fornecedor', 'fornecedores') : ''}
            </span>
          ) : f ? (
            <span className="es-forn-e-mais" title={f.nome}>
              <b className="es-forn">{f.nome}</b>
              {quem.size > 1 ? <small>+{quem.size - 1}</small> : null}
            </span>
          ) : (
            <span className="es-falta">falta escolher</span>
          )}
        </td>
        {guardado.planta ? (
          <td className="es-apoio es-some-2">
            {lugares.slice(0, 3).join(', ')}
            {lugares.length > 3 ? ' +' + (lugares.length - 3) : ''}
          </td>
        ) : null}
        <td className="dir">
          <b>{soma(itens, m => m.livre)}</b>
        </td>
        <td className="dir es-apoio es-some-1">{soma(itens, m => m.saldo)}</td>
        <td className="dir es-apoio es-some-1">
          {itens.some(m => m.reservado > 0) ? soma(itens, m => m.reservado) : ''}
        </td>
        <td />
        <td>
          <ParaComprar n={itens.filter(m => m.livre < m.minimo).length} />
        </td>
      </tr>
    )
  }

  return (
    <div className="es-tb-caixa">
      <div className="es-tb-topo" data-tabela-topo="">
        <Segmentado
          className="em-seg"
          valor={categoria}
          aoMudar={aoTrocarCategoria}
          opcoes={CATEGORIAS.map(c => ({
            valor: c,
            rotulo: (
              <>
                {NOME_DA_ABA[c]} <small>{conta[c]}</small>
              </>
            ),
          }))}
        />
        <div className="fileira">
          {chips.map(c => (
            <Chip
              key={c.valor}
              cor={c.cor}
              ligado={filtro === c.valor}
              onClick={() => aoFiltrar(filtro === c.valor ? '' : c.valor)}
            >
              {c.nome}{' '}
              <span className="es-conta">
                {contaDoChip(c.valor as Exclude<FiltroDaTabela, ''>)}
              </span>
            </Chip>
          ))}
        </div>
      </div>

      {escolhidos.length ? (
        <div
          className="es-lote"
          data-lote-da-tabela=""
          role="region"
          aria-label="O que fazer com os marcados"
        >
          <span className="es-lote-conta">
            <b>{plural(escolhidos.length, 'selecionado', 'selecionados')}</b>
            <small>{resumo}</small>
          </span>
          <div className="fileira">
            {fornecimento.disponivel ? (
              <Botao tamanho="sm" onClick={() => aoLote('fornecedor', escolhidos)}>
                Definir fornecedor
              </Botao>
            ) : null}
            <Botao tamanho="sm" onClick={() => aoLote('minimo', escolhidos)}>
              Definir mínimo
            </Botao>
            {categoria === 'tecido' ? (
              <Botao tamanho="sm" onClick={() => aoLote('ficha', escolhidos)}>
                Ficha técnica
              </Botao>
            ) : null}
            {guardado.planta ? (
              <Botao tamanho="sm" onClick={() => aoLote('lugar', escolhidos)}>
                <MapPin size={15} aria-hidden="true" />
                Definir onde está
              </Botao>
            ) : null}
            <Botao tamanho="sm" onClick={() => setMarcados(new Set())}>
              <X size={15} aria-hidden="true" />
              Limpar a seleção
            </Botao>
          </div>
        </div>
      ) : null}

      {!faixas.length ? (
        haMateriais ? (
          <Vazio
            titulo={filtrando ? 'Nada neste filtro' : 'Nada cadastrado nesta aba'}
            texto={
              filtrando
                ? 'Nenhum material combina com o que está escolhido.'
                : 'O que for cadastrado como ' +
                  NOME_DA_ABA[categoria].toLowerCase() +
                  ' aparece aqui.'
            }
          />
        ) : (
          <Vazio
            titulo="Nenhum material cadastrado"
            texto="O estoque nasce vazio. Cadastre a malha, o aviamento e o insumo que a fábrica guarda."
          />
        )
      ) : (
        <div className="tabela-rola">
          <table className="tabela es-tabela es-tb" data-tabela="">
            <thead>
              <tr>
                {caixa(linhas, 'Marcar tudo o que está à vista', true)}
                <th>{categoria === 'tecido' ? 'Grupo, tecido e cor' : 'Grupo e item'}</th>
                <th className="es-c-forn">Fornecedor</th>
                {/* sem depósito desenhado não há lugar para mostrar: a coluna não nasce vazia */}
                {guardado.planta ? <th className="es-c-onde es-some-2">Onde está</th> : null}
                <th className="dir es-c-num">Livre</th>
                <th className="dir es-c-prat es-some-1">Na prateleira</th>
                <th className="dir es-c-res es-some-1">Reservado</th>
                <th className="dir es-c-num">Mínimo</th>
                <th className="es-c-sit">Situação</th>
              </tr>
            </thead>
            <tbody>
              {faixas.map(g => (
                <Fragment key={g.chave}>
                  {linhaDaFaixa(
                    g.chave,
                    0,
                    g.nome,
                    <>
                      {g.cod !== undefined ? <Codigo cod={g.cod} /> : null}
                      <b>{g.nome}</b>
                    </>,
                    g.itens,
                    g.filhas.length
                      ? `${plural(g.filhas.length, 'tecido', 'tecidos')} · ${plural(g.itens.length, 'cor', 'cores')}`
                      : plural(g.itens.length, 'item', 'itens'),
                  )}
                  {!aberta(g.chave)
                    ? null
                    : g.filhas.length
                      ? g.filhas.map(t => {
                          const doTecido =
                            fornecedorDoGrupo({ itens: t.itens }, fornecimento)?.id ?? ''
                          return (
                            <Fragment key={t.chave}>
                              {linhaDaFaixa(
                                t.chave,
                                1,
                                t.nome,
                                <b>{t.nome}</b>,
                                t.itens,
                                plural(t.itens.length, 'cor', 'cores'),
                              )}
                              {aberta(t.chave)
                                ? t.itens.map(m => linhaDoMaterial(m, 2, doTecido))
                                : null}
                            </Fragment>
                          )
                        })
                      : g.itens.map(m => linhaDoMaterial(m, 1, ''))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
