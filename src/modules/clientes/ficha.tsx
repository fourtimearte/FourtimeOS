import { useEffect, useMemo, useState } from 'react'
import {
  Botao,
  Campo,
  Entrada,
  Modal,
  Selo,
  Seletor,
  Tabela,
  Vazio,
  avisar,
  type Coluna,
} from '@ds'
import {
  NOME_DA_SITUACAO,
  NOME_DO_ESTADO,
  NOME_DO_SEGMENTO,
  formatarCep,
  formatarData,
  formatarDinheiro,
  formatarDocumento,
  formatarTelefone,
  historicoAntigo,
  linkDoWhatsApp,
  pedidosDoCliente,
  salvarCliente,
  situacaoDoCliente,
  type AntesDoSistema,
  type Cliente,
  type Pedido,
  type Segmento,
} from '@dominio/cliente'
import { NOME_DA_ORIGEM, cepsPorCidade, transportadorasPara } from '@dominio/entrega'
import './clientes.css'

const SEGMENTOS = (Object.keys(NOME_DO_SEGMENTO) as Segmento[]).map((s) => ({
  valor: s,
  rotulo: NOME_DO_SEGMENTO[s],
}))

const UFS = ['GO', 'DF', 'MG', 'SP', 'BA', 'MT', 'MS', 'TO', 'PR', 'RJ'].map((u) => ({
  valor: u,
  rotulo: u,
}))

/* A ficha do cliente: cadastro a esquerda, historico a direita.

   Ela abre como modal largo porque duas colunas nao cabem numa folha lateral
   de 440 px, e porque a ficha e uma parada, nao um painel de apoio: a pessoa
   entra nela, resolve, e sai. */
export function FichaDoCliente({
  cliente,
  base,
  aoFechar,
  aoSalvar,
}: {
  cliente: Cliente | null
  /* A base inteira, para achar o CEP da cidade. Vem de cima em vez de a ficha
     pedir ao banco: a lista já está carregada do outro lado, e um segundo
     pedido só para descobrir o CEP de Goiânia seria a mesma consulta duas
     vezes na mesma tela. */
  base: Cliente[]
  aoFechar: () => void
  aoSalvar: (c: Cliente) => void
}) {
  const [rascunho, setRascunho] = useState<Cliente | null>(cliente)
  const [editando, setEditando] = useState(false)
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    setRascunho(cliente)
    /* cliente sem id e cliente novo: ele ja nasce em modo de edicao */
    setEditando(!!cliente && !cliente.id)
  }, [cliente])

  const c = rascunho
  const novo = !!c && !c.id

  /* O histórico vem do banco, e não de uma conta sobre o total comprado. Ele
     entra depois da ficha abrir de propósito: o cadastro é o que a pessoa veio
     ver, e segurar a ficha fechada esperando a lista de pedidos seria trocar
     o que ela quer pelo que ela talvez olhe. */
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [antigo, setAntigo] = useState<AntesDoSistema>({ pedidos: 0, total: 0, ultimo: '' })
  const [buscandoHistorico, setBuscandoHistorico] = useState(false)

  const idDoCliente = c?.id ?? ''
  useEffect(() => {
    if (!idDoCliente) {
      setPedidos([])
      setAntigo({ pedidos: 0, total: 0, ultimo: '' })
      return
    }
    let vivo = true
    setBuscandoHistorico(true)
    Promise.all([pedidosDoCliente(idDoCliente), historicoAntigo(idDoCliente)])
      .then(([lista, anterior]) => {
        if (!vivo) return
        setPedidos(lista)
        setAntigo(anterior)
      })
      .catch(() => vivo && setPedidos([]))
      .finally(() => vivo && setBuscandoHistorico(false))
    return () => {
      vivo = false
    }
  }, [idDoCliente])
  /* A melhor sugestao de frete: a lista vem em ordem de confianca, entao a
     primeira e a que tem a origem mais firme. A lista inteira fica na tela de
     clientes, ao clicar na cidade. */
  const frete = useMemo(() => {
    if (!c) return null
    const achadas = transportadorasPara(c, cepsPorCidade(base))
    return achadas[0] ?? null
  }, [c, base])

  if (!c) return null

  const mudar = (campo: keyof Cliente, valor: string) =>
    setRascunho((x) => (x ? { ...x, [campo]: valor } : x))

  async function salvar() {
    if (!c || gravando) return
    if (!c.nome.trim()) {
      avisar('O nome do cliente não pode ficar vazio', 'warn')
      return
    }
    setGravando(true)
    try {
      const salvo = await salvarCliente(c)
      aoSalvar(salvo)
      setEditando(false)
      avisar(novo ? 'Cliente cadastrado' : 'Cliente salvo', 'ok')
    } catch (e) {
      /* O erro do banco vai inteiro para a tela, e a ficha CONTINUA ABERTA em
         modo de edição. O nome repetido cai aqui ("Já existe um cadastro com
         esse nome"), e fechar a ficha nesse caso jogaria fora o que a pessoa
         acabou de digitar. */
      avisar(e instanceof Error ? e.message : 'Não consegui salvar o cliente', 'warn')
    } finally {
      setGravando(false)
    }
  }

  const situacao = c.id ? situacaoDoCliente(c) : null
  const tomDaSituacao =
    situacao === 'parado' ? 'brand' : situacao === 'novo' ? 'info' : situacao === 'ativo' ? 'ok' : 'neutro'

  /* o resumo do pedido mora embaixo do numero, e nao numa coluna propria:
     a ficha e estreita e o que importa nas colunas e numero, peca e valor */
  const colunas: Coluna<Pedido>[] = [
    {
      chave: 'numero',
      titulo: 'Pedido',
      celula: (p) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <b>{p.numero}</b>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{p.resumo}</span>
        </span>
      ),
    },
    { chave: 'data', titulo: 'Data', celula: (p) => formatarData(p.data) },
    { chave: 'pecas', titulo: 'Peças', numero: true, celula: (p) => p.pecas },
    {
      chave: 'estado',
      titulo: 'Situação',
      celula: (p) => (
        <Selo
          tom={
            p.estado === 'cancelado'
              ? 'brand'
              : p.estado === 'entregue'
                ? 'ok'
                : p.estado === 'producao'
                  ? 'info'
                  : 'warn'
          }
        >
          {NOME_DO_ESTADO[p.estado]}
        </Selo>
      ),
    },
    { chave: 'valor', titulo: 'Valor', numero: true, celula: (p) => formatarDinheiro(p.valor) },
  ]

  const mensagem =
    'Olá, ' +
    (c.contato || 'tudo bem') +
    '! Aqui é da Fourtime. Passando para falar sobre o pedido de vocês.'

  return (
    <Modal
      aberto
      largo
      aoFechar={aoFechar}
      titulo={novo ? 'Novo cliente' : c.nome}
      pe={
        editando ? (
          <>
            <Botao
              tom="limpo"
              onClick={() => {
                if (novo) aoFechar()
                else {
                  setRascunho(cliente)
                  setEditando(false)
                }
              }}
            >
              Cancelar
            </Botao>
            <Botao tom="primario" onClick={() => void salvar()} disabled={gravando}>
              {novo ? 'Cadastrar' : 'Salvar'}
            </Botao>
          </>
        ) : (
          <>
            <Botao
              tom="wa"
              onClick={() => window.open(linkDoWhatsApp(c, mensagem), '_blank', 'noopener')}
            >
              WhatsApp
            </Botao>
            <Botao tom="contorno" onClick={() => setEditando(true)}>
              Editar
            </Botao>
            <Botao tom="forte" onClick={aoFechar}>
              Fechar
            </Botao>
          </>
        )
      }
    >
      <div className="ficha">
        <section>
          <h3 className="ficha-titulo">Cadastro</h3>

          {editando ? (
            <div className="ficha-form">
              <Campo rotulo="Nome" className="col-2">
                <Entrada
                  value={c.nome}
                  onChange={(e) => mudar('nome', e.target.value)}
                  placeholder="Como aparece na cotação"
                />
              </Campo>
              <Campo rotulo="Nome fantasia" className="col-2">
                <Entrada
                  value={c.fantasia}
                  onChange={(e) => mudar('fantasia', e.target.value)}
                  placeholder="Quando o nome do cadastro não é o nome da porta"
                />
              </Campo>
              <Campo rotulo="Tipo">
                <Seletor
                  bloco
                  campo
                  valor={c.tipo}
                  opcoes={[
                    { valor: 'F', rotulo: 'Pessoa física' },
                    { valor: 'J', rotulo: 'Pessoa jurídica' },
                  ]}
                  vazio="Escolher"
                  aoEscolher={(v) => mudar('tipo', (v || 'F') as Cliente['tipo'])}
                />
              </Campo>
              <Campo rotulo="CPF ou CNPJ" dica="Só os números">
                <Entrada value={c.documento} onChange={(e) => mudar('documento', e.target.value)} />
              </Campo>
              <Campo rotulo="Contato">
                <Entrada value={c.contato} onChange={(e) => mudar('contato', e.target.value)} />
              </Campo>
              <Campo rotulo="Celular" dica="Com DDD. É por ele que sai o WhatsApp.">
                <Entrada value={c.celular} onChange={(e) => mudar('celular', e.target.value)} />
              </Campo>
              <Campo rotulo="Telefone fixo" dica="Com DDD, só os números">
                <Entrada value={c.telefone} onChange={(e) => mudar('telefone', e.target.value)} />
              </Campo>
              <Campo rotulo="E-mail">
                <Entrada
                  type="email"
                  value={c.email}
                  onChange={(e) => mudar('email', e.target.value)}
                />
              </Campo>
              <Campo rotulo="Endereço" className="col-2">
                <Entrada
                  value={c.endereco}
                  onChange={(e) => mudar('endereco', e.target.value)}
                  placeholder="Rua e número"
                />
              </Campo>
              <Campo rotulo="Complemento">
                <Entrada
                  value={c.complemento}
                  onChange={(e) => mudar('complemento', e.target.value)}
                />
              </Campo>
              <Campo rotulo="Bairro">
                <Entrada value={c.bairro} onChange={(e) => mudar('bairro', e.target.value)} />
              </Campo>
              <Campo rotulo="Cidade">
                <Entrada value={c.cidade} onChange={(e) => mudar('cidade', e.target.value)} />
              </Campo>
              <Campo rotulo="Estado">
                <Seletor
                  bloco
                  campo
                  valor={c.uf}
                  opcoes={UFS}
                  vazio="Escolher"
                  aoEscolher={(v) => mudar('uf', v)}
                />
              </Campo>
              <Campo
                rotulo="CEP"
                dica={
                  frete
                    ? frete.transportadora.nome + ', ' + frete.transportadora.prazo
                    : 'Preencha para saber quem entrega'
                }
              >
                <Entrada value={c.cep} onChange={(e) => mudar('cep', e.target.value)} />
              </Campo>
              <Campo rotulo="Segmento">
                <Seletor
                  bloco
                  campo
                  valor={c.segmento}
                  opcoes={SEGMENTOS}
                  vazio="Escolher"
                  aoEscolher={(v) => mudar('segmento', v || 'outros')}
                />
              </Campo>
              <Campo rotulo="Vendedor" className="col-2">
                <Entrada value={c.vendedor} onChange={(e) => mudar('vendedor', e.target.value)} />
              </Campo>
            </div>
          ) : (
            <dl className="ficha-dados">
              <Linha rotulo="Nome fantasia" valor={c.fantasia} />
              <Linha rotulo="Tipo" valor={c.tipo === 'J' ? 'Pessoa jurídica' : 'Pessoa física'} />
              <Linha rotulo="Documento" valor={formatarDocumento(c.documento)} />
              <Linha rotulo="Contato" valor={c.contato} />
              <Linha rotulo="Celular" valor={formatarTelefone(c.celular)} />
              <Linha rotulo="Telefone fixo" valor={formatarTelefone(c.telefone)} />
              <Linha rotulo="E-mail" valor={c.email} />
              <Linha
                rotulo="Endereço"
                valor={[c.endereco, c.complemento, c.bairro].filter(Boolean).join(' · ')}
              />
              <Linha rotulo="Cidade" valor={c.cidade ? c.cidade + ', ' + c.uf : ''} />
              <Linha rotulo="CEP" valor={formatarCep(c.cep)} />
              <Linha rotulo="Segmento" valor={NOME_DO_SEGMENTO[c.segmento]} />
              <Linha rotulo="Vendedor" valor={c.vendedor} />
              <Linha rotulo="Cliente desde" valor={formatarData(c.criadoEm)} />
            </dl>
          )}

          <div className="ficha-frete">
            <b>Frete</b>
            <span>
              {frete
                ? frete.transportadora.nome + ', ' + frete.transportadora.prazo
                : 'Sem CEP e sem cidade'}
            </span>
            <small>
              {frete
                ? 'Achada pelo ' + NOME_DA_ORIGEM[frete.origem] + '.'
                : 'Preencha cidade ou CEP para o sistema sugerir quem entrega.'}
            </small>
          </div>
        </section>

        <section>
          <div className="ficha-resumo">
            <div>
              <span className="rot">Pedidos</span>
              <b>{c.pedidos}</b>
            </div>
            <div>
              <span className="rot">Total comprado</span>
              <b>{formatarDinheiro(c.total)}</b>
            </div>
            <div>
              <span className="rot">Último pedido</span>
              <b>{formatarData(c.ultimoPedido) || 'nunca'}</b>
            </div>
            {situacao ? (
              <div>
                <span className="rot">Situação</span>
                <Selo tom={tomDaSituacao}>{NOME_DA_SITUACAO[situacao]}</Selo>
              </div>
            ) : null}
          </div>

          <h3 className="ficha-titulo">Histórico</h3>

          {/* O que veio do Bling não tem detalhe, e dizer isso em uma linha é
              mais honesto do que uma lista de pedidos que ninguém consegue
              abrir. Ela só aparece quando existe. */}
          {antigo.pedidos ? (
            <p className="ficha-antes">
              <b>{antigo.pedidos}</b> {antigo.pedidos === 1 ? 'pedido' : 'pedidos'} de antes do
              Fourtime OS, somando <b>{formatarDinheiro(antigo.total)}</b>
              {antigo.ultimo ? <> até {formatarData(antigo.ultimo)}</> : null}. Esses vieram do
              Bling e não têm detalhe por pedido.
            </p>
          ) : null}
          <Tabela
            colunas={colunas}
            linhas={pedidos}
            chaveDaLinha={(p) => p.numero}
            aoClicarNaLinha={() => avisar('Abrir o pedido entra junto com a ficha de produção', 'info')}
            vazio={
              <Vazio
                titulo={
                  buscandoHistorico
                    ? 'Buscando o histórico...'
                    : novo
                      ? 'Cliente ainda não cadastrado'
                      : antigo.pedidos
                        ? 'Nenhum pedido neste sistema ainda'
                        : 'Nenhum pedido ainda'
                }
                texto={
                  buscandoHistorico
                    ? ''
                    : novo
                      ? 'Preencha o cadastro à esquerda e o histórico começa aqui.'
                      : 'Quando a primeira cotação for aprovada, ela aparece nesta lista.'
                }
              />
            }
          />
        </section>
      </div>
    </Modal>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{valor || <span style={{ color: 'var(--text-3)' }}>não preenchido</span>}</dd>
    </>
  )
}
