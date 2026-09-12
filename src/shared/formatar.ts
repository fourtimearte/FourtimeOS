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
  const n = telefone.replace(/\D/g, '')
  const numero = n.startsWith('55') ? n : '55' + n
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem)
}

/** Texto sem acento e sem caixa, que e como a fabrica digita na busca. */
export const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
