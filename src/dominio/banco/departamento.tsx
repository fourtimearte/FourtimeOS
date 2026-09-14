import type { CSSProperties } from 'react'
import type { OpcaoDoSeletor } from '@ds'

/* ==========================================================================
   O DEPARTAMENTO É UMA FAMÍLIA DE TÉCNICA, E A COR DIZ QUAL.

   Os departamentos da Fourtime não são texto solto: são as máquinas por onde
   a peça passa. Sublimação, DTF, Silk, Bordado, e as combinações entre elas.
   Quem lê "DTF + Sublimação" numa lista de sete nomes parecidos lê palavra
   por palavra; quem vê a pílula azul reconhece antes de ler.

   A COR NÃO É SORTEADA, e nem vem de uma tabela que alguém tem de manter. Ela
   é a cor que a técnica JÁ TEM no sistema, a mesma das pílulas do módulo de
   design e das faixas de cor. Assim o azul do DTF é o mesmo azul em todo
   lugar, e um departamento novo chamado "DTF Noturno" nasce azul sem ninguém
   cadastrar cor nenhuma.

   QUANDO O NOME CITA DUAS TÉCNICAS, VALE A PRIMEIRA DO TEXTO. "DTF + Silk" é
   azul e "SILK + SUBLIMAÇÃO" é roxo, porque é assim que a pessoa lê: da
   esquerda para a direita. Inventar uma terceira cor para cada combinação
   seria uma tabela para manter, que é exatamente o que esta regra evita.

   E o nome que não cita técnica nenhuma fica neutro, de propósito: uma cor
   qualquer num departamento administrativo diria que ele é de uma máquina
   que não existe.
   ========================================================================== */

/* a ordem aqui não importa: quem decide é a POSIÇÃO no texto, não esta lista */
const FAMILIAS: { chave: string; procura: string }[] = [
  { chave: 'dtf', procura: 'dtf' },
  { chave: 'subli', procura: 'subli' },
  { chave: 'silk', procura: 'silk' },
  { chave: 'bordado', procura: 'bordado' },
  { chave: 'patch', procura: 'patch' },
  { chave: 'gola', procura: 'gola' },
  { chave: 'ribana', procura: 'ribana' },
]

const semAcento = (t: string) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** A família de técnica de um departamento, ou vazio quando ele não cita uma. */
export function familiaDoDepartamento(nome: string): string {
  const alvo = semAcento(nome)
  let achada = ''
  let onde = Infinity
  for (const f of FAMILIAS) {
    const i = alvo.indexOf(f.procura)
    if (i >= 0 && i < onde) {
      onde = i
      achada = f.chave
    }
  }
  return achada
}

/** As duas cores da pílula: fundo claro e texto legível em cima dele. */
export function pilulaDoDepartamento(nome: string): { fundo: string; texto: string } {
  const f = familiaDoDepartamento(nome)
  if (!f) return { fundo: 'var(--surface-2)', texto: 'var(--text-2)' }
  return { fundo: 'var(--tec-' + f + '-soft)', texto: 'var(--tec-' + f + '-fg)' }
}

/** A lista pronta para o seletor, cada opção já com a cor dela. */
export function opcoesDeDepartamento(lista: string[]): OpcaoDoSeletor[] {
  return lista.map((d) => ({ valor: d, rotulo: d, pilula: pilulaDoDepartamento(d) }))
}

/** O departamento desenhado como pílula, para listas e cabeçalhos. */
export function SeloDeDepartamento({ nome, className }: { nome: string; className?: string }) {
  if (!nome) return null
  const p = pilulaDoDepartamento(nome)
  return (
    <span
      className={['selo-depto', className].filter(Boolean).join(' ')}
      style={{ background: p.fundo, color: p.texto } as CSSProperties}
    >
      {nome}
    </span>
  )
}
