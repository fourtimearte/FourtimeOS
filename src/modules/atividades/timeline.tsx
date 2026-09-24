import { useEffect, useState } from 'react'
import { ArrowSquareOut, CheckCircle } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { Botao, Esqueleto, Modal, PilulaTecnica, Selo, Vazio } from '@ds'
import {
  NOME_DA_TECNICA,
  carregarAsFatiasDoPedido,
  carregarAsRotas,
  corDoPosto,
  faltamPostos,
  nomeDoPosto,
  paradoHa,
  quemSeguraOPedido,
  rotaDe,
  type Etapa,
  type FatiaNoQuadro,
  type Pedido,
  type Rota,
} from '@dominio/producao'
import './timeline.css'

/* ==========================================================================
   O modal da timeline do painel de atividades.

   ELE É O QUE TORNA HONESTA A COLUNA "ATUALIZAÇÃO". O painel mostra UM posto
   por pedido, e o pedido quase nunca está num posto só: ele foi fatiado por
   técnica lá no PCP, e cada fatia anda no ritmo dela. A coluna mostra a fatia
   mais atrasada, que é a resposta certa para a pergunta "o que está segurando
   a entrega", e é uma resposta que esconde as outras.

   Colapsar só é honesto quando existe um jeito de abrir, e o jeito precisa
   estar onde a pergunta nasce. Por isso o botão fica na própria linha.

   A TIMELINE É POR FATIA, E NÃO POR LAYOUT. O desenho de 21/09 dizia "uma
   timeline por layout", e o kanban de 22/09 decidiu que o cartão é por técnica
   com os layouts juntos. Dois layouts de DTF do mesmo pedido estão no mesmo
   cartão, sempre, no mesmo posto: desenhar duas timelines idênticas para eles
   seria inventar uma diferença que a fábrica não tem. Cada bloco diz quais
   layouts estão dentro dele, que é a informação que faltava.
   ========================================================================== */

export function ModalDaTimeline({
  pedido,
  aoFechar,
}: {
  pedido: Pedido
  aoFechar: () => void
}) {
  const navegar = useNavigate()
  const [fatias, setFatias] = useState<FatiaNoQuadro[] | null>(null)
  const [rotas, setRotas] = useState<Rota[]>([])
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    Promise.all([carregarAsFatiasDoPedido(pedido.id), carregarAsRotas()])
      .then(([f, r]) => {
        if (!vivo) return
        setFatias(f)
        setRotas(r)
      })
      .catch((e) => {
        if (!vivo) return
        setFatias([])
        setErro(e instanceof Error ? e.message : 'Não consegui ler as fatias deste pedido.')
      })
    return () => {
      vivo = false
    }
  }, [pedido.id])

  const segura = fatias && rotas.length ? quemSeguraOPedido(rotas, fatias) : ''
  const prontas = fatias ? fatias.filter((f) => f.etapa === 'finalizado').length : 0

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largo
      titulo={`${pedido.numero}, onde está cada parte`}
      pe={
        <>
          <Botao tom="contorno" onClick={aoFechar}>
            Fechar
          </Botao>
          <Botao tom="forte" onClick={() => navegar('/kanban')}>
            Abrir no quadro
            <ArrowSquareOut size={16} weight="bold" />
          </Botao>
        </>
      }
    >
      <p className="tl-sub">
        <b>{pedido.cliente}</b>
        <i>·</i>
        {pedido.pecas} peças
        <i>·</i>
        {/* "0 finalizadas" nao e informacao, e ruido: ele ocupa a linha para
            dizer que nada aconteceu. So aparece quando ha o que contar. */}
        {fatias
          ? (fatias.length === 1 ? '1 fatia no quadro' : fatias.length + ' fatias no quadro') +
            (prontas
              ? ', ' + prontas + ' finalizada' + (prontas === 1 ? '' : 's')
              : '')
          : 'lendo o quadro...'}
      </p>

      {erro ? <Vazio titulo="Não consegui ler o quadro" texto={erro} /> : null}

      {!fatias && !erro ? (
        <>
          <Esqueleto altura={120} />
          <Esqueleto altura={120} />
        </>
      ) : null}

      {/* O PEDIDO SEM FATIA NENHUMA NÃO É UM ERRO, É UM ESTADO.

          Ele existe de verdade: o pedido foi aprovado em venda e ainda não
          passou pelo portão do PCP, então nunca teve cartão. Desenhar um vazio
          genérico aqui faria parecer que a consulta falhou, e a pessoa iria
          procurar defeito no sistema em vez de procurar o pedido no PCP. */}
      {fatias && !fatias.length && !erro ? (
        <Vazio
          titulo="Este pedido ainda não desceu para o quadro"
          texto="As fatias nascem quando o diretor aprova a produção, na tela do PCP. Até lá o pedido não tem cartão em posto nenhum."
        />
      ) : null}

      {fatias?.map((f) => (
        <BlocoDaFatia key={f.id} fatia={f} rotas={rotas} segurando={f.id === segura} />
      ))}
    </Modal>
  )
}

/* --- uma fatia, com a rota dela em degraus -------------------------------- */
function BlocoDaFatia({
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
