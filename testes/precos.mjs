/* ==========================================================================
   AS CONTAS DAS TABELAS DE PREÇO (src/dominio/preco/tipos.ts), em node puro.
   Roda junto com `npm run contas`.
   ========================================================================== */
import {
  arredondar, celula, faixaDe, precoDoTamanho, ajustarEmLote, voltarParaARegra,
  escrever, copiarDe, tabelaEmBranco, tabelasParaEscolher, nomeDaFaixa,
} from './compilado/preco/tipos.js'

let ruins = 0
const ok = (certo, texto) => { if (!certo) ruins++; console.log((certo ? '  ok   ' : '  RUIM ') + texto) }

console.log('o arredondamento')
ok(arredondar(44.91, '90') === 44.9, ',90: 44,91 vira 44,90')
ok(arredondar(45.3, '90') === 44.9, ',90: 45,30 vira 44,90')
ok(arredondar(45.5, '90') === 45.9, ',90: 45,50 vira 45,90')
ok(arredondar(44.5, '00') === 45, ',00: 44,50 vira 45')
ok(arredondar(44.567, '') === 44.57, 'sem arredondar: o centavo')
ok(arredondar(0, '90') === 0 && arredondar(-3, '00') === 0, 'zero e negativo viram zero')

console.log('as faixas')
const t = tabelaEmBranco('Atacado')
ok(nomeDaFaixa(t.faixas[0]) === '10 a 20' && nomeDaFaixa(t.faixas[3]) === '101 ou mais', 'o nome das faixas')
ok(faixaDe(t.faixas, 5) === 0 && faixaDe(t.faixas, 20) === 0 && faixaDe(t.faixas, 21) === 1 && faixaDe(t.faixas, 64) === 2 && faixaDe(t.faixas, 500) === 3, 'qual faixa vale para 5, 20, 21, 64 e 500 peças')

console.log('a grade')
t.itens = [
  { codigo: 'CT01', tipo: 'referencia', base: 49.9, precos: [null, null, null, null] },
  { codigo: 'SH01', tipo: 'referencia', base: 39.9, precos: [null, 33, null, null] },
  { codigo: 'KT01', tipo: 'kit', base: null, precos: [null, null, null, null] },
  { codigo: 'KT09', tipo: 'kit', base: null, precos: [null, null, null, null] },
]
const ctx = {
  achar: (c) => t.itens.find((i) => i.codigo === c),
  pecasDoKit: (c) => (c === 'KT01' ? ['CT01', 'SH01'] : c === 'KT09' ? ['CT01', 'XX99'] : []),
}
const linha = (cod) => t.faixas.map((_, i) => celula(t, ctx.achar(cod), i, ctx))
const ct = linha('CT01')
ok(ct.map((c) => c.valor).join() === '49.9,44.9,40.9,36.9' && ct[0].origem === 'base' && ct[1].origem === 'regra',
  'referência: a base na primeira faixa, e a regra (menos 10%, ,90) nas outras: ' + ct.map((c) => c.valor).join(' '))
const sh = linha('SH01')
ok(sh[1].valor === 33 && sh[1].origem === 'mao' && sh[2].valor === 29.9, 'o escrito à mão vale na faixa e a regra segue dele: ' + sh.map((c) => c.valor).join(' '))
const kt = linha('KT01')
ok(kt[0].valor === 82.9 && kt[0].origem === 'kit' && kt[1].valor === 71.9,
  'kit sem base: a soma das peças em cada faixa, menos 8%, ,90: ' + kt.map((c) => c.valor).join(' '))
ok(linha('KT09')[0].valor === null, 'kit com peça fora da tabela fica vazio, e não inventado')

console.log('o tamanho')
ok(precoDoTamanho(t, 44.9, 'G2') === 50.9, 'plus: mais R$ 6,00')
ok(precoDoTamanho(t, 44.9, '8A') === 40.9, 'infantil: menos 10%, ,90')
ok(precoDoTamanho(t, 44.9, 'M') === 44.9, 'adulto: o da faixa')

console.log('mudar em lote e escrever')
const lote = ajustarEmLote(t, ['CT01', 'SH01'], 5, '90')
ok(lote.itens[0].base === 51.9 && lote.itens[1].precos[1] === 34.9 && lote.itens[2].base === null, 'mais 5% na base e no escrito à mão, e o kit sem base continua pela soma')
const volta = voltarParaARegra(t, ['SH01'])
ok(volta.itens[1].precos.every((p) => p === null) && volta.itens[1].base === 39.9, 'voltar para a regra apaga só o escrito à mão')
const esc = escrever(escrever(t, 'CT01', 0, 51.9), 'CT01', 2, 41)
ok(esc.itens[0].base === 51.9 && esc.itens[0].precos[2] === 41 && esc.itens[0].precos[1] === null, 'a primeira faixa é a base; as outras ficam à mão')

console.log('a tabela nova e a escolha')
const nova = copiarDe({ ...t, id: 'x', padrao: true, situacao: 'ativa' }, 'Parceiro', 8, '90')
ok(nova.id === '' && !nova.padrao && nova.situacao === 'rascunho' && nova.itens[0].base === 53.9 && nova.itens.length === 4, 'copiar de outra tabela com mais 8% nasce rascunho, sem ser padrão')
const lista = tabelasParaEscolher([
  { ...t, nome: 'B', situacao: 'ativa', padrao: false, soGerente: false },
  { ...t, nome: 'A', situacao: 'ativa', padrao: false, soGerente: true },
  { ...t, nome: 'C', situacao: 'ativa', padrao: true, soGerente: false },
  { ...t, nome: 'D', situacao: 'rascunho', padrao: false, soGerente: false },
], false)
ok(lista.map((x) => x.nome).join() === 'C,B', 'na cotação: só as ativas, a padrão primeiro, e a "só gerente" fica fora para o vendedor')

console.log(ruins ? `\n${ruins} RUINS` : '\ntabelas de preço: tudo certo')
process.exit(ruins ? 1 : 0)
