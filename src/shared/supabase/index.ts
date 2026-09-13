/* A porta da frente do Supabase. O resto do sistema entra por aqui. */
export { SUPABASE_CHAVE, SUPABASE_LIGADO, SUPABASE_URL } from './config'
export { crachaValido, entrarComEmail, renovarAgora, sairDoSupabase } from './auth'
export type { Cracha } from './auth'
export { SESSAO_VENCIDA, tabela } from './rest'
export type { Metodo, Pedido } from './rest'
