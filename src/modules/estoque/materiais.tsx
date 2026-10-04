import { useEffect, useMemo, useRef, useState } from 'react'
import {
  arvoreDeTecidos,
  chaveDoGrupo,
  gruposDeItens,
  gruposDoEstoque,
  paraComprarPorUrgencia,
  type Categoria,
  type GrupoDoEstoque,
  type Hierarquia,
  type Material,
  type Movimento,
  type PedidoNaSeparacao,
  type ReservaEmAberto,
} from '@dominio/estoque'
import type { Fornecedor } from '@dominio/fornecedor'
import { semAcento } from '@shared'
import type { Fornecimento, Guardado } from './apoio'
import { Arvore, chaveDoMaterial } from './arvore'
import { ParaComprar, ParaSeparacao, UltimosMovimentos } from './colunas'
import { PrateleiraDeTecidos } from './estante'
import { FichaDoMaterial, FichaDoTecido } from './ficha'
import './materiais.css'

/* ==========================================================================
   A aba Materiais: quatro colunas.

   (1) as três abas com a sanfona; (2) para separação; (3) para comprar;
   (4) últimos movimentos. As três da direita são baixas, e debaixo delas, na
   largura das três, fica a prateleira de tecidos. A primeira coluna desce ao
   lado, na altura das duas fileiras.

   Quando um tecido ou uma cor é escolhido, as três colunas e a prateleira dão
   lugar à ficha dele, e a árvore continua à esquerda.

   No celular os assuntos viram telas (os chips do topo escolhem), e a ficha
   toma a página.
   ========================================================================== */

/** a gaveta do material dentro da aba de aviamento ou de insumo */
function gavetaDoItem(m: Material): string {
  const chave = chaveDoGrupo(m)
  return 'i:' + (chave.startsWith('solto:') ? m.categoria + ':' : chave)
}

export type SecaoDosMateriais = 'materiais' | 'separacao' | 'comprar'

export function Materiais({
  materiais,
  filtrados,
  termo,
  hierarquia,
  movimentos,
  reservas,
  fornecimento,
  fila,
  guardado,
  podeEditar,
  podeSeparar,
  celular,
  secao,
  categoria,
  aoTrocarCategoria,
  escolhido,
  aoEscolher,
  aoMovimentar,
  aoNovo,
  aoEditar,
  aoMarcar,
  aoVerNoDeposito,
  aoVerFornecedor,
  aoVerMovimentos,
  aoVerComprar,
  aoSeparar,
}: {
  materiais: Material[]
  /** os que combinam com a busca */
  filtrados: Material[]
  /** o que está escrito na busca, já sem acento e sem espaço nas pontas */
  termo: string
  hierarquia: Hierarquia
  movimentos: Movimento[]
  reservas: ReservaEmAberto[]
  fornecimento: Fornecimento
  fila: PedidoNaSeparacao[]
  guardado: Guardado
  podeEditar: boolean
  podeSeparar: boolean
  celular: boolean
  secao: SecaoDosMateriais
  categoria: Categoria
  aoTrocarCategoria: (c: Categoria) => void
  /** a chave do tecido (tecido:<id>) ou do material (material:<id>); vazio é a visão geral */
  escolhido: string
  aoEscolher: (chave: string) => void
  aoMovimentar: (m: Material) => void
  aoNovo: (g: GrupoDoEstoque) => void
  aoEditar: (g: GrupoDoEstoque) => void
  aoMarcar: (m: Material, outroLugar: boolean) => void
  aoVerNoDeposito: (ids: string[], rotulo: string) => void
  aoVerFornecedor: (f: Fornecedor | null) => void
  aoVerMovimentos: (busca?: string) => void
  /** leva à lista inteira do que há para comprar; ausente onde ela não existe */
  aoVerComprar?: () => void
  aoSeparar: () => void
}) {
  const buscando = termo.length > 0

  /* A árvore inteira serve às fichas e ao que vem aberto; a filtrada, à
     sanfona. As duas trazem os tecidos do catálogo que ainda não têm estoque:
     todos na inteira, e na filtrada os que combinam com a busca (pelo nome do
     tecido, pelo código ou pelo nome do grupo). */
  const todosOsGrupos = useMemo(() => gruposDoEstoque(materiais), [materiais])
  const arvoreInteira = useMemo(
    () => arvoreDeTecidos(todosOsGrupos, hierarquia, () => true),
    [todosOsGrupos, hierarquia],
  )
  const gruposFiltrados = useMemo(() => gruposDoEstoque(filtrados), [filtrados])
  const arvore = useMemo(
    () =>
      arvoreDeTecidos(gruposFiltrados, hierarquia, (t, nomeDoGrupo) =>
        termo ? semAcento([t.nome, t.grupo, nomeDoGrupo].join(' ')).includes(termo) : true,
      ),
    [gruposFiltrados, hierarquia, termo],
  )
  /* a prateleira é o que HÁ: só os tecidos com cor no estoque, e só os grupos
     que têm algum */
  const naPrateleira = useMemo(
    () =>
      arvoreInteira
        .map(g => ({ ...g, tecidos: g.tecidos.filter(t => t.cores.length > 0) }))
        .filter(g => g.tecidos.length > 0),
    [arvoreInteira],
  )
  const itens = useMemo(
    () => (categoria === 'tecido' ? [] : gruposDeItens(gruposFiltrados, categoria)),
    [gruposFiltrados, categoria],
  )
  const contagem = useMemo(() => {
    const c: Record<Categoria, number> = { tecido: 0, aviamento: 0, insumo: 0 }
    for (const m of filtrados) c[m.categoria] += 1
    return c
  }, [filtrados])
  const comprar = useMemo(() => paraComprarPorUrgencia(materiais), [materiais])

  /* A BUSCA LEVA PARA A ABA ONDE ACHOU. Quem procura "linha" com a aba Tecido
     aberta não precisa descobrir sozinho que a resposta está em Aviamentos. */
  /* na aba Tecido também conta o tecido do catálogo achado pelo nome, que não
     é material e por isso não entra na contagem */
  const achouNaAba = (c: Categoria) => contagem[c] > 0 || (c === 'tecido' && arvore.length > 0)
  useEffect(() => {
    if (!buscando || achouNaAba(categoria)) return
    const outra = (['tecido', 'aviamento', 'insumo'] as Categoria[]).find(achouNaAba)
    if (outra) aoTrocarCategoria(outra)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, contagem, arvore.length])

  /* --- as gavetas -----------------------------------------------------------
     Sem busca, vale o que a pessoa abriu. Com busca, tudo o que sobrou vem
     aberto (é o que ela procurou), e vale o que ela fechou. */
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [fechadosNaBusca, setFechadosNaBusca] = useState<Set<string>>(new Set())
  useEffect(() => setFechadosNaBusca(new Set()), [termo])
  const abertosAVista = useMemo(() => {
    if (!buscando) return abertos
    const todas = new Set<string>()
    for (const g of arvore) {
      todas.add('g:' + g.cod)
      for (const t of g.tecidos) todas.add('t:' + t.chave)
    }
    for (const g of itens) todas.add('i:' + g.chave)
    for (const f of fechadosNaBusca) todas.delete(f)
    return todas
  }, [buscando, abertos, arvore, itens, fechadosNaBusca])
  function alternar(chave: string) {
    const troca = (antes: Set<string>) => {
      const novo = new Set(antes)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    }
    if (buscando) setFechadosNaBusca(troca)
    else setAbertos(troca)
  }

  /* a prateleira tem as próprias gavetas, pelo código do grupo */
  const [estante, setEstante] = useState<Set<string>>(new Set())

  /* NA PRIMEIRA VEZ, A PÁGINA ABRE ONDE HÁ O QUE COMPRAR: o grupo com mais
     cores abaixo do mínimo vem aberto na árvore, e os dois primeiros na
     prateleira. Depois disso quem manda é a pessoa. */
  const jaAbriu = useRef(false)
  useEffect(() => {
    if (jaAbriu.current || !arvoreInteira.length) return
    jaAbriu.current = true
    /* quem tem o que comprar primeiro; no empate, quem tem estoque antes do
       grupo que só veio do catálogo */
    const porUrgencia = [...arvoreInteira].sort(
      (a, b) => b.paraComprar - a.paraComprar || (b.cores ? 1 : 0) - (a.cores ? 1 : 0),
    )
    const comFalta = porUrgencia.filter(g => g.paraComprar > 0)
    const naEstante = (comFalta.length ? comFalta : porUrgencia).slice(0, 2).map(g => g.cod)
    setEstante(new Set(naEstante))
    setAbertos(antes => (antes.size ? antes : new Set(['g:' + porUrgencia[0].cod])))
  }, [arvoreInteira])

  /* --- o escolhido ----------------------------------------------------------- */
  const tecidoDe = (chave: string) => {
    for (const g of arvoreInteira) {
      const t = g.tecidos.find(x => x.chave === chave)
      if (t) return { grupo: g, tecido: t }
    }
    return null
  }
  const material = escolhido.startsWith('material:')
    ? (materiais.find(m => chaveDoMaterial(m.id) === escolhido) ?? null)
    : null
  const doMaterial =
    material && material.categoria === 'tecido' ? tecidoDe(chaveDoGrupo(material)) : null
  const doTecido = !material && escolhido ? tecidoDe(escolhido) : null

  /* QUEM É ESCOLHIDO APARECE NA ÁRVORE: a aba troca e as gavetas dele abrem.
     Vale para o clique na coluna "Para comprar" e na prateleira, que escolhem
     sem passar pela sanfona. */
  useEffect(() => {
    if (!escolhido) return
    const abrir: string[] = []
    if (material) {
      if (material.categoria !== categoria) aoTrocarCategoria(material.categoria)
      if (doMaterial) abrir.push('g:' + doMaterial.grupo.cod, 't:' + doMaterial.tecido.chave)
      else if (material.categoria !== 'tecido') abrir.push(gavetaDoItem(material))
    } else if (doTecido) {
      if (categoria !== 'tecido') aoTrocarCategoria('tecido')
      abrir.push('g:' + doTecido.grupo.cod, 't:' + doTecido.tecido.chave)
    }
    if (abrir.length) setAbertos(antes => new Set([...antes, ...abrir]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhido])

  const escolher = (chave: string) => aoEscolher(chave)
  /* na árvore, clicar de novo no escolhido solta */
  const escolherOuSoltar = (chave: string) => aoEscolher(chave === escolhido ? '' : chave)

  const ficha = material ? (
    <FichaDoMaterial
      key={material.id}
      m={material}
      tecido={doMaterial?.tecido ?? null}
      grupo={doMaterial?.grupo ?? null}
      movimentos={movimentos.filter(v => v.materialId === material.id)}
      reservas={reservas.filter(r => r.materialId === material.id)}
      fornecimento={fornecimento}
      guardado={guardado}
      podeEditar={podeEditar}
      noCelular={celular}
      aoEditar={() => {
        const g = todosOsGrupos.find(x => x.itens.some(i => i.id === material.id))
        if (g) aoEditar(g)
      }}
      aoMovimentar={aoMovimentar}
      aoFechar={() => aoEscolher('')}
      aoEscolher={escolher}
      aoMarcar={aoMarcar}
      aoVerNoDeposito={aoVerNoDeposito}
      aoVerFornecedor={aoVerFornecedor}
      aoVerMovimentos={() => aoVerMovimentos(material.nome)}
    />
  ) : doTecido ? (
    <FichaDoTecido
      key={doTecido.tecido.chave}
      tecido={doTecido.tecido}
      grupo={doTecido.grupo}
      movimentos={movimentos.filter(v => doTecido.tecido.cores.some(m => m.id === v.materialId))}
      reservas={reservas.filter(r => doTecido.tecido.cores.some(m => m.id === r.materialId))}
      fornecimento={fornecimento}
      guardado={guardado}
      podeEditar={podeEditar}
      noCelular={celular}
      aoEditar={() => aoEditar(doTecido.tecido.doEstoque)}
      aoMovimentar={aoMovimentar}
      aoFechar={() => aoEscolher('')}
      aoEscolher={escolher}
      aoNovaCor={() => aoNovo(doTecido.tecido.doEstoque)}
      aoVerNoDeposito={aoVerNoDeposito}
      aoVerFornecedor={aoVerFornecedor}
      aoVerMovimentos={() => aoVerMovimentos(doTecido.tecido.nome)}
    />
  ) : null

  const arvoreDaTela = (
    <Arvore
      categoria={categoria}
      aoTrocarCategoria={aoTrocarCategoria}
      contagem={contagem}
      tecidos={arvore}
      itens={itens}
      fornecimento={fornecimento}
      guardado={guardado}
      abertos={abertosAVista}
      aoAbrir={alternar}
      escolhido={escolhido}
      aoEscolher={escolherOuSoltar}
      buscando={buscando}
      podeEditar={podeEditar}
      aoNovaCor={t => aoNovo(t.doEstoque)}
    />
  )
  const separacao = (
    <ParaSeparacao
      fila={fila}
      materiais={materiais}
      guardado={guardado}
      podeSeparar={podeSeparar}
      inteira={celular}
      aoSeparar={aoSeparar}
      aoVerNoMapa={aoVerNoDeposito}
      aoVerMais={aoSeparar}
    />
  )
  const paraComprar = (
    <ParaComprar
      comprar={comprar}
      fornecimento={fornecimento}
      inteira={celular}
      aoEscolher={m => aoEscolher(chaveDoMaterial(m.id))}
      aoVerMais={celular ? undefined : aoVerComprar}
    />
  )
  const prateleira = (
    <PrateleiraDeTecidos
      grupos={naPrateleira}
      fornecimento={fornecimento}
      abertos={estante}
      aoAbrir={cod =>
        setEstante(antes => {
          const novo = new Set(antes)
          if (novo.has(cod)) novo.delete(cod)
          else novo.add(cod)
          return novo
        })
      }
      aoEscolher={escolher}
      celular={celular}
    />
  )

  /* --- o celular: uma tela por assunto ------------------------------------- */
  if (celular) {
    if (ficha) return <div className="em-palco">{ficha}</div>
    if (secao === 'separacao') return <div className="em-palco">{separacao}</div>
    if (secao === 'comprar') return <div className="em-palco">{paraComprar}</div>
    return (
      <div className="em-palco">
        <div className="pilha larga">
          {arvoreDaTela}
          {prateleira}
        </div>
      </div>
    )
  }

  return (
    <div className="em-palco">
      <div className={ficha ? 'em-quatro com-ficha' : 'em-quatro'}>
        {arvoreDaTela}
        {ficha ? (
          <div className="em-largo">{ficha}</div>
        ) : (
          <>
            {separacao}
            {paraComprar}
            <UltimosMovimentos
              movimentos={movimentos}
              materiais={materiais}
              aoVerMais={() => aoVerMovimentos()}
            />
            {prateleira}
          </>
        )}
      </div>
    </div>
  )
}
