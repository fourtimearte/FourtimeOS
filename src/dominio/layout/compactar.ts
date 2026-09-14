/* ==========================================================================
   A COMPRESSÃO VERTICAL, portada do editor v3.375.

   A REGRA É DOIS LAYOUTS POR FOLHA, SEMPRE. Duas artes deitadas, duas em pé,
   uma de cada: não importa a combinação, saem dois. Essa é a promessa que o
   vendedor decora e que a fábrica usa para achar a peça sem contar folha.

   Só que dois layouts nem sempre CABEM em 297 mm. A v3.375 resolveu isso há
   anos, e não com medição: com compressão. Quando falta espaço, o documento
   aperta até caber, e a ordem de quem cede é uma regra de leitura, não de
   código:

     1. A IMAGEM CEDE PRIMEIRO. Ela tem de sobra: uma arte 8% menor continua
        sendo arte de conferir estampa.
     2. A TABELA SÓ DEPOIS, e é recurso de emergência. Ela tem sete níveis de
        densidade, do padrão ao mínimo, e desce um degrau de cada vez.
     3. OS DOIS SE ALTERNAM. A cada passo a imagem tenta; se encolher a imagem
        não diminuiu a folha, é porque quem manda na altura é a ficha, e aí a
        tabela desce um nível.
     4. NO FIM, DEVOLVE O QUE CEDEU A MAIS. A tabela sobe primeiro, porque
        estar comprimida é emergência; a imagem reocupa o que ainda sobrar.

   O passo 4 não é capricho. Sem ele a folha terminava com a tabela no nível
   mínimo e espaço vazio embaixo, que é exatamente o defeito de "está apertado
   e sobrando espaço ao mesmo tempo".

   E SEM VALOR A TABELA VAI PARA O LADO. Isso não é feito aqui: é o
   `.mod-ficha.sem-valor`, que vira uma grade de duas colunas com a tabela à
   esquerda e os cartões à direita. Sem as duas colunas de dinheiro a tabela
   fica estreita e sobra largura, então usar a largura devolve altura, que é o
   que o papel precisa. A compressão daqui entra depois disso, se ainda faltar.
   ========================================================================== */

/* Os sete níveis. A fonte é um FATOR do corpo da tabela, e não um px fixo:
   assim a compressão não atropela quem um dia mexer no tamanho base. Os
   fatores são os px da v3.375 divididos pelos 11px do padrão. */
export const NIVEIS_DA_TABELA = [
  { p: '1.2mm', f: 1.045, lh: '1.4' } /* padrão */,
  { p: '1mm', f: 1.045, lh: '1.35' },
  { p: '0.85mm', f: 1.0, lh: '1.3' },
  { p: '0.7mm', f: 1.0, lh: '1.25' },
  { p: '0.55mm', f: 0.955, lh: '1.2' },
  { p: '0.45mm', f: 0.909, lh: '1.15' },
  { p: '0.35mm', f: 0.864, lh: '1.1' } /* mínimo */,
]

/** px por passo ao ceder espaço. Menor que isso é lento sem ser mais exato */
const IMG_PASSO = 4
/** piso da imagem: abaixo disso ela não serve para conferir estampa nenhuma */
const IMG_PISO = 90
/** a folga que se aceita: meio pixel é arredondamento, e não estouro */
const FOLGA = 0.5

function aplicarNivel(tabelas: HTMLElement[], n: number) {
  const v = NIVEIS_DA_TABELA[n]
  for (const t of tabelas) {
    t.style.setProperty('--tp', v.p)
    t.style.setProperty('--tf', 'calc(11px * ' + v.f + ')')
    t.style.setProperty('--tlh', v.lh)
    t.dataset.nivel = String(n)
  }
}

/** quanto o conteúdo passa do corpo da folha. Maior que zero é estouro. */
function excede(corpo: HTMLElement) {
  return corpo.scrollHeight - corpo.clientHeight
}

/** Encolhe as imagens um passo. Devolve o estado anterior, ou null se nenhuma
    pôde encolher porque já estão todas no piso. */
function cederImagens(imgs: HTMLImageElement[]) {
  const antes = imgs.map((im) => im.style.maxHeight)
  let mexeu = false
  for (const im of imgs) {
    const h = im.getBoundingClientRect().height
    if (h - IMG_PASSO > IMG_PISO) {
      im.style.maxHeight = h - IMG_PASSO + 'px'
      mexeu = true
    }
  }
  return mexeu ? antes : null
}

function desfazerImagens(imgs: HTMLImageElement[], antes: string[]) {
  imgs.forEach((im, i) => {
    im.style.maxHeight = antes[i]
  })
}

/**
 * Aperta UMA folha até os layouts dela caberem.
 *
 * Roda em toda folha, sempre, e não só nas que estouram: a folha que já cabe
 * precisa do estado limpo para não ficar presa a uma compressão de antes.
 * Apagar um layout, tirar um tecido ou trocar para sem valor libera altura, e
 * sem a limpeza a tabela continuaria espremida numa folha que agora sobra.
 */
export function compactarFolha(folha: HTMLElement) {
  const corpo = folha.querySelector('.fl-corpo')
  if (!(corpo instanceof HTMLElement)) return
  const tabelas = [...folha.querySelectorAll('.mod-tabela')].filter(
    (e): e is HTMLElement => e instanceof HTMLElement,
  )
  const imgs = [...folha.querySelectorAll('.img-area.tem img')].filter(
    (e): e is HTMLImageElement => e instanceof HTMLImageElement,
  )
  if (!tabelas.length && !imgs.length) return

  /* 1. estado limpo: tabela no padrão, imagem sem teto forçado */
  if (tabelas.length) aplicarNivel(tabelas, 0)
  for (const im of imgs) im.style.maxHeight = ''
  if (excede(corpo) <= FOLGA) return

  /* 2. falta espaço: a imagem cede, a tabela só se a imagem não resolver */
  let nivel = 0
  let guarda = 0
  while (excede(corpo) > FOLGA && guarda++ < 400) {
    const antes = excede(corpo)
    const estado = cederImagens(imgs)
    if (estado) {
      if (excede(corpo) < antes - 0.25) continue /* a imagem resolveu: segue */
      desfazerImagens(imgs, estado) /* não resolveu: quem dita é a ficha */
    }
    if (nivel < NIVEIS_DA_TABELA.length - 1) {
      aplicarNivel(tabelas, ++nivel)
      continue
    }
    break /* tabela no mínimo e imagem no piso */
  }

  /* 3. tabela no mínimo e ainda não coube: a imagem cede o resto, mas SÓ
     ENQUANTO ADIANTAR. Sem esta checagem, quando quem estoura é a ficha, o
     laço espreme a imagem até o piso sem resolver nada e a arte vira selo. */
  let g2 = 0
  while (excede(corpo) > FOLGA && imgs.length && g2++ < 200) {
    const antes = excede(corpo)
    const estado = cederImagens(imgs)
    if (!estado) break
    if (excede(corpo) >= antes - 0.25) {
      desfazerImagens(imgs, estado)
      break
    }
  }

  /* 4. devolver o que foi cedido a mais. A tabela sobe primeiro, porque estar
     comprimida é emergência; a imagem reocupa o que ainda sobrar. */
  let n = 0
  while (tabelas.length && n++ < 20) {
    const atual = Math.max(0, ...tabelas.map((t) => Number(t.dataset.nivel || 0)))
    if (atual === 0) break
    aplicarNivel(tabelas, atual - 1)
    if (excede(corpo) > FOLGA) {
      aplicarNivel(tabelas, atual)
      break
    }
  }
  /* a imagem desceu de 4 em 4 px, então quase sempre passou do necessário */
  let v = 0
  while (v++ < 900) {
    let cresceu = false
    for (const im of imgs) {
      const teto = parseFloat(im.style.maxHeight) || 0
      if (!teto) continue
      im.style.maxHeight = teto + 1 + 'px'
      if (excede(corpo) > FOLGA) {
        im.style.maxHeight = teto + 'px'
        continue
      }
      cresceu = true
    }
    if (!cresceu) break
  }
}

/** Aperta todas as folhas de um palco. */
export function compactarPalco(palco: HTMLElement | null) {
  if (!palco) return
  for (const f of palco.querySelectorAll('.fl')) {
    if (f instanceof HTMLElement) compactarFolha(f)
  }
}
