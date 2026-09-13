/* ==========================================================================
   A faxina do texto rico da observação.

   A observação virou HTML para ganhar o marca-texto da v3.375, e HTML que
   vem de fora é HTML de estranho: um .ft pode ter sido editado à mão, ter
   passado por outro sistema, ou ter vindo por e-mail. Tudo o que não for
   cor, marca-texto e quebra de linha sai na porta.

   A lista é curta de propósito. O que a barra de seleção sabe escrever é
   exatamente isto, então tudo o que não está aqui não foi escrito pelo
   editor, e não tem por que entrar.
   ========================================================================== */

const TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'FONT', 'BR', 'DIV', 'P'])

/* só cor e fundo. Tamanho, fonte e posição viriam coladas do Word e fariam a
   observação de um layout ter corpo diferente da do layout ao lado. */
const ESTILOS = ['color', 'background-color']

/* uma cor de CSS e nada mais: sem url(), sem expressão, sem ponto e vírgula
   solto para emendar outra coisa */
const COR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|[a-z]+)$/i

function limpaEstilo(el: HTMLElement) {
  const guardado: string[] = []
  for (const nome of ESTILOS) {
    const v = el.style.getPropertyValue(nome).trim()
    if (v && COR.test(v)) guardado.push(nome + ':' + v)
  }
  for (const a of [...el.attributes]) el.removeAttribute(a.name)
  if (guardado.length) el.setAttribute('style', guardado.join(';'))
}

export function sanitizarTextoRico(html: string): string {
  if (!html || typeof html !== 'string') return ''
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html')
  const raiz = doc.body.firstElementChild
  if (!raiz) return ''

  const andar = (pai: Element) => {
    for (const filho of [...pai.children]) {
      andar(filho)
      if (!TAGS.has(filho.tagName)) {
        /* a etiqueta sai, o texto dela fica: apagar junto seria perder o que
           a pessoa escreveu por causa de uma marcação que ela nem viu */
        filho.replaceWith(...filho.childNodes)
        continue
      }
      if (filho instanceof HTMLElement) limpaEstilo(filho)
    }
  }
  andar(raiz)
  return raiz.innerHTML
}
