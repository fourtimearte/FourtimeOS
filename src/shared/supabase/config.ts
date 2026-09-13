/* O endereco do projeto e a chave publicavel.

   Ficam em shared/ porque isto nao sabe o que e cliente nem cotacao: sabe
   falar HTTP com um servidor. Quem transforma resposta em regra da fabrica e
   o dominio. */

const ENDERECO = import.meta.env.VITE_SUPABASE_URL ?? ''
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** sem a barra do fim, para nao virar // ao montar o caminho */
export const SUPABASE_URL = ENDERECO.trim().replace(/\/+$/, '')
export const SUPABASE_CHAVE = CHAVE.trim()

/* Falso quando alguem roda o sistema sem as duas variaveis. Em vez de deixar a
   tela de entrada dar erro de rede sem explicacao, a tela avisa. */
export const SUPABASE_LIGADO = SUPABASE_URL !== '' && SUPABASE_CHAVE !== ''
