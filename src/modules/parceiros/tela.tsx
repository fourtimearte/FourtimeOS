import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CaretLeft, Plus } from '@phosphor-icons/react'
import { Botao, Esqueleto, Pagina, Segmentado, Seletor, Vazio } from '@ds'
import { mesesAte, quandoFoi, usarConsulta } from '@shared'
import {
  carregarParceiros,
  carregarVendas,
  colecoesDaLoja,
  diaDaLoja,
  fraseCompletaDoAcordo,
  fraseDoAcordo,
  mesDaLoja,
  situacaoDaPagina,
  somar,
  somarPorParceiro,
  SOMA_VAZIA,
  ultimoAvisoDaLoja,
  type AvisoDaLoja,
  type Colecao,
  type Parceiro,
  type SomaDoParceiro,
  type VendaDoParceiro,
} from '@dominio/parceiro'
import { pode, useSessao } from '@dominio/sessao'
import { intervaloDosMeses, mesSozinho, parteNaTela, plural, sanfonaDeChegada } from './apoio'
import { FichaDoParceiro } from './ficha'
import { VisaoGeral } from './geral'
import { VendasDoParceiro } from './vendas'
import './parceiros.css'

/* ==========================================================================
   Parceiros.

   Quem vende peças na loja, quanto vendeu e quanto recebe. A lista de um lado,
   com "Todos os parceiros" no topo, e do outro a visão geral ou o parceiro
   escolhido, com duas abas: Vendas, que são os mesmos números da página dele
   na loja, e Acordo e página, onde mora o acordo, o link e a senha.

   AS VENDAS CHEGAM SOZINHAS. A loja avisa cada pedido ao Supabase, e esta
   página só lê. A frase "último aviso da loja", no subtítulo, é o termômetro
   disso: se ela parar no tempo, a loja parou de avisar.

   DUAS FILEIRAS DE CONTROLE, E SÓ. Em cima, o período e "Novo parceiro". No
   cabeçalho do parceiro, as abas. Pedido do Henrique de 04/10/2026, na versão
   2 do wireframe: eram quatro fileiras e ele quis uma ou duas.

   UMA LEITURA SÓ. A página lê as vendas de todos os parceiros de uma vez,
   desde a primeira, e tudo o que aparece é conta em cima disso: trocar o
   período, o parceiro ou a aba, e voltar aos meses antigos, não vai ao banco.
   A coluna da lista é sempre o mês em andamento.

   NA TELA QUE NÃO CABE AS DUAS COLUNAS a visão geral é a página, com a lista
   de parceiros dentro dela, e tocar num parceiro troca a página pela dele, com
   a volta em cima. É o desenho do celular do wireframe.
   ========================================================================== */

const NOVO = 'novo'
type Aba = 'vendas' | 'acordo'

export function TelaParceiros() {
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const podeEditar = !!pessoa && pode(pessoa, 'parceiros', 'editar')

  const [hoje] = useState(() => new Date())
  const mesAtual = useMemo(() => mesDaLoja(hoje), [hoje])
  const dia = useMemo(() => diaDaLoja(hoje), [hoje])
  const [periodo, setPeriodo] = useState(6)
  const meses = useMemo(() => mesesAte(mesAtual, periodo), [mesAtual, periodo])

  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [vendas, setVendas] = useState<VendaDoParceiro[]>([])
  const [aviso, setAviso] = useState<AvisoDaLoja | null>(null)
  const [colecoes, setColecoes] = useState<Colecao[]>([])
  const [semColecoes, setSemColecoes] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  /* o que está aberto: vazio para a visão geral, NOVO para o cadastro novo, ou
     o id de um parceiro */
  const [aberto, setAberto] = useState('')
  const [aba, setAba] = useState<Aba>('vendas')
  /* o que está aberto na sanfona dos meses do parceiro escolhido */
  const [sanfona, setSanfona] = useState(() => sanfonaDeChegada(mesAtual))

  /* as duas colunas só cabem na tela larga; o celular troca tabela por lista */
  const larga = usarConsulta('(min-width: 1366px)')
  const estreita = usarConsulta('(max-width: 767px)')

  const ler = useCallback(async () => {
    const [ps, vs, av] = await Promise.all([
      carregarParceiros(),
      carregarVendas(),
      ultimoAvisoDaLoja(),
    ])
    setParceiros(ps)
    setVendas(vs)
    setAviso(av)
    setErro('')
  }, [])

  const recarregar = useCallback(async () => {
    try {
      await ler()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler os parceiros.')
    }
  }, [ler])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    ler()
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler os parceiros.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [ler])

  /* As coleções vêm da loja, pelo porteiro, e só quem edita precisa delas. É
     apoio: se não vierem, a ficha diz por quê e continua de pé. */
  useEffect(() => {
    if (!podeEditar) return
    let vivo = true
    colecoesDaLoja()
      .then(cs => {
        if (!vivo) return
        setColecoes(cs)
        setSemColecoes('')
      })
      .catch((e: unknown) => {
        if (vivo) setSemColecoes(e instanceof Error ? e.message : 'a loja não respondeu')
      })
    return () => {
      vivo = false
    }
  }, [podeEditar])

  /* na tela estreita, trocar de página (da geral para um parceiro, e de volta)
     começa do topo: sem isto a pessoa cai no meio da página nova */
  const jaAbriu = useRef(false)
  useEffect(() => {
    /* a primeira passada é a chegada na página, e não uma troca */
    if (!jaAbriu.current) {
      jaAbriu.current = true
      return
    }
    if (!larga) window.scrollTo(0, 0)
  }, [aberto, larga])

  const doPeriodo = useMemo(() => vendas.filter(v => v.mes >= meses[0]), [vendas, meses])
  /* a coluna da lista: o mês em andamento, qualquer que seja o período */
  const doMes = useMemo(() => vendas.filter(v => v.mes === mesAtual), [vendas, mesAtual])
  const somasDoMes = useMemo(() => somarPorParceiro(doMes), [doMes])
  const somaDoMes = useMemo(() => somar(doMes), [doMes])

  /* quem mais vendeu no mês vem primeiro; no empate, a ordem do nome */
  const ordenados = useMemo(
    () =>
      [...parceiros].sort(
        (a, b) =>
          (somasDoMes.get(b.id)?.valor ?? 0) - (somasDoMes.get(a.id)?.valor ?? 0) ||
          a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    [parceiros, somasDoMes],
  )

  const novo = aberto === NOVO
  const escolhido = novo ? null : (parceiros.find(p => p.id === aberto) ?? null)
  /* todas as vendas dele, e não só as do período: a aba Vendas deixa voltar
     aos meses antigos */
  const dele = useMemo(
    () => (escolhido ? vendas.filter(v => v.parceiroId === escolhido.id) : []),
    [vendas, escolhido],
  )

  const escolher = (id: string) => {
    setAberto(id)
    setAba('vendas')
    setSanfona(sanfonaDeChegada(mesAtual))
  }

  /* ---------- a fileira de cima: o período e o parceiro novo ---------------- */
  const seletorDoPeriodo = (
    <Seletor
      campo
      valor={periodo === 6 ? '' : String(periodo)}
      opcoes={[
        { valor: '3', rotulo: 'Últimos 3 meses' },
        { valor: '12', rotulo: 'Últimos 12 meses' },
      ]}
      aoEscolher={v => setPeriodo(Number(v) || 6)}
      vazio="Últimos 6 meses"
    />
  )
  const botaoNovo = podeEditar ? (
    <Botao tom="primario" onClick={() => setAberto(NOVO)}>
      <Plus size={16} weight="bold" />
      Novo parceiro
    </Botao>
  ) : null

  /* ---------- a lista de parceiros ------------------------------------------- */
  const item = (
    chave: string,
    nome: string,
    linha2: string,
    s: SomaDoParceiro,
    marcado: boolean,
  ) => (
    <button
      key={chave}
      type="button"
      className={marcado ? 'pa-item ligado' : 'pa-item'}
      aria-pressed={larga ? marcado : undefined}
      onClick={() => escolher(chave)}
    >
      <span className="pa-nome">
        <b>{nome}</b>
        <small>{linha2}</small>
      </span>
      <span className="pa-item-fim">
        <b>{parteNaTela(s)}</b>
        <small>{plural(s.pecas, 'peça', 'peças')}</small>
      </span>
    </button>
  )
  const itens = ordenados.map(p =>
    item(
      p.id,
      p.nome,
      `${fraseDoAcordo(p.acordo)} · ${situacaoDaPagina(p, hoje)}`,
      somasDoMes.get(p.id) ?? SOMA_VAZIA,
      larga && p.id === aberto,
    ),
  )

  /* ---------- o cabeçalho do que está aberto --------------------------------- */
  const cabeca = (titulo: string, sub: string, fim?: ReactNode) => (
    <div className="pa-cabeca">
      <div className="pa-cabeca-texto">
        {larga ? <h2>{titulo}</h2> : <h1>{titulo}</h1>}
        <p>{sub}</p>
      </div>
      {fim}
    </div>
  )
  const abas = (
    <Segmentado
      className="pa-abas"
      valor={aba}
      aoMudar={setAba}
      opcoes={[
        { valor: 'vendas', rotulo: 'Vendas' },
        { valor: 'acordo', rotulo: 'Acordo e página' },
      ]}
    />
  )

  const ficha = (
    <FichaDoParceiro
      key={novo ? NOVO : (escolhido?.id ?? 'nenhum')}
      parceiro={escolhido}
      novo={novo}
      podeEditar={podeEditar}
      colecoes={colecoes}
      semColecoes={semColecoes}
      hoje={hoje}
      aoDesistir={() => setAberto('')}
      aoSalvo={async id => {
        await recarregar()
        setAberto(id)
        setAba('acordo')
      }}
      aoMudar={recarregar}
    />
  )

  const visaoGeral = (meio?: ReactNode) => (
    <VisaoGeral
      parceiros={ordenados}
      vendas={doPeriodo}
      meses={meses}
      mesAtual={mesAtual}
      larga={larga}
      estreita={estreita}
      hoje={hoje}
      meio={meio}
    />
  )

  /* o parceiro aberto, ou o cadastro novo: o cabeçalho, as abas e a aba */
  const doParceiro = novo ? (
    <>
      {cabeca('Novo parceiro', 'O link e a senha da página nascem quando você salvar.')}
      <div className="pa-acordo">{ficha}</div>
    </>
  ) : escolhido ? (
    <>
      {cabeca(
        escolhido.nome,
        `${fraseCompletaDoAcordo(escolhido.acordo)} · ${situacaoDaPagina(escolhido, hoje)}${
          escolhido.ativo && escolhido.abertaEm
            ? `, aberta ${quandoFoi(escolhido.abertaEm, hoje)}`
            : ''
        }`,
        abas,
      )}
      {aba === 'vendas' ? (
        <VendasDoParceiro
          key={escolhido.id}
          vendas={dele}
          meses={meses}
          mesAtual={mesAtual}
          dia={dia}
          estreita={estreita}
          sanfona={sanfona}
          aoMudar={setSanfona}
        />
      ) : null}
      {/* a ficha fica montada com a aba Vendas à mostra: o que foi digitado e
          ainda não foi salvo não se perde ao olhar as vendas e voltar */}
      <div className="pa-acordo" hidden={aba !== 'acordo'}>
        {ficha}
      </div>
    </>
  ) : null

  /* ---------- a tela estreita com um parceiro aberto: a página é a dele ------ */
  if (!larga && doParceiro && !carregando && !erro) {
    return (
      <div className="pagina">
        <div className="pa-volta-fileira">
          <button type="button" className="pa-volta" onClick={() => setAberto('')}>
            <CaretLeft size={16} weight="bold" />
            Parceiros
          </button>
          {novo ? null : seletorDoPeriodo}
        </div>
        <div className="pa-miolo">{doParceiro}</div>
      </div>
    )
  }

  const andamento = `${intervaloDosMeses(meses)}. ${mesSozinho(mesAtual)[0].toUpperCase()}${mesSozinho(mesAtual).slice(1)} em andamento, até o dia ${dia}.`

  return (
    <Pagina
      acima="Gestão"
      titulo="Parceiros"
      sub={
        <>
          Quem vende peças na loja, quanto vendeu e quanto recebe.{' '}
          {aviso ? (
            <span className="pa-aviso">
              Último aviso da loja: <b>{quandoFoi(aviso.quando, hoje)}</b>
            </span>
          ) : (
            <span className="pa-aviso">A loja ainda não mandou nenhum aviso de venda.</span>
          )}
        </>
      }
      acoes={
        <>
          {seletorDoPeriodo}
          {botaoNovo}
        </>
      }
    >
      {erro ? (
        <section className="cartao pa-quadro">
          <Vazio titulo="Não consegui ler os parceiros" texto={erro} />
        </section>
      ) : carregando ? (
        <section className="cartao pa-quadro">
          <div className="pa-espera">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        </section>
      ) : parceiros.length === 0 && !novo ? (
        <section className="cartao pa-quadro">
          <Vazio
            titulo="Nenhum parceiro ainda"
            texto="Parceiro é quem vende peças na loja e recebe parte de cada venda. Cada um tem a sua coleção, o seu acordo e a sua página."
            acao={
              podeEditar ? <Botao onClick={() => setAberto(NOVO)}>Novo parceiro</Botao> : undefined
            }
          />
        </section>
      ) : larga ? (
        <div className="pa-duas">
          <section className="cartao pa-quadro pa-lado">
            <div className="pa-lado-topo">
              <span>Parceiro</span>
              <span>Parte em {mesSozinho(mesAtual)}</span>
            </div>
            {item('', 'Todos os parceiros', 'Visão geral da loja', somaDoMes, !novo && !escolhido)}
            {itens}
          </section>
          <div className="pa-miolo">
            {doParceiro ?? (
              <>
                {cabeca('Todos os parceiros', andamento)}
                {visaoGeral()}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="pa-miolo">
          {visaoGeral(
            <section className="pa-bloco">
              <h2 className="pa-bloco-titulo">Parceiros</h2>
              <div className="cartao pa-quadro pa-lista">{itens}</div>
              <p className="pa-ajuda">Toque num parceiro para ver as vendas e o acordo dele.</p>
            </section>,
          )}
        </div>
      )}
    </Pagina>
  )
}
