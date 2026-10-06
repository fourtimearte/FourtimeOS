import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowsIn, DownloadSimple, Minus, Plus, Ruler, Trash, UploadSimple } from '@phosphor-icons/react'
import { Aviso, Botao, Chip, Entrada, Esqueleto, Modal, Segmentado, Seletor, TituloCartao, Vazio, avisar } from '@ds'
import {
  acertarEscalaDoMolde,
  aproximar,
  areaDaPeca,
  areaEmMetros,
  carregarEscalasDoMolde,
  carregarMolde,
  emArea,
  emNumero,
  encaixar,
  escalaDoMolde,
  escalaPelaMedida,
  lerNumero,
  medidaDoMolde,
  moldeComoImagem,
  naOrdemDaFabrica,
  parteNoPonto,
  partesNoMolde,
  reguaDoMolde,
  salvarMolde,
  vezesDaParte,
  vezesEmPalavras,
  zoomEmPorcento,
  type Ficha,
  type MoldeMedido,
  type ReferenciaNaFicha,
  type TecidoDeConta,
  type Vista,
} from '@dominio/produto'
import { plural } from './apoio'
import { Cotas } from './cotas'
import { usarTecidoDeConta } from './medidas'
import { medirMolde } from './medir'
import { usarArquivoDoMolde } from './molde'

/* ==========================================================================
   O MOLDE EM TELA CHEIA, com as medidas de ponta a ponta de cada parte.

   Abre quando a pessoa toca no desenho do molde, na ficha da referência.
   O desenho é o SVG tirado do Affinity; a largura e a altura de cada parte
   são medidas no próprio arquivo (medir.ts) e as contas moram no domínio
   (dominio/produto/molde.ts).

   O TAMANHO EM CIMA TROCA O MOLDE. A peça tem um molde geral, e cada tamanho
   pode ter o molde dele. Tamanho sem molde próprio mostra o geral, e a tela
   diz isso: medida do molde geral não é medida do tamanho M.

   CENTÍMETRO SÓ COM ESCALA. O arquivo em pixel não diz o tamanho de nada.
   Sem escala a tela mostra o número do desenho e pede para acertar: a pessoa
   escolhe uma parte, digita quanto ela mede de verdade, e o resto sai dela.

   O DESENHO FICA SOBRE PAPEL BRANCO NOS DOIS TEMAS, com as cotas em cima do
   papel: traço preto do Affinity some no Grafite.
   ========================================================================== */

const FOLGA_DO_PAPEL = 56
const PASSO_DO_ZOOM = 1.25

type EscalaGuardada = { tamanho: string; cmPorUnidade: number | null }

export function VisorDoMolde({
  aberto,
  aoFechar,
  r,
  ficha,
  geral,
  tecidos,
  podeEditar,
}: {
  aberto: boolean
  aoFechar: () => void
  r: ReferenciaNaFicha
  ficha: Ficha
  /** o molde geral da peça, que a ficha já leu */
  geral: string | null
  tecidos: TecidoDeConta[]
  podeEditar: boolean
}) {
  const tamanhos = useMemo(() => naOrdemDaFabrica(ficha.tamanhos), [ficha.tamanhos])
  const [tamanho, setTamanho] = useState(() =>
    tamanhos.includes('M') ? 'M' : (tamanhos[Math.floor(tamanhos.length / 2)] ?? ''),
  )
  /* que moldes existem (o geral é o de tamanho vazio) e a escala acertada de cada um */
  const [escalas, setEscalas] = useState<EscalaGuardada[] | null>(null)
  /* o desenho de cada tamanho que tem molde próprio, lido quando alguém pede */
  const [proprios, setProprios] = useState<Record<string, string>>({})
  const [comMedidas, setComMedidas] = useState(true)
  const [escolhida, setEscolhida] = useState<string | null>(null)
  /* nulo: o desenho inteiro na tela */
  const [vista, setVista] = useState<Vista | null>(null)
  const [palco, setPalco] = useState({ w: 0, h: 0 })
  const [acertando, setAcertando] = useState(false)
  const [tirando, setTirando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const conta = usarTecidoDeConta(tecidos)

  useEffect(() => {
    if (!aberto) return
    let vivo = true
    setEscalas(null)
    carregarEscalasDoMolde(r.id)
      .then(lista => {
        if (vivo) setEscalas(lista)
      })
      .catch(() => {
        /* sem a lista, a tela mostra o molde geral e a escala que o arquivo disser */
        if (vivo) setEscalas([])
      })
    return () => {
      vivo = false
    }
  }, [aberto, r.id])

  const temProprio = !!tamanho && !!escalas?.some(e => e.tamanho === tamanho)
  /* de que molde é o desenho na tela: do tamanho, ou o geral */
  const qual = temProprio ? tamanho : ''
  const svg = temProprio ? (proprios[tamanho] ?? null) : geral

  useEffect(() => {
    if (!aberto || !temProprio || proprios[tamanho] !== undefined) return
    let vivo = true
    carregarMolde(r.id, tamanho)
      .then(m => {
        if (vivo && m) setProprios(atual => ({ ...atual, [tamanho]: m }))
      })
      .catch(e => avisar(e instanceof Error ? e.message : 'Não consegui ler o molde deste tamanho.', 'warn'))
    return () => {
      vivo = false
    }
  }, [aberto, temProprio, tamanho, proprios, r.id])

  /* a medição: o navegador desenha o SVG num quadro isolado e devolve as caixas */
  const [medicao, setMedicao] = useState<{ de: string; molde: MoldeMedido | null; erro: string } | null>(null)
  useEffect(() => {
    if (!aberto || !svg) return
    if (medicao?.de === svg) return
    try {
      setMedicao({ de: svg, molde: medirMolde(svg), erro: '' })
    } catch (e) {
      setMedicao({ de: svg, molde: null, erro: e instanceof Error ? e.message : 'Não consegui medir este SVG.' })
    }
  }, [aberto, svg, medicao])
  const medido = svg && medicao?.de === svg ? medicao.molde : null
  const erroDaMedicao = svg && medicao?.de === svg ? medicao.erro : ''

  const partes = useMemo(() => (medido ? partesNoMolde(medido) : []), [medido])
  const escala = useMemo(
    () =>
      medido
        ? escalaDoMolde(escalas?.find(e => e.tamanho === qual)?.cmPorUnidade, medido)
        : { cmPorUnidade: null, origem: '' as const },
    [medido, escalas, qual],
  )
  const cm = escala.cmPorUnidade

  /* --- o palco: o tamanho dele, o zoom e o arrasto --------------------------- */
  const caixaDoPalco = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = caixaDoPalco.current
    if (!el || !aberto) return
    const medir = () => setPalco({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [aberto, medido])

  const base = useMemo(
    () => (medido && palco.w > 0 && palco.h > 0 ? encaixar(medido.quadro, palco, FOLGA_DO_PAPEL + 8) : null),
    [medido, palco],
  )
  const v = vista ?? base
  /* para os ouvintes que não podem depender do desenho mais novo */
  const agora = useRef({ v, base })
  agora.current = { v, base }

  /* outro desenho, outra vista: o que estava aproximado não vale para ele */
  useEffect(() => {
    setVista(null)
    setEscolhida(null)
  }, [svg])

  function zoom(fator: number, ponto?: { x: number; y: number }) {
    const { v: atual, base: b } = agora.current
    if (!atual || !b) return
    setVista(aproximar(atual, fator, ponto ?? { x: palco.w / 2, y: palco.h / 2 }, b.z))
  }

  /* a roda do mouse aproxima em volta do cursor. Ouvinte posto à mão: o do
     React é passivo, e passivo não pode impedir a página de rolar junto */
  useEffect(() => {
    const el = caixaDoPalco.current
    if (!el || !aberto) return
    const rodar = (e: WheelEvent) => {
      const { v: atual, base: b } = agora.current
      if (!atual || !b) return
      e.preventDefault()
      const caixa = el.getBoundingClientRect()
      setVista(
        aproximar(atual, e.deltaY < 0 ? 1.15 : 1 / 1.15, { x: e.clientX - caixa.left, y: e.clientY - caixa.top }, b.z),
      )
    }
    el.addEventListener('wheel', rodar, { passive: false })
    return () => el.removeEventListener('wheel', rodar)
  }, [aberto, medido])

  /* o arrasto, e os dois dedos */
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  const gesto = useRef<{ x: number; y: number; v: Vista; andou: boolean; distancia: number } | null>(null)

  function ponto(e: PointerEvent) {
    const caixa = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - caixa.left, y: e.clientY - caixa.top }
  }
  function comecar(e: PointerEvent<HTMLDivElement>) {
    if (!v || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dedos.current.set(e.pointerId, ponto(e))
    const lista = [...dedos.current.values()]
    const meio = lista.length === 2 ? { x: (lista[0].x + lista[1].x) / 2, y: (lista[0].y + lista[1].y) / 2 } : lista[0]
    gesto.current = {
      x: meio.x,
      y: meio.y,
      v,
      andou: lista.length > 1,
      distancia: lista.length === 2 ? Math.hypot(lista[0].x - lista[1].x, lista[0].y - lista[1].y) : 0,
    }
  }
  function mover(e: PointerEvent<HTMLDivElement>) {
    const g = gesto.current
    if (!g || !dedos.current.has(e.pointerId) || !base) return
    dedos.current.set(e.pointerId, ponto(e))
    const lista = [...dedos.current.values()]
    const meio = lista.length === 2 ? { x: (lista[0].x + lista[1].x) / 2, y: (lista[0].y + lista[1].y) / 2 } : lista[0]
    const dx = meio.x - g.x
    const dy = meio.y - g.y
    if (!g.andou && Math.hypot(dx, dy) < 4) return
    g.andou = true
    let nova: Vista = { ...g.v, x: g.v.x + dx, y: g.v.y + dy }
    if (lista.length === 2 && g.distancia > 0) {
      const d = Math.hypot(lista[0].x - lista[1].x, lista[0].y - lista[1].y)
      nova = aproximar(nova, d / g.distancia, meio, base.z)
    }
    setVista(nova)
  }
  function soltar(e: PointerEvent<HTMLDivElement>) {
    const g = gesto.current
    const onde = ponto(e)
    dedos.current.delete(e.pointerId)
    if (dedos.current.size) {
      /* sobrou um dedo: o arrasto continua dele, de onde está */
      const resto = [...dedos.current.values()][0]
      if (agora.current.v) gesto.current = { x: resto.x, y: resto.y, v: agora.current.v, andou: true, distancia: 0 }
      return
    }
    gesto.current = null
    /* não andou: foi um toque, e toque escolhe a parte que está embaixo */
    if (g && !g.andou && v) {
      const chave = parteNoPonto(partes, (onde.x - v.x) / v.z, (onde.y - v.y) / v.z)
      setEscolhida(atual => (chave === atual ? null : chave))
    }
  }
  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    if (!v) return
    const passo = 48
    const anda: Record<string, [number, number]> = {
      ArrowLeft: [passo, 0],
      ArrowRight: [-passo, 0],
      ArrowUp: [0, passo],
      ArrowDown: [0, -passo],
    }
    if (anda[e.key]) {
      e.preventDefault()
      setVista({ ...v, x: v.x + anda[e.key][0], y: v.y + anda[e.key][1] })
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoom(PASSO_DO_ZOOM)
    } else if (e.key === '-') {
      e.preventDefault()
      zoom(1 / PASSO_DO_ZOOM)
    } else if (e.key === '0') {
      e.preventDefault()
      setVista(null)
    }
  }

  /* --- o molde de um tamanho -------------------------------------------------- */
  async function enviarMolde(novo: string) {
    if (!tamanho) return
    setEnviando(true)
    try {
      await salvarMolde(r.id, novo, tamanho)
      setProprios(atual => ({ ...atual, [tamanho]: novo }))
      /* desenho novo entra sem escala acertada: a de antes era do arquivo antigo */
      setEscalas(atual => [...(atual ?? []).filter(e => e.tamanho !== tamanho), { tamanho, cmPorUnidade: null }])
      avisar('Molde do ' + tamanho + ' guardado.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui guardar o molde.', 'warn', 7)
    } finally {
      setEnviando(false)
    }
  }
  const arquivo = usarArquivoDoMolde(novo => void enviarMolde(novo))

  async function tirarMolde() {
    setEnviando(true)
    try {
      await salvarMolde(r.id, '', tamanho)
      setEscalas(atual => (atual ?? []).filter(e => e.tamanho !== tamanho))
      setProprios(atual => {
        const outro = { ...atual }
        delete outro[tamanho]
        return outro
      })
      setTirando(false)
      avisar('O ' + tamanho + ' voltou a usar o molde geral.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui tirar o molde.', 'warn', 7)
    } finally {
      setEnviando(false)
    }
  }

  function baixar() {
    if (!svg) return
    const endereco = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = endereco
    a.download = 'molde-' + (r.cod || 'referencia') + (qual ? '-' + qual : '') + '.svg'
    a.click()
    setTimeout(() => URL.revokeObjectURL(endereco), 2000)
  }

  const area = tamanho ? areaDaPeca(ficha.partes, tamanho) : null
  const metros = areaEmMetros(area, conta.tecido)
  const regua = v && cm ? reguaDoMolde(cm, palco.w / v.z) : null
  const q = medido?.quadro
  const deQue = temProprio ? 'tamanho ' + tamanho : 'molde geral'

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      cheio
      solto
      topo={
        <div className="pd-visor-topo" data-visor-topo="">
          <div className="pd-visor-nome">
            <b>Molde · {r.nome}</b>
            <small>
              {r.cod || 'sem código'}
              {medido ? ' · ' + plural(partes.length, 'parte', 'partes') : ''} · {deQue}
            </small>
          </div>
          {tamanhos.length ? (
            <Segmentado
              className="pd-visor-tam"
              valor={tamanho}
              aoMudar={setTamanho}
              opcoes={tamanhos.map(t => ({
                valor: t,
                rotulo: escalas?.some(e => e.tamanho === t) ? (
                  <>
                    {t}
                    <i className="pd-visor-tem" title="tem molde próprio" />
                  </>
                ) : (
                  t
                ),
              }))}
            />
          ) : null}
          <div className="fileira">
            <Chip ligado={comMedidas} aria-pressed={comMedidas} onClick={() => setComMedidas(x => !x)}>
              <Ruler size={16} aria-hidden="true" />
              Medidas
            </Chip>
            <span className="pd-visor-zoom">
              <Botao icone aria-label="Afastar" disabled={!v} onClick={() => zoom(1 / PASSO_DO_ZOOM)}>
                <Minus size={16} aria-hidden="true" />
              </Botao>
              <b data-zoom="">{v && base ? zoomEmPorcento(v, base.z) : 100}%</b>
              <Botao icone aria-label="Aproximar" disabled={!v} onClick={() => zoom(PASSO_DO_ZOOM)}>
                <Plus size={16} aria-hidden="true" />
              </Botao>
            </span>
            <Botao disabled={!vista} onClick={() => setVista(null)}>
              <ArrowsIn size={16} aria-hidden="true" />
              Ajustar à tela
            </Botao>
            <Botao disabled={!svg} onClick={baixar}>
              <DownloadSimple size={16} aria-hidden="true" />
              Baixar o SVG
            </Botao>
          </div>
        </div>
      }
    >
      <div className="pd-visor" data-visor="">
        <div
          className="pd-visor-palco"
          ref={caixaDoPalco}
          tabIndex={0}
          role="img"
          aria-label={
            'O molde de ' + r.nome + ' ampliado' + (comMedidas ? ', com a largura e a altura de cada parte' : '')
          }
          data-foco-inicial=""
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onKeyDown={tecla}
        >
          {svg && q && v ? (
            <>
              <div
                className="pd-visor-papel"
                style={{
                  left: v.x + q.x * v.z - FOLGA_DO_PAPEL,
                  top: v.y + q.y * v.z - FOLGA_DO_PAPEL,
                  width: q.w * v.z + FOLGA_DO_PAPEL * 2,
                  height: q.h * v.z + FOLGA_DO_PAPEL * 2,
                }}
              />
              <img
                className="pd-visor-desenho"
                src={moldeComoImagem(svg)}
                alt=""
                draggable={false}
                style={{
                  width: q.w,
                  height: q.h,
                  transform: `translate(${v.x + q.x * v.z}px, ${v.y + q.y * v.z}px) scale(${v.z})`,
                }}
              />
              {comMedidas ? (
                <svg className="pd-visor-cotas" width={palco.w} height={palco.h} aria-hidden="true">
                  <Cotas partes={partes} vista={v} cmPorUnidade={cm} escolhida={escolhida} />
                </svg>
              ) : null}
              {regua ? (
                <span className="pd-visor-regua" data-regua="">
                  <i style={{ width: regua.unidades * v.z }} />
                  {emNumero(regua.cm, regua.cm < 1 ? 1 : 0)} cm
                </span>
              ) : null}
              <span className="pd-visor-dica">
                Arraste para mover · role para aproximar · toque numa parte para destacar as medidas dela
              </span>
            </>
          ) : erroDaMedicao ? (
            <Vazio titulo="Não consegui medir este molde" texto={erroDaMedicao} />
          ) : !svg && escalas !== null && !temProprio ? (
            <Vazio
              titulo="Esta peça ainda não tem o desenho do molde"
              texto="O molde geral entra pela ficha da referência, em Trocar o SVG."
            />
          ) : (
            <div className="pd-espera">
              <Esqueleto altura={22} largura="40%" />
              <Esqueleto altura={220} />
            </div>
          )}
        </div>

        <aside className="pd-visor-lado" data-visor-lado="">
          <div className="pd-topo">
            <TituloCartao icone={Ruler}>Medidas de ponta a ponta</TituloCartao>
            <span className="pd-topo-n">
              {deQue} · {cm ? 'em cm' : 'sem escala'}
            </span>
          </div>
          {partes.map(p => (
            <button
              type="button"
              key={p.chave}
              className={escolhida === p.chave ? 'pd-visor-parte on' : 'pd-visor-parte'}
              aria-pressed={escolhida === p.chave}
              data-parte={p.chave}
              onClick={() => setEscolhida(atual => (atual === p.chave ? null : p.chave))}
            >
              <span className="pd-visor-parte-nome">
                <b>{p.nome}</b>
                <small>{vezesEmPalavras(vezesDaParte(p, ficha.partes))}</small>
              </span>
              <span className="pd-visor-parte-med">
                <span>
                  <small>largura</small>
                  <b>{medidaDoMolde(p.largura, cm)}</b>
                </span>
                <span>
                  <small>altura</small>
                  <b>{medidaDoMolde(p.altura, cm)}</b>
                </span>
              </span>
            </button>
          ))}
          {medido && !partes.length ? (
            <div className="pd-corpo">
              <p className="pd-nota">Não achei nenhuma parte neste desenho para medir.</p>
            </div>
          ) : null}
          <div className="pd-corpo">
            <dl className="pd-visor-dl">
              {tamanho ? (
                <>
                  <dt>Tecido do {tamanho}</dt>
                  <dd>{area !== null ? emArea(area, 2) + ' m²' : 'sem número na ficha'}</dd>
                </>
              ) : null}
              {metros !== null && conta.tecido ? (
                <>
                  <dt>Em metros, com {emNumero(conta.tecido.largura, 2)} m</dt>
                  <dd>{emNumero(metros, 2)} m</dd>
                </>
              ) : null}
              <dt>Escala</dt>
              <dd data-escala={escala.origem || 'falta'}>
                {escala.origem === 'acertada'
                  ? 'acertada à mão'
                  : escala.origem === 'arquivo'
                    ? 'a que o arquivo diz'
                    : 'falta acertar'}
              </dd>
            </dl>
            {medido && !cm ? (
              <Aviso tom="warn" titulo="Estas medidas ainda não são centímetros">
                O SVG saiu do Affinity sem dizer o tamanho de verdade, então os números são da unidade do
                desenho.{' '}
                {podeEditar
                  ? 'Acerte a escala: diga quanto mede uma parte, e as outras saem dela.'
                  : 'Quem edita a ficha acerta a escala.'}
              </Aviso>
            ) : null}
            {podeEditar && medido ? (
              <div className="fileira">
                {partes.length ? (
                  <Botao tamanho="sm" onClick={() => setAcertando(true)}>
                    <Ruler size={14} aria-hidden="true" />
                    Acertar a escala
                  </Botao>
                ) : null}
              </div>
            ) : null}
            {podeEditar && tamanho ? (
              <div className="fileira">
                <Botao tamanho="sm" carregando={enviando} onClick={arquivo.abrir}>
                  <UploadSimple size={14} aria-hidden="true" />
                  {temProprio ? 'Trocar o molde do ' + tamanho : 'Enviar o molde do ' + tamanho}
                </Botao>
                {temProprio ? (
                  <Botao tamanho="sm" tom="limpo" disabled={enviando} onClick={() => setTirando(true)}>
                    <Trash size={14} aria-hidden="true" />
                    Tirar
                  </Botao>
                ) : null}
                {arquivo.campo}
              </div>
            ) : null}
            {tamanho && !temProprio && escalas !== null ? (
              <p className="pd-nota" data-molde-geral="">
                O {tamanho} ainda não tem molde próprio: o desenho e as medidas são do molde geral da peça.
              </p>
            ) : null}
            <p className="pd-nota">
              Largura é do ponto mais à esquerda ao mais à direita da parte; altura, do mais alto ao mais
              baixo. O sistema mede no próprio SVG, do jeito que o molde saiu do Affinity. Trocar o tamanho
              em cima troca o molde e as medidas.
            </p>
          </div>
        </aside>
      </div>

      {acertando && medido ? (
        <AcertarAEscala
          partes={partes}
          comecaEm={escolhida}
          atual={escala}
          aoFechar={() => setAcertando(false)}
          aoGuardar={async valor => {
            await acertarEscalaDoMolde(r.id, valor, qual)
            setEscalas(lista => [
              ...(lista ?? []).filter(e => e.tamanho !== qual),
              { tamanho: qual, cmPorUnidade: valor },
            ])
            setAcertando(false)
            avisar(valor === null ? 'Escala acertada tirada.' : 'Escala acertada.', 'ok')
          }}
        />
      ) : null}

      <Modal
        aberto={tirando}
        aoFechar={() => setTirando(false)}
        titulo={'Tirar o molde do ' + tamanho + '?'}
        pe={
          <>
            <Botao tom="limpo" onClick={() => setTirando(false)} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao tom="perigo" carregando={enviando} onClick={() => void tirarMolde()}>
              Tirar
            </Botao>
          </>
        }
      >
        <p className="pd-nota">
          O desenho deste tamanho e a escala acertada dele saem. O {tamanho} volta a mostrar o molde geral da
          peça.
        </p>
      </Modal>
    </Modal>
  )
}

/* Acertar a escala: uma parte, e quanto ela mede de verdade. */
function AcertarAEscala({
  partes,
  comecaEm,
  atual,
  aoFechar,
  aoGuardar,
}: {
  partes: ReturnType<typeof partesNoMolde>
  comecaEm: string | null
  atual: { cmPorUnidade: number | null; origem: string }
  aoFechar: () => void
  aoGuardar: (cmPorUnidade: number | null) => Promise<void>
}) {
  const [chave, setChave] = useState(comecaEm ?? partes[0]?.chave ?? '')
  const parte = partes.find(p => p.chave === chave) ?? null
  const [texto, setTexto] = useState(() =>
    parte && atual.cmPorUnidade ? medidaDoMolde(parte.largura, atual.cmPorUnidade) : '',
  )
  const [guardando, setGuardando] = useState(false)
  const [erro, setErro] = useState('')

  const lido = lerNumero(texto)
  const nova = parte && lido !== null && !Number.isNaN(lido) ? escalaPelaMedida(parte.largura, lido) : null

  async function guardar(valor: number | null) {
    setGuardando(true)
    setErro('')
    try {
      await aoGuardar(valor)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui guardar a escala.')
      setGuardando(false)
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Acertar a escala do molde"
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar} disabled={guardando}>
            Cancelar
          </Botao>
          {atual.origem === 'acertada' ? (
            <Botao disabled={guardando} onClick={() => void guardar(null)}>
              Tirar a escala acertada
            </Botao>
          ) : null}
          <Botao
            tom="primario"
            carregando={guardando}
            onClick={() => {
              if (!parte) return setErro('Escolha a parte que você mediu.')
              if (nova === null) return setErro('Digite quanto a parte mede, em centímetros. Só número.')
              void guardar(nova)
            }}
          >
            Guardar a escala
          </Botao>
        </>
      }
    >
      <div className="pd-form" data-acertar-escala="">
        <p className="pd-nota">
          Escolha uma parte e diga quanto ela mede de ponta a ponta, na largura. As outras medidas saem
          dela. A escala vale para este desenho: trocou o SVG, acerta de novo.
        </p>
        <div className="pd-campo">
          <span className="pd-campo-topo">Parte que você mediu</span>
          <Seletor
            campo
            bloco
            valor={chave}
            vazio="Escolha a parte"
            opcoes={partes.map(p => ({ valor: p.chave, rotulo: p.nome }))}
            aoEscolher={novo => {
              setChave(novo)
              setErro('')
            }}
          />
        </div>
        <label className="pd-campo">
          <span className="pd-campo-topo">
            Largura de verdade, em cm
            {parte ? <small>no desenho ela mede {medidaDoMolde(parte.largura, null)}</small> : null}
          </span>
          <Entrada
            inputMode="decimal"
            placeholder="55,0"
            value={texto}
            aria-invalid={!!erro}
            onChange={e => {
              setTexto(e.currentTarget.value)
              setErro('')
            }}
          />
        </label>
        {parte && nova ? (
          <p className="pd-nota" data-previa="">
            Com isso, {parte.nome} fica com {medidaDoMolde(parte.largura, nova)} cm de largura e{' '}
            {medidaDoMolde(parte.altura, nova)} cm de altura.
          </p>
        ) : null}
        {erro ? (
          <p className="pd-nota pd-erro" role="alert">
            {erro}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
