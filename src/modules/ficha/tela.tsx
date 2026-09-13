import { useCallback, useMemo, useState } from 'react'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CopySimple,
  CurrencyDollar,
  Eye,
  FolderOpen,
  FloppyDisk,
  Info,
  Plus,
  Printer,
  Trash,
} from '@phosphor-icons/react'
import { Botao, Pagina, avisar } from '@ds'
import {
  CaixaDeImagem,
  GradeDeTamanhos,
  ModuloDeLayout,
  blocoEmBranco,
  colarBloco,
  copiarBloco,
  temCopia,
  type Bloco,
} from '@dominio/layout'
import {
  abrirFt,
  baixarFt,
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
import { FolhaDaFicha } from './folha'
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
  /* A FOLHA NÃO É OUTRA ROTA, e sim outro estado desta tela. A ficha ainda
     vive só na memória: uma rota separada abriria numa ficha em branco, que é
     pior que não ter folha. Quando o Supabase for a casa dela, a folha vira
     rota com o número do pedido no endereço. */
  const [naFolha, setNaFolha] = useState(false)
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

  /* SALVAR E BAIXAR, e não salvar no banco: enquanto o Supabase não é a casa
     da ficha, o arquivo é o que atravessa de um computador para o outro. E o
     abrir lê os dois formatos, o novo e o .ft da v3.375, que é como o acervo
     inteiro da fábrica entra aqui sem ninguém reescrever nada. */
  async function abrir() {
    try {
      const lida = await abrirFt()
      if (!lida) return
      /* entra como UM passo do histórico: quem abriu o arquivo errado desfaz
         com Ctrl+Z e volta para onde estava */
      mudar(() => lida)
      avisar('Ficha aberta com ' + lida.pecas.length + ' layouts.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não deu para abrir este arquivo.', 'warn')
    }
  }

  if (naFolha) {
    return (
      <FolhaDaFicha
        ficha={ficha}
        comDinheiro={comDinheiro}
        aoTrocarDinheiro={setComDinheiro}
        aoVoltar={() => setNaFolha(false)}
      />
    )
  }

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
          <Botao tom="limpo" icone title="Abrir uma ficha ou um .ft do editor v4" onClick={abrir}>
            <FolderOpen size={18} />
          </Botao>
          <Botao
            tom="limpo"
            icone
            title="Salvar em arquivo"
            onClick={() => {
              baixarFt(ficha)
              avisar('Ficha salva em arquivo.', 'ok')
            }}
          >
            <FloppyDisk size={18} />
          </Botao>
          <Botao tom="contorno" onClick={() => setNaFolha(true)}>
            <Printer size={17} />
            Ver a folha
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
            aoColar={(b) => mudarPeca(i, (x) => ({ ...x, bloco: b }))}
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

/* --- uma peça no documento contínuo --------------------------------------
   O módulo é o da v3.375: duas colunas de mesma largura, a arte à esquerda e
   a ficha técnica à direita. A arte e a tabela chegam de fora porque a arte é
   arquivo e a tabela tem preço, e nenhuma das duas é do bloco. */
function PecaNaFicha({
  peca,
  comDinheiro,
  podeRemover,
  aoMudarBloco,
  aoMudarPreco,
  aoRemover,
  aoColar,
}: {
  peca: PecaDaFicha
  comDinheiro: boolean
  podeRemover: boolean
  aoMudarBloco: (b: Bloco) => void
  aoMudarPreco: (tamanho: string, valor: number | null) => void
  aoRemover: () => void
  aoColar: (b: Bloco) => void
}) {
  const b = peca.bloco
  const info = b.informacoes === true

  return (
    <section className="fc-peca">
      <ModuloDeLayout
        bloco={b}
        aoMudar={aoMudarBloco}
        semValor={!comDinheiro}
        arte={
          <CaixaDeImagem
            imagem={b.imagem}
            arte={b.arte}
            aoMudarImagem={(img) => aoMudarBloco({ ...b, imagem: img })}
          />
        }
        tabela={
          <GradeDeTamanhos
            faixa={b.faixa}
            grade={b.grade}
            aoMudar={(g) => aoMudarBloco({ ...b, grade: g })}
            aoTrocarFaixa={(f) => aoMudarBloco({ ...b, faixa: f })}
            precoBase={comDinheiro ? peca.precoBase : undefined}
            precoPorTamanho={peca.precoPorTamanho}
            aoMudarPreco={aoMudarPreco}
          />
        }
        acoes={
          <>
            <button
              type="button"
              className={info ? 'fc-bt-mod ligado' : 'fc-bt-mod'}
              aria-pressed={info}
              title={
                info
                  ? 'Voltar a ser layout de produção'
                  : 'Transformar em módulo de informações'
              }
              onClick={() => aoMudarBloco({ ...b, informacoes: !info })}
            >
              <Info size={16} />
            </button>

            <button
              type="button"
              className="fc-bt-mod"
              title={temCopia() ? 'Colar o layout copiado' : 'Copiar este layout'}
              onClick={() => {
                if (temCopia()) {
                  const colado = colarBloco(b.n)
                  if (colado) {
                    aoColar({ ...colado, id: b.id, n: b.n })
                    avisar('Layout colado.', 'ok')
                    return
                  }
                }
                copiarBloco(b)
                avisar('Layout copiado. Cole em outro layout ou em outra ficha.', 'ok')
              }}
            >
              <CopySimple size={16} />
            </button>

            {podeRemover ? (
              <button
                type="button"
                className="fc-bt-mod perigo"
                title="Apagar este layout"
                aria-label="Apagar este layout"
                onClick={aoRemover}
              >
                <Trash size={16} />
              </button>
            ) : null}
          </>
        }
      />
    </section>
  )
}
