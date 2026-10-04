// O PORTEIRO DA LOJA (supabase/functions/loja/index.ts), conferido sem Supabase
// e sem Shopify: o teste finge o ambiente do Deno, responde no lugar do banco e
// da loja, e olha o que o porteiro manda adiante.
//
//   node --experimental-strip-types testes/porteiro.mjs
//
// A assinatura do aviso e calculada aqui com o node:crypto, por fora da conta
// do porteiro: teste que usa a funcao que confere so prova que ela concorda
// consigo.

import { createHmac } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const SEGREDO = 'segredo-de-mentira-do-teste'
const BANCO = 'https://ensaio.supabase.co'
const ARQUIVO = pathToFileURL(resolve(import.meta.dirname, '../supabase/functions/loja/index.ts')).href

let certas = 0
let erradas = 0
function confere(nome, ok, detalhe = '') {
  if (ok) certas++
  else erradas++
  console.log(`${ok ? 'ok  ' : 'RUIM'} ${nome}${ok || !detalhe ? '' : ` (${detalhe})`}`)
}

// ---------- o ambiente de mentira ------------------------------------------
let chamadas = []
let respostas = {}

function fingirAmbiente(env) {
  globalThis.Deno = { env: { get: (n) => env[n] }, serve: () => {} }
  globalThis.fetch = async (url, opcoes = {}) => {
    const endereco = String(url)
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : null
    chamadas.push({ endereco, corpo, cabecalhos: opcoes.headers ?? {} })
    for (const [pedaco, resposta] of Object.entries(respostas)) {
      if (endereco.includes(pedaco)) {
        const r = typeof resposta === 'function' ? resposta(endereco, corpo, opcoes) : resposta
        return new Response(JSON.stringify(r.corpo ?? null), { status: r.status ?? 200 })
      }
    }
    return new Response('nao esperado', { status: 599 })
  }
}

async function carregar(env, marca) {
  fingirAmbiente(env)
  return import(`${ARQUIVO}?${marca}`)
}

function assinar(texto, segredo = SEGREDO) {
  return createHmac('sha256', segredo).update(Buffer.from(texto, 'utf8')).digest('base64')
}

function aviso(texto, assinatura, topico = 'orders/paid') {
  return new Request(`${BANCO}/functions/v1/loja`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-shopify-topic': topico,
      'x-shopify-hmac-sha256': assinatura,
    },
    body: texto,
  })
}

// ---------- um pedido como a Shopify manda, com tudo do comprador ----------
const PEDIDO = {
  id: 7180653134099,
  name: '#1089',
  email: 'maria.compradora@exemplo.com',
  contact_email: 'maria.compradora@exemplo.com',
  phone: '+5562999990000',
  created_at: '2026-10-03T14:32:10-03:00',
  updated_at: '2026-10-03T14:33:00-03:00',
  cancelled_at: null,
  financial_status: 'partially_refunded',
  test: false,
  browser_ip: '189.10.20.30',
  note: 'Entregar para Maria na portaria',
  customer: { id: 99, first_name: 'Maria', last_name: 'Compradora', email: 'maria.compradora@exemplo.com' },
  billing_address: { name: 'Maria Compradora', address1: 'Rua das Flores, 123', zip: '74000-000', company: '123.456.789-00' },
  shipping_address: { name: 'Maria Compradora', address1: 'Rua das Flores, 123', city: 'Goiânia', phone: '+5562999990000' },
  client_details: { user_agent: 'Mozilla/5.0', browser_ip: '189.10.20.30' },
  line_items: [
    {
      id: 17463340597523,
      product_id: 10149030232339,
      variant_id: 52466608767251,
      title: 'Camiseta Oficial Saneago Goiás Vôlei Verde Personalizado',
      variant_title: 'G',
      name: 'Camiseta Oficial Saneago Goiás Vôlei Verde Personalizado - G',
      quantity: 3,
      current_quantity: 2,
      price: '289.90',
      total_discount: '0.00',
      discount_allocations: [
        { amount: '100.00', discount_application_index: 0 },
        { amount: '73.94', discount_application_index: 1 },
      ],
      properties: [{ name: 'Nome na camisa', value: 'MARIA' }],
    },
    {
      id: 17463340597524,
      product_id: null,
      variant_id: null,
      title: 'Peça avulsa',
      variant_title: null,
      quantity: 1,
      price: '50.00',
      discount_allocations: [],
    },
  ],
  refunds: [
    { id: 1, refund_line_items: [{ line_item_id: 17463340597523, quantity: 1, subtotal: 231.92 }] },
  ],
}

const DO_COMPRADOR = ['maria', 'Maria', 'MARIA', 'compradora', 'Rua das Flores', '74000', '6299999', '189.10', '123.456', 'portaria', 'Mozilla']

// ---------- 1. as contas puras ---------------------------------------------
const porteiro = await carregar(
  { SUPABASE_URL: BANCO, SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico-de-mentira', SHOPIFY_WEBHOOK_SECRET: SEGREDO, LOJA_API: 'https://loja.exemplo/api/graphql.json' },
  'inteiro',
)

const resumo = porteiro.resumir(PEDIDO)
const escrito = JSON.stringify(resumo)
confere('1. o resumo nao leva nada do comprador', DO_COMPRADOR.every((p) => !escrito.includes(p)), escrito)
confere(
  '2. o resumo so tem os campos combinados',
  Object.keys(resumo).sort().join() === 'atualizado_em,cancelado_em,criado_em,id,itens,nome,situacao,teste' &&
    Object.keys(resumo.itens[0]).sort().join() === 'desconto,devolvida,id,preco,produto,produto_id,quantidade,variante,variante_id',
  Object.keys(resumo).join(),
)
const [um, dois] = resumo.itens
confere(
  '3. a linha traz peca, tamanho, quantidade, preco e a soma dos descontos',
  um.id === '17463340597523' && um.produto_id === '10149030232339' && um.variante === 'G' && um.quantidade === 3 && um.preco === 289.9 && um.desconto === 173.94,
  JSON.stringify(um),
)
confere('4. a devolvida sai da devolucao da linha', um.devolvida === 1, String(um.devolvida))
confere('5. linha sem produto e sem tamanho nao quebra', dois.produto_id === '' && dois.variante === '' && dois.devolvida === 0, JSON.stringify(dois))
confere('6. situacao em minusculas e pedido que nao e de teste', resumo.situacao === 'partially_refunded' && resumo.teste === false && resumo.cancelado_em === null)
const soSaldo = porteiro.resumir({ ...PEDIDO, refunds: [], line_items: [{ ...PEDIDO.line_items[0], current_quantity: 0 }] })
confere('7. sem a lista de devolucoes, a devolvida sai do saldo da linha', soSaldo.itens[0].devolvida === 3, String(soSaldo.itens[0].devolvida))

const bytes = new TextEncoder().encode('{"a":1}')
confere('8. assinatura certa confere', await porteiro.assinaturaConfere(bytes, assinar('{"a":1}'), SEGREDO))
confere('9. assinatura de outro segredo nao confere', !(await porteiro.assinaturaConfere(bytes, assinar('{"a":1}', 'outro'), SEGREDO)))
confere('10. corpo mexido nao confere', !(await porteiro.assinaturaConfere(new TextEncoder().encode('{"a":2}'), assinar('{"a":1}'), SEGREDO)))
confere('11. sem segredo nada confere', !(await porteiro.assinaturaConfere(bytes, assinar('{"a":1}', ''), '')))

// ---------- 2. o aviso da loja ---------------------------------------------
const texto = JSON.stringify(PEDIDO)

chamadas = []
respostas = { 'rpc/registrar_pedido_da_loja': { corpo: { ok: true, itens: 2, reler_produtos: false } } }
let r = await porteiro.atender(aviso(texto, assinar(texto)))
confere('12. aviso assinado e aceito', r.status === 200 && (await r.json()).itens === 2)
confere(
  '13. o banco recebe o resumo, o topico e a chave de servico',
  chamadas.length === 1 &&
    chamadas[0].endereco === `${BANCO}/rest/v1/rpc/registrar_pedido_da_loja` &&
    chamadas[0].corpo.p_topico === 'orders/paid' &&
    chamadas[0].corpo.p_pedido.nome === '#1089' &&
    chamadas[0].cabecalhos.apikey === 'chave-de-servico-de-mentira',
  JSON.stringify(chamadas.map((c) => c.endereco)),
)
confere('14. nada do comprador vai ao banco', DO_COMPRADOR.every((p) => !JSON.stringify(chamadas[0]?.corpo ?? '').includes(p)))

chamadas = []
r = await porteiro.atender(aviso(texto, assinar(texto, 'segredo-errado')))
confere('15. aviso com assinatura errada e recusado e nao chega ao banco', r.status === 401 && chamadas.length === 0, String(r.status))

chamadas = []
r = await porteiro.atender(aviso(texto.replace('"quantity":3', '"quantity":9'), assinar(texto)))
confere('16. aviso alterado no caminho e recusado', r.status === 401 && chamadas.length === 0, String(r.status))

chamadas = []
r = await porteiro.atender(aviso(texto, ''))
confere('17. assinatura vazia e recusada', r.status === 401 && chamadas.length === 0, String(r.status))

chamadas = []
respostas = {
  'rpc/registrar_pedido_da_loja': { corpo: { ok: true, itens: 2, reler_produtos: true } },
  'rpc/colecoes_dos_parceiros': { corpo: [{ parceiro_id: 'p-1', colecao: 'colecao-um' }, { parceiro_id: 'p-2', colecao: 'colecao-que-caiu' }] },
  'loja.exemplo/api/graphql.json': (_u, corpo) =>
    corpo.variables.colecao === 'colecao-um'
      ? { corpo: { data: { collection: { products: { nodes: [{ id: 'gid://shopify/Product/10149030232339', title: 'Camisa Verde', vendor: 'x' }, { id: 'gid://shopify/Product/222', title: 'Camisa Branca' }], pageInfo: { hasNextPage: false, endCursor: null } } } } } }
      : { corpo: { data: { collection: null } } },
  'rpc/registrar_produtos_do_parceiro': { corpo: 2 },
}
r = await porteiro.atender(aviso(texto, assinar(texto)))
const gravou = chamadas.filter((c) => c.endereco.endsWith('rpc/registrar_produtos_do_parceiro'))
confere(
  '18. produto sem parceiro manda reler as colecoes, e a que falha nao impede a outra',
  r.status === 200 &&
    gravou.length === 1 &&
    gravou[0].corpo.p_parceiro === 'p-1' &&
    JSON.stringify(gravou[0].corpo.p_produtos) === JSON.stringify([{ id: '10149030232339', titulo: 'Camisa Verde' }, { id: '222', titulo: 'Camisa Branca' }]),
  JSON.stringify(gravou.map((c) => c.corpo)),
)

chamadas = []
respostas = { 'rpc/registrar_pedido_da_loja': { corpo: { ok: true, itens: 0, reler_produtos: false } } }
const outro = JSON.stringify({ id: 5, title: 'Produto alterado', email: 'maria.compradora@exemplo.com' })
r = await porteiro.atender(aviso(outro, assinar(outro), 'products/update'))
confere(
  '19. aviso que nao e de pedido vai vazio ao banco, so para ficar anotado',
  r.status === 200 && JSON.stringify(chamadas[0]?.corpo.p_pedido) === '{}' && chamadas[0]?.corpo.p_topico === 'products/update',
  JSON.stringify(chamadas[0]?.corpo),
)

chamadas = []
respostas = { 'rpc/registrar_pedido_da_loja': { status: 500, corpo: { message: 'banco fora' } } }
r = await porteiro.atender(aviso(texto, assinar(texto)))
confere('20. banco que nao responde vira 500, para a Shopify tentar de novo', r.status === 500, String(r.status))

// ---------- 3. o pedido do Fourtime OS -------------------------------------
function doOS(corpo, cabecalhos = {}) {
  return new Request(`${BANCO}/functions/v1/loja`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...cabecalhos },
    body: JSON.stringify(corpo),
  })
}
const CRACHA = { authorization: 'Bearer cracha-de-quem-entrou', apikey: 'chave-publicavel' }

chamadas = []
respostas = {}
r = await porteiro.atender(doOS({ acao: 'colecoes' }))
confere('21. sem cracha o porteiro nao atende o OS, e nem pergunta ao banco', r.status === 403 && chamadas.length === 0, String(r.status))

chamadas = []
respostas = { 'rpc/posso': { corpo: false } }
r = await porteiro.atender(doOS({ acao: 'colecoes' }, CRACHA))
confere(
  '22. quem nao pode editar Parceiros e recusado, e a pergunta vai com o cracha da pessoa',
  r.status === 403 &&
    chamadas.length === 1 &&
    chamadas[0].cabecalhos.Authorization === 'Bearer cracha-de-quem-entrou' &&
    chamadas[0].cabecalhos.apikey === 'chave-publicavel' &&
    chamadas[0].corpo.p_painel === 'parceiros' &&
    chamadas[0].corpo.p_nivel === 'editar',
  JSON.stringify(chamadas[0]),
)

chamadas = []
respostas = {
  'rpc/posso': { corpo: true },
  'loja.exemplo/api/graphql.json': (_u, corpo) =>
    corpo.variables.depois === null
      ? { corpo: { data: { collections: { nodes: [{ handle: 'viapol', title: 'Viapol Vôlei', description: 'x' }], pageInfo: { hasNextPage: true, endCursor: 'cursor-2' } } } } }
      : { corpo: { data: { collections: { nodes: [{ handle: 'goias', title: 'Goiás Vôlei' }], pageInfo: { hasNextPage: false, endCursor: null } } } } },
}
r = await porteiro.atender(doOS({ acao: 'colecoes' }, CRACHA))
let j = await r.json()
confere(
  '23. quem pode recebe as colecoes da loja, das duas paginas, em ordem de nome, so com endereco e nome',
  r.status === 200 &&
    JSON.stringify(j.colecoes) === JSON.stringify([{ colecao: 'goias', nome: 'Goiás Vôlei' }, { colecao: 'viapol', nome: 'Viapol Vôlei' }]) &&
    chamadas.filter((c) => c.endereco.includes('loja.exemplo')).length === 2,
  JSON.stringify(j),
)

chamadas = []
respostas = {
  'rpc/posso': { corpo: true },
  'rpc/colecoes_dos_parceiros': { corpo: [{ parceiro_id: 'p-1', colecao: 'colecao-um' }, { parceiro_id: 'p-2', colecao: 'colecao-dois' }] },
  'loja.exemplo/api/graphql.json': { corpo: { data: { collection: { products: { nodes: [{ id: 'gid://shopify/Product/333', title: 'Moletom' }], pageInfo: { hasNextPage: false, endCursor: null } } } } } },
  'rpc/registrar_produtos_do_parceiro': { corpo: 1 },
}
r = await porteiro.atender(doOS({ acao: 'produtos', parceiro: 'p-2' }, CRACHA))
j = await r.json()
confere(
  '24. reler os produtos de um parceiro le so a colecao dele',
  r.status === 200 &&
    j.parceiros.length === 1 &&
    j.parceiros[0].produtos === 1 &&
    chamadas.filter((c) => c.endereco.includes('loja.exemplo')).every((c) => c.corpo.variables.colecao === 'colecao-dois') &&
    JSON.stringify(chamadas.find((c) => c.endereco.endsWith('rpc/registrar_produtos_do_parceiro')).corpo.p_produtos) === JSON.stringify([{ id: '333', titulo: 'Moletom' }]),
  JSON.stringify(j),
)

r = await porteiro.atender(doOS({ acao: 'apagar-tudo' }, CRACHA))
confere('25. acao desconhecida e recusada', r.status === 400, String(r.status))

// ---------- 4. as outras portas --------------------------------------------
r = await porteiro.atender(new Request(`${BANCO}/functions/v1/loja`, { method: 'OPTIONS' }))
confere('26. a consulta do navegador (OPTIONS) passa com os cabecalhos de CORS', r.status === 204 && r.headers.get('access-control-allow-headers').includes('authorization'))

r = await porteiro.atender(new Request(`${BANCO}/functions/v1/loja`))
j = await r.json()
confere('27. a porta de conferencia diz que as chaves estao postas, sem mostrar valor', j.ok && j.assinatura === true && j.servico === true && !JSON.stringify(j).includes(SEGREDO))

const semSegredo = await carregar({ SUPABASE_URL: BANCO, SUPABASE_SERVICE_ROLE_KEY: 'x' }, 'sem-segredo')
chamadas = []
r = await semSegredo.atender(aviso(texto, assinar(texto, '')))
confere('28. sem o segredo colocado, todo aviso e recusado e nada chega ao banco', r.status === 503 && chamadas.length === 0, String(r.status))
r = await semSegredo.atender(new Request(`${BANCO}/functions/v1/loja`))
confere('29. e a porta de conferencia avisa que falta a assinatura', (await r.json()).assinatura === false)

chamadas = []
respostas = { 'rpc/colecoes_dos_parceiros': { corpo: [] } }
r = await porteiro.atender(new Request(`${BANCO}/functions/v1/loja?banco=1`))
j = await r.json()
confere('29b. com ?banco=1 a conferencia fala com o banco e diz que conseguiu', j.banco === true && chamadas.length === 1)
respostas = { 'rpc/colecoes_dos_parceiros': { status: 401, corpo: { message: 'chave recusada' } } }
r = await porteiro.atender(new Request(`${BANCO}/functions/v1/loja?banco=1`))
j = await r.json()
confere('29c. e diz que nao conseguiu quando o banco recusa a chave', j.banco === false && j.motivo.includes('401') && !JSON.stringify(j).includes('chave-de-servico-de-mentira'))

const chavesNovas = await carregar(
  { SUPABASE_URL: BANCO, SUPABASE_SECRET_KEYS: JSON.stringify({ outra: 'sb_secret_outra', default: 'sb_secret_padrao' }), SUPABASE_SERVICE_ROLE_KEY: 'antiga', SHOPIFY_WEBHOOK_SECRET: SEGREDO },
  'chaves-novas',
)
chamadas = []
respostas = { 'rpc/registrar_pedido_da_loja': { corpo: { ok: true, itens: 2, reler_produtos: false } } }
await chavesNovas.atender(aviso(texto, assinar(texto)))
confere('30. com o dicionario de chaves secretas, o porteiro usa a "default" e nao a antiga', chamadas[0]?.cabecalhos.apikey === 'sb_secret_padrao' && chamadas[0]?.cabecalhos.Authorization === 'Bearer sb_secret_padrao')

const dicionarioTorto = await carregar(
  { SUPABASE_URL: BANCO, SUPABASE_SECRET_KEYS: 'isto nao e json', SUPABASE_SERVICE_ROLE_KEY: 'antiga', SHOPIFY_WEBHOOK_SECRET: SEGREDO },
  'dicionario-torto',
)
chamadas = []
await dicionarioTorto.atender(aviso(texto, assinar(texto)))
confere('31. dicionario ilegivel cai na chave antiga', chamadas[0]?.cabecalhos.apikey === 'antiga')

console.log(`\n${certas} certas, ${erradas} erradas`)
process.exit(erradas ? 1 : 0)
