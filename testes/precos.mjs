/* ==========================================================================
   AS CONTAS DAS TABELAS DE PREÇO (src/dominio/preco/tipos.ts), em node puro.
   Roda junto com `npm run contas`.
   ========================================================================== */
import {
  arredondar, celula, faixaDe, precoDoTamanho, ajustarEmLote, voltarParaARegra,
  escrever, copiarDe, tabelaEmBranco, tabelasParaEscolher, nomeDaFaixa,
  faixasDosFins, conferirFaixas, trocarFaixas, porNaTabela, tirarDaTabela, escreverBase, copiarPrecosDe, numeroDoTexto, colarNaTabela, colarPrecosDaPeca, preencherCelulas,
} from './compilado/preco/tipos.js'
import { aplicarTabelas, origemDoPreco, pecasPorTabela, SEM_TABELA } from './compilado/cotacao/tabela-de-preco.js'
import { cotacaoEmBranco, totalDoProduto, precoNaGrade } from './compilado/cotacao/tipos.js'
import { blocoEmBranco } from './compilado/layout/bloco.js'
import { adicionaisDe, tabelaCompleta, contaDosAdicionais, nomeDaCombinacao, tecnicaDoItem, valorDoTecido, comPrecoDoTecido, caixaDoTamanho, centroQueCabe, medidaDoTamanho } from './compilado/preco/adicionais.js'
import { escolhasDoLayout } from './compilado/cotacao/tabela-de-preco.js'

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

console.log('a tabela dentro da cotação')
{
  const tab = { ...t, id: 'T1', nome: 'Atacado', situacao: 'ativa' }
  const outra = { ...t, id: 'T2', nome: 'Parceiro', situacao: 'ativa', itens: [{ codigo: 'CT01', tipo: 'referencia', base: 60, precos: [null, null, null, null] }] }
  const tabelas = [tab, outra]
  const produto = (ref, grade, extra = {}) => {
    const b = blocoEmBranco(1)
    b.referencia = ref
    b.grade = grade
    return { bloco: b, precoPorTamanho: {}, precoBase: 10, ...extra }
  }
  const cot = cotacaoEmBranco('2026-9101')
  cot.informe.tabelaDePrecoId = 'T1'
  cot.produtos = [produto('CT01', { M: 15 }), produto('SH01', { M: 10 })]
  const um = aplicarTabelas(cot, tabelas, ctx.pecasDoKit)
  ok(um !== cot && um.produtos[0].precoBase === 44.9 && um.produtos[1].precoBase === 33,
    'a faixa vale pelo total da tabela: 15 + 10 = 25 peças, faixa 21 a 50 (44,90 da regra e 33,00 à mão)')
  ok(um.produtos[0].precoDaTabela.G1 === 50.9 && precoNaGrade(um.produtos[0], 'G1') === 50.9 && precoNaGrade(um.produtos[0], 'M') === 44.9,
    'o plus sai da tabela (mais R$ 6), o adulto é o preço base')
  ok(aplicarTabelas(um, tabelas, ctx.pecasDoKit) === um, 'sem mudança, devolve o mesmo objeto (o editor não fica sujo à toa)')
  ok(origemDoPreco(um, um.produtos[0], tabelas).faixa === '21 a 50' && origemDoPreco(um, um.produtos[0], tabelas).tabela === 'Atacado', 'a frase de onde veio o preço')
  const escrito = { ...um, produtos: [{ ...um.produtos[0], precoPorTamanho: { M: 99 } }, um.produtos[1]] }
  ok(totalDoProduto(escrito.produtos[0]) === 99 * 15, 'o escrito à mão na grade ganha da tabela')
  const manual = { ...cot, produtos: [produto('CT01', { M: 15 }, { tabelaId: SEM_TABELA }), produto('SH01', { M: 10 })] }
  const dois = aplicarTabelas(manual, tabelas, ctx.pecasDoKit)
  ok(dois.produtos[0].precoBase === 10 && dois.produtos[1].precoBase === 39.9, 'layout sem tabela fica com o preço escrito, e sai da conta da faixa (10 peças, primeira faixa)')
  const porLayout = { ...cot, produtos: [produto('CT01', { M: 15 }, { tabelaId: 'T2' }), produto('SH01', { M: 10 })] }
  const tres = aplicarTabelas(porLayout, tabelas, ctx.pecasDoKit)
  ok(tres.produtos[0].precoBase === 60 && pecasPorTabela(porLayout).get('T2') === 15, 'o layout pode seguir outra tabela, com a faixa dela')
  const semRef = { ...cot, produtos: [produto('ZZ01', { M: 30 })] }
  ok(aplicarTabelas(semRef, tabelas, ctx.pecasDoKit) === semRef && origemDoPreco(semRef, semRef.produtos[0], tabelas) === null, 'referência fora da tabela: nada muda')
  const aprovada = { ...cot, aprovacao: { quando: '2026-10-12', pedido: '1', quem: 'x' } }
  ok(aplicarTabelas(aprovada, tabelas, ctx.pecasDoKit) === aprovada, 'cotação aprovada não muda de preço')
}

console.log('as faixas pelo fim, e pôr e preencher muitas de uma vez (139 a 143)')
{
  const fx = faixasDosFins(1, [30, 100])
  ok(fx.map(nomeDaFaixa).join() === '1 a 30,31 a 100,101 ou mais' && conferirFaixas(fx) === '', 'escrever só o fim: 1 a 30, 31 a 100, 101 ou mais')
  ok(conferirFaixas([{ de: 10, ate: 5 }, { de: 6, ate: null }]) !== '' && conferirFaixas([{ de: 1, ate: 30 }, { de: 35, ate: null }]) !== '' && conferirFaixas([{ de: 1, ate: 30 }]) !== '', 'acusa faixa ao contrário, buraco e última com fim')
  const base = { ...tabelaEmBranco('T'), itens: [{ codigo: 'A', tipo: 'referencia', base: 50, precos: [null, 44, null, 30] }] }
  const tr = trocarFaixas(base, [{ de: 10, ate: 20 }, { de: 21, ate: 60 }, { de: 61, ate: null }])
  ok(tr.itens[0].base === 50 && tr.itens[0].precos.join() === ',,' && tr.faixas.length === 3, 'trocar as faixas: a base fica, o à mão de faixa que mudou sai')
  const tr2 = trocarFaixas(base, [{ de: 10, ate: 20 }, { de: 21, ate: 50 }, { de: 51, ate: null }])
  ok(tr2.itens[0].precos[1] === 44 && tr2.itens[0].precos[2] === null, 'a faixa que continua igual guarda o escrito à mão')
  const pos = porNaTabela(base, [{ codigo: 'A', tipo: 'referencia' }, { codigo: 'B', tipo: 'referencia' }, { codigo: 'B', tipo: 'referencia' }, { codigo: 'K', tipo: 'kit' }], 40)
  ok(pos.itens.length === 3 && pos.itens[0].base === 50 && pos.itens[1].base === 40 && pos.itens[2].tipo === 'kit' && pos.itens[1].precos.length === 4, 'pôr na tabela: o que já está fica igual, sem repetir, com a base')
  ok(tirarDaTabela(pos, ['B', 'K']).itens.map((i) => i.codigo).join() === 'A', 'tirar da tabela')
  const eb = escreverBase(base, [{ codigo: 'A', tipo: 'referencia' }, { codigo: 'C', tipo: 'referencia' }], 47.9)
  ok(eb.itens.length === 2 && eb.itens.every((i) => i.base === 47.9) && eb.itens[0].precos[1] === 44, 'a mesma base para várias, pondo quem faltava, sem apagar o à mão')
  const origem = { ...tabelaEmBranco('O'), itens: [{ codigo: 'A', tipo: 'referencia', base: 60, precos: [null, 50, null, null] }, { codigo: 'D', tipo: 'referencia', base: 30, precos: [null, null, null, null] }] }
  const cp = copiarPrecosDe(base, origem, ['A', 'D', 'X'], 10, '90')
  ok(cp.itens.find((i) => i.codigo === 'A').base === 65.9 && cp.itens.find((i) => i.codigo === 'A').precos[1] === 54.9 && cp.itens.find((i) => i.codigo === 'D').base === 32.9 && !cp.itens.some((i) => i.codigo === 'X'),
    'copiar de outra tabela com mais 10%: base e à mão, quem faltava entra, o que a outra não tem fica de fora')
  ok(numeroDoTexto('R$ 1.234,56') === 1234.56 && numeroDoTexto('49,9') === 49.9 && numeroDoTexto('49.90') === 49.9 && numeroDoTexto('') === null && Number.isNaN(numeroDoTexto('-')), 'o número escrito de qualquer jeito')
  const linhasC = [{ codigo: 'A', tipo: 'referencia' }, { codigo: 'B', tipo: 'referencia' }, { codigo: 'C', tipo: 'referencia' }]
  const col = colarNaTabela(base, linhasC, 1, 0, '39,90\t35\n42,90\n')
  ok(col.coladas === 3 && col.tabela.itens.find((i) => i.codigo === 'B').base === 39.9 && col.tabela.itens.find((i) => i.codigo === 'B').precos[1] === 35 && col.tabela.itens.find((i) => i.codigo === 'C').base === 42.9 && col.tabela.itens.find((i) => i.codigo === 'A').base === 50,
    'colar da planilha: começa na linha onde colou, desce, a segunda coluna vai para a faixa do lado, e quem faltava entra')
}

console.log('copiar os preços de uma peça e a alça')
{
  const b = { ...tabelaEmBranco('T'), itens: [{ codigo: 'A', tipo: 'referencia', base: 50, precos: [null, 44, null, null] }, { codigo: 'B', tipo: 'referencia', base: 30, precos: [null, null, null, 20] }] }
  const c = colarPrecosDaPeca(b, 'A', [{ codigo: 'A', tipo: 'referencia' }, { codigo: 'B', tipo: 'referencia' }, { codigo: 'C', tipo: 'referencia' }])
  ok(c.itens.length === 3 && c.itens.every((i) => i.base === 50 && i.precos[1] === 44 && i.precos[3] === null), 'colar os preços de A em B (que tinha outros) e em C (que entra)')
  const p = preencherCelulas(b, [{ codigo: 'B', tipo: 'referencia', faixa: 0 }, { codigo: 'D', tipo: 'referencia', faixa: 0 }], 50)
  ok(p.itens.find((i) => i.codigo === 'B').base === 50 && p.itens.find((i) => i.codigo === 'D').base === 50, 'a alça para baixo na base: as peças ganham a mesma base, e quem faltava entra')
  const h = preencherCelulas(b, [{ codigo: 'A', tipo: 'referencia', faixa: 2 }, { codigo: 'A', tipo: 'referencia', faixa: 3 }], 44)
  ok(h.itens[0].precos.join() === ',44,44,44' && h.itens[0].base === 50, 'a alça para o lado: as faixas seguintes ficam à mão com o mesmo valor')
}

console.log('os adicionais (083): a peça mais o material, a técnica e os extras')
{
  /* o rascunho guardado no navegador antes da 083 não tem adicionais: a página
     caía ao abrir (19/10/2026). Ele volta completo. */
  const velho = { ...tabelaEmBranco('Velha'), itens: [{ codigo: 'CT01', tipo: 'referencia', base: 40, precos: [null, null, null, null] }] }
  delete velho.adicionais
  const volta = tabelaCompleta(velho)
  ok(volta.adicionais && Array.isArray(volta.adicionais.materiais) && volta.adicionais.extras.length === 2 && Array.isArray(volta.adicionais.dtf), 'o rascunho de antes da 083 volta com os adicionais em branco')
  ok(volta.itens[0].sub === null && volta.itens[0].silk === null && volta.itens[0].base === 40, 'e os itens ganham Sub e Silk vazios, sem perder o preço')

  const a0 = adicionaisDe({})
  ok(a0.extras.length === 2 && a0.extras[0].tecnica === 'patch' && a0.extras[1].opcoes.map((o) => o.id).join() === 'P,M,G', 'sem nada no banco, o Patch e o Bordado já existem, com P, M e G')
  const ad = adicionaisDe({
    materiais: [{ tecido: 'Dry fit PET 160', valor: 2.5 }, { tecido: 'MOLETOM', valor: null }],
    extras: [
      { id: 'patch', nome: 'Patch', tecnica: 'patch', opcoes: [{ id: 'relevo', nome: 'Relevo', medida: '', valor: 5 }] },
      { id: 'bordado', nome: 'Bordado', tecnica: 'bordado', opcoes: [{ id: 'M', nome: 'M', medida: '6 x 6 cm', valor: 7 }] },
      { id: 'x1', nome: 'Termocolante', tecnica: '', opcoes: [{ id: 'o1', nome: 'Escudo', medida: '', valor: 3 }] },
    ],
    dtf: [{ id: 'c1', nome: 'Peito grande e manga', posicoes: ['peito-grande', 'manga-direita'], valor: 14 }],
  })
  ok(valorDoTecido(ad, 'DRY FIT PET 160') === 2.5 && valorDoTecido(ad, 'Moletom') === null && valorDoTecido(ad, 'Algodão') === undefined, 'o tecido sem acento e sem caixa; sem preço é null; fora da lista é undefined')
  ok(nomeDaCombinacao(['manga-direita', 'peito-grande']) === 'Peito grande e manga direita', 'o nome da combinação sai das posições, na ordem do desenho')
  /* os tamanhos de DTF editáveis (22/10/2026) */
  ok(a0.tamanhosDtf.length === 6 && a0.tamanhosDtf.map((t) => t.id).join() === 'peito-pequeno,peito-grande,manga-direita,manga-esquerda,nuca,costas-grande', 'sem tamanhos guardados, os seis de partida, com os ids das posições de antes')
  ok(ad.tamanhosDtf.length === 6, 'a tabela de antes de 22/10/2026 também ganha os seis')
  const tam = adicionaisDe({ tamanhosDtf: [{ id: 't1', nome: 'Escudo', lado: 'costas', largura: '12', altura: 0, x: 50, y: 20 }, { nome: 'sem id' }] })
  ok(tam.tamanhosDtf.length === 1 && tam.tamanhosDtf[0].largura === 12 && tam.tamanhosDtf[0].altura === 10 && tam.tamanhosDtf[0].lado === 'costas', 'o tamanho guardado volta arrumado: número lido, medida zero vira 10, sem id sai')
  ok(adicionaisDe({ tamanhosDtf: [] }).tamanhosDtf.length === 0, 'a tabela que apagou todos os tamanhos continua sem nenhum')
  ok(nomeDaCombinacao(['t1'], tam.tamanhosDtf) === 'Escudo', 'o nome da combinação sai dos tamanhos da tabela')
  ok(medidaDoTamanho({ largura: 21, altura: 29.7 }) === '21 x 29,7 cm', 'a medida mostrada em cm, com vírgula')
  const cx = caixaDoTamanho({ id: 'a', nome: 'A3', lado: 'costas', largura: 29.7, altura: 42, x: 50, y: 46 })
  ok(Math.abs(cx[2] - 23.76) < 0.01 && Math.abs(cx[3] - 33.6) < 0.01 && Math.abs(cx[0] - 38.12) < 0.01, 'a caixa no desenho sai da medida real na escala da camisa')
  const fora = centroQueCabe({ id: 'b', nome: 'B', lado: 'frente', largura: 20, altura: 20, x: 50, y: 50 }, 99, -5)
  ok(fora.x === 92 && fora.y === 8, 'arrastar para fora para na borda do desenho (' + JSON.stringify(fora) + ')')
  const tab = { ...tabelaEmBranco('A'), adicionais: ad, itens: [
    { codigo: 'CT01', tipo: 'referencia', base: 49.9, precos: [null, null, null, null], sub: 8, silk: 10 },
    { codigo: 'SH01', tipo: 'referencia', base: 39.9, precos: [null, null, null, null], sub: 6, silk: null },
    { codigo: 'KT01', tipo: 'kit', base: null, precos: [null, null, null, null] },
  ] }
  const ctx = { achar: (k) => tab.itens.find((i) => i.codigo === k), pecasDoKit: (k) => (k === 'KT01' ? ['CT01', 'SH01'] : []) }
  ok(tecnicaDoItem(tab, tab.itens[2], 'sub', ctx).valor === 14 && tecnicaDoItem(tab, tab.itens[2], 'silk', ctx).valor === null, 'o kit sem Sub própria soma as peças (8 + 6); o Silk falta porque o short não tem')
  const esc = { tecidos: ['DRY FIT PET 160'], sub: false, silk: 2, dtf: { combinacao: 'c1', porPeca: null }, patch: { opcao: 'relevo', qtd: 2 }, bordado: { opcao: 'M', qtd: 1 }, extras: [{ extra: 'x1', opcao: 'o1', qtd: 1 }] }
  const r = contaDosAdicionais(tab, tab.itens[0], ctx, esc)
  ok(r.adicional === 2.5 + 20 + 14 + 10 + 7 + 3 && r.partes.map((p) => p.tipo).join() === 'material,silk,dtf,patch,bordado,extra', 'a conta: tecido 2,50 + Silk 2 telas de 10 + DTF 14 + Patch Relevo 2 x 5 + Bordado M 7 + Termocolante 3 = 56,50 (' + r.adicional + ')')
  const m = contaDosAdicionais(tab, tab.itens[0], ctx, { ...esc, dtf: { combinacao: 'c1', porPeca: 12 } })
  ok(m.partes.find((p) => p.tipo === 'dtf').valor === 12 && m.partes.find((p) => p.tipo === 'dtf').rotulo === 'Na metragem', 'o DTF na metragem passa por cima da combinação')
  const f = contaDosAdicionais(tab, tab.itens[1], ctx, { tecidos: ['MOLETOM'], sub: true, silk: 1, dtf: { combinacao: '', porPeca: null }, patch: null, bordado: { opcao: 'G', qtd: 1 }, extras: [] })
  ok(f.partes.filter((p) => p.falta).map((p) => p.tipo).join() === 'material,silk,dtf,bordado' && f.adicional === 6, 'o que falta aparece e soma zero: tecido sem preço, Silk sem preço, DTF sem escolha, Bordado G fora da tabela; só a Sub soma (' + f.adicional + ')')
  const semTabela = contaDosAdicionais(undefined, undefined, undefined, { ...esc, dtf: { combinacao: '', porPeca: 9 } })
  ok(semTabela.partes.find((p) => p.tipo === 'dtf').valor === 9 && semTabela.adicional === 9, 'sem tabela, só o DTF escrito na metragem soma')
  const comMat = comPrecoDoTecido(ad, ['Algodão 100%', 'moletom'], 4)
  ok(valorDoTecido(comMat, 'ALGODAO 100%') === 4 && valorDoTecido(comMat, 'Moletom') === 4 && comMat.materiais.length === 3, 'o preço de vários tecidos de uma vez, sem repetir o que já estava')

  /* na cotação: a peça da faixa mais os adicionais, e o escrito à mão ganhando */
  const c = cotacaoEmBranco('CO-1')
  c.informe.tabelaDePrecoId = 't1'
  const b = blocoEmBranco(1)
  b.referencia = 'CT01'
  b.grade = { M: 60, G1: 2 }
  b.tecidos = [{ nome: 'DRY FIT PET 160', cor: 'Azul', hex: '#1d4ed8' }]
  b.design = [{ tag: 'Silk', tecnica: 'silk', cores: [], quantidade: 2 }, { tag: 'DTF', tecnica: 'dtf', cores: [], combinacao: 'c1' }, { tag: 'Patch', tecnica: 'patch', cores: [], tipoDePatch: 'relevo', quantidade: 2 }]
  c.produtos = [{ bloco: b, precoPorTamanho: {}, precoBase: 0 }]
  ok(JSON.stringify(escolhasDoLayout(c.produtos[0])) === JSON.stringify({ tecidos: ['DRY FIT PET 160'], sub: false, silk: 2, dtf: { combinacao: 'c1', porPeca: null }, patch: { opcao: 'relevo', qtd: 2 }, bordado: null, extras: [] }), 'as escolhas saem da ficha do layout: tecido, telas do Silk, a combinação do DTF e o Patch')
  const ap = aplicarTabelas(c, [{ ...tab, id: 't1' }], () => [])
  const pr = ap.produtos[0]
  ok(pr.precoBase === 40.9 && pr.adicional === 2.5 + 20 + 14 + 10 && precoNaGrade(pr, 'M') === 87.4 && precoNaGrade(pr, 'G1') === 93.4, '62 peças: a peça na faixa 51 a 100 (40,90) mais 46,50 = 87,40; o plus soma os 6 só na peça (93,40)')
  ok(aplicarTabelas(ap, [{ ...tab, id: 't1' }], () => []) === ap, 'aplicar de novo sem mudança devolve a mesma cotação')
  const mao = { ...pr, precoPorTamanho: { M: 80 } }
  ok(precoNaGrade(mao, 'M') === 80, 'o escrito à mão ganha da soma')
  const foraDaTabela = { ...c, informe: { ...c.informe, tabelaDePrecoId: '' }, produtos: [{ ...c.produtos[0], bloco: { ...b, design: [{ tag: 'Subli', tecnica: 'subli', cores: [] }] } }] }
  ok(aplicarTabelas(foraDaTabela, [], () => []) === foraDaTabela, 'sem tabela não há conta: a cotação volta a mesma, sem parte "falta" (o editor não fica sujo)')
}

console.log(ruins ? `\n${ruins} RUINS` : '\ntabelas de preço: tudo certo')
process.exit(ruins ? 1 : 0)
