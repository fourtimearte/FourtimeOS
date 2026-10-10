/* ==========================================================================
   A conferencia das contas e do arquivo .cft

   O teste visual confere o que se ve. Este confere o que nao se ve: a ordem da
   grade, a conta do desconto e, principalmente, a escada de migracao do
   arquivo. A escada e o tipo de coisa que so quebra daqui a um ano, quando um
   arquivo antigo nao abrir mais e ninguem lembrar por que. Por isso ela tem
   teste desde o primeiro dia.

   Rode com: npm run contas
   ========================================================================== */

import {
  cotacaoEmBranco,
  totalDaCotacao,
  subtotal,
  pecasDaCotacao,
  registrarEnvio,
  numeroDePedido,
  aprovar,
  travada,
  VERSAO_DO_CFT,
  informesEmBranco,
} from './compilado/cotacao/tipos.js'
import {
  paraCft,
  deCft,
  nomeDoArquivo,
  arrumarCotacao,
  ArquivoRecusado,
} from './compilado/cotacao/arquivo.js'
import { blocoEmBranco, migrarBloco, VERSAO_DO_BLOCO } from './compilado/layout/bloco.js'
import { arranjo, empacotar, faixaDeDestaques, fileiraDeDestaques, colunaDeDestaques, formato, imagemDe, limparMural, MAX_DESTAQUES } from './compilado/layout/destaques.js'
import { etiquetaDoDesign, comEtiqueta } from './compilado/layout/etiqueta.js'
import { fatiasDaCotacao, numerosDaFabrica } from './compilado/cotacao/fabrica.js'
import { tamanhosNaOrdem, gradeEmTexto, totalDaGrade } from './compilado/layout/grade.js'
import { estatisticasDoComercial, quandoDaCotacao, passoDoCaminho, ultimosMeses, diasEntre, naAba } from './compilado/cotacao/comercial.js'

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

/* --- enviar e aprovar --- */
console.log('enviar e aprovar')
let d = cotacaoEmBranco('2026-9002')
const bb = blocoEmBranco(1)
bb.grade = { M: 5 }
d.produtos = [{ bloco: bb, precoPorTamanho: {}, precoBase: 100 }]
d = registrarEnvio(d, 'Paulo', 'primeira')
ok('enviar guarda a versao 1', d.enviadas.length === 1 && d.enviadas[0].total === 500)
ok('enviar muda o estado', d.estado === 'enviada')
/* o preco sobe DEPOIS do primeiro envio */
d.produtos = [{ ...d.produtos[0], precoBase: 120 }]
d = registrarEnvio(d, 'Paulo', 'segunda')
ok('a versao 1 guarda o total que saiu, e nao o de hoje', d.enviadas[0].total === 500)
ok('a versao 2 guarda o novo', d.enviadas[1].total === 600)
ok('as duas versoes continuam la', d.enviadas.length === 2)
ok('nao travada antes do sim', !travada(d))
const pedido = numeroDePedido([])
d = aprovar(d, pedido, 'Rafael')
ok('aprovar gera numero de pedido', /^PD\d{8}$/.test(d.aprovacao.pedido))
ok('aprovar marca a versao que valeu', d.aprovacao.versao === 2)
ok('aprovar registra quem e quando', d.aprovacao.quem === 'Rafael' && !!d.aprovacao.em)
ok('travada depois do sim', travada(d))
ok('numero de pedido nao repete', numeroDePedido([pedido]) !== pedido)

/* a cotacao aprovada vai e volta pelo arquivo sem perder a aprovacao */
const voltaAprovada = deCft(paraCft(d))
ok('o .cft guarda a aprovacao', voltaAprovada.aprovacao?.pedido === d.aprovacao.pedido)
ok('o .cft guarda as duas versoes', voltaAprovada.enviadas.length === 2)

/* --- a escada de 1 para 2 --- */
console.log('escada da versao 1 para a 2')
const v1 = JSON.stringify({
  marca: 'fourtime.cotacao',
  versao: 1,
  cotacao: {
    numero: '2025-0002',
    estado: 'enviada',
    cliente: { nome: 'Antigo' },
    produtos: [{ bloco: { grade: { M: 2 } }, precoBase: 30 }],
    enviadas: [{ numero: 1, data: '2025-01-01T00:00:00.000Z', total: 60, para: 'ele', observacao: '' }],
  },
})
const subiu = deCft(v1)
ok('arquivo da versao 1 sobe para a 2', subiu.versaoDoFormato === VERSAO_DO_CFT)
ok('arquivo antigo nao ganha aprovacao inventada', subiu.aprovacao === null)
ok('arquivo antigo nao fica travado', !travada(subiu))
ok('o envio antigo mantem o total', subiu.enviadas[0].total === 60)
ok('o envio antigo ganha pecas zero, e nao indefinido', subiu.enviadas[0].pecas === 0)

/* --- a escada tambem vale para o que esta guardado ------------------------
   O erro que isto pega: uma cotacao gravada no navegador ANTES da fusao com a
   ficha nao tem o bloco de producao. Ate aqui a escada so rodava ao abrir um
   arquivo, entao esse registro chegava na tela cru, e a tela morria ao pedir
   c.producao.marcas. Um registro guardado e tao antigo quanto um arquivo. */
console.log('a escada do que esta guardado')
const guardadaV3 = {
  id: 'CT20260183',
  numero: '2026-0183',
  versaoDoFormato: 3,
  estado: 'enviada',
  cliente: { nome: 'Escola Girassol', cidade: 'Goiania', uf: 'GO' },
  produtos: [{ bloco: { grade: { M: 10 } }, precoBase: 52, precoPorTamanho: {} }],
  /* no formato 3 o MODO de entrega ainda se chamava envio */
  informe: { prazo: '12 dias uteis', pagamento: 'A VISTA', envio: 'CORREIOS' },
  enviadas: [],
  aprovacao: null,
}
const daMemoria = arrumarCotacao(guardadaV3, 3, 5)
ok('a guardada sobe ate o formato de hoje', daMemoria.versaoDoFormato === VERSAO_DO_CFT)
ok('a guardada ganha o bloco de producao', !!daMemoria.producao)
ok('as marcas chegam como lista, e nao indefinidas', Array.isArray(daMemoria.producao.marcas))
ok('o envio virou entrega', daMemoria.informe.entrega === 'CORREIOS')
ok('nao sobra campo fantasma chamado envio', daMemoria.informe.envio === undefined)
ok('o pedido nao e inventado', daMemoria.producao.pedido === '')
ok('o produto guardado continua la', daMemoria.produtos.length === 1)
ok('o preco guardado continua la', daMemoria.produtos[0].precoBase === 52)
ok('a lista de informes nunca chega indefinida', Array.isArray(daMemoria.informes))

/* o degrau 4 para 5: cada informe ganha o grupo. Os termos da casa pelo
   texto; o que alguem escreveu a mao vai para Sobre a producao; quem ja tem
   grupo fica com o dele (11/10/2026) */
console.log('os grupos dos informes')
const comInformesV4 = arrumarCotacao(
  { ...guardadaV3, versaoDoFormato: 4, informe: { entrega: 'CORREIOS' }, producao: { pedido: '', dataDeEnvio: '', departamento: '', embalagem: '', marcas: [], observacao: '' },
    informes: [
      { id: 'A', texto: 'Frete por conta do cliente, salvo combinação em contrário. Entregas em Goiânia.', noDocumento: true },
      { id: 'B', texto: 'Garantia de 90 dias contra defeitos de fabricação, nos termos do CDC.', noDocumento: true },
      { id: 'C', texto: 'Escrito a mão sobre a costura.', noDocumento: true },
      { id: 'D', texto: 'Escrito a mão e já posto nos termos.', noDocumento: true, grupo: 'termos' },
    ] },
  4,
  5,
)
const grupoDe = (id) => comInformesV4.informes.find((i) => i.id === id)?.grupo
ok('o frete da casa vira termo', grupoDe('A') === 'termos')
ok('a garantia da casa vira termo', grupoDe('B') === 'termos')
ok('o informe escrito a mao vai para Sobre a producao', grupoDe('C') === 'producao')
ok('quem ja tem grupo fica com o dele', grupoDe('D') === 'termos')
ok('a cotacao nova nasce com os informes da casa agrupados', informesEmBranco().every((i) => i.grupo === 'producao' || i.grupo === 'termos') && informesEmBranco().some((i) => i.grupo === 'termos'))
ok('grupo que nao existe vira Sobre a producao', arrumarCotacao({ ...guardadaV3, versaoDoFormato: VERSAO_DO_CFT, informes: [{ id: 'E', texto: 'x', noDocumento: true, grupo: 'outro' }] }, VERSAO_DO_CFT, 5).informes[0].grupo === 'producao')

/* um registro JA no formato de hoje nao pode ser mexido pela escada */
const deHoje = arrumarCotacao(
  { ...guardadaV3, versaoDoFormato: VERSAO_DO_CFT, informe: { entrega: 'RETIRADA' },
    producao: { pedido: 'PD004052', dataDeEnvio: '', departamento: 'Comercial',
      embalagem: 'Sacola', marcas: ['URGENTE'], observacao: '' } },
  VERSAO_DO_CFT,
  5,
)
ok('o que ja esta no formato de hoje nao sobe degrau', deHoje.producao.pedido === 'PD004052')
ok('a marca guardada fica', deHoje.producao.marcas.join() === 'URGENTE')
ok('a entrega guardada fica', deHoje.informe.entrega === 'RETIRADA')

/* um informe gravado sem um campo novo pega o padrao, e nao apaga o resto */
const faltando = arrumarCotacao({ ...guardadaV3, informe: { prazo: '5 dias' } }, 3, 5)
ok('o campo que falta no informe vem do molde', typeof faltando.informe.tabelaDePreco === 'string')
ok('o campo gravado no informe nao se perde', faltando.informe.prazo === '5 dias')

/* --- as fatias que viram cartao no kanban -------------------------------- */
console.log('fatias')

/* um produto de mentira, curto: o bloco em branco com grade e design */
function produto(n, grade, tecnicas, informacoes = false) {
  const b = blocoEmBranco(n)
  b.grade = grade
  b.informacoes = informacoes
  b.design = tecnicas.map((t) => ({ tag: t, tecnica: t, cores: [] }))
  return { bloco: b, precoPorTamanho: {}, precoBase: 10 }
}
const comProdutos = (...ps) => ({ ...cotacaoEmBranco(), produtos: ps })

const soSubli = fatiasDaCotacao(comProdutos(produto(1, { M: 10 }, ['subli'])))
ok('um pedido de uma tecnica vira uma fatia', soSubli.length === 1)
ok('a fatia leva o layout', soSubli[0].layouts.join() === '1')
ok('a fatia leva as pecas', soSubli[0].pecas === 10)

const duas = fatiasDaCotacao(
  comProdutos(produto(1, { M: 8 }, ['dtf']), produto(2, { M: 5 }, ['subli'])),
)
ok('duas tecnicas em layouts diferentes viram duas fatias', duas.length === 2)
ok('a ordem e a da fabrica, e nao a da cotacao',
  duas.map((f) => f.tecnica).join() === 'subli,dtf')

/* O CASO QUE DECIDE O DESENHO: um layout so, com duas tecnicas. Ele passa
   pelas duas maquinas, entao entra nas duas fatias, e as pecas contam nas
   duas. Somar as fatias e achar o dobro das pecas do pedido nao e erro. */
const junto = fatiasDaCotacao(comProdutos(produto(1, { M: 12 }, ['subli', 'bordado'])))
ok('um layout com duas tecnicas vira duas fatias', junto.length === 2)
ok('o mesmo layout aparece nas duas', junto.every((f) => f.layouts.join() === '1'))
ok('as pecas contam nas duas, porque sao dois trabalhos',
  junto[0].pecas === 12 && junto[1].pecas === 12)

const acabamento = fatiasDaCotacao(
  comProdutos(produto(1, { M: 4 }, ['subli', 'gola', 'ribana', 'etiqueta'])),
)
ok('gola, ribana e etiqueta nao viram fila', acabamento.length === 1)
ok('e a tecnica que sobra e a que ocupa posto', acabamento[0].tecnica === 'subli')

const duasCores = fatiasDaCotacao(comProdutos(produto(1, { M: 6 }, ['dtf', 'dtf'])))
ok('a mesma tecnica duas vezes no layout e um trabalho so', duasCores.length === 1)
ok('e o layout nao entra duas vezes na mesma fatia', duasCores[0].layouts.join() === '1')

const comAnexo = fatiasDaCotacao(
  comProdutos(produto(1, { M: 7 }, ['silk']), produto(2, { M: 99 }, ['silk'], true)),
)
ok('o modulo de informacoes nao entra em fila nenhuma', comAnexo[0].layouts.join() === '1')
ok('nem nas pecas', comAnexo[0].pecas === 7)

ok('cotacao sem tecnica de producao nao tem o que liberar',
  fatiasDaCotacao(comProdutos(produto(1, { M: 3 }, ['etiqueta']))).length === 0)

/* a divisao do dinheiro continua sendo por PRODUTO, e nao por fatia */
const dinheiro = numerosDaFabrica(comProdutos(produto(1, { M: 12 }, ['subli', 'bordado'])))
ok('um layout com sublimacao e um layout de sublimacao, mesmo com bordado junto',
  dinheiro.pecasSubli === 12 && dinheiro.pecasPersonalizadas === 0)


/* --- o mural dos destaques (decisao 164) e o bloco 6 --- */
console.log('destaques')
const larga = imagemDe(2800, 2400), alta = imagemDe(2800, 3299)
const R = (x, y, w, h) => ({ x, y, w, h, z: 1, dx: 0, dy: 0 })
const erroDeFormato = (caixas, regs, im) => Math.max(...caixas.map((c, i) => Math.abs(c.w / c.h - formato(regs[i], im)) / formato(regs[i], im)))
/* o caso dele: dois deitados e dois em pe. Os deitados primeiro, um embaixo do outro; os em pe embaixo, lado a lado */
const caso = [R(0.6, 0.55, 0.2, 0.35), R(0.1, 0.1, 0.4, 0.1), R(0.1, 0.5, 0.15, 0.4), R(0.5, 0.3, 0.4, 0.12)]
const ed = arranjo(650, 511, alta, caso)
const [p1, d1, p2, d2] = ed.thumbs
ok('no editor, cada destaque com o formato da regiao (erro < 3%)', erroDeFormato(ed.thumbs, caso, alta) < 0.03)
ok('deitados primeiro, um embaixo do outro', d1.y + d1.h <= d2.y + 1 && d2.y + d2.h <= p1.y + 1)
ok('em pe embaixo, lado a lado', Math.abs(p1.y - p2.y) <= 1 && p1.x + p1.w <= p2.x + 1)
ok('a arte desliza para a esquerda', ed.arte.x === 0)
{ const [a, b] = empacotar(600, 400, [4, 0.25], 6, false, [1, -1]).caixas
  ok('fileira nunca mistura deitado com em pe', a.y + a.h <= b.y + 0.5) }
ok('nada sai da caixa do editor', ed.thumbs.every((t) => t.x >= ed.arte.w - 0.5 && t.x + t.w <= 650.5 && t.y >= -0.5 && t.y + t.h <= 511.5))
const fx = faixaDeDestaques(340, larga, caso, 140)
ok('na folha, a faixa mantem o formato e cabe na altura', erroDeFormato(fx.thumbs, caso, larga) < 0.03 && fx.H <= 140.5)
const fi = fileiraDeDestaques(340, larga, caso, 4, 90)
ok('a fileira so (estilo 14): mesma altura, formato certo, dentro da largura', fi.thumbs.every((t) => Math.abs(t.h - fi.H) < 0.01) && erroDeFormato(fi.thumbs, caso, larga) < 0.03 && fi.thumbs.at(-1).x + fi.thumbs.at(-1).w <= 340.5)
const co = colunaDeDestaques(90, alta, caso, 4)
ok('a coluna (arte alta): mesma largura, formato certo', co.thumbs.every((t) => t.w === 90) && erroDeFormato(co.thumbs, caso, alta) < 0.03)
const sujo = limparMural({ regs: [{ x: -1, y: 0.2, w: 2, h: 0.1, z: 9, dx: 5, dy: 0 }, { x: 0.5, y: 0.5, w: 0, h: 0.2 }, ...Array(12).fill(R(0.1, 0.1, 0.2, 0.2))], travado: 'sim' })
ok('mural de fora: numero fora da faixa vai para a beira', sujo.regs[0].x === 0 && sujo.regs[0].w === 1 && sujo.regs[0].z === 4 && sujo.regs[0].dx === 0.5)
ok('mural de fora: regiao sem tamanho sai, e passam no maximo oito', sujo.regs.length === MAX_DESTAQUES && sujo.regs.every((r) => r.w > 0 && r.h > 0))
ok('mural de fora: trava so com true', sujo.travado === false)
ok('limparMural de lixo e um mural vazio', limparMural('x').regs.length === 0 && limparMural(null).travado === false)

console.log('bloco 6')
ok('o bloco esta na versao 6', VERSAO_DO_BLOCO === 6)
ok('bloco novo nasce com o mural vazio', blocoEmBranco(1).destaques.regs.length === 0 && blocoEmBranco(1).destaques.travado === false)
const b5 = { ...blocoEmBranco(1), versao: 5 }
delete b5.destaques
const b6 = migrarBloco(b5)
ok('bloco da versao 5 sobe com o mural vazio e carimbado', b6.destaques.regs.length === 0 && b6.versao === 6)
const semCarimbo = { ...blocoEmBranco(1) }
delete semCarimbo.destaques
delete semCarimbo.versao
ok('bloco sem carimbo e sem mural (tratado como de hoje) nao cai', migrarBloco({ ...semCarimbo, versao: 6 }).destaques.regs.length === 0)
const comMural = migrarBloco({ ...blocoEmBranco(1), versao: 6, destaques: { regs: [R(0.1, 0.1, 0.3, 0.2)], travado: true } })
ok('o mural de hoje passa inteiro', comMural.destaques.regs.length === 1 && comMural.destaques.travado === true)
const cc = cotacaoEmBranco('2026-9002')
cc.produtos = [{ bloco: comMural, precoPorTamanho: {}, precoBase: 0 }]
const voltaMural = deCft(paraCft(cc))
ok('o mural vai e volta no .cft', voltaMural.produtos[0].bloco.destaques.regs[0].w === 0.3 && voltaMural.produtos[0].bloco.destaques.travado === true)

console.log('etiqueta')
const D = (tag, tecnica = 'etiqueta') => ({ tag, tecnica, cores: [] })
ok('Eti. Fourtime com Eti. Silk', JSON.stringify(etiquetaDoDesign([D('Eti. Fourtime'), D('Eti. Silk'), D('DTF', 'dtf')])) === '{"tipo":"fourtime","tecnica":"silk"}')
ok('o cliente ganha da Fourtime na ficha antiga com as duas', etiquetaDoDesign([D('Eti. Fourtime'), D('Eti. Cliente')]).tipo === 'cliente')
ok('tecnica de etiqueta sem o tipo e a da Fourtime', etiquetaDoDesign([D('Eti. DTF')]).tipo === 'fourtime')
ok('sem tag de etiqueta, sem etiqueta', etiquetaDoDesign([D('Silk', 'silk')]).tipo === '')
const trocado = comEtiqueta([D('Eti. Fourtime'), D('Eti. Silk'), D('Subli', 'subli')], { tipo: 'cliente', tecnica: 'dtf' })
ok('trocar a etiqueta deixa uma so, com a tecnica, na frente', trocado.map((d) => d.tag).join() === 'Eti. Cliente,Eti. DTF,Subli')
ok('desligar a etiqueta leva a tecnica junto', comEtiqueta(trocado, { tipo: '', tecnica: 'dtf' }).map((d) => d.tag).join() === 'Subli')

console.log('a página do orçamento')
const CL = (id, estado, vendedor, total, validaAte, alteradaEm = '2026-10-02', criadaEm = '2026-10-01') => ({ id, estado, vendedor, total, validaAte, alteradaEm, criadaEm, pedido: '' })
const cots = [CL('a', 'enviada', 'Dani', 100, '2026-10-20'), CL('b', 'enviada', 'Rafa', 300, '2026-10-12'), CL('c', 'rascunho', 'Dani', 50, ''), CL('d', 'recusada', 'Dani', 70, '', '2026-10-05'), CL('e', 'aprovada', 'Dani', 200, '', '2026-10-08', '2026-10-01'), CL('f', 'vencida', 'Rafa', 90, '', '2026-09-28')]
const peds = [{ cotacaoId: 'e', estado: 'pcp', aprovadoEm: '2026-10-08T11:00:00', total: 200, vendedor: 'Dani' }, { cotacaoId: 'x', estado: 'entregue', aprovadoEm: '2026-09-20T11:00:00', total: 999, vendedor: 'Rafa' }, { cotacaoId: 'y', estado: 'cancelado', aprovadoEm: '2026-10-09T11:00:00', total: 500, vendedor: 'Rafa' }]
const est = estatisticasDoComercial(cots, peds, '2026-10', '2026-10-10')
ok('esperando: as enviadas e a soma', est.esperando.n === 2 && est.esperando.valor === 400)
ok('vencem esta semana: só a que acaba em até 7 dias', est.vencemNaSemana === 1)
ok('aprovadas no mês: pelo pedido, sem o cancelado e sem o de setembro', est.aprovadas.n === 1 && est.aprovadas.valor === 200)
ok('perdidas no mês: a recusada de outubro, e não a vencida de setembro', est.perdidas.n === 1 && est.perdidas.valor === 70)
ok('a taxa: 1 de 4 (aprovada, duas esperando, uma perdida)', est.saidas === 4 && est.taxa === 25)
ok('tempo até aprovar: da criação da cotação ao pedido', est.diasAteAprovar === 7)
ok('as últimas aprovadas, sem o cancelado, a mais nova primeiro', est.ultimas.length === 2 && est.ultimas[0].pedido.cotacaoId === 'e' && est.ultimas[0].cotacao.id === 'e')
ok('por vendedor: Dani aprovou 1 de 3, Rafa 0 de 1', JSON.stringify(est.porVendedor) === '[{"nome":"Dani","valor":200,"aprovou":1,"de":3},{"nome":"Rafa","valor":0,"aprovou":0,"de":1}]')
ok('sem nada no mês, a taxa é nula, e não zero', estatisticasDoComercial([], [], '2026-10', '2026-10-10').taxa === null)
ok('a validade: vence amanhã, em vermelho', JSON.stringify(quandoDaCotacao(CL('z', 'enviada', '', 0, '2026-10-11'), '2026-10-10')) === '{"texto":"vence amanhã","perto":true}')
ok('a validade: 3 dias é perto, 4 não', quandoDaCotacao(CL('z', 'enviada', '', 0, '2026-10-13'), '2026-10-10').perto && !quandoDaCotacao(CL('z', 'enviada', '', 0, '2026-10-14'), '2026-10-10').perto)
ok('a validade passada: venceu', quandoDaCotacao(CL('z', 'enviada', '', 0, '2026-10-08'), '2026-10-10').texto === 'venceu em 08/10')
ok('o rascunho mexido ontem', quandoDaCotacao(CL('z', 'rascunho', '', 0, '', '2026-10-09'), '2026-10-10').texto === 'mexida ontem')
ok('o caminho: a cotação enviada está no passo 0', passoDoCaminho('enviada', null) === 0)
ok('o caminho: o pedido no PCP está no passo 2, e o entregue passou de todos', passoDoCaminho('aprovada', { estado: 'pcp' }) === 2 && passoDoCaminho('aprovada', { estado: 'entregue' }) === 4)
ok('os doze meses, virando o ano', ultimosMeses('2026-02-10', 3).join() === '2026-02,2026-01,2025-12')
ok('dias entre datas, pelo calendário', diasEntre('2026-02-27', '2026-03-01') === 2)
ok('as abas: perdidas são recusadas e vencidas', naAba(CL('z', 'vencida'), 'perdidas') && !naAba(CL('z', 'aprovada'), 'perdidas') && naAba(CL('z', 'rascunho'), 'aberto'))

console.log(falhas ? '\n' + falhas + ' falha(s)' : '\ntudo passou')
process.exit(falhas ? 1 : 0)
