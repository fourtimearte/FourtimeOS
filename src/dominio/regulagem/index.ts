import { tabela } from '@shared/supabase'

/* ==========================================================================
   A regulagem do sistema.

   O punhado de decisões que valem para o sistema inteiro e que mudam de vez em
   quando. Hoje é uma só: o sistema está em ENSAIO ou já está valendo?

   Enquanto vale "teste", o pedido nasce PD-TESTE-0001 em vez de um número de
   pedido de verdade, e as ferramentas de conferência (o kit de teste, por
   exemplo) aparecem na tela. No dia do lançamento a chave vira, e elas somem
   sozinhas, sem ninguém precisar lembrar de tirá-las antes de a fábrica usar.

   A resposta é guardada na memória da aba. Não é economia de rede: é que a
   chave não muda no meio de um expediente, e uma consulta por tela aberta
   custaria mais do que vale. Recarregar a página relê.
   ========================================================================== */

let lembrado: boolean | null = null

export async function emEnsaio(): Promise<boolean> {
  if (lembrado !== null) return lembrado
  try {
    const linhas = await tabela<{ valor: string }[]>(
      'regulagem?select=valor&chave=eq.pedido',
    )
    /* Sem linha nenhuma, o sistema está em ensaio. O padrão prudente aqui é o
       contrário do usual: se a regulagem sumiu, é melhor o pedido sair marcado
       como teste do que sair com um número de pedido real que ninguém pediu. */
    lembrado = (linhas[0]?.valor ?? 'teste') === 'teste'
  } catch {
    lembrado = true
  }
  return lembrado
}

/** Esquece o que foi lido. Serve para depois de virar a chave. */
export function esquecerRegulagem() {
  lembrado = null
}
