// ===========================================================================
// O PORTEIRO DO CHAT DA LOJA (parte C2 do plano FOURTIME OS - 15)
//
// Funcao do Supabase (Edge Function) que recebe a ficha do chat da loja
// (fourtimefit.com.br) quando o cliente deixa nome e telefone, e entrega ao
// banco (registrar_lead_do_site, migracao 065). Endereco:
// <projeto>.supabase.co/functions/v1/lead-do-site
//
// O contrato da ficha e o do SHOPIFY - 04, secao 6.1.6. O navegador do
// cliente nao fala com o banco: fala com este arquivo, que confere tudo de
// novo, porque o endereco e publico e qualquer um pode mandar um POST.
//
// O QUE ESTE PORTEIRO FAZ, NA ORDEM:
//   1. so atende as origens da loja (CORS, e 403 para outra origem sem nem
//      ler o corpo);
//   2. corpo de ate 64 KB, JSON certo;
//   3. isca preenchida, ou enviado menos de 3 segundos depois de aberto: 422;
//   4. guarda so os campos do contrato, com teto de tamanho em cada texto;
//   5. o limite por IP (5 em 10 minutos, 20 em 24 horas) e a gravacao ficam
//      com o banco. O IP chega la como impressao (HMAC com a chave de servico),
//      nunca cru, por causa da LGPD.
//
// Respostas, sempre JSON: 201 lead novo, 200 repetido, 400, 403, 422, 429,
// 500. O chat so diz "Recebemos!" com 2xx; o resto ele tenta de novo ou
// oferece o WhatsApp.
//
// SEGREDOS: nenhum novo. SUPABASE_URL e a chave de servico ja vem postos pelo
// Supabase. Para o ensaio pelo editor de tema, ORIGENS_EXTRA pode receber
// outras origens separadas por virgula (decisao 6: o myshopify ja esta aqui).
//
// PUBLICAR: com "Verify JWT" DESLIGADO. O visitante da loja nao tem cracha.
// ===========================================================================

declare const Deno: {
  env: { get(nome: string): string | undefined }
  serve(atender: (req: Request) => Response | Promise<Response>): unknown
}

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
const CHAVE_DE_SERVICO = chaveDeServico()

/* A loja e, enquanto durar o ensaio, o dominio myshopify dela (decisao 6 do
   plano 15). Sai daqui na hora de ligar para todos. */
const ORIGENS = new Set(
  [
    'https://fourtimefit.com.br',
    'https://www.fourtimefit.com.br',
    'https://0e952b-76.myshopify.com',
    ...(Deno.env.get('ORIGENS_EXTRA') ?? '').split(','),
  ]
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean),
)

const TETO_DO_CORPO = 64 * 1024

function chaveDeServico(): string {
  const novas = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (novas) {
    try {
      const dicionario = JSON.parse(novas) as Record<string, unknown>
      const escolhida = dicionario.default ?? Object.values(dicionario)[0]
      if (typeof escolhida === 'string' && escolhida) return escolhida
    } catch {
      /* dicionario ilegivel: segue para a chave antiga */
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

function cors(origem: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function responder(corpo: unknown, status: number, origem = ''): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      ...(origem ? cors(origem) : {}),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

// ---------- a ficha, so com o que o contrato tem ---------------------------

type Solto = Record<string, unknown>

const texto = (v: unknown, teto: number): string =>
  (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, teto)

function objeto(v: unknown): Solto | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Solto) : null
}

/* So da loja: pagina de outro site no campo da pagina vira vazio. */
function daLoja(endereco: unknown): string {
  const e = texto(endereco, 500)
  try {
    const u = new URL(e)
    return ORIGENS.has(u.origin) ? e : ''
  } catch {
    return ''
  }
}

/* O QUE NAO ESTA AQUI NAO PASSA. Os codigos do orcamento vao como vieram: a
   lista fechada e conferida no banco, que recusa codigo fora dela. */
export function limpar(f: Solto): Solto {
  const utm = objeto(f.utm)
  const produto = objeto(f.produto)
  const falas = Array.isArray(f.mensagens) ? f.mensagens.slice(0, 200) : []
  const ficha: Solto = {
    origem: texto(f.origem, 20),
    id_envio: texto(f.id_envio, 40),
    enviado_em: texto(f.enviado_em, 40),
    aberto_em: texto(f.aberto_em, 40),
    empresa_extra: texto(f.empresa_extra, 200),
    nome: texto(f.nome, 120),
    telefone: texto(f.telefone, 20),
    email: texto(f.email, 200),
    mensagem: texto(f.mensagem, 2000),
    detalhe: texto(f.detalhe, 2000),
    pagina_origem: daLoja(f.pagina_origem),
    pagina_titulo: texto(f.pagina_titulo, 200),
    consentimento_em: texto(f.consentimento_em, 40),
    consentimento_texto: texto(f.consentimento_texto, 80),
    motivo: texto(f.motivo, 30),
    prioridade: f.prioridade === true,
    fora_do_horario: f.fora_do_horario === true,
    entrou_por: daLoja(f.entrou_por),
    veio_de: texto(f.veio_de, 500),
    fbclid: texto(f.fbclid, 300),
    gclid: texto(f.gclid, 300),
    dispositivo: f.dispositivo === 'celular' || f.dispositivo === 'computador' ? f.dispositivo : '',
    roteiro_atualizado_em: texto(f.roteiro_atualizado_em, 40),
    envio_numero: Number.isInteger(f.envio_numero) ? f.envio_numero : 1,
    teste: f.teste === true,
    utm: utm
      ? {
          source: texto(utm.source, 120),
          medium: texto(utm.medium, 120),
          campaign: texto(utm.campaign, 200),
          content: texto(utm.content, 200),
          term: texto(utm.term, 200),
        }
      : null,
    produto: produto
      ? { id: texto(produto.id, 80), titulo: texto(produto.titulo, 200), url: daLoja(produto.url) }
      : null,
    mensagens: falas
      .map((x) => objeto(x))
      .filter((x): x is Solto => !!x)
      .map((x) => ({
        autor: x.autor === 'cliente' ? 'cliente' : 'bot',
        texto: texto(x.texto, 2000),
        em: texto(x.em, 40),
      })),
  }
  for (const campo of ['tipo_peca', 'modelo_camiseta', 'finalidade', 'quantidade_faixa', 'prazo', 'arte']) {
    if (f[campo] !== undefined && f[campo] !== null && f[campo] !== '') ficha[campo] = texto(f[campo], 40)
  }
  return ficha
}

/* Robo: isca preenchida, ou ficha enviada menos de 3 segundos depois de o
   chat abrir (gente nao le, digita nome e telefone e aceita a politica em
   menos que isso). */
export function pareceRobo(f: Solto): boolean {
  if (texto(f.empresa_extra, 200).trim() !== '') return true
  const aberto = Date.parse(texto(f.aberto_em, 40))
  const enviado = Date.parse(texto(f.enviado_em, 40))
  return Number.isFinite(aberto) && Number.isFinite(enviado) && enviado - aberto < 3000
}

/* A impressao do IP: HMAC-SHA256 com a chave de servico, em hexadecimal. O
   mesmo IP da sempre a mesma impressao (e o que o limite precisa), e sem a
   chave nao se volta ao IP. */
export async function impressao(ip: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode('ip:' + ip)))
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function ipDe(req: Request): string {
  const primeiro = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  return (req.headers.get('cf-connecting-ip') ?? '').trim() || primeiro || (req.headers.get('x-real-ip') ?? '').trim() || 'sem-ip'
}

// ---------- o banco --------------------------------------------------------

/* O codigo do erro do banco vira a resposta: P0429 e o limite, P0422 a isca,
   22023 o que esta fora do contrato. O resto e problema nosso (500), e o chat
   tenta de novo. */
async function registrar(ficha: Solto, marca: string): Promise<{ status: number; corpo: Solto }> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_lead_do_site`, {
    method: 'POST',
    headers: {
      apikey: CHAVE_DE_SERVICO,
      Authorization: `Bearer ${CHAVE_DE_SERVICO}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_ficha: ficha, p_impressao: marca }),
    signal: AbortSignal.timeout(8000),
  })
  const bruto = await r.text()
  let dados: Solto = {}
  try {
    dados = bruto ? (JSON.parse(bruto) as Solto) : {}
  } catch {
    /* resposta que nao e JSON: fica vazia */
  }
  if (r.ok) return { status: dados.repetido === true ? 200 : 201, corpo: { ok: true } }
  const codigo = texto(dados.code, 10)
  if (codigo === 'P0429') return { status: 429, corpo: { ok: false, erro: 'Muitos envios. Tente de novo em alguns minutos.' } }
  if (codigo === 'P0422') return { status: 422, corpo: { ok: false, erro: 'Ficha recusada.' } }
  if (codigo === '22023') return { status: 400, corpo: { ok: false, erro: texto(dados.message, 120) || 'Ficha fora do contrato.' } }
  return { status: 500, corpo: { ok: false, erro: 'O Fourtime OS não respondeu.' } }
}

// ---------- a porta --------------------------------------------------------

export async function atender(req: Request): Promise<Response> {
  const origem = (req.headers.get('origin') ?? '').replace(/\/+$/, '')
  const daCasa = ORIGENS.has(origem)
  try {
    if (req.method === 'OPTIONS') {
      return daCasa ? new Response(null, { status: 204, headers: cors(origem) }) : responder({ ok: false }, 403)
    }
    if (req.method === 'GET') {
      /* so diz se a chave de servico esta posta, nunca o valor */
      return responder({ ok: true, porteiro: 'lead-do-site', servico: CHAVE_DE_SERVICO !== '' }, 200)
    }
    if (req.method !== 'POST') return responder({ ok: false, erro: 'Método não atendido.' }, 405, daCasa ? origem : '')
    if (!daCasa) return responder({ ok: false, erro: 'Origem não atendida.' }, 403)

    const declarado = Number(req.headers.get('content-length') ?? '0')
    if (declarado > TETO_DO_CORPO) return responder({ ok: false, erro: 'Ficha grande demais.' }, 400, origem)
    const bruto = await req.text()
    if (bruto.length > TETO_DO_CORPO) return responder({ ok: false, erro: 'Ficha grande demais.' }, 400, origem)
    let recebido: unknown
    try {
      recebido = JSON.parse(bruto)
    } catch {
      return responder({ ok: false, erro: 'JSON ilegível.' }, 400, origem)
    }
    const f = objeto(recebido)
    if (!f) return responder({ ok: false, erro: 'JSON ilegível.' }, 400, origem)
    if (pareceRobo(f)) return responder({ ok: false, erro: 'Ficha recusada.' }, 422, origem)

    const ficha = limpar(f)
    const marca = await impressao(ipDe(req), CHAVE_DE_SERVICO || 'sem-chave')
    const { status, corpo } = await registrar(ficha, marca)
    return responder(corpo, status, origem)
  } catch {
    return responder({ ok: false, erro: 'O Fourtime OS não respondeu.' }, 500, daCasa ? origem : '')
  }
}

Deno.serve(atender)
