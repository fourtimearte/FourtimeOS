import type { CSSProperties } from 'react'
import {
  COLUNAS,
  NOME_DA_TECNICA,
  corDoPosto,
  nomeDoPosto,
  paradoHa,
  rotaDe,
  type Etapa,
  type FatiaNoQuadro,
  type Rota,
} from '@dominio/producao'

/* ==========================================================================
   ONDE CADA LAYOUT ESTÁ: um gráfico só para o pedido inteiro.

   X SÃO OS POSTOS, Y SÃO OS LAYOUTS. Foi o pedido do Henrique em 01/10: um
   gráfico com todos os layouts, e não um gráfico por layout. Cada linha é um
   layout, e nela três pontos dizem tudo: cinza cheio por onde já passou,
   escuro onde está agora, vazado por onde ainda vai passar.

   OS POSTOS ESTÃO NA ORDEM DAS COLUNAS DO QUADRO, e não na ordem da rota. É
   isso que faz o gráfico ser um mapa do quadro de baixo: o ponto da terceira
   coluna do gráfico está na terceira coluna do quadro. Na ordem da rota, a
   sublimação (impressão, calandra, corte) e o DTF (corte, impressão, prensa)
   precisariam de dois eixos diferentes.

   SÓ ENTRAM OS POSTOS POR ONDE ALGUMA TÉCNICA DO PEDIDO PASSA. Com os treze,
   os nomes não cabem no cartão do trilho, e um pedido só de DTF desenharia
   colunas de bordado e silk que ele nunca vai visitar.

   DOIS TAMANHOS, O MESMO DESENHO. O `mini` mora no cartão aberto do trilho,
   escuro, com o rótulo de cada posto na cor dele. O `grande` mora no pedido
   inteiro, claro, com o nome do posto por extenso. As medidas de cada um são
   as do wireframe aprovado.
   ========================================================================== */

const CURTO: Partial<Record<Etapa, string>> = {
  corte: 'Corte',
  subli: 'Subli',
  dtf: 'DTF',
  prensa: 'Prensa',
  silk: 'Silk',
  bordado: 'Bord.',
  calandra: 'Calan.',
  futurize: 'Futur.',
  conferencia: 'Conf.',
  'cd-costura': 'C.cost',
  costura: 'Cost.',
  embalagem: 'Emb.',
  finalizado: 'Fim',
}

const TEC_CURTA: Record<string, string> = {
  subli: 'Sub',
  dtf: 'DTF',
  silk: 'Silk',
  bordado: 'Bord',
  patch: 'Pat',
}

type Ponto = 'passou' | 'aqui' | 'falta' | 'fora'

type Linha = {
  chave: string
  rotulo: string
  tecnica: string
  pontos: Ponto[]
  /* o ponto de agora fica vermelho quando a fatia está parada há 3 dias */
  parado: boolean
}

function montar(fatias: FatiaNoQuadro[], rotas: Rota[]) {
  const usados = new Set<Etapa>()
  for (const f of fatias) for (const p of rotaDe(rotas, f.tecnica)) usados.add(p)
  const colunas = COLUNAS.filter((c) => usados.has(c))

  const linhas: (Linha & { n: number })[] = []
  for (const f of fatias) {
    const rota = rotaDe(rotas, f.tecnica)
    const aqui = rota.indexOf(f.etapa)
    const pontos = colunas.map<Ponto>((c) => {
      const i = rota.indexOf(c)
      if (i < 0) return 'fora'
      if (i === aqui) return 'aqui'
      return i < aqui ? 'passou' : 'falta'
    })
    const parado = f.etapa !== 'finalizado' && paradoHa(f.etapaEm) >= 3
    /* FATIA SEM NÚMERO DE LAYOUT vira uma linha só com o nome da técnica. É o
       pedido antigo, de antes de a fatia guardar os blocos: mentir um L-01
       para ele seria inventar um layout. */
    if (!f.layouts.length) {
      linhas.push({ chave: f.id, n: 999, rotulo: 'Todos', tecnica: f.tecnica, pontos, parado })
      continue
    }
    for (const n of f.layouts) {
      linhas.push({
        chave: f.id + ':' + n,
        n,
        rotulo: 'L-' + String(n).padStart(2, '0'),
        tecnica: f.tecnica,
        pontos,
        parado,
      })
    }
  }
  linhas.sort((a, b) => a.n - b.n)
  return { colunas, linhas }
}

export function GraficoDoPedido({
  fatias,
  rotas,
  tamanho,
}: {
  fatias: FatiaNoQuadro[]
  rotas: Rota[]
  tamanho: 'mini' | 'grande'
}) {
  const { colunas, linhas } = montar(fatias, rotas)
  if (!colunas.length) return null

  if (tamanho === 'mini') {
    /* A ALTURA DA LINHA SE AJUSTA AO NÚMERO DE LAYOUTS, para o gráfico caber
       nos 77px do cartão aberto: 15 de rótulo e o resto dividido. Com quatro
       layouts dá 13; com dois, para em 15, que é o teto do wireframe. */
    const h = Math.max(6, Math.min(15, Math.floor(62 / Math.max(1, linhas.length)) - 2))
    const grade = { '--kb-n': colunas.length } as CSSProperties
    return (
      <div className="kb-gm" style={grade} aria-label="Onde cada layout está">
        <div className="kb-gm-linha kb-gm-eixo">
          <span />
          {colunas.map((c) => (
            <span
              key={c}
              className="kb-gm-posto"
              title={nomeDoPosto(c)}
              style={{ '--c': corDoPosto(c) } as CSSProperties}
            >
              {CURTO[c] ?? c}
            </span>
          ))}
        </div>
        {linhas.map((l) => (
          <div key={l.chave} className="kb-gm-linha" style={{ height: h }}>
            <span className="kb-gm-rot">
              {l.rotulo} <i>{TEC_CURTA[l.tecnica] ?? l.tecnica.slice(0, 4)}</i>
            </span>
            {l.pontos.map((p, i) => (
              <span key={i} className="kb-gm-cel">
                {p === 'fora' ? null : (
                  <span className={'kb-gm-ponto ' + p + (p === 'aqui' && l.parado ? ' parado' : '')} />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    )
  }

  const grade = { '--kb-n': colunas.length } as CSSProperties
  return (
    <section className="kb-gg" style={grade}>
      <div className="kb-gg-cima">
        <h3 className="kb-gg-titulo">Onde cada layout está</h3>
        <span className="kb-gg-leg">
          <span className="kb-gg-ponto passou" />
          passou
        </span>
        <span className="kb-gg-leg">
          <span className="kb-gg-ponto aqui sem-anel" />
          está aqui
        </span>
        <span className="kb-gg-leg">
          <span className="kb-gg-ponto falta" />
          ainda vai passar
        </span>
      </div>
      <div role="table">
        <div className="kb-gg-linha kb-gg-eixo" role="row">
          <span role="columnheader" />
          {colunas.map((c) => (
            <span key={c} role="columnheader" className="kb-gg-posto">
              {nomeDoPosto(c)}
            </span>
          ))}
        </div>
        {linhas.map((l) => (
          <div key={l.chave} className="kb-gg-linha" role="row">
            <span role="rowheader" className="kb-gg-rot">
              <b>{l.rotulo}</b> <i>{NOME_DA_TECNICA[l.tecnica as keyof typeof NOME_DA_TECNICA] ?? l.tecnica}</i>
            </span>
            {l.pontos.map((p, i) => (
              <span key={i} role="cell" className="kb-gg-cel">
                {p === 'fora' ? null : (
                  <span className={'kb-gg-ponto ' + p + (p === 'aqui' && l.parado ? ' parado' : '')} />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
