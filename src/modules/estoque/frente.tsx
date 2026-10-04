import type { CSSProperties, ReactNode } from 'react'
import { MapPin } from '@phosphor-icons/react'
import {
  codigoDoLugar,
  lugarPorExtenso,
  nomeDoVao,
  type Lugar,
  type Movel,
} from '@dominio/deposito'
import type { Material } from '@dominio/estoque'

/* ==========================================================================
   O nível, o lugar e a prateleira vista de frente.

   O NÍVEL É UMA COR, E A COR NUNCA VAI SOZINHA: o número está sempre dentro
   dela. Quem não distingue o verde do âmbar lê o 1 e o 3.
   ========================================================================== */

/* UM RÓTULO EM CIMA DE VÁRIOS CONTROLES. O Campo do sistema é um <label>, e
   um <label> com vários botões dentro entrega o clique ao primeiro deles: na
   caixa de marcar o lugar, clicar no rótulo "A Prateleira D vista de frente",
   ou no vão entre duas casas, marcava a casa D1 do nível de cima sem a pessoa
   pedir. Aqui o rótulo é só texto, e o grupo se anuncia como grupo. */
export function Grupo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="campo" role="group" aria-label={rotulo}>
      <span>{rotulo}</span>
      {children}
    </div>
  )
}

/** o quadradinho do nível: a cor com o número dentro */
export function Nv({ nivel }: { nivel: number }) {
  return (
    <i className={'dp-nv n' + nivel} aria-label={'nível ' + nivel}>
      {nivel}
    </i>
  )
}

/* A ETIQUETA DO LUGAR: o código curto ("D2" e o quadradinho do nível, ou
   "P07") na lista, e o lugar por extenso na ficha. Sem lugar, ela diz isso em
   vez de sumir: o vazio também é informação. */
export function EtiquetaDoLugar({
  movel,
  lugar,
  porExtenso,
  forte,
  semIcone,
}: {
  movel?: Movel
  lugar?: Lugar
  porExtenso?: boolean
  /** o principal, ou o que está escolhido */
  forte?: boolean
  semIcone?: boolean
}) {
  if (!movel || !lugar) return <span className="dp-etiqueta sem">sem lugar</span>
  const nivel = movel.tipo === 'prateleira' ? lugar.nivel : null
  return (
    <span
      className={forte ? 'dp-etiqueta forte' : 'dp-etiqueta'}
      title={lugarPorExtenso(movel, lugar.vao, lugar.nivel)}
    >
      {semIcone ? null : <MapPin size={12} aria-hidden="true" />}
      {porExtenso ? lugarPorExtenso(movel, lugar.vao, null) : codigoDoLugar(movel, lugar.vao, null)}
      {nivel !== null ? (
        <>
          {porExtenso ? <span className="dp-ponto-do-meio">·</span> : null}
          <Nv nivel={nivel} />
          {porExtenso ? 'nível ' + nivel : null}
        </>
      ) : null}
    </span>
  )
}

/* A PRATELEIRA VISTA DE FRENTE: os vãos lado a lado e os níveis empilhados,
   o de cima em cima. Cada casa mostra a bolinha do que está guardado ali.

   `vaoAberto` destaca um vão inteiro (o mapa abriu aquele vão). `escolhido` é
   a casa marcada, e `aoEscolher` deixa clicar: é como a caixa de marcar o
   lugar pergunta o vão e o nível. */
export function FrenteDaPrateleira({
  movel,
  guardados,
  vaoAberto,
  escolhido,
  aoEscolher,
}: {
  movel: Movel
  /** o que há em cada casa: a chave é vão:nível (nível 0 para quem não disse o nível) */
  guardados: Map<string, Material[]>
  vaoAberto?: number
  escolhido?: { vao: number; nivel: number | null }
  aoEscolher?: (vao: number, nivel: number) => void
}) {
  const vaos = Array.from({ length: movel.vaos }, (_, i) => i + 1)
  const niveis = Array.from({ length: movel.niveis }, (_, i) => movel.niveis - i)
  return (
    <div
      className="dp-frente"
      style={{ gridTemplateColumns: `auto repeat(${movel.vaos}, minmax(0, 1fr))` }}
    >
      <span />
      {vaos.map(v => (
        <span
          key={v}
          className={
            v === vaoAberto || v === escolhido?.vao ? 'dp-frente-vao aberto' : 'dp-frente-vao'
          }
          title={nomeDoVao(movel, v)}
        >
          {nomeDoVao(movel, v)}
        </span>
      ))}
      {niveis.map(n => (
        <Fileira key={n} nivel={n}>
          {vaos.map(v => {
            const dentro = guardados.get(v + ':' + n) ?? []
            const marcado = escolhido?.vao === v && escolhido.nivel === n
            const classe = [
              'dp-casa',
              'n' + n,
              dentro.length ? 'tem' : '',
              marcado ? 'marcada' : '',
              vaoAberto ? (v === vaoAberto ? 'do-aberto' : 'de-fora') : '',
            ]
              .filter(Boolean)
              .join(' ')
            /* A bolinha da casa tem um anel da cor do texto: a do sistema usa a
               borda do cartão, que some no tema escuro debaixo de um tecido
               preto ou marinho. Material sem cor entra como um quadradinho. */
            const bolas = dentro
              .slice(0, 4)
              .map(m => (
                <i
                  key={m.id}
                  className={m.corHex ? 'dp-bola' : 'dp-bola sem-cor'}
                  style={m.corHex ? ({ '--dp-bola': m.corHex } as CSSProperties) : undefined}
                />
              ))
            const resto = dentro.length > 4 ? <small>+{dentro.length - 4}</small> : null
            const rotulo =
              nomeDoVao(movel, v) +
              ', nível ' +
              n +
              (dentro.length
                ? ', ' + dentro.length + (dentro.length === 1 ? ' material' : ' materiais')
                : ', vazio')
            return aoEscolher ? (
              <button
                key={v}
                type="button"
                className={classe}
                aria-pressed={marcado}
                aria-label={rotulo}
                onClick={() => aoEscolher(v, n)}
              >
                {bolas}
                {resto}
              </button>
            ) : (
              <span key={v} className={classe} title={rotulo}>
                {bolas}
                {resto}
              </span>
            )
          })}
        </Fileira>
      ))}
    </div>
  )
}

function Fileira({ nivel, children }: { nivel: number; children: ReactNode }) {
  return (
    <>
      <span className="dp-frente-nivel">
        <Nv nivel={nivel} />
        nível {nivel}
      </span>
      {children}
    </>
  )
}
