import { chamar } from '@shared/supabase'

/* ==========================================================================
   O QUE A PAGINA GRAVA DO WHATSAPP (078, 13/10/2026).

   1. O REGISTRO NO LEAD (W3): as mensagens que a extensao leu da conversa
      aberta, so quando a conversa e de um lead do funil. O banco ignora a
      mensagem que ja tem (pelo id do WhatsApp) e atualiza o cartao.
   2. O ERRO DA EXTENSAO (o vigia): o que ela procurou no WhatsApp e nao
      achou, com o esqueleto da pagina em volta (sem texto nenhum).

   Antes da 078 rodar as duas funcoes nao existem: o registro avisa uma vez
   (semRegistro) e para de tentar; o erro some calado.
   ========================================================================== */

export type MensagemLida = {
  id: string
  eu: boolean
  /** ISO, ou vazio quando o WhatsApp nao mostrou a hora */
  em: string
  tipo: 'texto' | 'audio' | 'imagem' | 'video' | 'arquivo'
  texto: string
}

/* a funcao que nao existe chega como 404, que a tela traduz para "Não
   encontrei esse registro." (o lead fora do funil tem recado proprio) */
export const semRegistro = (e: unknown) =>
  e instanceof Error && /Não encontrei esse registro|PGRST202|Could not find the function|schema cache/i.test(e.message)

/** devolve quantas entraram (as repetidas o banco ignora) */
export async function registrarConversaDoWhatsApp(leadId: string, mensagens: MensagemLida[]): Promise<number> {
  if (!mensagens.length) return 0
  const n = await chamar<number>('registrar_conversa_do_whatsapp', { p_lead: leadId, p_mensagens: mensagens })
  return Number(n) || 0
}

export async function registrarErroDaExtensao(e: { versao: string; onde: string; oque: string; estrutura: unknown }) {
  await chamar('registrar_erro_da_extensao', {
    p_versao: String(e.versao || '').slice(0, 20),
    p_onde: String(e.onde || '').slice(0, 40),
    p_o_que: String(e.oque || '').slice(0, 200),
    p_estrutura: e.estrutura ?? null,
  }).catch(() => {})
}
