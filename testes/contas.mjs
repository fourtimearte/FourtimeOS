/* ==========================================================================
   A conferencia das contas e do arquivo .cft

   O teste visual confere o que se ve. Este confere o que nao se ve: a ordem da
   grade, a conta do desconto e, principalmente, a escada de migracao do
   arquivo. A escada e o tipo de coisa que so quebra daqui a um ano, quando um
   arquivo antigo nao abrir mais e ninguem lembrar por que. Por isso ela tem
   teste desde o primeiro dia.

   Rode com: npm run contas
   ========================================================================== */

import { cotacaoEmBranco, totalDaCotacao, subtotal, pecasDaCotacao, VERSAO_DO_CFT } from './compilado/cotacao/tipos.js'
import { paraCft, deCft, nomeDoArquivo, ArquivoRecusado } from './compilado/cotacao/arquivo.js'
import { blocoEmBranco } from './compilado/layout/bloco.js'
import { tamanhosNaOrdem, gradeEmTexto, totalDaGrade } from './compilado/layout/grade.js'

let falhas = 0
const ok = (n, c) => { if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n) } }

/* --- a grade --- */
console.log('grade')
ok('adulto na ordem', tamanhosNaOrdem('adulto', { M: 3 }).join(' ') === 'PP P M G GG XG G1 G2 G3 G4')
ok('infantil preenchido sobe para o topo da grade adulta',
   tamanhosNaOrdem('adulto', { M: 3, '8A': 2 })[0] === '8A')
ok('adulto preenchido desce para o fim da grade infantil',
   tamanhosNaOrdem('infantil', { '8A': 2, GG: 1 }).at(-1) === 'GG')
ok('tamanho da outra faixa sem quantidade nao aparece',
   !tamanhosNaOrdem('adulto', { M: 3 }).includes('8A'))
ok('total da grade', totalDaGrade({ M: 3, G: 4 }) === 7)
ok('grade em texto', gradeEmTexto('adulto', { G: 4, M: 3 }) === 'M 3   G 4')

/* --- as contas --- */
console.log('contas')
const c = cotacaoEmBranco('2026-9001')
const b = blocoEmBranco(1)
b.grade = { M: 10, G: 10 }
c.produtos = [{ bloco: b, precoPorTamanho: { G: 60 }, precoBase: 50 }]
ok('preco por tamanho ganha do preco base', subtotal(c) === 10 * 50 + 10 * 60)
c.ajustes = [
  { id: 'a', descricao: 'd1', tipo: 'porcento', valor: -10 },
  { id: 'b', descricao: 'd2', tipo: 'porcento', valor: -10 },
]
ok('dois descontos de 10 por cento somam 20, nao 19', totalDaCotacao(c) === 1100 - 220)
c.ajustes = [{ id: 'a', descricao: 'frete', tipo: 'reais', valor: 180 }]
ok('ajuste em reais soma direto', totalDaCotacao(c) === 1280)
ok('pecas da cotacao', pecasDaCotacao(c) === 20)

/* --- o arquivo --- */
console.log('arquivo .cft')
const texto = paraCft(c)
const volta = deCft(texto)
ok('ida e volta guarda o total', totalDaCotacao(volta) === totalDaCotacao(c))
ok('ida e volta guarda a grade', JSON.stringify(volta.produtos[0].bloco.grade) === JSON.stringify(c.produtos[0].bloco.grade))
ok('ida e volta guarda o cliente', volta.cliente.nome === c.cliente.nome)
ok('carimba a versao do formato', volta.versaoDoFormato === VERSAO_DO_CFT)
ok('nome do arquivo sem acento e sem espaco', nomeDoArquivo({ ...c, cliente: { ...c.cliente, nome: 'Colégio Nova Era' } }) === 'cotacao-2026-9001-colegio-nova-era.cft')

/* arquivo velho, sem versao e sem campo novo */
const velho = JSON.stringify({
  marca: 'fourtime.cotacao',
  cotacao: { numero: '2025-0001', cliente: { nome: 'Antigo' }, produtos: [{ bloco: { grade: { M: 2 } }, precoBase: 30 }] },
})
const migrado = deCft(velho)
ok('arquivo sem versao sobe a escada', migrado.versaoDoFormato === VERSAO_DO_CFT)
ok('arquivo sem campo novo ganha o padrao', typeof migrado.informe.prazo === 'string' && migrado.informe.prazo.length > 0)
ok('arquivo velho mantem a conta', subtotal(migrado) === 60)
ok('arquivo velho sem estado abre como rascunho', migrado.estado === 'rascunho')

/* recusas */
const recusa = (t, nome) => { try { deCft(t); ok(nome, false) } catch (e) { ok(nome, e instanceof ArquivoRecusado) } }
recusa('nao e json', 'texto qualquer e recusado')
recusa(JSON.stringify({ marca: 'outra.coisa' }), 'arquivo de outro sistema e recusado')
recusa(JSON.stringify({ marca: 'fourtime.cotacao', versao: 99, cotacao: {} }), 'arquivo do futuro e recusado')

console.log(falhas ? '\n' + falhas + ' falha(s)' : '\ntudo passou')
process.exit(falhas ? 1 : 0)
