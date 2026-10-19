// ===========================================================================
// O PEDIDO PAGO VIRA CARTÃO NO TRELLO (19/10/2026, pedido do Henrique)
//
// "Uma automação que leva um cartão para o Trello cada vez que um pedido do
// Shopify é pago, limitado a alguns produtos, com etiquetas automáticas,
// algumas informações e o PDF do pedido. Não esqueça do campo de observação:
// nas peças personalizadas ali vem o nome e o número das camisas."
//
// O Trello é o quadro da fábrica enquanto o kanban do Fourtime OS não está
// pronto. Por isso este arquivo separa as três partes: LER o aviso da
// Shopify (pedidoDoAviso), MONTAR o cartão e o PDF (cartaoDoPedido,
// pdfDoPedido) e ENTREGAR no Trello (no index.ts). No dia do kanban, só a
// entrega muda.
//
// O que é do comprador (nome, endereço, telefone, documento) vai para o
// Trello, que é onde a fábrica trabalha hoje, e NUNCA para o banco do
// Fourtime OS: o banco guarda só que o pedido virou cartão.
//
// Sem nada de Deno nem de rede aqui dentro: o teste roda no node
// (testes/trello.mjs), e a biblioteca do PDF chega por parâmetro.
// ===========================================================================

type Solto = Record<string, unknown>

const txt = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const lst = (v: unknown): Solto[] => (Array.isArray(v) ? (v as Solto[]) : [])
const obj = (v: unknown): Solto => (v && typeof v === 'object' ? (v as Solto) : {})

// ---------- 1. o pedido, lido do aviso --------------------------------------

export type Propriedade = { nome: string; valor: string }

export type ItemDoPedido = {
  produtoId: string
  /** o nome do produto, sem o tamanho */
  produto: string
  /** o tamanho (a variante) */
  tamanho: string
  quantidade: number
  preco: number
  /** Nome, Número, Pré-venda...: o que o cliente escreveu na página do produto */
  propriedades: Propriedade[]
  /** endereço da foto, quando a função achou (a vitrine da loja) */
  imagem?: string
}

export type PedidoDoTrello = {
  id: string
  /** "1098" */
  numero: string
  criadoEm: string
  pagoEm: string
  email: string
  telefone: string
  cliente: string
  documento: string
  /** o campo de observação do pedido na Shopify */
  observacao: string
  /** os campos extras do carrinho (note_attributes) */
  extras: Propriedade[]
  entrega: { metodo: string; valor: number; endereco: string[]; telefone: string }
  itens: ItemDoPedido[]
  subtotal: number
  desconto: number
  cupons: string[]
  total: number
}

const propriedades = (v: unknown): Propriedade[] =>
  lst(v)
    .map((p) => ({ nome: txt(p.name ?? p.key).trim(), valor: txt(p.value).trim() }))
    /* propriedade que começa com _ é do tema, escondida do cliente */
    .filter((p) => p.nome && p.valor && !p.nome.startsWith('_'))

/** O aviso da Shopify (orders/paid), do jeito que chega, vira o pedido. */
export function pedidoDoAviso(aviso: Solto): PedidoDoTrello {
  const cli = obj(aviso.customer)
  const ent = obj(aviso.shipping_address)
  const cob = obj(aviso.billing_address)
  const nomeDoCliente =
    [txt(cli.first_name), txt(cli.last_name)].join(' ').trim() || txt(ent.name) || txt(cob.name) || txt(aviso.email)
  const linhasDoEndereco = [
    txt(ent.name),
    txt(ent.company),
    txt(ent.address1),
    txt(ent.address2),
    [txt(ent.zip), txt(ent.city), txt(ent.province_code)].filter(Boolean).join(' '),
  ].filter((l) => l.trim())
  const frete = lst(aviso.shipping_lines)
  /* o CPF ou CNPJ: a Shopify do Brasil põe no endereço de cobrança (campo
     "company" em lojas antigas) ou nas extensões; vale o primeiro que vier */
  const documento =
    txt(obj(aviso.billing_address).cpf) ||
    lst(aviso.note_attributes).map((p) => ({ n: txt(p.name).toLowerCase(), v: txt(p.value) })).find((p) => /cpf|cnpj/.test(p.n))?.v ||
    ''
  return {
    id: txt(aviso.id),
    numero: txt(aviso.order_number) || txt(aviso.name).replace(/^#/, ''),
    criadoEm: txt(aviso.created_at),
    pagoEm: txt(aviso.processed_at) || txt(aviso.created_at),
    email: txt(aviso.email) || txt(cli.email),
    telefone: txt(aviso.phone) || txt(cli.phone) || txt(ent.phone),
    cliente: nomeDoCliente,
    documento: documento.trim(),
    observacao: txt(aviso.note).trim(),
    extras: propriedades(aviso.note_attributes).filter((p) => !/cpf|cnpj/i.test(p.nome)),
    entrega: {
      metodo: frete.map((f) => txt(f.title)).filter(Boolean).join(', '),
      valor: frete.reduce((s, f) => s + num(f.price), 0),
      endereco: linhasDoEndereco,
      telefone: txt(ent.phone),
    },
    itens: lst(aviso.line_items).map((l) => ({
      produtoId: txt(l.product_id),
      produto: txt(l.title),
      tamanho: txt(l.variant_title),
      quantidade: num(l.quantity) || 1,
      preco: num(l.price),
      propriedades: propriedades(l.properties),
    })),
    subtotal: num(aviso.subtotal_price),
    desconto: num(aviso.total_discounts),
    cupons: lst(aviso.discount_codes).map((d) => txt(d.code)).filter(Boolean),
    total: num(aviso.total_price),
  }
}

// ---------- 2. a regra: que pedido vai, para onde, com que etiquetas ---------

export type RegraDoTrello = {
  /** "Goiás Vôlei 2026/2027": o nome da regra, que vai no título */
  nome: string
  /** o pedaço do título do cartão, como a fábrica escreve: "GOIAS VOLEI 26 27" */
  titulo: string
  /** o item entra se o produto estiver numa destas coleções (handle) */
  colecoes: string[]
  /** etiquetas que vão sempre, pelo nome que está no quadro */
  etiquetas: string[]
  /** etiquetas que vão só quando: o pedido tem peça personalizada, ou está em pré-venda */
  sePersonalizado?: string[]
  sePreVenda?: string[]
}

/** As propriedades de personalização, pelo nome que o tema usa. */
const ehNome = (p: Propriedade) => /^nome\b/i.test(p.nome)
const ehNumero = (p: Propriedade) => /^n[uú]mero\b/i.test(p.nome)
const ehPreVenda = (p: Propriedade) => /pr[eé].?venda/i.test(p.nome)

export function personalizacao(i: ItemDoPedido): { nome: string; numero: string } | null {
  const nome = i.propriedades.find(ehNome)?.valor ?? ''
  const numero = i.propriedades.find(ehNumero)?.valor ?? ''
  return nome || numero ? { nome, numero } : null
}

export function preVenda(p: PedidoDoTrello): string {
  for (const i of p.itens) {
    const v = i.propriedades.find(ehPreVenda)?.valor
    if (v) return v
  }
  return ''
}

const MESES = ['janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
/** "Envio a partir de 15 de outubro de 2026" vira "2026-10-15". */
export function dataDaPreVenda(frase: string): string {
  const m = /(\d{1,2})\s+de\s+([a-zçã]+)\s+de\s+(\d{4})/i.exec(frase)
  if (!m) return ''
  let mes = MESES.indexOf(m[2].toLowerCase())
  if (mes < 0) return ''
  if (mes >= 3) mes -= 1 /* "março" e "marco" ocupam duas casas */
  return `${m[3]}-${String(mes + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// ---------- 3. o cartão --------------------------------------------------------

export type Cartao = {
  nome: string
  descricao: string
  etiquetas: string[]
  /** a data de entrega do cartão (aaaa-mm-dd), a do envio da pré-venda */
  prazo: string
  /** uma linha por peça a fazer, para a fábrica ir marcando */
  checklist: string[]
  nomeDoPdf: string
}

const reais = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** "Camiseta Oficial Saneago Goiás Vôlei 2026/2027 Verde Personalizado" vira
    "Verde Personalizado": o que muda de uma peça para outra do mesmo pedido. */
export function nomeCurto(produto: string): string {
  const m = /\d{4}\/\d{4}\s+(.+)$/.exec(produto) ?? /V[oô]lei\s+(.+)$/i.exec(produto)
  return (m ? m[1] : produto).trim()
}

const dataBr = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
  return p.replace(',', ' às')
}

export function cartaoDoPedido(p: PedidoDoTrello, r: RegraDoTrello, linkDoPedido: string): Cartao {
  const pv = preVenda(p)
  const personalizado = p.itens.some((i) => personalizacao(i))
  const etiquetas = [...r.etiquetas, ...(personalizado ? r.sePersonalizado ?? [] : []), ...(pv ? r.sePreVenda ?? [] : [])]
  const pecas = p.itens.reduce((s, i) => s + i.quantidade, 0)
  const nome = `PEDIDO ${p.numero} SITE ${r.titulo} · ${semAcento(p.cliente).toUpperCase()}`

  /* a checklist: uma linha por peça (quantidade 2 vira duas linhas) */
  const checklist: string[] = []
  for (const i of p.itens) {
    const per = personalizacao(i)
    for (let k = 0; k < i.quantidade; k++)
      checklist.push([i.tamanho, nomeCurto(i.produto), per ? [per.nome, per.numero].filter(Boolean).join(' ') : ''].filter(Boolean).join(' · '))
  }

  const linhasDasPecas = p.itens.map((i) => {
    const per = personalizacao(i)
    const outras = i.propriedades.filter((x) => !ehNome(x) && !ehNumero(x) && !ehPreVenda(x))
    return [
      `- **${i.quantidade}× ${i.tamanho}** · ${nomeCurto(i.produto)}`,
      per ? `  - Nome: **${per.nome || '(sem nome)'}** · Número: **${per.numero || '(sem número)'}**` : '',
      ...outras.map((x) => `  - ${x.nome}: ${x.valor}`),
    ]
      .filter(Boolean)
      .join('\n')
  })

  const descricao = [
    `**Pedido #${p.numero}** · pago em ${dataBr(p.pagoEm)} · ${pecas} ${pecas === 1 ? 'peça' : 'peças'}`,
    pv ? `**Pré-venda:** ${pv}` : '',
    '',
    '### Peças',
    ...linhasDasPecas,
    '',
    '### Observação do cliente',
    p.observacao ? p.observacao.split('\n').map((l) => '> ' + l).join('\n') : '_Sem observação._',
    ...(p.extras.length ? ['', ...p.extras.map((x) => `- ${x.nome}: ${x.valor}`)] : []),
    '',
    '### Entrega',
    `**${p.entrega.metodo || 'Sem frete'}**`,
    ...p.entrega.endereco,
    p.entrega.telefone || p.telefone ? `Telefone: ${p.entrega.telefone || p.telefone}` : '',
    '',
    '### Cliente',
    p.cliente,
    [p.email, p.telefone].filter(Boolean).join(' · '),
    p.documento ? `CPF/CNPJ: ${p.documento}` : '',
    '',
    `[Abrir o pedido na Shopify](${linkDoPedido})`,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')

  return {
    nome,
    descricao,
    etiquetas,
    prazo: dataDaPreVenda(pv),
    checklist,
    nomeDoPdf: `PEDIDO ${p.numero} SITE ${r.titulo}.pdf`,
  }
}

// ---------- 4. o PDF -------------------------------------------------------------

/* O que o PDF usa da pdf-lib. Chega por parâmetro: no Deno vem de
   npm:pdf-lib, no teste do node vem do node_modules. */
type Lib = {
  PDFDocument: { create(): Promise<Doc> }
  StandardFonts: { Helvetica: string; HelveticaBold: string }
  rgb(r: number, g: number, b: number): unknown
}
type Fonte = { widthOfTextAtSize(t: string, s: number): number }
type Imagem = { width: number; height: number }
type Pagina = {
  getSize(): { width: number; height: number }
  drawText(t: string, o: Solto): void
  drawRectangle(o: Solto): void
  drawLine(o: Solto): void
  drawImage(i: Imagem, o: Solto): void
}
type Doc = {
  embedFont(n: string): Promise<Fonte>
  embedJpg(b: Uint8Array): Promise<Imagem>
  embedPng(b: Uint8Array): Promise<Imagem>
  addPage(t: [number, number]): Pagina
  setTitle(t: string): void
  setAuthor(t: string): void
  save(): Promise<Uint8Array>
}

/* A fonte padrão do PDF (Helvetica) só escreve o alfabeto do Windows
   (WinAnsi). O resto (emoji, aspas curvas de outros sistemas) vira algo que
   ela sabe, ou some: nada derruba o PDF. */
function seguro(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x0A\x20-\x7E\xA0-\xFF×·]/g, '')
}

export async function pdfDoPedido(
  p: PedidoDoTrello,
  r: RegraDoTrello,
  lib: Lib,
  opcoes: { link: string; geradoEm?: Date; imagens?: Record<string, Uint8Array> } = { link: '' },
): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create()
  doc.setTitle(`Pedido ${p.numero} - ${r.nome}`)
  doc.setAuthor('Fourtime OS')
  const normal = await doc.embedFont(lib.StandardFonts.Helvetica)
  const negrito = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const PRETO = lib.rgb(0.1, 0.11, 0.14)
  const CINZA = lib.rgb(0.36, 0.39, 0.44)
  const CLARO = lib.rgb(0.55, 0.57, 0.62)
  const LINHA = lib.rgb(0.85, 0.86, 0.89)
  const FUNDO = lib.rgb(0.95, 0.96, 0.97)
  const VERMELHO = lib.rgb(0.78, 0.09, 0.11)
  const AMARELO = lib.rgb(1, 0.96, 0.8)
  const AMARELO_BORDA = lib.rgb(0.85, 0.66, 0.1)

  const A4: [number, number] = [595.28, 841.89]
  const M = 40
  let pg = doc.addPage(A4)
  const L = A4[0] - 2 * M
  let y = A4[1] - M

  const escrever = (t: string, x: number, yy: number, tam: number, f: Fonte = normal, cor: unknown = PRETO) =>
    pg.drawText(seguro(t), { x, y: yy, size: tam, font: f, color: cor })
  const quebrar = (t: string, larg: number, tam: number, f: Fonte = normal): string[] => {
    const saida: string[] = []
    for (const par of seguro(t).split('\n')) {
      let linha = ''
      for (const palavra of par.split(/\s+/)) {
        const tenta = linha ? linha + ' ' + palavra : palavra
        if (f.widthOfTextAtSize(tenta, tam) <= larg) linha = tenta
        else {
          if (linha) saida.push(linha)
          linha = palavra
        }
      }
      saida.push(linha)
    }
    return saida
  }
  const garantir = (alt: number) => {
    if (y - alt < M + 24) {
      rodape()
      pg = doc.addPage(A4)
      y = A4[1] - M
    }
  }
  let pagina = 1
  const rodape = () => {
    escrever(`Pedido #${p.numero} · ${r.nome} · página ${pagina}`, M, M - 14, 7.5, normal, CLARO)
    const g = `Gerado pelo Fourtime OS em ${dataBr((opcoes.geradoEm ?? new Date()).toISOString())}`
    escrever(g, A4[0] - M - normal.widthOfTextAtSize(seguro(g), 7.5), M - 14, 7.5, normal, CLARO)
    pagina++
  }
  const titulo = (t: string) => {
    garantir(30)
    y -= 6
    escrever(t.toUpperCase(), M, y - 9, 8, negrito, CINZA)
    pg.drawLine({ start: { x: M + negrito.widthOfTextAtSize(t.toUpperCase(), 8) + 8, y: y - 6 }, end: { x: M + L, y: y - 6 }, thickness: 0.6, color: LINHA })
    y -= 20
  }

  // --- o topo: número, quando, a regra -----------------------------------------
  const pv = preVenda(p)
  const pecas = p.itens.reduce((s, i) => s + i.quantidade, 0)
  escrever('PEDIDO', M, y - 9, 8, negrito, CINZA)
  escrever(`#${p.numero}`, M, y - 38, 30, negrito)
  const dir = (t: string, yy: number, tam: number, f: Fonte = normal, cor: unknown = PRETO) =>
    escrever(t, M + L - f.widthOfTextAtSize(seguro(t), tam), yy, tam, f, cor)
  dir(r.nome.toUpperCase(), y - 9, 8, negrito, VERMELHO)
  dir(`Pago em ${dataBr(p.pagoEm)}`, y - 24, 10, normal, CINZA)
  dir(`${pecas} ${pecas === 1 ? 'peça' : 'peças'} · loja virtual`, y - 38, 10, normal, CINZA)
  y -= 52
  if (pv) {
    pg.drawRectangle({ x: M, y: y - 20, width: L, height: 20, color: FUNDO })
    escrever('PRÉ-VENDA', M + 8, y - 13.5, 8, negrito, VERMELHO)
    escrever(pv, M + 8 + negrito.widthOfTextAtSize('PRÉ-VENDA', 8) + 10, y - 13.5, 9.5, normal)
    y -= 28
  }

  // --- a observação do cliente: onde vem nome e número ---------------------------
  titulo('Observação do cliente')
  {
    const linhas = p.observacao ? quebrar(p.observacao, L - 20, 11, negrito) : ['Sem observação.']
    const alt = linhas.length * 14 + 14
    garantir(alt)
    pg.drawRectangle({ x: M, y: y - alt, width: L, height: alt, color: p.observacao ? AMARELO : FUNDO, borderColor: p.observacao ? AMARELO_BORDA : LINHA, borderWidth: 0.8 })
    linhas.forEach((l, k) => escrever(l, M + 10, y - 17 - k * 14, 11, p.observacao ? negrito : normal, p.observacao ? PRETO : CLARO))
    y -= alt + 4
    for (const x of p.extras) {
      garantir(14)
      escrever(`${x.nome}: ${x.valor}`, M, y - 10, 9.5, normal, CINZA)
      y -= 14
    }
  }

  // --- as peças -----------------------------------------------------------------
  titulo('Peças para produzir')
  for (const i of p.itens) {
    const per = personalizacao(i)
    const outras = i.propriedades.filter((x) => !ehNome(x) && !ehNumero(x) && !ehPreVenda(x))
    const alt = Math.max(72, 30 + (per ? 26 : 0) + outras.length * 13)
    garantir(alt + 8)
    pg.drawRectangle({ x: M, y: y - alt, width: L, height: alt, borderColor: LINHA, borderWidth: 0.8 })
    const foto = opcoes.imagens?.[i.produtoId]
    let xTexto = M + 12
    if (foto) {
      try {
        const ehPng = foto[0] === 0x89 && foto[1] === 0x50
        const img = ehPng ? await doc.embedPng(foto) : await doc.embedJpg(foto)
        const lado = alt - 16
        const esc = Math.min(lado / img.width, lado / img.height)
        pg.drawImage(img, { x: M + 8 + (lado - img.width * esc) / 2, y: y - 8 - lado + (lado - img.height * esc) / 2, width: img.width * esc, height: img.height * esc })
        xTexto = M + 8 + lado + 12
      } catch {
        /* foto que não abre: a linha sai sem ela */
      }
    }
    // tamanho e quantidade, grandes, à direita
    const tam = i.tamanho || '-'
    const wTam = negrito.widthOfTextAtSize(seguro(tam), 22)
    escrever(tam, M + L - 14 - wTam, y - 32, 22, negrito)
    const q = `${i.quantidade}×`
    escrever(q, M + L - 14 - wTam - 10 - negrito.widthOfTextAtSize(q, 14), y - 30, 14, negrito, CINZA)
    const larg = M + L - 14 - wTam - 50 - xTexto
    escrever(quebrar(nomeCurto(i.produto), larg, 12, negrito)[0] ?? '', xTexto, y - 20, 12, negrito)
    escrever(quebrar(i.produto, larg, 8.5)[0] ?? '', xTexto, y - 33, 8.5, normal, CLARO)
    let yy = y - 33
    if (per) {
      yy -= 22
      escrever('NOME', xTexto, yy + 1, 7.5, negrito, CINZA)
      escrever(per.nome || '(sem nome)', xTexto + 30, yy, 14, negrito, VERMELHO)
      const xn = xTexto + 30 + negrito.widthOfTextAtSize(seguro(per.nome || '(sem nome)'), 14) + 18
      escrever('NÚMERO', xn, yy + 1, 7.5, negrito, CINZA)
      escrever(per.numero || '-', xn + 42, yy, 14, negrito, VERMELHO)
    }
    for (const x of outras) {
      yy -= 13
      escrever(`${x.nome}: ${x.valor}`, xTexto, yy, 9, normal, CINZA)
    }
    escrever(reais(i.preco) + (i.quantidade > 1 ? ` cada` : ''), M + L - 14 - normal.widthOfTextAtSize(reais(i.preco) + (i.quantidade > 1 ? ' cada' : ''), 8.5), y - alt + 10, 8.5, normal, CLARO)
    y -= alt + 8
  }

  // --- a conta de tamanhos (para cortar de uma vez) -------------------------------
  {
    const porTam = new Map<string, number>()
    for (const i of p.itens) porTam.set(i.tamanho || '-', (porTam.get(i.tamanho || '-') ?? 0) + i.quantidade)
    const frase = [...porTam].map(([t, n]) => `${t}: ${n}`).join('   ')
    garantir(16)
    escrever('Por tamanho', M, y - 8, 8, negrito, CINZA)
    escrever(frase, M + 62, y - 8, 9.5, negrito)
    y -= 22
  }

  // --- entrega e cliente, lado a lado ----------------------------------------------
  titulo('Entrega e cliente')
  {
    const metade = (L - 16) / 2
    const ent = [p.entrega.metodo || 'Sem frete', ...p.entrega.endereco, p.entrega.telefone ? 'Tel. ' + p.entrega.telefone : '']
      .filter(Boolean)
      .flatMap((l) => quebrar(l, metade - 16, 9.5))
    const cli = [p.cliente, p.email, p.telefone ? 'Tel. ' + p.telefone : '', p.documento ? 'CPF/CNPJ ' + p.documento : '']
      .filter(Boolean)
      .flatMap((l) => quebrar(l, metade - 16, 9.5))
    const alt = Math.max(ent.length, cli.length) * 13 + 30
    garantir(alt)
    for (const [k, [rot, linhas]] of ([['ENTREGA', ent], ['CLIENTE', cli]] as [string, string[]][]).entries()) {
      const x = M + k * (metade + 16)
      pg.drawRectangle({ x, y: y - alt, width: metade, height: alt, color: FUNDO })
      escrever(rot, x + 8, y - 14, 7.5, negrito, CINZA)
      linhas.forEach((l, n) => escrever(l, x + 8, y - 30 - n * 13, 9.5, n === 0 ? negrito : normal))
    }
    y -= alt + 6
  }

  // --- os valores -------------------------------------------------------------------
  titulo('Valores')
  {
    const linhas: [string, string][] = [
      ['Peças', reais(p.itens.reduce((s, i) => s + i.preco * i.quantidade, 0))],
      ...(p.desconto ? [[`Desconto${p.cupons.length ? ' (' + p.cupons.join(', ') + ')' : ''}`, '- ' + reais(p.desconto)] as [string, string]] : []),
      ['Frete', reais(p.entrega.valor)],
      ['Total pago', reais(p.total)],
    ]
    garantir(linhas.length * 14 + 6)
    linhas.forEach(([a, b], k) => {
      const f = k === linhas.length - 1 ? negrito : normal
      escrever(a, M, y - 10 - k * 14, 9.5, f, k === linhas.length - 1 ? PRETO : CINZA)
      escrever(b, M + 260 - f.widthOfTextAtSize(seguro(b), 9.5), y - 10 - k * 14, 9.5, f)
    })
    y -= linhas.length * 14 + 6
  }
  if (opcoes.link) {
    garantir(16)
    escrever('Pedido na Shopify: ' + opcoes.link, M, y - 10, 8, normal, CLARO)
    y -= 16
  }
  rodape()
  return await doc.save()
}
