/* ==========================================================================
   A conferência do título de cartão.

   Desde 05/10/2026 todo título de cartão leva um ÍCONE que diz do que o cartão
   trata, no lugar do quadradinho vermelho de antes (pedido do Henrique). Quem
   desenha o título é o `TituloCartao` do Design System, e nele o `icone` é
   obrigatório: título sem ícone não compila.

   O que o tipo não pega é o título escrito à mão, por fora do componente. Era
   assim que o Estoque inteiro fazia (`<h3 className="cartao-titulo">` com um
   `<span className="marca" />`), e por isso o quadradinho estava em 17 lugares
   que o componente não enxergava. Esta conferência fecha essa porta:

     1. `cartao-titulo` só aparece em `src/ds`. Tela usa o `TituloCartao`.
     2. O quadradinho não volta: nenhum CSS desenha a `.marca` de título, nem
        um ponto de marca antes de um título com `::before`.

   Rodar:  node testes/titulos.mjs
   ========================================================================== */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname
function arquivos(dir, fim, achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, fim, achados)
    else if (fim.some((f) => nome.endsWith(f))) achados.push(caminho)
  }
  return achados
}
const achados = []
const linhaDe = (texto, posicao) => texto.slice(0, posicao).split('\n').length

for (const caminho of arquivos(join(RAIZ, 'src'), ['.tsx', '.ts'])) {
  const nome = relative(RAIZ, caminho)
  if (nome.startsWith('src/ds/')) continue
  const texto = readFileSync(caminho, 'utf8')
  for (const m of texto.matchAll(/cartao-titulo/g)) {
    achados.push(`${nome}:${linhaDe(texto, m.index)}  título de cartão escrito à mão: use o TituloCartao do Design System, com o ícone`)
  }
}
for (const caminho of arquivos(join(RAIZ, 'src'), ['.css'])) {
  const nome = relative(RAIZ, caminho)
  const texto = readFileSync(caminho, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  for (const m of texto.matchAll(/\.cartao-titulo\s+\.marca\b/g)) {
    achados.push(`${nome}:${linhaDe(texto, m.index)}  o quadradinho do título voltou: o título leva ícone, não marca`)
  }
  /* o ponto de marca desenhado antes de um título: h2, h3 ou h4 com ::before pintado de --brand */
  for (const m of texto.matchAll(/([^{}]*\bh[2-4](?:\.[\w-]+)?::before[^{}]*)\{([^}]*)\}/g)) {
    if (/background(-color)?\s*:\s*var\(--brand\)/.test(m[2])) {
      achados.push(`${nome}:${linhaDe(texto, m.index + m[0].indexOf(m[1].trim()))}  ponto de marca antes do título (${m[1].trim()}): o título leva ícone`)
    }
  }
}

if (achados.length) {
  console.error(`${achados.length} achado(s) no título de cartão:\n`)
  for (const a of achados) console.error('  ' + a)
  process.exit(1)
}
console.log('títulos de cartão: nenhum escrito à mão, nenhum quadradinho de volta')
