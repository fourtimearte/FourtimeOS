import type { CSSProperties, PointerEvent as EventoDePonteiro } from 'react'
import { Paperclip } from '@phosphor-icons/react'
import {
  NOME_DA_TECNICA,
  corDoPosto,
  nomeDoPosto,
  paradoHa,
  vizinhoNaRota,
  type FatiaNoQuadro,
  type Rota,
  type Tag,
} from '@dominio/producao'

/* ==========================================================================
   O cartão do quadro, fechado, do jeito do wireframe de 01/10/2026.

   O DESENHO VEIO DO CARTÃO DO FUNIL, a pedido do Henrique: borda de 2px na
   cor do posto, a cor entrando de leve pelo canto de cima, a bolinha com as
   iniciais, e uma linha com o ponto colorido dizendo de onde o cartão é.
   Nenhum bloco de cor: a cor aparece em três lugares fracos somados.

   O QUE ELE MOSTRA, de cima para baixo: o nome do pedido, o número e a
   técnica, as tags mestre em letra miúda, as tags do posto, e no pé as peças,
   a conversa, o tempo parado e a seta do Terminei.

   ESCOLHIDO NO TRILHO, ELE FICA ESCURO. É o mesmo escuro do cartão aberto do
   trilho, e é isso que liga um ao outro de longe: o que está aceso lá em cima
   é o que está escuro aqui embaixo. Os outros apagam.
   ========================================================================== */

function iniciais(nome: string) {
  const p = nome.split(/\s+/).filter((x) => x.length > 2 || /\d/.test(x))
  const a = (p[0] ?? nome)[0] ?? '?'
  const b = p[1]?.[0] ?? ''
  return (a + b).toUpperCase()
}

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
        <span className="kb-cartao-topo">
          <span className="kb-avatar" aria-hidden="true">
            {iniciais(fatia.nome || fatia.cliente || fatia.numero)}
          </span>
          <span className="kb-nome">{fatia.nome || fatia.cliente}</span>
        </span>
        <span className="kb-origem">
          {fatia.numero} · {NOME_DA_TECNICA[fatia.tecnica] ?? fatia.tecnica}
        </span>
      </button>

      {fatia.marcas.length ? <span className="kb-mestres">{fatia.marcas.join(' · ')}</span> : null}

      {fatia.tags.length || fatia.aviso ? (
        <span className="kb-tags">
          {fatia.aviso ? (
            <span className="kb-tag kb-tag-aviso">
              {fatia.aviso === 'falta-material' ? 'falta material' : fatia.aviso.replace(/-/g, ' ')}
            </span>
          ) : null}
          {fatia.tags.map((chave) => (
            <span key={chave} className="kb-tag">
              {tags.get(chave)?.nome ?? chave}
            </span>
          ))}
        </span>
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
