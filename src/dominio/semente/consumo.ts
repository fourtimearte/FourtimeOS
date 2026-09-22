import { tabela } from '@shared/supabase'
import { TAMANHOS_ADULTO, TAMANHOS_INFANTIL } from '../layout/grade'

/* ==========================================================================
   O consumo do ensaio.

   A separação só mostra número quando existe consumo cadastrado. Sem ele toda
   reserva nasce marcada como "não sei", e a fila do estoque, do PCP e da
   separação ficam mudas: o ensaio encheria a fábrica de pedidos e não provaria
   nenhuma das contas.

   ESTES NÚMEROS SÃO DE DEMONSTRAÇÃO, E ELES DIZEM ISSO. Toda linha nasce com
   `teste = true` e some com o resto do ensaio. Consumo é cadastro de verdade:
   escrever número inventado num registro que a fábrica vai usar para comprar
   malha é o erro que o passo 7 existe para não cometer, e a cerca do teste é o
   que separa uma coisa da outra.

   E ELE ENTRA EM QUILOS, e não em metros. Metro só vira quilo com a largura e
   a gramatura do tecido, que também são cadastro de verdade: semear em metros
   obrigaria a inventar número em dois registros em vez de um.
   ========================================================================== */

/* peso médio da peça pronta, em quilos, pelo que o nome da referência diz.
   É a ordem de grandeza que a fábrica reconhece, e não uma medida. */
const PESO_POR_PECA: { chave: string; kg: number }[] = [
  { chave: 'REGATA', kg: 0.13 },
  { chave: 'CAMISETA', kg: 0.16 },
  { chave: 'CAMISA', kg: 0.18 },
  { chave: 'BLUSA', kg: 0.22 },
  { chave: 'SHORT', kg: 0.17 },
  { chave: 'BERMUDA', kg: 0.2 },
  { chave: 'CALCA', kg: 0.32 },
  { chave: 'CALÇA', kg: 0.32 },
  { chave: 'LEGGING', kg: 0.24 },
  { chave: 'JAQUETA', kg: 0.44 },
  { chave: 'MOLETOM', kg: 0.5 },
  { chave: 'AGASALHO', kg: 0.62 },
  { chave: 'MACAQUINHO', kg: 0.26 },
  { chave: 'MACACAO', kg: 0.38 },
  { chave: 'TOP', kg: 0.1 },
  { chave: 'MEIA', kg: 0.05 },
  { chave: 'BONE', kg: 0.08 },
]

function pesoBase(nome: string): number {
  const n = nome.toUpperCase()
  for (const p of PESO_POR_PECA) if (n.includes(p.chave)) return p.kg
  return 0.2
}

/* o tamanho puxa o peso para cima e para baixo. Um G2 não come o mesmo que um
   PP, e uma média por referência erraria para os dois lados ao mesmo tempo. */
const FATOR: Record<string, number> = {
  PP: 0.86, P: 0.93, M: 1, G: 1.07, GG: 1.14, XG: 1.21,
  G1: 1.28, G2: 1.35, G3: 1.42, G4: 1.5,
  '2A': 0.34, '4A': 0.42, '6A': 0.5, '8A': 0.58, '10A': 0.66, '12A': 0.74, '14A': 0.84,
}

type LinhaDeReferencia = { id: string; nome: string; genero: string }

export type ResultadoDoConsumo = { gravados: number; referencias: number }

export async function semearConsumo(): Promise<ResultadoDoConsumo> {
  const refs = await tabela<LinhaDeReferencia[]>(
    'referencia?select=id,nome,genero&ativo=is.true&order=ordem.asc',
  )

  const linhas: Record<string, unknown>[] = []
  for (const r of refs) {
    const base = pesoBase(r.nome)
    /* C é infantil no catálogo; o resto usa a grade adulta */
    const tamanhos = r.genero === 'C' ? TAMANHOS_INFANTIL : TAMANHOS_ADULTO
    for (const t of tamanhos) {
      const kg = Math.round(base * (FATOR[t] ?? 1) * 10000) / 10000
      linhas.push({
        referencia_id: r.id,
        tamanho: t,
        metros: null,
        quilos: kg,
        observacao: 'consumo de demonstração, semeado pelo ensaio',
        teste: true,
      })
    }
  }

  /* em blocos, senão um POST de milhares de linhas estoura o corpo do pedido
     e a resposta some no meio */
  let gravados = 0
  const PEDACO = 400
  for (let i = 0; i < linhas.length; i += PEDACO) {
    const bloco = linhas.slice(i, i + PEDACO)
    await tabela('consumo_da_referencia?on_conflict=referencia_id,tamanho', {
      metodo: 'POST',
      corpo: bloco,
      mesclar: true,
    })
    gravados += bloco.length
  }

  return { gravados, referencias: refs.length }
}
