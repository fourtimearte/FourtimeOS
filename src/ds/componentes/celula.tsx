import { useState } from 'react'
import type {
  ClipboardEvent as EventoDeColar,
  KeyboardEvent as EventoDeTecla,
  PointerEvent as EventoDePonteiro,
} from 'react'

/* ==========================================================================
   A CÉLULA QUE SE ESCREVE, JEITO PLANILHA (Kit de Comportamento, seção 3).

   Nasceu nas Tabelas de preço (prancha 139, 12/10/2026) e subiu para o
   Design System em 16/10/2026, junto com a tabela de preço nova, porque
   passou a valer em mais de uma grade (a peça, a Sub e o Silk, o material,
   os extras e o DTF). Um comportamento, uma peça:

     clicar ou começar a digitar abre o campo;
     Enter grava e desce, Shift + Enter grava e sobe;
     Tab grava e vai para o lado, Shift + Tab volta;
     Esc desiste;
     colar um bloco da planilha preenche para baixo e para o lado;
     a alça do canto repete o valor nas vizinhas (para baixo, para o lado
     ou na diagonal) e grava de uma vez ao soltar.

   Número lido do jeito brasileiro ("1.234,50") e mostrado com duas casas.
   ========================================================================== */

/** "R$ 1.234,56", "49,9", "49.90" viram número; vazio vira null; o resto, NaN. */
export function lerNumero(texto: string): number | null {
  const s = texto.replace(/[^\d,.-]/g, '')
  if (!s) return null
  const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return Number(limpo)
}

const duasCasas = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type EdicaoDeCelulas = {
  editando: { id: string; coluna: number } | null
  texto: string
  setTexto: (t: string) => void
  abrir: (id: string, coluna: number, inicio?: string) => void
  tecla: (e: EventoDeTecla<HTMLInputElement>) => void
  gravar: () => void
  colar: (e: EventoDeColar<HTMLInputElement>) => void
}

/** A edição de uma grade: quem está aberto, e para onde Enter e Tab levam. */
export function usarEdicaoDeCelulas({
  ordem,
  colunas,
  valorDe,
  aoEscrever,
  aoColar,
}: {
  /** os ids das linhas à vista, na ordem da tela */
  ordem: string[]
  colunas: number
  /** o que a célula guarda (o escrito, e não o que ela mostra pela regra) */
  valorDe: (id: string, coluna: number) => number | null
  aoEscrever: (id: string, coluna: number, valor: number | null) => void
  aoColar: (id: string, coluna: number, texto: string) => void
}): EdicaoDeCelulas {
  const [editando, setEditando] = useState<{ id: string; coluna: number } | null>(null)
  const [texto, setTexto] = useState('')

  function abrir(id: string, coluna: number, inicio?: string) {
    const v = valorDe(id, coluna)
    setEditando({ id, coluna })
    setTexto(inicio ?? (v == null ? '' : duasCasas(v)))
  }

  function gravarAgora(): boolean {
    if (!editando) return false
    const n = lerNumero(texto)
    const atual = valorDe(editando.id, editando.coluna)
    if (n === null || (Number.isFinite(n) && n >= 0)) {
      if (n !== atual) aoEscrever(editando.id, editando.coluna, n)
      return true
    }
    return false
  }

  function ir(id: string | undefined, coluna: number) {
    if (!id) return setEditando(null)
    abrir(id, coluna)
  }

  function tecla(e: EventoDeTecla<HTMLInputElement>) {
    if (!editando) return
    const i = ordem.indexOf(editando.id)
    if (e.key === 'Enter') {
      e.preventDefault()
      gravarAgora()
      ir(ordem[i + (e.shiftKey ? -1 : 1)], editando.coluna)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      gravarAgora()
      if (e.shiftKey) {
        if (editando.coluna > 0) ir(editando.id, editando.coluna - 1)
        else ir(ordem[i - 1], colunas - 1)
      } else if (editando.coluna < colunas - 1) ir(editando.id, editando.coluna + 1)
      else ir(ordem[i + 1], 0)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditando(null)
    }
  }

  function colar(e: EventoDeColar<HTMLInputElement>) {
    if (!editando) return
    const t = e.clipboardData.getData('text')
    if (!/[\t\n]/.test(t.trim())) return
    e.preventDefault()
    aoColar(editando.id, editando.coluna, t)
    setEditando(null)
  }

  return {
    editando,
    texto,
    setTexto,
    abrir,
    tecla,
    gravar: () => {
      gravarAgora()
      setEditando(null)
    },
    colar,
  }
}

/* --- A ALÇA: o quadradinho no canto do campo. Arrastar repete o valor nas
   vizinhas: para baixo ou para cima, nas outras linhas da mesma coluna; para
   o lado, nas outras colunas da mesma linha; na diagonal, no retângulo
   inteiro. Soltar grava de uma vez. ------------------------------------------ */
export type PontoDaGrade = { id: string; coluna: number }
export type AlcaDeCelulas = {
  naSelecao: (id: string, coluna: number) => boolean
  comecar: (e: EventoDePonteiro, id: string, coluna: number) => void
}

export function usarAlcaDeCelulas({
  ordem,
  valorDe,
  aoPreencher,
}: {
  ordem: string[]
  /** o valor que a célula MOSTRA */
  valorDe: (id: string, coluna: number) => number | null
  aoPreencher: (alvos: PontoDaGrade[], valor: number) => void
}): AlcaDeCelulas {
  const [arrasto, setArrasto] = useState<{ de: PontoDaGrade; ate: PontoDaGrade } | null>(null)

  function alvosDe(a: { de: PontoDaGrade; ate: PontoDaGrade }): PontoDaGrade[] {
    const i = ordem.indexOf(a.de.id)
    const j = ordem.indexOf(a.ate.id)
    const [r0, r1] = i < j ? [i, j] : [j, i]
    const [c0, c1] = a.de.coluna < a.ate.coluna ? [a.de.coluna, a.ate.coluna] : [a.ate.coluna, a.de.coluna]
    const out: PontoDaGrade[] = []
    for (let r = r0; r <= r1; r++)
      for (let k = c0; k <= c1; k++) if (!(ordem[r] === a.de.id && k === a.de.coluna)) out.push({ id: ordem[r], coluna: k })
    return out
  }

  function comecar(e: EventoDePonteiro, id: string, coluna: number) {
    e.preventDefault()
    e.stopPropagation()
    const de = { id, coluna }
    let atual = { de, ate: de }
    setArrasto(atual)
    const mover = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-celula]')
      if (!el) return
      const k = (el.dataset.celula ?? '').lastIndexOf(':')
      const c = (el.dataset.celula ?? '').slice(0, k)
      const f = (el.dataset.celula ?? '').slice(k + 1)
      if (!c || !ordem.includes(c)) return
      atual = { de, ate: { id: c, coluna: Number(f) } }
      setArrasto(atual)
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      const v = valorDe(de.id, de.coluna)
      const alvos = alvosDe(atual)
      setArrasto(null)
      if (v != null && alvos.length) aoPreencher(alvos, v)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const selecao = arrasto ? alvosDe(arrasto) : []
  return {
    naSelecao: (id, coluna) =>
      !!arrasto && ((arrasto.de.id === id && arrasto.de.coluna === coluna) || selecao.some((p) => p.id === id && p.coluna === coluna)),
    comecar,
  }
}

/* --- O CAMPO: sempre à vista, com borda. O estado diz como ele aparece:
     base     o escrito por alguém, em negrito;
     mao      escrito à mão por cima da regra, com o ponto;
     regra    veio da regra, em cinza;
     kit      a soma das peças, em cinza;
     vazio    falta o valor que importa: tracejado em vermelho;
     espera   espera outro valor (ou "não faz"): tracejado neutro;
     fora     a linha não está na tabela. -------------------------------------- */
export type EstadoDaCelula = 'base' | 'mao' | 'regra' | 'kit' | 'vazio' | 'espera' | 'fora'

const CLASSE: Record<EstadoDaCelula, string> = {
  base: 'cel cel-base',
  mao: 'cel cel-mao',
  regra: 'cel cel-regra',
  kit: 'cel cel-kit',
  vazio: 'cel cel-vazio',
  espera: 'cel cel-espera',
  fora: 'cel cel-fora',
}

export function CampoDeCelula({
  id,
  coluna,
  valor,
  estado,
  texto,
  titulo,
  rotulo,
  podeMexer,
  edicao,
  alca,
}: {
  id: string
  coluna: number
  /** o que a célula mostra */
  valor: number | null
  estado: EstadoDaCelula
  /** o texto no lugar do número (vazio, espera, fora) */
  texto?: string
  titulo?: string
  rotulo: string
  podeMexer: boolean
  edicao: EdicaoDeCelulas
  alca?: AlcaDeCelulas
}) {
  const aberto = edicao.editando?.id === id && edicao.editando.coluna === coluna
  const sel = alca?.naSelecao(id, coluna) ? ' cel-sel' : ''
  const mostra = texto ?? (valor == null ? '' : duasCasas(valor))
  return (
    <span className={'cel-caixa' + sel} data-celula={id + ':' + coluna}>
      {aberto ? (
        <input
          className="cel cel-campo"
          autoFocus
          inputMode="decimal"
          aria-label={rotulo}
          value={edicao.texto}
          onChange={(e) => edicao.setTexto(e.target.value)}
          onKeyDown={edicao.tecla}
          onPaste={edicao.colar}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={edicao.gravar}
        />
      ) : (
        <button
          type="button"
          className={CLASSE[estado]}
          disabled={!podeMexer}
          title={titulo}
          aria-label={rotulo + ': ' + (mostra || 'vazio')}
          onClick={() => edicao.abrir(id, coluna)}
          onKeyDown={(e) => {
            /* começar a digitar já abre o campo, com o que foi digitado */
            if (/^[\d,]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
              e.preventDefault()
              edicao.abrir(id, coluna, e.key)
            }
          }}
        >
          {mostra}
        </button>
      )}
      {alca && podeMexer && !aberto && estado !== 'fora' && valor != null ? (
        <span
          className="cel-alca"
          aria-hidden="true"
          title="Arraste para repetir este valor nas vizinhas"
          onPointerDown={(e) => alca.comecar(e, id, coluna)}
        />
      ) : null}
    </span>
  )
}
