import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { Botao, Kpi, Segmentado, Vazio } from '@ds'
import {
  NOME_DO_PERIODO,
  PERIODO_POR_EXTENSO,
  coberturaPorExtenso,
  nomeInteiro,
  nomeNoGrupo,
  prioridadeDeCompra,
  quantoNaUnidade,
  soONumero,
  usoMesAMes,
  usoPorMes,
  usoPorTecido,
  type Hierarquia,
  type Material,
  type Periodo,
  type UsoDaCor,
  type UsoDoMaterial,
} from '@dominio/estoque'
import { plural } from './apoio'
import { Codigo } from './arvore'
import { Bola } from './vao'
import './estatisticas.css'

/* ==========================================================================
   Estatísticas: quanto tecido saiu, por tecido e por cor.

   Pedido do Henrique (05/10/2026): "como saber a prioridade de compra de
   tecido? Preciso de uma tela de estatística com a quantidade de tecido usado
   dividido por tecido e por cor do tecido no mês, 3 meses, semestre".

   SÃO TRÊS RESPOSTAS NA MESMA TELA:
     1. o que mais sai (a lista por tecido, que abre nas cores);
     2. o que acaba antes (a prioridade de compra, pela cobertura);
     3. se o ritmo está subindo ou descendo (o mês a mês).

   USO É O QUE SAIU PARA PRODUZIR: a separação e a saída, menos o que voltou
   em devolução. A entrada e o ajuste de inventário não contam. A conta mora
   no banco (uso_do_estoque, migração 049); aqui só se ordena e se desenha.

   OS PERÍODOS SÃO JANELAS QUE ANDAM: os últimos 30, 90 e 180 dias contados de
   hoje, e não o mês do calendário. No dia 3 o "mês" do calendário teria três
   dias, e a prioridade de compra viraria ruído.

   UMA RÉGUA SÓ: a barra de um tecido e a de uma cor usam a mesma escala (o
   tecido que mais saiu enche a barra), para a cor ser lida como parte do
   tecido dela.
   ========================================================================== */

/** abaixo disto a cobertura é urgente; abaixo de 30, pede atenção */
const DIAS_CURTOS = 15
const DIAS_DE_ATENCAO = 30
const NA_PRIORIDADE = 8
/** com mais cores paradas do que isto num tecido, elas ficam atrás de um botão */
const MAXIMO_DE_PARADAS = 4

const kg = (v: number) => quantoNaUnidade(v, 'kg')

function tomDaCobertura(dias: number): '' | 'curta' | 'media' {
  if (dias < DIAS_CURTOS) return 'curta'
  if (dias < DIAS_DE_ATENCAO) return 'media'
  return ''
}

function Barra({ parte, forte }: { parte: number; forte?: boolean }) {
  return (
    <span className={forte ? 'eu-barra forte' : 'eu-barra'} aria-hidden="true">
      <i style={{ '--eu-parte': Math.max(0, Math.min(100, parte)) + '%' } as CSSProperties} />
    </span>
  )
}

function Cobertura({ c, livre }: { c: number; livre: number }) {
  const tom = tomDaCobertura(c)
  return (
    <span className="eu-cobertura">
      <small>livre {kg(livre)}</small>
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
  periodo: Periodo
  aoTrocarPeriodo: (p: Periodo) => void
  /** a tela estreita não tem lugar para o período na barra: ele vem aqui */
  comPeriodo: boolean
  aoAbrir: (m: Material) => void
}) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [todaAPrioridade, setTodaAPrioridade] = useState(false)

  const tudo = useMemo(
    () => usoPorTecido(materiais, usos, periodo, hierarquia),
    [materiais, usos, periodo, hierarquia],
  )
  const lista = useMemo(
    () => (termo ? usoPorTecido(filtrados, usos, periodo, hierarquia) : tudo),
    [termo, filtrados, usos, periodo, hierarquia, tudo],
  )
  const total = tudo.reduce((s, t) => s + t.usado, 0)
  const maior = tudo[0]?.usado ?? 0
  const prioridade = useMemo(() => prioridadeDeCompra(lista), [lista])
  const acabando = useMemo(
    () => prioridadeDeCompra(tudo).filter(c => c.cobertura < DIAS_DE_ATENCAO),
    [tudo],
  )
  const paradas = useMemo(
    () => tudo.flatMap(t => t.cores).filter(c => c.usado === 0 && c.m.livre > 0),
    [tudo],
  )
  const meses = useMemo(() => usoMesAMes(materiais, usos), [materiais, usos])
  const maiorMes = Math.max(...meses.map(m => m.usado), 0)
  const fechados = meses.filter(m => !m.corrente)
  const media = fechados.length ? fechados.reduce((s, m) => s + m.usado, 0) / fechados.length : 0

  const virar = (chave: string) =>
    setAbertos(antes => {
      const novo = new Set(antes)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  /* com busca, o que sobrou vem aberto: é a resposta */
  const aberto = (chave: string) => abertos.has(chave) !== !!termo

  const seletor = comPeriodo ? (
    <Segmentado
      className="eu-periodo"
      valor={periodo}
      aoMudar={aoTrocarPeriodo}
      opcoes={(['d30', 'd90', 'd180'] as Periodo[]).map(p => ({
        valor: p,
        rotulo: NOME_DO_PERIODO[p],
      }))}
    />
  ) : null

  const temTecido = materiais.some(m => m.categoria === 'tecido')
  if (!temTecido) {
    return (
      <section className="cartao es-quadro" data-estatisticas="">
        <Vazio
          titulo="Nenhum tecido no estoque"
          texto="As estatísticas contam o tecido que sai para a produção. Elas aparecem depois que houver tecido cadastrado e separado."
        />
      </section>
    )
  }

  const linhaDaPrioridade = (c: UsoDaCor) => {
    const tom = tomDaCobertura(c.cobertura)
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
            livre {kg(c.m.livre)} · saem {kg(usoPorMes(c.usado, periodo))} por mês
            {c.m.livre < c.m.minimo ? ' · abaixo do mínimo' : ''}
          </small>
        </span>
        <span className={tom ? 'eu-pri-dias ' + tom : 'eu-pri-dias'}>
          {coberturaPorExtenso(c.cobertura)}
        </span>
      </button>
    )
  }

  return (
    <>
      {seletor}
      <div className="eu-numeros">
        <div className="fila-kpi eu-kpis" data-numeros="">
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
          <Kpi
            rotulo="Acabam em menos de 30 dias"
            valor={acabando.length}
            unidade={acabando.length === 1 ? 'cor' : 'cores'}
            aviso={acabando.length > 0}
            sub="no ritmo deste período"
          />
          <Kpi
            rotulo="Paradas"
            valor={paradas.length}
            unidade={paradas.length === 1 ? 'cor' : 'cores'}
            sub="têm estoque e não saíram no período"
          />
        </div>
      </div>

      <div className="eu-dois-caixa" data-estatisticas="">
        <div className="eu-dois">
          <section className="cartao eu-col" data-uso-por-tecido="">
            <header className="eu-topo">
              <h3 className="cartao-titulo">
                <span className="marca" />
                Uso por tecido
              </h3>
              <span className="eu-nota">
                {plural(lista.length, 'tecido', 'tecidos')} · {PERIODO_POR_EXTENSO[periodo]}
              </span>
            </header>
            {total === 0 ? (
              <Vazio
                titulo="Nada saiu neste período"
                texto={`Nenhuma separação nem saída de tecido ${PERIODO_POR_EXTENSO[periodo]}. Troque o período para olhar mais longe.`}
              />
            ) : !lista.length ? (
              <Vazio
                titulo="Nenhum tecido com esse nome"
                texto="Confira a busca no alto da página."
              />
            ) : (
              <div data-lista="">
                <div className="eu-cabeca" aria-hidden="true">
                  <span>Tecido e cor</span>
                  <span />
                  <span className="eu-num">Usado</span>
                  <span className="eu-num">Do total</span>
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
                          <small>{plural(t.cores.length, 'cor', 'cores')}</small>
                        </span>
                        <Barra parte={maior ? (t.usado / maior) * 100 : 0} forte />
                        <b className={t.usado ? 'eu-num' : 'eu-num eu-zero'}>{kg(t.usado)}</b>
                        <span className="eu-num eu-apoio">
                          {t.usado ? Math.round((t.usado / total) * 100) + '%' : ''}
                        </span>
                        <Cobertura c={t.cobertura} livre={t.livre} />
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
                              <Barra parte={maior ? (c.usado / maior) * 100 : 0} />
                              <b className={c.usado ? 'eu-num' : 'eu-num eu-zero'}>{kg(c.usado)}</b>
                              <span className="eu-num eu-apoio">
                                {c.usado ? Math.round((c.usado / t.usado) * 100) + '%' : ''}
                              </span>
                              <Cobertura c={c.cobertura} livre={c.m.livre} />
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
                          Ver {guardadas === 1 ? 'a cor' : 'as ' + guardadas + ' cores'} sem saída
                          no período
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
            {total > 0 && lista.length ? (
              <p className="eu-pe">
                Usado é o que saiu para produzir: separação e saída, menos o que voltou em
                devolução. Na cor, "do total" é a parte dela dentro do tecido.
              </p>
            ) : null}
          </section>

          <div className="eu-lado">
            <section className="cartao eu-col" data-prioridade="">
              <header className="eu-topo">
                <h3 className="cartao-titulo">
                  <span className="marca" />
                  Prioridade de compra
                </h3>
                <span className="eu-nota">a que acaba antes primeiro</span>
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
                          ? 'Ver só as ' + NA_PRIORIDADE + ' primeiras'
                          : 'Ver as ' + prioridade.length}
                      </Botao>
                    </div>
                  ) : null}
                  <p className="eu-pe">
                    A conta é o livre dividido pelo que sai por dia {PERIODO_POR_EXTENSO[periodo]}.
                    Cor que não saiu no período não entra.
                  </p>
                </>
              ) : (
                <Vazio
                  titulo="Sem previsão"
                  texto="Nenhuma cor saiu no período, então não há ritmo para calcular quanto o estoque dura."
                />
              )}
            </section>

            <section className="cartao eu-col" data-mes-a-mes="">
              <header className="eu-topo">
                <h3 className="cartao-titulo">
                  <span className="marca" />
                  Mês a mês
                </h3>
                <span className="eu-nota">
                  {media > 0 ? 'média de ' + kg(media) + ' por mês' : 'tecido usado'}
                </span>
              </header>
              <div className="eu-meses" role="img" aria-label="Tecido usado em cada mês">
                {meses.map(m => (
                  <div
                    key={m.mes}
                    className={m.corrente ? 'eu-mes corrente' : 'eu-mes'}
                    data-mes={m.mes}
                    title={`${m.rotulo}: ${kg(m.usado)}${m.corrente ? ', até hoje' : ''}`}
                  >
                    <span className="eu-mes-valor">
                      {m.usado > 0 ? soONumero(m.usado, 'kg') : ''}
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
              <p className="eu-pe">Em kg. O último mês ainda está correndo, e vai só até hoje.</p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
