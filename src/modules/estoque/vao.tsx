import type { CSSProperties } from 'react'
import { enchimentoDoVao, type Material } from '@dominio/estoque'

/* ==========================================================================
   O vão da prateleira.

   Um espaço cinza com o material dentro, na cor dele. A altura é o livre
   contra o dobro do mínimo (a conta mora no domínio), e o risco tracejado do
   meio é o mínimo: tecido acima do risco tem folga, abaixo é compra.

   Material sem cor (aviamento, insumo) entra em cinza. Inventar uma cor para
   linha e botão diria que eles têm cor de catálogo, e não têm.
   ========================================================================== */
export function Vao({
  pct,
  cor,
  mini,
  semRisco,
  titulo,
}: {
  /** 0 a 100: quanto do vão o material ocupa */
  pct: number
  /** a cor do tecido; vazia desenha em cinza */
  cor?: string
  /** o vão miúdo da lista: sem picotado e sem risco */
  mini?: boolean
  semRisco?: boolean
  titulo?: string
}) {
  const estilo = { '--vao-pct': Math.max(0, Math.min(100, pct)) + '%' } as CSSProperties & Record<string, string>
  if (cor) estilo['--vao-cor'] = cor
  return (
    <span className={mini ? 'es-vao mini' : 'es-vao'} style={estilo} title={titulo}>
      <span className="es-vao-tecido">
        <i />
      </span>
      {mini || semRisco ? null : <span className="es-vao-risco" />}
    </span>
  )
}

/** O vão de um material, com a conta já feita. */
export function VaoDoMaterial({ m, mini, titulo }: { m: Material; mini?: boolean; titulo?: string }) {
  return <Vao pct={enchimentoDoVao(m)} cor={m.corHex} mini={mini} titulo={titulo} />
}

/** A bolinha da cor: redonda quando há cor, quadrada e cinza quando não há. */
export function Bola({ cor, pequena }: { cor?: string; pequena?: boolean }) {
  return (
    <span
      className={['es-bola', cor ? '' : 'sem-cor', pequena ? 'pequena' : ''].filter(Boolean).join(' ')}
      style={cor ? ({ '--bola': cor } as CSSProperties) : undefined}
      aria-hidden="true"
    />
  )
}
