/* ==========================================================================
   O DESENHO DO DEPÓSITO, SEM NAVEGADOR.

   Duas coisas se provam aqui. A primeira é o texto que cabe na forma: quebrar
   o nome em linhas, diminuir a letra antes de cortar, e nunca devolver uma
   linha mais larga que a caixa. A segunda são os dois campos do palete, a
   referência (P01, o endereço) e o nome (ALGODÃO, o que a pessoa escreveu).

   A RÉGUA É DE MENTIRA: cada letra mede 0,6 da altura. O que se prova é a
   conta, e não a letra; a letra de verdade é medida no teste de página
   (testes/deposito.mjs), que pergunta ao navegador onde cada texto ficou.

   Rodar:  sh testes/planta.sh
   ========================================================================== */

import * as t from './compilado-planta/src/dominio/deposito/texto.js'
import * as p from './compilado-planta/src/dominio/deposito/planta.js'

let ruins = 0
const conta = (certo, frase) => {
  if (!certo) ruins++
  console.log((certo ? 'ok   ' : 'RUIM ') + frase)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const regua = (texto, fonte) => texto.length * fonte * 0.6
const semEspaco = s => s.replace(/\s+/g, '')

/* ---------- 1. o texto que cabe ------------------------------------------- */

conta(igual(t.tamanhosDeLetra(9, 6.5), [9, 8.5, 8, 7.5, 7, 6.5]), 'os tamanhos de letra descem de meio em meio pixel, do maior até o menor')
conta(igual(t.tamanhosDeLetra(6.5, 6.5), [6.5]), 'quando o maior já é o menor, sobra um tamanho só')

{
  // 60 px numa letra de 10: cabem 10 letras por linha
  const l = t.quebrarEmLinhas('POLIAMIDA FUR C/ ELASTANO', 60, 10, regua)
  conta(igual(l, ['POLIAMIDA', 'FUR C/', 'ELASTANO']), `a quebra é no espaço, e junta o que cabe na mesma linha (${l.join(' | ')})`)
  conta(l.every(x => regua(x, 10) <= 60), 'nenhuma linha passa da largura')
  const s = t.quebrarEmLinhas('  DRY   DE\nSUBLIMAÇÃO ', 60, 10, regua)
  conta(igual(s, ['DRY DE', 'SUBLIMAÇÃO']), 'espaço sobrando e quebra de linha digitada contam como um espaço só')
}
{
  // 24 px numa letra de 10: cabem 4 letras; a palavra de 10 letras tem de ser partida
  const l = t.quebrarEmLinhas('SUBLIMAÇÃO', 24, 10, regua)
  conta(igual(l, ['SUBL', 'IMAÇ', 'ÃO']), `palavra que sozinha não cabe é partida no meio, sem perder letra (${l.join(' | ')})`)
  conta(t.partiuPalavra('SUBLIMAÇÃO', 24, 10, regua) && !t.partiuPalavra('DRY DE', 24, 10, regua), 'partiuPalavra diz quando alguma palavra não cabe inteira')
}

const letras = t.tamanhosDeLetra(11, 6.5)
{
  const r = t.caberNaCaixa('ALGODÃO', { largura: 90, altura: 90, fontes: letras, medir: regua })
  conta(r.fonte === 11 && igual(r.linhas, ['ALGODÃO']) && !r.cortado, 'com espaço de sobra o texto fica na maior letra, numa linha')
  conta(Math.abs(r.largura - regua('ALGODÃO', 11)) < 1e-9 && Math.abs(r.altura - 11 * t.ENTRELINHA) < 1e-9, 'a largura e a altura devolvidas são as do texto, e não as da caixa')
}
{
  // 3 linhas de 11 pedem 38,3 px; em 30 px a letra tem de descer
  const r = t.caberNaCaixa('POLIAMIDA FUR C/ ELASTANO', { largura: 62, altura: 30, fontes: letras, medir: regua, semPartir: true })
  conta(r.fonte < 11 && !r.cortado && r.linhas.length * r.fonte * t.ENTRELINHA <= 30 + 0.01, `quando não cabe na altura a letra diminui antes de cortar (letra ${r.fonte}, ${r.linhas.length} linhas)`)
  conta(semEspaco(r.linhas.join('')) === semEspaco('POLIAMIDA FUR C/ ELASTANO'), 'e nenhuma letra do nome se perde')
}
{
  // "AVIAMENTOS" tem 10 letras: em 50 px só cabe inteira com letra de 8 para baixo
  const com = t.caberNaCaixa('B - AVIAMENTOS', { largura: 50, altura: 60, fontes: letras, medir: regua, semPartir: true })
  const sem = t.caberNaCaixa('B - AVIAMENTOS', { largura: 50, altura: 60, fontes: letras, medir: regua })
  conta(com.fonte <= 8 && com.linhas.includes('AVIAMENTOS'), `semPartir prefere a letra menor a partir a palavra (letra ${com.fonte}: ${com.linhas.join(' | ')})`)
  conta(sem.fonte === 11 && !sem.linhas.includes('AVIAMENTOS'), `sem ele, a palavra é partida na letra maior (${sem.linhas.join(' | ')})`)
}
{
  // nem na menor letra: 2 linhas de 6,5 cabem em 16 px, e o nome pede mais
  const r = t.caberNaCaixa('POLIAMIDA FURADINHA SUBLIMADA BRANCA', { largura: 40, altura: 16, fontes: letras, medir: regua })
  conta(r.cortado && r.fonte === 6.5 && r.linhas.length === 2 && r.linhas[1].endsWith('…'), `quando nem a menor letra resolve, o texto é cortado com reticências (${r.linhas.join(' | ')})`)
  conta(r.linhas.every(x => regua(x, r.fonte) <= 40), 'e a linha das reticências também cabe na largura')
}
{
  const r = t.caberNaCaixa('MOLETOM ESPORTIVO PESADO', { largura: 60, altura: 200, fontes: letras, medir: regua, cabe: l => l.length <= 2 })
  conta(r.linhas.length <= 2 && r.fonte < 11, `a pergunta de quem chama é respeitada: aqui, duas linhas no máximo (letra ${r.fonte}: ${r.linhas.join(' | ')})`)
  const nunca = t.caberNaCaixa('MOLETOM ESPORTIVO PESADO', { largura: 60, altura: 200, fontes: letras, medir: regua, cabe: l => l.length <= 1 })
  conta(nunca.cortado && nunca.linhas.length === 1, 'e quando ela nunca é atendida, sobra o que ela aceita, cortado')
}
{
  const vazio = t.caberNaCaixa('   ', { largura: 60, altura: 60, fontes: letras, medir: regua })
  const semCaixa = t.caberNaCaixa('ALGODÃO', { largura: 0, altura: 60, fontes: letras, medir: regua })
  conta(vazio.linhas.length === 0 && semCaixa.linhas.length === 0 && !vazio.cortado, 'texto vazio ou caixa sem largura não desenha nada, e não quebra')
}
{
  /* A PROVA QUE IMPORTA: em qualquer caixa em que caiba ao menos uma linha da
     menor letra, o que sai fica dentro dela. Os nomes são os que o Henrique
     escreveu nos paletes dele, e as caixas vão de minúscula a folgada. */
  const nomes = ['ALGODÃO', 'BRIM', 'CREPE', 'DRY DE SUBLIMAÇÃO', 'MOLETOM ESPORTIVO', 'MOLETON', 'PIQUE', 'POLIAMIDA C/ ELASTANO', 'POLIAMIDA FLOW', 'POLIAMIDA FUR C/ ELASTANO', 'POLIAMIDA FURADINHA', 'POLIAMIDA FURADINHA SUB', 'POLIAMIDA S/ ELASTANO', 'SUPLEX', 'TACTEL', 'VISCOLICRA', 'B - AVIAMENTOS', 'P01', 'A', 'RETALHOSDEMALHASEMESPAÇONENHUM']
  let fora = 0; let perdidos = 0; let casos = 0
  for (const nome of nomes) {
    for (let largura = 9; largura <= 120; largura += 7) {
      for (let altura = 8; altura <= 120; altura += 9) {
        for (const semPartir of [false, true]) {
          casos++
          const r = t.caberNaCaixa(nome, { largura, altura, fontes: letras, medir: regua, semPartir })
          if (r.linhas.some(x => regua(x, r.fonte) > largura + 1e-9)) fora++
          if (r.linhas.length * r.fonte * t.ENTRELINHA > altura + 0.011) fora++
          if (!r.cortado && semEspaco(r.linhas.join('')) !== semEspaco(nome)) perdidos++
        }
      }
    }
  }
  conta(fora === 0, `em ${casos} caixas de tamanhos diferentes, nenhuma linha saiu da caixa (${fora} fora)`)
  conta(perdidos === 0, `e, onde o texto não foi cortado, nenhuma letra se perdeu (${perdidos} casos)`)
}

/* ---------- 2. a referência e o nome do palete ---------------------------- */

const movel = (id, tipo, nome, extra = {}) => ({
  id, tipo, nome, apelido: '', uso: '', x: 0, y: 0, largura: 1.2, fundo: 1.2, emPe: false, vaos: 1, niveis: 1, nomesDosVaos: [], grade: '', ...extra,
})
const planta = moveis => ({ id: 'd', nome: 'Depósito', largura: 12, fundo: 10, moveis })
const P13 = movel('a', 'palete', 'P13', { apelido: 'ALGODÃO', x: 1, y: 1 })
const P07 = movel('b', 'palete', 'P07', { x: 3, y: 1 })
const D = movel('c', 'prateleira', 'D', { x: 6, y: 1, largura: 4, fundo: 0.7, vaos: 4, niveis: 3 })

conta(p.lugarPorExtenso(P13, null, null) === 'Palete P13 · ALGODÃO', 'o palete com nome aparece por extenso com a referência e o nome')
conta(p.lugarPorExtenso(P07, null, null) === 'Palete P07', 'o palete sem nome aparece só com a referência, sem ponto sobrando')
conta(p.lugarPorExtenso(movel('x', 'palete', 'P02', { apelido: '   ' }), null, null) === 'Palete P02', 'nome só de espaços vale como sem nome')
conta(p.codigoDoLugar(P13, null, null) === 'P13', 'o código do lugar continua sendo a referência, e não o nome')
{
  const c = p.celulasDoMovel(P13)
  conta(c.length === 1 && c[0].nome === 'P13' && c[0].apelido === 'ALGODÃO', 'o lugar do palete leva a referência e o nome para o desenho')
  conta(p.celulasDoMovel(D).every(x => x.apelido === ''), 'vão de prateleira não tem nome de palete')
}
{
  const pl = planta([P13, P07, D])
  conta(igual(p.lugarPeloCodigo(pl, 'p13'), { movelId: 'a', vao: null, nivel: null }), 'o código escrito acha o palete pela referência')
  conta(igual(p.lugarPeloCodigo(pl, 'algodao'), { movelId: 'a', vao: null, nivel: null }), 'e também pelo nome, sem acento e em minúscula')
  conta(p.lugarPeloCodigo(pl, 'brim') === null, 'nome que nenhum palete tem não acha nada')
  const dois = planta([P13, { ...P07, apelido: 'Algodão' }, D])
  conta(p.lugarPeloCodigo(dois, 'algodão') === null, 'quando dois paletes têm o mesmo nome, o nome não escolhe nenhum')
  const troca = planta([P13, { ...P07, apelido: 'P13' }, D])
  conta(igual(p.lugarPeloCodigo(troca, 'P13'), { movelId: 'a', vao: null, nivel: null }), 'a referência ganha do nome: "P13" é o palete P13, mesmo com outro palete chamado assim')
  conta(igual(p.lugarPeloCodigo(pl, 'd2-3'), { movelId: 'c', vao: 2, nivel: 3 }), 'o vão da prateleira continua sendo achado com o nível')
}
{
  conta(p.conferirPlanta(planta([P13, P07, D])) === '', 'a planta certa passa na conferência')
  conta(p.conferirPlanta(planta([P13, { ...P07, apelido: 'ALGODÃO' }, D])) === '', 'dois paletes podem ter o mesmo nome')
  const semRef = p.conferirPlanta(planta([P13, { ...P07, nome: '  ' }, D]))
  conta(/referência/.test(semRef), `palete sem referência é recusado, e a frase fala em referência (${semRef})`)
  const repetida = p.conferirPlanta(planta([P13, { ...P07, nome: 'P13' }, D]))
  conta(/A referência P13 aparece em mais de um lugar/.test(repetida), `referência repetida é recusada (${repetida})`)
  const comprido = p.conferirPlanta(planta([{ ...P13, apelido: 'x'.repeat(61) }, P07, D]))
  conta(/passa de 60 letras/.test(comprido) && /P13/.test(comprido), `nome com 61 letras é recusado, e a frase diz de qual palete (${comprido})`)
  conta(p.conferirPlanta(planta([{ ...P13, apelido: 'x'.repeat(60) }, P07, D])) === '', 'com 60 letras passa')
}
{
  const a = planta([P13, P07, D])
  conta(p.plantasIguais(a, planta([{ ...P13 }, P07, D])), 'duas plantas iguais são iguais')
  conta(!p.plantasIguais(a, planta([{ ...P13, apelido: 'BRIM' }, P07, D])), 'mudar o nome de um palete é uma mudança a salvar')
  conta(p.plantasIguais(a, planta([{ ...P13, apelido: ' ALGODÃO  ' }, P07, D])), 'espaço na ponta do nome não é mudança')
}
{
  const pl = planta([P13, P07, D])
  const novo = p.novoPalete(pl, 'n')
  conta(novo.apelido === '' && /^P\d+$/.test(novo.nome) && novo.nome !== 'P13' && novo.nome !== 'P07', `o palete novo nasce com referência livre e sem nome (${novo.nome})`)
}
{
  /* a grade: quem já existia guarda o nome mesmo quando as referências são refeitas */
  const g1 = movel('g1', 'palete', 'P01', { apelido: 'TACTEL', grade: 'G', x: 1, y: 4, largura: 1.2, fundo: 1.2 })
  const g2 = movel('g2', 'palete', 'P02', { apelido: 'SUPLEX', grade: 'G', x: 3, y: 4, largura: 1.2, fundo: 1.2 })
  const pl = planta([g1, g2])
  const grade = p.gradeDosPaletes(pl, 'G')
  let n = 0
  const maior = p.montarGrade(pl, { ...grade, colunas: 3 }, { novoId: () => 'novo' + ++n })
  const por = Object.fromEntries(maior.map(m => [m.id, m]))
  conta(maior.length === 3 && por.g1.apelido === 'TACTEL' && por.g2.apelido === 'SUPLEX' && por.novo1.apelido === '', 'a grade que cresce guarda o nome de quem já existia, e o palete novo nasce sem nome')
  const renomeada = p.montarGrade(pl, grade, { novoId: () => 'x', renomear: true, prefixo: 'T', comecaEm: 5 })
  const r = Object.fromEntries(renomeada.map(m => [m.id, m]))
  conta(r.g1.nome === 'T05' && r.g2.nome === 'T06' && r.g1.apelido === 'TACTEL' && r.g2.apelido === 'SUPLEX', `refazer as referências da grade não toca nos nomes (${r.g1.nome} ${r.g1.apelido}, ${r.g2.nome} ${r.g2.apelido})`)
}

console.log(ruins ? `\n${ruins} conta(s) errada(s)` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
