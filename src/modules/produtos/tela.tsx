import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Botao, Busca, Chip, Esqueleto, Modal, Pagina, Segmentado, Vazio } from '@ds'
import { usarConsulta } from '@shared'
import { pode, useSessao } from '@dominio/sessao'
import {
  carregarMateriaisDeAviamento,
  carregarReferencia,
  carregarReferencias,
  carregarTecidosDeConta,
  casaComABusca,
  oQueFalta,
  type GrupoDeReferencia,
  type MaterialDoEstoque,
  type ReferenciaNaFicha,
  type TecidoDeConta,
} from '@dominio/produto'
import { plural } from './apoio'
import { Arvore, type Lista } from './arvore'
import { NovaReferencia } from './nova'
import { FichaDaReferencia } from './referencia'
import './produtos.css'

/* ==========================================================================
   Fichas técnicas (Materiais, Fichas técnicas).

   A referência é a peça que a fábrica faz, com código e nome. Ela já existia
   no cadastro (Configurações, Banco de dados). Esta página guarda o que
   faltava saber de cada uma: o molde, os detalhes de costura, a tabela de
   medidas, o tecido que ela gasta em cada tamanho e os aviamentos.

   A PÁGINA É IRMÃ DO ESTOQUE, e tem o mesmo desenho: a barra com as abas e a
   busca, a árvore em sanfona na primeira coluna e, escolhida uma peça, a
   ficha dela do lado direito. O estoque diz quanto tem; a ficha técnica diz
   de que a peça é feita.

   ESTE É O PRIMEIRO PASSO: as referências. Os kits, o molde em tela cheia com
   as medidas, a folha impressa, o Movimento, o Depósito de peças prontas e as
   Estatísticas chegam nos próximos, e até lá cada um diz isso na própria aba,
   em vez de fingir que existe.

   O GRUPO DOS KITS FICA FORA DA LISTA DE REFERÊNCIAS. Kit é um conjunto de
   peças, e não uma peça: ele não tem molde nem tabela de medidas próprios.
   ========================================================================== */

type Aba = 'fichas' | 'movimento' | 'deposito' | 'estatisticas'

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'fichas', rotulo: 'Referências e kits' },
  { valor: 'movimento', rotulo: 'Movimento' },
  { valor: 'deposito', rotulo: 'Depósito' },
  { valor: 'estatisticas', rotulo: 'Estatísticas' },
]

const AINDA_NAO: Record<Exclude<Aba, 'fichas'>, { titulo: string; texto: string }> = {
  movimento: {
    titulo: 'O Movimento ainda não chegou',
    texto:
      'Aqui vão aparecer as peças feitas, orçamento por orçamento: o que saiu da produção, em que grade e com qual técnica.',
  },
  deposito: {
    titulo: 'O Depósito de peças prontas ainda não chegou',
    texto:
      'Aqui vai ficar a peça pronta guardada: a pronta entrega, a sobra de pedido e o mostruário, por tamanho e com o lugar de cada lote.',
  },
  estatisticas: {
    titulo: 'As Estatísticas ainda não chegaram',
    texto:
      'Aqui vão aparecer as referências e os kits que mais vendem, os tamanhos que mais saem e a venda mês a mês.',
  },
}

const GRUPO_DOS_KITS = 'KIT'

export function TelaProdutos() {
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const podeEditar = !!pessoa && pode(pessoa, 'produtos', 'editar')
  /* criar e excluir referência é mexer no cadastro do Banco de dados, e lá só
     administrador e gerente mexem (a regra é do banco, migração 008) */
  const chefia = !!pessoa && (pessoa.papel === 'admin' || pessoa.papel === 'gerente')
  const podeCriar = podeEditar && chefia
  const podeExcluir = chefia && !!pessoa && pode(pessoa, 'produtos', 'deletar')

  const [grupos, setGrupos] = useState<GrupoDeReferencia[]>([])
  const [referencias, setReferencias] = useState<ReferenciaNaFicha[]>([])
  const [tecidos, setTecidos] = useState<TecidoDeConta[]>([])
  const [doEstoque, setDoEstoque] = useState<MaterialDoEstoque[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [endereco, setEndereco] = useSearchParams()
  const [aba, setAba] = useState<Aba>('fichas')
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState<Lista>('referencias')
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  /* o id da referência aberta do lado direito */
  const [escolhida, setEscolhida] = useState('')
  const [editando, setEditando] = useState(false)
  const [sujo, setSujo] = useState(false)
  /* o que a pessoa pediu para fazer com o editor aberto e mudança sem salvar */
  const [saida, setSaida] = useState<(() => void) | null>(null)
  const [nova, setNova] = useState<{ de?: ReferenciaNaFicha } | null>(null)

  const celular = usarConsulta('(max-width: 767px)')

  const ler = useCallback(async () => {
    const tudo = await carregarReferencias()
    setGrupos(tudo.grupos)
    setReferencias(tudo.referencias)
    setErro('')
    return tudo.referencias
  }, [])

  /* O tecido de conta e a lista de aviamentos são apoio: sem eles a ficha
     continua de pé, só sem o metro, o grama e a escolha do Estoque. */
  const lerApoio = useCallback(async () => {
    const [ts, ms] = await Promise.all([
      carregarTecidosDeConta().catch(() => [] as TecidoDeConta[]),
      carregarMateriaisDeAviamento().catch(() => [] as MaterialDoEstoque[]),
    ])
    setTecidos(ts)
    setDoEstoque(ms)
  }, [])

  const recarregar = useCallback(async () => {
    setCarregando(true)
    try {
      await ler()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler as fichas técnicas.')
    } finally {
      setCarregando(false)
    }
  }, [ler])

  useEffect(() => {
    let vivo = true
    void lerApoio()
    ler()
      .then(lidas => {
        if (!vivo) return
        /* a página abre já na peça quando alguém chega com ela no endereço */
        const pedida = endereco.get('ref')
        const r = pedida ? lidas.find(x => x.cod === pedida || x.id === pedida) : undefined
        if (r) {
          setEscolhida(r.id)
          setAbertos(new Set([r.grupo ?? '']))
        }
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler as fichas técnicas.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
    /* o endereço só é lido na chegada: depois é a página que escreve nele */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ler, lerApoio])

  const dePeca = useMemo(() => referencias.filter(r => r.grupo !== GRUPO_DOS_KITS), [referencias])
  const gruposDePeca = useMemo(() => grupos.filter(g => g.cod !== GRUPO_DOS_KITS), [grupos])
  const termo = busca.trim()
  const filtradas = useMemo(
    () => (termo ? dePeca.filter(r => casaComABusca(r, termo)) : dePeca),
    [dePeca, termo],
  )
  const aberta = useMemo(() => dePeca.find(r => r.id === escolhida) ?? null, [dePeca, escolhida])
  const grupoDaAberta = aberta ? (grupos.find(g => g.cod === aberta.grupo) ?? null) : null
  const completas = useMemo(() => dePeca.filter(r => !oQueFalta(r).length).length, [dePeca])

  /* a peça escolhida sumiu da lista (foi excluída, ou outra pessoa arquivou) */
  useEffect(() => {
    if (escolhida && !carregando && !aberta) setEscolhida('')
  }, [escolhida, carregando, aberta])

  /* --- sair do editor sem perder o que foi digitado ---------------------------- */
  function seDerParaSair(depois: () => void) {
    if (editando && sujo) setSaida(() => depois)
    else depois()
  }

  function escolher(id: string) {
    if (id === escolhida && !editando) return
    seDerParaSair(() => {
      setEditando(false)
      setEscolhida(id)
      const r = referencias.find(x => x.id === id)
      setEndereco(r ? { ref: r.cod || r.id } : {}, { replace: true })
    })
  }

  function trocarAba(a: Aba) {
    if (a === aba) return
    seDerParaSair(() => {
      setEditando(false)
      setAba(a)
    })
  }

  function abrirGrupo(cod: string) {
    setAbertos(atual => {
      const outro = new Set(atual)
      if (outro.has(cod)) outro.delete(cod)
      else outro.add(cod)
      return outro
    })
  }

  const relerAAberta = useCallback(async () => {
    if (!escolhida) return
    const linha = await carregarReferencia(escolhida)
    if (linha) setReferencias(atual => atual.map(r => (r.id === linha.id ? linha : r)))
  }, [escolhida])

  const sub = carregando
    ? 'Lendo as referências'
    : erro
      ? undefined
      : `${plural(dePeca.length, 'referência', 'referências')} · ${completas} com a ficha completa`

  const naFicha = aba === 'fichas' && !!aberta
  const semDados = (
    <section className="cartao pd-quadro">
      <div className="pd-espera">
        <Esqueleto altura={18} />
        <Esqueleto altura={18} />
        <Esqueleto altura={18} />
        <Esqueleto altura={18} />
        <Esqueleto altura={18} />
        <Esqueleto altura={18} />
      </div>
    </section>
  )

  return (
    <Pagina
      acima="Materiais"
      titulo="Fichas técnicas"
      sub={sub}
      acoes={
        podeCriar && !celular ? (
          <Botao tom="primario" onClick={() => seDerParaSair(() => setNova({}))}>
            Nova referência
          </Botao>
        ) : undefined
      }
    >
      {podeCriar && celular && !naFicha ? (
        <div className="pd-acoes">
          <Botao tom="primario" className="pd-cresce" onClick={() => setNova({})}>
            Nova referência
          </Botao>
        </div>
      ) : null}

      <div className="pd-barra-caixa">
        <div className="pd-barra" data-barra="">
          {celular ? (
            <div className="pd-secoes" role="tablist" aria-label="Assuntos das fichas técnicas">
              {ABAS.map(a => (
                <Chip
                  key={a.valor}
                  role="tab"
                  aria-selected={aba === a.valor}
                  ligado={aba === a.valor}
                  onClick={() => trocarAba(a.valor)}
                >
                  {a.rotulo}
                </Chip>
              ))}
            </div>
          ) : (
            <Segmentado className="pd-seg pd-abas-da-pagina" valor={aba} aoMudar={trocarAba} opcoes={ABAS} />
          )}
          {aba === 'fichas' ? (
            <Busca
              className="pd-busca"
              value={busca}
              onChange={e => {
                const texto = e.currentTarget.value
                /* no celular a ficha toma a tela: quem busca quer ver a lista */
                if (celular && escolhida && !editando) escolher('')
                setBusca(texto)
              }}
              placeholder="Buscar referência ou código"
              aria-label="Buscar"
            />
          ) : null}
        </div>
      </div>

      {aba !== 'fichas' ? (
        <section className="cartao pd-quadro" data-ainda-nao={aba}>
          <Vazio titulo={AINDA_NAO[aba].titulo} texto={AINDA_NAO[aba].texto} />
        </section>
      ) : erro ? (
        <section className="cartao pd-quadro">
          <Vazio
            titulo="Não consegui ler as fichas técnicas"
            texto={erro}
            acao={<Botao onClick={() => void recarregar()}>Tentar de novo</Botao>}
          />
        </section>
      ) : carregando ? (
        semDados
      ) : (
        <div className="pd-palco">
          <div className={aberta ? 'pd-quatro com-ficha' : 'pd-quatro'}>
            {celular && aberta ? null : (
              <Arvore
                grupos={gruposDePeca}
                referencias={filtradas}
                haReferencias={dePeca.length > 0}
                termo={termo}
                lista={lista}
                aoTrocarLista={setLista}
                abertos={abertos}
                aoAbrir={abrirGrupo}
                escolhida={escolhida}
                aoEscolher={escolher}
              />
            )}
            {aberta ? (
              <div className="pd-largo">
                <FichaDaReferencia
                  r={aberta}
                  grupo={grupoDaAberta}
                  todas={dePeca}
                  tecidos={tecidos}
                  doEstoque={doEstoque}
                  celular={celular}
                  podeEditar={podeEditar}
                  podeCriar={podeCriar}
                  podeExcluir={podeExcluir}
                  editando={editando}
                  aoEditar={() => setEditando(true)}
                  aoCancelarEdicao={() => seDerParaSair(() => setEditando(false))}
                  aoSalvouEdicao={() => {
                    setSujo(false)
                    setEditando(false)
                  }}
                  aoSujar={setSujo}
                  aoMudou={relerAAberta}
                  aoExcluiu={async () => {
                    setEditando(false)
                    setEscolhida('')
                    setEndereco({}, { replace: true })
                    await ler()
                  }}
                  aoDuplicar={() => setNova({ de: aberta })}
                  aoFechar={() => escolher('')}
                />
              </div>
            ) : celular ? null : (
              <section className="cartao pd-largo pd-quadro" data-nada-escolhido="">
                <Vazio
                  titulo="Escolha uma referência"
                  texto="Abra um grupo na lista e toque na peça. A ficha dela aparece aqui: o molde, os detalhes de costura, a tabela de medidas, o tecido por tamanho e os aviamentos."
                />
              </section>
            )}
          </div>
        </div>
      )}

      <NovaReferencia
        aberta={nova}
        grupos={grupos}
        referencias={referencias}
        aoFechar={() => setNova(null)}
        aoCriou={async id => {
          setNova(null)
          const lidas = await ler()
          const r = lidas.find(x => x.id === id)
          setBusca('')
          setLista('referencias')
          setEscolhida(id)
          if (r) {
            setAbertos(atual => new Set([...atual, r.grupo ?? '']))
            setEndereco({ ref: r.cod || r.id }, { replace: true })
          }
          /* a peça nova abre já no editor: ela nasceu para ser preenchida */
          setEditando(true)
        }}
      />

      <Modal
        aberto={!!saida}
        aoFechar={() => setSaida(null)}
        titulo="Sair sem salvar?"
        pe={
          <>
            <Botao onClick={() => setSaida(null)}>Continuar editando</Botao>
            <Botao
              tom="perigo"
              onClick={() => {
                const depois = saida
                setSaida(null)
                setSujo(false)
                depois?.()
              }}
            >
              Descartar as mudanças
            </Botao>
          </>
        }
      >
        <p className="pd-nota">
          A ficha tem mudança que ainda não foi salva. Se sair agora, o que foi digitado se perde.
        </p>
      </Modal>
    </Pagina>
  )
}
