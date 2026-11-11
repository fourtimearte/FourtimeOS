/* O GOOGLE DRIVE, EM REST PURO.

   Dois jeitos de entrar, os mesmos que o editor V4 conhece:

   1. CONTA DE SERVIÇO (GOOGLE_CONTA_DE_SERVICO, o JSON inteiro). Lê e grava
      por id, mas não tem cota: só CRIA arquivo dentro de um Drive
      compartilhado. No "Meu Drive" de uma conta o Google recusa
      (storageQuotaExceeded), que é o motivo de o editor ter o Apps Script.

   2. A CONTA adm@ PELO OAUTH (GOOGLE_CLIENTE_ID, GOOGLE_CLIENTE_SEGREDO e
      GOOGLE_RENOVACAO). Cria no Meu Drive dela, com a cota dela.

   O resto (subir, achar, baixar) é igual para os dois. supportsAllDrives em
   tudo: sem ele, arquivo de Drive compartilhado não existe para a API. */

import type { Ambiente } from './tipos.ts'

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const TOKEN = 'https://oauth2.googleapis.com/token'
const ESCOPO = 'https://www.googleapis.com/auth/drive'

type ContaDeServico = { client_email: string; private_key: string; token_uri?: string }
export type Credencial =
  | { modo: 'conta-de-servico'; conta: ContaDeServico }
  | { modo: 'oauth'; id: string; segredo: string; renovacao: string }

export function credencialDoGoogle(env: Ambiente): Credencial | null {
  if (env.GOOGLE_CONTA_DE_SERVICO) {
    try {
      const c = JSON.parse(env.GOOGLE_CONTA_DE_SERVICO) as ContaDeServico
      if (c.client_email && c.private_key) return { modo: 'conta-de-servico', conta: c }
    } catch {
      return null
    }
  }
  if (env.GOOGLE_CLIENTE_ID && env.GOOGLE_CLIENTE_SEGREDO && env.GOOGLE_RENOVACAO) {
    return {
      modo: 'oauth',
      id: env.GOOGLE_CLIENTE_ID,
      segredo: env.GOOGLE_CLIENTE_SEGREDO,
      renovacao: env.GOOGLE_RENOVACAO,
    }
  }
  return null
}

/* --- o token, lembrado até um minuto antes de vencer ------------------------ */
let tokenGuardado: { valor: string; venceEm: number } | null = null

export function esquecerToken(): void {
  tokenGuardado = null
}

function base64Url(bytes: Uint8Array | string): string {
  const u = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function derDoPem(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  const s = atob(b64)
  const u = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i)
  return u.buffer
}

async function assinarConta(conta: ContaDeServico): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  const cab = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = base64Url(
    JSON.stringify({
      iss: conta.client_email,
      scope: ESCOPO,
      aud: conta.token_uri || TOKEN,
      iat: agora,
      exp: agora + 3600,
    }),
  )
  const chave = await crypto.subtle.importKey(
    'pkcs8',
    derDoPem(conta.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const ass = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    chave,
    new TextEncoder().encode(cab + '.' + corpo),
  )
  return cab + '.' + corpo + '.' + base64Url(new Uint8Array(ass))
}

export async function tokenDoGoogle(env: Ambiente): Promise<string> {
  if (tokenGuardado && tokenGuardado.venceEm - Date.now() > 60_000) return tokenGuardado.valor
  const cred = credencialDoGoogle(env)
  if (!cred) throw new Error('sem credencial do Google')
  const corpo = new URLSearchParams()
  if (cred.modo === 'conta-de-servico') {
    corpo.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
    corpo.set('assertion', await assinarConta(cred.conta))
  } else {
    corpo.set('grant_type', 'refresh_token')
    corpo.set('client_id', cred.id)
    corpo.set('client_secret', cred.segredo)
    corpo.set('refresh_token', cred.renovacao)
  }
  const r = await fetch(cred.modo === 'conta-de-servico' ? cred.conta.token_uri || TOKEN : TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corpo.toString(),
  })
  const dados = (await r.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
  }
  if (!r.ok || !dados.access_token)
    throw new Error('o Google recusou a entrada: ' + (dados.error || r.status))
  tokenGuardado = {
    valor: dados.access_token,
    venceEm: Date.now() + (dados.expires_in || 3600) * 1000,
  }
  return tokenGuardado.valor
}

/* --- as chamadas ------------------------------------------------------------ */
type Metadados = {
  id?: string
  mimeType?: string
  parents?: string[]
  trashed?: boolean
  capabilities?: { canAddChildren?: boolean }
}

export async function metadados(
  token: string,
  id: string,
  campos: string,
): Promise<Metadados | null> {
  const r = await fetch(
    DRIVE +
      '/files/' +
      encodeURIComponent(id) +
      '?supportsAllDrives=true&fields=' +
      encodeURIComponent(campos),
    { headers: { Authorization: 'Bearer ' + token } },
  )
  if (r.status === 404) return null
  if (!r.ok) throw new Error('metadados ' + r.status)
  return (await r.json()) as Metadados
}

/** a mesma arte já subida antes (pelo hash): devolve o id, e não sobe de novo */
export async function acharPorHash(
  token: string,
  pasta: string,
  hash: string,
): Promise<string | null> {
  const q =
    "'" +
    pasta +
    "' in parents and trashed = false and appProperties has { key='sha256' and value='" +
    hash +
    "' }"
  const r = await fetch(
    DRIVE +
      '/files?supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1&fields=files(id)&q=' +
      encodeURIComponent(q),
    { headers: { Authorization: 'Bearer ' + token } },
  )
  if (!r.ok) return null
  const dados = (await r.json()) as { files?: { id: string }[] }
  return dados.files && dados.files[0] ? dados.files[0].id : null
}

/** sobe por multipart (metadados e bytes num pedido só) e devolve o id */
export async function subir(
  token: string,
  pasta: string,
  nome: string,
  tipo: string,
  bytes: Uint8Array,
  props: Record<string, string>,
): Promise<string> {
  const fronteira = 'ftos' + Math.random().toString(36).slice(2)
  const meta = JSON.stringify({
    name: nome,
    parents: [pasta],
    mimeType: tipo,
    appProperties: props,
  })
  const enc = new TextEncoder()
  const a = enc.encode(
    '--' +
      fronteira +
      '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      meta +
      '\r\n--' +
      fronteira +
      '\r\nContent-Type: ' +
      tipo +
      '\r\n\r\n',
  )
  const b = enc.encode('\r\n--' + fronteira + '--')
  const corpo = new Uint8Array(a.length + bytes.length + b.length)
  corpo.set(a, 0)
  corpo.set(bytes, a.length)
  corpo.set(b, a.length + bytes.length)
  const r = await fetch(UPLOAD + '/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'multipart/related; boundary=' + fronteira,
    },
    body: corpo,
  })
  const dados = (await r.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
  if (!r.ok || !dados.id)
    throw new Error(
      'o Drive recusou o envio: ' + ((dados.error && dados.error.message) || r.status),
    )
  return dados.id
}

export function baixar(token: string, id: string): Promise<Response> {
  return fetch(DRIVE + '/files/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', {
    headers: { Authorization: 'Bearer ' + token },
  })
}
