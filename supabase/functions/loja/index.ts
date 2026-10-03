// ===========================================================================
// O PORTEIRO DA LOJA
//
// Funcao do Supabase (Edge Function) que fica entre a loja da Shopify e o
// banco do Fourtime OS. Endereco: <projeto>.supabase.co/functions/v1/loja
//
// Ela atende duas portas:
//
//   1. O AVISO DA LOJA (webhook). A Shopify manda cada pedido criado, pago ou
//      alterado. O porteiro confere a assinatura do aviso, joga fora tudo que
//      e do comprador e entrega ao banco so as linhas do pedido: peca,
//      tamanho, quantidade e valor (registrar_pedido_da_loja, migracao 043).
//
//   2. O PEDIDO DO FOURTIME OS. A pagina Parceiros pede a lista de colecoes
//      da loja e manda reler os produtos de um parceiro. So atende quem esta
//      dentro do sistema e pode editar a pagina Parceiros (a pergunta e feita
//      ao banco, com o cracha de quem pediu).
//
// O QUE NUNCA PASSA DAQUI PARA O BANCO: nome, e-mail, telefone, endereco e
// documento de quem comprou. A funcao resumir() escolhe campo por campo o que
// fica; o que ela nao cita, nao vai.
//
// SEGREDOS (painel do Supabase, Edge Functions, Secrets):
//   SHOPIFY_WEBHOOK_SECRET   a chave com que a Shopify assina os avisos.
//                            Quem cola e o Henrique. Sem ela, todo aviso e
//                            recusado.
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ja vem postos pelo Supabase.
//
// PUBLICAR: esta funcao tem de ficar com "Verify JWT" DESLIGADO. A Shopify
// nao manda cracha do Supabase; quem protege cada porta e o codigo abaixo.
// ===========================================================================

declare const Deno: {
  env: { get(nome: string): string | undefined }
  serve(atender: (req: Request) => Response | Promise<Response>): unknown
}
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

const LOJA = (Deno.env.get('LOJA_ENDERECO') ?? 'https://fourtimefit.com.br').replace(/\/+$/, '')
const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
const CHAVE_DE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SEGREDO = Deno.env.get('SHOPIFY_WEBHOOK_SECRET') ?? ''

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
}

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// ---------- a assinatura do aviso ------------------------------------------

/* A Shopify assina o corpo do aviso, byte por byte, com HMAC-SHA256 e manda o
   resultado em base64 no cabecalho. A conta tem de ser feita sobre os bytes
   que chegaram, e nao sobre o JSON relido. A comparacao olha todos os
   caracteres antes de responder, para o tempo da resposta nao contar a quem
   tenta adivinhar em que ponto errou. */
export async function assinaturaConfere(corpo: Uint8Array, recebida: string, segredo: string): Promise<boolean> {
  if (!segredo || !recebida) return false
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, corpo as unknown as ArrayBuffer))
  let texto = ''
  for (const b of mac) texto += String.fromCharCode(b)
  const esperada = btoa(texto)
  const dada = recebida.trim()
  if (esperada.length !== dada.length) return false
  let diferenca = 0
  for (let i = 0; i < esperada.length; i++) diferenca |= esperada.charCodeAt(i) ^ dada.charCodeAt(i)
  return diferenca === 0
}

// ---------- o que sobra do pedido ------------------------------------------

type Solto = Record<string, unknown>

function numero(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function lista(v: unknown): Solto[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Solto[]) : []
}

/* O PEDIDO SEM O COMPRADOR. Daqui para a frente so existem estes campos. O
   aviso da Shopify traz cliente, e-mail, telefone, endereco de entrega e de
   cobranca, IP e navegador: nada disso e lido.

   A quantidade devolvida vem de dois lugares e vale o maior: a soma das
   devolucoes da linha (refunds) e a diferenca entre o que foi pedido e o que
   ainda vale (current_quantity). */
export function resumir(pedido: Solto): Solto {
  const devolvidas = new Map<string, number>()
  for (const devolucao of lista(pedido.refunds)) {
    for (const linha of lista(devolucao.refund_line_items)) {
      const id = texto(linha.line_item_id)
      devolvidas.set(id, (devolvidas.get(id) ?? 0) + numero(linha.quantity))
    }
  }
  return {
    id: texto(pedido.id),
    nome: texto(pedido.name),
    criado_em: texto(pedido.created_at) || null,
    atualizado_em: texto(pedido.updated_at) || null,
    cancelado_em: texto(pedido.cancelled_at) || null,
    situacao: texto(pedido.financial_status).toLowerCase(),
    teste: pedido.test === true,
    itens: lista(pedido.line_items).map((linha) => {
      const quantidade = numero(linha.quantity)
      const porDevolucao = devolvidas.get(texto(linha.id)) ?? 0
      const porSaldo =
        linha.current_quantity == null ? 0 : Math.max(0, quantidade - numero(linha.current_quantity))
      let desconto = 0
      for (const d of lista(linha.discount_allocations)) desconto += numero(d.amount)
      return {
        id: texto(linha.id),
        produto_id: linha.product_id == null ? '' : texto(linha.product_id),
        variante_id: linha.variant_id == null ? '' : texto(linha.variant_id),
        produto: texto(linha.title),
        variante: texto(linha.variant_title),
        quantidade,
        devolvida: Math.min(quantidade, Math.max(porDevolucao, porSaldo)),
        preco: numero(linha.price),
        desconto: Math.round(desconto * 100) / 100,
      }
    }),
  }
}

// ---------- a conversa com o banco -----------------------------------------

async function chamar(funcao: string, corpo: unknown): Promise<unknown> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcao}`, {
    method: 'POST',
    headers: {
      apikey: CHAVE_DE_SERVICO,
      Authorization: `Bearer ${CHAVE_DE_SERVICO}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo),
  })
  const resposta = await r.text()
  if (!r.ok) throw new Error(`${funcao} respondeu ${r.status}: ${resposta.slice(0, 300)}`)
  return resposta ? JSON.parse(resposta) : null
}

/* Quem pediu pode editar a pagina Parceiros? A pergunta vai ao banco com o
   cracha de quem pediu, e nao com a chave de servico: assim quem responde e a
   mesma matriz de acessos que vale para a tela. */
async function podeEditar(req: Request): Promise<boolean> {
  const cracha = req.headers.get('authorization') ?? ''
  const apikey = req.headers.get('apikey') ?? ''
  if (!cracha.toLowerCase().startsWith('bearer ') || !apikey) return false
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/posso`, {
    method: 'POST',
    headers: { apikey, Authorization: cracha, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_painel: 'parceiros', p_nivel: 'editar' }),
  })
  if (!r.ok) return false
  return (await r.json()) === true
}

// ---------- a leitura da loja ----------------------------------------------

/* A vitrine da loja entrega a lista de colecoes e os produtos de cada uma em
   JSON, sem chave nenhuma: sao os mesmos dados que qualquer visitante ve. E o
   que dispensa um app na Shopify so para saber de que colecao e um produto.
   So entra produto publicado na loja, o que basta: produto que vendeu estava
   publicado. */
async function lerDaLoja(caminho: string): Promise<Solto> {
  const r = await fetch(`${LOJA}${caminho}`, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`a loja respondeu ${r.status} em ${caminho.split('?')[0]}`)
  return (await r.json()) as Solto
}

async function colecoesDaLoja(): Promise<Solto[]> {
  const todas: Solto[] = []
  for (let pagina = 1; pagina <= 8; pagina++) {
    const j = await lerDaLoja(`/collections.json?limit=250&page=${pagina}`)
    const vieram = lista(j.collections)
    for (const c of vieram) {
      todas.push({ colecao: texto(c.handle), nome: texto(c.title), produtos: numero(c.products_count) })
    }
    if (vieram.length < 250) break
  }
  todas.sort((a, b) => texto(a.nome).localeCompare(texto(b.nome), 'pt-BR'))
  return todas
}

async function produtosDaColecao(colecao: string): Promise<Solto[]> {
  const todos: Solto[] = []
  for (let pagina = 1; pagina <= 20; pagina++) {
    const j = await lerDaLoja(`/collections/${encodeURIComponent(colecao)}/products.json?limit=250&page=${pagina}`)
    const vieram = lista(j.products)
    for (const p of vieram) todos.push({ id: texto(p.id), titulo: texto(p.title) })
    if (vieram.length < 250) break
  }
  return todos
}

/* Rele os produtos dos parceiros ativos (ou de um so). O erro de um parceiro
   nao impede a leitura dos outros: volta escrito na linha dele. */
async function relerProdutos(soEste?: string): Promise<Solto[]> {
  const parceiros = lista(await chamar('colecoes_dos_parceiros', {}))
  const feito: Solto[] = []
  for (const p of parceiros) {
    const id = texto(p.parceiro_id)
    if (soEste && id !== soEste) continue
    try {
      const produtos = await produtosDaColecao(texto(p.colecao))
      const total = await chamar('registrar_produtos_do_parceiro', { p_parceiro: id, p_produtos: produtos })
      feito.push({ parceiro: id, na_colecao: produtos.length, produtos: total })
    } catch (erro) {
      feito.push({ parceiro: id, erro: erro instanceof Error ? erro.message : String(erro) })
    }
  }
  return feito
}

// ---------- as duas portas -------------------------------------------------

async function atenderAviso(req: Request, corpo: Uint8Array, assinatura: string): Promise<Response> {
  if (!SEGREDO) return responder({ ok: false, erro: 'O segredo da assinatura ainda não foi colocado.' }, 503)
  if (!(await assinaturaConfere(corpo, assinatura, SEGREDO))) {
    return responder({ ok: false, erro: 'Assinatura não confere.' }, 401)
  }
  const topico = req.headers.get('x-shopify-topic') ?? ''
  let pedido: Solto = {}
  try {
    const lido = JSON.parse(new TextDecoder().decode(corpo))
    if (lido && typeof lido === 'object') pedido = lido as Solto
  } catch {
    return responder({ ok: false, erro: 'O aviso não é JSON.' }, 400)
  }
  /* aviso que nao e de pedido (sem linhas) vai ao banco vazio, so para ficar
     anotado no registro que chegou */
  const resumo = Array.isArray(pedido.line_items) ? resumir(pedido) : {}
  const feito = (await chamar('registrar_pedido_da_loja', { p_pedido: resumo, p_topico: topico })) as Solto
  if (feito && feito.reler_produtos === true) {
    /* a Shopify espera a resposta por 5 segundos: a releitura dos produtos
       corre depois de responder */
    const depois = relerProdutos().catch(() => [])
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(depois)
    else await depois
  }
  return responder({ ok: true, itens: feito?.itens ?? 0 })
}

async function atenderOS(req: Request, corpo: Uint8Array): Promise<Response> {
  if (!(await podeEditar(req))) {
    return responder({ ok: false, erro: 'Seu acesso não permite mexer nos parceiros.' }, 403)
  }
  let pedido: Solto = {}
  try {
    const lido = JSON.parse(new TextDecoder().decode(corpo) || '{}')
    if (lido && typeof lido === 'object') pedido = lido as Solto
  } catch {
    return responder({ ok: false, erro: 'Pedido que não é JSON.' }, 400)
  }
  if (pedido.acao === 'colecoes') {
    return responder({ ok: true, colecoes: await colecoesDaLoja() })
  }
  if (pedido.acao === 'produtos') {
    const parceiro = texto(pedido.parceiro)
    return responder({ ok: true, parceiros: await relerProdutos(parceiro || undefined) })
  }
  return responder({ ok: false, erro: 'Ação desconhecida.' }, 400)
}

export async function atender(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (req.method === 'GET') {
      /* so diz se as duas chaves estao postas, nunca o valor delas */
      return responder({ ok: true, porteiro: 'loja', assinatura: SEGREDO !== '', servico: CHAVE_DE_SERVICO !== '' })
    }
    if (req.method !== 'POST') return responder({ ok: false, erro: 'Método não atendido.' }, 405)
    const corpo = new Uint8Array(await req.arrayBuffer())
    const assinatura = req.headers.get('x-shopify-hmac-sha256')
    if (assinatura !== null) return await atenderAviso(req, corpo, assinatura)
    return await atenderOS(req, corpo)
  } catch (erro) {
    /* 500 faz a Shopify tentar de novo mais tarde, que e o que se quer quando
       o banco nao respondeu */
    return responder({ ok: false, erro: erro instanceof Error ? erro.message : String(erro) }, 500)
  }
}

Deno.serve(atender)
