import { useEffect, useState } from 'react'
import { ArrowsSplit, Warning } from '@phosphor-icons/react'
import { AreaTexto, Botao, Campo, Marcacao, Modal, Seletor, useSelecaoDeLinhas } from '@ds'
import { totalDaGrade, type Bloco } from '@dominio/layout'
import {
  destravarOCartao,
  nomeDoPosto,
  separarDoCartao,
  travarOCartao,
  type Etapa,
  type FatiaNoQuadro,
} from '@dominio/producao'

/* ==========================================================================
   TRAVOU AQUI E SEPARAR (076, 12/10/2026). As duas eram decisão sem botão
   (FOURTIME OS - 08, seção 8, item 6).

   TRAVOU AQUI: o cartão parou neste posto por um motivo que não é dele. Quem
   está no posto escreve o motivo, o cartão fica vermelho no quadro, e o
   diretor é avisado no sino. Andar de posto destrava sozinho.

   SEPARAR: tirar layouts do cartão para um cartão novo, num posto da rota (a
   reimpressão que volta enquanto o resto segue). As peças saem da grade da
   cotação, que o cartão aberto já leu.
   ========================================================================== */

const rotulo = (n: number) => 'L-' + String(n).padStart(2, '0')

function quandoFoi(iso: string): string {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return 'há ' + min + ' min'
  const h = Math.round(min / 60)
  if (h < 24) return 'há ' + h + ' h'
  const d = Math.round(h / 24)
  return 'há ' + d + (d === 1 ? ' dia' : ' dias')
}

export function TravouESeparar({
  fatia,
  blocos,
  rota,
  podeMover,
  aoMexer,
}: {
  fatia: FatiaNoQuadro
  blocos: Bloco[]
  rota: Etapa[]
  podeMover: boolean
  /** grava, relê a linha do tempo e o quadro; o erro vira recado */
  aoMexer: (oQue: () => Promise<unknown>) => Promise<void>
}) {
  const [travando, setTravando] = useState(false)
  const [separando, setSeparando] = useState(false)
  const fechado = !!fatia.fechadoEm || fatia.etapa === 'finalizado'
  const podeSeparar = podeMover && !fechado && fatia.layouts.length > 1 && blocos.length > 1

  if (!fatia.travadaEm && (!podeMover || fechado)) return null

  return (
    <section className="ca-travou-sec" aria-label="Travou aqui e separar">
      {fatia.travadaEm ? (
        <div className="ca-travou" role="status">
          <Warning size={18} weight="bold" aria-hidden="true" />
          <div>
            <b>Travou aqui</b>
            <p>{fatia.travadaMotivo}</p>
            <small>
              {[fatia.travadaPorNome, quandoFoi(fatia.travadaEm)].filter(Boolean).join(' · ')}. Andar de posto destrava.
            </small>
          </div>
        </div>
      ) : null}
      {podeMover && !fechado ? (
        <div className="ca-travou-botoes">
          {fatia.travadaEm ? (
            <button type="button" className="ca-bt" onClick={() => void aoMexer(() => destravarOCartao(fatia.id))}>
              Destravar
            </button>
          ) : (
            <button type="button" className="ca-bt" onClick={() => setTravando(true)}>
              <Warning size={16} weight="bold" aria-hidden="true" />
              Travou aqui
            </button>
          )}
          {podeSeparar ? (
            <button type="button" className="ca-bt" onClick={() => setSeparando(true)}>
              <ArrowsSplit size={16} weight="bold" aria-hidden="true" />
              Separar layouts
            </button>
          ) : null}
        </div>
      ) : null}

      <ModalDoTravou
        aberto={travando}
        posto={nomeDoPosto(fatia.etapa)}
        aoFechar={() => setTravando(false)}
        aoGravar={(motivo) => aoMexer(() => travarOCartao(fatia.id, motivo))}
      />
      <ModalDeSeparar
        aberto={separando}
        fatia={fatia}
        blocos={blocos}
        rota={rota}
        aoFechar={() => setSeparando(false)}
        aoGravar={(layouts, pecas, posto, motivo) => aoMexer(() => separarDoCartao(fatia.id, layouts, pecas, posto, motivo))}
      />
    </section>
  )
}

function ModalDoTravou({
  aberto,
  posto,
  aoFechar,
  aoGravar,
}: {
  aberto: boolean
  posto: string
  aoFechar: () => void
  aoGravar: (motivo: string) => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [gravando, setGravando] = useState(false)
  useEffect(() => {
    if (aberto) setMotivo('')
  }, [aberto])
  const valido = motivo.trim().length >= 3

  async function gravar() {
    if (!valido) return
    setGravando(true)
    await aoGravar(motivo.trim())
    setGravando(false)
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={'Travou em ' + posto}
      fechaFora={false}
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar} disabled={gravando}>
            Cancelar
          </Botao>
          <Botao tom="primario" onClick={() => void gravar()} disabled={!valido || gravando} carregando={gravando}>
            Marcar que travou
          </Botao>
        </>
      }
    >
      <Campo rotulo="O que travou" dica="O diretor recebe no sino. O cartão fica vermelho até andar de posto ou alguém destravar.">
        <AreaTexto
          value={motivo}
          maxLength={300}
          rows={3}
          autoFocus
          placeholder="A calandra quebrou, falta a arte, o cliente mudou a grade"
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Campo>
    </Modal>
  )
}

function ModalDeSeparar({
  aberto,
  fatia,
  blocos,
  rota,
  aoFechar,
  aoGravar,
}: {
  aberto: boolean
  fatia: FatiaNoQuadro
  blocos: Bloco[]
  rota: Etapa[]
  aoFechar: () => void
  aoGravar: (layouts: number[], pecas: number, posto: Etapa, motivo: string) => Promise<void>
}) {
  const [escolhidos, setEscolhidos] = useState<number[]>([])
  const [posto, setPosto] = useState<Etapa | ''>('')
  const [motivo, setMotivo] = useState('')
  const [gravando, setGravando] = useState(false)
  useEffect(() => {
    if (!aberto) return
    setEscolhidos([])
    /* a reimpressao quase sempre volta para o primeiro posto da rota */
    setPosto(rota[0] ?? '')
    setMotivo('')
  }, [aberto, rota])

  const postos = rota.filter((p) => p !== 'finalizado')
  const pecasDe = (n: number) => totalDaGrade(blocos.find((b) => b.n === n)?.grade ?? {})
  const pecas = escolhidos.reduce((s, n) => s + pecasDe(n), 0)
  const todos = escolhidos.length >= fatia.layouts.length
  const pecasBoas = pecas >= 1 && pecas < fatia.pecas
  const valido = escolhidos.length > 0 && !todos && pecasBoas && !!posto && motivo.trim().length >= 3

  /* a seleção do Kit de Comportamento: Shift pega a faixa, Esc solta, Ctrl+A marca todos */
  const selecao = useSelecaoDeLinhas(
    fatia.layouts.map(String),
    escolhidos.map(String),
    (novos) => setEscolhidos(fatia.layouts.filter((n) => novos.includes(String(n)))),
  )

  async function gravar() {
    if (!valido || !posto) return
    setGravando(true)
    await aoGravar(escolhidos, pecas, posto, motivo.trim())
    setGravando(false)
    aoFechar()
  }

  const recado = !escolhidos.length
    ? 'Escolha os layouts que saem deste cartão.'
    : todos
      ? 'Deixe pelo menos um layout no cartão: separar todos é mover o cartão.'
      : !pecasBoas
        ? 'A grade destes layouts não fecha com as peças do cartão; confira a cotação.'
        : escolhidos.map(rotulo).join(', ') + ' saem com ' + pecas + ' peças para ' + (posto ? nomeDoPosto(posto) : 'o posto escolhido') + '; o cartão fica com ' + (fatia.pecas - pecas) + '.'

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={'Separar layouts do ' + fatia.numero}
      fechaFora={false}
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar} disabled={gravando}>
            Cancelar
          </Botao>
          <Botao tom="primario" onClick={() => void gravar()} disabled={!valido || gravando} carregando={gravando}>
            Separar
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <Campo rotulo="Layouts que saem">
          <div className="ca-sep-lista" onKeyDown={selecao.naTecla}>
            {fatia.layouts.map((n) => (
              <Marcacao
                key={n}
                checked={escolhidos.includes(n)}
                onChange={() => {}}
                onClick={(e) => selecao.naCaixa(String(n), e)}
              >
                {rotulo(n)} · {pecasDe(n)} pçs
              </Marcacao>
            ))}
          </div>
        </Campo>
        <Campo rotulo="Voltam para">
          <Seletor
            bloco
            campo
            valor={posto}
            vazio="Escolher o posto"
            comBusca={false}
            opcoes={postos.map((p) => ({ valor: p, rotulo: nomeDoPosto(p) + (p === fatia.etapa ? ' (onde está)' : '') }))}
            aoEscolher={(v) => setPosto(v as Etapa)}
          />
        </Campo>
        <Campo rotulo="Por quê">
          <AreaTexto
            value={motivo}
            maxLength={200}
            rows={2}
            placeholder="Reimpressão da manga, cor errada"
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Campo>
        <p className={valido ? 'ca-sep-recado' : 'ca-sep-recado falta'} role="status">
          {recado}
        </p>
      </div>
    </Modal>
  )
}
