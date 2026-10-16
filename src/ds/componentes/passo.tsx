import { Minus, Plus } from './icones-do-passo'

/* ==========================================================================
   O PASSO: menos, o número, mais (Kit de Comportamento, seção 4). Nasceu no
   botão direito do Patch (quantos por peça) e subiu para o Design System em
   16/10/2026, quando passou a valer também no Bordado, nas telas do Silk e
   na conta da peça da cotação. Um comportamento, uma peça.

   `valor` null quer dizer "vários" (o lote com quantidades diferentes): o
   menos e o mais partem de 1.
   ========================================================================== */

export function Passo({
  valor,
  aoMudar,
  min = 1,
  max = 20,
  rotulo,
  unidade,
  desligado,
}: {
  valor: number | null
  aoMudar: (n: number) => void
  min?: number
  max?: number
  /** o que se conta, para o leitor de tela: "patches por peça" */
  rotulo: string
  /** a palavra depois do número, quando ajuda: "telas" */
  unidade?: string
  desligado?: boolean
}) {
  const v = valor
  return (
    <span className="passo" role="group" aria-label={rotulo}>
      <button
        type="button"
        className="btn btn-contorno sm icone"
        aria-label={'Menos ' + rotulo}
        disabled={desligado || v === min}
        onClick={() => aoMudar(Math.max(min, (v ?? min + 1) - 1))}
      >
        <Minus />
      </button>
      <b className="passo-n" aria-live="polite">
        {v ?? 'vários'}
        {unidade && v != null ? <small>{unidade}</small> : null}
      </b>
      <button
        type="button"
        className="btn btn-contorno sm icone"
        aria-label={'Mais ' + rotulo}
        disabled={desligado || v === max}
        onClick={() => aoMudar(Math.min(max, (v ?? min - 1) + 1))}
      >
        <Plus />
      </button>
    </span>
  )
}
