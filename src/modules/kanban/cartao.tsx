import type { CSSProperties, PointerEvent as EventoDePonteiro } from 'react'
import { Paperclip } from '@phosphor-icons/react'
import { Etiqueta } from '@ds'
import {
  NOME_DA_TECNICA,
  corDoPosto,
  nomeDoPosto,
  paradoHa,
  tomDaMarca,
  vizinhoNaRota,
  type FatiaNoQuadro,
  type Rota,
  type Tag,
} from '@dominio/producao'

/* ==========================================================================
   O cartão do quadro, fechado, do jeito do wireframe de 01/10/2026.

   O DESENHO VEIO DO CARTÃO DO FUNIL, e em 01/10 o Henrique tirou dele a cor
   e a bolinha: a borda é cinza neutra, igual em todo posto, e o título vem
   sozinho na primeira linha. A única cor que sobrou é o ponto miúdo da linha
   de origem, que diz de que posto o cartão é.

   O QUE ELE MOSTRA, de cima para baixo: o nome do pedido, o número e a
   técnica, a FILEIRA DE TAGS (as mestre, que vêm da cotação, e as do posto,
   separadas por um risco), e no pé as peças, a conversa, o tempo parado e a
   seta do Terminei.

   ESCOLHIDO NO TRILHO, ELE FICA ESCURO. É o mesmo escuro do cartão aberto do
   trilho, e é isso que liga um ao outro de longe: o que está aceso lá em cima
   é o que está escuro aqui embaixo. Os outros apagam.
   ========================================================================== */

function Fala() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function Relogio() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Seta() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CartaoDaFatia({
  fatia,
  rotas,
  tags,
  podeMover,
  arrastando,
  aceso,
  apagado,
  aoPegar,
  aoAbrir,
  aoTerminar,
}: {
  fatia: FatiaNoQuadro
  rotas: Rota[]
  tags: Map<string, Tag>
  podeMover: boolean
  arrastando: boolean
  /* o pedido deste cartão é o que está aberto no trilho */
  aceso?: boolean
  /* há um pedido aberto no trilho, e não é o deste cartão */
  apagado?: boolean
  aoPegar: (e: EventoDePonteiro) => void
  aoAbrir: () => void
  aoTerminar: () => void
}) {
  const dias = paradoHa(fatia.etapaEm)
  const proximo = vizinhoNaRota(rotas, fatia.tecnica, fatia.etapa, 1)
  const empacado = dias >= 3 && fatia.etapa !== 'finalizado'
  const classes = [
    'kb-cartao',
    arrastando ? 'saindo' : '',
    aceso ? 'escuro' : '',
    apagado ? 'apagado' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className={classes}
      onPointerDown={aoPegar}
      style={{ '--c': corDoPosto(fatia.etapa) } as CSSProperties}
    >
      {/* O CARTÃO INTEIRO ABRE, e é um botão de verdade: um article com
          onClick não recebe Tab, e esta tela roda em tablet onde metade das
          pessoas chega nas coisas pelo teclado de acessibilidade. */}
      <button type="button" className="kb-abrir" onClick={aoAbrir}>
        <span className="kb-nome">{fatia.nome || fatia.cliente}</span>
        {/* uma linha só: o número nunca quebra, e se não couber quem leva
            as reticências é a técnica */}
        <span className="kb-origem">
          <span>
            {fatia.numero} · {NOME_DA_TECNICA[fatia.tecnica] ?? fatia.tecnica}
          </span>
        </span>
      </button>

      {/* A FILEIRA DE TAGS. As mestre primeiro, porque valem para o pedido
          inteiro e em todo posto; um risco; e depois as do posto, que mudam o
          dia todo. São as mesmas etiquetas do cartão aberto, com a cor de
          cada uma, para a tag ser reconhecida de longe pela cor. */}
      {fatia.marcas.length || fatia.tags.length || fatia.aviso ? (
        <div className="kb-fileira">
          {fatia.marcas.map((m) => (
            <Etiqueta key={'m-' + m} mestre pequena tom={tomDaMarca(m)}>
              {m}
            </Etiqueta>
          ))}
          {fatia.marcas.length && (fatia.tags.length || fatia.aviso) ? (
            <span className="kb-risco" aria-hidden="true" />
          ) : null}
          {fatia.aviso ? (
            <Etiqueta pequena tom="vermelha">
              {fatia.aviso === 'falta-material' ? 'falta material' : fatia.aviso.replace(/-/g, ' ')}
            </Etiqueta>
          ) : null}
          {fatia.tags.map((chave) => {
            const t = tags.get(chave)
            return (
              <Etiqueta key={chave} pequena tom={t?.tom ?? 'cinza'}>
                {t?.nome ?? chave}
              </Etiqueta>
            )
          })}
        </div>
      ) : null}

      <footer className="kb-pe">
        <b className="kb-pecas">{fatia.pecas} pçs</b>
        <span className="kb-empurra" />
        {fatia.falas ? (
          <span className="kb-sinal" title={fatia.falas + ' na conversa'}>
            <Fala />
            {fatia.falas}
          </span>
        ) : null}
        {fatia.anexos ? (
          <span className="kb-sinal" title={fatia.anexos + ' anexo(s)'}>
            <Paperclip size={13} weight="bold" />
            {fatia.anexos}
          </span>
        ) : null}
        <span
          className={empacado ? 'kb-parado forte' : 'kb-parado'}
          title={dias === 0 ? 'chegou hoje neste posto' : `parado há ${dias} dia${dias === 1 ? '' : 's'}`}
        >
          <Relogio />
          {dias === 0 ? 'hoje' : dias + ' d'}
        </span>

        {/* SÓ A SETA, QUADRADA, CLARA E COM BORDA, decisão de 29/09. O alvo
            continua com 44px no toque. */}
        {podeMover && proximo ? (
          <button
            type="button"
            className="kb-terminei"
            aria-label={'Terminar aqui e mandar para ' + nomeDoPosto(proximo)}
            title={'Terminar aqui e mandar para ' + nomeDoPosto(proximo)}
            /* o clique não pode virar arrasto: sem isto, tocar o botão
               começa a arrastar o cartão junto */
            onPointerDown={(e) => e.stopPropagation()}
            onClick={aoTerminar}
          >
            <Seta />
          </button>
        ) : null}
      </footer>
    </article>
  )
}
