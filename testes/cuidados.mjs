/* ==========================================================================
   OS SÍMBOLOS DE CUIDADO: A LISTA DA TELA E A DO BANCO SÃO A MESMA.

   O código, o grupo e a ordem de cada símbolo moram em dois lugares: no banco
   (banco/048-a-ficha-tecnica-da-cor.sql, que confere a ficha antes de gravar)
   e na tela (src/dominio/estoque/cuidados.tsx, que tem o desenho e a frase).
   Lista em dois lugares esquece um: este teste reprova quando as duas se
   separam, e quando falta desenho para um código.

   Uso:  node testes/cuidados.mjs
   ========================================================================== */
import { readFileSync } from 'node:fs'

const sql = readFileSync('banco/048-a-ficha-tecnica-da-cor.sql', 'utf8')
const tsx = readFileSync('src/dominio/estoque/cuidados.tsx', 'utf8')

const doBanco = [...sql.matchAll(/\('([a-z0-9-]+)',\s*'([a-z]+)',\s*(\d+)\)/g)].map((m) => ({ cod: m[1], grupo: m[2], ordem: Number(m[3]) }))
doBanco.sort((a, b) => a.ordem - b.ordem)
const daTela = [...tsx.matchAll(/cod:\s*'([a-z0-9-]+)',\s*grupo:\s*'([a-z]+)'/g)].map((m) => ({ cod: m[1], grupo: m[2] }))
const bloco = tsx.slice(tsx.indexOf('const DESENHO'), tsx.indexOf('/** O símbolo desenhado'))
const desenhados = new Set([...bloco.matchAll(/^\s{2}'?([a-z0-9-]+)'?:/gm)].map((m) => m[1]))
const gruposDoBanco = [...(sql.match(/grupo in \(([^)]+)\)/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1])
const gruposDaTela = [...(tsx.match(/GRUPOS_DE_CUIDADO: GrupoDeCuidado\[\] = \[([^\]]+)\]/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1])

const achados = []
const conta = (certo, texto) => { achados.push(certo); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

conta(doBanco.length === 38 && daTela.length === 38, `38 símbolos no banco e 38 na tela (${doBanco.length} e ${daTela.length})`)
const diferentes = doBanco.filter((b, i) => daTela[i]?.cod !== b.cod || daTela[i]?.grupo !== b.grupo).map((b) => b.cod)
conta(diferentes.length === 0, `mesmo código, mesmo grupo e mesma ordem nas duas listas (${diferentes.join(', ') || 'iguais'})`)
const semDesenho = daTela.filter((t) => !desenhados.has(t.cod)).map((t) => t.cod)
const semLista = [...desenhados].filter((d) => !daTela.some((t) => t.cod === d))
conta(semDesenho.length === 0 && semLista.length === 0, `todo símbolo tem desenho, e todo desenho tem símbolo (sem desenho: ${semDesenho.join(', ') || 'nenhum'}; sem lista: ${semLista.join(', ') || 'nenhum'})`)
conta(gruposDoBanco.join(',') === gruposDaTela.join(',') && gruposDaTela.length === 6, `os seis grupos, na mesma ordem (${gruposDaTela.join(', ')})`)
const porGrupo = {}
daTela.forEach((t) => { porGrupo[t.grupo] = (porGrupo[t.grupo] ?? 0) + 1 })
conta(Object.keys(porGrupo).every((g) => gruposDaTela.includes(g)), `nenhum símbolo num grupo que não existe (${Object.entries(porGrupo).map(([g, n]) => g + ' ' + n).join(', ')})`)
const repetidos = daTela.map((t) => t.cod).filter((c, i, l) => l.indexOf(c) !== i)
conta(repetidos.length === 0, `nenhum código repetido (${repetidos.join(', ') || 'nenhum'})`)

const ruins = achados.filter((a) => !a).length
console.log(ruins ? `\n${ruins} conferência(s) reprovada(s).` : '\ncuidados ok: a lista da tela e a do banco são a mesma')
if (ruins) process.exit(1)
