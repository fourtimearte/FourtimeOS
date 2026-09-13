import { useEffect, useMemo, useRef, useState } from 'react'
import { Aviso, Botao, Pagina } from '@ds'
import { EMPRESA, EMPRESA_A_CONFERIR } from '@dominio/empresa'
import {
  CaixaDeImagem,
  Folha,
  GradeDeTamanhos,
  Medidor,
  ModuloDeLayout,
  Palco,
  imprimir,
  usarPaginacao,
  type BlocoDaFolha,
} from '@dominio/layout'
import { pecasDaFicha, valorDaFicha, type Ficha, type PecaDaFicha } from '@dominio/ficha'
import { CabecalhoDaProducao } from './cabecalho'
import './ficha.css'

/* ==========================================================================
   A folha A4 da ficha de produção.

   O DOCUMENTO É O MESMO. Na tela ele é contínuo e rola; no papel ele é
   cortado em folhas de 297 mm. O conteúdo de um layout não muda de um para o
   outro, e isso não é economia de código: é a promessa de que o que a fábrica
   lê na mesa de corte é exatamente o que o vendedor viu na tela. Duas
   montagens diferentes para a mesma peça é como nasce a ficha que "na tela
   estava certo".

   Por isso o módulo aqui é o mesmo ModuloDeLayout, em modo leitura. O que
   muda é só o que sobra: os botões somem, os campos viram texto, e os
   tamanhos sem peça nenhuma não são impressos.

   COM VALOR E SEM VALOR são duas folhas diferentes do mesmo pedido. Quem leva
   para a mesa de corte não precisa ver preço, e mandar preço para o galpão é
   como um valor de venda vira assunto de corredor. O padrão daqui é SEM, e o
   botão está ao lado para quando a folha é a do comercial.
   ========================================================================== */

/* O palpite inicial: a folha inteira menos margem, cabeçalho e rodapé, por
   alto. Ele serve só para o primeiro desenho; logo depois o corpo da primeira
   folha é MEDIDO e o número certo toma o lugar. Palpite de altura é o jeito
   clássico de perder a última linha de cada página. */
const ALTURA_CHUTADA = 1123 - 91 - 210 - 64

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function FolhaDaFicha({
  ficha,
  comDinheiro,
  aoTrocarDinheiro,
  aoVoltar,
}: {
  ficha: Ficha
  comDinheiro: boolean
  aoTrocarDinheiro: (v: boolean) => void
  aoVoltar: () => void
}) {
  const blocos: BlocoDaFolha[] = useMemo(
    () =>
      ficha.pecas.map((p) => ({
        id: p.bloco.id,
        conteudo: <PecaNaFolha peca={p} comDinheiro={comDinheiro} />,
      })),
    [ficha.pecas, comDinheiro],
  )

  /* a chave diz quando o conteúdo mudou de verdade: sem ela a medição rodaria
     a cada desenho e nunca pararia */
  const chave = ficha.id + ':' + ficha.mudadaEm + ':' + ficha.pecas.length + ':' + comDinheiro
  const [alturaUtil, setAlturaUtil] = useState(ALTURA_CHUTADA)
  const palco = useRef<HTMLDivElement>(null)
  const { medidor, paginas } = usarPaginacao(blocos, alturaUtil, chave)

  /* mede o corpo de verdade da primeira folha e refaz a conta com ele */
  useEffect(() => {
    const corpo = palco.current?.querySelector('.fl-corpo')
    if (!corpo) return
    /* clientHeight e não getBoundingClientRect: o palco encolhe a folha com
       transform quando a tela é estreita, e o retângulo sairia encolhido
       junto. A conta da página é em milímetro de papel, não em pixel de tela */
    const h = corpo.clientHeight
    if (h > 200 && Math.abs(h - alturaUtil) > 2) setAlturaUtil(h)
  })

  const pecas = pecasDaFicha(ficha)
  const reais = valorDaFicha(ficha)

  return (
    <Pagina
      acima={
        <button type="button" className="fc-volta" onClick={aoVoltar}>
          Voltar ao editor
        </button>
      }
      titulo={'Folha da ficha ' + (ficha.cabecalho.pedido || ficha.cabecalho.nome || '')}
      sub={
        'O que vai para a mesa de corte, do jeito que sai na impressora. ' +
        paginas.length +
        (paginas.length === 1 ? ' página.' : ' páginas.')
      }
      acoes={
        <>
          <Botao tom="contorno" onClick={() => aoTrocarDinheiro(!comDinheiro)}>
            {comDinheiro ? 'Tirar os valores' : 'Mostrar os valores'}
          </Botao>
          <Botao tom="contorno" onClick={aoVoltar}>
            Editar
          </Botao>
          <Botao tom="primario" onClick={imprimir}>
            Imprimir ou salvar em PDF
          </Botao>
        </>
      }
    >
      {EMPRESA_A_CONFERIR ? (
        <div className="fl-nao-imprime" style={{ marginBottom: 'var(--sp-5)' }}>
          <Aviso tom="warn" titulo="O rodapé ainda está com dados de molde">
            Endereço e CNPJ da Fourtime ainda não foram preenchidos no sistema. Eles aparecem no
            rodapé de toda folha impressa.
          </Aviso>
        </div>
      ) : null}

      <Medidor aoMedir={medidor} blocos={blocos} />

      <div ref={palco}>
        <Palco>
          {paginas.map((pagina, i) => (
            <Folha
              key={i}
              numero={i + 1}
              de={paginas.length}
              cabecalho={
                <CabecalhoDaProducao
                  cab={ficha.cabecalho}
                  aoMudar={() => {}}
                  totalDePecas={pecas}
                  totalEmReais={reais}
                  comDinheiro={comDinheiro}
                  leitura
                />
              }
              rodape={<RodapeDaFabrica pecas={pecas} reais={reais} comDinheiro={comDinheiro} />}
            >
              {pagina.map((b) => (
                <div key={b.id} className="fc-folha-peca">
                  {b.conteudo}
                </div>
              ))}
            </Folha>
          ))}
        </Palco>
      </div>
    </Pagina>
  )
}

/* --- uma peça na folha ----------------------------------------------------
   O MESMO módulo da tela, em leitura. Ver o comentário do topo: o que a
   fábrica lê tem que ser o que o vendedor viu. */
function PecaNaFolha({ peca, comDinheiro }: { peca: PecaDaFicha; comDinheiro: boolean }) {
  const b = peca.bloco
  return (
    <ModuloDeLayout
      bloco={b}
      aoMudar={() => {}}
      leitura
      semValor={!comDinheiro}
      arte={<CaixaDeImagem imagem={b.imagem} arte={b.arte} leitura />}
      tabela={
        <GradeDeTamanhos
          leitura
          faixa={b.faixa}
          grade={b.grade}
          precoBase={comDinheiro ? peca.precoBase : undefined}
          precoPorTamanho={peca.precoPorTamanho}
        />
      }
    />
  )
}

/* --- o rodapé da fábrica -------------------------------------------------
   Endereço à esquerda, a conta à direita. O total de PEÇAS vem sempre, porque
   é o número que a produção confere; o dinheiro só quando a folha é a do
   comercial. */
function RodapeDaFabrica({
  pecas,
  reais,
  comDinheiro,
}: {
  pecas: number
  reais: number
  comDinheiro: boolean
}) {
  return (
    <div className="fc-rodape">
      <span className="fc-rodape-empresa">
        <b>{EMPRESA.nome}</b> · {EMPRESA.endereco} · {EMPRESA.cidade}, {EMPRESA.uf} · CNPJ{' '}
        {EMPRESA.cnpj}
      </span>
      <span className="fc-rodape-conta">
        <b>{pecas}</b> peças
        {comDinheiro ? <> · {dinheiro(reais)}</> : null}
      </span>
    </div>
  )
}
