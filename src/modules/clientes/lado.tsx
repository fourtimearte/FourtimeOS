import { useEffect, useMemo, useState } from 'react'
import {
  Buildings,
  CalendarBlank,
  ChartBar,
  ChatCircleText,
  ClockCounterClockwise,
  Envelope,
  FileText,
  IdentificationCard,
  MapPin,
  Package,
  PencilSimple,
  Truck,
  User,
  Users,
  WarningCircle,
} from '@phosphor-icons/react'
import { Botao, Segmentado, Selo, Vazio } from '@ds'
import {
  NOME_DA_SITUACAO,
  NOME_DO_ESTADO,
  NOME_DO_SEGMENTO,
  abrirClienteNoWhatsApp,
  formatarCep,
  formatarData,
  formatarDinheiro,
  formatarDocumento,
  formatarTelefone,
  historicoAntigo,
  numeroDeWhatsApp,
  pedidosDoCliente,
  situacaoDoCliente,
  type AntesDoSistema,
  type Cliente,
  type Pedido,
  type Segmento,
  type Situacao,
  EXTRAS_VAZIOS,
  carregarExtras,
  carregarFreteDoCliente,
  enderecoEmLinha,
  frasesDoFrete,
  type ExtrasDoCliente,
  type FreteDoCliente,
} from '@dominio/cliente'
import { ExtrasNaLeitura } from './extras'
import { carregarCotacoes, type CotacaoNaLista } from '@dominio/cotacao'
import { NOME_DA_ORIGEM, cepsPorCidade, transportadorasPara } from '@dominio/entrega'
import { usarTransportadoras } from './transportadoras'

/* ==========================================================================
   A FICHA AO LADO (prancha 147, ideia A, escolhida em 12/10/2026): clicar
   numa linha abre a ficha a direita, sem modal, e a lista continua a vista.
   Abas Resumo, Cadastro e Pedidos. Editar abre o formulario de sempre.

   SEM NINGUEM ESCOLHIDO, A COLUNA NAO FICA VAZIA: mostra a base por
   segmento, as cidades com mais clientes e o que precisa de arrumacao.
   ========================================================================== */

export const TOM_DA_SITUACAO: Record<Situacao, 'ok' | 'info' | 'warn' | 'neutro'> = {
  ativo: 'ok',
  novo: 'info',
  parado: 'warn',
  'sem-pedido': 'neutro',
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
type Aba = 'resumo' | 'cadastro' | 'pedidos'

export function FichaAoLado({
  cliente: c,
  base,
  hoje,
  aoEditar,
  aoNovaCotacao,
  aoVerEntrega,
}: {
  cliente: Cliente
  base: Cliente[]
  hoje: number
  aoEditar: () => void
  aoNovaCotacao: () => void
  aoVerEntrega: () => void
}) {
  const [aba, setAba] = useState<Aba>('resumo')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [antigo, setAntigo] = useState<AntesDoSistema>({ pedidos: 0, total: 0, ultimo: '' })
  const [cotacoes, setCotacoes] = useState<CotacaoNaLista[]>([])
  const [buscando, setBuscando] = useState(true)
  /* os outros cadastros e o frete de costume (082) */
  const [extras, setExtras] = useState<ExtrasDoCliente>(EXTRAS_VAZIOS)
  const [freteDeCostume, setFreteDeCostume] = useState<FreteDoCliente | null>(null)
  useEffect(() => {
    let vivo = true
    setExtras(EXTRAS_VAZIOS)
    setFreteDeCostume(null)
    void carregarExtras(c.id).then((x) => vivo && setExtras(x))
    void carregarFreteDoCliente(c.id).then((f) => vivo && setFreteDeCostume(f))
    return () => {
      vivo = false
    }
  }, [c.id])

  useEffect(() => {
    let vivo = true
    setBuscando(true)
    setPedidos([])
    setCotacoes([])
    setAntigo({ pedidos: 0, total: 0, ultimo: '' })
    void Promise.allSettled([pedidosDoCliente(c.id), historicoAntigo(c.id), carregarCotacoes({ clienteId: c.id })]).then(
      ([p, a, q]) => {
        if (!vivo) return
        if (p.status === 'fulfilled') setPedidos(p.value)
        if (a.status === 'fulfilled') setAntigo(a.value)
        if (q.status === 'fulfilled') setCotacoes(q.value)
        setBuscando(false)
      },
    )
    return () => {
      vivo = false
    }
  }, [c.id])

  const transportadoras = usarTransportadoras()
  const frete = useMemo(
    () => (transportadoras ? (transportadorasPara(c, cepsPorCidade(base), transportadoras)[0] ?? null) : null),
    [c, base, transportadoras],
  )
  const situacao = situacaoDoCliente(c, hoje)
  const validos = pedidos.filter((p) => p.estado !== 'cancelado')
  const ticket = c.pedidos ? c.total / c.pedidos : 0
  const abertas = cotacoes.filter((q) => q.estado === 'rascunho' || q.estado === 'enviada')

  /* QUANDO ELE COMPRA: os meses dos pedidos do sistema (o Bling so trouxe o
     total, sem a data de cada pedido, e por isso o bloco so aparece quando
     ha pedido com data) */
  const porMes = useMemo(() => {
    const n = Array(12).fill(0) as number[]
    validos.forEach((p) => {
      const m = Number(p.data.slice(5, 7)) - 1
      if (m >= 0 && m < 12) n[m]++
    })
    return n
  }, [validos])
  const maxMes = Math.max(...porMes)
  const mesesFortes = porMes
    .map((n, i) => [n, i] as const)
    .filter(([n]) => n && n === maxMes)
    .map(([, i]) => MESES[i])
  const mesDeHoje = new Date(hoje).getMonth()

  const zap = numeroDeWhatsApp(c)
  const mensagem = 'Olá, ' + (c.contato || 'tudo bem') + '! Aqui é da Fourtime.'

  return (
    <section className="cartao cl-lado" aria-label={'Ficha de ' + c.nome}>
      <div className="cl-lado-cab">
        <div className="cl-lado-l1">
          <span className="cl-av cl-av-g" aria-hidden="true">
            {c.tipo === 'J' ? <Buildings size={22} /> : <User size={22} />}
          </span>
          <div className="pilha cl-lado-nome">
            <h2>{c.nome}</h2>
            <p>
              {[NOME_DO_SEGMENTO[c.segmento], c.documento ? formatarDocumento(c.documento) : 'sem documento', c.criadoEm ? 'cliente desde ' + formatarData(c.criadoEm) : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="fileira miuda">
              <Selo tom={TOM_DA_SITUACAO[situacao]}>{NOME_DA_SITUACAO[situacao]}</Selo>
              <Selo forma="contorno">{c.tipo === 'J' ? 'Pessoa jurídica' : 'Pessoa física'}</Selo>
              {c.vendedor ? <Selo forma="contorno">Carteira de {c.vendedor.split(' ')[0]}</Selo> : null}
            </div>
          </div>
        </div>
        <div className="fileira">
          {zap ? (
            <Botao tom="wa" onClick={() => abrirClienteNoWhatsApp(c, mensagem)}>
              WhatsApp
            </Botao>
          ) : null}
          <Botao tom="contorno" onClick={aoEditar}>
            <PencilSimple size={16} />
            Editar
          </Botao>
          <Botao tom="primario" className="cl-lado-fim" onClick={aoNovaCotacao}>
            <FileText size={16} />
            Nova cotação
          </Botao>
        </div>
        <Segmentado<Aba>
          className="cl-lado-abas"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: 'resumo', rotulo: 'Resumo' },
            { valor: 'cadastro', rotulo: 'Cadastro' },
            {
              valor: 'pedidos',
              rotulo: (
                <span className="cl-aba">
                  Pedidos <span className="cl-conta">{validos.length + antigo.pedidos}</span>
                </span>
              ),
            },
          ]}
        />
      </div>

      {aba === 'resumo' ? (
        <>
          <div className="cl-lado-bloco">
            <div className="cl-nums">
              <div className="cl-num">
                <small>Pedidos</small>
                <b>{c.pedidos}</b>
                <i>{antigo.pedidos ? antigo.pedidos + ' do Bling' : 'no sistema'}</i>
              </div>
              <div className="cl-num">
                <small>Total comprado</small>
                <b>{formatarDinheiro(c.total)}</b>
                <i>{c.ultimoPedido ? 'último em ' + formatarData(c.ultimoPedido) : 'nunca pediu'}</i>
              </div>
              <div className="cl-num">
                <small>Ticket médio</small>
                <b>{ticket ? formatarDinheiro(ticket) : '-'}</b>
                <i>por pedido</i>
              </div>
            </div>
          </div>

          {validos.length ? (
            <div className="cl-lado-bloco">
              <p className="cl-rot">
                <CalendarBlank size={16} /> Quando ele compra
                <span className="cl-rot-dir">{mesesFortes.join(' e ')}</span>
              </p>
              <div className="cl-meses" role="img" aria-label={'Meses com pedido: ' + mesesFortes.join(', ')}>
                {porMes.map((n, i) => (
                  <span key={MESES[i]} className={i === mesDeHoje ? 'hoje' : ''}>
                    <i className={n === 0 ? '' : n === maxMes ? 'forte' : 'medio'} />
                    {MESES[i]}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="cl-lado-bloco">
            <p className="cl-rot">
              <Users size={16} /> Quem fala com a gente
            </p>
            {c.contato || c.celular || c.telefone || c.email ? (
              <div className="cl-pessoa">
                <span className="cl-av" aria-hidden="true">
                  {(c.contato || c.nome).trim().slice(0, 2).toUpperCase()}
                </span>
                <div className="pilha cl-pessoa-t">
                  <b>{c.contato || 'Sem nome de contato'}</b>
                  <small>{[formatarTelefone(c.celular || c.telefone), c.email].filter(Boolean).join(' · ')}</small>
                </div>
                <div className="fileira colada">
                  {zap ? (
                    <Botao tom="contorno" tamanho="sm" icone aria-label="Abrir no WhatsApp" onClick={() => abrirClienteNoWhatsApp(c, mensagem)}>
                      <ChatCircleText size={16} />
                    </Botao>
                  ) : null}
                  {c.email ? (
                    <a className="btn btn-contorno sm icone" href={'mailto:' + c.email} aria-label="Mandar e-mail">
                      <Envelope size={16} />
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="cl-falta">Sem contato: não dá para avisar nem cobrar. Complete em Editar.</p>
            )}
            {extras.contatos.map((k, i) => {
              const comEle = { ...c, contato: k.nome, celular: k.celular, telefone: k.telefone }
              const zapDele = numeroDeWhatsApp(comEle)
              return (
                <div key={k.id ?? i} className="cl-pessoa">
                  <span className="cl-av" aria-hidden="true">
                    {(k.nome || '?').trim().slice(0, 2).toUpperCase()}
                  </span>
                  <div className="pilha cl-pessoa-t">
                    <b>{[k.nome || 'Sem nome', k.cargo].filter(Boolean).join(' · ')}</b>
                    <small>{[formatarTelefone(k.celular || k.telefone), k.email].filter(Boolean).join(' · ')}</small>
                  </div>
                  <div className="fileira colada">
                    {zapDele ? (
                      <Botao
                        tom="contorno"
                        tamanho="sm"
                        icone
                        aria-label={'Abrir ' + (k.nome || 'o contato') + ' no WhatsApp'}
                        onClick={() => abrirClienteNoWhatsApp(comEle, 'Olá, ' + (k.nome || 'tudo bem') + '! Aqui é da Fourtime.')}
                      >
                        <ChatCircleText size={16} />
                      </Botao>
                    ) : null}
                    {k.email ? (
                      <a className="btn btn-contorno sm icone" href={'mailto:' + k.email} aria-label={'Mandar e-mail para ' + (k.nome || 'o contato')}>
                        <Envelope size={16} />
                      </a>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="cl-lado-bloco">
            <p className="cl-rot">
              <Package size={16} /> Últimos pedidos e cotações
              {validos.length > 3 ? (
                <button type="button" className="cl-rot-link" onClick={() => setAba('pedidos')}>
                  Ver os {validos.length}
                </button>
              ) : null}
            </p>
            {abertas.slice(0, 2).map((q) => (
              <div key={q.id} className="cl-ped">
                <b>{q.numero}</b>
                <span>{q.pecas} peças</span>
                <Selo tom="info">{q.estado === 'enviada' ? 'Enviada' : 'Rascunho'}</Selo>
                <i>{formatarDinheiro(q.total)}</i>
              </div>
            ))}
            {validos.slice(0, 3).map((p) => (
              <div key={p.numero} className="cl-ped">
                <b>{p.numero}</b>
                <span>{[p.resumo, p.pecas + ' peças'].filter(Boolean).join(' · ')}</span>
                <Selo tom={p.estado === 'entregue' ? 'ok' : 'neutro'}>{NOME_DO_ESTADO[p.estado]}</Selo>
                <i>{formatarDinheiro(p.valor)}</i>
              </div>
            ))}
            {!buscando && !validos.length && !abertas.length ? (
              <p className="cl-falta">
                {antigo.pedidos
                  ? `${antigo.pedidos} ${antigo.pedidos === 1 ? 'pedido' : 'pedidos'} de antes do sistema (Bling), sem detalhe.`
                  : 'Nenhum pedido nem cotação ainda.'}
              </p>
            ) : null}
            {buscando ? <p className="cl-falta">Buscando...</p> : null}
          </div>

          <div className="cl-lado-bloco">
            <p className="cl-rot">
              <Truck size={16} /> Entrega
            </p>
            <div className="cl-linha">
              <MapPin size={16} />
              <span>
                {[c.endereco, c.bairro, c.cidade ? c.cidade + (c.uf ? ', ' + c.uf : '') : '', c.cep ? formatarCep(c.cep) : '']
                  .filter(Boolean)
                  .join(' · ') || 'Sem endereço'}
              </span>
            </div>
            {extras.enderecos.map((e, i) => (
              <div key={e.id ?? i} className="cl-linha">
                <MapPin size={16} />
                <span>{(e.apelido ? e.apelido + ': ' : '') + enderecoEmLinha(e)}</span>
              </div>
            ))}
            <div className="cl-linha">
              <Truck size={16} />
              <span>{frete ? frete.transportadora.nome + ', ' + frete.transportadora.prazo : 'Sem CEP e sem cidade'}</span>
              {frete ? (
                <button type="button" className="cl-rot-link cl-linha-dir" onClick={aoVerEntrega}>
                  pelo {NOME_DA_ORIGEM[frete.origem]}
                </button>
              ) : null}
            </div>
            {frasesDoFrete(freteDeCostume).map((f) => (
              <div key={f} className="cl-linha">
                <ClockCounterClockwise size={16} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </>
      ) : aba === 'cadastro' ? (
        <div className="cl-lado-bloco">
          <dl className="ficha-dados">
            <Dado rotulo="Nome fantasia" valor={c.fantasia} />
            <Dado rotulo="Tipo" valor={c.tipo === 'J' ? 'Pessoa jurídica' : 'Pessoa física'} />
            <Dado rotulo="Documento" valor={formatarDocumento(c.documento)} />
            <Dado rotulo="Contato" valor={c.contato} />
            <Dado rotulo="Celular" valor={formatarTelefone(c.celular)} />
            <Dado rotulo="Telefone fixo" valor={formatarTelefone(c.telefone)} />
            <Dado rotulo="E-mail" valor={c.email} />
            <Dado rotulo="Endereço" valor={[c.endereco, c.complemento, c.bairro].filter(Boolean).join(' · ')} />
            <Dado rotulo="Cidade" valor={c.cidade ? c.cidade + (c.uf ? ', ' + c.uf : '') : ''} />
            <Dado rotulo="CEP" valor={formatarCep(c.cep)} />
            <Dado rotulo="Segmento" valor={NOME_DO_SEGMENTO[c.segmento]} />
            <Dado rotulo="Vendedor" valor={c.vendedor} />
            <Dado rotulo="Cliente desde" valor={formatarData(c.criadoEm)} />
          </dl>
          <ExtrasNaLeitura x={extras} />
          <Botao tom="contorno" className="cl-alinha" onClick={aoEditar}>
            <IdentificationCard size={16} />
            Editar o cadastro
          </Botao>
        </div>
      ) : (
        <div className="cl-lado-bloco">
          {antigo.pedidos ? (
            <p className="ficha-antes">
              <b>{antigo.pedidos}</b> {antigo.pedidos === 1 ? 'pedido' : 'pedidos'} de antes do Fourtime OS, somando{' '}
              <b>{formatarDinheiro(antigo.total)}</b>
              {antigo.ultimo ? <> até {formatarData(antigo.ultimo)}</> : null}. Vieram do Bling, sem detalhe por pedido.
            </p>
          ) : null}
          {pedidos.map((p) => (
            <div key={p.numero} className="cl-ped">
              <b>{p.numero}</b>
              <span>
                {formatarData(p.data)} · {[p.resumo, p.pecas + ' peças'].filter(Boolean).join(' · ')}
              </span>
              <Selo tom={p.estado === 'entregue' ? 'ok' : p.estado === 'cancelado' ? 'brand' : 'neutro'}>{NOME_DO_ESTADO[p.estado]}</Selo>
              <i>{formatarDinheiro(p.valor)}</i>
            </div>
          ))}
          {!pedidos.length && !buscando ? <p className="cl-falta">Nenhum pedido neste sistema ainda.</p> : null}
        </div>
      )}
    </section>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{valor || <span className="cl-falta">não preenchido</span>}</dd>
    </>
  )
}

/* --- sem ninguem escolhido: o retrato da base ----------------------------- */
export function RetratoDaBase({
  base,
  incompletos,
  duplicados,
  aoSegmento,
  aoCidade,
  aoArrumar,
}: {
  base: Cliente[]
  incompletos: number
  duplicados: number
  aoSegmento: (s: Segmento) => void
  aoCidade: (c: Cliente) => void
  aoArrumar: () => void
}) {
  const segmentos = useMemo(() => {
    const n = new Map<Segmento, number>()
    base.forEach((c) => n.set(c.segmento, (n.get(c.segmento) ?? 0) + 1))
    return [...n.entries()].sort((a, b) => b[1] - a[1])
  }, [base])
  const cidades = useMemo(() => {
    const n = new Map<string, { c: Cliente; q: number }>()
    base.forEach((c) => {
      if (!c.cidade) return
      const k = c.cidade + '|' + c.uf
      const ja = n.get(k)
      n.set(k, { c: ja?.c ?? c, q: (ja?.q ?? 0) + 1 })
    })
    return [...n.values()].sort((a, b) => b.q - a.q).slice(0, 6)
  }, [base])
  const maior = segmentos[0]?.[1] ?? 1

  if (!base.length) return null
  return (
    <section className="cartao cl-lado" aria-label="A base de clientes">
      <div className="cl-lado-bloco">
        <p className="cl-rot">
          <ChartBar size={16} /> Por segmento
        </p>
        <div className="cl-barras">
          {segmentos.map(([s, q]) => (
            <button key={s} type="button" className="cl-barra" onClick={() => aoSegmento(s)}>
              <span>{NOME_DO_SEGMENTO[s]}</span>
              <i>
                <em style={{ width: Math.max(4, Math.round((q / maior) * 100)) + '%' }} />
              </i>
              <b>{q}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="cl-lado-bloco">
        <p className="cl-rot">
          <MapPin size={16} /> Onde estão
        </p>
        {cidades.map(({ c, q }) => (
          <button key={c.cidade + c.uf} type="button" className="cl-cid" onClick={() => aoCidade(c)}>
            <b>{c.cidade}</b>
            <span>{c.uf}</span>
            <span className="cl-linha-dir">
              {q} <Truck size={14} />
            </span>
          </button>
        ))}
      </div>
      {incompletos || duplicados ? (
        <div className="cl-lado-bloco">
          <p className="cl-rot">
            <WarningCircle size={16} /> Para arrumar
          </p>
          <p className="cl-falta">
            {[
              incompletos ? `${incompletos} ${incompletos === 1 ? 'cadastro incompleto' : 'cadastros incompletos'}` : '',
              duplicados ? `${duplicados} ${duplicados === 1 ? 'possível duplicado' : 'possíveis duplicados'}` : '',
            ]
              .filter(Boolean)
              .join(' e ')}
            .
          </p>
          <Botao tom="contorno" className="cl-alinha" onClick={aoArrumar}>
            Ver e arrumar
          </Botao>
        </div>
      ) : null}
      <div className="cl-lado-bloco">
        <Vazio titulo="Clique num cliente" texto="A ficha abre aqui, com os números, quando ele compra, quem fala com a gente e a entrega." />
      </div>
    </section>
  )
}
