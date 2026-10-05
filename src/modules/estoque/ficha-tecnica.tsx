import { useEffect, useMemo, useRef, useState } from 'react'
import { PencilSimple, Plus, Trash, X } from '@phosphor-icons/react'
import { Aviso, Botao, Campo, Entrada, Marcacao, Modal, Seletor, avisar } from '@ds'
import {
  composicaoPorExtenso,
  definirCadastro,
  minimoRecomendado,
  nomeInteiro,
  nomeNoGrupo,
  quantoNaUnidade,
  rendimento,
  type Fibra,
  type Material,
  type MudancaDoCadastro,
  type UsoDoMaterial,
} from '@dominio/estoque'
import {
  CUIDADOS,
  FIBRAS,
  GRUPOS_DE_CUIDADO,
  NOME_DO_GRUPO_DE_CUIDADO,
  SimboloDeCuidado,
  alternarCuidado,
  cuidadosEmOrdem,
} from '@dominio/estoque/cuidados'
import { NovoFornecedorAoLado } from '@dominio/fornecedor/ao-lado'
import { EscolherFornecedor } from '@dominio/fornecedor/escolher'
import { criarFornecedor } from '@dominio/fornecedor'
import { lerNumero } from '@dominio/ferramentas'
import { idsDosFornecedores, plural, type Fornecimento } from './apoio'
import { Bola } from './vao'
import './ficha-tecnica.css'

/* ==========================================================================
   A ficha técnica da cor.

   Composição, gramatura, largura, rendimento, detalhes e os símbolos de
   cuidado. O Henrique pediu em 05/10/2026 e disse de quem ela é: "a ficha
   técnica daquele tecido com aquela cor, entenda que isso é individual". A
   mesma malha, em duas cores, pode vir de dois fornecedores, com gramatura e
   cuidado diferentes. Por isso ela mora no material (048), e não no catálogo.

   DUAS PEÇAS:
     o CARTÃO, que mostra a ficha na ficha da cor;
     o EDITOR, que é o que o botão Editar abre. É a tela do wireframe (prancha
     51): o fornecedor, o mínimo e a ficha de um lado, os símbolos do outro.

   O EDITOR SERVE A UMA COR E A VÁRIAS. Com uma, tudo vem preenchido. Com
   várias (o Editar do tecido, e o lote da tabela), cada campo vem com o valor
   que todas têm em comum, ou vazio quando elas diferem; e SÓ O QUE A PESSOA
   MEXER É GRAVADO. O que ela não tocar fica como está em cada cor.

   O FORNECEDOR QUE NÃO EXISTE NASCE ALI: "Novo fornecedor" troca a coluna dos
   símbolos pela do cadastro dele, e volta com ele escolhido.
   ========================================================================== */

/** Os números da ficha, do jeito que se escreve: "190 g/m²", "1,20 m". */
function gramaturaEmTexto(g: number): string {
  return g > 0 ? g.toLocaleString('pt-BR') + ' g/m²' : ''
}
function larguraEmTexto(l: number): string {
  return l > 0
    ? l.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'
    : ''
}
function rendimentoEmTexto(gramatura: number, largura: number): string {
  const r = rendimento(gramatura, largura)
  return r > 0
    ? r.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
        ' m por kg'
    : ''
}

/** a ficha tem alguma coisa escrita */
export function temFicha(m: Material): boolean {
  return (
    m.composicao.length > 0 ||
    m.gramatura > 0 ||
    m.largura > 0 ||
    m.detalhes.length > 0 ||
    m.cuidados.length > 0
  )
}

/* --- o que a etiqueta diz: os símbolos e a frase de cada um ------------------ */
export function EtiquetaDeCuidados({ cuidados }: { cuidados: string[] }) {
  const lista = cuidadosEmOrdem(cuidados)
  if (!lista.length) return null
  return (
    <div className="ft-etiqueta" data-etiqueta="">
      <div className="ft-etiqueta-simbolos">
        {lista.map(c => (
          <span key={c.cod} className="ft-simbolo" title={c.frase}>
            <SimboloDeCuidado cod={c.cod} />
          </span>
        ))}
      </div>
      <ul className="ft-etiqueta-frases">
        {lista.map(c => (
          <li key={c.cod}>{c.frase}</li>
        ))}
      </ul>
    </div>
  )
}

/* --- o cartão da ficha da cor --------------------------------------------- */
export function CartaoDaFichaTecnica({
  m,
  doCatalogo,
  podeEditar,
  aoEditar,
}: {
  m: Material
  /** a gramatura e a largura do tecido no catálogo, para quando a cor não tem a sua */
  doCatalogo: { gramatura: number; largura: number }
  podeEditar: boolean
  aoEditar: () => void
}) {
  const gramatura = m.gramatura || doCatalogo.gramatura
  const largura = m.largura || doCatalogo.largura
  const vazia = !temFicha(m)
  return (
    <section className="cartao em-col" data-ficha-tecnica="">
      <div className="em-topo">
        <h3 className="cartao-titulo">
          <span className="marca" />
          Ficha técnica
        </h3>
        {podeEditar ? (
          <Botao tamanho="sm" onClick={aoEditar}>
            <PencilSimple size={15} aria-hidden="true" />
            Editar a ficha
          </Botao>
        ) : null}
      </div>
      <div className="em-corpo">
        {vazia ? (
          <p className="em-nota">
            Esta cor ainda não tem ficha técnica.
            {podeEditar
              ? ' Em "Editar a ficha" entram a composição, a gramatura, a largura e os cuidados dela.'
              : ''}
          </p>
        ) : null}
        <dl className="ft-linhas">
          {m.composicao.length ? (
            <div>
              <dt>Composição</dt>
              <dd>
                <b>{composicaoPorExtenso(m.composicao)}</b>
              </dd>
            </div>
          ) : null}
          {gramatura > 0 ? (
            <div>
              <dt>Gramatura</dt>
              <dd>
                <b>{gramaturaEmTexto(gramatura)}</b>
                {m.gramatura > 0 ? null : <small>do catálogo de tecidos</small>}
              </dd>
            </div>
          ) : null}
          {largura > 0 ? (
            <div>
              <dt>Largura</dt>
              <dd>
                <b>{larguraEmTexto(largura)}</b>
                {m.largura > 0 ? null : <small>do catálogo de tecidos</small>}
              </dd>
            </div>
          ) : null}
          {rendimento(gramatura, largura) > 0 ? (
            <div>
              <dt>Rendimento</dt>
              <dd>
                <b>{rendimentoEmTexto(gramatura, largura)}</b>
                <small>calculado</small>
              </dd>
            </div>
          ) : null}
          {m.detalhes.length ? (
            <div>
              <dt>Detalhes</dt>
              <dd className="ft-tags">
                {m.detalhes.map(d => (
                  <span key={d} className="ft-tag">
                    {d}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {m.cuidados.length ? (
            <div>
              <dt>Cuidados</dt>
              <dd>
                <EtiquetaDeCuidados cuidados={m.cuidados} />
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  )
}

/* ==========================================================================
   O EDITOR
   ========================================================================== */

type LinhaDeFibra = { fibra: string; pct: string }

/** o valor que todos têm, ou `undefined` quando diferem */
function emComum<T>(lista: Material[], de: (m: Material) => T): T | undefined {
  if (!lista.length) return undefined
  const primeiro = JSON.stringify(de(lista[0]))
  return lista.every(m => JSON.stringify(de(m)) === primeiro) ? de(lista[0]) : undefined
}

const emTexto = (n: number) => (n > 0 ? String(n).replace('.', ',') : '')

export function EditarFicha({
  materiais,
  titulo: tituloDoLote,
  fornecimento,
  doCatalogo,
  irmas,
  so,
  usos,
  aoFechar,
  aoSalvar,
  aoCriarFornecedor,
}: {
  /** os materiais que a ficha vai mudar; nulo fecha */
  materiais: Material[] | null
  /** o título quando são vários: "Ficha das 6 cores de PIQUET COM ELASTANO" */
  titulo?: string
  fornecimento: Fornecimento
  /** a gramatura e a largura do catálogo, para dizer de onde vem a que aparece apagada */
  doCatalogo?: { gramatura: number; largura: number }
  /** as outras cores do mesmo tecido que já têm ficha, para copiar de uma delas */
  irmas?: Material[]
  /** o lote da tabela que só quer uma coisa: mostra esse campo e mais nada */
  so?: 'fornecedor' | 'minimo'
  /** o que saiu de cada material, para o mínimo recomendado; nulo enquanto não leu */
  usos?: UsoDoMaterial[] | null
  aoFechar: () => void
  aoSalvar: (quantos: number) => Promise<void>
  aoCriarFornecedor: () => Promise<void>
}) {
  const lista = useMemo(() => materiais ?? [], [materiais])
  const varios = lista.length > 1
  const um = lista.length === 1 ? lista[0] : null
  /* a ficha inteira (composição, gramatura, cuidados) só existe no tecido, e
     não quando a tabela pediu só o fornecedor ou só o mínimo */
  const soTecido = !so && lista.length > 0 && lista.every(m => m.categoria === 'tecido')
  const unidade = emComum(lista, m => m.unidade) ?? ''
  const chave = lista.map(m => m.id).join(',')

  const [fornecedorId, setFornecedorId] = useState('')
  const [trocarOsQueTem, setTrocarOsQueTem] = useState(true)
  const [minimo, setMinimo] = useState('')
  const [fibras, setFibras] = useState<LinhaDeFibra[]>([])
  const [gramatura, setGramatura] = useState('')
  const [largura, setLargura] = useState('')
  const [detalhes, setDetalhes] = useState<string[]>([])
  const [detalheNovo, setDetalheNovo] = useState('')
  const [cuidados, setCuidados] = useState<string[]>([])
  /* o que a pessoa mexeu: só isto é gravado */
  const [mexeu, setMexeu] = useState<Set<string>>(new Set())
  const [aoLado, setAoLado] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')
  const tocar = (campo: string) => setMexeu(a => (a.has(campo) ? a : new Set([...a, campo])))

  /* o fornecedor de cada material é o primeiro que está ligado a ele */
  const fornecedorDe = (m: Material) => idsDosFornecedores(fornecimento.ligacoes, m.id)[0] ?? ''
  const comFornecedor = lista.filter(m => fornecedorDe(m)).length
  /* o que elas têm de diferente, para dizer ao lado de cada campo */
  const varia = useMemo(
    () => ({
      fornecedor: emComum(lista, fornecedorDe) === undefined,
      minimo: emComum(lista, m => m.minimo) === undefined,
      composicao: emComum(lista, m => m.composicao) === undefined,
      gramatura: emComum(lista, m => m.gramatura) === undefined,
      largura: emComum(lista, m => m.largura) === undefined,
      detalhes: emComum(lista, m => m.detalhes) === undefined,
      cuidados: emComum(lista, m => m.cuidados) === undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chave, fornecimento.ligacoes],
  )

  /* abre com o que elas têm em comum; onde diferem, o campo vem vazio */
  const aberta = useRef('')
  useEffect(() => {
    if (!lista.length || aberta.current === chave) return
    aberta.current = chave
    setFornecedorId(emComum(lista, fornecedorDe) ?? '')
    setTrocarOsQueTem(true)
    setMinimo(emTexto(emComum(lista, m => m.minimo) ?? 0) || (varios ? '' : '0'))
    setFibras(
      (emComum(lista, m => m.composicao) ?? []).map(f => ({ fibra: f.fibra, pct: emTexto(f.pct) })),
    )
    setGramatura(emTexto(emComum(lista, m => m.gramatura) ?? 0))
    setLargura(emTexto(emComum(lista, m => m.largura) ?? 0))
    setDetalhes(emComum(lista, m => m.detalhes) ?? [])
    setDetalheNovo('')
    setCuidados(emComum(lista, m => m.cuidados) ?? [])
    setMexeu(new Set())
    setAoLado(false)
    setFalha('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  useEffect(() => {
    if (!materiais) aberta.current = ''
  }, [materiais])

  /* --- o mínimo recomendado pela saída ---
     Um por material. Com vários, a faixa de menor a maior; o botão de usar só
     existe quando o número é um só, porque o lote grava o mesmo valor em todos. */
  const recomendados = useMemo(() => {
    if (!usos) return null
    const doMaterial = new Map(usos.map(u => [u.materialId, u]))
    return lista.map(m => ({
      uso: doMaterial.get(m.id),
      valor: minimoRecomendado(doMaterial.get(m.id), m.unidade),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usos, chave])
  const comRecomendado = (recomendados ?? []).filter(r => r.valor > 0)
  const menorRecomendado = Math.min(...comRecomendado.map(r => r.valor))
  const maiorRecomendado = Math.max(...comRecomendado.map(r => r.valor))
  const recomendadoUnico = comRecomendado.length > 0 && menorRecomendado === maiorRecomendado
  const usoDoUnico = um ? recomendados?.[0]?.uso : undefined

  /* --- as contas --- */
  const min = lerNumero(minimo)
  const minimoRuim = mexeu.has('minimo') && (min === null || Number.isNaN(min) || min < 0)
  const linhasCheias = fibras.filter(f => f.fibra || f.pct.trim())
  const soma = linhasCheias.reduce((s, f) => s + (lerNumero(f.pct) || 0), 0)
  const fibraRuim = linhasCheias.some(f => {
    const p = lerNumero(f.pct)
    return !f.fibra || p === null || Number.isNaN(p) || p <= 0 || p > 100
  })
  const fibraRepetida =
    new Set(linhasCheias.map(f => f.fibra.toLowerCase())).size !== linhasCheias.length
  const composicaoRuim =
    mexeu.has('composicao') &&
    linhasCheias.length > 0 &&
    (fibraRuim || fibraRepetida || Math.abs(soma - 100) > 0.01)
  const g = lerNumero(gramatura)
  const gramaturaRuim =
    mexeu.has('gramatura') && g !== null && (Number.isNaN(g) || g < 20 || g > 1500)
  const l = lerNumero(largura)
  const larguraRuim = mexeu.has('largura') && l !== null && (Number.isNaN(l) || l < 0.2 || l > 5)
  const valido = !minimoRuim && !composicaoRuim && !gramaturaRuim && !larguraRuim
  const gramaturaDaConta = (g && !Number.isNaN(g) ? g : 0) || doCatalogo?.gramatura || 0
  const larguraDaConta = (l && !Number.isNaN(l) ? l : 0) || doCatalogo?.largura || 0

  function juntarDetalhe() {
    const d = detalheNovo.trim()
    if (!d) return
    if (!detalhes.some(x => x.toLowerCase() === d.toLowerCase())) {
      setDetalhes(a => [...a, d])
      tocar('detalhes')
    }
    setDetalheNovo('')
  }

  function copiarDe(id: string) {
    const outra = (irmas ?? []).find(x => x.id === id)
    if (!outra) return
    setFibras(outra.composicao.map(f => ({ fibra: f.fibra, pct: emTexto(f.pct) })))
    setGramatura(emTexto(outra.gramatura))
    setLargura(emTexto(outra.largura))
    setDetalhes(outra.detalhes)
    setCuidados(outra.cuidados)
    setMexeu(a => new Set([...a, 'composicao', 'gramatura', 'largura', 'detalhes', 'cuidados']))
  }

  async function salvar() {
    if (!lista.length || !valido || gravando || mexeu.size === 0) return
    const m: MudancaDoCadastro = {}
    if (mexeu.has('minimo')) m.minimo = min ?? 0
    if (mexeu.has('composicao')) {
      m.composicao = linhasCheias.map<Fibra>(f => ({
        fibra: f.fibra.trim(),
        pct: lerNumero(f.pct) ?? 0,
      }))
    }
    if (mexeu.has('gramatura')) m.gramatura = g === null || Number.isNaN(g) ? null : g
    if (mexeu.has('largura')) m.largura = l === null || Number.isNaN(l) ? null : l
    if (mexeu.has('detalhes')) m.detalhes = detalhes
    if (mexeu.has('cuidados')) m.cuidados = cuidados
    if (mexeu.has('fornecedor')) {
      m.fornecedor = fornecedorId || null
      if (varios && fornecedorId && !trocarOsQueTem) m.soSemFornecedor = true
    }
    setGravando(true)
    setFalha('')
    try {
      const n = await definirCadastro(
        lista.map(x => x.id),
        m,
      )
      avisar(
        n === 1 ? 'Ficha salva.' : `Ficha salva em ${plural(n, 'material', 'materiais')}.`,
        'ok',
      )
      await aoSalvar(n)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui salvar a ficha.')
    } finally {
      setGravando(false)
    }
  }

  const deQuem = um ? nomeInteiro(um) : plural(lista.length, 'material', 'materiais')
  const titulo = !lista.length
    ? ''
    : so === 'fornecedor'
      ? 'Fornecedor de ' + deQuem
      : so === 'minimo'
        ? 'Mínimo de ' + deQuem
        : um
          ? 'Ficha de ' + deQuem
          : (tituloDoLote ?? 'Ficha de ' + deQuem)
  const sub = um
    ? um.categoria === 'tecido'
      ? 'Vale só para esta cor. Cada cor do tecido tem a sua ficha e o seu fornecedor.'
      : 'O cadastro deste material: de quem vem e quanto tem de ficar no estoque.'
    : 'Só o que você mexer aqui muda. O que você não tocar fica como está em cada um.'
  const dica = (campo: keyof typeof varia) =>
    varios && varia[campo] && !mexeu.has(campo) ? <small>varia</small> : null
  const jaFornecem = [...new Set(lista.map(fornecedorDe).filter(Boolean))]
  const categoria = lista[0]?.categoria ?? 'tecido'
  const nomeDaCategoria =
    categoria === 'tecido' ? 'Tecido' : categoria === 'aviamento' ? 'Aviamento' : 'Insumo'
  const comFicha = (irmas ?? []).filter(x => !lista.some(y => y.id === x.id))

  return (
    <Modal
      aberto={!!materiais}
      aoFechar={aoFechar}
      largo={soTecido || aoLado}
      titulo={titulo}
      pe={
        <>
          <span className="ft-pe-nota">
            {mexeu.size === 0
              ? 'Nada mudou ainda.'
              : varios
                ? `Vai mudar ${[...mexeu].map(c => NOME_DO_CAMPO[c] ?? c).join(', ')} em ${plural(lista.length, 'material', 'materiais')}.`
                : ''}
          </span>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            tom="primario"
            onClick={salvar}
            disabled={!valido || gravando || mexeu.size === 0}
            carregando={gravando}
          >
            {gravando ? 'Salvando' : varios ? `Aplicar em ${lista.length}` : 'Salvar a ficha'}
          </Botao>
        </>
      }
    >
      {lista.length ? (
        <div className={soTecido || aoLado ? 'ft-editor dois' : 'ft-editor'} data-editar-ficha="">
          <div className="ft-coluna">
            <p className="es-ajuda">{sub}</p>

            {varios ? (
              <div className="ft-lote" data-lote="">
                {lista.slice(0, 14).map(m => (
                  <span key={m.id} className="ft-lote-item" title={nomeInteiro(m)}>
                    <Bola cor={m.corHex} pequena />
                    {nomeNoGrupo(m)}
                  </span>
                ))}
                {lista.length > 14 ? (
                  <span className="ft-lote-item">e mais {lista.length - 14}</span>
                ) : null}
              </div>
            ) : null}

            {fornecimento.disponivel && so !== 'minimo' ? (
              <div className="campo">
                <span className="es-campo-topo">
                  {um && um.categoria === 'tecido' ? 'Fornecedor desta cor' : 'Fornecedor'}
                  {dica('fornecedor')}
                </span>
                <div className="es-fornecedor-e-novo">
                  <EscolherFornecedor
                    valor={fornecedorId}
                    aoEscolher={id => {
                      setFornecedorId(id)
                      tocar('fornecedor')
                    }}
                    fornecedores={fornecimento.fornecedores}
                    jaFornecem={jaFornecem}
                    tipo={categoria}
                    nomeDoTipo={nomeDaCategoria}
                    oQue={varios ? 'estes materiais' : 'este material'}
                    aoCriar={async n => {
                      const id = await criarFornecedor({
                        nome: n,
                        entrouPor: 'estoque',
                        tipos: [categoria],
                      })
                      await aoCriarFornecedor()
                      return id
                    }}
                  />
                  <Botao
                    className="es-novo-fornecedor"
                    aria-expanded={aoLado}
                    disabled={aoLado}
                    onClick={() => setAoLado(true)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Novo fornecedor
                  </Botao>
                </div>
                {varios && mexeu.has('fornecedor') && fornecedorId && comFornecedor > 0 ? (
                  <Marcacao
                    checked={trocarOsQueTem}
                    onChange={e => setTrocarOsQueTem(e.currentTarget.checked)}
                  >
                    Trocar também{' '}
                    {comFornecedor === 1 ? 'no que já tem' : `nos ${comFornecedor} que já têm`}{' '}
                    fornecedor
                  </Marcacao>
                ) : null}
              </div>
            ) : null}

            {so === 'fornecedor' ? null : (
              <Campo
                rotulo={
                  <span className="es-campo-topo">
                    {'Mínimo no estoque' + (unidade ? ', em ' + unidade : '')}
                    {dica('minimo')}
                  </span>
                }
                erro={minimoRuim}
                dica="Quando o livre cai abaixo dele, o material entra em Para comprar e no trilho."
              >
                <Entrada
                  inputMode="decimal"
                  value={minimo}
                  onChange={e => {
                    setMinimo(e.currentTarget.value)
                    tocar('minimo')
                  }}
                  placeholder={varios && varia.minimo ? 'cada um com o seu' : '0'}
                  aria-label="Mínimo no estoque"
                />
              </Campo>
            )}
            {so === 'fornecedor' || !recomendados ? null : comRecomendado.length ? (
              <div className="es-recomendado" data-recomendado="">
                <span>
                  Recomendado:{' '}
                  <b>
                    {recomendadoUnico
                      ? quantoNaUnidade(menorRecomendado, unidade)
                      : `de ${emTexto(menorRecomendado)} a ${quantoNaUnidade(maiorRecomendado, unidade)}`}
                  </b>
                </span>
                {recomendadoUnico && emTexto(menorRecomendado) !== minimo.trim() ? (
                  <Botao
                    tamanho="sm"
                    onClick={() => {
                      setMinimo(emTexto(menorRecomendado))
                      tocar('minimo')
                    }}
                  >
                    Usar
                  </Botao>
                ) : null}
                <small>
                  {um && usoDoUnico
                    ? `É a média entre o que saiu no último mês (${quantoNaUnidade(usoDoUnico.d30, unidade)}) e o mês médio dos últimos três (${quantoNaUnidade(usoDoUnico.d90 / 3, unidade)}).`
                    : `Cada um tem o seu, pela média do último mês e dos últimos três. ${comRecomendado.length} de ${lista.length} tiveram saída. O lote grava o mesmo mínimo em todos: para usar o de cada um, abra a ficha de cada um.`}
                </small>
              </div>
            ) : (
              <p className="es-recomendado" data-recomendado="">
                <small>
                  Ainda sem mínimo recomendado:{' '}
                  {um ? 'este material não teve saída' : 'nenhum deles teve saída'} nos últimos 3
                  meses. A recomendação aparece quando a Separação começar a baixar.
                </small>
              </p>
            )}

            {soTecido ? (
              <>
                <div className="campo" data-composicao="">
                  <span className="es-campo-topo">
                    Composição
                    {dica('composicao') ??
                      (linhasCheias.length ? (
                        <small className={composicaoRuim ? 'ft-ruim' : ''}>
                          soma {String(Math.round(soma * 100) / 100).replace('.', ',')}%
                        </small>
                      ) : null)}
                  </span>
                  {fibras.map((f, i) => (
                    <div key={i} className="ft-fibra">
                      <Seletor
                        campo
                        bloco
                        comBusca
                        valor={f.fibra}
                        opcoes={[...new Set([...FIBRAS, ...(f.fibra ? [f.fibra] : [])])].map(x => ({
                          valor: x,
                          rotulo: x,
                        }))}
                        aoEscolher={v => {
                          setFibras(a => a.map((x, k) => (k === i ? { ...x, fibra: v } : x)))
                          tocar('composicao')
                        }}
                        vazio="Fibra"
                      />
                      <Entrada
                        inputMode="decimal"
                        value={f.pct}
                        onChange={e => {
                          const v = e.currentTarget.value
                          setFibras(a => a.map((x, k) => (k === i ? { ...x, pct: v } : x)))
                          tocar('composicao')
                        }}
                        placeholder="%"
                        aria-label={'Porcentagem de ' + (f.fibra || 'fibra')}
                      />
                      <Botao
                        tom="limpo"
                        icone
                        aria-label={'Tirar ' + (f.fibra || 'a fibra')}
                        onClick={() => {
                          setFibras(a => a.filter((_, k) => k !== i))
                          tocar('composicao')
                        }}
                      >
                        <Trash size={16} aria-hidden="true" />
                      </Botao>
                    </div>
                  ))}
                  <div className="fileira">
                    <Botao
                      tamanho="sm"
                      disabled={fibras.length >= 8}
                      onClick={() => {
                        const falta = Math.max(0, Math.round((100 - soma) * 100) / 100)
                        setFibras(a => [
                          ...a,
                          { fibra: '', pct: a.length && falta ? emTexto(falta) : '' },
                        ])
                        tocar('composicao')
                      }}
                    >
                      <Plus size={14} weight="bold" aria-hidden="true" />
                      {fibras.length ? 'Outra fibra' : 'Pôr a composição'}
                    </Botao>
                  </div>
                  {composicaoRuim ? (
                    <span className="dica ft-ruim">
                      {fibraRepetida
                        ? 'A mesma fibra aparece duas vezes.'
                        : fibraRuim
                          ? 'Toda linha precisa da fibra e de uma porcentagem entre 0 e 100.'
                          : 'A composição tem de somar 100%.'}
                    </span>
                  ) : null}
                </div>

                <div className="ft-dois">
                  <Campo
                    rotulo={
                      <span className="es-campo-topo">Gramatura (g/m²){dica('gramatura')}</span>
                    }
                    erro={gramaturaRuim}
                  >
                    <Entrada
                      inputMode="decimal"
                      value={gramatura}
                      onChange={e => {
                        setGramatura(e.currentTarget.value)
                        tocar('gramatura')
                      }}
                      placeholder={
                        doCatalogo?.gramatura
                          ? emTexto(doCatalogo.gramatura) + ' no catálogo'
                          : '190'
                      }
                      aria-label="Gramatura"
                    />
                  </Campo>
                  <Campo
                    rotulo={<span className="es-campo-topo">Largura (m){dica('largura')}</span>}
                    erro={larguraRuim}
                  >
                    <Entrada
                      inputMode="decimal"
                      value={largura}
                      onChange={e => {
                        setLargura(e.currentTarget.value)
                        tocar('largura')
                      }}
                      placeholder={
                        doCatalogo?.largura ? emTexto(doCatalogo.largura) + ' no catálogo' : '1,20'
                      }
                      aria-label="Largura"
                    />
                  </Campo>
                </div>
                {gramaturaRuim || larguraRuim ? (
                  <span className="dica ft-ruim">
                    {gramaturaRuim
                      ? 'A gramatura fica entre 20 e 1.500 g/m².'
                      : 'A largura fica entre 0,20 e 5 metros.'}
                  </span>
                ) : null}
                <div className="ft-rendimento" data-rendimento="">
                  <span>Rendimento</span>
                  <b>
                    {rendimentoEmTexto(gramaturaDaConta, larguraDaConta) ||
                      'falta a gramatura ou a largura'}
                  </b>
                  <small>calculado</small>
                </div>
              </>
            ) : null}

            {so ? null : (
              <div className="campo" data-detalhes="">
                <span className="es-campo-topo">
                  Detalhes técnicos
                  {dica('detalhes')}
                </span>
                {detalhes.length ? (
                  <div className="ft-tags">
                    {detalhes.map(d => (
                      <span key={d} className="ft-tag">
                        {d}
                        <button
                          type="button"
                          aria-label={'Tirar ' + d}
                          onClick={() => {
                            setDetalhes(a => a.filter(x => x !== d))
                            tocar('detalhes')
                          }}
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <Entrada
                  value={detalheNovo}
                  maxLength={60}
                  disabled={detalhes.length >= 12}
                  onChange={e => setDetalheNovo(e.currentTarget.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      juntarDetalhe()
                    }
                  }}
                  onBlur={juntarDetalhe}
                  placeholder="Escrever um detalhe e apertar Enter"
                  aria-label="Detalhe técnico novo"
                />
              </div>
            )}

            {um && soTecido && comFicha.length ? (
              <div className="campo" data-copiar="">
                <span className="es-campo-topo">
                  Copiar a ficha de outra cor <small>depois dá para ajustar</small>
                </span>
                <Seletor
                  campo
                  bloco
                  comBusca
                  valor=""
                  opcoes={comFicha.map(x => ({ valor: x.id, rotulo: nomeNoGrupo(x) }))}
                  aoEscolher={copiarDe}
                  vazio="Escolha a cor"
                />
              </div>
            ) : null}

            {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
          </div>

          {aoLado ? (
            <NovoFornecedorAoLado
              tipo={categoria}
              nomeDoTipo={nomeDaCategoria}
              aoFechar={() => setAoLado(false)}
              aoCriar={async (id, nomeDele) => {
                await aoCriarFornecedor()
                setFornecedorId(id)
                tocar('fornecedor')
                setAoLado(false)
                avisar(`${nomeDele} entrou em Fornecedores e já está escolhido aqui.`, 'ok')
              }}
            />
          ) : soTecido ? (
            <div className="ft-coluna" data-cuidados="">
              <span className="es-campo-topo ft-titulo-da-coluna">
                Cuidados com o tecido
                {dica('cuidados') ?? <small>{CUIDADOS.length} símbolos, um por grupo</small>}
              </span>
              {GRUPOS_DE_CUIDADO.map(grupo => (
                <div
                  key={grupo}
                  className="ft-grupo"
                  role="group"
                  aria-label={NOME_DO_GRUPO_DE_CUIDADO[grupo]}
                >
                  <span className="ft-grupo-nome">{NOME_DO_GRUPO_DE_CUIDADO[grupo]}</span>
                  <div className="ft-simbolos">
                    {CUIDADOS.filter(c => c.grupo === grupo).map(c => {
                      const ligado = cuidados.includes(c.cod)
                      return (
                        <button
                          type="button"
                          key={c.cod}
                          className={ligado ? 'ft-botao ligado' : 'ft-botao'}
                          aria-pressed={ligado}
                          aria-label={c.frase}
                          title={c.frase}
                          data-cod={c.cod}
                          onClick={() => {
                            setCuidados(a => alternarCuidado(a, c.cod))
                            tocar('cuidados')
                          }}
                        >
                          <SimboloDeCuidado cod={c.cod} mudo />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="campo">
                <span className="es-campo-topo">Como fica na etiqueta</span>
                <div className="ft-previa">
                  {cuidados.length ? (
                    <EtiquetaDeCuidados cuidados={cuidados} />
                  ) : (
                    <p className="em-nota">
                      Nenhum símbolo marcado. Clicar de novo num símbolo marcado tira ele.
                    </p>
                  )}
                </div>
              </div>
              <p className="es-ajuda">
                Os símbolos são os da norma de etiqueta têxtil (ABNT NBR NM ISO 3758).
                {um
                  ? ' O quanto tem no estoque não muda aqui: hoje são ' +
                    quantoNaUnidade(um.saldo, um.unidade) +
                    ' na prateleira.'
                  : ''}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}

const NOME_DO_CAMPO: Record<string, string> = {
  fornecedor: 'o fornecedor',
  minimo: 'o mínimo',
  composicao: 'a composição',
  gramatura: 'a gramatura',
  largura: 'a largura',
  detalhes: 'os detalhes',
  cuidados: 'os cuidados',
}
