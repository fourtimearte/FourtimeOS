/* ==========================================================================
   O CNPJ.

   Conta pura, sem rede e sem banco, para o verificador de boleto e o teste
   poderem usar sem carregar mais nada.
   ========================================================================== */

/* O CNPJ NOVO TEM LETRA. Desde julho de 2026 a Receita emite CNPJ com letra
   maiúscula nas doze primeiras casas; os dois dígitos do fim continuam
   números. A conta do dígito é a mesma de sempre, só que cada caractere vale
   o código dele menos 48: '0' vale 0, 'A' vale 17. Para um CNPJ só de número
   isso dá exatamente a conta antiga. */
export function limparCnpj(texto: string): string {
  return texto.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

export function cnpjValido(texto: string): boolean {
  const c = limparCnpj(texto)
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false
  if (/^(.)\1{13}$/.test(c)) return false
  const valor = (i: number) => c.charCodeAt(i) - 48
  const digito = (ate: number) => {
    let soma = 0
    let peso = 2
    for (let i = ate - 1; i >= 0; i--) {
      soma += valor(i) * peso
      peso = peso === 9 ? 2 : peso + 1
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito(12) === valor(12) && digito(13) === valor(13)
}

/** "12.345.678/0001-90". O que não tem os 14 caracteres volta como veio. */
export function cnpjNaTela(texto: string): string {
  const c = limparCnpj(texto)
  if (c.length !== 14) return texto
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}

/** A máscara enquanto a pessoa digita: põe ponto, barra e traço no lugar. */
export function mascaraDoCnpj(texto: string): string {
  const c = limparCnpj(texto).slice(0, 14)
  let fora = c.slice(0, 2)
  if (c.length > 2) fora += '.' + c.slice(2, 5)
  if (c.length > 5) fora += '.' + c.slice(5, 8)
  if (c.length > 8) fora += '/' + c.slice(8, 12)
  if (c.length > 12) fora += '-' + c.slice(12)
  return fora
}
