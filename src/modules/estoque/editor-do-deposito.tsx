import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as EventoDePonteiro, ReactNode } from 'react'
import {
  ArrowClockwise,
  ArrowUUpLeft,
  ArrowUUpRight,
  BoundingBox,
  Copy,
  Door,
  GridFour,
  ListNumbers,
  Package,
  PencilSimpleLine,
  Plus,
  Rows,
  Stairs,
  Trash,
} from '@phosphor-icons/react'
import {
  avisar,
  Aviso,
  Botao,
  BotaoComMenu,
  Campo,
  Entrada,
  type IconeDoPacote,
  Modal,
  Pagina,
  Segmentado,
  Seletor,
  TituloCartao,
} from '@ds'
import {
  ENCAIXE,
  MAIOR_LADO_DO_CHAO,
  ESPACO_DA_GRADE,
  MAXIMO_DA_GRADE,
  MAXIMO_DE_NIVEIS,
  MAXIMO_DE_VAOS,
  MENOR_LADO_DO_CHAO,
  chaveDaCelula,
  conferirPlanta,
  contornoDaGrade,
  duasCasas,
  encaixar,
  girar,
  gradeDosPaletes,
  guardaMaterial,
  metros,
  maiorVaoDaGrade,
  montarGrade,
  mudarContagemDaGrade,
  nomeDoVao,
  novaEscada,
  novaPorta,
  novaPrateleira,
  novoPalete,
  partirNomeDePalete,
  plantasIguais,
  porDentroDoChao,
  quemPerdeOLugar,
  salvarDeposito,
  sobrepoe,
  type Grade,
  type LugarDoMaterial,
  type Movel,
  type OrdemDosNomes,
  type Planta,
} from '@dominio/deposito'
import type { Material } from '@dominio/estoque'
import { lerNumero } from '@dominio/ferramentas'
import { usarConsulta } from '@shared'
import { plural } from './apoio'
import { nomeEmDuas } from './deposito'
import { Grupo, Nv } from './frente'
import {
  DesenhoDaPlanta,
  SelecaoDaGrade,
  SelecaoDoMovel,
  escalaQueCabe,
  metrosDoPonteiro,
  usarLarguraDe,
  type Alca,
  type EstadoDoLugar,
} from './planta'

/* ==========================================================================
   O editor do depósito.

   A pessoa monta o chão e põe em cima dele as prateleiras, os paletes e a
   escada, dá nome a cada coisa, e volta aqui sempre que o estoque for
   arrumado de outro jeito.

   O EDITOR MEXE NUMA CÓPIA. Nada vale para o Estoque antes do Salvar, e o
   Salvar grava o desenho inteiro de uma vez. Descartar devolve o que estava.

   ARRASTAR MOVE, AS ALÇAS MUDAM O TAMANHO, E TUDO ENCAIXA DE 10 EM 10 CM. O
   que a pessoa digita no painel vale como digitou: a medida exata se escreve,
   não se arrasta.

   NINGUÉM PERDE O LUGAR SEM SABER. Se o desenho novo tira o lugar de algum
   material (a prateleira saiu, os vãos diminuíram), o Salvar pergunta antes.
   ========================================================================== */

const CHAO_NOVO: Planta = { id: '', nome: 'Depósito', largura: 15, fundo: 10, moveis: [] }
const MENOR_PECA = 0.3
/** mudanças com menos disto de intervalo são o mesmo passo do desfazer, em ms */
const JUNTA_DO_DESFAZER = 800
const PASSOS_DO_DESFAZER = 200
/** o maior vão que a grade aceita entre um palete e o vizinho, em metros */
const MAIOR_VAO_DA_GRADE = 10
const USOS = ['Tecido', 'Aviamentos', 'Insumo', 'Aviamentos e insumos', 'Retalhos', 'Outros']

function novoId(): string {
  return crypto.randomUUID()
}

type Arrasto =
  | {
      tipo: 'mover'
      ids: string[]
      inicio: { x: number; y: number }
      originais: Map<string, Movel>
      andou: boolean
    }
  | { tipo: 'alca'; id: string; alca: Alca; inicio: { x: number; y: number }; original: Movel }
  | { tipo: 'canto'; grade: Grade; alca: Alca; inicio: { x: number; y: number }; planta: Planta }

export function EditorDoDeposito({
  sub,
  plantaInicial,
  lugares,
  materiais,
  aoSair,
  aoSalvar,
}: {
  sub: ReactNode
  plantaInicial: Planta | null
  lugares: LugarDoMaterial[]
  materiais: Material[]
  /** sai do editor; `aba` é para onde a pessoa pediu para ir */
  aoSair: (aba: 'materiais' | 'razao' | 'deposito' | 'uso') => void
  aoSalvar: () => Promise<void>
}) {
  const original = useMemo(() => plantaInicial ?? CHAO_NOVO, [plantaInicial])
  const [p, porPlanta] = useState<Planta>(original)
  const [escolhido, setEscolhido] = useState('')

  /* DESFAZER E REFAZER (pedido do Henrique, 05/10/2026: "quero capacidade de dar
     Ctrl+Z na edição do depósito"). Toda mudança do desenho passa por `setP`,
     que guarda como ele estava antes.

     UM GESTO É UM PASSO. Arrastar uma peça escreve o desenho dezenas de vezes
     e escrever "12,5" num campo escreve quatro: desfazer devolve o desenho de
     antes do arrasto, ou de antes da pessoa começar a escrever, e não um
     pedaço do caminho. O arrasto inteiro é um passo; fora dele, o que vem com
     menos de 800 ms de intervalo se junta ao passo anterior.

     O que já foi salvo não volta: a história é desta sessão do editor. */
  const atual = useRef(original)
  const historia = useRef({
    passado: [] as Planta[],
    futuro: [] as Planta[],
    quando: 0,
    arrasto: null as Arrasto | null,
  })
  const [passos, setPassos] = useState({ atras: 0, adiante: 0 })
  function setP(acao: Planta | ((antes: Planta) => Planta)) {
    const antes = atual.current
    const novo = typeof acao === 'function' ? acao(antes) : acao
    if (novo === antes || plantasIguais(novo, antes)) {
      /* mudança que não muda o desenho não vira passo */
      if (novo !== antes) {
        atual.current = novo
        porPlanta(novo)
      }
      return
    }
    const h = historia.current
    const agora = Date.now()
    const noMesmoArrasto = arrasto.current !== null && h.arrasto === arrasto.current
    if (!noMesmoArrasto && (arrasto.current !== null || agora - h.quando > JUNTA_DO_DESFAZER)) {
      h.passado.push(antes)
      if (h.passado.length > PASSOS_DO_DESFAZER) h.passado.shift()
    }
    h.arrasto = arrasto.current
    h.quando = agora
    h.futuro = []
    atual.current = novo
    porPlanta(novo)
    setPassos({ atras: h.passado.length, adiante: h.futuro.length })
  }
  function andarNaHistoria(para: 'atras' | 'adiante') {
    const h = historia.current
    const destino = para === 'atras' ? h.passado.pop() : h.futuro.pop()
    if (!destino) return
    ;(para === 'atras' ? h.futuro : h.passado).push(atual.current)
    /* o próximo gesto é um passo novo, e o campo com foco relê o desenho */
    h.quando = 0
    h.arrasto = null
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    atual.current = destino
    porPlanta(destino)
    setEscolhido(id => (destino.moveis.some(m => m.id === id) ? id : ''))
    setFalha('')
    setPassos({ atras: h.passado.length, adiante: h.futuro.length })
  }
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')
  /* as duas perguntas: descartar o que mudou, e soltar quem perderia o lugar */
  const [saindoPara, setSaindoPara] = useState<'' | 'materiais' | 'razao' | 'deposito' | 'uso'>('')
  const [confirmarPerda, setConfirmarPerda] = useState<string[] | null>(null)
  const arrasto = useRef<Arrasto | null>(null)
  const [arrastando, setArrastando] = useState(false)

  const estreita = usarConsulta('(max-width: 1099px)')
  const [moldura, larguraDisponivel] = usarLarguraDe<HTMLDivElement>()
  const S = escalaQueCabe(p, larguraDisponivel, true, 56)

  const mudou = !plantasIguais(p, original)
  const movel = p.moveis.find(m => m.id === escolhido) ?? null
  const grade =
    movel && movel.tipo === 'palete' && movel.grade ? gradeDosPaletes(p, movel.grade) : null
  const erro = conferirPlanta(p)

  const porMovel = useMemo(() => {
    const n = new Map<string, number>()
    for (const l of lugares) n.set(l.movelId, (n.get(l.movelId) ?? 0) + 1)
    return n
  }, [lugares])

  /* ---------- mexer no desenho -------------------------------------------- */
  const trocar = (id: string, mudanca: Partial<Movel>) =>
    setP(antes => ({
      ...antes,
      moveis: antes.moveis.map(m => (m.id === id ? { ...m, ...mudanca } : m)),
    }))

  function por(novo: Movel) {
    setP(antes => ({ ...antes, moveis: [...antes.moveis, novo] }))
    setEscolhido(novo.id)
    setFalha('')
  }

  function porGrade() {
    const id = novoId()
    const g: Grade = {
      id,
      x: 0.5,
      y: 0.5,
      fileiras: 2,
      colunas: 3,
      largura: 1.2,
      fundo: 1.2,
      espacoX: ESPACO_DA_GRADE,
      espacoY: ESPACO_DA_GRADE,
    }
    /* a grade nasce onde couber: desce de meio em meio metro até não pisar em ninguém */
    const contorno = contornoDaGrade(g)
    let achou = false
    for (let y = 0.5; !achou && y + contorno.fundo <= p.fundo; y = duasCasas(y + 0.5)) {
      for (let x = 0.5; !achou && x + contorno.largura <= p.largura; x = duasCasas(x + 0.5)) {
        if (!p.moveis.some(m => sobrepoe({ ...contorno, x, y }, m))) {
          g.x = x
          g.y = y
          achou = true
        }
      }
    }
    const moveis = montarGrade(p, g, { novoId, renomear: true, comecaEm: proximoNumeroDePalete(p) })
    const primeiro = moveis.find(m => m.grade === id)
    if (!primeiro) {
      avisar('Não achei espaço livre no chão para uma grade de paletes.', 'info')
      return
    }
    setP({ ...p, moveis })
    setEscolhido(primeiro.id)
  }

  function apagar(ids: string[]) {
    setP(antes => ({ ...antes, moveis: antes.moveis.filter(m => !ids.includes(m.id)) }))
    setEscolhido('')
  }

  function duplicar(m: Movel) {
    const copia: Movel = porDentroDoChao(
      {
        ...m,
        id: novoId(),
        grade: '',
        nome:
          m.tipo === 'palete'
            ? novoPalete(p, '').nome
            : m.tipo === 'prateleira'
              ? novaPrateleira(p, '').nome
              : m.nome + ' 2',
        nomesDosVaos: [],
        x: encaixar(m.x + 0.5),
        y: encaixar(m.y + 0.5),
      },
      p,
    )
    por(copia)
  }

  /* MAIS OU MENOS FILEIRAS E COLUNAS. Quando o chão não dá para estender, a
     grade reparte os paletes no espaço que já ocupa; e o que não coube é dito,
     em vez de o campo voltar ao número de antes sem explicação. */
  function contarGrade(g: Grade, eixo: 'fileiras' | 'colunas', quantos: number) {
    const m = mudarContagemDaGrade(p, g, eixo, quantos)
    const nome = eixo === 'fileiras' ? 'fileiras' : 'colunas'
    const lado = metros(eixo === 'fileiras' ? g.fundo : g.largura)
    if (m.como === 'nao-cabe') {
      avisar(
        `Não cabem ${quantos} ${nome} de ${lado} m daqui até a parede, nem com os paletes encostados. Arraste a grade para mais longe da parede ou diminua o palete.`,
        'warn',
        7,
      )
      return
    }
    if (m.como === 'repartiu' || m.como === 'ate-a-parede') {
      avisar(
        m.como === 'repartiu'
          ? `Não havia chão para estender: as ${quantos} ${nome} foram repartidas no espaço que a grade já ocupava. O vão entre elas passou de ${metros(m.antes)} para ${metros(m.depois)} m.`
          : `Não havia chão para estender: as ${quantos} ${nome} foram até a parede, e o vão entre elas passou de ${metros(m.antes)} para ${metros(m.depois)} m.`,
        'info',
        7,
      )
    }
    refazerGrade(m.grade)
  }

  /* O VÃO QUE NÃO CABE vira o maior que cabe, e a tela diz. Antes, um vão
     grande demais empurrava a última coluna para fora do chão e ela sumia. */
  function espacarGrade(g: Grade, eixo: 'espacoX' | 'espacoY', vao: number) {
    const maior = maiorVaoDaGrade(p, g, eixo)
    if (vao > maior + 0.001) {
      const n = eixo === 'espacoX' ? g.colunas : g.fileiras
      avisar(
        `Com ${n} ${eixo === 'espacoX' ? 'colunas' : 'fileiras'}, o maior vão que cabe daqui até a parede é ${metros(maior)} m.`,
        'info',
        7,
      )
    }
    refazerGrade({ ...g, [eixo]: Math.min(vao, maior) })
  }

  function refazerGrade(
    g: Grade,
    opcoes: { renomear?: boolean; prefixo?: string; comecaEm?: number; ordem?: OrdemDosNomes } = {},
  ) {
    /* o que cairia fora do chão ou em cima de outra peça não nasce. Quando uma
       fileira ou uma coluna inteira fica de fora, a conta do painel volta para
       o que existe: dizer isso, em vez de o número mudar calado. */
    const ficou = gradeDosPaletes({ ...p, moveis: montarGrade(p, g, { novoId, ...opcoes }) }, g.id)
    if (ficou && (ficou.fileiras < g.fileiras || ficou.colunas < g.colunas)) {
      avisar(
        `Nem tudo coube: a grade ficou com ${ficou.fileiras} por ${ficou.colunas}. O que cairia fora do chão ou inteiro em cima de outra peça não foi criado.`,
        'warn',
        7,
      )
    }
    setP(antes => {
      const moveis = montarGrade(antes, g, { novoId, ...opcoes })
      /* o palete escolhido pode ter saído da grade: escolhe outro dela */
      if (!moveis.some(m => m.id === escolhido)) {
        const outro = moveis.find(m => m.grade === g.id)
        setEscolhido(outro?.id ?? '')
      }
      return { ...antes, moveis }
    })
  }

  /* ---------- o ponteiro --------------------------------------------------- */
  function aoPegarMovel(m: Movel, e: EventoDePonteiro<SVGGElement>) {
    if (e.button !== 0) return
    e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    setEscolhido(m.id)
    setFalha('')
    const ids =
      m.tipo === 'palete' && m.grade
        ? p.moveis.filter(x => x.grade === m.grade).map(x => x.id)
        : [m.id]
    arrasto.current = {
      tipo: 'mover',
      ids,
      inicio: metrosDoPonteiro(e, svg, S),
      originais: new Map(p.moveis.filter(x => ids.includes(x.id)).map(x => [x.id, x])),
      andou: false,
    }
  }

  function aoPegarAlca(a: Alca, e: EventoDePonteiro<SVGRectElement>) {
    if (!movel || e.button !== 0) return
    e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    arrasto.current = {
      tipo: 'alca',
      id: movel.id,
      alca: a,
      inicio: metrosDoPonteiro(e, svg, S),
      original: movel,
    }
    setArrastando(true)
  }

  function aoPegarCanto(a: Alca, e: EventoDePonteiro<SVGRectElement>) {
    if (!grade || e.button !== 0) return
    e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    arrasto.current = {
      tipo: 'canto',
      grade,
      alca: a,
      inicio: metrosDoPonteiro(e, svg, S),
      planta: p,
    }
    setArrastando(true)
  }

  function aoMover(e: EventoDePonteiro<SVGSVGElement>) {
    const a = arrasto.current
    if (!a) return
    const agora = metrosDoPonteiro(e, e.currentTarget, S)
    const dx = agora.x - a.inicio.x
    const dy = agora.y - a.inicio.y

    if (a.tipo === 'mover') {
      if (!a.andou && Math.abs(dx) * S < 3 && Math.abs(dy) * S < 3) return
      a.andou = true
      setArrastando(true)
      /* o grupo anda junto, e para quando o primeiro dele encosta na parede */
      const todos = [...a.originais.values()]
      const x0 = Math.min(...todos.map(m => m.x))
      const y0 = Math.min(...todos.map(m => m.y))
      const x1 = Math.max(...todos.map(m => m.x + m.largura))
      const y1 = Math.max(...todos.map(m => m.y + m.fundo))
      /* O EIXO QUE NÃO ANDOU NÃO ENCAIXA. Uma prateleira a 25 cm da parede,
         arrastada só para o lado, pulava 5 cm para a frente porque o encaixe
         de 10 cm valia para os dois eixos. Agora só encaixa o eixo que a mão
         levou mais de meio encaixe. */
      const andar = (de: number, quanto: number) =>
        Math.abs(quanto) < ENCAIXE / 2 ? 0 : encaixar(de + quanto) - de
      const passoX = Math.min(Math.max(andar(x0, dx), -x0), p.largura - x1)
      const passoY = Math.min(Math.max(andar(y0, dy), -y0), p.fundo - y1)
      setP(antes => ({
        ...antes,
        moveis: antes.moveis.map(m => {
          const o = a.originais.get(m.id)
          return o ? { ...m, x: duasCasas(o.x + passoX), y: duasCasas(o.y + passoY) } : m
        }),
      }))
      return
    }

    if (a.tipo === 'alca') {
      const o = a.original
      let x = o.x
      let y = o.y
      let direita = o.x + o.largura
      let baixo = o.y + o.fundo
      /* o canto puxado só para o lado não mexe na borda de cima nem na de baixo */
      const puxar = (de: number, quanto: number) =>
        Math.abs(quanto) < ENCAIXE / 2 ? de : encaixar(de + quanto)
      if (a.alca.hx === -1) x = Math.min(Math.max(0, puxar(o.x, dx)), direita - MENOR_PECA)
      if (a.alca.hx === 1)
        direita = Math.max(Math.min(p.largura, puxar(direita, dx)), x + MENOR_PECA)
      if (a.alca.hy === -1) y = Math.min(Math.max(0, puxar(o.y, dy)), baixo - MENOR_PECA)
      if (a.alca.hy === 1) baixo = Math.max(Math.min(p.fundo, puxar(baixo, dy)), y + MENOR_PECA)
      trocar(a.id, {
        x: duasCasas(x),
        y: duasCasas(y),
        largura: duasCasas(direita - x),
        fundo: duasCasas(baixo - y),
      })
      return
    }

    /* o canto da grade muda o espaço entre os paletes: o canto oposto fica onde está */
    const g = a.grade
    const c = contornoDaGrade(g)
    const larguraNova = c.largura + (a.alca.hx === 1 ? dx : -dx)
    const fundoNovo = c.fundo + (a.alca.hy === 1 ? dy : -dy)
    const porX = g.colunas > 1 ? (larguraNova - g.colunas * g.largura) / (g.colunas - 1) : null
    const porY = g.fileiras > 1 ? (fundoNovo - g.fileiras * g.fundo) / (g.fileiras - 1) : null
    /* cada eixo com o seu vão: esticar para o lado não afasta as fileiras */
    const vao = (bruto: number | null, deHoje: number) =>
      bruto === null ? deHoje : Math.min(Math.max(0, encaixar(bruto)), MAIOR_VAO_DA_GRADE)
    const novo: Grade = { ...g, espacoX: vao(porX, g.espacoX), espacoY: vao(porY, g.espacoY) }
    const cn = contornoDaGrade(novo)
    if (a.alca.hx === -1) novo.x = duasCasas(c.x + c.largura - cn.largura)
    if (a.alca.hy === -1) novo.y = duasCasas(c.y + c.fundo - cn.fundo)
    if (novo.x < 0 || novo.y < 0) return
    setP({ ...a.planta, moveis: montarGrade(a.planta, novo, { novoId }) })
  }

  function aoSoltar(e: EventoDePonteiro<SVGSVGElement>) {
    if (!arrasto.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    arrasto.current = null
    /* o arrasto acabou: o que vier depois é outro passo do desfazer */
    historia.current.quando = 0
    historia.current.arrasto = null
    setArrastando(false)
  }

  function aoTeclarNoMovel(m: Movel, e: KeyboardEvent<SVGGElement>) {
    const passo = e.shiftKey ? 1 : ENCAIXE
    const anda: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo],
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setEscolhido(m.id)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      apagar([m.id])
      return
    }
    const d = anda[e.key]
    if (!d) return
    e.preventDefault()
    setEscolhido(m.id)
    const ids =
      m.tipo === 'palete' && m.grade
        ? p.moveis.filter(x => x.grade === m.grade).map(x => x.id)
        : [m.id]
    setP(antes => {
      const grupo = antes.moveis.filter(x => ids.includes(x.id))
      const cabe = grupo.every(
        x =>
          x.x + d[0] >= -0.001 &&
          x.y + d[1] >= -0.001 &&
          x.x + x.largura + d[0] <= antes.largura + 0.001 &&
          x.y + x.fundo + d[1] <= antes.fundo + 0.001,
      )
      if (!cabe) return antes
      return {
        ...antes,
        moveis: antes.moveis.map(x =>
          ids.includes(x.id) ? { ...x, x: duasCasas(x.x + d[0]), y: duasCasas(x.y + d[1]) } : x,
        ),
      }
    })
  }

  /* ---------- salvar e sair ------------------------------------------------ */
  async function gravar(soltar: boolean) {
    if (gravando) return
    setGravando(true)
    setFalha('')
    try {
      await salvarDeposito(p, soltar)
      avisar('Depósito salvo.', 'ok')
      await aoSalvar()
      aoSair('deposito')
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui salvar o depósito.')
    } finally {
      setGravando(false)
      setConfirmarPerda(null)
    }
  }

  function salvar() {
    if (erro) {
      setFalha(erro)
      return
    }
    const perdem = quemPerdeOLugar(p, lugares)
    if (perdem.length) {
      setConfirmarPerda(perdem)
      return
    }
    void gravar(false)
  }

  function sair(aba: 'materiais' | 'razao' | 'deposito' | 'uso') {
    if (mudou) setSaindoPara(aba)
    else aoSair(aba)
  }

  /* Esc solta a peça escolhida, e Delete apaga. O Delete vale com o foco em
     qualquer lugar que não seja um campo: quem acabou de clicar em "Palete"
     está com o foco no botão, e não na peça que nasceu. */
  useEffect(() => {
    const ouvir = (e: globalThis.KeyboardEvent) => {
      if (saindoPara || confirmarPerda) return
      /* Ctrl+Z desfaz e Ctrl+Shift+Z (ou Ctrl+Y) refaz, com o foco em qualquer
         lugar: dentro de um campo também, porque o campo escreve no desenho */
      const comCtrl = (e.ctrlKey || e.metaKey) && !e.altKey
      const tecla = e.key.toLowerCase()
      if (comCtrl && (tecla === 'z' || tecla === 'y')) {
        e.preventDefault()
        andarNaHistoria(tecla === 'z' && !e.shiftKey ? 'atras' : 'adiante')
        return
      }
      if (e.key === 'Escape') setEscolhido('')
      if (e.key === 'Delete' && escolhido && !e.defaultPrevented) {
        const alvo = e.target instanceof HTMLElement ? e.target : null
        if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)))
          return
        e.preventDefault()
        apagar([escolhido])
      }
    }
    window.addEventListener('keydown', ouvir)
    return () => window.removeEventListener('keydown', ouvir)
  }, [saindoPara, confirmarPerda, escolhido])

  const escolhidos = useMemo(() => new Set(escolhido ? [escolhido] : []), [escolhido])

  /* O DESENHO DO EDITOR CONTINUA DIZENDO ONDE HÁ MATERIAL: quem arruma o
     depósito precisa ver o que está ocupado antes de mexer numa peça. */
  const { estados, comprar } = useMemo(() => {
    const e = new Map<string, EstadoDoLugar>()
    const c = new Set<string>()
    const porId = new Map(materiais.map(m => [m.id, m]))
    for (const l of lugares) {
      const mv = p.moveis.find(m => m.id === l.movelId)
      if (!mv || !guardaMaterial(mv) || (l.vao !== null && l.vao > mv.vaos)) continue
      const chave = chaveDaCelula(l.movelId, mv.tipo === 'prateleira' ? l.vao : null)
      e.set(chave, 'tem')
      const m = porId.get(l.materialId)
      if (m && m.livre < m.minimo) c.add(chave)
    }
    return { estados: e, comprar: c }
  }, [lugares, materiais, p.moveis])
  const emCima = movel ? p.moveis.filter(m => m.id !== movel.id && sobrepoe(movel, m)) : []

  const porCima =
    arrasto.current?.tipo === 'mover' && arrastando ? null : grade ? (
      <SelecaoDaGrade planta={p} gradeId={grade.id} escala={S} aoPegarCanto={aoPegarCanto} />
    ) : movel ? (
      <SelecaoDoMovel movel={movel} escala={S} aoPegarAlca={aoPegarAlca} />
    ) : null

  const nomesDosQuePerdem = (confirmarPerda ?? [])
    .map(id => materiais.find(m => m.id === id))
    .filter((m): m is Material => !!m)
    .map(m => nomeEmDuas(m).filter(Boolean).join(' · '))

  return (
    <Pagina
      acima="Materiais"
      titulo="Estoque"
      sub={sub}
      acoes={
        <>
          <Botao onClick={() => sair('deposito')}>Descartar</Botao>
          <Botao
            tom="primario"
            onClick={salvar}
            disabled={!mudou || gravando}
            carregando={gravando}
          >
            {gravando ? 'Salvando' : 'Salvar o depósito'}
          </Botao>
        </>
      }
    >
      <div className="es-barra">
        <Segmentado
          className="es-aba"
          valor="deposito"
          aoMudar={(a: 'materiais' | 'razao' | 'deposito' | 'uso') => sair(a)}
          opcoes={[
            { valor: 'materiais', rotulo: 'Materiais' },
            { valor: 'razao', rotulo: 'Movimentos' },
            { valor: 'deposito', rotulo: 'Depósito' },
            { valor: 'uso', rotulo: 'Estatísticas' },
          ]}
        />
        <span className="dp-selo-editando es-ver">editando o depósito</span>
      </div>

      {falha ? <Aviso tom="brand">{falha}</Aviso> : null}

      <div className={estreita ? 'dp-tela editor estreita' : 'dp-tela editor'}>
        <section className="cartao dp-cartao" data-mapa="">
          <div className="dp-topo ferramentas">
            <TituloCartao icone={PencilSimpleLine}>
              Editando o depósito
              <small>
                {metros(p.largura)} × {metros(p.fundo)} m
              </small>
            </TituloCartao>
            <span className="dp-desfazer">
              <Botao
                tamanho="sm"
                icone
                aria-label="Desfazer"
                title="Desfazer (Ctrl+Z)"
                disabled={passos.atras === 0}
                onClick={() => andarNaHistoria('atras')}
              >
                <ArrowUUpLeft size={16} aria-hidden="true" />
              </Botao>
              <Botao
                tamanho="sm"
                icone
                aria-label="Refazer"
                title="Refazer (Ctrl+Shift+Z)"
                disabled={passos.adiante === 0}
                onClick={() => andarNaHistoria('adiante')}
              >
                <ArrowUUpRight size={16} aria-hidden="true" />
              </Botao>
            </span>
            <div className="dp-ferramentas">
              <Botao tamanho="sm" onClick={() => por(novaPrateleira(p, novoId()))}>
                <Plus size={15} aria-hidden="true" />
                Prateleira
              </Botao>
              <Botao tamanho="sm" onClick={() => por(novoPalete(p, novoId()))}>
                <Plus size={15} aria-hidden="true" />
                Palete
              </Botao>
              <Botao tamanho="sm" onClick={porGrade}>
                <Plus size={15} aria-hidden="true" />
                Grade de paletes
              </Botao>
              <BotaoComMenu
                valor="Escada ou porta"
                titulo="Pôr uma escada ou uma porta"
                tamanho="sm"
              >
                {fechar => (
                  <div className="mn-lista">
                    <button
                      type="button"
                      className="mn-item"
                      onClick={() => {
                        fechar()
                        por(novaEscada(p, novoId()))
                      }}
                    >
                      <span className="nm">Escada</span>
                    </button>
                    <button
                      type="button"
                      className="mn-item"
                      onClick={() => {
                        fechar()
                        por(novaPorta(p, novoId()))
                      }}
                    >
                      <span className="nm">Porta</span>
                    </button>
                  </div>
                )}
              </BotaoComMenu>
              <Botao tamanho="sm" onClick={() => setEscolhido('')}>
                Tamanho do chão
              </Botao>
            </div>
          </div>
          <div className="dp-area">
            <div
              ref={moldura}
              className={arrastando ? 'dp-moldura-da-planta arrastando' : 'dp-moldura-da-planta'}
            >
              {S > 0 ? (
                <DesenhoDaPlanta
                  planta={p}
                  escala={S}
                  estados={estados}
                  comprar={comprar}
                  escolhidos={escolhidos}
                  aoPegarMovel={aoPegarMovel}
                  aoTeclarNoMovel={aoTeclarNoMovel}
                  aoApertar={() => setEscolhido('')}
                  aoMover={aoMover}
                  aoSoltar={aoSoltar}
                  porCima={porCima}
                  aviso={
                    p.moveis.length
                      ? undefined
                      : [
                          'O chão está vazio',
                          'Escolha em cima o que pôr: prateleira, palete, grade de paletes ou a escada.',
                        ]
                  }
                  rotulo="Editor do depósito: arraste as peças para mover"
                />
              ) : null}
            </div>
          </div>
          <div className="dp-pe">
            <p className="dp-nota">
              {grade
                ? 'A linha tracejada é a grade inteira: arraste um canto para mudar o espaço entre os paletes. Um clique num palete escolhe só ele.'
                : movel
                  ? 'Arraste para mover e puxe as alças para mudar o tamanho. Tudo encaixa de 10 em 10 cm; a medida exata se escreve ao lado.'
                  : p.moveis.length
                    ? 'Clique numa prateleira, num palete ou na escada para escolher. O que está escolhido aparece ao lado, com o nome e as medidas.'
                    : 'O depósito começa só com o chão. Nada vale para o Estoque enquanto você não salvar.'}
            </p>
          </div>
        </section>

        <div className="dp-pilha">
          {emCima.length && movel ? (
            <Aviso tom="warn">
              {movel.nome} está em cima de {emCima.map(m => m.nome).join(', ')}.
            </Aviso>
          ) : null}
          {grade && movel ? (
            <>
              <PainelDaGrade
                grade={grade}
                membros={p.moveis.filter(m => m.grade === grade.id)}
                aoMudar={refazerGrade}
                aoContar={(eixo, quantos) => contarGrade(grade, eixo, quantos)}
                aoEspacar={(eixo, vao) => espacarGrade(grade, eixo, vao)}
                aoDesmanchar={() =>
                  setP(antes => ({
                    ...antes,
                    moveis: antes.moveis.map(m => (m.grade === grade.id ? { ...m, grade: '' } : m)),
                  }))
                }
                aoApagar={() => apagar(p.moveis.filter(m => m.grade === grade.id).map(m => m.id))}
              />
              <PainelDoPalete
                key={movel.id}
                movel={movel}
                daGrade
                guardados={porMovel.get(movel.id) ?? 0}
                aoMudar={mudanca => trocar(movel.id, mudanca)}
                aoTirarDaGrade={() => trocar(movel.id, { grade: '' })}
                aoApagar={() => apagar([movel.id])}
              />
            </>
          ) : movel && movel.tipo === 'prateleira' ? (
            <PainelDaPrateleira
              key={movel.id}
              movel={movel}
              guardados={porMovel.get(movel.id) ?? 0}
              aoMudar={mudanca => trocar(movel.id, mudanca)}
              aoGirar={() => trocar(movel.id, girar(movel, p))}
              aoDuplicar={() => duplicar(movel)}
              aoApagar={() => apagar([movel.id])}
            />
          ) : movel && movel.tipo === 'palete' ? (
            <PainelDoPalete
              key={movel.id}
              movel={movel}
              guardados={porMovel.get(movel.id) ?? 0}
              aoMudar={mudanca => trocar(movel.id, mudanca)}
              aoDuplicar={() => duplicar(movel)}
              aoApagar={() => apagar([movel.id])}
            />
          ) : movel ? (
            <PainelDaPassagem
              key={movel.id}
              movel={movel}
              aoMudar={mudanca => trocar(movel.id, mudanca)}
              aoGirar={() => trocar(movel.id, girar(movel, p))}
              aoApagar={() => apagar([movel.id])}
            />
          ) : (
            <PainelDoChao
              planta={p}
              aoMudar={mudanca => setP(antes => ({ ...antes, ...mudanca }))}
            />
          )}
        </div>
      </div>

      <Modal
        aberto={!!saindoPara}
        aoFechar={() => setSaindoPara('')}
        titulo="Descartar as mudanças?"
        pe={
          <>
            <Botao onClick={() => setSaindoPara('')}>Continuar editando</Botao>
            <Botao tom="perigo" onClick={() => aoSair(saindoPara || 'deposito')}>
              Descartar
            </Botao>
          </>
        }
      >
        <p className="dp-nota grande">
          O desenho do depósito mudou e ainda não foi salvo. Se sair agora, ele volta a ser como
          estava.
        </p>
      </Modal>

      <Modal
        aberto={!!confirmarPerda}
        aoFechar={() => setConfirmarPerda(null)}
        titulo={
          confirmarPerda
            ? plural(confirmarPerda.length, 'material perde', 'materiais perdem') +
              ' o lugar marcado'
            : ''
        }
        pe={
          <>
            <Botao onClick={() => setConfirmarPerda(null)}>Voltar ao desenho</Botao>
            <Botao
              tom="perigo"
              onClick={() => void gravar(true)}
              disabled={gravando}
              carregando={gravando}
            >
              Salvar mesmo assim
            </Botao>
          </>
        }
      >
        <p className="dp-nota grande">
          Neste desenho o lugar onde eles estavam deixou de existir (a peça saiu, ou os vãos ou os
          níveis diminuíram). Eles continuam no estoque. Quem tinha outro lugar marcado continua
          nele; os outros ficam sem lugar e aparecem na lista para você marcar de novo.
        </p>
        {nomesDosQuePerdem.length ? (
          <ul className="dp-lista-simples">
            {nomesDosQuePerdem.slice(0, 6).map(n => (
              <li key={n}>{n}</li>
            ))}
            {nomesDosQuePerdem.length > 6 ? <li>e mais {nomesDosQuePerdem.length - 6}</li> : null}
          </ul>
        ) : null}
      </Modal>
    </Pagina>
  )
}

function proximoNumeroDePalete(p: Planta): number {
  let maior = 0
  for (const m of p.moveis) {
    if (m.tipo !== 'palete') continue
    const { prefixo, numero } = partirNomeDePalete(m.nome)
    if (prefixo === 'P' && numero > maior) maior = numero
  }
  return maior + 1
}

/* ---------- os campos -------------------------------------------------------
   O NÚMERO É DIGITADO COMO TEXTO: quem escreve "1," ainda não terminou, e um
   campo que apaga a vírgula no meio da digitação é um campo que briga com a
   pessoa. O valor só sobe quando o texto vira um número que vale. */
function CampoDeNumero({
  rotulo,
  valor,
  aoMudar,
  sufixo = '',
  minimo,
  maximo,
  inteiro,
  dica,
}: {
  rotulo: string
  valor: number
  aoMudar: (v: number) => void
  sufixo?: string
  minimo: number
  maximo: number
  inteiro?: boolean
  dica?: string
}) {
  const mostrar = (v: number) => metros(v)
  const [texto, setTexto] = useState(mostrar(valor))
  const [focado, setFocado] = useState(false)
  useEffect(() => {
    if (!focado) setTexto(mostrar(valor))
  }, [valor, focado])
  const n = lerNumero(texto.replace(/m$/i, ''))
  const ruim =
    n === null || Number.isNaN(n) || n < minimo || n > maximo || (!!inteiro && !Number.isInteger(n))
  return (
    <Campo
      rotulo={rotulo}
      erro={ruim}
      dica={ruim ? `De ${metros(minimo)} a ${metros(maximo)}${sufixo ? ' ' + sufixo : ''}.` : dica}
    >
      <span className="dp-com-sufixo">
        <Entrada
          value={texto}
          inputMode={inteiro ? 'numeric' : 'decimal'}
          aria-label={rotulo}
          aria-invalid={ruim}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          onChange={e => {
            const t = e.currentTarget.value
            setTexto(t)
            const v = lerNumero(t.replace(/m$/i, ''))
            if (
              v !== null &&
              !Number.isNaN(v) &&
              v >= minimo &&
              v <= maximo &&
              (!inteiro || Number.isInteger(v))
            )
              aoMudar(duasCasas(v))
          }}
        />
        {sufixo ? <i>{sufixo}</i> : null}
      </span>
    </Campo>
  )
}

function CampoDoUso({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  const opcoes = (USOS.includes(valor) || !valor ? USOS : [valor, ...USOS]).map(u => ({
    valor: u,
    rotulo: u,
  }))
  return (
    <Grupo rotulo="Para que serve">
      <Seletor campo bloco valor={valor} opcoes={opcoes} aoEscolher={aoMudar} vazio="Não dizer" />
    </Grupo>
  )
}

function Caixa({
  titulo,
  icone,
  selo,
  children,
}: {
  titulo: string
  icone: IconeDoPacote
  selo?: string
  children: ReactNode
}) {
  return (
    <section className="cartao dp-cartao dp-painel">
      <div className="dp-topo">
        <TituloCartao icone={icone}>{titulo}</TituloCartao>
        {selo ? <span className="dp-conta">{selo}</span> : null}
      </div>
      <div className="dp-recheio dp-formulario">{children}</div>
    </section>
  )
}

function avisoDosGuardados(n: number): string {
  return n
    ? `${plural(n, 'material tem', 'materiais têm')} lugar marcado aqui. Se apagar, o Salvar pergunta antes.`
    : ''
}

/* ---------- o chão ---------------------------------------------------------- */
function PainelDoChao({
  planta,
  aoMudar,
}: {
  planta: Planta
  aoMudar: (m: Partial<Planta>) => void
}) {
  const tem = (tipo: Movel['tipo']) => planta.moveis.some(m => m.tipo === tipo)
  const passos: [string, string, boolean][] = [
    ['O chão', 'A largura e o fundo da sala, em metros.', true],
    [
      'A escada ou a porta',
      'Por onde se entra, para a pessoa se achar no desenho.',
      tem('escada') || tem('porta'),
    ],
    ['As prateleiras', 'Nome, medidas, quantos vãos e quantos níveis.', tem('prateleira')],
    ['Os paletes', 'Um por um, ou uma grade inteira de uma vez.', tem('palete')],
  ]
  const feitos = passos.filter(x => x[2]).length
  return (
    <>
      <Caixa
      titulo="O chão do depósito"
      icone={BoundingBox}
      selo={feitos < 4 ? `passo ${feitos} de 4` : undefined}>
        <Campo rotulo="Nome do depósito">
          <Entrada
            value={planta.nome}
            onChange={e => aoMudar({ nome: e.currentTarget.value })}
            aria-label="Nome do depósito"
          />
        </Campo>
        <div className="dp-dois">
          <CampoDeNumero
            rotulo="Largura"
            sufixo="m"
            valor={planta.largura}
            minimo={MENOR_LADO_DO_CHAO}
            maximo={MAIOR_LADO_DO_CHAO}
            aoMudar={v => aoMudar({ largura: v })}
          />
          <CampoDeNumero
            rotulo="Fundo"
            sufixo="m"
            valor={planta.fundo}
            minimo={MENOR_LADO_DO_CHAO}
            maximo={MAIOR_LADO_DO_CHAO}
            aoMudar={v => aoMudar({ fundo: v })}
          />
        </div>
        <p className="dp-nota">
          Dá para mudar depois: o que já estiver no chão fica onde está. A grade do desenho tem 1 m.
        </p>
      </Caixa>
      <Caixa titulo="Como montar" icone={ListNumbers}>
        {passos.map(([nome, texto, feito], i) => (
          <div key={nome} className="dp-passo-linha">
            <span className={feito ? 'dp-passo feito' : 'dp-passo falta'}>{i + 1}</span>
            <span className="dp-texto">
              <b>{nome}</b>
              <small>{texto}</small>
            </span>
          </div>
        ))}
        <p className="dp-nota">
          Conforme o estoque for sendo arrumado, é só voltar aqui, mexer e salvar. O lugar marcado
          em cada material acompanha.
        </p>
      </Caixa>
    </>
  )
}

/* ---------- a prateleira ----------------------------------------------------- */
function PainelDaPrateleira({
  movel,
  guardados,
  aoMudar,
  aoGirar,
  aoDuplicar,
  aoApagar,
}: {
  movel: Movel
  guardados: number
  aoMudar: (m: Partial<Movel>) => void
  aoGirar: () => void
  aoDuplicar: () => void
  aoApagar: () => void
}) {
  /* comprimento é o lado por onde os vãos correm, esteja a prateleira deitada ou em pé */
  const comprimento = movel.emPe ? movel.fundo : movel.largura
  const profundidade = movel.emPe ? movel.largura : movel.fundo
  const niveis = Array.from({ length: movel.niveis }, (_, i) => movel.niveis - i)
  return (
    <Caixa titulo={'Prateleira ' + movel.nome} icone={Rows} selo="escolhida">
      <div className="dp-dois">
        <Campo rotulo="Nome">
          <Entrada
            value={movel.nome}
            onChange={e => aoMudar({ nome: e.currentTarget.value })}
            aria-label="Nome da prateleira"
          />
        </Campo>
        <CampoDoUso valor={movel.uso} aoMudar={uso => aoMudar({ uso })} />
      </div>
      <div className="dp-dois">
        <CampoDeNumero
          rotulo="Comprimento"
          sufixo="m"
          valor={comprimento}
          minimo={MENOR_PECA}
          maximo={MAIOR_LADO_DO_CHAO}
          aoMudar={v => aoMudar(movel.emPe ? { fundo: v } : { largura: v })}
        />
        <CampoDeNumero
          rotulo="Profundidade"
          sufixo="m"
          valor={profundidade}
          minimo={MENOR_PECA}
          maximo={MAIOR_LADO_DO_CHAO}
          aoMudar={v => aoMudar(movel.emPe ? { largura: v } : { fundo: v })}
        />
      </div>
      <div className="dp-dois">
        <CampoDeNumero
          rotulo="Vãos"
          inteiro
          valor={movel.vaos}
          minimo={1}
          maximo={MAXIMO_DE_VAOS}
          aoMudar={v => aoMudar({ vaos: v, nomesDosVaos: movel.nomesDosVaos.slice(0, v) })}
        />
        <CampoDeNumero
          rotulo="Níveis"
          inteiro
          valor={movel.niveis}
          minimo={1}
          maximo={MAXIMO_DE_NIVEIS}
          aoMudar={v => aoMudar({ niveis: v })}
        />
      </div>
      <Grupo rotulo="O nome de cada vão">
        <div className="dp-nomes-dos-vaos">
          {Array.from({ length: movel.vaos }, (_, i) => (
            <Entrada
              key={i}
              tamanho="sm"
              value={movel.nomesDosVaos[i] ?? ''}
              placeholder={movel.nome + (i + 1)}
              aria-label={'Nome do vão ' + (i + 1)}
              onChange={e => {
                const nomes = Array.from(
                  { length: movel.vaos },
                  (_, k) => movel.nomesDosVaos[k] ?? '',
                )
                nomes[i] = e.currentTarget.value
                aoMudar({ nomesDosVaos: nomes })
              }}
            />
          ))}
        </div>
      </Grupo>
      <Grupo rotulo="A cor de cada nível">
        <div className="dp-cores-dos-niveis">
          {niveis.map(n => (
            <span key={n} className="dp-cor-do-nivel">
              <Nv nivel={n} />
              nível {n}
              {n === 1 && movel.niveis > 1
                ? ' · embaixo'
                : n === movel.niveis && movel.niveis > 1
                  ? ' · em cima'
                  : ''}
            </span>
          ))}
        </div>
      </Grupo>
      <p className="dp-nota">
        Fica a {metros(movel.x)} m da parede da esquerda e a {metros(movel.y)} m da parede de cima
        do desenho. O lugar de um material nela fica {nomeDoVao(movel, Math.min(2, movel.vaos))}-
        {Math.min(3, movel.niveis)}: o vão e o nível.
      </p>
      <div className="dp-botoes">
        <Botao onClick={aoGirar}>
          <ArrowClockwise size={16} aria-hidden="true" />
          Girar
        </Botao>
        <Botao onClick={aoDuplicar}>
          <Copy size={16} aria-hidden="true" />
          Duplicar
        </Botao>
        <Botao onClick={aoApagar}>
          <Trash size={16} aria-hidden="true" />
          Apagar
        </Botao>
      </div>
      {guardados ? <p className="dp-nota">{avisoDosGuardados(guardados)}</p> : null}
    </Caixa>
  )
}

/* ---------- o palete ---------------------------------------------------------- */
function PainelDoPalete({
  movel,
  daGrade,
  guardados,
  aoMudar,
  aoDuplicar,
  aoTirarDaGrade,
  aoApagar,
}: {
  movel: Movel
  daGrade?: boolean
  guardados: number
  aoMudar: (m: Partial<Movel>) => void
  aoDuplicar?: () => void
  aoTirarDaGrade?: () => void
  aoApagar: () => void
}) {
  return (
    <Caixa titulo={'Palete ' + movel.nome} icone={Package} selo="escolhido">
      <div className="dp-dois">
        <Campo rotulo="Nome">
          <Entrada
            value={movel.nome}
            onChange={e => aoMudar({ nome: e.currentTarget.value })}
            aria-label="Nome do palete"
          />
        </Campo>
        <CampoDoUso valor={movel.uso} aoMudar={uso => aoMudar({ uso })} />
      </div>
      {daGrade ? (
        <p className="dp-nota">
          Cada palete da grade pode ter o nome que você quiser, como "Dry fit 1" ou "Retalhos".
        </p>
      ) : (
        <div className="dp-dois">
          <CampoDeNumero
            rotulo="Largura"
            sufixo="m"
            valor={movel.largura}
            minimo={MENOR_PECA}
            maximo={MAIOR_LADO_DO_CHAO}
            aoMudar={v => aoMudar({ largura: v })}
          />
          <CampoDeNumero
            rotulo="Fundo"
            sufixo="m"
            valor={movel.fundo}
            minimo={MENOR_PECA}
            maximo={MAIOR_LADO_DO_CHAO}
            aoMudar={v => aoMudar({ fundo: v })}
          />
        </div>
      )}
      <div className="dp-botoes">
        {aoTirarDaGrade ? <Botao onClick={aoTirarDaGrade}>Tirar da grade</Botao> : null}
        {aoDuplicar ? (
          <Botao onClick={aoDuplicar}>
            <Copy size={16} aria-hidden="true" />
            Duplicar
          </Botao>
        ) : null}
        <Botao onClick={aoApagar}>
          <Trash size={16} aria-hidden="true" />
          {daGrade ? 'Apagar só este' : 'Apagar'}
        </Botao>
      </div>
      {guardados ? <p className="dp-nota">{avisoDosGuardados(guardados)}</p> : null}
    </Caixa>
  )
}

/* ---------- a grade de paletes -------------------------------------------------
   "1,3 × 1,2" é o palete: largura por fundo. Um número só vale para os dois. */
function lerTamanho(texto: string): { largura: number; fundo: number } | null {
  const partes = texto
    .toLowerCase()
    .replace(/m/g, '')
    .split(/[x×]/)
    .map(t => lerNumero(t))
  if (partes.length < 1 || partes.length > 2) return null
  const [a, b = partes[0]] = partes
  if (a === null || b === null || Number.isNaN(a) || Number.isNaN(b)) return null
  if (a < MENOR_PECA || b < MENOR_PECA || a > 10 || b > 10) return null
  return { largura: duasCasas(a), fundo: duasCasas(b) }
}

function PainelDaGrade({
  grade,
  membros,
  aoMudar,
  aoContar,
  aoEspacar,
  aoDesmanchar,
  aoApagar,
}: {
  grade: Grade
  membros: Movel[]
  aoMudar: (
    g: Grade,
    opcoes?: { renomear?: boolean; prefixo?: string; comecaEm?: number; ordem?: OrdemDosNomes },
  ) => void
  /** fileiras e colunas passam pela conta de caber no chão */
  aoContar: (eixo: 'fileiras' | 'colunas', quantos: number) => void
  /** o vão também: o que não cabe até a parede vira o maior que cabe */
  aoEspacar: (eixo: 'espacoX' | 'espacoY', vao: number) => void
  aoDesmanchar: () => void
  aoApagar: () => void
}) {
  const tamanhoEscrito = metros(grade.largura) + ' × ' + metros(grade.fundo)
  const [tamanho, setTamanho] = useState(tamanhoEscrito)
  const [comeca, setComeca] = useState('')
  const [ordem, setOrdem] = useState<OrdemDosNomes>('fileira')
  const [focado, setFocado] = useState(false)
  useEffect(() => {
    if (!focado) setTamanho(tamanhoEscrito)
  }, [tamanhoEscrito, focado])
  const tamanhoRuim = lerTamanho(tamanho) === null
  const cheia = grade.fileiras * grade.colunas

  function renomear(texto: string, ordemNova: OrdemDosNomes) {
    const { prefixo, numero } = partirNomeDePalete(texto.trim() || 'P01')
    aoMudar(grade, { renomear: true, prefixo, comecaEm: numero, ordem: ordemNova })
  }

  return (
    <Caixa
      titulo="Grade de paletes"
      icone={GridFour}
      selo={plural(membros.length, 'palete', 'paletes')}>
      <div className="dp-dois">
        <CampoDeNumero
          rotulo="Fileiras"
          inteiro
          valor={grade.fileiras}
          minimo={1}
          maximo={MAXIMO_DA_GRADE}
          aoMudar={v => aoContar('fileiras', v)}
        />
        <CampoDeNumero
          rotulo="Colunas"
          inteiro
          valor={grade.colunas}
          minimo={1}
          maximo={MAXIMO_DA_GRADE}
          aoMudar={v => aoContar('colunas', v)}
        />
      </div>
      <Campo
        rotulo="Tamanho do palete"
        erro={tamanhoRuim}
        dica={tamanhoRuim ? 'Largura × fundo, em metros.' : undefined}
      >
        <span className="dp-com-sufixo">
          <Entrada
            value={tamanho}
            aria-label="Tamanho do palete"
            aria-invalid={tamanhoRuim}
            onFocus={() => setFocado(true)}
            onBlur={() => setFocado(false)}
            onChange={e => {
              setTamanho(e.currentTarget.value)
              const t = lerTamanho(e.currentTarget.value)
              if (t) aoMudar({ ...grade, ...t })
            }}
          />
          <i>m</i>
        </span>
      </Campo>
      <div className="dp-dois">
        <CampoDeNumero
          rotulo="Espaço entre colunas"
          sufixo="m"
          valor={grade.espacoX}
          minimo={0}
          maximo={MAIOR_VAO_DA_GRADE}
          aoMudar={v => aoEspacar('espacoX', v)}
        />
        <CampoDeNumero
          rotulo="Espaço entre fileiras"
          sufixo="m"
          valor={grade.espacoY}
          minimo={0}
          maximo={MAIOR_VAO_DA_GRADE}
          aoMudar={v => aoEspacar('espacoY', v)}
        />
      </div>
      <div className="dp-dois">
        <Campo rotulo="Os nomes começam em">
          <Entrada
            value={comeca}
            placeholder={membros[0]?.nome ?? 'P01'}
            aria-label="Os nomes começam em"
            onChange={e => setComeca(e.currentTarget.value)}
            onBlur={() => {
              if (comeca.trim()) renomear(comeca, ordem)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && comeca.trim()) renomear(comeca, ordem)
            }}
          />
        </Campo>
        <Grupo rotulo="Ordem dos nomes">
          <Seletor
            campo
            bloco
            valor={ordem}
            vazio="Por fileira"
            opcoes={[
              { valor: 'fileira', rotulo: 'Por fileira' },
              { valor: 'coluna', rotulo: 'Por coluna' },
            ]}
            aoEscolher={v => {
              const nova: OrdemDosNomes = v === 'coluna' ? 'coluna' : 'fileira'
              setOrdem(nova)
              renomear(comeca || membros[0]?.nome || 'P01', nova)
            }}
          />
        </Grupo>
      </div>
      <p className="dp-nota">
        A grade põe todos de uma vez. Onde ela cai em cima de outra peça ou fora do chão, o palete
        não é criado
        {membros.length < cheia ? `: por isso são ${membros.length}, e não ${cheia}.` : '.'}
      </p>
      <div className="dp-botoes">
        <Botao onClick={aoDesmanchar}>Desmanchar a grade</Botao>
        <Botao onClick={aoApagar}>
          <Trash size={16} aria-hidden="true" />
          Apagar
        </Botao>
      </div>
    </Caixa>
  )
}

/* ---------- a escada e a porta --------------------------------------------------- */
function PainelDaPassagem({
  movel,
  aoMudar,
  aoGirar,
  aoApagar,
}: {
  movel: Movel
  aoMudar: (m: Partial<Movel>) => void
  aoGirar: () => void
  aoApagar: () => void
}) {
  return (
    <Caixa
      titulo={movel.nome || (movel.tipo === 'escada' ? 'Escada' : 'Porta')}
      icone={movel.tipo === 'escada' ? Stairs : Door}
      selo={movel.tipo === 'escada' ? 'escolhida' : 'escolhida'}
    >
      <Campo
        rotulo="Nome"
        dica={
          movel.tipo === 'escada'
            ? 'Como "Escada" ou "Escada · entrada".'
            : 'Como "Porta" ou "Portão dos fundos".'
        }
      >
        <Entrada
          value={movel.nome}
          onChange={e => aoMudar({ nome: e.currentTarget.value })}
          aria-label="Nome"
        />
      </Campo>
      <div className="dp-dois">
        <CampoDeNumero
          rotulo="Largura"
          sufixo="m"
          valor={movel.largura}
          minimo={MENOR_PECA}
          maximo={MAIOR_LADO_DO_CHAO}
          aoMudar={v => aoMudar({ largura: v })}
        />
        <CampoDeNumero
          rotulo="Fundo"
          sufixo="m"
          valor={movel.fundo}
          minimo={0.1}
          maximo={MAIOR_LADO_DO_CHAO}
          aoMudar={v => aoMudar({ fundo: v })}
        />
      </div>
      <p className="dp-nota">
        {movel.tipo === 'escada'
          ? 'A escada não guarda material: está no desenho para a pessoa saber por onde entra. A seta mostra para que lado ela corre.'
          : 'A porta não guarda material: está no desenho para a pessoa saber por onde entra.'}
      </p>
      <div className="dp-botoes">
        <Botao onClick={aoGirar}>
          <ArrowClockwise size={16} aria-hidden="true" />
          Girar
        </Botao>
        <Botao onClick={aoApagar}>
          <Trash size={16} aria-hidden="true" />
          Apagar
        </Botao>
      </div>
    </Caixa>
  )
}
