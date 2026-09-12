import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Botao, Pagina, Segmentado, Seletor, avisar } from '@ds'
import {
  CAPACIDADE_DA_SEMANA,
  CAPACIDADE_DO_DIA,
  DIAS_DA_SEMANA,
  DIAS_UTEIS,
  ETAPAS,
  POSTO,
  atrasado,
  diaDaSemanaDe,
  etapaVelha,
  iso,
  moverEtapa,
  semanaDeslocada,
  tituloDaSemana,
  diaEMes,
  ehHoje,
  listarPedidos,
  semanaDoAno,
  type Etapa,
  type Pedido,
} from '@dominio/producao'
import { VENDEDORES } from '@dominio/banco'
import './atividades.css'

/* ==========================================================================
   Painel de atividades, no arranjo do v5.

   A pergunta da tela esta escrita no proprio cabecalho: o que a fabrica
   produz nesta semana, e cabe? Por isso cada dia tem uma regua de saturacao
   contra a capacidade do dia, e ela fica vermelha quando passa de 100.

   Segunda a sabado, seis dias. Domingo nao vira coluna: dia que nao produz
   nao ocupa espaco.
   ========================================================================== */

const VISTAS = [
  { valor: 'tela', rotulo: 'Tela' },
  { valor: 'a4', rotulo: 'Folha A4' },
]

export function TelaAtividades() {
  /* muda quando alguem troca a etapa de um pedido: e o sinal para reler */
  const [versao, setVersao] = useState(0)
  /* 0 e esta semana, -1 a passada, +1 a que vem */
  const [semana, setSemana] = useState(0)
  const inicio = useMemo(() => semanaDeslocada(semana), [semana])
  const diasDaSemana = useMemo(
    () => DIAS_DA_SEMANA.map((nome, i) => ({ nome, data: diaDaSemanaDe(inicio, i) })),
    [inicio],
  )

  /* So os que estao planejados nesta semana. Antes o pedido guardava so o dia
     da semana, entao toda semana mostrava os mesmos pedidos: uma tela que
     parecia navegar e nao navegava. */
  const daSemana = useMemo(() => {
    const dias = new Set(diasDaSemana.map((d) => iso(d.data)))
    return listarPedidos().filter((p) => dias.has(p.planejadoEm))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, diasDaSemana])

  /* O painel mostra TUDO que esta planejado na semana, inclusive o que ja
     finalizou. E o que o editor faz: a maior parte dos chips verdes dele sao
     pedidos prontos. Esconder os prontos faria a saturacao do dia mentir, que
     e justamente a conta que esta tela existe para responder. */
  const pedidos = daSemana
  const [vendedor, setVendedor] = useState('')
  const [etapa, setEtapa] = useState('')
  const [situacao, setSituacao] = useState('')

  const filtrados = useMemo(
    () =>
      pedidos.filter((p) => {
        if (vendedor && p.vendedor !== vendedor) return false
        if (etapa && p.etapa !== etapa) return false
        if (situacao === 'atrasados' && !atrasado(p)) return false
        if (situacao === 'manual' && !p.planejamentoManual) return false
        return true
      }),
    [pedidos, vendedor, etapa, situacao],
  )

  const pecas = filtrados.reduce((s, p) => s + p.pecas, 0)
  const pecasSubli = filtrados.reduce((s, p) => s + p.pecasSubli, 0)
  const pecasPersonalizadas = filtrados.reduce((s, p) => s + p.pecasPersonalizadas, 0)
  const atrasados = filtrados.filter(atrasado).length
  const saturacao = Math.round((pecas / CAPACIDADE_DA_SEMANA) * 100)
  const sobra = CAPACIDADE_DA_SEMANA - pecas
  const prontosNaSemana = filtrados.filter((p) => p.etapa === 'finalizado')
  const prontos = prontosNaSemana.length
  const pecasProntas = prontosNaSemana.reduce((s, p) => s + p.pecas, 0)


  return (
    <Pagina
      acima="Gestão · o que a fábrica produz nesta semana, e cabe?"
      titulo="Painel de atividades"
      sub={
        'Semana ' + semanaDoAno(inicio) + ' · ' + tituloDaSemana(inicio) +
        ' · o planejamento é por dia, e o atraso é calculado pela entrega'
      }
      acoes={
        <>
          {/* O seletor de semana, que no editor fica no topo e aqui faltava.
              Sem ele o painel so sabia falar da semana de hoje, e quem planeja
              precisa ver a que vem antes de prometer prazo. */}
          <span className="at-semana">
            <button
              type="button"
              onClick={() => setSemana((n) => n - 1)}
              aria-label="Semana anterior"
              title="Semana anterior"
            >
              ‹
            </button>
            <span className="at-semana-txt">
              <b>{tituloDaSemana(inicio)}</b>
              <small>
                {semana === 0
                  ? 'semana de hoje'
                  : semana === -1
                    ? 'semana passada'
                    : semana === 1
                      ? 'semana que vem'
                      : semana < 0
                        ? Math.abs(semana) + ' semanas atrás'
                        : 'daqui a ' + semana + ' semanas'}
              </small>
            </span>
            <button
              type="button"
              onClick={() => setSemana((n) => n + 1)}
              aria-label="Próxima semana"
              title="Próxima semana"
            >
              ›
            </button>
          </span>
          {semana !== 0 ? (
            <Botao tom="limpo" onClick={() => setSemana(0)}>
              Semana de hoje
            </Botao>
          ) : null}
          <Botao
            tom="contorno"
            onClick={() => avisar('A varredura do Drive entra junto com o kanban', 'info')}
          >
            Conferir agora
          </Botao>
          <Segmentado
            valor="tela"
            opcoes={VISTAS}
            aoMudar={(v) => {
              if (v === 'a4') avisar('A folha A4 do painel entra junto com o kanban', 'info')
            }}
          />
        </>
      }
    >
      <div className="at-filtros">
        <Seletor
          rotulo="VENDEDOR"
          valor={vendedor}
          opcoes={VENDEDORES.map((v) => ({
            valor: v,
            rotulo: v,
            contagem: pedidos.filter((p) => p.vendedor === v).length,
          }))}
          vazio="Todos os vendedores"
          aoEscolher={setVendedor}
        />
        <Seletor
          rotulo="ETAPA"
          valor={etapa}
          opcoes={ETAPAS.map((e) => ({
            valor: e,
            rotulo: POSTO[e].nome,
            contagem: pedidos.filter((p) => p.etapa === e).length,
          }))}
          vazio="Todas as etapas"
          aoEscolher={setEtapa}
        />
        <Seletor
          rotulo="SITUAÇÃO"
          valor={situacao}
          opcoes={[
            { valor: 'atrasados', rotulo: 'Só atrasados', contagem: atrasados },
            {
              valor: 'manual',
              rotulo: 'Só planejamento manual',
              contagem: pedidos.filter((p) => p.planejamentoManual).length,
            },
          ]}
          vazio="Todas"
          aoEscolher={setSituacao}
        />
        <span className="at-capacidade">
          Capacidade {CAPACIDADE_DA_SEMANA.toLocaleString('pt-BR')} pçs/semana ·{' '}
          {CAPACIDADE_DO_DIA}/dia
        </span>
      </div>

      <div className="at-topo">
        {/* Os quatro numeros do Relatorio de Atividade do editor v3.375, com a
            mesma segunda linha embaixo de cada um. A segunda linha e o que faz
            o numero valer: "1.173" sozinho nao diz nada, "730 sublimacao e 443
            personalizado" diz onde a semana esta carregada. */}
        <div className="at-numeros">
          <div style={{ '--barra': 'var(--posto-subli)' } as CSSProperties}>
            <span className="l">Peças na semana</span>
            <b>{pecas.toLocaleString('pt-BR')}</b>
            <small>
              {pecasSubli.toLocaleString('pt-BR')} sublimação ·{' '}
              {pecasPersonalizadas.toLocaleString('pt-BR')} personalizado
            </small>
          </div>
          <div style={{ '--barra': 'var(--text-3)' } as CSSProperties}>
            <span className="l">Capacidade</span>
            <b>{CAPACIDADE_DA_SEMANA.toLocaleString('pt-BR')}</b>
            <small>
              {CAPACIDADE_DO_DIA} peças por dia · {DIAS_UTEIS} dias
            </small>
          </div>
          <div
            style={
              {
                '--barra': saturacao > 100 ? 'var(--brand)' : 'var(--posto-finalizado)',
              } as CSSProperties
            }
          >
            <span className="l">Saturação</span>
            <b className={saturacao > 100 ? 'vermelho' : 'verde'}>{saturacao}%</b>
            <small>
              {sobra >= 0
                ? 'cabem +' + sobra.toLocaleString('pt-BR') + ' peças'
                : 'passou ' + Math.abs(sobra).toLocaleString('pt-BR') + ' peças do limite'}
            </small>
            <span className="at-regua">
              <i
                style={
                  {
                    width: Math.min(100, saturacao) + '%',
                    background: saturacao > 100 ? 'var(--brand)' : 'var(--posto-finalizado)',
                  } as CSSProperties
                }
              />
            </span>
          </div>
          <div style={{ '--barra': 'var(--brand)' } as CSSProperties}>
            <span className="l">Pedidos</span>
            <b>{filtrados.length}</b>
            <small>
              {prontos} finalizados · {pecasProntas.toLocaleString('pt-BR')} peças prontas
              {atrasados ? (
                <span className="at-atrasados">
                  {atrasados} atrasado{atrasados > 1 ? 's' : ''}
                </span>
              ) : null}
            </small>
          </div>
        </div>

        {/* As colunas do editor, na ordem dele. */}
        <div className="at-colunas">
          <span>Pedido</span>
          <span>Nome</span>
          <span className="esconde">Aviso</span>
          <span className="some-antes">Departamento</span>
          <span className="esconde num">Entrega</span>
          <span className="esconde num">Planejamento</span>
          <span className="num">Peças</span>
          <span>Atualização</span>
        </div>
      </div>

      {diasDaSemana.map(({ nome, data }) => {
        const doDia = filtrados.filter((p) => p.planejadoEm === iso(data))
        const pecasDoDia = doDia.reduce((s, p) => s + p.pecas, 0)
        const pct = Math.round((pecasDoDia / CAPACIDADE_DO_DIA) * 100)
        const folgaDoDia = CAPACIDADE_DO_DIA - pecasDoDia
        const atrasadosDoDia = doDia.filter(atrasado).length
        return (
          <section key={nome} className="at-dia">
            <header className={ehHoje(data) ? 'at-dia-topo hoje' : 'at-dia-topo'}>
              <span className="at-dia-nome">
                {nome} <span className="at-data">{diaEMes(data)}</span>
                {ehHoje(data) ? <span className="at-hoje">hoje</span> : null}
              </span>
              {/* O editor escreve "309 / 325" e "cabem +16", e nao a
                  porcentagem. Quem planeja a semana nao pergunta quantos por
                  cento o dia esta: pergunta quanto ainda cabe nele. */}
              <span className="at-conta">
                <b>{pecasDoDia.toLocaleString('pt-BR')}</b> / {CAPACIDADE_DO_DIA}
              </span>
              <span className={pct > 100 ? 'at-regua dia passou' : 'at-regua dia'}>
                <i style={{ width: Math.min(100, pct) + '%' }} />
              </span>
              <span className={folgaDoDia < 0 ? 'at-conta vermelho' : 'at-conta'}>
                {folgaDoDia >= 0
                  ? 'cabem +' + folgaDoDia.toLocaleString('pt-BR')
                  : 'passou ' + Math.abs(folgaDoDia).toLocaleString('pt-BR')}
              </span>
              {atrasadosDoDia ? (
                <span className="at-alerta">
                  {atrasadosDoDia} atrasado{atrasadosDoDia > 1 ? 's' : ''}
                </span>
              ) : null}
            </header>

            <div className="at-corpo">
              {doDia.map((p) => (
                <Linha
                  key={p.id}
                  pedido={p}
                  aoTrocarEtapa={(e) => {
                    const de = POSTO[p.etapa].nome
                    moverEtapa(p.id, e)
                    setVersao((v) => v + 1)
                    avisar(p.id + ': ' + de + ' para ' + POSTO[e].nome, 'ok')
                  }}
                />
              ))}
              {!doDia.length ? <p className="at-vazio">Nada neste dia.</p> : null}
            </div>
          </section>
        )
      })}

      <div className="at-legenda">
        <span>
          <i className="at-marca atrasado" />
          atrasado: situação calculada pela entrega, convive com a etapa
        </span>
        <span>
          Capacidade: {CAPACIDADE_DA_SEMANA.toLocaleString('pt-BR')} peças/semana ·{' '}
          {CAPACIDADE_DO_DIA}/dia · {DIAS_UTEIS} dias
        </span>
      </div>
    </Pagina>
  )
}

function Linha({ pedido, aoTrocarEtapa }: { pedido: Pedido; aoTrocarEtapa: (e: Etapa) => void }) {
  const p = pedido
  const late = atrasado(p)
  const velha = etapaVelha(p)
  return (
    <div className={late ? 'at-linha atrasada' : 'at-linha'}>
      <span className="at-cod">{p.id}</span>
      <span className="at-quem">
        <b>{p.cliente}</b>
        <small>{p.vendedor}</small>
      </span>

      {/* Sem aviso desenha tracejado apagado, e nao celula em branco: celula
          em branco parece dado que nao carregou. */}
      <span className="esconde">
        <span
          className={p.aviso ? 'at-aviso' : 'at-aviso sem'}
          title={p.aviso || 'sem aviso'}
        >
          <span>{p.aviso || 'sem aviso'}</span>
        </span>
      </span>

      <span className="some-antes at-suave">{p.departamento}</span>

      <span className={late ? 'esconde num at-vencido' : 'esconde num at-suave'}>
        {diaEMes(new Date(Date.now() + p.emDias * 86400000))}
      </span>

      <span className="esconde num">
        <span className={p.planejamentoManual ? 'at-plano manual' : 'at-plano'}>
          {diaEMes(new Date(p.planejadoEm + 'T00:00:00'))}
          {p.planejamentoManual ? ' · manual' : ''}
        </span>
      </span>

      {/* Total, sublimacao e personalizado numa celula so. No editor sao tres
          colunas; aqui elas somavam 170 px e espremiam o Nome, que e o texto
          que se procura na linha. Os tres numeros continuam todos na tela: o
          total em cima, a divisao embaixo, do mesmo jeito que o nome tem o
          vendedor embaixo. */}
      <span className="at-pecas num">
        <b>{p.pecas}</b>
        <small>
          {p.pecasSubli ? p.pecasSubli + ' subli' : ''}
          {p.pecasSubli && p.pecasPersonalizadas ? ' · ' : ''}
          {p.pecasPersonalizadas ? p.pecasPersonalizadas + ' pers' : ''}
        </small>
      </span>

      {/* A coluna chama Atualizacao, e nao Etapa, porque ela responde duas
          perguntas: em que posto o pedido esta, e se isso ainda vale. Etapa
          sem ninguem tocar ha mais de tres dias sai com a borda tracejada. */}
      <span className={velha ? 'at-etapa velha' : 'at-etapa'}>
        <Seletor
          tamanho="sm"
          bloco
          cor={POSTO[p.etapa].cor}
          valor={p.etapa}
          opcoes={ETAPAS.map((e) => ({ valor: e, rotulo: POSTO[e].nome }))}
          vazio="sem etapa"
          aoEscolher={(v) => aoTrocarEtapa((v || p.etapa) as Etapa)}
        />
      </span>
    </div>
  )
}
