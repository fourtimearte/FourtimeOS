import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Botao, Pagina, Segmentado, Selo, Seletor, avisar } from '@ds'
import {
  CAPACIDADE_DA_SEMANA,
  CAPACIDADE_DO_DIA,
  DIAS_DA_SEMANA,
  DIAS_UTEIS,
  POSTO,
  atrasado,
  diaDaSemana,
  diaEMes,
  ehHoje,
  listarPedidos,
  naFabrica,
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
  const pedidos = useMemo(() => listarPedidos().filter(naFabrica), [])
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
  const atrasados = filtrados.filter(atrasado).length
  const saturacao = Math.round((pecas / CAPACIDADE_DA_SEMANA) * 100)
  const inicio = diaDaSemana(0)
  const fim = diaDaSemana(DIAS_UTEIS - 1)

  const etapasUsadas = useMemo(
    () => [...new Set(pedidos.map((p) => p.etapa))] as Etapa[],
    [pedidos],
  )

  return (
    <Pagina
      acima="Gestão · o que a fábrica produz nesta semana, e cabe?"
      titulo="Painel de atividades"
      sub={
        'Semana ' + semanaDoAno() + ' · ' + diaEMes(inicio) + ' a ' + diaEMes(fim) +
        ' · o planejamento é por dia, e o atraso é calculado pela entrega'
      }
      acoes={
        <>
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
          opcoes={etapasUsadas.map((e) => ({
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
        <div className="at-numeros">
          <div>
            <span className="l">Pedidos na semana</span>
            <b>{filtrados.length}</b>
          </div>
          <div>
            <span className="l">Peças</span>
            <b>
              {pecas.toLocaleString('pt-BR')}{' '}
              <small>de {CAPACIDADE_DA_SEMANA.toLocaleString('pt-BR')}</small>
            </b>
          </div>
          <div>
            <span className="l">Saturação</span>
            <b className={saturacao > 100 ? 'vermelho' : ''}>{saturacao}%</b>
            <span className="at-regua">
              <i
                style={
                  {
                    width: Math.min(100, saturacao) + '%',
                    background: saturacao > 100 ? 'var(--brand)' : 'var(--ink)',
                  } as CSSProperties
                }
              />
            </span>
          </div>
          <div>
            <span className="l">Atrasados</span>
            <b className={atrasados ? 'vermelho' : ''}>{atrasados}</b>
          </div>
        </div>

        <div className="at-colunas">
          <span>Pedido</span>
          <span>Cliente</span>
          <span className="esconde">Vendedor</span>
          <span className="esconde num">Peças</span>
          <span className="esconde num">Entrega</span>
          <span>Etapa</span>
          <span className="esconde">Planejado</span>
        </div>
      </div>

      {DIAS_DA_SEMANA.map((nome, i) => {
        const data = diaDaSemana(i)
        const doDia = filtrados.filter((p) => p.planejadoNoDia === i)
        const pecasDoDia = doDia.reduce((s, p) => s + p.pecas, 0)
        const pct = Math.round((pecasDoDia / CAPACIDADE_DO_DIA) * 100)
        const atrasadosDoDia = doDia.filter(atrasado).length
        return (
          <section key={nome} className="at-dia">
            <header className={ehHoje(data) ? 'at-dia-topo hoje' : 'at-dia-topo'}>
              <span className="at-dia-nome">
                {nome} <span className="at-data">{diaEMes(data)}</span>
                {ehHoje(data) ? <span className="at-hoje">hoje</span> : null}
              </span>
              <span className="at-conta">
                {doDia.length} ped · {pecasDoDia.toLocaleString('pt-BR')} pçs
              </span>
              <span className={pct > 100 ? 'at-regua dia passou' : 'at-regua dia'}>
                <i style={{ width: Math.min(100, pct) + '%' }} />
              </span>
              <span className="at-conta">
                {pct}% de {CAPACIDADE_DO_DIA}
              </span>
              {atrasadosDoDia ? (
                <span className="at-alerta">
                  {atrasadosDoDia} atrasado{atrasadosDoDia > 1 ? 's' : ''}
                </span>
              ) : null}
            </header>

            <div className="at-corpo">
              {doDia.map((p) => (
                <Linha key={p.id} pedido={p} />
              ))}
              {!doDia.length ? (
                <p className="at-vazio">Sem pedido planejado para este dia.</p>
              ) : null}
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

function Linha({ pedido }: { pedido: Pedido }) {
  const p = pedido
  const late = atrasado(p)
  return (
    <div className={late ? 'at-linha atrasada' : 'at-linha'}>
      <span className="at-cod">{p.id}</span>
      <span className="at-quem">
        <b>{p.cliente}</b>
        <small>
          {p.vendedor} · {p.pecas} pçs · {p.departamento}
        </small>
      </span>
      <span className="esconde at-suave">{p.vendedor}</span>
      <span className="esconde num at-forte">{p.pecas}</span>
      <span className={late ? 'esconde num at-vencido' : 'esconde num at-suave'}>
        {diaEMes(new Date(Date.now() + p.emDias * 86400000))}
      </span>
      <span className="at-etapa">
        <Selo forma="contorno">{POSTO[p.etapa].nome}</Selo>
      </span>
      <span className="esconde">
        <span className={p.planejamentoManual ? 'at-plano manual' : 'at-plano'}>
          {diaEMes(diaDaSemana(p.planejadoNoDia))}
          {p.planejamentoManual ? ' · manual' : ''}
        </span>
      </span>
    </div>
  )
}
