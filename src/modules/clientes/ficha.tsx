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
  linkDoWhatsApp,
  pedidosDoCliente,
  salvarCliente,
  situacaoDoCliente,
  transportadoraPorCep,
  type Cliente,
  type Pedido,
  type Segmento,
} from '@dominio/cliente'
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
  aoFechar,
  aoSalvar,
}: {
  cliente: Cliente | null
  aoFechar: () => void
  aoSalvar: (c: Cliente) => void
}) {
  const [rascunho, setRascunho] = useState<Cliente | null>(cliente)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    setRascunho(cliente)
    /* cliente sem id e cliente novo: ele ja nasce em modo de edicao */
    setEditando(!!cliente && !cliente.id)
  }, [cliente])

  const c = rascunho
  const novo = !!c && !c.id

  const pedidos = useMemo(() => (c && c.id ? pedidosDoCliente(c) : []), [c])
  const transportadora = useMemo(() => transportadoraPorCep(c?.cep ?? ''), [c?.cep])

  if (!c) return null

  const mudar = (campo: keyof Cliente, valor: string) =>
    setRascunho((x) => (x ? { ...x, [campo]: valor } : x))

  function salvar() {
    if (!c) return
    if (!c.nome.trim()) {
      avisar('O nome do cliente não pode ficar vazio', 'warn')
      return
    }
    const salvo = salvarCliente(c)
    aoSalvar(salvo)
    setEditando(false)
    avisar(novo ? 'Cliente cadastrado' : 'Cliente salvo', 'ok')
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
            <Botao tom="primario" onClick={salvar}>
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
        <section className="ficha-cadastro">
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
              <Campo rotulo="CPF ou CNPJ" dica="Só os números">
                <Entrada value={c.documento} onChange={(e) => mudar('documento', e.target.value)} />
              </Campo>
              <Campo rotulo="Contato">
                <Entrada value={c.contato} onChange={(e) => mudar('contato', e.target.value)} />
              </Campo>
              <Campo rotulo="Telefone" dica="Com DDD, só os números">
                <Entrada value={c.telefone} onChange={(e) => mudar('telefone', e.target.value)} />
              </Campo>
              <Campo rotulo="E-mail">
                <Entrada
                  type="email"
                  value={c.email}
                  onChange={(e) => mudar('email', e.target.value)}
                />
              </Campo>
              <Campo rotulo="Cidade">
                <Entrada value={c.cidade} onChange={(e) => mudar('cidade', e.target.value)} />
              </Campo>
              <Campo rotulo="Estado">
                <Seletor
                  bloco
                  valor={c.uf}
                  opcoes={UFS}
                  vazio="Escolher"
                  aoEscolher={(v) => mudar('uf', v)}
                />
              </Campo>
              <Campo rotulo="CEP" dica={transportadora.nome + ', ' + transportadora.prazo}>
                <Entrada value={c.cep} onChange={(e) => mudar('cep', e.target.value)} />
              </Campo>
              <Campo rotulo="Segmento">
                <Seletor
                  bloco
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
              <Linha rotulo="Documento" valor={formatarDocumento(c.documento)} />
              <Linha rotulo="Contato" valor={c.contato} />
              <Linha rotulo="Telefone" valor={formatarTelefone(c.telefone)} />
              <Linha rotulo="E-mail" valor={c.email} />
              <Linha rotulo="Cidade" valor={c.cidade + ', ' + c.uf} />
              <Linha rotulo="CEP" valor={formatarCep(c.cep)} />
              <Linha rotulo="Segmento" valor={NOME_DO_SEGMENTO[c.segmento]} />
              <Linha rotulo="Vendedor" valor={c.vendedor} />
              <Linha rotulo="Cliente desde" valor={formatarData(c.criadoEm)} />
            </dl>
          )}

          <div className="ficha-frete">
            <b>Frete</b>
            <span>
              {transportadora.nome}, {transportadora.prazo}
            </span>
            <small>Quem decide é a faixa de CEP, não a cidade.</small>
          </div>
        </section>

        <section className="ficha-historico">
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
          <Tabela
            colunas={colunas}
            linhas={pedidos}
            chaveDaLinha={(p) => p.numero}
            aoClicarNaLinha={() => avisar('Abrir o pedido entra junto com a ficha de produção', 'info')}
            vazio={
              <Vazio
                titulo={novo ? 'Cliente ainda não cadastrado' : 'Nenhum pedido ainda'}
                texto={
                  novo
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
