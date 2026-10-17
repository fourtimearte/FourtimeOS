import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Factory, Handshake, MagnifyingGlass, Plus, UserCircle, X } from '@phosphor-icons/react'
import { Botao, Busca, Campo, CampoDeData, Entrada, Flutuante, Seletor, TituloCartao, semAcento } from '@ds'
import { comOValorAtual, opcoesDeDepartamento, usarListasDoCabecalho } from '@dominio/banco'
import { pode, useSessao } from '@dominio/sessao'
import {
  EXTRAS_VAZIOS,
  acharCliente,
  carregarClientes,
  carregarExtras,
  carregarFreteDoCliente,
  contatosDoCliente,
  documentosDoCliente,
  enderecoEmLinha,
  enderecosDoCliente,
  frasesDoFrete,
  type Cliente,
  type ExtrasDoCliente,
  type FreteDoCliente,
} from '@dominio/cliente'
import {
  COR_DA_MARCA,
  MARCAS,
  NOME_DO_ESTADO_DA_COTACAO,
  carregarVendedores,
  clienteDaCotacao,
  formataPedido,
  mascaraDeDocumento,
  type Vendedor,
  type Cotacao,
  type EstadoDaCotacao,
} from '@dominio/cotacao'
import { usarTabelasDaCotacao } from './tabelas-da-cotacao'
import './cotacao.css'

/* ==========================================================================
   Os dados do pedido, em três cartões.

   Moram na gaveta Dados do pedido (prancha 124), lado a lado, na ordem em que
   a venda acontece. Pagamento, entrega, embalagem e departamento vêm das
   listas do cabeçalho do banco (Configurações > Banco de dados), só as
   ativas; o vendedor é uma pessoa (CampoDoVendedor).

   UMA ARMADILHA QUE VALE DIZER EM VOZ ALTA: "envio" queria dizer duas coisas
   diferentes nos dois sistemas. Na cotação era o MODO (CORREIOS), na ficha era
   a DATA. Aqui o modo se chama Entrega e a data se chama Data de envio.
   ========================================================================== */


/* A lista de antes da 068: so vale enquanto as tabelas de preco nao estao
   no banco. Depois, a escolha e uma tabela de verdade, com id. */
const TABELAS_DE_ANTES = [
  { valor: 'Atacado 2026', rotulo: 'Atacado 2026' },
  { valor: 'Varejo 2026', rotulo: 'Varejo 2026' },
  { valor: 'Licitação', rotulo: 'Licitação' },
]

const ESTADOS = (Object.keys(NOME_DO_ESTADO_DA_COTACAO) as EstadoDaCotacao[]).map((e) => ({
  valor: e,
  rotulo: NOME_DO_ESTADO_DA_COTACAO[e],
}))

type Props = { c: Cotacao; mudar: (parte: Partial<Cotacao>) => void; travado?: boolean }

/** O que o cartão Dados do pedido precisa ter para o visto verde da porta. */
export function dadosCompletos(c: Cotacao): boolean {
  return !!(c.cliente.nome.trim() && c.vendedor && c.validaAte && c.informe.prazo.trim() && c.informe.pagamento)
}

/* O CADASTRO DA FICHA (082): os outros CPF/CNPJ, contatos e endereços do
   cliente ligado a esta cotação, e o frete de costume dos últimos pedidos.
   Sem cliente ligado, ou antes da 082, tudo vem vazio e o cartão é o de
   sempre. */
function usarCadastroDoCliente(id: string) {
  const [lido, setLido] = useState<{ id: string; cliente: Cliente | null; extras: ExtrasDoCliente; frete: FreteDoCliente | null }>({
    id: '',
    cliente: null,
    extras: EXTRAS_VAZIOS,
    frete: null,
  })
  useEffect(() => {
    if (!id) return
    let vivo = true
    void Promise.all([acharCliente(id).catch(() => null), carregarExtras(id).catch(() => EXTRAS_VAZIOS), carregarFreteDoCliente(id)]).then(
      ([cliente, extras, frete]) => vivo && setLido({ id, cliente, extras, frete }),
    )
    return () => {
      vivo = false
    }
  }, [id])
  return lido.id === id ? lido : { id, cliente: null, extras: EXTRAS_VAZIOS, frete: null }
}

export function QuemCompra({ c, mudar, travado }: Props) {
  const cli = (parte: Partial<Cotacao['cliente']>) => mudar({ cliente: { ...c.cliente, ...parte } })
  const cad = usarCadastroDoCliente(c.cliente.id)
  const docs = cad.cliente ? documentosDoCliente(cad.cliente, cad.extras) : []
  const contatos = cad.cliente ? contatosDoCliente(cad.cliente, cad.extras) : []
  const enderecos = cad.cliente ? enderecosDoCliente(cad.cliente, cad.extras) : []
  const escolhe = !travado && (docs.length > 1 || contatos.length > 1 || enderecos.length > 1)
  const costume = frasesDoFrete(cad.frete)

  /* ESCOLHER UM CLIENTE da base: o principal da ficha entra, e a Entrega
     vazia ganha o modo que os últimos pedidos dele mais usaram */
  const escolherCliente = (x: Cliente) => {
    mudar({ cliente: { ...c.cliente, ...clienteDaCotacao(x) } })
    if (c.informe.entrega) return
    void carregarFreteDoCliente(x.id).then((f) => {
      if (f?.modo) mudar({ informe: { ...c.informe, entrega: f.modo } })
    })
  }

  return (
    <section className="cartao ct-mc">
      <header className="ct-mc-cab">
        <TituloCartao icone={UserCircle}>Quem compra</TituloCartao>
        {!travado ? <BuscarEmClientes aoEscolher={escolherCliente} /> : null}
      </header>
      <div className="ct-mc-corpo ct-mc-2">
        <Campo rotulo="Cliente" className="ct-mc-toda">
          <Entrada
            value={c.cliente.nome}
            disabled={travado}
            placeholder="Nome como sai na proposta"
            onChange={(e) => cli({ nome: e.target.value })}
          />
        </Campo>
        {escolhe ? (
          <div className="ct-mc-toda ct-do-cadastro" aria-label="Escolher do cadastro do cliente">
            <small>Esta ficha tem mais de um cadastro. Escolha qual vale nesta cotação:</small>
            <div className="ct-do-cadastro-grade">
              {docs.length > 1 ? (
                <Campo rotulo="Qual CPF/CNPJ">
                  <Seletor
                    bloco
                    campo
                    valor={c.cliente.documentoDe ?? ''}
                    opcoes={docs.map((d) => ({ valor: d.valor, rotulo: d.rotulo + ' · ' + mascaraDeDocumento(d.dado.documento) }))}
                    vazio="Escrito à mão"
                    aoEscolher={(v) => {
                      const d = docs.find((x) => x.valor === v)
                      if (!d) return
                      cli({
                        documento: mascaraDeDocumento(d.dado.documento),
                        documentoDe: v,
                        ...(v !== 'principal' && d.dado.nome ? { nome: d.dado.nome } : v === 'principal' && cad.cliente ? { nome: cad.cliente.nome } : {}),
                      })
                    }}
                  />
                </Campo>
              ) : null}
              {contatos.length > 1 ? (
                <Campo rotulo="Qual contato">
                  <Seletor
                    bloco
                    campo
                    valor={c.cliente.contatoDe ?? ''}
                    opcoes={contatos.map((k) => ({ valor: k.valor, rotulo: k.rotulo }))}
                    vazio="Escrito à mão"
                    aoEscolher={(v) => {
                      const k = contatos.find((x) => x.valor === v)
                      if (!k) return
                      cli({ contato: k.dado.nome, telefone: k.dado.celular || k.dado.telefone, email: k.dado.email, contatoDe: v })
                    }}
                  />
                </Campo>
              ) : null}
              {enderecos.length > 1 ? (
                <Campo rotulo="Qual endereço de entrega">
                  <Seletor
                    bloco
                    campo
                    valor={c.cliente.enderecoDe ?? ''}
                    opcoes={enderecos.map((e) => ({ valor: e.valor, rotulo: e.rotulo }))}
                    vazio="Escrito à mão"
                    aoEscolher={(v) => {
                      const e = enderecos.find((x) => x.valor === v)
                      if (!e) return
                      cli({ endereco: enderecoEmLinha(e.dado), cidade: e.dado.cidade || c.cliente.cidade, uf: e.dado.uf || c.cliente.uf, enderecoDe: v })
                    }}
                  />
                </Campo>
              ) : null}
            </div>
          </div>
        ) : null}
        <Campo rotulo="CPF / CNPJ">
          <Entrada
            value={c.cliente.documento}
            inputMode="numeric"
            disabled={travado}
            onChange={(e) => cli({ documento: mascaraDeDocumento(e.target.value) })}
          />
        </Campo>
        <Campo rotulo="Contato">
          <Entrada
            value={c.cliente.contato}
            disabled={travado}
            placeholder="quem responde pelo pedido"
            onChange={(e) => cli({ contato: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Telefone">
          <Entrada value={c.cliente.telefone} disabled={travado} onChange={(e) => cli({ telefone: e.target.value })} />
        </Campo>
        <Campo rotulo="E-mail">
          <Entrada value={c.cliente.email} disabled={travado} onChange={(e) => cli({ email: e.target.value })} />
        </Campo>
        <Campo rotulo="Cidade">
          <Entrada value={c.cliente.cidade} disabled={travado} onChange={(e) => cli({ cidade: e.target.value })} />
        </Campo>
        <Campo rotulo="UF" className="ct-mc-uf">
          <Entrada
            value={c.cliente.uf}
            disabled={travado}
            maxLength={2}
            onChange={(e) => cli({ uf: e.target.value.toUpperCase() })}
          />
        </Campo>
        <Campo
          rotulo="Endereço de entrega"
          className="ct-mc-toda"
          dica={costume.length ? 'De costume: ' + costume.join('. ') : undefined}
        >
          <Entrada
            value={c.cliente.endereco ?? ''}
            disabled={travado}
            placeholder="Rua, número, bairro, cidade e CEP"
            onChange={(e) => cli({ endereco: e.target.value, enderecoDe: '' })}
          />
        </Campo>
      </div>
    </section>
  )
}

function BuscarEmClientes({ aoEscolher }: { aoEscolher: (c: Cliente) => void }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [todos, setTodos] = useState<Cliente[] | null>(null)
  const [falha, setFalha] = useState(false)
  const bt = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto || todos) return
    let vivo = true
    carregarClientes()
      .then((l) => vivo && setTodos(l))
      .catch(() => vivo && setFalha(true))
    return () => {
      vivo = false
    }
  }, [aberto, todos])

  const achados = useMemo(() => {
    const q = semAcento(busca.trim())
    const lista = todos ?? []
    const filtrada = q
      ? lista.filter((x) => semAcento([x.nome, x.fantasia, x.documento, x.cidade].join(' ')).includes(q))
      : lista
    return filtrada.slice(0, 30)
  }, [busca, todos])

  return (
    <>
      <button ref={bt} type="button" className="btn btn-contorno sm" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <MagnifyingGlass size={15} />
        Buscar em Clientes
      </button>
      <Flutuante aberto={aberto} ancora={bt} aoFechar={() => setAberto(false)} opcoes={{ alinhar: 'direita', largura: 360 }}>
        <div className="ct-busca-cli">
          <Busca
            autoFocus
            value={busca}
            placeholder="Nome, CNPJ ou cidade"
            aria-label="Buscar cliente"
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className="mn-lista ct-busca-lista">
            {falha ? (
              <p className="ct-busca-nada">Não consegui ler os clientes agora.</p>
            ) : !todos ? (
              <p className="ct-busca-nada">Lendo os clientes...</p>
            ) : !achados.length ? (
              <p className="ct-busca-nada">Nenhum cliente com esse nome.</p>
            ) : (
              achados.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className="mn-item"
                  onClick={() => {
                    aoEscolher(x)
                    setAberto(false)
                  }}
                >
                  <span className="nm">{x.nome}</span>
                  <span className="ct-busca-de">{[x.cidade, x.uf].filter(Boolean).join(' · ')}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </Flutuante>
    </>
  )
}

/* O VENDEDOR (11/10/2026): quem cria o orçamento já é o vendedor dele. Só quem
   tem CONTROLE TOTAL em Cotação (matriz de Acessos) troca para outra pessoa,
   escolhendo entre quem cria orçamento. Os outros veem o nome, e numa cotação
   ainda sem dono podem ficar com ela. */
function CampoDoVendedor({ c, mudar, travado }: Props) {
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null
  const escolhe = !!eu && pode(eu, 'cotacao', 'total') && !travado
  const [lista, setLista] = useState<Vendedor[]>([])
  useEffect(() => {
    if (!escolhe) return
    let vivo = true
    carregarVendedores()
      .then((l) => vivo && setLista(l))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [escolhe])

  if (escolhe) {
    const opcoes = lista.map((v) => ({ valor: v.id, rotulo: v.nome }))
    const atual = c.vendedorId || lista.find((v) => semAcento(v.nome).toLowerCase() === semAcento(c.vendedor).toLowerCase())?.id || ''
    if (!atual && c.vendedor) opcoes.push({ valor: '__nome', rotulo: c.vendedor + ' (sem conta)' })
    return (
      <Seletor
        bloco
        campo
        valor={atual || (c.vendedor ? '__nome' : '')}
        opcoes={opcoes}
        vazio="Escolher"
        aoEscolher={(id) => {
          const v = lista.find((x) => x.id === id)
          if (v) mudar({ vendedor: v.nome, vendedorId: v.id })
        }}
      />
    )
  }
  if (!c.vendedor && eu && !travado) {
    return (
      <Botao tom="contorno" onClick={() => mudar({ vendedor: eu.nome, vendedorId: eu.id })}>
        Ficar com este orçamento
      </Botao>
    )
  }
  return <Entrada value={c.vendedor || 'sem vendedor'} readOnly title="Só quem tem controle total em Cotação troca o vendedor" />
}

export function OQueFoiCombinado({ c, mudar, travado }: Props) {
  const inf = (parte: Partial<Cotacao['informe']>) => mudar({ informe: { ...c.informe, ...parte } })
  const listas = usarListasDoCabecalho()
  return (
    <section className="cartao ct-mc">
      <header className="ct-mc-cab">
        <TituloCartao icone={Handshake}>O que foi combinado</TituloCartao>
      </header>
      <div className="ct-mc-corpo ct-mc-2">
        <Campo rotulo="Vendedor">
          <CampoDoVendedor c={c} mudar={mudar} travado={travado} />
        </Campo>
        <Campo rotulo="Validade da proposta">
          <CampoDeData bloco valor={c.validaAte} aoMudar={(d) => mudar({ validaAte: d })} />
        </Campo>
        <Campo rotulo="Prazo de produção">
          <Entrada value={c.informe.prazo} disabled={travado} onChange={(e) => inf({ prazo: e.target.value })} />
        </Campo>
        <Campo rotulo="Pagamento">
          <Seletor bloco campo valor={c.informe.pagamento} opcoes={comOValorAtual(listas.pagamento, c.informe.pagamento)} vazio="Escolher" aoEscolher={(v) => inf({ pagamento: v })} />
        </Campo>
        {/* ENTREGA é o MODO. A data mora no cartão da fábrica, e os dois
            nunca mais podem se chamar "envio" ao mesmo tempo. */}
        <Campo rotulo="Entrega">
          <Seletor bloco campo valor={c.informe.entrega} opcoes={comOValorAtual(listas.entrega, c.informe.entrega)} vazio="Escolher" aoEscolher={(v) => inf({ entrega: v })} />
        </Campo>
        <Campo rotulo="Tabela de preço">
          <SeletorDaTabela c={c} aoMudar={inf} />
        </Campo>
        <Campo rotulo="Situação">
          <Seletor
            bloco
            campo
            valor={c.estado}
            opcoes={ESTADOS}
            vazio="Rascunho"
            aoEscolher={(v) => mudar({ estado: (v || 'rascunho') as EstadoDaCotacao })}
          />
        </Campo>
      </div>
    </section>
  )
}

export function OQueAFabricaPrecisaSaber({ c, mudar }: Props) {
  const [menuDeMarcas, setMenuDeMarcas] = useState(false)
  const btMarcas = useRef<HTMLButtonElement>(null)
  const prod = (parte: Partial<Cotacao['producao']>) => mudar({ producao: { ...c.producao, ...parte } })
  const faltando = MARCAS.filter((m) => !c.producao.marcas.includes(m))
  const listas = usarListasDoCabecalho()
  const deptos = listas.departamento.includes(c.producao.departamento) || !c.producao.departamento
    ? listas.departamento
    : [...listas.departamento, c.producao.departamento]

  return (
    <section className="cartao ct-mc">
      <header className="ct-mc-cab">
        <TituloCartao icone={Factory}>O que a fábrica precisa saber</TituloCartao>
      </header>
      <div className="ct-mc-corpo ct-mc-4">
        <Campo rotulo="Pedido nº">
          <Entrada
            value={c.producao.pedido}
            inputMode="numeric"
            placeholder="PD000000"
            onChange={(e) => prod({ pedido: e.target.value })}
            /* a formatação acontece ao SAIR do campo: formatar a cada tecla
               joga o cursor para o fim, e quem corrigia o meio perde o lugar */
            onBlur={(e) => prod({ pedido: formataPedido(e.target.value) })}
          />
        </Campo>
        <Campo rotulo="Data de envio">
          <CampoDeData bloco valor={c.producao.dataDeEnvio} aoMudar={(d) => prod({ dataDeEnvio: d })} />
        </Campo>
        <Campo rotulo="Departamento">
          <Seletor
            bloco
            campo
            valor={c.producao.departamento}
            opcoes={opcoesDeDepartamento(deptos)}
            vazio="Escolher"
            aoEscolher={(v) => prod({ departamento: v })}
          />
        </Campo>
        <Campo rotulo="Embalagem">
          <Seletor bloco campo valor={c.producao.embalagem} opcoes={comOValorAtual(listas.embalagem, c.producao.embalagem)} vazio="Escolher" aoEscolher={(v) => prod({ embalagem: v })} />
        </Campo>

        <Campo rotulo="Marcas do documento" className="ct-mc-meia">
          <div className="ct-marcas">
            {c.producao.marcas.map((m) => (
              <span key={m} className="ct-selo-marca" style={{ '--c': COR_DA_MARCA[m] ?? 'var(--text-3)' } as CSSProperties}>
                {m}
                <button
                  type="button"
                  aria-label={'Tirar a marca ' + m}
                  onClick={() => prod({ marcas: c.producao.marcas.filter((x) => x !== m) })}
                >
                  <X size={11} weight="bold" />
                </button>
              </span>
            ))}
            {faltando.length ? (
              <button
                ref={btMarcas}
                type="button"
                className="ct-mais-marca"
                title="Marcar o documento"
                aria-label="Marcar o documento"
                onClick={() => setMenuDeMarcas(true)}
              >
                <Plus size={13} />
              </button>
            ) : null}
          </div>
        </Campo>

        <Campo rotulo="Observação do pedido" className="ct-mc-meia">
          <Entrada
            value={c.producao.observacao}
            placeholder="o recado que vale para o pedido inteiro"
            onChange={(e) => prod({ observacao: e.target.value })}
          />
        </Campo>
      </div>

      <Flutuante aberto={menuDeMarcas} ancora={btMarcas} aoFechar={() => setMenuDeMarcas(false)} opcoes={{ alinhar: 'esquerda' }}>
        <div className="mn-lista">
          {faltando.map((m) => (
            <button
              key={m}
              type="button"
              className="mn-item"
              onClick={() => {
                prod({ marcas: [...c.producao.marcas, m] })
                setMenuDeMarcas(false)
              }}
            >
              <span className="nm">{m}</span>
            </button>
          ))}
        </div>
      </Flutuante>
    </section>
  )
}

/* A TABELA DE PRECO DA COTACAO. Com a 068 no banco, as tabelas ativas que
   esta pessoa pode escolher (a "so gerente" so para chefia), mais a que ja
   estava escolhida, mesmo arquivada depois; o nome vai junto do id, que e
   o que a folha e a lista mostram. Sem a 068, ou com ela e nenhuma tabela
   criada ainda, a lista de nomes de antes. */
function SeletorDaTabela({
  c,
  aoMudar,
}: {
  c: Cotacao
  aoMudar: (parte: Partial<Cotacao['informe']>) => void
}) {
  const { todas, escolhiveis, semBanco } = usarTabelasDaCotacao()
  if (semBanco || !todas.length) {
    return (
      <Seletor
        bloco
        campo
        valor={c.informe.tabelaDePreco}
        opcoes={TABELAS_DE_ANTES}
        vazio="Escolher"
        aoEscolher={(v) => aoMudar({ tabelaDePreco: v })}
      />
    )
  }
  const id = c.informe.tabelaDePrecoId ?? ''
  const opcoes = escolhiveis.map((t) => ({ valor: t.id, rotulo: t.nome + (t.padrao ? ' (padrão)' : '') }))
  const atual = todas.find((t) => t.id === id)
  if (atual && !opcoes.some((o) => o.valor === id)) opcoes.push({ valor: id, rotulo: atual.nome })
  return (
    <Seletor
      bloco
      campo
      valor={id}
      opcoes={opcoes}
      vazio="Sem tabela"
      aoEscolher={(v) => aoMudar({ tabelaDePrecoId: v, tabelaDePreco: todas.find((t) => t.id === v)?.nome ?? '' })}
    />
  )
}
