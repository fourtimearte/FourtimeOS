import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Package } from '@phosphor-icons/react'
import { Botao, Busca, Esqueleto, Pagina, Segmentado, Seletor, Tabela, Vazio, semAcento, type Coluna } from '@ds'
import {
  carregarFilaDaSeparacao,
  carregarMaterialDaFila,
  carregarMiniaturas,
  carregarReservasDoPedido,
  carregarSeparados,
  numeroNaUnidade,
  type MaterialDaFila,
  type PedidoNaSeparacao,
  type PedidoSeparado,
  type ReservaDoPedido,
} from '@dominio/estoque'
import { GrupoDaFila, LinhaDaFila, LinhaDoSeparado } from './fila'
import { PedidoAberto } from './pedido'
import { ResumoDaFila } from './resumo'
import './separacao.css'

/* ==========================================================================
   SEPARAÇÃO, no desenho do wireframe (pranchas 82 a 86; parte S1 em
   11/10/2026, FOURTIME OS - 12, 4.0c).

   Da aprovação até o PCP o pedido para aqui: é onde a reserva deixa de ser
   promessa e o material sai da prateleira de verdade.

   Em cima, as abas Na fila, Com falta e Concluídas, a busca (pedido, cliente
   ou material) e a ordem. À esquerda, a fila em Separando e Esperando. À
   direita, com nada escolhido, a fila inteira de uma vez (os números, a Soma
   da fila e a Falta na prateleira); com um pedido escolhido, o pedido.

   A PÁGINA ABRE NUM PEDIDO quando o endereço traz `?pedido=<id>`: é por aí
   que o Estoque chega aqui. O pedido que já saiu da fila aparece em cima, só
   para ler, com o que saiu da prateleira para ele.
   ========================================================================== */

type Aba = 'fila' | 'falta' | 'concluidas'
type Ordem = 'entrega' | 'cliente' | 'pecas'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** um pedido para ler: o que já saiu da fila (endereço ou aba Concluídas) */
type Registro = { id: string; numero: string; linhas: ReservaDoPedido[] | null; erro: string; doEndereco: boolean }

export function TelaSeparacao() {
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const doEndereco = parametros.get('pedido') ?? ''
  const pedidoDoEndereco = UUID.test(doEndereco) ? doEndereco : ''

  const [fila, setFila] = useState<PedidoNaSeparacao[]>([])
  const [separados, setSeparados] = useState<PedidoSeparado[] | null>([])
  const [materiais, setMateriais] = useState<MaterialDaFila[] | null>([])
  const [miniaturas, setMiniaturas] = useState<Map<string, string>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('fila')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('entrega')
  const [escolhido, setEscolhido] = useState('')
  const [registro, setRegistro] = useState<Registro | null>(null)

  const recarregar = useCallback(async () => {
    const [f, m, s] = await Promise.all([
      carregarFilaDaSeparacao(),
      carregarMaterialDaFila().catch(() => [] as MaterialDaFila[]),
      carregarSeparados().catch(() => [] as PedidoSeparado[]),
    ])
    setFila(f)
    setMateriais(m)
    setSeparados(s)
    const cotacoes = [...f.map((p) => p.cotacaoId), ...(s ?? []).map((p) => p.cotacaoId)]
    void carregarMiniaturas(cotacoes).then(setMiniaturas)
    return f
  }, [])

  useEffect(() => {
    let vivo = true
    recarregar()
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Não consegui ler a fila.'))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [recarregar])

  /* abrir um pedido para ler: o que saiu da prateleira para ele */
  const lerRegistro = useCallback((id: string, numero: string, doEnd: boolean) => {
    setRegistro({ id, numero, linhas: null, erro: '', doEndereco: doEnd })
    carregarReservasDoPedido(id)
      .then((linhas) => setRegistro((r) => (r && r.id === id ? { ...r, linhas, numero: numero || linhas[0]?.pedido || '' } : r)))
      .catch((e: unknown) =>
        setRegistro((r) =>
          r && r.id === id ? { ...r, linhas: [], erro: e instanceof Error ? e.message : 'Não consegui ler o material deste pedido.' } : r,
        ),
      )
  }, [])

  /* O PEDIDO DO ENDEREÇO: na fila, ele vira o escolhido; fora dela, o
     registro do que saiu para ele aparece em cima */
  useEffect(() => {
    if (carregando || erro) return
    if (!pedidoDoEndereco) {
      setRegistro((r) => (r?.doEndereco ? null : r))
      return
    }
    const naFila = fila.find((p) => p.id === pedidoDoEndereco)
    if (naFila) {
      setRegistro(null)
      setAba('fila')
      setEscolhido(naFila.id)
      return
    }
    lerRegistro(pedidoDoEndereco, separados?.find((p) => p.id === pedidoDoEndereco)?.numero ?? '', true)
    // a fila muda a cada separação; o que importa aqui é o pedido do endereço
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDoEndereco, carregando, erro])

  /* a busca casa com o pedido, o cliente e o material: o material pela soma
     da fila, que diz quais pedidos pedem cada um */
  const b = semAcento(busca.trim())
  const pedidosDoMaterial = useMemo(() => {
    if (!b || !materiais) return new Set<string>()
    return new Set(materiais.filter((m) => semAcento(m.material).includes(b)).flatMap((m) => m.numeros))
  }, [b, materiais])
  const bate = (numero: string, cliente: string) =>
    !b || semAcento(numero + ' ' + cliente).includes(b) || pedidosDoMaterial.has(numero)

  const ordenar = <T extends { entregaEm: string; cliente: string; pecas: number; numero: string }>(l: T[]) =>
    [...l].sort((x, y) =>
      ordem === 'cliente'
        ? x.cliente.localeCompare(y.cliente, 'pt-BR')
        : ordem === 'pecas'
          ? y.pecas - x.pecas
          : (x.entregaEm || '9999').localeCompare(y.entregaEm || '9999') || x.numero.localeCompare(y.numero),
    )

  const comFalta = fila.filter((p) => p.naoCobre > 0)
  const daAba = ordenar((aba === 'falta' ? comFalta : fila).filter((p) => bate(p.numero, p.cliente)))
  const separando = daAba.filter((p) => p.estado === 'separacao')
  const esperando = daAba.filter((p) => p.estado !== 'separacao')
  const concluidas = (separados ?? []).filter((p) => bate(p.numero, p.cliente))
  const aberto = aba !== 'concluidas' ? fila.find((p) => p.id === escolhido) ?? null : null

  function escolher(id: string) {
    setRegistro(null)
    if (pedidoDoEndereco) setParametros({}, { replace: true })
    setEscolhido((x) => (x === id ? '' : id))
  }

  function abrirPeloNumero(numero: string) {
    const p = fila.find((x) => x.numero === numero)
    if (p) {
      setAba(p.naoCobre > 0 && aba === 'falta' ? 'falta' : 'fila')
      escolher(p.id)
    }
  }

  const conta = { fila: fila.length, falta: comFalta.length, concluidas: separados?.length ?? 0 }
  const pecas = fila.reduce((s, p) => s + p.pecas, 0)
  const ROTULO: Record<Aba, string> = { fila: 'Na fila', falta: 'Com falta', concluidas: 'Concluídas' }

  let lista: ReactNode
  if (aba === 'concluidas') {
    lista =
      separados === null ? (
        <Vazio titulo="A lista das concluídas ainda não existe" texto="Falta rodar a migração 061 no banco." />
      ) : !concluidas.length ? (
        <Vazio titulo="Nenhuma separação concluída" texto={b ? 'Nada com esse nome ou número.' : 'O pedido aparece aqui quando a separação dele é concluída.'} />
      ) : (
        <GrupoDaFila nome="Concluídas" apoio={plural(concluidas.length, 'pedido', 'pedidos') + ' · a mais recente primeiro'}>
          {concluidas.map((p) => (
            <LinhaDoSeparado
              key={p.id}
              p={p}
              miniatura={miniaturas.get(p.cotacaoId)}
              escolhido={registro?.id === p.id && !registro.doEndereco}
              aoEscolher={() => (registro?.id === p.id ? setRegistro(null) : lerRegistro(p.id, p.numero, false))}
            />
          ))}
        </GrupoDaFila>
      )
  } else if (!daAba.length) {
    lista = (
      <Vazio
        titulo={aba === 'falta' ? 'Nenhum pedido com falta' : 'Nada esperando separação'}
        texto={
          b
            ? 'Nada com esse nome, número ou material.'
            : aba === 'falta'
              ? 'A prateleira cobre todos os pedidos da fila.'
              : 'Todo pedido aprovado já teve o material separado e seguiu para o PCP. Pedido novo aparece aqui no instante em que a cotação é aprovada.'
        }
      />
    )
  } else {
    const linha = (p: PedidoNaSeparacao) => (
      <LinhaDaFila key={p.id} p={p} miniatura={miniaturas.get(p.cotacaoId)} escolhido={p.id === escolhido} aoEscolher={() => escolher(p.id)} />
    )
    lista = (
      <>
        {separando.length ? (
          <GrupoDaFila nome="Separando" apoio={plural(separando.length, 'pedido', 'pedidos') + ' · já começou'}>
            {separando.map(linha)}
          </GrupoDaFila>
        ) : null}
        {esperando.length ? (
          <GrupoDaFila
            nome="Esperando"
            apoio={esperando.length + ' · ' + (ordem === 'entrega' ? 'pela entrega mais próxima' : ordem === 'cliente' ? 'pelo cliente' : 'pelas peças')}
          >
            {esperando.map(linha)}
          </GrupoDaFila>
        ) : null}
      </>
    )
  }

  return (
    <Pagina
      acima="Produção · materiais"
      titulo="Separação"
      sub={
        <>
          <b>{conta.fila}</b> {conta.fila === 1 ? 'pedido aprovado' : 'pedidos aprovados'} na fila · {pecas.toLocaleString('pt-BR')} peças · o material
          sai da prateleira quando é separado
        </>
      }
      acoes={
        <Botao tom="contorno" onClick={() => navegar('/estoque')}>
          <Package size={17} />
          Abrir o Estoque
        </Botao>
      }
    >
      {registro?.doEndereco ? <RegistroDoPedido r={registro} aoFechar={() => setParametros({}, { replace: true })} /> : null}

      {erro ? (
        <Vazio titulo="Não consegui ler a fila" texto={erro} />
      ) : (
        <div className="sp-palco">
          <div className="sp-barra">
            <Segmentado
              className="sp-abas"
              valor={aba}
              aoMudar={(v) => {
                setAba(v)
                setRegistro((r) => (r?.doEndereco ? r : null))
              }}
              opcoes={(['fila', 'falta', 'concluidas'] as Aba[]).map((a) => ({
                valor: a,
                rotulo: (
                  <>
                    {ROTULO[a]} <small>{conta[a]}</small>
                  </>
                ),
              }))}
            />
            <div className="sp-barra-busca">
              <Busca placeholder="Buscar pedido, cliente ou material" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Seletor
              rotulo="ORDEM"
              /* a ordem de sempre (entrega) fica com o seletor neutro, como no
                 wireframe; só a escolhida pinta */
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

          <div className="sp-mesa">
            <section className="cartao sp-fila" aria-label="Fila da separação">
              {carregando ? (
                <div className="sp-espera">
                  <Esqueleto altura={48} />
                  <Esqueleto altura={48} />
                  <Esqueleto altura={48} />
                </div>
              ) : (
                lista
              )}
            </section>

            <div className="sp-direita">
              {carregando ? (
                <Esqueleto altura={360} />
              ) : aba === 'concluidas' ? (
                registro && !registro.doEndereco ? (
                  <RegistroDoPedido r={registro} aoFechar={() => setRegistro(null)} />
                ) : (
                  <Vazio titulo="Escolha um pedido" texto="Abre o que saiu da prateleira para ele, só para ler." />
                )
              ) : aberto ? (
                <PedidoAberto
                  key={aberto.id}
                  p={aberto}
                  aoMexer={async () => {
                    await recarregar()
                  }}
                  aoConcluir={async () => {
                    setEscolhido('')
                    await recarregar()
                  }}
                  aoFechar={() => setEscolhido('')}
                />
              ) : (
                <ResumoDaFila fila={fila} materiais={materiais} aoAbrirPedido={abrirPeloNumero} />
              )}
            </div>
          </div>
        </div>
      )}
    </Pagina>
  )
}

/* o que saiu da prateleira para um pedido que já não está na fila */
function RegistroDoPedido({ r, aoFechar }: { r: Registro; aoFechar: () => void }) {
  const colunas: Coluna<ReservaDoPedido>[] = [
    {
      chave: 'material',
      titulo: 'Material',
      celula: (l) => (
        <span className="pilha colada">
          <b className="sp-nome">{l.material}</b>
          <small className="sp-apoio sp-nome">{l.categoria}</small>
        </span>
      ),
    },
    {
      chave: 'precisava',
      titulo: 'Precisava',
      numero: true,
      celula: (l) => (l.semConsumo ? <span className="sp-apoio">sem consumo</span> : numeroNaUnidade(l.quantidade, l.unidade)),
    },
    {
      chave: 'saiu',
      titulo: 'Saiu',
      numero: true,
      celula: (l) => (l.baixada ? <b className="sp-saiu">{numeroNaUnidade(l.separado, l.unidade)}</b> : <span className="sp-pouco">não saiu</span>),
    },
  ]
  return (
    <section className="cartao sp-passado" data-passado="">
      <header className="sp-topo">
        <div className="pilha colada">
          <b>{r.numero ? `O pedido ${r.numero} não está mais na fila da Separação` : 'Este pedido não está na fila da Separação'}</b>
          <small className="sp-apoio">
            {r.linhas === null
              ? 'Lendo o material dele.'
              : r.erro
                ? r.erro
                : r.linhas.length
                  ? 'A separação dele foi concluída e o pedido seguiu para o PCP. Abaixo, o que saiu da prateleira para ele.'
                  : 'Não há material reservado para ele: ou o pedido seguiu sem reserva, ou ainda não foi aprovado.'}
          </small>
        </div>
        <Botao onClick={aoFechar}>Fechar</Botao>
      </header>
      {r.linhas === null ? (
        <div className="sp-espera">
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </div>
      ) : r.linhas.length ? (
        <Tabela colunas={colunas} linhas={r.linhas} chaveDaLinha={(l) => l.id} />
      ) : null}
    </section>
  )
}
