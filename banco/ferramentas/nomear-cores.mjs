/* Dá nome às 387 cores de impressão.

   As cores de DTF e de sublimação nunca tiveram nome: o operador lê o número
   na máquina e pronto. Mas quem vende manda o orçamento para o cliente, e
   "(157)" não diz nada para quem vai vestir a camiseta.

   De onde vêm os nomes: das 122 cores de tecido, que JÁ têm nome escolhido
   pela Fourtime. Quando uma cor de impressão cai perto o suficiente de uma
   cor de tecido, ela herda aquele nome. É a diferença entre usar o vocabulário
   da casa e inventar um novo do zero.

   Quando não cai perto de nenhuma, o nome é montado: família de matiz em
   português mais o tom. E quando dois números chegam ao mesmo nome, o grupo é
   ordenado do mais claro para o mais escuro e cada um ganha o seu tom.

   Nada disso é opinião de gosto: é distância de cor medida em Lab, que é o
   espaço que se aproxima de como o olho compara. O resultado é uma proposta
   para o Henrique corrigir na tela, não uma decisão final.
*/

import fs from 'node:fs'
import { DICIONARIO } from './dicionario-de-cores.mjs'

const bd = JSON.parse(fs.readFileSync(new URL('../origem-3375.json', import.meta.url)))

/* --- cor em número ------------------------------------------------------- */
const paraRgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/* sRGB para Lab. O passo do meio (XYZ) existe porque a distância entre duas
   cores em RGB não tem relação com o quanto o olho as vê diferentes. */
function paraLab(hex) {
  let [r, g, b] = paraRgb(hex).map((v) => v / 255)
  ;[r, g, b] = [r, g, b].map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92))
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function paraHsl(hex) {
  const [r, g, b] = paraRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s * 100, l * 100]
}

/* --- as famílias de matiz, em português ---------------------------------- */
const FAMILIAS = [
  [345, 360, 'Vermelho'],
  [0, 12, 'Vermelho'],
  [12, 22, 'Laranja Avermelhado'],
  [22, 40, 'Laranja'],
  [40, 52, 'Âmbar'],
  [52, 66, 'Amarelo'],
  [66, 82, 'Verde Limão'],
  [82, 150, 'Verde'],
  [150, 172, 'Verde Água'],
  [172, 192, 'Turquesa'],
  [192, 205, 'Ciano'],
  [205, 232, 'Azul'],
  [232, 255, 'Azul Cobalto'],
  [255, 280, 'Violeta'],
  [280, 300, 'Roxo'],
  [300, 320, 'Magenta'],
  [320, 335, 'Pink'],
  [335, 345, 'Rosa'],
]

const familiaDe = (h) => {
  const f = FAMILIAS.find(([a, b]) => h >= a && h < b)
  return f ? f[2] : 'Vermelho'
}

/* Cinza e quase-cinza têm nome próprio: chamar de "Azul Bem Claro" uma coisa
   que o olho lê como branco é pior que não nomear. */
function nomeNeutro(l) {
  if (l >= 96) return 'Branco'
  if (l >= 88) return 'Branco Gelo'
  if (l >= 76) return 'Cinza Claro'
  if (l >= 60) return 'Cinza'
  if (l >= 44) return 'Cinza Médio'
  if (l >= 28) return 'Cinza Escuro'
  if (l >= 12) return 'Grafite'
  return 'Preto'
}

/* --- o vocabulário da casa ----------------------------------------------- */
/* As duas cores de marcador ficam de fora: SUBLIMAÇÃO e AMARELO MANTEIGA são
   #cccccc de enfeite, não cor de verdade, e puxariam vizinhos para um nome
   sem sentido. */
/* O dicionário entra primeiro, e as cores de tecido da Fourtime depois: assim,
   quando as duas trazem o mesmo nome, fica a versão da casa. */
const VOCABULARIO = (() => {
  const vistos = new Set()
  const lista = []
  const por = (nome, hex) => {
    const chave = nome.toLowerCase()
    if (vistos.has(chave)) return
    vistos.add(chave)
    lista.push({ nome, hex, lab: paraLab(hex) })
  }
  bd.coresDeTecido
    .filter((c) => c.c.toLowerCase() !== '#cccccc')
    .forEach((c) => por(c.n, c.c))
  DICIONARIO.forEach(([nome, hex]) => por(nome, hex))
  return lista
})()

/* 12 é perto o bastante para o olho chamar de "a mesma cor". Acima disso o
   nome emprestado começa a mentir, e aí é melhor montar um. */
const PERTO = 22

function maisPerto(hex) {
  const lab = paraLab(hex)
  let melhor = null
  let menor = Infinity
  for (const v of VOCABULARIO) {
    const d = distancia(lab, v.lab)
    if (d < menor) {
      menor = d
      melhor = v
    }
  }
  return { nome: melhor.nome, distancia: menor }
}

/* --- montar o nome quando não dá para herdar ------------------------------
   O tom vem da claridade e da saturação DE VERDADE, nunca da posição da cor
   dentro de um grupo. Foi esse o erro da primeira versão: ela chamava um
   vermelho forte de "Cereja Bem Claro" e um azul quase preto de "Azul Marinho
   Claro", porque olhava a ordem e não a cor. Nome que mente é pior que número.
*/
function tomDe(s, l) {
  if (l >= 88) return 'Bem Claro'
  if (l >= 74) return 'Claro'
  if (l >= 60) return s >= 55 ? 'Vivo' : 'Suave'
  if (l >= 44) return s >= 88 ? 'Neon' : ''
  if (l >= 30) return s >= 70 ? '' : 'Acinzentado'
  if (l >= 17) return 'Escuro'
  return 'Bem Escuro'
}

function nomeMontado(hex) {
  const [h, s, l] = paraHsl(hex)
  if (s < 10) return nomeNeutro(l)
  return (familiaDe(h) + ' ' + tomDe(s, l)).trim()
}

/* Um nome do vocabulário que já carrega tom não aceita outro por cima:
   "Azul Marinho Claro" e "Amarelo Canário Escuro" se contradizem sozinhos. */
const JA_TEM_TOM =
  /(claro|escuro|médio|suave|vivo|neon|bebê|ônix|mescla|metálico|bem)\b/i

function comTom(nome, diferencaDeL) {
  if (JA_TEM_TOM.test(nome)) return null
  if (diferencaDeL >= 22) return nome + ' Bem Claro'
  if (diferencaDeL >= 10) return nome + ' Claro'
  if (diferencaDeL <= -22) return nome + ' Bem Escuro'
  if (diferencaDeL <= -10) return nome + ' Escuro'
  return null
}

/* --- roda ----------------------------------------------------------------
   Uma passada só, na ordem do número, e o nome do vocabulário fica com quem
   chegou mais perto. Quem chegar depois no mesmo nome ganha um tom, se a
   diferença de claridade justificar, e se não justificar monta o nome do
   zero. No fim, o que ainda repetir recebe um número, porque "Azul Piscina 2"
   é honesto e "Azul Piscina Claro" num azul que não é mais claro não é.
*/
function nomear(mapa) {
  const lista = Object.entries(mapa)
    .map(([codigo, hex]) => ({ codigo, hex: hex.toUpperCase() }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo))

  /* quem está mais perto de cada nome do vocabulário fica com ele */
  const dono = new Map()
  lista.forEach((c) => {
    const { nome, distancia: d } = maisPerto(c.hex)
    c.vizinho = nome
    c.perto = d
    if (d <= PERTO && (!dono.has(nome) || dono.get(nome).perto > d)) dono.set(nome, c)
  })

  lista.forEach((c) => {
    if (c.perto <= PERTO && dono.get(c.vizinho) === c) {
      c.nome = c.vizinho
      c.deOnde = 'tecido'
      return
    }
    if (c.perto <= PERTO) {
      const ref = VOCABULARIO.find((v) => v.nome === c.vizinho)
      const tom = comTom(c.vizinho, paraHsl(c.hex)[2] - paraHsl(ref.hex)[2])
      if (tom) {
        c.nome = tom
        c.deOnde = 'tecido com tom'
        return
      }
    }
    c.nome = nomeMontado(c.hex)
    c.deOnde = 'montado'
  })

  /* o que ainda repetir: número, do mais claro para o mais escuro */
  const porNome = new Map()
  lista.forEach((c) => {
    if (!porNome.has(c.nome)) porNome.set(c.nome, [])
    porNome.get(c.nome).push(c)
  })
  for (const [nome, grupo] of porNome) {
    if (grupo.length < 2) continue
    grupo.sort((a, b) => paraHsl(b.hex)[2] - paraHsl(a.hex)[2])
    grupo.forEach((c, i) => {
      if (i > 0) c.nome = nome + ' ' + (i + 1)
    })
  }

  return lista.map(({ codigo, hex, nome, deOnde }) => ({ codigo, hex, nome, deOnde }))
}

const dtf = nomear(bd.coresDtf)
const sub = nomear(bd.coresSublimacao)
const todas = [...dtf, ...sub]

fs.writeFileSync(
  new URL('../cores-nomeadas.json', import.meta.url),
  JSON.stringify(todas, null, 1),
)

const conta = (q) => todas.filter((c) => c.deOnde === q).length
const repetidos = todas.length - new Set(todas.map((c) => c.codigo.startsWith('S') ? 'S|' + c.nome : 'D|' + c.nome)).size
console.log('cores nomeadas:', todas.length)
console.log('  nome da cor de tecido, inteiro:', conta('tecido'))
console.log('  nome da cor de tecido, com tom:', conta('tecido com tom'))
console.log('  nome montado:', conta('montado'))
console.log('  com numero no fim:', todas.filter((c) => /\s\d+$/.test(c.nome)).length)
console.log('  repetidos dentro da mesma tecnica:', repetidos)
