import { useEffect, useRef } from 'react'

/* ==========================================================================
   A área de texto rico e a barra de seleção: o MARCA-TEXTO da v3.375.

   A observação do layout nunca foi texto cru. Quem escreve ali escreve para
   a mesa de corte, e pinta de vermelho o que não pode passar batido e de
   amarelo o que o cliente pediu por telefone. Sem isso a observação vira um
   parágrafo cinza que ninguém lê inteiro.

   A barra é UMA só para a página inteira, criada à mão e guardada num
   módulo, do mesmo jeito que a dica de linha em flutuante.tsx. Duas razões:
   ela precisa viver fora de qualquer overflow, e precisa saber da seleção do
   documento, que é global. Um componente por área daria uma barra por
   observação, todas escutando o mesmo evento.

   As sete cores são as da v3.375 e não são decoração: a fábrica já lê
   vermelho como "atenção" e amarelo como "confirmado com o cliente". Elas
   são valores fixos, e não fichas do tema, porque acompanham o texto para
   dentro do arquivo e da folha impressa, onde tema nenhum existe.
   ========================================================================== */

const CORES: [string, string][] = [
  ['#C6161B', 'Vermelho'],
  ['#1F6FEB', 'Azul'],
  ['#0B7A3B', 'Verde'],
  ['#111214', 'Preto'],
  ['#E0218A', 'Pink'],
]

const MARCAS: [string, string][] = [
  ['#FFF27A', 'Marca-texto amarelo'],
  ['#FF9EC7', 'Marca-texto pink'],
]

let barra: HTMLDivElement | null = null
let ligada = false

function comando(nome: string, valor?: string) {
  try {
    /* sem isto o Firefox escreve <font color> em vez de estilo, e a marcação
       não sobrevive à volta pelo arquivo */
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(nome, false, valor)
  } catch {
    /* navegador sem execCommand: a área continua editável, só sem cor */
  }
}

function areaDaSelecao(): HTMLElement | null {
  const sel = document.getSelection()
  if (!sel || !sel.rangeCount || sel.isCollapsed) return null
  let n: Node | null = sel.anchorNode
  if (n && n.nodeType === 3) n = n.parentNode
  return n instanceof Element ? n.closest('.rico') : null
}

function montarBarra() {
  if (barra) return barra
  const d = document.createElement('div')
  d.className = 'selbar'
  d.setAttribute('popover', 'manual')
  const botao = (cor: string, titulo: string, marca: boolean) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.title = titulo
    b.style.background = cor
    if (marca) {
      b.className = 'sb-marca'
      b.textContent = 'A'
      b.dataset.marca = cor
    } else {
      b.dataset.cor = cor
    }
    return b
  }
  CORES.forEach(([c, t]) => d.appendChild(botao(c, t, false)))
  const sep = () => {
    const s = document.createElement('span')
    s.className = 'sb-fio'
    return s
  }
  d.appendChild(sep())
  MARCAS.forEach(([c, t]) => d.appendChild(botao(c, t, true)))
  d.appendChild(sep())
  const limpar = document.createElement('button')
  limpar.type = 'button'
  limpar.className = 'sb-limpar'
  limpar.title = 'Tirar a formatação'
  limpar.dataset.limpar = '1'
  limpar.innerHTML =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 7L7 17M7 7L17 17"/></svg>'
  d.appendChild(limpar)

  /* o mousedown não pode chegar ao documento: ele apagaria a seleção que a
     barra existe para formatar */
  d.addEventListener('mousedown', (e) => e.preventDefault())
  d.addEventListener('click', (e) => {
    const alvo = e.target
    if (!(alvo instanceof HTMLElement)) return
    const bt = alvo.closest('button')
    if (!(bt instanceof HTMLElement)) return
    const area = areaDaSelecao()
    if (bt.dataset.cor) comando('foreColor', bt.dataset.cor)
    else if (bt.dataset.marca) comando('hiliteColor', bt.dataset.marca)
    else if (bt.dataset.limpar) comando('removeFormat')
    /* a área precisa avisar quem guarda o texto: execCommand não dispara
       input em todo navegador */
    area?.dispatchEvent(new Event('input', { bubbles: true }))
  })
  document.body.appendChild(d)
  barra = d
  return d
}

function posicionar() {
  const d = barra
  const sel = document.getSelection()
  if (!d || !sel || !sel.rangeCount) return
  const r = sel.getRangeAt(0).getBoundingClientRect()
  const folga = 6
  const esq = Math.max(
    folga,
    Math.min(r.left + r.width / 2 - d.offsetWidth / 2, innerWidth - d.offsetWidth - folga),
  )
  /* acima da seleção sempre que couber: embaixo ela nasce debaixo do ponteiro */
  const acima = r.top - d.offsetHeight - 8
  d.style.left = Math.round(esq) + 'px'
  d.style.top = Math.round(acima >= folga ? acima : r.bottom + 8) + 'px'
}

function abrir() {
  const d = montarBarra()
  d.classList.add('on')
  try {
    if (!d.matches(':popover-open')) d.showPopover()
  } catch {
    /* navegador sem popover: a classe já resolve */
  }
  requestAnimationFrame(posicionar)
}

function fechar() {
  if (!barra) return
  barra.classList.remove('on')
  try {
    if (barra.matches(':popover-open')) barra.hidePopover()
  } catch {
    /* idem */
  }
}

function ligarUmaVez() {
  if (ligada) return
  ligada = true
  document.addEventListener('selectionchange', () => {
    if (areaDaSelecao()) abrir()
    else fechar()
  })
  addEventListener('scroll', () => barra?.classList.contains('on') && posicionar(), true)
  addEventListener('resize', () => barra?.classList.contains('on') && posicionar())
}

/* A área em si. Ela é contenteditable, então o React não pode redesenhar o
   conteúdo a cada tecla: o cursor pularia para o começo. Quem manda no DOM é
   o navegador, e o valor de fora só entra quando é REALMENTE outro texto,
   que é o caso de desfazer, colar um layout ou abrir um arquivo. */
export function AreaDeTextoRico({
  valor,
  aoMudar,
  convite,
  leitura,
  className = '',
}: {
  valor: string
  aoMudar?: (html: string) => void
  convite?: string
  leitura?: boolean
  className?: string
}) {
  const el = useRef<HTMLDivElement>(null)

  useEffect(ligarUmaVez, [])

  useEffect(() => {
    const d = el.current
    if (d && d.innerHTML !== valor) d.innerHTML = valor
  }, [valor])

  return (
    <div
      ref={el}
      className={['rico', className].filter(Boolean).join(' ')}
      contentEditable={!leitura}
      suppressContentEditableWarning
      role={leitura ? undefined : 'textbox'}
      aria-multiline="true"
      aria-label={convite}
      data-convite={convite}
      spellCheck={false}
      onInput={(e) => aoMudar?.(e.currentTarget.innerHTML)}
      /* colar chega como texto puro: o HTML do Word traria fonte, tamanho e
         tabela inteira para dentro da observação */
      onPaste={(e) => {
        if (leitura) return
        e.preventDefault()
        const t = e.clipboardData.getData('text/plain')
        comando('insertText', t)
        aoMudar?.(e.currentTarget.innerHTML)
      }}
    />
  )
}
