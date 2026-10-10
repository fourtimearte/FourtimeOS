import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowSquareOut, Check, ClipboardText, Minus, Plus, Warning } from '@phosphor-icons/react'
import { MenuCodigoDeCor, MenuCorDeTecido, MenuTecido, TituloCartao } from '@ds'
import {
  ABAS_DE_COR,
  GRUPOS_DE_COR_DE_TECIDO,
  TIPOS_DE_TECIDO,
  comEtiqueta,
  etiquetaDoDesign,
  type Bloco,
  type Design,
  type EtiquetaDoLayout,
  type TecidoDoBloco,
  type Tecnica,
} from '@dominio/layout'
import { carregarConstrucao, DETALHES, type ConstrucaoDoLayout } from '@dominio/produto'
import './cotacao.css'

/* ==========================================================================
   A FICHA TÉCNICA DO LAYOUT, "interruptores e paleta" (decisão 153).

   Primeira linha, dividida ao meio: o TECIDO (cada um com o quadrado da cor
   antes do nome) e a ETIQUETA (Fourtime ou Cliente, uma só: decisão 152; e a
   técnica dela, Silk, Sub ou DTF). Depois o DESIGN: os cinco interruptores das
   técnicas, sempre à mostra, e uma caixa de cores para cada técnica ligada que
   leva cor (só Sublimação e DTF: decisão 144).

   Embaixo, o que a ficha técnica da REFERÊNCIA diz de como a peça é feita
   (decisão 133): gola, manga, punho, barra, costura, a atenção na costura e
   os aviamentos. Isso é leitura: vem da página Fichas técnicas pelo código do
   layout, e o botão "Abrir a ficha" leva até lá para mudar.
   ========================================================================== */

type DaTecnica = { tecnica: Tecnica; tag: string; rotulo: string; cor: boolean; aba: string; tom: string }
const TECNICAS: DaTecnica[] = [
  { tecnica: 'subli', tag: 'Subli', rotulo: 'Sub', cor: true, aba: 'sub', tom: 'ct-ch-subli' },
  { tecnica: 'dtf', tag: 'DTF', rotulo: 'DTF', cor: true, aba: 'dtf', tom: 'ct-ch-dtf' },
  { tecnica: 'silk', tag: 'Silk', rotulo: 'Silk', cor: false, aba: '', tom: 'ct-ch-silk' },
  { tecnica: 'bordado', tag: 'Bordado', rotulo: 'Bordado', cor: false, aba: '', tom: 'ct-ch-bordado' },
  { tecnica: 'patch', tag: 'Patch', rotulo: 'Patch', cor: false, aba: '', tom: 'ct-ch-patch' },
]

const SEM_COR = { nome: 'sem cor', hex: '' }

/* a construção lida uma vez por código: trocar de layout e voltar não lê de novo */
const lidas = new Map<string, Promise<ConstrucaoDoLayout>>()
export function construcaoDe(cod: string): Promise<ConstrucaoDoLayout> {
  if (!lidas.has(cod)) {
    const p = carregarConstrucao(cod)
    p.catch(() => lidas.delete(cod))
    lidas.set(cod, p)
  }
  return lidas.get(cod)!
}

export function FichaDoLayout({
  bloco,
  travado,
  aoMudar,
}: {
  bloco: Bloco
  travado: boolean
  aoMudar: (b: Bloco) => void
}) {
  const [menu, setMenu] = useState<'' | 'tecido' | 'cor' | 'codigo'>('')
  const [linha, setLinha] = useState(0)
  const [abaAberta, setAbaAberta] = useState<DaTecnica | null>(null)
  const ancora = useRef<HTMLElement | null>(null)
  /* o que foi desligado nesta visita volta com as cores se for religado: um
     clique sem querer no interruptor não pode apagar seis códigos */
  const guardadas = useRef(new Map<string, Design>())

  const mudar = (parte: Partial<Bloco>) => aoMudar({ ...bloco, ...parte })
  const etiqueta = etiquetaDoDesign(bloco.design)
  const mudarEtiqueta = (e: EtiquetaDoLayout) => mudar({ design: comEtiqueta(bloco.design, e) })

  function alternarTecnica(t: DaTecnica) {
    const tem = bloco.design.find((d) => d.tag === t.tag)
    if (tem) {
      guardadas.current.set(t.tag, tem)
      mudar({ design: bloco.design.filter((d) => d.tag !== t.tag) })
    } else {
      const volta = guardadas.current.get(t.tag) ?? { tag: t.tag, tecnica: t.tecnica, cores: [] }
      /* a ordem do design é a da fábrica: as técnicas na ordem dos interruptores, depois do resto */
      const outras = bloco.design.filter((d) => !TECNICAS.some((x) => x.tag === d.tag))
      const tecnicas = TECNICAS.map((x) => (x.tag === t.tag ? volta : bloco.design.find((d) => d.tag === x.tag))).filter(
        (d): d is Design => !!d,
      )
      const etiquetas = outras.filter((d) => d.tecnica === 'etiqueta')
      const acabamentos = outras.filter((d) => d.tecnica !== 'etiqueta')
      mudar({ design: [...etiquetas, ...tecnicas, ...acabamentos] })
    }
  }

  const tecidos: TecidoDoBloco[] = bloco.tecidos.length ? bloco.tecidos : []
  const mudarTecido = (i: number, parte: Partial<TecidoDoBloco>) => {
    const base = tecidos.length ? tecidos : [{ nome: '', cor: SEM_COR.nome, hex: SEM_COR.hex }]
    mudar({ tecidos: base.map((t, k) => (k === i ? { ...t, ...parte } : t)) })
  }

  if (bloco.informacoes) {
    return (
      <section className="cartao ct-ft">
        <header className="ct-ft-cab">
          <TituloCartao icone={ClipboardText}>Ficha técnica do layout</TituloCartao>
        </header>
        <p className="ct-ft-anexo">
          Módulo de informações: anexo do pedido, e não peça de produção. Não tem tecido, design nem grade, e não entra
          em soma nenhuma.
        </p>
      </section>
    )
  }

  const comCor = TECNICAS.filter((t) => t.cor && bloco.design.some((d) => d.tag === t.tag))

  return (
    <section className="cartao ct-ft">
      <header className="ct-ft-cab">
        <TituloCartao icone={ClipboardText}>Ficha técnica do layout</TituloCartao>
        {bloco.referencia ? (
          <a
            className="btn btn-contorno sm"
            href={'/produtos?' + (bloco.referencia.startsWith('FT-KIT') ? 'kit=' : 'ref=') + encodeURIComponent(bloco.referencia)}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowSquareOut size={15} />
            Abrir a ficha
          </a>
        ) : null}
      </header>

      {/* --- tecido | etiqueta ---------------------------------------------- */}
      <div className="ct-ft-par">
        <div className="ct-ft-lado">
          <div className="ct-ft-rot">
            Tecido
            {!travado ? (
              <button
                type="button"
                className="ct-ft-mais"
                aria-label="Acrescentar tecido"
                title="Acrescentar tecido"
                onClick={() => mudar({ tecidos: [...tecidos, { nome: '', cor: SEM_COR.nome, hex: SEM_COR.hex }] })}
              >
                <Plus size={13} />
              </button>
            ) : null}
          </div>
          {(tecidos.length ? tecidos : [{ nome: '', cor: '', hex: '' }]).map((t, i) => (
            <div className="ct-tc" key={i}>
              <button
                type="button"
                className={t.hex ? 'ct-tc-q' : 'ct-tc-q ct-tc-vazio'}
                style={t.hex ? ({ '--cor': t.hex } as CSSProperties) : undefined}
                disabled={travado}
                aria-label={'Cor do tecido: ' + (t.cor || 'sem cor')}
                title={t.cor || 'sem cor'}
                onClick={(e) => {
                  ancora.current = e.currentTarget
                  setLinha(i)
                  setMenu('cor')
                }}
              />
              <span className="ct-tc-txt">
                <button
                  type="button"
                  className="ct-tc-nome"
                  disabled={travado}
                  onClick={(e) => {
                    ancora.current = e.currentTarget
                    setLinha(i)
                    setMenu('tecido')
                  }}
                >
                  {t.nome || (travado ? 'sem tecido' : 'Escolher o tecido')}
                </button>
                <small>{t.cor && t.cor !== SEM_COR.nome ? t.cor : 'sem cor escolhida'}</small>
              </span>
              {!travado && tecidos.length > 1 ? (
                <button
                  type="button"
                  className="ct-ft-menos"
                  aria-label="Tirar este tecido"
                  title="Tirar este tecido"
                  onClick={() => mudar({ tecidos: tecidos.filter((_, k) => k !== i) })}
                >
                  <Minus size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="ct-ft-lado">
          <div className="ct-ft-rot">Etiqueta</div>
          <div className="ct-chaves ct-chaves-2">
            {(['fourtime', 'cliente'] as const).map((tipo) => (
              <Chave
                key={tipo}
                tom={tipo === 'fourtime' ? 'ct-ch-fourtime' : 'ct-ch-cliente'}
                ligada={etiqueta.tipo === tipo}
                travado={travado}
                rotulo={tipo === 'fourtime' ? 'Fourtime' : 'Cliente'}
                aoAlternar={() =>
                  mudarEtiqueta(etiqueta.tipo === tipo ? { tipo: '', tecnica: '' } : { tipo, tecnica: etiqueta.tecnica })
                }
              />
            ))}
          </div>
          <div className="ct-chaves ct-chaves-3">
            {(['silk', 'sub', 'dtf'] as const).map((tec) => (
              <Chave
                key={tec}
                tom={tec === 'sub' ? 'ct-ch-subli' : tec === 'dtf' ? 'ct-ch-dtf' : 'ct-ch-silk'}
                ligada={etiqueta.tecnica === tec}
                travado={travado || !etiqueta.tipo}
                titulo={etiqueta.tipo ? undefined : 'Escolha antes se a etiqueta é da Fourtime ou do cliente'}
                rotulo={tec === 'sub' ? 'Sub' : tec === 'dtf' ? 'DTF' : 'Silk'}
                aoAlternar={() => mudarEtiqueta({ ...etiqueta, tecnica: etiqueta.tecnica === tec ? '' : tec })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* --- design ----------------------------------------------------------- */}
      <div className="ct-ft-design">
        <div className="ct-chaves ct-chaves-5">
          {TECNICAS.map((t) => (
            <Chave
              key={t.tag}
              tom={t.tom}
              ligada={bloco.design.some((d) => d.tag === t.tag)}
              travado={travado}
              rotulo={t.rotulo}
              aoAlternar={() => alternarTecnica(t)}
            />
          ))}
        </div>
        {comCor.length ? (
          <div className="ct-paletas">
            {comCor.map((t) => {
              const d = bloco.design.find((x) => x.tag === t.tag)!
              return (
                <div key={t.tag} className={'ct-paleta ' + t.tom}>
                  <span className="ct-paleta-nome">{t.rotulo}</span>
                  {d.cores.map((c) => (
                    <button
                      key={c.cod}
                      type="button"
                      className="ct-cartao-cor"
                      disabled={travado}
                      title={'Cor ' + c.cod + (travado ? '' : ': clique para abrir a paleta')}
                      onClick={(e) => {
                        ancora.current = e.currentTarget
                        setAbaAberta(t)
                        setMenu('codigo')
                      }}
                    >
                      <i style={{ '--cor': c.hex } as CSSProperties} />
                      <b>{c.cod}</b>
                    </button>
                  ))}
                  {!travado ? (
                    <button
                      type="button"
                      className="ct-cartao-cor ct-cartao-mais"
                      aria-label={'Acrescentar cor em ' + t.rotulo}
                      title="Acrescentar cor"
                      onClick={(e) => {
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

      <Construcao cod={bloco.referencia} />

      <MenuTecido
        aberto={menu === 'tecido'}
        ancora={ancora}
        aoFechar={() => setMenu('')}
        tipos={TIPOS_DE_TECIDO}
        valor={tecidos[linha]?.nome ?? ''}
        aoEscolher={(nome) => mudarTecido(linha, { nome })}
        aoCriar={(nome) => mudarTecido(linha, { nome })}
      />
      <MenuCorDeTecido
        aberto={menu === 'cor'}
        ancora={ancora}
        aoFechar={() => setMenu('')}
        grupos={GRUPOS_DE_COR_DE_TECIDO}
        valor={tecidos[linha]?.cor ?? ''}
        aoEscolher={(cor, hex) => mudarTecido(linha, { cor, hex })}
        aoLimpar={() => mudarTecido(linha, { cor: SEM_COR.nome, hex: SEM_COR.hex })}
      />
      <MenuCodigoDeCor
        aberto={menu === 'codigo'}
        ancora={ancora}
        aoFechar={() => setMenu('')}
        abas={ABAS_DE_COR.filter((a) => !abaAberta || a.id === abaAberta.aba)}
        noLayout={bloco.design.find((d) => d.tag === abaAberta?.tag)?.cores.map((c) => c.cod) ?? []}
        aoAlternar={(cod, hex) => {
          if (!abaAberta) return
          mudar({
            design: bloco.design.map((d) =>
              d.tag === abaAberta.tag
                ? { ...d, cores: d.cores.some((c) => c.cod === cod) ? d.cores.filter((c) => c.cod !== cod) : [...d.cores, { cod, hex }] }
                : d,
            ),
          })
        }}
      />
    </section>
  )
}

/* O INTERRUPTOR (decisão 153): 34 px, sempre com a borda na cor dele, clara
   desligado e cheia ligado; ligado ganha o fundo suave, o texto na cor e o visto. */
function Chave({
  tom,
  ligada,
  travado,
  rotulo,
  titulo,
  aoAlternar,
}: {
  tom: string
  ligada: boolean
  travado: boolean
  rotulo: string
  titulo?: string
  aoAlternar: () => void
}) {
  return (
    <button
      type="button"
      className={['ct-chave', tom, ligada ? 'ct-chave-on' : ''].filter(Boolean).join(' ')}
      aria-pressed={ligada}
      disabled={travado}
      title={titulo}
      onClick={aoAlternar}
    >
      {ligada ? <Check size={12} weight="bold" /> : null}
      {rotulo}
    </button>
  )
}

/* --- a construção da peça, lida da ficha técnica ------------------------------ */
function Construcao({ cod }: { cod: string }) {
  const [c, setC] = useState<ConstrucaoDoLayout | null>(null)
  const [falha, setFalha] = useState(false)
  useEffect(() => {
    let vivo = true
    setC(null)
    setFalha(false)
    if (!cod.trim()) return
    construcaoDe(cod.trim())
      .then((x) => vivo && setC(x))
      .catch(() => vivo && setFalha(true))
    return () => {
      vivo = false
    }
  }, [cod])

  if (!cod.trim()) return <p className="ct-ft-vazio">Escolha a referência para ver como a peça é feita.</p>
  if (falha) return <p className="ct-ft-vazio">Não consegui ler a ficha técnica de {cod} agora.</p>
  if (!c) return <p className="ct-ft-vazio">Lendo a ficha técnica de {cod}...</p>
  if (c.tipo === 'nenhuma')
    return (
      <p className="ct-ft-vazio">
        <Warning size={15} weight="fill" />
        {cod} não tem ficha técnica nas Fichas técnicas.
      </p>
    )

  return (
    <>
      {c.pecas.map((p) => (
        <div key={p.cod + p.papel} className="ct-fab">
          <div className="ct-fab-faixa">
            Fabricação da peça / {p.papel ? p.papel + ' · ' : ''}referência {p.cod}
          </div>
          <div className="ct-fab-pares">
            {DETALHES.map((d) => {
              const texto = (p.detalhes[d.chave] ?? '').trim()
              const [cabeca, ...resto] = texto.split(',')
              return (
                <div key={d.chave} className={d.chave === 'costura' ? 'ct-fab-par ct-fab-largo' : 'ct-fab-par'}>
                  <span className="ct-fab-rot">{d.nome}</span>
                  <b>{cabeca || '-'}</b>
                  {resto.length ? <small>{resto.join(',').trim()}</small> : null}
                </div>
              )
            })}
          </div>
          {p.atencao.trim() ? (
            <div className="ct-fab-atencao">
              <span className="ct-fab-rot">Atenção na costura</span>
              <p>{p.atencao}</p>
            </div>
          ) : null}
          <div className="ct-fab-faixa">Aviamentos e insumos</div>
          {p.aviamentos.length ? (
            <div className="ct-fab-avi">
              {p.aviamentos.map((a, i) => (
                <div key={i} className="ct-fab-av">
                  <b>{a.nome}</b>
                  <span>
                    {a.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {a.unidade}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="ct-ft-vazio">A ficha não tem aviamento nenhum.</p>
          )}
        </div>
      ))}
    </>
  )
}
