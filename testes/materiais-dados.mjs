/* O banco de mentira de testes/materiais.mjs: os mesmos nomes e numeros do
   wireframe de 03/10/2026 (Estoque, Fornecedores e Verificador de Boleto).
   Nada aqui e dado de verdade: os CNPJs sao inventados e so fecham a conta
   dos digitos, para a tela aceitar. */
const HOJE = new Date()
const em = (dias, h, m) => { const d = new Date(HOJE); d.setDate(d.getDate() - dias); d.setHours(h, m, 0, 0); return d.toISOString() }
const dia = (dias) => { const d = new Date(HOJE); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10) }

const COR = { Branco: '#FFFFFF', Preto: '#1A1D23', 'Azul Marinho': '#1B2A4E', 'Vermelho Fourtime': '#C6161B', 'Cinza Mescla': '#B4B8C0', 'Amarelo Ouro': '#F2B705', 'Verde Bandeira': '#0E7A3B', 'Azul Royal': '#1E46B4', Laranja: '#EE6C1A', 'Rosa Pink': '#E0218A' }
const MALHAS = ['DRYFIT POLIESTER 100%', 'PIQUET 100%', 'ALGODAO 100%', 'ALGODAO MESCLA SEM ELASTANO', 'HELANCA COLEGIAL', 'MOLETOM']
export const tecidos = MALHAS.map((nome, i) => ({ id: 't' + (i + 1), nome }))
export const cores = Object.entries(COR).map(([nome, hex], i) => ({ id: 'c' + (i + 1), nome, hex }))
const tid = (n) => tecidos.find((t) => t.nome === n).id
const cid = (n) => cores.find((c) => c.nome === n).id

let n = 0
const mat = (categoria, nome, unidade, minimo, saldo, reservado = 0, extra = {}) => ({
  id: 'm' + (++n), categoria, nome, unidade, minimo, saldo, reservado, livre: saldo - reservado,
  pedidos_reservando: extra.pedidos ?? (reservado ? 1 : 0), reserva_sem_consumo: false, ativo: true,
  tecido_id: null, cor_id: null, tecido: null, cor: null, cor_hex: extra.hex ?? null,
  abaixo_do_minimo: saldo - reservado < minimo, atualizado_em: em(3, 10, 0), ultimo_movimento: em(extra.dias ?? 3, 10, 0),
  grupo: extra.grupo ?? '', onde_fica: extra.onde ?? '', criado_em: em(60, 9, 0),
})
const tec = (malha, cor, minimo, saldo, reservado = 0, pedidos) => ({
  ...mat('tecido', `${malha} · ${cor}`, 'kg', minimo, saldo, reservado, { pedidos }),
  tecido_id: tid(malha), cor_id: cid(cor), tecido: malha, cor, cor_hex: COR[cor],
})
export const materiais = [
  tec('DRYFIT POLIESTER 100%', 'Branco', 20, 42),
  tec('DRYFIT POLIESTER 100%', 'Preto', 20, 9, 6, 2),
  tec('DRYFIT POLIESTER 100%', 'Azul Marinho', 10, 28, 4, 1),
  tec('DRYFIT POLIESTER 100%', 'Vermelho Fourtime', 10, 12),
  tec('PIQUET 100%', 'Branco', 15, 6),
  tec('PIQUET 100%', 'Azul Marinho', 15, 31),
  tec('ALGODAO 100%', 'Preto', 15, 22),
  tec('ALGODAO MESCLA SEM ELASTANO', 'Cinza Mescla', 20, 46),
  tec('HELANCA COLEGIAL', 'Azul Marinho', 3, 4),
  tec('MOLETOM', 'Preto', 10, 16),
  mat('aviamento', 'Linha poliéster 120 branca', 'cone', 8, 18, 0, { grupo: 'Linha', hex: '#FFFFFF' }),
  mat('aviamento', 'Linha poliéster 120 preta', 'cone', 8, 11, 0, { grupo: 'Linha', hex: '#1A1D23' }),
  mat('aviamento', 'Elástico 30 mm', 'm', 100, 210, 0, { grupo: 'Elástico e cadarço' }),
  mat('aviamento', 'Cadarço 6 mm branco', 'm', 60, 140, 0, { grupo: 'Elástico e cadarço', hex: '#FFFFFF' }),
  mat('aviamento', 'Botão 4 furos 18 mm', 'un', 800, 2200, 0, { grupo: 'Botão' }),
  mat('aviamento', 'Etiqueta Fourtime tecida', 'un', 500, 1450, 0, { grupo: 'Etiqueta' }),
  mat('aviamento', 'Gola retilínea piquet marinho', 'un', 60, 40, 0, { grupo: 'Gola', hex: '#1B2A4E' }),
  mat('insumo', 'Filme DTF 60 cm', 'm', 100, 140, 0, { grupo: 'DTF' }),
  mat('insumo', 'Pó DTF hot melt', 'kg', 2, 4.5, 0, { grupo: 'DTF' }),
  mat('insumo', 'Tinta DTF branca', 'L', 1, 1.2, 0, { grupo: 'DTF', hex: '#FFFFFF' }),
  mat('insumo', 'Papel sublimático 100 g', 'm', 200, 380, 0, { grupo: 'Sublimação' }),
  mat('insumo', 'Tinta sublimática magenta', 'L', 1, 0.6, 0, { grupo: 'Sublimação', hex: '#E0218A' }),
  mat('insumo', 'Tinta sublimática ciano', 'L', 1, 2.4, 0, { grupo: 'Sublimação', hex: '#1B9AD6' }),
  mat('insumo', 'Tela de silk 120 fios', 'un', 8, 18, 0, { grupo: 'Silk' }),
  mat('insumo', 'Tinta silk plastisol branca', 'kg', 2, 3.2, 0, { grupo: 'Silk', hex: '#FFFFFF' }),
  mat('insumo', 'Saco de embalagem 30x40', 'un', 400, 900, 0, { grupo: 'Embalagem' }),
]
const M = (nome) => materiais.find((m) => m.nome === nome)

/* o CNPJ de mentira precisa fechar a conta dos digitos, senao a tela o recusa */
export const cn = (c) => {
  if (!c) return c
  const b = c.slice(0, 12)
  const dv = (s) => { let soma = 0, peso = 2; for (let i = s.length - 1; i >= 0; i--) { soma += Number(s[i]) * peso; peso = peso === 9 ? 2 : peso + 1 } const r = soma % 11; return r < 2 ? 0 : 11 - r }
  const d1 = dv(b); const d2 = dv(b + d1)
  return b + d1 + d2
}
let f = 0
const forn = (nome, cnpjCru, cidade, uf, situacao, entrou_por, tipos, extra = {}) => { const cnpj = cn(cnpjCru); return ({
  id: 'f' + (++f), nome, razao_social: extra.razao ?? nome, cnpj, cidade, uf, contato: extra.contato ?? '',
  pagamento: extra.pagamento ?? '', prazo: extra.prazo ?? '', o_que_fornece: extra.fornece ?? '',
  situacao, entrou_por, receita: cnpj ? { razao_social: extra.razao ?? nome, situacao: 'Ativa', abertura: extra.abertura ?? '2011-03-14', atividade: extra.atividade ?? 'Fabricação de tecidos de malha', cidade, uf, consultado_em: em(40, 9, 0) } : null,
  aprovado_por: situacao === 'confiavel' ? '1' : null, aprovado_por_nome: situacao === 'confiavel' ? 'Henrique' : null,
  aprovado_em: situacao === 'confiavel' ? '2026-03-12T12:00:00Z' : null, motivo_do_bloqueio: extra.motivo ?? '',
  criado_em: '2026-03-10T12:00:00Z', tipos, materiais: 0, entradas: extra.entradas ?? 0,
  ultima_entrada: extra.ultima ?? null, boletos: extra.boletos ?? 0, ultimo_boleto: extra.boleto ?? null,
}) }
export const fornecedores = [
  forn('Malharia Exemplo Ltda', '12345678000195', 'Goiânia', 'GO', 'confiavel', 'estoque', ['tecido', 'aviamento'], { contato: 'Vendas · (62) 9 0000-0000', pagamento: 'Boleto, 28 dias', prazo: '5 dias úteis', entradas: 14, ultima: em(8, 15, 30), boletos: 7, boleto: em(20, 9, 0) }),
  forn('Malhas Exemplo do Sul Ltda', '89012345000165', 'Brusque', 'SC', 'confiavel', 'cadastro', ['tecido'], { abertura: '2009-06-01', entradas: 3, ultima: em(30, 9, 0) }),
  forn('Tecidos Exemplo S.A.', '34567890000102', 'São Paulo', 'SP', 'confiavel', 'estoque', ['tecido'], { entradas: 5, ultima: em(17, 9, 0), boletos: 2, boleto: em(2, 15, 22) }),
  forn('Malharia Nova Exemplo', null, 'Goiânia', 'GO', 'novo', 'estoque', ['tecido']),
  forn('Aviamentos Exemplo Ltda', '45678901000135', 'Goiânia', 'GO', 'confiavel', 'boleto', ['aviamento'], { entradas: 6, ultima: em(1, 11, 32), boletos: 3, boleto: em(1, 11, 5) }),
  forn('Etiquetas Exemplo Ltda', '90123456000102', 'São Paulo', 'SP', 'confiavel', 'estoque', ['aviamento'], { entradas: 2, ultima: em(45, 9, 0) }),
  forn('Suprimentos DTF Exemplo Ltda', '01234567000195', 'São Paulo', 'SP', 'confiavel', 'estoque', ['insumo'], { entradas: 4, ultima: em(1, 8, 55) }),
  forn('Gráfica Exemplo Ltda', '23456789000195', 'Goiânia', 'GO', 'confiavel', 'estoque', ['insumo'], { entradas: 2, ultima: em(12, 9, 0), boletos: 1, boleto: em(0, 9, 12) }),
  forn('Correios', null, 'Brasil inteiro', '', 'novo', 'entrega', ['frete'], { fornece: 'Entrega ao cliente, PAC e SEDEX' }),
  forn('Jadlog', null, 'GO e DF', '', 'novo', 'entrega', ['frete'], { fornece: 'Entrega ao cliente, 1 a 3 dias úteis' }),
  forn('Braspress', null, 'Capitais SP e GO', '', 'novo', 'entrega', ['frete'], { fornece: 'Entrega ao cliente, 2 a 5 dias úteis' }),
  forn('Transportadora Exemplo Ltda', '67890123000145', 'Goiânia', 'GO', 'esperando', 'boleto', ['frete'], { fornece: 'Frete de compra de malha', abertura: '2017-03-14', atividade: 'Transporte rodoviário de carga', boletos: 1, boleto: em(0, 14, 32) }),
  forn('Facção Exemplo Ltda', '11222333000181', 'Aparecida de Goiânia', 'GO', 'confiavel', 'cadastro', ['servico'], { fornece: 'Costura de camiseta básica' }),
]
const F = (nome) => fornecedores.find((x) => x.nome === nome)
const liga = (fornecedor, nomes) => nomes.map((m) => ({ material_id: M(m).id, fornecedor_id: F(fornecedor).id, criado_em: em(50, 9, 0) }))
export const ligacoes = [
  ...liga('Malharia Exemplo Ltda', materiais.filter((m) => /^(DRYFIT|PIQUET)/.test(m.nome)).map((m) => m.nome).concat(['Gola retilínea piquet marinho'])),
  ...liga('Tecidos Exemplo S.A.', ['ALGODAO 100% · Preto', 'ALGODAO MESCLA SEM ELASTANO · Cinza Mescla']),
  ...liga('Malhas Exemplo do Sul Ltda', ['HELANCA COLEGIAL · Azul Marinho', 'MOLETOM · Preto']),
  ...liga('Aviamentos Exemplo Ltda', ['Linha poliéster 120 branca', 'Linha poliéster 120 preta', 'Elástico 30 mm', 'Cadarço 6 mm branco', 'Botão 4 furos 18 mm']),
  ...liga('Etiquetas Exemplo Ltda', ['Etiqueta Fourtime tecida']),
  ...liga('Suprimentos DTF Exemplo Ltda', ['Filme DTF 60 cm', 'Pó DTF hot melt', 'Tinta DTF branca']),
  ...liga('Gráfica Exemplo Ltda', ['Papel sublimático 100 g', 'Tinta sublimática magenta', 'Tinta sublimática ciano']),
]
fornecedores.forEach((x) => { x.materiais = ligacoes.filter((l) => l.fornecedor_id === x.id).length })

let v = 0
const mov = (dias, h, mi, motivo, nome, quantidade, extra = {}) => {
  const m = M(nome)
  return { id: 'v' + (++v), material_id: m.id, material: m.nome, unidade: m.unidade, categoria: m.categoria, quantidade, motivo,
    observacao: extra.obs ?? '', pedido_id: extra.pedido ? 'p-' + extra.pedido : null, pedido: extra.pedido ?? null, quem: '1',
    quem_nome: extra.quem ?? 'Estoque', quem_na_equipe: extra.quem ?? 'Estoque', quando: em(dias, h, mi),
    fornecedor_id: extra.forn ? F(extra.forn).id : null, fornecedor: extra.forn ?? null, tecido_id: m.tecido_id, grupo: m.grupo,
    tecido: m.tecido, cor: m.cor, cor_hex: m.cor_hex }
}
export const movimentos = [
  mov(0, 14, 10, 'separacao', 'DRYFIT POLIESTER 100% · Preto', -4, { pedido: 'PD-0412' }),
  mov(0, 11, 32, 'entrada', 'Linha poliéster 120 branca', 12, { forn: 'Aviamentos Exemplo Ltda', obs: 'NF 4512' }),
  mov(0, 11, 30, 'entrada', 'Elástico 30 mm', 200, { forn: 'Aviamentos Exemplo Ltda', obs: 'NF 4512' }),
  mov(0, 9, 48, 'separacao', 'PIQUET 100% · Branco', -9, { pedido: 'PD-0410' }),
  mov(0, 9, 15, 'ajuste', 'Tinta sublimática magenta', -0.2, { quem: 'Henrique', obs: 'contagem da manhã' }),
  mov(1, 16, 20, 'devolucao', 'DRYFIT POLIESTER 100% · Azul Marinho', 1.5, { pedido: 'PD-0398', obs: 'sobra do corte' }),
  mov(1, 15, 2, 'separacao', 'Filme DTF 60 cm', -18, { pedido: 'PD-0407' }),
  mov(1, 10, 40, 'saida', 'Saco de embalagem 30x40', -100, { obs: 'uso da expedição' }),
  mov(1, 8, 55, 'entrada', 'Filme DTF 60 cm', 100, { forn: 'Suprimentos DTF Exemplo Ltda', obs: 'NF 880' }),
  mov(2, 17, 12, 'separacao', 'ALGODAO MESCLA SEM ELASTANO · Cinza Mescla', -12, { pedido: 'PD-0405' }),
  mov(2, 13, 30, 'entrada', 'Etiqueta Fourtime tecida', 1000, { forn: 'Etiquetas Exemplo Ltda', obs: 'NF 2231' }),
  mov(2, 10, 5, 'separacao', 'DRYFIT POLIESTER 100% · Preto', -6, { pedido: 'PD-0405' }),
  mov(2, 9, 5, 'ajuste', 'Botão 4 furos 18 mm', 200, { quem: 'Henrique', obs: 'contagem' }),
  mov(3, 15, 44, 'saida', 'Gola retilínea piquet marinho', -20, { obs: 'amostra para cliente' }),
  mov(3, 10, 12, 'entrada', 'Botão 4 furos 18 mm', 1000, { forn: 'Aviamentos Exemplo Ltda', obs: 'NF 4490' }),
  mov(6, 8, 40, 'ajuste', 'DRYFIT POLIESTER 100% · Preto', -1, { quem: 'Henrique', obs: 'contagem' }),
  mov(8, 15, 30, 'entrada', 'DRYFIT POLIESTER 100% · Branco', 30, { forn: 'Malharia Exemplo Ltda', obs: 'NF 1907' }),
]
export const reservas = [
  { id: 'r1', pedido_id: 'p-PD-0412', pedido: 'PD-0412', entrega: dia(6), material_id: M('DRYFIT POLIESTER 100% · Preto').id, quantidade: 4, unidade: 'kg', pecas: 20, sem_consumo: false },
  { id: 'r2', pedido_id: 'p-PD-0418', pedido: 'PD-0418', entrega: dia(12), material_id: M('DRYFIT POLIESTER 100% · Preto').id, quantidade: 2, unidade: 'kg', pecas: 10, sem_consumo: false },
  { id: 'r3', pedido_id: 'p-PD-0415', pedido: 'PD-0415', entrega: dia(8), material_id: M('DRYFIT POLIESTER 100% · Azul Marinho').id, quantidade: 4, unidade: 'kg', pecas: 22, sem_consumo: false },
]
export const tipos = [
  { chave: 'tecido', nome: 'Tecido', ordem: 10, fixo: true }, { chave: 'aviamento', nome: 'Aviamento', ordem: 20, fixo: true },
  { chave: 'insumo', nome: 'Insumo', ordem: 30, fixo: true }, { chave: 'frete', nome: 'Frete', ordem: 40, fixo: true },
  { chave: 'servico', nome: 'Serviço', ordem: 50, fixo: true },
]
const OITO = (estados, textos) => ['linha', 'valor', 'pagador', 'receita', 'fornecedor', 'historico', 'repetido', 'banco'].map((chave, i) => ({ chave, titulo: chave, estado: estados[i], texto: textos?.[i] ?? '' }))
const conf = (id, dias, h, mi, beneficiario, cnpjCru, valor, venc, resultado, situacao, extra = {}) => { const cnpj = cn(cnpjCru); return ({
  id, quando: em(dias, h, mi), quem: '2', quem_nome: 'Financeiro', linha: extra.linha ?? String(id).padEnd(47, '1').replace(/\D/g, '1'), arquivo: extra.arquivo ?? 'boleto.pdf',
  banco: extra.banco ?? '341', banco_nome: 'Itaú', valor, vencimento: dia(venc), beneficiario, cnpj, pagador: 'Fourtime', pagador_documento: '',
  resultado, situacao, checagens: extra.checagens ?? OITO(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']), motivo: extra.motivo ?? '',
  fornecedor_id: fornecedores.find((x) => x.cnpj === cnpj)?.id ?? null, decidido_por: null, decidido_por_nome: extra.por ?? '', decidido_em: extra.por ? em(dias, h + 1, 0) : null, nota_da_decisao: '',
}) }
export const conferencias = [
  conf('1001', 0, 9, 12, 'Gráfica Exemplo Ltda', '23456789000195', 412, 6, 'pode_pagar', 'conferido'),
  conf('1002', 1, 16, 40, 'Cobrança Exemplo Ltda', '56789012000134', 1980, -1, 'nao_pague', 'conferido', { checagens: OITO(['ok', 'ok', 'ok', 'ok', 'erro', 'atencao', 'ok', 'ok'], [, , , , 'CNPJ bloqueado']) }),
  conf('1003', 1, 11, 5, 'Aviamentos Exemplo Ltda', '45678901000135', 286.9, 3, 'precisa_aprovacao', 'aprovado', { por: 'Henrique' }),
  conf('1004', 2, 15, 22, 'Tecidos Exemplo S.A.', '34567890000102', 6120, 13, 'pode_pagar', 'conferido'),
]
export const perfil = (papel = 'admin') => {
  const PAGINAS = ['inicio','funil','clientes','cotacao','separacao','pcp','ficha','kanban','produtos','estoque','atividades','relatorio','transporte','banco','config','kit']
  const permissoes = {}; PAGINAS.forEach((k) => permissoes[k] = { ver: true, editar: papel !== 'vendedor' || k !== 'estoque', deletar: papel === 'admin', total: papel === 'admin' })
  return [{ id: '1', nome: papel === 'admin' ? 'Henrique' : 'Financeiro', papel, situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 't@f', foto_em: null }]
}
