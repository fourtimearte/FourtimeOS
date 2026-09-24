import type { PointerEvent as EventoDePonteiro } from 'react'
import { ArrowRight, ChatCircleText, Paperclip, Warning } from '@phosphor-icons/react'
import { Etiqueta, PilulaTecnica, Selo } from '@ds'
import {
  NOME_DA_TECNICA,
  nomeDoPosto,
  paradoHa,
  tomDaMarca,
  vizinhoNaRota,
  type FatiaNoQuadro,
  type Rota,
  type Tag,
} from '@dominio/producao'

/* ==========================================================================
   O cartão do MARK45, fechado.

   O que fica do lado de fora foi decidido pelo Henrique em 22/09, e está em
   claude/DECISAO-O-CARTAO-DO-MARK45.md: número, nome do pedido, a fileira das
   tags mestre, as tags do posto, peças, tempo parado, os ícones de anexo e o
   botão Terminei.

   SEM MINIATURA DOS LAYOUTS. Elas enchiam o cartão e não respondiam nenhuma
   pergunta que se faça olhando o quadro de longe. Quem quer ver o layout abre
   o cartão, e lá ele aparece grande, do jeito da cotação.

   A FILEIRA DAS MESTRES TEM UMA LINHA EM CIMA E OUTRA EMBAIXO, e fundo nenhum.
   A tag mestre vem do cabeçalho da cotação e vale para o pedido inteiro, em
   todo posto e para sempre; a tag de baixo é do posto e muda o dia todo. Duas
   coisas com formatos parecidos e vidas diferentes precisam de uma linha entre
   elas, e um fundo cinza faria a faixa parecer outro cartão dentro do cartão.
   ========================================================================== */

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
  /* o pedido deste cartão é o que está escolhido no trilho */
  aceso?: boolean
  /* há um pedido escolhido no trilho, e não é o deste cartão */
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
    empacado ? 'empacado' : '',
    aceso ? 'aceso' : '',
    apagado ? 'apagado' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={classes} onPointerDown={aoPegar}>
      {/* O CARTÃO INTEIRO ABRE, e é um botão de verdade: um article com
          onClick não recebe Tab, e esta tela roda em tablet onde metade das
          pessoas chega nas coisas pelo teclado de acessibilidade. */}
      <button type="button" className="kb-abrir" onClick={aoAbrir}>
        <span className="kb-cartao-topo">
          <b>{fatia.numero}</b>
          <PilulaTecnica tecnica={fatia.tecnica} tamanho="sm">
            {NOME_DA_TECNICA[fatia.tecnica] ?? fatia.tecnica}
          </PilulaTecnica>
          {fatia.teste ? <Selo tom="info">teste</Selo> : null}
        </span>
        {/* AS PEÇAS SOBEM PARA A LINHA DO NOME. No rodapé elas dividiam o
            espaço com o tempo parado e com o botão, e "160 pçs, chegou hoje"
            acabava cortado no meio: sumia justamente o "chegou hoje", que é a
            metade que responde se o cartão está empacado. */}
        <span className="kb-nome">
          <span className="n">{fatia.nome}</span>
          <span className="q">{fatia.pecas} pçs</span>
        </span>
      </button>

      {fatia.marcas.length ? (
        <div className="kb-mestres">
          {fatia.marcas.map((m) => (
            <Etiqueta key={m} mestre tom={tomDaMarca(m)}>
              {m}
            </Etiqueta>
          ))}
        </div>
      ) : null}

      <div className="kb-corpo">
        {fatia.tags.length ? (
          <div className="kb-tags">
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

        {fatia.aviso ? (
          <p className="kb-aviso">
            <Warning size={14} />
            {fatia.aviso === 'falta-material' ? 'desceu com falta de material' : fatia.aviso}
          </p>
        ) : null}

        <footer className="kb-pe">
          <span className={empacado ? 'kb-parado forte' : 'kb-parado'}>
            {dias === 0 ? 'chegou hoje' : `parado ${dias} dia${dias === 1 ? '' : 's'}`}
          </span>

          {/* OS SINAIS, e não os arquivos. O cartão diz que existe conversa e
              que existe anexo; o que eles são fica dentro. Um clipe a menos
              aqui é uma linha a mais de nome de cliente, e o nome é o que a
              pessoa procura varrendo a coluna com o olho. */}
          {fatia.falas ? (
            <span className="kb-sinal" title={fatia.falas + ' na conversa'}>
              <ChatCircleText size={16} weight="bold" />
              {fatia.falas}
            </span>
          ) : null}
          {fatia.anexos ? (
            <span className="kb-sinal" title={fatia.anexos + ' anexo(s)'}>
              <Paperclip size={16} weight="bold" />
              {fatia.anexos}
            </span>
          ) : null}

          {/* SÓ A SETA, E EM CLARO COM BORDA.

              Ele era vermelho com a palavra Terminei, e num quadro de treze
              colunas isso é uma parede de vermelho: a cor da marca é ação e
              ATRASO no V7, e quando ela se repete em cada cartão ela para de
              querer dizer qualquer coisa. O que precisa gritar num quadro é o
              cartão empacado, não o botão que se aperta o dia inteiro.

              A palavra saiu porque o destino já está no title e a seta já é a
              gramática do quadro: o cartão anda para a direita. Quem duvida
              passa o dedo e lê "Terminar aqui e mandar para Calandra".

              É um botão nosso e não o Botao do DS porque nenhuma variante de
              lá é quadrada: as do V7 têm recheio lateral para caber texto, e
              aqui não há texto. O alvo continua com 44px no toque. */}
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
              <ArrowRight size={16} weight="bold" />
            </button>
          ) : null}
        </footer>
      </div>
    </article>
  )
}
