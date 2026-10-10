import { useState } from 'react'
import type { ReactNode } from 'react'
import { CaretDown, ListBullets, NotePencil, Package, Plus, Warning } from '@phosphor-icons/react'
import { AreaDeTextoRico, LINHA_ESCOLHIDA, TituloCartao, type IconeDoPacote } from '@ds'
import { etiquetaDoDesign, totalDaGrade, type Bloco } from '@dominio/layout'
import { pecasDoProduto, totalDoProduto, type ProdutoCotado } from '@dominio/cotacao'
import './cotacao.css'

/* ==========================================================================
   A COLUNA DOS LAYOUTS, na extrema direita do editor (decisões 162 e 163).

   Em cima, o cartão Layouts: a lista original, com a miniatura da arte, o
   código e o nome, as peças e o valor, e o aviso do que falta. A caixa da
   lista tem SEMPRE a altura de cinco linhas: com um layout ou com quinze; de
   seis em diante ela rola por dentro e o resto da coluna não se mexe. No pé,
   o Adicionar layout.

   Embaixo, duas sanfonas fechadas: as Observações do layout escolhido (com um
   ponto quando há texto) e os Materiais reservados. Abrir uma fecha a outra,
   para a coluna não crescer além da primeira tela.
   ========================================================================== */

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** O que falta preencher num layout para ele ir à produção. */
export function faltaNoLayout(b: Bloco): string[] {
  if (b.informacoes) return []
  return [
    !etiquetaDoDesign(b.design).tipo && 'falta a etiqueta',
    !b.tecidos.some((t) => t.nome.trim()) && 'falta o tecido',
    !totalDaGrade(b.grade) && 'falta a grade',
  ].filter((x): x is string => !!x)
}

const codigoDoLayout = (n: number) => 'L-' + String(n).padStart(2, '0')

/* o texto rico vazio do editor deixa marcação sem letra ("<br>"): isso não é observação */
const temTexto = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== ''

export function ColunaDosLayouts({
  produtos,
  escolhido,
  travado,
  podeColar,
  aoEscolher,
  aoAdicionar,
  aoColar,
  aoMudarObservacao,
}: {
  produtos: ProdutoCotado[]
  escolhido: number
  travado: boolean
  podeColar: boolean
  aoEscolher: (i: number) => void
  aoAdicionar: () => void
  aoColar: () => void
  aoMudarObservacao: (html: string) => void
}) {
  const [aberta, setAberta] = useState<'' | 'obs' | 'mat'>('')
  const pecas = produtos.reduce((s, p) => s + pecasDoProduto(p), 0)
  const comFalta = produtos.filter((p) => faltaNoLayout(p.bloco).length).length
  const atual = produtos[escolhido]?.bloco

  return (
    <div className="ct-col">
      <section className="cartao ct-lys">
        <header className="ct-lys-cab">
          <TituloCartao icone={ListBullets}>Layouts</TituloCartao>
          <span className="ct-lys-conta">
            {produtos.length} {produtos.length === 1 ? 'layout' : 'layouts'} · {pecas} peças
          </span>
        </header>
        {comFalta ? (
          <p className="ct-lys-aviso">
            <Warning size={15} weight="fill" />
            {comFalta} com algo por preencher
          </p>
        ) : null}
        <div className="ct-lys-lista" role="listbox" aria-label="Layouts da cotação">
          {produtos.map((p, i) => {
            const falta = faltaNoLayout(p.bloco)
            const sel = i === escolhido
            return (
              <button
                key={p.bloco.id}
                type="button"
                role="option"
                aria-selected={sel}
                className={sel ? 'ct-ly-linha ct-ly-sel ' + LINHA_ESCOLHIDA : 'ct-ly-linha'}
                onClick={() => aoEscolher(i)}
              >
                <span className="ct-ly-mini">{p.bloco.imagem ? <img src={p.bloco.imagem} alt="" /> : null}</span>
                <span className="ct-ly-txt">
                  <b>
                    {codigoDoLayout(p.bloco.n)} · {p.bloco.nomeDaReferencia || p.bloco.referencia || 'sem referência'}
                  </b>
                  <small>
                    {pecasDoProduto(p)} pçs · {dinheiro(totalDoProduto(p))}
                  </small>
                  {falta.length ? <small className="ct-ly-falta">{falta.join(', ')}</small> : null}
                </span>
                {falta.length ? (
                  <span className="ct-ly-placa" title={falta.join(', ')}>
                    <Warning size={14} weight="fill" />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        {!travado ? (
          <div className="ct-lys-pe">
            <button type="button" className="ct-lys-mais" onClick={aoAdicionar}>
              <Plus size={16} />
              Adicionar layout
            </button>
            {podeColar ? (
              <button type="button" className="ct-lys-colar" onClick={aoColar}>
                Colar layout copiado
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <Sanfona
        icone={NotePencil}
        titulo="Observações do layout"
        ponto={!!atual && temTexto(atual.observacao)}
        aberta={aberta === 'obs'}
        aoAlternar={() => setAberta((a) => (a === 'obs' ? '' : 'obs'))}
      >
        {atual ? (
          <AreaDeTextoRico
            valor={atual.observacao}
            aoMudar={aoMudarObservacao}
            convite={'Observações do ' + codigoDoLayout(atual.n) + '...'}
            leitura={travado}
          />
        ) : null}
      </Sanfona>

      <Sanfona
        icone={Package}
        titulo="Materiais reservados para este orçamento"
        aberta={aberta === 'mat'}
        aoAlternar={() => setAberta((a) => (a === 'mat' ? '' : 'mat'))}
      >
        {/* decisão 132: o material NÃO sai do estoque na cotação, ele só fica
            marcado como negociado; sai depois de aprovado para a produção */}
        <p className="ct-sf-texto">
          O tecido e os aviamentos destes layouts ficam reservados no Estoque enquanto a cotação está aberta: eles não
          saem da prateleira, só ficam marcados como negociados. Saem de verdade depois de aprovados para a produção.
        </p>
      </Sanfona>
    </div>
  )
}

function Sanfona({
  icone,
  titulo,
  ponto,
  aberta,
  aoAlternar,
  children,
}: {
  icone: IconeDoPacote
  titulo: string
  ponto?: boolean
  aberta: boolean
  aoAlternar: () => void
  children: ReactNode
}) {
  return (
    <section className={aberta ? 'cartao ct-sf ct-sf-aberta' : 'cartao ct-sf'}>
      {/* o cabeçalho inteiro é o alvo: o botão cobre a faixa por baixo do
          título, e o título continua sendo o título do cartão */}
      <header className="ct-sf-cab">
        <button type="button" className="ct-sf-alvo" aria-expanded={aberta} aria-label={titulo} onClick={aoAlternar} />
        <TituloCartao icone={icone}>{titulo}</TituloCartao>
        {ponto ? <span className="ct-sf-ponto" title="Tem observação escrita" /> : null}
        <span className="ct-sf-seta" aria-hidden="true">
          <CaretDown size={16} />
        </span>
      </header>
      {aberta ? <div className="ct-sf-corpo">{children}</div> : null}
    </section>
  )
}
