import {
  ArrowDown,
  ArrowUp,
  Check,
  Info,
  PaperPlaneTilt,
  Percent,
  Plus,
  X,
} from '@phosphor-icons/react'
import { AreaTexto, Botao, Seletor, TituloCartao } from '@ds'
import {
  GRUPOS_DO_INFORME,
  NOME_DO_GRUPO,
  subtotal,
  valorDoAjuste,
  type Ajuste,
  type Cotacao,
  type GrupoDoInforme,
  type InformeDoDocumento,
} from '@dominio/cotacao'
import './cotacao.css'

/* ==========================================================================
   O fechamento: o que vale para o documento inteiro, e não para um layout.

   Desde a decisão 161 mora na metade direita do modal "Dados do pedido e
   fechamento": Ajustes no valor e Informes e termos lado a lado, e O
   que já foi enviado embaixo. O editor mostra sempre os valores (decisão 154):
   esconder o R$ é escolha da folha A4, e não da tela.
   ========================================================================== */

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Props = { c: Cotacao; mudar: (parte: Partial<Cotacao>) => void; travado?: boolean }

export function AjustesNoValor({ c, mudar, travado }: Props) {
  const base = subtotal(c)
  return (
    <section className="cartao ct-mc">
      <header className="ct-mc-cab">
        <TituloCartao icone={Percent}>Ajustes no valor</TituloCartao>
        <span className="ct-mc-apoio">do documento, não de um layout</span>
      </header>
      <div className="ct-mc-corpo ct-mc-pilha">
        {c.ajustes.length ? (
          <div className="ct-ajustes">
            {c.ajustes.map(a => (
              <LinhaDeAjuste
                key={a.id}
                ajuste={a}
                travado={travado}
                base={base}
                aoMudar={novo => mudar({ ajustes: c.ajustes.map(x => (x.id === a.id ? novo : x)) })}
                aoRemover={() => mudar({ ajustes: c.ajustes.filter(x => x.id !== a.id) })}
              />
            ))}
          </div>
        ) : (
          <p className="ct-nada">Nenhum desconto nem acréscimo. O total é a soma dos layouts.</p>
        )}
        {!travado ? (
          <Botao
            tom="limpo"
            tamanho="sm"
            onClick={() =>
              mudar({
                ajustes: [
                  ...c.ajustes,
                  {
                    id: 'AJ' + Math.random().toString(36).slice(2, 7),
                    descricao: '',
                    tipo: 'porcento',
                    valor: 0,
                  },
                ],
              })
            }
          >
            <Plus size={15} />
            Adicionar ajuste
          </Botao>
        ) : null}
        <p className="ct-nada">
          Ajuste em por cento vale sempre sobre o subtotal, nunca sobre o total já ajustado. Dois
          descontos de 10 por cento tiram 20, e não 19.
        </p>
      </div>
    </section>
  )
}

/* OS INFORMES EM DOIS GRUPOS, do jeito que a folha monta (11/10/2026):
   "Sobre a produção" e "Termos", um embaixo do outro, cada um com o seu
   Adicionar na linha do nome (embaixo da lista, o modal passava da tela). A seta passa o informe para o outro grupo sem reescrever. O
   apoio de cada grupo diz onde ele sai: termo de venda não vai na folha da
   produção. */
export function InformesDaProducao({ c, mudar }: Props) {
  const mudarInforme = (id: string, troca: (x: InformeDoDocumento) => InformeDoDocumento) =>
    mudar({ informes: c.informes.map(x => (x.id === id ? troca(x) : x)) })
  const outro = (g: GrupoDoInforme): GrupoDoInforme => (g === 'producao' ? 'termos' : 'producao')
  return (
    <section className="cartao ct-mc">
      <header className="ct-mc-cab">
        <TituloCartao icone={Info}>Informes e termos</TituloCartao>
        <span className="ct-mc-apoio">desmarcar tira da folha</span>
      </header>
      <div className="ct-mc-corpo ct-informes">
        {GRUPOS_DO_INFORME.map(g => {
          const lista = c.informes.filter(x => x.grupo === g)
          const naFolha = lista.filter(x => x.noDocumento && x.texto.trim()).length
          return (
            <div className="ct-if-grupo" key={g} data-grupo={g}>
              <div className="ct-if-cab">
                <span>
                  <b>{NOME_DO_GRUPO[g]}</b>
                  <small>
                    {naFolha} na folha ·{' '}
                    {g === 'producao'
                      ? 'coluna da esquerda, sai nas duas folhas'
                      : 'coluna da direita, só na folha com valor'}
                  </small>
                </span>
                <Botao
                  tom="limpo"
                  tamanho="sm"
                  onClick={() =>
                    mudar({
                      informes: [
                        ...c.informes,
                        {
                          id: 'IF' + Math.random().toString(36).slice(2, 7),
                          texto: '',
                          noDocumento: true,
                          grupo: g,
                        },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  {g === 'producao' ? 'Adicionar informe' : 'Adicionar termo'}
                </Botao>
              </div>
              {lista.length ? null : <p className="ct-nada">Nenhum informe neste grupo.</p>}
              {lista.map(x => (
                <div className={x.noDocumento ? 'ct-informe' : 'ct-informe fora'} key={x.id}>
                  <button
                    type="button"
                    className="ct-marca"
                    role="switch"
                    aria-checked={x.noDocumento}
                    aria-label={x.noDocumento ? 'Tirar da folha' : 'Pôr na folha'}
                    title={
                      x.noDocumento
                        ? 'Sai na folha. Clique para tirar.'
                        : 'Fora da folha. Clique para pôr.'
                    }
                    onClick={() => mudarInforme(x.id, i => ({ ...i, noDocumento: !i.noDocumento }))}
                  >
                    {x.noDocumento ? <Check size={13} weight="bold" /> : null}
                  </button>
                  <AreaTexto
                    rows={2}
                    value={x.texto}
                    aria-label={'Texto do informe, ' + NOME_DO_GRUPO[g]}
                    onChange={e => mudarInforme(x.id, i => ({ ...i, texto: e.target.value }))}
                  />
                  <span className="ct-if-acoes">
                    <button
                      type="button"
                      className="ct-tira"
                      aria-label={'Passar para ' + NOME_DO_GRUPO[outro(g)]}
                      title={'Passar para ' + NOME_DO_GRUPO[outro(g)]}
                      onClick={() => mudarInforme(x.id, i => ({ ...i, grupo: outro(g) }))}
                    >
                      {g === 'producao' ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
                    </button>
                    <button
                      type="button"
                      className="ct-tira"
                      aria-label="Apagar o informe"
                      title="Apagar o informe"
                      onClick={() => mudar({ informes: c.informes.filter(i => i.id !== x.id) })}
                    >
                      <X size={15} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function OQueJaFoiEnviado({ c }: { c: Cotacao }) {
  return (
    <section className="cartao ct-mc">
      <header className="ct-mc-cab">
        <TituloCartao icone={PaperPlaneTilt}>O que já foi enviado</TituloCartao>
        <span className="ct-mc-apoio">o valor de cada envio fica como saiu</span>
      </header>
      <div className="ct-mc-corpo">
        {c.enviadas.length ? (
          <div className="ct-envios">
            {c.enviadas.map(e => (
              <div
                key={e.numero}
                className={c.aprovacao?.versao === e.numero ? 'ct-envio valeu' : 'ct-envio'}
              >
                <b>Envio {e.numero}</b>
                <span>{new Date(e.data).toLocaleString('pt-BR')}</span>
                <span>{e.pecas ? e.pecas + ' peças' : 'peças não gravadas'}</span>
                <span className="ct-envio-total">{dinheiro(e.total)}</span>
                {c.aprovacao?.versao === e.numero ? (
                  <span className="ct-envio-selo">aprovado</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="ct-nada">
            Ainda não saiu nenhum envio. Enviar ao cliente grava aqui o total que ele recebeu.
          </p>
        )}
      </div>
    </section>
  )
}

/* --- uma linha de ajuste ------------------------------------------------- */
function LinhaDeAjuste({
  ajuste,
  base,
  travado,
  aoMudar,
  aoRemover,
}: {
  ajuste: Ajuste
  base: number
  travado?: boolean
  aoMudar: (a: Ajuste) => void
  aoRemover: () => void
}) {
  const soma = ajuste.valor >= 0
  const conta = dinheiro(valorDoAjuste(ajuste, base))

  if (travado) {
    return (
      <div className="ct-ajuste travado">
        <span className="ct-sinal parado">{soma ? '+' : '−'}</span>
        <span>
          {Math.abs(ajuste.valor)}
          {ajuste.tipo === 'porcento' ? '%' : ' reais'}
        </span>
        <span className="ct-ajuste-motivo-lido">{ajuste.descricao || 'sem motivo escrito'}</span>
        <span className="ct-ajuste-conta">{conta}</span>
      </div>
    )
  }

  return (
    <div className="ct-ajuste">
      <button
        type="button"
        className="ct-sinal"
        onClick={() => aoMudar({ ...ajuste, valor: -ajuste.valor })}
        aria-label={soma ? 'Virar desconto' : 'Virar acréscimo'}
        title={
          soma ? 'Acréscimo. Clique para virar desconto.' : 'Desconto. Clique para virar acréscimo.'
        }
      >
        {soma ? '+' : '−'}
      </button>
      <input
        className="ct-ajuste-valor"
        inputMode="decimal"
        value={Math.abs(ajuste.valor) || ''}
        placeholder="0"
        onChange={e => {
          const n = Math.abs(Number(e.target.value.replace(',', '.')) || 0)
          aoMudar({ ...ajuste, valor: soma ? n : -n })
        }}
        aria-label="Valor do ajuste"
      />
      <Seletor
        tamanho="sm"
        valor={ajuste.tipo}
        opcoes={[
          { valor: 'porcento', rotulo: '%' },
          { valor: 'reais', rotulo: 'R$' },
        ]}
        vazio="%"
        aoEscolher={v => aoMudar({ ...ajuste, tipo: (v || 'porcento') as Ajuste['tipo'] })}
      />
      <input
        className="ct-ajuste-motivo"
        value={ajuste.descricao}
        placeholder="Motivo do ajuste"
        onChange={e => aoMudar({ ...ajuste, descricao: e.target.value })}
        aria-label="Motivo do ajuste"
      />
      <span className="ct-ajuste-conta">{conta}</span>
      <button
        type="button"
        className="ct-bt-icone risco"
        onClick={aoRemover}
        title="Remover ajuste"
      >
        <X size={16} />
      </button>
    </div>
  )
}
