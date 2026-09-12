import { useEffect, useRef, useState } from 'react'
import { Flutuante } from './flutuante'

/* ==========================================================================
   O campo de data.

   Existe porque o sistema nao usa peca de navegador em lugar nenhum, e o
   <input type="date"> abre o calendario do Chrome, que muda de cara em cada
   maquina do galpao e nao obedece ao tema.

   Ele aceita os dois jeitos de trabalhar: digitar 24/09/2026 direto, que e
   como quem usa teclado faz, e escolher no calendario, que e como quem esta
   no tablet faz. O valor guardado e sempre AAAA-MM-DD, que e o formato que o
   banco entende.
   ========================================================================== */

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** AAAA-MM-DD vira 24/09/2026 */
export function dataParaTela(iso: string) {
  const [a, m, d] = (iso || '').split('-')
  return a && m && d ? d + '/' + m + '/' + a : ''
}

/** 24/09/2026 vira AAAA-MM-DD, ou vazio quando a data nao existe */
export function telaParaData(texto: string) {
  const n = texto.replace(/\D/g, '')
  if (n.length !== 8) return ''
  const d = Number(n.slice(0, 2))
  const m = Number(n.slice(2, 4))
  const a = Number(n.slice(4))
  if (m < 1 || m > 12 || d < 1 || a < 1900) return ''
  /* 31 de fevereiro nao existe: o proprio Date devolve marco, e e assim que
     dizemos que a data esta errada */
  const dt = new Date(a, m - 1, d)
  if (dt.getDate() !== d || dt.getMonth() !== m - 1) return ''
  return [a, String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-')
}

function comMascara(bruto: string) {
  const n = bruto.replace(/\D/g, '').slice(0, 8)
  if (n.length <= 2) return n
  if (n.length <= 4) return n.slice(0, 2) + '/' + n.slice(2)
  return n.slice(0, 2) + '/' + n.slice(2, 4) + '/' + n.slice(4)
}

const hojeEmIso = () => new Date().toISOString().slice(0, 10)

export function CampoDeData({
  valor,
  aoMudar,
  bloco,
}: {
  /** sempre AAAA-MM-DD, ou vazio */
  valor: string
  aoMudar: (iso: string) => void
  bloco?: boolean
}) {
  const [texto, setTexto] = useState(() => dataParaTela(valor))
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  /* quem muda a data por fora, tipo colar um .cft, tambem muda o que se le */
  useEffect(() => {
    setTexto(dataParaTela(valor))
  }, [valor])

  const base = valor || hojeEmIso()
  const [ano, mes] = base.split('-').map(Number)
  const [olhando, setOlhando] = useState({ ano, mes })
  useEffect(() => {
    if (aberto) setOlhando({ ano, mes })
  }, [aberto, ano, mes])

  const primeiro = new Date(olhando.ano, olhando.mes - 1, 1)
  const diasNoMes = new Date(olhando.ano, olhando.mes, 0).getDate()
  const vazios = primeiro.getDay()
  const hoje = hojeEmIso()

  function escolher(dia: number) {
    const iso = [
      olhando.ano,
      String(olhando.mes).padStart(2, '0'),
      String(dia).padStart(2, '0'),
    ].join('-')
    aoMudar(iso)
    setAberto(false)
  }

  function andar(passo: number) {
    const d = new Date(olhando.ano, olhando.mes - 1 + passo, 1)
    setOlhando({ ano: d.getFullYear(), mes: d.getMonth() + 1 })
  }

  return (
    <>
      <div
        ref={caixa}
        className={['data', bloco ? 'bloco' : '', aberto ? 'aberto' : ''].filter(Boolean).join(' ')}
      >
        <input
          className="data-campo"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={texto}
          onChange={(e) => {
            const t = comMascara(e.target.value)
            setTexto(t)
            const iso = telaParaData(t)
            if (iso) aoMudar(iso)
            else if (!t) aoMudar('')
          }}
          /* o que ficou pela metade volta ao que valia: campo de data nao
             guarda meia data */
          onBlur={() => setTexto(dataParaTela(valor))}
          aria-label="Data"
        />
        <button
          type="button"
          className="data-bt"
          onClick={() => setAberto((x) => !x)}
          aria-label="Abrir o calendário"
          title="Calendário"
        >
          <Calendario />
        </button>
      </div>

      <Flutuante
        aberto={aberto}
        ancora={caixa}
        aoFechar={() => setAberto(false)}
        opcoes={{ alinhar: 'esquerda', largura: 296 }}
        versao={olhando.ano * 100 + olhando.mes}
        className="mn cal"
      >
        <div className="cal-topo">
          <button type="button" className="cal-seta" onClick={() => andar(-1)} aria-label="Mês anterior">
            ‹
          </button>
          <span className="cal-mes">
            {MESES[olhando.mes - 1]} de {olhando.ano}
          </span>
          <button type="button" className="cal-seta" onClick={() => andar(1)} aria-label="Próximo mês">
            ›
          </button>
        </div>

        <div className="cal-semana">
          {DIAS_DA_SEMANA.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="cal-grade">
          {Array.from({ length: vazios }, (_, i) => (
            <span key={'v' + i} />
          ))}
          {Array.from({ length: diasNoMes }, (_, i) => {
            const dia = i + 1
            const iso = [
              olhando.ano,
              String(olhando.mes).padStart(2, '0'),
              String(dia).padStart(2, '0'),
            ].join('-')
            return (
              <button
                key={dia}
                type="button"
                className={['cal-dia', iso === valor ? 'escolhido' : '', iso === hoje ? 'hoje' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => escolher(dia)}
              >
                {dia}
              </button>
            )
          })}
        </div>

        <div className="cal-pe">
          <button type="button" className="cal-acao" onClick={() => { aoMudar(hoje); setAberto(false) }}>
            Hoje
          </button>
          <button type="button" className="cal-acao" onClick={() => { aoMudar(''); setAberto(false) }}>
            Limpar
          </button>
        </div>
      </Flutuante>
    </>
  )
}

function Calendario() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
