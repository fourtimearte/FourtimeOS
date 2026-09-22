import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUUpLeft, Check, Stamp, Warning } from '@phosphor-icons/react'
import {
  AreaTexto,
  Botao,
  Cartao,
  Esqueleto,
  Kpi,
  Marcacao,
  Pagina,
  PilulaTecnica,
  Selo,
  TituloCartao,
  Vazio,
  avisar,
} from '@ds'
import { acharCotacao, fatiasDaCotacao } from '@dominio/cotacao'
import {
  NOME_DA_TECNICA,
  carregarOPcp,
  desmarcarDoPcp,
  devolverDoPcp,
  diasAte,
  liberarParaProducao,
  marcarParaAprovacao,
  type PedidoNoPcp,
} from '@dominio/producao'
import { pode, souAdmin, useSessao } from '@dominio/sessao'
import './pcp.css'

/* ==========================================================================
   PCP, planejamento e controle de produção. O portão.

   O CAMINHO, decidido em 21/09/2026:

     funil -> cotação -> pedido -> separação -> PCP -> kanban

   A separação vem ANTES do PCP de propósito: ela descobre a verdade sobre o
   estoque, e o PCP decide o que fazer com o que faltou. Assim o operador abre
   a tela com os avisos prontos na frente, em vez de sair procurando.

   DUAS APROVAÇÕES, E NÃO UMA. O PCP confere e MARCA; quem APROVA é o diretor
   de produção. Quem confere não é quem libera, e isso não é combinado entre
   pessoas: a migração 032 recusa liberar um pedido que ninguém marcou, venha
   o pedido de onde vier.

   A TELA TEM DUAS LEITURAS DA MESMA FILA, e quem vê qual depende do que a
   pessoa pode, e não de uma aba que qualquer um clica.

   APROVAR EM LOTE NÃO É UM CLIQUE SOZINHO. É o jeito de aprovar a semana numa
   manhã, e é também o jeito mais fácil de aprovar sem olhar: a confirmação
   mostra a lista do que vai descer, com a falta em vermelho, antes de ir.
   ========================================================================== */

function dataCurta(iso: string): string {
  if (!iso) return 'sem data'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function dinheiro(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/* O quanto falta para a entrega, dito do jeito que alguém fala. */
function prazo(iso: string): { texto: string; aperta: boolean; atrasado: boolean } {
  const d = diasAte(iso)
  if (d === null) return { texto: 'sem data de entrega', aperta: false, atrasado: false }
  if (d < 0) return { texto: `${-d} dia${-d === 1 ? '' : 's'} atrasado`, aperta: true, atrasado: true }
  if (d === 0) return { texto: 'entrega hoje', aperta: true, atrasado: false }
  if (d === 1) return { texto: 'entrega amanhã', aperta: true, atrasado: false }
  return { texto: `${d} dias para a entrega`, aperta: d <= 3, atrasado: false }
}

export function TelaPcp() {
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null

  /* Quem edita o PCP confere e marca; quem tem controle total aprova. A tela
     lê a matriz em vez de perguntar o papel: no dia em que existir um papel
     `diretor`, nada aqui muda. */
  const podeMarcar = !!eu && pode(eu, 'pcp', 'editar')
  const podeAprovar = !!eu && (pode(eu, 'pcp', 'total') || souAdmin(eu))

  const [fila, setFila] = useState<PedidoNoPcp[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])
  const [devolvendo, setDevolvendo] = useState<PedidoNoPcp | null>(null)
  const [motivo, setMotivo] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const f = await carregarOPcp()
      setFila(f)
      setMarcados((m) => m.filter((id) => f.some((p) => p.id === id && p.marcado)))
      return f
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler a fila do PCP.')
      return []
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const esperando = useMemo(() => fila.filter((p) => !p.marcado), [fila])
  const naMesaDoDiretor = useMemo(() => fila.filter((p) => p.marcado), [fila])

  const conta = useMemo(
    () => ({
      naFila: fila.length,
      aprovar: naMesaDoDiretor.length,
      falta: fila.filter((p) => p.faltando > 0 || p.aviso === 'falta-material').length,
      atrasado: fila.filter((p) => prazo(p.entregaEm).atrasado).length,
      pecas: fila.reduce((s, p) => s + p.pecas, 0),
    }),
    [fila, naMesaDoDiretor],
  )

  async function marcar(p: PedidoNoPcp) {
    setOcupado(p.id)
    try {
      await marcarParaAprovacao(p.id)
      await carregar()
      avisar(`${p.numero} foi para a mesa do diretor.`, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui marcar.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  async function desmarcar(p: PedidoNoPcp) {
    setOcupado(p.id)
    try {
      await desmarcarDoPcp(p.id)
      await carregar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui desmarcar.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  async function devolver() {
    if (!devolvendo) return
    setOcupado('devolver')
    try {
      await devolverDoPcp(devolvendo.id, motivo)
      setDevolvendo(null)
      setMotivo('')
      await carregar()
      avisar('Devolvido ao PCP com o motivo escrito.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui devolver.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  /* LIBERAR É O VERBO, E ELE PRECISA DAS FATIAS. Quem sabe ler um bloco de
     layout e transformar grade em peça é o domínio da cotação, e não o banco:
     por isso a cotação de cada pedido é lida aqui antes de descer. */
  async function aprovar(lista: PedidoNoPcp[]) {
    setOcupado('aprovar')
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
    setConfirmando(false)
    setMarcados([])
    await carregar()
    setOcupado('')
    if (erros.length) {
      avisar(`${foram} de ${lista.length} desceram. ${erros.join(' · ')}`, 'warn')
    } else {
      avisar(
        foram === 1
          ? `${lista[0].numero} está no chão de fábrica.`
          : `${foram} pedidos desceram para a fábrica.`,
        'ok',
      )
    }
  }

  const escolhidos = naMesaDoDiretor.filter((p) => marcados.includes(p.id))

  if (!eu) return null

  return (
    <Pagina
      acima="Produção"
      titulo="PCP"
      sub={
        <>
          <b>{conta.naFila}</b> pedido{conta.naFila === 1 ? '' : 's'} no portão ·{' '}
          {conta.pecas.toLocaleString('pt-BR')} peças · o PCP confere e marca, o diretor aprova
        </>
      }
      acoes={
        podeAprovar && escolhidos.length > 0 ? (
          <Botao tom="primario" onClick={() => setConfirmando(true)} disabled={!!ocupado}>
            <Check size={17} />
            Aprovar {escolhidos.length} para a fábrica
          </Botao>
        ) : null
      }
    >
      <div className="pcp-kpis">
        <Kpi rotulo="No portão" valor={conta.naFila} sub="conferindo e esperando" />
        <Kpi rotulo="Na mesa do diretor" valor={conta.aprovar} sub="já marcados pelo PCP" />
        <Kpi
          rotulo="Com falta de material"
          valor={conta.falta}
          sub={conta.falta ? 'o diretor decide se desce assim' : 'tudo coberto'}
          aviso={conta.falta > 0}
        />
        <Kpi
          rotulo="Já atrasado"
          valor={conta.atrasado}
          sub={conta.atrasado ? 'a entrega já passou' : 'nenhum passou da data'}
          aviso={conta.atrasado > 0}
        />
      </div>

      {erro ? (
        <Vazio titulo="Não consegui ler a fila do PCP" texto={erro} />
      ) : carregando ? (
        <Cartao>
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </Cartao>
      ) : !fila.length ? (
        <Vazio
          titulo="Nada esperando no PCP"
          texto="Pedido chega aqui quando a separação é concluída. Enquanto a fila estiver vazia, não há nada para liberar para a fábrica."
        />
      ) : (
        <div className="pcp-mesa">
          <Fila
            titulo="Conferindo"
            vazio="Tudo que está no PCP já foi marcado."
            linha="O PCP confere a cotação e o material, e marca o que pode descer."
            pedidos={esperando}
            eu="pcp"
            ocupado={ocupado}
            podeMarcar={podeMarcar}
            podeAprovar={podeAprovar}
            marcados={marcados}
            aoMarcar={(p) => void marcar(p)}
            aoDesmarcar={(p) => void desmarcar(p)}
            aoEscolher={() => {}}
            aoDevolver={() => {}}
          />

          <Fila
            titulo="Esperando o diretor"
            vazio="Nada marcado ainda. O PCP marca do lado de cá."
            linha="Aprovar cria as fatias no kanban e põe o pedido no chão de fábrica."
            pedidos={naMesaDoDiretor}
            eu="diretor"
            ocupado={ocupado}
            podeMarcar={podeMarcar}
            podeAprovar={podeAprovar}
            marcados={marcados}
            aoMarcar={(p) => void marcar(p)}
            aoDesmarcar={(p) => void desmarcar(p)}
            aoEscolher={(p) =>
              setMarcados((m) => (m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id]))
            }
            aoDevolver={(p) => {
              setDevolvendo(p)
              setMotivo('')
            }}
          />
        </div>
      )}

      {/* A CONFIRMAÇÃO DO LOTE MOSTRA O QUE VAI DESCER. Aprovar rápido é bom;
          aprovar sem ver o que está aprovando não é. */}
      {confirmando ? (
        <Cartao className="pcp-confirma">
          <TituloCartao>Descer {escolhidos.length} para a fábrica?</TituloCartao>
          <ul className="pcp-lista-confirma">
            {escolhidos.map((p) => (
              <li key={p.id}>
                <b>{p.numero}</b> · {p.cliente || 'sem cliente'} · {p.pecas} pçs
                {p.faltando > 0 ? (
                  <span className="pcp-falta"> · {p.faltando} material sem cobrir</span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="pcp-apoio">
            Cada um vira fatia no kanban por técnica, linha no painel e registro no relatório.
            Isso não tem botão de desfazer.
          </p>
          <div className="pcp-botoes">
            <Botao
              tom="primario"
              carregando={ocupado === 'aprovar'}
              onClick={() => void aprovar(escolhidos)}
            >
              Descer para a fábrica
            </Botao>
            <Botao tom="limpo" onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
          </div>
        </Cartao>
      ) : null}

      {devolvendo ? (
        <Cartao className="pcp-confirma">
          <TituloCartao>Devolver {devolvendo.numero} ao PCP</TituloCartao>
          <p className="pcp-apoio">
            O pedido continua no PCP e a marca cai. O motivo aparece para quem for arrumar, e sem
            ele a devolução vira recado de WhatsApp.
          </p>
          <AreaTexto
            value={motivo}
            rows={3}
            placeholder="Falta confirmar a malha com o cliente antes de cortar."
            onChange={(e) => setMotivo(e.currentTarget.value)}
          />
          <div className="pcp-botoes">
            <Botao
              tom="primario"
              carregando={ocupado === 'devolver'}
              disabled={motivo.trim().length < 3}
              onClick={() => void devolver()}
            >
              <ArrowUUpLeft size={16} />
              Devolver com este motivo
            </Botao>
            <Botao tom="limpo" onClick={() => setDevolvendo(null)}>
              Cancelar
            </Botao>
          </div>
        </Cartao>
      ) : null}
    </Pagina>
  )
}

function Fila({
  titulo,
  linha,
  vazio,
  pedidos,
  eu,
  ocupado,
  podeMarcar,
  podeAprovar,
  marcados,
  aoMarcar,
  aoDesmarcar,
  aoEscolher,
  aoDevolver,
}: {
  titulo: string
  linha: string
  vazio: string
  pedidos: PedidoNoPcp[]
  eu: 'pcp' | 'diretor'
  ocupado: string
  podeMarcar: boolean
  podeAprovar: boolean
  marcados: string[]
  aoMarcar: (p: PedidoNoPcp) => void
  aoDesmarcar: (p: PedidoNoPcp) => void
  aoEscolher: (p: PedidoNoPcp) => void
  aoDevolver: (p: PedidoNoPcp) => void
}) {
  return (
    <Cartao className="pcp-coluna">
      <TituloCartao>
        {titulo} <span className="pcp-conta">{pedidos.length}</span>
      </TituloCartao>
      <p className="pcp-apoio pcp-linha-topo">{linha}</p>

      {!pedidos.length ? (
        <p className="pcp-vazio">{vazio}</p>
      ) : (
        pedidos.map((p) => {
          const pz = prazo(p.entregaEm)
          const falta = p.faltando > 0 || p.aviso === 'falta-material'
          return (
            <article key={p.id} className="pcp-cartao">
              <header className="pcp-topo">
                <span className="pilha colada">
                  <b className="pcp-numero">
                    {eu === 'diretor' && podeAprovar ? (
                      <Marcacao
                        checked={marcados.includes(p.id)}
                        disabled={!!ocupado}
                        aria-label={'Escolher ' + p.numero}
                        onChange={() => aoEscolher(p)}
                      />
                    ) : null}
                    {p.numero}
                    {p.teste ? <Selo tom="info">teste</Selo> : null}
                  </b>
                  <small className="pcp-apoio">{p.cliente || 'sem cliente'}</small>
                </span>
                <span className={pz.aperta ? 'pcp-prazo aperta' : 'pcp-prazo'}>
                  {dataCurta(p.entregaEm)}
                </span>
              </header>

              <p className="pcp-numeros">
                {p.pecas} peças · {p.layouts} layout{p.layouts === 1 ? '' : 's'} ·{' '}
                {dinheiro(p.total)} · {pz.texto}
              </p>

              {/* A PÍLULA, E NÃO A CHAVE CRUA. A cor da técnica é a mesma no
                  editor, no cartão e no kanban, e escrever 'subli' na tela
                  jogaria fora a peça que o Design System já tem para isso. */}
              {p.tecnicas.length ? (
                <p className="pcp-tecnicas">
                  {p.tecnicas.map((t) => (
                    <PilulaTecnica key={t} tecnica={t} tamanho="sm">
                      {NOME_DA_TECNICA[t] ?? t}
                    </PilulaTecnica>
                  ))}
                </p>
              ) : (
                <p className="pcp-tecnicas alerta">
                  Nenhuma técnica no documento: sem isso não nasce fatia no kanban.
                </p>
              )}

              {falta ? (
                <p className="pcp-aviso">
                  <Warning size={15} />
                  {p.faltando > 0
                    ? `${p.faltando} de ${p.materiais} materiais não foram cobertos na separação.`
                    : 'A separação carimbou falta de material neste pedido.'}
                </p>
              ) : null}

              {p.devolvidoMotivo ? (
                <p className="pcp-devolvido">
                  <ArrowUUpLeft size={15} />
                  Devolvido por {p.devolvidoPor || 'alguém'}: {p.devolvidoMotivo}
                </p>
              ) : null}

              {p.marcado ? (
                <p className="pcp-apoio">
                  Marcado por {p.marcadoPor || 'alguém'} em {dataCurta(p.marcadoEm)}.
                </p>
              ) : null}

              <footer className="pcp-botoes">
                {/* Link com a roupa de botão, e não Botao com um Link dentro:
                    âncora dentro de botão é HTML inválido, e o navegador faz o
                    que quer com o clique. */}
                <Link className="btn btn-contorno sm" to={`/cotacao/${p.cotacaoId}/producao`}>
                  Ver a folha
                </Link>

                {eu === 'pcp' && podeMarcar ? (
                  <Botao
                    tom="forte"
                    tamanho="sm"
                    carregando={ocupado === p.id}
                    disabled={!!ocupado}
                    onClick={() => aoMarcar(p)}
                  >
                    <Stamp size={16} />
                    Marcar para aprovação
                  </Botao>
                ) : null}

                {eu === 'diretor' && podeMarcar ? (
                  <Botao
                    tom="limpo"
                    tamanho="sm"
                    disabled={!!ocupado}
                    onClick={() => aoDesmarcar(p)}
                  >
                    Tirar a marca
                  </Botao>
                ) : null}

                {eu === 'diretor' && podeAprovar ? (
                  <Botao tom="limpo" tamanho="sm" disabled={!!ocupado} onClick={() => aoDevolver(p)}>
                    <ArrowUUpLeft size={16} />
                    Devolver
                  </Botao>
                ) : null}
              </footer>
            </article>
          )
        })
      )}
    </Cartao>
  )
}
