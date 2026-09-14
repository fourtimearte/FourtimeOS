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
