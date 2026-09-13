/* Conferencia do modulo do Supabase.

   O servidor e falso de proposito: as respostas abaixo sao as que o Supabase
   de verdade devolveu quando eu chamei com curl, copiadas palavra por palavra.
   Assim da para conferir o caminho do cracha vencido e o do GRANT faltando sem
   depender de rede nem de conta criada. */

const guardado = new Map()
globalThis.localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
  removeItem: (k) => guardado.delete(k),
}
globalThis.__env = {
  VITE_SUPABASE_URL: 'https://exemplo.supabase.co/',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_teste',
}

let chamadas = []
let responder = () => resposta(500, {})

function resposta(situacao, corpo) {
  return {
    ok: situacao >= 200 && situacao < 300,
    status: situacao,
    json: async () => corpo,
  }
}

globalThis.fetch = async (endereco, opcoes = {}) => {
  chamadas.push({
    endereco,
    metodo: opcoes.method ?? 'GET',
    cabecalho: opcoes.headers ?? {},
    corpo: opcoes.body ? JSON.parse(opcoes.body) : undefined,
  })
  return responder(endereco, opcoes)
}

const sb = await import('./compilado-sessao/shared/supabase/index.js')

let falhas = 0
function conferir(nome, condicao, visto) {
  if (condicao) console.log('  ok   ' + nome)
  else {
    falhas++
    console.log('  FALHOU ' + nome + '  ->  ' + JSON.stringify(visto))
  }
}
async function erroDe(promessa) {
  try {
    await promessa
    return null
  } catch (e) {
    return e.message
  }
}
function limpar() {
  guardado.clear()
  chamadas = []
}
const CRACHA_BOM = {
  access_token: 'acesso-1',
  refresh_token: 'renova-1',
  expires_in: 3600,
  user: { id: 'uuid-do-henrique', email: 'arte@fourtimefit.com.br' },
}

console.log('config')
conferir('ligado', sb.SUPABASE_LIGADO === true)
conferir('tirou a barra do fim', sb.SUPABASE_URL === 'https://exemplo.supabase.co', sb.SUPABASE_URL)

console.log('\nsenha errada')
limpar()
responder = () =>
  resposta(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
let erro = await erroDe(sb.entrarComEmail('a@b.com', 'errada'))
conferir('recado em portugues', erro === 'E-mail ou senha não conferem.', erro)
conferir('nao guardou nada', guardado.size === 0)

console.log('\nmuitas tentativas')
limpar()
responder = () => resposta(429, { code: 429, msg: '' })
erro = await erroDe(sb.entrarComEmail('a@b.com', 'x'))
conferir('avisa para esperar', /Espere um minuto/.test(erro ?? ''), erro)

console.log('\nservidor fora do ar')
limpar()
responder = () => {
  throw new TypeError('fetch failed')
}
erro = await erroDe(sb.entrarComEmail('a@b.com', 'x'))
conferir('fala de internet, nao de senha', /internet/.test(erro ?? ''), erro)

console.log('\nentrada certa')
limpar()
responder = () => resposta(200, CRACHA_BOM)
const cracha = await sb.entrarComEmail('  ARTE@Fourtimefit.com.BR ', 'boa')
conferir('email sem espaco e em minuscula', chamadas[0].corpo.email === 'arte@fourtimefit.com.br', chamadas[0].corpo.email)
conferir('guardou o cracha', guardado.has('ft.sessao'))
conferir('sabe quem e', cracha.usuario === 'uuid-do-henrique', cracha.usuario)
conferir('vence daqui uma hora', cracha.venceEm - Date.now() > 3_500_000)

console.log('\ncracha ainda bom nao renova')
chamadas = []
const mesmo = await sb.crachaValido()
conferir('devolveu o guardado', mesmo.acesso === 'acesso-1', mesmo.acesso)
conferir('sem ida ao servidor', chamadas.length === 0, chamadas.length)

console.log('\ncracha perto de vencer, dois pedidos ao mesmo tempo')
guardado.set(
  'ft.sessao',
  JSON.stringify({
    acesso: 'acesso-1',
    renovacao: 'renova-1',
    venceEm: Date.now() + 5000,
    usuario: 'uuid-do-henrique',
    email: 'arte@fourtimefit.com.br',
  }),
)
chamadas = []
responder = () =>
  resposta(200, { ...CRACHA_BOM, access_token: 'acesso-2', refresh_token: 'renova-2' })
const [a, b] = await Promise.all([sb.crachaValido(), sb.crachaValido()])
conferir('renovou uma vez so', chamadas.length === 1, chamadas.length)
conferir('os dois receberam o novo', a.acesso === 'acesso-2' && b.acesso === 'acesso-2', [a.acesso, b.acesso])

console.log('\nbilhete de renovacao queimado')
guardado.set(
  'ft.sessao',
  JSON.stringify({
    acesso: 'velho',
    renovacao: 'queimado',
    venceEm: Date.now() - 1,
    usuario: 'u',
    email: 'e',
  }),
)
responder = () => resposta(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' })
conferir('devolve nulo', (await sb.crachaValido()) === null)
conferir('e limpa o guardado', guardado.size === 0)

console.log('\nconsulta na tabela')
limpar()
responder = () => resposta(200, CRACHA_BOM)
await sb.entrarComEmail('a@b.com', 'boa')
chamadas = []
responder = () => resposta(200, [{ id: 'uuid-do-henrique', nome: 'Henrique', papel: 'dono', ativo: true }])
const linhas = await sb.tabela('pessoa?select=id,nome,papel,ativo&id=eq.uuid-do-henrique')
conferir('leu a linha', linhas[0].papel === 'dono', linhas)
conferir('mandou o cracha', chamadas[0].cabecalho.Authorization === 'Bearer acesso-1', chamadas[0].cabecalho.Authorization)
conferir('mandou a chave publica', chamadas[0].cabecalho.apikey === 'sb_publishable_teste')
conferir('montou o endereco certo', chamadas[0].endereco === 'https://exemplo.supabase.co/rest/v1/pessoa?select=id,nome,papel,ativo&id=eq.uuid-do-henrique', chamadas[0].endereco)

console.log('\n401 de cracha vencido: renova e tenta de novo')
chamadas = []
let vez = 0
responder = (endereco) => {
  vez++
  if (endereco.includes('/rest/v1/') && vez === 1) return resposta(401, { code: 'PGRST301', message: 'JWT expired' })
  if (endereco.includes('/auth/v1/token')) return resposta(200, { ...CRACHA_BOM, access_token: 'acesso-3' })
  return resposta(200, [{ id: 'x' }])
}
const depoisDeRenovar = await sb.tabela('pessoa?select=id')
conferir('a consulta deu certo na segunda', depoisDeRenovar[0].id === 'x', depoisDeRenovar)
conferir('foram tres idas: falhou, renovou, refez', chamadas.length === 3, chamadas.map((c) => c.endereco))
conferir('a segunda foi com o cracha novo', chamadas[2].cabecalho.Authorization === 'Bearer acesso-3', chamadas[2].cabecalho.Authorization)

console.log('\n401 de GRANT faltando: NAO derruba a sessao')
chamadas = []
responder = () =>
  resposta(401, {
    code: '42501',
    details: null,
    hint: 'Grant the required privileges to the current role with: GRANT SELECT ON public.pessoa TO anon;',
    message: 'permission denied for table pessoa',
  })
erro = await erroDe(sb.tabela('pessoa?select=id'))
conferir('nao fala em sessao terminada', erro === 'Seu acesso não permite fazer isso.', erro)
conferir('nem tentou renovar', chamadas.length === 1, chamadas.map((c) => c.endereco))
conferir('a pessoa continua dentro', guardado.has('ft.sessao'))

console.log('\nnome repetido')
responder = () => resposta(409, { code: '23505', message: 'duplicate key value violates unique constraint "cliente_nome_unico"' })
erro = await erroDe(sb.tabela('cliente', { metodo: 'POST', corpo: { nome: 'Escola Sao Jose' } }))
conferir('recado que a fabrica entende', erro === 'Já existe um cadastro com esse nome.', erro)

console.log('\nsair')
chamadas = []
responder = () => resposta(204, null)
await sb.sairDoSupabase()
conferir('limpou o guardado', guardado.size === 0)
conferir('avisou o servidor', chamadas.some((c) => c.endereco.includes('/auth/v1/logout')), chamadas.map((c) => c.endereco))

console.log('\nsair com a internet caida ainda sai daqui')
guardado.set('ft.sessao', JSON.stringify({ acesso: 'a', renovacao: 'r', venceEm: Date.now() + 9e5, usuario: 'u', email: 'e' }))
responder = () => {
  throw new TypeError('fetch failed')
}
await sb.sairDoSupabase()
conferir('limpou mesmo assim', guardado.size === 0)

console.log(falhas === 0 ? '\nTUDO CERTO' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
