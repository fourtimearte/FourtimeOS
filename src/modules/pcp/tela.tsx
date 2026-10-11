import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowFatLineDown } from '@phosphor-icons/react'
import { Botao, Busca, Esqueleto, Modal, Pagina, Segmentado, Seletor, Vazio, avisar, semAcento } from '@ds'
import { acharCotacao, fatiasDaCotacao } from '@dominio/cotacao'
import {
  LIBERADOS_A_VISTA,
  carregarLiberados,
  carregarOPcp,
  liberarParaProducao,
  type PedidoLiberado,
  type PedidoNoPcp,
} from '@dominio/producao'
import { pode, souAdmin, useSessao } from '@dominio/sessao'
import { GrupoDaFila, LinhaDoLiberado, LinhaDoPcp, dataCurta, temFalta } from './fila'
import { LiberadoAberto, PedidoAberto } from './pedido'
import { ResumoDoPcp } from './resumo'
import './pcp.css'

/* ==========================================================================
   PCP, planejamento e controle de produção. O portão. No desenho do
   wireframe (pranchas 87 a 92; parte P1 em 11/10/2026, FOURTIME OS - 12,
   4.0c).

   O CAMINHO: funil -> cotação -> pedido -> separação -> PCP -> kanban. A
   separação vem antes de propósito: ela descobre a verdade sobre o estoque,
   e o PCP decide o que fazer com o que faltou.

   DUAS APROVAÇÕES, E NÃO UMA. O PCP confere e MARCA; quem APROVA é o
   diretor de produção. A migração 032 recusa liberar um pedido que ninguém
   marcou, venha o pedido de onde vier.

   AS ABAS: No portão (Conferindo e Esperando o diretor), Devolvidos (o PCP
   devolveu ao vendedor; o pedido continua no PCP, decisão de 11/10/2026) e
   Liberados (os que já desceram, com quem aprovou). À esquerda a fila; à
   direita, com nada escolhido, os números, as entregas mais próximas e a
   mesa do diretor; com um pedido escolhido, o pedido.

   APROVAR EM LOTE NÃO É UM CLIQUE SOZINHO: a confirmação mostra a lista do
   que vai descer, com a falta em vermelho, antes de ir.
   ========================================================================== */

type Aba = 'portao' | 'devolvidos' | 'liberados'
type Ordem = 'entrega' | 'cliente' | 'pecas'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function TelaPcp() {
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null

  /* Quem edita o PCP confere e marca; quem tem controle total aprova. A tela
     lê a matriz em vez de perguntar o papel. Devolver ao vendedor é ação do
     PCP (063): a tela mostra o botão a quem confere, e o banco cobra a
     ação pcp.ao_vendedor. */
  const podeMarcar = !!eu && pode(eu, 'pcp', 'editar')
  const podeAprovar = !!eu && (pode(eu, 'pcp', 'total') || souAdmin(eu))

  const [fila, setFila] = useState<PedidoNoPcp[]>([])
  const [liberados, setLiberados] = useState<PedidoLiberado[] | null>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('portao')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('entrega')
  const [escolhido, setEscolhido] = useState('')
  /* a mesa do diretor: o que está marcado para descer */
  const [naMesa, setNaMesa] = useState<string[]>([])
  const [confirmando, setConfirmando] = useState<PedidoNoPcp[] | null>(null)
  const [aprovando, setAprovando] = useState(false)
  /* os pedidos que a mesa já viu: o que o diretor desmarcou não volta
     marcado na próxima leitura */
  const vistosNaMesa = useRef(new Set<string>())
  const direita = useRef<HTMLDivElement>(null)

  /* NO CELULAR E NO TABLET a fila fica em cima do pedido: escolher leva a
     tela até ele, senão o toque parece não ter feito nada */
  useEffect(() => {
    const d = direita.current
    if (!escolhido || !d) return
    const fila = d.previousElementSibling as HTMLElement | null
    if (fila && d.offsetTop > fila.offsetTop + 10) d.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [escolhido])

  const recarregar = useCallback(async () => {
    const [f, l] = await Promise.all([carregarOPcp(), carregarLiberados().catch(() => [] as PedidoLiberado[])])
    setFila(f)
    setLiberados(l)
    /* o que chega à mesa sem falta já vem marcado; o com falta, o diretor
       marca de propósito; o que saiu da mesa sai da lista */
    setNaMesa((m) => {
      const mesa = f.filter((p) => p.marcado)
      const vistos = vistosNaMesa.current
      const novos = mesa.filter((p) => !m.includes(p.id) && !temFalta(p) && !vistos.has(p.id)).map((p) => p.id)
      mesa.forEach((p) => vistos.add(p.id))
      return [...m.filter((id) => mesa.some((p) => p.id === id)), ...novos]
    })
    return f
  }, [])

  useEffect(() => {
    let vivo = true
    recarregar()
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Não consegui ler a fila do PCP.'))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [recarregar])

  const b = semAcento(busca.trim())
  const bate = (numero: string, cliente: string) => !b || semAcento(numero + ' ' + cliente).includes(b)
  const ordenar = <T extends { entregaEm: string; cliente: string; pecas: number; numero: string }>(l: T[]) =>
    [...l].sort((x, y) =>
      ordem === 'cliente'
        ? x.cliente.localeCompare(y.cliente, 'pt-BR')
        : ordem === 'pecas'
          ? y.pecas - x.pecas
          : (x.entregaEm || '9999').localeCompare(y.entregaEm || '9999') || x.numero.localeCompare(y.numero),
    )

  const portao = useMemo(() => fila.filter((p) => !p.comOVendedor), [fila])
  const devolvidos = useMemo(() => fila.filter((p) => p.comOVendedor), [fila])
  const mesa = useMemo(() => ordenar(portao.filter((p) => p.marcado)), [portao, ordem]) // eslint-disable-line react-hooks/exhaustive-deps

  const daAba = ordenar((aba === 'devolvidos' ? devolvidos : portao).filter((p) => bate(p.numero, p.cliente)))
  const conferindo = daAba.filter((p) => !p.marcado)
  const esperando = daAba.filter((p) => p.marcado)
  const libs = (liberados ?? []).filter((p) => bate(p.numero, p.cliente))

  const aberto = aba !== 'liberados' ? fila.find((p) => p.id === escolhido) ?? null : null
  const liberadoAberto = aba === 'liberados' ? (liberados ?? []).find((p) => p.id === escolhido) ?? null : null

  function escolher(id: string) {
    setEscolhido((x) => (x === id ? '' : id))
  }

  function abrir(id: string) {
    const p = fila.find((x) => x.id === id)
    if (!p) return
    setAba(p.comOVendedor ? 'devolvidos' : 'portao')
    setEscolhido(id)
  }

  /* LIBERAR É O VERBO, E ELE PRECISA DAS FATIAS. Quem transforma grade em
     peça é o domínio da cotação, e não o banco: a cotação de cada pedido é
     lida aqui antes de descer. */
  async function aprovar(lista: PedidoNoPcp[]) {
    setAprovando(true)
    let foram = 0
    const erros: string[] = []
    for (const p of lista) {
      try {
        const c = await acharCotacao(p.cotacaoId)
        if (!c) throw new Error('não achei a cotação deste pedido')
        const fatias = fatiasDaCotacao(c)
        if (!fatias.length) throw new Error('nenhuma técnica de produção no documento')
        await liberarParaProducao(p.id, fatias)
        foram++
      } catch (e) {
        erros.push(`${p.numero}: ${e instanceof Error ? e.message : 'falhou'}`)
      }
    }
    setConfirmando(null)
    setAprovando(false)
    if (lista.some((p) => p.id === escolhido)) setEscolhido('')
    await recarregar().catch(() => null)
    if (erros.length) avisar(`${foram} de ${lista.length} desceram. ${erros.join(' · ')}`, 'warn')
    else avisar(foram === 1 ? `${lista[0].numero} está no chão de fábrica.` : `${foram} pedidos desceram para a fábrica.`, 'ok')
  }

  const conta = { portao: portao.length, devolvidos: devolvidos.length, liberados: liberados?.length ?? 0 }
  const pecas = portao.reduce((s, p) => s + p.pecas, 0)
  const ROTULO: Record<Aba, string> = { portao: 'No portão', devolvidos: 'Devolvidos', liberados: 'Liberados' }
  const comoOrdena = ordem === 'entrega' ? 'pela entrega' : ordem === 'cliente' ? 'pelo cliente' : 'pelas peças'

  let lista: ReactNode
  if (aba === 'liberados') {
    lista =
      liberados === null ? (
        <Vazio titulo="A lista dos liberados ainda não existe" texto="Falta rodar a migração 063 no banco." />
      ) : !libs.length ? (
        <Vazio titulo="Nenhum pedido liberado" texto={b ? 'Nada com esse nome ou número.' : 'O pedido aparece aqui quando o diretor aprova para a produção.'} />
      ) : (
        <GrupoDaFila
          nome="Liberados"
          apoio={libs.length >= LIBERADOS_A_VISTA ? `os ${LIBERADOS_A_VISTA} mais recentes` : 'o mais recente primeiro'}
        >
          {libs.map((p) => (
            <LinhaDoLiberado key={p.id} p={p} escolhido={p.id === escolhido} aoEscolher={() => escolher(p.id)} />
          ))}
        </GrupoDaFila>
      )
  } else if (!daAba.length) {
    lista = (
      <Vazio
        titulo={aba === 'devolvidos' ? 'Nenhum pedido devolvido' : 'Nada no portão'}
        texto={
          b
            ? 'Nada com esse nome ou número.'
            : aba === 'devolvidos'
              ? 'Quando o PCP devolve um pedido ao vendedor, ele espera aqui, com o motivo.'
              : 'Pedido chega aqui quando a separação é concluída.'
        }
      />
    )
  } else {
    const linha = (p: PedidoNoPcp) => <LinhaDoPcp key={p.id} p={p} escolhido={p.id === escolhido} aoEscolher={() => escolher(p.id)} />
    lista =
      aba === 'devolvidos' ? (
        <GrupoDaFila nome="Com o vendedor" apoio={plural(daAba.length, 'pedido', 'pedidos') + ' · ' + comoOrdena}>
          {daAba.map(linha)}
        </GrupoDaFila>
      ) : (
        <>
          {conferindo.length ? (
            <GrupoDaFila nome="Conferindo" apoio={conferindo.length + ' · com o PCP'}>
              {conferindo.map(linha)}
            </GrupoDaFila>
          ) : null}
          {esperando.length ? (
            <GrupoDaFila nome="Esperando o diretor" apoio={esperando.length + ' · já conferidos'}>
              {esperando.map(linha)}
            </GrupoDaFila>
          ) : null}
        </>
      )
  }

  if (!eu) return null

  return (
    <Pagina
      acima="Produção"
      titulo="PCP"
      sub={
        <>
          <b>{conta.portao}</b> {conta.portao === 1 ? 'pedido' : 'pedidos'} no portão · {pecas.toLocaleString('pt-BR')} peças · o PCP confere o
          orçamento e o diretor dá a última aprovação
        </>
      }
    >
      {erro ? (
        <Vazio titulo="Não consegui ler a fila do PCP" texto={erro} />
      ) : (
        <div className="pc-palco">
          <div className="pc-barra">
            <Segmentado
              className="pc-abas"
              valor={aba}
              aoMudar={(v) => {
                setAba(v)
                setEscolhido('')
              }}
              opcoes={(['portao', 'devolvidos', 'liberados'] as Aba[]).map((a) => ({
                valor: a,
                rotulo: (
                  <>
                    {ROTULO[a]} <small>{conta[a]}</small>
                  </>
                ),
              }))}
            />
            <div className="pc-barra-busca">
              <Busca placeholder="Buscar pedido ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Seletor
              rotulo="ORDEM"
              valor={ordem === 'entrega' ? '' : ordem}
              opcoes={[
                { valor: 'entrega', rotulo: 'Entrega' },
                { valor: 'cliente', rotulo: 'Cliente' },
                { valor: 'pecas', rotulo: 'Peças' },
              ]}
              vazio="Entrega"
              aoEscolher={(v) => setOrdem((v || 'entrega') as Ordem)}
            />
          </div>

          <div className="pc-mesa">
            <section className="cartao pc-fila" aria-label="Fila do PCP">
              {carregando ? (
                <div className="pc-espera">
                  <Esqueleto altura={48} />
                  <Esqueleto altura={48} />
                  <Esqueleto altura={48} />
                </div>
              ) : (
                lista
              )}
            </section>

            <div className="pc-direita" ref={direita}>
              {carregando ? (
                <Esqueleto altura={360} />
              ) : aberto ? (
                <PedidoAberto
                  key={aberto.id}
                  p={aberto}
                  eu={eu.nome}
                  podeMarcar={podeMarcar}
                  podeDevolverAoVendedor={podeMarcar}
                  podeAprovar={podeAprovar}
                  aoMexer={recarregar}
                  aoAprovar={(p) => setConfirmando([p])}
                  aoFechar={() => setEscolhido('')}
                />
              ) : liberadoAberto ? (
                <LiberadoAberto key={liberadoAberto.id} p={liberadoAberto} aoFechar={() => setEscolhido('')} />
              ) : aba === 'liberados' ? (
                <Vazio titulo="Escolha um pedido" texto="Abre quem conferiu e quem aprovou, só para ler." />
              ) : (
                <ResumoDoPcp
                  portao={portao}
                  todos={fila}
                  mesa={mesa}
                  podeAprovar={podeAprovar}
                  escolhidos={naMesa}
                  ocupado={aprovando}
                  aoEscolher={(id) => setNaMesa((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))}
                  aoAprovar={() => setConfirmando(mesa.filter((p) => naMesa.includes(p.id)))}
                  aoAbrir={abrir}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* A CONFIRMAÇÃO MOSTRA O QUE VAI DESCER. Aprovar rápido é bom;
          aprovar sem ver o que está aprovando não é. */}
      <Modal
        aberto={!!confirmando}
        aoFechar={() => (aprovando ? null : setConfirmando(null))}
        titulo={confirmando?.length === 1 ? `Descer ${confirmando[0].numero} para a fábrica?` : `Descer ${confirmando?.length ?? 0} pedidos para a fábrica?`}
        pe={
          <div className="fileira fim">
            <Botao tom="limpo" disabled={aprovando} onClick={() => setConfirmando(null)}>
              Cancelar
            </Botao>
            <Botao tom="primario" carregando={aprovando} onClick={() => confirmando && void aprovar(confirmando)}>
              <ArrowFatLineDown size={17} />
              Descer para a fábrica
            </Botao>
          </div>
        }
      >
        <ul className="pc-confirma">
          {(confirmando ?? []).map((p) => (
            <li key={p.id}>
              <b>{p.numero}</b> · {p.cliente || 'sem cliente'} · {p.pecas} pçs · entrega {dataCurta(p.entregaEm)}
              {temFalta(p) ? (
                <span className="pc-alerta">
                  {' '}
                  · {p.faltando > 0 ? `${p.faltando} material sem cobrir` : 'desce com falta de material'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="pc-apoio">
          Cada um vira fatia no kanban por técnica, linha no painel e registro no relatório. Isso não tem botão de desfazer.
        </p>
      </Modal>
    </Pagina>
  )
}
