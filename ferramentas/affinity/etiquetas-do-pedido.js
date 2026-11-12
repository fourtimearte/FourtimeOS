'use strict';
// ETIQUETAS DO PEDIDO v3
//
// Monta as etiquetas de composicao de um pedido a partir do JSON "PEDIDO
// INTEIRO" do editor V4 (botao Copiar do HTML do Trello, formato
// FOURTIME_DTF, tecnica PEDIDO).
//
// Tudo o que o script usa mora NESTE documento, nas pranchetas:
//   ETIQUETA BASE   o desenho da etiqueta (alinhamentos e tamanhos certos)
//   TECIDOS         uma linha "NOME DO TECIDO = COMPOSICAO" por tecido, e ao
//                   lado o texto "CUIDADOS DE <NOME>" com os codigos dos
//                   simbolos, ex.: "CUIDADOS: lavar-30 nao-alvejar varal"
//   CUIDADOS        os 38 simbolos, cada um com o codigo no nome da camada
//   GENEROS         "GENERO MASCULINO" e "GENERO feminino"
//   GRADE TAMANHOS  os tamanhos (so para conferir a grade)
// Nada vem do Fourtime OS na hora de rodar: para mudar os cuidados de um
// tecido, edite o texto "CUIDADOS DE <NOME>" na prancheta TECIDOS.
//
// Cria UMA prancheta "ETQ <pedido>", a direita das que ja existem, no
// mesmo modelo da prancheta DTF ORGANIZADO, que o script do gang sheet le:
// uma fileira por etiqueta, em tres colunas, nesta ordem:
//   LAYOUT       texto "L1"  (camada "L1 TAG")
//   QUANTIDADE   texto "5x"  (camada "L1 QTD")
//   ARTE         a etiqueta, num grupo "L1-PP"
// As fileiras seguem a ordem dos layouts e, dentro do layout, a da grade,
// com 10 cm entre elas. Rodar de novo para o mesmo pedido apaga a prancheta
// antiga.
//
// A ETIQUETA BASE precisa ter o desenho dentro de UM grupo (Ctrl+G).
//
// Regras do desenho:
//   composicao        de canto a canto
//   simbolos          de canto a canto, com o mesmo vao entre eles
//   tamanho           sempre no mesmo lugar, preso pela esquerda
//   genero            preso na parede direita; sem genero no JSON, vale o
//                     FEM, MASC ou INF da referencia; infantil: sem simbolo

const { Document } = require('/document.js');
const { AddChildNodesCommandBuilder } = require('/commands.js');
const { ArtTextNodeDefinition } = require('/nodes.js');
const { StoryBuilder } = require('/storybuilder.js');
const { GlyphAttDoubleType } = require('/glyphatts.js');
const { FontFamily } = require('/fonts.js');
const { FillDescriptor } = require('/fills.js');
const { Colour } = require('/colours.js');
const { Selection, TextSelection } = require('/selections.js');
const { DocumentCommand, NodeMoveType, NodeChildType } = require('/commands.js');
const { Transform, Rectangle } = require('/geometry.js');
const { Dialog, DialogResult } = require('/dialog.js');
const { app } = require('/application.js');

const TITULO = 'Etiquetas do pedido v3';
const VAO_PRANCHETAS_MM = 100;      // da prancheta nova para as que ja existem
/* o modelo da prancheta DTF ORGANIZADO, medido nela (12/11/2026), em mm a
   partir do canto de cima-esquerda da prancheta */
const COL_LAYOUT_MM = 300;          // texto "L1"
const COL_QTD_MM = 736;             // texto "22x"
const COL_ARTE_MM = 1088;           // a arte
const MARGEM_MM = 300;              // em cima, embaixo e a direita da arte
const VAO_FILEIRAS_MM = 100;        // entre uma fileira e a outra
const FONTE_TEXTO = 'Montserrat-Bold';
const ALTURA_FONTE_MM = 120;        // 340 pt, como no DTF ORGANIZADO
const COR_TEXTO = { r: 198, g: 22, b: 27, alpha: 255 };
const VAO_MINIMO_SIMBOLOS_MM = 1;   // se os simbolos nao couberem, encolhem
const ALTURA_MAX_COMPOSICAO = 1.25; // o texto curto estica na largura, nao na altura
const ORDEM_TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', 'G4',
  '2A', '4A', '6A', '8A', '10A', '12A', '14A'];

function aviso(msg) { try { app.alert(msg, TITULO); } catch (e) { console.log(msg); } }

// ---------- leitura do documento --------------------------------------------
const ACENTOS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
function chave(s) {
  return String(s || '').normalize('NFD').replace(ACENTOS, '').toUpperCase()
    .replace(/\bC\s*\/\s*/g, 'COM ')
    .replace(/[^A-Z0-9%]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const texto = n => { try { return (n.storyInterface && n.storyInterface.text) || ''; } catch (e) { return ''; } };
const nome = n => (n && n.userDescription) || '';
const ehPrancheta = n => !!(n.artboardInterface && n.artboardInterface.isArtboardEnabled);
const caixa = n => n.exactSpreadBaseBox;

function todos(n, lista) {
  lista = lista || [];
  for (const c of n.children) { lista.push(c); if (c.children && c.children.length) todos(c, lista); }
  return lista;
}

function lerDocumento(doc) {
  const spread = doc.currentSpread || [...doc.spreads][0];
  const pranchetas = [...spread.children].filter(ehPrancheta);
  const achar = nomeP => pranchetas.find(p => chave(nome(p)) === chave(nomeP));
  const P = {
    base: achar('ETIQUETA BASE'), cuidados: achar('CUIDADOS'), generos: achar('GENEROS'),
    tecidos: achar('TECIDOS'), grade: achar('GRADE TAMANHOS'),
  };
  const faltam = Object.entries(P).filter(([, v]) => !v).map(([k]) => k);
  if (faltam.length) throw new Error('Nao achei as pranchetas: ' + faltam.join(', ') + '. Use o documento ETIQUETA SUPERE SPORTS.');

  // os simbolos: camada com o codigo no nome
  const simbolos = new Map();
  for (const n of todos(P.cuidados)) {
    const c = nome(n);
    if (/^[a-z0-9-]+$/.test(c) && n.constructor.name !== 'ArtTextNode' && !(n.children && n.children.length)) simbolos.set(c, n);
  }
  const maiorSimbolo = Math.max(...[...simbolos.values()].map(n => caixa(n).height));

  // os generos
  const generos = new Map();
  for (const n of todos(P.generos)) {
    const m = /^GENERO\s+(.+)$/i.exec(nome(n));
    if (m) generos.set(chave(m[1]), n);
  }

  // os tecidos: composicao e cuidados
  const tecidos = new Map();
  const cuidadosDe = new Map();
  for (const n of todos(P.tecidos)) {
    if (n.constructor.name !== 'ArtTextNode') continue;
    const t = texto(n).trim();
    const mc = /^CUIDADOS DE\s+(.+)$/i.exec(nome(n));
    if (mc) {
      const cods = t.replace(/^CUIDADOS\s*:?/i, '').split(/[\s,;|]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
      cuidadosDe.set(chave(mc[1]), cods);
      continue;
    }
    const i = t.indexOf('=');
    if (i > 0) {
      const comp = t.slice(i + 1).trim()
        .replace(/(\d)\s*%\s*/g, '$1% ')
        .replace(/\s*\|\s*/g, ' | ')
        .replace(/\s+/g, ' ');
      tecidos.set(chave(t.slice(0, i)), { nome: t.slice(0, i).trim(), composicao: comp, cuidados: null });
    }
  }
  for (const [k, cods] of cuidadosDe) if (tecidos.has(k)) tecidos.get(k).cuidados = cods;

  // a etiqueta base: o desenho dentro de UM grupo
  const grupos = [...P.base.children].filter(n => n.isGroupNode === true);
  if (grupos.length !== 1 || [...P.base.children].length !== 1) {
    throw new Error('A ETIQUETA BASE precisa ter o desenho inteiro dentro de UM grupo (selecione tudo e Ctrl+G).');
  }
  const etiqueta = grupos[0];
  const filhos = [...etiqueta.children];
  const tamanhosDaGrade = new Set(todos(P.grade).map(n => chave(texto(n))).filter(Boolean));
  const B = {
    prancheta: P.base,
    etiqueta: etiqueta,
    filhos: filhos,
    iComp: filhos.findIndex(n => n.constructor.name === 'ArtTextNode' && texto(n).includes('%')),
    iTam: filhos.findIndex(n => n.constructor.name === 'ArtTextNode' && tamanhosDaGrade.has(chave(texto(n)))),
    iGen: filhos.findIndex(n => /^GENERO/i.test(nome(n))),
    iCuid: filhos.findIndex(n => chave(nome(n)) === 'CUIDADOS'),
  };
  const semPeca = ['iComp', 'iTam', 'iGen', 'iCuid'].filter(k => B[k] < 0);
  if (semPeca.length) throw new Error('Na ETIQUETA BASE nao achei: ' + semPeca.map(k => ({ iComp: 'a composicao (texto com %)', iTam: 'o tamanho', iGen: 'o simbolo GENERO', iCuid: 'o grupo CUIDADOS' }[k])).join(', '));
  return { spread, pranchetas, P, simbolos, maiorSimbolo, generos, tecidos, B };
}

// ---------- o JSON do editor V4 ---------------------------------------------
/* O GENERO (v1.1). Vem do campo genero do layout. Quando ele esta vazio, a
   propria referencia diz: FEM, MASC ou INF no nome (ex.: "CAMISETA POLO
   FEM SEM PUNHO"), ou a letra no fim do codigo (FT-010-013F). Infantil
   continua sem simbolo. */
function generoDoLayout(L) {
  const g = chave(L.genero);
  if (g) return g;
  const ref = chave([L.ref, L.nome, L.categoria].filter(Boolean).join(' '));
  if (/(^| )FEM/.test(ref)) return 'FEMININO';
  if (/(^| )MASC/.test(ref)) return 'MASCULINO';
  if (/(^| )INF/.test(ref)) return 'INFANTIL';
  /* o codigo da referencia termina com a letra do genero: FT-010-000M,
     FT-010-013F, FT-010-008C (crianca) */
  const fim = /\d([MFC])$/.exec(String(L.ref || '').trim().toUpperCase());
  if (fim) return { M: 'MASCULINO', F: 'FEMININO', C: 'INFANTIL' }[fim[1]];
  return '';
}

function lerPedido(txt, D) {
  let j;
  try { j = JSON.parse(String(txt || '').trim()); } catch (e) { throw new Error('O texto colado nao e um JSON valido.'); }
  if (!j || j.formato !== 'FOURTIME_DTF' || !Array.isArray(j.layouts)) {
    throw new Error('Cole o JSON do "PEDIDO INTEIRO" (botao Copiar do HTML do Trello, formato FOURTIME_DTF).');
  }
  const problemas = [];
  const layouts = [];
  for (const L of j.layouts) {
    const tams = Object.keys(L.tamanhos || {}).filter(t => (L.tamanhos[t] || 0) > 0)
      .sort((a, b) => ORDEM_TAMANHOS.indexOf(a) - ORDEM_TAMANHOS.indexOf(b))
      .map(t => ({ tam: t, qtd: L.tamanhos[t] }));
    if (!tams.length) continue;
    const nomeTec = (L.tecidos || []).find(Boolean) || '';
    const tec = D.tecidos.get(chave(nomeTec));
    const rot = 'L' + L.n + (L.ref ? ' ' + L.ref : '');
    if (!nomeTec) problemas.push(rot + ': o layout nao tem tecido');
    else if (!tec) problemas.push(rot + ': o tecido "' + nomeTec + '" nao esta na prancheta TECIDOS');
    else if (!tec.cuidados || !tec.cuidados.length) problemas.push(rot + ': o tecido "' + tec.nome + '" nao tem o texto "CUIDADOS DE ' + tec.nome + '" na prancheta TECIDOS');
    else {
      const desconhecidos = tec.cuidados.filter(c => !D.simbolos.has(c));
      if (desconhecidos.length) problemas.push(rot + ': simbolo que nao esta na prancheta CUIDADOS: ' + desconhecidos.join(', '));
    }
    const outros = [...new Set((L.tecidos || []).filter(Boolean).map(chave))];
    if (outros.length > 1) console.log(rot + ': o layout tem ' + outros.length + ' tecidos; a etiqueta usa o primeiro (' + nomeTec + ')');
    const gen = generoDoLayout(L);
    layouts.push({ n: L.n, ref: L.ref || '', nome: L.nome || '', rot: rot, tecido: tec, tamanhos: tams,
      genero: D.generos.get(gen) || null, generoNome: gen });
  }
  if (!layouts.length) problemas.push('Nenhum layout com peca no JSON.');
  return { pedido: (j.pedido && j.pedido.numero) || '', cliente: (j.pedido && j.pedido.cliente) || '', layouts, problemas };
}

// ---------- pecas de comando ------------------------------------------------
function trocarTexto(doc, no, str) {
  const r = no.storyInterface.storyRange;
  const sel = Selection.create(doc, no);
  sel.addSubSelectionForNode(no, TextSelection.create([{ begin: r.begin, end: r.begin + r.length - 1 }]));
  doc.executeCommand(DocumentCommand.createSetText(sel, str));
}
function mover(doc, no, xf) { doc.executeCommand(DocumentCommand.createTransform(Selection.create(doc, [no]), xf)); }
function apagar(doc, nos) { if (nos.length) doc.executeCommand(DocumentCommand.createDeleteSelection(Selection.create(doc, nos))); }
function colocarDentro(doc, nos, alvo) {
  doc.executeCommand(DocumentCommand.createMoveNodes(Selection.create(doc, nos), alvo, NodeMoveType.Inside, NodeChildType.Main));
}
function renomear(doc, no, n) { doc.executeCommand(DocumentCommand.createSetDescription(Selection.create(doc, [no]), n)); }
// copia "fonte" com escala s e o canto de cima-esquerda em (x, y), coords de spread
function copiarEm(fonte, s, x, y) {
  const b = caixa(fonte);
  return fonte.duplicate(Transform.createTranslate(x - s * b.x, y - s * b.y).multiply(Transform.createScale(s, s)));
}

// ---------- uma etiqueta ----------------------------------------------------
function montarEtiqueta(doc, D, G, alvo, dx, dy, L, item) {
  const B = D.B;
  const copia = B.etiqueta.duplicate(Transform.createTranslate(dx, dy));
  colocarDentro(doc, [copia], alvo);
  const partes = [...copia.children];

  // composicao: de canto a canto
  const comp = partes[B.iComp];
  const cb0 = caixa(B.filhos[B.iComp]);
  trocarTexto(doc, comp, L.tecido.composicao);
  const cb = caixa(comp);
  const cyAlvo = cb0.y + cb0.height / 2 + dy;
  const sx = (G.R - G.L) / cb.width;
  const sy = Math.min(sx, ALTURA_MAX_COMPOSICAO * cb0.height / cb.height);
  mover(doc, comp, Transform.createTranslate(G.L + dx - sx * cb.x, cyAlvo - sy * (cb.y + cb.height / 2)).multiply(Transform.createScale(sx, sy)));

  // tamanho: preso pela esquerda
  const tam = partes[B.iTam];
  const tb0 = caixa(B.filhos[B.iTam]);
  trocarTexto(doc, tam, item.tam);
  const tb = caixa(tam);
  mover(doc, tam, Transform.createTranslate(tb0.x + dx - tb.x, 0));
  renomear(doc, tam, item.tam);

  // genero: preso na parede direita
  const gb0 = caixa(B.filhos[B.iGen]);
  apagar(doc, [partes[B.iGen]]);
  if (L.genero) {
    const fonte = L.genero;
    const fb = caixa(fonte);
    const s = gb0.height / fb.height;
    const g = copiarEm(fonte, s, gb0.x + gb0.width - s * fb.width + dx, gb0.y + dy);
    colocarDentro(doc, [g], copia);
  }

  // simbolos de cuidado: de canto a canto
  const grupo = partes[B.iCuid];
  const velhos = [...grupo.children];
  const fontes = L.tecido.cuidados.map(c => D.simbolos.get(c));
  let k = G.k;
  const larguras = () => fontes.map(f => caixa(f).width * k);
  let soma = larguras().reduce((a, b) => a + b, 0);
  const vaoMin = VAO_MINIMO_SIMBOLOS_MM * G.mm;
  if (fontes.length > 1 && soma + vaoMin * (fontes.length - 1) > G.R - G.L) {
    k = k * (G.R - G.L - vaoMin * (fontes.length - 1)) / soma;
    soma = larguras().reduce((a, b) => a + b, 0);
  }
  const vao = fontes.length > 1 ? (G.R - G.L - soma) / (fontes.length - 1) : 0;
  let x = G.L + dx;
  const novos = [];
  for (const f of fontes) {
    const fb = caixa(f);
    const n = copiarEm(f, k, x, G.cy + dy - k * fb.height / 2);
    renomear(doc, n, nome(f));
    novos.push(n);
    x += fb.width * k + vao;
  }
  colocarDentro(doc, novos, grupo);
  apagar(doc, velhos);

  // o nome da arte, como no DTF ORGANIZADO (L1-F1, L1-C1...)
  renomear(doc, copia, 'L' + L.n + '-' + item.tam);
  return copia;
}

// ---------- os textos de LAYOUT e QUANTIDADE ---------------------------------
let FONTE = null;
function fonte() {
  if (FONTE === null) {
    FONTE = undefined;
    try {
      for (const fam of FontFamily.all) {
        const f = [...fam.fonts].find(x => x.postscriptName === FONTE_TEXTO);
        if (f) { FONTE = f; break; }
      }
    } catch (e) { console.log('fonte: ' + e.message); }
  }
  return FONTE;
}
// cria o texto com a borda esquerda em x e o centro vertical em cy (spread)
function criarTexto(doc, alvo, str, x, cy, nomeCamada) {
  const sb = StoryBuilder.create();
  sb.setToArtisticTextDefaultStyle(doc.dpi, doc.format);
  const ga = sb.glyphAtts.clone();
  const f = fonte(); if (f) ga.font = f;
  ga.setDoubleValue(GlyphAttDoubleType.Height, ALTURA_FONTE_MM * doc.dpi / 25.4);
  ga.brushFill = FillDescriptor.createSolid(Colour.createRGBA8(COR_TEXTO));
  sb.setGlyphAtts(ga);
  sb.addText(str);
  const def = ArtTextNodeDefinition.createFromStoryBuilder({ x: x, y: cy }, sb);
  try { def.userDescription = nomeCamada; } catch (e) {}
  const antes = [...alvo.children];
  const b = AddChildNodesCommandBuilder.create();
  b.setInsertionTarget(alvo);
  b.addNode(def);
  doc.executeCommand(b.createCommand(false, NodeChildType.Main));
  const novo = [...alvo.children].find(n => !antes.some(a => a.isSameNode(n)));
  if (!novo) throw new Error('Nao consegui escrever "' + str + '"');
  const nb = caixa(novo);
  mover(doc, novo, Transform.createTranslate(x - nb.x, cy - (nb.y + nb.height / 2)));
  renomear(doc, novo, nomeCamada);
  return novo;
}

// ---------- o pedido inteiro ------------------------------------------------
function montar(doc, D, ped) {
  const B = D.B;
  const mm = doc.dpi / 25.4;
  const BA = caixa(B.prancheta);
  const ET = caixa(B.etiqueta);
  const cuid = caixa(B.filhos[B.iCuid]);
  const G = {
    mm: mm, L: cuid.x, R: cuid.x + cuid.width, cy: cuid.y + cuid.height / 2,
    k: cuid.height / D.maiorSimbolo,
  };

  // as fileiras: layout por layout, tamanho por tamanho
  const fileiras = [];
  for (const L of ped.layouts) for (const item of L.tamanhos) fileiras.push({ L, item });

  // a altura da fileira: a maior entre a etiqueta e o texto "L1"
  const altTexto = 0.72 * ALTURA_FONTE_MM * mm;
  const altFileira = Math.max(ET.height, altTexto);
  const vao = VAO_FILEIRAS_MM * mm, margem = MARGEM_MM * mm;

  // apaga a prancheta deste pedido feita antes (e as de uma prancheta por layout, da v1)
  const prefixo = 'ETQ ' + (ped.pedido || 'SEM NUMERO');
  const antigas = D.pranchetas.filter(p => nome(p) === prefixo || nome(p).startsWith(prefixo + ' '));
  apagar(doc, antigas);
  const resto = D.pranchetas.filter(p => !antigas.some(a => a.isSameNode(p)));
  const x0 = Math.max(...resto.map(p => caixa(p).x + caixa(p).width)) + VAO_PRANCHETAS_MM * mm;

  const n = fileiras.length;
  const r = new Rectangle(x0, BA.y, COL_ARTE_MM * mm + ET.width + margem, 2 * margem + n * altFileira + (n - 1) * vao);
  doc.addRectangularArtboard(r, false, false);
  const ab = [...D.spread.children].filter(ehPrancheta).find(p => {
    const b = caixa(p); return Math.abs(b.x - r.x) < 2 && Math.abs(b.y - r.y) < 2 && Math.abs(b.width - r.width) < 2;
  });
  if (!ab) throw new Error('Nao consegui criar a prancheta do pedido');
  renomear(doc, ab, prefixo);
  /* a prancheta nasce no pixel inteiro: tudo sai da caixa real dela */
  const real = caixa(ab);

  fileiras.forEach(({ L, item }, i) => {
    const cy = real.y + margem + i * (altFileira + vao) + altFileira / 2;
    const tag = 'L' + L.n;
    montarEtiqueta(doc, D, G, ab, real.x + COL_ARTE_MM * mm - ET.x, cy - ET.height / 2 - ET.y, L, item);
    criarTexto(doc, ab, tag, real.x + COL_LAYOUT_MM * mm, cy, tag + ' TAG');
    criarTexto(doc, ab, item.qtd + 'x', real.x + COL_QTD_MM * mm, cy, tag + ' QTD');
  });
  const total = fileiras.reduce((s, f) => s + f.item.qtd, 0);
  return { nome: prefixo, layouts: ped.layouts.length, etiquetas: n, pecas: total };
}

function main() {
  const doc = Document.current;
  if (!doc) { aviso('Abra o documento ETIQUETA SUPERE SPORTS.'); return; }
  let D;
  try { D = lerDocumento(doc); } catch (e) { aviso(e.message); return; }

  const dlg = Dialog.create(TITULO);
  const g = dlg.addColumn().addGroup();
  g.addStaticText(null, 'Cole o JSON do PEDIDO INTEIRO (editor V4, HTML do Trello, botao Copiar). Uma prancheta no modelo do DTF ORGANIZADO: uma fileira por etiqueta, com LAYOUT, QUANTIDADE e ARTE. Os cuidados vem do texto "CUIDADOS DE <tecido>" na prancheta TECIDOS.').setIsFullWidth();
  const caixaJson = g.addTextBox('', '');
  caixaJson.setIsMultiLine(true);
  try { caixaJson.setRowSpan(14); } catch (e) {}
  try { caixaJson.setIsFullWidth(true); } catch (e) {}
  dlg.initialWidth = 520;
  if (dlg.runModal() !== DialogResult.Ok) return;

  let ped;
  try { ped = lerPedido(caixaJson.text, D); } catch (e) { aviso(e.message); return; }
  if (ped.problemas.length) {
    aviso('Nada foi criado. Corrija antes:\n\n- ' + ped.problemas.join('\n- '));
    return;
  }
  try {
    const f = montar(doc, D, ped);
    const msg = 'Feito: prancheta ' + f.nome + ' com ' + f.layouts + ' layouts, ' + f.etiquetas + ' fileiras e ' + f.pecas + ' etiquetas no total.';
    console.log(msg);
    aviso(msg);
  } catch (e) {
    aviso('Parou no meio: ' + e.message + '\nUse Desfazer para limpar o que foi criado.');
    console.log(e.stack || e.message);
  }
}

module.exports.main = main;
main();
