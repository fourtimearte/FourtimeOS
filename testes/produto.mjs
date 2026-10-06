/* ==========================================================================
   AS CONTAS DA FICHA TÉCNICA.

   O que dá para provar sem navegador e sem banco: a grade de cada peça, o
   código que nasce do grupo, do número e do gênero, o que falta numa ficha,
   a área do tecido virando metro e grama, o número digitado com vírgula, e o
   rascunho do editor virando a ficha que vai para o banco.

   AS CONTAS DE CONFERÊNCIA SÃO ESCRITAS AQUI, de outro jeito, e os números
   esperados vêm do estudo de moldes da FT-010-000M (PP 0,8204 m2 a G4
   1,3964 m2): teste que usa a mesma função que confere só prova que ela
   concorda consigo.

   Rodar:  sh testes/produto.sh
   ========================================================================== */

import * as p from './compilado-produto/src/dominio/produto/contas.js'
import * as k from './compilado-produto/src/dominio/produto/kit.js'
import * as o from './compilado-produto/src/dominio/produto/molde.js'
import * as v from './compilado-produto/src/dominio/produto/vendas.js'

let ruins = 0
const conta = (certo, frase) => {
  if (!certo) ruins++
  console.log((certo ? 'ok   ' : 'RUIM ') + frase)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const perto = (a, b, folga = 1e-9) => typeof a === 'number' && Math.abs(a - b) <= folga

const ADULTA = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', 'G4']
const INFANTIL = ['2A', '4A', '6A', '8A', '10A', '12A', '14A']

/* ---- a grade ------------------------------------------------------------- */
conta(igual(p.TODOS_OS_TAMANHOS, [...ADULTA, ...INFANTIL]), 'a grade: dez tamanhos de adulto e sete de infantil, nesta ordem')
conta(p.ehInfantil({ genero: 'C', nome: 'CAMISETA' }), 'infantil: pelo gênero C')
conta(p.ehInfantil({ genero: 'U', nome: 'CAMISETA INFANTIL UNISSEX' }), 'infantil: pelo nome, mesmo marcada como unissex')
conta(p.ehInfantil({ genero: 'U', nome: 'CALÇAO INF SEM BOLSO' }), 'infantil: pelo INF abreviado')
conta(!p.ehInfantil({ genero: 'M', nome: 'CAMISETA INFORMAL' }), 'infantil: INFORMAL não é infantil')
conta(igual(p.tamanhosDaReferencia({ tamanhos: [], genero: 'M', nome: 'X' }), ADULTA), 'ficha em branco de adulto: nasce com a grade adulta')
conta(igual(p.tamanhosDaReferencia({ tamanhos: [], genero: 'C', nome: 'X' }), INFANTIL), 'ficha em branco de infantil: nasce com a grade infantil')
conta(igual(p.tamanhosDaReferencia({ tamanhos: ['G', '2A', 'P'], genero: 'M', nome: 'X' }), ['P', 'G', '2A']), 'ficha preenchida: os tamanhos ligados, na ordem da fábrica')
conta(igual(p.faixasDaGrade(['P', 'G']), ['adulto']) && igual(p.faixasDaGrade(['4A']), ['infantil']) && igual(p.faixasDaGrade(['P', '4A']), ['adulto', 'infantil']), 'as faixas da grade: só adulta, só infantil e as duas')
conta(p.gradeEmPalavras(ADULTA) === 'grade adulta, PP a G4', 'grade em palavras: adulta inteira')
conta(p.gradeEmPalavras(['4A', '6A', '8A']) === 'grade infantil, 4A a 8A', 'grade em palavras: infantil pela metade')
conta(p.gradeEmPalavras(['M', '2A', '14A', 'G']) === 'M a G e 2A a 14A', 'grade em palavras: as duas faixas')
conta(p.gradeEmPalavras(['M']) === 'grade adulta, M', 'grade em palavras: um tamanho só')
conta(p.gradeEmPalavras([]) === 'sem tamanho', 'grade em palavras: nenhum')

/* ---- o código ------------------------------------------------------------ */
conta(p.montarCodigo('010', '0', 'M') === 'FT-010-000M', 'código: o número ganha os zeros da frente')
conta(p.montarCodigo('090', '12', 'F') === 'FT-090-012F', 'código: grupo, número e gênero')
conta(p.montarCodigo('090', 'a1b2', 'F') === 'FT-090-012F', 'código: só os dígitos do número contam')
conta(p.montarCodigo('', '1', 'M') === '' && p.montarCodigo('010', '', 'M') === '' && p.montarCodigo('010', '1', '') === '', 'código: faltou um pedaço, não tem código')
conta(p.codigoCurto('FT-010-000M') === '010-000M' && p.codigoCurto('KIT-1') === 'KIT-1', 'código curto: sem o FT-, e o que não é FT fica como está')
{
  const refs = [
    { cod: 'FT-010-000M', grupo: '010' },
    { cod: 'FT-010-001M', grupo: '010' },
    { cod: 'FT-010-003F', grupo: '010' },
    { cod: 'FT-020-002M', grupo: '020' },
  ]
  conta(p.proximoNumero(refs, '010') === '002', 'próximo número: o primeiro buraco do grupo (000, 001 e 003 usados dá 002)')
  conta(p.proximoNumero(refs, '020') === '000', 'próximo número: grupo que começa no 002 ainda tem o 000 livre')
  conta(p.proximoNumero(refs, '999') === '000', 'próximo número: grupo vazio começa no 000')
}

/* ---- o que falta --------------------------------------------------------- */
{
  const base = { fichaEm: null, medidas: 0, partesComTecido: 0, materiais: 0, temMolde: false }
  conta(igual(p.oQueFalta(base), ['medidas', 'tecido', 'molde']), 'falta: ficha em branco falta tudo')
  conta(p.emBranco(base), 'em branco: nunca salva e sem molde')
  conta(!p.emBranco({ ...base, temMolde: true }), 'em branco: com molde já não está')
  conta(!p.emBranco({ ...base, fichaEm: '2026-10-05T12:00:00Z' }), 'em branco: salva uma vez já não está')
  conta(igual(p.oQueFalta({ ...base, medidas: 3, partesComTecido: 2, temMolde: true }), []), 'falta: com medidas, tecido e molde não falta nada (aviamento não é exigido)')
  conta(p.faltaEmPalavras(['tecido']) === 'falta tecido', 'falta em palavras: uma coisa')
  conta(p.faltaEmPalavras(['medidas', 'molde']) === 'faltam medidas e molde', 'falta em palavras: duas')
  conta(p.faltaEmPalavras(['medidas', 'tecido', 'molde']) === 'faltam medidas, tecido e molde', 'falta em palavras: três')
  conta(p.faltaEmPalavras([]) === '', 'falta em palavras: nada')
}

/* ---- o tecido: a área, o metro e o grama --------------------------------- */
{
  /* o estudo de moldes da FT-010-000M: a peça inteira, e a divisão por parte */
  const INTEIRA = { PP: 0.8204, G4: 1.3964 }
  const partes = [
    { nome: 'Frente', vezes: 1, unidade: 'm2', quantidades: { PP: 0.2953, G4: 0.5027 } },
    { nome: 'Costas', vezes: 1, unidade: 'm2', quantidades: { PP: 0.3036, G4: 0.5167 } },
    { nome: 'Mangas', vezes: 2, unidade: 'm2', quantidades: { PP: 0.2215, G4: 0.377 } },
    { nome: 'Ribana da gola', vezes: 1, unidade: 'm', quantidades: { PP: 0.44, G4: 0.52 } },
  ]
  const somaNaMao = (t) => 0.0 + partes[0].quantidades[t] + partes[1].quantidades[t] + partes[2].quantidades[t]
  conta(perto(p.areaDaPeca(partes, 'PP'), INTEIRA.PP, 1e-4) && perto(p.areaDaPeca(partes, 'PP'), somaNaMao('PP')), 'área da peça no PP: soma só as partes de pano, e dá o 0,8204 do estudo (' + p.areaDaPeca(partes, 'PP').toFixed(4) + ')')
  conta(perto(p.areaDaPeca(partes, 'G4'), INTEIRA.G4, 1e-4), 'área da peça no G4: 1,3964 (' + p.areaDaPeca(partes, 'G4').toFixed(4) + ')')
  conta(p.areaDaPeca(partes, 'M') === null, 'área da peça num tamanho sem número: nulo, e não zero')
  conta(p.areaDaPeca([partes[3]], 'PP') === null, 'área da peça só com ribana: nulo, porque ribana se mede em metro')
  const dry = { id: 't', nome: 'DRYFIT', gramatura: 180, largura: 1.6 }
  conta(perto(p.areaEmMetros(0.8204, dry), 0.8204 / 1.6), 'metros: a área dividida pela largura (0,8204 em 1,60 m dá ' + p.areaEmMetros(0.8204, dry).toFixed(4) + ' m)')
  conta(perto(p.areaEmGramas(0.8204, dry), 147.672, 1e-6), 'gramas: a área vezes a gramatura (0,8204 em 180 g/m2 dá 147,67 g)')
  conta(p.areaEmMetros(0.8, { ...dry, largura: null }) === null && p.areaEmMetros(0.8, { ...dry, largura: 0 }) === null, 'metros: tecido sem largura não converte')
  conta(p.areaEmGramas(0.8, { ...dry, gramatura: null }) === null, 'gramas: tecido sem gramatura não converte')
  conta(p.areaEmMetros(null, dry) === null && p.areaEmGramas(0.8, null) === null, 'sem área ou sem tecido não há conta')
  conta(igual(p.tecidosQueConvertem([dry, { ...dry, id: 'a', largura: null }, { ...dry, id: 'b', gramatura: 0 }]).map((t) => t.id), ['t']), 'tecido de conta: só o que tem largura e gramatura')
  conta(p.vezesEmPalavras(1) === 'cortada 1 vez' && p.vezesEmPalavras(2) === 'cortada 2 vezes', 'quantas vezes a parte é cortada, em palavras')
}

/* ---- o número digitado ---------------------------------------------------- */
conta(p.lerNumero('1,12') === 1.12 && p.lerNumero('1.12') === 1.12 && p.lerNumero(' 66 ') === 66, 'número: vírgula, ponto e espaço em volta')
conta(p.lerNumero('') === null && p.lerNumero('   ') === null, 'número: campo vazio é nulo, e não zero')
conta(Number.isNaN(p.lerNumero('abc')) && Number.isNaN(p.lerNumero('1,2,3')) && Number.isNaN(p.lerNumero('-4')) && Number.isNaN(p.lerNumero('1,')), 'número: letra, duas vírgulas, negativo e vírgula solta não são número')
conta(Number.isNaN(p.lerNumero('0,12345')), 'número: mais de quatro casas não entra')
conta(p.paraOCampo(1.5) === '1,5' && p.paraOCampo(66) === '66' && p.paraOCampo(undefined) === '', 'número para o campo: com vírgula e sem zero sobrando')
conta(p.emNumero(66, 1) === '66,0' && p.emNumero(0.5127, 2) === '0,51' && p.emNumero(null, 2) === '', 'número na tela: com as casas pedidas')
conta(p.casasDaArea([0.3, 0.45, null, undefined]) === 2 && p.casasDaArea([0.3, 0.295]) === 3 && p.casasDaArea([0.2953]) === 3 && p.casasDaArea([]) === 2 && p.casasDaArea([0.3004]) === 2, 'casas da área: duas, e três quando algum tamanho da linha tem a terceira casa')
conta(p.emArea(0.3) === '0,30' && p.emArea(0.3, 3) === '0,300' && p.emArea(0.2953, 3) === '0,295' && p.emArea(0.012, 3) === '0,012' && p.emArea(1) === '1,00' && p.emArea(null, 3) === '', 'área na tela: com as casas que a linha pede')
conta(p.campoComErro('1,') && p.campoComErro('x') && !p.campoComErro('') && !p.campoComErro('12,5'), 'campo com erro: o que não é número, e o vazio não é erro')

/* ---- o molde -------------------------------------------------------------- */
conta(p.erroNoMolde('<svg viewBox="0 0 1 1"><path d="M0,0"/></svg>') === '', 'molde: um SVG simples sobe')
conta(p.erroNoMolde('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>') === '', 'molde: com o cabeçalho de XML na frente também')
conta(p.erroNoMolde('<html><body>oi</body></html>') !== '', 'molde: o que não é SVG não sobe')
conta(p.erroNoMolde('<svg><script>alert(1)</script></svg>') !== '', 'molde: com script não sobe')
conta(p.erroNoMolde('<svg><foreignObject></foreignObject></svg>') !== '', 'molde: com foreignObject não sobe')
conta(p.erroNoMolde('<svg><a href="javascript:x()">a</a></svg>') !== '', 'molde: com endereço javascript não sobe')
conta(p.erroNoMolde('<svg onload="x()"></svg>') !== '' && p.erroNoMolde('<svg><path onclick = "x()"/></svg>') !== '', 'molde: com evento (onload, onclick) não sobe')
conta(p.erroNoMolde('<svg>' + 'a'.repeat(p.TETO_DO_MOLDE) + '</svg>') !== '', 'molde: passou do teto de tamanho não sobe')
conta(p.moldeComoImagem('<svg id="a#b"></svg>').startsWith('data:image/svg+xml;charset=utf-8,') && !p.moldeComoImagem('<svg id="a#b"></svg>').includes('#'), 'molde como imagem: o endereço escapa o # que cortaria o desenho')

/* ---- o rascunho ------------------------------------------------------------ */
{
  const ficha = {
    nome: 'CAMISETA MASC TRAD',
    detalhes: { gola: 'Redonda', costura: 'Overloque' },
    observacao: 'Reforço de ombro a ombro.',
    tamanhos: ['PP', 'P', 'M'],
    medidas: [
      { nome: 'Comprimento', comoMedir: 'do ombro à barra', valores: { PP: 66, P: 68, M: 70.5 } },
      { nome: 'Largura', comoMedir: '', valores: { PP: 47 } },
    ],
    partes: [
      { nome: 'Frente', vezes: 1, unidade: 'm2', quantidades: { PP: 0.2953, P: 0.31 } },
      { nome: 'Mangas', vezes: 2, unidade: 'm2', quantidades: {} },
    ],
    materiais: [{ materialId: 'abc', nome: 'Linha 120', quantidade: 0.02, unidade: 'cone' }],
  }
  const r = p.abrirRascunho(ficha)
  conta(r.medidas[0].valores.M === '70,5' && r.partes[0].quantidades.PP === '0,2953' && r.materiais[0].quantidade === '0,02' && r.partes[1].vezes === '2', 'rascunho: os números viram texto com vírgula')
  conta(r.detalhes.manga === '' && r.detalhes.gola === 'Redonda', 'rascunho: o detalhe que a ficha não tem nasce vazio')
  conta(new Set([...r.medidas, ...r.partes, ...r.materiais].map((x) => x.chave)).size === 5, 'rascunho: cada linha tem a sua chave')
  const volta = p.fecharRascunho(r)
  conta(volta.erro === '' && igual(volta.ficha, ficha), 'rascunho: abrir e fechar sem mexer devolve a mesma ficha')
  conta(p.retratoDoRascunho(r) === p.retratoDoRascunho(p.abrirRascunho(ficha)), 'retrato: dois rascunhos da mesma ficha são iguais, mesmo com chaves diferentes')
  conta(p.retratoDoRascunho(r) !== p.retratoDoRascunho({ ...r, nome: r.nome + ' ' }), 'retrato: mudou uma letra, mudou o retrato')

  const com = (troca) => p.fecharRascunho({ ...r, ...troca })
  const erra = (troca, onde, pedaco, frase) => {
    const f = com(troca)
    conta(f.ficha === null && f.onde === onde && f.erro.includes(pedaco), frase + ' (' + (f.erro || 'passou') + ')')
  }
  erra({ nome: '   ' }, 'identificacao', 'nome', 'não fecha: sem nome')
  erra({ nome: 'x'.repeat(121) }, 'identificacao', '120', 'não fecha: nome com mais de 120 letras')
  erra({ tamanhos: [] }, 'grade', 'tamanho', 'não fecha: sem tamanho ligado')
  erra({ detalhes: { ...r.detalhes, gola: 'x'.repeat(201) } }, 'detalhes', '200', 'não fecha: detalhe com mais de 200 letras')
  erra({ medidas: [{ ...r.medidas[0], valores: { PP: 'abc' } }] }, 'medidas', 'PP', 'não fecha: letra no lugar da medida, e diz o tamanho')
  erra({ medidas: [{ ...r.medidas[0], valores: { M: '1000' } }] }, 'medidas', '999', 'não fecha: medida acima de 999')
  erra({ medidas: [r.medidas[0], { ...r.medidas[1], nome: 'COMPRIMENTO ' }] }, 'medidas', 'duas vezes', 'não fecha: a mesma medida duas vezes, sem olhar maiúscula')
  erra({ medidas: [{ ...r.medidas[0], nome: '' }] }, 'medidas', 'sem nome', 'não fecha: medida com número e sem nome')
  erra({ partes: [{ ...r.partes[0], vezes: '0' }] }, 'tecido', '1 a 20', 'não fecha: parte cortada zero vezes')
  erra({ partes: [{ ...r.partes[0], vezes: '2,5' }] }, 'tecido', '1 a 20', 'não fecha: parte cortada duas vezes e meia')
  erra({ partes: [{ ...r.partes[0], quantidades: { P: '100' } }] }, 'tecido', '99', 'não fecha: parte com mais de 99 de área')
  erra({ partes: [r.partes[0], { ...r.partes[1], nome: 'FRENTE' }] }, 'tecido', 'duas vezes', 'não fecha: a mesma parte duas vezes')
  erra({ materiais: [{ ...r.materiais[0], quantidade: '0' }] }, 'materiais', 'maior que zero', 'não fecha: aviamento com zero')
  erra({ materiais: [{ ...r.materiais[0], quantidade: '' }] }, 'materiais', 'maior que zero', 'não fecha: aviamento sem quantidade')
  erra({ materiais: [{ ...r.materiais[0], unidade: 'x'.repeat(13) }] }, 'materiais', '12', 'não fecha: unidade com mais de 12 letras')

  {
    /* desligar um tamanho não apaga o número do rascunho, mas ele não vai para o banco */
    const semM = com({ tamanhos: ['PP', 'P'] })
    conta(semM.erro === '' && igual(semM.ficha.medidas[0].valores, { PP: 66, P: 68 }) && r.medidas[0].valores.M === '70,5', 'tamanho desligado: o número fica no rascunho e não vai para a ficha')
    const comLixo = com({ tamanhos: ['PP', 'P'], medidas: [{ ...r.medidas[0], valores: { PP: '66', M: 'abc' } }] })
    conta(comLixo.erro === '', 'tamanho desligado: o que está errado nele não impede de salvar')
  }
  {
    const comVazia = com({ medidas: [...r.medidas, { chave: 99, nome: '  ', comoMedir: '', valores: { PP: ' ' } }] })
    conta(comVazia.erro === '' && comVazia.ficha.medidas.length === 2, 'linha de medida adicionada e nunca preenchida some sozinha')
    const soNome = com({ medidas: [...r.medidas, { chave: 99, nome: 'Punho', comoMedir: '', valores: {} }] })
    conta(soNome.erro === '' && soNome.ficha.medidas.length === 3 && igual(soNome.ficha.medidas[2].valores, {}), 'medida só com o nome é guardada, sem número')
  }
  {
    const foraDeOrdem = com({ tamanhos: ['M', 'PP', 'P'] })
    conta(igual(foraDeOrdem.ficha.tamanhos, ['PP', 'P', 'M']), 'a grade sai na ordem da fábrica, não na ordem do clique')
    const aparado = com({ nome: '  CAMISETA  ', detalhes: { ...r.detalhes, gola: '  Redonda  ', manga: '   ' } })
    conta(aparado.ficha.nome === 'CAMISETA' && aparado.ficha.detalhes.gola === 'Redonda' && !('manga' in aparado.ficha.detalhes), 'o texto sai aparado, e o detalhe vazio não vai')
  }
  {
    const numeros = p.partesEmNumero([{ chave: 1, nome: 'Frente', vezes: '1', unidade: 'm2', quantidades: { PP: '0,3', P: '0,', M: '' } }, { chave: 2, nome: 'Costas', vezes: '', unidade: 'm2', quantidades: { PP: '0,31' } }], ['PP', 'P', 'M'])
    conta(igual(numeros[0].quantidades, { PP: 0.3 }) && numeros[1].vezes === 1, 'partes em número: o que ainda não é número fica de fora da soma, e vezes vazio conta 1')
    conta(perto(p.areaDaPeca(numeros, 'PP'), 0.61), 'a soma anda junto com o que é digitado (0,30 + 0,31 = 0,61)')
  }
}

/* ---- copiar a ficha -------------------------------------------------------- */
{
  const de = { nome: 'A', detalhes: { gola: 'Polo' }, observacao: 'o', tamanhos: ['P'], medidas: [{ nome: 'C', comoMedir: '', valores: { P: 1 } }], partes: [{ nome: 'F', vezes: 1, unidade: 'm2', quantidades: { P: 1 } }], materiais: [{ materialId: null, nome: 'L', quantidade: 1, unidade: 'un' }] }
  const copia = p.copiarFicha(de, 'B')
  copia.medidas[0].valores.P = 9
  copia.partes[0].quantidades.P = 9
  copia.detalhes.gola = 'x'
  copia.tamanhos.push('M')
  conta(copia.nome === 'B' && de.medidas[0].valores.P === 1 && de.partes[0].quantidades.P === 1 && de.detalhes.gola === 'Polo' && de.tamanhos.length === 1, 'copiar a ficha: mexer na cópia não mexe na original')
}

/* ---- o kit -------------------------------------------------------------------- */
{
  conta(k.codigoDoKit(['FT-020-000M', 'FT-090-000M']) === 'FT-KIT-020-000M-090-000M', 'código do kit: FT-KIT e o código de cada peça sem o FT-, na ordem')
  conta(k.codigoDoKit(['FT-090-000M', 'FT-020-000M']) === 'FT-KIT-090-000M-020-000M', 'código do kit: outra ordem das peças é outro código')
  conta(k.codigoDoKit(['FT-020-000M']) === '' && k.codigoDoKit([]) === '' && k.codigoDoKit(['FT-020-000M', '']) === '', 'código do kit: com uma peça só, ou com peça sem código, não tem código')
  conta(k.generoDoKit(['M', 'M']) === 'M' && k.generoDoKit(['F', 'M']) === 'U' && k.generoDoKit(['C', 'C', 'C']) === 'C' && k.generoDoKit(['', '']) === 'U', 'gênero do kit: o das peças quando concordam; senão, unissex')
  const adulto = { tamanhos: [], genero: 'M', nome: 'CAMISETA' }
  conta(igual(k.gradeDoKit([adulto, { tamanhos: ['P', 'M', 'G', '10A'], genero: 'M', nome: 'CALÇA' }]), ['P', 'M', 'G']), 'grade do kit: só os tamanhos que todas as peças têm')
  conta(igual(k.gradeDoKit([adulto, { tamanhos: [], genero: 'C', nome: 'INFANTIL' }]), []), 'grade do kit: peça adulta com peça infantil não têm tamanho em comum')
  conta(igual(k.gradeDoKit([]), []), 'grade do kit: sem peça, sem grade')

  const lista = { fichaEm: null, temDesenho: false, pecasSemTecido: 2, pecasSemEtiqueta: 2 }
  conta(k.kitEmBranco(lista) && !k.kitEmBranco({ ...lista, fichaEm: '2026-10-06' }) && !k.kitEmBranco({ ...lista, temDesenho: true }), 'kit em branco: nunca salvo e sem desenho')
  conta(k.faltasDoKit(lista) === 5 && k.faltasDoKit({ fichaEm: 'x', temDesenho: true, pecasSemTecido: 0, pecasSemEtiqueta: 0 }) === 0, 'faltas do kit: peça sem tecido, peça sem etiqueta e o desenho')

  const cima = { referenciaId: 'a', cod: 'FT-010-000M', nome: 'CAMISETA', genero: 'M', detalhes: {}, tamanhos: [], papel: 'Parte de cima', tecidos: [{ parte: 'Frente e costas', tecidoId: 't1', tecido: 'DRYFIT' }, { parte: 'Mangas', tecidoId: 't2', tecido: 'JAKAR' }], design: [{ tecnica: 'subli', onde: 'peça inteira' }, { tecnica: 'patch', onde: ' ' }], etiqueta: 'silk', etiquetaOnde: 'no decote', observacao: '' }
  const baixo = { referenciaId: 'b', cod: 'FT-090-000M', nome: 'CALÇAO', genero: 'M', detalhes: {}, tamanhos: [], papel: 'Parte de baixo', tecidos: [], design: [], etiqueta: '', etiquetaOnde: '', observacao: '' }
  const pend = k.pendenciasDoKit({ nome: 'KIT', pecas: [cima, baixo] }, false)
  conta(pend.every((x) => !x.impede) && igual(pend.map((x) => x.deQuem + ': ' + x.texto), ['Parte de cima: falta dizer onde vai Patch.', 'Parte de baixo: falta escolher o tecido.', 'Parte de baixo: falta escolher a etiqueta.', ': Falta o desenho do kit, em SVG.']), 'pendências: o que falta em cada peça e o desenho, sem impedir de salvar')
  conta(k.pendenciasDoKit({ nome: 'KIT', pecas: [{ ...cima, design: [{ tecnica: 'subli', onde: 'tudo' }] }, { ...baixo, tecidos: [{ parte: 'A peça inteira', tecidoId: 't1', tecido: 'DRYFIT' }], etiqueta: 'sem' }] }, true).length === 0, 'pendências: kit inteiro não tem nenhuma, e "sem etiqueta" é uma escolha')
  const impede = k.pendenciasDoKit({ nome: ' ', pecas: [{ ...cima, tecidos: [{ parte: 'Mangas', tecidoId: 't1', tecido: 'A' }, { parte: ' mangas ', tecidoId: 't2', tecido: 'B' }, { parte: 'Frente', tecidoId: '', tecido: '' }] }] }, true).filter((x) => x.impede)
  conta(impede.length === 4 && impede[0].texto.includes('nome') && impede[1].texto.includes('duas peças') && impede[2].texto.includes('sem a parte') && impede[3].texto.includes('dois tecidos'), 'pendências que impedem: sem nome, menos de duas peças, tecido pela metade e parte com dois tecidos')

  /* o tecido de um kit: a soma das peças, tecido por tecido, com números fáceis de conferir na mão */
  const partesDaCamiseta = [
    { nome: 'Frente', vezes: 1, unidade: 'm2', quantidades: { P: 0.3, M: 0.4 } },
    { nome: 'Costas', vezes: 1, unidade: 'm2', quantidades: { P: 0.3, M: 0.4 } },
    { nome: 'Mangas', vezes: 2, unidade: 'm2', quantidades: { P: 0.2, M: 0.25 } },
    { nome: 'Ribana', vezes: 1, unidade: 'm', quantidades: { P: 0.5, M: 0.5 } },
  ]
  const partesDoCalcao = [{ nome: 'Perna', vezes: 2, unidade: 'm2', quantidades: { P: 0.5 } }, { nome: 'Cós', vezes: 1, unidade: 'm2', quantidades: { P: 0.05 } }]
  const comFicha = [
    { papel: 'Parte de cima', nome: 'CAMISETA', tecidos: [{ parte: 'frente', tecidoId: 't1', tecido: 'DRYFIT' }, { parte: 'Costas', tecidoId: 't1', tecido: 'DRYFIT' }, { parte: 'Mangas', tecidoId: 't2', tecido: 'JAKAR' }], partes: partesDaCamiseta, materiais: [{ materialId: 'l', nome: 'Linha', quantidade: 0.1, unidade: 'cone' }, { materialId: null, nome: 'Etiqueta de composição', quantidade: 1, unidade: 'un' }] },
    { papel: 'Parte de baixo', nome: 'CALÇAO', tecidos: [{ parte: 'A peça inteira', tecidoId: 't1', tecido: 'DRYFIT' }], partes: partesDoCalcao, materiais: [{ materialId: 'l', nome: 'Linha', quantidade: 0.2, unidade: 'cone' }, { materialId: 'e', nome: 'Elástico', quantidade: 0.7, unidade: 'm' }, { materialId: null, nome: 'etiqueta de composição', quantidade: 1, unidade: 'un' }] },
  ]
  const tec = k.tecidoDoKit(comFicha, ['P', 'M', 'G'])
  conta(tec.length === 2 && tec[0].tecido === 'DRYFIT' && tec[1].tecido === 'JAKAR', 'tecido do kit: uma linha por tecido, e tecidos diferentes não se somam')
  conta(perto(tec[0].areas[0], 0.3 + 0.3 + 0.5 + 0.05) && perto(tec[0].areas[1], 0.8) && tec[0].areas[2] === null, 'tecido do kit: o dryfit no P é frente, costas e o calção inteiro (1,15); no M só a camiseta tem número (0,80); no G ninguém tem')
  conta(perto(tec[1].areas[0], 0.2) && perto(tec[1].areas[1], 0.25), 'tecido do kit: o jakar é só a manga, e a ribana em metro não entra')
  conta(tec[0].onde === 'frente e costas da parte de cima, e a parte de baixo' && tec[1].onde === 'mangas da parte de cima', 'tecido do kit: diz em palavras onde cada tecido vai')
  conta(k.tecidoDoKit([{ ...comFicha[0], tecidos: [] }], ['P']).length === 0, 'tecido do kit: peça sem tecido escolhido não entra na conta')

  const avi = k.aviamentosDoKit(comFicha)
  conta(igual(avi.map((a) => [a.nome, a.quantidade, a.unidade, a.deQuem]), [['Linha', 0.3, 'cone', 'das duas peças'], ['Etiqueta de composição', 2, 'un', 'das duas peças'], ['Elástico', 0.7, 'm', 'da parte de baixo']]), 'aviamentos do kit: o mesmo material numa linha só, somado (0,1 + 0,2 dá 0,3, e não 0,30000000000000004), e de que peça ele vem')

  const banco = k.kitParaOBanco({ nome: '  KIT  ', pecas: [{ ...cima, papel: ' Parte de cima ', observacao: ' x ' }, baixo] })
  conta(banco.nome === 'KIT' && igual(Object.keys(banco.pecas[0]).sort(), ['design', 'etiqueta', 'etiqueta_onde', 'observacao', 'papel', 'referencia_id', 'tecidos']) && igual(banco.pecas[0].tecidos[0], { parte: 'Frente e costas', tecido_id: 't1' }) && banco.pecas[0].papel === 'Parte de cima' && banco.pecas[0].observacao === 'x' && banco.pecas[0].design[1].onde === '', 'kit para o banco: só o que é do kit vai, com o texto aparado e o tecido pelo id')
  const nova = k.pecaNova({ id: 'z', cod: 'FT-1', nome: 'N', genero: 'M', detalhes: { gola: 'V' }, tamanhos: ['P'] }, 0)
  conta(nova.papel === 'Parte de cima' && k.pecaNova({ id: 'z', cod: '', nome: '', genero: '', detalhes: {}, tamanhos: [] }, 1).papel === 'Parte de baixo' && k.papelDaPosicao(5) === 'Acessório' && nova.etiqueta === '' && nova.tecidos.length === 0, 'peça nova: a primeira é a parte de cima, a segunda a de baixo, as outras acessório, com a ficha em branco')
}

/* ==========================================================================
   O MOLDE MEDIDO: as partes, a escala e o zoom
   ========================================================================== */
{
  console.log('')
  console.log('O molde medido')
  conta(igual(['Frente', 'FRENTE', 'costas', 'Manga_2', 'Manga1', 'Manga 3', 'gola-ribana', 'Bolso_x28_esq_x29_', 'Frente e Costas'].map(o.nomeDaParteNoMolde), ['Frente', 'Frente', 'Costas', 'Manga', 'Manga', 'Manga', 'Gola ribana', 'Bolso(esq)', 'Frente e Costas']), 'nome da parte: a camada do Affinity vira nome, sem o número que o programa põe e sem gritar em maiúscula')
  conta(igual(['', 'path12', 'g3', 'Layer_1', 'Camada 2', 'rect', 'Curve', 'Artboard1', '  '].map(o.nomeDaParteNoMolde), ['', '', '', '', '', '', '', '', '']), 'nome da parte: o nome que o programa inventa sozinho não é nome')

  /* um molde de camiseta num quadro de 1000 por 600: fundo, frente com um bolso e o nome escrito dentro, costas, duas mangas, uma parte sem nome e um pique */
  const quadro = { x: 0, y: 0, w: 1000, h: 600 }
  const caixas = [
    { id: '', x: 0, y: 0, w: 1000, h: 600, retangulo: true },
    { id: 'Frente', x: 40, y: 40, w: 220, h: 294, retangulo: false },
    { id: 'Bolso', x: 100, y: 90, w: 50, h: 50, retangulo: true },
    { id: 'path77', x: 110, y: 200, w: 80, h: 14, retangulo: false },
    { id: 'COSTAS', x: 300, y: 40, w: 220, h: 300, retangulo: false },
    { id: 'Manga', x: 560, y: 40, w: 176, h: 98, retangulo: false },
    { id: 'Manga1', x: 560, y: 180, w: 178, h: 96, retangulo: false },
    { id: '', x: 780, y: 40, w: 192, h: 18, retangulo: true },
    { id: 'pique', x: 40, y: 500, w: 30, h: 0.5, retangulo: false },
  ]
  const molde = { quadro, largura: '', altura: '', caixas }
  const partes = o.partesNoMolde(molde)
  conta(igual(partes.map((x) => [x.nome, x.vezes, x.largura, x.altura]), [['Frente', 1, 220, 294], ['Costas', 1, 220, 300], ['Manga', 2, 178, 98], ['Parte 1', 1, 192, 18]]), 'partes do molde: o fundo da prancha, o bolso e o nome dentro da frente e o pique solto não são partes; as duas mangas são uma, duas vezes, com a maior largura e a maior altura')
  conta(partes[2].caixas.length === 2 && partes[2].chave === 'manga' && partes[3].chave === 'sem-nome-1', 'partes do molde: a manga guarda as duas caixas dela, e a parte sem nome ganha um número')
  conta(o.partesNoMolde({ quadro, largura: '', altura: '', caixas: [{ id: 'Fundo', x: 0, y: 0, w: 1000, h: 600, retangulo: true }, { id: 'Bolso', x: 100, y: 90, w: 50, h: 50, retangulo: true }] }).map((x) => x.nome).join() === 'Fundo', 'partes do molde: um retângulo COM nome do tamanho do quadro é parte (uma faixa, um pano inteiro), e o que está dentro dele é detalhe')
  conta(o.partesNoMolde({ quadro, largura: '', altura: '', caixas: [] }).length === 0, 'partes do molde: desenho sem nada medido não tem parte')
  conta(o.partesNoMolde({ quadro, largura: '', altura: '', caixas: [{ id: 'A', x: 0, y: 0, w: 100, h: 100, retangulo: false }, { id: 'B', x: 60, y: 60, w: 100, h: 100, retangulo: false }] }).length === 2, 'partes do molde: duas caixas que só se cruzam são duas partes')

  conta(igual(o.partesNoMolde({ quadro, largura: '', altura: '', caixas: [{ id: 'Manga', x: 10, y: 10, w: 100, h: 60, retangulo: false }, { id: 'Manga1', x: 10, y: 10, w: 100, h: 60, retangulo: false }] }).map((x) => [x.nome, x.vezes]), [['Manga', 2]]), 'partes do molde: duas partes iguais, uma em cima da outra no arquivo, não somem uma dentro da outra')
  const daFicha = [{ nome: 'Frente', vezes: 1, unidade: 'm2', quantidades: {} }, { nome: 'Mangas', vezes: 4, unidade: 'm2', quantidades: {} }, { nome: 'Costas', vezes: 3, unidade: 'm', quantidades: {} }]
  conta(o.vezesDaParte(partes[2], daFicha) === 4 && o.vezesDaParte(partes[2], []) === 2 && o.vezesDaParte(partes[1], daFicha) === 1, 'vezes da parte: vale a ficha ("Manga" do desenho é "Mangas" da ficha), sem ficha vale o desenho, e a fita com o mesmo nome não conta')

  /* a escala */
  conta(perto(o.escalaDoArquivo({ quadro, largura: '500mm', altura: '300mm', caixas: [] }), 0.05) && perto(o.escalaDoArquivo({ quadro, largura: '25cm', altura: '', caixas: [] }), 0.025) && perto(o.escalaDoArquivo({ quadro, largura: '10in', altura: '', caixas: [] }), 0.0254) && perto(o.escalaDoArquivo({ quadro, largura: '720pt', altura: '', caixas: [] }), 0.0254) && perto(o.escalaDoArquivo({ quadro, largura: '', altura: '60 cm', caixas: [] }), 0.1), 'escala do arquivo: milímetro, centímetro, polegada e ponto dizem o tamanho, e sem a largura vale a altura')
  conta([['1000px', '600px'], ['100%', '100%'], ['1000', '600'], ['', ''], ['0mm', '']].every(([l, a]) => o.escalaDoArquivo({ quadro, largura: l, altura: a, caixas: [] }) === null), 'escala do arquivo: pixel, porcento, número solto e zero não dizem tamanho nenhum')
  conta(igual(o.escalaDoMolde(0.25, { quadro, largura: '500mm', altura: '', caixas: [] }), { cmPorUnidade: 0.25, origem: 'acertada' }) && o.escalaDoMolde(null, { quadro, largura: '500mm', altura: '', caixas: [] }).origem === 'arquivo' && igual(o.escalaDoMolde(null, molde), { cmPorUnidade: null, origem: '' }) && o.escalaDoMolde(0, molde).origem === '', 'escala que vale: a acertada à mão ganha da do arquivo, e sem nenhuma não há centímetro')
  conta(perto(o.escalaPelaMedida(220, 55), 0.25) && o.escalaPelaMedida(0, 55) === null && o.escalaPelaMedida(220, 0) === null && o.escalaPelaMedida(220, NaN) === null && o.escalaPelaMedida(220, Infinity) === null, 'acertar a escala: 220 unidades que medem 55 cm dão 0,25 cm por unidade; zero e número torto não acertam nada')
  conta(o.medidaDoMolde(220, 0.25) === '55,0' && o.medidaDoMolde(294, 0.25) === '73,5' && o.medidaDoMolde(178, 0.2471) === '44,0' && o.medidaDoMolde(220, null) === '220,0' && o.medidaDoMolde(4800, 0.25) === '1.200,0', 'a medida na tela: uma casa, com vírgula; sem escala é o número do desenho')
  conta(igual(o.reguaDoMolde(0.25, 1000), { cm: 20, unidades: 80 }) && igual(o.reguaDoMolde(0.05, 1000), { cm: 5, unidades: 100 }) && o.reguaDoMolde(null, 1000) === null && o.reguaDoMolde(0.0001, 1000) === null, 'a régua do canto: o maior comprimento redondo que cabe num sexto do desenho (250 cm de largura dá 20 cm), e sem escala não há régua')

  /* a vista */
  const v = o.encaixar(quadro, { w: 1128, h: 700 }, 64)
  conta(perto(v.z, 0.9533333333, 1e-6) && perto(v.x + 500 * v.z, 564, 1e-6) && perto(v.y + 300 * v.z, 350, 1e-6), 'encaixar: o desenho inteiro cabe com a folga, e o meio dele cai no meio do palco (a altura é que manda aqui)')
  const deslocado = o.encaixar({ x: 100, y: 50, w: 200, h: 100 }, { w: 528, h: 328 }, 64)
  conta(perto(deslocado.z, 2) && perto(deslocado.x + 100 * deslocado.z, 64) && perto(deslocado.y + 50 * deslocado.z, 64), 'encaixar: quadro que não começa no zero também fica no lugar')
  const perto2 = o.aproximar(v, 2, { x: 300, y: 200 }, v.z)
  const antes = { ux: (300 - v.x) / v.z, uy: (200 - v.y) / v.z }
  conta(perto(perto2.z, v.z * 2) && perto(perto2.x + antes.ux * perto2.z, 300, 1e-6) && perto(perto2.y + antes.uy * perto2.z, 200, 1e-6) && o.zoomEmPorcento(perto2, v.z) === 200, 'aproximar: dobra o zoom e o ponto debaixo do cursor não sai do lugar')
  conta(perto(o.aproximar(v, 100, { x: 0, y: 0 }, v.z).z, v.z * 8) && perto(o.aproximar(v, 0.001, { x: 0, y: 0 }, v.z).z, v.z * 0.25) && o.zoomEmPorcento(v, v.z) === 100, 'aproximar: para em 8 vezes e em um quarto do encaixe')
  conta(o.parteNoPonto(partes, 60, 60) === 'frente' && o.parteNoPonto(partes, 600, 200) === 'manga' && o.parteNoPonto(partes, 900, 400) === null && o.parteNoPonto([{ chave: 'a', nome: 'A', vezes: 1, largura: 0, altura: 0, caixas: [{ x: 0, y: 0, w: 100, h: 100 }] }, { chave: 'b', nome: 'B', vezes: 1, largura: 0, altura: 0, caixas: [{ x: 60, y: 60, w: 20, h: 20 }] }], 70, 70) === 'b', 'parte no ponto: a que está debaixo do clique, e entre duas sobrepostas a menor')
}

/* ---- o movimento e as vendas (migração 053) ---------------------------------
   As datas são escritas NA HORA DE QUEM ESTÁ OLHANDO (new Date(ano, mês, dia)),
   e não em UTC: assim a conferência dá o mesmo em qualquer fuso. Os números
   esperados foram somados à mão, layout por layout, no comentário de cada caso. */
{
  const em = (mes, dia, hora = 12, min = 0) => new Date(2026, mes - 1, dia, hora, min).toISOString()
  const ETAPAS = ['corte', 'subli', 'dtf', 'prensa', 'silk', 'bordado', 'calandra', 'futurize', 'conferencia', 'cd-costura', 'costura', 'embalagem', 'finalizado']
  const KITS = { kitA: [{ referenciaId: 'cam', cod: 'FT-010-000M', nome: 'CAMISETA MASC TRAD' }, { referenciaId: 'cal', cod: 'FT-090-000M', nome: 'CALÇAO MASC SEM BOLSO' }] }
  const soma = (g) => Object.values(g).reduce((a, n) => a + n, 0)
  const L = (ped, ordem, o2) => ({
    pedidoId: ped.id, numero: ped.numero, cliente: ped.cliente, estado: ped.estado, etapa: ped.etapa ?? 'corte', etapaEm: ped.etapaEm ?? '',
    aprovadoEm: ped.aprovadoEm, fechadoEm: ped.fechadoEm ?? '', teste: false, ordem, layout: o2.layout ?? ordem,
    referencia: o2.cod ?? '', nome: o2.nome, arte: o2.arte ?? '', grade: o2.grade, pecas: soma(o2.grade), tecnicas: o2.tecnicas ?? [],
    referenciaId: o2.id ?? null, kit: !!o2.kit,
  })
  const CAM = { id: 'cam', cod: 'FT-010-000M', nome: 'CAMISETA MASC TRAD' }
  const INF = { id: 'inf', cod: 'FT-010-008C', nome: 'CAMISETA INFANTIL UNISSEX' }
  const KIT = { id: 'kitA', cod: 'FT-KIT-010-000M-090-000M', nome: 'KIT CAMISETA E CALÇAO', kit: true }

  const P1 = { id: 'p1', numero: 'PD-0412', cliente: 'Atlético Exemplo', estado: 'producao', etapa: 'costura', etapaEm: em(10, 4, 9), aprovadoEm: em(9, 20) }
  const P2 = { id: 'p2', numero: 'PD-0409', cliente: 'Escola Exemplo', estado: 'pronto', etapa: 'finalizado', etapaEm: em(10, 5, 16, 42), aprovadoEm: em(10, 2), fechadoEm: em(10, 5, 16, 42) }
  const P3 = { id: 'p3', numero: 'PD-0390', cliente: 'Clube Exemplo', estado: 'pronto', etapa: 'finalizado', etapaEm: em(9, 28), aprovadoEm: em(9, 3), fechadoEm: em(9, 28) }
  const P4 = { id: 'p4', numero: 'PD-0420', cliente: 'Academia Exemplo', estado: 'producao', etapa: 'corte', etapaEm: em(10, 3), aprovadoEm: em(10, 3, 8) }
  const P5 = { id: 'p5', numero: 'PD-0421', cliente: 'Auto Peças Exemplo', estado: 'pcp', aprovadoEm: em(10, 5) }
  const P6 = { id: 'p6', numero: 'PD-0388', cliente: 'Pelada Exemplo', estado: 'producao', etapa: 'prensa', etapaEm: em(10, 2), aprovadoEm: em(8, 30) }
  const P7 = { id: 'p7', numero: 'PD-0422', cliente: 'Escolinha Exemplo', estado: 'aprovado', aprovadoEm: em(10, 4) }
  const P8 = { id: 'p8', numero: 'PD-0400', cliente: 'Loja Exemplo', estado: 'separacao', aprovadoEm: em(9, 10) }

  const layouts = [
    L(P1, 1, { ...KIT, arte: 'linha', grade: { P: 10, M: 32, G: 30, GG: 14, XG: 3 }, tecnicas: ['subli', 'patch'] }), // 89 kits, 178 peças
    L(P1, 2, { ...CAM, arte: 'goleiro', grade: { M: 2, G: 4, GG: 2 }, tecnicas: ['subli'] }), // 8
    L(P1, 3, { ...CAM, arte: 'comissão', grade: { P: 20, M: 48, G: 44, GG: 24, XG: 7 }, tecnicas: ['dtf'] }), // 143
    L(P2, 1, { ...INF, arte: 'uniforme', grade: { '4A': 8, '6A': 14, '8A': 18, '10A': 14, '12A': 10 }, tecnicas: ['silk'] }), // 64
    L(P3, 1, { ...CAM, grade: { M: 50 }, tecnicas: ['subli'] }), // 50
    L(P4, 1, { nome: 'PEÇA LISA', grade: { M: 20 } }), // 20, fora do catálogo e sem técnica
    L(P5, 1, { ...CAM, grade: { P: 10, GG: 20 }, tecnicas: ['subli'] }), // 30, ainda no PCP
    L(P6, 1, { ...CAM, grade: { G: 25 }, tecnicas: ['subli'] }), // 25
    L(P6, 2, { ...CAM, grade: { G: 40 }, tecnicas: ['dtf', 'bordado'] }), // 40
    L(P7, 1, { ...KIT, grade: { M: 10 } }), // 10 kits, 20 peças
    L(P8, 1, { ...CAM, grade: { G: 100 }, tecnicas: ['subli'] }), // 100
  ]
  const F = (ped, tecnica, etapa, quando, quais, fechou = '') => ({ pedidoId: ped.id, tecnica, etapa, etapaEm: quando, fechadoEm: fechou, layouts: quais })
  const fatias = [
    F(P1, 'subli', 'finalizado', em(10, 6, 14, 10), [1, 2], em(10, 6, 14, 10)),
    F(P1, 'patch', 'finalizado', em(10, 5, 11), [1], em(10, 5, 11)),
    F(P1, 'dtf', 'costura', em(10, 4, 9), [3]),
    F(P2, 'silk', 'finalizado', em(10, 5, 16, 40), [1], em(10, 5, 16, 40)),
    F(P6, 'subli', 'finalizado', em(9, 30, 10), [1], em(9, 30, 10)),
    F(P6, 'dtf', 'prensa', em(10, 2), [2]),
    F(P6, 'bordado', 'bordado', em(10, 1), [2]),
  ]

  /* o mês de quem olha */
  conta(v.mesDe(new Date(2026, 9, 31, 23, 30).toISOString()) === '2026-10' && v.mesDe(new Date(2026, 10, 1, 0, 10).toISOString()) === '2026-11' && v.mesDe('') === '' && v.mesDe('lixo') === '', 'o mês de um instante: onze e meia da noite do dia 31 ainda é outubro para quem está olhando; sem data, sem mês')
  conta(v.pecasDoLayout(layouts[0], KITS) === 178 && v.pecasDoLayout(layouts[1], KITS) === 8 && v.pecasDoLayout(layouts[0], {}) === 89 && v.pecasDoLayout({ ...layouts[0], referenciaId: null }, KITS) === 89, 'peças do layout: 89 kits de duas peças são 178 peças de roupa; kit sem peça cadastrada conta uma por kit')

  /* a situação de cada layout */
  const sit = (l, fs = fatias) => v.situacaoDoLayout(l, fs, ETAPAS)
  conta(igual(sit(layouts[0]), { pronto: true, etapa: 'finalizado', em: em(10, 6, 14, 10) }), 'situação: layout com duas técnicas fechadas está pronto, no dia da ÚLTIMA que fechou')
  conta(igual(sit(layouts[2]), { pronto: false, etapa: 'costura', em: em(10, 4, 9) }), 'situação: no mesmo pedido, o layout de outra técnica continua na costura')
  conta(igual(sit(layouts[8]), { pronto: false, etapa: 'prensa', em: em(10, 2) }), 'situação: com duas fatias abertas, quem segura é a do posto que vem antes na fábrica (prensa antes de bordado)')
  conta(sit(layouts[8], [F(P6, 'dtf', 'costura', em(10, 2), [2]), F(P6, 'bordado', 'costura', em(10, 1), [2])]).em === em(10, 1), 'situação: no mesmo posto, quem segura é a que está parada há mais tempo')
  conta(igual(sit(layouts[5]), { pronto: false, etapa: 'corte', em: em(10, 3) }) && sit({ ...layouts[5], etapa: 'finalizado' }).pronto, 'situação: peça lisa não tem fatia, e vale o posto do pedido')
  conta(igual(sit(layouts[4]), { pronto: true, etapa: 'finalizado', em: em(9, 28) }), 'situação: pedido finalizado sem fatia lida fica pronto no dia do pedido')
  conta(igual(sit(layouts[3]), { pronto: true, etapa: 'finalizado', em: em(10, 5, 16, 40) }), 'situação: pedido finalizado com a fatia fechada fica pronto no dia da fatia')
  conta(igual(sit(layouts[3], [F(P2, 'silk', 'costura', em(10, 5), [1])]), { pronto: true, etapa: 'finalizado', em: em(10, 5, 16, 42) }), 'situação: pedido finalizado à mão com fatia esquecida aberta está pronto, no dia do pedido')
  conta(sit(layouts[3], [F(P2, 'silk', 'finalizado', em(10, 1), [1], em(10, 1)), F(P2, 'dtf', 'costura', em(10, 5), [1])]).em === em(10, 5, 16, 42), 'situação: pedido finalizado com uma fatia fechada e outra esquecida aberta vale o dia do pedido, e não o da fatia que fechou antes')
  conta(['enviado', 'entregue'].every((estado) => igual(sit({ ...layouts[4], estado }), { pronto: true, etapa: 'finalizado', em: em(9, 28) })) && v.passouPelaFabrica('enviado') && v.passouPelaFabrica('entregue') && v.passouPelaFabrica('producao') && !v.passouPelaFabrica('pcp') && !v.passouPelaFabrica('cancelado'), 'situação: o pedido que já foi enviado ou entregue continua pronto, no dia em que ficou pronto')
  conta(igual(sit(layouts[6]), { pronto: false, etapa: '', em: '' }) && igual(sit(layouts[9]), { pronto: false, etapa: '', em: '' }), 'situação: pedido que ainda não entrou na produção não tem posto')
  conta(sit(layouts[1], [F(P6, 'subli', 'corte', em(10, 1), [2]), ...fatias]).pronto, 'situação: a fatia de outro pedido com o mesmo número de layout não conta')

  /* o movimento do mês */
  const linhas = v.linhasDaFabrica(layouts, fatias, KITS, ETAPAS)
  conta(linhas.length === 8 && !linhas.some((x) => ['p5', 'p7', 'p8'].includes(x.l.pedidoId)), 'movimento: só entra o que está ou esteve na fábrica (PCP, separação e aprovado ficam de fora)')
  conta(v.linhasDaFabrica(layouts.map((l) => (l.pedidoId === 'p3' ? { ...l, estado: 'entregue' } : l.pedidoId === 'p2' ? { ...l, estado: 'enviado' } : l)), fatias, KITS, ETAPAS).filter((x) => x.pronto).length === 5, 'movimento: o pedido enviado e o entregue continuam no movimento, como peça pronta')
  const out = v.movimentoDoMes(linhas, '2026-10', '2026-10')
  conta(igual(out.pedidos.map((g) => [g.numero, g.pecasDeRoupa, g.emProducao, g.linhas.length]), [['PD-0412', 329, true, 3], ['PD-0409', 64, false, 1], ['PD-0420', 20, true, 1], ['PD-0388', 40, true, 1]]), 'movimento de outubro: quatro orçamentos, do mais novo para o mais velho, e o PD-0388 só com o layout que ainda está na fábrica')
  conta(out.pecasFeitas === 250 && out.orcamentosComPecaFeita === 2 && out.kitsFeitos === 89, 'movimento de outubro: 178 + 8 + 64 = 250 peças feitas, em 2 orçamentos, 89 kits')
  conta(out.pecasEmProducao === 203 && out.orcamentosEmProducao === 3, 'movimento: 143 + 20 + 40 = 203 peças na fábrica agora, em 3 orçamentos')
  conta(out.pedidos[0].quando === em(10, 6, 14, 10) && igual(out.pedidos[0].linhas.map((x) => x.l.ordem), [1, 2, 3]), 'movimento: o orçamento fica com a hora da linha mais nova, e as linhas na ordem do orçamento')
  const set = v.movimentoDoMes(linhas, '2026-09', '2026-10')
  conta(igual(set.pedidos.map((g) => [g.numero, g.pecasDeRoupa, g.emProducao]), [['PD-0388', 25, false], ['PD-0390', 50, false]]) && set.pecasFeitas === 75 && set.kitsFeitos === 0, 'movimento de setembro: só o que ficou pronto nele (25 + 50), e nada do que está na fábrica hoje')
  conta(set.pecasEmProducao === 203 && set.orcamentosEmProducao === 3, 'movimento: "em produção agora" não muda com o mês escolhido')
  conta(v.movimentoDoMes(linhas, '2026-07', '2026-10').pedidos.length === 0, 'movimento: mês sem nada pronto vem vazio')
  conta(igual(v.ultimasFeitas(linhas, 4).map((x) => [x.l.numero, x.l.ordem]), [['PD-0412', 1], ['PD-0412', 2], ['PD-0409', 1], ['PD-0388', 1]]), 'últimas peças feitas: da mais nova para a mais velha, atravessando os meses')
  conta(igual(v.movimentoPorReferencia(out.pedidos).map((r) => [r.nome, r.unidades, r.orcamentos, r.kit]), [['CAMISETA MASC TRAD', 191, 2, false], ['KIT CAMISETA E CALÇAO', 89, 1, true], ['CAMISETA INFANTIL UNISSEX', 64, 1, false], ['PEÇA LISA', 20, 1, false]]), 'movimento por referência: as mesmas linhas juntas pela peça (8 + 143 + 40 = 191 em 2 orçamentos), e o kit em kits')
  conta(v.casaComOMovimento(linhas[0], 'calcao') && v.casaComOMovimento(linhas[0], 'CALÇÃO') && v.casaComOMovimento(linhas[3], 'pd-0409') && v.casaComOMovimento(linhas[3], 'ESCOLA') && v.casaComOMovimento(linhas[1], '010-000') && v.casaComOMovimento(linhas[1], 'goleiro') && !v.casaComOMovimento(linhas[1], 'xyz') && v.casaComOMovimento(linhas[1], '  '), 'busca no movimento: pela peça sem acento, pelo código, pelo pedido, pelo cliente e pela arte')

  /* as janelas */
  const hoje = new Date(2026, 9, 6, 15, 0)
  const iso = (a, m, d) => new Date(a, m - 1, d).toISOString()
  const j1 = v.janelasDoPeriodo(1, hoje)
  conta(igual(j1.atual, { de: iso(2026, 10, 1), ate: iso(2026, 10, 7) }) && igual(j1.anterior, { de: iso(2026, 9, 1), ate: iso(2026, 9, 7) }) && igual(j1.meses, ['2026-10']) && igual(j1.mesesAntes, ['2026-09']), 'janela de 1 mês no dia 6: de 1 a 6 de outubro, contra de 1 a 6 de setembro')
  const j3 = v.janelasDoPeriodo(3, hoje)
  conta(igual(j3.atual, { de: iso(2026, 8, 1), ate: iso(2026, 10, 7) }) && igual(j3.anterior, { de: iso(2026, 5, 1), ate: iso(2026, 7, 7) }) && igual(j3.meses, ['2026-08', '2026-09', '2026-10']) && igual(j3.mesesAntes, ['2026-05', '2026-06', '2026-07']), 'janela de 3 meses: de agosto até hoje, contra de maio até 6 de julho')
  const j12 = v.janelasDoPeriodo(12, hoje)
  conta(j12.atual.de === iso(2025, 11, 1) && igual(j12.anterior, { de: iso(2024, 11, 1), ate: iso(2025, 10, 7) }) && j12.meses.length === 12 && j12.mesesAntes[0] === '2024-11', 'janela de 1 ano: atravessa a virada do ano, para trás duas vezes')
  conta(igual(v.janelasDoPeriodo(1, new Date(2026, 2, 31, 9)).anterior, { de: iso(2026, 2, 1), ate: iso(2026, 3, 1) }), 'janela no dia 31 de março: o mês anterior acaba no dia 28 de fevereiro, e não invade março')
  conta(v.periodoEmPalavras(j1.meses) === 'em outubro' && v.periodoEmPalavras(j3.meses) === 'de agosto a outubro' && v.comparacaoEmPalavras(j1.mesesAntes) === 'contra setembro' && v.comparacaoEmPalavras(j3.mesesAntes) === 'contra o anterior', 'o período em palavras')
  conta(v.rumoDe(105, 100) === 'igual' && v.rumoDe(106, 100) === 'subiu' && v.rumoDe(95, 100) === 'igual' && v.rumoDe(94, 100) === 'caiu' && v.rumoDe(0, 0) === 'igual' && v.rumoDe(1, 0) === 'subiu' && v.rumoDe(0, 1) === 'caiu', 'subiu, igual ou caiu: até 5% de diferença é igual')

  /* as vendas: vale o dia em que o orçamento foi aprovado, e entra o que ainda nem foi para a fábrica */
  conta(v.pecasVendidas(layouts, KITS, j1.atual) === 134 && v.pecasVendidas(layouts, KITS, j1.anterior) === 50 && v.pecasVendidas(layouts, KITS, j3.atual) === 678, 'peças vendidas: 64 + 20 + 30 + 20 = 134 em outubro; de 1 a 6 de setembro só as 50 do dia 3; em 3 meses, 678')
  const r1 = v.rankingDeReferencias(layouts, KITS, j1.atual, j1.anterior)
  conta(igual(r1.map((x) => [x.nome, x.quanto, x.orcamentos, x.antes, x.rumo]), [['CAMISETA INFANTIL UNISSEX', 64, 1, 0, 'subiu'], ['CAMISETA MASC TRAD', 40, 2, 50, 'caiu'], ['PEÇA LISA', 20, 1, 0, 'subiu'], ['CALÇAO MASC SEM BOLSO', 10, 1, 0, 'subiu']]), 'ranking de outubro: a camiseta soma a venda solta (30) e a de dentro do kit (10), em 2 orçamentos, e caiu contra as 50 do mesmo trecho de setembro')
  conta(perto(r1[0].parte, 64 / 134) && perto(r1.reduce((a, x) => a + x.parte, 0), 1) && r1[2].referenciaId === null && r1[2].chave === 'fora:PEÇA LISA' && r1[3].referenciaId === 'cal' && r1[3].cod === 'FT-090-000M', 'ranking: as partes somam o total; a peça fora do catálogo fica com o nome do orçamento, e a de dentro do kit com o código dela')
  const r3 = v.rankingDeReferencias(layouts, KITS, j3.atual, j3.anterior)
  conta(igual(r3.map((x) => [x.cod || x.nome, x.quanto]), [['FT-010-000M', 495], ['FT-090-000M', 99], ['FT-010-008C', 64], ['PEÇA LISA', 20]]), 'ranking de 3 meses: camiseta 40 + 390 + 65 = 495, calção 10 + 89 = 99')
  conta(igual(v.rankingDeReferencias(layouts, {}, j1.atual).map((x) => [x.nome, x.quanto]), [['CAMISETA INFANTIL UNISSEX', 64], ['CAMISETA MASC TRAD', 30], ['PEÇA LISA', 20], ['KIT CAMISETA E CALÇAO', 10]]), 'ranking: kit sem peça cadastrada entra com o próprio nome, e nada some da conta')
  conta(igual(v.rankingDeKits(layouts, j1.atual, j1.anterior).map((x) => [x.nome, x.quanto, x.orcamentos, x.antes, x.rumo]), [['KIT CAMISETA E CALÇAO', 10, 1, 0, 'subiu']]) && v.rankingDeKits(layouts, j3.atual)[0].quanto === 99, 'ranking dos kits: em kits, e não em peças (10 em outubro, 99 em 3 meses)')
  conta(igual(v.tamanhosVendidos(layouts, KITS, j1.atual).map((t) => [t.tamanho, t.pecas]), [['P', 10], ['M', 40], ['G', 0], ['GG', 20], ['4A', 8], ['6A', 14], ['8A', 18], ['10A', 14], ['12A', 10]]), 'tamanhos de outubro: o M do kit conta dobrado (20 + 20), o G que não saiu aparece com zero no meio da grade, e o infantil vem depois')
  conta(perto(v.tamanhosVendidos(layouts, KITS, j1.atual).reduce((a, t) => a + t.parte, 0), 1) && v.tamanhosVendidos([], KITS, j1.atual).length === 0, 'tamanhos: as partes somam o total, e sem venda não há tamanho')
  conta(igual(v.vendaMesAMes(layouts, KITS, hoje).map((m) => [m.mes, m.pecas, m.corrente]), [['2026-05', 0, false], ['2026-06', 0, false], ['2026-07', 0, false], ['2026-08', 65, false], ['2026-09', 479, false], ['2026-10', 134, true]]), 'mês a mês: seis meses, setembro com 329 + 50 + 100 = 479, e outubro marcado como o que está correndo')
  conta(v.orcamentosCom(layouts, 'kitA', j3.atual) === 2 && v.orcamentosCom(layouts, 'kitA', j1.atual) === 1 && v.orcamentosCom(layouts, 'cam', j1.atual) === 1, 'em quantos orçamentos saiu: o kit em 2 nos 3 meses; a camiseta solta em 1 em outubro')
  conta(igual(v.ultimosOrcamentosCom(layouts, 'kitA', 4).map((x) => [x.numero, x.unidades, x.estado]), [['PD-0422', 10, 'aprovado'], ['PD-0412', 89, 'producao']]) && v.ultimosOrcamentosCom(layouts, 'cam', 2).length === 2 && v.ultimosOrcamentosCom(layouts, 'cam', 9).find((x) => x.numero === 'PD-0388').unidades === 65, 'últimos orçamentos com o kit: do mais novo para o mais velho, e dois layouts da mesma peça no pedido somam (25 + 40)')
}

console.log('')
console.log(ruins ? ruins + ' conta(s) erradas na ficha técnica' : 'contas da ficha técnica ok')
process.exit(ruins ? 1 : 0)
