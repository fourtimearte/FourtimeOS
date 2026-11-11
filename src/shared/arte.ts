/* A ARTE DO LAYOUT NO GOOGLE DRIVE (11/11/2026).

   A arte guardada no layout é um texto de um destes dois jeitos:

     data:image/webp;base64,...   a imagem inteira, dentro da cotação (como
                                  sempre foi, e como continua quando a ponte
                                  do Drive está desligada)
     drive:<id>                   a imagem mora no Drive; a cotação guarda só
                                  o id, e quem entrega é a ponte da Cloudflare
                                  (worker/index.ts), em /api/arte/<id>

   Quem desenha a arte passa SEMPRE pelo srcDaArte: ele devolve um endereço
   que o <img>, o new Image() e o background-image entendem nos dois casos.

   O <img> não manda cabeçalho, então o crachá vai num cookie só desse
   caminho (/api/arte), escrito pela sessão (shared/supabase/auth.ts). */

import { crachaValido } from './supabase/auth'

export const PREFIXO_DRIVE = 'drive:'

export const ehDoDrive = (v: string | null | undefined): boolean =>
  typeof v === 'string' && v.startsWith(PREFIXO_DRIVE)

/** o endereço que a tela usa para desenhar a arte, venha ela de onde vier */
export function srcDaArte(v: string | null | undefined): string {
  if (!v) return ''
  if (ehDoDrive(v)) return '/api/arte/' + encodeURIComponent(v.slice(PREFIXO_DRIVE.length))
  return v
}

/* --- a ponte está ligada? -----------------------------------------------
   Perguntado uma vez por visita. Fora do ar, sem a ponte ou rodando sem a
   Cloudflare (o teste, o vite), a resposta não é JSON e vale "não": a arte
   continua dentro da cotação, como sempre. */
let pronta: Promise<boolean> | null = null

export function pontePronta(): Promise<boolean> {
  if (!pronta) {
    pronta = fetch('/api/arte/saude', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => !!(d && (d as { pronto?: unknown }).pronto === true))
      .catch(() => false)
  }
  return pronta
}

/** para os testes e para reler depois de ligar a ponte */
export function esquecerPonte(): void {
  pronta = null
}

async function hashDe(dados: ArrayBuffer): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', dados))
  return Array.from(h, b => b.toString(16).padStart(2, '0')).join('')
}

/** Sobe a arte (data URL) para o Drive e devolve "drive:<id>". A mesma arte
    subida duas vezes volta com o mesmo id (o hash). */
export async function subirArte(dataUrl: string, nome = ''): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const dados = await blob.arrayBuffer()
  const cracha = await crachaValido()
  if (!cracha) throw new Error('Entre de novo no sistema para enviar a arte.')
  const r = await fetch('/api/arte', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + cracha.acesso,
      'Content-Type': blob.type || 'image/webp',
      'X-Arte-Hash': await hashDe(dados),
      'X-Arte-Nome': encodeURIComponent(nome.slice(0, 120)),
    },
    body: dados,
  })
  const corpo = (await r.json().catch(() => ({}))) as { id?: string; erro?: string }
  if (!r.ok || !corpo.id)
    throw new Error(corpo.erro || 'O Drive não recebeu a arte (' + r.status + ').')
  return PREFIXO_DRIVE + corpo.id
}
