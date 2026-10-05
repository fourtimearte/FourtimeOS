import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarBlank, ListBullets, Plus, Stack, Table } from '@phosphor-icons/react'
import { Botao, BotaoComMenu, Busca, Chip, Esqueleto, Pagina, Segmentado, Vazio, avisar } from '@ds'
import { semAcento, usarConsulta } from '@shared'
import {
  CATEGORIAS,
  NOME_DA_CATEGORIA,
  NOME_DO_MOTIVO,
  SEM_HIERARQUIA,
  abaixoDoMinimo,
  carregarFilaDaSeparacao,
  carregarHierarquiaDeTecido,
  carregarMateriais,
  carregarMovimentos,
  carregarReservasEmAberto,
  chaveDoTecido,
  conferirORazao,
  grupoSemEstoque,
  gruposDoEstoque,
  nomeNoGrupo,
  refazerAsReservasAbertas,
  type Categoria,
  type GrupoDoEstoque,
  type Hierarquia,
  type Material,
  type Motivo,
  type Movimento,
  type PedidoNaSeparacao,
  type ReservaEmAberto,
} from '@dominio/estoque'
import {
  carregarDeposito,
  carregarLugares,
  type LugarDoMaterial,
  type Planta,
} from '@dominio/deposito'
import { fornecedoresParaOEstoque } from '@dominio/fornecedor'
import { pode, useSessao } from '@dominio/sessao'
import { materialDoMovimento, plural, type Fornecimento } from './apoio'
import { chaveDoMaterial } from './arvore'
import { BotaoEditarODeposito, Deposito } from './deposito'
import { EditarGrupo } from './editar-grupo'
import { EditorDoDeposito } from './editor-do-deposito'
import { FolhaDeMovimento } from './folha-de-movimento'
import { MarcarLugar } from './marcar-lugar'
import { Materiais } from './materiais'
import { Movimentacoes, type Agrupar } from './movimentacoes'
import { NovoMaterial, type InicioDoNovo } from './novo-material'
import { TabelaDeMateriais } from './tabela'
import './estoque.css'

/* ==========================================================================
   Estoque.

   A PÁGINA TEM TRÊS ABAS: Materiais, Movimentações e Depósito. Materiais é a
   da frente, em quatro colunas (materiais.tsx): a árvore do catálogo, o que
   espera separação, o que falta comprar e o que andou, com a prateleira de
   tecidos embaixo. Escolhido um tecido ou uma cor, o lado direito vira a
   ficha dele.

   NO CELULAR OS ASSUNTOS VIRAM CHIPS: Materiais, Separação, Comprar,
   Movimentos e Depósito, uma tela para cada.

   O QUE ESTA TELA MOSTRA É O RAZÃO, E NÃO UM SALDO DIGITÁVEL. Não existe
   campo para corrigir o quanto tem. Quem erra a contagem lança um ajuste, e o
   ajuste fica no histórico com nome e hora.

   O FORNECEDOR ESTÁ SEMPRE À VISTA. Ele vem da página de Fornecedores; quando
   a lista de lá não responde, a tela se cala sobre fornecedor e continua
   respondendo o que é dela, que é tem ou não tem.

   O DEPÓSITO, A HIERARQUIA DO CATÁLOGO E A FILA DA SEPARAÇÃO SÃO APOIO. Cada
   um tem a sua leitura: se uma falhar, a lista de materiais continua de pé.
   ========================================================================== */

/* separacao e comprar só existem no celular: no computador são colunas da aba Materiais */
type Aba = 'materiais' | 'separacao' | 'comprar' | 'razao' | 'deposito'
type Vista = 'lista' | 'tabela'
type Filtro = '' | Categoria | 'comprar'

const SEM_FORNECIMENTO: Fornecimento = { fornecedores: [], ligacoes: [], disponivel: false }
const MOTIVOS: Motivo[] = ['entrada', 'saida', 'ajuste', 'separacao', 'devolucao']

function abaDoEndereco(valor: string | null): Aba {
  return valor === 'razao' ? 'razao' : valor === 'deposito' ? 'deposito' : 'materiais'
}

export function TelaEstoque() {
  const navegar = useNavigate()
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const podeEditar = !!pessoa && pode(pessoa, 'estoque', 'editar')
  const podeSeparar = !!pessoa && pode(pessoa, 'separacao', 'ver')

  const [materiais, setMateriais] = useState<Material[]>([])
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [reservas, setReservas] = useState<ReservaEmAberto[]>([])
  const [fornecimento, setFornecimento] = useState<Fornecimento>(SEM_FORNECIMENTO)
  const [hierarquia, setHierarquia] = useState<Hierarquia>(SEM_HIERARQUIA)
  const [fila, setFila] = useState<PedidoNaSeparacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  /* A PÁGINA ABRE JÁ FILTRADA quando alguém chega de outra: a ficha do
     fornecedor manda para cá com o nome dele na busca, e para as
     movimentações dele com a aba junto. */
  const [endereco] = useSearchParams()
  const [aba, setAba] = useState<Aba>(abaDoEndereco(endereco.get('aba')))
  const [vista, setVista] = useState<Vista>('lista')
  const [busca, setBusca] = useState(endereco.get('busca') ?? '')
  const [filtro, setFiltro] = useState<Filtro>('')
  const [motivo, setMotivo] = useState<'' | Motivo>('')
  const [agrupar, setAgrupar] = useState<Agrupar>('dia')
  const [categoria, setCategoria] = useState<Categoria>('tecido')
  /* a chave do tecido (tecido:<id>) ou do material (material:<id>) */
  const [escolhido, setEscolhido] = useState('')

  const [noMovimento, setNoMovimento] = useState<Material | null>(null)
  const [novo, setNovo] = useState<InicioDoNovo | null>(null)
  const [editando, setEditando] = useState<GrupoDoEstoque | null>(null)
  const [refazendo, setRefazendo] = useState(false)

  /* o depósito: o desenho, o lugar de cada material, e o que está aberto por cima */
  const [deposito, setDeposito] = useState<Planta | null>(null)
  const [lugares, setLugares] = useState<LugarDoMaterial[]>([])
  const [lendoDeposito, setLendoDeposito] = useState(true)
  const [erroDoDeposito, setErroDoDeposito] = useState('')
  const [editandoDeposito, setEditandoDeposito] = useState(false)
  const [marcando, setMarcando] = useState<{ m: Material; outro: boolean } | null>(null)
  /* o que outra parte da página pediu para ver no mapa */
  const [marcados, setMarcados] = useState<{ ids: string[]; rotulo: string } | null>(null)

  /* abaixo disto a tabela some e as movimentações viram lista de duas linhas */
  const estreita = usarConsulta('(max-width: 1099px)')
  const celular = usarConsulta('(max-width: 767px)')

  const ler = useCallback(async () => {
    const [ms, vs, rs, fs] = await Promise.all([
      carregarMateriais(),
      carregarMovimentos(),
      carregarReservasEmAberto(),
      fornecedoresParaOEstoque(),
    ])
    setMateriais(ms)
    setMovimentos(vs)
    setReservas(rs)
    setFornecimento(fs)
    setErro('')
  }, [])

  /* A fila da separação e a hierarquia do catálogo são apoio: uma falha vira
     lista vazia, e nunca derruba a página. */
  const lerApoio = useCallback(async () => {
    const [h, f] = await Promise.all([
      carregarHierarquiaDeTecido(),
      carregarFilaDaSeparacao().catch(() => [] as PedidoNaSeparacao[]),
    ])
    setHierarquia(h)
    setFila(f)
  }, [])

  const recarregar = useCallback(async () => {
    try {
      await Promise.all([ler(), lerApoio()])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler o estoque.')
    }
  }, [ler, lerApoio])

  useEffect(() => {
    let vivo = true
    /* a página só aparece com a hierarquia lida: sem ela a árvore nasceria
       inteira no "Sem tipo" e se rearrumaria um instante depois */
    Promise.all([ler(), lerApoio()])
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler o estoque.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [ler, lerApoio])

  const lerDeposito = useCallback(async () => {
    try {
      const [d, ls] = await Promise.all([carregarDeposito(), carregarLugares()])
      setDeposito(d)
      setLugares(ls)
      setErroDoDeposito('')
    } catch (e) {
      setErroDoDeposito(e instanceof Error ? e.message : 'Não consegui ler o depósito.')
    } finally {
      setLendoDeposito(false)
    }
  }, [])
  useEffect(() => {
    void lerDeposito()
  }, [lerDeposito])

  const recarregarFornecedores = useCallback(async () => {
    setFornecimento(await fornecedoresParaOEstoque())
  }, [])

  const baixo = useMemo(() => abaixoDoMinimo(materiais), [materiais])
  const todosOsGrupos = useMemo(() => gruposDoEstoque(materiais), [materiais])
  const guardado = useMemo(() => ({ planta: deposito, lugares }), [deposito, lugares])

  /* no computador não existem as telas de Separação e de Comprar: são colunas */
  const abaAVista: Aba = !celular && (aba === 'separacao' || aba === 'comprar') ? 'materiais' : aba

  /* A BUSCA ACHA PELO QUE A PESSOA LEMBRA: o nome do material, a malha, a
     cor, o grupo ou o fornecedor. */
  const termo = semAcento(busca.trim())
  /* o grupo de tecido do catálogo também acha: "dry fit" tem de trazer o
     Dryfit Poliéster, que não tem o espaço no nome */
  const grupoDoTecido = useMemo(() => {
    const nome = new Map(hierarquia.grupos.map(g => [g.cod, g.nome]))
    return new Map(
      hierarquia.tecidos.map(t => [t.id, t.grupo ? t.grupo + ' ' + (nome.get(t.grupo) ?? '') : '']),
    )
  }, [hierarquia])
  const filtrados = useMemo(() => {
    if (!termo) return materiais
    return materiais.filter(m => {
      const forn = fornecimento.ligacoes
        .filter(l => l.materialId === m.id)
        .map(l => fornecimento.fornecedores.find(f => f.id === l.fornecedorId)?.nome ?? '')
        .join(' ')
      const doCatalogo = m.categoria === 'tecido' ? (grupoDoTecido.get(m.tecidoId) ?? '') : ''
      return semAcento([m.nome, m.tecido, m.cor, m.grupo, doCatalogo, forn].join(' ')).includes(
        termo,
      )
    })
  }, [materiais, termo, fornecimento, grupoDoTecido])
  /* os chips de categoria e o "para comprar" só valem na tabela */
  const gruposDaTabela = useMemo(
    () =>
      gruposDoEstoque(
        filtrados.filter(m =>
          filtro === 'comprar' ? m.livre < m.minimo : filtro ? m.categoria === filtro : true,
        ),
      ),
    [filtrados, filtro],
  )

  /* --- o escolhido -----------------------------------------------------------
     Um tecido inteiro ou um material. O que sumiu (o último item foi
     arquivado, o tecido ficou sem cor) não deixa a tela presa numa ficha vazia. */
  const materialEscolhido = useMemo(
    () => materiais.find(m => chaveDoMaterial(m.id) === escolhido) ?? null,
    [materiais, escolhido],
  )
  const grupoEscolhido = useMemo(
    () =>
      materialEscolhido
        ? (todosOsGrupos.find(g => g.itens.some(i => i.id === materialEscolhido.id)) ?? null)
        : (todosOsGrupos.find(g => g.chave === escolhido) ??
          /* o tecido do catálogo que ainda não tem cor no estoque também se escolhe */
          (() => {
            const t = hierarquia.tecidos.find(x => x.ativo && chaveDoTecido(x.id) === escolhido)
            return t ? grupoSemEstoque(t) : null
          })()),
    [todosOsGrupos, materialEscolhido, escolhido, hierarquia],
  )
  useEffect(() => {
    if (escolhido && !carregando && !grupoEscolhido) setEscolhido('')
  }, [escolhido, carregando, grupoEscolhido])

  const movimentosFiltrados = useMemo(() => {
    return movimentos.filter(v => {
      if (motivo && v.motivo !== motivo) return false
      if (!termo) return true
      return semAcento(
        [materialDoMovimento(v), v.pedido, v.quem, v.fornecedor, v.observacao].join(' '),
      ).includes(termo)
    })
  }, [movimentos, termo, motivo])

  function trocarAba(a: Aba) {
    setAba(a)
    setBusca('')
    setMarcados(null)
    if (a !== 'materiais') setEscolhido('')
  }

  function escolher(chave: string) {
    setEscolhido(chave)
    if (chave) {
      setAba('materiais')
      setVista('lista')
    }
  }

  async function refazer(fechar: () => void) {
    fechar()
    if (refazendo) return
    setRefazendo(true)
    try {
      const quantos = await refazerAsReservasAbertas()
      await recarregar()
      avisar(
        quantos === 1 ? 'Refiz a reserva de 1 pedido.' : `Refiz a reserva de ${quantos} pedidos.`,
        'ok',
      )
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui refazer as reservas.', 'brand')
    } finally {
      setRefazendo(false)
    }
  }

  async function conferir(fechar: () => void) {
    fechar()
    try {
      const fora = await conferirORazao()
      if (!fora.length) {
        avisar('O saldo de todos os materiais bate com a soma do razão.', 'ok')
        return
      }
      avisar(
        fora.length === 1
          ? `O saldo de ${fora[0].material} não bate com o razão.`
          : `${fora.length} materiais com saldo diferente da soma do razão.`,
        'brand',
      )
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui conferir o razão.', 'brand')
    }
  }

  function abrirMovimento() {
    if (!materiais.length) {
      avisar('Cadastre um material antes de movimentar o estoque.', 'info')
      return
    }
    setNoMovimento(materialEscolhido ?? grupoEscolhido?.itens[0] ?? materiais[0])
  }

  function abrirNovo(g?: GrupoDoEstoque | null) {
    if (g) {
      setNovo({
        categoria: g.categoria,
        tecidoId: g.tecidoId || undefined,
        grupo: g.categoria === 'tecido' ? undefined : g.itens[0]?.grupo,
      })
    } else {
      setNovo({ categoria })
    }
  }

  function verNoDeposito(ids: string[], rotulo: string) {
    setEscolhido('')
    setBusca('')
    setMarcados({ ids, rotulo })
    setAba('deposito')
  }

  const naFicha = celular && !!grupoEscolhido && abaAVista === 'materiais'
  const mostraTabela = abaAVista === 'materiais' && vista === 'tabela' && !estreita

  const contagem = (c: Categoria) => materiais.filter(m => m.categoria === c).length
  const contagemDoMotivo = (m: Motivo) => movimentos.filter(v => v.motivo === m).length

  const maisAcoes = podeEditar ? (
    <BotaoComMenu valor="Mais" titulo="Mais ações do estoque">
      {fechar => (
        <div className="mn-lista">
          <button type="button" className="mn-item" onClick={() => void refazer(fechar)}>
            <span className="nm">Refazer as reservas</span>
          </button>
          <button type="button" className="mn-item" onClick={() => void conferir(fechar)}>
            <span className="nm">Conferir o razão</span>
          </button>
        </div>
      )}
    </BotaoComMenu>
  ) : null

  const sub = (
    <>
      {plural(materiais.length, 'material', 'materiais')} ·{' '}
      {baixo.length ? <b className="es-pouco">{baixo.length} para comprar</b> : 'nada para comprar'}
    </>
  )

  /* --- o cabeçalho ---------------------------------------------------------
     No celular, com a ficha aberta, o cabeçalho da página é o do material: a
     volta em cima e o nome no título. */
  const cabecalho =
    naFicha && grupoEscolhido
      ? {
          acima: (
            <button type="button" className="es-volta" onClick={() => setEscolhido('')}>
              <ArrowLeft size={14} weight="bold" />
              Estoque · {NOME_DA_CATEGORIA[grupoEscolhido.categoria]}
            </button>
          ),
          titulo: materialEscolhido ? nomeNoGrupo(materialEscolhido) : grupoEscolhido.nome,
          sub:
            materialEscolhido && materialEscolhido.categoria === 'tecido'
              ? grupoEscolhido.nome
              : materialEscolhido
                ? materialEscolhido.grupo
                : grupoEscolhido.itens.length
                  ? plural(grupoEscolhido.itens.length, 'cor', 'cores')
                  : 'sem estoque',
        }
      : {
          acima: 'Materiais',
          titulo: 'Estoque',
          sub,
          acoes:
            podeEditar && !celular ? (
              <>
                {maisAcoes}
                <Botao onClick={() => abrirNovo()}>Novo material</Botao>
                <Botao tom="primario" onClick={abrirMovimento}>
                  Registrar movimento
                </Botao>
              </>
            ) : undefined,
        }

  /* O EDITOR DO DEPÓSITO TOMA A PÁGINA: tem os próprios botões no topo
     (Descartar e Salvar) e só devolve a tela quando a pessoa sai dele. */
  if (editandoDeposito && podeEditar) {
    return (
      <EditorDoDeposito
        sub={sub}
        plantaInicial={deposito}
        lugares={lugares}
        materiais={materiais}
        aoSalvar={lerDeposito}
        aoSair={para => {
          setEditandoDeposito(false)
          setAba(para)
        }}
      />
    )
  }

  /* --- a barra ---------------------------------------------------------------
     A mesma grade das quatro colunas: as abas da página sobre a primeira, a
     busca sobre a segunda e a terceira, e o que é da aba sobre a quarta. */
  const fimDaBarra =
    abaAVista === 'deposito' ? (
      podeEditar && !celular && !lendoDeposito && !erroDoDeposito && deposito ? (
        <BotaoEditarODeposito temDeposito aoEditar={() => setEditandoDeposito(true)} />
      ) : null
    ) : abaAVista === 'razao' ? (
      estreita ? null : (
        <Segmentado
          valor={agrupar}
          aoMudar={setAgrupar}
          opcoes={[
            {
              valor: 'dia',
              rotulo: (
                <span className="es-rotulo-com-icone">
                  <CalendarBlank size={16} />
                  Por dia
                </span>
              ),
            },
            {
              valor: 'material',
              rotulo: (
                <span className="es-rotulo-com-icone">
                  <Stack size={16} />
                  Por material
                </span>
              ),
            },
          ]}
        />
      )
    ) : abaAVista === 'materiais' && !estreita ? (
      <Segmentado
        valor={vista}
        aoMudar={v => {
          setVista(v)
          if (v === 'tabela') setEscolhido('')
          else setFiltro('')
        }}
        opcoes={[
          {
            valor: 'lista',
            rotulo: (
              <span className="es-rotulo-com-icone">
                <ListBullets size={16} />
                Lista
              </span>
            ),
          },
          {
            valor: 'tabela',
            rotulo: (
              <span className="es-rotulo-com-icone">
                <Table size={16} />
                Tabela
              </span>
            ),
          },
        ]}
      />
    ) : null

  const temBusca = abaAVista !== 'separacao' && abaAVista !== 'comprar'

  return (
    <Pagina {...cabecalho}>
      {podeEditar && celular && !naFicha ? (
        <div className="es-acoes">
          <Botao tom="primario" className="es-cresce" onClick={abrirMovimento}>
            Registrar movimento
          </Botao>
          <Botao icone aria-label="Novo material" onClick={() => abrirNovo()}>
            <Plus size={18} />
          </Botao>
          {maisAcoes}
        </div>
      ) : null}

      {naFicha ? null : (
        <div className="em-barra-caixa">
          <div className="em-barra" data-barra="">
            {celular ? (
              <div className="em-secoes" role="tablist" aria-label="Assuntos do estoque">
                {(
                  [
                    ['materiais', 'Materiais', 0],
                    ['separacao', 'Separação', fila.length],
                    ['comprar', 'Comprar', baixo.length],
                    ['razao', 'Movimentos', 0],
                    ['deposito', 'Depósito', 0],
                  ] as [Aba, string, number][]
                ).map(([valor, rotulo, n]) => (
                  <Chip
                    key={valor}
                    role="tab"
                    aria-selected={abaAVista === valor}
                    ligado={abaAVista === valor}
                    onClick={() => trocarAba(valor)}
                  >
                    {rotulo}
                    {n ? <span className="em-chip-n">{n}</span> : null}
                  </Chip>
                ))}
              </div>
            ) : (
              <Segmentado
                className="em-seg es-aba"
                valor={abaAVista === 'razao' || abaAVista === 'deposito' ? abaAVista : 'materiais'}
                aoMudar={trocarAba}
                opcoes={[
                  { valor: 'materiais', rotulo: 'Materiais' },
                  { valor: 'razao', rotulo: 'Movimentações' },
                  { valor: 'deposito', rotulo: 'Depósito' },
                ]}
              />
            )}
            {temBusca ? (
              <Busca
                className="em-busca es-busca"
                value={busca}
                onChange={e => {
                  setBusca(e.currentTarget.value)
                  setMarcados(null)
                }}
                placeholder={
                  abaAVista === 'materiais'
                    ? 'Buscar material, cor ou fornecedor'
                    : abaAVista === 'razao'
                      ? 'Buscar material, pedido ou pessoa'
                      : 'Onde está? Buscar tecido, cor ou item'
                }
                aria-label={abaAVista === 'deposito' ? 'Onde está?' : 'Buscar'}
              />
            ) : null}
            {fimDaBarra ? <div className="em-barra-fim">{fimDaBarra}</div> : null}

            {mostraTabela ? (
              <div className="em-barra-linha es-chips">
                <Chip ligado={filtro === ''} onClick={() => setFiltro('')}>
                  Todos <span className="es-conta">{materiais.length}</span>
                </Chip>
                {CATEGORIAS.map(c => (
                  <Chip
                    key={c}
                    ligado={filtro === c}
                    onClick={() => setFiltro(filtro === c ? '' : c)}
                  >
                    {NOME_DA_CATEGORIA[c]} <span className="es-conta">{contagem(c)}</span>
                  </Chip>
                ))}
                <Chip
                  cor="var(--brand)"
                  ligado={filtro === 'comprar'}
                  onClick={() => setFiltro(filtro === 'comprar' ? '' : 'comprar')}
                >
                  Para comprar <span className="es-conta">{baixo.length}</span>
                </Chip>
              </div>
            ) : abaAVista === 'razao' ? (
              <div className="em-barra-linha es-chips">
                <Chip ligado={motivo === ''} onClick={() => setMotivo('')}>
                  Todos <span className="es-conta">{movimentos.length}</span>
                </Chip>
                {MOTIVOS.map(m => (
                  <Chip
                    key={m}
                    ligado={motivo === m}
                    onClick={() => setMotivo(motivo === m ? '' : m)}
                  >
                    {NOME_DO_MOTIVO[m]} <span className="es-conta">{contagemDoMotivo(m)}</span>
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {abaAVista === 'deposito' && erroDoDeposito ? (
        <section className="cartao es-quadro">
          <Vazio
            titulo="Não consegui ler o depósito"
            texto={erroDoDeposito}
            acao={<Botao onClick={() => void lerDeposito()}>Tentar de novo</Botao>}
          />
        </section>
      ) : erro ? (
        <section className="cartao es-quadro">
          <Vazio titulo="Não consegui ler o estoque" texto={erro} />
        </section>
      ) : carregando || (abaAVista === 'deposito' && lendoDeposito) ? (
        <section className="cartao es-quadro">
          <div className="es-espera">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        </section>
      ) : abaAVista === 'deposito' ? (
        <Deposito
          planta={deposito}
          lugares={lugares}
          materiais={materiais}
          busca={busca}
          marcados={marcados}
          aoLimparMarcados={() => setMarcados(null)}
          podeEditar={podeEditar}
          estreita={estreita}
          celular={celular}
          aoEditar={() => setEditandoDeposito(true)}
          aoMarcar={m => setMarcando({ m, outro: false })}
          aoMovimentar={setNoMovimento}
        />
      ) : abaAVista === 'razao' ? (
        <section className="cartao es-quadro">
          <Movimentacoes
            movimentos={movimentosFiltrados}
            agrupar={agrupar}
            estreita={estreita}
            haMovimentos={movimentos.length > 0}
            aoAbrirPedido={
              podeSeparar ? pedidoId => navegar('/separacao?pedido=' + pedidoId) : undefined
            }
          />
        </section>
      ) : mostraTabela ? (
        <section className="cartao es-quadro">
          <TabelaDeMateriais
            grupos={gruposDaTabela}
            fornecimento={fornecimento}
            haMateriais={materiais.length > 0}
            filtrando={!!termo || !!filtro}
            aoAbrir={m => (podeEditar ? setNoMovimento(m) : undefined)}
          />
        </section>
      ) : materiais.length === 0 ? (
        <section className="cartao es-quadro">
          <Vazio
            titulo="Nenhum material cadastrado"
            texto="O estoque nasce vazio. Cadastre a malha, o aviamento e o insumo que a fábrica guarda, ou rode o ensaio para conferir a tela com conteúdo."
            acao={podeEditar ? <Botao onClick={() => abrirNovo()}>Novo material</Botao> : undefined}
          />
        </section>
      ) : (
        <Materiais
          materiais={materiais}
          filtrados={filtrados}
          termo={termo}
          hierarquia={hierarquia}
          movimentos={movimentos}
          reservas={reservas}
          fornecimento={fornecimento}
          fila={fila}
          guardado={guardado}
          podeEditar={podeEditar}
          podeSeparar={podeSeparar}
          celular={celular}
          secao={abaAVista === 'separacao' || abaAVista === 'comprar' ? abaAVista : 'materiais'}
          categoria={categoria}
          aoTrocarCategoria={setCategoria}
          escolhido={escolhido}
          aoEscolher={escolher}
          aoMovimentar={setNoMovimento}
          aoNovo={abrirNovo}
          aoEditar={setEditando}
          aoMarcar={(m, outro) => setMarcando({ m, outro })}
          aoVerNoDeposito={verNoDeposito}
          aoVerFornecedor={f => navegar(f ? '/fornecedores?abrir=' + f.id : '/fornecedores')}
          aoVerMovimentos={nome => {
            setEscolhido('')
            setMarcados(null)
            setBusca(nome ?? '')
            setAba('razao')
          }}
          aoVerComprar={
            estreita
              ? undefined
              : () => {
                  setFiltro('comprar')
                  setVista('tabela')
                }
          }
          aoSeparar={p => navegar(p ? '/separacao?pedido=' + p.id : '/separacao')}
        />
      )}

      <FolhaDeMovimento
        material={noMovimento}
        materiais={materiais}
        fornecimento={fornecimento}
        aoFechar={() => setNoMovimento(null)}
        aoGravar={async () => {
          setNoMovimento(null)
          await recarregar()
        }}
        aoCriarFornecedor={recarregarFornecedores}
      />
      <MarcarLugar
        material={marcando?.m ?? null}
        outroLugar={marcando?.outro}
        planta={deposito}
        lugares={lugares}
        materiais={materiais}
        aoFechar={() => setMarcando(null)}
        aoGravar={async () => {
          setMarcando(null)
          await lerDeposito()
        }}
      />
      <NovoMaterial
        inicio={novo}
        materiais={materiais}
        fornecimento={fornecimento}
        aoFechar={() => setNovo(null)}
        aoCriar={async (id, categoriaNova, tecidoId) => {
          setNovo(null)
          await recarregar()
          setCategoria(categoriaNova)
          /* o tecido novo abre a ficha do tecido; o item novo, a dele */
          escolher(
            categoriaNova === 'tecido' && tecidoId
              ? chaveDoTecido(tecidoId)
              : id
                ? chaveDoMaterial(id)
                : '',
          )
        }}
        aoCriarFornecedor={recarregarFornecedores}
      />
      <EditarGrupo
        grupo={editando}
        fornecimento={fornecimento}
        aoFechar={() => setEditando(null)}
        aoSalvar={async () => {
          setEditando(null)
          await recarregar()
        }}
        aoCriarFornecedor={recarregarFornecedores}
      />
    </Pagina>
  )
}
