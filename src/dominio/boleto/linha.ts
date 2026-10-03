/* ==========================================================================
   A linha digitável.

   Tudo aqui é conta pura: entra texto, sai o que a linha diz e se os dígitos
   de controle fecham. Nada de rede, nada de banco, nada de tela, para poder
   ser testado sozinho (testes/boleto.mjs).

   DOIS TIPOS DE BOLETO, DUAS CONTAS:

     O boleto de cobrança tem 47 dígitos. É o do fornecedor: banco, moeda,
     três campos com dígito próprio (módulo 10), um dígito geral (módulo 11),
     o fator de vencimento e o valor.

     A guia de arrecadação tem 48 e começa com 8. É conta de água, luz,
     telefone e imposto. Não tem banco emissor nem vencimento na linha, e o
     dígito dela é módulo 10 ou 11 conforme a terceira casa.

   O FATOR DE VENCIMENTO DEU A VOLTA. Ele conta dias desde 07/10/1997 em
   quatro casas, chegou a 9999 em 21/02/2025 e recomeçou do 1000 no dia
   seguinte. Um mesmo fator vale então duas datas, com 9000 dias de distância
   uma da outra, e a certa é a que está mais perto de hoje.
   ========================================================================== */

export type TipoDeLinha = 'cobranca' | 'arrecadacao'

export type LinhaLida = {
  tipo: TipoDeLinha
  /** só os números, 47 ou 48 */
  linha: string
  /** os 44 do código de barras */
  barras: string
  /** os três números do banco; vazio na arrecadação */
  banco: string
  /** em reais; nulo quando a linha não traz valor */
  valor: number | null
  /** AAAA-MM-DD; vazio quando a linha não traz vencimento */
  vencimento: string
  /** os dígitos de controle fecham */
  valida: boolean
  /** em palavras, o que não fechou */
  problema: string
}

export function soNumeros(texto: string): string {
  return texto.replace(/\D/g, '')
}

/* Módulo 10: da direita para a esquerda, peso 2 e 1 alternados; produto de
   dois algarismos soma os algarismos. */
export function modulo10(numeros: string): number {
  let soma = 0
  let peso = 2
  for (let i = numeros.length - 1; i >= 0; i--) {
    const p = Number(numeros[i]) * peso
    soma += p > 9 ? p - 9 : p
    peso = peso === 2 ? 1 : 2
  }
  return (10 - (soma % 10)) % 10
}

/* Módulo 11 do código de barras de cobrança: pesos de 2 a 9, da direita para
   a esquerda. Resultado 0, 10 ou 11 vira 1. */
export function modulo11DaCobranca(numeros: string): number {
  let soma = 0
  let peso = 2
  for (let i = numeros.length - 1; i >= 0; i--) {
    soma += Number(numeros[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const d = 11 - (soma % 11)
  return d === 0 || d === 10 || d === 11 ? 1 : d
}

/* Módulo 11 da arrecadação: os mesmos pesos, mas resto 0 ou 1 dá dígito 0 e
   resto 10 também. */
export function modulo11DaArrecadacao(numeros: string): number {
  let soma = 0
  let peso = 2
  for (let i = numeros.length - 1; i >= 0; i--) {
    soma += Number(numeros[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  if (resto === 0 || resto === 1) return 0
  if (resto === 10) return 1
  return 11 - resto
}

const DIA = 86400000
const BASE_ANTIGA = Date.UTC(1997, 9, 7)
const BASE_NOVA = Date.UTC(2025, 1, 22)

function emIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** A data do fator, escolhida entre os dois ciclos pela proximidade de `hoje`. */
export function vencimentoDoFator(fator: number, hoje: Date = new Date()): string {
  if (!fator) return ''
  const antiga = BASE_ANTIGA + fator * DIA
  if (fator < 1000) return emIso(antiga)
  const nova = BASE_NOVA + (fator - 1000) * DIA
  const agora = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.abs(nova - agora) <= Math.abs(antiga - agora) ? emIso(nova) : emIso(antiga)
}

/** O fator de uma data, no ciclo que estiver valendo nela. */
export function fatorDoVencimento(iso: string): number {
  const ms = Date.parse(iso + 'T00:00:00Z')
  if (ms >= BASE_NOVA) return 1000 + Math.round((ms - BASE_NOVA) / DIA)
  return Math.round((ms - BASE_ANTIGA) / DIA)
}

function lerCobranca(l: string, hoje: Date): LinhaLida {
  const campo1 = l.slice(0, 9)
  const campo2 = l.slice(10, 20)
  const campo3 = l.slice(21, 31)
  const geral = Number(l[32])
  const fator = Number(l.slice(33, 37))
  const centavos = Number(l.slice(37, 47))
  const barras = l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + campo2 + campo3

  const errados: string[] = []
  if (modulo10(campo1) !== Number(l[9])) errados.push('primeiro campo')
  if (modulo10(campo2) !== Number(l[20])) errados.push('segundo campo')
  if (modulo10(campo3) !== Number(l[31])) errados.push('terceiro campo')
  if (modulo11DaCobranca(barras.slice(0, 4) + barras.slice(5)) !== geral) errados.push('dígito geral')

  return {
    tipo: 'cobranca',
    linha: l,
    barras,
    banco: l.slice(0, 3),
    valor: centavos ? centavos / 100 : null,
    vencimento: vencimentoDoFator(fator, hoje),
    valida: errados.length === 0,
    problema: errados.length ? 'Não fecha a conta: ' + errados.join(', ') : '',
  }
}

function lerArrecadacao(l: string): LinhaLida {
  const blocos = [l.slice(0, 12), l.slice(12, 24), l.slice(24, 36), l.slice(36, 48)]
  const barras = blocos.map((b) => b.slice(0, 11)).join('')
  /* a terceira casa diz a conta: 6 e 7 são módulo 10, 8 e 9 são módulo 11 */
  const referencia = barras[2]
  const conta = referencia === '6' || referencia === '7' ? modulo10 : modulo11DaArrecadacao
  const errados: string[] = []
  blocos.forEach((b, i) => {
    if (conta(b.slice(0, 11)) !== Number(b[11])) errados.push(`bloco ${i + 1}`)
  })
  if (conta(barras.slice(0, 3) + barras.slice(4)) !== Number(barras[3])) errados.push('dígito geral')
  /* 6 e 8 trazem o valor em reais; 7 e 9 trazem uma quantidade de moeda */
  const temValor = referencia === '6' || referencia === '8'
  const centavos = Number(barras.slice(4, 15))
  return {
    tipo: 'arrecadacao',
    linha: l,
    barras,
    banco: '',
    valor: temValor && centavos ? centavos / 100 : null,
    vencimento: '',
    valida: errados.length === 0,
    problema: errados.length ? 'Não fecha a conta: ' + errados.join(', ') : '',
  }
}

/* O que entra pode ser a linha digitável (47 ou 48) ou o código de barras
   (44). Com 44 a linha é montada de volta, porque é ela que se cola no banco. */
export function lerLinha(texto: string, hoje: Date = new Date()): LinhaLida | null {
  const n = soNumeros(texto)
  if (n.length === 47) return lerCobranca(n, hoje)
  if (n.length === 48 && n[0] === '8') return lerArrecadacao(n)
  if (n.length === 44 && n[0] !== '8') return lerCobranca(linhaDasBarras(n), hoje)
  return null
}

/** A linha de 47 de um código de barras de cobrança de 44. */
export function linhaDasBarras(b: string): string {
  const campo1 = b.slice(0, 4) + b.slice(19, 24)
  const campo2 = b.slice(24, 34)
  const campo3 = b.slice(34, 44)
  return (
    campo1 + modulo10(campo1) + campo2 + modulo10(campo2) + campo3 + modulo10(campo3) + b[4] + b.slice(5, 19)
  )
}

/** "34191.79001 01043.510047 91020.150008 5 15950000184750" */
export function linhaNaTela(linha: string): string {
  const l = soNumeros(linha)
  if (l.length === 47) {
    return (
      `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ` +
      `${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`
    )
  }
  if (l.length === 48) {
    return [0, 12, 24, 36].map((i) => `${l.slice(i, i + 11)}-${l[i + 11]}`).join(' ')
  }
  return linha
}

/* PROCURAR A LINHA DENTRO DE UM TEXTO. O texto de um PDF traz a linha com
   ponto e espaço, às vezes partida, às vezes repetida, e no meio de outros
   números compridos (nosso número, CNPJ, código do documento). Em vez de
   adivinhar pelo formato, a procura junta os pedaços de número e testa cada
   janela de 47 e de 48 casas: a que fecha os dígitos de controle é a linha.
   Uma sequência qualquer de 47 números passar nos quatro dígitos por acaso é
   uma chance em dez mil. */
export function acharLinhaNoTexto(texto: string, hoje: Date = new Date()): LinhaLida | null {
  const pedacos = texto.match(/\d[\d.\s-]{40,90}\d/g) ?? []
  let primeira: LinhaLida | null = null
  for (const pedaco of pedacos) {
    const n = soNumeros(pedaco)
    for (const tamanho of [47, 48]) {
      for (let i = 0; i + tamanho <= n.length; i++) {
        const lida = lerLinha(n.slice(i, i + tamanho), hoje)
        if (!lida) continue
        if (lida.valida) return lida
        if (!primeira && i === 0 && n.length === tamanho) primeira = lida
      }
    }
  }
  /* nenhuma fechou: devolve a que tinha o tamanho certo, para a tela poder
     dizer "a linha deste PDF não fecha a conta" em vez de "não achei linha" */
  return primeira
}

/* ---------- os bancos ----------------------------------------------------- */

const BANCOS: Record<string, string> = {
  '001': 'Banco do Brasil',
  '003': 'Banco da Amazônia',
  '004': 'Banco do Nordeste',
  '021': 'Banestes',
  '033': 'Santander',
  '037': 'Banpará',
  '041': 'Banrisul',
  '047': 'Banese',
  '070': 'BRB',
  '077': 'Inter',
  '084': 'Uniprime',
  '085': 'Ailos',
  '097': 'Credisis',
  '104': 'Caixa',
  '133': 'Cresol',
  '136': 'Unicred',
  '197': 'Stone',
  '208': 'BTG Pactual',
  '212': 'Original',
  '218': 'BS2',
  '237': 'Bradesco',
  '246': 'ABC Brasil',
  '260': 'Nubank',
  '274': 'BMP',
  '290': 'PagBank',
  '323': 'Mercado Pago',
  '336': 'C6 Bank',
  '341': 'Itaú',
  '364': 'Efí',
  '380': 'PicPay',
  '389': 'Mercantil',
  '403': 'Cora',
  '422': 'Safra',
  '461': 'Asaas',
  '633': 'Rendimento',
  '655': 'BV',
  '707': 'Daycoval',
  '745': 'Citibank',
  '748': 'Sicredi',
  '756': 'Sicoob',
}

/** O nome do banco pelo código; vazio quando o código não está na lista. */
export function nomeDoBanco(codigo: string): string {
  return BANCOS[codigo] ?? ''
}

/** "Itaú (341)", ou "banco 999" quando o código não é conhecido. */
export function bancoNaTela(codigo: string): string {
  if (!codigo) return ''
  const nome = nomeDoBanco(codigo)
  return nome ? `${nome} (${codigo})` : `banco ${codigo}`
}
