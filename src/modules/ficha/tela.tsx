import { useCallback, useMemo, useState } from 'react'
import { ArrowCounterClockwise, ArrowClockwise, CurrencyDollar, Eye, Plus, Printer, Trash } from '@phosphor-icons/react'
import { Botao, Pagina, avisar } from '@ds'
import { FileiraDoLayout, GradeDeTamanhos, blocoEmBranco, type Bloco } from '@dominio/layout'
import {
  fichaEmBranco,
  pecasDaFicha,
  useAtalhosDoHistorico,
  useHistorico,
  valorDaFicha,
  type CabecalhoDaFicha,
  type Ficha,
  type PecaDaFicha,
} from '@dominio/ficha'
import { CabecalhoDaProducao } from './cabecalho'
import './ficha.css'

/* ==========================================================================
   A ficha de produção.

   É o editor da v3.375 trazido para o visual novo. O documento é CONTÍNUO:
   cabeçalho, e abaixo dele os layouts um atrás do outro, rolando. A folha A4
   e a quebra de página existem na impressão, que é onde a folha existe de
   verdade; na tela, papel é metáfora que só atrapalha a rolagem.

   Modo com valor e sem valor: é a mesma ficha, e o que muda são as colunas de
   dinheiro da tabela e o total do cabeçalho. Quem leva a ficha para a mesa de
   corte não precisa ver preço, e quem fecha a venda precisa.
   ========================================================================== */

export function TelaFicha() {
  const inicial = useMemo(() => fichaEmBranco(), [])
  const h = useHistorico<Ficha>(inicial)
  useAtalhosDoHistorico(h)

  const [comDinheiro, setComDinheiro] = useState(true)
  const ficha = h.valor

  const mudar = useCallback(
    (troca: (f: Ficha) => Ficha, junta?: boolean) => {
      h.mudar((f) => ({ ...troca(f), mudadaEm: new Date().toISOString() }), { junta })
    },
    [h],
  )

  const mudarCabecalho = useCallback(
    (parte: Partial<CabecalhoDaFicha>) =>
      mudar((f) => ({ ...f, cabecalho: { ...f.cabecalho, ...parte } }), true),
    [mudar],
  )

  const mudarPeca = useCallback(
    (i: number, troca: (p: PecaDaFicha) => PecaDaFicha) =>
      mudar((f) => ({ ...f, pecas: f.pecas.map((p, k) => (k === i ? troca(p) : p)) })),
    [mudar],
  )

  const acrescentar = useCallback(
    () =>
      mudar((f) => ({
        ...f,
        pecas: [
          ...f.pecas,
          { bloco: blocoEmBranco(f.pecas.length + 1), precoBase: 0, precoPorTamanho: {} },
        ],
      })),
    [mudar],
  )

  const remover = useCallback(
    (i: number) =>
      mudar((f) => ({
        ...f,
        /* renumera na hora: L-03 depois de apagar o L-02 seria um selo que não
           corresponde a nada na conversa da fábrica */
        pecas: f.pecas.filter((_, k) => k !== i).map((p, k) => ({ ...p, bloco: { ...p.bloco, n: k + 1 } })),
      })),
    [mudar],
  )

  const pecas = pecasDaFicha(ficha)
  const reais = valorDaFicha(ficha)

  return (
    <Pagina
      acima="Produção"
      titulo={ficha.cabecalho.nome || 'Nova ficha'}
      sub={
        ficha.cabecalho.pedido
          ? ficha.cabecalho.pedido + ' · ' + ficha.pecas.length + ' layouts'
          : 'Rascunho · ' + ficha.pecas.length + ' layouts'
      }
      acoes={
        <>
          <Botao
            tom="limpo"
            icone
            title="Desfazer (Ctrl+Z)"
            disabled={!h.podeDesfazer}
            onClick={h.desfazer}
          >
            <ArrowCounterClockwise size={18} />
          </Botao>
          <Botao
            tom="limpo"
            icone
            title="Refazer (Ctrl+Y)"
            disabled={!h.podeRefazer}
            onClick={h.refazer}
          >
            <ArrowClockwise size={18} />
          </Botao>
          <Botao
            tom="contorno"
            onClick={() => setComDinheiro((v) => !v)}
            title={comDinheiro ? 'Esconder os valores' : 'Mostrar os valores'}
          >
            {comDinheiro ? <Eye size={17} /> : <CurrencyDollar size={17} />}
            {comDinheiro ? 'Ocultar valores' : 'Mostrar valores'}
          </Botao>
          <Botao
            tom="contorno"
            onClick={() => avisar('A impressão entra junto com a folha A4 da ficha.', 'info')}
          >
            <Printer size={17} />
            Imprimir
          </Botao>
          <Botao tom="primario" onClick={acrescentar}>
            <Plus size={17} />
            Novo layout
          </Botao>
        </>
      }
    >
      <div className="fc-doc">
        <CabecalhoDaProducao
          cab={ficha.cabecalho}
          aoMudar={mudarCabecalho}
          totalDePecas={pecas}
          totalEmReais={reais}
          comDinheiro={comDinheiro}
        />

        {ficha.pecas.map((p, i) => (
          <PecaNaFicha
            key={p.bloco.id}
            peca={p}
            comDinheiro={comDinheiro}
            podeRemover={ficha.pecas.length > 1}
            aoMudarBloco={(b) => mudarPeca(i, (x) => ({ ...x, bloco: b }))}
            aoMudarPreco={(tam, v) =>
              mudarPeca(i, (x) => {
                const precos = { ...x.precoPorTamanho }
                if (v === null) delete precos[tam]
                else precos[tam] = v
                return { ...x, precoPorTamanho: precos }
              })
            }
            aoRemover={() => remover(i)}
          />
        ))}

        <button type="button" className="fc-mais-layout" onClick={acrescentar}>
          <Plus size={18} />
          Novo layout
        </button>
      </div>
    </Pagina>
  )
}

/* --- uma peça no documento contínuo -------------------------------------- */
function PecaNaFicha({
  peca,
  comDinheiro,
  podeRemover,
  aoMudarBloco,
  aoMudarPreco,
  aoRemover,
}: {
  peca: PecaDaFicha
  comDinheiro: boolean
  podeRemover: boolean
  aoMudarBloco: (b: Bloco) => void
  aoMudarPreco: (tamanho: string, valor: number | null) => void
  aoRemover: () => void
}) {
  const b = peca.bloco
  return (
    <section className="fc-peca">
      <FileiraDoLayout
        bloco={b}
        aoMudar={aoMudarBloco}
        arranjo="campos"
        selo={<span className="fc-selo-lay">L-{String(b.n).padStart(2, '0')}</span>}
        acoes={
          podeRemover ? (
            <button
              type="button"
              className="fc-apagar"
              title="Apagar este layout"
              aria-label="Apagar este layout"
              onClick={aoRemover}
            >
              <Trash size={16} />
            </button>
          ) : null
        }
      />

      <div className="fc-grade">
        <GradeDeTamanhos
          faixa={b.faixa}
          grade={b.grade}
          aoMudar={(g) => aoMudarBloco({ ...b, grade: g })}
          aoTrocarFaixa={(f) => aoMudarBloco({ ...b, faixa: f })}
          precoBase={comDinheiro ? peca.precoBase : undefined}
          precoPorTamanho={peca.precoPorTamanho}
          aoMudarPreco={aoMudarPreco}
        />
        {b.observacao ? <p className="fc-obs">{b.observacao}</p> : null}
      </div>
    </section>
  )
}
