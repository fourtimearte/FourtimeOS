import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { CalendarBlank, CaretRight, ChartBar, ShoppingCart } from '@phosphor-icons/react'
import { Botao, Kpi, Segmentado, TituloCartao, Vazio } from '@ds'
import {
  CATEGORIAS,
  NOME_DO_PERIODO,
  PERIODO_POR_EXTENSO,
  coberturaPorExtenso,
  nomeInteiro,
  nomeNoGrupo,
  prioridadeDeCompra,
  quantoNaUnidade,
  soONumero,
  usoDaCategoria,
  usoMesAMes,
  usoPorMes,
  type Categoria,
  type Hierarquia,
  type Material,
  type Periodo,
  type UsoDaCor,
  type UsoDoMaterial,
} from '@dominio/estoque'
import { plural } from './apoio'
import { Codigo, NOME_DA_ABA } from './arvore'
import { Bola } from './vao'
import './estatisticas.css'

/* ==========================================================================
   Estatísticas: quanto saiu do estoque, por tecido e cor, ou por grupo e item.

   Pedido do Henrique (05/10/2026): "como saber a prioridade de compra de
   tecido? Preciso de uma tela de estatística com a quantidade de tecido usado
   dividido por tecido e por cor do tecido no mês, 3 meses, semestre". No mesmo
   dia: "sim, quero estatísticas de insumo e aviamentos".

   SÃO TRÊS RESPOSTAS NA MESMA TELA:
     1. o que mais sai (a lista, que abre nas cores ou nos itens);
     2. o que acaba antes (a prioridade de compra, pela cobertura);
     3. se o ritmo está subindo ou descendo (o mês a mês).

   USO É O QUE SAIU PARA PRODUZIR: a separação e a saída, menos o que voltou
   em devolução. A entrada e o ajuste de inventário não contam. A conta mora
   no banco (uso_do_estoque, migração 049); aqui só se ordena e se desenha.

   OS PERÍODOS SÃO JANELAS QUE ANDAM: os últimos 30, 90 e 180 dias contados de
   hoje, e não o mês do calendário. No dia 3 o "mês" do calendário teria três
   dias, e a prioridade de compra viraria ruído.

   UMA RÉGUA POR UNIDADE: a barra de um tecido e a de uma cor usam a mesma
   escala (o tecido que mais saiu enche a barra), para a cor ser lida como
   parte do tecido dela. Em aviamento e insumo as unidades se misturam (cone,
   unidade, litro), e a barra só compara quem usa a mesma: quilo não se mede
   contra botão. Pelo mesmo motivo essas duas abas não têm "total usado", e o
   mês a mês delas vem um por unidade.
   ========================================================================== */

/** abaixo disto a cobertura é urgente; abaixo de 30, pede atenção */
const DIAS_CURTOS = 15
const DIAS_DE_ATENCAO = 30
const NA_PRIORIDADE = 8
/** com mais cores paradas do que isto num tecido, elas ficam atrás de um botão */
const MAXIMO_DE_PARADAS = 4
/** no mês a mês de aviamento e insumo, quantas unidades ganham gráfico */
const MAXIMO_DE_SERIES = 3

const NOME_DA_COISA: Record<Categoria, string> = {
  tecido: 'tecido',
  aviamento: 'aviamento',
  insumo: 'insumo',
}

function tomDaCobertura(dias: number): '' | 'curta' | 'media' {
  if (dias < DIAS_CURTOS) return 'curta'
  if (dias < DIAS_DE_ATENCAO) return 'media'
  return ''
}

/** "9 dias" vira ["9", "dias"], para o número grande do cartão */
function coberturaEmNumero(dias: number): [string, string] {
  if (dias < 60) {
    const n = Math.max(0, Math.round(dias))
    return [String(n), n === 1 ? 'dia' : 'dias']
  }
  const meses = Math.round(dias / 30)
  return [String(meses), 'meses']
}

function Barra({ parte, forte }: { parte: number; forte?: boolean }) {
  return (
    <span className={forte ? 'eu-barra forte' : 'eu-barra'} aria-hidden="true">
      <i style={{ '--eu-parte': Math.max(0, Math.min(100, parte)) + '%' } as CSSProperties} />
    </span>
  )
}

function Cobertura({ c, livre, unidade }: { c: number; livre: number; unidade: string }) {
  const tom = tomDaCobertura(c)
  return (
    <span className="eu-cobertura">
      <small>livre {quantoNaUnidade(livre, unidade)}</small>
      {Number.isFinite(c) ? (
        <b className={tom ? 'eu-dias ' + tom : 'eu-dias'}>
          {c > 0 ? 'dá para ' + coberturaPorExtenso(c) : coberturaPorExtenso(c)}
        </b>
      ) : (
        <span className="eu-dias parada">{coberturaPorExtenso(c)}</span>
      )}
    </span>
  )
}

export function Estatisticas({
  materiais,
  filtrados,
  termo,
  usos,
  hierarquia,
  categoria,
  aoTrocarCategoria,
  periodo,
  aoTrocarPeriodo,
  comPeriodo,
  aoAbrir,
}: {
  /** todos os materiais do estoque */
  materiais: Material[]
  /** os que combinam com a busca */
  filtrados: Material[]
  termo: string
  usos: UsoDoMaterial[]
  hierarquia: Hierarquia
  categoria: Categoria
  aoTrocarCategoria: (c: Categoria) => void
  periodo: Periodo
  aoTrocarPeriodo: (p: Periodo) => void
  /** a tela estreita não tem lugar para o período na barra: ele vem aqui */
  comPeriodo: boolean
  aoAbrir: (m: Material) => void
}) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [todaAPrioridade, setTodaAPrioridade] = useState(false)
  const ehTecido = categoria === 'tecido'

  const conta = useMemo(() => {
    const c: Record<Categoria, number> = { tecido: 0, aviamento: 0, insumo: 0 }
    for (const m of filtrados) c[m.categoria] += 1
    return c
  }, [filtrados])
  /* a busca leva para a aba onde achou, como na árvore e na tabela */
  useEffect(() => {
    if (!termo || conta[categoria] > 0) return
    const outra = CATEGORIAS.find(c => conta[c] > 0)
    if (outra) aoTrocarCategoria(outra)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, conta])

  const tudo = useMemo(
    () => usoDaCategoria(materiais, usos, periodo, categoria, hierarquia),
    [materiais, usos, periodo, categoria, hierarquia],
  )
  const lista = useMemo(
    () => (termo ? usoDaCategoria(filtrados, usos, periodo, categoria, hierarquia) : tudo),
    [termo, filtrados, usos, periodo, categoria, hierarquia, tudo],
  )
  const itens = useMemo(() => tudo.flatMap(t => t.cores), [tudo])
  const saiu = itens.filter(c => c.usado > 0)
  /* só o tecido tem total: é tudo quilo */
  const total = ehTecido ? tudo.reduce((s, t) => s + t.usado, 0) : 0
  const maior = tudo[0]?.usado ?? 0
  /* a régua de cada unidade: o maior grupo (ou o maior item, no grupo misto) */
  const regua = useMemo(() => {
    const r = new Map<string, number>()
    const sobe = (unidade: string, v: number) => {
      if (v > (r.get(unidade) ?? 0)) r.set(unidade, v)
    }
    for (const t of tudo) {
      if (t.unidade) sobe(t.unidade, t.usado)
      for (const c of t.cores) sobe(c.m.unidade, c.usado)
    }
    return r
  }, [tudo])
  const parte = (usado: number, unidade: string) => {
    const teto = regua.get(unidade) ?? 0
    return teto ? (usado / teto) * 100 : 0
  }
  const prioridade = useMemo(() => prioridadeDeCompra(lista), [lista])
  const urgente = useMemo(() => prioridadeDeCompra(tudo), [tudo])
  const acabando = urgente.filter(c => c.cobertura < DIAS_DE_ATENCAO)
  const paradas = itens.filter(c => c.usado === 0 && c.m.livre > 0)
  const series = useMemo(() => usoMesAMes(materiais, usos, categoria), [materiais, usos, categoria])

  const virar = (chave: string) =>
    setAbertos(antes => {
      const novo = new Set(antes)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  /* com busca, o que sobrou vem aberto: é a resposta */
  const aberto = (chave: string) => abertos.has(chave) !== !!termo

  const um = ehTecido ? 'cor' : 'item'
  const varios = ehTecido ? 'cores' : 'itens'
  const coisa = NOME_DA_COISA[categoria]

  const alto = (
    <div className="eu-alto" data-estatisticas-alto="">
      <Segmentado
        className="em-seg eu-categoria"
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
      {comPeriodo ? (
        <Segmentado
          className="eu-periodo"
          valor={periodo}
          aoMudar={aoTrocarPeriodo}
          opcoes={(['d30', 'd90', 'd180'] as Periodo[]).map(p => ({
            valor: p,
            rotulo: NOME_DO_PERIODO[p],
          }))}
        />
      ) : null}
    </div>
  )

  if (!materiais.some(m => m.categoria === categoria)) {
    return (
      <>
        {alto}
        <section className="cartao es-quadro" data-estatisticas="">
          <Vazio
            titulo={'Nenhum ' + coisa + ' no estoque'}
            texto="As estatísticas contam o que sai para a produção. Elas aparecem depois que houver material cadastrado e separado."
          />
        </section>
      </>
    )
  }

  const linhaDaPrioridade = (c: UsoDaCor) => {
    const tom = tomDaCobertura(c.cobertura)
    const u = c.m.unidade
    return (
      <button
        type="button"
        key={c.m.id}
        className="eu-pri"
        data-material={c.m.nome}
        onClick={() => aoAbrir(c.m)}
      >
        <Bola cor={c.m.corHex} />
        <span className="eu-pri-texto">
          <b>{nomeInteiro(c.m)}</b>
          <small>
            livre {quantoNaUnidade(c.m.livre, u)} · saem{' '}
            {quantoNaUnidade(usoPorMes(c.usado, periodo), u)} por mês
            {c.m.livre < c.m.minimo ? ' · abaixo do mínimo' : ''}
          </small>
        </span>
        <span className={tom ? 'eu-pri-dias ' + tom : 'eu-pri-dias'}>
          {coberturaPorExtenso(c.cobertura)}
        </span>
      </button>
    )
  }

  const primeiro = urgente[0]
  const [dura, emQue] = primeiro ? coberturaEmNumero(primeiro.cobertura) : ['0', varios]

  return (
    <>
      {alto}
      <div className="eu-numeros">
        <div className="fila-kpi eu-kpis" data-numeros="">
          {ehTecido ? (
            <>
              <Kpi
                rotulo="Tecido usado"
                valor={soONumero(total, 'kg')}
                unidade="kg"
                sub={PERIODO_POR_EXTENSO[periodo]}
              />
              <Kpi
                rotulo="O tecido que mais sai"
                valor={maior > 0 ? soONumero(maior, 'kg') : '0'}
                unidade="kg"
                sub={
                  maior > 0
                    ? `${tudo[0].nome} · ${Math.round((maior / total) * 100)}% do total`
                    : 'nada saiu no período'
                }
              />
            </>
          ) : (
            <>
              <Kpi
                rotulo="Itens que saíram"
                valor={saiu.length}
                unidade={saiu.length === 1 ? 'item' : 'itens'}
                sub={`de ${itens.length} · ${PERIODO_POR_EXTENSO[periodo]}`}
              />
              <Kpi
                rotulo="O que acaba primeiro"
                valor={dura}
                unidade={emQue}
                sub={primeiro ? nomeInteiro(primeiro.m) : 'nada saiu no período'}
              />
            </>
          )}
          <Kpi
            rotulo="Acabam em menos de 30 dias"
            valor={acabando.length}
            unidade={acabando.length === 1 ? um : varios}
            aviso={acabando.length > 0}
            sub="no ritmo deste período"
          />
          <Kpi
            rotulo={ehTecido ? 'Paradas' : 'Parados'}
            valor={paradas.length}
            unidade={paradas.length === 1 ? um : varios}
            sub="têm estoque e não saíram no período"
          />
        </div>
      </div>

      <div className="eu-dois-caixa" data-estatisticas="">
        <div className="eu-dois">
          <section className="cartao eu-col" data-uso-por-tecido="">
            <header className="eu-topo">
              <TituloCartao icone={ChartBar}>
                {ehTecido ? 'Uso por tecido' : 'Uso por grupo'}
              </TituloCartao>
              <span className="eu-nota">
                {ehTecido
                  ? plural(lista.length, 'tecido', 'tecidos')
                  : plural(lista.length, 'grupo', 'grupos')}{' '}
                · {PERIODO_POR_EXTENSO[periodo]}
              </span>
            </header>
            {!saiu.length ? (
              <Vazio
                titulo="Nada saiu neste período"
                texto={`Nenhuma separação nem saída de ${coisa} ${PERIODO_POR_EXTENSO[periodo]}. Troque o período para olhar mais longe.`}
              />
            ) : !lista.length ? (
              <Vazio
                titulo={'Nenhum ' + coisa + ' com esse nome'}
                texto="Confira a busca no alto da página."
              />
            ) : (
              <div data-lista="">
                <div className="eu-cabeca" aria-hidden="true">
                  <span>{ehTecido ? 'Tecido e cor' : 'Grupo e item'}</span>
                  <span />
                  <span className="eu-num">Usado</span>
                  <span className="eu-num">{ehTecido ? 'Do total' : 'Do grupo'}</span>
                  <span>Quanto dura</span>
                </div>
                {lista.map(t => {
                  const ab = aberto(t.chave)
                  /* num tecido de trinta cores, as que não saíram ficam atrás de
                     um botão: quem abriu quer ver primeiro o que sai */
                  const usadas = t.cores.filter(c => c.usado > 0)
                  const paradasDele = t.cores.length - usadas.length
                  const esconde =
                    usadas.length > 0 &&
                    paradasDele > MAXIMO_DE_PARADAS &&
                    !abertos.has('paradas:' + t.chave)
                  const aVista = esconde ? usadas : t.cores
                  const guardadas = esconde ? paradasDele : 0
                  return (
                    <div key={t.chave} className="eu-gaveta">
                      <button
                        type="button"
                        className="eu-linha"
                        data-tecido={t.nome}
                        aria-expanded={ab}
                        onClick={() => virar(t.chave)}
                      >
                        <span className="eu-nome">
                          <CaretRight
                            size={14}
                            weight="bold"
                            className={ab ? 'em-seta aberta' : 'em-seta'}
                          />
                          {t.cod ? <Codigo cod={t.cod} /> : null}
                          <b>{t.nome}</b>
                          <small>{plural(t.cores.length, um, varios)}</small>
                        </span>
                        {t.unidade ? (
                          <>
                            <Barra parte={parte(t.usado, t.unidade)} forte />
                            <b className={t.usado ? 'eu-num' : 'eu-num eu-zero'}>
                              {quantoNaUnidade(t.usado, t.unidade)}
                            </b>
                            <span className="eu-num eu-apoio">
                              {ehTecido && t.usado ? Math.round((t.usado / total) * 100) + '%' : ''}
                            </span>
                            <Cobertura c={t.cobertura} livre={t.livre} unidade={t.unidade} />
                          </>
                        ) : (
                          /* o grupo com unidades misturadas não tem soma: diz
                             quantos itens saíram, e o número fica em cada um */
                          <span className="eu-misto">
                            {usadas.length
                              ? plural(usadas.length, 'item saiu', 'itens saíram')
                              : 'sem saída no período'}
                            <small>unidades diferentes, sem soma</small>
                          </span>
                        )}
                      </button>
                      {ab
                        ? aVista.map(c => (
                            <button
                              type="button"
                              key={c.m.id}
                              className="eu-linha eu-cor"
                              data-material={c.m.nome}
                              title={'Abrir a ficha de ' + nomeInteiro(c.m)}
                              onClick={() => aoAbrir(c.m)}
                            >
                              <span className="eu-nome">
                                <Bola cor={c.m.corHex} />
                                <b>{nomeNoGrupo(c.m)}</b>
                                {c.m.livre < c.m.minimo ? (
                                  <span className="em-marca alerta">comprar</span>
                                ) : null}
                              </span>
                              <Barra parte={parte(c.usado, c.m.unidade)} />
                              <b className={c.usado ? 'eu-num' : 'eu-num eu-zero'}>
                                {quantoNaUnidade(c.usado, c.m.unidade)}
                              </b>
                              <span className="eu-num eu-apoio">
                                {c.usado && t.unidade && t.usado
                                  ? Math.round((c.usado / t.usado) * 100) + '%'
                                  : ''}
                              </span>
                              <Cobertura c={c.cobertura} livre={c.m.livre} unidade={c.m.unidade} />
                            </button>
                          ))
                        : null}
                      {ab && guardadas > 0 ? (
                        <button
                          type="button"
                          className="eu-resto"
                          data-paradas={t.nome}
                          onClick={() => virar('paradas:' + t.chave)}
                        >
                          Ver{' '}
                          {guardadas === 1
                            ? ehTecido
                              ? 'a cor'
                              : 'o item'
                            : (ehTecido ? 'as ' : 'os ') + guardadas + ' ' + varios}{' '}
                          sem saída no período
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
            {saiu.length && lista.length ? (
              <p className="eu-pe">
                Usado é o que saiu para produzir: separação e saída, menos o que voltou em
                devolução.{' '}
                {ehTecido
                  ? 'Na cor, "do total" é a parte dela dentro do tecido.'
                  : 'A barra compara só quem usa a mesma unidade, e "do grupo" é a parte do item dentro do grupo dele.'}
              </p>
            ) : null}
          </section>

          <div className="eu-lado">
            <section className="cartao eu-col" data-prioridade="">
              <header className="eu-topo">
                <TituloCartao icone={ShoppingCart}>Prioridade de compra</TituloCartao>
                <span className="eu-nota">
                  {ehTecido ? 'a que acaba antes primeiro' : 'o que acaba antes primeiro'}
                </span>
              </header>
              {prioridade.length ? (
                <>
                  {(todaAPrioridade ? prioridade : prioridade.slice(0, NA_PRIORIDADE)).map(
                    linhaDaPrioridade,
                  )}
                  {prioridade.length > NA_PRIORIDADE ? (
                    <div className="eu-mais">
                      <Botao tamanho="sm" onClick={() => setTodaAPrioridade(v => !v)}>
                        {todaAPrioridade
                          ? ehTecido
                            ? 'Ver só as ' + NA_PRIORIDADE + ' primeiras'
                            : 'Ver só os ' + NA_PRIORIDADE + ' primeiros'
                          : 'Ver ' + (ehTecido ? 'as ' : 'os ') + prioridade.length}
                      </Botao>
                    </div>
                  ) : null}
                  <p className="eu-pe">
                    A conta é o livre dividido pelo que sai por dia {PERIODO_POR_EXTENSO[periodo]}.{' '}
                    {ehTecido ? 'Cor que não saiu' : 'Item que não saiu'} no período não entra.
                  </p>
                </>
              ) : (
                <Vazio
                  titulo="Sem previsão"
                  texto={`${ehTecido ? 'Nenhuma cor saiu' : 'Nenhum item saiu'} no período, então não há ritmo para calcular quanto o estoque dura.`}
                />
              )}
            </section>

            <section className="cartao eu-col" data-mes-a-mes="">
              <header className="eu-topo">
                <TituloCartao icone={CalendarBlank}>Mês a mês</TituloCartao>
                <span className="eu-nota">
                  {series.length === 1
                    ? notaDaSerie(series[0])
                    : plural(series.length, 'unidade', 'unidades') + ', uma régua para cada'}
                </span>
              </header>
              {series.slice(0, MAXIMO_DE_SERIES).map(serie => {
                const maiorMes = Math.max(...serie.meses.map(m => m.usado), 0)
                return (
                  <div key={serie.unidade} data-serie={serie.unidade}>
                    {series.length > 1 ? (
                      <p className="eu-serie">
                        Em {serie.unidade} <small>{notaDaSerie(serie)}</small>
                      </p>
                    ) : null}
                    <div
                      className="eu-meses"
                      role="img"
                      aria-label={`O que saiu em cada mês, em ${serie.unidade}`}
                    >
                      {serie.meses.map(m => (
                        <div
                          key={m.mes}
                          className={m.corrente ? 'eu-mes corrente' : 'eu-mes'}
                          data-mes={m.mes}
                          title={`${m.rotulo}: ${quantoNaUnidade(m.usado, serie.unidade)}${m.corrente ? ', até hoje' : ''}`}
                        >
                          <span className="eu-mes-valor">
                            {m.usado > 0 ? soONumero(m.usado, serie.unidade) : ''}
                          </span>
                          <span className="eu-mes-trilho">
                            <i
                              style={
                                {
                                  '--eu-parte': (maiorMes ? (m.usado / maiorMes) * 100 : 0) + '%',
                                } as CSSProperties
                              }
                            />
                          </span>
                          <span className="eu-mes-nome">{m.rotulo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <p className="eu-pe">
                {series.length === 1 ? `Em ${series[0].unidade}. ` : ''}O último mês ainda está
                correndo, e vai só até hoje.
                {series.length > MAXIMO_DE_SERIES
                  ? ` Ficaram de fora ${plural(series.length - MAXIMO_DE_SERIES, 'unidade', 'unidades')} com menos itens.`
                  : ''}
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

/** "média de 40,2 kg por mês", dos cinco meses fechados */
function notaDaSerie(serie: { unidade: string; meses: { usado: number; corrente: boolean }[] }) {
  const fechados = serie.meses.filter(m => !m.corrente)
  const media = fechados.length ? fechados.reduce((s, m) => s + m.usado, 0) / fechados.length : 0
  return media > 0 ? 'média de ' + quantoNaUnidade(media, serie.unidade) + ' por mês' : 'sem saída'
}
