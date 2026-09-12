import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso, Botao, Kpi, Pagina, Selo, Vazio } from '@ds'
import { formatarData, formatarDinheiro } from '@shared'
import {
  NOME_DO_ESTADO_DA_COTACAO,
  listarCotacoes,
  pecasDaCotacao,
  totalDaCotacao,
  type Cotacao,
} from '@dominio/cotacao'
import { diasParado, esquecido, listarLeads, type Lead } from '@dominio/funil'
import { listarClientes, situacaoDoCliente } from '@dominio/cliente'
import './painel.css'

/* ==========================================================================
   O inicio.

   Ele nao e um painel de graficos. Ele responde a uma pergunta so, que e a
   primeira da manha: o que esta esperando por mim?

   Por isso a lista do meio nao e "as ultimas coisas": e o que passou da hora.
   Lead esquecido, proposta vencendo, rascunho parado. Cada linha leva para o
   lugar onde ela se resolve, em um clique.
   ========================================================================== */

const DIA = 24 * 60 * 60 * 1000

type Pendencia = {
  id: string
  tipo: 'lead' | 'cotacao'
  titulo: string
  motivo: string
  desde: number
  para: string
  valor: number
}

export function TelaPainel() {
  const navegar = useNavigate()
  const hoje = useMemo(() => Date.now(), [])
  const leads = useMemo(() => listarLeads(), [])
  const cotacoes = useMemo(() => listarCotacoes(), [])
  const clientes = useMemo(() => listarClientes(), [])

  const pendencias = useMemo(() => {
    const lista: Pendencia[] = []

    leads.filter((l) => esquecido(l, hoje)).forEach((l: Lead) =>
      lista.push({
        id: l.id,
        tipo: 'lead',
        titulo: l.nome,
        motivo: 'ninguém responde há ' + diasParado(l, hoje) + ' dias',
        desde: diasParado(l, hoje),
        para: '/funil',
        valor: l.valor,
      }),
    )

    cotacoes.forEach((c: Cotacao) => {
      if (c.estado !== 'enviada') return
      const faltam = Math.ceil((new Date(c.validaAte).getTime() - hoje) / DIA)
      if (faltam <= 5) {
        lista.push({
          id: c.id,
          tipo: 'cotacao',
          titulo: c.numero + ' · ' + (c.cliente.nome || 'sem cliente'),
          motivo: faltam < 0 ? 'venceu há ' + -faltam + ' dias' : faltam === 0 ? 'vence hoje' : 'vence em ' + faltam + ' dias',
          desde: -faltam,
          para: '/cotacao/' + c.id,
          valor: totalDaCotacao(c),
        })
      }
    })

    cotacoes.forEach((c: Cotacao) => {
      if (c.estado !== 'rascunho') return
      const parada = Math.floor((hoje - new Date(c.alteradaEm).getTime()) / DIA)
      if (parada >= 2) {
        lista.push({
          id: c.id,
          tipo: 'cotacao',
          titulo: c.numero + ' · ' + (c.cliente.nome || 'sem cliente'),
          motivo: 'rascunho parado há ' + parada + ' dias',
          desde: parada,
          para: '/cotacao/' + c.id,
          valor: totalDaCotacao(c),
        })
      }
    })

    return lista.sort((a, b) => b.desde - a.desde)
  }, [leads, cotacoes, hoje])

  const contas = useMemo(() => {
    const enviadas = cotacoes.filter((c) => c.estado === 'enviada')
    const aprovadasNoMes = cotacoes.filter((c) => {
      if (!c.aprovacao) return false
      const d = new Date(c.aprovacao.em)
      const agora = new Date(hoje)
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()
    })
    return {
      esperando: pendencias.length,
      emAberto: enviadas.length,
      valorEmAberto: enviadas.reduce((s, c) => s + totalDaCotacao(c), 0),
      pedidosNoMes: aprovadasNoMes.length,
      pecasNoMes: aprovadasNoMes.reduce((s, c) => s + pecasDaCotacao(c), 0),
      clientesNovos: clientes.filter((c) => situacaoDoCliente(c, hoje) === 'novo').length,
    }
  }, [cotacoes, clientes, pendencias, hoje])

  const ultimas = useMemo(
    () =>
      [...cotacoes]
        .sort((a, b) => new Date(b.alteradaEm).getTime() - new Date(a.alteradaEm).getTime())
        .slice(0, 5),
    [cotacoes],
  )

  return (
    <Pagina
      acima="Fourtime OS"
      titulo="Início"
      sub="O que está esperando por você, antes de qualquer outra coisa."
      acoes={
        <>
          <Botao tom="contorno" onClick={() => navegar('/funil')}>
            Abrir o funil
          </Botao>
          <Botao tom="primario" onClick={() => navegar('/cotacao')}>
            Cotações
          </Botao>
        </>
      }
    >
      <div className="fila-kpi" style={{ marginBottom: 'var(--sp-5)' }}>
        <Kpi
          rotulo="Esperando você"
          valor={contas.esperando}
          sub="lead esquecido ou proposta vencendo"
          aviso={contas.esperando > 0}
        />
        <Kpi rotulo="Propostas em aberto" valor={contas.emAberto} sub="na mão do cliente" />
        <Kpi
          rotulo="Valor em aberto"
          valor={formatarDinheiro(contas.valorEmAberto)}
          sub="soma do que foi enviado"
        />
        <Kpi
          rotulo="Aprovado no mês"
          valor={contas.pedidosNoMes}
          unidade={contas.pedidosNoMes === 1 ? 'pedido' : 'pedidos'}
          sub={contas.pecasNoMes + ' peças para produzir'}
        />
      </div>

      <section className="pn-bloco">
        <h3 className="pn-h">O que passou da hora</h3>
        {pendencias.length ? (
          <div className="pn-lista">
            {pendencias.map((p) => (
              <button key={p.tipo + p.id} type="button" className="pn-linha" onClick={() => navegar(p.para)}>
                <Selo tom={p.tipo === 'lead' ? 'warn' : 'brand'}>
                  {p.tipo === 'lead' ? 'Lead' : 'Cotação'}
                </Selo>
                <span className="pn-titulo">{p.titulo}</span>
                <span className="pn-motivo">{p.motivo}</span>
                <span className="pn-valor">{formatarDinheiro(p.valor)}</span>
              </button>
            ))}
          </div>
        ) : (
          <Vazio
            titulo="Nada atrasado"
            texto="Nenhum lead esquecido e nenhuma proposta vencendo. Bom dia de trabalho."
          />
        )}
      </section>

      <section className="pn-bloco">
        <h3 className="pn-h">Últimas cotações mexidas</h3>
        <div className="pn-lista">
          {ultimas.map((c) => (
            <button key={c.id} type="button" className="pn-linha" onClick={() => navegar('/cotacao/' + c.id)}>
              <Selo
                tom={
                  c.estado === 'aprovada'
                    ? 'ok'
                    : c.estado === 'enviada'
                      ? 'info'
                      : c.estado === 'recusada'
                        ? 'brand'
                        : 'neutro'
                }
              >
                {NOME_DO_ESTADO_DA_COTACAO[c.estado]}
              </Selo>
              <span className="pn-titulo">
                {c.numero} · {c.cliente.nome || 'sem cliente'}
              </span>
              <span className="pn-motivo">mexida em {formatarData(c.alteradaEm)}</span>
              <span className="pn-valor">{formatarDinheiro(totalDaCotacao(c))}</span>
            </button>
          ))}
        </div>
      </section>

      <Aviso tom="info" titulo="Tudo aqui vem de dado inventado">
        Os números saem das cotações, dos leads e dos clientes de exemplo que vivem neste navegador.
        Quando o banco entrar, esta tela não muda: ela já lê pelas mesmas funções.
      </Aviso>
    </Pagina>
  )
}
