import { migrarBloco, VERSAO_DO_BLOCO, type Bloco } from '../layout/bloco'
import {
  INFORME_PADRAO,
  VERSAO_DO_CFT,
  cotacaoEmBranco,
  informesEmBranco,
  type Cotacao,
} from './tipos'

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

  /* de 1 para 2: entrou o pedido.
     Arquivo da versao 1 nao tem aprovacao nem pecas no envio. Aprovacao nula e
     a resposta certa: ele foi salvo antes de existir aprovacao no sistema, e
     inventar uma seria mentir sobre um sim que ninguem deu. As pecas de cada
     envio antigo nao da para saber, entao ficam zero, e a tela mostra so o
     total, que esse esta gravado. */
  (c) => ({
    ...c,
    aprovacao: null,
    enviadas: Array.isArray(c.enviadas)
      ? (c.enviadas as Bruto[]).map((e) => ({ pecas: 0, ...e }))
      : [],
  }),

  /* de 2 para 3: os informes viraram lista.
     "entrega" muda de nome para "envio" e a tabela de preco entra com o padrao
     da casa. A observacao solta, que era um campo de texto sem dono, vira o
     primeiro informe da lista e ja nasce marcada para o PDF: ela foi escrita
     para o cliente ler, e sumir com ela na migracao seria perder texto que
     alguem digitou. Os nove informes padrao entram depois dela. */
  (c) => {
    const velho = (c.informe ?? {}) as Bruto
    const observacao = String(velho.observacao ?? '').trim()
    const daCasa = informesEmBranco()
    return {
      ...c,
      informe: {
        prazo: String(velho.prazo ?? '') || INFORME_PADRAO.prazo,
        pagamento: String(velho.pagamento ?? '') || INFORME_PADRAO.pagamento,
        /* O DEGRAU CONGELA NO TEMPO. Aqui o campo ainda se chama `envio`, e o
           valor de reserva e escrito a mao: um degrau que le uma constante de
           hoje muda de comportamento toda vez que a constante muda, e ai um
           arquivo de dois anos atras passa a abrir diferente do que abria
           ontem. Quem renomeia `envio` para `entrega` e o degrau seguinte. */
        envio: String(velho.entrega ?? '') || 'CORREIOS',
        tabelaDePreco: INFORME_PADRAO.tabelaDePreco,
      },
      informes: observacao
        ? [{ id: 'IF0', texto: observacao, noDocumento: true }, ...daCasa]
        : daCasa,
    }
  },
  /* de 3 para 4: a FUSAO com a ficha de producao.

     O bloco de producao entra VAZIO, e nao chutado: uma cotacao salva antes
     da fusao nunca teve numero de pedido nem departamento, e inventar um
     seria escrever na ficha um dado que ninguem digitou.

     E o `envio` do informe vira `entrega`. Ele sempre foi o MODO, e a ficha
     chamava de `envio` a DATA: manter os dois com o mesmo nome no mesmo
     registro era a armadilha mais cara da fusao. O degrau renomeia e apaga o
     nome velho, para nao sobrar campo fantasma no arquivo de amanha. */
  (c) => {
    const informe = { ...((c.informe ?? {}) as Bruto) }
    if (informe.envio !== undefined && informe.entrega === undefined) {
      informe.entrega = informe.envio
    }
    delete informe.envio
    return {
      ...c,
      informe,
      producao: c.producao ?? {
        pedido: '',
        dataDeEnvio: '',
        departamento: '',
        embalagem: '',
        marcas: [],
        observacao: '',
      },
    }
  },
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

  return arrumarCotacao(
    (env.cotacao ?? {}) as Bruto,
    versao,
    Number(env.versaoDoBloco ?? 0),
  )
}

/* --------------------------------------------------------------------------
   A ESCADA NAO E SO DO ARQUIVO.

   Ela nasceu dentro do deCft, e por um tempo isso pareceu suficiente: quem
   sobe degrau e o arquivo que veio de fora. Mas uma cotacao guardada no
   proprio navegador tambem e um registro antigo: ela foi gravada com o
   formato daquele dia e fica ali, parada, enquanto o sistema anda. Quando a
   fusao com a ficha entrou, toda cotacao ja gravada passou a estar um degrau
   atras, sem o bloco de producao. A tela nova pedia c.producao.marcas e
   encontrava nada.

   Entao a escada e publica. Todo lugar que le uma cotacao que nao acabou de
   nascer na memoria passa por aqui: o arquivo .cft, o armazenamento do
   navegador, e amanha o Supabase. E a mesma porta, e e a unica.
   -------------------------------------------------------------------------- */

/**
 * Sobe uma cotacao crua ate o formato de hoje.
 *
 * @param corpo a cotacao como esta gravada, seja em arquivo ou no navegador
 * @param versao o formato em que ela foi gravada. 0 quer dizer "antes de tudo"
 * @param versaoDoBloco o formato dos blocos daquele momento
 */
export function arrumarCotacao(corpo: Bruto, versao: number, versaoDoBloco: number): Cotacao {
  let corpoAtual = corpo
  let v = Math.max(0, Math.min(versao, VERSAO_DO_CFT))
  while (v < VERSAO_DO_CFT) {
    corpoAtual = DEGRAUS[v](corpoAtual)
    v++
  }

  /* os blocos sobem a propria escada, que e a mesma que a ficha de producao
     vai usar na fase 2 */
  const produtosBrutos = Array.isArray(corpoAtual.produtos) ? (corpoAtual.produtos as Bruto[]) : []
  const produtos = produtosBrutos.map((p) => {
    const guardada = (p.bloco ?? {}) as Bruto
    /* a versao gravada no proprio bloco manda, quando ela existe: no
       navegador cada bloco carrega a sua, e no arquivo ela vem do envelope */
    const bruto = { ...guardada, versao: Number(guardada.versao ?? versaoDoBloco) }
    return {
      bloco: migrarBloco(bruto) as Bloco,
      precoPorTamanho: (p.precoPorTamanho ?? {}) as Record<string, number>,
      precoBase: Number(p.precoBase ?? 0),
    }
  })

  /* o molde em branco preenche o que faltar: registro antigo sem campo novo
     abre com o campo no padrao, e nao quebra a tela. Os objetos de dentro
     precisam ser espalhados um a um, porque o espalhar de cima troca o objeto
     inteiro: um `informe` gravado sem `entrega` apagaria o `entrega` do molde */
  const molde = cotacaoEmBranco(String(corpoAtual.numero ?? ''))
  return {
    ...molde,
    ...(corpoAtual as unknown as Cotacao),
    cliente: { ...molde.cliente, ...((corpoAtual.cliente ?? {}) as object) },
    informe: { ...molde.informe, ...((corpoAtual.informe ?? {}) as object) },
    producao: { ...molde.producao, ...((corpoAtual.producao ?? {}) as object) },
    informes: Array.isArray(corpoAtual.informes)
      ? (corpoAtual.informes as Cotacao['informes'])
      : molde.informes,
    ajustes: Array.isArray(corpoAtual.ajustes) ? (corpoAtual.ajustes as Cotacao['ajustes']) : [],
    enviadas: Array.isArray(corpoAtual.enviadas) ? (corpoAtual.enviadas as Cotacao['enviadas']) : [],
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
