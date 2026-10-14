import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowSquareOut, ClipboardText, Minus, Plus, Warning } from '@phosphor-icons/react'
import { MenuTecidoECor, TituloCartao } from '@ds'
import { type Bloco, type TecidoDoBloco } from '@dominio/layout'
import { carregarConstrucao, DETALHES, type ConstrucaoDoLayout } from '@dominio/produto'
import './cotacao.css'
import { usarTecidosDoEstoque } from './usar-tecidos-do-estoque'
import { ChavesDaEtiqueta, EditorDoDesign } from './pecas-da-ficha'

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
  const [menu, setMenu] = useState<'' | 'tecido'>('')
  /* o tecido e a cor vêm do que está cadastrado no Estoque (11/10/2026) */
  const doEstoque = usarTecidosDoEstoque()
  const [linha, setLinha] = useState(0)
  const ancora = useRef<HTMLElement | null>(null)
  const mudar = (parte: Partial<Bloco>) => aoMudar({ ...bloco, ...parte })
  const tecidos: TecidoDoBloco[] = bloco.tecidos.length ? bloco.tecidos : []
  /* linha -1 é o "+": o tecido escolhido entra numa linha nova. Sem tecido
     nenhum, a primeira escolha é a linha 0 */
  const escolherTecido = (i: number, novo: TecidoDoBloco) => {
    if (i < 0 || !tecidos.length) mudar({ tecidos: [...tecidos, novo] })
    else mudar({ tecidos: tecidos.map((t, k) => (k === i ? novo : t)) })
  }

  if (bloco.informacoes) {
    return (
      <section className="cartao ct-ft">
        <header className="ct-ft-cab">
          <TituloCartao icone={ClipboardText}>Ficha técnica do layout</TituloCartao>
        </header>
        <p className="ct-ft-anexo">
          Módulo de informações: anexo do pedido, e não peça de produção. Não tem tecido, design nem
          grade, e não entra em soma nenhuma.
        </p>
      </section>
    )
  }

  return (
    <section className="cartao ct-ft">
      <header className="ct-ft-cab">
        <TituloCartao icone={ClipboardText}>Ficha técnica do layout</TituloCartao>
        {bloco.referencia ? (
          <a
            className="btn btn-contorno sm"
            href={
              '/produtos?' +
              (bloco.referencia.startsWith('FT-KIT') ? 'kit=' : 'ref=') +
              encodeURIComponent(bloco.referencia)
            }
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
                onClick={e => {
                  ancora.current = e.currentTarget
                  setLinha(-1)
                  setMenu('tecido')
                }}
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
                onClick={e => {
                  ancora.current = e.currentTarget
                  setLinha(i)
                  setMenu('tecido')
                }}
              />
              <span className="ct-tc-txt">
                <button
                  type="button"
                  className="ct-tc-nome"
                  disabled={travado}
                  onClick={e => {
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
          <ChavesDaEtiqueta bloco={bloco} travado={travado} aoMudar={aoMudar} />
        </div>
      </div>

      {/* --- design ----------------------------------------------------------- */}
      <EditorDoDesign bloco={bloco} travado={travado} aoMudar={aoMudar} />

      <Construcao cod={bloco.referencia} />

      <MenuTecidoECor
        aberto={menu === 'tecido'}
        ancora={ancora}
        aoFechar={() => setMenu('')}
        grupos={doEstoque.grupos}
        tecido={linha >= 0 ? (tecidos[linha]?.nome ?? '') : ''}
        cor={linha >= 0 ? (tecidos[linha]?.cor ?? '') : ''}
        semTecidos={
          doEstoque.fase === 'falhou'
            ? 'Não consegui ler o estoque: ' + doEstoque.falha
            : doEstoque.fase === 'pronto'
              ? 'Nenhum tecido com cor cadastrada no Estoque'
              : 'Carregando os tecidos do estoque...'
        }
        aoEscolher={(t, c) =>
          escolherTecido(linha, { nome: t.nome, cor: c.nome, hex: c.hex, materialId: c.id })
        }
      />
    </section>
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
      .then(x => vivo && setC(x))
      .catch(() => vivo && setFalha(true))
    return () => {
      vivo = false
    }
  }, [cod])

  if (!cod.trim())
    return <p className="ct-ft-vazio">Escolha a referência para ver como a peça é feita.</p>
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
      {c.pecas.map(p => (
        <div key={p.cod + p.papel} className="ct-fab">
          <div className="ct-fab-faixa">
            Fabricação da peça / {p.papel ? p.papel + ' · ' : ''}referência {p.cod}
          </div>
          <div className="ct-fab-pares">
            {DETALHES.map(d => {
              const texto = (p.detalhes[d.chave] ?? '').trim()
              const [cabeca, ...resto] = texto.split(',')
              return (
                <div
                  key={d.chave}
                  className={d.chave === 'costura' ? 'ct-fab-par ct-fab-largo' : 'ct-fab-par'}
                >
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
