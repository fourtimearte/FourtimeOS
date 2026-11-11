/* A PONTE DO DRIVE (worker/), provada sem Google e sem Cloudflare.

   O Google, o Supabase (só a chave pública) e o cache da Cloudflare são de
   mentira, montados aqui: cada chamada que a ponte faz para fora passa por
   `falso`, que responde como o serviço de verdade e anota o pedido. O crachá
   é assinado aqui com uma chave ES256 nossa, como o Supabase assina, e a
   conta de serviço tem uma chave RSA nossa: a ponte assina, e o teste confere
   a assinatura com a chave pública, como o Google faria.

   Rodar: node --experimental-strip-types testes/ponte-do-drive.mjs */

import ponte, { esquecerSaude } from '../worker/index.ts'
import { esquecerChaves } from '../worker/sessao.ts'
import { esquecerToken } from '../worker/google.ts'

let ok = 0
const falhas = []
function diz(rot, obtido, esperado) {
  const certo = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(
    `  ${certo ? 'ok  ' : 'RUIM'} ${rot}${certo ? '' : `  obtido=${JSON.stringify(obtido)} esperado=${JSON.stringify(esperado)}`}`,
  )
  if (certo) ok++
  else falhas.push(rot)
}

const SUPA = 'https://projeto.supabase.co'
const PASTA = 'PASTA_DAS_ARTES_1234'
const b64u = u => Buffer.from(u).toString('base64url')

/* --- as chaves ----------------------------------------------------------- */
const ec = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const jwkPublica = {
  ...(await crypto.subtle.exportKey('jwk', ec.publicKey)),
  kid: 'k1',
  alg: 'ES256',
  use: 'sig',
}
const ecOutra = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])

async function cracha(mudar = {}, chave = ec.privateKey, kid = 'k1') {
  const agora = Math.floor(Date.now() / 1000)
  const cab = b64u(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }))
  const corpo = b64u(
    JSON.stringify({
      iss: SUPA + '/auth/v1',
      aud: 'authenticated',
      sub: 'pessoa-1',
      email: 'a@b.c',
      role: 'authenticated',
      exp: agora + 3600,
      ...mudar,
    }),
  )
  const ass = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    chave,
    new TextEncoder().encode(cab + '.' + corpo),
  )
  return cab + '.' + corpo + '.' + b64u(new Uint8Array(ass))
}

const rsa = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
)
const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', rsa.privateKey)).toString('base64')
const PEM =
  '-----BEGIN PRIVATE KEY-----\n' +
  pkcs8.match(/.{1,64}/g).join('\n') +
  '\n-----END PRIVATE KEY-----\n'
const CONTA = JSON.stringify({
  client_email: 'ponte@projeto.iam.gserviceaccount.com',
  private_key: PEM,
  token_uri: 'https://oauth2.googleapis.com/token',
})

/* --- o mundo de mentira --------------------------------------------------- */
let arquivos, pedidos, cache, pastaEscreve
function zerar() {
  arquivos = new Map([
    [
      'ARTE_NA_PASTA_0001',
      { mimeType: 'image/webp', parents: [PASTA], bytes: new Uint8Array([1, 2, 3, 4]), props: {} },
    ],
    [
      'ORCAMENTO_DO_EDITOR',
      {
        mimeType: 'application/octet-stream',
        parents: ['OUTRA_PASTA'],
        bytes: new Uint8Array([9]),
        props: {},
      },
    ],
    [
      'IMAGEM_DE_FORA_0001',
      { mimeType: 'image/png', parents: ['OUTRA_PASTA'], bytes: new Uint8Array([7]), props: {} },
    ],
    [
      'ARTE_NA_LIXEIRA_001',
      {
        mimeType: 'image/png',
        parents: [PASTA],
        trashed: true,
        bytes: new Uint8Array([5]),
        props: {},
      },
    ],
  ])
  pedidos = []
  cache = new Map()
  pastaEscreve = true
  esquecerSaude()
  esquecerChaves()
  esquecerToken()
}
globalThis.caches = {
  default: {
    async match(req) {
      const r = cache.get(req.url)
      return r ? r.clone() : undefined
    },
    async put(req, res) {
      cache.set(req.url, res)
    },
  },
}
let contador = 0
globalThis.fetch = async (entrada, init = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada.url)
  const metodo = (init.method || 'GET').toUpperCase()
  pedidos.push({ url: url.toString(), metodo, init })
  const js = (o, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } })
  if (url.toString() === SUPA + '/auth/v1/.well-known/jwks.json') return js({ keys: [jwkPublica] })
  if (url.toString() === 'https://oauth2.googleapis.com/token')
    return js({ access_token: 'TOKEN_DO_GOOGLE', expires_in: 3600 })
  if (url.pathname === '/drive/v3/files' && metodo === 'GET') {
    const q = url.searchParams.get('q')
    const hash = (q.match(/value='([a-f0-9]+)'/) || [])[1]
    const achado = [...arquivos].find(
      ([, a]) => a.parents.includes(PASTA) && !a.trashed && a.props.sha256 === hash,
    )
    return js({ files: achado ? [{ id: achado[0] }] : [] })
  }
  const mMeta = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/)
  if (mMeta && metodo === 'GET') {
    const id = decodeURIComponent(mMeta[1])
    if (id === PASTA) {
      return js({
        id,
        mimeType: 'application/vnd.google-apps.folder',
        capabilities: { canAddChildren: pastaEscreve },
      })
    }
    const a = arquivos.get(id)
    if (!a) return js({ error: { message: 'not found' } }, 404)
    if (url.searchParams.get('alt') === 'media')
      return new Response(a.bytes, { status: 200, headers: { 'Content-Type': a.mimeType } })
    return js({ id, mimeType: a.mimeType, parents: a.parents, trashed: !!a.trashed })
  }
  if (url.pathname === '/upload/drive/v3/files' && metodo === 'POST') {
    const corpo = Buffer.from(init.body)
    const fronteira = (init.headers['Content-Type'].match(/boundary=(.+)$/) || [])[1]
    const partes = corpo.toString('latin1').split('--' + fronteira)
    const meta = JSON.parse(partes[1].split('\r\n\r\n')[1].trim())
    const bytesTxt = partes[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
    const id = 'NOVA_ARTE_' + String(++contador).padStart(6, '0')
    arquivos.set(id, {
      mimeType: meta.mimeType,
      parents: meta.parents,
      bytes: Buffer.from(bytesTxt, 'latin1'),
      props: meta.appProperties,
      nome: meta.name,
    })
    return js({ id })
  }
  return js({ erro: 'não previsto: ' + metodo + ' ' + url }, 500)
}

const ASSETS = {
  fetch: async req => new Response('SITE ' + new URL(req.url).pathname, { status: 200 }),
}
const env = (extra = {}) => ({
  ASSETS,
  SUPABASE_URL: SUPA,
  DRIVE_PASTA: PASTA,
  GOOGLE_CONTA_DE_SERVICO: CONTA,
  ...extra,
})
const esperas = []
const ctx = { waitUntil: p => esperas.push(p) }
const chama = async (caminho, init = {}, e = env()) => {
  const r = await ponte.fetch(new Request('https://fourtimeos.exemplo.dev' + caminho, init), e, ctx)
  await Promise.all(esperas.splice(0))
  return r
}
const corpoDe = async r => {
  try {
    return await r.clone().json()
  } catch {
    return null
  }
}
const ARTE = new Uint8Array([82, 73, 70, 70, 0, 1, 2, 3, 13, 10, 45, 45, 255])
const HASH = 'a'.repeat(64)

/* ========================================================================== */
console.log('\n  --- a saúde')
zerar()
let r = await chama('/api/arte/saude', {}, env({ GOOGLE_CONTA_DE_SERVICO: '' }))
diz('sem a chave do Google: desligada, e diz por quê', await corpoDe(r), {
  pronto: false,
  motivo: 'sem-credencial',
})
zerar()
r = await chama('/api/arte/saude', {}, env({ DRIVE_PASTA: '' }))
diz('sem a pasta: desligada', (await corpoDe(r)).motivo, 'sem-pasta')
zerar()
r = await chama('/api/arte/saude')
diz('com a conta de serviço e a pasta que aceita arquivo: ligada', await corpoDe(r), {
  pronto: true,
  modo: 'conta-de-servico',
})
diz('  e a resposta não fica em cache nenhum', r.headers.get('Cache-Control'), 'no-store')
zerar()
pastaEscreve = false
r = await chama('/api/arte/saude')
diz(
  'pasta sem permissão de criar: desligada (é o Meu Drive com conta de serviço)',
  (await corpoDe(r)).motivo,
  'pasta-sem-escrita',
)
zerar()
r = await chama(
  '/api/arte/saude',
  {},
  env({
    GOOGLE_CONTA_DE_SERVICO: '',
    GOOGLE_CLIENTE_ID: 'cid',
    GOOGLE_CLIENTE_SEGREDO: 'seg',
    GOOGLE_RENOVACAO: 'ren',
  }),
)
diz('pelo OAuth da conta adm: ligada', await corpoDe(r), { pronto: true, modo: 'oauth' })
const pedToken = pedidos.find(p => p.url.includes('oauth2.googleapis.com/token'))
const formOauth = new URLSearchParams(pedToken.init.body)
diz(
  '  o token sai pela renovação',
  [formOauth.get('grant_type'), formOauth.get('refresh_token'), formOauth.get('client_id')],
  ['refresh_token', 'ren', 'cid'],
)

console.log('\n  --- a conta de serviço assina como o Google pede')
zerar()
await chama('/api/arte/saude')
const form = new URLSearchParams(pedidos.find(p => p.url.includes('oauth2')).init.body)
const [c64, p64, s64] = form.get('assertion').split('.')
const claims = JSON.parse(Buffer.from(p64, 'base64url').toString())
const assinou = await crypto.subtle.verify(
  'RSASSA-PKCS1-v1_5',
  rsa.publicKey,
  Buffer.from(s64, 'base64url'),
  new TextEncoder().encode(c64 + '.' + p64),
)
diz('a assinatura RS256 confere com a chave pública da conta', assinou, true)
diz(
  '  emissor, escopo do Drive e destino',
  [claims.iss, claims.scope, claims.aud],
  [
    'ponte@projeto.iam.gserviceaccount.com',
    'https://www.googleapis.com/auth/drive',
    'https://oauth2.googleapis.com/token',
  ],
)
diz('  vale uma hora', claims.exp - claims.iat, 3600)
diz('  o tipo de concessão', form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer')

console.log('\n  --- subir uma arte')
zerar()
const sobe = async (token, extra = {}) =>
  chama('/api/arte', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'image/webp',
      'X-Arte-Hash': HASH,
      'X-Arte-Nome': encodeURIComponent('ARENA CROSS 240326.png'),
      ...extra.headers,
    },
    body: extra.body || ARTE,
  })
r = await sobe('')
diz('sem crachá: 401', r.status, 401)
r = await sobe(await cracha({ exp: Math.floor(Date.now() / 1000) - 10 }))
diz('crachá vencido: 401', r.status, 401)
r = await sobe(await cracha({ iss: 'https://outro.supabase.co/auth/v1' }))
diz('crachá de outro projeto: 401', r.status, 401)
r = await sobe(await cracha({}, ecOutra.privateKey))
diz('crachá assinado por outra chave: 401', r.status, 401)
r = await sobe(await cracha({ aud: 'anon' }))
diz('crachá de quem não entrou (anon): 401', r.status, 401)
const bom = await cracha()
const adulterado = bom
  .split('.')
  .map((p, i) =>
    i === 1
      ? b64u(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: 'outra' }))
      : p,
  )
  .join('.')
r = await sobe(adulterado)
diz('crachá com o conteúdo trocado: 401', r.status, 401)
diz(
  '  e nenhuma ida ao Drive em tudo isso',
  pedidos.filter(p => p.url.includes('googleapis.com/') && !p.url.includes('oauth2')).length,
  0,
)

r = await sobe(bom)
const subida = await corpoDe(r)
diz(
  'crachá bom: 201 com o id novo',
  [r.status, /^NOVA_ARTE_/.test(subida.id), subida.repetida],
  [201, true, false],
)
const guardado = arquivos.get(subida.id)
diz('  o arquivo foi para a pasta das artes', guardado.parents, [PASTA])
diz('  com os mesmos bytes', [...guardado.bytes], [...ARTE])
diz(
  '  com o hash e a origem nas propriedades',
  [guardado.props.sha256, guardado.props.origem, guardado.props.quem],
  [HASH, 'fourtime-os', 'pessoa-1'],
)
diz(
  '  e o nome legível: a arte, o começo do hash e a extensão',
  guardado.nome,
  'ARENA CROSS 240326 aaaaaaaaaaaa.webp',
)

const antes = pedidos.length
r = await sobe(bom)
const de2 = await corpoDe(r)
diz(
  'a mesma arte de novo: devolve o mesmo id, sem subir',
  [r.status, de2.id, de2.repetida],
  [200, subida.id, true],
)
diz(
  '  nenhum envio novo ao Drive',
  pedidos.slice(antes).filter(p => p.url.includes('/upload/')).length,
  0,
)

r = await sobe(bom, { headers: { 'Content-Type': 'application/pdf' } })
diz('não é imagem: 415', r.status, 415)
r = await sobe(bom, { body: new Uint8Array(15 * 1024 * 1024 + 1) })
diz('acima de 15 MB: 413', r.status, 413)
r = await sobe(bom, { body: new Uint8Array(0) })
diz('vazio: 400', r.status, 400)
r = await chama(
  '/api/arte',
  {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + bom, 'Content-Type': 'image/webp' },
    body: ARTE,
  },
  env({ GOOGLE_CONTA_DE_SERVICO: '' }),
)
diz('ponte desligada: 503, e a tela continua com a arte dentro da cotação', r.status, 503)

console.log('\n  --- entregar uma arte')
zerar()
const cookie = { Cookie: 'outra=1; ft_arte=' + encodeURIComponent(bom) }
r = await chama('/api/arte/ARTE_NA_PASTA_0001')
diz('sem crachá: 401', r.status, 401)
r = await chama('/api/arte/ARTE_NA_PASTA_0001', { headers: cookie })
diz(
  'com o crachá no cookie (é o que o <img> manda): 200 com os bytes',
  [r.status, [...new Uint8Array(await r.clone().arrayBuffer())]],
  [200, [1, 2, 3, 4]],
)
diz('  com o tipo da imagem', r.headers.get('Content-Type'), 'image/webp')
diz(
  '  guardada um ano só no navegador de quem viu',
  r.headers.get('Cache-Control'),
  'private, max-age=31536000, immutable',
)
diz(
  '  e no cache da Cloudflare',
  cache.has('https://fourtimeos.exemplo.dev/api/arte/ARTE_NA_PASTA_0001'),
  true,
)
const n = pedidos.length
r = await chama('/api/arte/ARTE_NA_PASTA_0001', { headers: { Authorization: 'Bearer ' + bom } })
diz(
  'a segunda vez sai do cache, sem ir ao Drive',
  [r.status, pedidos.slice(n).filter(p => p.url.includes('googleapis')).length],
  [200, 0],
)
r = await chama('/api/arte/ARTE_NA_PASTA_0001')
diz('o cache não abre para quem não entrou', r.status, 401)
r = await chama('/api/arte/ORCAMENTO_DO_EDITOR', { headers: cookie })
diz('arquivo de fora da pasta (o .ft do editor): 404', r.status, 404)
r = await chama('/api/arte/IMAGEM_DE_FORA_0001', { headers: cookie })
diz('imagem de fora da pasta: 404', r.status, 404)
r = await chama('/api/arte/ARTE_NA_LIXEIRA_001', { headers: cookie })
diz('arte que foi para a lixeira: 404', r.status, 404)
r = await chama('/api/arte/' + encodeURIComponent("x' or '1'='1"), { headers: cookie })
diz('id torto: 404 sem perguntar ao Drive', r.status, 404)

console.log('\n  --- o resto do site')
r = await chama('/cotacao/123')
diz('as páginas continuam vindo dos arquivos do site', await r.text(), 'SITE /cotacao/123')
r = await chama('/api/outra-coisa')
diz('endereço /api desconhecido: 404', r.status, 404)

console.log('\n  --- lembranças')
zerar()
await chama('/api/arte/ARTE_NA_PASTA_0001', { headers: cookie })
await chama('/api/arte/IMAGEM_DE_FORA_0001', { headers: cookie })
diz(
  'o token do Google é pedido uma vez só',
  pedidos.filter(p => p.url.includes('oauth2')).length,
  1,
)
diz(
  'a chave pública do Supabase é lida uma vez só',
  pedidos.filter(p => p.url.includes('jwks')).length,
  1,
)

console.log(`\n  ${ok} conferências passaram`)
if (falhas.length) {
  console.log(`  FALHARAM ${falhas.length}:\n    - ${falhas.join('\n    - ')}`)
  process.exit(1)
}
console.log('  ponte do Drive: tudo certo')
