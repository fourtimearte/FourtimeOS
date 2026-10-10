import { useEffect, useRef, useState } from 'react'
import { ArrowsClockwise, CaretLeft, CaretRight, Copy, Image as Imagem_, Lock, LockOpen, Selection, Trash } from '@phosphor-icons/react'
import { Botao, MenuReferencia, TituloCartao } from '@ds'
import {
  CaixaDeImagem,
  MAX_DESTAQUES,
  grupoDaReferencia,
  imagemDe,
  muralVazio,
  usarReferencias,
  type Bloco,
  type Imagem,
} from '@dominio/layout'
import type { ProdutoCotado } from '@dominio/cotacao'
import { ColunaDosLayouts } from './coluna-dos-layouts'
import { FichaDoLayout } from './ficha-do-layout'
import { CartaoDaGrade } from './grade-deitada'
import { MuralDaArte } from './mural-da-arte'
import './cotacao.css'

/* ==========================================================================
   O CORPO DO EDITOR (prancha 109).

   Três colunas: a ARTE e a GRADE (680 px), a FICHA do layout no meio, e a
   coluna dos LAYOUTS na extrema direita (360 px). Em cima das duas primeiras,
   a barra de referência (decisão 160) e, alinhadas com a ficha, as setas, o
   "Layout 1 de 3" no meio do vão, o Duplicar e o Remover.

   Um layout aberto por vez: a lista da direita escolhe qual.
   ========================================================================== */

const GENEROS: [string, string, string][] = [
  ['', 'Sem gênero', 'ct-g-sem'],
  ['masculino', 'Masculino', 'ct-g-masc'],
  ['feminino', 'Feminino', 'ct-g-fem'],
  ['infantil', 'Infantil', 'ct-g-inf'],
]

export function CorpoDoEditor({
  produtos,
  escolhido,
  travado,
  podeColar,
  aoEscolher,
  aoMudarProduto,
  aoAdicionar,
  aoColar,
  aoDuplicar,
  aoRemover,
}: {
  produtos: ProdutoCotado[]
  escolhido: number
  travado: boolean
  podeColar: boolean
  aoEscolher: (i: number) => void
  aoMudarProduto: (i: number, troca: (p: ProdutoCotado) => ProdutoCotado) => void
  aoAdicionar: () => void
  aoColar: () => void
  aoDuplicar: (i: number) => void
  aoRemover: (i: number) => void
}) {
  const p = produtos[escolhido]
  const mudarBloco = (b: Bloco) => aoMudarProduto(escolhido, (x) => ({ ...x, bloco: b }))

  return (
    <div className="ct-ly">
      {p ? (
        <>
          <BarraDeReferencia bloco={p.bloco} travado={travado} aoMudar={mudarBloco} />
          <div className="ct-ly-acoes">
            <div className="ct-ly-setas">
              <Botao tom="contorno" icone aria-label="Layout anterior" title="Layout anterior" disabled={escolhido <= 0} onClick={() => aoEscolher(escolhido - 1)}>
                <CaretLeft size={17} />
              </Botao>
              <Botao
                tom="contorno"
                icone
                aria-label="Próximo layout"
                title="Próximo layout"
                disabled={escolhido >= produtos.length - 1}
                onClick={() => aoEscolher(escolhido + 1)}
              >
                <CaretRight size={17} />
              </Botao>
            </div>
            <span className="ct-ly-conta">
              Layout {escolhido + 1} de {produtos.length}
            </span>
            {!travado ? (
              <div className="ct-ly-setas">
                <Botao tom="contorno" onClick={() => aoDuplicar(escolhido)}>
                  <Copy size={17} />
                  Duplicar layout
                </Botao>
                <Botao tom="contorno" onClick={() => aoRemover(escolhido)}>
                  <Trash size={17} />
                  Remover layout
                </Botao>
              </div>
            ) : null}
          </div>
          <CartaoDaArte bloco={p.bloco} travado={travado} aoMudar={mudarBloco} />
          <CartaoDaGrade produto={p} travado={travado} aoMudarProduto={(troca) => aoMudarProduto(escolhido, troca)} />
          <div className="ct-ly-ficha">
            <FichaDoLayout bloco={p.bloco} travado={travado} aoMudar={mudarBloco} />
          </div>
        </>
      ) : null}
      <div className="ct-ly-coluna">
        <ColunaDosLayouts
          produtos={produtos}
          escolhido={escolhido}
          travado={travado}
          podeColar={podeColar}
          aoEscolher={aoEscolher}
          aoAdicionar={aoAdicionar}
          aoColar={aoColar}
          aoMudarObservacao={(html) => p && mudarBloco({ ...p.bloco, observacao: html })}
        />
      </div>
    </div>
  )
}

/* A BARRA DE REFERÊNCIA (decisão 160): uma caixa só, de 40 px, em duas portas.
   Na esquerda, o número do layout, o nome com a setinha (troca a referência)
   e, encostados à direita, o código em cima e o grupo embaixo. Na direita, os
   quatro quadrados do gênero, o escolhido no aro preto. */
function BarraDeReferencia({ bloco, travado, aoMudar }: { bloco: Bloco; travado: boolean; aoMudar: (b: Bloco) => void }) {
  const [aberto, setAberto] = useState(false)
  const bt = useRef<HTMLButtonElement>(null)
  /* as referências e os grupos do BANCO (usar-referencias.ts), e não a lista
     de exemplo do /kit */
  const doBanco = usarReferencias()
  const grupo = grupoDaReferencia(doBanco, bloco.referencia)
  return (
    <div className="ct-rf">
      <button
        ref={bt}
        type="button"
        className="ct-rf-ref"
        disabled={travado}
        aria-label="Trocar a referência ou o kit"
        title={travado ? undefined : 'Trocar a referência ou o kit'}
        onClick={() => setAberto(true)}
      >
        <span className="ct-rf-num">{String(bloco.n).padStart(2, '0')}</span>
        <b className="ct-rf-nome">{bloco.nomeDaReferencia || bloco.referencia || 'Escolher a referência'}</b>
        {!travado ? (
          <span className="ct-rf-seta" aria-hidden="true">
            ▼
          </span>
        ) : null}
        <span className="ct-rf-cod">
          <small>{bloco.referencia || 'sem código'}</small>
          <small>{grupo || 'sem grupo'}</small>
        </span>
      </button>
      <span className="ct-rf-gen" role="radiogroup" aria-label="Gênero">
        {GENEROS.map(([g, nome, cls]) => (
          <button
            key={nome}
            type="button"
            role="radio"
            aria-checked={bloco.genero === g}
            aria-label={nome}
            title={nome}
            disabled={travado}
            className={bloco.genero === g ? 'ct-rf-q ct-rf-q-sel' : 'ct-rf-q'}
            onClick={() => aoMudar({ ...bloco, genero: g })}
          >
            <i className={cls} />
          </button>
        ))}
      </span>
      <MenuReferencia
        aberto={aberto}
        ancora={bt}
        aoFechar={() => setAberto(false)}
        refs={doBanco.refs}
        categorias={doBanco.categorias}
        ordem={doBanco.ordem}
        semRefs={
          doBanco.fase === 'falhou'
            ? 'Não consegui ler as referências do banco: ' + doBanco.falha
            : doBanco.fase === 'pronto'
              ? 'Nenhuma referência no banco'
              : 'Carregando as referências do banco...'
        }
        valor={bloco.referencia}
        aoEscolher={(r) =>
          aoMudar({ ...bloco, referencia: r.cod, nomeDaReferencia: r.nome, genero: r.genero, faixa: r.genero === 'infantil' ? 'infantil' : 'adulto' })
        }
        aoCriar={(t) => aoMudar({ ...bloco, referencia: t, nomeDaReferencia: '', genero: '' })}
      />
    </div>
  )
}

/* A ARTE DO LAYOUT: a caixa tem 372 px de altura para a arte larga e 511 para
   a alta (o teste do protótipo da coluna; 12, item 37 (b), em aberto). Trocar e
   Remover moram no cabeçalho do cartão. O highlight do mockup entra aqui na
   parte 4. */
function CartaoDaArte({ bloco, travado, aoMudar }: { bloco: Bloco; travado: boolean; aoMudar: (b: Bloco) => void }) {
  const [dim, setDim] = useState<Imagem | null>(null)
  const [selecionando, setSelecionando] = useState(false)
  const controle = useRef<{ trocar: () => void } | null>(null)
  useEffect(() => {
    setSelecionando(false)
    if (!bloco.imagem) {
      setDim(null)
      return
    }
    let vivo = true
    const im = new Image()
    im.onload = () => vivo && setDim(imagemDe(im.naturalWidth, im.naturalHeight))
    im.src = bloco.imagem
    return () => {
      vivo = false
    }
  }, [bloco.imagem])
  const alta = !!dim && dim.a < 1
  const mural = bloco.destaques
  /* o mural aparece quando há destaque ou quando a pessoa vai escolher um;
     sem nada disso a caixa é a de sempre, que aceita arrastar e colar a arte */
  const comMural = !!bloco.imagem && !!dim && (mural.regs.length > 0 || selecionando)
  /* imagem nova, mural novo: as regiões eram frações da arte de antes */
  const trocarImagem = (img: string) => aoMudar({ ...bloco, imagem: img, destaques: muralVazio() })
  return (
    <section className="cartao ct-arte">
      <header className="ct-arte-cab">
        <TituloCartao icone={Imagem_}>Arte do layout</TituloCartao>
        {bloco.imagem ? (
          <span className="ct-arte-bts">
            {mural.travado ? (
              <>
                <span className="ct-hl-selo">
                  <Lock size={14} />
                  Mural travado
                </span>
                {!travado ? (
                  <Botao tom="contorno" tamanho="sm" onClick={() => aoMudar({ ...bloco, destaques: { ...mural, travado: false } })}>
                    <LockOpen size={16} />
                    Destravar
                  </Botao>
                ) : null}
              </>
            ) : !travado ? (
              <>
                <Botao
                  tom="contorno"
                  tamanho="sm"
                  aria-pressed={selecionando}
                  className={selecionando ? 'ct-hl-modo' : undefined}
                  disabled={!dim || (mural.regs.length >= MAX_DESTAQUES && !selecionando)}
                  onClick={() => setSelecionando((x) => !x)}
                >
                  <Selection size={16} />
                  {selecionando ? 'Pronto' : 'Destacar região'}
                </Botao>
                {mural.regs.length ? (
                  <Botao tom="contorno" tamanho="sm" onClick={() => { setSelecionando(false); aoMudar({ ...bloco, destaques: { ...mural, travado: true } }) }}>
                    <Lock size={16} />
                    Travar o mural
                  </Botao>
                ) : null}
              </>
            ) : null}
            {!travado ? (
              <>
                <Botao tom="contorno" tamanho="sm" icone aria-label="Trocar a arte" title="Trocar a arte" onClick={() => controle.current?.trocar()}>
                  <ArrowsClockwise size={16} />
                </Botao>
                <Botao tom="contorno" tamanho="sm" icone aria-label="Remover a arte" title="Remover a arte" onClick={() => trocarImagem('')}>
                  <Trash size={16} />
                </Botao>
              </>
            ) : null}
          </span>
        ) : null}
      </header>
      <div className={alta ? 'ct-arte-quadro ct-arte-alta' : 'ct-arte-quadro'}>
        {comMural && dim ? (
          <MuralDaArte
            imagem={bloco.imagem}
            dimensoes={dim}
            mural={mural}
            selecionando={selecionando && !travado}
            aoTerminarDeSelecionar={() => setSelecionando(false)}
            aoMudar={(m) => aoMudar({ ...bloco, destaques: m })}
          />
        ) : null}
        {/* a caixa de sempre fica montada (escondida com o mural à vista): é ela
            que sabe abrir o arquivo quando alguém clica em Trocar */}
        <div className={comMural ? 'ct-arte-caixa-oculta' : 'ct-arte-caixa'}>
          <CaixaDeImagem caber controle={controle} leitura={travado} imagem={bloco.imagem} arte={bloco.arte} aoMudarImagem={trocarImagem} />
        </div>
      </div>
      {selecionando ? <p className="ct-hl-dica">Arraste em cima da arte para escolher a região (até {MAX_DESTAQUES}). Esc desiste.</p> : null}
    </section>
  )
}
