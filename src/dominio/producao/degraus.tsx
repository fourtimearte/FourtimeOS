import { CheckCircle } from '@phosphor-icons/react'
import { PilulaTecnica, Selo } from '@ds'
import { corDoPosto, faltamPostos, nomeDoPosto, paradoHa, rotaDe } from './kanban'
import { NOME_DA_TECNICA } from './tipos'
import type { FatiaNoQuadro, Rota } from './kanban'
import type { Etapa } from './tipos'
import './degraus.css'

/* ==========================================================================
   A ROTA DE UMA FATIA, EM DEGRAUS.

   Ela mora no domínio, e não numa tela, porque duas telas fazem a mesma
   pergunta: o modal da timeline no painel de atividades pergunta "onde foi
   parar cada pedaço deste pedido", e o pedido aberto no MARK45 pergunta a
   mesma coisa enquanto a pessoa olha os layouts. Duas montagens diferentes
   para a mesma peça é como nasce a tela que discorda da outra sobre onde o
   cartão está.

   É o mesmo motivo do ModuloDeLayout, que o editor, a ficha e o cartão do
   quadro compartilham desde a fusão. A diferença é que aqui a peça é de
   `dominio/producao`, e não de `dominio/layout`, porque ela fala de rota e de
   posto.

   Os nomes das classes continuam começando por `tl-` de propósito: elas
   nasceram no painel, os dois temas já foram conferidos com esses nomes, e
   renomear trocaria uma peça que funciona por um dia de conferência.
   ========================================================================== */

export function BlocoDaFatia({
  fatia,
  rotas,
  segurando,
}: {
  fatia: FatiaNoQuadro
  rotas: Rota[]
  segurando: boolean
}) {
  const rota = rotaDe(rotas, fatia.tecnica)
  const onde = rota.indexOf(fatia.etapa)
  const dias = paradoHa(fatia.etapaEm)
  const faltam = faltamPostos(rotas, fatia.tecnica, fatia.etapa)
  const pronta = fatia.etapa === 'finalizado'

  return (
    <section className={segurando ? 'tl-fatia segura' : 'tl-fatia'}>
      <header className="tl-cab">
        <PilulaTecnica tecnica={fatia.tecnica} tamanho="sm">
          {NOME_DA_TECNICA[fatia.tecnica] ?? fatia.tecnica}
        </PilulaTecnica>

        {/* QUAIS LAYOUTS ESTÃO NESTE CARTÃO. Sem isto o bloco responde "a
            sublimação está na calandra" e deixa de fora a pergunta seguinte,
            que é qual peça é a sublimação. */}
        <span className="tl-lay">
          {fatia.layouts.length
            ? fatia.layouts.map((n) => 'L-' + String(n).padStart(2, '0')).join(', ')
            : 'sem layout marcado'}
        </span>

        <span className="tl-pecas">{fatia.pecas} pçs</span>

        {pronta ? (
          <Selo tom="ok">
            <CheckCircle size={13} weight="bold" />
            finalizada
          </Selo>
        ) : segurando ? (
          <Selo tom="brand" forma="contorno">
            segura o pedido
          </Selo>
        ) : null}
      </header>

      {/* A ROTA EM DEGRAUS, DE CIMA PARA BAIXO.

          Em pé e não deitada, e isso é decisão de tela e não de gosto: são até
          nove postos com nomes como "Impressão sublimação", e deitados eles
          dão 38px de largura cada um no celular do galpão. Nome cortado num
          quadro que a fábrica lê de longe não é economia de espaço, é um posto
          que ninguém reconhece. */}
      {rota.length ? (
        <ol className="tl-passos">
          {rota.map((p, i) => (
            <Degrau
              key={p}
              posto={p}
              estado={i < onde ? 'andou' : i === onde ? 'agora' : 'falta'}
              dias={i === onde ? dias : -1}
              segurando={segurando}
            />
          ))}
        </ol>
      ) : (
        <p className="tl-sem-rota">
          A técnica <b>{fatia.tecnica}</b> não tem rota cadastrada, então não dá para dizer quanto
          falta. Ela está em <b>{nomeDoPosto(fatia.etapa)}</b>.
        </p>
      )}

      <footer className="tl-pe">
        {pronta
          ? 'Terminou a rota.'
          : onde < 0
            ? 'Está em ' + nomeDoPosto(fatia.etapa) + ', que está fora da rota desta técnica.'
            : faltam === 0
              ? 'Está no último posto da rota.'
              : 'Faltam ' + faltam + ' posto' + (faltam === 1 ? '' : 's') + ' para o fim da rota.'}
        {!pronta && dias >= 3 ? (
          <b className="tl-empacado">
            parada há {dias} dias no mesmo posto
          </b>
        ) : null}
      </footer>
    </section>
  )
}

function Degrau({
  posto,
  estado,
  dias,
  segurando,
}: {
  posto: Etapa
  estado: 'andou' | 'agora' | 'falta'
  dias: number
  segurando: boolean
}) {
  /* A COR DO PONTO É A DO POSTO, e ela é identidade: Impressão DTF é rosa no
     quadro, na ficha e aqui. O vermelho de "segura o pedido" entra pela tarja
     da esquerda do bloco, e não pintando o ponto, senão o posto perderia a cor
     que a fábrica inteira usa para reconhecê-lo. */
  return (
    <li className={'tl-passo ' + estado + (segurando && estado === 'agora' ? ' trava' : '')}>
      {/* O PONTO DO QUE AINDA NÃO ACONTECEU NÃO LEVA A COR DO POSTO, e não é
          detalhe: um ponto rosa em "Prensa DTF" que ainda falta diz para o
          olho que aquilo já foi. O que falta é um anel vazio, e só. */}
      <span
        className="tl-ponto"
        style={estado === 'falta' ? undefined : { background: corDoPosto(posto) }}
      />
      <span className="tl-posto">{nomeDoPosto(posto)}</span>
      <span className="tl-quando">
        {estado === 'agora'
          ? dias === 0
            ? 'chegou hoje'
            : 'há ' + dias + ' dia' + (dias === 1 ? '' : 's')
          : estado === 'andou'
            ? 'andou'
            : ''}
      </span>
    </li>
  )
}
