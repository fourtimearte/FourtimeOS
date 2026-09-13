/* ==========================================================================
   A faxina do texto rico da observacao.

   A observacao virou HTML para ganhar o marca-texto da v3.375, e HTML que vem
   de fora e HTML de estranho: um .ft pode ter sido editado a mao, ter passado
   por outro sistema, ou ter vindo por e-mail. Ele e escrito na tela com
   innerHTML, entao tudo o que nao for cor, marca-texto e quebra de linha sai
   na porta.

   ELA NAO USA O NAVEGADOR de proposito. A primeira versao usava DOMParser, e
   com isso a faxina so existia dentro do navegador: fora dele a funcao
   devolvia o texto intacto, que e exatamente o contrario do que ela promete.
   Pior, era o caminho que uma conferencia automatica nunca conseguiria
   testar. Assim, uma leitura so da string, ela vale em qualquer lugar e a
   conferencia pega qualquer regressao.

   A lista e curta de proposito: o que a barra de selecao sabe escrever e
   exatamente isto, entao tudo o que nao esta aqui nao foi escrito pelo
   editor, e nao tem por que entrar.
   ========================================================================== */

const PERMITIDAS = new Set(['b', 'strong', 'i', 'em', 'u', 'span', 'font', 'br', 'div', 'p'])

/* vazias: nao tem conteudo nem fechamento */
const VAZIAS = new Set(['br'])

/* estas levam o conteudo junto quando saem. Deixar o miolo de um <script>
   virar texto solto na observacao seria trocar um risco por uma sujeira. */
const COM_MIOLO = new Set(['script', 'style', 'title', 'textarea', 'iframe', 'object', 'embed'])

/* so cor e fundo. Tamanho, fonte e posicao viriam coladas do Word e fariam a
   observacao de um layout ter corpo diferente da do layout ao lado. */
const ESTILOS = ['color', 'background-color']

/* uma cor de CSS e nada mais: sem url(), sem expressao, sem ponto e virgula
   solto para emendar outra coisa */
const COR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%/]+\)|[a-zA-Z]+)$/

function estiloLimpo(atributos: string): string {
  const m = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(atributos)
  if (!m) return ''
  const bruto = m[2] ?? m[3] ?? ''
  const guardado: string[] = []
  for (const parte of bruto.split(';')) {
    const dois = parte.indexOf(':')
    if (dois < 0) continue
    const nome = parte.slice(0, dois).trim().toLowerCase()
    const valor = parte.slice(dois + 1).trim()
    if (!ESTILOS.includes(nome)) continue
    if (!COR.test(valor)) continue
    guardado.push(nome + ':' + valor)
  }
  return guardado.length ? ' style="' + guardado.join(';') + '"' : ''
}

export function sanitizarTextoRico(html: string): string {
  if (!html || typeof html !== 'string') return ''

  const marcacao = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g
  const abertas: string[] = []
  let saida = ''
  let cursor = 0
  let pularAte = ''
  let m: RegExpExecArray | null

  while ((m = marcacao.exec(html)) !== null) {
    const nome = m[1].toLowerCase()
    const fechando = m[0][1] === '/'

    /* dentro de um <script> ou <style>: nada vale ate o fechamento dele */
    if (pularAte) {
      if (fechando && nome === pularAte) {
        pularAte = ''
        cursor = marcacao.lastIndex
      }
      continue
    }

    saida += html.slice(cursor, m.index)
    cursor = marcacao.lastIndex

    if (COM_MIOLO.has(nome)) {
      if (!fechando) pularAte = nome
      continue
    }
    /* etiqueta de fora: ela sai e o texto dela fica. Apagar junto seria
       perder o que a pessoa escreveu por causa de uma marcacao que ela nem
       viu que estava ali. */
    if (!PERMITIDAS.has(nome)) continue

    if (VAZIAS.has(nome)) {
      saida += '<' + nome + '>'
      continue
    }
    if (fechando) {
      const i = abertas.lastIndexOf(nome)
      if (i < 0) continue /* fechamento sem abertura: nao existe, some */
      /* fecha na ordem o que ficou aberto no meio, senao a saida sai torta */
      while (abertas.length > i) saida += '</' + abertas.pop() + '>'
      continue
    }
    abertas.push(nome)
    saida += '<' + nome + estiloLimpo(m[2] || '') + '>'
  }

  if (!pularAte) saida += html.slice(cursor)
  /* o que ficou aberto fecha aqui: HTML torto entrando nao pode virar HTML
     torto saindo, ou a observacao de um layout engole a do layout seguinte */
  while (abertas.length) saida += '</' + abertas.pop() + '>'
  return saida
}
