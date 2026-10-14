import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, DotsThree, List, PencilSimple, Printer, Plus, Package, Star, Table, Tag, Trash } from '@phosphor-icons/react'
import {
  Aviso,
  Botao,
  Busca,
  Campo,
  Entrada,
  Interruptor,
  MenuDeContexto,
  LINHA_ESCOLHIDA,
  Modal,
  Pagina,
  Segmentado,
  Selo,
  Seletor,
  TituloCartao,
  Vazio,
  avisar,
  useRascunho,
} from '@ds'
import { quandoFoi } from '@shared'
import { useSessao } from '@dominio/sessao'
import {
  NOME_DA_SITUACAO,
  ajustarEmLote,
  apagarTabelaDePreco,
  celula,
  carregarTabelasDePreco,
  colarNaTabela,
  copiarDe,
  copiarPrecosDe,
  escrever,
  nomeDaFaixa,
  numeroDoTexto,
  porNaTabela,
  preencherCelulas,
  trocarFaixas,
  salvarTabelaDePreco,
  tornarPadrao,
  voltarParaARegra,
  type Arredondar,
  type RegrasDaTabela,
  type TabelaDePreco,
} from '@dominio/preco'
import { achaNaBusca, contextoDe, gruposDoCatalogo, linhasDe, usarCatalogo } from './catalogo'
import { AdicionarDoCatalogo } from './adicionar'
import { MudarAsFaixas } from './faixas'
import { GradeDaTabela } from './grade'
import { ModoTabela } from './modo-tabela'
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

   A REVISÃO DE 12/10/2026 (pranchas 139 a 143, que ficaram no lugar da 134
   e da 135): o preço é um campo à vista, a busca acha também no catálogo, o
   Adicionar é agrupado, as faixas têm começo e fim e mudam depois, a tabela
   nova mostra três jeitos de começar, e há o MODO TABELA, como o do Estoque,
   para mexer em muitas peças de uma vez (?modo=tabela).
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
  const [rascunho, setRascunho] = useState<TabelaDePreco | null>(null)
  const [marcados, setMarcados] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [lotePct, setLotePct] = useState('5')
  const [loteArr, setLoteArr] = useState<Arredondar>('90')
  const [gravando, setGravando] = useState(false)
  const [nova, setNova] = useState(false)
  const [trocarPara, setTrocarPara] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [mudandoFaixas, setMudandoFaixas] = useState(false)
  const [soSemPreco, setSoSemPreco] = useState(false)
  const botaoAdicionar = useRef<HTMLSpanElement>(null)
  const campoDoNome = useRef<HTMLInputElement>(null)
  const [menuDe, setMenuDe] = useState('')
  const ancoraDoMenu = useRef<HTMLElement | null>(null)
  const [excluindo, setExcluindo] = useState<TabelaDePreco | null>(null)
  const souAdmin = eu?.papel === 'admin'
  const { catalogo } = usarCatalogo()

  const escolhidaId = params.get('t') ?? ''
  const modo: 'lista' | 'tabela' = params.get('modo') === 'tabela' ? 'tabela' : 'lista'
  const trocarModo = (m: 'lista' | 'tabela') => {
    const p = new URLSearchParams(params)
    if (m === 'tabela') p.set('modo', 'tabela')
    else p.delete('modo')
    setParams(p, { replace: true })
  }

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
        setParams((p) => {
          const n = new URLSearchParams(p)
          n.set('t', primeira.id)
          return n
        }, { replace: true })
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
  /* o rascunho no navegador (Kit de Comportamento, 14/10/2026): a tabela mexida
     e não salva volta se a página recarregar, fechar ou trocar */
  useRascunho({
    chave: 'tabela-de-preco:' + (escolhida?.id ?? ''),
    ligado: !!escolhida && !!t,
    valor: t,
    sujo,
    base: escolhida,
    aoVoltar: (v) => {
      if (v.valor && v.valor.id === escolhida?.id) setRascunho(v.valor)
    },
    aoDescartar: () =>
      setRascunho(escolhida ? { ...escolhida, itens: escolhida.itens.map((i) => ({ ...i, precos: [...i.precos] })) } : null),
  })
  const ctx = useMemo(() => (t ? contextoDe(t, catalogo) : null), [t, catalogo])
  const linhas = useMemo(() => (t ? linhasDe(t, catalogo) : []), [t, catalogo])
  const gruposDaTabela = [...new Set(linhas.map((l) => l.grupo))]
  const naTabela = useMemo(() => new Set(t?.itens.map((i) => i.codigo) ?? []), [t])
  const doCatalogo = useMemo(() => gruposDoCatalogo(catalogo, naTabela), [catalogo, naTabela])
  const semPreco = ctx && t ? linhas.filter((l) => celula(t, l.item, 0, ctx).valor == null).length : 0
  const filtradas = linhas.filter(
    (l) =>
      (!grupo || l.grupo === grupo) &&
      (!soSemPreco || (ctx && t && celula(t, l.item, 0, ctx).valor == null)) &&
      achaNaBusca(busca, l.item.codigo, l.nome, l.grupoCod, l.grupo),
  )
  /* a busca procura tambem no catalogo: o que a tabela nao tem aparece embaixo */
  const foraDaBusca = busca.trim()
    ? doCatalogo.flatMap((g) => g.pecas.filter((p) => !naTabela.has(p.codigo) && achaNaBusca(busca, p.codigo, p.nome, g.cod, g.nome)))
    : []
  const outras = tabelas.filter((x) => x.id !== t?.id && x.itens.length)

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
      setParams((p) => {
        const n = new URLSearchParams(p)
        n.set('t', salva.id)
        return n
      }, { replace: true })
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

  async function situacao(s: TabelaDePreco['situacao'], alvo: TabelaDePreco | null = t) {
    if (!alvo) return
    if (s === 'arquivada' && alvo.padrao) {
      avisar('A padrão não arquiva: escolha outra padrão antes', 'warn')
      return
    }
    /* a escolhida leva o rascunho junto; outra da lista vai como está no banco */
    const base = alvo.id === t?.id ? t : alvo
    const salva = await salvar({ ...base, situacao: s })
    if (salva && s === 'arquivada') avisar(salva.nome + ' foi para as arquivadas. Dá para desarquivar quando quiser.', 'ok')
  }

  async function duplicar(alvo: TabelaDePreco | null = t) {
    if (!alvo) return
    const origem = alvo.id === t?.id ? t : alvo
    const base = origem.nome.replace(/ \(cópia( \d+)?\)$/, '')
    let nome = base + ' (cópia)'
    for (let n = 2; tabelas.some((x) => x.nome.toLowerCase() === nome.toLowerCase()); n++) nome = `${base} (cópia ${n})`
    const salva = await salvar({ ...copiarDe(origem, nome, 0, origem.regras.arredondar), regras: { ...origem.regras } })
    if (salva) avisar('Cópia criada como rascunho', 'ok')
  }

  async function excluir(alvo: TabelaDePreco) {
    try {
      await apagarTabelaDePreco(alvo.id)
      const restam = tabelas.filter((x) => x.id !== alvo.id)
      setTabelas(restam)
      setExcluindo(null)
      if (alvo.id === escolhidaId) {
        const outra = restam.find((x) => x.padrao) ?? restam.find((x) => x.situacao !== 'arquivada') ?? restam[0]
        setParams((p) => {
          const n = new URLSearchParams(p)
          if (outra) n.set('t', outra.id)
          else n.delete('t')
          return n
        }, { replace: true })
      }
      avisar('Tabela ' + alvo.nome + ' excluída', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui excluir a tabela', 'warn')
    }
  }

  /* O MENU DE CADA TABELA (pedido dele em 12/10/2026: "não consigo editar ou
     excluir"): o mesmo no três pontinhos da lista e no do cabeçalho */
  function acoesDe(x: TabelaDePreco) {
    const abrirEla = (depois?: () => void) => {
      if (x.id !== escolhidaId) trocarTabela(x.id)
      if (depois) setTimeout(depois, 60)
    }
    return [
      { rotulo: 'Editar: mudar o nome', aoEscolher: () => abrirEla(() => campoDoNome.current?.select()) },
      { rotulo: 'Mudar as faixas', aoEscolher: () => abrirEla(() => setMudandoFaixas(true)) },
      { rotulo: 'Duplicar', aoEscolher: () => void duplicar(x) },
      ...(x.padrao
        ? []
        : x.situacao === 'arquivada'
          ? [{ rotulo: 'Desarquivar', aoEscolher: () => void situacao('ativa', x) }]
          : [{ rotulo: 'Arquivar (some da cotação, pode voltar)', aoEscolher: () => void situacao('arquivada', x) }]),
      ...(souAdmin && !x.padrao ? [{ rotulo: 'Excluir de vez', risco: true, aoEscolher: () => setExcluindo(x) }] : []),
    ]
  }
  const menuDaTabela = tabelas.find((x) => x.id === menuDe)

  function trocarTabela(id: string) {
    if (id === escolhidaId) return
    /* mudanca nao salva: o primeiro clique avisa, o segundo troca */
    if (sujo && trocarPara !== id) {
      setTrocarPara(id)
      avisar('Há mudanças não salvas nesta tabela. Salve, ou clique de novo para trocar sem salvar.', 'warn')
      return
    }
    setTrocarPara('')
    setSoSemPreco(false)
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('t', id)
      return n
    })
  }

  const seletorDeModo = (
    <Segmentado<'lista' | 'tabela'>
      valor={modo}
      aoMudar={trocarModo}
      opcoes={[
        { valor: 'lista', rotulo: <span className="pr-seg"><List size={16} />Lista</span> },
        { valor: 'tabela', rotulo: <span className="pr-seg"><Table size={16} />Tabela</span> },
      ]}
    />
  )

  const rodape = (
    <p className="pr-pe">
      {sujo ? 'Há mudanças não salvas: elas só valem na cotação depois do Salvar.' : 'Tudo salvo.'}
    </p>
  )

  function cabecalho(x: TabelaDePreco) {
    return (
      <div className="pr-cab">
        <div className="pilha">
          {podeMexer ? (
            <label className="pr-titulo-rotulo" title="Clique para mudar o nome">
              <input
                ref={campoDoNome}
                className="pr-titulo-campo"
                aria-label="Nome da tabela"
                value={x.nome}
                onChange={(e) => mudar((y) => ({ ...y, nome: e.target.value }))}
              />
              <PencilSimple size={16} aria-hidden="true" />
            </label>
          ) : (
            <h2 className="pr-titulo">{x.nome}</h2>
          )}
          <p className="pr-apoio">
            {x.itens.length ? `${x.itens.length} ${x.itens.length === 1 ? 'peça' : 'peças'}` : 'nenhuma peça'} em {x.faixas.length}{' '}
            {x.faixas.length === 1 ? 'faixa' : 'faixas'} ({x.faixas.map(nomeDaFaixa).join(', ')}) ·{' '}
            {NOME_DA_SITUACAO[x.situacao].toLowerCase()}
            {x.padrao ? ' · padrão das cotações novas' : ''}
            {x.atualizadoEm ? ' · mudada ' + quandoFoi(x.atualizadoEm) : ''}
          </p>
        </div>
        {podeMexer ? (
          <div className="fileira">
            {!x.padrao && x.situacao !== 'arquivada' ? (
              <Botao tom="contorno" onClick={() => void padrao()}>
                <Star size={17} />
                Tornar padrão
              </Botao>
            ) : null}
            {x.situacao === 'rascunho' ? (
              <Botao tom="contorno" onClick={() => void situacao('ativa')}>
                Ativar
              </Botao>
            ) : x.situacao === 'arquivada' ? (
              <Botao tom="contorno" onClick={() => void situacao('ativa')}>
                Desarquivar
              </Botao>
            ) : !x.padrao ? (
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
            <Botao
              tom="contorno"
              icone
              aria-label={'Mais ações da ' + x.nome}
              title="Mudar as faixas, arquivar ou excluir"
              aria-haspopup="menu"
              aria-expanded={menuDe === x.id + ':cab'}
              onClick={(e) => {
                ancoraDoMenu.current = e.currentTarget
                setMenuDe((m) => (m === x.id + ':cab' ? '' : x.id + ':cab'))
              }}
            >
              <DotsThree size={18} weight="bold" />
            </Botao>
          </div>
        ) : null}
      </div>
    )
  }

  /* A COLUNA EM SECOES (pedido de 12/10/2026): Rascunhos, Ativas e
     Arquivadas, num cartao branco, como a fila do PCP e da Separacao; a
     escolhida leva o desenho do item aberto do menu (LINHA_ESCOLHIDA) */
  const porData = (a: TabelaDePreco, b: TabelaDePreco) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || '')
  const secoes: [string, TabelaDePreco[]][] = [
    ['Rascunhos', tabelas.filter((x) => x.situacao === 'rascunho').sort(porData)],
    ['Ativas', tabelas.filter((x) => x.situacao === 'ativa').sort((a, b) => Number(b.padrao) - Number(a.padrao) || a.nome.localeCompare(b.nome, 'pt'))],
    ['Arquivadas', tabelas.filter((x) => x.situacao === 'arquivada').sort(porData)],
  ]
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
      ) : modo === 'tabela' && t && ctx ? (
        /* O MODO TABELA ocupa a largura toda: o catálogo inteiro precisa de lugar */
        <section className="cartao pr-cartao" aria-label={'Tabela ' + t.nome + ', modo tabela'}>
          {cabecalho(t)}
          <div className="fileira pr-ferr">
            <Seletor
              rotulo="TABELA"
              valor={t.id}
              vazio="Escolher"
              opcoes={tabelas.filter((x) => x.situacao !== 'arquivada').map((x) => ({ valor: x.id, rotulo: x.nome + (x.padrao ? ' (padrão)' : '') }))}
              aoEscolher={(id) => id && trocarTabela(id)}
            />
            {seletorDeModo}
            <Busca placeholder="Buscar código, nome ou grupo" aria-label="Buscar código, nome ou grupo" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <ModoTabela tabela={t} outras={outras} grupos={doCatalogo} busca={busca} ctx={ctx} podeMexer={podeMexer} mudar={mudar} />
          {rodape}
        </section>
      ) : (
        <div className="pr-mesa">
          <section className="cartao pr-tabelas" aria-label="As tabelas de preço">
            <div className="pr-col-cab">
              <b>
                <Tag size={17} />
                As tabelas
              </b>
              <small>{tabelas.length}</small>
            </div>
            {!tabelas.length ? <p className="pr-nada">{lendo ? 'Lendo...' : 'Nenhuma tabela ainda.'}</p> : null}
            {secoes.map(([nome, lista]) =>
              lista.length ? (
                <div key={nome} className="pr-secao" role="list" aria-label={nome}>
                  <div className="pr-g">
                    {nome}
                    <small>{lista.length}</small>
                  </div>
                  {lista.map((x) => (
                    <div
                      role="listitem"
                      key={x.id}
                      className={'pr-item-caixa' + (x.id === escolhidaId ? ' ' + LINHA_ESCOLHIDA : '') + (x.situacao === 'arquivada' ? ' pr-arq' : '')}
                    >
                      <button
                        type="button"
                        className={'pr-item' + (x.id === escolhidaId ? ' ligado' : '')}
                        aria-pressed={x.id === escolhidaId}
                        onClick={() => trocarTabela(x.id)}
                      >
                        <span className="pr-l1">
                          <b className="corta">{x.nome}</b>
                          {x.padrao ? (
                            <Selo tom="brand">
                              <Star size={12} weight="fill" />
                              Padrão
                            </Selo>
                          ) : null}
                        </span>
                        <small>
                          {x.itens.length ? `${x.itens.length} ${x.itens.length === 1 ? 'peça' : 'peças'}` : 'nenhuma peça ainda'}
                          {x.valeAte ? ' · vale até ' + x.valeAte.split('-').reverse().join('/') : ''}
                        </small>
                        <small>
                          {x.situacao === 'arquivada'
                            ? 'Some da cotação, pode voltar'
                            : x.situacao === 'rascunho'
                              ? 'Ainda não aparece na cotação'
                              : x.soGerente
                                ? 'Só gerente e admin escolhem'
                                : 'Todos os vendedores usam'}
                        </small>
                      </button>
                      {podeMexer ? (
                        <button
                          type="button"
                          className="btn btn-limpo icone pr-item-mais"
                          aria-label={'Editar, duplicar, arquivar ou excluir a ' + x.nome}
                          title="Editar, duplicar, arquivar ou excluir"
                          aria-haspopup="menu"
                          aria-expanded={menuDe === x.id}
                          onClick={(e) => {
                            ancoraDoMenu.current = e.currentTarget
                            setMenuDe((m) => (m === x.id ? '' : x.id))
                          }}
                        >
                          <DotsThree size={18} weight="bold" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null,
            )}
          </section>

          {!t ? (
            <div className="cartao pr-cartao">
              <Vazio
                titulo={lendo ? 'Lendo as tabelas...' : 'Nenhuma tabela escolhida'}
                texto={podeMexer ? 'Crie a primeira em Nova tabela, copiando de outra ou em branco.' : 'Quando houver uma tabela, ela aparece aqui.'}
              />
            </div>
          ) : (
            <section className="cartao pr-cartao" aria-label={'Tabela ' + t.nome}>
              {cabecalho(t)}

              <div className="fileira pr-ferr">
                <Busca
                  placeholder="Buscar código, nome ou grupo"
                  aria-label="Buscar código, nome ou grupo"
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
                {seletorDeModo}
                {podeMexer ? (
                  <span ref={botaoAdicionar} className="pr-ferr-fim">
                    <Botao tom="contorno" aria-expanded={adicionando} onClick={() => setAdicionando((a) => !a)}>
                      <Plus size={17} />
                      Adicionar referência ou kit
                    </Botao>
                  </span>
                ) : null}
              </div>

              {semPreco ? (
                <div className="pr-aviso" role="status">
                  <Aviso
                    titulo={`${semPreco} ${semPreco === 1 ? 'peça sem preço base' : 'peças sem preço base'}`}
                    acao={
                      <Botao tom="contorno" tamanho="sm" onClick={() => setSoSemPreco((v) => !v)}>
                        {soSemPreco ? 'Mostrar todas' : semPreco === 1 ? 'Mostrar só ela' : 'Mostrar só elas'}
                      </Botao>
                    }
                  >
                    {semPreco === 1 ? 'Ela não aparece' : 'Elas não aparecem'} na cotação nem na folha impressa até ganhar um preço.
                  </Aviso>
                </div>
              ) : null}

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

              {linhas.length === 0 && !busca.trim() ? (
                <ComecoDaTabela
                  nome={t.nome}
                  podeMexer={podeMexer}
                  outras={outras}
                  aoCatalogo={() => setAdicionando(true)}
                  aoModoTabela={() => trocarModo('tabela')}
                  aoCopiar={(o, pct) => {
                    mudar((x) => copiarPrecosDe(x, o, o.itens.map((i) => i.codigo), pct, x.regras.arredondar))
                    avisar(`${o.itens.length} peças vieram da ${o.nome}`, 'ok')
                  }}
                />
              ) : ctx ? (
                filtradas.length || foraDaBusca.length ? (
                  <GradeDaTabela
                    tabela={t}
                    linhas={filtradas}
                    fora={foraDaBusca}
                    busca={busca}
                    ctx={ctx}
                    podeMexer={podeMexer}
                    marcados={marcados}
                    aoMarcar={setMarcados}
                    aoEscrever={(cod, i, v) => mudar((x) => escrever(x, cod, i, v))}
                    aoColar={(cods, k, i, texto) => {
                      let n = 0
                      mudar((x) => {
                        const r = colarNaTabela(x, cods.map((c) => ({ codigo: c, tipo: x.itens.find((it) => it.codigo === c)?.tipo ?? 'referencia' })), k, i, texto)
                        n = r.coladas
                        return r.tabela
                      })
                      setTimeout(() => avisar(`${n} ${n === 1 ? 'preço colado' : 'preços colados'} da planilha`, 'ok'), 0)
                    }}
                    aoPreencher={(alvos, v) =>
                      mudar((x) => preencherCelulas(x, alvos.map((a) => ({ ...a, tipo: x.itens.find((i) => i.codigo === a.codigo)?.tipo ?? 'referencia' })), v))
                    }
                    aoPor={(peca) => mudar((x) => porNaTabela(x, [{ codigo: peca.codigo, tipo: peca.tipo }]))}
                  />
                ) : (
                  <Vazio titulo="Nada com essa busca" texto="Nem na tabela nem no catálogo da ficha técnica." />
                )
              ) : null}
              {rodape}
            </section>
          )}

          {t ? (
            <aside className="pilha pr-col">
              <div className="cartao cartao-pad pilha pr-bloco">
                <TituloCartao icone={Tag}>As faixas de quantidade</TituloCartao>
                <div className="fileira miuda">
                  {t.faixas.map((f) => (
                    <Selo key={f.de} forma="contorno">
                      {nomeDaFaixa(f)}
                    </Selo>
                  ))}
                </div>
                {podeMexer ? (
                  <Botao tom="contorno" tamanho="sm" className="pr-alinha-inicio" onClick={() => setMudandoFaixas(true)}>
                    <PencilSimple size={15} />
                    Mudar as faixas
                  </Botao>
                ) : null}
              </div>
              <div className="cartao cartao-pad pilha pr-bloco">
                <TituloCartao icone={Tag}>As regras desta tabela</TituloCartao>
                <p className="pr-nota">Você escreve só o PREÇO BASE. As outras faixas saem dele pela regra; o que alguém escreve por cima fica marcado e a regra não muda.</p>
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
                <p className="pr-nota">Mudar um preço aqui não muda cotação já enviada ao cliente.</p>
              </div>
              <div className="cartao cartao-pad pilha pr-bloco">
                <TituloCartao icone={Tag}>Como ler a grade</TituloCartao>
                <div className="pilha pr-leg">
                  <span>
                    <i className="pr-pc pr-pc-base">49,90</i>a base, escrita por alguém
                  </span>
                  <span>
                    <i className="pr-pc pr-pc-regra">44,90</i>cinza: veio da regra
                  </span>
                  <span>
                    <i className="pr-pc pr-pc-mao">47,00</i>ponto: escrito à mão
                  </span>
                  <span>
                    <i className="pr-pc pr-pc-kit">82,90</i>o kit pela soma das peças
                  </span>
                  <span>
                    <i className="pr-pc pr-pc-vazio">R$ 0,00</i>falta o preço: não sai na cotação
                  </span>
                  <span>
                    <i className="pr-pc pr-pc-dabase">da base</i>espera o preço base
                  </span>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      )}

      {t && podeMexer ? (
        <AdicionarDoCatalogo
          aberto={adicionando && modo === 'lista'}
          ancora={botaoAdicionar}
          grupos={doCatalogo}
          naTabela={naTabela}
          aoFechar={() => setAdicionando(false)}
          aoPor={(entradas, base) => {
            mudar((x) => porNaTabela(x, entradas, base))
            setAdicionando(false)
            avisar(`${entradas.length} ${entradas.length === 1 ? 'peça entrou' : 'peças entraram'} na tabela. Falta salvar.`, 'ok')
          }}
        />
      ) : null}
      {mudandoFaixas && t ? (
        <MudarAsFaixas
          atuais={t.faixas}
          aoFechar={() => setMudandoFaixas(false)}
          aoAplicar={(f) => {
            mudar((x) => trocarFaixas(x, f))
            setMudandoFaixas(false)
          }}
        />
      ) : null}
      {podeMexer ? (
        <MenuDeContexto
          aberto={!!menuDe}
          ancora={ancoraDoMenu}
          aoFechar={() => setMenuDe('')}
          cabecalho={menuDaTabela?.nome ?? tabelas.find((x) => x.id + ':cab' === menuDe)?.nome}
          itens={(() => {
            const x = menuDaTabela ?? tabelas.find((y) => y.id + ':cab' === menuDe)
            return x ? acoesDe(x) : []
          })()}
        />
      ) : null}
      {excluindo ? (
        <Modal
          aberto
          fechaFora={false}
          aoFechar={() => setExcluindo(null)}
          titulo={'Excluir a ' + excluindo.nome + '?'}
          pe={
            <>
              <Botao tom="limpo" autoFocus onClick={() => setExcluindo(null)}>
                Cancelar
              </Botao>
              <Botao tom="perigo" onClick={() => void excluir(excluindo)}>
                <Trash size={17} />
                Excluir de vez
              </Botao>
            </>
          }
        >
          <p className="pr-nota">
            A tabela some e não volta. As cotações que já usaram ela continuam com o nome e os preços que têm. Se quiser só
            tirar da cotação e poder voltar depois, use Arquivar.
          </p>
        </Modal>
      ) : null}
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

/* A TABELA NOVA NÃO NASCE EM BRANCO (prancha 143): em vez da grade vazia,
   três jeitos de começar. */
function ComecoDaTabela({
  nome,
  podeMexer,
  outras,
  aoCatalogo,
  aoModoTabela,
  aoCopiar,
}: {
  nome: string
  podeMexer: boolean
  outras: TabelaDePreco[]
  aoCatalogo: () => void
  aoModoTabela: () => void
  aoCopiar: (origem: TabelaDePreco, pct: number) => void
}) {
  const [origem, setOrigem] = useState(outras.find((o) => o.padrao)?.id ?? outras[0]?.id ?? '')
  const [pct, setPct] = useState('0')
  if (!podeMexer) return <Vazio titulo="Nenhuma peça nesta tabela" texto="Quem é admin ou gerente põe as peças." />
  return (
    <div className="pr-comeco">
      <span className="pr-comeco-ic">
        <Package size={30} />
      </span>
      <h3>A {nome || 'tabela nova'} ainda não tem nenhuma peça</h3>
      <p className="pr-nota">
        A tabela guarda o preço de cada referência e kit da ficha técnica. Escolha como começar; dá para misturar os três depois.
      </p>
      <div className="pr-comeco-op">
        <div className="pr-op">
          <b>
            <List size={17} />
            Escolher no catálogo
          </b>
          <span>A lista agrupada da ficha técnica: marque um grupo inteiro ou peça por peça.</span>
          <Botao tom="contorno" tamanho="sm" onClick={aoCatalogo}>
            <Plus size={15} />
            Adicionar referência ou kit
          </Botao>
        </div>
        <div className="pr-op pr-op-forte">
          <b>
            <Table size={17} />
            Modo tabela
          </b>
          <span>O catálogo inteiro numa tabela, para marcar, pôr e preencher muitas de uma vez, ou colar da planilha.</span>
          <Botao tom="forte" tamanho="sm" onClick={aoModoTabela}>
            Abrir o modo tabela
          </Botao>
        </div>
        <div className="pr-op">
          <b>
            <Copy size={17} />
            Copiar de outra tabela
          </b>
          <span>As peças e os preços de outra tabela, com um ajuste em por cento (0 copia igual).</span>
          {outras.length ? (
            <div className="fileira miuda">
              <Seletor valor={origem} vazio="Escolher" opcoes={outras.map((o) => ({ valor: o.id, rotulo: o.nome }))} aoEscolher={setOrigem} />
              <Entrada className="pr-lote-pct" inputMode="decimal" aria-label="Ajuste em por cento" value={pct} onChange={(e) => setPct(e.target.value)} />
              <Botao
                tom="contorno"
                tamanho="sm"
                onClick={() => {
                  const o = outras.find((x) => x.id === origem)
                  const n = numeroDoTexto(pct) ?? 0
                  if (!o) return avisar('Escolha de qual tabela copiar', 'warn')
                  if (!Number.isFinite(n)) return avisar('O ajuste é um número em por cento', 'warn')
                  aoCopiar(o, n)
                }}
              >
                Copiar
              </Botao>
            </div>
          ) : (
            <span className="pr-nota">Ainda não há outra tabela com peças.</span>
          )}
        </div>
      </div>
    </div>
  )
}
