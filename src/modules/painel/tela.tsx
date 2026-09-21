import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao, Kpi, Nivel, Pagina, PilulaTecnica, Selo, Vazio } from '@ds'
import {
  abaixoDoMinimo,
  carregarMateriais,
  corDoNivel,
  nivel,
  numeroNaUnidade,
  quantidade,
  type Material,
} from '@dominio/estoque'
import {
  CAPACIDADE_DA_SEMANA,
  POSTO,
  atrasado,
  diasAteAEntrega,
  carregarPedidos,
  naFabrica,
  noPreparo,
  prazoEmTexto,
  saiEm7Dias,
  type Pedido,
} from '@dominio/producao'
import {
  carregarLeads,
  iniciais,
  minutosDesde,
  nomeDoLead,
  tempoCurto,
  type Lead,
} from '@dominio/funil'
import './painel.css'

/* ==========================================================================
   Inicio, no arranjo do mockup v5.

   Ele nao e painel de grafico: e a primeira pergunta da manha. Em cima, o dia
   e o que esta na fabrica. Depois quatro numeros de PRODUCAO, nao de venda.
   Embaixo, duas colunas: "Precisa de voce" com os pedidos que gritam, e a
   direita o WhatsApp e o estoque abaixo do minimo.

   Tudo que aparece aqui vem do banco. O cartao do estoque foi o ultimo a
   deixar de ser exemplo: ate a migracao 025 ele lia uma lista escrita a mao,
   entao a primeira tela que a fabrica abria todo dia trazia um alerta
   inventado. Agora ele le o saldo de verdade, e nenhum alerta do inicio e
   opiniao de arquivo.
   ========================================================================== */

const NOME_DA_TECNICA: Record<string, string> = {
  dtf: 'DTF',
  subli: 'SUB',
  silk: 'SILK',
  patch: 'PATCH',
  bordado: 'BORDADO',
  gola: 'GOLA',
  ribana: 'RIBANA',
  etiqueta: 'ETIQUETA',
}

const DIA_DA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** a semana do ano, que e como a fabrica fala de prazo */
function semanaDoAno(d: Date): number {
  const inicio = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - inicio.getTime()) / 86400000 + inicio.getDay() + 1) / 7)
}

export function TelaPainel() {
  const navegar = useNavigate()
  /* O inicio nao para por causa de uma consulta que falhou.

     Esta e a primeira tela que a pessoa ve ao entrar, e ela e um resumo: se o
     funil nao carregar, o resto continua util. Por isso cada pedaco cai sozinho
     para uma lista vazia em vez de derrubar a pagina inteira com um erro. */
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [materiais, setMateriais] = useState<Material[]>([])
  useEffect(() => {
    let vivo = true
    carregarPedidos()
      .then((p) => vivo && setPedidos(p))
      .catch(() => vivo && setPedidos([]))
    carregarLeads()
      .then((l) => vivo && setLeads(l))
      .catch(() => vivo && setLeads([]))
    carregarMateriais()
      .then((m) => vivo && setMateriais(m))
      .catch(() => vivo && setMateriais([]))
    return () => {
      vivo = false
    }
  }, [])
  const baixo = useMemo(() => abaixoDoMinimo(materiais), [materiais])

  const hoje = new Date()
  const cabecalho =
    DIA_DA_SEMANA[hoje.getDay()] + ', ' + hoje.getDate() + ' de ' + MES[hoje.getMonth()] +
    ' · semana ' + semanaDoAno(hoje)

  const conta = useMemo(() => {
    const ativos = pedidos.filter(naFabrica)
    const atrasados = ativos.filter(atrasado)
    const semana = ativos
      .filter(saiEm7Dias)
      .sort((a, b) => diasAteAEntrega(a) - diasAteAEntrega(b))
    return {
      ativos,
      atrasados,
      semana,
      pecas: ativos.reduce((s, p) => s + p.pecas, 0),
      pecasDaSemana: semana.reduce((s, p) => s + p.pecas, 0),
      preparo: ativos.filter(noPreparo).length,
      maisAntigo: atrasados.length ? Math.max(...atrasados.map((p) => -diasAteAEntrega(p))) : 0,
    }
  }, [pedidos])

  /* a lista do meio: primeiro o que ja atrasou, depois o que sai esta semana */
  const precisa: Pedido[] = [
    ...conta.atrasados,
    ...conta.semana.filter((p) => !conta.atrasados.includes(p)),
  ].slice(0, 6)

  /* no WhatsApp entra so quem ainda nao foi atendido: novo e em atendimento */
  const conversas = leads.filter((l) => l.estagio === 'novo' || l.estagio === 'atendimento')

  return (
    <Pagina
      acima={cabecalho}
      titulo="Bom dia, Henrique"
      sub={
        <>
          {conta.ativos.length} pedidos na fábrica ·{' '}
          {conta.pecas.toLocaleString('pt-BR')} peças ·{' '}
          {conta.atrasados.length ? (
            <b className="pn-vermelho">{conta.atrasados.length} atrasado</b>
          ) : (
            'nenhum atraso'
          )}
        </>
      }
      acoes={
        <>
          <Botao tom="contorno" onClick={() => navegar('/atividades')}>
            Semana
          </Botao>
          <Botao tom="primario" onClick={() => navegar('/cotacao')}>
            Nova cotação
          </Botao>
        </>
      }
    >
      <div className="fila-kpi" style={{ marginBottom: 'var(--sp-4)' }}>
        {/* O UNICO cartao de tinta da tela. E o numero que abre o dia, e ele
            e um so de proposito: dois cartoes pintados competem entre si e a
            fileira volta a nao ter primeiro lugar nenhum. */}
        <Kpi
          tinta
          rotulo="Peças na fila"
          valor={conta.pecas.toLocaleString('pt-BR')}
          sub={Math.round((conta.pecas / CAPACIDADE_DA_SEMANA) * 100) + '% da capacidade semanal'}
        />
        <Kpi
          rotulo="Pedidos em produção"
          valor={conta.ativos.length}
          sub={conta.preparo + ' ainda no preparo'}
        />
        <Kpi
          rotulo="Atrasados"
          valor={conta.atrasados.length}
          aviso={conta.atrasados.length > 0}
          sub={conta.atrasados.length ? 'mais antigo: ' + conta.maisAntigo + ' d' : 'no prazo'}
        />
        <Kpi
          rotulo="Entregas em 7 dias"
          valor={conta.semana.length}
          sub={conta.pecasDaSemana.toLocaleString('pt-BR') + ' peças a sair'}
        />
      </div>

      <div className="pn-grade">
        <section className="cartao pn-cartao">
          <header className="pn-cartao-topo">
            <h3>Precisa de você</h3>
            <button type="button" onClick={() => navegar('/kanban')}>
              Kanban
            </button>
          </header>
          <div className="pn-lista">
            {precisa.map((p) => {
              const prazo = prazoEmTexto(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pn-linha"
                  onClick={() => navegar('/kanban')}
                >
                  <span className="pn-cod">{p.numero}</span>
                  <span className="pn-quem">
                    <b>{p.cliente}</b>
                    <small>
                      {p.pecas} pçs · {p.layouts} layout{p.layouts > 1 ? 's' : ''} · {p.vendedor}
                    </small>
                  </span>
                  <span className="pn-tecnicas">
                    {p.tecnicas.map((t) => (
                      <PilulaTecnica key={t} tecnica={t} tamanho="sm">
                        {NOME_DA_TECNICA[t] ?? t}
                      </PilulaTecnica>
                    ))}
                  </span>
                  <span className="pn-etapa">
                    <Selo forma="contorno">{POSTO[p.etapa].nome}</Selo>
                  </span>
                  <span className={prazo.atrasado ? 'pn-prazo atrasado' : 'pn-prazo'}>
                    {prazo.texto}
                  </span>
                </button>
              )
            })}
            {!precisa.length ? (
              <Vazio titulo="Nada gritando" texto="Nenhum pedido atrasado e nenhum saindo esta semana." />
            ) : null}
          </div>
        </section>

        <div className="pn-coluna">
          <section className="cartao pn-cartao">
            <header className="pn-cartao-topo">
              <h3>WhatsApp</h3>
              <button type="button" onClick={() => navegar('/funil')}>
                Funil
              </button>
            </header>
            <div className="pn-lista">
              {conversas.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="pn-linha conversa"
                  onClick={() => navegar('/funil')}
                >
                  <span className={l.novo ? 'fn-avatar anel' : 'fn-avatar'}>
                    {iniciais(nomeDoLead(l))}
                  </span>
                  <span className="pn-conversa">
                    <span className="pn-conversa-topo">
                      <b>{nomeDoLead(l)}</b>
                      <small>{tempoCurto(minutosDesde(l.ultimaMsgEm))}</small>
                    </span>
                    <small className="pn-previa">{l.msg}</small>
                  </span>
                </button>
              ))}
              {!conversas.length ? (
                <Vazio titulo="Ninguém esperando" texto="Nenhuma conversa nova no WhatsApp." />
              ) : null}
            </div>
          </section>

          <section className="cartao pn-cartao">
            <header className="pn-cartao-topo">
              <h3>Estoque abaixo do mínimo</h3>
              <button type="button" onClick={() => navegar('/estoque')}>
                Estoque
              </button>
            </header>
            <div className="pn-lista">
              {baixo.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="pn-linha"
                  onClick={() => navegar('/estoque')}
                >
                  <span className="pn-quem">
                    <b>{m.nome}</b>
                    <small>
                      {m.categoria} · mín {numeroNaUnidade(m.minimo, m.unidade)}
                    </small>
                  </span>
                  <Nivel fixa valor={nivel(m)} cor={corDoNivel(m)} />
                  <span className="pn-prazo atrasado">{quantidade(m)}</span>
                </button>
              ))}
              {!baixo.length ? (
                <Vazio titulo="Estoque em dia" texto="Nenhum material abaixo do mínimo." />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </Pagina>
  )
}
