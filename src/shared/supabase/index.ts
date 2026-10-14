/* A porta da frente do Supabase. O resto do sistema entra por aqui. */
export { SUPABASE_CHAVE, SUPABASE_LIGADO, SUPABASE_URL } from './config'
export { cadastrar, crachaDoLink, crachaValido, entrarComEmail, pedirLinkDeSenha, renovarAgora, sairDoSupabase, trocarASenha } from './auth'
export type { Cracha } from './auth'
export { chamar, RECADO_DO_PRAZO_GRAVANDO, RECADO_DO_PRAZO_LENDO, SESSAO_VENCIDA, tabela } from './rest'
export type { Metodo, Pedido } from './rest'
export { funcao } from './funcoes'
export { apagarArquivo, baixarArquivo, enderecoPublico, subirArquivo } from './arquivos'
