import type { ReactNode } from 'react'

/* ==========================================================================
   Os símbolos de cuidado com o tecido.

   São os 38 da norma de etiqueta têxtil (ABNT NBR NM ISO 3758), em seis
   grupos: lavagem, alvejamento, secagem em tambor, secagem natural,
   passadoria e limpeza profissional. A etiqueta leva UM de cada grupo, e quem
   confere isso é o banco (048).

   O DESENHO É PRÓPRIO, em linha, numa grade de 24. O Design System usa
   Phosphor, que não tem estes símbolos; é a única exceção, e só para eles. As
   formas são as da norma: a tina, o triângulo, o quadrado, o ferro e o
   círculo.

   ESTA LISTA E A DO BANCO SÃO A MESMA. O código, o grupo e a ordem moram
   também em banco/048-a-ficha-tecnica-da-cor.sql, e testes/cuidados.mjs
   reprova o build quando as duas se separam.
   ========================================================================== */

export type GrupoDeCuidado =
  'lavagem' | 'alvejamento' | 'tambor' | 'natural' | 'passadoria' | 'profissional'

export const NOME_DO_GRUPO_DE_CUIDADO: Record<GrupoDeCuidado, string> = {
  lavagem: 'Lavagem',
  alvejamento: 'Alvejamento',
  tambor: 'Secagem em tambor',
  natural: 'Secagem natural',
  passadoria: 'Passadoria',
  profissional: 'Limpeza profissional',
}

export const GRUPOS_DE_CUIDADO: GrupoDeCuidado[] = [
  'lavagem',
  'alvejamento',
  'tambor',
  'natural',
  'passadoria',
  'profissional',
]

export type Cuidado = { cod: string; grupo: GrupoDeCuidado; frase: string }

/* a ordem desta lista é a ordem da etiqueta */
export const CUIDADOS: Cuidado[] = [
  { cod: 'lavar-30', grupo: 'lavagem', frase: 'Lavar a 30 °C' },
  { cod: 'lavar-30-suave', grupo: 'lavagem', frase: 'Lavar a 30 °C, ciclo suave' },
  { cod: 'lavar-30-muito-suave', grupo: 'lavagem', frase: 'Lavar a 30 °C, ciclo muito suave' },
  { cod: 'lavar-40', grupo: 'lavagem', frase: 'Lavar a 40 °C' },
  { cod: 'lavar-40-suave', grupo: 'lavagem', frase: 'Lavar a 40 °C, ciclo suave' },
  { cod: 'lavar-40-muito-suave', grupo: 'lavagem', frase: 'Lavar a 40 °C, ciclo muito suave' },
  { cod: 'lavar-50', grupo: 'lavagem', frase: 'Lavar a 50 °C' },
  { cod: 'lavar-60', grupo: 'lavagem', frase: 'Lavar a 60 °C' },
  { cod: 'lavar-95', grupo: 'lavagem', frase: 'Lavar a 95 °C' },
  { cod: 'lavar-mao', grupo: 'lavagem', frase: 'Lavar à mão, até 40 °C' },
  { cod: 'nao-lavar', grupo: 'lavagem', frase: 'Não lavar' },
  { cod: 'alvejar', grupo: 'alvejamento', frase: 'Pode usar qualquer alvejante' },
  { cod: 'alvejar-oxigenio', grupo: 'alvejamento', frase: 'Só alvejante de oxigênio, sem cloro' },
  { cod: 'nao-alvejar', grupo: 'alvejamento', frase: 'Não alvejar' },
  { cod: 'tambor-normal', grupo: 'tambor', frase: 'Secar em tambor, temperatura normal' },
  { cod: 'tambor-baixa', grupo: 'tambor', frase: 'Secar em tambor, temperatura baixa' },
  { cod: 'nao-tambor', grupo: 'tambor', frase: 'Não secar em tambor' },
  { cod: 'varal', grupo: 'natural', frase: 'Secar no varal' },
  { cod: 'varal-sombra', grupo: 'natural', frase: 'Secar no varal, à sombra' },
  { cod: 'varal-pingando', grupo: 'natural', frase: 'Secar no varal sem torcer' },
  { cod: 'varal-pingando-sombra', grupo: 'natural', frase: 'Secar no varal sem torcer, à sombra' },
  { cod: 'horizontal', grupo: 'natural', frase: 'Secar na horizontal' },
  { cod: 'horizontal-sombra', grupo: 'natural', frase: 'Secar na horizontal, à sombra' },
  { cod: 'horizontal-pingando', grupo: 'natural', frase: 'Secar na horizontal sem torcer' },
  {
    cod: 'horizontal-pingando-sombra',
    grupo: 'natural',
    frase: 'Secar na horizontal sem torcer, à sombra',
  },
  { cod: 'passar-1', grupo: 'passadoria', frase: 'Passar a até 110 °C, sem vapor' },
  { cod: 'passar-2', grupo: 'passadoria', frase: 'Passar a até 150 °C' },
  { cod: 'passar-3', grupo: 'passadoria', frase: 'Passar a até 200 °C' },
  { cod: 'nao-passar', grupo: 'passadoria', frase: 'Não passar' },
  { cod: 'seco-p', grupo: 'profissional', frase: 'Limpeza a seco com percloroetileno' },
  {
    cod: 'seco-p-suave',
    grupo: 'profissional',
    frase: 'Limpeza a seco com percloroetileno, suave',
  },
  { cod: 'seco-f', grupo: 'profissional', frase: 'Limpeza a seco com hidrocarboneto' },
  { cod: 'seco-f-suave', grupo: 'profissional', frase: 'Limpeza a seco com hidrocarboneto, suave' },
  { cod: 'nao-seco', grupo: 'profissional', frase: 'Não limpar a seco' },
  { cod: 'umido-w', grupo: 'profissional', frase: 'Limpeza profissional a úmido' },
  { cod: 'umido-w-suave', grupo: 'profissional', frase: 'Limpeza a úmido, suave' },
  { cod: 'umido-w-muito-suave', grupo: 'profissional', frase: 'Limpeza a úmido, muito suave' },
  { cod: 'nao-umido', grupo: 'profissional', frase: 'Não limpar a úmido' },
]

const POR_COD = new Map(CUIDADOS.map(c => [c.cod, c]))

export function cuidadoDe(cod: string): Cuidado | undefined {
  return POR_COD.get(cod)
}

/** Os cuidados na ordem da etiqueta, sem os códigos que a lista não conhece. */
export function cuidadosEmOrdem(cods: string[]): Cuidado[] {
  return CUIDADOS.filter(c => cods.includes(c.cod))
}

/** Marca um símbolo: tira o outro do mesmo grupo, e marcar de novo o mesmo tira ele. */
export function alternarCuidado(cods: string[], cod: string): string[] {
  const novo = cuidadoDe(cod)
  if (!novo) return cods
  if (cods.includes(cod)) return cods.filter(c => c !== cod)
  const semOGrupo = cods.filter(c => cuidadoDe(c)?.grupo !== novo.grupo)
  return cuidadosEmOrdem([...semOGrupo, cod]).map(c => c.cod)
}

/* ---------- o desenho ------------------------------------------------------ */

const X = <path d="M3.5 3.5l17 17M20.5 3.5l-17 17" />
const TINA = <path d="M3.2 6.5 5.3 17h13.4l2.1-10.5" />
const ONDA = <path d="M2.6 7.7c1.6-1.5 3.1-1.5 4.7 0s3.1 1.5 4.7 0 3.1-1.5 4.7 0 3.1 1.5 4.7 0" />
const BARRA1 = <path d="M6.5 19.7h11" />
const BARRA2 = <path d="M6.5 19.7h11M6.5 22.1h11" />
const TRI = <path d="M12 3.5 21.3 19.5H2.7z" />
const QUAD = <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
const SOMBRA = <path d="M3.5 9.5l6-6" />
const TAMBOR = <circle cx="12" cy="12" r="6" />
const FERRO = (
  <>
    <path d="M3 18.5 6.6 11h13.9v7.5z" />
    <path d="M8.5 11V8.6a2 2 0 0 1 2-2h6a4 4 0 0 1 4 4v.4" />
  </>
)
const MAO = (
  <path d="M9.2 12.6V5.4a1 1 0 0 1 2 0v4.2m0 0V4.4a1 1 0 0 1 2 0v5.2m0 0V5.6a1 1 0 0 1 2 0v6M9.2 11l-1.2-1a1 1 0 0 0-1.4 1.4l2.3 3c.6.8 1.5 1.2 2.5 1.2h1a3 3 0 0 0 2.8-3" />
)

function Texto({ t, y = 16, tam = 6.3 }: { t: string; y?: number; tam?: number }) {
  return (
    <text
      x="12"
      y={y}
      textAnchor="middle"
      fontSize={tam}
      fontWeight="700"
      fill="currentColor"
      stroke="none"
    >
      {t}
    </text>
  )
}

function Pontos({ xs, y }: { xs: number[]; y: number }) {
  return (
    <>
      {xs.map(x => (
        <circle key={x} cx={x} cy={y} r="1.05" fill="currentColor" stroke="none" />
      ))}
    </>
  )
}

function Circulo({ letra, barras = 0 }: { letra: string; barras?: 0 | 1 | 2 }) {
  if (barras) {
    return (
      <>
        <circle cx="12" cy="10.2" r="7.2" />
        <Texto t={letra} y={13.2} tam={8} />
        <path d={barras === 1 ? 'M6.5 20h11' : 'M6.5 20h11M6.5 22.4h11'} />
      </>
    )
  }
  return (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <Texto t={letra} y={15} tam={8.4} />
    </>
  )
}

const lavar = (grau: string, barra?: ReactNode) => (
  <>
    {TINA}
    {ONDA}
    <Texto t={grau} />
    {barra}
  </>
)
const secar = (dentro: ReactNode, sombra = false) => (
  <>
    {QUAD}
    {sombra ? SOMBRA : null}
    {dentro}
  </>
)

const DESENHO: Record<string, ReactNode> = {
  'lavar-30': lavar('30'),
  'lavar-30-suave': lavar('30', BARRA1),
  'lavar-30-muito-suave': lavar('30', BARRA2),
  'lavar-40': lavar('40'),
  'lavar-40-suave': lavar('40', BARRA1),
  'lavar-40-muito-suave': lavar('40', BARRA2),
  'lavar-50': lavar('50'),
  'lavar-60': lavar('60'),
  'lavar-95': lavar('95'),
  'lavar-mao': (
    <>
      {TINA}
      {MAO}
    </>
  ),
  'nao-lavar': (
    <>
      {TINA}
      {ONDA}
      {X}
    </>
  ),
  alvejar: TRI,
  'alvejar-oxigenio': (
    <>
      {TRI}
      <path d="M8.5 19.5l6.4-11M14 19.5l3.65-6.28" />
    </>
  ),
  'nao-alvejar': (
    <>
      {TRI}
      {X}
    </>
  ),
  'tambor-normal': (
    <>
      {QUAD}
      {TAMBOR}
      <Pontos xs={[10, 14]} y={12} />
    </>
  ),
  'tambor-baixa': (
    <>
      {QUAD}
      {TAMBOR}
      <Pontos xs={[12]} y={12} />
    </>
  ),
  'nao-tambor': (
    <>
      {QUAD}
      {TAMBOR}
      {X}
    </>
  ),
  varal: secar(<path d="M12 7v10" />),
  'varal-sombra': secar(<path d="M12 7v10" />, true),
  'varal-pingando': secar(<path d="M9.5 7v10M14.5 7v10" />),
  'varal-pingando-sombra': secar(<path d="M9.5 7v10M14.5 7v10" />, true),
  horizontal: secar(<path d="M7 12h10" />),
  'horizontal-sombra': secar(<path d="M7 12h10" />, true),
  'horizontal-pingando': secar(<path d="M7 10h10M7 14h10" />),
  'horizontal-pingando-sombra': secar(<path d="M7 10.5h10M7 14.5h10" />, true),
  'passar-1': (
    <>
      {FERRO}
      <Pontos xs={[12.5]} y={14.8} />
    </>
  ),
  'passar-2': (
    <>
      {FERRO}
      <Pontos xs={[10.8, 14.2]} y={14.8} />
    </>
  ),
  'passar-3': (
    <>
      {FERRO}
      <Pontos xs={[9.3, 12.5, 15.7]} y={14.8} />
    </>
  ),
  'nao-passar': (
    <>
      {FERRO}
      {X}
    </>
  ),
  'seco-p': <Circulo letra="P" />,
  'seco-p-suave': <Circulo letra="P" barras={1} />,
  'seco-f': <Circulo letra="F" />,
  'seco-f-suave': <Circulo letra="F" barras={1} />,
  'nao-seco': (
    <>
      <circle cx="12" cy="12" r="8.2" />
      {X}
    </>
  ),
  'umido-w': <Circulo letra="W" />,
  'umido-w-suave': <Circulo letra="W" barras={1} />,
  'umido-w-muito-suave': <Circulo letra="W" barras={2} />,
  'nao-umido': (
    <>
      <Circulo letra="W" />
      {X}
    </>
  ),
}

/** O símbolo desenhado. Sem `mudo`, o leitor de tela diz a frase dele. */
export function SimboloDeCuidado({
  cod,
  tamanho = 26,
  mudo,
}: {
  cod: string
  tamanho?: number
  /** quando a frase já está escrita ao lado, ou no botão em volta */
  mudo?: boolean
}) {
  const c = cuidadoDe(cod)
  if (!c) return null
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={mudo ? undefined : 'img'}
      aria-label={mudo ? undefined : c.frase}
      aria-hidden={mudo ? true : undefined}
      data-cuidado={cod}
    >
      {DESENHO[cod]}
    </svg>
  )
}

/* ---------- as fibras ------------------------------------------------------ */

/* As fibras que a fábrica compra. A lista é da tela: o banco aceita qualquer
   nome, e a que não está aqui se escreve em "Outra". */
export const FIBRAS = [
  'Algodão',
  'Poliéster',
  'Poliamida',
  'Elastano',
  'Viscose',
  'Modal',
  'Linho',
  'Acrílico',
  'Lã',
  'Bambu',
  'Polipropileno',
]
