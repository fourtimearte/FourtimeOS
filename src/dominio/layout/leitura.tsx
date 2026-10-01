import { useState } from 'react'
import { VisorDeImagem } from '@ds'
import type { Bloco } from './bloco'
import { tamanhosNaOrdem, totalDaGrade } from './grade'
import { sanitizarTextoRico } from './texto'
import './leitura.css'

/* ==========================================================================
   O LAYOUT EM LEITURA, do jeito do wireframe aprovado em 01/10/2026.

   ELE NÃO É O MÓDULO DO EDITOR, e isso é uma decisão do Henrique tomada em
   01/10: até ali o cartão do kanban desenhava os layouts com o ModuloDeLayout
   da cotação (decisão de 22/09), e o wireframe novo trocou aquilo por um
   desenho mais limpo, só com linhas finas, sem caixa dentro de caixa. Ele
   pediu o desenho do wireframe sabendo que isso são dois desenhos para manter.

   POR ISSO ELE SÓ LÊ. Não tem menu, não tem campo, não tem botão de escolher
   cor. Quem edita é o editor da cotação, e no dia em que a cotação ganhar um
   campo novo que o chão de fábrica precise ver, ele entra aqui também: é a
   única obrigação que vem junto com ter dois desenhos.

   AS MEDIDAS SÃO AS DO WIREFRAME, uma a uma: imagem de 340 por 300, grade de
   120, o resto para tecido, design e observação, 20 entre as três, 16 entre o
   cabeçalho e o corpo, 28 de respiro embaixo com uma linha fina.
   ========================================================================== */

/* A camiseta em traço, no lugar da arte que ainda não veio. É o mesmo desenho
   do wireframe: uma caixa vazia sem nada dentro parece erro de carregamento,
   e a silhueta diz "aqui vai a arte". */
function Silhueta() {
  return (
    <svg width="120" height="120" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M36 14 L22 21 L9 38 L21 46 L28 40 L28 88 L72 88 L72 40 L79 46 L91 38 L78 21 L64 14 Q50 25 36 14 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LayoutDeLeitura({
  bloco,
  tecnica,
}: {
  bloco: Bloco
  /** o que vai à direita do cabeçalho, antes das peças. Sem ele, as tags do design */
  tecnica?: string
}) {
  const [ampliada, setAmpliada] = useState(false)
  const tamanhos = tamanhosNaOrdem(bloco.faixa, bloco.grade).filter((t) => (bloco.grade[t] ?? 0) > 0)
  const total = totalDaGrade(bloco.grade)
  const ref = [bloco.referencia, bloco.nomeDaReferencia].filter(Boolean).join(' · ')
  const qual = tecnica || bloco.design.map((d) => d.tag).join(', ')
  const obs = sanitizarTextoRico(bloco.observacao)

  return (
    <article className="lr">
      <header className="lr-topo">
        <span className="lr-n">L-{String(bloco.n).padStart(2, '0')}</span>
        <span className="lr-ref" data-genero={bloco.genero || undefined}>
          {ref || 'sem referência'}
        </span>
        <span className="lr-qual">
          {[qual, bloco.informacoes ? '' : total + ' peças'].filter(Boolean).join(' · ')}
        </span>
      </header>

      <div className={bloco.informacoes ? 'lr-corpo info' : 'lr-corpo'}>
        {bloco.imagem ? (
          <button
            type="button"
            className="lr-arte"
            onClick={() => setAmpliada(true)}
            aria-label="Ampliar a arte"
          >
            <img src={bloco.imagem} alt={bloco.arte || 'arte do layout'} />
          </button>
        ) : (
          <div className="lr-arte vazia">
            <Silhueta />
          </div>
        )}

        {bloco.informacoes ? null : (
          <div className="lr-grade" role="table" aria-label="Grade de tamanhos">
            <div className="lr-grade-topo" role="row">
              <span role="columnheader">TAM.</span>
              <span role="columnheader">PÇS</span>
            </div>
            {tamanhos.map((t) => (
              <div className="lr-grade-linha" role="row" key={t}>
                <b role="cell">{t}</b>
                <span role="cell">{bloco.grade[t]}</span>
              </div>
            ))}
            <div className="lr-grade-total" role="row">
              <span role="cell">Total</span>
              <span role="cell">{total}</span>
            </div>
          </div>
        )}

        <div className="lr-info">
          {bloco.informacoes ? null : (
            <>
              <section className="lr-parte">
                <h4 className="lr-rot">Tecido</h4>
                {bloco.tecidos.length ? (
                  bloco.tecidos.map((t, i) => (
                    <div className="lr-tecido" key={i}>
                      <span className="lr-amostra" style={{ background: t.hex || 'transparent' }} />
                      <span className="lr-tecido-txt">
                        <b>{t.nome || 'tecido a definir'}</b>
                        {t.cor ? <span>{t.cor}</span> : null}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="lr-nada">a definir</span>
                )}
              </section>

              <section className="lr-parte">
                <h4 className="lr-rot">Design</h4>
                {bloco.design.length ? (
                  bloco.design.map((d, i) => (
                    <div className="lr-design" key={i}>
                      <span className="lr-design-tag">{d.tag}</span>
                      {d.cores.map((c, j) => (
                        <span className="lr-cod" key={j}>
                          <span className="lr-cod-amostra" style={{ background: c.hex || 'transparent' }} />
                          {c.cod}
                        </span>
                      ))}
                    </div>
                  ))
                ) : (
                  <span className="lr-nada">a definir</span>
                )}
              </section>
            </>
          )}

          {obs ? (
            <section className="lr-parte">
              <h4 className="lr-rot">Observação</h4>
              {/* o texto rico já passou pela peneira do sanitizarTextoRico,
                  a mesma que o editor usa ao gravar */}
              <div className="lr-obs" dangerouslySetInnerHTML={{ __html: obs }} />
            </section>
          ) : null}
        </div>
      </div>

      {ampliada && bloco.imagem ? (
        <VisorDeImagem
          src={bloco.imagem}
          nome={bloco.arte || 'L-' + String(bloco.n).padStart(2, '0')}
          aoFechar={() => setAmpliada(false)}
        />
      ) : null}
    </article>
  )
}
