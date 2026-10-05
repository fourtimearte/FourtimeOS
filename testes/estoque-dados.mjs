/* O banco de mentira de testes/estoque.mjs: o que a página Materiais do
   Estoque, versão 2, precisa além de testes/materiais-dados.mjs: a hierarquia
   do catálogo (grupo de tecido, tecido), a fila da separação com as reservas
   de cada pedido, uma cor que vem de outro fornecedor e um tecido sem
   fornecedor nenhum. Nada aqui é dado de verdade. */
import * as D from './materiais-dados.mjs'

export const gruposDeTecido = [
  { cod: 'ALG', nome: 'ALGODÃO', ordem: 1 },
  { cod: 'POL', nome: 'POLIAMIDA', ordem: 2 },
  { cod: 'DRY', nome: 'DRY FIT', ordem: 3 },
  { cod: 'PIQ', nome: 'PIQUE', ordem: 4 },
  { cod: 'MOL', nome: 'MOLETOM', ordem: 5 },
  { cod: 'SPX', nome: 'SUPLEX', ordem: 6 },
  { cod: 'VIS', nome: 'VISCOSE', ordem: 7 },
  { cod: '', nome: 'Sem tipo', ordem: 99 },
]
const DO_TECIDO = {
  'DRYFIT POLIESTER 100%': ['DRY', 160, 1.6],
  'PIQUET 100%': ['PIQ', 190, 1.2],
  'ALGODAO 100%': ['ALG', 165, 1.8],
  'ALGODAO MESCLA SEM ELASTANO': ['ALG', 160, 1.8],
  'HELANCA COLEGIAL': [null, null, null],
  MOLETOM: ['MOL', 300, 1.85],
}
/* numeric chega como texto no JSON de verdade: aqui também */
const comEstoque = D.tecidos.map((t, i) => {
  const [grupo, gramatura, largura] = DO_TECIDO[t.nome]
  return { ...t, grupo, gramatura: gramatura === null ? null : gramatura.toFixed(2), largura: largura === null ? null : largura.toFixed(3), ordem: i + 1, ativo: true }
})
/* O CATÁLOGO É MAIOR QUE O ESTOQUE: tecidos que ninguém cadastrou no estoque
   ainda. Dois em grupos que já têm estoque (um deles antes, na ordem do
   catálogo, do tecido que tem), dois num grupo que não tem nada (VIS), o
   suplex sozinho no grupo dele, e um desligado, que não pode aparecer. */
export const tecidosSemEstoque = [
  { id: 'ts1', nome: 'DRYFIT JAKAR 100%', grupo: 'DRY', gramatura: null, largura: null, ordem: 0, ativo: true },
  { id: 'ts2', nome: 'PIQUET MISTO', grupo: 'PIQ', gramatura: '200.00', largura: '1.200', ordem: 20, ativo: true },
  { id: 'ts3', nome: 'VISCOSE PV ANTIPILING', grupo: 'VIS', gramatura: null, largura: null, ordem: 21, ativo: true },
  { id: 'ts4', nome: 'VISCOSE COM ELASTANO PROTEÇÃO UV50', grupo: 'VIS', gramatura: null, largura: null, ordem: 22, ativo: true },
  { id: 'ts5', nome: 'SUPLEX POLIAMIDA', grupo: 'SPX', gramatura: null, largura: null, ordem: 23, ativo: true },
  { id: 'ts6', nome: 'ALGODAO DESLIGADO', grupo: 'ALG', gramatura: null, largura: null, ordem: 24, ativo: false },
]
export const tecidos = [...comEstoque, ...tecidosSemEstoque]

const M = (nome) => D.materiais.find((m) => m.nome === nome)
const F = (nome) => D.fornecedores.find((f) => f.nome === nome)

/* o Vermelho Fourtime do dry fit vem de outro fornecedor, e a helanca não tem nenhum */
export const ligacoes = D.ligacoes
  .filter((l) => l.material_id !== M('HELANCA COLEGIAL · Azul Marinho').id)
  .map((l) => l.material_id === M('DRYFIT POLIESTER 100% · Vermelho Fourtime').id ? { ...l, fornecedor_id: F('Tecidos Exemplo S.A.').id } : l)

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const pedido = (numero, cliente, pecas, entrega, materiais, separados, nao_cobre, sem_consumo = 0) => ({
  id: D.idDoPedido(numero), numero, cliente_id: 'cl-' + numero, cliente, estado: separados ? 'separacao' : 'aprovado', aviso: '', pecas, entrega_em: entrega === null ? null : dia(entrega),
  departamento: 'Comercial', criado_em: '2026-10-01T12:00:00Z', materiais, separados, sem_consumo, nao_cobre, tudo_separado: materiais > 0 && separados === materiais,
})
export const fila = [
  pedido('PD-0412', 'Atlético Exemplo', 329, 3, 3, 0, 1),
  pedido('PD-0415', 'Auto Peças Exemplo', 230, 4, 2, 1, 0),
  pedido('PD-0418', 'Escola Exemplo', 173, 5, 1, 0, 0),
  pedido('PD-0420', 'Atacado Exemplo', 72, 6, 1, 0, 0, 1),
  pedido('PD-0421', 'Associação Exemplo', 330, 9, 2, 0, 0),
  pedido('PD-0422', 'Academia Exemplo', 48, null, 1, 0, 0),
  pedido('PD-0423', 'Clube Exemplo', 120, 12, 1, 0, 0),
]
let r = 0
const reserva = (numero, nome, quantidade, extra = {}) => {
  const m = M(nome)
  return {
    id: 'rp' + (++r), pedido_id: D.idDoPedido(numero), pedido: numero, material_id: m.id, material: m.nome, categoria: m.categoria,
    quantidade, unidade: m.unidade, pecas: extra.pecas ?? 100, sem_consumo: !!extra.semConsumo, baixada: !!extra.baixada,
    separado: extra.baixada ? quantidade : null, saldo: m.saldo, o_estoque_cobre: m.saldo >= quantidade,
  }
}
export const reservasDoPedido = [
  reserva('PD-0412', 'DRYFIT POLIESTER 100% · Preto', 23.6),
  reserva('PD-0412', 'MOLETOM · Preto', 12),
  reserva('PD-0412', 'PIQUET 100% · Azul Marinho', 19.3),
  reserva('PD-0415', 'DRYFIT POLIESTER 100% · Azul Marinho', 4, { baixada: true }),
  reserva('PD-0415', 'ALGODAO 100% · Preto', 8),
  reserva('PD-0418', 'DRYFIT POLIESTER 100% · Branco', 6),
  reserva('PD-0420', 'ALGODAO MESCLA SEM ELASTANO · Cinza Mescla', 0, { semConsumo: true }),
  reserva('PD-0421', 'PIQUET 100% · Branco', 4),
  reserva('PD-0421', 'DRYFIT POLIESTER 100% · Vermelho Fourtime', 5),
  reserva('PD-0422', 'MOLETOM · Preto', 3),
  reserva('PD-0423', 'ALGODAO 100% · Preto', 9),
  /* o PD-0410 já saiu da fila: a separação dele foi concluída. Ele só existe
     nas movimentações, e é por ele que a Separação mostra "não está mais na fila" */
  reserva('PD-0410', 'PIQUET 100% · Branco', 9, { baixada: true }),
]

/* O ESTOQUE GRANDE: o dry fit com mais 26 cores, e mais 5 tecidos no grupo
   dele. Serve para ver que um tecido de trinta cores e um grupo cheio não
   empurram a página para o lado. */
const matiz = (i) => '#' + [0, 1, 2].map((k) => Math.round(127 + 110 * Math.sin(i * 0.9 + k * 2.1)).toString(16).padStart(2, '0')).join('')
const base = M('DRYFIT POLIESTER 100% · Branco')
export const coresAMais = Array.from({ length: 26 }, (_, i) => ({
  ...base, id: 'mx' + i, nome: `DRYFIT POLIESTER 100% · Cor de prova ${i + 1}`, cor_id: 'cx' + i, cor: `Cor de prova ${i + 1}`, cor_hex: matiz(i),
  minimo: 20, saldo: 4 + ((i * 7) % 60), reservado: 0, livre: 4 + ((i * 7) % 60), abaixo_do_minimo: 4 + ((i * 7) % 60) < 20,
}))
export const tecidosAMais = Array.from({ length: 5 }, (_, i) => ({ id: 'tx' + i, nome: `DRY DE PROVA ${i + 1}`, grupo: 'DRY', gramatura: '150.00', largura: '1.600', ordem: 50 + i, ativo: true }))
export const materiaisDosTecidosAMais = tecidosAMais.flatMap((t, i) => Array.from({ length: 6 }, (_, k) => ({
  ...base, id: `my${i}-${k}`, nome: `${t.nome} · Cor ${k + 1}`, tecido_id: t.id, tecido: t.nome, cor_id: `cy${i}-${k}`, cor: `Cor ${k + 1}`, cor_hex: matiz(i * 6 + k + 3),
  minimo: 10, saldo: 6 + k * 5, reservado: 0, livre: 6 + k * 5, abaixo_do_minimo: 6 + k * 5 < 10,
})))

/* A FICHA TÉCNICA (048): o dry fit preto tem a ficha inteira, o branco tem a
   mesma composição e outra gramatura, e as outras cores não têm nenhuma. */
export const fichas = {
  'DRYFIT POLIESTER 100% · Preto': {
    composicao: [{ fibra: 'Poliéster', pct: 96 }, { fibra: 'Elastano', pct: 4 }], gramatura: '190.00', largura: '1.200',
    detalhes: ['Proteção UV 50+', 'Secagem rápida'], cuidados: ['lavar-40-suave', 'nao-alvejar', 'nao-tambor', 'varal-sombra', 'passar-1', 'nao-seco'],
  },
  'DRYFIT POLIESTER 100% · Branco': {
    composicao: [{ fibra: 'Poliéster', pct: 96 }, { fibra: 'Elastano', pct: 4 }], gramatura: '170.00', largura: null, detalhes: [], cuidados: ['lavar-30'],
  },
}
const SEM_FICHA = { composicao: [], gramatura: null, largura: null, detalhes: [], cuidados: [] }
/** os materiais com as colunas da ficha, como a view devolve depois da 048 */
export const comFicha = (materiais) => materiais.map((m) => ({ ...SEM_FICHA, ...m, ...(fichas[m.nome] ?? {}) }))

/* O USO (049): o que saiu de cada material em 30, 90 e 180 dias, e mês a mês.
   O dry fit preto é o que mais sai; o piquet branco quase não sai. */
const mesDe = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
const uso = (nome, d30, d90, d180, meses) => ({ material_id: M(nome).id, d30, d90, d180, meses: Object.fromEntries(meses.map((v, i) => [mesDe(meses.length - 1 - i), v]).filter(([, v]) => v > 0)) })
export const usos = [
  uso('DRYFIT POLIESTER 100% · Preto', 30, 84, 150, [20, 22, 24, 26, 28, 30]),
  uso('DRYFIT POLIESTER 100% · Branco', 12, 30, 66, [14, 10, 12, 8, 10, 12]),
  uso('DRYFIT POLIESTER 100% · Azul Marinho', 0, 6, 18, [6, 6, 0, 6, 0, 0]),
  uso('PIQUET 100% · Branco', 3, 9, 12, [0, 3, 0, 3, 3, 3]),
  uso('MOLETOM · Preto', 15, 15, 15, [0, 0, 0, 0, 0, 15]),
  uso('Linha poliéster 120 branca', 4, 10, 22, [4, 4, 4, 3, 3, 4]),
  uso('Tinta sublimática magenta', 0.4, 1.1, 2.3, [0.4, 0.4, 0.4, 0.4, 0.3, 0.4]),
]

/* O CATÁLOGO DE CORES INTEIRO, como a migração 009 pôs no banco: 122 cores em
   12 famílias, mais a sublimação e uma cor sem família. É com ele que o
   cadastro de material mostra "primeiro a família, depois a cor". As dez cores
   que os materiais de mentira usam guardam o id e o hex de materiais-dados. */
export const gruposDeCor = 'BR~Branco e Cru§PC~Preto e Cinza§VM~Vermelho§RS~Rosa§LR~Laranja§AM~Amarelo§VD~Verde§AZ~Azul§RX~Roxo e Lilás§MR~Marrom e Terra§BG~Bege e Nude§MT~Metálicos e Especiais§SUB~Sublimação'
  .split('§').map((x, i) => ({ cod: x.split('~')[0], nome: x.split('~')[1], ordem: i + 1 }))
const CATALOGO_DE_CORES = 'Branco~#FFFFFF~BR§Preto~#111111~PC§Cinza Mescla~#A8A9AD~PC§Cinza Chumbo~#4A4E52~PC§Cinza Claro~#D3D5D8~PC§Prata~#C0C4C8~MT§Vermelho~#D0021B~VM§Vermelho Escuro~#8E1218~VM§Vinho~#6B1F2B~VM§Bordô~#5C1A2B~VM§Coral~#FF6F5E~RS§Salmão~#FA8072~RS§Rosa~#F48FB1~RS§Rosa Pink~#E91E8C~RS§Rosa Bebê~#F7C6D9~RS§Magenta~#C2007B~RS§Laranja~#F57C00~LR§Laranja Neon~#FF6D00~LR§Terracota~#B4543A~LR§Ferrugem~#8E4B2E~LR§Amarelo Ouro~#E7B400~AM§Amarelo Canário~#FFE000~AM§Amarelo Neon~#EFFF00~AM§Mostarda~#C99700~AM§Creme~#F3E9D2~BR§Bege~#D9C7A7~BG§Verde Bandeira~#00963F~VD§Verde Musgo~#4A5D23~VD§Verde Militar~#5A6650~VD§Verde Limão~#9BD200~VD§Verde Água~#8FD3C4~VD§Verde Neon~#39FF14~VD§Verde Menta~#B7E4C7~VD§Verde Oliva~#7C864A~VD§Azul Royal~#12489E~AZ§Azul Marinho~#12213F~AZ§Azul Celeste~#7EC8E3~AZ§Azul Turquesa~#00B2A9~AZ§Azul Petróleo~#12556B~AZ§Azul Bebê~#BBDDFB~AZ§Ciano~#00BFFF~AZ§Roxo~#5E2A84~RX§Lilás~#B491C8~RX§Violeta~#7A4FBF~RX§Púrpura~#6A0D5B~RX§Marrom~#6B4423~MR§Café~#4B3621~MR§Chocolate~#5C3317~MR§Caqui~#B5A16B~MR§Nude~#E3C4A8~BG§SUBLIMAÇÃO~#CCCCCC~SUB§AMARELO MANTEIGA~#CCCCCC~§Branco Gelo~#F7F9FA~BR§Off White~#F2EFE9~BR§Marfim~#EFE7D2~BR§Pérola~#EDE9E3~BR§Areia Clara~#EAE0CE~BR§Palha~#E8DFC0~BR§Champagne~#E4D9C3~BR§Cru~#DED3BC~BR§Preto Ônix~#1B1B1F~PC§Grafite~#3A3F47~PC§Cinza Escuro~#5F646A~PC§Cinza Mescla Escuro~#6E7378~PC§Cinza Médio~#8A8F95~PC§Cinza Pérola~#E5E7EA~PC§Vermelho Fourtime~#C6161B~VM§Vermelho Tomate~#E23B2E~VM§Vermelho Escarlate~#B3161C~VM§Vermelho Neon~#FF1E1E~VM§Cereja~#A81232~VM§Marsala~#7B3540~VM§Rosé~#E8A0A0~RS§Rosa Chiclete~#FF6FB5~RS§Rosa Neon~#FF2D95~RS§Fúcsia~#D4157E~RS§Pêssego~#FFCBA4~LR§Damasco~#F0A868~LR§Laranja Claro~#FFA24D~LR§Tangerina~#F2670A~LR§Cenoura~#ED7014~LR§Abóbora~#D97D1E~LR§Amarelo Bebê~#FBEFA0~AM§Amarelo Limão~#F4F062~AM§Milho~#F5CE3E~AM§Girassol~#F2C200~AM§Âmbar~#D99A00~AM§Dourado~#C9A227~AM§Verde Esmeralda~#068A5B~VD§Verde Floresta~#1E4D2B~VD§Azul Piscina~#29A8C9~AZ§Azul Cobalto~#1A4FBF~AZ§Azul Jeans~#4A6D8C~AZ§Lavanda~#C9B6E4~RX§Roxo Neon~#B026FF~RX§Orquídea~#A45EE5~RX§Ametista~#8A5FBF~RX§Uva~#4B2354~RX§Berinjela~#3F2140~RX§Areia Escura~#C2A878~MR§Canela~#A9703F~MR§Caramelo~#9A5B22~MR§Tabaco~#7A5230~MR§Castanho~#5A3A22~MR§Cacau~#3E2A1E~MR§Linho~#E6DCC8~BG§Nude Rosado~#E7C9BC~BG§Trigo~#E0CBA4~BG§Amêndoa~#DCC3A5~BG§Café com Leite~#C8A784~BG§Bege Escuro~#C3AE8A~BG§Argila~#C08F72~BG§Camurça~#BFA37C~BG§Perolado~#E8E6E1~MT§Champanhe Metálico~#CBB78F~MT§Holográfico~#C9D6E8~MT§Dourado Metálico~#C6A140~MT§Refletivo~#B8C0C6~MT§Cobre~#B06C3B~MT§Bronze~#A9773F~MT§Chumbo Metálico~#7E858B~MT§Grafite Metálico~#6E7276~MT'
export const coresDoCatalogo = CATALOGO_DE_CORES.split('§').map((x, i) => {
  const [nome, hex, grupo] = x.split('~')
  const usada = D.cores.find((c) => c.nome === nome)
  return { id: usada?.id ?? 'k' + (i + 1), nome, hex: usada?.hex ?? hex, grupo: grupo || null, ordem: i + 1, ativo: true }
})
