import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Botao,
  Busca,
  Kpi,
  Pagina,
  Selo,
  Seletor,
  Esqueleto,
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
  carregarCotacoes,
  type CotacaoNaLista,
  proximoNumero,
  salvarCotacao,
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

  /* A LISTA VEM DA VIEW, SEM O CORPO DO DOCUMENTO.

     Dentro do corpo vao as imagens dos layouts. Pedir a cotacao inteira para
     desenhar uma tabela de texto seria baixar dezenas de megabytes para
     mostrar sessenta linhas. Por isso o tipo aqui e CotacaoNaLista, e nao
     Cotacao: assim nao existe o caminho em que alguem tenta desenhar um
     layout que nunca veio. */
  const [todas, setTodas] = useState<CotacaoNaLista[]>([])
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')

  const recarregar = useCallback(async () => {
    try {
      setTodas(await carregarCotacoes())
      setFalha('')
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui carregar as cotações.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

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
      return limpar(c.numero + ' ' + c.clienteNome + ' ' + c.clienteCidade).includes(b)
    })
  }, [todas, busca, estado, vendedor])

  const contas = useMemo(() => {
    const conta = (e: EstadoDaCotacao) => todas.filter((c) => c.estado === e).length
    const emAberto = todas.filter((c) => c.estado === 'enviada')
    return {
      rascunho: conta('rascunho'),
      enviada: emAberto.length,
      aprovada: conta('aprovada'),
      valorEmAberto: emAberto.reduce((s, c) => s + c.total, 0),
    }
  }, [todas])

  /* O NUMERO SAI DO BANCO, e nao de uma conta sobre a lista. Duas pessoas
     criando cotacao no mesmo minuto leriam a mesma lista e tirariam o mesmo
     proximo numero; o contador la dentro e uma linha so, e o update dele e
     atomico. */
  async function nova() {
    try {
      const c = cotacaoEmBranco(await proximoNumero())
      const salva = await salvarCotacao(c)
      navegar('/cotacao/' + salva.id)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui criar a cotação', 'warn')
    }
  }

  async function abrirArquivo() {
    try {
      const c = await abrirCft()
      if (!c) return
      /* Arquivo aberto vira cotacao NOVA no banco, com numero novo. Ele pode
         ter vindo de outro computador, de um backup ou de uma versao antiga, e
         gravar por cima do id que estava escrito dentro dele sobrescreveria
         silenciosamente uma cotacao que alguem esta editando. */
      const salva = await salvarCotacao({ ...c, id: '', numero: c.numero || (await proximoNumero()) })
      avisar('Cotação ' + salva.numero + ' aberta do arquivo', 'ok')
      navegar('/cotacao/' + salva.id)
    } catch (e) {
      avisar(e instanceof ArquivoRecusado ? e.message : 'Não deu para abrir o arquivo', 'warn')
    }
  }

  const colunas: Coluna<CotacaoNaLista>[] = [
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
          <b>{c.clienteNome || 'sem cliente'}</b>
          <span>
            {c.clienteCidade}
            {c.clienteUf ? ', ' + c.clienteUf : ''}
          </span>
        </span>
      ),
    },
    { chave: 'criadaEm', titulo: 'Criada', celula: (c) => data(c.criadaEm) },
    { chave: 'validaAte', titulo: 'Vale até', celula: (c) => data(c.validaAte) },
    { chave: 'pecas', titulo: 'Peças', numero: true, celula: (c) => c.pecas },
    {
      chave: 'estado',
      titulo: 'Situação',
      celula: (c) => <Selo tom={TOM_DO_ESTADO[c.estado]}>{NOME_DO_ESTADO_DA_COTACAO[c.estado]}</Selo>,
    },
    { chave: 'total', titulo: 'Total', numero: true, celula: (c) => dinheiro(c.total) },
  ]

  return (
    <Pagina
      acima="Comercial"
      titulo="Cotação de venda"
      sub="A proposta que vai para o cliente, e o arquivo .cft que ela vira."
      acoes={
        <>
          <Botao tom="contorno" onClick={() => void abrirArquivo()}>
            Abrir .cft
          </Botao>
          <Botao tom="primario" onClick={() => void nova()}>
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
          carregando ? (
            <Esqueleto altura={200} />
          ) : falha ? (
            <Vazio
              titulo="Não consegui carregar as cotações"
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
              titulo="Nenhuma cotação por aqui"
              texto={
                todas.length
                  ? 'Mude os filtros para ver o resto da base.'
                  : 'Abra um arquivo .cft, comece uma cotação nova, ou semeie conteúdo de teste em Configurações.'
              }
            />
          )
        }
      />
    </Pagina>
  )
}
