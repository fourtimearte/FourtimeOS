/* As duas variaveis que ligam o sistema ao Supabase.

   Elas entram na hora de montar o pacote, nao na hora de rodar: o Fourtime OS
   e uma pagina estatica no Cloudflare, nao tem servidor por tras. Por isso o
   nome comeca com VITE_, que e o unico prefixo que o Vite deixa chegar ao
   navegador, e por isso elas moram em Settings > Builds > Variables and
   secrets, e nao em Runtime.

   Nada aqui e segredo. A chave publicavel foi feita para ficar dentro da
   pagina: quem barra o acesso e a regra de acesso do banco, nao o sigilo da
   chave. A senha do banco e a chave secreta nunca entram no codigo.

   Fica separado do vite-env.d.ts de proposito: aquele arquivo puxa os tipos do
   Vite, que so existem depois do npm install, e o teste do modulo do Supabase
   compila sem nada instalado. Este aqui nao depende de nada. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
