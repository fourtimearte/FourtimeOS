import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Factory, Handshake, MagnifyingGlass, Plus, UserCircle, X } from '@phosphor-icons/react'
import { Busca, Campo, CampoDeData, Entrada, Flutuante, Seletor, TituloCartao, semAcento } from '@ds'
import {
  opcoesDeDepartamento,
  DEPARTAMENTOS,
  EMBALAGENS,
  ENTREGAS,
  PAGAMENTOS,
  VENDEDORES,
} from '@dominio/banco'
import { carregarClientes, type Cliente } from '@dominio/cliente'
import {
  COR_DA_MARCA,
  MARCAS,
  NOME_DO_ESTADO_DA_COTACAO,
  formataPedido,
  mascaraDeDocumento,
  type Cotacao,
  type EstadoDaCotacao,
} from '@dominio/cotacao'
import './cotacao.css'

/* ==========================================================================
   Os dados do pedido, em três cartões.

   Desde a decisão 161 eles moram no modal "Dados do pedido e fechamento", e
   não mais na página: a metade esquerda do modal tem Quem compra e O que foi
   combinado lado a lado, e O que a fábrica precisa saber embaixo, na largura
   toda. A ordem é a ordem em que a venda acontece.

   UMA ARMADILHA QUE VALE DIZER EM VOZ ALTA: "envio" queria dizer duas coisas
   diferentes nos dois sistemas. Na cotação era o MODO (CORREIOS), na ficha era
   a DATA. Aqui o modo se chama Entrega e a data se chama Data de envio.
   ========================================================================== */

const emOpcao = (lista: string[]) => lista.map((x) => ({ valor: x, rotulo: x }))

const TABELAS = [
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

export function QuemCompra({ c, mudar, travado }: Props) {
  const cli = (parte: Partial<Cotacao['cliente']>) => mudar({ cliente: { ...c.cliente, ...parte } })
  return (
    <section className="cartao ct-mc">
      <header className="ct-mc-cab">
        <TituloCartao icone={UserCircle}>Quem compra</TituloCartao>
        {!travado ? <BuscarEmClientes aoEscolher={(x) => cli(doCadastro(x))} /> : null}
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
      </div>
    </section>
  )
}

/* O CADASTRO MANDA NOS CAMPOS, MAS NÃO PRENDE. Escolher um cliente de Clientes
   preenche os campos e guarda o id (é o que liga a cotação à carteira); quem
   quiser outro nome na proposta corrige depois, que o cadastro não muda. */
function doCadastro(x: Cliente): Partial<Cotacao['cliente']> {
  return {
    id: x.id,
    nome: x.nome,
    documento: mascaraDeDocumento(x.documento),
    contato: x.contato,
    telefone: x.celular || x.telefone,
    email: x.email,
    cidade: x.cidade,
    uf: x.uf,
  }
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

export function OQueFoiCombinado({ c, mudar, travado }: Props) {
  const inf = (parte: Partial<Cotacao['informe']>) => mudar({ informe: { ...c.informe, ...parte } })
  return (
    <section className="cartao ct-mc">
      <header className="ct-mc-cab">
        <TituloCartao icone={Handshake}>O que foi combinado</TituloCartao>
      </header>
      <div className="ct-mc-corpo ct-mc-2">
        <Campo rotulo="Vendedor">
          <Seletor bloco campo valor={c.vendedor} opcoes={emOpcao(VENDEDORES)} vazio="Escolher" aoEscolher={(v) => mudar({ vendedor: v })} />
        </Campo>
        <Campo rotulo="Validade da proposta">
          <CampoDeData bloco valor={c.validaAte} aoMudar={(d) => mudar({ validaAte: d })} />
        </Campo>
        <Campo rotulo="Prazo de produção">
          <Entrada value={c.informe.prazo} disabled={travado} onChange={(e) => inf({ prazo: e.target.value })} />
        </Campo>
        <Campo rotulo="Pagamento">
          <Seletor bloco campo valor={c.informe.pagamento} opcoes={emOpcao(PAGAMENTOS)} vazio="Escolher" aoEscolher={(v) => inf({ pagamento: v })} />
        </Campo>
        {/* ENTREGA é o MODO. A data mora no cartão da fábrica, e os dois
            nunca mais podem se chamar "envio" ao mesmo tempo. */}
        <Campo rotulo="Entrega">
          <Seletor bloco campo valor={c.informe.entrega} opcoes={emOpcao(ENTREGAS)} vazio="Escolher" aoEscolher={(v) => inf({ entrega: v })} />
        </Campo>
        <Campo rotulo="Tabela de preço">
          <Seletor bloco campo valor={c.informe.tabelaDePreco} opcoes={TABELAS} vazio="Escolher" aoEscolher={(v) => inf({ tabelaDePreco: v })} />
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
            opcoes={opcoesDeDepartamento(DEPARTAMENTOS)}
            vazio="Escolher"
            aoEscolher={(v) => prod({ departamento: v })}
          />
        </Campo>
        <Campo rotulo="Embalagem">
          <Seletor bloco campo valor={c.producao.embalagem} opcoes={emOpcao(EMBALAGENS)} vazio="Escolher" aoEscolher={(v) => prod({ embalagem: v })} />
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
