// O PORTEIRO DO CHAT DA LOJA (supabase/functions/lead-do-site/index.ts),
// conferido sem Supabase: o teste finge o ambiente do Deno, responde no lugar
// do banco e olha o que o porteiro manda adiante.
//
//   node --experimental-strip-types testes/porteiro-do-site.mjs

import { createHmac } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const BANCO = 'https://ensaio.supabase.co'
const CHAVE = 'chave-de-servico-de-mentira'
const ARQUIVO = pathToFileURL(resolve(import.meta.dirname, '../supabase/functions/lead-do-site/index.ts')).href

let certas = 0
let erradas = 0
function confere(nome, ok, detalhe = '') {
  if (ok) certas++
  else erradas++
  console.log(`${ok ? 'ok  ' : 'RUIM'} ${nome}${ok || !detalhe ? '' : ` (${detalhe})`}`)
}

let chamadas = []
let resposta = { status: 200, corpo: { lead_id: 'x', repetido: false } }
globalThis.Deno = { env: { get: (n) => ({ SUPABASE_URL: BANCO, SUPABASE_SERVICE_ROLE_KEY: CHAVE })[n] }, serve: () => {} }
globalThis.fetch = async (url, opcoes = {}) => {
  chamadas.push({ endereco: String(url), corpo: opcoes.body ? JSON.parse(opcoes.body) : null, cabecalhos: opcoes.headers ?? {} })
  return new Response(JSON.stringify(resposta.corpo), { status: resposta.status })
}
const { atender } = await import(ARQUIVO)

const LOJA = 'https://fourtimefit.com.br'
const FICHA = {
  origem: 'site-chat', id_envio: '6f1c2a0e-5b7d-4c1a-9e3f-2a8b7c6d5e4f',
  aberto_em: '2026-10-11T14:58:00-03:00', enviado_em: '2026-10-11T15:00:08-03:00',
  empresa_extra: '', nome: 'Fernanda', telefone: '+5562977775555', email: '',
  tipo_peca: 'kit_camiseta_short', modelo_camiseta: 'raglan', finalidade: 'academia',
  quantidade_faixa: '50_100', prazo: 'urgente', arte: 'criar_do_zero',
  mensagem: 'Logo nas costas', pagina_origem: 'https://fourtimefit.com.br/products/raglan',
  utm: { source: 'instagram', medium: 'cpc', campaign: 'academias', content: '', term: '' },
  consentimento_em: '2026-10-11T15:00:00-03:00', consentimento_texto: 'politica-2026-09',
  campo_inventado: 'nao passa', produto: { id: '1', titulo: 'Raglan', url: 'https://outro-site.com/x' },
  mensagens: [{ autor: 'cliente', texto: 'oi', em: '2026-10-11T14:59:00-03:00', extra: 'nao passa' }],
  teste: true, envio_numero: 1,
}
const post = (corpo, origem = LOJA, cab = {}) =>
  new Request(`${BANCO}/functions/v1/lead-do-site`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origem ? { origin: origem } : {}), 'x-forwarded-for': '189.10.20.30, 10.0.0.1', ...cab },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  })

// 1. a pre-consulta
let r = await atender(new Request(`${BANCO}/functions/v1/lead-do-site`, { method: 'OPTIONS', headers: { origin: LOJA } }))
confere('OPTIONS da loja: 204 com a origem dela', r.status === 204 && r.headers.get('access-control-allow-origin') === LOJA)
r = await atender(new Request(`${BANCO}/functions/v1/lead-do-site`, { method: 'OPTIONS', headers: { origin: 'https://golpe.com' } }))
confere('OPTIONS de outra origem: 403', r.status === 403 && !r.headers.get('access-control-allow-origin'))

// 2. outra origem nao chega ao banco
chamadas = []
r = await atender(post(FICHA, 'https://golpe.com'))
confere('POST de outra origem: 403 sem chamar o banco', r.status === 403 && chamadas.length === 0)
r = await atender(post(FICHA, ''))
confere('POST sem origem: 403', r.status === 403)

// 3. lead novo e repetido
chamadas = []
resposta = { status: 200, corpo: { lead_id: 'x', repetido: false } }
r = await atender(post(FICHA))
const ida = chamadas[0]
confere('ficha nova: 201, com CORS da loja', r.status === 201 && r.headers.get('access-control-allow-origin') === LOJA)
confere('vai para registrar_lead_do_site com a chave de servico', ida?.endereco === `${BANCO}/rest/v1/rpc/registrar_lead_do_site`
  && ida.cabecalhos.Authorization === `Bearer ${CHAVE}`)
confere('o que nao e do contrato nao passa', ida && !('campo_inventado' in ida.corpo.p_ficha) && !('extra' in ida.corpo.p_ficha.mensagens[0]))
confere('produto com endereco de fora fica sem endereco', ida?.corpo.p_ficha.produto.url === '')
const esperada = createHmac('sha256', CHAVE).update('ip:189.10.20.30').digest('hex')
confere('o IP vai como impressao (HMAC), nunca cru', ida?.corpo.p_impressao === esperada && !JSON.stringify(ida.corpo).includes('189.10.20.30'))
confere('a resposta nao devolve o id do lead', !(JSON.stringify(await r.json())).includes('lead_id'))
resposta = { status: 200, corpo: { lead_id: 'x', repetido: true } }
r = await atender(post(FICHA))
confere('ficha repetida: 200', r.status === 200)

// 4. robo
chamadas = []
r = await atender(post({ ...FICHA, empresa_extra: 'Robo Ltda' }))
confere('isca preenchida: 422 sem chamar o banco', r.status === 422 && chamadas.length === 0)
r = await atender(post({ ...FICHA, aberto_em: '2026-10-11T15:00:07-03:00' }))
confere('enviada 1 segundo depois de aberta: 422', r.status === 422 && chamadas.length === 0)

// 5. corpo
r = await atender(post('{nao e json'))
confere('JSON torto: 400', r.status === 400)
r = await atender(post('x'.repeat(70 * 1024)))
confere('corpo acima de 64 KB: 400', r.status === 400)

// 6. o que o banco responde vira a resposta
resposta = { status: 400, corpo: { code: 'P0429', message: 'limite de envios' } }
r = await atender(post(FICHA))
confere('limite do banco: 429', r.status === 429)
resposta = { status: 400, corpo: { code: '22023', message: 'prazo fora da lista' } }
r = await atender(post(FICHA))
const corpo = await r.json()
confere('fora do contrato: 400 com o motivo', r.status === 400 && corpo.erro === 'prazo fora da lista')
resposta = { status: 500, corpo: { code: 'XX000', message: 'segredo interno do banco' } }
r = await atender(post(FICHA))
confere('erro do banco: 500 sem contar o detalhe', r.status === 500 && !(await r.text()).includes('segredo'))

// 7. o GET de conferencia nao mostra a chave
r = await atender(new Request(`${BANCO}/functions/v1/lead-do-site`))
const g = await r.text()
confere('GET diz so se a chave esta posta', r.status === 200 && g.includes('"servico":true') && !g.includes(CHAVE))

// 8. o aviso por e-mail: desligado sem os segredos, e ligado com eles
chamadas = []
resposta = { status: 200, corpo: { lead_id: 'L1', repetido: false } }
r = await atender(post(FICHA))
confere('sem RESEND_API_KEY nao manda e-mail', r.status === 201 && !chamadas.some((c) => c.endereco.includes('resend')))

globalThis.Deno = { env: { get: (n) => ({ SUPABASE_URL: BANCO, SUPABASE_SERVICE_ROLE_KEY: CHAVE,
  RESEND_API_KEY: 're_mentira', AVISO_EMAIL_DE: 'Fourtime OS <avisos@fourtimefit.com.br>', AVISO_EMAIL_PARA: 'extra@fourtime.test, nao-e-email' })[n] }, serve: () => {} }
let dono = null
let leadRepetido = false
globalThis.fetch = async (url, opcoes = {}) => {
  const u = String(url)
  chamadas.push({ endereco: u, corpo: opcoes.body ? JSON.parse(opcoes.body) : null, cabecalhos: opcoes.headers ?? {} })
  let corpo = {}
  if (u.includes('rpc/registrar_lead_do_site')) corpo = { lead_id: 'L1', repetido: leadRepetido }
  else if (u.includes('/rest/v1/lead?')) corpo = [{ nome: 'Fernanda <b>', telefone: '+5562977775555', vendedor_id: dono, teste: true, ultima_msg: 'Logo nas costas', prioridade: false }]
  else if (u.includes('/rest/v1/pessoa?')) corpo = [
    { id: 'A', email: 'admin@fourtime.test', papel: 'admin' }, { id: 'G', email: 'gerente@fourtime.test', papel: 'gerente' },
    { id: 'V', email: 'dani@fourtime.test', papel: 'vendedor' }, { id: 'P', email: 'joana@fourtime.test', papel: 'producao' }]
  else if (u.includes('api.resend.com')) corpo = { id: 'email-1' }
  return new Response(JSON.stringify(corpo), { status: 200 })
}
const comEmail = await import(ARQUIVO + '?com-email')
chamadas = []
r = await comEmail.atender(post(FICHA))
let email = chamadas.find((c) => c.endereco === 'https://api.resend.com/emails')
confere('lead novo sem dono: e-mail para admin, gerente e o fixo, nao para a vendedora nem a producao',
  r.status === 201 && !!email && JSON.stringify(email.corpo.to.sort()) === JSON.stringify(['admin@fourtime.test', 'extra@fourtime.test', 'gerente@fourtime.test'])
  && email.cabecalhos.Authorization === 'Bearer re_mentira', JSON.stringify(email?.corpo?.to))
confere('o e-mail leva o link do lead, marca o teste e escapa o nome no HTML',
  !!email && email.corpo.subject === '[TESTE] Lead novo pelo site: Fernanda <b>' && email.corpo.html.includes('Fernanda &lt;b&gt;')
  && email.corpo.html.includes('/funil?lead=L1') && email.corpo.from === 'Fourtime OS <avisos@fourtimefit.com.br>')
dono = 'V'
chamadas = []
await comEmail.atender(post(FICHA))
email = chamadas.find((c) => c.endereco === 'https://api.resend.com/emails')
confere('lead com dono: e-mail para o dono (e o fixo)', !!email && JSON.stringify(email.corpo.to.sort()) === JSON.stringify(['dani@fourtime.test', 'extra@fourtime.test']), JSON.stringify(email?.corpo?.to))
leadRepetido = true
chamadas = []
r = await comEmail.atender(post(FICHA))
confere('a mesma conversa chegando de novo nao manda e-mail', r.status === 200 && !chamadas.some((c) => c.endereco.includes('resend')))
leadRepetido = false
globalThis.fetch = async (url) => {
  if (String(url).includes('api.resend.com')) throw new Error('fora do ar')
  return new Response(JSON.stringify(String(url).includes('rpc/') ? { lead_id: 'L1', repetido: false } : []), { status: 200 })
}
r = await comEmail.atender(post(FICHA))
confere('o e-mail falhando nao muda a resposta ao chat', r.status === 201)

console.log(`\n${certas} de ${certas + erradas} certos`)
process.exit(erradas ? 1 : 0)
