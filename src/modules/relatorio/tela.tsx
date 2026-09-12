import { useMemo, useState } from 'react'
import { Botao, BotaoComMenu, Pagina, Seletor, Vazio, avisar } from '@ds'
import { formatarDinheiroExato, formatarNumeroExato } from '@shared'
import { VENDEDORES } from '@dominio/banco'
import { listarTodosOsPedidos, misto, valorDoPedido, type Pedido } from '@dominio/producao'
import './relatorio.css'

/* ==========================================================================
   Relatorio mensal, no arranjo do v5.

   Marcar um mes abre o relatorio daquele mes; marcar dois ou mais soma. A
   regra vem do editor: um arquivo por mes, sem migracao, e mes sem movimento
   continua clicavel, so mais apagado, porque e nele que se gera o primeiro.

   A semana e a do MES, e nao a do ano: e assim que a fabrica fecha.
   ========================================================================== */

const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MES_LONGO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const semanaDoMes = (dia: number) => Math.floor((dia - 1) / 7) + 1

type Item = Pedido & { ano: number; mes: number; dia: number }

function comData(p: Pedido): Item {
  const [ano, mes, dia] = p.fechadoEm.split('-').map(Number)
  return { ...p, ano, mes: mes - 1, dia }
}

export function TelaRelatorio() {
  const todos = useMemo(() => listarTodosOsPedidos().map(comData), [])
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [meses, setMeses] = useState<number[]>([hoje.getMonth()])
  const [vendedor, setVendedor] = useState('')

  /* os meses que tem movimento no ano escolhido: eles aparecem menos apagados */
  const comMovimento = useMemo(
    () => new Set(todos.filter((x) => x.ano === ano).map((x) => x.mes)),
    [todos, ano],
  )

  const itens = useMemo(
    () =>
      todos
        .filter((x) => x.ano === ano && meses.includes(x.mes))
        .filter((x) => !vendedor || x.vendedor === vendedor)
        .sort((a, b) => a.mes - b.mes || a.dia - b.dia),
    [todos, ano, meses, vendedor],
  )

  const total = itens.reduce((s, x) => s + valorDoPedido(x), 0)
  const pecas = itens.reduce((s, x) => s + x.pecasSubli + x.pecasPersonalizadas, 0)
  const totalSubli = itens.reduce((s, x) => s + x.valorSubli, 0)
  const varios = meses.length > 1

  /* O que a pilula escreve. Ate tres meses cabem por extenso, e ler "Jul · Ago
     · Set" e melhor que ler "3 meses": diz QUAIS. De quatro em diante nao cabe
     mais, e a contagem no canto ja guarda o numero. */
  const naOrdem = [...meses].sort((a2, b2) => a2 - b2)
  const rotuloDoPeriodo =
    naOrdem.length <= 3
      ? naOrdem.map((m) => MES_CURTO[m]).join(' · ') + ' ' + ano
      : naOrdem.length + ' meses de ' + ano

  /* agrupado por mes e semana do mes, na ordem em que aparecem */
  const grupos = useMemo(() => {
    const mapa = new Map<string, Item[]>()
    itens.forEach((x) => {
      const k = x.mes + '-' + semanaDoMes(x.dia)
      if (!mapa.has(k)) mapa.set(k, [])
      mapa.get(k)!.push(x)
    })
    return [...mapa.entries()]
  }, [itens])

  function marcarMes(i: number) {
    setMeses((atual) => {
      if (atual.includes(i)) {
        /* desmarcar o ultimo nao faz nada: relatorio sem mes nenhum nao existe */
        if (atual.length === 1) return atual
        return atual.filter((x) => x !== i)
      }
      return [...atual, i]
    })
  }

  const periodo = (() => {
    const ms = [...meses].sort((a, b) => a - b)
    if (ms.length === 1) return MES_LONGO[ms[0]] + ' de ' + ano
    const seguido = ms.every((m, i) => !i || m === ms[i - 1] + 1)
    return seguido
      ? MES_LONGO[ms[0]] + ' a ' + MES_LONGO[ms[ms.length - 1]] + ' de ' + ano
      : ms.map((m) => MES_CURTO[m]).join(', ') + ' de ' + ano
  })()

  return (
    <Pagina
      acima="Gestão · relatório de pedidos"
      titulo="Relatório mensal"
      sub="Marcar um mês abre o relatório normal; marcar dois ou mais soma. Um arquivo por mês, sem migração."
      acoes={
        <>
          <Botao tom="contorno" onClick={() => avisar('A folha A4 do relatório entra junto com o kanban', 'info')}>
            Imprimir A4
          </Botao>
          {/* O período saiu da coluna da esquerda e virou uma pílula com o
              mesmo menu de antes: passo de ano em cima e a grade dos doze
              meses embaixo. A coluna inteira some com ele, e a tabela, que é
              o conteúdo desta tela, fica com a largura toda. */}
          <BotaoComMenu
            rotulo="PERÍODO"
            marcado
            valor={rotuloDoPeriodo}
            conta={meses.length}
            titulo="Marcar um mês abre o relatório do mês; marcar dois ou mais soma"
          >
            {() => (
              <>
                <div className="rl-menu-topo">
                  <b>Escolher o período</b>
                  <span className="rl-ano">
                    <button
                      type="button"
                      onClick={() => setAno((a2) => a2 - 1)}
                      aria-label="Ano anterior"
                    >
                      ‹
                    </button>
                    <b>{ano}</b>
                    <button
                      type="button"
                      onClick={() => setAno((a2) => a2 + 1)}
                      aria-label="Próximo ano"
                    >
                      ›
                    </button>
                  </span>
                </div>
                <div className="rl-meses">
                  {MES_CURTO.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      /* 'sem-movimento' e nao 'vazio': vazio e a classe do
                         estado vazio do Design System, com 44 px de recheio, e
                         ela estava inchando cada mes para 90 px de altura */
                      className={[
                        meses.includes(i) ? 'ligado' : '',
                        comMovimento.has(i) ? '' : 'sem-movimento',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => marcarMes(i)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="rl-nota">
                  Mês sem movimento continua clicável, só mais apagado: é nele que se gera o
                  primeiro relatório. Desmarcar o último mês não faz nada.
                </p>
              </>
            )}
          </BotaoComMenu>
          <Seletor
            rotulo="VENDEDOR"
            valor={vendedor}
            opcoes={VENDEDORES.map((v) => ({
              valor: v,
              rotulo: v,
              contagem: itens.filter((x) => x.vendedor === v).length,
            }))}
            vazio="Todos os vendedores"
            aoEscolher={setVendedor}
          />
          <Botao tom="primario" onClick={() => avisar('Gerar e guardar no Drive entra com o Supabase', 'info')}>
            Gerar / atualizar
          </Botao>
        </>
      }
    >
      <div className="rl-grade">
        <div className="rl-direita">
          <div className="rl-fixo">
            <div className="rl-fixo-quem">
              <span className="rot">Relatório de pedidos</span>
              <b>{periodo}</b>
            </div>
            <div className="rl-fixo-numeros">
              <Numero rotulo="Pedidos" valor={String(itens.length)} />
              <Numero rotulo="Peças" valor={pecas.toLocaleString('pt-BR')} />
              <Numero rotulo="Faturamento" valor={formatarDinheiroExato(total)} />
              <Numero
                rotulo="Ticket médio"
                valor={formatarDinheiroExato(itens.length ? total / itens.length : 0)}
              />
              <Numero
                rotulo="Sublimação"
                valor={Math.round((totalSubli / (total || 1)) * 100) + '% da venda'}
              />
            </div>
          </div>

          <div className="cartao rl-rolo">
            {itens.length ? (
              <table className="rl-tab">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th className="esconde">Vendedor</th>
                    <th className="esconde">Departamento</th>
                    <th className="num">Pçs subli</th>
                    <th className="num">Pçs pers.</th>
                    <th className="num">Pçs</th>
                    <th className="num">Subli R$</th>
                    <th className="num">Person. R$</th>
                    <th className="num">Total R$</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(([chave, linhas]) => {
                    const [m, s] = chave.split('-')
                    return (
                      <Grupo
                        key={chave}
                        titulo={
                          'Semana ' + s + (varios ? ' · ' + MES_LONGO[+m] : '') + ' · ' +
                          linhas.length + ' pedido' + (linhas.length === 1 ? '' : 's')
                        }
                        linhas={linhas}
                        varios={varios}
                        rotuloDoTotal="Total da semana"
                      />
                    )
                  })}
                  <Total linhas={itens} rotulo="Total do período" forte />
                </tbody>
              </table>
            ) : (
              <Vazio
                titulo="Nenhum pedido no período"
                texto="Escolha outro mês. Mês sem movimento continua clicável, e é nele que se gera o primeiro relatório."
              />
            )}
          </div>

          <p className="rl-rodape">
            O valor de sublimação aparece em vermelho, com asterisco, quando o pedido tem layout de
            outra técnica junto. A semana é do mês; com vários meses o cabeçalho diz qual.
          </p>
        </div>
      </div>
    </Pagina>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rl-num">
      <span>{rotulo}</span>
      <b>{valor}</b>
    </div>
  )
}

function Grupo({
  titulo,
  linhas,
  varios,
  rotuloDoTotal,
}: {
  titulo: string
  linhas: Item[]
  varios: boolean
  rotuloDoTotal: string
}) {
  return (
    <>
      <tr className="rl-grupo">
        <td colSpan={11}>{titulo}</td>
      </tr>
      {linhas.map((x) => (
        <tr key={x.id}>
          <td className="rl-suave num">
            {x.dia}
            {varios ? ' · ' + MES_CURTO[x.mes] : ''}
          </td>
          <td className="rl-cod">{x.id}</td>
          <td className="rl-cliente">{x.cliente}</td>
          <td className="esconde rl-suave">{x.vendedor}</td>
          <td className="esconde rl-suave">{x.departamento}</td>
          <td className="num">{x.pecasSubli || ''}</td>
          <td className="num">{x.pecasPersonalizadas || ''}</td>
          <td className="num forte">{x.pecasSubli + x.pecasPersonalizadas}</td>
          <td className={misto(x) ? 'num rl-misto' : 'num'}>
            {x.valorSubli ? formatarNumeroExato(x.valorSubli) + (misto(x) ? '*' : '') : ''}
          </td>
          <td className="num">
            {x.valorPersonalizado ? formatarNumeroExato(x.valorPersonalizado) : ''}
          </td>
          <td className="num forte">{formatarNumeroExato(valorDoPedido(x))}</td>
        </tr>
      ))}
      <Total linhas={linhas} rotulo={rotuloDoTotal} />
    </>
  )
}

function Total({ linhas, rotulo, forte }: { linhas: Item[]; rotulo: string; forte?: boolean }) {
  const soma = (f: (x: Item) => number) => linhas.reduce((s, x) => s + f(x), 0)
  return (
    <tr className={forte ? 'rl-total periodo' : 'rl-total'}>
      {/* Tres celulas, e nao um colSpan de cinco.

          Vendedor e Departamento somem por CSS abaixo de 1536 px, e colSpan
          nao sabe disso: ele continua comendo cinco colunas quando so tres
          estao na tela, e a linha inteira de numeros escorrega duas colunas
          para a esquerda. O total da semana aparecia na coluna do subtotal de
          sublimacao, certinho e no lugar errado, que e o pior tipo de numero
          errado. Com celulas de verdade, a que some some junto. */}
      <td colSpan={3}>{rotulo}</td>
      <td className="esconde" />
      <td className="esconde" />
      <td className="num">{soma((x) => x.pecasSubli).toLocaleString('pt-BR')}</td>
      <td className="num">{soma((x) => x.pecasPersonalizadas).toLocaleString('pt-BR')}</td>
      <td className="num">
        {soma((x) => x.pecasSubli + x.pecasPersonalizadas).toLocaleString('pt-BR')}
      </td>
      <td className="num">{formatarNumeroExato(soma((x) => x.valorSubli))}</td>
      <td className="num">{formatarNumeroExato(soma((x) => x.valorPersonalizado))}</td>
      <td className="num">{formatarNumeroExato(soma(valorDoPedido))}</td>
    </tr>
  )
}
