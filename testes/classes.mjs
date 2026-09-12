/* ==========================================================================
   A conferencia de classe emprestada.

   Duas vezes na mesma semana uma tela quebrou pelo mesmo motivo: um CSS de
   modulo escreveu uma regra usando uma classe que era do Design System.

     .mes.vazio       -> ".vazio" e o estado vazio do DS, com 44 px de padding
     .lay-bt.campo    -> ".campo" e o campo de formulario do DS, em coluna

   Nos dois casos a regra parecia local e nao era: o navegador aplicou junto
   tudo que o DS ja dizia daquela classe. Nao da para ver isso lendo o arquivo,
   porque o arquivo mostra so metade da verdade.

   A regra daqui em diante: um CSS de modulo ou de dominio so pode escrever
   selecionadores com classes que ele mesmo define. Classe de fora entra pelo
   prefixo do dono (ds/ define, modulo usa no className), nunca dentro de um
   selecionador de modulo.

   Rodar:  node testes/classes.mjs
   ========================================================================== */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname

function arquivos(dir, achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, achados)
    else if (nome.endsWith('.css')) achados.push(caminho)
  }
  return achados
}

/* Toda classe que aparece num selecionador do arquivo. */
function classesDoCss(css) {
  const fora = new Set()
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of limpo.matchAll(/(^|\})([^{}@]+)\{/g)) {
    for (const c of m[2].matchAll(/\.([a-zA-Z][\w-]*)/g)) fora.add(c[1])
  }
  return fora
}

function selecionadores(css) {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...limpo.matchAll(/(^|\})([^{}@]+)\{/g)].map((m) => m[2].trim())
}

/* So interessa a classe que o ds/ pinta SOZINHA, isto e, num selecionador que
   nao pede mais nada: ".campo { }" e ".vazio { }" valem em qualquer elemento
   que leve a classe, em qualquer lugar da tela, e e por isso que reusar o nome
   quebra. Ja ".kpi.ligado" so vale dentro de um KPI: um ".ct-chip.ligado" de
   modulo nao encosta nela. */
function classesSoltasDo(css) {
  const fora = new Set()
  for (const sel of selecionadores(css)) {
    for (const parte of sel.split(',')) {
      const ultimo = parte.trim().split(/\s+|>|\+|~/).filter(Boolean).pop()
      if (!ultimo) continue
      /* tira o pseudo, e exige uma classe so, sem nome de elemento na frente */
      const m = /^\.([a-zA-Z][\w-]*)(::?[\w-]+(\([^)]*\))?)*$/.exec(ultimo)
      if (m) fora.add(m[1])
    }
  }
  return fora
}

const DS = join(RAIZ, 'src/ds')
const doDs = new Set()
for (const a of arquivos(DS)) {
  for (const c of classesSoltasDo(readFileSync(a, 'utf8'))) doDs.add(c)
}

/* O prefixo de um arquivo sai das proprias classes dele: cl-kpis e cl-tab
   dizem que o prefixo e "cl". Um arquivo pode ter mais de um, e nao ha lista
   escrita em lugar nenhum para ficar desatualizada. */
function prefixosDo(css) {
  const p = new Set()
  for (const c of classesDoCss(css)) {
    const i = c.indexOf('-')
    if (i > 0) p.add(c.slice(0, i))
  }
  return p
}

const problemas = []
for (const pasta of ['src/modules', 'src/dominio']) {
  for (const a of arquivos(join(RAIZ, pasta))) {
    const css = readFileSync(a, 'utf8')
    const prefixos = prefixosDo(css)
    for (const sel of selecionadores(css)) {
      /* So o COMPOSTO interessa: ".lay-bt.campo" e ".mes.vazio" poem a classe
         do ds/ no MESMO elemento que a do modulo, e ai as duas regras valem
         juntas sem o arquivo dizer. ".ct-filtros .busca" e outra conversa: ali
         o modulo esta so colocando um componente do ds/ no lugar, que e o uso
         certo e acontece em toda tela. */
      for (const parte of sel.split(',')) {
        for (const alvo of parte.trim().split(/\s+|>|\+|~/).filter(Boolean)) {
          const classes = [...alvo.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1])
          if (!classes.length) continue
          const comElemento = /^[a-zA-Z]/.test(alvo)
          const meu = classes.some((n) => {
            const i = n.indexOf('-')
            return i > 0 && prefixos.has(n.slice(0, i))
          })
          /* Duas formas contam, e as duas poem a regra do ds/ no mesmo
             elemento sem o arquivo dizer:
               .lay-bt.campo     classe do modulo junto com a do ds/
               button.vazio      a do ds/ pendurada num elemento nosso
             Um ".ct-filtros .busca" sozinho nao conta: ali o modulo so esta
             colocando um componente do ds/ no lugar, que e o uso certo. */
          if (!meu && !comElemento) continue
          for (const nome of classes) {
            if (!doDs.has(nome)) continue
            const i = nome.indexOf('-')
            if (i > 0 && prefixos.has(nome.slice(0, i))) continue
            problemas.push({
              arquivo: a.replace(RAIZ, ''),
              selecionador: sel.split('\n')[0].trim(),
              classe: nome,
            })
          }
        }
      }
    }
  }
}

if (!problemas.length) {
  console.log('classes ok: nenhum CSS de modulo escreve regra com classe do Design System')
  process.exit(0)
}

console.log('x ' + problemas.length + ' regra(s) usando classe que e do Design System:')
for (const p of problemas) {
  console.log('  ' + p.arquivo + '  ' + p.selecionador + '   (".' + p.classe + '" é do ds/)')
}
console.log('')
console.log('A regra do ds/ vale junto com a sua, e o arquivo nao mostra isso.')
console.log('Troque por um nome com o prefixo do modulo.')
process.exit(1)
