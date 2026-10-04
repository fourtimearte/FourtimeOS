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
export const tecidos = D.tecidos.map((t, i) => {
  const [grupo, gramatura, largura] = DO_TECIDO[t.nome]
  return { ...t, grupo, gramatura: gramatura === null ? null : gramatura.toFixed(2), largura: largura === null ? null : largura.toFixed(3), ordem: i + 1 }
})

const M = (nome) => D.materiais.find((m) => m.nome === nome)
const F = (nome) => D.fornecedores.find((f) => f.nome === nome)

/* o Vermelho Fourtime do dry fit vem de outro fornecedor, e a helanca não tem nenhum */
export const ligacoes = D.ligacoes
  .filter((l) => l.material_id !== M('HELANCA COLEGIAL · Azul Marinho').id)
  .map((l) => l.material_id === M('DRYFIT POLIESTER 100% · Vermelho Fourtime').id ? { ...l, fornecedor_id: F('Tecidos Exemplo S.A.').id } : l)

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const pedido = (numero, cliente, pecas, entrega, materiais, separados, nao_cobre, sem_consumo = 0) => ({
  id: 'p-' + numero, numero, cliente_id: 'cl-' + numero, cliente, estado: separados ? 'separacao' : 'aprovado', aviso: '', pecas, entrega_em: entrega === null ? null : dia(entrega),
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
    id: 'rp' + (++r), pedido_id: 'p-' + numero, pedido: numero, material_id: m.id, material: m.nome, categoria: m.categoria,
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
export const tecidosAMais = Array.from({ length: 5 }, (_, i) => ({ id: 'tx' + i, nome: `DRY DE PROVA ${i + 1}`, grupo: 'DRY', gramatura: '150.00', largura: '1.600', ordem: 50 + i }))
export const materiaisDosTecidosAMais = tecidosAMais.flatMap((t, i) => Array.from({ length: 6 }, (_, k) => ({
  ...base, id: `my${i}-${k}`, nome: `${t.nome} · Cor ${k + 1}`, tecido_id: t.id, tecido: t.nome, cor_id: `cy${i}-${k}`, cor: `Cor ${k + 1}`, cor_hex: matiz(i * 6 + k + 3),
  minimo: 10, saldo: 6 + k * 5, reservado: 0, livre: 6 + k * 5, abaixo_do_minimo: 6 + k * 5 < 10,
})))
