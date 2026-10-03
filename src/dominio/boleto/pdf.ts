import { lerTextoDoBoleto, type BoletoLido } from './texto'

/* ==========================================================================
   O PDF do boleto.

   O ARQUIVO NÃO SAI DO NAVEGADOR. Ele é aberto aqui, o texto é lido aqui, e
   o que sobra na memória quando a pessoa sai da tela é nada. Nenhum pedaço
   dele vai para o banco da Fourtime nem para servidor nenhum: o registro da
   conferência guarda o que estava escrito, e o nome do arquivo.

   O LEITOR É O pdf.js, o mesmo que o Firefox usa para abrir PDF. Ele pesa
   mais de um megabyte, então só é baixado no momento em que alguém solta um
   arquivo: quem só cola a linha digitável nunca paga por ele.

   LER O TEXTO NÃO É ENTENDER O BOLETO. Cada banco desenha a ficha de um
   jeito, e o PDF não diz "isto é o beneficiário": ele diz "este texto está
   nesta posição". O que dá para tirar com certeza é a linha digitável (os
   dígitos de controle provam) e os CNPJs (a conta do CNPJ prova). O nome do
   beneficiário é um palpite a partir de onde o CNPJ dele está escrito, e por
   isso a tela mostra o nome que a Receita dá para aquele CNPJ logo ao lado.

   PDF QUE É FOTO NÃO TEM TEXTO. Boleto escaneado ou fotografado vira uma
   imagem dentro do PDF, e aí não há o que ler: a função avisa, e a pessoa
   cola a linha digitável.
   ========================================================================== */

type ItemDeTexto = { str?: string; transform?: number[] }

/* AS LINHAS SÃO REMONTADAS PELA POSIÇÃO. O pdf.js devolve pedaços de texto
   soltos, cada um com o seu lugar na página, e não na ordem de leitura. Aqui
   eles são agrupados por altura (dois pontos de tolerância) e ordenados da
   esquerda para a direita, que é como o olho lê a ficha. */
function linhasDaPagina(itens: ItemDeTexto[]): string[] {
  const pedacos = itens
    .filter((i) => i.str && i.str.trim() && i.transform)
    .map((i) => ({ texto: i.str as string, x: (i.transform as number[])[4], y: (i.transform as number[])[5] }))
  pedacos.sort((a, b) => b.y - a.y || a.x - b.x)
  const linhas: { y: number; partes: { x: number; texto: string }[] }[] = []
  for (const p of pedacos) {
    const dona = linhas.find((l) => Math.abs(l.y - p.y) <= 2.5)
    if (dona) dona.partes.push(p)
    else linhas.push({ y: p.y, partes: [p] })
  }
  return linhas.map((l) =>
    l.partes
      .sort((a, b) => a.x - b.x)
      .map((p) => p.texto)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export async function lerPdfDoBoleto(arquivo: File): Promise<BoletoLido> {
  if (arquivo.size > 15 * 1024 * 1024) {
    throw new Error('O arquivo passa de 15 MB. Um boleto não chega perto disso: confira se é o arquivo certo.')
  }
  let texto = ''
  try {
    /* a versão "legacy" do pdf.js roda em navegador mais velho, que é o caso
       de mais de um computador da fábrica */
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const operario = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = operario.default
    const dados = new Uint8Array(await arquivo.arrayBuffer())
    const documento = await pdfjs.getDocument({ data: dados }).promise
    const linhas: string[] = []
    /* boleto é uma página, às vezes duas com o recibo. Seis é folga. */
    const paginas = Math.min(documento.numPages, 6)
    for (let n = 1; n <= paginas; n++) {
      const pagina = await documento.getPage(n)
      const conteudo = await pagina.getTextContent()
      linhas.push(...linhasDaPagina(conteudo.items as ItemDeTexto[]))
    }
    await documento.destroy()
    texto = linhas.join('\n')
  } catch (e) {
    const recado = e instanceof Error ? e.message : ''
    if (/password/i.test(recado)) {
      throw new Error('Este PDF tem senha. Abra, salve sem senha e solte de novo, ou cole a linha digitável.')
    }
    throw new Error('Não consegui abrir este PDF. Cole a linha digitável no campo de baixo.')
  }
  if (texto.replace(/\s/g, '').length < 40) {
    throw new Error(
      'Este PDF é uma imagem, sem texto para ler. Cole a linha digitável no campo de baixo.',
    )
  }
  return lerTextoDoBoleto(texto, arquivo.name)
}
