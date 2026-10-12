import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Buildings, DownloadSimple, MapPin, Plus, Truck, User } from '@phosphor-icons/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Aviso, Botao, Busca, Esqueleto, Gaveta, Pagina, Paginador, Segmentado, Selo, Seletor, Vazio, avisar } from '@ds'
import { formatarCep, semAcento } from '@shared'
import { FichaDoCliente } from './ficha'
import { FichaAoLado, RetratoDaBase, TOM_DA_SITUACAO } from './lado'
import {
  NOME_DA_SITUACAO,
  NOME_DO_SEGMENTO,
  cadastroIncompleto,
  clienteEmBranco,
  formatarData,
  formatarDinheiro,
  formatarDocumento,
  idsDuplicados,
  carregarClientes,
  numeroDeWhatsApp,
  situacaoDoCliente,
  temContato,
  temPedidoNoSistema,
  type Cliente,
  type Segmento,
  type Situacao,
} from '@dominio/cliente'
import { clienteDaCotacao, cotacaoNovaDaCasa, proximoNumero, salvarCotacao } from '@dominio/cotacao'
import { useSessao } from '@dominio/sessao'
import {
  NOME_DA_ORIGEM,
  cepsPorCidade,
  transportadorasPara,
  type Sugestao,
} from '@dominio/entrega'
import './clientes.css'

/* ==========================================================================
   Clientes (prancha 147, ideia A, escolhida pelo Henrique em 12/10/2026:
   "sobre cliente, ideia a, 147").

   A LISTA COM A FICHA AO LADO. No topo, a busca, as situacoes num segmentado
   (Todos, Ativos, Novos, Parados, Sem pedido) e os seletores Segmento,
   Cidade, Vendedor e Filtro. A placa amarela conta os cadastros incompletos
   e os possiveis duplicados. A tabela diz cidade, situacao, ultimo pedido,
   quanto comprou e o vendedor. Clicar numa linha abre a ficha a direita, sem
   modal; sem ninguem escolhido a coluna mostra o retrato da base. Abaixo de
   1280 px a coluna nao cabe: a ficha abre como antes, por cima.

   A BASE INTEIRA DE UMA VEZ, e nao paginada no banco: os numeros sao contas
   sobre a base completa ("37 incompletos" nao pode virar "incompletos nesta
   pagina"). A paginacao e so da tela.

   Clicar na cidade abre as transportadoras que cobrem aquele CEP: a pergunta
   "quem entrega ai?" aparece no atendimento, antes de existir pedido.
   ========================================================================== */

type Ordem = 'nome' | 'cidade' | 'ultimo' | 'total'
type QualSituacao = '' | Situacao
type Qualidade =
  | ''
  | 'pf'
  | 'pj'
  | 'contato'
  | 'sem-contato'
  | 'whatsapp'
  | 'documento'
  | 'endereco'
  | 'incompleto'
  | 'duplicado'
  | 'pedidos'
  | 'fornecedor'
  | 'funcionario'

const ROTULO_DA_QUALIDADE: Record<Exclude<Qualidade, ''>, string> = {
  pf: 'Pessoa física',
  pj: 'Pessoa jurídica',
  contato: 'Com contato',
  'sem-contato': 'Sem contato',
  whatsapp: 'Com WhatsApp',
  documento: 'Com CPF/CNPJ',
  endereco: 'Com endereço',
  incompleto: 'Cadastro incompleto',
  duplicado: 'Possíveis duplicados',
  pedidos: 'Com pedido no sistema',
  fornecedor: 'Também fornecedor',
  funcionario: 'Também funcionário',
}

const SEM = '__vazio__'
const so = (s: string) => (s || '').replace(/\D/g, '')
const DIA = 86400000

/* a ficha ao lado so cabe a partir de 1280 px */
function useLargo(): boolean {
  const consulta = '(min-width: 1280px)'
  const [largo, setLargo] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches)
  useEffect(() => {
    const m = window.matchMedia(consulta)
    const mudou = () => setLargo(m.matches)
    m.addEventListener('change', mudou)
    return () => m.removeEventListener('change', mudou)
  }, [])
  return largo
}

/** ha quanto tempo, em palavras curtas: "há 12 dias", "há 3 meses" */
function haQuanto(iso: string, hoje: number): string {
  if (!iso) return ''
  const d = Math.max(0, Math.round((hoje - new Date(iso).getTime()) / DIA))
  if (d < 1) return 'hoje'
  if (d < 45) return 'há ' + d + (d === 1 ? ' dia' : ' dias')
  const m = Math.round(d / 30)
  if (m < 18) return 'há ' + m + (m === 1 ? ' mês' : ' meses')
  const a = Math.round(d / 365)
  return 'há ' + a + (a === 1 ? ' ano' : ' anos')
}

export function TelaClientes() {
  const navegar = useNavigate()
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null
  const largo = useLargo()

  const [todos, setTodos] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')
  const hoje = useMemo(() => Date.now(), [])

  const recarregar = useCallback(() => {
    setFalha('')
    return carregarClientes()
      .then(setTodos)
      .catch((e) => setFalha(e instanceof Error ? e.message : 'Não consegui carregar os clientes.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    let vivo = true
    carregarClientes()
      .then((l) => vivo && setTodos(l))
      .catch((e) => vivo && setFalha(e instanceof Error ? e.message : 'Não consegui carregar os clientes.'))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [])
  const duplicados = useMemo(() => idsDuplicados(todos), [todos])
  const cepsDaCidade = useMemo(() => cepsPorCidade(todos), [todos])

  /* a ficha: ao lado (escolhido) no computador, por cima (naFicha) no resto,
     e por cima tambem para editar e para o cliente novo */
  const [escolhidoId, setEscolhidoId] = useState('')
  const [naFicha, setNaFicha] = useState<Cliente | null>(null)
  const [editarNaFicha, setEditarNaFicha] = useState(false)
  const [naEntrega, setNaEntrega] = useState<Cliente | null>(null)
  const escolhido = todos.find((c) => c.id === escolhidoId) ?? null

  function abrir(c: Cliente) {
    if (largo) setEscolhidoId(c.id)
    else {
      setEditarNaFicha(false)
      setNaFicha(c)
    }
  }

  /* ---------- ABRIR NUM CLIENTE, vindo de outra tela (?abrir=<id>) --------
     O funil e a busca mandam para ca. UMA VEZ SO, e o parametro sai da barra
     logo depois: sem isso, fechar a ficha reabriria a mesma ficha. */
  const [parametros, setParametros] = useSearchParams()
  const jaAbriu = useRef(false)
  const pedido = parametros.get('abrir') ?? ''

  useEffect(() => {
    if (!pedido || jaAbriu.current || !todos.length) return
    const achado = todos.find((c) => c.id === pedido)
    jaAbriu.current = true
    setParametros({}, { replace: true })
    if (achado) abrir(achado)
    else avisar('Não achei esse cliente na lista.', 'warn')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, todos, setParametros])

  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<QualSituacao>('')
  const [segmento, setSegmento] = useState('')
  const [cidade, setCidade] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [qualidade, setQualidade] = useState<Qualidade>('')
  const [ordem, setOrdem] = useState<Ordem>('ultimo')
  const [crescente, setCrescente] = useState(false)
  const [pagina, setPagina] = useState(1)
  const porPagina = 25

  const situacoes = useMemo(() => {
    const m = new Map<string, Situacao>()
    todos.forEach((c) => m.set(c.id, situacaoDoCliente(c, hoje)))
    return m
  }, [todos, hoje])

  const conta = useMemo(() => {
    const n = (s: Situacao) => todos.filter((c) => situacoes.get(c.id) === s).length
    return {
      total: todos.length,
      ativo: n('ativo'),
      novo: n('novo'),
      parado: n('parado'),
      semPedido: n('sem-pedido'),
      comprou12: todos.filter((c) => c.ultimoPedido && hoje - new Date(c.ultimoPedido).getTime() <= 365 * DIA).length,
      totalVendido: todos.reduce((s, c) => s + (c.total || 0), 0),
      incompletos: todos.filter(cadastroIncompleto).length,
      duplicados: duplicados.size,
    }
  }, [todos, situacoes, hoje, duplicados])

  const cidades = useMemo(() => {
    const mapa = new Map<string, { nome: string; quantos: number }>()
    todos.forEach((c) => {
      if (!c.cidade) return
      const k = semAcento(c.cidade)
      const ja = mapa.get(k)
      mapa.set(k, { nome: c.cidade + (c.uf ? ', ' + c.uf : ''), quantos: (ja?.quantos ?? 0) + 1 })
    })
    return [...mapa.entries()].sort((a, b) => b[1].quantos - a[1].quantos || a[1].nome.localeCompare(b[1].nome, 'pt'))
  }, [todos])

  const vendedores = useMemo(() => {
    const mapa = new Map<string, number>()
    todos.forEach((c) => c.vendedor && mapa.set(c.vendedor, (mapa.get(c.vendedor) ?? 0) + 1))
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }, [todos])

  const segmentos = useMemo(() => {
    const mapa = new Map<Segmento, number>()
    todos.forEach((c) => mapa.set(c.segmento, (mapa.get(c.segmento) ?? 0) + 1))
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }, [todos])

  function naQualidade(c: Cliente) {
    switch (qualidade) {
      case '':
        return true
      case 'pf':
        return c.tipo === 'F'
      case 'pj':
        return c.tipo === 'J'
      case 'contato':
        return temContato(c)
      case 'sem-contato':
        return !temContato(c)
      case 'whatsapp':
        return !!numeroDeWhatsApp(c)
      case 'documento':
        return !!c.documento
      case 'endereco':
        return !!(c.endereco || c.cidade)
      case 'incompleto':
        return cadastroIncompleto(c)
      case 'duplicado':
        return duplicados.has(c.id)
      case 'pedidos':
        return temPedidoNoSistema(c)
      case 'fornecedor':
        return c.tipoDeContato.includes('Fornecedor')
      case 'funcionario':
        return c.tipoDeContato.includes('Funcionario')
    }
  }

  const achados = useMemo(() => {
    const b = semAcento(busca.trim())
    const digitado = so(busca)
    const lista = todos.filter((c) => {
      if (situacao && situacoes.get(c.id) !== situacao) return false
      if (segmento && c.segmento !== segmento) return false
      if (cidade && (cidade === SEM ? !!c.cidade : semAcento(c.cidade) !== cidade)) return false
      if (vendedor && (vendedor === SEM ? !!c.vendedor : c.vendedor !== vendedor)) return false
      if (!naQualidade(c)) return false
      if (!b) return true
      const palha =
        semAcento([c.nome, c.fantasia, c.email, c.cidade, c.uf, c.bairro, c.contato].filter(Boolean).join(' ')) +
        ' ' +
        [c.documento, c.telefone, c.celular].join(' ')
      return palha.includes(b) || (digitado.length >= 4 && palha.includes(digitado))
    })
    const sinal = crescente ? 1 : -1
    return [...lista].sort((a, b2) => {
      let r = 0
      if (ordem === 'ultimo') r = (a.ultimoPedido || '').localeCompare(b2.ultimoPedido || '')
      else if (ordem === 'total') r = (a.total || 0) - (b2.total || 0)
      else if (ordem === 'cidade') r = (a.cidade || 'zzz').localeCompare(b2.cidade || 'zzz', 'pt')
      else r = semAcento(a.nome).localeCompare(semAcento(b2.nome), 'pt')
      if (r === 0) r = semAcento(a.nome).localeCompare(semAcento(b2.nome), 'pt')
      return r * sinal
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, busca, situacao, segmento, cidade, vendedor, qualidade, ordem, crescente, duplicados, situacoes])

  const paginas = Math.max(1, Math.ceil(achados.length / porPagina))
  const paginaSegura = Math.min(pagina, paginas)
  const naTela = achados.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina)

  function mudou(fn: () => void) {
    fn()
    setPagina(1)
  }

  function limparTudo() {
    mudou(() => {
      setBusca('')
      setSituacao('')
      setSegmento('')
      setCidade('')
      setVendedor('')
      setQualidade('')
    })
  }

  function ordenarPor(k: Ordem) {
    if (ordem === k) setCrescente((c) => !c)
    else {
      setOrdem(k)
      setCrescente(k === 'nome' || k === 'cidade')
    }
    setPagina(1)
  }

  /* o que esta filtrando agora, escrito, com um x em cada um */
  const marcas: [string, () => void][] = []
  if (situacao) marcas.push([NOME_DA_SITUACAO[situacao], () => setSituacao('')])
  if (segmento) marcas.push(['Segmento: ' + NOME_DO_SEGMENTO[segmento as Segmento], () => setSegmento('')])
  if (cidade) {
    const achada = cidades.find(([k]) => k === cidade)
    marcas.push([cidade === SEM ? 'Sem cidade' : 'Cidade: ' + (achada ? achada[1].nome : cidade), () => setCidade('')])
  }
  if (vendedor) marcas.push([vendedor === SEM ? 'Sem vendedor' : 'Vendedor: ' + vendedor, () => setVendedor('')])
  if (qualidade) marcas.push([ROTULO_DA_QUALIDADE[qualidade], () => setQualidade('')])
  if (busca.trim()) marcas.push(['"' + busca.trim() + '"', () => setBusca('')])

  /* EXPORTAR: o que esta filtrado, numa planilha (CSV com ponto e virgula,
     que o Excel em portugues abre direto) */
  function exportar() {
    const cab = ['Nome', 'Fantasia', 'Tipo', 'Documento', 'Contato', 'Celular', 'Telefone', 'E-mail', 'Endereço', 'Bairro', 'Cidade', 'UF', 'CEP', 'Segmento', 'Vendedor', 'Situação', 'Pedidos', 'Total comprado', 'Último pedido', 'Cliente desde']
    const cel = (v: string | number) => {
      const t = String(v ?? '')
      return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
    }
    const linhas = achados.map((c) =>
      [c.nome, c.fantasia, c.tipo === 'J' ? 'PJ' : 'PF', c.documento, c.contato, c.celular, c.telefone, c.email, c.endereco, c.bairro, c.cidade, c.uf, c.cep, NOME_DO_SEGMENTO[c.segmento], c.vendedor, NOME_DA_SITUACAO[situacoes.get(c.id) ?? 'sem-pedido'], c.pedidos, String(c.total).replace('.', ','), c.ultimoPedido.slice(0, 10), c.criadoEm.slice(0, 10)]
        .map(cel)
        .join(';'),
    )
    const blob = new Blob(['﻿' + [cab.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'clientes-' + new Date(hoje).toISOString().slice(0, 10) + '.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    avisar(`${achados.length} ${achados.length === 1 ? 'cliente exportado' : 'clientes exportados'}.`, 'ok')
  }

  async function novaCotacao(cad: Cliente) {
    try {
      const c = await cotacaoNovaDaCasa(await proximoNumero(), eu ? { id: eu.id, nome: eu.nome } : null)
      const doCadastro = clienteDaCotacao(cad)
      c.cliente = { ...c.cliente, ...Object.fromEntries(Object.entries(doCadastro).filter(([, v]) => v)) }
      const salva = await salvarCotacao(c)
      avisar('Cotação ' + salva.numero + ' criada para ' + cad.nome, 'ok')
      navegar('/cotacao/' + salva.id)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui criar a cotação', 'warn')
    }
  }

  const seta = (k: Ordem) => (ordem === k ? (crescente ? ' ▲' : ' ▼') : '')
  const mostraLado = largo

  return (
    <Pagina
      acima="Comercial"
      titulo="Clientes"
      sub={
        <>
          <b>{conta.total.toLocaleString('pt-BR')}</b> clientes · <b>{conta.comprou12.toLocaleString('pt-BR')}</b> compraram
          nos últimos 12 meses · <b>{formatarDinheiro(conta.totalVendido)}</b> comprados ao todo
        </>
      }
      acoes={
        <>
          <Botao tom="contorno" onClick={exportar} disabled={!achados.length}>
            <DownloadSimple size={17} />
            Exportar
          </Botao>
          <Botao
            tom="primario"
            onClick={() => {
              setEditarNaFicha(true)
              setNaFicha(clienteEmBranco())
            }}
          >
            <Plus size={17} weight="bold" />
            Novo cliente
          </Botao>
        </>
      }
    >
      <div className="cl-ferr">
        <Busca
          className="cl-busca"
          placeholder="Buscar nome, CNPJ, telefone ou cidade"
          aria-label="Buscar cliente"
          value={busca}
          onChange={(e) => mudou(() => setBusca(e.target.value))}
        />
        <div className="cl-seg-rolo">
        <Segmentado<QualSituacao>
          valor={situacao}
          aoMudar={(v) => mudou(() => setSituacao(v))}
          opcoes={[
            { valor: '', rotulo: <span className="cl-aba">Todos <span className="cl-conta">{conta.total}</span></span> },
            { valor: 'ativo', rotulo: <span className="cl-aba">Ativos <span className="cl-conta">{conta.ativo}</span></span> },
            { valor: 'novo', rotulo: <span className="cl-aba">Novos <span className="cl-conta">{conta.novo}</span></span> },
            { valor: 'parado', rotulo: <span className="cl-aba">Parados <span className="cl-conta">{conta.parado}</span></span> },
            { valor: 'sem-pedido', rotulo: <span className="cl-aba">Sem pedido <span className="cl-conta">{conta.semPedido}</span></span> },
          ]}
        />
        </div>
        <Seletor
          rotulo="Segmento"
          valor={segmento}
          vazio="Todos"
          opcoes={segmentos.map(([s, q]) => ({ valor: s, rotulo: NOME_DO_SEGMENTO[s], contagem: q }))}
          aoEscolher={(v) => mudou(() => setSegmento(v))}
        />
        <Seletor
          rotulo="Cidade"
          valor={cidade}
          vazio="Todas"
          comBusca
          opcoes={[
            ...cidades.map(([k, o]) => ({ valor: k, rotulo: o.nome, contagem: o.quantos })),
            { valor: SEM, rotulo: 'Sem cidade', contagem: todos.filter((c) => !c.cidade).length },
          ]}
          aoEscolher={(v) => mudou(() => setCidade(v))}
        />
        <Seletor
          rotulo="Vendedor"
          valor={vendedor}
          vazio="Todos"
          opcoes={[
            ...vendedores.map(([n, q]) => ({ valor: n, rotulo: n, contagem: q })),
            { valor: SEM, rotulo: 'Sem vendedor', contagem: todos.filter((c) => !c.vendedor).length },
          ]}
          aoEscolher={(v) => mudou(() => setVendedor(v))}
        />
        <Seletor
          rotulo="Filtro"
          valor={qualidade}
          vazio="Nenhum"
          opcoes={(Object.keys(ROTULO_DA_QUALIDADE) as Exclude<Qualidade, ''>[]).map((q) => ({ valor: q, rotulo: ROTULO_DA_QUALIDADE[q] }))}
          aoEscolher={(v) => mudou(() => setQualidade(v as Qualidade))}
        />
      </div>

      {conta.incompletos || conta.duplicados ? (
        <Aviso
          tom="warn"
          acao={
            <Botao tom="contorno" tamanho="sm" onClick={() => mudou(() => setQualidade(conta.incompletos ? 'incompleto' : 'duplicado'))}>
              Ver e arrumar
            </Botao>
          }
        >
          {conta.incompletos ? (
            <>
              <b>{conta.incompletos}</b> {conta.incompletos === 1 ? 'cadastro incompleto' : 'cadastros incompletos'}: sem documento e sem
              contato, não dá para cobrar nem avisar.{' '}
            </>
          ) : null}
          {conta.duplicados ? (
            <>
              <b>{conta.duplicados}</b> {conta.duplicados === 1 ? 'possível duplicado' : 'possíveis duplicados'}, mesmo documento ou mesmo
              nome.
            </>
          ) : null}
        </Aviso>
      ) : null}

      {marcas.length ? (
        <div className="cl-marcas">
          <span>
            <b>{achados.length.toLocaleString('pt-BR')}</b> {achados.length === 1 ? 'cliente' : 'clientes'} de{' '}
            {conta.total.toLocaleString('pt-BR')}
          </span>
          {marcas.map(([texto, tirar]) => (
            <span className="cl-marca" key={texto}>
              {texto}
              <button type="button" aria-label={'Tirar o filtro ' + texto} onClick={() => mudou(tirar)}>
                &times;
              </button>
            </span>
          ))}
          <button type="button" className="cl-limpa-tudo" onClick={limparTudo}>
            limpar tudo
          </button>
        </div>
      ) : null}

      <div className={mostraLado ? 'cl-mesa' : 'cl-mesa so-lista'}>
        <div className="cartao cl-caixa">
          {achados.length ? (
            <>
              <div className="cl-rolo">
                <table className="cl-tab">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" onClick={() => ordenarPor('nome')}>
                          Cliente{seta('nome')}
                        </button>
                      </th>
                      <th className="cl-some">
                        <button type="button" onClick={() => ordenarPor('cidade')}>
                          Cidade{seta('cidade')}
                        </button>
                      </th>
                      <th>Situação</th>
                      <th className="cl-some">
                        <button type="button" onClick={() => ordenarPor('ultimo')}>
                          Último pedido{seta('ultimo')}
                        </button>
                      </th>
                      <th className="cl-num-col cl-some">
                        <button type="button" onClick={() => ordenarPor('total')}>
                          Comprou{seta('total')}
                        </button>
                      </th>
                      <th className="cl-some-mais">Vendedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {naTela.map((c) => (
                      <Linha
                        key={c.id}
                        c={c}
                        situacao={situacoes.get(c.id) ?? 'sem-pedido'}
                        hoje={hoje}
                        ligada={mostraLado && c.id === escolhidoId}
                        duplicado={duplicados.has(c.id)}
                        transportadoras={c.cidade ? transportadorasPara(c, cepsDaCidade).length : 0}
                        aoAbrir={() => abrir(c)}
                        aoVerEntrega={() => setNaEntrega(c)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cl-pe">
                <Paginador pagina={paginaSegura} paginas={paginas} total={achados.length} porPagina={porPagina} aoIr={setPagina} />
              </div>
            </>
          ) : carregando ? (
            <div className="cl-carregando">
              <Esqueleto altura={48} />
              <Esqueleto altura={48} />
              <Esqueleto altura={48} />
              <Esqueleto altura={48} />
              <Esqueleto altura={48} />
            </div>
          ) : falha ? (
            <Vazio
              titulo="Não consegui carregar os clientes"
              texto={falha}
              acao={
                <Botao
                  tom="forte"
                  onClick={() => {
                    setCarregando(true)
                    void recarregar()
                  }}
                >
                  Tentar de novo
                </Botao>
              }
            />
          ) : (
            <Vazio
              titulo={todos.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
              texto={
                todos.length
                  ? 'Ajuste a busca ou limpe os filtros para ver a base completa.'
                  : 'A base do Bling ainda não foi importada. Você pode semear conteúdo de teste em Configurações para conferir a tela.'
              }
              acao={
                todos.length ? (
                  <Botao tom="forte" onClick={limparTudo}>
                    Limpar filtros
                  </Botao>
                ) : undefined
              }
            />
          )}
        </div>

        {mostraLado ? (
          escolhido ? (
            <FichaAoLado
              key={escolhido.id}
              cliente={escolhido}
              base={todos}
              hoje={hoje}
              aoEditar={() => {
                setEditarNaFicha(true)
                setNaFicha(escolhido)
              }}
              aoNovaCotacao={() => void novaCotacao(escolhido)}
              aoVerEntrega={() => setNaEntrega(escolhido)}
            />
          ) : (
            <RetratoDaBase
              base={todos}
              incompletos={conta.incompletos}
              duplicados={conta.duplicados}
              aoSegmento={(s) => mudou(() => setSegmento(s))}
              aoCidade={(c) => setNaEntrega(c)}
              aoArrumar={() => mudou(() => setQualidade(conta.incompletos ? 'incompleto' : 'duplicado'))}
            />
          )
        ) : null}
      </div>

      <FichaDoCliente
        cliente={naFicha}
        base={todos}
        comecarEditando={editarNaFicha}
        aoFechar={() => setNaFicha(null)}
        aoSalvar={(c) => {
          /* A lista volta do banco, e não do que a ficha devolveu: gravar um
             cliente pode mexer em mais coisa do que o campo que a pessoa
             editou, e a tela que adivinha o resultado é a tela que mente. */
          void recarregar()
          if (largo) {
            setNaFicha(null)
            setEscolhidoId(c.id)
          } else setNaFicha(c)
        }}
      />

      <Entrega
        cliente={naEntrega}
        sugestoes={naEntrega ? transportadorasPara(naEntrega, cepsDaCidade) : []}
        aoFechar={() => setNaEntrega(null)}
      />
    </Pagina>
  )
}

/* --- uma linha da tabela -------------------------------------------------- */
function Linha({
  c,
  situacao,
  hoje,
  ligada,
  duplicado,
  transportadoras,
  aoAbrir,
  aoVerEntrega,
}: {
  c: Cliente
  situacao: Situacao
  hoje: number
  ligada: boolean
  duplicado: boolean
  transportadoras: number
  aoAbrir: () => void
  aoVerEntrega: () => void
}) {
  return (
    <tr
      className={ligada ? 'ligado' : ''}
      onClick={aoAbrir}
      tabIndex={0}
      aria-selected={ligada}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          aoAbrir()
        }
      }}
    >
      <td>
        <span className="cl-quem">
          <span className="cl-av" aria-hidden="true">
            {c.tipo === 'J' ? <Buildings size={16} /> : <User size={16} />}
          </span>
          <span className="cl-nome">
            <span className="cl-titulo">
              {c.nome}
              {duplicado ? (
                <b className="cl-marca-dup" title="Mesmo documento ou nome de outro cadastro">
                  DUP
                </b>
              ) : null}
              {cadastroIncompleto(c) ? (
                <b className="cl-marca-inc" title="Sem documento e sem contato">
                  INC
                </b>
              ) : null}
            </span>
            <span className="cl-fantasia">
              {[NOME_DO_SEGMENTO[c.segmento], c.documento ? formatarDocumento(c.documento) : 'sem documento'].join(' · ')}
            </span>
          </span>
        </span>
      </td>
      <td className="cl-some">
        {c.cidade ? (
          <button
            type="button"
            className="cl-cidade"
            title="Quem entrega aí"
            onClick={(e) => {
              e.stopPropagation()
              aoVerEntrega()
            }}
          >
            <MapPin size={14} />
            {c.cidade}
            {c.uf ? <span className="cl-uf">· {c.uf}</span> : null}
            <span className="cl-transp">
              <Truck size={13} /> {transportadoras}
            </span>
          </button>
        ) : (
          <span className="cl-falta">sem cidade</span>
        )}
      </td>
      <td>
        <Selo tom={TOM_DA_SITUACAO[situacao]}>{NOME_DA_SITUACAO[situacao]}</Selo>
      </td>
      <td className="cl-some">
        {c.ultimoPedido ? (
          <span className="cl-duas">
            {formatarData(c.ultimoPedido)}
            <small>{haQuanto(c.ultimoPedido, hoje)}</small>
          </span>
        ) : (
          <span className="cl-duas">
            nunca pediu
            <small>{c.criadoEm ? 'cadastrado ' + haQuanto(c.criadoEm, hoje) : ''}</small>
          </span>
        )}
      </td>
      <td className="cl-num-col cl-some">{formatarDinheiro(c.total || 0)}</td>
      <td className="cl-some-mais">
        {c.vendedor ? (
          <span className="cl-vd">
            <i aria-hidden="true">{c.vendedor.trim().slice(0, 2).toUpperCase()}</i>
            {c.vendedor.split(' ')[0]}
          </span>
        ) : (
          <span className="cl-falta">sem vendedor</span>
        )}
      </td>
    </tr>
  )
}

/* --- a gaveta das transportadoras ---------------------------------------- */
function Entrega({
  cliente,
  sugestoes,
  aoFechar,
}: {
  cliente: Cliente | null
  sugestoes: Sugestao[]
  aoFechar: () => void
}) {
  if (!cliente) return null
  return (
    <Gaveta
      aberto={!!cliente}
      aoFechar={aoFechar}
      titulo={'Transportadoras · ' + cliente.cidade + (cliente.uf ? ' · ' + cliente.uf : '')}
    >
      <p className="cl-nota">
        Cobertura calculada pelo CEP {cliente.cep ? formatarCep(cliente.cep) : 'da cidade'}. A tabela
        de faixas fica editável em Configurações.
      </p>
      {sugestoes.length ? (
        sugestoes.map(({ transportadora, origem }) => (
          <div className="cl-transp-linha" key={transportadora.nome}>
            <span className="cl-caminhao" style={{ background: 'var(' + transportadora.cor + ')' }}>
              <Truck size={14} />
            </span>
            <span className="cl-transp-nome">
              <b>
                {transportadora.nome}
                <span className="cl-origem">{NOME_DA_ORIGEM[origem]}</span>
              </b>
              <span>{transportadora.observacao}</span>
            </span>
            <span className="cl-prazo">{transportadora.prazo}</span>
          </div>
        ))
      ) : (
        <Vazio
          titulo="Sem cobertura calculada"
          texto="Cadastre cidade ou CEP para o sistema sugerir a transportadora."
        />
      )}
    </Gaveta>
  )
}

