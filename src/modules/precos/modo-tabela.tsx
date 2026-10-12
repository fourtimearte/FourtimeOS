import { Fragment, useMemo, useState } from 'react'
import { CaretRight, ClipboardText, Copy, Plus, X } from '@phosphor-icons/react'
import { Aviso, Botao, Chip, Entrada, Interruptor, Marcacao, Seletor, avisar } from '@ds'
import { formatarNumeroExato } from '@shared'
import {
  ajustarEmLote,
  celula,
  colarNaTabela,
  colarPrecosDaPeca,
  preencherCelulas,
  copiarPrecosDe,
  escrever,
  escreverBase,
  nomeDaFaixa,
  numeroDoTexto,
  porNaTabela,
  precoDoTamanho,
  tirarDaTabela,
  voltarParaARegra,
  type Contexto,
  type EntradaDoCatalogo,
  type TabelaDePreco,
} from '@dominio/preco'
import { CampoDePreco, usarAlca, usarEdicao, usarMarcarEmFaixa } from './campo'
import { achaNaBusca, type GrupoDoCatalogo, type PecaDoCatalogo } from './catalogo'

/* ==========================================================================
   O MODO TABELA (prancha 142), como o da página Estoque: o catálogo INTEIRO
   da ficha técnica, por grupo, em sanfona, com a chave "Na tabela" em cada
   peça. Marcar o grupo marca as peças dele. Com algo marcado, a faixa preta
   faz de uma vez: pôr na tabela, o mesmo preço base, ajustar em por cento,
   copiar de outra tabela, voltar para a regra e tirar da tabela.

   Escrever um preço numa peça que está fora já põe ela na tabela. Enter
   desce, Tab vai para o lado, e colar um bloco da planilha preenche de cima
   para baixo, só nas peças à vista.
   ========================================================================== */

type Filtro = '' | 'sem' | 'fora' | 'mao'

/* a classe de cada "como está", escrita inteira para a conferencia de ligacoes */
const CLASSE_DO_ESTADO = { fora: 'pr-st pr-st-fora', falta: 'pr-st pr-st-falta', mao: 'pr-st pr-st-mao', '': 'pr-st' } as const

export function ModoTabela({
  tabela: t,
  outras,
  grupos,
  busca,
  ctx,
  podeMexer,
  mudar,
}: {
  tabela: TabelaDePreco
  /** as outras tabelas, para "Copiar de outra tabela" */
  outras: TabelaDePreco[]
  grupos: GrupoDoCatalogo[]
  busca: string
  ctx: Contexto
  podeMexer: boolean
  mudar: (f: (x: TabelaDePreco) => TabelaDePreco) => void
}) {
  const [filtro, setFiltro] = useState<Filtro>('')
  const [marcados, setMarcados] = useState<string[]>([])
  const [fechados, setFechados] = useState<string[] | null>(null)
  const [base, setBase] = useState('')
  const [pct, setPct] = useState('5')
  const [origem, setOrigem] = useState('')

  const item = (cod: string) => t.itens.find((i) => i.codigo === cod)
  const semBase = (cod: string) => {
    const it = item(cod)
    return !!it && celula(t, it, 0, ctx).valor == null
  }
  const temMao = (cod: string) => !!item(cod)?.precos.some((v) => v != null)

  const contas = useMemo(() => {
    const todas = grupos.flatMap((g) => g.pecas)
    return {
      todas: todas.length,
      sem: todas.filter((p) => semBase(p.codigo)).length,
      fora: todas.filter((p) => !item(p.codigo)).length,
      mao: todas.filter((p) => temMao(p.codigo)).length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, t])

  const passa = (p: PecaDoCatalogo, g: GrupoDoCatalogo) =>
    achaNaBusca(busca, p.codigo, p.nome, g.cod, g.nome) &&
    (filtro === '' ||
      (filtro === 'sem' && semBase(p.codigo)) ||
      (filtro === 'fora' && !item(p.codigo)) ||
      (filtro === 'mao' && temMao(p.codigo)))
  const visiveis = grupos.map((g) => ({ ...g, pecas: g.pecas.filter((p) => passa(p, g)) })).filter((g) => g.pecas.length)
  /* as sanfonas nascem abertas onde a tabela tem peça; com busca ou filtro, tudo aberto */
  const fechadosDeFabrica = grupos.filter((g) => !g.pecas.some((p) => item(p.codigo))).map((g) => g.cod)
  const fechadas = busca.trim() || filtro ? [] : (fechados ?? fechadosDeFabrica)
  const ordem = visiveis.filter((g) => !fechadas.includes(g.cod)).flatMap((g) => g.pecas)
  const entradas = (cods: string[]): EntradaDoCatalogo[] =>
    grupos.flatMap((g) => g.pecas).filter((p) => cods.includes(p.codigo)).map((p) => ({ codigo: p.codigo, tipo: p.tipo }))

  const edicao = usarEdicao({
    ordem: ordem.map((p) => p.codigo),
    faixas: t.faixas.length,
    valorDe: (cod, i) => {
      const it = item(cod)
      return it ? (i === 0 ? it.base : (it.precos[i] ?? null)) : null
    },
    aoEscrever: (cod, i, v) => mudar((x) => escrever(porNaTabela(x, entradas([cod])), cod, i, v)),
    aoColar: (cod, i, texto) => {
      const k = ordem.findIndex((p) => p.codigo === cod)
      let n = 0
      mudar((x) => {
        const r = colarNaTabela(x, ordem.map((p) => ({ codigo: p.codigo, tipo: p.tipo })), k, i, texto)
        n = r.coladas
        return r.tabela
      })
      setTimeout(() => avisar(`${n} ${n === 1 ? 'preço colado' : 'preços colados'} da planilha`, 'ok'), 0)
    },
  })

  /* A ALÇA: o valor que a célula mostra repete nas vizinhas, para baixo ou para o lado */
  const alca = usarAlca({
    ordem: ordem.map((p) => p.codigo),
    valorDe: (cod, i) => {
      const it = item(cod)
      return it ? celula(t, it, i, ctx).valor : null
    },
    aoPreencher: (alvos, v) => {
      const tipo = (c: string) => grupos.flatMap((g) => g.pecas).find((p) => p.codigo === c)?.tipo ?? 'referencia'
      mudar((x) => preencherCelulas(x, alvos.map((a) => ({ ...a, tipo: tipo(a.codigo) })), v))
    },
  })

  /* COPIAR OS PREÇOS DE UMA PEÇA e colar em outras, no grupo ou nas marcadas */
  const [copiada, setCopiada] = useState('')
  const colar = (cods: string[]) => {
    if (!copiada) return
    const alvos = entradas(cods.filter((c) => c !== copiada))
    if (!alvos.length) return
    mudar((x) => colarPrecosDaPeca(x, copiada, alvos))
    avisar(`Os preços da ${copiada} foram para ${alvos.length} ${alvos.length === 1 ? 'peça' : 'peças'}. Falta salvar.`, 'ok')
  }
  const daCopiada = copiada ? item(copiada) : undefined

  const marcar = (cods: string[], sim: boolean) =>
    setMarcados((m) => (sim ? [...new Set([...m, ...cods])] : m.filter((c) => !cods.includes(c))))
  const marcarUma = usarMarcarEmFaixa(
    ordem.map((p) => p.codigo),
    marcados,
    setMarcados,
  )
  const naTabela = marcados.filter((c) => item(c))

  function aplicarBase() {
    const v = numeroDoTexto(base)
    if (v == null || !Number.isFinite(v) || v < 0) return avisar('Escreva o preço base, como 47,90', 'warn')
    mudar((x) => escreverBase(x, entradas(marcados), v))
  }
  function ajustar() {
    const p = Number(pct.replace(',', '.'))
    if (!Number.isFinite(p)) return avisar('Escreva quantos por cento (menos 5 para baixar)', 'warn')
    mudar((x) => ajustarEmLote(x, naTabela, p, x.regras.arredondar))
  }
  function copiar(id: string) {
    const o = outras.find((x) => x.id === id)
    setOrigem(id)
    if (!o) return
    mudar((x) => copiarPrecosDe(x, o, marcados, 0, x.regras.arredondar))
    const tem = o.itens.filter((i) => marcados.includes(i.codigo)).length
    avisar(`${tem} de ${marcados.length} vieram da ${o.nome}`, tem ? 'ok' : 'warn')
  }

  const colunas = t.faixas.length + 6
  return (
    <div className="pr-mt">
      <div className="fileira miuda pr-mt-filtros" role="group" aria-label="Mostrar">
        <Chip ligado={filtro === ''} onClick={() => setFiltro('')}>
          Todas <small>{contas.todas}</small>
        </Chip>
        <Chip ligado={filtro === 'sem'} onClick={() => setFiltro(filtro === 'sem' ? '' : 'sem')}>
          Sem preço <small>{contas.sem}</small>
        </Chip>
        <Chip ligado={filtro === 'fora'} onClick={() => setFiltro(filtro === 'fora' ? '' : 'fora')}>
          Fora da tabela <small>{contas.fora}</small>
        </Chip>
        <Chip ligado={filtro === 'mao'} onClick={() => setFiltro(filtro === 'mao' ? '' : 'mao')}>
          Escrito à mão <small>{contas.mao}</small>
        </Chip>
      </div>

      {podeMexer && marcados.length ? (
        <div className="pr-lote pr-mt-lote" role="group" aria-label="Mudar as marcadas de uma vez">
          <b>
            {marcados.length} {marcados.length === 1 ? 'marcada' : 'marcadas'}
          </b>
          <span className="pr-mt-div" />
          <Botao tom="contorno" tamanho="sm" onClick={() => mudar((x) => porNaTabela(x, entradas(marcados)))}>
            <Plus size={15} />
            Pôr na tabela
          </Botao>
          <span className="pr-mt-div" />
          <span>Preço base</span>
          <Entrada className="pr-lote-pct" inputMode="decimal" aria-label="Preço base das marcadas" placeholder="R$" value={base} onChange={(e) => setBase(e.target.value)} />
          <Botao tom="primario" tamanho="sm" onClick={aplicarBase}>
            Aplicar {marcados.length === 1 ? 'na marcada' : `nas ${marcados.length}`}
          </Botao>
          <span className="pr-mt-div" />
          <span>Ajustar (%)</span>
          <Entrada className="pr-lote-pct" inputMode="decimal" aria-label="Ajuste em por cento" value={pct} onChange={(e) => setPct(e.target.value)} />
          <Botao tom="contorno" tamanho="sm" disabled={!naTabela.length} onClick={ajustar}>
            Aplicar
          </Botao>
          <span className="pr-mt-div" />
          {outras.length ? (
            <Seletor rotulo="COPIAR DE" valor={origem} vazio="Outra tabela" opcoes={outras.map((o) => ({ valor: o.id, rotulo: o.nome }))} aoEscolher={copiar} />
          ) : null}
          <Botao tom="contorno" tamanho="sm" disabled={!naTabela.length} onClick={() => mudar((x) => voltarParaARegra(x, naTabela))}>
            Voltar para a regra
          </Botao>
          <Botao tom="contorno" tamanho="sm" disabled={!naTabela.length} onClick={() => mudar((x) => tirarDaTabela(x, naTabela))}>
            Tirar da tabela
          </Botao>
          <Botao tom="limpo" tamanho="sm" icone aria-label="Desmarcar todas" className="pr-mt-x" onClick={() => setMarcados([])}>
            <X size={16} />
          </Botao>
        </div>
      ) : null}

      {daCopiada ? (
        <div className="pr-mt-copia" role="status">
          <Aviso
            tom="info"
            titulo={'Preços da ' + copiada + ' copiados'}
            acao={
              <span className="fileira">
                {marcados.length ? (
                  <Botao tom="primario" tamanho="sm" onClick={() => colar(marcados)}>
                    Colar {marcados.length === 1 ? 'na marcada' : `nas ${marcados.length} marcadas`}
                  </Botao>
                ) : null}
                <Botao tom="contorno" tamanho="sm" onClick={() => setCopiada('')}>
                  Esquecer
                </Botao>
              </span>
            }
          >
            {t.faixas.map((_f, i) => formatarNumeroExato(celula(t, daCopiada, i, ctx).valor ?? 0)).join(' · ')}. Cole numa peça,
            no grupo ou nas marcadas.
          </Aviso>
        </div>
      ) : null}

      <p className="pr-mt-dica">
        <ClipboardText size={15} />
        Clique num preço e escreva: <kbd>Enter</kbd> desce, <kbd>Tab</kbd> vai para o lado. Arraste o quadradinho do canto
        do campo para repetir o valor nas vizinhas, para baixo, para o lado ou na diagonal. <kbd>Ctrl</kbd> <kbd>V</kbd> numa célula cola a
        coluna copiada da planilha. O botão de copiar ao lado do nome leva os preços de uma peça para outras.
      </p>

      <div className="pr-rola">
        <table className="pr-grade pr-mt-tab">
          <thead>
            <tr>
              <th className="pr-ck-col" />
              <th className="pr-nm">Peça</th>
              <th className="pr-mt-na">Na tabela</th>
              {t.faixas.map((f, i) => (
                <th key={nomeDaFaixa(f)} className={i === 0 ? 'pr-col-base' : ''}>
                  {i === 0 ? 'Preço base' : nomeDaFaixa(f)}
                  <small>{i === 0 ? nomeDaFaixa(f) : 'peças'}</small>
                </th>
              ))}
              <th className="pr-mt-calc">
                Plus G1 a G4<small>na base</small>
              </th>
              <th className="pr-mt-calc">
                Infantil<small>na base</small>
              </th>
              <th className="pr-mt-st">Como está</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={colunas} className="pr-nada">
                  Nenhuma peça com essa busca ou esse filtro.
                </td>
              </tr>
            ) : null}
            {visiveis.map((g) => {
              const cods = g.pecas.map((p) => p.codigo)
              const quantos = cods.filter((c) => marcados.includes(c)).length
              const fechada = fechadas.includes(g.cod)
              const tem = g.pecas.filter((p) => item(p.codigo)).length
              const sem = g.pecas.filter((p) => semBase(p.codigo)).length
              return (
                <Fragment key={g.cod}>
                  <tr className={'pr-mt-g' + (fechada ? ' fechada' : '')}>
                    <td className="pr-ck-col">
                      {podeMexer ? (
                        <Marcacao
                          aria-label={'Marcar o grupo ' + g.nome}
                          checked={quantos === cods.length}
                          meio={quantos > 0 && quantos < cods.length}
                          onChange={() => marcar(cods, quantos !== cods.length)}
                        />
                      ) : null}
                    </td>
                    <td colSpan={colunas - 1}>
                      <button
                        type="button"
                        className={'pr-ad-seta' + (fechada ? '' : ' aberta')}
                        aria-expanded={!fechada}
                        aria-label={(fechada ? 'Abrir ' : 'Fechar ') + g.nome}
                        onClick={() =>
                          setFechados((f) => {
                            const atual = f ?? fechadosDeFabrica
                            return atual.includes(g.cod) ? atual.filter((x) => x !== g.cod) : [...atual, g.cod]
                          })
                        }
                      >
                        <CaretRight size={14} />
                      </button>
                      <span className="pr-gcod">{g.cod === 'sem' ? '...' : g.cod}</span>
                      <b>{g.nome}</b>
                      <span className="pr-mt-gconta">
                        {g.pecas.length} {g.pecas.length === 1 ? 'peça' : 'peças'} · {tem ? `${tem} na tabela` : 'nenhuma na tabela'}
                        {sem ? ` · ${sem} sem preço` : ''}
                      </span>
                      {copiada && podeMexer ? (
                        <Botao
                          tom="contorno"
                          tamanho="sm"
                          className="pr-mt-colar-g"
                          title={'Colar os preços da ' + copiada + ' em todas as peças de ' + g.nome}
                          onClick={() => colar(cods)}
                        >
                          Colar no grupo
                        </Botao>
                      ) : null}
                    </td>
                  </tr>
                  {fechada
                    ? null
                    : g.pecas.map((p) => {
                        const it = item(p.codigo)
                        const marcado = marcados.includes(p.codigo)
                        const v0 = it ? celula(t, it, 0, ctx).valor : null
                        const estado: [keyof typeof CLASSE_DO_ESTADO, string] = !it
                          ? ['fora', 'fora da tabela']
                          : v0 == null
                            ? ['falta', 'falta o preço']
                            : temMao(p.codigo)
                              ? ['mao', `${it.precos.filter((v) => v != null).length} à mão`]
                              : celula(t, it, 0, ctx).origem === 'kit'
                                ? ['', 'soma das peças']
                                : ['', 'pela regra']
                        return (
                          <tr key={p.codigo} className={[marcado ? 'pr-marcada' : '', it ? '' : 'pr-mt-fora'].filter(Boolean).join(' ')}>
                            <td className="pr-ck-col">
                              {podeMexer ? (
                                <Marcacao
                                  aria-label={'Marcar ' + p.codigo}
                                  checked={marcado}
                                  onChange={() => {}}
                                  onClick={(e) => marcarUma(p.codigo, e)}
                                />
                              ) : null}
                            </td>
                            <td className="pr-nm">
                              <div className="pr-mt-nome">
                                <span>
                                  <span className="pr-cod">{p.codigo}</span>
                                  <b>{p.nome}</b>
                                  {p.sub ? <small>{p.sub}</small> : null}
                                </span>
                                {podeMexer && (it || copiada) ? (
                                  copiada && copiada !== p.codigo ? (
                                    <Botao tom="contorno" tamanho="sm" className="pr-mt-copiar" onClick={() => colar([p.codigo])}>
                                      Colar
                                    </Botao>
                                  ) : it ? (
                                    <Botao
                                      tom={copiada === p.codigo ? 'forte' : 'limpo'}
                                      tamanho="sm"
                                      icone
                                      className="pr-mt-copiar"
                                      aria-label={'Copiar os preços da ' + p.codigo}
                                      title="Copiar os preços desta peça para colar em outras"
                                      onClick={() => setCopiada(copiada === p.codigo ? '' : p.codigo)}
                                    >
                                      <Copy size={15} />
                                    </Botao>
                                  ) : null
                                ) : null}
                              </div>
                            </td>
                            <td className="pr-mt-na">
                              <Interruptor
                                ligado={!!it}
                                nome={(it ? 'Tirar ' : 'Pôr ') + p.codigo + (it ? ' da tabela' : ' na tabela')}
                                aoMudar={(sim) =>
                                  podeMexer && mudar((x) => (sim ? porNaTabela(x, [{ codigo: p.codigo, tipo: p.tipo }]) : tirarDaTabela(x, [p.codigo])))
                                }
                              />
                            </td>
                            {t.faixas.map((f, i) => (
                              <td key={nomeDaFaixa(f)} className={i === 0 ? 'pr-col-base' : ''}>
                                <CampoDePreco
                                  codigo={p.codigo}
                                  faixa={i}
                                  celula={it ? celula(t, it, i, ctx) : { valor: null, origem: 'vazio' }}
                                  fora={!it}
                                  rotulo={`${p.codigo}, ${i === 0 ? 'preço base' : nomeDaFaixa(f) + ' peças'}`}
                                  podeMexer={podeMexer}
                                  edicao={edicao}
                                  alca={alca}
                                />
                              </td>
                            ))}
                            <td className="pr-mt-calc">{v0 == null ? '' : formatarNumeroExato(precoDoTamanho(t, v0, 'G1'))}</td>
                            <td className="pr-mt-calc">{v0 == null ? '' : formatarNumeroExato(precoDoTamanho(t, v0, '2A'))}</td>
                            <td className="pr-mt-st">
                              <span className={CLASSE_DO_ESTADO[estado[0]]}>
                                <i />
                                {estado[1]}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
