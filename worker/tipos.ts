/* O que a Cloudflare entrega ao script: os arquivos do site e as variáveis.

   Variáveis (wrangler.jsonc, "vars"; não são segredo):
     SUPABASE_URL   o endereço do projeto, para conferir a assinatura do crachá
     DRIVE_PASTA    o id da pasta das artes no Google Drive

   Segredos (painel da Cloudflare, Workers, fourtimeos, Settings, Variables and
   Secrets; colados pelo Henrique), um dos dois jeitos:
     GOOGLE_CONTA_DE_SERVICO   o JSON inteiro da conta de serviço (Drive
                               compartilhado, onde ela pode criar arquivo)
     GOOGLE_CLIENTE_ID, GOOGLE_CLIENTE_SEGREDO, GOOGLE_RENOVACAO
                               a conta adm@ pelo OAuth (Meu Drive dela) */

export type Ambiente = {
  ASSETS: { fetch(req: Request): Promise<Response> }
  SUPABASE_URL?: string
  DRIVE_PASTA?: string
  GOOGLE_CONTA_DE_SERVICO?: string
  GOOGLE_CLIENTE_ID?: string
  GOOGLE_CLIENTE_SEGREDO?: string
  GOOGLE_RENOVACAO?: string
}

/* o cache da Cloudflare: o caches.default não existe no navegador nem no Node */
declare global {
  interface CacheStorage {
    readonly default: Cache
  }
}
