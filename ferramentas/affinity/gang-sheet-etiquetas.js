/**
 * name: 03 - GANG SHEET ETIQUETAS v2 121126
 */
// ============================================================================
// GANG SHEET ETIQUETAS v2 (12/11/2026)
// v2: layout com poucas etiquetas divide a fileira com outro, separado por uma
//   linha vermelha em pe, cada um com o seu nome; a ordem dos layouts pode
//   mudar para poupar filme. No PD004430: 143,4 cm na v1.1, 126,8 cm na v2.
// v1.1: cada grupo ganhou o nome do layout e a linha caiu de 3 para 1,5 mm.
// Irmao do GANG SHEET MOTOR v8.7, so para ETIQUETAS.
//
// Etiqueta e sempre retangulo ou quadrado, entao o encaixe por contorno do
// motor (teewee, quadriangulo, par, circulo, rede alternada, aperto) nao
// serve aqui. Este script faz GRADE: fileiras e colunas, LAYOUT POR LAYOUT.
//
//   1) le a prancheta das etiquetas (a "ETQ ..." ou "DTF ETQ ..." que o
//      ETIQUETAS DO PEDIDO monta), com as tres colunas de sempre:
//      TAG "L1" | QUANTIDADE "5x" | ARTE "L1-PP"
//   2) junta as artes por layout, na ordem em que aparecem na prancheta
//   3) cada layout vira um bloco em grade, com o nome dele ("L2") em
//      vermelho em cima; o layout inteiro fica deitado ou em pe
//   4) layout grande ocupa a largura da chapa; layout pequeno entra ao lado
//      de outro, separado por uma LINHA VERMELHA EM PE de 1,5 mm; entre as
//      fileiras de blocos, a LINHA VERMELHA DEITADA sai do nome de cada
//      layout. A ordem dos layouts pode mudar para poupar filme.
//
// Mantido do motor v8.7: chapa de 58 cm cravado, ate 230 cm, folga de 8 mm,
// arte a 4 mm da lateral, 10 cm entre gang sheets, prancheta no mesmo Y da
// prancheta de origem, fundo cinza, nome "GANG SHEET N", janela de
// confirmacao, freio (PARAR.txt na Area de Trabalho e 10 min), higiene de
// selecao, copia SEMPRE do no de origem, rodape com metros e ocupacao,
// TOTAL embaixo e janela final com o tempo.
// ============================================================================
'use strict';
const { app } = require('/application');
const { Transform, Rectangle, Curve, PolyCurve } = require('/geometry');
const { DocumentCommand, NodeMoveType, NodeChildType, AddChildNodesCommandBuilder, createCompoundCommand } = require('/commands');
const { ArtTextNodeDefinition, PolyCurveNodeDefinition } = require('/nodes');
const { StoryBuilder } = require('/storybuilder');
const { GlyphAttDoubleType } = require('/glyphatts');
const { FillDescriptor } = require('/fills');
const { BlendMode } = require('affinity:common');
const { Selection } = require('/selections');
const { Colour } = require('/colours');
const { Dialog, DialogResult } = require('/dialog');

// ---------------------------- freio de emergencia ---------------------------
const FreioFS = require('/fs').FileSystemApi;
const FREIO_PATH = app.userDesktopPath + '/PARAR.txt';
const VERSAO = 'GANG SHEET ETIQUETAS v2  (blocos por layout, layouts pequenos lado a lado, linhas vermelhas de 1,5 mm deitadas e em pe)';
const TEMPO_MAX_S = 600;
let T0 = Date.now();
let FREIO_AVISADO = false;
function pedidoDeParada() {
  if ((Date.now() - T0) / 1000 > TEMPO_MAX_S) {
    if (!FREIO_AVISADO) { FREIO_AVISADO = true; console.log('PARANDO: passou de ' + TEMPO_MAX_S + 's.'); }
    return true;
  }
  try { if (FreioFS.exists(FREIO_PATH)) { if (!FREIO_AVISADO) { FREIO_AVISADO = true; console.log('PARANDO: achei PARAR.txt na Area de Trabalho.'); } return true; } } catch (e) {}
  return false;
}
function limparFreio() { try { if (FreioFS.exists(FREIO_PATH)) FreioFS.remove(FREIO_PATH); } catch (e) {} }
limparFreio();
function tempoTexto(seg) {
  const s = Math.max(0, Math.round(seg));
  const m = Math.floor(s / 60), r = s % 60;
  return m ? (m + ' min ' + r + ' s') : (r + ' s');
}

// ---------------------------- numeros fixos ---------------------------------
const SHEET_W = 58.0;                  // 58 cm cravado, NAO ALTERAR (igual ao motor v8.7)
const SHEET_H_MIN = 200, SHEET_H_MAX = 230;
const SHEET_H = SHEET_H_MAX;
const GAP_SHEETS_CM = 10;
const PXCM = 300 / 2.54;
const MM = PXCM / 10;                  // px por mm
const FOLGA_MM = 8;                    // entre uma etiqueta e a outra
const MEIA_MM = FOLGA_MM / 2;          // 4 mm: da lateral da chapa ate a arte
const LINHA_MM = 1.5;                  // a linha vermelha entre layouts (v1.1: era 3)
const ROTULO_MM = 6;                   // altura do nome do layout ("L2") no começo de cada grupo
const FAIXA_MM = MEIA_MM + ROTULO_MM + MEIA_MM;   // a faixa do nome: 4 + 6 + 4 mm
const VAO_ROTULO_MM = 3;               // do fim do nome ate o começo da linha
const LINHA_COR = { r: 255, g: 0, b: 0, alpha: 255 };
const W_MM = SHEET_W * 10, H_MM = SHEET_H * 10;
const EMPATE = 1.01;                   // deitada so perde para em pe se em pe gastar 1% a menos
const APOIO = /^(molde|base|fundo|mockup|guia|ref|teste)/i;
const TAG_LAYOUT = /(^|\s)TAG\s*$/i;
// v7.7 (01/09/2026): a TAG de layout do organizador v21 pode trazer o tamanho
// do molde junto ("L1.3.7 6A", "L1.3 6A | L7 8A"). O regex antigo so conhecia
// "L1" e "L2.3", entao a tag vermelha da coluna 1 passaria por ARTE e ganharia
// copia no gang sheet. A trava do nome de camada (TAG_LAYOUT) ja pegava esses
// casos, mas esta e a segunda rede e tem de conhecer o formato novo.
const TAM_NA_TAG = /^(1A|2A|4A|6A|8A|10A|12A|14A|PP|P|M|G|GG|XG|G1|G2|G3|G4|PLUS)$/i;
function ehTagDeLayout(txt) {
  const t = String(txt || '').trim();
  if (!t || t.length > 60) return false;
  const blocos = t.split('|');
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i].trim();
    if (!b) return false;
    const p = b.split(/\s+/);
    if (!/^L[-\d.]*$/i.test(p[0])) return false;
    if (p.length > 2) return false;
    // v7.8: o organizador junta tamanhos infantis que servem os mesmos layouts
    // num token so ("L2 6A.8A"), entao o token do tamanho tem de ser quebrado
    // por ponto e validado pedaco a pedaco. Sem isto "L2 6A.8A" nao era
    // reconhecida como tag, e a tag vermelha da coluna 1 entrava como ARTE e
    // ganhava copia impressa no gang sheet.
    if (p.length === 2) {
      const tams = p[1].split('.');
      for (let j = 0; j < tams.length; j++) if (!TAM_NA_TAG.test(tams[j])) return false;
    }
  }
  return true;
}

const d = app.documents.current || app.documents.all[0];
// ============================================================================
// v7.9 (07/10/2026): HIGIENE DE SELECAO, O ANTI FECHAMENTO
// O Affinity 3.3 fechava sozinho em parte das rodadas dos scripts, sempre com o
// mesmo erro vindo da interface (ArgumentOutOfRangeException). Aqui, cada peca
// era duplicada (a copia sai SELECIONADA) e, no comando seguinte, movida para
// dentro da prancheta ainda selecionada: centenas de vezes por rodada. O painel
// ficava apontando para um item que tinha acabado de mudar de lugar.
// Agora a selecao e esvaziada DENTRO do mesmo comando que move a peca, e os
// textos do rodape nascem sem selecao. Esvaziar sozinho gasta um passo do
// historico, entao so acontece quando ha de fato algo selecionado.
// ============================================================================
function quantosSelecionados(doc) {
  try { return doc.selection.nodes.toArray().length; } catch (e) {}
  try { return doc.selection.length; } catch (e) {}
  return -1;
}
function selecaoVazia(doc) { return DocumentCommand.createSetSelection(Selection.create(doc, [])); }
function limpaSelecao(doc) {
  try {
    if (quantosSelecionados(doc) === 0) return true;
    doc.executeCommand(selecaoVazia(doc));
    return true;
  } catch (e) { return false; }
}
function comandoQuieto(builder) {
  try { return builder.createCommand(false, NodeChildType.Main); }
  catch (e) { return builder.createCommand(); }
}
if (!d) { app.alert('Nenhum documento aberto.'); throw new Error('sem documento'); }
function getAbs() { const out = []; for (let i = 0; i < d.artboards.length; i++) out.push(d.artboards[i]); return out; }

// ============================================================================
// PASSO 1: achar a prancheta das etiquetas e ler TAG, QUANTIDADE e ARTE
// ============================================================================
// Quantidade: texto com "x" no fim ("5x"), ou numero puro numa camada "... QTD"
// (mesma regra do motor v8.6). Ela soma na arte da MESMA fileira, a direita.
const QTY1 = /^\s*(\d+)\s*[xX]\s*$/;
const QTY_NUM = /^\s*(\d+)\s*$/;
const NOME_QTD = /(^|\s)QTD\s*$/i;
// o layout pelo nome da arte: "L1-PP", "L2.3-M", "L4 G"
const LAYOUT_NO_NOME = /^(L[\d.]+)(?=$|[-\s_])/i;
const ehGang = ab => /^gang sheet/i.test(ab.description || '');
// se houver prancheta de ETIQUETA (ETQ no nome), so ela entra; senao, as DTF
let fonteAbs = getAbs().filter(ab => /(^|\s)ETQ(\s|$)/i.test(ab.description || '') && !ehGang(ab));
if (!fonteAbs.length) fonteAbs = getAbs().filter(ab => /dtf/i.test(ab.description || '') && !ehGang(ab));
if (!fonteAbs.length) { app.alert('Nenhuma prancheta de etiquetas ("ETQ" ou "DTF" no nome).'); throw new Error('sem prancheta'); }
fonteAbs.sort((a, b) => a.spreadBaseBox.x - b.spreadBaseBox.x);

const items = [];
for (const ab of fonteAbs) {
  const artes = [], qtys = [], tags = [];
  let ch = ab.node.firstChild;
  while (ch) {
    const desc = ch.description || '';
    const cn = ch.constructor.name;
    const ehTexto = cn === 'ArtTextNode' || cn === 'TextNode';
    let txt = ''; if (ehTexto) { try { txt = ch.story.text; } catch (e) {} }
    if (TAG_LAYOUT.test(desc) || (ehTexto && ehTagDeLayout(txt))) {
      // a TAG nao e impressa, mas diz de qual layout e a fileira
      const t = (ehTexto && ehTagDeLayout(txt) ? txt : desc).trim().split(/\s+/)[0].toUpperCase();
      const vb = ch.getExactSpreadVisibleBox();
      tags.push({ key: t, cy: vb.y + vb.height / 2, y0: vb.y, y1: vb.y + vb.height });
    } else if (!APOIO.test(desc)) {
      if (!ehTexto) artes.push(ch);
      else {
        const f1 = txt.match(QTY1) || (NOME_QTD.test(desc) ? txt.match(QTY_NUM) : null);
        if (f1) qtys.push({ node: ch, qty: parseInt(f1[1], 10) });
        else artes.push(ch);   // texto que nao e quantidade nem tag e arte
      }
    }
    ch = ch.nextSibling;
  }
  const gi = artes.map(g => {
    const vb = g.getExactSpreadVisibleBox();
    return { g, vb, cy: vb.y + vb.height / 2, qty: 0, nome: g.description || '' };
  });
  for (const q of qtys) {
    const tb = q.node.getExactSpreadVisibleBox();
    const qcy = tb.y + tb.height / 2;
    let melhor = null;
    for (const a of gi) {
      if (a.vb.x <= tb.x) continue;
      // mesma fileira: o meio do texto cai dentro da altura da arte
      if (qcy < a.vb.y || qcy > a.vb.y + a.vb.height) continue;
      if (!melhor || a.vb.x < melhor.vb.x) melhor = a;
    }
    if (melhor) melhor.qty += q.qty;
    else console.log('AVISO: quantidade sem arte pareada em ' + ab.description + ': ' + q.qty + 'x');
  }
  for (const a of gi) {
    let key = '';
    const m = a.nome.match(LAYOUT_NO_NOME);
    if (m) key = m[1].toUpperCase();
    if (!key) {
      // a TAG da mesma fileira; sem ela, a ultima TAG acima
      let t = tags.find(t => t.cy >= a.vb.y && t.cy <= a.vb.y + a.vb.height);
      if (!t) { for (const u of tags) if (u.cy <= a.cy && (!t || u.cy > t.cy)) t = u; }
      if (t) key = t.key;
    }
    items.push({
      node: a.g, ab: ab.description, layout: key || 'SEM LAYOUT', nome: a.nome || ('arte ' + (items.length + 1)),
      vb: { x: a.vb.x, y: a.vb.y, w: a.vb.width, h: a.vb.height },
      qty: a.qty > 0 ? a.qty : 1, ordem: fonteAbs.indexOf(ab) * 1e9 + a.vb.y * 1e3 + a.vb.x / 1e3,
    });
  }
}
// a ordem da prancheta: de cima para baixo (e prancheta por prancheta)
items.sort((a, b) => a.ordem - b.ordem);
// os layouts, na ordem da primeira fileira de cada um
const LAYOUTS = [];
{
  const porKey = {};
  items.forEach((it, i) => {
    it.idx = i;
    if (!porKey[it.layout]) { porKey[it.layout] = { key: it.layout, itens: [] }; LAYOUTS.push(porKey[it.layout]); }
    porKey[it.layout].itens.push(it);
  });
}
let totCopias = 0;
items.forEach(it => { totCopias += it.qty; });
console.log(VERSAO);
console.log('Layouts: ' + LAYOUTS.length + ', artes: ' + items.length + ', copias pedidas: ' + totCopias);
if (!items.length) { app.alert('A prancheta ' + fonteAbs.map(a => a.description).join(', ') + ' nao tem nenhuma arte.'); throw new Error('sem arte'); }
{
  // etiqueta maior que a chapa nao tem como entrar
  const larga = items.filter(it => Math.min(it.vb.w, it.vb.h) / MM + FOLGA_MM > W_MM + 0.01);
  if (larga.length) { app.alert('Arte mais larga que a chapa de 58 cm: ' + larga.map(it => it.nome).join(', ')); throw new Error('arte larga'); }
}

// ============================================================================
// PASSO 2: JANELA DE CONFIRMACAO ANTES DE COMECAR (igual ao motor v8.4)
// ============================================================================
{
  const gsExistentes = getAbs().filter(ab => /^GANG SHEET \d+$/.test(ab.description || '')).length;
  const linhas = [
    'Prancheta: ' + fonteAbs.map(ab => ab.description).join(', '),
    'Layouts: ' + LAYOUTS.length + '     Artes: ' + items.length + '     Cópias: ' + totCopias,
    '',
    'Layouts pequenos dividem a fileira, separados por linha vermelha em pe. A ordem pode mudar.',
    'No fim aparece uma janela com o tempo e a metragem.'
  ];
  let seguir = true;
  try {
    const dlg = Dialog.create('Gang sheet etiquetas v2');
    const col = dlg.addColumn();
    const g1 = col.addGroup('O gang sheet de etiquetas vai começar');
    linhas.forEach(t => g1.addStaticText('', t || ' '));
    if (gsExistentes) {
      const g2 = col.addGroup('Atenção');
      g2.addStaticText('', 'Este documento já tem ' + gsExistentes + ' prancheta(s) GANG SHEET.');
      g2.addStaticText('', 'Rodar de novo cria outro conjunto ao lado. Cancele se já rodou.');
    }
    seguir = dlg.runModal() === DialogResult.Ok;
  } catch (e) {
    console.log('AVISO: janela de confirmacao falhou: ' + (e.message || e));
    app.alert('O gang sheet de etiquetas vai começar.\n\n' + linhas.join('\n') +
      (gsExistentes ? '\n\nATENÇÃO: este documento já tem ' + gsExistentes + ' prancheta(s) GANG SHEET.' : ''));
  }
  if (!seguir) { console.log('Cancelado na janela de confirmacao. Nada foi alterado.'); throw new Error('cancelado'); }
  T0 = Date.now();
  limparFreio();
}

// ============================================================================
// PASSO 3 (v2): blocos por layout, prateleiras e chapas (tudo em mm)
// ============================================================================
// Cada layout vira um BLOCO retangular: o nome dele em cima e a grade das
// etiquetas embaixo (celula = arte + 4 mm de cada lado, entao duas artes
// vizinhas ficam a 8 mm e a da ponta a 4 mm da lateral).
// Layout grande (mais de uma fileira) abre uma PRATELEIRA na largura da chapa.
// Layout pequeno (cabe numa fileira) entra na sobra de largura de qualquer
// prateleira, ao lado de outro layout, separado por uma LINHA VERMELHA EM PE;
// se for preciso ele vira um bloco de mais fileiras para caber na altura da
// prateleira. Se nao couber em nenhuma, abre uma prateleira nova, onde outros
// pequenos tambem entram. Por isso a ordem dos layouts pode mudar (pedido do
// Henrique em 12/11/2026: pode sair da ordem para poupar filme).
// Entre uma prateleira e a de cima, a linha vermelha deitada sai do nome de
// cada layout ate a linha em pe do vizinho (ou ate a lateral).
// O script tenta 6 jeitos de arrumar os pequenos e fica com o que gasta menos
// filme. Cada prateleira vai para a primeira chapa onde cabe.
// PASSO 3 da v2: blocos por layout, prateleiras e chapas (tudo em mm)
// entrada: LAYOUTS [{key, itens:[{vb:{w,h} em px, qty, idx}]}], MM, constantes
// saida: finais [{placements, blocos, linhasV, cursor, tinta}]
function planejaV2(LAYOUTS, K, opc) {
  opc = opc || { abre: 'baixo', ordem: 'n' };
  const { MM, W_MM, H_MM, FOLGA_MM, MEIA_MM, LINHA_MM, ROTULO_MM, EMPATE } = K;
  const FAIXA_MM = MEIA_MM + ROTULO_MM + MEIA_MM;
  const SEP_V_MM = MEIA_MM + LINHA_MM + MEIA_MM;
  const E = 0.01;
  function copiasDo(L) { const c = []; for (const it of L.itens) for (let k = 0; k < it.qty; k++) c.push(it); return c; }
  // a celula do layout: a maior arte dele + 4 mm de cada lado
  function celula(L, ang) {
    let w = 0, h = 0;
    for (const it of L.itens) { const a = it.vb.w / MM, b = it.vb.h / MM; w = Math.max(w, ang ? b : a); h = Math.max(h, ang ? a : b); }
    return { cw: w + FOLGA_MM, ch: h + FOLGA_MM, w, h };
  }
  const maxCols = c => Math.floor((W_MM + E) / c.cw);
  const maxRows = c => Math.floor((H_MM - FAIXA_MM + E) / c.ch);
  function bloco(L, ang, copias, c, r) {
    const cel = celula(L, ang);
    return { L, ang, copias, c, r, cel, w: c * cel.cw, h: FAIXA_MM + r * cel.ch };
  }
  const grandes = [], pequenos = [];
  for (const L of LAYOUTS) {
    L.copias = copiasDo(L);
    const n = L.copias.length;
    const opcoes = [0, 90].filter(a => maxCols(celula(L, a)) >= 1);
    if (!opcoes.length) throw new Error('arte mais larga que a chapa: ' + L.key);
    if (opcoes.some(a => n <= maxCols(celula(L, a)))) { pequenos.push(L); continue; }
    // grande: o jeito que gasta menos altura na largura toda (deitada no empate)
    const alt = a => Math.ceil(n / maxCols(celula(L, a))) * celula(L, a).ch;
    let ang = opcoes[0];
    if (opcoes.length > 1 && alt(90) * EMPATE < alt(0)) ang = 90;
    const cel = celula(L, ang), C = maxCols(cel), R = Math.max(1, maxRows(cel));
    // pedacos que cabem numa chapa; o ultimo fica so com as colunas que precisa
    for (let i = 0; i < n; i += C * R) {
      const parte = L.copias.slice(i, i + C * R);
      const r = Math.ceil(parte.length / C), c = Math.ceil(parte.length / r);
      grandes.push(bloco(L, ang, parte, c, r));
    }
  }
  // prateleiras: cada bloco grande abre uma; os pequenos entram nas sobras
  grandes.sort((a, b) => b.h - a.h);
  const prateleiras = grandes.map(b => ({ h: b.h, w: b.w, blocos: [b] }));
  const largura1 = L => Math.min(...[0, 90].map(a => { const c = celula(L, a); return maxCols(c) >= L.copias.length ? L.copias.length * c.cw : 1e9; }));
  if (opc.ordem === 'largura') pequenos.sort((a, b) => largura1(b) - largura1(a));
  else pequenos.sort((a, b) => b.copias.length - a.copias.length);
  for (const L of pequenos) {
    const n = L.copias.length;
    // a sobra mais justa de todas as prateleiras, em qualquer jeito e fileiras
    let melhor = null;
    for (const p of prateleiras) {
      const sobra = W_MM - p.w - SEP_V_MM;
      for (const a of [0, 90]) {
        const cel = celula(L, a); const C = maxCols(cel);
        for (let r = 1; C >= 1 && FAIXA_MM + r * cel.ch <= p.h + E; r++) {
          const c = Math.ceil(n / r); if (c > C) continue;
          const w = c * cel.cw; if (w > sobra + E) continue;
          const fica = sobra - w;
          if (!melhor || fica < melhor.fica - E || (Math.abs(fica - melhor.fica) <= E && r < melhor.r)) melhor = { p, a, c, r, fica };
        }
      }
    }
    if (melhor) {
      const b = bloco(L, melhor.a, L.copias, melhor.c, melhor.r);
      melhor.p.blocos.push(b); melhor.p.w += SEP_V_MM + b.w;
      continue;
    }
    // nao coube em nenhuma: abre prateleira nova, numa fileira so, o mais baixo
    let op = null;
    const jeitos = opc.abre === 'pe' ? [90, 0] : opc.abre === 'deitada' ? [0, 90] : null;
    for (const a of (jeitos || [0, 90])) {
      const cel = celula(L, a); if (maxCols(cel) < n) continue;
      const b = bloco(L, a, L.copias, n, 1);
      if (jeitos) { if (!op) op = b; continue; }
      if (!op || b.h < op.h - E || (Math.abs(b.h - op.h) <= E && b.w < op.w)) op = b;
    }
    prateleiras.push({ h: op.h, w: op.w, blocos: [op] });
  }
  // chapas: cada prateleira na primeira chapa onde cabe
  const finais = [];
  for (const p of prateleiras) {
    let s = finais.find(f => f.cursor + p.h <= H_MM + E);
    if (!s) { s = { placements: [], blocos: [], linhasV: [], cursor: 0, tinta: 0, prateleiras: 0 }; finais.push(s); }
    const y0 = s.cursor, comLinha = s.prateleiras > 0;
    let x = 0;
    p.blocos.forEach((b, bi) => {
      const ultimo = bi === p.blocos.length - 1;
      const yRot = y0 + MEIA_MM;
      // a linha do nome vai ate a linha de pe do vizinho, ou ate a lateral
      const xFim = ultimo ? (W_MM - MEIA_MM) : (x + b.w + SEP_V_MM / 2 + LINHA_MM / 2);
      s.blocos.push({ x: x + MEIA_MM, y: yRot, texto: b.L.key, linha: comLinha, x1: xFim,
        nome: 'LINHA ' + b.L.key + (b.copias.length < b.L.copias.length ? ' (parte)' : '') });
      b.copias.forEach((it, k) => {
        const col = k % b.c, fil = Math.floor(k / b.c);
        // a arte de verdade (pode ser menor que a celula do layout)
        const aw = b.ang ? it.vb.h / MM : it.vb.w / MM, ah = b.ang ? it.vb.w / MM : it.vb.h / MM;
        s.placements.push({ key: it.idx, ang: b.ang, x: x + col * b.cel.cw + MEIA_MM, y: y0 + FAIXA_MM + fil * b.cel.ch + MEIA_MM, w: aw, h: ah, layout: b.L.key });
        s.tinta += aw * ah;
      });
      if (!ultimo) {
        const xl = x + b.w + SEP_V_MM / 2 - LINHA_MM / 2;
        const yA = comLinha ? (yRot + (ROTULO_MM - LINHA_MM) / 2) : yRot;
        s.linhasV.push({ x: xl, y0: yA, y1: y0 + p.h - MEIA_MM, nome: 'LINHA ' + b.L.key + ' | ' + p.blocos[bi + 1].L.key });
      }
      x += b.w + SEP_V_MM;
    });
    s.cursor += p.h; s.prateleiras++;
  }
  return { finais, prateleiras, grandes, pequenos };
}
// tenta alguns jeitos de abrir prateleira e de ordenar os pequenos e fica com
// o que gasta menos filme (empate: menos chapas)
function melhorPlano(LAYOUTS, K) {
  let melhor = null;
  for (const abre of ['baixo', 'pe', 'deitada']) for (const ordem of ['n', 'largura']) {
    const r = planejaV2(LAYOUTS, K, { abre, ordem });
    r.total = r.finais.reduce((t, s) => t + s.cursor, 0);
    if (!melhor || r.total < melhor.total - 0.01 || (Math.abs(r.total - melhor.total) <= 0.01 && r.finais.length < melhor.finais.length)) melhor = r;
  }
  return melhor;
}
const PLANO = melhorPlano(LAYOUTS, { MM, W_MM, H_MM, FOLGA_MM, MEIA_MM, LINHA_MM, ROTULO_MM, EMPATE });
const finais = PLANO.finais;
for (let i = finais.length - 1; i >= 0; i--) if (!finais[i].placements.length) finais.splice(i, 1);

let totalCm = 0, areaTinta = 0;
for (const s of finais) {
  totalCm += s.cursor / 10;
  areaTinta += s.tinta;
  s.metros = s.cursor / 1000;
  s.ocupacao = s.cursor > 0 ? (100 * s.tinta / (W_MM * s.cursor)) : 0;
}
let plano = 'PLANO\n';
finais.forEach((s, i) => { plano += '  GANG SHEET ' + (i + 1) + ': ' + s.placements.length + ' copias, ' + s.prateleiras + ' prateleira(s), ' + (s.cursor / 10).toFixed(1) + ' cm\n'; });
PLANO.prateleiras.forEach(p => { plano += '    ' + p.blocos.map(b => b.L.key + ' ' + b.copias.length + (b.ang ? ' em pe' : '') + ' (' + b.c + 'x' + b.r + ')').join('  |  ') + '\n'; });
plano += '  total ' + (totalCm / 100).toFixed(2) + ' m de filme, ocupacao ' + (totalCm > 0 ? (100 * areaTinta / (W_MM * totalCm * 10)).toFixed(1) : '0') + '%\n';
console.log(plano);

// ============================================================================
// PASSO 4: montar no Affinity (igual ao motor v8.7)
// ============================================================================
// A prancheta GANG SHEET nasce no MESMO Y da prancheta de origem e a 10 cm da
// lateral dela; se o lugar estiver ocupado, empurra para a direita.
const dtfBox = fonteAbs[fonteAbs.length - 1].spreadBaseBox;
const Y0 = dtfBox.y;
const PITCH = (SHEET_W + GAP_SHEETS_CM) * PXCM;
const ocupadas = getAbs().map(function (ab) { const b = ab.spreadBaseBox; return { x: b.x, y: b.y, w: b.width, h: b.height }; });
function vago(x) {
  const w = SHEET_W * PXCM, h = SHEET_H * PXCM;
  for (const b of ocupadas) {
    if (x < b.x + b.w - 1 && b.x < x + w - 1 && Y0 < b.y + b.h - 1 && b.y < Y0 + h - 1) return false;
  }
  return true;
}
const XS = [];
{
  let x = dtfBox.x + dtfBox.width + GAP_SHEETS_CM * PXCM, g = 0;
  for (let i = 0; i < finais.length; i++) {
    while (!vago(x) && g++ < 400) x += PITCH;
    XS.push(x);
    ocupadas.push({ x: x, y: Y0, w: SHEET_W * PXCM, h: SHEET_H * PXCM });
    x += PITCH;
  }
}
const CINZA = Colour.createRGBA8({ r: 128, g: 128, b: 128, alpha: 255 });
let baseNum = 0;
for (const ab of getAbs()) { const m = (ab.description || '').match(/^GANG SHEET (\d+)$/); if (m) baseNum = Math.max(baseNum, parseInt(m[1], 10)); }
const gsAbs = [];
limpaSelecao(d);
// todas com o comprimento maximo, para os rodapes ficarem na mesma linha;
// os metros contam so o que foi ocupado (regra do motor, 20/08/2026)
function alturaDaChapa(s, ehUltima) { return SHEET_H_MAX; }
for (let i = 0; i < finais.length; i++) {
  const x = XS[i];
  const altCm = alturaDaChapa(finais[i], i === finais.length - 1);
  finais[i].alturaCm = altCm;
  d.addRectangularArtboard(new Rectangle(x, Y0, SHEET_W * PXCM, altCm * PXCM));
  let novo = null;
  for (const ab of getAbs()) {
    const bb = ab.spreadBaseBox;
    if (Math.abs(bb.x - x) < 2 && Math.abs(bb.y - Y0) < 2 && !/^GANG SHEET \d+$/.test(ab.description || '')) novo = ab;
  }
  if (!novo) { console.log('AVISO: nao achei a prancheta criada em x=' + x); gsAbs.push(null); continue; }
  d.setLayerDescription('GANG SHEET ' + (baseNum + i + 1), Selection.create(d, novo.node));
  d.setBrushFillDescriptor(CINZA, Selection.create(d, novo.node));
  gsAbs.push(novo);
}
limpaSelecao(d);

function moveParaDentro(no, ab, nome) {
  let juntos = false;
  try {
    d.executeCommand(createCompoundCommand([
      selecaoVazia(d),
      DocumentCommand.createMoveNodes(Selection.create(d, no), ab.node, NodeMoveType.Inside, NodeChildType.Main),
      DocumentCommand.createSetDescription(Selection.create(d, no), nome)]));
    juntos = true;
  } catch (e) {}
  if (!juntos) {
    limpaSelecao(d);
    d.executeCommand(DocumentCommand.createMoveNodes(Selection.create(d, no), ab.node, NodeMoveType.Inside, NodeChildType.Main));
    d.setLayerDescription(nome, Selection.create(d, no));
  }
}
let spreadRaiz = null;
for (const sp of d.rootNode.children) { spreadRaiz = sp; break; }
function conta(pai) { let n = 0; for (const c of pai.children) n++; return n; }
const VERMELHO = FillDescriptor.createSolid(Colour.createRGBA8(LINHA_COR), BlendMode.Normal);

const contadores = {};
let okCount = 0, badCount = 0, PAROU = false, linhasOk = 0, linhasPedidas = 0, rotulosOk = 0, rotulosPedidos = 0;
// o nome do layout: texto artistico vermelho, medido e acertado para ROTULO_MM
function criaRotulo(txt) {
  const sb = StoryBuilder.create();
  sb.setToArtisticTextDefaultStyle(d.dpi, d.format);
  const ga = sb.glyphAtts;
  ga.setDoubleValue(GlyphAttDoubleType.Height, ROTULO_MM * MM);
  ga.brushFill = VERMELHO;
  sb.setGlyphAtts(ga);
  sb.addText(txt);
  const b = AddChildNodesCommandBuilder.create();
  try { b.setInsertionTarget(spreadRaiz); } catch (e) {}
  b.addNode(ArtTextNodeDefinition.createFromStoryBuilder({ x: 0, y: 0 }, sb));
  const antes = conta(spreadRaiz);
  d.executeCommand(comandoQuieto(b));
  const todos = []; for (const c of spreadRaiz.children) todos.push(c);
  return todos.slice(antes)[0] || null;
}
// a linha vermelha: retangulo cheio, em coordenada de spread
function desenhaLinha(ab, r, nomeLinha) {
  linhasPedidas++;
  try {
    const pc = PolyCurve.create(); pc.addCurve(Curve.createRectangle(r));
    const b = AddChildNodesCommandBuilder.create();
    try { b.setInsertionTarget(spreadRaiz); } catch (e) {}
    b.addNode(PolyCurveNodeDefinition.create(pc, VERMELHO, null, null, null));
    const antes = conta(spreadRaiz);
    d.executeCommand(comandoQuieto(b));
    const todos = []; for (const c of spreadRaiz.children) todos.push(c);
    const no = todos.slice(antes)[0];
    if (!no) throw new Error('a linha nao apareceu');
    moveParaDentro(no, ab, nomeLinha);
    const vb = no.getExactSpreadVisibleBox();
    if (Math.abs(vb.y - r.y) < 2 && Math.abs(vb.height - r.height) < 2 && Math.abs(vb.width - r.width) < 2) linhasOk++;
    else console.log('DIVERGENTE: ' + nomeLinha);
  } catch (e) { console.log('AVISO: nao desenhei ' + nomeLinha + ': ' + (e.message || e)); }
}
finais.forEach((s, si) => {
  if (PAROU || !gsAbs[si]) return;
  const ab = gsAbs[si];
  const box = ab.spreadBaseBox;           // a caixa real (a prancheta nasce no pixel inteiro)
  const ox = box.x, oy = box.y;
  let cnt = 0;
  for (const p of s.placements) {
    if ((cnt++ % 20) === 0 && pedidoDeParada()) { PAROU = true; break; }
    const it = items[p.key];
    const rad = p.ang * Math.PI / 180, co = Math.cos(rad), se = Math.sin(rad);
    const corners = [[it.vb.x, it.vb.y], [it.vb.x + it.vb.w, it.vb.y], [it.vb.x + it.vb.w, it.vb.y + it.vb.h], [it.vb.x, it.vb.y + it.vb.h]]
      .map(function (c) { return [c[0] * co - c[1] * se, c[0] * se + c[1] * co]; });
    let mx = 1e18, my = 1e18;
    for (const c of corners) { if (c[0] < mx) mx = c[0]; if (c[1] < my) my = c[1]; }
    const tx = ox + p.x * MM;
    const ty = oy + p.y * MM;
    const T = Transform.createTranslate(tx - mx, ty - my).multiply(Transform.createRotate(rad));
    const dup = it.node.duplicate(T);                       // SEMPRE do no de origem
    contadores[p.key] = (contadores[p.key] || 0) + 1;
    moveParaDentro(dup, ab, it.nome + ' ' + contadores[p.key] + '/' + it.qty);
    const vb2 = dup.getExactSpreadVisibleBox();
    const ew = p.ang % 180 === 0 ? it.vb.w : it.vb.h, eh = p.ang % 180 === 0 ? it.vb.h : it.vb.w;
    if (Math.abs(vb2.x - tx) < 5 && Math.abs(vb2.y - ty) < 5 && Math.abs(vb2.width - ew) < 5 && Math.abs(vb2.height - eh) < 5) okCount++;
    else { badCount++; console.log('DIVERGENTE: ' + it.nome); }
  }
  // os nomes dos layouts, as linhas deitadas que saem deles e as linhas em pe
  // entre os layouts da mesma prateleira
  for (const f of s.blocos) {
    if (PAROU) break;
    const topo = oy + f.y * MM, alt = ROTULO_MM * MM;
    let xLinha = ox + f.x * MM;
    rotulosPedidos++;
    try {
      const no = criaRotulo(f.texto);
      if (!no) throw new Error('o texto nao apareceu');
      const vb = no.getExactSpreadVisibleBox();
      const k = alt / vb.height;
      d.executeCommand(DocumentCommand.createTransform(Selection.create(d, no),
        Transform.createTranslate(ox + f.x * MM, topo).multiply(Transform.createScale(k, k)).multiply(Transform.createTranslate(-vb.x, -vb.y))));
      moveParaDentro(no, ab, f.texto + ' ROTULO');
      const v2 = no.getExactSpreadVisibleBox();
      if (Math.abs(v2.y - topo) < 2 && Math.abs(v2.height - alt) < 2) rotulosOk++;
      else console.log('DIVERGENTE: rotulo ' + f.texto);
      xLinha = v2.x + v2.width + VAO_ROTULO_MM * MM;
    } catch (e) { console.log('AVISO: nao escrevi o nome ' + f.texto + ': ' + (e.message || e)); }
    if (!f.linha) continue;
    const r = new Rectangle(xLinha, topo + (alt - LINHA_MM * MM) / 2, ox + f.x1 * MM - xLinha, LINHA_MM * MM);
    if (r.width > 1) desenhaLinha(ab, r, f.nome);
  }
  for (const v of s.linhasV) {
    if (PAROU) break;
    desenhaLinha(ab, new Rectangle(ox + v.x * MM, oy + v.y0 * MM, LINHA_MM * MM, (v.y1 - v.y0) * MM), v.nome);
  }
});
// ============================================================================
// RODAPE DE CADA PRANCHETA: metros a esquerda, ocupacao a direita
// Pedido do Henrique em 19/08/2026. Dois textos artisticos de 5 cm, POR FORA da
// prancheta, logo abaixo dela, para nao entrarem no filme impresso.
// Se qualquer coisa falhar aqui, o gang sheet ja esta pronto: o rodape e
// informacao, nao pode derrubar a montagem. Por isso tudo em try.
// ============================================================================
const RODAPE_CM = 5;        // corpo da fonte
const RODAPE_FOLGA_CM = 3;  // distancia entre a base da prancheta e o texto
const RODAPE_TOTAL_CM = 10; // corpo do total do pedido
const TOTAL_FOLGA_CM = 4;   // v8.4: distancia entre a linha do rodape e o TOTAL
try {
  let spreadRoot = null;
  for (const sp of d.rootNode.children) { spreadRoot = sp; break; }
  if (spreadRoot && gsAbs.length) {
    // v8.5: no Affinity 3.3.3 a cor tem de ser um objeto {r, g, b, alpha}
    const BRANCO = FillDescriptor.createSolid(Colour.createRGBA8({ r: 255, g: 255, b: 255, alpha: 255 }), BlendMode.Normal);
    const corpoU = RODAPE_CM * PXCM;
    function textoArtistico(txt) {
      const sb = StoryBuilder.create();
      sb.setToArtisticTextDefaultStyle(d.dpi, d.format);
      const ga = sb.glyphAtts;
      ga.setDoubleValue(GlyphAttDoubleType.Height, corpoU);
      ga.brushFill = BRANCO;
      sb.setGlyphAtts(ga);
      sb.addText(txt);
      return ArtTextNodeDefinition.createFromStoryBuilder({ x: 0, y: 0 }, sb);
    }
    function conta(pai) { let n = 0; for (const c of pai.children) n++; return n; }
    const b = AddChildNodesCommandBuilder.create();
    try { b.setInsertionTarget(spreadRoot); } catch (e) {}
    const alvos = [];
    finais.forEach(function (sh, i) {
      if (!gsAbs[i]) return;
      const cx = gsAbs[i].spreadBaseBox;
      const yTexto = cx.y + cx.height + RODAPE_FOLGA_CM * PXCM;
      const met = sh.metros.toFixed(2).replace('.', ',') + ' m';
      const ocu = sh.ocupacao.toFixed(1).replace('.', ',') + '%';
      b.addNode(textoArtistico(met));
      alvos.push({ x: cx.x, y: yTexto, dir: false, nome: 'GS' + (baseNum + i + 1) + ' METROS' });
      b.addNode(textoArtistico(ocu));
      alvos.push({ x: cx.x + cx.width, y: yTexto, dir: true, nome: 'GS' + (baseNum + i + 1) + ' OCUPACAO' });
    });
    // v8.4: o fundo real da linha do rodape (o texto mais baixo), para o TOTAL
    // ficar logo abaixo dele
    let fundoRodape = 0;
    if (alvos.length) {
      const antes = conta(spreadRoot);
      d.executeCommand(comandoQuieto(b));
      const todos = []; for (const c of spreadRoot.children) todos.push(c);
      const novos = todos.slice(antes);
      const cmds = [];
      novos.forEach(function (n, i) {
        const a = alvos[i];
        if (!a || !n) return;
        const vb = n.getExactSpreadVisibleBox();
        if (!vb || !isFinite(vb.x) || !(vb.width > 0)) return;
        // o texto nasce na linha de base; a posicao final e acertada medindo a caixa
        const destX = a.dir ? (a.x - vb.width) : a.x;
        cmds.push(DocumentCommand.createTransform(Selection.create(d, n),
          Transform.createTranslate(destX - vb.x, a.y - vb.y)));
        fundoRodape = Math.max(fundoRodape, a.y + vb.height);
        try { d.setLayerDescription(a.nome, Selection.create(d, n)); } catch (e) {}
      });
      // um a um de proposito: um texto que falhe nao pode derrubar os outros
      cmds.forEach(function (c) { try { d.executeCommand(c); } catch (err) {} });
      console.log('Rodape: ' + (alvos.length / 2) + ' prancheta(s) receberam metros e ocupacao.');
    }
    // TOTAL DO PEDIDO, 10 cm.
    // v8.4 (Henrique, 22/10/2026): saiu do lado da ultima prancheta e foi para
    // BAIXO do rodape, centralizado no conjunto de todas as folhas.
    try {
      const pri = gsAbs[0].spreadBaseBox;
      const ult = gsAbs[gsAbs.length - 1].spreadBaseBox;
      let fundoGS = 0;
      gsAbs.forEach(function (ab) { const bb = ab.spreadBaseBox; fundoGS = Math.max(fundoGS, bb.y + bb.height); });
      // se o rodape nao foi medido, conta a altura nominal dele
      const baseRodape = fundoRodape > 0 ? fundoRodape : (fundoGS + (RODAPE_FOLGA_CM + RODAPE_CM) * PXCM);
      const topoTotal = baseRodape + TOTAL_FOLGA_CM * PXCM;
      const centroX = (pri.x + ult.x + ult.width) / 2;
      const sbT = StoryBuilder.create();
      sbT.setToArtisticTextDefaultStyle(d.dpi, d.format);
      const gaT = sbT.glyphAtts;
      gaT.setDoubleValue(GlyphAttDoubleType.Height, RODAPE_TOTAL_CM * PXCM);
      gaT.brushFill = BRANCO;
      sbT.setGlyphAtts(gaT);
      sbT.addText('TOTAL  ' + (totalCm / 100).toFixed(2).replace('.', ',') + ' m');
      const antes2 = conta(spreadRoot);
      const bT = AddChildNodesCommandBuilder.create();
      try { bT.setInsertionTarget(spreadRoot); } catch (e) {}
      bT.addNode(ArtTextNodeDefinition.createFromStoryBuilder({ x: 0, y: 0 }, sbT));
      d.executeCommand(comandoQuieto(bT));
      const t2 = []; for (const c of spreadRoot.children) t2.push(c);
      const noT = t2.slice(antes2)[0];
      if (noT) {
        const vb = noT.getExactSpreadVisibleBox();
        if (vb && isFinite(vb.x)) {
          const dx = (centroX - vb.width / 2) - vb.x;
          const dy = topoTotal - vb.y;
          d.executeCommand(DocumentCommand.createTransform(Selection.create(d, noT),
            Transform.createTranslate(dx, dy)));
        }
        try { d.setLayerDescription('TOTAL DO PEDIDO', Selection.create(d, noT)); } catch (e) {}
      }
    } catch (e) { console.log('AVISO: nao escrevi o total: ' + (e.message || e)); }
  }
} catch (e) {
  console.log('AVISO: nao consegui escrever o rodape das pranchetas: ' + (e.message || e));
}

// ---------------------------- auditoria -------------------------------------
const SEGUNDOS = ((Date.now() - T0) / 1000);
let audit = (PAROU ? ('INTERROMPIDO PELO FREIO depois de ' + SEGUNDOS.toFixed(0) + 's, limite ' + TEMPO_MAX_S + 's\n') : '') + 'AUDITORIA\n';
let auditOk = true;
items.forEach(function (it, i) {
  const c = contadores[i] || 0;
  if (c !== it.qty) { auditOk = false; audit += '  ERRO ' + it.nome + ': pedidas ' + it.qty + ', colocadas ' + c + '\n'; }
});
if (auditOk) audit += '  copias por arte: todas exatas (' + totCopias + ' no total)\n';
audit += '  posicoes conferidas: ' + okCount + ' certas, ' + badCount + ' divergentes\n';
audit += '  nomes de layout: ' + rotulosOk + ' de ' + rotulosPedidos + '     linhas vermelhas: ' + linhasOk + ' de ' + linhasPedidas + '\n';
audit += plano;
limparFreio();
limpaSelecao(d);
console.log(audit);
app.alert('TERMINOU em ' + tempoTexto(SEGUNDOS) + '   |   TOTAL ' + (totalCm / 100).toFixed(2).replace('.', ',') + ' m\n\n' +
  VERSAO + '\n\n' + audit);
