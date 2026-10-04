import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { CaretRight, Plus, TShirt } from '@phosphor-icons/react'
import { Botao, Esqueleto, Pagina, Seletor, Vazio } from '@ds'
import { nomeDoMes, quandoFoi, ultimosMeses, usarConsulta } from '@shared'
import {
  carregarParceiros,
  carregarUltimasCompras,
  carregarVendasDoMes,
  colecoesDaLoja,
  fraseDoAcordo,
  miniatura,
  situacaoDaPagina,
  somarPorParceiro,
  ultimoAvisoDaLoja,
  type AvisoDaLoja,
  type Colecao,
  type Parceiro,
  type VendaDoParceiro,
} from '@dominio/parceiro'
import { pode, useSessao } from '@dominio/sessao'
import { dinheiro, plural } from './apoio'
import { FichaDoParceiro } from './ficha'
import './parceiros.css'

/* ==========================================================================
   Parceiros.

   Quem vende peças na loja e quanto recebe por venda. A lista de um lado, com
   o que cada parceiro vendeu no mês, e a ficha do outro, onde mora o acordo, o
   link e a senha da página dele.

   AS VENDAS CHEGAM SOZINHAS. A loja avisa cada pedido ao Supabase, e esta
   página só lê. A linha "último aviso da loja" é o termômetro disso: se ela
   parar no tempo, a loja parou de avisar.

   O MÊS É O DE QUEM OLHA, e vale para os três números da lista.

   A SANFONA. Clicar num parceiro abre a ficha dele ao lado e, embaixo da
   linha, as últimas compras das peças dele: a foto, a peça, quando foi e o
   valor. Clicar de novo no mesmo fecha a sanfona; a ficha fica. As compras
   não obedecem ao mês escolhido: são as mais novas, de qualquer mês. Pedido
   do Henrique de 03/10/2026, depois do wireframe (a primeira versão era uma
   coluna à esquerda, que ele não gostou).
   ========================================================================== */

const NOVO = 'novo'

export function TelaParceiros() {
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const podeEditar = !!pessoa && pode(pessoa, 'parceiros', 'editar')

  const [hoje] = useState(() => new Date())
  const meses = useMemo(() => ultimosMeses(hoje, 12), [hoje])
  const [mes, setMes] = useState(meses[0])

  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [vendas, setVendas] = useState<VendaDoParceiro[]>([])
  const [aviso, setAviso] = useState<AvisoDaLoja | null>(null)
  const [colecoes, setColecoes] = useState<Colecao[]>([])
  const [semColecoes, setSemColecoes] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  /* o id do parceiro aberto, NOVO para o cadastro novo, vazio para nada */
  const [aberto, setAberto] = useState('')
  /* o id do parceiro com a sanfona das últimas compras aberta, e o que já foi
     lido de cada um: a lista, 'erro', ou nada enquanto a leitura não volta */
  const [sanfona, setSanfona] = useState('')
  const [compras, setCompras] = useState<Record<string, VendaDoParceiro[] | 'erro'>>({})

  /* a ficha ao lado só cabe na tela larga; na estreita ela vira folha */
  const larga = usarConsulta('(min-width: 1280px)')
  const estreita = usarConsulta('(max-width: 767px)')

  const ler = useCallback(async () => {
    const [ps, vs, av] = await Promise.all([
      carregarParceiros(),
      carregarVendasDoMes(mes),
      ultimoAvisoDaLoja(),
    ])
    setParceiros(ps)
    setVendas(vs)
    setAviso(av)
    setErro('')
  }, [mes])

  const recarregar = useCallback(async () => {
    try {
      await ler()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler os parceiros.')
    }
  }, [ler])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    ler()
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler os parceiros.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [ler])

  /* As coleções vêm da loja, pelo porteiro, e só quem edita precisa delas. É
     apoio: se não vierem, a ficha diz por quê e continua de pé. */
  useEffect(() => {
    if (!podeEditar) return
    let vivo = true
    colecoesDaLoja()
      .then(cs => {
        if (!vivo) return
        setColecoes(cs)
        setSemColecoes('')
      })
      .catch((e: unknown) => {
        if (vivo) setSemColecoes(e instanceof Error ? e.message : 'a loja não respondeu')
      })
    return () => {
      vivo = false
    }
  }, [podeEditar])

  const somas = useMemo(() => somarPorParceiro(vendas), [vendas])

  /* as compras de cada parceiro são lidas na primeira vez que a sanfona dele abre */
  useEffect(() => {
    if (!sanfona || compras[sanfona] !== undefined) return
    let vivo = true
    carregarUltimasCompras(sanfona)
      .then(cs => {
        if (vivo) setCompras(antes => ({ ...antes, [sanfona]: cs }))
      })
      .catch(() => {
        if (vivo) setCompras(antes => ({ ...antes, [sanfona]: 'erro' }))
      })
    return () => {
      vivo = false
    }
  }, [sanfona, compras])

  /* clicar no parceiro abre a ficha dele e a sanfona; no que já está com a
     sanfona aberta, fecha só a sanfona */
  const escolher = (id: string) => {
    setAberto(id)
    setSanfona(antes => (antes === id ? '' : id))
  }

  const comprasDe = (id: string) => {
    const lista = compras[id]
    return (
      <div className="pa-sanfona-caixa">
        <p className="pa-sanfona-titulo">Últimas compras</p>
        {lista === undefined ? (
          <div className="pa-espera pa-sanfona-espera">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        ) : lista === 'erro' ? (
          <p className="pa-ajuda">
            Não consegui ler as compras agora. Feche e abra de novo para tentar.
          </p>
        ) : lista.length === 0 ? (
          <p className="pa-ajuda">Nenhuma compra das peças deste parceiro ainda.</p>
        ) : (
          <ul className="pa-compras">
            {lista.map(v => {
              const foto = miniatura(v.imagem)
              return (
                <li key={v.id} className="pa-compra">
                  <span className="pa-foto">
                    {foto ? (
                      <img
                        src={foto}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        onError={e => {
                          e.currentTarget.hidden = true
                        }}
                      />
                    ) : (
                      <TShirt size={18} />
                    )}
                  </span>
                  <span className="pa-nome">
                    <b>{v.produto}</b>
                    <small>
                      {quandoFoi(v.quando, hoje)}
                      {v.pecas > 1 ? ` · ${v.pecas} peças` : ''}
                    </small>
                  </span>
                  <span className="pa-compra-valor">{dinheiro(v.valor)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  /* quem mais vendeu no mês vem primeiro; no empate, a ordem do nome */
  const ordenados = useMemo(
    () =>
      [...parceiros].sort(
        (a, b) =>
          (somas.get(b.id)?.valor ?? 0) - (somas.get(a.id)?.valor ?? 0) ||
          a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    [parceiros, somas],
  )

  /* na tela larga a ficha nunca fica vazia: sem escolha, vale o primeiro */
  const idAberto = aberto || (larga ? (ordenados[0]?.id ?? '') : '')
  const escolhido = idAberto === NOVO ? null : (parceiros.find(p => p.id === idAberto) ?? null)
  const novo = idAberto === NOVO

  const ficha = (
    <FichaDoParceiro
      key={novo ? NOVO : (escolhido?.id ?? 'nenhum')}
      parceiro={escolhido}
      novo={novo}
      moldura={larga ? 'cartao' : 'folha'}
      podeEditar={podeEditar}
      colecoes={colecoes}
      semColecoes={semColecoes}
      hoje={hoje}
      aoFechar={() => setAberto('')}
      aoSalvo={async id => {
        await recarregar()
        setAberto(larga ? id : '')
      }}
      aoMudar={recarregar}
    />
  )

  return (
    <Pagina
      acima="Gestão"
      titulo="Parceiros"
      sub="Quem vende peças na loja e quanto recebe por venda."
      acoes={
        podeEditar ? (
          <Botao tom="primario" onClick={() => setAberto(NOVO)}>
            <Plus size={16} weight="bold" />
            Novo parceiro
          </Botao>
        ) : null
      }
    >
      <div className="pa-barra">
        <p className="pa-aviso">
          {aviso ? (
            <>
              Último aviso da loja: <b>{quandoFoi(aviso.quando, hoje)}</b>
            </>
          ) : (
            'A loja ainda não mandou nenhum aviso de venda.'
          )}
        </p>
        <span className="pa-fim">
          <Seletor
            campo
            rotulo="Mês"
            valor={mes}
            opcoes={meses.map(m => ({ valor: m, rotulo: nomeDoMes(m) }))}
            aoEscolher={v => setMes(v || meses[0])}
            vazio={nomeDoMes(meses[0])}
          />
        </span>
      </div>

      {erro ? (
        <section className="cartao pa-quadro">
          <Vazio titulo="Não consegui ler os parceiros" texto={erro} />
        </section>
      ) : carregando ? (
        <section className="cartao pa-quadro">
          <div className="pa-espera">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        </section>
      ) : (
        <div className={larga && (escolhido || novo) ? 'pa-duas com-ficha' : 'pa-duas'}>
          <section className="cartao pa-quadro">
            {parceiros.length === 0 ? (
              <Vazio
                titulo="Nenhum parceiro ainda"
                texto="Parceiro é quem vende peças na loja e recebe parte de cada venda. Cada um tem a sua coleção, o seu acordo e a sua página."
                acao={
                  podeEditar ? (
                    <Botao onClick={() => setAberto(NOVO)}>Novo parceiro</Botao>
                  ) : undefined
                }
              />
            ) : estreita ? (
              <div className="pa-lista">
                {ordenados.map(p => {
                  const s = somas.get(p.id)
                  return (
                    <Fragment key={p.id}>
                      <button
                        type="button"
                        className="pa-item"
                        aria-expanded={sanfona === p.id}
                        onClick={() => escolher(p.id)}
                      >
                        <span className="pa-nome">
                          <b>{p.nome}</b>
                          <small>
                            {fraseDoAcordo(p.acordo)} · {situacaoDaPagina(p, hoje)}
                          </small>
                        </span>
                        <span className="pa-item-fim">
                          <b>
                            {s && s.semAcordo === s.pecas && s.pecas > 0
                              ? 'sem acordo'
                              : dinheiro(s?.parte ?? 0)}
                          </b>
                          <small>{plural(s?.pecas ?? 0, 'peça', 'peças')}</small>
                        </span>
                      </button>
                      {sanfona === p.id ? (
                        <div className="pa-sanfona">{comprasDe(p.id)}</div>
                      ) : null}
                    </Fragment>
                  )
                })}
              </div>
            ) : (
              <div className="tabela-rola">
                <table className="tabela pa-tabela">
                  <thead>
                    <tr>
                      <th>Parceiro</th>
                      <th>Acordo</th>
                      <th className="dir">Peças no mês</th>
                      <th className="dir pa-some-medio">Vendido no mês</th>
                      <th className="dir">Parte do parceiro</th>
                      {larga ? null : <th className="pa-seta" aria-label="Abrir" />}
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.map(p => {
                      const s = somas.get(p.id)
                      return (
                        <Fragment key={p.id}>
                          <tr
                            className={p.id === idAberto ? 'pa-linha marcada' : 'pa-linha'}
                            aria-expanded={sanfona === p.id}
                            onClick={() => escolher(p.id)}
                          >
                            <td>
                              <span className="pa-nome">
                                <b>{p.nome}</b>
                                <small>{situacaoDaPagina(p, hoje)}</small>
                              </span>
                            </td>
                            <td className={p.acordo ? undefined : 'pa-falta'}>
                              {fraseDoAcordo(p.acordo)}
                            </td>
                            <td className="dir">{s?.pecas ?? 0}</td>
                            <td className="dir pa-some-medio">{dinheiro(s?.valor ?? 0)}</td>
                            <td className="dir pa-forte">
                              {s && s.semAcordo > 0 ? (
                                <span className="pa-nome pa-direita">
                                  <b>
                                    {s.semAcordo === s.pecas ? 'sem acordo' : dinheiro(s.parte)}
                                  </b>
                                  {s.semAcordo === s.pecas ? null : (
                                    <small>
                                      {plural(s.semAcordo, 'peça sem acordo', 'peças sem acordo')}
                                    </small>
                                  )}
                                </span>
                              ) : (
                                dinheiro(s?.parte ?? 0)
                              )}
                            </td>
                            {larga ? null : (
                              <td className="pa-seta">
                                <CaretRight size={16} />
                              </td>
                            )}
                          </tr>
                          {sanfona === p.id ? (
                            <tr className="pa-sanfona">
                              <td colSpan={larga ? 5 : 6}>{comprasDe(p.id)}</td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {larga ? ficha : null}
        </div>
      )}

      {larga ? null : ficha}
    </Pagina>
  )
}
