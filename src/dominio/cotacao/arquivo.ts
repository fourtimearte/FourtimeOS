import { migrarBloco, VERSAO_DO_BLOCO, type Bloco } from '../layout/bloco'
import { VERSAO_DO_CFT, cotacaoEmBranco, type Cotacao } from './tipos'

/* ==========================================================================
   O arquivo .cft

   Uma cotacao pode sair do sistema como arquivo e voltar. Serve para tres
   coisas que acontecem toda semana na fabrica: mandar a cotacao para outro
   vendedor mexer, guardar uma copia antes de uma mudanca grande, e abrir de
   novo um orcamento antigo sem depender do banco estar no ar.

   O .cft e um JSON com cabecalho. O cabecalho existe para o arquivo se
   identificar sozinho: quem abrir no bloco de notas ve o que e, de que versao
   e, e de quando. Sem isso, daqui a dois anos um arquivo solto na area de
   trabalho e um enigma.

   A REGRA DA ESCADA
   Cada mudanca de formato vira um degrau novo, e nenhum degrau antigo e
   apagado nem editado. Assim um arquivo salvo hoje continua abrindo depois de
   dez mudancas de formato: ele sobe a escada degrau por degrau ate a versao
   de hoje. Arquivo de versao mais NOVA que o sistema nao abre, e avisa, porque
   adivinhar o que veio do futuro e como se perde dado.
   ========================================================================== */

export const EXTENSAO = '.cft'
const MARCA = 'fourtime.cotacao'

type Envelope = {
  marca: string
  versao: number
  versaoDoBloco: number
  gravadoEm: string
  cotacao: unknown
}

type Bruto = Record<string, unknown>

/* --- a escada da cotacao -------------------------------------------------
   Ela nasce com um degrau que nao faz nada, de proposito. A hora de escrever
   a escada e antes de existir o segundo formato, nao depois. */
const DEGRAUS: ((c: Bruto) => Bruto)[] = [
  /* de 0 (arquivo sem versao, anterior a tudo) para 1: so carimbar */
  (c) => c,
]

export class ArquivoRecusado extends Error {}

/** A cotacao virada texto, pronta para virar arquivo. */
export function paraCft(c: Cotacao): string {
  const envelope: Envelope = {
    marca: MARCA,
    versao: VERSAO_DO_CFT,
    versaoDoBloco: VERSAO_DO_BLOCO,
    gravadoEm: new Date().toISOString(),
    cotacao: { ...c, versaoDoFormato: VERSAO_DO_CFT },
  }
  return JSON.stringify(envelope, null, 2)
}

/** O texto de um .cft virando cotacao, subindo a escada se for antigo. */
export function deCft(texto: string): Cotacao {
  let lido: unknown
  try {
    lido = JSON.parse(texto)
  } catch {
    throw new ArquivoRecusado('Este arquivo não é um .cft: o conteúdo não é legível.')
  }

  const env = lido as Partial<Envelope>
  if (!env || env.marca !== MARCA) {
    throw new ArquivoRecusado('Este arquivo não é uma cotação da Fourtime.')
  }

  const versao = Number(env.versao ?? 0)
  if (versao > VERSAO_DO_CFT) {
    throw new ArquivoRecusado(
      'Este arquivo foi salvo por uma versão mais nova do sistema. Atualize a página e tente de novo.',
    )
  }

  let corpo = (env.cotacao ?? {}) as Bruto
  let v = versao
  while (v < VERSAO_DO_CFT) {
    corpo = DEGRAUS[v](corpo)
    v++
  }

  /* os blocos sobem a propria escada, que e a mesma que a ficha de producao
     vai usar na fase 2 */
  const versaoDoBloco = Number(env.versaoDoBloco ?? 0)
  const produtosBrutos = Array.isArray(corpo.produtos) ? (corpo.produtos as Bruto[]) : []
  const produtos = produtosBrutos.map((p) => {
    const bruto = { ...((p.bloco ?? {}) as Bruto), versao: versaoDoBloco }
    return {
      bloco: migrarBloco(bruto) as Bloco,
      precoPorTamanho: (p.precoPorTamanho ?? {}) as Record<string, number>,
      precoBase: Number(p.precoBase ?? 0),
    }
  })

  /* o molde em branco preenche o que faltar: arquivo antigo sem campo novo
     abre com o campo no padrao, e nao quebra a tela */
  const molde = cotacaoEmBranco(String(corpo.numero ?? ''))
  return {
    ...molde,
    ...(corpo as unknown as Cotacao),
    cliente: { ...molde.cliente, ...((corpo.cliente ?? {}) as object) },
    informe: { ...molde.informe, ...((corpo.informe ?? {}) as object) },
    ajustes: Array.isArray(corpo.ajustes) ? (corpo.ajustes as Cotacao['ajustes']) : [],
    enviadas: Array.isArray(corpo.enviadas) ? (corpo.enviadas as Cotacao['enviadas']) : [],
    produtos,
    versaoDoFormato: VERSAO_DO_CFT,
  }
}

/** Um nome de arquivo que a pessoa reconhece na pasta de downloads. */
export function nomeDoArquivo(c: Cotacao): string {
  const cliente = (c.cliente.nome || 'sem cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return ['cotacao', c.numero, cliente].filter(Boolean).join('-') + EXTENSAO
}

/** Baixa a cotacao como arquivo. */
export function baixarCft(c: Cotacao) {
  const blob = new Blob([paraCft(c)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeDoArquivo(c)
  document.body.appendChild(a)
  a.click()
  a.remove()
  /* o navegador precisa de um instante para comecar a baixar antes de soltar */
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Abre o seletor de arquivo do sistema e devolve a cotacao lida. */
export function abrirCft(): Promise<Cotacao | null> {
  return new Promise((resolve, reject) => {
    const entrada = document.createElement('input')
    entrada.type = 'file'
    entrada.accept = EXTENSAO + ',application/json'
    entrada.onchange = () => {
      const arq = entrada.files?.[0]
      if (!arq) {
        resolve(null)
        return
      }
      const leitor = new FileReader()
      leitor.onload = () => {
        try {
          resolve(deCft(String(leitor.result)))
        } catch (e) {
          reject(e)
        }
      }
      leitor.onerror = () => reject(new ArquivoRecusado('Não deu para ler o arquivo.'))
      leitor.readAsText(arq)
    }
    entrada.click()
  })
}
