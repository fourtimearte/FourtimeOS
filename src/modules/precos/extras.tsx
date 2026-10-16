import { useState } from 'react'
import { ListBullets, Plus, Trash, X } from '@phosphor-icons/react'
import { Botao, CampoDeCelula, Entrada, PilulaTecnica, Selo, usarEdicaoDeCelulas } from '@ds'
import { novoId, type Extra, type OpcaoDeExtra, type TabelaDePreco } from '@dominio/preco'

/* ==========================================================================
   A ABA EXTRAS (083, tela 3 do wireframe de 16/10/2026): um mini editor por
   extra. Cada extra é uma lista de opções, cada opção com o seu preço. O
   Patch (Liso, Relevo, 3D) e o Bordado (P, M, G) existem sempre; o extra
   novo aparece na cotação ao lado deles.

   O preço é a célula do Kit (seção 3): Enter grava e desce para a opção de
   baixo. Apagar um extra novo pergunta na própria página (seção 7).
   ========================================================================== */

const NA_COTACAO: Record<string, string> = {
  patch: 'Na cotação: escolhe o tipo e quantos patches vão em cada peça.',
  bordado: 'Na cotação: escolhe o tamanho e quantos bordados vão em cada peça.',
  '': 'Na cotação: escolhe a opção e quantos vão em cada peça.',
}
const NOME_DA_OPCAO: Record<string, [string, string]> = {
  patch: ['Tipo', 'Outro tipo'],
  bordado: ['Tamanho', 'Outro tamanho'],
  '': ['Opção', 'Outra opção'],
}

export function AbaExtras({
  tabela,
  podeMexer,
  mudar,
}: {
  tabela: TabelaDePreco
  podeMexer: boolean
  mudar: (f: (x: TabelaDePreco) => TabelaDePreco) => void
}) {
  const [apagando, setApagando] = useState('')
  const extras = tabela.adicionais.extras
  const mudarExtras = (f: (es: Extra[]) => Extra[]) => mudar((x) => ({ ...x, adicionais: { ...x.adicionais, extras: f(x.adicionais.extras) } }))
  const mudarExtra = (id: string, f: (e: Extra) => Extra) => mudarExtras((es) => es.map((e) => (e.id === id ? f(e) : e)))

  function novoExtra() {
    const id = novoId('extra-', extras.map((e) => e.id))
    mudarExtras((es) => [...es, { id, nome: 'Novo extra', tecnica: '', opcoes: [{ id: 'op1', nome: '', medida: '', valor: null }] }])
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-extra="${id}"] .pr-ex-nome`)?.select(), 60)
  }

  return (
    <>
      <div className="pr-ex-grade">
        {extras.map((e) => (
          <CartaoDoExtra
            key={e.id}
            extra={e}
            podeMexer={podeMexer}
            apagando={apagando === e.id}
            aoMudar={(f) => mudarExtra(e.id, f)}
            aoPedirApagar={() => setApagando(e.id)}
            aoDesistir={() => setApagando('')}
            aoApagar={() => {
              mudarExtras((es) => es.filter((x) => x.id !== e.id))
              setApagando('')
            }}
          />
        ))}
        {podeMexer ? (
          <button type="button" className="pr-ex-novo" onClick={novoExtra}>
            <Plus size={20} />
            <b>Novo extra</b>
            <span>Um nome e as opções, cada uma com o preço. Ele aparece na cotação ao lado do Patch e do Bordado.</span>
          </button>
        ) : null}
      </div>
      <p className="pr-pe">O preço é de cada um: na cotação ele multiplica pela quantidade escolhida no layout.</p>
    </>
  )
}

function CartaoDoExtra({
  extra,
  podeMexer,
  apagando,
  aoMudar,
  aoPedirApagar,
  aoDesistir,
  aoApagar,
}: {
  extra: Extra
  podeMexer: boolean
  apagando: boolean
  aoMudar: (f: (e: Extra) => Extra) => void
  aoPedirApagar: () => void
  aoDesistir: () => void
  aoApagar: () => void
}) {
  const ordem = extra.opcoes.map((o) => o.id)
  const [rotuloDaOpcao, rotuloDoMais] = NOME_DA_OPCAO[extra.tecnica]
  const comMedida = extra.tecnica !== 'patch'
  const mudarOpcao = (id: string, parcial: Partial<OpcaoDeExtra>) =>
    aoMudar((e) => ({ ...e, opcoes: e.opcoes.map((o) => (o.id === id ? { ...o, ...parcial } : o)) }))
  const edicao = usarEdicaoDeCelulas({
    ordem,
    colunas: 1,
    valorDe: (id) => extra.opcoes.find((o) => o.id === id)?.valor ?? null,
    aoEscrever: (id, _c, v) => mudarOpcao(id, { valor: v }),
    aoColar: () => {},
  })
  const semPreco = extra.opcoes.filter((o) => o.valor == null).length

  return (
    <section className="cartao pr-ex" data-extra={extra.id} aria-label={extra.nome}>
      <div className="pr-ex-cab">
        {extra.tecnica ? (
          <PilulaTecnica tecnica={extra.tecnica} tamanho="sm">
            {extra.nome.toUpperCase()}
          </PilulaTecnica>
        ) : null}
        {!extra.tecnica && podeMexer ? (
          <Entrada
            className="pr-ex-nome"
            aria-label="Nome do extra"
            value={extra.nome}
            onChange={(e) => aoMudar((x) => ({ ...x, nome: e.target.value }))}
          />
        ) : (
          <b>{extra.nome}</b>
        )}
        <small>
          {extra.opcoes.length} {extra.opcoes.length === 1 ? 'opção' : 'opções'}
        </small>
        {semPreco ? <Selo tom="warn">{semPreco} sem preço</Selo> : null}
        {!extra.tecnica && podeMexer && !apagando ? (
          <Botao tom="limpo" tamanho="sm" icone className="pr-ex-fim" aria-label={'Apagar o extra ' + extra.nome} onClick={aoPedirApagar}>
            <Trash size={16} />
          </Botao>
        ) : null}
      </div>
      {apagando ? (
        <div className="pr-ex-pergunta" role="alert">
          <span>
            Apagar o extra <b>{extra.nome}</b>? A cotação que já usa ele perde esta parte da conta.
          </span>
          <span className="fileira">
            <Botao tom="contorno" tamanho="sm" onClick={aoDesistir}>
              Manter
            </Botao>
            <Botao tom="perigo" tamanho="sm" onClick={aoApagar}>
              Apagar
            </Botao>
          </span>
        </div>
      ) : null}
      <p className="pr-ex-nota">
        <ListBullets size={16} />
        {NA_COTACAO[extra.tecnica]}
      </p>
      <div className={'pr-ex-op pr-ex-op-cab' + (comMedida ? '' : ' sem-medida')}>
        <span>{rotuloDaOpcao}</span>
        {comMedida ? <span>Medida</span> : null}
        <span className="pr-ex-dir">Preço de cada</span>
        <span />
      </div>
      {extra.opcoes.map((o) => (
        <div key={o.id} className={'pr-ex-op' + (comMedida ? '' : ' sem-medida')}>
          <Entrada
            tamanho="sm"
            aria-label={rotuloDaOpcao + ' de ' + extra.nome}
            placeholder={rotuloDaOpcao}
            value={o.nome}
            disabled={!podeMexer}
            onChange={(e) => mudarOpcao(o.id, { nome: e.target.value })}
          />
          {comMedida ? (
            <Entrada
              tamanho="sm"
              aria-label={'Medida de ' + (o.nome || 'opção')}
              placeholder="6 x 6 cm"
              value={o.medida}
              disabled={!podeMexer}
              onChange={(e) => mudarOpcao(o.id, { medida: e.target.value })}
            />
          ) : null}
          <CampoDeCelula
            id={o.id}
            coluna={0}
            valor={o.valor}
            estado={o.valor == null ? 'vazio' : 'base'}
            texto={o.valor == null ? 'sem preço' : undefined}
            rotulo={extra.nome + ' ' + (o.nome || 'opção') + ', preço de cada'}
            podeMexer={podeMexer}
            edicao={edicao}
          />
          {podeMexer && extra.opcoes.length > 1 ? (
            <Botao
              tom="limpo"
              tamanho="sm"
              icone
              aria-label={'Tirar ' + (o.nome || 'a opção')}
              onClick={() => aoMudar((e) => ({ ...e, opcoes: e.opcoes.filter((x) => x.id !== o.id) }))}
            >
              <X size={15} />
            </Botao>
          ) : (
            <span />
          )}
        </div>
      ))}
      {podeMexer ? (
        <div className="pr-ex-pe">
          <Botao
            tom="contorno"
            tamanho="sm"
            onClick={() => aoMudar((e) => ({ ...e, opcoes: [...e.opcoes, { id: novoId('op', e.opcoes.map((x) => x.id)), nome: '', medida: '', valor: null }] }))}
          >
            <Plus size={15} />
            {rotuloDoMais}
          </Botao>
        </div>
      ) : null}
    </section>
  )
}
