import { useCallback, useEffect, useMemo, useState } from 'react'
import { Buildings, MapPin, Trash, Truck, User } from '@phosphor-icons/react'
import { Botao, Busca, Esqueleto, Gaveta, Kpi, Pagina, Seletor, Vazio, avisar } from '@ds'
import { formatarCep, semAcento } from '@shared'
import { FichaDoCliente } from './ficha'
import {
  cadastroIncompleto,
  clienteEmBranco,
  entrouNosUltimos30,
  formatarData,
  formatarDocumento,
  formatarTelefone,
  idsDuplicados,
  carregarClientes,
  numeroDeWhatsApp,
  temContato,
  temPedidoNoSistema,
  type Cliente,
} from '@dominio/cliente'
import {
  NOME_DA_ORIGEM,
  cepsPorCidade,
  transportadorasPara,
  type Sugestao,
} from '@dominio/entrega'
import './clientes.css'

/* ==========================================================================
   Clientes cadastrados.

   Esta e a base do Bling encostada nos pedidos do sistema, e por isso ela nao
   e uma lista bonita: e um retrato do que esta cadastrado. Os seis numeros do
   topo existem para isso. "Cadastro incompleto" e o unico em vermelho porque
   e o unico que custa dinheiro: cliente sem documento e sem contato e cliente
   que nao da para cobrar nem avisar que a arte ficou pronta.

   Clicar na cidade abre as transportadoras que cobrem aquele CEP. Isso mora
   aqui porque a pergunta "quem entrega ai?" aparece no atendimento, antes de
   existir pedido, e nao na hora de despachar.
   ========================================================================== */

type Ordem = 'nome' | 'cidade' | 'desde'
type Qualidade =
  | ''
  | 'contato'
  | 'sem-contato'
  | 'whatsapp'
  | 'documento'
  | 'endereco'
  | 'incompleto'
  | 'duplicado'
  | 'pedidos'
  | 'novos30'
  | 'fornecedor'
  | 'funcionario'

const ROTULO_DA_QUALIDADE: Record<Exclude<Qualidade, ''>, string> = {
  contato: 'Com contato',
  'sem-contato': 'Sem contato',
  whatsapp: 'Com WhatsApp',
  documento: 'Com CPF/CNPJ',
  endereco: 'Com endereço',
  incompleto: 'Cadastro incompleto',
  duplicado: 'Possíveis duplicados',
  pedidos: 'Com pedido no sistema',
  novos30: 'Novos (30 dias)',
  fornecedor: 'Também fornecedor',
  funcionario: 'Também funcionário',
}

const ROTULO_DO_PERIODO: Record<string, string> = {
  mes: 'Este mês',
  '90': 'Últimos 90 dias',
}

const SEM = '__vazio__'
const so = (s: string) => (s || '').replace(/\D/g, '')

export function TelaClientes() {
  /* A base inteira de uma vez, e não paginada no banco.

     São 1.901 contatos, e os seis números do topo são contas sobre a base
     COMPLETA: "cadastro incompleto: 340" não pode virar "incompletos nesta
     página". Paginar no banco obrigaria a fazer essas contas lá também, em SQL
     que duplicaria as regras que já estão escritas em tipos.ts. A paginação
     aqui é da tela, e é só isso que ela precisa ser. */
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
      .catch(
        (e) =>
          vivo && setFalha(e instanceof Error ? e.message : 'Não consegui carregar os clientes.'),
      )
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [])
  const duplicados = useMemo(() => idsDuplicados(todos), [todos])
  const cepsDaCidade = useMemo(() => cepsPorCidade(todos), [todos])

  const [naFicha, setNaFicha] = useState<Cliente | null>(null)
  const [naEntrega, setNaEntrega] = useState<Cliente | null>(null)

  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [uf, setUf] = useState('')
  const [cidade, setCidade] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [qualidade, setQualidade] = useState<Qualidade>('')
  const [ordem, setOrdem] = useState<Ordem>('desde')
  const [crescente, setCrescente] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(25)

  /* --- os seis numeros do topo, sempre sobre a base inteira -------------- */
  const conta = useMemo(() => {
    const pf = todos.filter((c) => c.tipo === 'F').length
    return {
      total: todos.length,
      pf,
      pj: todos.length - pf,
      contato: todos.filter(temContato).length,
      novos: todos.filter((c) => entrouNosUltimos30(c, hoje)).length,
      incompletos: todos.filter(cadastroIncompleto).length,
      whatsapp: todos.filter((c) => !!numeroDeWhatsApp(c)).length,
      documento: todos.filter((c) => !!c.documento).length,
      endereco: todos.filter((c) => !!(c.endereco || c.cidade)).length,
      pedidos: todos.filter(temPedidoNoSistema).length,
      duplicados: duplicados.size,
      fornecedor: todos.filter((c) => c.tipoDeContato.includes('Fornecedor')).length,
      funcionario: todos.filter((c) => c.tipoDeContato.includes('Funcionario')).length,
    }
  }, [todos, hoje, duplicados])

  const ufs = useMemo(
    () => [...new Set(todos.map((c) => c.uf).filter(Boolean))].sort(),
    [todos],
  )

  /* a lista de cidades segue a UF escolhida, senao ela oferece cidade que o
     filtro de cima ja tirou da mesa */
  const cidades = useMemo(() => {
    const base = uf && uf !== SEM ? todos.filter((c) => c.uf === uf) : todos
    const mapa = new Map<string, { nome: string; quantos: number }>()
    base.forEach((c) => {
      if (!c.cidade) return
      const k = semAcento(c.cidade)
      const ja = mapa.get(k)
      mapa.set(k, { nome: c.cidade, quantos: (ja?.quantos ?? 0) + 1 })
    })
    return [...mapa.entries()].sort(
      (a, b) => b[1].quantos - a[1].quantos || a[1].nome.localeCompare(b[1].nome, 'pt'),
    )
  }, [todos, uf])

  const anos = useMemo(
    () =>
      [...new Set(todos.map((c) => c.criadoEm.slice(0, 4)).filter(Boolean))].sort().reverse(),
    [todos],
  )

  function noPeriodo(c: Cliente) {
    if (!periodo) return true
    if (!c.criadoEm) return false
    if (periodo === 'mes') return c.criadoEm.slice(0, 7) === new Date(hoje).toISOString().slice(0, 7)
    if (periodo === '90') return (hoje - new Date(c.criadoEm).getTime()) / 86400000 <= 90
    return c.criadoEm.slice(0, 4) === periodo
  }

  function naQualidade(c: Cliente) {
    switch (qualidade) {
      case '':
        return true
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
      case 'novos30':
        return entrouNosUltimos30(c, hoje)
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
      if (tipo && c.tipo !== tipo) return false
      if (uf) {
        if (uf === SEM ? !!c.uf : c.uf !== uf) return false
      }
      if (cidade) {
        if (cidade === SEM ? !!c.cidade : semAcento(c.cidade) !== cidade) return false
      }
      if (!noPeriodo(c)) return false
      if (!naQualidade(c)) return false
      if (!b) return true
      const palha =
        semAcento([c.nome, c.fantasia, c.email, c.cidade, c.uf, c.bairro].filter(Boolean).join(' ')) +
        ' ' +
        [c.documento, c.telefone, c.celular].join(' ')
      return palha.includes(b) || (digitado.length >= 4 && palha.includes(digitado))
    })
    const sinal = crescente ? 1 : -1
    return [...lista].sort((a, b2) => {
      let r = 0
      if (ordem === 'desde') r = (a.criadoEm || '').localeCompare(b2.criadoEm || '')
      else if (ordem === 'cidade')
        r = (a.cidade || 'zzz').localeCompare(b2.cidade || 'zzz', 'pt')
      else r = semAcento(a.nome).localeCompare(semAcento(b2.nome), 'pt')
      if (r === 0) r = semAcento(a.nome).localeCompare(semAcento(b2.nome), 'pt')
      return r * sinal
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, busca, tipo, uf, cidade, periodo, qualidade, ordem, crescente, duplicados, hoje])

  const paginas = Math.max(1, Math.ceil(achados.length / porPagina))
  const paginaSegura = Math.min(pagina, paginas)
  const de = achados.length ? (paginaSegura - 1) * porPagina + 1 : 0
  const ate = Math.min(achados.length, paginaSegura * porPagina)
  const naTela = achados.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina)

  function mudou(fn: () => void) {
    fn()
    setPagina(1)
  }

  function limparTudo() {
    mudou(() => {
      setBusca('')
      setTipo('')
      setUf('')
      setCidade('')
      setPeriodo('')
      setQualidade('')
    })
  }

  function ordenarPor(k: Ordem) {
    if (ordem === k) setCrescente((c) => !c)
    else {
      setOrdem(k)
      setCrescente(k !== 'desde')
    }
    setPagina(1)
  }

  /* o que esta filtrando agora, escrito, com um x em cada um */
  const marcas: [string, () => void][] = []
  if (tipo) marcas.push([tipo === 'F' ? 'Pessoa física' : 'Pessoa jurídica', () => setTipo('')])
  if (uf) marcas.push([uf === SEM ? 'Sem UF' : 'UF: ' + uf, () => setUf('')])
  if (cidade) {
    const achada = cidades.find(([k]) => k === cidade)
    marcas.push([
      cidade === SEM ? 'Sem cidade' : 'Cidade: ' + (achada ? achada[1].nome : cidade),
      () => setCidade(''),
    ])
  }
  if (periodo) marcas.push([ROTULO_DO_PERIODO[periodo] ?? 'Em ' + periodo, () => setPeriodo('')])
  if (qualidade) marcas.push([ROTULO_DA_QUALIDADE[qualidade], () => setQualidade('')])
  if (busca.trim()) marcas.push(['"' + busca.trim() + '"', () => setBusca('')])

  const seta = (k: Ordem) => (ordem === k ? (crescente ? ' ▲' : ' ▼') : '')

  return (
    <Pagina
      acima="CRM · base do Bling + pedidos do sistema"
      titulo="Clientes cadastrados"
      sub={
        <>
          <b>{conta.total.toLocaleString('pt-BR')}</b> contatos · clique na cidade para ver as
          transportadoras
        </>
      }
      acoes={
        <>
          <Botao
            tom="contorno"
            onClick={() => avisar('A exportação do filtro entra junto com o Supabase', 'info')}
          >
            Exportar filtro
          </Botao>
          <Botao tom="primario" onClick={() => setNaFicha(clienteEmBranco())}>
            Novo cliente
          </Botao>
        </>
      }
    >
      <div className="cl-kpis">
        <Kpi rotulo="Total de clientes" valor={conta.total} sub="base completa" />
        <Kpi
          rotulo="Pessoa física"
          valor={conta.pf}
          sub={pct(conta.pf, conta.total) + ' da base'}
          ligado={tipo === 'F'}
          aoClicar={() => mudou(() => setTipo(tipo === 'F' ? '' : 'F'))}
        />
        <Kpi
          rotulo="Pessoa jurídica"
          valor={conta.pj}
          sub={pct(conta.pj, conta.total) + ' da base'}
          ligado={tipo === 'J'}
          aoClicar={() => mudou(() => setTipo(tipo === 'J' ? '' : 'J'))}
        />
        <Kpi
          rotulo="Com contato"
          valor={conta.contato}
          sub="fone, celular ou e-mail"
          ligado={qualidade === 'contato'}
          aoClicar={() => mudou(() => setQualidade(qualidade === 'contato' ? '' : 'contato'))}
        />
        <Kpi
          rotulo="Novos · 30 dias"
          valor={conta.novos}
          sub="entraram no último mês"
          ligado={qualidade === 'novos30'}
          aoClicar={() => mudou(() => setQualidade(qualidade === 'novos30' ? '' : 'novos30'))}
        />
        <Kpi
          rotulo="Cadastro incompleto"
          valor={conta.incompletos}
          sub="sem documento e sem contato"
          aviso
          ligado={qualidade === 'incompleto'}
          aoClicar={() => mudou(() => setQualidade(qualidade === 'incompleto' ? '' : 'incompleto'))}
        />
      </div>

      <div className="cl-filtros">
        <div className="cl-busca">
          <Busca
            placeholder="Buscar por nome, fantasia, CPF/CNPJ, e-mail, telefone, cidade"
            value={busca}
            onChange={(e) => mudou(() => setBusca(e.target.value))}
          />
        </div>
        <Seletor
          rotulo="Tipo"
          valor={tipo}
          vazio="Todos"
          opcoes={[
            { valor: 'F', rotulo: 'Pessoa física', contagem: conta.pf },
            { valor: 'J', rotulo: 'Pessoa jurídica', contagem: conta.pj },
          ]}
          aoEscolher={(v) => mudou(() => setTipo(v))}
        />
        <Seletor
          rotulo="UF"
          valor={uf}
          vazio="Todas"
          opcoes={[
            ...ufs.map((u) => ({
              valor: u,
              rotulo: u,
              contagem: todos.filter((c) => c.uf === u).length,
            })),
            { valor: SEM, rotulo: 'Sem UF', contagem: todos.filter((c) => !c.uf).length },
          ]}
          aoEscolher={(v) =>
            mudou(() => {
              setUf(v)
              setCidade('')
            })
          }
        />
        <Seletor
          rotulo="Cidade"
          valor={cidade}
          vazio={uf && uf !== SEM ? 'Todas de ' + uf : 'Todas'}
          comBusca
          opcoes={[
            ...cidades.map(([k, o]) => ({ valor: k, rotulo: o.nome, contagem: o.quantos })),
            { valor: SEM, rotulo: 'Sem cidade', contagem: todos.filter((c) => !c.cidade).length },
          ]}
          aoEscolher={(v) => mudou(() => setCidade(v))}
        />
        <Seletor
          rotulo="Cliente desde"
          valor={periodo}
          vazio="Todos"
          opcoes={[
            { valor: 'mes', rotulo: 'Este mês' },
            { valor: '90', rotulo: 'Últimos 90 dias' },
            ...anos.map((a) => ({
              valor: a,
              rotulo: 'Em ' + a,
              contagem: todos.filter((c) => c.criadoEm.slice(0, 4) === a).length,
            })),
          ]}
          aoEscolher={(v) => mudou(() => setPeriodo(v))}
        />
        <Seletor
          rotulo="Filtro"
          valor={qualidade}
          vazio="Todos"
          opcoes={[
            { valor: 'contato', rotulo: 'Com contato', contagem: conta.contato },
            { valor: 'sem-contato', rotulo: 'Sem contato', contagem: conta.total - conta.contato },
            { valor: 'whatsapp', rotulo: 'Com WhatsApp', contagem: conta.whatsapp },
            { valor: 'documento', rotulo: 'Com CPF/CNPJ', contagem: conta.documento },
            { valor: 'endereco', rotulo: 'Com endereço', contagem: conta.endereco },
            { valor: 'incompleto', rotulo: 'Cadastro incompleto', contagem: conta.incompletos },
            { valor: 'duplicado', rotulo: 'Possíveis duplicados', contagem: conta.duplicados },
            { valor: 'pedidos', rotulo: 'Com pedido no sistema', contagem: conta.pedidos },
            { valor: 'novos30', rotulo: 'Novos (30 dias)', contagem: conta.novos },
            { valor: 'fornecedor', rotulo: 'Também fornecedor', contagem: conta.fornecedor },
            { valor: 'funcionario', rotulo: 'Também funcionário', contagem: conta.funcionario },
          ]}
          aoEscolher={(v) => mudou(() => setQualidade(v as Qualidade))}
        />
        <button
          type="button"
          className="bt-icone cl-limpa"
          title="Limpar filtros"
          aria-label="Limpar filtros"
          onClick={limparTudo}
        >
          <Trash size={18} />
        </button>
      </div>

      <div className="cl-marcas">
        <span>
          <b>{achados.length.toLocaleString('pt-BR')}</b>{' '}
          {achados.length === 1 ? 'cliente' : 'clientes'}
          {achados.length !== conta.total ? ' de ' + conta.total.toLocaleString('pt-BR') : ''}
        </span>
        {marcas.map(([texto, tirar]) => (
          <span className="cl-marca" key={texto}>
            {texto}
            <button type="button" aria-label={'Tirar o filtro ' + texto} onClick={() => mudou(tirar)}>
              &times;
            </button>
          </span>
        ))}
        {marcas.length ? (
          <button type="button" className="cl-limpa-tudo" onClick={limparTudo}>
            limpar tudo
          </button>
        ) : null}
      </div>

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
                    <th>Documento</th>
                    <th className="cl-some">Contato</th>
                    <th>
                      <button type="button" onClick={() => ordenarPor('cidade')}>
                        Cidade / UF{seta('cidade')}
                      </button>
                    </th>
                    <th className="cl-some">Tipo</th>
                    <th className="cl-some">
                      <button type="button" onClick={() => ordenarPor('desde')}>
                        Desde{seta('desde')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {naTela.map((c) => (
                    <Linha
                      key={c.id}
                      c={c}
                      duplicado={duplicados.has(c.id)}
                      transportadoras={c.cidade ? transportadorasPara(c, cepsDaCidade).length : 0}
                      aoAbrir={() => setNaFicha(c)}
                      aoVerEntrega={() => setNaEntrega(c)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cl-pe">
              <span>
                Mostrando <b>{de} a {ate}</b> de <b>{achados.length.toLocaleString('pt-BR')}</b>
              </span>
              <span className="cl-empurra" />
              <Seletor
                rotulo="Por página"
                tamanho="sm"
                valor={String(porPagina)}
                vazio="25"
                opcoes={[25, 50, 100].map((n) => ({ valor: String(n), rotulo: String(n) }))}
                aoEscolher={(v) => mudou(() => setPorPagina(Number(v) || 25))}
              />
              <Numeros pagina={paginaSegura} paginas={paginas} aoIr={setPagina} />
            </div>
          </>
        ) : carregando ? (
          <div className="cl-carregando">
            <Esqueleto altura={44} />
            <Esqueleto altura={44} />
            <Esqueleto altura={44} />
            <Esqueleto altura={44} />
            <Esqueleto altura={44} />
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
            titulo={
              todos.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'
            }
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

      <FichaDoCliente
        cliente={naFicha}
        base={todos}
        aoFechar={() => setNaFicha(null)}
        aoSalvar={(c) => {
          /* A lista volta do banco, e não do que a ficha devolveu: gravar um
             cliente pode mexer em mais coisa do que o campo que a pessoa
             editou, e a tela que adivinha o resultado é a tela que mente. */
          void recarregar()
          setNaFicha(c)
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
  duplicado,
  transportadoras,
  aoAbrir,
  aoVerEntrega,
}: {
  c: Cliente
  duplicado: boolean
  transportadoras: number
  aoAbrir: () => void
  aoVerEntrega: () => void
}) {
  const zap = numeroDeWhatsApp(c)
  const fone = c.celular || c.telefone
  return (
    <tr onClick={aoAbrir}>
      <td>
        <span className="cl-quem">
          <span className="cl-retrato">
            {c.tipo === 'J' ? <Buildings size={14} /> : <User size={14} />}
          </span>
          <span className="cl-nome">
            <span className="cl-titulo">
              {c.nome}
              {temPedidoNoSistema(c) ? <b className="cl-marca-pd">PD</b> : null}
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
            {c.fantasia ? <span className="cl-fantasia">{c.fantasia}</span> : null}
          </span>
        </span>
      </td>
      <td className="cl-doc">
        {c.documento ? formatarDocumento(c.documento) : <span className="cl-falta">sem documento</span>}
      </td>
      <td className="cl-some">
        <span className="cl-contato">
          {fone ? (
            <span>
              {formatarTelefone(fone)}
              {zap ? (
                <a
                  className="cl-wa"
                  href={'https://wa.me/55' + zap}
                  target="_blank"
                  rel="noopener"
                  onClick={(e) => e.stopPropagation()}
                >
                  WA
                </a>
              ) : null}
            </span>
          ) : null}
          {c.email ? <span className="cl-email">{c.email.toLowerCase()}</span> : null}
          {!fone && !c.email ? <span className="cl-falta">sem contato</span> : null}
        </span>
      </td>
      <td>
        {c.cidade ? (
          <button
            type="button"
            className="cl-cidade"
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
      <td className="cl-some">
        <span className={c.tipo === 'J' ? 'cl-tipo pj' : 'cl-tipo'}>
          {c.tipo === 'J' ? 'PJ' : 'PF'}
        </span>
      </td>
      <td className="cl-some cl-desde">{formatarData(c.criadoEm)}</td>
    </tr>
  )
}

/* --- os numeros de pagina do rodape -------------------------------------- */
function Numeros({
  pagina,
  paginas,
  aoIr,
}: {
  pagina: number
  paginas: number
  aoIr: (p: number) => void
}) {
  const lista: (number | 'mais')[] = []
  for (let p = 1; p <= paginas; p++) {
    if (p <= 2 || p > paginas - 2 || Math.abs(p - pagina) <= 1) lista.push(p)
    else if (lista[lista.length - 1] !== 'mais') lista.push('mais')
  }
  return (
    <span className="cl-numeros">
      <button type="button" disabled={pagina <= 1} onClick={() => aoIr(pagina - 1)} aria-label="Página anterior">
        ‹
      </button>
      {lista.map((p, i) =>
        p === 'mais' ? (
          <span key={'m' + i}>…</span>
        ) : (
          <button
            type="button"
            key={p}
            className={p === pagina ? 'ligado' : ''}
            aria-current={p === pagina ? 'page' : undefined}
            onClick={() => aoIr(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={pagina >= paginas}
        onClick={() => aoIr(pagina + 1)}
        aria-label="Próxima página"
      >
        ›
      </button>
    </span>
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

const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 100) : 0) + '%'
