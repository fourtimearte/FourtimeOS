import { cnpjValido, limparCnpj } from '../fornecedor/cnpj'
import { acharLinhaNoTexto, type LinhaLida } from './linha'

/* ==========================================================================
   O texto do boleto.

   O que dá para tirar do texto de um PDF de boleto, sem o pdf.js: a linha
   digitável, os CNPJs, o nome ao lado do CNPJ, os valores e as datas. É
   conta pura, e por isso mora separada de pdf.ts: o teste (testes/boleto.mjs)
   roda em node, onde não existe leitor de PDF.
   ========================================================================== */

export type BoletoLido = {
  arquivo: string
  /** o texto inteiro, linha por linha, como estava no PDF */
  texto: string
  linha: LinhaLida | null
  /** todos os CNPJs válidos do texto, na ordem em que aparecem, sem repetir */
  cnpjs: string[]
}

/** A parte que não depende do pdf.js, para poder ser testada com texto solto. */
export function lerTextoDoBoleto(texto: string, arquivo = '', hoje: Date = new Date()): BoletoLido {
  return {
    arquivo,
    texto,
    linha: acharLinhaNoTexto(texto, hoje),
    cnpjs: cnpjsDoTexto(texto),
  }
}

/* Com ponto e barra, ou os 14 caracteres corridos. A conta do dígito separa
   CNPJ de número comprido qualquer: "nosso número" e código de documento
   também têm 14 casas, e quase nunca fecham a conta. */
export function cnpjsDoTexto(texto: string): string[] {
  const achados: string[] = []
  const padrao = /(?<![0-9A-Z])([0-9A-Z]{2}\.?[0-9A-Z]{3}\.?[0-9A-Z]{3}\/?[0-9A-Z]{4}-?[0-9]{2})(?![0-9])/g
  for (const m of texto.toUpperCase().matchAll(padrao)) {
    const c = limparCnpj(m[1])
    /* sem pontuação nenhuma, só vale o que é todo de número: uma palavra de
       catorze letras seguida de dois números não é CNPJ */
    if (!/[./-]/.test(m[1]) && !/^\d{14}$/.test(c)) continue
    if (cnpjValido(c) && !achados.includes(c)) achados.push(c)
  }
  return achados
}

/* DE QUEM É O BOLETO. Entre os CNPJs do texto, o do beneficiário é o que não
   é o da própria empresa. Quando sobram dois (beneficiário e sacador
   avalista), ganha o que está escrito mais perto da palavra "Beneficiário"
   ou "Cedente", depois dela. */
export function cnpjDoBeneficiario(lido: BoletoLido, cnpjDaEmpresa: string): string {
  const meu = limparCnpj(cnpjDaEmpresa)
  const outros = lido.cnpjs.filter((c) => c !== meu)
  if (outros.length <= 1) return outros[0] ?? ''
  const maiusculo = lido.texto.toUpperCase()
  const rotulo = maiusculo.search(/BENEFICI[AÁ]RIO|CEDENTE|FAVORECIDO/)
  if (rotulo < 0) return outros[0]
  let melhor = outros[0]
  let distancia = Infinity
  for (const c of outros) {
    const onde = posicaoDoCnpj(maiusculo, c, rotulo)
    if (onde >= 0 && onde - rotulo < distancia) {
      distancia = onde - rotulo
      melhor = c
    }
  }
  return melhor
}

function posicaoDoCnpj(maiusculo: string, cnpj: string, apartirDe = 0): number {
  const comPontos = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
  const a = maiusculo.indexOf(comPontos, apartirDe)
  if (a >= 0) return a
  return maiusculo.indexOf(cnpj, apartirDe)
}

/* O NOME ESCRITO AO LADO DO CNPJ. Na ficha, o beneficiário aparece como
   "NOME DA EMPRESA LTDA - CNPJ: 12.345.678/0001-90" ou com o nome na linha
   de cima. Daqui sai o texto da linha do CNPJ sem o CNPJ, sem os rótulos e
   sem o endereço que costuma vir depois; se sobrar pouco, vale a linha de
   cima. É palpite, e a tela diz que é. */
export function nomeAoLadoDoCnpj(lido: BoletoLido, cnpj: string): string {
  if (!cnpj) return ''
  const linhas = lido.texto.split('\n')
  const indice = linhas.findIndex((l) => posicaoDoCnpj(l.toUpperCase(), cnpj) >= 0)
  if (indice < 0) return ''
  const limpar = (t: string) =>
    t
      .replace(/[0-9A-Z]{2}\.?[0-9A-Z]{3}\.?[0-9A-Z]{3}\/[0-9A-Z]{4}-?[0-9]{2}/gi, ' ')
      .replace(/\b(benefici[aá]rio( final)?|cedente|favorecido|sacador\/?avalista|sacador|cnpj\/cpf|cpf\/cnpj|cnpj|cpf|ag[eê]ncia\s*\/?\s*c[oó]digo( do)?( benefici[aá]rio| cedente)?|nome( do)?|raz[aã]o social)\b\s*:?/gi, ' ')
      .replace(/R\$\s*[\d.,]+/g, ' ')
      .replace(/\d{2}[/.]\d{2}[/.]\d{4}/g, ' ')
      .replace(/\d{4,}[-\d/. ]*/g, ' ')
      .replace(/[-\u2013\u2014:|/\s]+$/g, ' ')
      .replace(/^[-\u2013\u2014:|/\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const temNome = (t: string) => t.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 4
  /* na linha do CNPJ, o nome vem ANTES dele. O que vem depois é de outra
     coluna da ficha: vencimento, agência, valor. */
  const linha = linhas[indice]
  const onde = posicaoDoCnpj(linha.toUpperCase(), cnpj)
  const antes = limpar(linha.slice(0, onde))
  if (temNome(antes)) return antes.slice(0, 90)
  const deCima = indice > 0 ? limpar(linhas[indice - 1]) : ''
  if (temNome(deCima)) return deCima.slice(0, 90)
  const depois = limpar(linha.slice(onde))
  return temNome(depois) ? depois.slice(0, 90) : ''
}

/* O NOME ESTÁ ESCRITO NO BOLETO? Esta é a pergunta que a conferência faz, e
   ela é mais firme que adivinhar o nome pela posição: pega o nome que a
   Receita dá ao CNPJ, tira acento, pontuação e o tipo de sociedade, e procura
   no texto inteiro do PDF. Não importa em que canto da ficha o banco pôs. */
export function nomeApareceNoTexto(nome: string, texto: string): boolean {
  const limpo = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  const agulha = limpo(nome)
    .replace(/\b(ltda|me|epp|eireli|s a|sa|cia|mei)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (agulha.length < 4) return false
  return limpo(texto).replace(/\s+/g, ' ').includes(agulha)
}

/** Todos os valores em reais escritos no texto: "1.847,50" vira 1847.5. */
export function valoresDoTexto(texto: string): number[] {
  const fora: number[] = []
  for (const m of texto.matchAll(/(?<![\d.,])(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})(?![\d])/g)) {
    const v = Number(m[1].replace(/\./g, '') + '.' + m[2])
    if (Number.isFinite(v) && !fora.includes(v)) fora.push(v)
  }
  return fora
}

/** Todas as datas escritas no texto, em AAAA-MM-DD. */
export function datasDoTexto(texto: string): string[] {
  const fora: string[] = []
  for (const m of texto.matchAll(/(?<!\d)(\d{2})[/.](\d{2})[/.](\d{4})(?!\d)/g)) {
    const iso = `${m[3]}-${m[2]}-${m[1]}`
    if (!Number.isNaN(Date.parse(iso)) && !fora.includes(iso)) fora.push(iso)
  }
  return fora
}
