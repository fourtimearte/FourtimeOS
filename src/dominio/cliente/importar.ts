import type { Cliente, TipoDePessoa } from './tipos'

/* ==========================================================================
   A IMPORTACAO DOS CONTATOS DO BLING (pendencia 4.1 do FOURTIME OS - 12,
   12/10/2026). Sem banco e sem navegador: le o CSV que o Bling exporta,
   acha as colunas pelo nome do cabecalho, e separa cada linha em quatro
   montes antes de gravar qualquer coisa:

     novo                 entra
     ja existe            o mesmo documento, o mesmo final de telefone ou o
                          mesmo nome de um cliente que ja esta no sistema
     repetido no arquivo  a mesma pessoa duas vezes no CSV (fica a primeira)
     sem nome             a linha nao tem nome e o banco nao aceita

   O NOME E UNICO NO BANCO (001, cliente_nome_unico, sem acento e sem caixa).
   Por isso dois homonimos no arquivo nao entram os dois: o segundo vai para
   o relatorio, e quem decide e uma pessoa.
   ========================================================================== */

export type LinhaImportada = {
  /** a linha no arquivo, contando o cabecalho como 1 */
  linha: number
  cliente: Cliente
  situacao: 'novo' | 'ja-existe' | 'repetido' | 'sem-nome'
  /** por que caiu no monte: "mesmo CNPJ de Colegio Exemplo" */
  motivo: string
}

const so = (s: string) => (s || '').replace(/\D/g, '')
const chave = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
const fim = (s: string) => so(s).slice(-8)

/** O CSV do Bling: ponto e virgula ou virgula, aspas duplas, quebra de linha dentro de aspas. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, '')
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) {
      linha.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo[i + 1] === '\n') i++
      linha.push(campo)
      campo = ''
      if (linha.some((x) => x.trim())) linhas.push(linha)
      linha = []
    } else campo += c
  }
  linha.push(campo)
  if (linha.some((x) => x.trim())) linhas.push(linha)
  return linhas
}

type Campo =
  | 'nome'
  | 'fantasia'
  | 'documento'
  | 'tipo'
  | 'contato'
  | 'telefone'
  | 'celular'
  | 'email'
  | 'endereco'
  | 'numero'
  | 'complemento'
  | 'bairro'
  | 'cidade'
  | 'uf'
  | 'cep'
  | 'vendedor'
  | 'tipoDeContato'
  | 'situacao'

/* os nomes que o cabecalho pode ter, sem acento e sem caixa; o primeiro que bater ganha */
const NOMES: [Campo, string[]][] = [
  ['nome', ['nome', 'razao social', 'nome/razao social', 'nome / razao social', 'cliente']],
  ['fantasia', ['fantasia', 'nome fantasia']],
  ['documento', ['cnpj / cpf', 'cnpj/cpf', 'cpf / cnpj', 'cpf/cnpj', 'cnpj', 'cpf', 'documento']],
  ['tipo', ['tipo pessoa', 'tipo de pessoa', 'tipo']],
  ['contato', ['contatos', 'contato', 'pessoa de contato']],
  ['telefone', ['fone', 'telefone', 'telefone fixo']],
  ['celular', ['celular', 'whatsapp']],
  ['email', ['e-mail', 'email', 'e-mail para nfe']],
  ['endereco', ['endereco', 'logradouro']],
  ['numero', ['numero', 'nro', 'n']],
  ['complemento', ['complemento']],
  ['bairro', ['bairro']],
  ['cidade', ['cidade', 'municipio']],
  ['uf', ['uf', 'estado']],
  ['cep', ['cep']],
  ['vendedor', ['vendedor']],
  ['tipoDeContato', ['tipo contato', 'tipo de contato', 'tipos de contato']],
  ['situacao', ['situacao']],
]

export type MapaDeColunas = Partial<Record<Campo, number>>

export function acharColunas(cabecalho: string[]): MapaDeColunas {
  const cab = cabecalho.map(chave)
  const mapa: MapaDeColunas = {}
  for (const [campo, nomes] of NOMES) {
    const i = cab.findIndex((c, j) => nomes.includes(c) && !Object.values(mapa).includes(j))
    if (i >= 0) mapa[campo] = i
  }
  return mapa
}

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))

function paraCliente(l: string[], m: MapaDeColunas, molde: Cliente): Cliente {
  const v = (c: Campo) => (m[c] === undefined ? '' : (l[m[c] as number] ?? '').trim())
  const doc = so(v('documento'))
  const tipoTexto = chave(v('tipo'))
  const tipo: TipoDePessoa = tipoTexto.startsWith('j') || doc.length === 14 ? 'J' : 'F'
  const uf = v('uf').toUpperCase().slice(0, 2)
  const endereco = [v('endereco'), v('numero')].filter(Boolean).join(', ')
  return {
    ...molde,
    nome: v('nome').replace(/\s+/g, ' '),
    fantasia: v('fantasia'),
    tipo,
    documento: doc,
    contato: v('contato'),
    telefone: so(v('telefone')),
    celular: so(v('celular')),
    email: v('email').toLowerCase(),
    endereco,
    complemento: v('complemento'),
    bairro: v('bairro'),
    cidade: v('cidade'),
    uf: UFS.has(uf) ? uf : '',
    cep: so(v('cep')),
    vendedor: v('vendedor'),
    tipoDeContato: v('tipoDeContato') || 'Cliente',
  }
}

/** As chaves de quem e a mesma pessoa: o documento, o final de cada telefone e o nome. */
function chaves(c: Pick<Cliente, 'documento' | 'celular' | 'telefone' | 'nome'>): { tipo: string; valor: string }[] {
  const ks: { tipo: string; valor: string }[] = []
  const d = so(c.documento)
  if (d.length === 11 || d.length === 14) ks.push({ tipo: d.length === 14 ? 'CNPJ' : 'CPF', valor: 'd' + d })
  for (const t of [c.celular, c.telefone]) if (fim(t).length === 8) ks.push({ tipo: 'telefone', valor: 't' + fim(t) })
  const n = chave(c.nome)
  if (n) ks.push({ tipo: 'nome', valor: 'n' + n })
  return ks
}

export type Importacao = {
  linhas: LinhaImportada[]
  colunas: MapaDeColunas
  /** o cabecalho nao tem a coluna do nome: o arquivo nao e o do Bling */
  semNome: boolean
  conta: Record<LinhaImportada['situacao'], number>
}

export function separarImportacao(texto: string, base: Cliente[], molde: Cliente): Importacao {
  const [cabecalho = [], ...resto] = lerCsv(texto)
  const colunas = acharColunas(cabecalho)
  const conta = { novo: 0, 'ja-existe': 0, repetido: 0, 'sem-nome': 0 }
  if (colunas.nome === undefined) return { linhas: [], colunas, semNome: true, conta }

  const naBase = new Map<string, Cliente>()
  base.forEach((c) => chaves(c).forEach((k) => !naBase.has(k.valor) && naBase.set(k.valor, c)))
  const noArquivo = new Map<string, number>()

  const linhas = resto.map((l, i): LinhaImportada => {
    const cliente = paraCliente(l, colunas, molde)
    const n = i + 2
    if (!cliente.nome) return { linha: n, cliente, situacao: 'sem-nome', motivo: 'a linha não tem nome' }
    const ks = chaves(cliente)
    for (const k of ks) {
      const existe = naBase.get(k.valor)
      if (existe) return { linha: n, cliente, situacao: 'ja-existe', motivo: `mesmo ${k.tipo} de ${existe.nome}` }
    }
    for (const k of ks) {
      const antes = noArquivo.get(k.valor)
      if (antes) return { linha: n, cliente, situacao: 'repetido', motivo: `mesmo ${k.tipo} da linha ${antes}` }
    }
    ks.forEach((k) => noArquivo.set(k.valor, n))
    return { linha: n, cliente, situacao: 'novo', motivo: '' }
  })
  linhas.forEach((l) => conta[l.situacao]++)
  return { linhas, colunas, semNome: false, conta }
}

/** O relatorio do que nao entrou, para a pessoa aprovar: CSV com ponto e virgula. */
export function relatorioDaImportacao(imp: Importacao): string {
  const nome: Record<LinhaImportada['situacao'], string> = { novo: 'entra', 'ja-existe': 'já existe', repetido: 'repetido no arquivo', 'sem-nome': 'sem nome' }
  const q = (s: string | number) => '"' + String(s).replace(/"/g, '""') + '"'
  const cab = ['Linha', 'Situação', 'Motivo', 'Nome', 'CNPJ/CPF', 'Celular', 'Telefone', 'Cidade', 'UF']
  const corpo = imp.linhas
    .filter((l) => l.situacao !== 'novo')
    .map((l) => [l.linha, nome[l.situacao], l.motivo, l.cliente.nome, l.cliente.documento, l.cliente.celular, l.cliente.telefone, l.cliente.cidade, l.cliente.uf].map(q).join(';'))
  return '﻿' + [cab.map(q).join(';'), ...corpo].join('\r\n')
}

/** O texto do arquivo: o Bling exporta em UTF-8 ou em Latin-1, conforme a versao. */
export function textoDoArquivo(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
