import { medidaDoMolde, type ParteNoMolde, type Vista } from '@dominio/produto'

/* ==========================================================================
   AS COTAS: a largura embaixo e a altura ao lado de cada parte do molde.

   São desenhadas POR CIMA do molde, num SVG próprio, e nunca dentro do
   arquivo do molde: o desenho do Affinity não é tocado. Quem chama diz onde o
   desenho está na tela (a vista) e as cotas caem no lugar.

   Serve à tela cheia, onde a letra não cresce com o zoom, e à folha
   impressa, onde tudo é um desenho só.
   ========================================================================== */

export function Cotas({
  partes,
  vista,
  cmPorUnidade,
  escolhida,
  recuo = 18,
  comUnidade = true,
}: {
  partes: ParteNoMolde[]
  vista: Vista
  cmPorUnidade: number | null
  /** a parte em destaque */
  escolhida?: string | null
  /** a distância entre a parte e a linha da cota */
  recuo?: number
  /** "55,0 cm" na tela cheia; na folha, só "55,0" */
  comUnidade?: boolean
}) {
  const sufixo = comUnidade && cmPorUnidade ? ' cm' : ''
  const pe = 6
  return (
    <>
      {partes.flatMap(p =>
        p.caixas.map((c, i) => {
          const x0 = vista.x + c.x * vista.z
          const x1 = x0 + c.w * vista.z
          const y0 = vista.y + c.y * vista.z
          const y1 = y0 + c.h * vista.z
          const yDaLargura = y1 + recuo
          const xDaAltura = x0 - recuo
          return (
            <g
              className={escolhida === p.chave ? 'pd-cota pd-cota-sel' : 'pd-cota'}
              key={p.chave + '-' + i}
              data-cota={p.chave}
            >
              <path
                d={
                  `M${x0},${yDaLargura} L${x1},${yDaLargura} M${x0},${yDaLargura - pe} L${x0},${yDaLargura + pe} M${x1},${yDaLargura - pe} L${x1},${yDaLargura + pe} ` +
                  `M${xDaAltura},${y0} L${xDaAltura},${y1} M${xDaAltura - pe},${y0} L${xDaAltura + pe},${y0} M${xDaAltura - pe},${y1} L${xDaAltura + pe},${y1}`
                }
              />
              <text x={(x0 + x1) / 2} y={yDaLargura + pe + 12} textAnchor="middle" data-cota-largura="">
                {medidaDoMolde(c.w, cmPorUnidade) + sufixo}
              </text>
              <text
                transform={`translate(${xDaAltura - pe - 3} ${(y0 + y1) / 2}) rotate(-90)`}
                textAnchor="middle"
                data-cota-altura=""
              >
                {medidaDoMolde(c.h, cmPorUnidade) + sufixo}
              </text>
            </g>
          )
        }),
      )}
    </>
  )
}
