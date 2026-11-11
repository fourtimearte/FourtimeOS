/* ==========================================================================
   A PONTE DO DRIVE (11/11/2026)

   Pedido do Henrique: "as imagens de tudo vão parar no Google Drive, o mesmo
   jeito do editor V4, assim não usa nada do Supabase". Até aqui a arte do
   layout morava dentro do corpo da cotação, em data URL: cada orçamento
   carregava de 1 a 7 MB para o banco.

   Este é o script da Cloudflare que publica o sistema. Antes ele só entregava
   os arquivos do site; agora ele atende quatro endereços, e todo o resto
   continua indo para os arquivos do site, como sempre:

     GET  /api/arte/saude   se a ponte está ligada (sem login: não diz nada
                            além de sim ou não)
     POST /api/arte         sobe uma arte para a pasta do Drive e devolve o id
     GET  /api/arte/<id>    entrega a arte, com cache, para quem entrou

   A imagem nunca passa pelo Supabase: o banco guarda só "drive:<id>". O login
   é conferido aqui mesmo, pela assinatura do crachá do Supabase (a chave
   pública do projeto), sem ida ao banco.

   Os segredos (a chave do Google) moram nos segredos da Cloudflare e são
   colados pelo Henrique; nenhum passa pelo Claude nem pelo repositório.
   ========================================================================== */

import { conferirCracha } from './sessao.ts'
import {
  acharPorHash,
  baixar,
  credencialDoGoogle,
  metadados,
  subir,
  tokenDoGoogle,
} from './google.ts'
import type { Ambiente } from './tipos.ts'

/** o maior arquivo aceito: a arte já chega comprimida (WebP, até 2560 px) */
export const LIMITE_DA_ARTE = 15 * 1024 * 1024

const ID_VALIDO = /^[A-Za-z0-9_-]{10,100}$/
const HASH_VALIDO = /^[a-f0-9]{64}$/

function json(corpo: unknown, situacao = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corpo), {
    status: situacao,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  })
}

/** o crachá vem no cabeçalho (subir) ou no cookie ft_arte (o <img> não manda cabeçalho) */
export function crachaDoPedido(req: Request): string {
  const auth = req.headers.get('Authorization') || ''
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim()
  const cookie = req.headers.get('Cookie') || ''
  const m = cookie.match(/(?:^|;\s*)ft_arte=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

/* --- a saúde ---------------------------------------------------------------
   Lembrada por 5 minutos: a tela pergunta uma vez por visita, e a resposta só
   muda quando alguém mexe nos segredos. */
let saudeGuardada: { em: number; corpo: Record<string, unknown> } | null = null

async function saude(env: Ambiente): Promise<Response> {
  if (saudeGuardada && Date.now() - saudeGuardada.em < 5 * 60_000) return json(saudeGuardada.corpo)
  const cred = credencialDoGoogle(env)
  let corpo: Record<string, unknown>
  if (!cred) corpo = { pronto: false, motivo: 'sem-credencial' }
  else if (!env.DRIVE_PASTA) corpo = { pronto: false, motivo: 'sem-pasta', modo: cred.modo }
  else {
    try {
      const token = await tokenDoGoogle(env)
      const m = await metadados(token, env.DRIVE_PASTA, 'id,mimeType,capabilities/canAddChildren')
      const pasta = m && m.mimeType === 'application/vnd.google-apps.folder'
      const escreve = !!(m && m.capabilities && m.capabilities.canAddChildren)
      corpo =
        pasta && escreve
          ? { pronto: true, modo: cred.modo }
          : {
              pronto: false,
              motivo: pasta ? 'pasta-sem-escrita' : 'pasta-nao-achada',
              modo: cred.modo,
            }
    } catch (e) {
      corpo = {
        pronto: false,
        motivo: 'google-recusou',
        detalhe: String(e).slice(0, 200),
        modo: cred.modo,
      }
    }
  }
  saudeGuardada = { em: Date.now(), corpo }
  return json(corpo)
}

/** para os testes: esquece a saúde lembrada */
export function esquecerSaude(): void {
  saudeGuardada = null
}

/* --- subir ----------------------------------------------------------------- */
async function receber(req: Request, env: Ambiente): Promise<Response> {
  const quem = await conferirCracha(crachaDoPedido(req), env)
  if (!quem) return json({ erro: 'Entre de novo no sistema para enviar a arte.' }, 401)
  if (!credencialDoGoogle(env) || !env.DRIVE_PASTA) {
    return json({ erro: 'A ponte do Drive ainda não está ligada.' }, 503)
  }
  const tipo = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase()
  if (!/^image\/(webp|png|jpeg|gif)$/.test(tipo))
    return json({ erro: 'Só imagem (WebP, PNG, JPG ou GIF).' }, 415)
  const tamanho = Number(req.headers.get('Content-Length') || '0')
  if (tamanho > LIMITE_DA_ARTE) return json({ erro: 'Arte acima de 15 MB.' }, 413)
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (!bytes.length) return json({ erro: 'Arquivo vazio.' }, 400)
  if (bytes.length > LIMITE_DA_ARTE) return json({ erro: 'Arte acima de 15 MB.' }, 413)

  /* o hash vem do navegador, que já tem os bytes na mão: aqui ele só serve
     para não subir a mesma arte duas vezes, e não é conferido como prova de
     nada (quem manda o arquivo já entrou no sistema) */
  const hash = (req.headers.get('X-Arte-Hash') || '').toLowerCase()
  const nome = limparNome(req.headers.get('X-Arte-Nome') || '')
  const token = await tokenDoGoogle(env)
  if (HASH_VALIDO.test(hash)) {
    const ja = await acharPorHash(token, env.DRIVE_PASTA, hash)
    if (ja) return json({ id: ja, repetida: true })
  }
  const ext = tipo === 'image/jpeg' ? 'jpg' : tipo.split('/')[1]
  const nomeDoArquivo =
    (nome ? nome + ' ' : 'arte ') + (hash ? hash.slice(0, 12) : String(Date.now())) + '.' + ext
  const id = await subir(token, env.DRIVE_PASTA, nomeDoArquivo, tipo, bytes, {
    sha256: HASH_VALIDO.test(hash) ? hash : '',
    origem: 'fourtime-os',
    quem: quem.sub,
  })
  return json({ id, repetida: false }, 201)
}

function limparNome(n: string): string {
  let t = ''
  try {
    t = decodeURIComponent(n)
  } catch {
    t = n
  }
  return (
    t
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
  )
}

/* --- entregar -------------------------------------------------------------- */
async function entregar(req: Request, env: Ambiente, id: string, ctx: Contexto): Promise<Response> {
  if (!ID_VALIDO.test(id)) return json({ erro: 'Arte não achada.' }, 404)
  const quem = await conferirCracha(crachaDoPedido(req), env)
  if (!quem) return json({ erro: 'Entre de novo no sistema.' }, 401)

  /* O CACHE DA CLOUDFLARE, pela chave sem cookie e sem cabeçalho: o arquivo
     de um id nunca muda (a ponte só cria, nunca sobrescreve). A conferência
     do crachá vem ANTES, então quem não entrou não chega ao cache. */
  const chave = new Request(new URL('/api/arte/' + id, req.url).toString(), { method: 'GET' })
  const cache = caches.default
  const guardada = await cache.match(chave)
  if (guardada) return paraONavegador(guardada)

  if (!credencialDoGoogle(env) || !env.DRIVE_PASTA)
    return json({ erro: 'A ponte do Drive ainda não está ligada.' }, 503)
  const token = await tokenDoGoogle(env)
  /* SÓ O QUE ESTÁ NA PASTA DAS ARTES. A conta do Google enxerga mais coisa
     (os orçamentos do editor, o banco dele): um id de fora da pasta, ou que
     não é imagem, responde como se não existisse. */
  const m = await metadados(token, id, 'id,mimeType,parents,trashed')
  if (
    !m ||
    m.trashed ||
    !String(m.mimeType || '').startsWith('image/') ||
    !(m.parents || []).includes(env.DRIVE_PASTA)
  ) {
    return json({ erro: 'Arte não achada.' }, 404)
  }
  const r = await baixar(token, id)
  if (!r.ok || !r.body) return json({ erro: 'O Drive não entregou a arte.' }, 502)
  const resposta = new Response(r.body, {
    status: 200,
    headers: {
      'Content-Type': String(m.mimeType),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
  ctx.waitUntil(cache.put(chave, resposta.clone()))
  return paraONavegador(resposta)
}

/* no navegador a arte fica guardada um ano, mas só para quem a viu: nenhum
   cache no meio do caminho (um proxy da empresa) pode guardar */
function paraONavegador(r: Response): Response {
  const h = new Headers(r.headers)
  h.set('Cache-Control', 'private, max-age=31536000, immutable')
  h.set('X-Content-Type-Options', 'nosniff')
  return new Response(r.body, { status: r.status, headers: h })
}

/* --- a porta --------------------------------------------------------------- */
type Contexto = { waitUntil(p: Promise<unknown>): void }

export default {
  async fetch(req: Request, env: Ambiente, ctx: Contexto): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname
    try {
      if (p === '/api/arte/saude' && req.method === 'GET') return await saude(env)
      if (p === '/api/arte' && req.method === 'POST') return await receber(req, env)
      if (p.startsWith('/api/arte/') && req.method === 'GET') {
        return await entregar(req, env, decodeURIComponent(p.slice('/api/arte/'.length)), ctx)
      }
      if (p.startsWith('/api/')) return json({ erro: 'Endereço desconhecido.' }, 404)
    } catch (e) {
      return json({ erro: 'Falha na ponte do Drive.', detalhe: String(e).slice(0, 200) }, 502)
    }
    return env.ASSETS.fetch(req)
  },
}
