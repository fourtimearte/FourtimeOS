/* O banco de mentira da página Fichas técnicas. Quem usa: testes/produtos.mjs.

   NENHUM NÚMERO DAQUI É DA FÁBRICA, a não ser a área da FT-010-000M, que é a
   do estudo de moldes (PP 0,8204 m2 a G4 1,3964 m2, com 82% de
   aproveitamento). As medidas, as partes e os aviamentos são de exemplo.

   O BANCO GUARDA O QUE A PÁGINA GRAVA: a ficha salva aparece na leitura
   seguinte, o molde trocado também, e a referência criada entra na lista.
   Sem isso a prova só mostraria que a página manda, e não que ela lê de volta
   o que mandou. */
import * as D from './materiais-dados.mjs'

export const ADULTA = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', 'G4']
export const INFANTIL = ['2A', '4A', '6A', '8A', '10A', '12A', '14A']

export const grupos = [
  { cod: '010', nome: 'Camisetas e polos', ordem: 10 },
  { cod: '020', nome: 'Raglan', ordem: 20 },
  { cod: '070', nome: 'Calças', ordem: 70 },
  { cod: '090', nome: 'Calções', ordem: 90 },
  { cod: 'KIT', nome: 'Kits (conjuntos)', ordem: 990 },
]

/* a área líquida do estudo de moldes, e o que ela dá com a perda do corte */
const LIQUIDA = [0.8204, 0.8703, 0.9215, 0.9738, 1.0401, 1.1077, 1.1775, 1.2487, 1.3219, 1.3964]
export const BRUTA = LIQUIDA.map((a) => a / 0.82)
const quatro = (v) => Math.round(v * 10000) / 10000
const porTamanho = (lista, valores) => Object.fromEntries(lista.map((t, i) => [t, valores[i]]).filter(([, v]) => v !== undefined && v !== null))
const parte = (fatia) => porTamanho(ADULTA, BRUTA.map((a) => quatro(a * fatia)))

export const MOLDE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" width="420" height="220"><g fill="none" stroke="#000" stroke-width="2"><path d="M36,12 Q60,44 84,12 L108,24 Q92,50 106,80 L106,196 L14,196 L14,80 Q28,50 12,24 Z"/><path transform="translate(130 0)" d="M36,12 Q60,24 84,12 L108,24 Q92,50 106,80 L106,196 L14,196 L14,80 Q28,50 12,24 Z"/><path transform="translate(270 10)" d="M6,62 Q48,2 90,62 L82,92 L14,92 Z"/><path transform="translate(270 110)" d="M6,62 Q48,2 90,62 L82,92 L14,92 Z"/></g></svg>'
export const OUTRO_MOLDE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" width="200" height="120"><rect x="10" y="10" width="180" height="100" fill="none" stroke="#000" stroke-width="2"/></svg>'

/* UM MOLDE COMO O AFFINITY EXPORTA: sem tamanho de verdade (100%), com o fundo
   da prancha, a prancheta embrulhando tudo, uma camada por parte (o nome vem em
   serif:id), matriz em cima de matriz, um bolso desenhado dentro da frente, um
   botão girado e um pique solto. As caixas, na unidade do desenho:
     Frente 220 x 294 · Costas 220 x 300 · Manga 176 x 98, duas vezes ·
     Gola 192 x 18 · Botão 18 x 18 (girado 45 graus: a caixa da caixa daria 25,5)
   A 0,25 cm por unidade: 55,0 x 73,5 · 55,0 x 75,0 · 44,0 x 24,5 · 48,0 x 4,5. */
const MIOLO_DO_MOLDE = '<rect x="0" y="0" width="1000" height="600" style="fill:white;"/>'
  + '<g id="Artboard1" serif:id="Artboard1"><g transform="matrix(1,0,0,1,0,0)">'
  + '<g id="Frente" serif:id="Frente" transform="matrix(2,0,0,2,0,0)"><path d="M20,20L130,20L130,167L20,167Z" style="fill:white;stroke:black;stroke-width:1px;"/><rect id="Bolso" x="50" y="45" width="25" height="25" style="fill:none;stroke:black;stroke-width:0.5px;"/></g>'
  + '<g id="Costas" serif:id="COSTAS" transform="matrix(1,0,0,1,300,40)"><path d="M0,0L220,0L220,300L0,300Z" style="fill:white;stroke:black;stroke-width:2px;"/></g>'
  + '<g id="Manga" serif:id="Manga"><path d="M0,98Q88,-98 176,98Z" transform="matrix(1,0,0,1,560,40)" style="fill:white;stroke:black;stroke-width:2px;"/></g>'
  + '<g id="Manga1" serif:id="Manga"><path d="M0,98Q88,-98 176,98Z" transform="matrix(1,0,0,1,560,180)" style="fill:white;stroke:black;stroke-width:2px;"/></g>'
  + '<path id="Gola" d="M780,40h192v18h-192Z" style="fill:white;stroke:black;stroke-width:2px;"/>'
  + '<circle id="Botao" cx="0" cy="0" r="9" transform="translate(880,300) rotate(45)" style="fill:white;stroke:black;stroke-width:2px;"/>'
  + '<path d="M40,560L70,560" style="fill:none;stroke:black;stroke-width:1px;"/>'
  + '</g></g>'
const CASCA_DO_MOLDE = (tamanho) => `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg ${tamanho} viewBox="0 0 1000 600" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;">${MIOLO_DO_MOLDE}</svg>`
export const MOLDE_DE_CAMADAS = CASCA_DO_MOLDE('width="100%" height="100%"')
/* o mesmo desenho, dizendo o tamanho: 500 mm de largura para 1000 unidades, 0,05 cm por unidade */
export const MOLDE_EM_MM = CASCA_DO_MOLDE('width="500mm" height="300mm"')

/* as fichas, por id da referência: o que as tabelas filhas guardam */
const FICHAS = {
  r000: {
    medidas: [
      { nome: 'Comprimento', como_medir: 'do ombro à barra', valores: porTamanho(ADULTA, [66, 68, 70, 72, 74, 76, 78, 80, 82, 84]) },
      { nome: 'Largura', como_medir: 'de axila a axila', valores: porTamanho(ADULTA, [47, 50, 53, 56, 59, 62, 65, 68, 71, 74]) },
      { nome: 'Manga', como_medir: 'do ombro à bainha', valores: porTamanho(ADULTA, [19, 20, 21, 22, 23, 24, 25, 26, 27, 28.5]) },
    ],
    partes: [
      { nome: 'Frente', vezes: 1, unidade: 'm2', quantidades: parte(0.36) },
      { nome: 'Costas', vezes: 1, unidade: 'm2', quantidades: parte(0.37) },
      { nome: 'Mangas', vezes: 2, unidade: 'm2', quantidades: parte(0.27) },
      { nome: 'Ribana da gola', vezes: 1, unidade: 'm', quantidades: porTamanho(ADULTA, [0.44, 0.45, 0.46, 0.47, 0.48, 0.49, 0.5, 0.51]) },
    ],
    materiais: [
      { material_id: 'av1', nome: 'Linha poliéster 120', quantidade: 0.02, unidade: 'cone' },
      { material_id: null, nome: 'Fio texturizado, na cor do tecido', quantidade: 0.03, unidade: 'cone' },
      { material_id: 'in1', nome: 'Saco de embalagem 30x40', quantidade: 1, unidade: 'un' },
    ],
    molde: MOLDE,
  },
  r004: {
    medidas: [
      { nome: 'Comprimento', como_medir: 'do ombro à barra', valores: porTamanho(ADULTA, [56, 58, 60, 62, 64, 66]) },
      { nome: 'Largura', como_medir: '', valores: porTamanho(ADULTA, [40, 42, 44, 46, 48, 50]) },
    ],
    partes: [],
    materiais: [],
    molde: null,
  },
  r070: {
    medidas: [
      { nome: 'Cintura', como_medir: 'de lado a lado, sem esticar', valores: { PP: 34, P: 36, M: 38, G: 40, GG: 42, '10A': 28, '12A': 30, '14A': 32 } },
      { nome: 'Quadril', como_medir: '', valores: { PP: 46, P: 48, M: 50, G: 52, GG: 54, '10A': 38, '12A': 40, '14A': 42 } },
      { nome: 'Gancho', como_medir: 'do cós ao fundo', valores: { PP: 27, P: 28, M: 29, G: 30, GG: 31 } },
      { nome: 'Entrepernas', como_medir: 'do fundo à barra', valores: { PP: 72, P: 74, M: 76, G: 78, GG: 80, '10A': 58, '12A': 62, '14A': 66 } },
      { nome: 'Boca da perna', como_medir: '', valores: { PP: 16, P: 17, M: 18, G: 19, GG: 20 } },
    ],
    partes: [
      { nome: 'Perna', vezes: 2, unidade: 'm2', quantidades: { PP: 1.02, P: 1.08, M: 1.14, G: 1.2, GG: 1.27, '10A': 0.71, '12A': 0.78, '14A': 0.86 } },
      { nome: 'Cós', vezes: 1, unidade: 'm2', quantidades: { PP: 0.07, P: 0.07, M: 0.08, G: 0.08, GG: 0.09 } },
    ],
    materiais: [],
    molde: null,
  },
}

const ref = (id, cod, nome, grupo, genero, extra = {}) => ({ id, cod, nome, grupo, genero, ordem: 0, ativo: true, detalhes: {}, observacao: '', tamanhos: [], ficha_em: null, ...extra })
const REFERENCIAS = [
  ref('r000', 'FT-010-000M', 'CAMISETA MASC TRAD', '010', 'M', { detalhes: { gola: 'Redonda, ribana 1x1 de 2 cm', manga: 'Curta, com bainha', punho: 'Sem punho', barra: 'Bainha de 2 cm', costura: 'Overloque de 4 fios e galoneira' }, observacao: 'Reforço de ombro a ombro. Bainha da manga com 2 cm.', tamanhos: ADULTA, ficha_em: '2026-10-05T14:10:00Z' }),
  ref('r001', 'FT-010-001M', 'CAMISETA MASC TRAD GOLA V', '010', 'M'),
  ref('r004', 'FT-010-004F', 'BABY LOOK', '010', 'F', { tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'XG'], ficha_em: '2026-10-04T10:00:00Z' }),
  ref('r008', 'FT-010-008C', 'CAMISETA INFANTIL UNISSEX', '010', 'C'),
  ref('r020', 'FT-020-000M', 'RAGLAN MASC SEM PUNHO', '020', 'M'),
  ref('r070', 'FT-070-000M', 'CALÇA MOLETOM MASC TRAD CORTE RETO SEM PUNHO', '070', 'M', { tamanhos: ['PP', 'P', 'M', 'G', 'GG', '10A', '12A', '14A'], ficha_em: '2026-10-03T09:00:00Z', detalhes: { costura: 'Overloque de 4 fios, reta no cós' } }),
  ref('r090', 'FT-090-000M', 'CALÇAO MASC SEM BOLSO', '090', 'M'),
  ref('rkit', 'FT-KIT-020-000M-090-000M', 'KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO', 'KIT', 'M'),
  ref('rsem', '', 'ALGODAO PIMA', null, ''),
]

export const tecidos = [
  { id: 't1', nome: 'DRYFIT POLIESTER 100%', gramatura: '180.00', largura: '1.600', ordem: 1, ativo: true },
  { id: 't2', nome: 'MOLETOM 3 CABOS', gramatura: '310.00', largura: '1.850', ordem: 2, ativo: true },
  { id: 't3', nome: 'DRYFIT JAKAR 100%', gramatura: null, largura: null, ordem: 3, ativo: true },
]
export const doEstoque = [
  { id: 'av1', nome: 'Linha poliéster 120', categoria: 'aviamento', unidade: 'cone', grupo: 'Linha' },
  { id: 'av2', nome: 'Elástico 30 mm', categoria: 'aviamento', unidade: 'm', grupo: 'Elástico' },
  { id: 'av3', nome: 'Cordão de poliéster', categoria: 'aviamento', unidade: 'm', grupo: 'Cordão' },
  { id: 'in1', nome: 'Saco de embalagem 30x40', categoria: 'insumo', unidade: 'un', grupo: 'Embalagem' },
]

/* o perfil de quem abre: 'chefe' é o administrador, 'edita' muda a ficha mas
   não cria nem exclui referência (não é chefia), 'le' só vê, 'fora' nem tem a página */
export function perfil(acesso) {
  const [p] = D.perfil('admin')
  if (acesso === 'edita') { p.papel = 'estoquista'; p.nome = 'Estoquista'; p.permissoes.produtos = { ver: true, editar: true, deletar: true, total: false } }
  if (acesso === 'le') { p.papel = 'vendedor'; p.nome = 'Vendedor'; p.permissoes.produtos = { ver: true, editar: false, deletar: false, total: false }; delete p.permissoes.kanban; p.paineis = p.paineis.filter((k) => k !== 'kanban') }
  if (acesso === 'fora') { p.papel = 'vendedor'; p.nome = 'Vendedor'; delete p.permissoes.produtos; p.paineis = p.paineis.filter((k) => k !== 'produtos') }
  return [p]
}

/* As peças de cada kit, por id do kit: o que a tabela peca_do_kit guarda. O kit
   do catálogo nasce como a migração 051 o deixa: as duas peças lidas do
   código, sem tecido, sem etiqueta e sem desenho. */
const PECAS_DOS_KITS = {
  rkit: [
    { referencia_id: 'r020', papel: 'Parte de cima', tecidos: [], design: [], etiqueta: '', etiqueta_onde: '', observacao: '' },
    { referencia_id: 'r090', papel: 'Parte de baixo', tecidos: [], design: [], etiqueta: '', etiqueta_onde: '', observacao: '' },
  ],
}

/* As listas dos detalhes de peça (migração 058): o catálogo dos nomes que se
   pode escolher. A lista de PUNHOS NASCE VAZIA de propósito: a camiseta diz
   "Sem punho", que então não é de lista nenhuma, e a prova vê o seletor
   mostrar o texto de antes das listas em vez de escondê-lo. */
const item = (id, detalhe, nome, ordem) => ({ id, detalhe, nome, ordem })
const ITENS_DE_DETALHE = [
  item('ig1', 'gola', 'Redonda, ribana 1x1 de 2 cm', 1), item('ig2', 'gola', 'Gola V', 2), item('ig3', 'gola', 'Polo', 3),
  item('im1', 'manga', 'Curta, com bainha', 1), item('im2', 'manga', 'Longa', 2),
  item('ib1', 'barra', 'Bainha de 2 cm', 1),
  item('ic1', 'costura', 'Overloque de 4 fios e galoneira', 1), item('ic2', 'costura', 'Overloque de 4 fios, reta no cós', 2),
]

/* ---- as vendas: os layouts dos pedidos, como a view layout_na_fabrica devolve ----
   O DIA DE HOJE DA PROVA É 06/10/2026, 15h em Goiânia (a prova trava o relógio
   da página nele). Os números que a prova espera estão somados à mão em
   testes/produtos.mjs, ao lado de cada conferência. */
export const HOJE_DA_PROVA = '2026-10-06T15:00:00-03:00'
const em = (dia, hora = '12:00') => `${dia}T${hora}:00-03:00`
const PEDIDOS = {
  p1: { numero: 'PD-0412', cliente: 'Atlético Exemplo', estado: 'producao', etapa: 'costura', etapa_em: em('2026-10-04', '09:00'), aprovado_em: em('2026-09-20'), fechado_em: null, teste: false },
  p2: { numero: 'PD-0409', cliente: 'Escola Exemplo', estado: 'pronto', etapa: 'finalizado', etapa_em: em('2026-10-05', '16:42'), aprovado_em: em('2026-10-02', '10:00'), fechado_em: em('2026-10-05', '16:42'), teste: false },
  /* entregue e enviado (p9) são pedidos que já saíram da fábrica: continuam contando como peça pronta */
  p3: { numero: 'PD-0390', cliente: 'Clube Exemplo', estado: 'entregue', etapa: 'finalizado', etapa_em: em('2026-09-28', '15:30'), aprovado_em: em('2026-09-03'), fechado_em: em('2026-09-28', '15:30'), teste: false },
  p4: { numero: 'PD-0420', cliente: 'Academia Exemplo', estado: 'producao', etapa: 'corte', etapa_em: em('2026-10-03', '08:00'), aprovado_em: em('2026-10-03', '07:00'), fechado_em: null, teste: true },
  p5: { numero: 'PD-0421', cliente: 'Auto Peças Exemplo', estado: 'pcp', etapa: 'corte', etapa_em: em('2026-10-05'), aprovado_em: em('2026-10-05'), fechado_em: null, teste: false },
  p7: { numero: 'PD-0422', cliente: 'Escolinha Exemplo', estado: 'aprovado', etapa: 'corte', etapa_em: em('2026-10-04'), aprovado_em: em('2026-10-04'), fechado_em: null, teste: false },
  p8: { numero: 'PD-0400', cliente: 'Loja Exemplo', estado: 'separacao', etapa: 'corte', etapa_em: em('2026-09-10'), aprovado_em: em('2026-09-10'), fechado_em: null, teste: false },
  p9: { numero: 'PD-0101', cliente: 'Cliente Antigo Exemplo', estado: 'enviado', etapa: 'finalizado', etapa_em: em('2025-02-20'), aprovado_em: em('2025-01-15'), fechado_em: em('2025-02-20'), teste: false },
}
const CAMISETA = { referencia: 'FT-010-000M', nome: 'CAMISETA MASC TRAD', referencia_id: 'r000', kit: false }
const KIT_DA_PROVA = { referencia: 'FT-KIT-020-000M-090-000M', nome: 'KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO', referencia_id: 'rkit', kit: true }
const lay = (pedido, ordem, peca, arte, grade, tecnicas) => ({ pedido_id: pedido, ...PEDIDOS[pedido], pedido_nome: '', ordem, layout: ordem, genero: 'masculino', faixa: 'adulto', ...peca, arte, grade, pecas: Object.values(grade).reduce((a, n) => a + n, 0), tecnicas })
const LAYOUTS = [
  lay('p1', 1, KIT_DA_PROVA, 'linha', { P: 10, M: 32, G: 30, GG: 14, XG: 3 }, ['subli', 'patch']),
  /* a grade fora de ordem, como o orçamento pode guardar: a tela é que põe na ordem da fábrica */
  lay('p1', 2, CAMISETA, 'goleiro', { GG: 2, M: 2, G: 4 }, ['subli']),
  lay('p1', 3, CAMISETA, 'comissão', { P: 20, M: 48, G: 44, GG: 24, XG: 7 }, ['dtf']),
  lay('p2', 1, { referencia: 'FT-010-008C', nome: 'CAMISETA INFANTIL UNISSEX', referencia_id: 'r008', kit: false }, 'uniforme', { '4A': 8, '6A': 14, '8A': 18, '10A': 14, '12A': 10 }, ['silk']),
  lay('p3', 1, { referencia: 'FT-020-000M', nome: 'RAGLAN MASC SEM PUNHO', referencia_id: 'r020', kit: false }, 'treino', { P: 12, M: 38, G: 40, GG: 22, XG: 8 }, ['subli']),
  lay('p4', 1, { referencia: '', nome: 'PEÇA LISA', referencia_id: null, kit: false }, '', { M: 20 }, []),
  /* o orçamento guardou um nome que a referência já não tem: nas vendas vale o nome de hoje */
  lay('p5', 1, { ...CAMISETA, nome: 'CAMISETA MASCULINA TRADICIONAL' }, 'polo', { P: 10, GG: 20 }, ['bordado']),
  lay('p7', 1, KIT_DA_PROVA, '', { M: 10 }, ['subli']),
  lay('p8', 1, { referencia: 'FT-010-004F', nome: 'BABY LOOK', referencia_id: 'r004', kit: false }, '', { P: 40, M: 60 }, ['subli']),
  lay('p9', 1, CAMISETA, '', { M: 500 }, ['subli']),
]
const fat = (id, pedido, tecnica, etapa, quando, layouts, fechou = null) => ({ id, pedido_id: pedido, tecnica, etapa, etapa_em: quando, fechado_em: fechou, layouts, estado: PEDIDOS[pedido].estado })
const FATIAS = [
  fat('f1', 'p1', 'subli', 'finalizado', em('2026-10-06', '14:10'), [1, 2], em('2026-10-06', '14:10')),
  fat('f2', 'p1', 'patch', 'finalizado', em('2026-10-05', '11:00'), [1], em('2026-10-05', '11:00')),
  fat('f3', 'p1', 'dtf', 'costura', em('2026-10-04', '09:00'), [3]),
  fat('f4', 'p2', 'silk', 'finalizado', em('2026-10-05', '16:42'), [1], em('2026-10-05', '16:42')),
  fat('f5', 'p3', 'subli', 'finalizado', em('2026-09-28', '15:30'), [1], em('2026-09-28', '15:30')),
]
/* quinze peças fora do catálogo, cada uma com uma quantidade: mais do que o ranking mostra de primeira */
const LAYOUTS_VARIADOS = Array.from({ length: 15 }, (_, i) => ({ ...lay('p5', 1, { referencia: '', nome: 'PEÇA ' + String(i + 1).padStart(2, '0'), referencia_id: null, kit: false }, '', { M: 150 - i * 10 }, ['subli']), pedido_id: 'v' + i, numero: 'PD-V' + i }))
/* dois mil e trezentos layouts de uma peça cada: mais do que o banco devolve de uma vez */
const MUITOS_LAYOUTS = Array.from({ length: 2300 }, (_, i) => ({ ...lay('p5', 1, CAMISETA, '', { M: 1 }, ['subli']), pedido_id: 'm' + String(i).padStart(4, '0'), numero: 'PD-M' + String(i).padStart(4, '0') }))

const copia = (x) => JSON.parse(JSON.stringify(x))

/* `estado`: 'cheio' (o de cima), 'vazio' (nenhuma referência), 'erro' (a
   leitura da lista falha), 'sem-apoio' (o catálogo de tecidos e o Estoque não
   respondem, e a página tem de continuar de pé).
   `recusa`: o salvar da ficha recusa uma vez, do jeito que a função do banco recusa.
   `vendas`: 'cheias' (as de cima), 'vazias' (nenhum pedido), 'erro' (a leitura
   dos layouts falha), 'muitas' (2.300 layouts, para a leitura de mil em mil) ou
   'variadas' (quinze peças diferentes, para o ranking que abre o resto). */
export function bancoDasFichas({ estado = 'cheio', recusa = 0, vendas = 'cheias' } = {}) {
  const semVenda = vendas === 'vazias' || estado === 'vazio'
  const layouts = semVenda ? [] : vendas === 'muitas' ? MUITOS_LAYOUTS : vendas === 'variadas' ? LAYOUTS_VARIADOS : copia(LAYOUTS)
  const fatias = semVenda || vendas === 'muitas' || vendas === 'variadas' ? [] : copia(FATIAS)
  /* os pedidos de leitura que a página fez, para a prova ver o que ela pediu */
  const lidos = []
  /* devolve o pedaço que o endereço pede: limit e offset, como o banco */
  const pedaco = (u, lista) => {
    const limite = Number((u.match(/[?&]limit=(\d+)/) ?? [])[1] ?? 1000)
    const de = Number((u.match(/[?&]offset=(\d+)/) ?? [])[1] ?? 0)
    /* o banco nunca devolve mais de mil de uma vez, peça o que pedir */
    return lista.slice(de, de + Math.min(limite, 1000))
  }
  const refs = estado === 'vazio' ? [] : copia(REFERENCIAS)
  const fichas = copia(FICHAS)
  const pecasDosKits = estado === 'vazio' ? {} : copia(PECAS_DOS_KITS)
  const itens = estado === 'vazio' ? [] : copia(ITENS_DE_DETALHE)
  const igual = (x, y) => (x ?? '').trim().toLowerCase() === (y ?? '').trim().toLowerCase()
  /* o item como a view item_de_detalhe_na_lista devolve: com quem usa o nome */
  const itemNaLista = (i) => ({
    ...i,
    referencias: refs.filter((r) => r.grupo !== 'KIT' && igual(r.detalhes?.[i.detalhe], i.nome)).length,
    kits: Object.values(pecasDosKits).flat().filter((p) => igual(p.detalhes_do_kit?.[i.detalhe], i.nome)).length,
  })
  const ORDEM_DOS_DETALHES = ['barra', 'costura', 'gola', 'manga', 'punho']
  const gravados = []
  let recusas = recusa
  let novos = 0
  let itensNovos = 0
  const fichaDe = (id) => (fichas[id] ??= { medidas: [], partes: [], materiais: [], molde: null })
  /* o molde de cada tamanho e a escala acertada de cada molde ('' é o geral) */
  const moldesDe = (id) => (fichaDe(id).moldes ??= {})
  const escalasDe = (id) => (fichaDe(id).escalas ??= {})
  const comNumero = (lista, campo) => lista.filter((x) => Object.keys(x[campo] ?? {}).length).length
  /* a linha como a view referencia_na_ficha devolve */
  const naLista = (r) => {
    const f = fichaDe(r.id)
    return { ...r, medidas: comNumero(f.medidas, 'valores'), partes_com_tecido: comNumero(f.partes, 'quantidades'), materiais: f.materiais.length, tem_molde: !!f.molde }
  }
  const idDe = (u, campo) => (u.match(new RegExp(campo + '=eq\\.([^&]+)')) ?? [])[1]

  /* o kit como a view kit_na_ficha devolve */
  const kitNaLista = (k) => {
    const ps = pecasDosKits[k.id] ?? []
    return { id: k.id, cod: k.cod, nome: k.nome, genero: k.genero, ativo: k.ativo, ficha_em: k.ficha_em, pecas: ps.length, pecas_cod: ps.map((p) => refs.find((r) => r.id === p.referencia_id)?.cod ?? ''), pecas_sem_tecido: ps.filter((p) => !p.tecidos.length).length, pecas_sem_etiqueta: ps.filter((p) => !p.etiqueta).length, tem_desenho: !!fichaDe(k.id).molde }
  }
  /* a peça como a view peca_do_kit_na_lista devolve */
  const pecaNaLista = (kitId) => (p, ordem) => {
    const k = refs.find((x) => x.id === kitId); const r = refs.find((x) => x.id === p.referencia_id)
    return { kit_id: kitId, kit_cod: k.cod, kit_nome: k.nome, kit_ativo: k.ativo, referencia_id: r.id, cod: r.cod, nome: r.nome, genero: r.genero, grupo: r.grupo, detalhes: r.detalhes, detalhes_do_kit: {}, tamanhos: r.tamanhos, ordem, ...p }
  }

  /* devolve { status, corpo } para um pedido ao banco, ou nulo se não é com ele */
  function responder(metodo, u, corpo) {
    if (u.includes('meu_perfil')) return null
    if (u.includes('rpc/salvar_ficha_da_referencia')) {
      gravados.push({ u: 'rpc/salvar_ficha_da_referencia', corpo })
      if (recusas > 0) { recusas--; return { status: 400, corpo: { code: '23514', message: 'A medida "Comprimento" está duas vezes na tabela.' } } }
      const r = refs.find((x) => x.id === corpo.p_referencia)
      if (!r) return { status: 404, corpo: { code: 'P0002', message: 'Referência não encontrada.' } }
      const f = corpo.p_ficha
      Object.assign(r, { nome: f.nome, detalhes: f.detalhes, observacao: f.observacao, tamanhos: f.tamanhos, ficha_em: '2026-10-06T12:00:00Z' })
      Object.assign(fichaDe(r.id), { medidas: f.medidas, partes: f.partes, materiais: f.materiais })
      return { status: 200, corpo: r.ficha_em }
    }
    if (u.includes('rpc/salvar_kit')) {
      gravados.push({ u: 'rpc/salvar_kit', corpo })
      if (recusas > 0) { recusas--; return { status: 400, corpo: { code: '23514', message: 'Em "CAMISETA MASC TRAD", escolha o tecido de "Mangas" no catálogo.' } } }
      const f = corpo.p_ficha
      const cods = f.pecas.map((p) => refs.find((r) => r.id === p.referencia_id).cod)
      const cod = 'FT-KIT-' + cods.map((c) => c.replace(/^FT-/, '')).join('-')
      let kit = corpo.p_kit ? refs.find((x) => x.id === corpo.p_kit) : null
      if (corpo.p_kit && (!kit || kit.cod !== cod)) return { status: 400, corpo: { code: '23514', message: 'As peças de um kit não mudam depois de criado: o código dele é feito delas. Para outras peças, crie outro kit.' } }
      if (!kit) {
        if (refs.some((x) => x.cod === cod)) return { status: 409, corpo: { code: '23505', message: 'Já existe um kit com estas peças, nesta ordem.' } }
        novos += 1
        const generos = new Set(f.pecas.map((p) => refs.find((r) => r.id === p.referencia_id).genero))
        kit = ref('kit' + novos, cod, f.nome, 'KIT', generos.size === 1 ? [...generos][0] : 'U')
        refs.push(kit)
      }
      Object.assign(kit, { nome: f.nome, ficha_em: '2026-10-06T12:00:00Z' })
      pecasDosKits[kit.id] = f.pecas.map((p) => ({ referencia_id: p.referencia_id, papel: p.papel, tecidos: p.tecidos.map((t) => ({ ...t, tecido: tecidos.find((x) => x.id === t.tecido_id)?.nome ?? '' })), design: p.design, etiqueta: p.etiqueta, etiqueta_onde: p.etiqueta_onde, observacao: p.observacao, detalhes_do_kit: p.detalhes ?? {} }))
      return { status: 200, corpo: kit.id }
    }
    if (u.includes('rpc/adicionar_item_de_detalhe')) {
      gravados.push({ u: 'rpc/adicionar_item_de_detalhe', corpo })
      const ja = itens.find((i) => i.detalhe === corpo.p_detalhe && igual(i.nome, corpo.p_nome))
      if (ja) return { status: 200, corpo: ja.id }
      itensNovos += 1
      const daLista = itens.filter((i) => i.detalhe === corpo.p_detalhe)
      const novo = item('inovo' + itensNovos, corpo.p_detalhe, corpo.p_nome.trim(), Math.max(0, ...daLista.map((i) => i.ordem)) + 1)
      itens.push(novo)
      return { status: 200, corpo: novo.id }
    }
    if (u.includes('rpc/salvar_listas_de_detalhe')) {
      gravados.push({ u: 'rpc/salvar_listas_de_detalhe', corpo })
      if (recusas > 0) { recusas--; return { status: 400, corpo: { code: '23514', message: '"Polo" está duas vezes na lista de golas.' } } }
      let mexidos = 0
      /* como a 058: a lista que vem é a lista inteira; a que não vem fica como está */
      for (const [detalhe, lista] of Object.entries(corpo.p_listas)) {
        const fica = new Set(lista.map((x) => x.id).filter(Boolean))
        for (let n = itens.length - 1; n >= 0; n--) if (itens[n].detalhe === detalhe && !fica.has(itens[n].id)) itens.splice(n, 1)
        lista.forEach((x, n) => {
          const i = x.id ? itens.find((y) => y.id === x.id) : null
          if (!i) { itensNovos += 1; itens.push(item('inovo' + itensNovos, detalhe, x.nome, n + 1)); mexidos++; return }
          /* mudou o nome: muda o texto nas referências e nas peças dos kits que o usam */
          if (i.nome !== x.nome) {
            for (const r of refs) if (igual(r.detalhes?.[detalhe], i.nome)) r.detalhes = { ...r.detalhes, [detalhe]: x.nome }
            for (const p of Object.values(pecasDosKits).flat()) if (igual(p.detalhes_do_kit?.[detalhe], i.nome)) p.detalhes_do_kit = { ...p.detalhes_do_kit, [detalhe]: x.nome }
          }
          Object.assign(i, { nome: x.nome, ordem: n + 1 }); mexidos++
        })
      }
      return { status: 200, corpo: mexidos }
    }
    if (u.includes('rpc/salvar_molde_da_referencia')) {
      gravados.push({ u: 'rpc/salvar_molde_da_referencia', corpo })
      const tam = corpo.p_tamanho ?? ''
      const antes = tam ? moldesDe(corpo.p_referencia)[tam] : fichaDe(corpo.p_referencia).molde
      /* como a 052: desenho diferente derruba a escala acertada */
      if (antes !== corpo.p_svg) delete escalasDe(corpo.p_referencia)[tam]
      if (tam) { if (corpo.p_svg) moldesDe(corpo.p_referencia)[tam] = corpo.p_svg; else delete moldesDe(corpo.p_referencia)[tam] }
      else fichaDe(corpo.p_referencia).molde = corpo.p_svg || null
      return { status: 200, corpo: !!corpo.p_svg }
    }
    if (u.includes('rpc/acertar_escala_do_molde')) {
      gravados.push({ u: 'rpc/acertar_escala_do_molde', corpo })
      if (recusas > 0) { recusas--; return { status: 400, corpo: { code: '23514', message: 'Essa medida não fecha com o desenho. Confira o número digitado.' } } }
      const tam = corpo.p_tamanho ?? ''
      const tem = tam ? moldesDe(corpo.p_referencia)[tam] : fichaDe(corpo.p_referencia).molde
      if (!tem) return { status: 404, corpo: { code: 'P0002', message: 'Este molde ainda não tem desenho para acertar a escala.' } }
      if (corpo.p_cm_por_unidade === null) delete escalasDe(corpo.p_referencia)[tam]
      else escalasDe(corpo.p_referencia)[tam] = corpo.p_cm_por_unidade
      return { status: 200, corpo: corpo.p_cm_por_unidade }
    }
    if (/\/referencia(\?|$)/.test(u) && metodo === 'POST') {
      gravados.push({ u: 'referencia', corpo })
      novos += 1
      const nova = ref('novo' + novos, corpo[0].cod, corpo[0].nome, corpo[0].grupo, corpo[0].genero)
      refs.push(nova)
      return { status: 201, corpo: [nova] }
    }
    if (/\/referencia\?id=eq\./.test(u) && metodo === 'DELETE') {
      gravados.push({ u: 'referencia DELETE', corpo: idDe(u, 'id') })
      const i = refs.findIndex((x) => x.id === idDe(u, 'id'))
      if (i >= 0) refs.splice(i, 1)
      delete pecasDosKits[idDe(u, 'id')]
      for (const k of Object.keys(pecasDosKits)) pecasDosKits[k] = pecasDosKits[k].filter((p) => p.referencia_id !== idDe(u, 'id'))
      return { status: 204, corpo: null }
    }
    if (metodo !== 'GET') return null
    if (u.includes('item_de_detalhe_na_lista')) {
      if (estado === 'sem-apoio') return { status: 403, corpo: { message: 'permission denied for view item_de_detalhe_na_lista' } }
      return { status: 200, corpo: [...itens].sort((x, y) => ORDEM_DOS_DETALHES.indexOf(x.detalhe) - ORDEM_DOS_DETALHES.indexOf(y.detalhe) || x.ordem - y.ordem || x.nome.localeCompare(y.nome)).map(itemNaLista) }
    }
    if (u.includes('grupo_de_referencia')) return { status: 200, corpo: estado === 'erro' ? [] : grupos }
    if (u.includes('referencia_na_ficha')) {
      if (estado === 'erro') return { status: 403, corpo: { message: 'permission denied for view referencia_na_ficha' } }
      const id = idDe(u, 'id')
      return { status: 200, corpo: (id ? refs.filter((r) => r.id === id) : refs.filter((r) => r.ativo)).map(naLista) }
    }
    if (u.includes('kit_na_ficha')) return estado === 'sem-kits' ? { status: 404, corpo: { message: 'relation "public.kit_na_ficha" does not exist' } } : { status: 200, corpo: refs.filter((r) => r.grupo === 'KIT' && r.ativo).map(kitNaLista).sort((a, b) => a.nome.localeCompare(b.nome)) }
    if (u.includes('layout_na_fabrica')) {
      lidos.push(u)
      if (vendas === 'erro') return { status: 403, corpo: { message: 'permission denied for view layout_na_fabrica' } }
      const desde = (u.match(/aprovado_em=gte\.([^&]+)/) ?? [])[1]
      return { status: 200, corpo: pedaco(u, layouts.filter((l) => !desde || new Date(l.aprovado_em) >= new Date(desde))) }
    }
    if (u.includes('fatia_na_fabrica') && u.includes('select=pedido_id,tecnica')) {
      lidos.push(u)
      return { status: 200, corpo: pedaco(u, fatias) }
    }
    if (u.includes('peca_do_kit_na_lista')) {
      const kitId = idDe(u, 'kit_id'); const refId = idDe(u, 'referencia_id')
      if (kitId) return { status: 200, corpo: (pecasDosKits[kitId] ?? []).map(pecaNaLista(kitId)) }
      /* a lista de todas as peças de todos os kits, que as vendas pedem */
      if (!refId) { lidos.push(u); return { status: 200, corpo: pedaco(u, Object.keys(pecasDosKits).flatMap((k) => pecasDosKits[k].map(pecaNaLista(k)))) } }
      return { status: 200, corpo: Object.keys(pecasDosKits).flatMap((k) => pecasDosKits[k].map(pecaNaLista(k))).filter((p) => p.referencia_id === refId) }
    }
    if (u.includes('medida_da_referencia')) return { status: 200, corpo: fichaDe(idDe(u, 'referencia_id')).medidas }
    if (u.includes('parte_da_referencia')) return { status: 200, corpo: fichaDe(idDe(u, 'referencia_id')).partes }
    if (u.includes('material_da_referencia')) return { status: 200, corpo: fichaDe(idDe(u, 'referencia_id')).materiais }
    if (u.includes('molde_da_referencia')) {
      const id = idDe(u, 'referencia_id'); const geral = fichaDe(id).molde
      /* a lista leve: que moldes existem e a escala de cada um, sem o desenho */
      if (u.includes('select=tamanho,cm_por_unidade')) {
        const linha = (tamanho) => ({ tamanho, cm_por_unidade: escalasDe(id)[tamanho] ?? null })
        return { status: 200, corpo: [...(geral ? [linha('')] : []), ...Object.keys(moldesDe(id)).map(linha)] }
      }
      const tam = (u.match(/tamanho=eq\.([^&]*)/) ?? [])[1] ?? ''
      const m = tam ? moldesDe(id)[tam] : geral
      return { status: 200, corpo: m ? [{ svg: m }] : [] }
    }
    if (u.includes('/tecido?')) return estado === 'sem-apoio' ? { status: 403, corpo: { message: 'permission denied for table tecido' } } : { status: 200, corpo: tecidos }
    if (u.includes('/material?')) return estado === 'sem-apoio' ? { status: 403, corpo: { message: 'permission denied for table material' } } : { status: 200, corpo: doEstoque }
    return null
  }
  return { responder, gravados, fichas, refs, pecasDosKits, itens, lidos }
}
