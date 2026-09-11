/* A sessao de quem esta usando o sistema.

   LEIA ANTES DE MEXER
   Isto e uma cortina, nao e uma fechadura. A conferencia acontece dentro do
   navegador, entao quem abrir o codigo da pagina consegue ler usuario e senha.
   Serve so para o prototipo nao ficar escancarado enquanto ele esta no ar.
   A autenticacao de verdade entra no passo 6, com o Supabase: la a senha nunca
   chega ao navegador, e cada pessoa passa a ter o seu papel.
*/

const USUARIO_PROVISORIO = 'admin'
const SENHA_PROVISORIA = '2026@Fourtime'
const CHAVE = 'ft.sessao'

export type Sessao = {
  usuario: string
  desde: number
}

function ler(): Sessao | null {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return null
    const s = JSON.parse(cru) as Sessao
    return s && typeof s.usuario === 'string' ? s : null
  } catch {
    return null
  }
}

function gravar(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s))
    else localStorage.removeItem(CHAVE)
  } catch {
    /* navegador anonimo ou armazenamento bloqueado: a sessao vive so nesta aba */
  }
}

export function sessaoAtual(): Sessao | null {
  return ler()
}

export function entrar(usuario: string, senha: string): Sessao | null {
  const u = usuario.trim().toLowerCase()
  if (u !== USUARIO_PROVISORIO || senha !== SENHA_PROVISORIA) return null
  const s: Sessao = { usuario: USUARIO_PROVISORIO, desde: Date.now() }
  gravar(s)
  return s
}

export function sair() {
  gravar(null)
}
