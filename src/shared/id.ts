/* ==========================================================================
   O id que o banco entende.

   As colunas de vínculo do Postgres são uuid, e um texto que não é uuid faz o
   banco recusar a gravação INTEIRA com uma mensagem sobre sintaxe de uuid: uma
   frase que não tem nada a ver com o que a pessoa fez e que ninguém entende.

   E texto que não é uuid aparece o tempo todo: a base do Bling numerava cliente
   como "C0001", e todo documento .cft salvo antes da virada para o Supabase
   carrega um id desses dentro dele. Abrir um arquivo assim e salvar não pode
   quebrar; o vínculo simplesmente não existe mais, e o certo é gravar vazio.

   Mora em shared/ porque não é regra de cotação nem de cliente: é a forma do
   id, e ela vale em toda porta que fala com o banco.
   ========================================================================== */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehUuid(id: unknown): boolean {
  return typeof id === 'string' && UUID.test(id)
}

/** O id quando ele serve de vínculo, e null quando não serve. */
export function vinculo(id: string | null | undefined): string | null {
  return ehUuid(id) ? (id as string) : null
}
