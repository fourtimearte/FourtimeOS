import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, Printer, Plus, Star, Tag } from '@phosphor-icons/react'
import {
  Aviso,
  Botao,
  Busca,
  Campo,
  Entrada,
  Interruptor,
  Pagina,
  Seletor,
  TituloCartao,
  Vazio,
  avisar,
  semAcento,
} from '@ds'
import { quandoFoi } from '@shared'
import { useSessao } from '@dominio/sessao'
import {
  NOME_DA_SITUACAO,
  ajustarEmLote,
  carregarTabelasDePreco,
  copiarDe,
  escrever,
  nomeDaFaixa,
  salvarTabelaDePreco,
  tornarPadrao,
  voltarParaARegra,
  type Arredondar,
  type RegrasDaTabela,
  type TabelaDePreco,
} from '@dominio/preco'
import { contextoDe, foraDaTabela, itemNovo, linhasDe, usarCatalogo } from './catalogo'
import { GradeDaTabela } from './grade'
import { NovaTabela } from './nova'
import './precos.css'

/* ==========================================================================
   TABELAS DE PREÇO (prancha 134, aprovada em 12/10/2026).

   À esquerda as tabelas da casa; no meio a grade da escolhida; à direita as
   regras que preenchem a grade sozinhas. Quem lê: todo aprovado com acesso à
   Cotação. Quem muda: admin e gerente (a regra mora no banco, 068).

   A grade é editada num RASCUNHO e gravada inteira no Salvar: uma tabela de
   preço muda de uma vez, e não célula a célula na frente de quem está
   cotando agora.
   ========================================================================== */

export const ARREDONDAR: { valor: Arredondar; rotulo: string }[] = [
  { valor: '90', rotulo: ',90' },
  { valor: '00', rotulo: ',00' },
  { valor: '', rotulo: 'Não arredondar' },
]

export function TelaTabelasDePreco() {
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null
  const podeMexer = eu?.papel === 'admin' || eu?.papel === 'gerente'

  const [tabelas, setTabelas] = useState<TabelaDePreco[]>([])
  const [semBanco, setSemBanco] = useState(false)
  const [lendo, setLendo] = useState(true)
  const [falha, setFalha] = useState('')
  const [verArquivadas, setVerArquivadas] = useState(false)
  const [rascunho, setRascunho] = useState<TabelaDePreco | null>(null)
  const [marcados, setMarcados] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [lotePct, setLotePct] = useState('5')
  const [loteArr, setLoteArr] = useState<Arredondar>('90')
  const [gravando, setGravando] = useState(false)
  const [nova, setNova] = useState(false)
  const [trocarPara, setTrocarPara] = useState('')
  const { catalogo } = usarCatalogo()

  const escolhidaId = params.get('t') ?? ''

  async function ler(manter = '') {
    setLendo(true)
    try {
      const r = await carregarTabelasDePreco()
      setTabelas(r.tabelas)
      setSemBanco(r.semBanco)
      setFalha('')
      const alvo = manter || escolhidaId
      if (!alvo && r.tabelas.length) {
        const primeira = r.tabelas.find((t) => t.padrao) ?? r.tabelas.find((t) => t.situacao !== 'arquivada') ?? r.tabelas[0]
        setParams({ t: primeira.id }, { replace: true })
      }
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui ler as tabelas de preço')
    } finally {
      setLendo(false)
    }
  }
  useEffect(() => {
    void ler()
    // so na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const escolhida = tabelas.find((t) => t.id === escolhidaId) ?? null
  /* trocar de tabela troca o rascunho; voltar para a mesma nao perde o que mudou */
  useEffect(() => {
    setRascunho(escolhida ? { ...escolhida, itens: escolhida.itens.map((i) => ({ ...i, precos: [...i.precos] })) } : null)
    setMarcados([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhida?.id, escolhida?.atualizadoEm])

  const t = rascunho
  const sujo = !!t && !!escolhida && JSON.stringify(t) !== JSON.stringify(escolhida)
  const ctx = useMemo(() => (t ? contextoDe(t, catalogo) : null), [t, catalogo])
  const linhas = useMemo(() => (t ? linhasDe(t, catalogo) : []), [t, catalogo])
  const gruposDaTabela = [...new Set(linhas.map((l) => l.grupo))]
  const filtradas = linhas.filter(
    (l) =>
      (!grupo || l.grupo === grupo) &&
      (!busca.trim() || semAcento(l.item.codigo + ' ' + l.nome).includes(semAcento(busca.trim()))),
  )

  const mudar = (f: (x: TabelaDePreco) => TabelaDePreco) => setRascunho((x) => (x ? f(x) : x))
  const regra = (parcial: Partial<RegrasDaTabela>) => mudar((x) => ({ ...x, regras: { ...x.regras, ...parcial } }))

  async function salvar(alvo: TabelaDePreco | null = t) {
    if (!alvo || gravando) return
    if (!alvo.nome.trim()) {
      avisar('A tabela precisa de um nome', 'warn')
      return
    }
    setGravando(true)
    try {
      const salva = await salvarTabelaDePreco(alvo)
      setTabelas((ts) => (ts.some((x) => x.id === salva.id) ? ts.map((x) => (x.id === salva.id ? salva : x)) : [...ts, salva]))
      setParams({ t: salva.id }, { replace: true })
      avisar('Tabela ' + salva.nome + ' salva', 'ok')
      return salva
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar a tabela', 'warn')
    } finally {
      setGravando(false)
    }
  }

  async function padrao() {
    if (!t) return
    try {
      if (sujo) await salvar()
      await tornarPadrao(t.id)
      await ler(t.id)
      avisar(t.nome + ' é a padrão das cotações novas', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui trocar a padrão', 'warn')
    }
  }

  async function situacao(s: TabelaDePreco['situacao']) {
    if (!t) return
    if (s === 'arquivada' && t.padrao) {
      avisar('A padrão não arquiva: escolha outra padrão antes', 'warn')
      return
    }
    await salvar({ ...t, situacao: s })
  }

  async function duplicar() {
    if (!t) return
    const base = t.nome.replace(/ \(cópia( \d+)?\)$/, '')
    let nome = base + ' (cópia)'
    for (let n = 2; tabelas.some((x) => x.nome.toLowerCase() === nome.toLowerCase()); n++) nome = `${base} (cópia ${n})`
    const salva = await salvar({ ...copiarDe(t, nome, 0, t.regras.arredondar), regras: { ...t.regras } })
    if (salva) avisar('Cópia criada como rascunho', 'ok')
  }

  const visiveis = tabelas.filter((x) => (verArquivadas ? x.situacao === 'arquivada' : x.situacao !== 'arquivada'))
  const arquivadas = tabelas.filter((x) => x.situacao === 'arquivada').length
  const ativas = tabelas.filter((x) => x.situacao === 'ativa').length
  const nomeDaPadrao = tabelas.find((x) => x.padrao)?.nome

  return (
    <Pagina
      acima="Comercial"
      titulo="Tabelas de preço"
      sub={
        semBanco
          ? 'falta a migração 068 no banco'
          : `${ativas} ${ativas === 1 ? 'tabela ativa' : 'tabelas ativas'}` +
            (nomeDaPadrao ? ` · a padrão das cotações novas é a ${nomeDaPadrao}` : ' · nenhuma é a padrão ainda')
      }
      acoes={
        <>
          {t && t.id ? (
            <Botao tom="contorno" onClick={() => navegar('/tabelas/' + t.id + '/imprimir')}>
              <Printer size={18} />
              Imprimir
            </Botao>
          ) : null}
          {podeMexer && !semBanco ? (
            <Botao tom="primario" onClick={() => setNova(true)}>
              <Plus size={18} />
              Nova tabela
            </Botao>
          ) : null}
        </>
      }
    >
      {semBanco ? (
        <Aviso tom="warn" titulo="As tabelas de preço ainda não estão no banco">
          Falta rodar a migração 068 (banco/068-as-tabelas-de-preco.sql) no Supabase. Até lá, a cotação continua com a
          lista de tabelas de antes, e nada se perde.
        </Aviso>
      ) : falha ? (
        <Aviso tom="brand" titulo="Não consegui ler as tabelas de preço">
          {falha}
        </Aviso>
      ) : (
        <div className="pr-mesa">
          <div className="pilha pr-col">
            <span className="pr-rot">
              <Tag size={15} />
              {verArquivadas ? 'Arquivadas' : 'As tabelas da casa'}
            </span>
            <div className="pr-lista" role="list">
              {visiveis.length === 0 ? (
                <p className="pr-nada">{lendo ? 'Lendo...' : verArquivadas ? 'Nenhuma arquivada.' : 'Nenhuma tabela ainda.'}</p>
              ) : (
                visiveis.map((x) => (
                  <button
                    type="button"
                    role="listitem"
                    key={x.id}
                    className={'pr-item' + (x.id === escolhidaId ? ' ligado' : '')}
                    onClick={() => {
                      /* mudanca nao salva: o primeiro clique avisa, o segundo troca */
                      if (sujo && trocarPara !== x.id && x.id !== escolhidaId) {
                        setTrocarPara(x.id)
                        avisar('Há mudanças não salvas nesta tabela. Salve, ou clique de novo para trocar sem salvar.', 'warn')
                        return
                      }
                      setTrocarPara('')
                      setParams({ t: x.id })
                    }}
                  >
                    <span className="pr-l1">
                      <b className="corta">{x.nome}</b>
                      {x.padrao ? (
                        <span className="pr-selo pr-selo-padrao">
                          <Star size={12} weight="fill" />
                          PADRÃO
                        </span>
                      ) : x.situacao !== 'ativa' ? (
                        <span className="pr-selo pr-selo-rasc">{NOME_DA_SITUACAO[x.situacao].toUpperCase()}</span>
                      ) : null}
                    </span>
                    <small>
                      {x.itens.length} {x.itens.length === 1 ? 'item' : 'itens'}
                      {x.valeAte ? ' · vale até ' + x.valeAte.split('-').reverse().join('/') : ''}
                    </small>
                    <small>{x.soGerente ? 'Só gerente e admin escolhem' : x.situacao === 'rascunho' ? 'Ainda não aparece na cotação' : 'Todos os vendedores usam'}</small>
                  </button>
                ))
              )}
            </div>
            {arquivadas || verArquivadas ? (
              <Botao tom="limpo" tamanho="sm" onClick={() => setVerArquivadas((v) => !v)}>
                {verArquivadas ? 'Voltar às tabelas da casa' : `Arquivadas (${arquivadas})`}
              </Botao>
            ) : null}
          </div>

          {!t ? (
            <div className="cartao pr-cartao">
              <Vazio
                titulo={lendo ? 'Lendo as tabelas...' : 'Nenhuma tabela escolhida'}
                texto={podeMexer ? 'Crie a primeira em Nova tabela, copiando de outra ou em branco.' : 'Quando houver uma tabela, ela aparece aqui.'}
              />
            </div>
          ) : (
            <section className="cartao pr-cartao" aria-label={'Tabela ' + t.nome}>
              <div className="pr-cab">
                <div className="pilha">
                  {podeMexer ? (
                    <input
                      className="pr-titulo-campo"
                      aria-label="Nome da tabela"
                      value={t.nome}
                      onChange={(e) => mudar((x) => ({ ...x, nome: e.target.value }))}
                    />
                  ) : (
                    <h2 className="pr-titulo">{t.nome}</h2>
                  )}
                  <p className="pr-apoio">
                    {t.itens.length} {t.itens.length === 1 ? 'item' : 'itens'} em {t.faixas.length} faixas de quantidade ·{' '}
                    {NOME_DA_SITUACAO[t.situacao].toLowerCase()}
                    {t.padrao ? ' · padrão das cotações novas' : ''}
                    {t.atualizadoEm ? ' · mudada ' + quandoFoi(t.atualizadoEm) : ''}
                  </p>
                </div>
                {podeMexer ? (
                  <div className="fileira">
                    {!t.padrao && t.situacao !== 'arquivada' ? (
                      <Botao tom="contorno" onClick={() => void padrao()}>
                        <Star size={17} />
                        Tornar padrão
                      </Botao>
                    ) : null}
                    {t.situacao === 'rascunho' ? (
                      <Botao tom="contorno" onClick={() => void situacao('ativa')}>
                        Ativar
                      </Botao>
                    ) : t.situacao === 'arquivada' ? (
                      <Botao tom="contorno" onClick={() => void situacao('ativa')}>
                        Desarquivar
                      </Botao>
                    ) : !t.padrao ? (
                      <Botao tom="contorno" onClick={() => void situacao('arquivada')}>
                        Arquivar
                      </Botao>
                    ) : null}
                    <Botao tom="contorno" onClick={() => void duplicar()}>
                      <Copy size={17} />
                      Duplicar
                    </Botao>
                    <Botao tom="primario" disabled={!sujo || gravando} onClick={() => void salvar()}>
                      {gravando ? 'Salvando...' : sujo ? 'Salvar' : 'Salvo'}
                    </Botao>
                  </div>
                ) : null}
              </div>

              <div className="fileira pr-ferr">
                <Busca
                  placeholder="Buscar código ou nome"
                  aria-label="Buscar código ou nome"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                <Seletor
                  rotulo="GRUPO"
                  valor={grupo}
                  vazio="Todos"
                  opcoes={gruposDaTabela.map((g) => ({ valor: g, rotulo: g }))}
                  aoEscolher={setGrupo}
                />
                {podeMexer ? (
                  <Seletor
                    rotulo="ADICIONAR"
                    valor=""
                    vazio="Referência ou kit"
                    comBusca
                    opcoes={foraDaTabela(t, catalogo)}
                    aoEscolher={(v) => {
                      if (!v) return
                      mudar((x) => ({ ...x, itens: [...x.itens, itemNovo(v, x.faixas.length)] }))
                    }}
                  />
                ) : null}
              </div>

              {podeMexer && marcados.length ? (
                <div className="pr-lote" role="group" aria-label="Mudar em lote">
                  <b>
                    {marcados.length} {marcados.length === 1 ? 'marcada' : 'marcadas'}
                  </b>
                  <span>Mudar o preço em</span>
                  <Entrada
                    className="pr-lote-pct"
                    aria-label="Por cento"
                    inputMode="decimal"
                    value={lotePct}
                    onChange={(e) => setLotePct(e.target.value)}
                  />
                  <span>% e arredondar para</span>
                  <Seletor valor={loteArr} vazio="Não arredondar" opcoes={ARREDONDAR.filter((a) => a.valor)} aoEscolher={(v) => setLoteArr(v as Arredondar)} />
                  <Botao
                    tom="primario"
                    tamanho="sm"
                    onClick={() => {
                      const pct = Number(lotePct.replace(',', '.'))
                      if (!Number.isFinite(pct)) return avisar('Escreva quantos por cento (use menos para baixar)', 'warn')
                      mudar((x) => ajustarEmLote(x, marcados, pct, loteArr))
                    }}
                  >
                    Aplicar {marcados.length === 1 ? 'na marcada' : `nas ${marcados.length}`}
                  </Botao>
                  <Botao tom="contorno" tamanho="sm" onClick={() => mudar((x) => voltarParaARegra(x, marcados))}>
                    Voltar para a regra
                  </Botao>
                  <Botao
                    tom="contorno"
                    tamanho="sm"
                    onClick={() => {
                      mudar((x) => ({ ...x, itens: x.itens.filter((i) => !marcados.includes(i.codigo)) }))
                      setMarcados([])
                    }}
                  >
                    Tirar da tabela
                  </Botao>
                </div>
              ) : null}

              {linhas.length === 0 ? (
                <Vazio
                  titulo="Nenhuma referência nesta tabela"
                  texto={podeMexer ? 'Use ADICIONAR para trazer referências e kits da ficha técnica.' : ''}
                />
              ) : ctx ? (
                <GradeDaTabela
                  tabela={t}
                  linhas={filtradas}
                  ctx={ctx}
                  podeMexer={podeMexer}
                  marcados={marcados}
                  aoMarcar={setMarcados}
                  aoEscrever={(cod, i, v) => mudar((x) => escrever(x, cod, i, v))}
                />
              ) : null}
              <p className="pr-pe">{sujo ? 'Há mudanças não salvas.' : 'Tudo salvo.'}</p>
            </section>
          )}

          {t ? (
            <aside className="pilha pr-col">
              <div className="cartao cartao-pad pilha pr-bloco">
                <TituloCartao icone={Tag}>As regras desta tabela</TituloCartao>
                <p className="pr-nota">As regras preenchem a grade sozinhas. O que alguém escreve por cima fica marcado e a regra não muda.</p>
                <Regra rotulo="De uma faixa para a seguinte (%)" valor={t.regras.passoPct} podeMexer={podeMexer} aoMudar={(v) => regra({ passoPct: v })} />
                <Campo rotulo="Arredondar para">
                  <Seletor
                    campo
                    bloco
                    valor={t.regras.arredondar}
                    vazio="Não arredondar"
                    opcoes={ARREDONDAR.filter((a) => a.valor)}
                    aoEscolher={(v) => podeMexer && regra({ arredondar: v as Arredondar })}
                  />
                </Campo>
                <Regra rotulo="Plus, G1 a G4 (R$ a mais)" valor={t.regras.plusReais} podeMexer={podeMexer} aoMudar={(v) => regra({ plusReais: v })} />
                <Regra rotulo="Infantil, 2 a 14 anos (%)" valor={t.regras.infantilPct} podeMexer={podeMexer} aoMudar={(v) => regra({ infantilPct: v })} />
                <Regra rotulo="Kit sem base: a soma das peças (%)" valor={t.regras.kitPct} podeMexer={podeMexer} aoMudar={(v) => regra({ kitPct: v })} />
              </div>
              <div className="cartao cartao-pad pilha pr-bloco">
                <TituloCartao icone={Tag}>Onde ela vale</TituloCartao>
                <Campo rotulo="Vale até" dica="Vazio: sem data para acabar">
                  <Entrada
                    type="date"
                    value={t.valeAte}
                    disabled={!podeMexer}
                    onChange={(e) => mudar((x) => ({ ...x, valeAte: e.target.value }))}
                  />
                </Campo>
                <Interruptor
                  ligado={t.soGerente}
                  aoMudar={(v) => podeMexer && mudar((x) => ({ ...x, soGerente: v }))}
                  rotulo="Só gerente e admin escolhem na cotação"
                />
                <p className="pr-nota">
                  Faixas: {t.faixas.map(nomeDaFaixa).join(', ')}. Mudar um preço aqui não muda cotação já enviada ao cliente.
                </p>
              </div>
              <div className="cartao cartao-pad pilha pr-bloco">
                <TituloCartao icone={Tag}>Como ler a grade</TituloCartao>
                <div className="pilha pr-leg">
                  <span>
                    <i className="pr-v pr-v-base">49,90</i>a base, escrita por alguém
                  </span>
                  <span>
                    <i className="pr-v pr-v-regra">44,90</i>cinza: veio da regra
                  </span>
                  <span>
                    <i className="pr-v pr-v-mao">48,90</i>com ponto: escrito à mão
                  </span>
                  <span>
                    <i className="pr-v pr-v-kit">82,90</i>o kit pela soma das peças
                  </span>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      )}

      {nova ? (
        <NovaTabela
          tabelas={tabelas}
          aoFechar={() => setNova(false)}
          aoCriar={async (x) => {
            const salva = await salvar(x)
            if (salva) setNova(false)
          }}
        />
      ) : null}
    </Pagina>
  )
}

function Regra({
  rotulo,
  valor,
  podeMexer,
  aoMudar,
}: {
  rotulo: string
  valor: number
  podeMexer: boolean
  aoMudar: (v: number) => void
}) {
  const [texto, setTexto] = useState(String(valor).replace('.', ','))
  useEffect(() => setTexto(String(valor).replace('.', ',')), [valor])
  return (
    <Campo rotulo={rotulo}>
      <Entrada
        inputMode="decimal"
        value={texto}
        disabled={!podeMexer}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const n = Number(texto.replace(',', '.'))
          if (Number.isFinite(n)) aoMudar(n)
          else setTexto(String(valor).replace('.', ','))
        }}
      />
    </Campo>
  )
}
