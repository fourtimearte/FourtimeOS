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

console.log('')
console.log(ruins ? ruins + ' conta(s) erradas na ficha técnica' : 'contas da ficha técnica ok')
process.exit(ruins ? 1 : 0)
