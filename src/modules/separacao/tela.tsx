import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Botao,
  Entrada,
  Esqueleto,
  Kpi,
  Pagina,
  Selo,
  Tabela,
  Vazio,
  avisar,
  type Coluna,
} from '@ds'
import {
  carregarFilaDaSeparacao,
  carregarReservasDoPedido,
  casasDaUnidade,
  comecarASeparacao,
  concluirASeparacao,
  desfazerASeparacao,
  numeroNaUnidade,
  separarMaterial,
  type PedidoNaSeparacao,
  type ReservaDoPedido,
} from '@dominio/estoque'
import './separacao.css'

/* ==========================================================================
   Separação.

   Da aprovação até o corte o pedido para aqui. É onde a reserva deixa de ser
   promessa: o material sai da prateleira de verdade, e o que não saiu vira um
   aviso que viaja com o pedido até o PCP.

   A TELA SEMPRE PERGUNTA QUANTO SAIU. O número reservado já vem escrito no
   campo, mas quem separa confirma ou corrige. Parece trabalho a mais e não é:
   a reserva é uma conta e a separação é uma pesagem, e quando as duas
   discordam quem está certo é a balança. Um botão que só dissesse "separado"
   gravaria a conta como se fosse a pesagem, e o razão passaria a guardar o que
   o sistema achou em vez do que aconteceu.

   E é por isso que a linha sem consumo cadastrado também dá para separar: o
   campo nasce vazio e a pessoa escreve o que pesou. O sistema não sabia quanto
   era; a fábrica sabe.

   CONCLUIR NÃO EXIGE QUE TUDO TENHA SAÍDO. Exigir isso pararia a fábrica no
   dia em que faltasse meio quilo de malha: o pedido ficaria preso aqui e
   ninguém decidiria nada. Quem decide se o pedido desce assim é o PCP, e para
   decidir ele precisa que o pedido chegue lá com a falta escrita.
   ========================================================================== */

function dataCurta(iso: string): string {
  if (!iso) return 'sem data'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function TelaSeparacao() {
  const [fila, setFila] = useState<PedidoNaSeparacao[]>([])
  const [escolhido, setEscolhido] = useState<PedidoNaSeparacao | null>(null)
  const [linhas, setLinhas] = useState<ReservaDoPedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abrindo, setAbrindo] = useState(false)
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')
  /* A LEITURA QUE FALHOU FICA GUARDADA, e nao vira lista vazia.

     Ate 24/09 o catch aqui embaixo so soltava um recado, que some sozinho em
     alguns segundos, e deixava `linhas` vazia. O que ficava na tela depois
     disso era "Nenhum material neste pedido", uma frase plausivel e falsa: o
     cartao da fila ao lado dizia "0 de 1" ao mesmo tempo. Foi assim que a
     view quebrada da 027 passou despercebida por dias.

     Tela que nao distingue "nao ha nada" de "nao consegui ler" mente sempre
     que a segunda acontece, e mente com confianca. */
  const [erroDoMaterial, setErroDoMaterial] = useState('')

  /* O que a pessoa digitou, por linha. Ele nasce com o reservado e é ele que
     vai para o razão: o campo é a balança, e não um espelho da conta. */
  const [pesado, setPesado] = useState<Record<string, string>>({})

  const recarregarFila = useCallback(async () => {
    const f = await carregarFilaDaSeparacao()
    setFila(f)
    return f
  }, [])

  useEffect(() => {
    let vivo = true
    carregarFilaDaSeparacao()
      .then((f) => {
        if (!vivo) return
        setFila(f)
        setEscolhido(f[0] ?? null)
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler a fila.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  const abrir = useCallback(async (p: PedidoNaSeparacao | null) => {
    if (!p) {
      setLinhas([])
      return
    }
    setAbrindo(true)
    setErroDoMaterial('')
    try {
      const r = await carregarReservasDoPedido(p.id)
      setLinhas(r)
      const inicial: Record<string, string> = {}
      r.forEach((x) => {
        inicial[x.id] = x.semConsumo
          ? ''
          : String(x.quantidade).replace('.', ',')
      })
      setPesado(inicial)
    } catch (e) {
      const recado = e instanceof Error ? e.message : 'Não consegui ler o material do pedido.'
      setLinhas([])
      setErroDoMaterial(recado)
      avisar(recado, 'brand')
    } finally {
      setAbrindo(false)
    }
  }, [])

  useEffect(() => {
    void abrir(escolhido)
  }, [escolhido, abrir])

  const conta = useMemo(
    () => ({
      naFila: fila.length,
      prontos: fila.filter((p) => p.tudoSeparado).length,
      semConsumo: fila.filter((p) => p.semConsumo > 0).length,
      naoCobre: fila.filter((p) => p.naoCobre > 0).length,
      pecas: fila.reduce((s, p) => s + p.pecas, 0),
    }),
    [fila],
  )

  function lido(texto: string): number {
    const n = Number(texto.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  async function separar(l: ReservaDoPedido) {
    if (!escolhido || ocupado) return
    const quanto = lido(pesado[l.id] ?? '')
    if (quanto <= 0) {
      avisar('Escreva quanto saiu da prateleira.', 'warn')
      return
    }
    setOcupado(l.id)
    try {
      /* O pedido entra em `separacao` no instante em que a primeira linha sai
         da prateleira, e não quando alguém abre a tela: abrir para olhar não é
         começar, e a fila não deveria mentir sobre isso. */
      if (escolhido.estado === 'aprovado') await comecarASeparacao(escolhido.id)
      await separarMaterial(l.id, quanto)
      await depoisDeMexer()
      avisar(`${numeroNaUnidade(quanto, l.unidade)} de ${l.material} saiu da prateleira.`, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui separar.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  async function desfazer(l: ReservaDoPedido) {
    if (ocupado) return
    setOcupado(l.id)
    try {
      await desfazerASeparacao(l.id)
      await depoisDeMexer()
      avisar(`${l.material} voltou para a prateleira.`, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui desfazer.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  /* A fila e o pedido aberto são a mesma verdade vista de dois jeitos: mexer
     numa linha muda os dois, e recarregar só um deixaria o contador da fila
     dizendo 2 de 7 com sete linhas separadas na frente. */
  async function depoisDeMexer() {
    const f = await recarregarFila()
    const eu = escolhido ? (f.find((p) => p.id === escolhido.id) ?? null) : null
    if (eu) setEscolhido(eu)
    else await abrir(escolhido)
  }

  async function concluir() {
    if (!escolhido || ocupado) return
    setOcupado('concluir')
    try {
      const recado = await concluirASeparacao(escolhido.id)
      const f = await recarregarFila()
      setEscolhido(f[0] ?? null)
      avisar(recado, recado.includes('falta') ? 'warn' : 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui concluir.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  const colunas: Coluna<ReservaDoPedido>[] = [
    {
      chave: 'material',
      titulo: 'Material',
      celula: (l) => (
        <span className="pilha colada">
          <b className="sp-nome">{l.material}</b>
          <small className="sp-apoio sp-nome">
            {l.categoria}
            {l.semConsumo ? ' · consumo não cadastrado' : ''}
            {/* NO CELULAR A COLUNA "PRECISA" SOME E ELE DESCE PARA CA. Quatro
                colunas nao cabem em 390 com um campo e um botao dentro, e
                separar sem saber quanto era a conta e separar no escuro. */}
            {l.semConsumo ? null : (
              <span className="sp-no-celular">
                {' · precisa ' + numeroNaUnidade(l.quantidade, l.unidade)}
              </span>
            )}
          </small>
        </span>
      ),
    },
    {
      chave: 'precisa',
      titulo: 'Precisa',
      numero: true,
      celula: (l) =>
        l.semConsumo ? (
          <Selo tom="warn">não sei</Selo>
        ) : (
          <b>{numeroNaUnidade(l.quantidade, l.unidade)}</b>
        ),
    },
    {
      chave: 'tem',
      titulo: 'Na prateleira',
      numero: true,
      celula: (l) => (
        <span className={!l.semConsumo && l.saldo < l.quantidade ? 'sp-pouco' : 'sp-apoio'}>
          {numeroNaUnidade(l.saldo, l.unidade)}
        </span>
      ),
    },
    {
      chave: 'saiu',
      titulo: 'Saiu',
      numero: true,
      celula: (l) =>
        l.baixada ? (
          <b className="sp-saiu">{numeroNaUnidade(l.separado, l.unidade)}</b>
        ) : (
          <Entrada
            tamanho="sm"
            inputMode="decimal"
            className="sp-campo"
            value={pesado[l.id] ?? ''}
            disabled={ocupado === l.id}
            placeholder={casasDaUnidade(l.unidade) ? '0,0' : '0'}
            aria-label={'Quanto saiu de ' + l.material + ', em ' + l.unidade}
            onChange={(e) => setPesado((x) => ({ ...x, [l.id]: e.currentTarget.value }))}
          />
        ),
    },
    {
      chave: 'acao',
      titulo: '',
      /* FORTE, E NÃO PRIMÁRIO, no botão de separar. No V7 vermelho é ação
         principal e atraso, e a ação principal desta tela é Concluir a
         separação, no topo. Uma coluna de botões vermelhos disputaria a
         atenção com ela e com o vermelho da falta, e três vermelhos na mesma
         tela não são nenhum. */
      celula: (l) =>
        l.baixada ? (
          <Botao tom="limpo" tamanho="sm" onClick={() => void desfazer(l)} disabled={!!ocupado}>
            Desfazer
          </Botao>
        ) : (
          <Botao
            tom="forte"
            tamanho="sm"
            onClick={() => void separar(l)}
            carregando={ocupado === l.id}
            disabled={!!ocupado}
          >
            Separar
          </Botao>
        ),
    },
  ]

  const separados = linhas.filter((l) => l.baixada).length

  return (
    <Pagina
      acima="Produção · materiais"
      titulo="Separação"
      sub={
        <>
          <b>{conta.naFila}</b> pedido{conta.naFila === 1 ? '' : 's'} esperando ·{' '}
          {conta.pecas.toLocaleString('pt-BR')} peças · o material sai da prateleira aqui, e não na
          entrega
        </>
      }
    >
      <div className="sp-kpis">
        <Kpi rotulo="Na fila" valor={conta.naFila} sub="da aprovação até o corte" />
        <Kpi rotulo="Prontos para concluir" valor={conta.prontos} sub="material todo separado" />
        <Kpi
          rotulo="A prateleira não cobre"
          valor={conta.naoCobre}
          sub={conta.naoCobre ? 'vai descer com falta' : 'tudo coberto'}
          aviso={conta.naoCobre > 0}
        />
        <Kpi
          rotulo="Sem consumo cadastrado"
          valor={conta.semConsumo}
          sub={conta.semConsumo ? 'a pesagem decide' : 'toda linha tem tamanho'}
          aviso={conta.semConsumo > 0}
        />
      </div>

      {erro ? (
        <Vazio titulo="Não consegui ler a fila" texto={erro} />
      ) : carregando ? (
        <section className="cartao sp-espera">
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </section>
      ) : !fila.length ? (
        <Vazio
          titulo="Nada esperando separação"
          texto="Todo pedido aprovado já teve o material separado e seguiu para o PCP. Pedido novo aparece aqui no instante em que a cotação é aprovada."
        />
      ) : (
        /* O PALCO SÓ EXISTE PARA SER MEDIDO. Ele é o contêiner que a mesa
           consulta: sem ele, a mesa perguntaria o tamanho da JANELA, e a
           janela tem 248px de menu lateral que a mesa não pode usar. */
        <div className="sp-palco">
          <div className="sp-mesa">
            <section className="cartao sp-fila" aria-label="Fila de separação">
              {fila.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={escolhido?.id === p.id ? 'sp-item escolhido' : 'sp-item'}
                  onClick={() => setEscolhido(p)}
                >
                  <span className="sp-item-topo">
                    <b className="sp-numero">{p.numero}</b>
                    {p.estado === 'separacao' ? <Selo tom="info">em separação</Selo> : null}
                  </span>
                  <span className="sp-nome sp-cliente">{p.cliente || 'sem cliente'}</span>
                  <span className="sp-item-pe">
                    <small className="sp-apoio">
                      {p.pecas} pçs · entrega {dataCurta(p.entregaEm)}
                    </small>
                    <small className={p.tudoSeparado ? 'sp-pronto' : 'sp-apoio'}>
                      {p.materiais ? `${p.separados} de ${p.materiais}` : 'sem material'}
                    </small>
                  </span>
                </button>
              ))}
            </section>

            <section className="cartao sp-quadro">
              {escolhido ? (
                <>
                  <header className="sp-topo">
                    <div className="pilha colada">
                      <b>
                        {escolhido.numero} · {escolhido.cliente || 'sem cliente'}
                      </b>
                      <small className="sp-apoio">
                        {escolhido.pecas} peças · {escolhido.departamento || 'sem departamento'} ·
                        entrega {dataCurta(escolhido.entregaEm)}
                      </small>
                    </div>
                    {/* CONCLUIR FICA TRANCADO ENQUANTO A LISTA NAO ABRIU.

                        Concluir manda o pedido para o PCP com a falta carimbada,
                        e a falta e calculada no banco a partir do que foi
                        baixado. Concluir sem ter visto o material e carimbar uma
                        falta que ninguem conferiu, e o pedido segue para a
                        frente com um numero inventado atras dele. */}
                    <Botao
                      tom="primario"
                      onClick={() => void concluir()}
                      carregando={ocupado === 'concluir'}
                      disabled={!!ocupado || !!erroDoMaterial}
                      title={
                        erroDoMaterial
                          ? 'A lista de material não abriu. Recarregue a página antes de concluir.'
                          : undefined
                      }
                    >
                      Concluir a separação
                    </Botao>
                  </header>

                  {abrindo ? (
                    <div className="sp-espera">
                      <Esqueleto altura={18} />
                      <Esqueleto altura={18} />
                      <Esqueleto altura={18} />
                    </div>
                  ) : (
                    <Tabela
                      colunas={colunas}
                      linhas={linhas}
                      chaveDaLinha={(l) => l.id}
                      marcadas={linhas.filter((l) => l.baixada).map((l) => l.id)}
                      vazio={
                        erroDoMaterial ? (
                          <Vazio
                            titulo="Não consegui ler o material deste pedido"
                            texto={
                              erroDoMaterial +
                              ' A fila ao lado diz quantos materiais este pedido tem; não conclua a separação enquanto esta lista não abrir.'
                            }
                          />
                        ) : (
                          <Vazio
                            titulo="Nenhum material neste pedido"
                            texto="A reserva nasce da aprovação e depende do consumo cadastrado. Sem material cadastrado para os tecidos deste layout, não há o que separar: concluir manda o pedido direto para o PCP."
                          />
                        )
                      }
                    />
                  )}

                  <footer className="sp-pe">
                    <small className="sp-apoio">
                      {erroDoMaterial
                        ? 'a lista de material não abriu'
                        : linhas.length
                          ? `${separados} de ${linhas.length} materiais separados`
                          : 'sem material para separar'}
                      . Concluir move o pedido para o PCP, com falta ou sem.
                    </small>
                  </footer>
                </>
              ) : (
                <Vazio titulo="Escolha um pedido" texto="A fila está à esquerda." />
              )}
            </section>
          </div>
        </div>
      )}
    </Pagina>
  )
}
