/* O banco de mentira de testes/deposito.mjs: o depósito das pranchas 42 a 50 do
   wireframe do Estoque, versão 2 (04/10/2026). Sala de 15 m por 10 m, a escada
   no canto de baixo à esquerda, a prateleira D na parede esquerda, a prateleira
   A com os materiais e o resto do chão numa grade de 21 paletes.

   Os materiais são os de testes/materiais-dados.mjs. Nada aqui é dado de
   verdade. */
import * as D from './materiais-dados.mjs'

export const DEPOSITO = { id: 'dep-1', nome: 'Depósito de tecidos', largura: 15, fundo: 10 }

const base = (id, tipo, nome, x, y, largura, fundo, extra = {}) => ({
  id, tipo, nome, uso: extra.uso ?? '', x, y, largura, fundo, em_pe: !!extra.emPe,
  vaos: extra.vaos ?? 1, niveis: extra.niveis ?? 1, nomes_dos_vaos: extra.nomes ?? [], grade: extra.grade ?? null,
})
const doisDigitos = (n) => (n < 10 ? '0' + n : String(n))

/* a grade: 6 colunas por 4 fileiras, paletes de 1,3 m a cada 2 m; os 3 que cairiam na escada não existem */
const paletes = []
for (let f = 0; f < 4; f++) {
  for (let c = 0; c < 6; c++) {
    const x = +(2.1 + c * 2).toFixed(2); const y = +(1.6 + f * 2).toFixed(2)
    if (y + 1.3 > 8.1 && x < 6.9) continue
    paletes.push(base('pal-' + doisDigitos(paletes.length + 1), 'palete', 'P' + doisDigitos(paletes.length + 1), x, y, 1.3, 1.3, { grade: 'grade-1', uso: 'Tecido' }))
  }
}
export const moveis = [
  base('prat-a', 'prateleira', 'A', 1, 0.25, 6, 0.7, { uso: 'Aviamentos e insumos', vaos: 4, niveis: 4, nomes: ['A1', 'A2', 'A3', 'A4'] }),
  base('prat-d', 'prateleira', 'D', 0.25, 2.2, 0.7, 6, { uso: 'Tecido', emPe: true, vaos: 4, niveis: 4, nomes: ['D1', 'D2', 'D3', 'D4'] }),
  base('escada', 'escada', 'Escada · entrada', 0, 8.4, 6.4, 1.6),
  ...paletes,
]

/* O DEPÓSITO ESTICADO: é o que o Henrique tinha salvo em 05/10/2026 quando achou
   o defeito da grade. Uma grade de 2 fileiras por 3 colunas puxada pelo canto
   até ocupar o chão (4,3 m entre os paletes), a escada embaixo e uma prateleira
   na parede esquerda. Com o vão de 4,3 m não há chão para uma terceira fileira
   nem para uma quarta coluna. */
export const moveisEsticados = [
  base('escada', 'escada', 'Escada', 0, 8.6, 4, 1.2),
  base('prat-a', 'prateleira', 'A', 0.1, 3.8, 0.7, 4, { emPe: true, vaos: 4, niveis: 4, nomes: ['A1', 'A2', 'A3', 'A4'] }),
  ...[[2, 1.1], [7.5, 1.1], [13, 1.1], [2, 6.6], [7.5, 6.6], [13, 6.6]].map(([x, y], i) => base('pe-' + (i + 1), 'palete', 'P0' + (i + 1), x, y, 1.2, 1.2, { grade: 'grade-e' })),
]

const M = (nome) => D.materiais.find((m) => m.nome === nome)
let n = 0
const lugar = (nome, movelId, vao, nivel, principal = true) => {
  const mv = moveis.find((m) => m.id === movelId)
  const vaoNome = vao ? mv.nomes_dos_vaos[vao - 1] : null
  return {
    id: 'l' + (++n), material_id: M(nome).id, movel_id: movelId, tipo: mv.tipo, movel: mv.nome, vao, vao_nome: vaoNome, nivel, principal,
    codigo: vao ? vaoNome + (nivel ? '-' + nivel : '') : mv.nome, criado_em: '2026-10-04T12:00:00Z',
  }
}
export const lugares = [
  /* a prateleira D, vão 2: as quatro cores do dry fit, uma por nível, e o piquet branco dividindo o nível 1 */
  lugar('DRYFIT POLIESTER 100% · Branco', 'prat-d', 2, 1),
  lugar('DRYFIT POLIESTER 100% · Preto', 'prat-d', 2, 2),
  lugar('DRYFIT POLIESTER 100% · Azul Marinho', 'prat-d', 2, 3),
  lugar('DRYFIT POLIESTER 100% · Vermelho Fourtime', 'prat-d', 2, 4),
  lugar('PIQUET 100% · Branco', 'prat-d', 2, 1),
  lugar('PIQUET 100% · Azul Marinho', 'prat-d', 1, 2),
  /* o dry fit preto não coube: o resto está no palete P11 */
  lugar('DRYFIT POLIESTER 100% · Preto', 'pal-11', null, null, false),
  lugar('ALGODAO 100% · Preto', 'pal-01', null, null),
  lugar('ALGODAO MESCLA SEM ELASTANO · Cinza Mescla', 'pal-01', null, null),
  lugar('MOLETOM · Preto', 'prat-d', 3, null),
  /* a prateleira A: aviamentos e insumos */
  lugar('Linha poliéster 120 branca', 'prat-a', 1, 2),
  lugar('Linha poliéster 120 preta', 'prat-a', 1, 2),
  lugar('Elástico 30 mm', 'prat-a', 1, 3),
  lugar('Cadarço 6 mm branco', 'prat-a', 1, 3),
  lugar('Botão 4 furos 18 mm', 'prat-a', 2, 1),
  lugar('Etiqueta Fourtime tecida', 'prat-a', 2, 2),
  lugar('Gola retilínea piquet marinho', 'prat-a', 2, 4),
  lugar('Filme DTF 60 cm', 'prat-a', 3, 1),
  lugar('Pó DTF hot melt', 'prat-a', 3, 2),
  lugar('Tinta DTF branca', 'prat-a', 3, 2),
  lugar('Tinta sublimática magenta', 'prat-a', 4, 1),
  lugar('Tinta sublimática ciano', 'prat-a', 4, 1),
  lugar('Papel sublimático 100 g', 'pal-21', null, null),
]
/* sem lugar: HELANCA COLEGIAL · Azul Marinho, Tela de silk, Tinta silk e Saco de embalagem */
export const SEM_LUGAR = D.materiais.filter((m) => !lugares.some((l) => l.material_id === m.id)).map((m) => m.nome)

/* A PRATELEIRA DE NOVE NÍVEIS (pedido do Henrique de 06/10/2026, migração 054):
   a prateleira D sobe de 4 para 9 níveis, e o vão D2 ganha um material em cada
   nível novo, do 5 ao 9. São segundos lugares de materiais que já tinham um, e
   por isso a lista de quem está sem lugar continua a mesma. */
export const moveisDeNove = moveis.map((m) => (m.id === 'prat-d' ? { ...m, niveis: 9 } : m))
export const lugaresDeNove = [
  ...lugares,
  lugar('ALGODAO 100% · Preto', 'prat-d', 2, 5, false),
  lugar('ALGODAO MESCLA SEM ELASTANO · Cinza Mescla', 'prat-d', 2, 6, false),
  lugar('MOLETOM · Preto', 'prat-d', 2, 7, false),
  lugar('PIQUET 100% · Azul Marinho', 'prat-d', 2, 8, false),
  lugar('Papel sublimático 100 g', 'prat-d', 2, 9, false),
]
