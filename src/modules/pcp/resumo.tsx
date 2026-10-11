import { CalendarCheck, Check, UserCheck } from '@phosphor-icons/react'
import { Botao, Kpi, Marcacao, Selo, TituloCartao } from '@ds'
import type { PedidoNoPcp } from '@dominio/producao'
import { dataCurta, emDias, temFalta } from './fila'

/* ==========================================================================
   NADA ESCOLHIDO (prancha 87): o portão inteiro de uma vez.

   Os quatro números; as ENTREGAS MAIS PRÓXIMAS, que é a pergunta de quem
   abre o PCP de manhã (o que aperta primeiro); e a MESA DO DIRETOR, com os
   pedidos já conferidos e o "Aprovar os marcados".

   SÓ O DIRETOR VÊ OS BOTÕES. Quem confere vê a mesa para saber o que já
   passou por ele, mas a caixa de marcar e o Aprovar são de quem tem o
   controle total do PCP.

   O PEDIDO COM FALTA NASCE DESMARCADO na mesa (escolha do Claude): o diretor
   pode descer com falta, mas marca a caixa de propósito.
   ========================================================================== */

const VISIVEIS = 8

function fase(p: PedidoNoPcp): string {
  if (p.comOVendedor) return 'com o vendedor'
  if (p.marcado) return 'esperando o diretor'
  return 'conferindo'
}

/** "a Bruna", "a Bruna e o Léo": os nomes sem artigo, que o sistema não sabe o gênero */
function nomes(lista: string[]): string {
  const u = [...new Set(lista.filter(Boolean))]
  if (!u.length) return 'pelo PCP'
  if (u.length === 1) return 'por ' + u[0]
  return 'por ' + u.slice(0, -1).join(', ') + ' e ' + u[u.length - 1]
}

export function ResumoDoPcp({
  portao,
  todos,
  diferencas = {},
  mesa,
  podeAprovar,
  escolhidos,
  ocupado,
  aoEscolher,
  aoAprovar,
  aoAbrir,
}: {
  /** conferindo e esperando o diretor, sem os devolvidos */
  portao: PedidoNoPcp[]
  /** tudo que está no PCP, para as entregas */
  todos: PedidoNoPcp[]
  /** as diferenças da comparação dos pedidos já abertos */
  diferencas?: Record<string, number>
  mesa: PedidoNoPcp[]
  podeAprovar: boolean
  escolhidos: string[]
  ocupado: boolean
  aoEscolher: (id: string) => void
  aoAprovar: () => void
  aoAbrir: (id: string) => void
}) {
  const comProblema = portao.filter(
    p => temFalta(p) || (!p.marcado && (!!p.devolvidoMotivo || (diferencas[p.id] ?? 0) > 0)),
  ).length
  const atrasados = todos.filter(p => emDias(p.entregaEm).atrasado).length
  const entregas = todos
    .filter(p => p.entregaEm)
    .sort((a, b) => a.entregaEm.localeCompare(b.entregaEm) || a.numero.localeCompare(b.numero))
    .slice(0, VISIVEIS)
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const marcadosNaMesa = mesa.filter(p => escolhidos.includes(p.id))
  const comFaltaNaMesa = mesa.filter(temFalta).length

  return (
    <div className="pc-resumo">
      <div className="pc-kpis">
        <Kpi
          rotulo="No portão"
          valor={portao.length}
          unidade={portao.length === 1 ? 'pedido' : 'pedidos'}
          sub="conferindo e esperando"
        />
        <Kpi
          rotulo="Na mesa do diretor"
          valor={mesa.length}
          unidade={mesa.length === 1 ? 'pedido' : 'pedidos'}
          sub="já conferidos pelo PCP"
        />
        <Kpi
          rotulo="Com diferença ou falta"
          valor={comProblema}
          unidade={comProblema === 1 ? 'pedido' : 'pedidos'}
          sub={comProblema ? 'o vendedor ou o diretor decide' : 'nada pendente'}
          aviso={comProblema > 0}
        />
        <Kpi
          rotulo="Já atrasado"
          valor={atrasados}
          sub={atrasados ? 'a entrega já passou' : 'nenhum passou da data'}
          aviso={atrasados > 0}
        />
      </div>

      <div className="pc-resumo-par">
        <section className="cartao pc-entregas" aria-label="Entregas mais próximas">
          <header className="pc-cab">
            <TituloCartao icone={CalendarCheck}>Entregas mais próximas</TituloCartao>
            <span className="pc-cab-apoio">contando de hoje, {hoje}</span>
          </header>
          {!entregas.length ? (
            <p className="pc-nada">Nenhum pedido do PCP tem data de entrega.</p>
          ) : (
            <ul className="pc-lista">
              {entregas.map(p => {
                const d = emDias(p.entregaEm)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="pc-linha"
                      data-entrega={p.numero}
                      onClick={() => aoAbrir(p.id)}
                    >
                      <span className="pilha colada pc-linha-meio">
                        <b className="pc-cliente">{p.cliente || 'sem cliente'}</b>
                        <small>
                          {p.numero} · {p.pecas} pçs · {fase(p)}
                        </small>
                      </span>
                      <span className={d.perto ? 'pc-dias pc-perto' : 'pc-dias'}>{d.texto}</span>
                      <b className="pc-data">{dataCurta(p.entregaEm)}</b>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="cartao pc-mesa-diretor" aria-label="Mesa do diretor">
          <header className="pc-cab">
            <TituloCartao icone={UserCheck}>Mesa do diretor</TituloCartao>
            <span className="pc-cab-apoio">
              {podeAprovar ? 'só o diretor vê os botões' : 'quem aprova é o diretor'}
            </span>
          </header>
          {!mesa.length ? (
            <p className="pc-nada">
              Nada esperando o diretor. O pedido chega aqui quando o PCP marca como conferido.
            </p>
          ) : (
            <>
              <ul className="pc-lista">
                {mesa.map(p => (
                  <li key={p.id} className="pc-mesa-linha" data-mesa={p.numero}>
                    {podeAprovar ? (
                      <Marcacao
                        checked={escolhidos.includes(p.id)}
                        disabled={ocupado}
                        aria-label={'Escolher ' + p.numero}
                        onChange={() => aoEscolher(p.id)}
                      />
                    ) : null}
                    <span className="pilha colada pc-linha-meio">
                      <b className="pc-cliente">
                        {p.cliente || 'sem cliente'}
                        {temFalta(p) ? (
                          <>
                            {' '}
                            <Selo tom="brand">falta</Selo>
                          </>
                        ) : null}
                      </b>
                      <small>
                        {p.numero} · {p.pecas} pçs · entrega {dataCurta(p.entregaEm)}
                      </small>
                    </span>
                    <Botao tom="limpo" tamanho="sm" onClick={() => aoAbrir(p.id)}>
                      Abrir
                    </Botao>
                  </li>
                ))}
              </ul>
              <div className="pc-mesa-pe">
                <p>
                  {mesa.length === 1
                    ? 'Ele já foi conferido '
                    : `Os ${mesa.length} já foram conferidos `}
                  {nomes(mesa.map(p => p.marcadoPor))}
                  {comFaltaNaMesa
                    ? `, e ${comFaltaNaMesa === 1 ? 'um desce' : comFaltaNaMesa + ' descem'} com falta de material`
                    : ' e não têm falta de material'}
                  . Aprovar cria as fatias no kanban e põe o pedido na produção.
                </p>
                {podeAprovar ? (
                  <Botao
                    tom="primario"
                    disabled={!marcadosNaMesa.length || ocupado}
                    onClick={aoAprovar}
                  >
                    <Check size={17} />
                    {marcadosNaMesa.length
                      ? `Aprovar ${marcadosNaMesa.length === 1 ? 'o marcado' : `os ${marcadosNaMesa.length} marcados`}`
                      : 'Marque o que vai descer'}
                  </Botao>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
