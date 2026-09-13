import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import { Campo, CampoDeData, Entrada, Flutuante, Seletor } from '@ds'
import {
  DEPARTAMENTOS,
  EMBALAGENS,
  ENTREGAS,
  PAGAMENTOS,
  VENDEDORES,
} from '@dominio/banco'
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
   O cabeçalho do pedido: o que era "Dados da cotação" e o cabeçalho da ficha,
   agora num lugar só.

   A decisão está em claude/DECISAO-COTACAO-E-FICHA-UM-PEDIDO.md. O orçamento
   se preenche uma vez, e a aprovação manda o mesmo registro para o acervo e
   para o kanban. Aqui estão TODOS os campos únicos dos dois lados, e nenhum
   foi cortado de propósito: cortar é a próxima decisão, e ela é do Henrique,
   olhando para a tela cheia.

   Os campos vêm em três famílias, e a ordem delas é a ordem em que a venda
   acontece: quem compra, o que foi combinado, e o que a fábrica precisa saber
   depois do sim. A família da fábrica fica por último porque, num orçamento
   que ainda está sendo montado, ela está vazia.

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

export function CabecalhoDoPedido({
  c,
  mudar,
  travado,
}: {
  c: Cotacao
  mudar: (parte: Partial<Cotacao>) => void
  travado?: boolean
}) {
  const [menuDeMarcas, setMenuDeMarcas] = useState(false)
  const btMarcas = useRef<HTMLButtonElement>(null)

  const mudarInforme = (parte: Partial<Cotacao['informe']>) =>
    mudar({ informe: { ...c.informe, ...parte } })
  const mudarProducao = (parte: Partial<Cotacao['producao']>) =>
    mudar({ producao: { ...c.producao, ...parte } })

  const faltando = MARCAS.filter((m) => !c.producao.marcas.includes(m))

  return (
    <section className="cartao ct-cartao">
      <header className="ct-cab">
        <h3>Dados do pedido</h3>
        <span>vai para o cabeçalho da página 1, e para a ficha da produção</span>
      </header>

      <div className="ct-grupos">
        {/* --- quem compra --- */}
        <div className="ct-grupo">
          <span className="ct-grupo-nome">Quem compra</span>
          <div className="ct-form">
            <Campo rotulo="Cliente" className="col-2">
              <Entrada
                value={c.cliente.nome}
                disabled={travado}
                placeholder="Nome como sai na proposta"
                onChange={(e) => mudar({ cliente: { ...c.cliente, nome: e.target.value } })}
              />
            </Campo>
            <Campo rotulo="CPF / CNPJ">
              <Entrada
                value={c.cliente.documento}
                inputMode="numeric"
                disabled={travado}
                onChange={(e) =>
                  mudar({ cliente: { ...c.cliente, documento: mascaraDeDocumento(e.target.value) } })
                }
              />
            </Campo>
            <Campo rotulo="Contato">
              <Entrada
                value={c.cliente.contato}
                disabled={travado}
                placeholder="quem responde pelo pedido"
                onChange={(e) => mudar({ cliente: { ...c.cliente, contato: e.target.value } })}
              />
            </Campo>
            <Campo rotulo="Telefone">
              <Entrada
                value={c.cliente.telefone}
                disabled={travado}
                onChange={(e) => mudar({ cliente: { ...c.cliente, telefone: e.target.value } })}
              />
            </Campo>
            <Campo rotulo="E-mail">
              <Entrada
                value={c.cliente.email}
                disabled={travado}
                onChange={(e) => mudar({ cliente: { ...c.cliente, email: e.target.value } })}
              />
            </Campo>
            <Campo rotulo="Cidade">
              <Entrada
                value={c.cliente.cidade}
                disabled={travado}
                onChange={(e) => mudar({ cliente: { ...c.cliente, cidade: e.target.value } })}
              />
            </Campo>
            <Campo rotulo="UF" className="estreito">
              <Entrada
                value={c.cliente.uf}
                disabled={travado}
                maxLength={2}
                onChange={(e) =>
                  mudar({ cliente: { ...c.cliente, uf: e.target.value.toUpperCase() } })
                }
              />
            </Campo>
          </div>
        </div>

        {/* --- o que foi combinado --- */}
        <div className="ct-grupo">
          <span className="ct-grupo-nome">O que foi combinado</span>
          <div className="ct-form">
            <Campo rotulo="Vendedor">
              <Seletor
                bloco
                campo
                valor={c.vendedor}
                opcoes={emOpcao(VENDEDORES)}
                vazio="Escolher"
                aoEscolher={(v) => mudar({ vendedor: v })}
              />
            </Campo>
            <Campo rotulo="Validade da proposta">
              <CampoDeData bloco valor={c.validaAte} aoMudar={(d) => mudar({ validaAte: d })} />
            </Campo>
            <Campo rotulo="Prazo de produção">
              <Entrada
                value={c.informe.prazo}
                disabled={travado}
                onChange={(e) => mudarInforme({ prazo: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Pagamento">
              <Seletor
                bloco
                campo
                valor={c.informe.pagamento}
                opcoes={emOpcao(PAGAMENTOS)}
                vazio="Escolher"
                aoEscolher={(v) => mudarInforme({ pagamento: v })}
              />
            </Campo>
            {/* ENTREGA é o MODO. A data mora no grupo da fábrica, e os dois
                nunca mais podem se chamar "envio" ao mesmo tempo. */}
            <Campo rotulo="Entrega">
              <Seletor
                bloco
                campo
                valor={c.informe.entrega}
                opcoes={emOpcao(ENTREGAS)}
                vazio="Escolher"
                aoEscolher={(v) => mudarInforme({ entrega: v })}
              />
            </Campo>
            <Campo rotulo="Tabela de preço">
              <Seletor
                bloco
                campo
                valor={c.informe.tabelaDePreco}
                opcoes={TABELAS}
                vazio="Escolher"
                aoEscolher={(v) => mudarInforme({ tabelaDePreco: v })}
              />
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
        </div>

        {/* --- o que a fábrica precisa saber --- */}
        <div className="ct-grupo">
          <span className="ct-grupo-nome">O que a fábrica precisa saber</span>
          <div className="ct-form">
            <Campo rotulo="Pedido nº">
              <Entrada
                value={c.producao.pedido}
                inputMode="numeric"
                placeholder="PD000000"
                onChange={(e) => mudarProducao({ pedido: e.target.value })}
                /* a formatação acontece ao SAIR do campo. Formatar a cada tecla
                   joga o cursor para o fim, e quem estava corrigindo o meio do
                   número perde o lugar */
                onBlur={(e) => mudarProducao({ pedido: formataPedido(e.target.value) })}
              />
            </Campo>
            <Campo rotulo="Data de envio">
              <CampoDeData
                bloco
                valor={c.producao.dataDeEnvio}
                aoMudar={(d) => mudarProducao({ dataDeEnvio: d })}
              />
            </Campo>
            <Campo rotulo="Departamento">
              <Seletor
                bloco
                campo
                valor={c.producao.departamento}
                opcoes={emOpcao(DEPARTAMENTOS)}
                vazio="Escolher"
                aoEscolher={(v) => mudarProducao({ departamento: v })}
              />
            </Campo>
            <Campo rotulo="Embalagem">
              <Seletor
                bloco
                campo
                valor={c.producao.embalagem}
                opcoes={emOpcao(EMBALAGENS)}
                vazio="Escolher"
                aoEscolher={(v) => mudarProducao({ embalagem: v })}
              />
            </Campo>

            <Campo rotulo="Marcas do documento" className="col-2">
              <div className="ct-marcas">
                {c.producao.marcas.map((m) => (
                  <span
                    key={m}
                    className="ct-selo-marca"
                    style={{ '--c': COR_DA_MARCA[m] ?? 'var(--text-3)' } as CSSProperties}
                  >
                    {m}
                    <button
                      type="button"
                      aria-label={'Tirar a marca ' + m}
                      onClick={() =>
                        mudarProducao({ marcas: c.producao.marcas.filter((x) => x !== m) })
                      }
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

            <Campo rotulo="Observação do pedido" className="col-2">
              <Entrada
                value={c.producao.observacao}
                placeholder="o recado que vale para o pedido inteiro"
                onChange={(e) => mudarProducao({ observacao: e.target.value })}
              />
            </Campo>
          </div>
        </div>
      </div>

      <Flutuante
        aberto={menuDeMarcas}
        ancora={btMarcas}
        aoFechar={() => setMenuDeMarcas(false)}
        opcoes={{ alinhar: 'esquerda' }}
      >
        <div className="mn-lista">
          {faltando.map((m) => (
            <button
              key={m}
              type="button"
              className="mn-item"
              onClick={() => {
                mudarProducao({ marcas: [...c.producao.marcas, m] })
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
