import type { CSSProperties } from 'react'

/* ==========================================================================
   A tabela por tamanho: uma linha por medida (ou por parte do molde) e uma
   coluna por tamanho.

   NUMA CAIXA ESTREITA ELA FICA EM PÉ: um tamanho por linha e uma coluna por
   medida. Dez colunas de número não cabem em 360 px, e espremer até caber dá
   uma tabela que ninguém lê. Em pé, quem procura o G acha a linha do G e lê
   tudo dele de uma vez, que é como a costureira confere a peça na mesa.
   ========================================================================== */

export type LinhaDaGrade = {
  chave: string
  nome: string
  apoio?: string
  /** o nome curto, para o cabeçalho de coluna quando a tabela está em pé */
  curto?: string
  /** um texto por tamanho, na ordem dos tamanhos; vazio vira o ponto */
  valores: string[]
  /** soma: a linha de total. apagada: a linha de conta, que ninguém digitou */
  tipo?: 'soma' | 'apagada'
}

const PONTO = '·'

export function GradePorTamanho({
  primeira,
  tamanhos,
  linhas,
  emPe,
  rotulo,
}: {
  /** o título da primeira coluna: "Medida, em cm" */
  primeira: string
  tamanhos: string[]
  linhas: LinhaDaGrade[]
  emPe: boolean
  rotulo: string
}) {
  if (emPe) {
    return (
      <div className="pd-grade-rola">
        <table
          className="pd-grade pd-em-pe"
          aria-label={rotulo}
          style={{ '--pd-colunas': linhas.length } as CSSProperties}
        >
          <thead>
            <tr>
              <th scope="col">Tamanho</th>
              {linhas.map(l => (
                <th scope="col" key={l.chave} className={l.tipo}>
                  {l.curto ?? l.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tamanhos.map((t, i) => (
              <tr key={t}>
                <th scope="row">{t}</th>
                {linhas.map(l => (
                  <td
                    key={l.chave}
                    className={[l.tipo, l.valores[i] ? '' : 'sem'].filter(Boolean).join(' ') || undefined}
                  >
                    {l.valores[i] || PONTO}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <table className="pd-grade" aria-label={rotulo}>
      <thead>
        <tr>
          <th scope="col">{primeira}</th>
          {tamanhos.map(t => (
            <th scope="col" key={t}>
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map(l => (
          <tr key={l.chave} className={l.tipo}>
            <th scope="row">
              {l.tipo === 'apagada' ? (
                <small>{l.nome}</small>
              ) : (
                <>
                  <b>{l.nome}</b>
                  {l.apoio ? <small>{l.apoio}</small> : null}
                </>
              )}
            </th>
            {l.valores.map((v, i) => (
              <td key={tamanhos[i]} className={v ? undefined : 'sem'}>
                {v || PONTO}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
