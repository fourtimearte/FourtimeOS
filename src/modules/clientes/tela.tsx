import { useMemo, useState } from 'react'
import {
  Aviso,
  Botao,
  Busca,
  Kpi,
  Pagina,
  Paginador,
  Selo,
  Seletor,
  Tabela,
  Tag,
  Vazio,
  avisar,
  type Coluna,
} from '@ds'
import { FichaDoCliente } from './ficha'
import {
  clienteEmBranco,
  DADO_DE_EXEMPLO,
  NOME_DA_SITUACAO,
  NOME_DO_SEGMENTO,
  formatarData,
  formatarDinheiro,
  formatarDocumento,
  formatarTelefone,
  listarClientes,
  situacaoDoCliente,
  type Cliente,
  type Segmento,
  type Situacao,
} from '@dominio/cliente'

const POR_PAGINA = 20

/* busca sem acento e sem caixa, que e como a fabrica digita */
const limpar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function TelaClientes() {
  /* muda quando alguem salva: e o sinal para reler a lista */
  const [versao, setVersao] = useState(0)
  const todos = useMemo(() => listarClientes(), [versao])
  const [naFicha, setNaFicha] = useState<Cliente | null>(null)
  const hoje = useMemo(() => Date.now(), [])

  const [busca, setBusca] = useState('')
  const [foco, setFoco] = useState<Situacao | ''>('')
  const [vendedor, setVendedor] = useState('')
  const [segmento, setSegmento] = useState('')
  const [cidade, setCidade] = useState('')
  const [pagina, setPagina] = useState(1)

  const comSituacao = useMemo(
    () => todos.map((c) => ({ c, situacao: situacaoDoCliente(c, hoje) })),
    [todos, hoje],
  )

  const contas = useMemo(() => {
    const n = { ativo: 0, novo: 0, parado: 0, 'sem-pedido': 0 } as Record<Situacao, number>
    comSituacao.forEach((x) => (n[x.situacao] += 1))
    const compradores = todos.filter((c) => c.pedidos > 0)
    const ticket = compradores.length
      ? compradores.reduce((s, c) => s + c.total, 0) / compradores.reduce((s, c) => s + c.pedidos, 0)
      : 0
    return { ...n, ticket }
  }, [comSituacao, todos])

  const opcoesVendedor = useMemo(
    () => juntar(todos.map((c) => c.vendedor)).map((v) => ({ valor: v[0], rotulo: v[0], contagem: v[1] })),
    [todos],
  )
  const opcoesCidade = useMemo(
    () =>
      juntar(todos.map((c) => c.cidade + ' ' + c.uf)).map((v) => ({
        valor: v[0],
        rotulo: v[0],
        contagem: v[1],
      })),
    [todos],
  )
  const opcoesSegmento = useMemo(
    () =>
      juntar(todos.map((c) => c.segmento)).map((v) => ({
        valor: v[0],
        rotulo: NOME_DO_SEGMENTO[v[0] as Segmento],
        contagem: v[1],
      })),
    [todos],
  )

  const achados = useMemo(() => {
    const b = limpar(busca.trim())
    const so = b.replace(/\D/g, '')
    return comSituacao
      .filter(({ c, situacao }) => {
        if (foco && situacao !== foco) return false
        if (vendedor && c.vendedor !== vendedor) return false
        if (segmento && c.segmento !== segmento) return false
        if (cidade && c.cidade + ' ' + c.uf !== cidade) return false
        if (!b) return true
        if (so.length >= 3 && (c.documento.includes(so) || c.telefone.includes(so))) return true
        return limpar(c.nome + ' ' + c.contato + ' ' + c.vendedor + ' ' + c.cidade).includes(b)
      })
      .map((x) => x.c)
  }, [comSituacao, busca, foco, vendedor, segmento, cidade])

  const paginas = Math.max(1, Math.ceil(achados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, paginas)
  const naTela = achados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA)

  function mudouFiltro(fn: () => void) {
    fn()
    setPagina(1)
  }

  const filtrando = !!(busca || foco || vendedor || segmento || cidade)

  const colunas: Coluna<Cliente>[] = [
    {
      chave: 'nome',
      titulo: 'Cliente',
      ordenarPor: (c) => limpar(c.nome),
      celula: (c) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <b>{c.nome}</b>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatarDocumento(c.documento)}</span>
        </span>
      ),
    },
    {
      chave: 'segmento',
      titulo: 'Segmento',
      ordenarPor: (c) => c.segmento,
      celula: (c) => <Tag>{NOME_DO_SEGMENTO[c.segmento]}</Tag>,
    },
    {
      chave: 'contato',
      titulo: 'Contato',
      celula: (c) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>{c.contato}</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatarTelefone(c.telefone)}</span>
        </span>
      ),
    },
    {
      chave: 'cidade',
      titulo: 'Cidade',
      ordenarPor: (c) => limpar(c.cidade),
      celula: (c) => c.cidade + ', ' + c.uf,
    },
    { chave: 'vendedor', titulo: 'Vendedor', ordenarPor: (c) => c.vendedor, celula: (c) => c.vendedor },
    {
      chave: 'situacao',
      titulo: 'Situação',
      celula: (c) => {
        const s = situacaoDoCliente(c, hoje)
        const tom = s === 'parado' ? 'brand' : s === 'novo' ? 'info' : s === 'ativo' ? 'ok' : 'neutro'
        return <Selo tom={tom}>{NOME_DA_SITUACAO[s]}</Selo>
      },
    },
    {
      chave: 'pedidos',
      titulo: 'Pedidos',
      numero: true,
      ordenarPor: (c) => c.pedidos,
      celula: (c) => c.pedidos,
    },
    {
      chave: 'ultimo',
      titulo: 'Último pedido',
      numero: true,
      ordenarPor: (c) => c.ultimoPedido || '0',
      celula: (c) => formatarData(c.ultimoPedido) || '-',
    },
    {
      chave: 'total',
      titulo: 'Total comprado',
      numero: true,
      ordenarPor: (c) => c.total,
      celula: (c) => formatarDinheiro(c.total),
    },
  ]

  return (
    <Pagina
      acima="Comercial"
      titulo="Clientes"
      sub="Quem compra, o que já comprou e quem atende."
      acoes={
        <>
          <Botao tom="contorno" onClick={() => avisar('A importação do Bling entra no passo 11', 'info')}>
            Importar do Bling
          </Botao>
          <Botao tom="primario" onClick={() => setNaFicha(clienteEmBranco())}>
            Novo cliente
          </Botao>
        </>
      }
    >
      {DADO_DE_EXEMPLO ? (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <Aviso tom="info" titulo="Estes clientes são inventados">
            A tela está pronta, o dado não. Nenhum nome, documento ou telefone aqui pertence a
            alguém de verdade, e o que você cadastrar ou editar vale só enquanto esta aba estiver
            aberta. A base real entra na importação do Bling, e só o arquivo que busca o dado muda:
            esta tela fica igual.
          </Aviso>
        </div>
      ) : null}

      <div className="fila-kpi" style={{ marginBottom: 'var(--sp-5)' }}>
        <Kpi
          rotulo="Clientes"
          valor={todos.length}
          sub="na base inteira"
          ligado={foco === ''}
          aoClicar={() => mudouFiltro(() => setFoco(''))}
        />
        <Kpi
          rotulo="Ativos"
          valor={contas.ativo}
          sub="pediram nos últimos 6 meses"
          ligado={foco === 'ativo'}
          aoClicar={() => mudouFiltro(() => setFoco('ativo'))}
        />
        <Kpi
          rotulo="Novos"
          valor={contas.novo}
          sub="entraram nos últimos 30 dias"
          ligado={foco === 'novo'}
          aoClicar={() => mudouFiltro(() => setFoco('novo'))}
        />
        <Kpi
          rotulo="Parados"
          valor={contas.parado}
          sub="sem pedido há mais de 6 meses"
          aviso
          ligado={foco === 'parado'}
          aoClicar={() => mudouFiltro(() => setFoco('parado'))}
        />
        <Kpi rotulo="Ticket médio" valor={formatarDinheiro(contas.ticket)} sub="por pedido" />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 'var(--gap-btn)',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 'var(--sp-4)',
        }}
      >
        <div style={{ flex: '1 1 260px', minWidth: 0, maxWidth: 420 }}>
          <Busca
            placeholder="Nome, documento, telefone ou contato"
            value={busca}
            onChange={(e) => mudouFiltro(() => setBusca(e.target.value))}
          />
        </div>
        <Seletor
          rotulo="VENDEDOR"
          valor={vendedor}
          opcoes={opcoesVendedor}
          aoEscolher={(v) => mudouFiltro(() => setVendedor(v))}
        />
        <Seletor
          rotulo="SEGMENTO"
          valor={segmento}
          opcoes={opcoesSegmento}
          aoEscolher={(v) => mudouFiltro(() => setSegmento(v))}
        />
        <Seletor
          rotulo="CIDADE"
          valor={cidade}
          opcoes={opcoesCidade}
          aoEscolher={(v) => mudouFiltro(() => setCidade(v))}
        />
        {filtrando ? (
          <Botao
            tom="limpo"
            onClick={() =>
              mudouFiltro(() => {
                setBusca('')
                setFoco('')
                setVendedor('')
                setSegmento('')
                setCidade('')
              })
            }
          >
            Limpar filtros
          </Botao>
        ) : null}
      </div>

      <Tabela
        colunas={colunas}
        linhas={naTela}
        chaveDaLinha={(c) => c.id}
        aoClicarNaLinha={(c) => setNaFicha(c)}
        vazio={
          <Vazio
            titulo="Nenhum cliente com esses filtros"
            texto="Tire um filtro ou procure por outro pedaço do nome."
            acao={
              <Botao
                tom="forte"
                onClick={() =>
                  mudouFiltro(() => {
                    setBusca('')
                    setFoco('')
                    setVendedor('')
                    setSegmento('')
                    setCidade('')
                  })
                }
              >
                Limpar filtros
              </Botao>
            }
          />
        }
      />

      <FichaDoCliente
        cliente={naFicha}
        aoFechar={() => setNaFicha(null)}
        aoSalvar={(c) => {
          setVersao((v) => v + 1)
          setNaFicha(c)
        }}
      />

      <Paginador
        pagina={paginaSegura}
        paginas={paginas}
        total={achados.length}
        porPagina={POR_PAGINA}
        aoIr={(p) => setPagina(Math.max(1, Math.min(paginas, p)))}
      />
    </Pagina>
  )
}

/* conta quantas vezes cada valor aparece, e devolve em ordem alfabetica */
function juntar(valores: string[]): [string, number][] {
  const mapa = new Map<string, number>()
  valores.forEach((v) => mapa.set(v, (mapa.get(v) ?? 0) + 1))
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt'))
}
