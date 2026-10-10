import { useEffect, useSyncExternalStore } from 'react'
import { tabela } from '@shared/supabase'
import type { AbaDeCores } from '@ds'
import {
  assinarCoresDeImpressao,
  coresJaLidas,
  guardarCoresDeImpressao,
  type CorDeImpressaoNoMenu,
  type CoresDeImpressao,
} from './cores-de-impressao'

/* A LEITURA DAS CORES DE IMPRESSÃO, uma vez por visita (ver
   cores-de-impressao.ts). Enquanto ela não volta, o menu fica vazio e diz que
   está carregando; ele nunca mostra a lista de exemplo no lugar, porque cor
   errada lançada no layout vai errada para a máquina. */

type Linha = { codigo: string; tecnica: string; numero: number; hex: string; nome: string }

export function carregarCoresDeImpressao(forcar = false): void {
  const atual = coresJaLidas()
  if (!forcar && (atual.fase === 'lendo' || atual.fase === 'pronto')) return
  guardarCoresDeImpressao({ ...atual, fase: 'lendo', falha: '' })
  tabela<Linha[]>('cor_de_impressao?select=codigo,tecnica,numero,hex,nome&order=tecnica.asc,numero.asc')
    .then((linhas) => {
      const daTecnica = (t: string) =>
        linhas
          .filter((l) => l.tecnica === t)
          .map((l): CorDeImpressaoNoMenu => [String(l.codigo).toUpperCase(), String(l.hex), String(l.nome ?? '')])
      guardarCoresDeImpressao({ fase: 'pronto', dtf: daTecnica('dtf'), sub: daTecnica('sublimacao'), falha: '' })
    })
    .catch((e: unknown) => {
      guardarCoresDeImpressao({ ...coresJaLidas(), fase: 'falhou', falha: e instanceof Error ? e.message : String(e) })
    })
}

/** as cores do banco, lidas na primeira vez que alguém pede */
export function usarCoresDeImpressao(): CoresDeImpressao {
  const atual = useSyncExternalStore(assinarCoresDeImpressao, coresJaLidas)
  useEffect(() => {
    if (atual.fase === 'nada' || atual.fase === 'falhou') carregarCoresDeImpressao(atual.fase === 'falhou')
  }, [atual.fase])
  return atual
}

/* AS DUAS ABAS DO MENU DE CÓDIGO DE COR, com as cores do BANCO (Configurações,
   Banco de dados: 300 do DTF e 87 da sublimação). Até 11/10/2026 eram as
   listas de exemplo do /kit, e o editor mostrava cores que a fábrica não tem. */
export function usarAbasDeCor(): { abas: AbaDeCores[]; fase: CoresDeImpressao['fase']; falha: string } {
  const cores = usarCoresDeImpressao()
  return {
    abas: [
      { id: 'dtf', rotulo: 'DTF', cor: 'var(--tec-dtf-vivo)', cores: cores.dtf },
      { id: 'sub', rotulo: 'SUB', cor: 'var(--tec-subli-vivo)', cores: cores.sub },
    ],
    fase: cores.fase,
    falha: cores.falha,
  }
}
