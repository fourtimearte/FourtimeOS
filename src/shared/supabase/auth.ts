/* A entrada, a saida e o cuidado com o cracha.

   O Supabase entrega dois papeis quando a pessoa entra: um cracha de acesso,
   que vale uma hora, e um bilhete de renovacao, que troca o cracha vencido por
   um novo sem pedir a senha de novo. Uma tablet no galpao fica aberta o dia
   inteiro, entao a renovacao nao e detalhe: sem ela a costureira e derrubada
   no meio do turno.

   Por que nao a biblioteca oficial: o container onde este codigo e escrito nao
   alcanca o registro do npm, entao um pacote novo so seria testado depois de
   publicado, na tablet da fabrica. Isto aqui e pequeno o bastante para ser
   conferido antes de subir, que e o que importa. */

import { SUPABASE_CHAVE, SUPABASE_URL } from './config'

export type Cracha = {
  acesso: string
  renovacao: string
  /** quando o cracha de acesso vence, em milissegundos desde 1970 */
  venceEm: number
  usuario: string
  email: string
}

const CHAVE_GUARDADA = 'ft.sessao'

/* Renova um minuto antes de vencer. Sem essa folga, uma consulta disparada no
   ultimo segundo chega ao servidor ja vencida. */
const FOLGA = 60_000

/* --- onde o cracha fica ---------------------------------------------------
   O localStorage e a verdade, e ele e lido toda vez. Guardar uma copia em
   memoria e usar essa copia parece mais rapido e custa caro: com duas abas do
   sistema abertas, a aba A renova o cracha e queima o bilhete antigo, a aba B
   continua enxergando o bilhete velho que ela guardou, tenta renovar com ele,
   leva "invalid_grant" e derruba a pessoa sozinha. Ler o armazenamento e
   barato; errar quem esta dentro nao e.

   A copia em memoria serve so para o caso em que o localStorage nem existe
   (navegador anonimo, armazenamento bloqueado). Ai a sessao vale enquanto a
   pagina estiver aberta e acaba ao recarregar. E ruim, mas nao quebra. */

let semArmazenamento: Cracha | null = null

function arrumar(cru: string): Cracha | null {
  try {
    const c = JSON.parse(cru) as Partial<Cracha>
    if (typeof c.acesso !== 'string' || typeof c.renovacao !== 'string') return null
    if (typeof c.venceEm !== 'number') return null
    return {
      acesso: c.acesso,
      renovacao: c.renovacao,
      venceEm: c.venceEm,
      usuario: typeof c.usuario === 'string' ? c.usuario : '',
      email: typeof c.email === 'string' ? c.email : '',
    }
  } catch {
    return null
  }
}

function ler(): Cracha | null {
  let cru: string | null
  try {
    cru = localStorage.getItem(CHAVE_GUARDADA)
  } catch {
    /* armazenamento bloqueado: so entao a copia em memoria vale */
    return semArmazenamento
  }
  if (!cru) return null
  return arrumar(cru)
}

function gravar(c: Cracha | null) {
  try {
    if (c) localStorage.setItem(CHAVE_GUARDADA, JSON.stringify(c))
    else localStorage.removeItem(CHAVE_GUARDADA)
    semArmazenamento = null
  } catch {
    semArmazenamento = c
  }
}

/* --- o pedido de cracha --------------------------------------------------- */

type RespostaDoToken = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  user?: { id?: string; email?: string }
  error?: string
  error_description?: string
  error_code?: string
  msg?: string
  message?: string
}

const SEM_REDE = 'Não consegui falar com o servidor. Confira a internet e tente de novo.'

function recado(dados: RespostaDoToken, situacao: number): string {
  const bruto = [
    dados.error_description,
    dados.msg,
    dados.message,
    dados.error_code,
    dados.error,
  ]
    .filter(Boolean)
    .join(' ')

  if (/invalid[ _]login[ _]credentials|invalid_grant|invalid_credentials/i.test(bruto)) {
    return 'E-mail ou senha não conferem.'
  }
  if (/email[ _]not[ _]confirmed/i.test(bruto)) {
    return 'Esta conta ainda não foi confirmada.'
  }
  if (situacao === 429) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  }
  return bruto || 'Não consegui entrar agora. Tente de novo.'
}

async function pedirCracha(corpo: Record<string, string>, tipo: string): Promise<Cracha> {
  let resposta: Response
  try {
    resposta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${tipo}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_CHAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new Error(SEM_REDE)
  }

  const dados = (await resposta.json().catch(() => ({}))) as RespostaDoToken
  if (!resposta.ok || !dados.access_token || !dados.refresh_token) {
    throw new Error(recado(dados, resposta.status))
  }

  return {
    acesso: dados.access_token,
    renovacao: dados.refresh_token,
    venceEm: Date.now() + (dados.expires_in ?? 3600) * 1000,
    usuario: dados.user?.id ?? '',
    email: dados.user?.email ?? '',
  }
}

/* --- renovacao de um de cada vez ------------------------------------------
   Duas telas podem pedir dados ao mesmo tempo com o cracha vencido. Sem esta
   trava, as duas mandariam renovar, e a segunda renovacao usaria um bilhete
   que a primeira acabou de queimar: a pessoa cairia para fora sozinha. */

let renovando: Promise<Cracha | null> | null = null

export function renovarAgora(): Promise<Cracha | null> {
  const guardado = ler()
  if (!guardado) return Promise.resolve(null)

  if (!renovando) {
    renovando = pedirCracha({ refresh_token: guardado.renovacao }, 'refresh_token')
      .then((novo) => {
        gravar(novo)
        return novo
      })
      .catch(() => {
        gravar(null)
        return null
      })
      .finally(() => {
        renovando = null
      })
  }
  return renovando
}

/* --- o que o resto do sistema usa ----------------------------------------- */

/** O cracha valido, renovando se estiver perto de vencer. Nulo: nao entrou. */
export function crachaValido(): Promise<Cracha | null> {
  const guardado = ler()
  if (!guardado) return Promise.resolve(null)
  if (guardado.venceEm - Date.now() > FOLGA) return Promise.resolve(guardado)
  return renovarAgora()
}

export async function entrarComEmail(email: string, senha: string): Promise<Cracha> {
  const novo = await pedirCracha(
    { email: email.trim().toLowerCase(), password: senha },
    'password',
  )
  gravar(novo)
  return novo
}

export async function sairDoSupabase(): Promise<void> {
  const guardado = ler()
  gravar(null)
  if (!guardado) return
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_CHAVE, Authorization: `Bearer ${guardado.acesso}` },
    })
  } catch {
    /* o cracha ja foi apagado daqui, que e o que importa para esta tablet */
  }
}
