import { useState } from 'react'
import type { ClipboardEvent as EventoDeColar, KeyboardEvent as EventoDeTecla } from 'react'
import { formatarNumeroExato } from '@shared'
import { numeroDoTexto, type Celula } from '@dominio/preco'

/* ==========================================================================
   O CAMPO DO PREÇO (prancha 139): todo preço é um campo à vista, com borda,
   e não um número solto. A primeira faixa é o PREÇO BASE, escrito por
   alguém; as outras vêm da regra, em cinza dentro do campo, ou foram
   escritas à mão, com o ponto. Sem base, o campo fica tracejado em vermelho
   ("R$ 0,00") e as faixas esperam com "da base".

   A edição é a mesma nas duas vistas (Lista e Tabela): clicar ou começar a
   digitar abre o campo; Enter grava e desce para a peça de baixo; Tab grava
   e vai para a faixa do lado; Esc desiste; apagar o número de uma faixa
   devolve ela para a regra. Colar um bloco copiado da planilha preenche
   para baixo e para o lado.
   ========================================================================== */

/* a classe de cada estado, escrita inteira para a conferencia de ligacoes achar */
const CLASSE = {
  base: 'pr-pc pr-pc-base',
  mao: 'pr-pc pr-pc-mao',
  regra: 'pr-pc pr-pc-regra',
  kit: 'pr-pc pr-pc-kit',
  vazio: 'pr-pc pr-pc-vazio',
  dabase: 'pr-pc pr-pc-dabase',
  fora: 'pr-pc pr-pc-fora',
} as const

const TITULO = {
  base: 'O preço base, escrito por alguém',
  mao: 'Escrito à mão. Apague para voltar à regra.',
  regra: 'Da regra da tabela, a partir do preço base',
  kit: 'Soma das peças do kit, com o desconto do kit',
  vazio: 'Falta o preço base: sem ele a peça não sai na cotação',
  dabase: 'Espera o preço base',
  fora: 'Fora da tabela: escreva um preço para pôr',
} as const

export type Edicao = {
  editando: { codigo: string; faixa: number } | null
  texto: string
  setTexto: (t: string) => void
  abrir: (codigo: string, faixa: number, inicio?: string) => void
  tecla: (e: EventoDeTecla<HTMLInputElement>) => void
  gravar: () => void
  colar: (e: EventoDeColar<HTMLInputElement>) => void
}

/** A edição de uma grade: quem está aberto, e para onde Enter e Tab levam. */
export function usarEdicao({
  ordem,
  faixas,
  valorDe,
  aoEscrever,
  aoColar,
}: {
  /** os códigos à vista, na ordem da tela */
  ordem: string[]
  faixas: number
  valorDe: (codigo: string, faixa: number) => number | null
  aoEscrever: (codigo: string, faixa: number, valor: number | null) => void
  aoColar: (codigo: string, faixa: number, texto: string) => void
}): Edicao {
  const [editando, setEditando] = useState<{ codigo: string; faixa: number } | null>(null)
  const [texto, setTexto] = useState('')

  function abrir(codigo: string, faixa: number, inicio?: string) {
    const v = valorDe(codigo, faixa)
    setEditando({ codigo, faixa })
    setTexto(inicio ?? (v == null ? '' : formatarNumeroExato(v)))
  }

  function gravarAgora(): boolean {
    if (!editando) return false
    const n = numeroDoTexto(texto)
    const atual = valorDe(editando.codigo, editando.faixa)
    if (n === null || (Number.isFinite(n) && n >= 0)) {
      if (n !== atual) aoEscrever(editando.codigo, editando.faixa, n)
      return true
    }
    return false
  }

  function ir(codigo: string | undefined, faixa: number) {
    if (!codigo) return setEditando(null)
    abrir(codigo, faixa)
  }

  function tecla(e: EventoDeTecla<HTMLInputElement>) {
    if (!editando) return
    const i = ordem.indexOf(editando.codigo)
    if (e.key === 'Enter') {
      e.preventDefault()
      gravarAgora()
      ir(ordem[i + (e.shiftKey ? -1 : 1)], editando.faixa)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      gravarAgora()
      if (e.shiftKey) {
        if (editando.faixa > 0) ir(editando.codigo, editando.faixa - 1)
        else ir(ordem[i - 1], faixas - 1)
      } else if (editando.faixa < faixas - 1) ir(editando.codigo, editando.faixa + 1)
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
    aoColar(editando.codigo, editando.faixa, t)
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

export function CampoDePreco({
  codigo,
  faixa,
  celula,
  fora = false,
  rotulo,
  podeMexer,
  edicao,
}: {
  codigo: string
  faixa: number
  celula: Celula
  fora?: boolean
  rotulo: string
  podeMexer: boolean
  edicao: Edicao
}) {
  const aberto = edicao.editando?.codigo === codigo && edicao.editando.faixa === faixa
  if (aberto) {
    return (
      <input
        className="pr-pc pr-pc-campo"
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
    )
  }
  const estado: keyof typeof CLASSE = fora
    ? 'fora'
    : celula.origem === 'vazio'
      ? faixa === 0
        ? 'vazio'
        : 'dabase'
      : celula.origem
  const texto =
    estado === 'fora' ? 'fora' : estado === 'vazio' ? 'R$ 0,00' : estado === 'dabase' ? 'da base' : formatarNumeroExato(celula.valor ?? 0)
  return (
    <button
      type="button"
      className={CLASSE[estado]}
      disabled={!podeMexer}
      title={TITULO[estado]}
      aria-label={rotulo + ': ' + texto}
      data-celula={codigo + ':' + faixa}
      onClick={() => edicao.abrir(codigo, faixa)}
      onKeyDown={(e) => {
        /* comecar a digitar ja abre o campo, com o que foi digitado */
        if (/^[\d,]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          edicao.abrir(codigo, faixa, e.key)
        }
      }}
    >
      {texto}
    </button>
  )
}
