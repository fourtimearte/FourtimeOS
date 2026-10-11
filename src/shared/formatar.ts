/* ==========================================================================
   Os formatadores.

   Eles moram aqui, e nao dentro de um dominio, porque telefone e telefone em
   qualquer tela: no cliente, no lead, na cotacao. Estavam escritos no dominio
   de cliente, e o funil so nao copiou de novo porque eles mudaram de casa.

   Regra: shared/ so pode importar de ds/. Nunca de dominio/ nem de modules/.
   ========================================================================== */

export function formatarDocumento(d: string) {
  const n = d.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return d
}

export function formatarTelefone(t: string) {
  const n = t.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return t
}

export function formatarDinheiro(v: number) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

/** Com centavos, para documento e para conta que precisa fechar. */
export function formatarDinheiroExato(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/* So o numero, sem o R$. A tabela do relatorio usa isto porque o cabecalho ja
   diz "Total R$": repetir o simbolo em cada celula custa uns 30 px por coluna,
   que e exatamente o que empurrava o Total R$ para fora da vista. */
export function formatarNumeroExato(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatarData(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatarCep(cep: string) {
  const n = cep.replace(/\D/g, '')
  return n.length === 8 ? n.replace(/(\d{5})(\d{3})/, '$1-$2') : cep
}

/* O link do WhatsApp com a mensagem pronta, que foi a decisao 1 do passo 1:
   wa.me agora, API oficial depois. O numero pode vir com ou sem o 55. */
export function linkDoWhatsApp(telefone: string, mensagem: string) {
  return 'https://wa.me/' + numeroComPais(telefone) + '?text=' + encodeURIComponent(mensagem)
}

function numeroComPais(telefone: string) {
  const n = telefone.replace(/\D/g, '')
  return n.startsWith('55') ? n : '55' + n
}

/* NO COMPUTADOR, O WHATSAPP WEB DIRETO (W1 do plano 16, 11/10/2026).

   O wa.me no computador para numa pagina do meio ("Continuar para a
   conversa", "usar o WhatsApp Web") antes de chegar na conversa: um clique a
   mais, cem vezes por dia. O /send do WhatsApp Web pula essa pagina.

   No celular e no tablet do galpao continua o wa.me, que abre o aplicativo.
   Ponteiro grosso e o sinal, e nao a largura: tablet deitado passa de 1024 px
   e continua sem WhatsApp Web.

   SEMPRE UMA ABA NOVA, e nao a mesma aba de antes. O WhatsApp Web corta o laco
   com a pagina que o abriu (Cross-Origin-Opener-Policy), entao uma janela com
   nome nunca e achada de novo: o segundo clique abriria outra aba do mesmo
   jeito, so que fingindo que nao. Trocar de conversa sem recarregar e trabalho
   da extensao Fourtime OS (W2). */
export function noComputador(): boolean {
  if (typeof window === 'undefined') return false
  const fino = window.matchMedia?.('(pointer: fine)').matches ?? false
  return fino && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
}

export function linkDoWhatsAppWeb(telefone: string, mensagem = '') {
  return (
    'https://web.whatsapp.com/send?phone=' +
    numeroComPais(telefone) +
    (mensagem ? '&text=' + encodeURIComponent(mensagem) : '')
  )
}

/** A versao da extensao Fourtime OS neste Chrome, ou '' sem ela. Quem marca e
    a propria extensao (extensao/anuncio.js), na raiz da pagina. */
export function versaoDaExtensao(): string {
  if (typeof document === 'undefined') return ''
  return document.documentElement.dataset.fourtimeExtensao ?? ''
}

export function abrirNoWhatsApp(telefone: string, mensagem = '') {
  /* COM A EXTENSAO, a conversa troca na aba do WhatsApp que ja esta aberta,
     sem aba nova e, se o WhatsApp aceitar, sem recarregar. O pedido vai para a
     propria janela; a extensao pega e leva. */
  /* A PAGINA PODE ATENDER PRIMEIRO. O Funil com o WhatsApp aberto dentro
     dele (pranchas 131 a 133) pega o pedido e troca a conversa ali mesmo;
     em qualquer outra pagina ninguem pega, e segue o caminho de sempre. */
  const pedido = new CustomEvent('fourtime:abrir-whatsapp', {
    cancelable: true,
    detail: { telefone: numeroComPais(telefone), texto: mensagem },
  })
  if (!window.dispatchEvent(pedido)) return
  if (noComputador() && versaoDaExtensao()) {
    window.postMessage(
      { fourtime: 'abrir-whatsapp', telefone: numeroComPais(telefone), texto: mensagem },
      window.location.origin,
    )
    return
  }
  const link = noComputador()
    ? linkDoWhatsAppWeb(telefone, mensagem)
    : mensagem
      ? linkDoWhatsApp(telefone, mensagem)
      : 'https://wa.me/' + numeroComPais(telefone)
  window.open(link, '_blank', 'noopener')
}

/** Texto sem acento e sem caixa, que e como a fabrica digita na busca. */
export const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
