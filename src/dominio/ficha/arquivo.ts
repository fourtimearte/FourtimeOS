/* Os imports sao relativos, e nao pelo apelido do dominio, de proposito: a
   porta da frente de @dominio/layout leva junto as telas em React, e este
   arquivo precisa continuar rodando em node puro para a conferencia do
   formato poder existir. Mesma razao do arquivo .cft da cotacao. */
import { blocoEmBranco, VERSAO_DO_BLOCO, type Bloco } from '../layout/bloco'
import { hexDaCor, hexDoTecido, tecnicaDaTag } from '../layout/banco'
import type { Faixa } from '../layout/grade'
import {
  cabecalhoEmBranco,
  fichaEmBranco,
  formataPedido,
  migrarFicha,
  VERSAO_DA_FICHA,
  type CabecalhoDaFicha,
  type Ficha,
  type PecaDaFicha,
} from './tipos'

/* ==========================================================================
   Salvar e abrir a ficha em arquivo.

   Duas coisas moram aqui, e elas nao sao a mesma:

     O FORMATO NOVO, que e a ficha do Fourtime OS escrita como esta na
     memoria. Ele existe para levar uma ficha de um computador a outro, ou
     para guardar uma copia fora do banco. Quando o Supabase for a casa da
     ficha, este arquivo vira exportacao, e nao o lugar onde ela mora.

     O FORMATO DA v3.375, que e o `.ft` que a fabrica tem aos milhares no
     Drive desde 2012. Ele so e LIDO. Escrever de volta nele seria prometer
     que o editor velho abre o que o novo salva, e essa promessa nao tem como
     ser mantida: a ficha nova ja tem campos que la nao existem.

   Ler o `.ft` velho nao e gentileza: e a unica forma de o sistema novo
   comecar com o acervo inteiro da empresa dentro dele.
   ========================================================================== */

export const EXTENSAO = '.ft'
const MARCA = 'fourtime.ficha'
export const VERSAO_DO_FT = 1

/* o que a v3.375 carimba no arquivo dela. A extensao e a mesma, e isso e de
   proposito: a fabrica procura .ft ha anos, e trocar a extensao agora seria
   pedir para meia empresa aprender outro nome. Quem diz qual dos dois formatos
   esta dentro e a marca, e nao o nome do arquivo. */
const MARCA_V4 = 'FOURTIME_ORCAMENTO'

type Envelope = {
  marca: string
  versao: number
  versaoDoBloco: number
  gravadoEm: string
  ficha: unknown
}

type Bruto = Record<string, unknown>

export class ArquivoRecusado extends Error {}

/* --- escrever ------------------------------------------------------------ */

/** A ficha virada texto, pronta para virar arquivo. */
export function paraFt(f: Ficha): string {
  const envelope: Envelope = {
    marca: MARCA,
    versao: VERSAO_DO_FT,
    versaoDoBloco: VERSAO_DO_BLOCO,
    gravadoEm: new Date().toISOString(),
    ficha: { ...f, versao: VERSAO_DA_FICHA },
  }
  return JSON.stringify(envelope, null, 2)
}

/** Um nome de arquivo que a pessoa reconhece na pasta de downloads. */
export function nomeDoArquivo(f: Ficha): string {
  const c = f.cabecalho
  const quem = (c.nome || c.cliente || 'sem cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return ['ficha', c.pedido, quem].filter(Boolean).join('-') + EXTENSAO
}

/* --- ler ----------------------------------------------------------------- */

/** O texto de um .ft virando ficha, venha ele do sistema novo ou da v3.375. */
export function deFt(texto: string): Ficha {
  let lido: unknown
  try {
    lido = JSON.parse(texto)
  } catch {
    throw new ArquivoRecusado('Este arquivo não é um .ft: o conteúdo não é legível.')
  }
  const bruto = (lido ?? {}) as Bruto
  if (typeof bruto !== 'object') throw new ArquivoRecusado('Arquivo vazio.')

  /* o arquivo da v3.375 vem primeiro na fila porque ele e o caso comum: a
     fabrica tem milhares deles, e nenhum vai ser reescrito */
  if (bruto._formato === MARCA_V4 || Array.isArray(bruto.layouts)) return daV4(bruto)

  if (bruto.marca !== MARCA) {
    throw new ArquivoRecusado('Este arquivo não é uma ficha da Fourtime.')
  }
  const versao = Number(bruto.versao ?? 0)
  if (versao > VERSAO_DO_FT) {
    throw new ArquivoRecusado(
      'Este arquivo foi salvo por uma versão mais nova do sistema. Atualize a página e tente de novo.',
    )
  }
  /* os blocos sobem a propria escada: a versao deles vem do envelope, porque
     um bloco gravado nao carrega a sua */
  const corpo = (bruto.ficha ?? {}) as Bruto
  const versaoDoBloco = Number(bruto.versaoDoBloco ?? 0)
  const pecas = (Array.isArray(corpo.pecas) ? (corpo.pecas as Bruto[]) : []).map((p) => ({
    ...p,
    bloco: { ...((p.bloco ?? {}) as Bruto), versao: versaoDoBloco },
  }))
  return migrarFicha({ ...corpo, pecas } as Bruto)
}

/** Baixa a ficha como arquivo. */
export function baixarFt(f: Ficha) {
  const blob = new Blob([paraFt(f)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeDoArquivo(f)
  document.body.appendChild(a)
  a.click()
  a.remove()
  /* o navegador precisa de um instante para comecar a baixar antes de soltar */
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Abre o seletor de arquivo do sistema e devolve a ficha lida. */
export function abrirFt(): Promise<Ficha | null> {
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
          resolve(deFt(String(leitor.result)))
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

/* --- a conversao do .ft da v3.375 ---------------------------------------- */

/* "FT-010-000M — CAMISETA" vira codigo e nome. O separador e o travessao
   porque o banco inteiro da fabrica ja e assim desde sempre: ele e DADO, e
   nao escrita. Referencia sem separador entra inteira no codigo, que e o que
   a pessoa digitou e o que ela espera ver de volta. */
function partirReferencia(bruto: string): { cod: string; nome: string } {
  const s = String(bruto || '').trim()
  const i = s.indexOf(' — ')
  if (i < 0) return { cod: s, nome: '' }
  return { cod: s.slice(0, i).trim(), nome: s.slice(i + 3).trim() }
}

/* a v3.375 escreve a data como dd/mm/aaaa no campo; aqui dentro ela e ISO */
function dataParaIso(bruto: string): string {
  const s = String(bruto || '').trim()
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (m) return m[3] + '-' + m[2] + '-' + m[1]
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return ''
}

function numero(bruto: unknown): number {
  const s = String(bruto ?? '').trim().replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/* o texto do cabecalho da v3.375 pode vir de um campo (texto puro) ou de um
   elemento editavel (HTML). Aqui dentro o cabecalho e texto puro. */
function semEtiquetas(bruto: unknown): string {
  return String(bruto ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function cabecalhoDaV4(h: Bruto): CabecalhoDaFicha {
  const documento = semEtiquetas(h.cpfcnpj ?? h.cpf ?? h.cnpj)
  const cliente = semEtiquetas(h.cliente)
  return {
    ...cabecalhoEmBranco(),
    nome: semEtiquetas(h.nomedoc) || cliente.toUpperCase(),
    cliente,
    documento,
    pedido: formataPedido(semEtiquetas(h.pedido)),
    envio: dataParaIso(semEtiquetas(h.envio)),
    vendedor: semEtiquetas(h.vendedor),
    departamento: semEtiquetas(h.departamento),
    entrega: semEtiquetas(h.entrega),
    embalagem: semEtiquetas(h.embalagem),
    pagamento: semEtiquetas(h.pagamento),
    contato: semEtiquetas(h.contato),
    /* a observacao do documento e a unica coisa do cabecalho que pode ter
       marcacao: ela e texto rico dos dois lados */
    observacao: String(h.obs ?? ''),
    marcas: [],
  }
}

function pecaDaV4(L: Bruto, n: number): PecaDaFicha {
  const b: Bloco = blocoEmBranco(n)
  const ref = partirReferencia(String(L.ref ?? ''))
  b.referencia = ref.cod
  b.nomeDaReferencia = ref.nome
  b.genero = String(L.genero ?? '')
  b.faixa = (L.grade === 'infantil' ? 'infantil' : 'adulto') as Faixa
  b.informacoes = L.info === true
  b.arte = String(L.arte ?? '')
  b.imagem = typeof L.img === 'string' ? L.img : ''
  b.observacao = String(L.obs ?? '')

  /* UMA COR POR TECIDO desde a v3.340. O campo `cor` antigo continua no
     arquivo, com a cor da primeira linha, e e ele que vale quando o arquivo
     e mais velho que a v3.340 e nao tem a lista. */
  const nomes = Array.isArray(L.tecidos) ? (L.tecidos as unknown[]).map((t) => String(t ?? '')) : []
  const cores = Array.isArray(L.cores) ? (L.cores as unknown[]).map((c) => String(c ?? '')) : []
  const corSolta = String(L.cor ?? '')
  b.tecidos = nomes
    .map((nome, i) => {
      const cor = cores[i] ?? (i === 0 ? corSolta : '')
      return { nome, cor, hex: hexDoTecido(cor) }
    })
    .filter((t) => t.nome.trim() !== '' || t.cor.trim() !== '')

  b.design = (Array.isArray(L.design) ? (L.design as Bruto[]) : [])
    .filter((d) => d && typeof d.tag === 'string')
    .map((d) => {
      const tag = String(d.tag)
      const lista = Array.isArray(d.cores) ? (d.cores as unknown[]) : []
      return {
        tag,
        tecnica: tecnicaDaTag(tag),
        cores: lista
          .map((c) => String(c ?? '').trim())
          .filter(Boolean)
          .map((cod) => ({ cod, hex: hexDaCor(cod) })),
      }
    })

  /* a grade da v3.375 guarda quantidade e valor juntos, um par por tamanho */
  const tam = (L.tamanhos ?? {}) as Record<string, { q?: unknown; u?: unknown }>
  const precoPorTamanho: Record<string, number> = {}
  const grade = b.grade as Record<string, number>
  for (const [t, par] of Object.entries(tam)) {
    const q = Math.round(numero(par?.q))
    const u = numero(par?.u)
    if (q > 0) grade[t] = q
    if (u > 0) precoPorTamanho[t] = u
  }

  /* QUANDO O VALOR E O MESMO EM TODOS OS TAMANHOS ele vira preco base, e a
     coluna por tamanho fica vazia. E o caso comum, e sem isto toda ficha
     aberta apareceria com dez valores repetidos digitados a mao. */
  const valores = Object.values(precoPorTamanho)
  const todosIguais = valores.length > 0 && valores.every((v) => v === valores[0])
  if (todosIguais) return { bloco: b, precoBase: valores[0], precoPorTamanho: {} }
  return { bloco: b, precoBase: 0, precoPorTamanho }
}

function daV4(doc: Bruto): Ficha {
  const f = fichaEmBranco()
  const layouts = Array.isArray(doc.layouts) ? (doc.layouts as Bruto[]) : []
  const pecas = layouts.map((L, i) => pecaDaV4(L, i + 1))
  return migrarFicha({
    ...f,
    cabecalho: cabecalhoDaV4((doc.header ?? {}) as Bruto),
    pecas: pecas.length ? pecas : f.pecas,
    criadaEm: String(doc.salvoEm ?? f.criadaEm),
    mudadaEm: new Date().toISOString(),
  } as unknown as Bruto)
}
