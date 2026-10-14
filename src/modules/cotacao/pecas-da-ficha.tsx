import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Plus } from '@phosphor-icons/react'
import { MenuCodigoDeCor, MenuDeContexto } from '@ds'
import {
  comEtiqueta,
  etiquetaDoDesign,
  hexDoBanco,
  usarAbasDeCor,
  type Bloco,
  type Design,
  type EtiquetaDoLayout,
} from '@dominio/layout'
import {
  TAMANHOS_DE_APLIQUE,
  TECNICAS,
  alternarCor,
  comTamanho,
  desligarTecnica,
  ligarTecnica,
  rotuloDaTecnica,
  tirarCor,
  type DaTecnica,
} from './design-do-layout'
import './cotacao.css'

/* ==========================================================================
   AS PEÇAS DA FICHA DO LAYOUT que a tabela do editor também usa (14/10/2026):
   os interruptores da etiqueta e o design inteiro (os cinco interruptores, a
   paleta de cada técnica com cor, o tamanho do bordado e do patch). Um lugar
   só: a ficha e o balão da tabela mostram e mexem do mesmo jeito.
   ========================================================================== */

/** Os interruptores da etiqueta: Fourtime ou Cliente, e a técnica dela. */
export function ChavesDaEtiqueta({
  bloco,
  travado,
  aoMudar,
}: {
  bloco: Bloco
  travado: boolean
  aoMudar: (b: Bloco) => void
}) {
  const etiqueta = etiquetaDoDesign(bloco.design)
  const mudarEtiqueta = (e: EtiquetaDoLayout) =>
    aoMudar({ ...bloco, design: comEtiqueta(bloco.design, e) })
  return (
    <>
      <div className="ct-chaves ct-chaves-2">
        {(['fourtime', 'cliente'] as const).map(tipo => (
          <Chave
            key={tipo}
            tom={tipo === 'fourtime' ? 'ct-ch-fourtime' : 'ct-ch-cliente'}
            ligada={etiqueta.tipo === tipo}
            travado={travado}
            rotulo={tipo === 'fourtime' ? 'Fourtime' : 'Cliente'}
            aoAlternar={() =>
              mudarEtiqueta(
                etiqueta.tipo === tipo
                  ? { tipo: '', tecnica: '' }
                  : { tipo, tecnica: etiqueta.tecnica },
              )
            }
          />
        ))}
      </div>
      <div className="ct-chaves ct-chaves-3">
        {(['silk', 'sub', 'dtf'] as const).map(tec => (
          <Chave
            key={tec}
            tom={tec === 'sub' ? 'ct-ch-subli' : tec === 'dtf' ? 'ct-ch-dtf' : 'ct-ch-silk'}
            ligada={etiqueta.tecnica === tec}
            travado={travado || !etiqueta.tipo}
            titulo={
              etiqueta.tipo ? undefined : 'Escolha antes se a etiqueta é da Fourtime ou do cliente'
            }
            rotulo={tec === 'sub' ? 'Sub' : tec === 'dtf' ? 'DTF' : 'Silk'}
            aoAlternar={() =>
              mudarEtiqueta({ ...etiqueta, tecnica: etiqueta.tecnica === tec ? '' : tec })
            }
          />
        ))}
      </div>
    </>
  )
}

/** O design do layout: os interruptores das técnicas e as paletas. */
export function EditorDoDesign({
  bloco,
  travado,
  aoMudar,
}: {
  bloco: Bloco
  travado: boolean
  aoMudar: (b: Bloco) => void
}) {
  const [menu, setMenu] = useState<'' | 'codigo'>('')
  /* as cores de impressão do banco: 300 do DTF e 87 da sublimação */
  const coresDoBanco = usarAbasDeCor()
  const [abaAberta, setAbaAberta] = useState<DaTecnica | null>(null)
  const ancora = useRef<HTMLElement | null>(null)
  /* o botão direito no Bordado ou no Patch: o tamanho P, M ou G */
  const [doTamanho, setDoTamanho] = useState<DaTecnica | null>(null)
  const ancoraDoTamanho = useRef<HTMLElement | null>(null)
  /* o que foi desligado nesta visita volta com as cores se for religado: um
     clique sem querer no interruptor não pode apagar seis códigos */
  const guardadas = useRef(new Map<string, Design>())
  const mudar = (parte: Partial<Bloco>) => aoMudar({ ...bloco, ...parte })

  function alternarTecnica(t: DaTecnica) {
    const tem = bloco.design.find(d => d.tag === t.tag)
    if (tem) {
      guardadas.current.set(t.tag, tem)
      mudar({ design: desligarTecnica(bloco.design, t) })
    } else {
      mudar({ design: ligarTecnica(bloco.design, t, guardadas.current.get(t.tag)) })
    }
  }

  const comCor = TECNICAS.filter(t => t.cor && bloco.design.some(d => d.tag === t.tag))

  return (
    <>
      <div className="ct-ft-design">
        <div className="ct-chaves ct-chaves-5">
          {TECNICAS.map(t => (
            <Chave
              key={t.tag}
              tom={t.tom}
              ligada={bloco.design.some(d => d.tag === t.tag)}
              travado={travado}
              rotulo={rotuloDaTecnica(
                t,
                bloco.design.find(d => d.tag === t.tag),
              )}
              titulo={t.porTamanho && !travado ? 'Botão direito: o tamanho (P, M ou G)' : undefined}
              aoAlternar={() => alternarTecnica(t)}
              aoMenu={
                t.porTamanho
                  ? el => {
                      ancoraDoTamanho.current = el
                      setDoTamanho(t)
                    }
                  : undefined
              }
            />
          ))}
        </div>
        {comCor.length ? (
          <div className="ct-paletas">
            {comCor.map(t => {
              const d = bloco.design.find(x => x.tag === t.tag)!
              return (
                <div key={t.tag} className={'ct-paleta ' + t.tom}>
                  <span className="ct-paleta-nome">{t.rotulo}</span>
                  {d.cores.map(c => (
                    <button
                      key={c.cod}
                      type="button"
                      className="ct-cartao-cor"
                      disabled={travado}
                      title={
                        'Cor ' +
                        c.cod +
                        (travado ? '' : ': clique para abrir a paleta, botão direito tira')
                      }
                      onContextMenu={e => {
                        e.preventDefault()
                        if (!travado) mudar({ design: tirarCor(bloco.design, t.tag, c.cod) })
                      }}
                      onClick={e => {
                        ancora.current = e.currentTarget
                        setAbaAberta(t)
                        setMenu('codigo')
                      }}
                    >
                      <i style={{ '--cor': hexDoBanco(c.cod, c.hex) } as CSSProperties} />
                      <b>{c.cod}</b>
                    </button>
                  ))}
                  {!travado ? (
                    <button
                      type="button"
                      className="ct-cartao-cor ct-cartao-mais"
                      aria-label={'Acrescentar cor em ' + t.rotulo}
                      title="Acrescentar cor"
                      onClick={e => {
                        ancora.current = e.currentTarget
                        setAbaAberta(t)
                        setMenu('codigo')
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <MenuCodigoDeCor
        aberto={menu === 'codigo'}
        ancora={ancora}
        aoFechar={() => setMenu('')}
        abas={coresDoBanco.abas.filter(a => !abaAberta || a.id === abaAberta.aba)}
        semCores={
          coresDoBanco.fase === 'falhou'
            ? 'Não consegui ler as cores do banco: ' + coresDoBanco.falha
            : 'Carregando as cores do banco...'
        }
        noLayout={bloco.design.find(d => d.tag === abaAberta?.tag)?.cores.map(c => c.cod) ?? []}
        aoAlternar={(cod, hex) => {
          if (!abaAberta) return
          mudar({ design: alternarCor(bloco.design, abaAberta.tag, cod, hex) })
        }}
      />
      <MenuDeContexto
        aberto={!!doTamanho}
        ancora={ancoraDoTamanho}
        aoFechar={() => setDoTamanho(null)}
        cabecalho={doTamanho ? 'Tamanho do ' + doTamanho.rotulo.toLowerCase() : null}
        itens={
          doTamanho
            ? [
                ...TAMANHOS_DE_APLIQUE.map(x => ({
                  rotulo: `${x.valor}  ${x.nome}`,
                  aoEscolher: () => mudar({ design: comTamanho(bloco.design, doTamanho, x.valor) }),
                })),
                ...(bloco.design.find(d => d.tag === doTamanho.tag)?.tamanho
                  ? [
                      {
                        rotulo: 'Sem tamanho',
                        aoEscolher: () =>
                          mudar({ design: comTamanho(bloco.design, doTamanho, '') }),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />
    </>
  )
}

/* O INTERRUPTOR (decisão 153): 34 px, sempre com a borda na cor dele, clara
   desligado e cheia ligado; ligado ganha o fundo suave, o texto na cor e o visto. */
export function Chave({
  tom,
  ligada,
  travado,
  rotulo,
  titulo,
  aoAlternar,
  aoMenu,
}: {
  tom: string
  ligada: boolean
  travado: boolean
  rotulo: string
  titulo?: string
  aoAlternar: () => void
  /** o botão direito (o tamanho do bordado e do patch) */
  aoMenu?: (el: HTMLElement) => void
}) {
  return (
    <button
      type="button"
      className={['ct-chave', tom, ligada ? 'ct-chave-on' : ''].filter(Boolean).join(' ')}
      aria-pressed={ligada}
      disabled={travado}
      title={titulo}
      onClick={aoAlternar}
      onContextMenu={
        aoMenu
          ? e => {
              e.preventDefault()
              if (!travado) aoMenu(e.currentTarget)
            }
          : undefined
      }
    >
      {ligada ? <Check size={12} weight="bold" /> : null}
      {rotulo}
    </button>
  )
}
