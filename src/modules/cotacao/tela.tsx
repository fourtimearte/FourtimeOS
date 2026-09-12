import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Botao,
  Busca,
  Kpi,
  Pagina,
  Selo,
  Seletor,
  Tabela,
  Vazio,
  avisar,
  type Coluna,
} from '@ds'
import {
  ArquivoRecusado,
  NOME_DO_ESTADO_DA_COTACAO,
  abrirCft,
  cotacaoEmBranco,
  listarCotacoes,
  pecasDaCotacao,
  proximoNumero,
  salvarCotacao,
  totalDaCotacao,
  type Cotacao,
  type EstadoDaCotacao,
} from '@dominio/cotacao'
import './cotacao.css'

const limpar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const TOM_DO_ESTADO: Record<EstadoDaCotacao, 'neutro' | 'info' | 'ok' | 'warn' | 'brand'> = {
  rascunho: 'neutro',
  enviada: 'info',
  aprovada: 'ok',
  recusada: 'brand',
  vencida: 'warn',
}

const ESTADOS = (Object.keys(NOME_DO_ESTADO_DA_COTACAO) as EstadoDaCotacao[]).map((e) => ({
  valor: e,
  rotulo: NOME_DO_ESTADO_DA_COTACAO[e],
}))

const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const data = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')

export function TelaCotacao() {
  const navegar = useNavigate()
  const [versao, setVersao] = useState(0)
  const todas = useMemo(() => listarCotacoes(), [versao])

  const [busca, setBusca] = useState('')
  const [estado, setEstado] = useState('')
  const [vendedor, setVendedor] = useState('')

  const vendedores = useMemo(
    () => [...new Set(todas.map((c) => c.vendedor).filter(Boolean))].sort(),
    [todas],
  )

  const filtradas = useMemo(() => {
    const b = limpar(busca.trim())
    return todas.filter((c) => {
      if (estado && c.estado !== estado) return false
      if (vendedor && c.vendedor !== vendedor) return false
      if (!b) return true
      return limpar(c.numero + ' ' + c.cliente.nome + ' ' + c.cliente.cidade).includes(b)
    })
  }, [todas, busca, estado, vendedor])

  const contas = useMemo(() => {
    const conta = (e: EstadoDaCotacao) => todas.filter((c) => c.estado === e).length
    const emAberto = todas.filter((c) => c.estado === 'enviada')
    return {
      rascunho: conta('rascunho'),
      enviada: emAberto.length,
      aprovada: conta('aprovada'),
      valorEmAberto: emAberto.reduce((s, c) => s + totalDaCotacao(c), 0),
    }
  }, [todas])

  function nova() {
    const c = cotacaoEmBranco(proximoNumero())
    salvarCotacao(c)
    navegar('/cotacao/' + c.id)
  }

  async function abrirArquivo() {
    try {
      const c = await abrirCft()
      if (!c) return
      const salva = salvarCotacao(c)
      setVersao((v) => v + 1)
      avisar('Cotação ' + salva.numero + ' aberta do arquivo', 'ok')
      navegar('/cotacao/' + salva.id)
    } catch (e) {
      avisar(e instanceof ArquivoRecusado ? e.message : 'Não deu para abrir o arquivo', 'warn')
    }
  }

  const colunas: Coluna<Cotacao>[] = [
    {
      chave: 'numero',
      titulo: 'Cotação',
      celula: (c) => (
        <span className="ct-num">
          <b>{c.numero}</b>
          <span>{c.vendedor || 'sem vendedor'}</span>
        </span>
      ),
    },
    {
      chave: 'cliente',
      titulo: 'Cliente',
      celula: (c) => (
        <span className="ct-num">
          <b>{c.cliente.nome || 'sem cliente'}</b>
          <span>
            {c.cliente.cidade}
            {c.cliente.uf ? ', ' + c.cliente.uf : ''}
          </span>
        </span>
      ),
    },
    { chave: 'criadaEm', titulo: 'Criada', celula: (c) => data(c.criadaEm) },
    { chave: 'validaAte', titulo: 'Vale até', celula: (c) => data(c.validaAte) },
    { chave: 'pecas', titulo: 'Peças', numero: true, celula: (c) => pecasDaCotacao(c) },
    {
      chave: 'estado',
      titulo: 'Situação',
      celula: (c) => <Selo tom={TOM_DO_ESTADO[c.estado]}>{NOME_DO_ESTADO_DA_COTACAO[c.estado]}</Selo>,
    },
    { chave: 'total', titulo: 'Total', numero: true, celula: (c) => dinheiro(totalDaCotacao(c)) },
  ]

  return (
    <Pagina
      acima="Comercial"
      titulo="Cotação de venda"
      sub="A proposta que vai para o cliente, e o arquivo .cft que ela vira."
      acoes={
        <>
          <Botao tom="contorno" onClick={abrirArquivo}>
            Abrir .cft
          </Botao>
          <Botao tom="primario" onClick={nova}>
            Nova cotação
          </Botao>
        </>
      }
    >
      <div className="fila-kpi" style={{ marginBottom: 'var(--sp-5)' }}>
        <Kpi rotulo="Cotações" valor={todas.length} sub="na base inteira" ligado={estado === ''} aoClicar={() => setEstado('')} />
        <Kpi rotulo="Rascunhos" valor={contas.rascunho} sub="ainda não saíram" ligado={estado === 'rascunho'} aoClicar={() => setEstado('rascunho')} />
        <Kpi rotulo="Em aberto" valor={contas.enviada} sub="esperando resposta" ligado={estado === 'enviada'} aoClicar={() => setEstado('enviada')} />
        <Kpi rotulo="Valor em aberto" valor={dinheiro(contas.valorEmAberto)} sub="soma do que foi enviado" />
      </div>

      <div className="ct-filtros">
        <Busca
          placeholder="Número, cliente ou cidade"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Seletor
          rotulo="SITUAÇÃO"
          valor={estado}
          opcoes={ESTADOS}
          vazio="Todas"
          aoEscolher={setEstado}
        />
        <Seletor
          rotulo="VENDEDOR"
          valor={vendedor}
          opcoes={vendedores.map((v) => ({ valor: v, rotulo: v }))}
          vazio="Todos"
          aoEscolher={setVendedor}
        />
      </div>

      <Tabela
        colunas={colunas}
        linhas={filtradas}
        chaveDaLinha={(c) => c.id}
        aoClicarNaLinha={(c) => navegar('/cotacao/' + c.id)}
        vazio={
          <Vazio
            titulo="Nenhuma cotação por aqui"
            texto="Mude os filtros, abra um arquivo .cft, ou comece uma cotação nova."
          />
        }
      />
    </Pagina>
  )
}
