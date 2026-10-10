import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Warning } from '@phosphor-icons/react'
import {
  TAMANHOS_ADULTO,
  TAMANHOS_INFANTIL,
  etiquetaDoDesign,
  formato,
  fundo,
  grupoDaReferencia,
  hexDoBanco,
  imagemDe,
  sanitizarTextoRico,
  usarReferencias,
  type Bloco,
  type Caixa,
  type Imagem,
  type Tamanho,
} from '@dominio/layout'
import { pecasDoProduto, totalDoProduto, type ProdutoCotado } from '@dominio/cotacao'
import type { ConstrucaoDoLayout } from '@dominio/produto'
import { construcaoDe } from './ficha-do-layout'
import { n2, pecas, reais, Rotulo, Titulo } from './pagina-um'
import './documento.css'

/* ==========================================================================
   AS PÁGINAS DE LAYOUT NO TEMPLATE PADRÃO (FOURTIME OS - 14, seções 5 a 9).

   Um layout é um MÓDULO de papel, na ordem em que a fábrica lê: o cabeçalho
   do layout (16), a arte (9) com os destaques (14), a grade vendida (21), a
   ficha (21: tecido, etiqueta e design), a fabricação (13), os aviamentos
   (11), a observação (14) e a soma (9). Em dois por página o módulo é uma
   coluna de 340 px; na página inteira ele tem a largura da folha e a
   arrumação própria da seção 9.

   O código de referência é o do protótipo (a4n/p2.js, motor.js e papel.css),
   com as classes de lá e o prefixo dc-.
   ========================================================================== */

export type ModoDaFolha = 'dupla' | 'cheia'

/* A ESCOLHA DA ARRUMAÇÃO: dois por página ou um por página. Não é do
   preset de impressão, por pedido do Henrique (11/10/2026): "independente do
   preset eu decido se quero 1 por página ou 2 na hora da impressão, mas por
   default vão ser sempre 2". Por isso ela nasce em 2 toda vez que a folha
   abre, e não fica guardada (até a parte 9 ficava, no navegador). */
export function usarModoDaFolha(): [ModoDaFolha, (m: ModoDaFolha) => void] {
  const [modo, setModo] = useState<ModoDaFolha>('dupla')
  return [modo, setModo]
}


/** a largura útil de uma coluna: 704 px de folha menos 24 de vão, ao meio */
export const LARGURA_DA_COLUNA = 340
export const LARGURA_DA_PAGINA = 704

/* O PISO DA ARTE (seção 5 do 14): a arte nasce na altura em que enche a
   largura e só encolhe quando a coluna passa da folha, até este piso. */
export const PISO_DA_ARTE: Record<ModoDaFolha, number> = { dupla: 150, cheia: 260 }

/* a caixa da arte (ARTE 9) tem 6 px em cima e embaixo e um risco de 1 px em
   cada ponta: 14 px que não são imagem */
const MOLDURA_DA_ARTE = 14

/* os destaques (DEST 14, "uma fileira só"): a arte alta ocupa 76% da largura
   e a coluna da direita fica com o resto; a larga ganha uma faixa de até 72
   px embaixo (45% mais na página inteira) */
const PARTE_DA_ARTE_ALTA = 0.76
const TETO_DA_FAIXA: Record<ModoDaFolha, number> = { dupla: 72, cheia: 104 }

const n0 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const num = (b: Bloco) => String(b.n).padStart(2, '0')
const GENERO: Record<string, string> = { masculino: 'Masculino', feminino: 'Feminino', infantil: 'Infantil' }

/* ==========================================================================
   O QUE A FOLHA PRECISA LER DE FORA DO BLOCO: a construção de cada código
   (Fichas técnicas) e o tamanho de cada imagem (para saber se a arte é alta
   ou larga, e recortar os destaques). As duas chegam depois do primeiro
   desenho, e a folha se arruma de novo quando chegam.
   ========================================================================== */
export function usarConstrucoes(cods: string[]): Record<string, ConstrucaoDoLayout | null> {
  const [mapa, setMapa] = useState<Record<string, ConstrucaoDoLayout | null>>({})
  const chave = [...new Set(cods.map((c) => c.trim()).filter(Boolean))].sort().join('|')
  useEffect(() => {
    let vivo = true
    for (const cod of chave ? chave.split('|') : []) {
      construcaoDe(cod)
        .then((c) => vivo && setMapa((m) => (m[cod] === c ? m : { ...m, [cod]: c })))
        .catch(() => vivo && setMapa((m) => ({ ...m, [cod]: null })))
    }
    return () => {
      vivo = false
    }
  }, [chave])
  return mapa
}

export function usarImagens(srcs: string[]): Record<string, Imagem> {
  const [mapa, setMapa] = useState<Record<string, Imagem>>({})
  const chave = [...new Set(srcs.filter(Boolean))].join('\n')
  useEffect(() => {
    let vivo = true
    for (const src of chave ? chave.split('\n') : []) {
      const im = new Image()
      im.onload = () => {
        if (vivo && im.naturalWidth && im.naturalHeight) {
          setMapa((m) => ({ ...m, [src]: imagemDe(im.naturalWidth, im.naturalHeight) }))
        }
      }
      im.src = src
    }
    return () => {
      vivo = false
    }
  }, [chave])
  return mapa
}

/* a arte é ALTA quando é mais alta que larga: aí os destaques vão para a
   coluna da direita, dentro da caixa da arte; senão, numa faixa embaixo */
const ehAlta = (im: Imagem | undefined) => !!im && im.a < 1

/** a altura em que a imagem enche a largura (com a sobra da coluna dos destaques, na alta) */
export function alturaNaturalDaArte(b: Bloco, im: Imagem | undefined, largura: number, comDestaques = true): number {
  if (!b.imagem) return 0
  if (!im) return 240
  const comColuna = comDestaques && ehAlta(im) && b.destaques.regs.length > 0
  const util = comColuna ? largura * PARTE_DA_ARTE_ALTA - largura * 0.012 : largura
  return Math.round(util / im.a + MOLDURA_DA_ARTE)
}

/* ==========================================================================
   1. CABEÇALHO DO LAYOUT 16, "grupo em cima": o número em tinta, o tipo da
   peça em sobrelinha, o nome embaixo e a linha miúda com o código.
   ========================================================================== */
function CabecalhoDoLayout({ b, kit }: { b: Bloco; kit: boolean }) {
  /* o grupo vem das referências do BANCO (usar-referencias.ts) */
  const grupo = grupoDaReferencia(usarReferencias(), b.referencia)
  const miuda = [b.referencia, GENERO[b.genero], b.faixa === 'infantil' ? 'grade infantil' : 'grade adulta']
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="dc-lc">
      <span className="dc-num dc-num-g">{num(b)}</span>
      <div>
        {grupo ? <Rotulo>{grupo}</Rotulo> : null}
        <b>{b.nomeDaReferencia || b.arte || 'Layout sem referência'}</b>
        {kit ? <span className="dc-kit">Kit</span> : null}
        <small>{miuda}</small>
      </div>
    </div>
  )
}

/* ==========================================================================
   2. A ARTE 9 E OS DESTAQUES 14.

   A arte vai sem caixa, entre dois riscos finos. Com destaques, a regra dele
   (10/10/2026): arte ALTA, os destaques numa coluna à direita, dentro da
   caixa da arte, todos com a mesma largura (a arte desliza para a esquerda,
   como no editor); arte LARGA, numa fileira embaixo, todos com a mesma
   altura. Cada destaque é a MESMA imagem, recortada pela região que o
   vendedor escolheu, com o zoom e a posição dele: o recorte é o fundo do
   CSS, e não uma segunda imagem.
   ========================================================================== */
function Destaque({ b, im, i, c, dx = 0, dy = 0 }: { b: Bloco; im: Imagem; i: number; c: Caixa; dx?: number; dy?: number }) {
  const f = fundo(b.destaques.regs[i], c, im)
  return (
    <span
      className="dc-dt"
      aria-label={'Destaque ' + (i + 1)}
      style={{
        left: c.x + dx,
        top: c.y + dy,
        width: c.w,
        height: c.h,
        backgroundImage: 'url("' + b.imagem.replace(/"/g, '%22') + '")',
        backgroundSize: f.size,
        backgroundPosition: f.pos,
      }}
    />
  )
}

function ArteDoLayout({
  b,
  im,
  altura,
  largura,
  comDestaques = true,
}: {
  b: Bloco
  im: Imagem | undefined
  altura: number
  largura: number
  /** false quando o preset tirou os destaques: a arte alta volta a ser só a arte */
  comDestaques?: boolean
}) {
  if (!b.imagem) {
    return <div className="dc-arte dc-arte-vazia">sem arte neste layout</div>
  }
  const regs = comDestaques ? b.destaques.regs : []
  const H = altura - MOLDURA_DA_ARTE
  if (im && ehAlta(im) && regs.length) {
    const W = largura
    const gA = W * 0.012
    const wA = Math.min(H * im.a, W * PARTE_DA_ARTE_ALTA - gA)
    const hA = wA / im.a
    const x0 = wA + gA
    const L = W - x0
    const g = Math.max(3, W * 0.012)
    const as = regs.map((r) => formato(r, im))
    const w = Math.min(L, (H - g * (as.length - 1)) / as.reduce((t, a) => t + 1 / a, 0))
    let y = 0
    const caixas = as.map((a) => {
      const c = { x: (L - w) / 2, y, w, h: w / a }
      y += w / a + g
      return c
    })
    const sobra = H - (y - g)
    return (
      <div className="dc-arte" data-id={b.id} style={{ height: altura }}>
        <div className="dc-mural">
          <img
            src={b.imagem}
            alt={'Arte do layout ' + b.n}
            style={{ left: 0, top: (H - hA) / 2, width: wA, height: hA }}
          />
          {caixas.map((c, i) => (
            <Destaque key={i} b={b} im={im} i={i} c={c} dx={x0} dy={sobra / 2} />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="dc-arte" data-id={b.id} style={{ height: altura }}>
      <img src={b.imagem} alt={'Arte do layout ' + b.n} />
    </div>
  )
}

function FaixaDeDestaques({ b, im, largura, modo }: { b: Bloco; im: Imagem | undefined; largura: number; modo: ModoDaFolha }) {
  const regs = b.destaques.regs
  if (!b.imagem || !im || ehAlta(im) || !regs.length) return null
  const g = Math.max(3, largura * 0.012 * 1.6)
  const as = regs.map((r) => formato(r, im))
  const h = Math.min(TETO_DA_FAIXA[modo], (largura - g * (as.length - 1)) / as.reduce((t, a) => t + a, 0))
  let x = 0
  const caixas = as.map((a) => {
    const c = { x, y: 0, w: a * h, h }
    x += a * h + g
    return c
  })
  return (
    <div className="dc-faixa" style={{ height: Math.ceil(h) }} aria-label="Destaques da arte">
      {caixas.map((c, i) => (
        <Destaque key={i} b={b} im={im} i={i} c={c} />
      ))}
    </div>
  )
}

/* ==========================================================================
   3. A GRADE VENDIDA 21 (seção 6 do 14): tamanho, peças e preço dentro da
   célula, a soma em tinta na ÚLTIMA coluna; embaixo, fora das células, o
   valor em R$ de cada tamanho e o total uma vez só, sob a soma.

   As fileiras: a adulta (PP a XG) sempre; a plus (G1 a G4) e a infantil (2A
   a 14A) só com peça; adulta e plus na MESMA fileira; a infantil só se
   diferencia pelo verde, e desce para uma fileira própria quando não cabe
   (mais de 12 tamanhos na coluna, mais de 24 na página inteira). Com até 3
   peças infantis, tudo numa fileira só, e da infantil só os tamanhos com peça.
   ========================================================================== */
const ADULTA = TAMANHOS_ADULTO.slice(0, 6) as readonly Tamanho[]
const PLUS = TAMANHOS_ADULTO.slice(6) as readonly Tamanho[]
const INFANTIL = TAMANHOS_INFANTIL as readonly Tamanho[]
const ehInfantil = (t: Tamanho) => INFANTIL.includes(t)

export function fileirasDaGrade(b: Bloco, modo: ModoDaFolha): { nome: string; tamanhos: Tamanho[] }[] {
  const q = (t: Tamanho) => b.grade[t] ?? 0
  const base: Tamanho[] = [...ADULTA, ...(PLUS.some((t) => q(t) > 0) ? PLUS : [])]
  const pecasInf = INFANTIL.reduce((s, t) => s + q(t), 0)
  if (!pecasInf) return [{ nome: '', tamanhos: base }]
  if (pecasInf <= 3) return [{ nome: '', tamanhos: [...base, ...INFANTIL.filter((t) => q(t) > 0)] }]
  const cabe = modo === 'dupla' ? 12 : 24
  return base.length + INFANTIL.length > cabe
    ? [
        { nome: 'Adulta', tamanhos: base },
        { nome: 'Infantil', tamanhos: [...INFANTIL] },
      ]
    : [{ nome: '', tamanhos: [...base, ...INFANTIL] }]
}

function GradeVendida({ p, comValor, modo }: { p: ProdutoCotado; comValor: boolean; modo: ModoDaFolha }) {
  const b = p.bloco
  const q = (t: Tamanho) => b.grade[t] ?? 0
  const preco = (t: Tamanho) => p.precoPorTamanho[t] ?? p.precoBase
  const filas = fileirasDaGrade(b, modo)
  const varias = filas.length > 1
  const ncols = Math.max(...filas.map((f) => f.tamanhos.length))
  const classes = [
    'dc-gr',
    modo === 'dupla' && ncols > 10 ? 'dc-gr-apertada' : '',
    modo === 'dupla' && ncols >= 8 ? 'dc-gr-rs-cima' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const vazias = (n: number) => Array.from({ length: ncols - n }, (_, i) => <td key={'v' + i} className="dc-gx" />)
  return (
    <div className="dc-ne">
      <Titulo>Grade vendida</Titulo>
      <table className={classes}>
        <tbody>
          {filas.map((f) => {
            const soma = f.tamanhos.reduce((s, t) => s + q(t), 0)
            const valor = f.tamanhos.reduce((s, t) => s + q(t) * preco(t), 0)
            return [
              <tr key={f.nome + 'q'}>
                {varias ? <th className={f.nome === 'Infantil' ? 'dc-gr-fam dc-gr-inf' : 'dc-gr-fam'}>{f.nome}</th> : null}
                {f.tamanhos.map((t) => (
                  <td key={t} className={['dc-gr-dt', q(t) ? '' : 'dc-gr-z', ehInfantil(t) ? 'dc-gr-inf' : ''].filter(Boolean).join(' ')}>
                    <span>{t}</span>
                    <b>{q(t) || ''}</b>
                    {comValor && q(t) ? <small>{n2(preco(t))}</small> : null}
                  </td>
                ))}
                {vazias(f.tamanhos.length)}
                <td className="dc-gr-soma">
                  <span>Soma</span>
                  <b>{soma}</b>
                </td>
              </tr>,
              comValor ? (
                <tr key={f.nome + 'v'} className="dc-gr-vf">
                  {varias ? <th className="dc-gr-fam" /> : null}
                  {f.tamanhos.map((t) => (
                    <td key={t} className="dc-gr-v">
                      {q(t) ? (
                        <>
                          <i>R$</i> {n0(q(t) * preco(t))}
                        </>
                      ) : null}
                    </td>
                  ))}
                  {vazias(f.tamanhos.length)}
                  <td className="dc-gr-vt">{reais(valor)}</td>
                </tr>
              ) : null,
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ==========================================================================
   4. A FICHA 21 (seção 7 do 14): o título dividido "Ficha técnica do layout
   | Etiqueta"; o tecido grande e a etiqueta em pílulas; um risco; e o design,
   com Sublimação e DTF em caixas de cartões de cor, lado a lado, primeiro, e
   as técnicas sem cor em pílulas no espaço que sobra, empilhadas de três em
   três na altura de uma caixa, ou deitadas na linha de baixo quando não cabem.
   ========================================================================== */
const TEC: Record<string, [string, string]> = {
  subli: ['Sublimação', 'dc-tec-subli'],
  dtf: ['DTF', 'dc-tec-dtf'],
  silk: ['Silk', 'dc-tec-silk'],
  bordado: ['Bordado', 'dc-tec-bordado'],
  patch: ['Patch', 'dc-tec-patch'],
}
const TEC_DA_ETIQUETA: Record<string, [string, string]> = {
  silk: ['Silk', 'dc-tec-silk'],
  sub: ['Sub', 'dc-tec-subli'],
  dtf: ['DTF', 'dc-tec-dtf'],
}

function Pilulas({ b }: { b: Bloco }) {
  const e = etiquetaDoDesign(b.design)
  if (!e.tipo) return <small>sem etiqueta</small>
  const tec = e.tecnica ? TEC_DA_ETIQUETA[e.tecnica] : null
  return (
    <span className="dc-pils">
      <span className={e.tipo === 'cliente' ? 'dc-pil dc-pil-cliente' : 'dc-pil dc-pil-fourtime'}>
        {e.tipo === 'cliente' ? 'Cliente' : 'Fourtime'}
      </span>
      {tec ? <span className={'dc-pil ' + tec[1]}>{tec[0]}</span> : null}
    </span>
  )
}

function Tecnicas({ b }: { b: Bloco }) {
  const ts = b.design.filter((d) => TEC[d.tecnica])
  const comCor = ts.filter((d) => d.cores.length && (d.tecnica === 'subli' || d.tecnica === 'dtf'))
  const semCor = ts.filter((d) => !comCor.includes(d))
  const linha = useRef<HTMLDivElement>(null)
  const [deitada, setDeitada] = useState(false)
  const assinatura = ts.map((d) => d.tecnica + d.cores.length).join(',')

  /* as pílulas tentam caber ao lado da última caixa; se a fileira quebrar,
     elas descem e ficam deitadas, lado a lado */
  useLayoutEffect(() => {
    setDeitada(false)
  }, [assinatura])
  useLayoutEffect(() => {
    const el = linha.current
    if (!el || deitada) return
    const pils = el.querySelector<HTMLElement>('.dc-tk-pils')
    const caixas = el.querySelectorAll<HTMLElement>('.dc-tk')
    const ult = caixas[caixas.length - 1]
    if (pils && ult && pils.offsetTop >= ult.offsetTop + ult.offsetHeight - 1) setDeitada(true)
  })

  if (!ts.length) return null
  const POR_COLUNA = 3
  const colunas: (typeof semCor)[] = []
  for (let i = 0; i < semCor.length; i += POR_COLUNA) colunas.push(semCor.slice(i, i + POR_COLUNA))
  const pil = (d: (typeof semCor)[number], i: number) => (
    <span key={d.tecnica + i} className={'dc-pil ' + TEC[d.tecnica][1]}>
      {TEC[d.tecnica][0]}
    </span>
  )
  return (
    <div className="dc-tks" ref={linha}>
      {comCor.map((d, i) => (
        <div key={d.tecnica + i} className={'dc-tk ' + TEC[d.tecnica][1]}>
          <b className="dc-tk-t">{TEC[d.tecnica][0]}</b>
          <span className="dc-tk-c">
            {d.cores.map((c, k) => (
              <span key={c.cod + k} className="dc-cd">
                <i style={{ '--dc-cor': hexDoBanco(c.cod, c.hex) || '#fff' } as CSSProperties} />
                <b>{c.cod}</b>
              </span>
            ))}
          </span>
        </div>
      ))}
      {semCor.length ? (
        deitada || !comCor.length ? (
          <span className="dc-tk-pils dc-tk-deitada">{semCor.map(pil)}</span>
        ) : (
          <span className="dc-tk-pils">
            {colunas.map((col, k) => (
              <span key={k} className="dc-tk-col">
                {col.map((d, i) => pil(d, k * POR_COLUNA + i))}
              </span>
            ))}
          </span>
        )
      ) : null}
    </div>
  )
}

function Tecidos({ b }: { b: Bloco }) {
  const lista = b.tecidos.filter((t) => t.nome || t.cor)
  if (!lista.length) return <small>tecido não escolhido</small>
  return (
    <div className="dc-fa">
      {lista.map((t, i) => (
        <div key={i}>
          <i className="dc-q" style={{ '--dc-cor': t.hex || '#fff' } as CSSProperties} />
          <span>
            <b>{t.nome || 'tecido'}</b>
            {t.cor ? <small>{t.cor}</small> : null}
          </span>
        </div>
      ))}
    </div>
  )
}

function FichaDoLayoutNaFolha({ b, modo }: { b: Bloco; modo: ModoDaFolha }) {
  if (modo === 'cheia') {
    return (
      <div className="dc-ne dc-fh">
        <div>
          <Titulo>Ficha técnica do layout</Titulo>
          <Tecidos b={b} />
        </div>
        <div>
          <Titulo>Etiqueta</Titulo>
          <Pilulas b={b} />
        </div>
        <div>
          <Titulo>Design</Titulo>
          <Tecnicas b={b} />
        </div>
      </div>
    )
  }
  return (
    <div className="dc-ne">
      <div className="dc-ft2">
        <Titulo>Ficha técnica do layout</Titulo>
        <Titulo>Etiqueta</Titulo>
      </div>
      <div className="dc-ff">
        <div className="dc-fg">
          <div>
            <Tecidos b={b} />
          </div>
          <div className="dc-fe">
            <Pilulas b={b} />
          </div>
        </div>
        <Tecnicas b={b} />
      </div>
    </div>
  )
}

/* ==========================================================================
   5. FABRICAÇÃO 13, AVIAMENTOS 11 E OBSERVAÇÃO 14, lidos da ficha técnica
   da referência (ou de cada peça do kit) pelo código do layout.
   ========================================================================== */
const DETALHES_DA_FOLHA: [string, string][] = [
  ['gola', 'Gola'],
  ['manga', 'Manga'],
  ['punho', 'Punho'],
  ['barra', 'Barra'],
  ['costura', 'Costura'],
]

function Placa({ children }: { children: ReactNode }) {
  return (
    <div className="dc-ob">
      <i>
        <Warning size={13} weight="bold" />
      </i>
      <div>{children}</div>
    </div>
  )
}

function Fabricacao({ c, kit }: { c: ConstrucaoDoLayout; kit: boolean }) {
  const pecasComAlgo = c.pecas.filter(
    (p) => DETALHES_DA_FOLHA.some(([k]) => (p.detalhes[k as keyof typeof p.detalhes] ?? '').trim()) || p.atencao.trim(),
  )
  if (!pecasComAlgo.length) return null
  return (
    <div className="dc-ne">
      <Titulo>Fabricação da peça</Titulo>
      {pecasComAlgo.map((p) => {
        const pares = DETALHES_DA_FOLHA.map(([k, nome]) => {
          const texto = (p.detalhes[k as keyof typeof p.detalhes] ?? '').trim()
          const [cabeca, ...resto] = texto.split(',')
          return { k, nome, v: cabeca.trim(), s: resto.join(',').trim() }
        }).filter((x) => x.v)
        return (
          <div key={p.cod + p.papel} className="dc-fab">
            {kit ? <b className="dc-sub">{(p.papel ? p.papel + ' · ' : '') + p.cod}</b> : null}
            {pares.length ? (
              <div className="dc-fb">
                {pares.map((x) => (
                  <div key={x.k}>
                    <Rotulo>{x.nome}</Rotulo>
                    <b>{x.v}</b>
                    {x.s ? <small>{x.s}</small> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {p.atencao.trim() ? <Placa>{p.atencao}</Placa> : null}
          </div>
        )
      })}
    </div>
  )
}

function Aviamentos({ c }: { c: ConstrucaoDoLayout }) {
  const itens = c.pecas.flatMap((p) => p.aviamentos.map((a) => ({ ...a, de: c.pecas.length > 1 ? p.papel || p.cod : '' })))
  if (!itens.length) return null
  return (
    <div className="dc-ne">
      <Titulo>Aviamentos e insumos</Titulo>
      <ul className="dc-av">
        {itens.map((a, i) => (
          <li key={i}>
            <i />
            <span>
              <b>{a.nome}</b> · {a.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {a.unidade}
              {a.de ? <small>{a.de}</small> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Observacao({ b }: { b: Bloco }) {
  const html = sanitizarTextoRico(b.observacao)
  if (!html.replace(/<[^>]*>/g, '').trim()) return null
  return (
    <div className="dc-ne dc-ne-obs">
      <Placa>
        <div className="dc-ob-texto" dangerouslySetInnerHTML={{ __html: html }} />
      </Placa>
    </div>
  )
}

/* ==========================================================================
   O MÓDULO INTEIRO. Em dois por página, uma coluna com vão de 10 px entre as
   partes. Na página inteira (seção 9 do 14): em cima o cabeçalho, a arte na
   largura toda com os destaques e a grade; a ficha deitada em três colunas;
   embaixo, a fabricação à esquerda e os aviamentos à direita, com a
   observação no pé deles; a soma no pé de tudo.
   ========================================================================== */
export function ModuloNaFolha({
  produto: p,
  comValor,
  modo,
  construcao,
  imagem,
  alturaDaArte,
  fora = [],
}: {
  produto: ProdutoCotado
  comValor: boolean
  modo: ModoDaFolha
  construcao: ConstrucaoDoLayout | null | undefined
  imagem: Imagem | undefined
  alturaDaArte: number
  /** os módulos que o preset tirou da folha (arte, dest, grade, ficha, fab, avi, obs, soma) */
  fora?: readonly string[]
}) {
  const b = p.bloco
  const tem = (k: string) => !fora.includes(k)
  const largura = modo === 'dupla' ? LARGURA_DA_COLUNA : LARGURA_DA_PAGINA
  const kit = construcao?.tipo === 'kit'
  const soma = !tem('soma') ? null : (
    <p className="dc-sm">
      {pecas(pecasDoProduto(p))}
      {comValor ? (
        <>
          {' · '}
          <b>{reais(totalDoProduto(p))}</b>
        </>
      ) : null}
    </p>
  )

  if (b.informacoes) {
    return (
      <article className="dc-n dc-mod" data-id={b.id}>
        <CabecalhoDoLayout b={b} kit={false} />
        {b.imagem && tem('arte') ? <ArteDoLayout b={b} im={imagem} altura={alturaDaArte} largura={largura} comDestaques={tem('dest')} /> : null}
        {tem('obs') ? <Observacao b={b} /> : null}
      </article>
    )
  }

  const cab = <CabecalhoDoLayout b={b} kit={kit} />
  const arte = tem('arte') ? (
    <ArteDoLayout b={b} im={imagem} altura={alturaDaArte} largura={largura} comDestaques={tem('dest')} />
  ) : null
  const dest = tem('dest') ? <FaixaDeDestaques b={b} im={imagem} largura={largura} modo={modo} /> : null
  const grade = tem('grade') ? <GradeVendida p={p} comValor={comValor} modo={modo} /> : null
  const ficha = tem('ficha') ? <FichaDoLayoutNaFolha b={b} modo={modo} /> : null
  const fab = construcao && tem('fab') ? <Fabricacao c={construcao} kit={kit} /> : null
  const avi = construcao && tem('avi') ? <Aviamentos c={construcao} /> : null
  const obs = tem('obs') ? <Observacao b={b} /> : null

  if (modo === 'cheia') {
    return (
      <article className="dc-n dc-mod" data-id={b.id}>
        {cab}
        {arte}
        {dest}
        {grade}
        {ficha}
        {fab || avi || obs ? (
          <div className="dc-mod-2">
            <div>{fab}</div>
            <div>
              {avi}
              {obs}
            </div>
          </div>
        ) : null}
        {soma}
      </article>
    )
  }
  return (
    <article className="dc-n dc-mod" data-id={b.id}>
      {cab}
      {arte}
      {dest}
      {grade}
      {ficha}
      {fab}
      {avi}
      {obs}
      {soma}
    </article>
  )
}

/* ==========================================================================
   O ENCAIXE DA ARTE (seção 5 do 14). Depois de cada desenho, cada módulo é
   medido contra a folha: se passa, a arte encolhe o que falta, até o piso; se
   sobra, ela volta para a altura natural. Medida em pixel de papel (a régua
   divide pela escala do palco), porque na tela a folha pode estar encolhida.
   Devolve a nova tabela de alturas, ou null quando nada muda.
   ========================================================================== */
export function encaixarArtes(
  palco: HTMLElement,
  atual: Record<string, number>,
  natural: (id: string) => number,
  piso: number,
): Record<string, number> | null {
  const novo = { ...atual }
  let mudou = false
  for (const mod of palco.querySelectorAll<HTMLElement>('.fl .dc-mod[data-id]')) {
    const id = mod.dataset.id ?? ''
    const corpo = mod.closest('.fl-corpo')
    const arte = mod.querySelector<HTMLElement>('.dc-arte[data-id]')
    if (!(corpo instanceof HTMLElement) || !arte) continue
    const rc = corpo.getBoundingClientRect()
    const k = corpo.offsetHeight ? rc.height / corpo.offsetHeight : 1
    const limite = corpo.clientHeight - 12
    const fundo = (mod.getBoundingClientRect().bottom - rc.top) / k
    const passa = fundo - limite
    const h = arte.offsetHeight
    const nat = natural(id)
    if (passa > 0.5) {
      const quer = Math.max(Math.min(piso, nat), h - Math.ceil(passa))
      if (quer < h) {
        novo[id] = quer
        mudou = true
      }
    } else if (atual[id] !== undefined && passa < -2) {
      const quer = Math.min(nat, h + Math.floor(-passa))
      if (quer >= nat) delete novo[id]
      else novo[id] = quer
      if (quer !== h) mudou = true
    }
  }
  return mudou ? novo : null
}
