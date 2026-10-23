import { useEffect, useRef } from 'react'
import { avisar } from './recados'

/* ==========================================================================
   O RASCUNHO GUARDADO NO NAVEGADOR (Kit de Comportamento, item 11;
   14/10/2026).

   Pedido do Henrique: "capacidade de salvar no browser dados que não foram
   salvos, para que eles permaneçam se acidentalmente reiniciar a página, ou
   fechar o navegador, ou até trocar de página, e isso é para o sistema
   inteiro, pois imagina estar fazendo um orçamento e perder tudo".

   Como funciona, em toda tela que edita e tem um Salvar:
   - enquanto há mudança não salva, o que está na tela é guardado neste
     navegador, um instante depois de cada mudança e também na hora de fechar
     ou trocar de aba;
   - ao abrir a mesma coisa de novo (recarregar, voltar à página, abrir outro
     dia), a tela volta com o que não tinha sido salvo, marcada como não
     salva, e um recado diz de quando é, com o botão Descartar;
   - salvar apaga o rascunho; descartar volta ao que está no banco.

   Guarda no IndexedDB, e não no localStorage: uma cotação com as artes passa
   fácil dos 5 MB que o localStorage aguenta. Sem IndexedDB (janela anônima de
   alguns navegadores), a tela funciona igual, só não guarda.

   O rascunho guarda também uma impressão do que estava no banco quando a
   pessoa começou a mexer. Se o banco mudou depois (outra pessoa salvou), o
   recado avisa que o rascunho está por cima de uma versão mais nova.
   ========================================================================== */

const BANCO = 'ft-rascunhos'
const LOJA = 'rascunho'
/* rascunho esquecido some sozinho depois de 30 dias */
const VALIDADE = 30 * 24 * 60 * 60 * 1000

export type Rascunho<T> = {
  valor: T
  /** quando foi guardado (ms) */
  em: number
  /** a impressão do que estava no banco quando a mudança começou */
  base: string
}

let aberto: Promise<IDBDatabase | null> | null = null
function abrir(): Promise<IDBDatabase | null> {
  if (aberto) return aberto
  aberto = new Promise(resolver => {
    try {
      if (typeof indexedDB === 'undefined') return resolver(null)
      const pedido = indexedDB.open(BANCO, 1)
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA)
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => resolver(null)
    } catch {
      resolver(null)
    }
  })
  return aberto
}

async function naLoja<R>(
  modo: IDBTransactionMode,
  faz: (l: IDBObjectStore) => IDBRequest<R>,
): Promise<R | null> {
  const db = await abrir()
  if (!db) return null
  return new Promise(resolver => {
    try {
      const pedido = faz(db.transaction(LOJA, modo).objectStore(LOJA))
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => resolver(null)
    } catch {
      resolver(null)
    }
  })
}

export function lerRascunho<T>(chave: string): Promise<Rascunho<T> | null> {
  return naLoja('readonly', l => l.get(chave) as IDBRequest<Rascunho<T> | undefined>).then(r => {
    if (!r) return null
    if (Date.now() - r.em > VALIDADE) {
      void apagarRascunho(chave)
      return null
    }
    return r
  })
}

export function guardarRascunho<T>(chave: string, r: Rascunho<T>): Promise<unknown> {
  return naLoja('readwrite', l => l.put(r, chave))
}

export function apagarRascunho(chave: string): Promise<unknown> {
  voltaram.delete(chave)
  return naLoja('readwrite', l => l.delete(chave))
}

/* OS RASCUNHOS QUE VOLTARAM NESTA VISITA (19/10/2026). Um rascunho guardado
   por uma versão anterior do sistema pode não ter um campo que a tela de hoje
   lê, e a tela cai ("Cannot read properties of undefined"), de novo a cada
   vez que abre, porque o rascunho volta sempre. A rede de segurança pergunta
   aqui qual foi o último que voltou e oferece descartar só ele. */
const voltaram = new Map<string, { em: number; voltouEm: number }>()

/* Rascunho que voltou ha mais tempo que isto nao e suspeito: o tombo de um
   rascunho torto acontece no primeiro desenho depois de ele voltar. Sem o
   prazo, a mudanca nao salva de OUTRA tela, de uma hora atras, seria
   oferecida para descarte num tombo que nao tem nada a ver com ela. */
const SUSPEITO_POR = 60_000

/** O último rascunho que voltou para a tela nesta visita (no último minuto), e de quando ele é. */
export function ultimoRascunhoQueVoltou(): { chave: string; em: number } | null {
  let ultimo: { chave: string; em: number } | null = null
  for (const [chave, r] of voltaram) if (Date.now() - r.voltouEm <= SUSPEITO_POR) ultimo = { chave, em: r.em }
  return ultimo
}

/** Uma impressão curta de um valor, para saber se o banco mudou. */
export function impressao(valor: unknown): string {
  const texto = JSON.stringify(valor) ?? ''
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + ':' + texto.length
}

/** "hoje às 14:32", "ontem às 18:05", "12/10 às 09:10" */
export function quandoFoiOrascunho(em: number): string {
  const d = new Date(em)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date()
  const ontem = new Date(hoje.getTime() - 86400000)
  if (d.toDateString() === hoje.toDateString()) return 'hoje às ' + hora
  if (d.toDateString() === ontem.toDateString()) return 'ontem às ' + hora
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + hora
}

/**
 * Guarda o que a tela tem de não salvo e devolve quando ela abre de novo.
 *
 * - `chave`: o que está sendo editado, único no sistema ("cotacao:<id>").
 * - `valor`: o estado inteiro da tela que se perde ao sair.
 * - `sujo`: há mudança não salva. Quando volta a falso (salvou), o rascunho sai.
 * - `base`: o que veio do banco, para saber se ele mudou depois.
 * - `aoVoltar`: chamado uma vez, ao abrir, quando há rascunho guardado. A tela
 *   põe o valor no estado (e fica não salva). O recado com o Descartar é a
 *   peça que mostra, e ele some se a tela fechar.
 * - `aoDescartar`: o Descartar do recado; a tela volta ao que está no banco.
 */
export function useRascunho<T>({
  chave,
  valor,
  sujo,
  base,
  aoVoltar,
  aoDescartar,
  ligado = true,
}: {
  chave: string
  valor: T
  sujo: boolean
  base: unknown
  aoVoltar: (r: Rascunho<T>) => void
  aoDescartar: () => void
  /** desliga o rascunho (o documento travado, por exemplo) */
  ligado?: boolean
}): { limpar: () => void } {
  const ultimo = useRef({ valor, sujo, chave, ligado })
  ultimo.current = { valor, sujo, chave, ligado }
  /* a base de quando a mudança começou: não muda enquanto está sujo */
  const baseDoInicio = useRef(impressao(base))
  if (!sujo) baseDoInicio.current = impressao(base)
  const conferido = useRef('')
  const voltar = useRef(aoVoltar)
  voltar.current = aoVoltar
  const descartar = useRef(aoDescartar)
  descartar.current = aoDescartar
  /* o recado que esta tela mostrou: some quando a tela fecha, senão o
     Descartar de uma tela que já saiu apagaria o rascunho da que entrou */
  const fecharRecado = useRef<() => void>(() => {})
  useEffect(() => () => fecharRecado.current(), [])

  /* ao abrir: há rascunho desta chave? */
  useEffect(() => {
    /* desligou (a folha fechou): abrir de novo confere o rascunho de novo */
    if (!ligado) {
      conferido.current = ''
      return
    }
    if (conferido.current === chave) return
    conferido.current = chave
    let vivo = true
    void lerRascunho<T>(chave).then(r => {
      if (!vivo || !r) return
      voltaram.delete(chave)
      voltaram.set(chave, { em: r.em, voltouEm: Date.now() })
      try {
        voltar.current(r)
      } catch (e) {
        /* não deu para pôr de volta: a tela fica com o que está no banco, e o
           rascunho continua guardado (nada se perde sem a pessoa pedir) */
        console.error('[fourtime] o rascunho não voltou:', e)
        avisar('Não consegui trazer de volta o que não tinha sido salvo. A tela abriu com o que está salvo.', 'warn')
        return
      }
      fecharRecado.current = avisarQueORascunhoVoltou(r.em, r.base !== impressao(base), () => {
        void apagarRascunho(chave)
        descartar.current()
      })
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, ligado])

  /* guarda um instante depois de cada mudança; salvou (sujo voltou a falso),
     apaga. Ao abrir a tela, limpa ainda não é "salvou": o rascunho de antes
     está sendo lido para voltar */
  /* a chave que estava suja: trocar de documento na mesma tela (outra tabela
     de preço) não é "salvou", e não pode apagar o rascunho do novo */
  const sujoEm = useRef<string | null>(null)
  /* depois do limpar (salvou e a tela vai fechar), nada mais é guardado até
     a tela ficar limpa e sujar de novo */
  const pausado = useRef(false)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!ligado) {
      /* fechar não é salvar: o rascunho fica para quando abrir de novo */
      sujoEm.current = null
      return
    }
    if (!sujo) {
      if (sujoEm.current === chave) void apagarRascunho(chave)
      sujoEm.current = null
      pausado.current = false
      return
    }
    if (pausado.current) return
    sujoEm.current = chave
    const base = baseDoInicio.current
    espera.current = setTimeout(() => {
      if (!pausado.current) void guardarRascunho(chave, { valor, em: Date.now(), base })
    }, 400)
    return () => {
      if (espera.current) clearTimeout(espera.current)
      /* a tela trocou de documento, ou a folha fechou, com mudança por
         guardar: guarda o de antes já */
      if ((ultimo.current.chave !== chave || !ultimo.current.ligado) && !pausado.current)
        void guardarRascunho(chave, { valor, em: Date.now(), base })
    }
  }, [chave, valor, sujo, ligado])

  /* fechar a aba, recarregar ou esconder a página: guarda na hora */
  useEffect(() => {
    const agora = () => {
      const u = ultimo.current
      if (u.ligado && u.sujo && !pausado.current)
        void guardarRascunho(u.chave, {
          valor: u.valor,
          em: Date.now(),
          base: baseDoInicio.current,
        })
    }
    const escondeu = () => {
      if (document.visibilityState === 'hidden') agora()
    }
    window.addEventListener('pagehide', agora)
    document.addEventListener('visibilitychange', escondeu)
    return () => {
      /* sair da tela (trocar de página no sistema) também guarda */
      agora()
      window.removeEventListener('pagehide', agora)
      document.removeEventListener('visibilitychange', escondeu)
    }
  }, [])

  return {
    /** Salvou (ou descartou) e a tela vai fechar: apaga o rascunho e não
        guarda mais nada até a próxima mudança. */
    limpar() {
      pausado.current = true
      sujoEm.current = null
      if (espera.current) clearTimeout(espera.current)
      void apagarRascunho(ultimo.current.chave)
    },
  }
}

/** O recado de quando a tela volta com o rascunho: de quando é, se alguém
    salvou depois, e o botão Descartar (que volta ao que está no banco). */
export function avisarQueORascunhoVoltou(
  em: number,
  baseMudou: boolean,
  aoDescartar: () => void,
): () => void {
  let fechar = () => {}
  fechar = avisar(
    <span className="recado-rascunho">
      <span>
        Voltei com o que não estava salvo, de {quandoFoiOrascunho(em)}.
        {baseMudou ? ' Alguém salvou depois disso: confira antes de salvar.' : ''}
      </span>
      <button
        type="button"
        className="recado-acao"
        onClick={() => {
          aoDescartar()
          fechar()
        }}
      >
        Descartar
      </button>
    </span>,
    'info',
    12,
  )
  return fechar
}
