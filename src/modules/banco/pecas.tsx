import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CaretDown, PencilSimple, X } from '@phosphor-icons/react'
import { Botao, Campo, Entrada, Gaveta, Modal, avisar } from '@ds'

/* ==========================================================================
   As peças que as cinco categorias do banco repetem.

   O editor v3.375 usa a mesma linha para tudo: o que identifica à esquerda, o
   nome no meio, o lápis e o X à direita. Foi copiado assim de propósito. Quem
   usa o editor todo dia não deveria ter que reaprender a mexer no banco só
   porque a tela é outra.
   ========================================================================== */

/* --- o bloco que abre e fecha ---------------------------------------------
   Nenhum <details> nativo: ele traz o triângulo do navegador, que muda de
   desenho em cada sistema e não obedece ao tema. */
export function Bloco({
  cod,
  nome,
  conta,
  enfeite,
  aberto,
  aoAlternar,
  children,
}: {
  cod?: string
  nome: string
  conta: number
  enfeite?: ReactNode
  aberto: boolean
  aoAlternar: () => void
  children: ReactNode
}) {
  return (
    <section className={aberto ? 'bd-bloco aberto' : 'bd-bloco'}>
      <button type="button" className="bd-bloco-topo" onClick={aoAlternar} aria-expanded={aberto}>
        {cod ? <span className="bd-cod-grupo">{cod}</span> : null}
        {enfeite}
        <span className="bd-bloco-nome">{nome}</span>
        <span className="bd-bloco-conta">{conta}</span>
        <CaretDown size={15} className="bd-seta" />
      </button>
      {aberto ? <div className="bd-bloco-corpo">{children}</div> : null}
    </section>
  )
}

/* --- a linha --------------------------------------------------------------- */
export function Linha({
  esquerda,
  nome,
  direita,
  podeMexer,
  aoRenomear,
  aoApagar,
}: {
  esquerda?: ReactNode
  nome: ReactNode
  direita?: ReactNode
  podeMexer: boolean
  aoRenomear?: () => void
  aoApagar?: () => void
}) {
  return (
    <div className="bd-linha">
      {esquerda}
      <span className="bd-linha-nome">{nome}</span>
      {direita}
      {podeMexer && aoRenomear ? (
        <button type="button" className="bd-mao" title="Renomear" onClick={aoRenomear}>
          <PencilSimple size={15} />
        </button>
      ) : null}
      {podeMexer && aoApagar ? (
        <button type="button" className="bd-mao perigo" title="Apagar" onClick={aoApagar}>
          <X size={15} />
        </button>
      ) : null}
    </div>
  )
}

/* --- renomear --------------------------------------------------------------
   Uma gaveta só, emprestada por todas as categorias. O campo já vem com o
   texto selecionado, porque renomear quase sempre é trocar tudo e não
   acrescentar uma letra no fim. */
export type AlvoDoNome = {
  titulo: string
  rotulo: string
  dica?: string
  valor: string
  gravar: (novo: string) => Promise<void>
}

export function GavetaDeNome({ alvo, aoFechar }: { alvo: AlvoDoNome | null; aoFechar: () => void }) {
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (alvo) setTexto(alvo.valor)
  }, [alvo])

  async function salvar() {
    if (!alvo || salvando) return
    const novo = texto.trim()
    if (!novo) {
      avisar('O nome não pode ficar vazio.', 'brand')
      return
    }
    if (novo === alvo.valor) {
      aoFechar()
      return
    }
    setSalvando(true)
    try {
      await alvo.gravar(novo)
      aoFechar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Gaveta
      aberto={!!alvo}
      aoFechar={aoFechar}
      titulo={alvo?.titulo ?? ''}
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" carregando={salvando} onClick={() => void salvar()}>
            Salvar
          </Botao>
        </>
      }
    >
      {alvo ? (
        <Campo rotulo={alvo.rotulo} dica={alvo.dica}>
          <Entrada
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void salvar()
            }}
          />
        </Campo>
      ) : null}
    </Gaveta>
  )
}

/* --- apagar ----------------------------------------------------------------
   Sem confirm() do navegador: ele ignora o tema, aparece no topo da janela
   longe do dedo e trava a página inteira até alguém responder. */
export type AlvoDeApagar = { titulo: string; texto: ReactNode; apagar: () => Promise<void> }

export function ModalDeApagar({
  alvo,
  aoFechar,
}: {
  alvo: AlvoDeApagar | null
  aoFechar: () => void
}) {
  const [ocupado, setOcupado] = useState(false)

  async function confirmar() {
    if (!alvo || ocupado) return
    setOcupado(true)
    try {
      await alvo.apagar()
      aoFechar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui apagar.', 'brand')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Modal
      aberto={!!alvo}
      aoFechar={aoFechar}
      titulo={alvo?.titulo ?? ''}
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="perigo" carregando={ocupado} onClick={() => void confirmar()}>
            Apagar
          </Botao>
        </>
      }
    >
      <p className="bd-aviso-apagar">{alvo?.texto}</p>
    </Modal>
  )
}

/* --- a tarja de gênero ----------------------------------------------------- */
const GENERO_LONGO: Record<string, string> = {
  M: 'Masculino',
  F: 'Feminino',
  C: 'Infantil',
  U: 'Unissex',
}

export function TarjaDeGenero({ letra }: { letra: string }) {
  const l = letra || 'U'
  return (
    <span className={'bd-genero g-' + l} title={GENERO_LONGO[l] ?? 'Unissex'}>
      {l}
    </span>
  )
}
