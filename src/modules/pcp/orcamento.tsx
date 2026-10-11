import type { CSSProperties } from 'react'
import { FileText, TShirt } from '@phosphor-icons/react'
import { Esqueleto, PilulaTecnica, Selo, TituloCartao } from '@ds'
import { COR_DA_MARCA, totalDoProduto, type Cotacao, type ProdutoCotado } from '@dominio/cotacao'
import { tamanhosNaOrdem, totalDaGrade } from '@dominio/layout'
import { dataCurta } from './fila'

/* ==========================================================================
   O ORÇAMENTO NO PCP (pranchas 88 e 89, parte P2).

   Quem confere lê o pedido como o cliente aprovou: um cartão com os dados do
   pedido (vendedor e quando o cliente aprovou, pagamento, envio, embalagem,
   observação e as marcas, como URGENTE) e um cartão por layout com a arte, o
   tecido, o design, a grade e a observação, agora COM O VALOR, que na
   Separação não aparece.

   É SÓ LEITURA. A grade aprovada não destrava (decisão de 11/10/2026): o que
   estiver errado volta ao vendedor pelo "Devolver ao vendedor".
   ========================================================================== */

function dinheiro(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const semTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function CartaoDoOrcamento({
  c,
  vendedor,
}: {
  c: Cotacao | null | undefined
  vendedor: string
}) {
  if (c === undefined) {
    return (
      <section className="cartao pc-orc" aria-label="O orçamento">
        <div className="pc-espera">
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </div>
      </section>
    )
  }
  if (c === null) {
    return (
      <section className="cartao pc-orc" aria-label="O orçamento">
        <header className="pc-cab">
          <TituloCartao icone={FileText}>O orçamento</TituloCartao>
        </header>
        <p className="pc-nada">Não achei a cotação deste pedido.</p>
      </section>
    )
  }
  const aprovadoEm = c.aprovacao?.em ?? ''
  const obs = semTags(c.producao.observacao || '')
  return (
    <section className="cartao pc-orc" aria-label="O orçamento">
      <header className="pc-cab">
        <TituloCartao icone={FileText}>O orçamento</TituloCartao>
        <span className="pc-cab-apoio fileira miuda fim">
          {(c.producao.marcas ?? []).map(m => (
            <Selo key={m} tom={COR_DA_MARCA[m] === 'var(--brand)' ? 'brand' : 'warn'}>
              {m}
            </Selo>
          ))}
        </span>
      </header>
      <dl className="pc-orc-dados">
        <dt>Vendedor</dt>
        <dd>
          <b>{c.vendedor || vendedor || 'sem vendedor'}</b>
          {aprovadoEm ? <small> aprovado pelo cliente em {dataCurta(aprovadoEm)}</small> : null}
        </dd>
        <dt>Pagamento</dt>
        <dd>{c.informe.pagamento || '-'}</dd>
        <dt>Envio</dt>
        <dd>
          {c.informe.entrega || '-'}
          {c.producao.dataDeEnvio ? (
            <small> sai em {dataCurta(c.producao.dataDeEnvio)}</small>
          ) : null}
        </dd>
        <dt>Embalagem</dt>
        <dd>{c.producao.embalagem || '-'}</dd>
        {c.producao.departamento ? (
          <>
            <dt>Departamento</dt>
            <dd>{c.producao.departamento}</dd>
          </>
        ) : null}
        {obs ? (
          <>
            <dt>Observação</dt>
            <dd>{obs}</dd>
          </>
        ) : null}
      </dl>
    </section>
  )
}

export function CartaoDoLayoutNoPcp({ p }: { p: ProdutoCotado }) {
  const b = p.bloco
  const pecas = totalDaGrade(b.grade)
  const tamanhos = tamanhosNaOrdem(b.faixa, b.grade).filter(t => (b.grade[t] ?? 0) > 0)
  const nome = b.nomeDaReferencia || b.referencia || 'sem referência'
  const obs = semTags(b.observacao || '')
  return (
    <section className="cartao pc-lay" data-layout={b.n}>
      <header className="pc-cab">
        <span className="pc-lay-tit">
          <TShirt size={18} weight="duotone" aria-hidden="true" />
          <span className="pc-corta">
            L-{String(b.n).padStart(2, '0')} · {nome.toUpperCase()}
          </span>
        </span>
        <span className="pc-cab-apoio">
          {pecas} pçs · {dinheiro(totalDoProduto(p))}
        </span>
      </header>
      <div className="pc-lay-corpo">
        <div className="pc-lay-arte">
          {b.imagem ? <img src={b.imagem} alt={'Arte do layout ' + b.n} /> : <span>sem arte</span>}
        </div>
        <dl className="pc-lay-dados">
          <dt>Tecido</dt>
          <dd>
            {b.tecidos.length
              ? b.tecidos.map((t, i) => (
                  <span key={i} className="pc-lay-tec">
                    {t.hex ? (
                      <i className="pc-q" style={{ '--cor': t.hex } as CSSProperties} />
                    ) : null}
                    <span>
                      {t.nome}
                      {t.cor && t.cor !== 'sem cor' ? ' · ' + t.cor : ''}
                    </span>
                  </span>
                ))
              : 'sem tecido'}
          </dd>
          <dt>Design</dt>
          <dd className="pc-lay-tags">
            {b.design.length
              ? b.design.map(d => (
                  <PilulaTecnica key={d.tag} tecnica={d.tecnica} tamanho="sm">
                    {d.tag}
                  </PilulaTecnica>
                ))
              : 'sem design'}
          </dd>
          <dt>Grade</dt>
          <dd className="pc-lay-grade">
            {tamanhos.length
              ? tamanhos.map(t => (
                  <span key={t}>
                    {t} <b>{b.grade[t]}</b>
                  </span>
                ))
              : 'sem grade'}
          </dd>
          {obs ? (
            <>
              <dt>Obs.</dt>
              <dd>{obs}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </section>
  )
}
