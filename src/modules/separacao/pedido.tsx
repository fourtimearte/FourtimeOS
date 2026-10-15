import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CheckCircle, FileText, Sigma, X } from '@phosphor-icons/react'
import { Botao, Entrada, Esqueleto, Selo, Tabela, TituloCartao, Vazio, avisar, type Coluna } from '@ds'
import { acharCotacao } from '@dominio/cotacao'
import type { Bloco } from '@dominio/layout'
import {
  carregarMaterialDosLayouts,
  carregarOndeFica,
  carregarReservasDoPedido,
  casasDaUnidade,
  comecarASeparacao,
  concluirASeparacao,
  desfazerASeparacao,
  numeroNaUnidade,
  separarMaterial,
  type MaterialDoLayout,
  type PedidoNaSeparacao,
  type ReservaDoPedido,
} from '@dominio/estoque'
import { ModalDaFolha } from '@modules/cotacao'
import { dataCurta } from './fila'
import { CartaoDoLayout, FichaDoLayoutNaSeparacao } from './layout'

/* ==========================================================================
   O PEDIDO ESCOLHIDO (prancha 83). O cabeçalho (S1): o estado, o pedido e os
   layouts, o cliente, a linha com peças, departamento, entrega e vendedor, e
   Ver o orçamento, Concluir a separação e Fechar. Depois um cartão por layout
   (S2): o que foi negociado e o material daquele layout, com a conta. No fim
   a Soma de tudo, onde se marca o que saiu (S3 redesenha).

   A TELA SEMPRE PERGUNTA QUANTO SAIU. O número reservado já vem escrito no
   campo, mas quem separa confirma ou corrige: a reserva é uma conta e a
   separação é uma pesagem, e quando as duas discordam quem está certo é a
   balança.

   CONCLUIR NÃO EXIGE QUE TUDO TENHA SAÍDO. Quem decide se o pedido desce com
   falta é o PCP, e para decidir ele precisa que o pedido chegue lá com a falta
   escrita.
   ========================================================================== */

const NOME_DA_CATEGORIA: Record<string, string> = { tecido: 'Tecido', aviamento: 'Aviamento', insumo: 'Insumo' }
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function PedidoAberto({
  p,
  aoMexer,
  aoConcluir,
  aoFechar,
}: {
  p: PedidoNaSeparacao
  /** a fila muda junto: o contador "x de y" é a mesma verdade */
  aoMexer: () => Promise<void>
  aoConcluir: () => Promise<void>
  aoFechar: () => void
}) {
  const [linhas, setLinhas] = useState<ReservaDoPedido[]>([])
  const [abrindo, setAbrindo] = useState(true)
  const [ocupado, setOcupado] = useState('')
  /* A LEITURA QUE FALHOU FICA GUARDADA, e não vira lista vazia: "Nenhum
     material neste pedido" com a fila dizendo "0 de 1" ao lado é uma frase
     plausível e falsa. */
  const [erro, setErro] = useState('')
  const [pesado, setPesado] = useState<Record<string, string>>({})
  const [folha, setFolha] = useState(false)
  /* os layouts como o orçamento diz, e o material de cada um (062) */
  const [blocos, setBlocos] = useState<Bloco[] | null>(null)
  const [porLayout, setPorLayout] = useState<MaterialDoLayout[] | null>([])
  /* onde fica cada material no depósito */
  const [onde, setOnde] = useState<Map<string, string>>(new Map())
  const [ficha, setFicha] = useState<Bloco | null>(null)

  useEffect(() => {
    let vivo = true
    setBlocos(null)
    Promise.all([
      p.cotacaoId ? acharCotacao(p.cotacaoId).catch(() => null) : Promise.resolve(null),
      carregarMaterialDosLayouts(p.id).catch(() => [] as MaterialDoLayout[]),
    ]).then(([c, m]) => {
      if (!vivo) return
      setBlocos(c ? c.produtos.map((x) => x.bloco).filter((b) => !b.informacoes) : [])
      setPorLayout(m)
    })
    return () => {
      vivo = false
    }
  }, [p.id, p.cotacaoId])

  const abrir = useCallback(async () => {
    setErro('')
    try {
      const r = await carregarReservasDoPedido(p.id)
      setLinhas(r)
      void carregarOndeFica(r.map((x) => x.materialId)).then(setOnde)
      setPesado((antes) => {
        const novo: Record<string, string> = {}
        r.forEach((x) => {
          novo[x.id] = antes[x.id] ?? (x.semConsumo ? '' : String(x.quantidade).replace('.', ','))
        })
        return novo
      })
    } catch (e) {
      const recado = e instanceof Error ? e.message : 'Não consegui ler o material do pedido.'
      setLinhas([])
      setErro(recado)
      avisar(recado, 'brand')
    } finally {
      setAbrindo(false)
    }
  }, [p.id])

  useEffect(() => {
    setAbrindo(true)
    setPesado({})
    void abrir()
  }, [abrir])

  const lido = (texto: string) => {
    const n = Number(texto.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  async function separar(l: ReservaDoPedido, fixo?: number) {
    if (ocupado) return
    const quanto = fixo ?? lido(pesado[l.id] ?? '')
    if (quanto <= 0) {
      avisar('Escreva quanto pesou.', 'warn')
      return
    }
    setOcupado(l.id)
    try {
      /* o pedido entra em separação quando a primeira linha sai da prateleira,
         e não quando alguém abre para olhar */
      if (p.estado === 'aprovado') await comecarASeparacao(p.id)
      await separarMaterial(l.id, quanto)
      await Promise.all([abrir(), aoMexer()])
      avisar(`${numeroNaUnidade(quanto, l.unidade)} de ${l.material} pesado e guardado. Sai do estoque quando o pedido entrar na produção.`, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui separar.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  async function desfazer(l: ReservaDoPedido) {
    if (ocupado) return
    setOcupado(l.id)
    try {
      await desfazerASeparacao(l.id)
      await Promise.all([abrir(), aoMexer()])
      avisar(l.pesada ? `A pesagem de ${l.material} foi desfeita.` : `${l.material} voltou para a prateleira.`, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui desfazer.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  async function concluir() {
    if (ocupado) return
    setOcupado('concluir')
    try {
      const recado = await concluirASeparacao(p.id)
      avisar(recado, recado.includes('falta') ? 'warn' : 'ok')
      await aoConcluir()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui concluir.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  const separados = linhas.filter((l) => l.baixada).length

  /* de quais layouts vem cada material, e a cor dele, pelo consumo (062) */
  const layoutsDe = (materialId: string) =>
    [...new Set((porLayout ?? []).filter((m) => m.materialId === materialId).map((m) => 'L-' + String(m.ordem).padStart(2, '0')))].join(' + ')
  const corDe = (materialId: string) => (porLayout ?? []).find((m) => m.materialId === materialId)?.corHex ?? ''
  const curto = (l: ReservaDoPedido) => !l.baixada && !l.semConsumo && l.saldo < l.quantidade

  /* SEPARAR O QUE TEM: a prateleira não cobre, então sai o que há nela e o
     resto vira a falta que o PCP lê. É a mesma pesagem, só que com o campo
     já no saldo. */
  function separarOQueTem(l: ReservaDoPedido) {
    setPesado((x) => ({ ...x, [l.id]: String(l.saldo).replace('.', ',') }))
    void separar(l, l.saldo)
  }

  const colunas: Coluna<ReservaDoPedido>[] = [
    {
      chave: 'material',
      titulo: 'Material',
      celula: (l) => (
        <span className="sp-mat">
          {l.categoria === 'tecido' && corDe(l.materialId) ? <i className="sp-q" style={{ '--cor': corDe(l.materialId) } as CSSProperties} /> : null}
          <span className="pilha colada">
            <b className="sp-nome">{l.material}</b>
            <small className="sp-apoio sp-nome">
              {NOME_DA_CATEGORIA[l.categoria] ?? l.categoria}
              {layoutsDe(l.materialId) ? ' · ' + layoutsDe(l.materialId) : ''}
              {l.semConsumo ? ' · consumo não cadastrado' : ''}
              {/* no celular a coluna Precisa some e o número desce para cá */}
              {l.semConsumo ? null : <span className="sp-no-celular">{' · precisa ' + numeroNaUnidade(l.quantidade, l.unidade)}</span>}
            </small>
          </span>
        </span>
      ),
    },
    {
      chave: 'precisa',
      titulo: 'Precisa',
      numero: true,
      celula: (l) => (l.semConsumo ? <Selo tom="warn">não sei</Selo> : <b>{numeroNaUnidade(l.quantidade, l.unidade)}</b>),
    },
    {
      chave: 'tem',
      titulo: 'Na prateleira',
      numero: true,
      celula: (l) =>
        curto(l) ? (
          <span className="pilha colada sp-fim">
            <b className="sp-pouco">{numeroNaUnidade(l.saldo, l.unidade)}</b>
            <small className="sp-pouco">falta {numeroNaUnidade(l.quantidade - l.saldo, l.unidade)}</small>
          </span>
        ) : (
          <span className="sp-apoio">{numeroNaUnidade(l.saldo, l.unidade)}</span>
        ),
    },
    {
      chave: 'onde',
      titulo: 'Onde fica',
      celula: (l) => <span className="sp-apoio">{onde.get(l.materialId) || 'sem lugar'}</span>,
    },
    {
      chave: 'saiu',
      titulo: 'Pesado',
      numero: true,
      celula: (l) =>
        l.baixada ? (
          <b className="sp-saiu">{numeroNaUnidade(l.separado, l.unidade)}</b>
        ) : (
          <Entrada
            tamanho="sm"
            inputMode="decimal"
            className="sp-campo"
            value={pesado[l.id] ?? ''}
            disabled={ocupado === l.id}
            placeholder={casasDaUnidade(l.unidade) ? '0,0' : '0'}
            aria-label={'Quanto pesou ' + l.material + ', em ' + l.unidade}
            onChange={(e) => {
              const v = e.currentTarget.value
              setPesado((x) => ({ ...x, [l.id]: v }))
            }}
          />
        ),
    },
    {
      chave: 'acao',
      titulo: '',
      celula: (l) =>
        l.baixada ? (
          <Botao tom="limpo" tamanho="sm" onClick={() => void desfazer(l)} disabled={!!ocupado}>
            Desfazer
          </Botao>
        ) : curto(l) && l.saldo > 0 ? (
          <Botao tom="contorno" tamanho="sm" onClick={() => separarOQueTem(l)} carregando={ocupado === l.id} disabled={!!ocupado}>
            <span className="sp-fora-do-celular">Pesar o que tem</span>
            <span className="sp-no-celular">O que tem</span>
          </Botao>
        ) : (
          <Botao tom="forte" tamanho="sm" onClick={() => void separar(l)} carregando={ocupado === l.id} disabled={!!ocupado}>
            Pesar e guardar
          </Botao>
        ),
    },
  ]

  return (
    <div className="sp-aberto">
      <header className="sp-ped-topo">
        <div className="sp-ped-tit">
          <span className="sp-ped-caminho">
            <Selo tom={p.estado === 'separacao' ? 'info' : 'neutro'}>{p.estado === 'separacao' ? 'em separação' : 'esperando'}</Selo>
            <span>
              {p.numero}
              {p.layouts ? ' › ' + plural(p.layouts, 'layout', 'layouts') : ''}
            </span>
          </span>
          <h2>{p.cliente || 'sem cliente'}</h2>
          <small>
            {p.pecas} peças · {p.departamento || 'sem departamento'} · entrega {dataCurta(p.entregaEm)}
            {p.vendedor ? ' · vendido por ' + p.vendedor : ''}
          </small>
        </div>
        <div className="fileira">
          {p.cotacaoId ? (
            <Botao tom="contorno" onClick={() => setFolha(true)}>
              <FileText size={17} />
              Ver o orçamento
            </Botao>
          ) : null}
          {/* CONCLUIR FICA TRANCADO ENQUANTO A LISTA NÃO ABRIU: a falta é
              calculada do que foi baixado, e concluir sem ter visto o material
              carimba uma falta que ninguém conferiu */}
          <Botao
            tom="primario"
            onClick={() => void concluir()}
            carregando={ocupado === 'concluir'}
            disabled={!!ocupado || !!erro || abrindo}
            title={erro ? 'A lista de material não abriu. Recarregue a página antes de concluir.' : undefined}
          >
            <CheckCircle size={17} />
            Concluir a separação
          </Botao>
          <Botao tom="contorno" onClick={aoFechar}>
            <X size={17} />
            Fechar
          </Botao>
        </div>
      </header>

      {blocos === null ? (
        <Esqueleto altura={260} />
      ) : (
        blocos.map((b, i) => (
          <CartaoDoLayout
            key={b.id}
            bloco={b}
            materiais={porLayout === null ? null : porLayout.filter((m) => m.ordem === posicaoNoOrcamento(blocos, i))}
            reservas={linhas}
            aoVerFicha={() => setFicha(b)}
          />
        ))
      )}

      <section className="cartao sp-quadro">
        <header className="sp-cab">
          <TituloCartao icone={Sigma}>Soma de tudo</TituloCartao>
          <span className="sp-cab-apoio">
            {blocos && blocos.length > 1 ? `os ${blocos.length} layouts juntos · ` : ''}aqui se anota o que pesou
          </span>
        </header>
        {abrindo ? (
          <div className="sp-espera">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        ) : (
          <Tabela
            colunas={colunas}
            linhas={linhas}
            chaveDaLinha={(l) => l.id}
            vazio={
              erro ? (
                <Vazio
                  titulo="Não consegui ler o material deste pedido"
                  texto={erro + ' A fila ao lado diz quantos materiais este pedido tem; não conclua a separação enquanto esta lista não abrir.'}
                />
              ) : (
                <Vazio
                  titulo="Nenhum material neste pedido"
                  texto="A reserva nasce da aprovação e depende do consumo cadastrado. Sem material cadastrado para os tecidos deste layout, não há o que separar: concluir manda o pedido direto para o PCP."
                />
              )
            }
          />
        )}
        <footer className="sp-pe sp-pe-fim">
          <small className="sp-apoio">
            {erro ? 'a lista de material não abriu' : linhas.length ? `${separados} de ${linhas.length} materiais separados` : 'sem material para separar'}.
            Concluir move o pedido para o PCP, com falta ou sem.
          </small>
          <Botao tom="primario" onClick={() => void concluir()} carregando={ocupado === 'concluir'} disabled={!!ocupado || !!erro || abrindo}>
            <CheckCircle size={17} />
            Concluir a separação
          </Botao>
        </footer>
      </section>

      <FichaDoLayoutNaSeparacao
        bloco={ficha}
        materiais={ficha && porLayout ? porLayout.filter((m) => m.ordem === ficha.n) : null}
        reservas={linhas}
        aoFechar={() => setFicha(null)}
      />
      {folha && p.cotacaoId ? <ModalDaFolha cotacaoId={p.cotacaoId} numeroDoPedido={p.numero} aoFechar={() => setFolha(false)} /> : null}
    </div>
  )
}

/* a posição do layout no orçamento conta também o módulo de informações, que
   não aparece aqui: o consumo (062) guarda a posição de verdade */
function posicaoNoOrcamento(blocos: Bloco[], i: number): number {
  return blocos[i].n || i + 1
}
