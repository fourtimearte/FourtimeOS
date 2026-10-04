/* O banco de mentira de testes/parceiros.mjs: os mesmos nomes e numeros das
   pranchas 6 a 10 do wireframe "Página do Parceiro", versao 2, de 04/10/2026.
   O dia de hoje do wireframe e sabado, 3 de outubro de 2026, e o teste congela
   o relogio nele, as 17:40 de Goiania. Nada aqui e dado de verdade: a chave e
   a senha sao inventadas. */
export const HOJE = '2026-10-03T20:40:00Z'
export const FUSO = 'America/Sao_Paulo'

const P = (id, nome, colecao, colecao_nome, extra) => ({
  id, nome, colecao, colecao_nome,
  chave: `chave${id}00000000000000000000000000`.slice(0, 32), senha: 'EXEMPLO2',
  ativo: true, aberta_em: '2026-10-02T12:00:00Z', travado_ate: null, produtos_em: '2026-10-03T12:00:00Z', criado_em: '2026-09-01T12:00:00Z', produtos: 8,
  acordo_tipo: null, acordo_valor: null, acordo_base: null, acordo_desde: null,
  ultimo_tipo: null, ultimo_valor: null, ultimo_base: null, ultimo_desde: null,
  ...extra,
})
const acordo = (tipo, valor, base = 'valor_pago', desde = '2026-10-01') => ({
  acordo_tipo: tipo, acordo_valor: valor, acordo_base: base, acordo_desde: desde,
  ultimo_tipo: tipo, ultimo_valor: valor, ultimo_base: base, ultimo_desde: desde,
})

/* em ordem de nome, como o banco devolve */
export const parceiros = [
  P('p3', 'Colégio Professora Yolanda', 'colegio-professora-yolanda', 'Colégio Professora Yolanda', { ...acordo('percentual', '15.00'), produtos: 6, aberta_em: null }),
  P('p1', 'Saneago Goiás Vôlei', 'saneago-goias-volei-completo', 'Saneago Goiás Vôlei Completo', acordo('percentual', '10.00')),
  P('p2', 'Viapol Vôlei São José', 'viapol-volei-sao-jose', 'Viapol Vôlei São José', acordo('valor_por_peca', '25.00')),
]

let n = 0
/* a foto vem do produto: os da linha 2026/2027 tem foto, o de 2025 saiu da
   loja e nao tem, e os do Viapol tem */
const FOTO = (produto) => (produto.includes('2025') || produto.includes('Uniforme') ? '' : `https://cdn.shopify.com/s/files/1/0000/exemplo/${produto.includes('Viapol') ? 'viapol' : 'goias'}.jpg?v=1`)
const V = (parceiro, quando, produto, variante, quantidade, valor, parte, conta = true) => ({
  item_id: 9000 + (++n), parceiro_id: parceiro, vendido_em: quando, mes: quando.slice(0, 7), produto, variante,
  quantidade, pecas: conta ? quantidade : 0, valor: conta ? valor : 0, parte: conta ? parte : 0, conta, aparece: true,
  motivo: conta ? null : 'devolvida',
  imagem: FOTO(produto),
})
/* as seis pecas do Goias que contam, a devolvida que nao conta, e as duas do Viapol */
export const outubro = [
  V('p1', '2026-10-03T17:32:00Z', 'Camisa Saneago Goiás Vôlei 2026/2027 Verde', 'M', 1, '249.90', '24.99'),
  V('p1', '2026-10-03T13:05:00Z', 'Camisa Saneago Goiás Vôlei 2026/2027 Branca Personalizado', 'G', 1, '289.90', '28.99'),
  V('p1', '2026-10-03T00:48:00Z', 'Camisa Saneago Goiás Vôlei 2026/2027 Verde Personalizado', 'GG', 2, '579.80', '57.98'),
  V('p1', '2026-10-02T19:20:00Z', 'Camisa Saneago Goiás Vôlei 2026/2027 Branca', 'P', 1, '249.90', '24.99'),
  V('p1', '2026-10-02T12:12:00Z', 'Camisa Saneago Goiás Vôlei 2025 Verde', 'M', 1, '189.90', '18.99'),
  V('p1', '2026-10-01T21:40:00Z', 'Camisa Saneago Goiás Vôlei 2026/2027 Verde', 'G', 1, '249.90', '0', false),
  V('p2', '2026-10-02T15:00:00Z', 'Camiseta Oficial Viapol Vôlei São José - AZUL', 'M', 1, '249.90', '25.00'),
  V('p2', '2026-10-01T15:00:00Z', 'Camiseta Oficial Viapol Vôlei São José - BRANCO', 'G', 1, '249.90', '25.00'),
]

/* Os meses de antes, com os totais do wireframe: uma linha de pedido por mes e
   por parceiro, que e o bastante para a soma. De maio a setembro sao os seis
   meses da prancha; abril e de fora deles, e so aparece nos doze meses. */
const MES = (parceiro, mes, produto, pecas, valor, parte) => V(parceiro, `${mes}-15T15:00:00Z`, produto, 'M', pecas, valor, parte)
const G = 'Camisa Saneago Goiás Vôlei 2025 Verde'
const VI = 'Camiseta Oficial Viapol Vôlei São José - AZUL'
const Y = 'Uniforme Colégio Professora Yolanda'
export const antes = [
  MES('p1', '2026-09', G, 12, '2318.80', '231.88'), MES('p2', '2026-09', VI, 4, '999.60', '100.00'), MES('p3', '2026-09', Y, 2, '359.70', '53.96'),
  MES('p1', '2026-08', G, 9, '1739.10', '173.91'), MES('p2', '2026-08', VI, 2, '499.80', '50.00'), MES('p3', '2026-08', Y, 4, '449.70', '67.46'),
  MES('p1', '2026-07', G, 5, '1329.50', '132.95'), MES('p2', '2026-07', VI, 1, '249.90', '25.00'), MES('p3', '2026-07', Y, 3, '269.70', '40.46'),
  MES('p1', '2026-06', G, 7, '1829.30', '182.93'), MES('p2', '2026-06', VI, 3, '749.70', '75.00'),
  MES('p1', '2026-05', G, 4, '999.60', '99.96'), MES('p2', '2026-05', VI, 2, '499.80', '50.00'),
  MES('p1', '2026-04', G, 3, '749.70', '74.97'),
]
/* da mais nova para a mais velha, como o banco devolve */
export const vendas = [...outubro, ...antes].sort((a, b) => (a.vendido_em < b.vendido_em ? 1 : -1))
/* a linha do pedido da venda que nao conta: de onde sai o valor riscado */
export const linhasDaLoja = outubro.filter((v) => !v.conta).map((v) => ({ item_id: v.item_id, quantidade: 1, preco: '249.90', desconto: '0.00' }))

export const aviso = [{ recebido_em: '2026-10-03T17:32:00Z', topico: 'orders/paid', resultado: 'paid' }]

export const colecoes = [
  { colecao: 'colegio-professora-yolanda', nome: 'Colégio Professora Yolanda' },
  { colecao: 'fourtime-run', nome: 'Fourtime Run' },
  { colecao: 'saneago-goias-volei-completo', nome: 'Saneago Goiás Vôlei Completo' },
  { colecao: 'viapol-volei-sao-jose', nome: 'Viapol Vôlei São José' },
]

export const PEDE_CONFIRMACAO = 'Este acordo muda a parte de 6 venda(s) já registrada(s). Confirme para refazer a conta.'
