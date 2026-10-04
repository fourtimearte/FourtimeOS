/* O banco de mentira de testes/parceiros.mjs: os mesmos nomes e numeros da
   prancha 5 do wireframe "Página do Parceiro", de 03/10/2026. O dia de hoje do
   wireframe e sabado, 3 de outubro de 2026, e o teste congela o relogio nele,
   as 17:40 de Goiania. Nada aqui e dado de verdade: a chave e a senha sao
   inventadas. */
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
const V = (parceiro, quando, produto, variante, quantidade, valor, parte, conta = true) => ({
  item_id: 9000 + (++n), parceiro_id: parceiro, vendido_em: quando, produto, variante,
  quantidade, pecas: conta ? quantidade : 0, valor: conta ? valor : 0, parte: conta ? parte : 0, conta, aparece: true,
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

export const aviso = [{ recebido_em: '2026-10-03T17:32:00Z', topico: 'orders/paid', resultado: 'paid' }]

export const colecoes = [
  { colecao: 'colegio-professora-yolanda', nome: 'Colégio Professora Yolanda', produtos: 6 },
  { colecao: 'fourtime-run', nome: 'Fourtime Run', produtos: 12 },
  { colecao: 'saneago-goias-volei-completo', nome: 'Saneago Goiás Vôlei Completo', produtos: 8 },
  { colecao: 'viapol-volei-sao-jose', nome: 'Viapol Vôlei São José', produtos: 8 },
]

export const PEDE_CONFIRMACAO = 'Este acordo muda a parte de 6 venda(s) já registrada(s). Confirme para refazer a conta.'
