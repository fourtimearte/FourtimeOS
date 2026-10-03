/* ==========================================================================
   AS CONTAS DO VERIFICADOR DE BOLETO.

   O que da para provar sem navegador e sem banco: a linha digitavel fecha ou
   nao fecha, o fator de vencimento cai no ciclo certo, o CNPJ (o de numero e
   o novo, com letra) fecha ou nao fecha, e do texto de um boleto saem a
   linha, os CNPJs, o nome, os valores e as datas.

   NENHUM BOLETO DE VERDADE MORA AQUI. As linhas sao montadas pelo proprio
   teste, a partir de um codigo de barras inventado, com os digitos de
   controle calculados por uma conta escrita AQUI, e nao pela do sistema:
   teste que usa a mesma funcao que confere so prova que ela concorda consigo.

   Rodar:  sh testes/boleto.sh
   ========================================================================== */

import * as linha from './compilado-boleto/src/dominio/boleto/linha.js'
import * as texto from './compilado-boleto/src/dominio/boleto/texto.js'
import * as cnpj from './compilado-boleto/src/dominio/fornecedor/cnpj.js'

let ruins = 0
const conta = (certo, frase) => {
  if (!certo) ruins++
  console.log((certo ? 'ok   ' : 'RUIM ') + frase)
}

/* ---- as contas do teste, escritas de outro jeito ------------------------ */
function m10(n) {
  let soma = 0
  ;[...n].reverse().forEach((d, i) => {
    const p = Number(d) * (i % 2 === 0 ? 2 : 1)
    soma += Math.floor(p / 10) + (p % 10)
  })
  return (10 - (soma % 10)) % 10
}
function m11(n) {
  let soma = 0
  ;[...n].reverse().forEach((d, i) => { soma += Number(d) * ((i % 8) + 2) })
  const d = 11 - (soma % 11)
  return d > 9 || d === 0 ? 1 : d
}
function barrasDeCobranca(banco, fator, centavos, livre) {
  const sem = banco + '9' + String(fator).padStart(4, '0') + String(centavos).padStart(10, '0') + livre
  return sem.slice(0, 4) + m11(sem) + sem.slice(4)
}
function linhaDe(b) {
  const c1 = b.slice(0, 4) + b.slice(19, 24), c2 = b.slice(24, 34), c3 = b.slice(34, 44)
  return c1 + m10(c1) + c2 + m10(c2) + c3 + m10(c3) + b[4] + b.slice(5, 19)
}
const diasDesde = (base, iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(base + 'T00:00:00Z')) / 86400000)

const HOJE = new Date(2026, 9, 2)

/* ---- 1. a linha de cobranca -------------------------------------------- */
const fator = 1000 + diasDesde('2025-02-22', '2026-10-10')
const barras = barrasDeCobranca('341', fator, 184750, '1790010104351004791020150')
const L = linhaDe(barras)
const lida = linha.lerLinha(L, HOJE)
conta(L.length === 47 && lida && lida.valida, `linha de 47 montada pelo teste fecha a conta (${linha.linhaNaTela(L)})`)
conta(lida.banco === '341' && linha.bancoNaTela(lida.banco) === 'Itaú (341)', `banco lido: ${linha.bancoNaTela(lida.banco)}`)
conta(lida.valor === 1847.5, `valor lido: ${lida.valor}`)
conta(lida.vencimento === '2026-10-10', `vencimento lido: ${lida.vencimento}`)
conta(lida.barras === barras, 'o codigo de barras remontado e o original')
conta(linha.lerLinha(barras, HOJE).linha === L, 'colar o codigo de barras de 44 devolve a mesma linha de 47')
conta(linha.lerLinha(linha.linhaNaTela(L), HOJE).valida, 'com ponto e espaco continua valendo')

/* um digito trocado em cada regiao */
for (const [onde, nome] of [[2, 'banco'], [12, 'segundo campo'], [25, 'terceiro campo'], [40, 'valor']]) {
  const torta = L.slice(0, onde) + ((Number(L[onde]) + 1) % 10) + L.slice(onde + 1)
  const r = linha.lerLinha(torta, HOJE)
  conta(r && !r.valida, `um digito trocado no ${nome} quebra a conta (${r.problema})`)
}
conta(linha.lerLinha('123', HOJE) === null, 'texto curto demais nao e linha')
conta(linha.lerLinha('', HOJE) === null, 'vazio nao e linha')

/* ---- 2. o fator de vencimento ------------------------------------------ */
conta(linha.fatorDoVencimento('2025-02-21') === 9999, 'o ultimo dia do ciclo antigo e o fator 9999')
conta(linha.fatorDoVencimento('2025-02-22') === 1000, 'o primeiro dia do ciclo novo e o fator 1000')
conta(linha.vencimentoDoFator(1000, HOJE) === '2025-02-22', 'fator 1000, lido em 2026, e 22/02/2025')
conta(linha.vencimentoDoFator(9999, HOJE) === '2025-02-21', 'fator 9999, lido em 2026, e 21/02/2025 e nao 2049')
conta(linha.vencimentoDoFator(1000, new Date(2003, 0, 1)) === '2000-07-03', 'fator 1000, lido em 2003, e 03/07/2000')
conta(linha.vencimentoDoFator(fator, HOJE) === '2026-10-10', `o fator ${fator} de hoje cai em 10/10/2026`)
conta(linha.vencimentoDoFator(0, HOJE) === '', 'fator zero e boleto sem vencimento')
const semValor = linha.lerLinha(linhaDe(barrasDeCobranca('001', 0, 0, '0000001234567890123456789')), HOJE)
conta(semValor.valida && semValor.valor === null && semValor.vencimento === '', 'linha sem valor e sem vencimento continua valida, com os dois vazios')

/* ---- 3. a guia de arrecadacao ------------------------------------------ */
function guia(ident, centavos, resto) {
  const sem = '8' + '3' + ident + String(centavos).padStart(11, '0') + resto
  const dv = ident === '6' || ident === '7' ? m10(sem) : (() => {
    let soma = 0
    ;[...sem].reverse().forEach((d, i) => { soma += Number(d) * ((i % 8) + 2) })
    const r = soma % 11
    return r === 0 || r === 1 ? 0 : r === 10 ? 1 : 11 - r
  })()
  const b = sem.slice(0, 3) + dv + sem.slice(3)
  const dvBloco = (x) => (ident === '6' || ident === '7' ? m10(x) : (() => {
    let soma = 0
    ;[...x].reverse().forEach((d, i) => { soma += Number(d) * ((i % 8) + 2) })
    const r = soma % 11
    return r === 0 || r === 1 ? 0 : r === 10 ? 1 : 11 - r
  })())
  return [0, 11, 22, 33].map((i) => b.slice(i, i + 11) + dvBloco(b.slice(i, i + 11))).join('')
}
for (const ident of ['6', '8']) {
  const g = guia(ident, 12345, '00420000000000001234567890123')
  const r = linha.lerLinha(g, HOJE)
  conta(g.length === 48 && r && r.valida && r.tipo === 'arrecadacao' && r.valor === 123.45,
    `guia de arrecadacao de 48, referencia ${ident}, fecha e vale 123,45 (${r && r.problema})`)
}
const guiaTorta = guia('6', 12345, '00420000000000001234567890123')
conta(!linha.lerLinha(guiaTorta.slice(0, 20) + ((Number(guiaTorta[20]) + 1) % 10) + guiaTorta.slice(21), HOJE).valida, 'guia com digito trocado nao fecha')

/* ---- 4. o CNPJ ---------------------------------------------------------- */
conta(cnpj.cnpjValido('11.222.333/0001-81'), 'CNPJ de numero, valido')
conta(!cnpj.cnpjValido('11.222.333/0001-82'), 'CNPJ com o ultimo digito errado')
conta(!cnpj.cnpjValido('00.000.000/0000-00'), 'CNPJ todo zero nao vale')
conta(cnpj.cnpjValido('12.ABC.345/01DE-35'), 'CNPJ novo, com letra, valido (o exemplo da Receita)')
conta(!cnpj.cnpjValido('12.ABC.345/01DE-36'), 'CNPJ com letra e digito errado')
conta(cnpj.cnpjNaTela('11222333000181') === '11.222.333/0001-81', 'CNPJ na tela com ponto, barra e traco')
conta(cnpj.mascaraDoCnpj('112223330') === '11.222.333/0', 'a mascara acompanha a digitacao')
conta(cnpj.limparCnpj('12.abc.345/01de-35') === '12ABC34501DE35', 'letra minuscula vira maiuscula')

/* ---- 5. o texto de um boleto ------------------------------------------- */
const FICHA = [
  'Banco Itaú S.A. | 341-7 | ' + linha.linhaNaTela(L),
  'Local de pagamento: pagável em qualquer banco até o vencimento',
  'Beneficiário',
  'MALHARIA EXEMPLO LTDA - CNPJ: 11.222.333/0001-81',
  'Agência/Código do beneficiário 1234/56789-0 Nosso número 109/00012345-6',
  'Data do documento 01/10/2026 Vencimento 10/10/2026',
  'Valor do documento R$ 1.847,50',
  'Pagador',
  'EMPRESA PAGADORA DE TESTE LTDA CNPJ 45.723.174/0001-10',
  'Rua Exemplo, 100 - Goiânia GO - 74000-000',
  'Sacador/Avalista',
].join('\n')
const lido = texto.lerTextoDoBoleto(FICHA, 'boleto.pdf', HOJE)
conta(lido.linha && lido.linha.valida && lido.linha.linha === L, 'acha a linha digitavel no meio do texto')
conta(lido.cnpjs.length === 2 && lido.cnpjs[0] === '11222333000181' && lido.cnpjs[1] === '45723174000110',
  `acha os dois CNPJs e ignora o nosso numero (${lido.cnpjs.join(', ')})`)
conta(texto.cnpjDoBeneficiario(lido, '45.723.174/0001-10') === '11222333000181', 'o CNPJ do beneficiario e o que nao e o da empresa')
conta(texto.nomeAoLadoDoCnpj(lido, '11222333000181') === 'MALHARIA EXEMPLO LTDA',
  `o nome ao lado do CNPJ: "${texto.nomeAoLadoDoCnpj(lido, '11222333000181')}"`)
conta(texto.valoresDoTexto(FICHA).includes(1847.5), 'acha o valor 1.847,50 no texto')
conta(texto.datasDoTexto(FICHA).includes('2026-10-10'), 'acha o vencimento 10/10/2026 no texto')

/* o nome na linha de cima do CNPJ */
const FICHA2 = FICHA.replace('MALHARIA EXEMPLO LTDA - CNPJ: 11.222.333/0001-81', 'MALHARIA EXEMPLO LTDA\nCNPJ: 11.222.333/0001-81')
conta(texto.nomeAoLadoDoCnpj(texto.lerTextoDoBoleto(FICHA2, '', HOJE), '11222333000181') === 'MALHARIA EXEMPLO LTDA',
  'quando o nome esta na linha de cima do CNPJ, vale a linha de cima')

/* tres CNPJs: ganha o que esta depois de "Beneficiário" */
const FICHA3 = 'Sacador 60.746.948/0001-12\n' + FICHA
conta(texto.cnpjDoBeneficiario(texto.lerTextoDoBoleto(FICHA3, '', HOJE), '45723174000110') === '11222333000181',
  'com tres CNPJs, vale o que vem depois da palavra Beneficiário')

/* a linha partida em duas no PDF */
const partida = linha.linhaNaTela(L)
const FICHA4 = partida.slice(0, 24) + '\n' + partida.slice(24) + '\nBeneficiário X'
conta(texto.lerTextoDoBoleto(FICHA4, '', HOJE).linha?.valida === true, 'linha partida em duas pelo PDF ainda e achada')

conta(texto.lerTextoDoBoleto('sem numero nenhum aqui', '', HOJE).linha === null, 'texto sem linha devolve nulo')

/* o vencimento na mesma linha do beneficiario: e o que derrubou o primeiro ensaio com PDF de verdade */
const FICHA5 = FICHA.replace('MALHARIA EXEMPLO LTDA - CNPJ: 11.222.333/0001-81', 'MALHARIA EXEMPLO LTDA - CNPJ: 11.222.333/0001-81 10/10/2026 R$ 1.847,50')
conta(texto.nomeAoLadoDoCnpj(texto.lerTextoDoBoleto(FICHA5, '', HOJE), '11222333000181') === 'MALHARIA EXEMPLO LTDA',
  `data e valor na mesma linha do CNPJ nao entram no nome: "${texto.nomeAoLadoDoCnpj(texto.lerTextoDoBoleto(FICHA5, '', HOJE), '11222333000181')}"`)

/* ---- 6. o nome da Receita esta no boleto? ------------------------------ */
conta(texto.nomeApareceNoTexto('MALHARIA EXEMPLO LTDA', FICHA), 'a razao social da Receita aparece no texto do boleto')
conta(texto.nomeApareceNoTexto('Malharia Exemplo Ltda.', FICHA), 'com caixa e ponto diferentes, continua aparecendo')
conta(texto.nomeApareceNoTexto('MALHARIA EXEMPLO S/A', FICHA), 'o tipo de sociedade nao entra na comparacao')
conta(!texto.nomeApareceNoTexto('MALHARIA EXEMPLAR LTDA', FICHA), 'nome parecido nao e o mesmo nome')
conta(!texto.nomeApareceNoTexto('LTDA', FICHA), 'so o tipo de sociedade nao e nome')

console.log(ruins ? `\n${ruins} conferencia(s) RUIM` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
