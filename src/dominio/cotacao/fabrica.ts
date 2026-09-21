import { totalDaGrade } from '../layout/grade'
import type { Tecnica } from '../layout/bloco'
import { totalDoProduto, type Cotacao } from './tipos'

/* ==========================================================================
   O que a fábrica precisa saber de uma cotação aprovada.

   Estes números descem para a linha do pedido no dia do sim e CONGELAM lá. O
   documento pode ser editado depois (uma observação, um informe), e o que a
   fábrica cortou não muda por causa disso.

   A conta mora aqui, em TypeScript, e não no banco. Quem sabe ler um bloco de
   layout, o que é uma técnica e como uma grade vira peça é o domínio, onde
   isso já está escrito. Ensinar a mesma coisa ao SQL seria a mesma regra em
   duas linguagens, e no dia em que uma mudasse a outra ficaria mentindo em
   silêncio.

   A DIVISÃO ENTRE SUBLIMAÇÃO E O RESTO é por PRODUTO, e não por peça.

   Um layout que tem sublimação é um layout de sublimação, mesmo que leve um
   bordado no peito junto: quem faz a conta na fábrica está perguntando qual
   máquina vai rodar aquilo, e a resposta é a sublimadora. Um pedido com um
   layout de cada lado é MISTO, e é assim que o relatório mensal o marca.
   ========================================================================== */

export type NumerosDaFabrica = {
  layouts: number
  tecnicas: Tecnica[]
  pecasSubli: number
  pecasPersonalizadas: number
  valorSubli: number
  valorPersonalizado: number
}

export function numerosDaFabrica(c: Cotacao): NumerosDaFabrica {
  const tecnicas = new Set<Tecnica>()
  let pecasSubli = 0
  let pecasPersonalizadas = 0
  let valorSubli = 0
  let valorPersonalizado = 0

  for (const p of c.produtos) {
    const doProduto = p.bloco.design.map((d) => d.tecnica)
    doProduto.forEach((t) => tecnicas.add(t))

    const pecas = totalDaGrade(p.bloco.grade)
    const valor = totalDoProduto(p)

    if (doProduto.includes('subli')) {
      pecasSubli += pecas
      valorSubli += valor
    } else {
      pecasPersonalizadas += pecas
      valorPersonalizado += valor
    }
  }

  return {
    layouts: c.produtos.length,
    tecnicas: [...tecnicas],
    pecasSubli,
    pecasPersonalizadas,
    valorSubli,
    valorPersonalizado,
  }
}

/* ==========================================================================
   AS FATIAS: o que vira cartao no kanban.

   O cartao do kanban nao e o pedido, e uma FATIA: pedido mais tecnica. Um
   pedido com layouts em sublimacao e DTF vira duas fatias, cada uma com sua
   etapa e seu ritmo, porque sao duas maquinas diferentes andando em
   velocidades diferentes. O painel de atividades continua com uma linha por
   pedido; quem se divide e o chao de fabrica.

   E O CARTAO E POR TECNICA, COM OS LAYOUTS JUNTOS, decidido pelo Henrique em
   21/09. Um pedido com 8 subli e 3 DTF vira 2 cartoes, e cada cartao lista os
   layouts dele. Um cartao por layout encheria o quadro: um pedido de 11
   layouts viraria 11 cartoes para arrastar um a um.

   UM LAYOUT PODE ESTAR EM DUAS FATIAS, e isso nao e erro de conta. Uma
   camiseta sublimada com bordado no peito passa pela sublimadora E pelo
   bordado: sao dois trabalhos na mesma peca. Por isso a soma das pecas das
   fatias nao bate com as pecas do pedido, e nao deveria bater: peca e o que o
   cliente recebe, fatia e trabalho que alguem faz.

   Isto e diferente da divisao subli/personalizado logo acima, que e por
   PRODUTO e serve para o dinheiro do relatorio. Ali a pergunta e "qual
   maquina rodou isso"; aqui e "por quantos lugares isso passa".
   ========================================================================== */

/* As tecnicas que ocupam um posto e viram cartao. Gola, ribana e etiqueta nao
   entram: elas sao acabamento que viaja junto com a peca, e nao uma fila
   propria com uma pessoa esperando na frente. */
const TECNICA_VIRA_FATIA: Tecnica[] = ['subli', 'dtf', 'silk', 'bordado', 'patch']

export type FatiaNova = {
  tecnica: Tecnica
  /** o numero do bloco na folha, que e como a fabrica chama o layout */
  layouts: number[]
  pecas: number
}

export function fatiasDaCotacao(c: Cotacao): FatiaNova[] {
  const porTecnica = new Map<Tecnica, FatiaNova>()

  for (const p of c.produtos) {
    /* o modulo de informacoes nao tem design nem grade, e nao entra em fila
       nenhuma: ele e anexo do pedido, nao peca */
    if (p.bloco.informacoes) continue

    const pecas = totalDaGrade(p.bloco.grade)
    /* Set porque a mesma tecnica pode estar marcada duas vezes no mesmo
       layout, com cores diferentes: sao dois lancamentos de cor, e um
       trabalho so. */
    const doLayout = new Set(p.bloco.design.map((d) => d.tecnica))

    for (const t of doLayout) {
      if (!TECNICA_VIRA_FATIA.includes(t)) continue
      const fatia = porTecnica.get(t) ?? { tecnica: t, layouts: [], pecas: 0 }
      fatia.layouts.push(p.bloco.n)
      fatia.pecas += pecas
      porTecnica.set(t, fatia)
    }
  }

  /* a ordem da lista e a ordem em que a fabrica trabalha, e nao a ordem em
     que os layouts apareceram na cotacao: o quadro fica igual todo dia */
  return TECNICA_VIRA_FATIA.map((t) => porTecnica.get(t)).filter(
    (f): f is FatiaNova => f !== undefined,
  )
}
