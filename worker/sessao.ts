/* QUEM ESTÁ PEDINDO.

   O crachá do Supabase é um JWT assinado com ES256. A chave pública do projeto
   está em <SUPABASE_URL>/auth/v1/.well-known/jwks.json, aberta a qualquer um:
   conferir a assinatura aqui dispensa uma ida ao banco a cada imagem e não
   pede segredo nenhum.

   Confere: a assinatura, o emissor (o próprio projeto), o público
   ("authenticated") e o vencimento. Não confere se a conta foi aprovada: a
   arte só é achada por quem leu a cotação, e quem lê a cotação é a RLS que
   decide. */

import type { Ambiente } from './tipos.ts'

export type Quem = { sub: string; email: string }

type Chave = { kid: string; chave: CryptoKey }
let chaves: { em: number; lista: Chave[] } | null = null

function deBase64Url(t: string): Uint8Array<ArrayBuffer> {
  const b = t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)
  const s = atob(b)
  const u = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i)
  return u
}

function textoDe(t: string): string {
  return new TextDecoder().decode(deBase64Url(t))
}

async function lerChaves(env: Ambiente, forcar = false): Promise<Chave[]> {
  if (!forcar && chaves && Date.now() - chaves.em < 60 * 60_000) return chaves.lista
  const r = await fetch(
    String(env.SUPABASE_URL).replace(/\/+$/, '') + '/auth/v1/.well-known/jwks.json',
  )
  if (!r.ok) throw new Error('jwks ' + r.status)
  const dados = (await r.json()) as { keys?: (JsonWebKey & { kid?: string; alg?: string })[] }
  const lista: Chave[] = []
  for (const k of dados.keys || []) {
    if (k.kty !== 'EC' || k.crv !== 'P-256' || !k.kid) continue
    const chave = await crypto.subtle.importKey(
      'jwk',
      { kty: k.kty, crv: k.crv, x: k.x, y: k.y },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    lista.push({ kid: k.kid, chave })
  }
  chaves = { em: Date.now(), lista }
  return lista
}

/** para os testes: esquece as chaves lidas */
export function esquecerChaves(): void {
  chaves = null
}

export async function conferirCracha(jwt: string, env: Ambiente): Promise<Quem | null> {
  if (!jwt || !env.SUPABASE_URL) return null
  const partes = jwt.split('.')
  if (partes.length !== 3) return null
  let cab: { alg?: string; kid?: string }
  let corpo: {
    iss?: string
    aud?: string | string[]
    exp?: number
    sub?: string
    email?: string
    role?: string
  }
  try {
    cab = JSON.parse(textoDe(partes[0]))
    corpo = JSON.parse(textoDe(partes[1]))
  } catch {
    return null
  }
  if (cab.alg !== 'ES256' || !cab.kid) return null
  let lista = await lerChaves(env)
  let achada = lista.find(k => k.kid === cab.kid)
  /* chave nova (o projeto girou a chave): relê uma vez antes de recusar */
  if (!achada) {
    lista = await lerChaves(env, true)
    achada = lista.find(k => k.kid === cab.kid)
  }
  if (!achada) return null
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    achada.chave,
    deBase64Url(partes[2]),
    new TextEncoder().encode(partes[0] + '.' + partes[1]),
  )
  if (!ok) return null
  const emissor = String(env.SUPABASE_URL).replace(/\/+$/, '') + '/auth/v1'
  if (corpo.iss !== emissor) return null
  const aud = Array.isArray(corpo.aud) ? corpo.aud : [corpo.aud]
  if (!aud.includes('authenticated')) return null
  if (typeof corpo.exp !== 'number' || corpo.exp * 1000 < Date.now()) return null
  if (!corpo.sub) return null
  return { sub: corpo.sub, email: corpo.email || '' }
}
