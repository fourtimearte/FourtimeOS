import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Ruler } from '@phosphor-icons/react'
import { Botao, Segmentado, Seletor, TituloCartao } from '@ds'
import type { Faixa } from '@dominio/layout/grade'
import {
  areaDaPeca,
  areaEmGramas,
  areaEmMetros,
  casasDaArea,
  emArea,
  emNumero,
  faixasDaGrade,
  tamanhosDaFaixa,
  tecidosQueConvertem,
  vezesEmPalavras,
  type Ficha,
  type TecidoDeConta,
} from '@dominio/produto'
import { LARGURA_DA_TABELA_DEITADA, usarLargura } from './apoio'
import { GradePorTamanho, type LinhaDaGrade } from './grade'

/* ==========================================================================
   Medidas e tecido: um módulo, duas abas.

   MEDIDAS É A DA FRENTE (revisão do Henrique de 05/10/2026). É a tabela que a
   costura e a conferência abrem. As medidas são LIVRES: uma camiseta tem
   comprimento, largura e manga; uma calça tem cintura, quadril, gancho e
   entrepernas. Cada referência tem as dela, na ordem que quiser.

   TECIDO É OUTRA ABA, e não outra tabela embaixo: são dois assuntos, e
   misturar os dois numa grade só foi o que ele pediu para não fazer.

   NA ABA TECIDO SÓ A ÁREA É DA FICHA. O metro e o grama dependem do tecido
   que o orçamento escolher, então aqui eles são uma conta de apoio, com um
   tecido de exemplo que a pessoa troca, e aparecem apagados por isso.
   ========================================================================== */

export type AbaDoModulo = 'medidas' | 'tecido'

/** centímetros: uma casa sempre, a segunda só quando existe */
export const emCm = (v: number | undefined) =>
  v === undefined
    ? ''
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })

const NOME_DA_FAIXA: Record<Faixa, string> = { adulto: 'Adulta', infantil: 'Infantil' }

/** A faixa à vista: a grade com as duas mostra uma de cada vez. */
export function usarFaixa(tamanhos: string[]) {
  const faixas = useMemo(() => faixasDaGrade(tamanhos), [tamanhos])
  const [faixa, setFaixa] = useState<Faixa>(faixas[0] ?? 'adulto')
  /* a faixa que estava à vista foi desligada inteira: passa para a que sobrou */
  useEffect(() => {
    if (faixas.length && !faixas.includes(faixa)) setFaixa(faixas[0])
  }, [faixas, faixa])
  const aVista = faixas.includes(faixa) ? faixa : (faixas[0] ?? 'adulto')
  return { faixas, faixa: aVista, setFaixa, tamanhos: tamanhosDaFaixa(tamanhos, aVista) }
}

/** O topo do módulo: o título, as duas abas e, quando a grade tem as duas faixas, a troca. */
export function TopoDoModulo({
  aba,
  aoTrocarAba,
  faixas,
  faixa,
  aoTrocarFaixa,
}: {
  aba: AbaDoModulo
  aoTrocarAba: (a: AbaDoModulo) => void
  faixas: Faixa[]
  faixa: Faixa
  aoTrocarFaixa: (f: Faixa) => void
}) {
  return (
    <div className="pd-topo quebra">
      <TituloCartao icone={Ruler}>Medidas e tecido</TituloCartao>
      <div className="fileira">
        <Segmentado
          className="pd-abas-do-modulo"
          valor={aba}
          aoMudar={aoTrocarAba}
          opcoes={[
            { valor: 'medidas', rotulo: 'Medidas' },
            { valor: 'tecido', rotulo: 'Tecido' },
          ]}
        />
        {faixas.length > 1 ? (
          <Segmentado
            valor={faixa}
            aoMudar={aoTrocarFaixa}
            opcoes={faixas.map(f => ({ valor: f, rotulo: NOME_DA_FAIXA[f] }))}
          />
        ) : null}
      </div>
    </div>
  )
}

/** O tecido de conta: o primeiro que converte, até a pessoa escolher outro. */
export function usarTecidoDeConta(tecidos: TecidoDeConta[]) {
  const servem = useMemo(() => tecidosQueConvertem(tecidos), [tecidos])
  /* nulo: ninguém escolheu ainda. Vazio: a pessoa pediu para não converter. */
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const id = escolhido ?? servem[0]?.id ?? ''
  const tecido = servem.find(t => t.id === id) ?? null
  return { servem, tecido, id: tecido ? id : '', setId: setEscolhido }
}

/** A escolha do tecido de conta, embaixo da tabela de tecido. */
export function EscolhaDoTecidoDeConta({ conta }: { conta: ReturnType<typeof usarTecidoDeConta> }) {
  if (!conta.servem.length) {
    return (
      <p className="pd-nota">
        Nenhum tecido do catálogo tem largura e gramatura cadastradas, então a área ainda não vira metro
        nem grama aqui. Elas se cadastram em Configurações, Banco de dados, Tecidos.
      </p>
    )
  }
  return (
    <div className="fileira" data-tecido-de-conta="">
      <span className="pd-rotulo-solto">Ver em metros e gramas com</span>
      <Seletor
        campo
        tamanho="sm"
        valor={conta.id}
        vazio="Não converter"
        opcoes={conta.servem.map(t => ({ valor: t.id, rotulo: t.nome }))}
        aoEscolher={conta.setId}
      />
    </div>
  )
}

/** As linhas de conta: o metro e o grama, pelo tecido escolhido. */
export function linhasDeConta(
  areas: (number | null)[],
  tecido: TecidoDeConta | null,
): LinhaDaGrade[] {
  if (!tecido) return []
  return [
    {
      chave: 'conta-metros',
      nome: `dá em metros, com ${emNumero(tecido.largura, 2)} m de largura`,
      curto: 'Metros',
      valores: areas.map(a => emNumero(areaEmMetros(a, tecido), 2)),
      tipo: 'apagada',
    },
    {
      chave: 'conta-gramas',
      nome: `dá em gramas, com malha de ${emNumero(tecido.gramatura, 0)} g/m²`,
      curto: 'Gramas',
      valores: areas.map(a => {
        const g = areaEmGramas(a, tecido)
        return g === null ? '' : emNumero(Math.round(g), 0)
      }),
      tipo: 'apagada',
    },
  ]
}

export function MedidasETecido({
  ficha,
  tecidos,
  aba,
  aoTrocarAba,
  podeEditar,
  aoEditar,
}: {
  ficha: Ficha
  tecidos: TecidoDeConta[]
  aba: AbaDoModulo
  aoTrocarAba: (a: AbaDoModulo) => void
  podeEditar: boolean
  aoEditar: (aba: AbaDoModulo) => void
}) {
  const caixa = useRef<HTMLElement>(null)
  const emPe = usarLargura(caixa) < LARGURA_DA_TABELA_DEITADA
  const grade = usarFaixa(ficha.tamanhos)
  const conta = usarTecidoDeConta(tecidos)
  const tamanhos = grade.tamanhos

  const pano = ficha.partes.filter(p => p.unidade === 'm2')
  const fita = ficha.partes.filter(p => p.unidade === 'm')
  const areas = tamanhos.map(t => areaDaPeca(ficha.partes, t))

  const linhasDeMedida: LinhaDaGrade[] = ficha.medidas.map(m => ({
    chave: m.nome,
    nome: m.nome,
    apoio: m.comoMedir,
    valores: tamanhos.map(t => emCm(m.valores[t])),
  }))
  const linhasDeTecido: LinhaDaGrade[] = [
    ...pano.map(p => {
      const daLinha = tamanhos.map(t => p.quantidades[t])
      const casas = casasDaArea(daLinha)
      return {
        chave: p.nome,
        nome: p.nome,
        apoio: vezesEmPalavras(p.vezes),
        valores: daLinha.map(v => emArea(v, casas)),
      }
    }),
    ...(pano.length
      ? [
          {
            chave: 'soma',
            nome: 'A peça inteira',
            curto: 'A peça',
            apoio: 'em m², já com a perda do corte',
            valores: areas.map(a => emArea(a, casasDaArea(areas))),
            tipo: 'soma' as const,
          },
          ...linhasDeConta(areas, conta.tecido),
        ]
      : []),
    ...fita.map(p => ({
      chave: p.nome,
      nome: p.nome,
      apoio: 'em metros',
      valores: tamanhos.map(t => emNumero(p.quantidades[t], 2)),
    })),
  ]

  return (
    <section className="cartao pd-col" data-modulo={aba} ref={caixa}>
      <TopoDoModulo
        aba={aba}
        aoTrocarAba={aoTrocarAba}
        faixas={grade.faixas}
        faixa={grade.faixa}
        aoTrocarFaixa={grade.setFaixa}
      />
      {aba === 'medidas' ? (
        <>
          {linhasDeMedida.length ? (
            <GradePorTamanho
              primeira="Medida, em cm"
              tamanhos={tamanhos}
              linhas={linhasDeMedida}
              emPe={emPe}
              rotulo="Tabela de medidas, em centímetros"
            />
          ) : null}
          <div className="pd-corpo">
            <div className="fileira entre">
              <p className="pd-nota pd-cresce">
                {linhasDeMedida.length
                  ? 'A peça pronta, medida esticada na mesa. Cada referência tem as medidas que precisar.'
                  : 'Esta peça ainda não tem tabela de medidas. Cada referência tem as medidas que precisar: comprimento, largura, manga, cintura, gancho, o que a peça tiver.'}
              </p>
              {podeEditar ? (
                <Botao tamanho="sm" onClick={() => aoEditar('medidas')}>
                  <Plus size={14} aria-hidden="true" />
                  Adicionar medida
                </Botao>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <>
          {linhasDeTecido.length ? (
            <GradePorTamanho
              primeira="Parte do molde, em m²"
              tamanhos={tamanhos}
              linhas={linhasDeTecido}
              emPe={emPe}
              rotulo="Tecido por parte do molde, em cada tamanho"
            />
          ) : null}
          <div className="pd-corpo">
            {linhasDeTecido.length ? (
              <>
                {pano.length ? <EscolhaDoTecidoDeConta conta={conta} /> : null}
                <p className="pd-nota">
                  A área de cada parte, já com a perda do corte. Os metros e os gramas mudam com o tecido
                  escolhido no orçamento. É por esta tabela que a Separação calcula o tecido de cada layout.
                </p>
              </>
            ) : (
              <div className="fileira entre">
                <p className="pd-nota pd-cresce">
                  Esta peça ainda não tem o tecido medido. Ele é digitado em área, por parte do molde e por
                  tamanho, e é dele que a Separação tira quanto tecido cada layout gasta.
                </p>
                {podeEditar ? (
                  <Botao tamanho="sm" onClick={() => aoEditar('tecido')}>
                    <Plus size={14} aria-hidden="true" />
                    Medir o tecido
                  </Botao>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
