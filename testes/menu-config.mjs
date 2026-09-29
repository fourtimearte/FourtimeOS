/* ==========================================================================
   O MENU DE CONFIGURACOES ESTA INTEIRO?

   Em 29/09 o menu lateral mostrava quatro das oito paginas de Configuracoes.
   Ninguem apagou nada: cada pagina nova entrou nas abas do topo e esqueceu o
   menu, porque o menu tinha a sua propria lista escrita a mao. O navegador
   nao reclama de item que falta, entao so descobre quem procura.

   A cura foi uma lista so (ABAS_DA_CONFIG, em modules/config/abas.tsx), que
   as abas e o menu leem. Esta conferencia garante que continue assim:

     1. toda rota de Configuracoes em rotas.tsx esta na lista
     2. toda pagina que desenha <AbasDaConfig atual="x"> tem x na lista
     3. o menu em app.tsx le da lista, e nao escreve galho /config a mao

   A regra esta em claude/REGRA-MENU-DE-CONFIGURACOES.md.

   Rodar:  node testes/menu-config.mjs
   ========================================================================== */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname
const ler = (c) => readFileSync(join(RAIZ, c), 'utf8')
const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const abas = semComentario(ler('src/modules/config/abas.tsx'))
const lista = abas.slice(abas.indexOf('ABAS_DA_CONFIG'), abas.indexOf('export const ICONE_DA_ABA'))
const itens = [...lista.matchAll(/\{\s*chave:\s*'([^']+)',\s*para:\s*'([^']+)'/g)].map((m) => ({
  chave: m[1],
  para: m[2],
}))
const paras = new Set(itens.map((i) => i.para))
const chaves = new Set(itens.map((i) => i.chave))

const erros = []
if (itens.length < 2) erros.push('nao achei a lista ABAS_DA_CONFIG em abas.tsx (mudou de formato?)')

/* 1. as rotas */
const rotas = semComentario(ler('src/rotas.tsx'))
for (const m of rotas.matchAll(/path:\s*'([^']+)',\s*element:\s*([^\n]+)/g)) {
  const caminho = '/' + m[1]
  const daConfig = m[1] === 'config' || m[1].startsWith('config/') || m[2].includes('AbasDaConfig')
  if (daConfig && !paras.has(caminho)) {
    erros.push(`rota ${caminho} e de Configuracoes e nao esta em ABAS_DA_CONFIG: some do menu e das abas`)
  }
}

/* 2. as paginas que desenham as abas */
const pasta = join(RAIZ, 'src/modules/config')
const fontes = [
  ...readdirSync(pasta)
    .filter((n) => n.endsWith('.tsx'))
    .map((n) => ['src/modules/config/' + n, ler('src/modules/config/' + n)]),
  ['src/rotas.tsx', rotas],
]
for (const [arquivo, texto] of fontes) {
  for (const m of texto.matchAll(/<AbasDaConfig\s+atual="([^"]+)"/g)) {
    if (!chaves.has(m[1])) erros.push(`${arquivo} desenha a aba "${m[1]}", que nao existe em ABAS_DA_CONFIG`)
  }
}

/* 3. o menu le da lista */
const app = semComentario(ler('src/app.tsx'))
if (!app.includes('abasDaConfigDe(')) {
  erros.push('app.tsx nao monta o galho de Configuracoes com abasDaConfigDe(): o menu voltou a ter lista propria')
}
const aMao = [...app.matchAll(/para:\s*'(\/config[^']*|\/banco|\/kit)'/g)].map((m) => m[1])
for (const p of aMao) {
  if (p !== '/config') erros.push(`app.tsx escreve o galho ${p} a mao: ele tem que vir de ABAS_DA_CONFIG`)
}

if (erros.length) {
  console.log('\nMENU DE CONFIGURACOES: ' + erros.length + ' problema(s)\n')
  for (const e of erros) console.log('  - ' + e)
  console.log('')
  process.exit(1)
}
console.log(`menu de Configuracoes: ${itens.length} paginas, todas no menu e nas abas`)
