import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarBlank, CaretRight, ListBullets, Plus, Stack, Table } from '@phosphor-icons/react'
import { Botao, BotaoComMenu, Busca, Chip, Esqueleto, Pagina, Segmentado, Vazio, avisar } from '@ds'
import { semAcento, usarConsulta } from '@shared'
import {
  CATEGORIAS,
  NOME_DA_CATEGORIA,
  NOME_DO_MOTIVO,
  abaixoDoMinimo,
  carregarMateriais,
  carregarMovimentos,
  carregarReservasEmAberto,
  conferirORazao,
  gruposDoEstoque,
  refazerAsReservasAbertas,
  type Categoria,
  type GrupoDoEstoque,
  type Material,
  type Motivo,
  type Movimento,
  type ReservaEmAberto,
} from '@dominio/estoque'
import { fornecedoresParaOEstoque } from '@dominio/fornecedor'
import { pode, useSessao } from '@dominio/sessao'
import { fornecedorDoGrupo, materialDoMovimento, plural, type Fornecimento } from './apoio'
import { EditarGrupo } from './editar-grupo'
import { MaterialEscolhido, resumoDoGrupo, rotuloDeNovoItem } from './escolhido'
import { FolhaDeMovimento } from './folha-de-movimento'
import { VisaoGeral } from './geral'
import { Movimentacoes, type Agrupar } from './movimentacoes'
import { NovoMaterial, type InicioDoNovo } from './novo-material'
import { TabelaDeMateriais } from './tabela'
import { VaoDoMaterial } from './vao'
import './estoque.css'

/* ==========================================================================
   Estoque.

   A TELA É LISTA E ESCOLHIDO. À esquerda a lista, agrupada: tecido por malha
   (as cores entram dentro dela), aviamento e insumo por grupo. À direita o que
   foi escolhido, e enquanto nada foi escolhido, a visão geral: o que falta
   comprar, o que andou e a prateleira de tecidos.

   O QUE ESTA TELA MOSTRA É O RAZÃO, E NÃO UM SALDO DIGITÁVEL. Não existe
   campo para corrigir o quanto tem. Quem erra a contagem lança um ajuste, e o
   ajuste fica no histórico com nome e hora.

   O FORNECEDOR ESTÁ SEMPRE À VISTA: na linha da lista, na etiqueta do
   material escolhido, na tabela e no movimento. Ele vem da página de
   Fornecedores; quando a lista de lá não responde, a tela se cala sobre
   fornecedor e continua respondendo o que é dela, que é tem ou não tem.
   ========================================================================== */

type Aba = 'materiais' | 'razao'
type Vista = 'lista' | 'tabela'
type Filtro = '' | Categoria | 'comprar'

const SEM_FORNECIMENTO: Fornecimento = { fornecedores: [], ligacoes: [], disponivel: false }
const MOTIVOS: Motivo[] = ['entrada', 'saida', 'ajuste', 'separacao', 'devolucao']

export function TelaEstoque() {
  const navegar = useNavigate()
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const podeEditar = !!pessoa && pode(pessoa, 'estoque', 'editar')

  const [materiais, setMateriais] = useState<Material[]>([])
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [reservas, setReservas] = useState<ReservaEmAberto[]>([])
  const [fornecimento, setFornecimento] = useState<Fornecimento>(SEM_FORNECIMENTO)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  /* A PÁGINA ABRE JÁ FILTRADA quando alguém chega de outra: a ficha do
     fornecedor manda para cá com o nome dele na busca, e para as
     movimentações dele com a aba junto. */
  const [endereco] = useSearchParams()
  const [aba, setAba] = useState<Aba>(endereco.get('aba') === 'razao' ? 'razao' : 'materiais')
  const [vista, setVista] = useState<Vista>('lista')
  const [busca, setBusca] = useState(endereco.get('busca') ?? '')
  const [filtro, setFiltro] = useState<Filtro>('')
  const [motivo, setMotivo] = useState<'' | Motivo>('')
  const [agrupar, setAgrupar] = useState<Agrupar>('dia')
  const [escolhido, setEscolhido] = useState('')

  const [noMovimento, setNoMovimento] = useState<Material | null>(null)
  const [novo, setNovo] = useState<InicioDoNovo | null>(null)
  const [editando, setEditando] = useState<GrupoDoEstoque | null>(null)
  const [refazendo, setRefazendo] = useState(false)

  /* abaixo disto as caixas empilham e o material escolhido vira a tela */
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

  const recarregar = useCallback(async () => {
    try {
      await ler()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler o estoque.')
    }
  }, [ler])

  useEffect(() => {
    let vivo = true
    ler()
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler o estoque.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [ler])

  const recarregarFornecedores = useCallback(async () => {
    setFornecimento(await fornecedoresParaOEstoque())
  }, [])

  const baixo = useMemo(() => abaixoDoMinimo(materiais), [materiais])
  const todosOsGrupos = useMemo(() => gruposDoEstoque(materiais), [materiais])

  /* A BUSCA ACHA PELO QUE A PESSOA LEMBRA: o nome do material, a malha, a
     cor, o grupo ou o fornecedor. */
  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim())
    return materiais.filter((m) => {
      if (filtro === 'comprar' ? m.livre >= m.minimo : filtro && m.categoria !== filtro) return false
      if (!termo) return true
      const forn = fornecimento.ligacoes
        .filter((l) => l.materialId === m.id)
        .map((l) => fornecimento.fornecedores.find((f) => f.id === l.fornecedorId)?.nome ?? '')
        .join(' ')
      return semAcento([m.nome, m.tecido, m.cor, m.grupo, forn].join(' ')).includes(termo)
    })
  }, [materiais, busca, filtro, fornecimento])
  const grupos = useMemo(() => gruposDoEstoque(filtrados), [filtrados])

  const grupoEscolhido = useMemo(
    () => todosOsGrupos.find((g) => g.chave === escolhido) ?? null,
    [todosOsGrupos, escolhido],
  )
  /* o grupo que sumiu (o último item foi arquivado, o nome do grupo mudou)
     não deixa a tela presa num detalhe vazio */
  useEffect(() => {
    if (escolhido && !carregando && !grupoEscolhido) setEscolhido('')
  }, [escolhido, carregando, grupoEscolhido])

  const movimentosFiltrados = useMemo(() => {
    const termo = semAcento(busca.trim())
    return movimentos.filter((v) => {
      if (motivo && v.motivo !== motivo) return false
      if (!termo) return true
      return semAcento(
        [materialDoMovimento(v), v.pedido, v.quem, v.fornecedor, v.observacao].join(' '),
      ).includes(termo)
    })
  }, [movimentos, busca, motivo])

  async function refazer(fechar: () => void) {
    fechar()
    if (refazendo) return
    setRefazendo(true)
    try {
      const quantos = await refazerAsReservasAbertas()
      await recarregar()
      avisar(quantos === 1 ? 'Refiz a reserva de 1 pedido.' : `Refiz a reserva de ${quantos} pedidos.`, 'ok')
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
    setNoMovimento(grupoEscolhido?.itens[0] ?? materiais[0])
  }

  function abrirNovo(g?: GrupoDoEstoque | null) {
    if (g) {
      setNovo({
        categoria: g.categoria,
        tecidoId: g.tecidoId || undefined,
        grupo: g.categoria === 'tecido' ? undefined : g.itens[0]?.grupo,
      })
    } else {
      setNovo({ categoria: filtro === 'aviamento' || filtro === 'insumo' ? filtro : 'tecido' })
    }
  }

  const noDetalhe = estreita && !!grupoEscolhido && aba === 'materiais'
  const mostraTabela = aba === 'materiais' && vista === 'tabela' && !estreita

  const contagem = (c: Categoria) => materiais.filter((m) => m.categoria === c).length
  const contagemDoMotivo = (m: Motivo) => movimentos.filter((v) => v.motivo === m).length

  const maisAcoes = podeEditar ? (
    <BotaoComMenu valor="Mais" titulo="Mais ações do estoque">
      {(fechar) => (
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
      {baixo.length ? (
        <b className="es-pouco">{baixo.length} para comprar</b>
      ) : (
        'nada para comprar'
      )}
    </>
  )

  /* --- o cabeçalho ---------------------------------------------------------
     No detalhe estreito, o cabeçalho da página é o do material: a volta em
     cima, o nome no título e os botões dele. */
  const cabecalho = noDetalhe && grupoEscolhido
    ? {
        acima: (
          <button type="button" className="es-volta" onClick={() => setEscolhido('')}>
            <ArrowLeft size={14} weight="bold" />
            Estoque · {NOME_DA_CATEGORIA[grupoEscolhido.categoria]}
          </button>
        ),
        titulo: grupoEscolhido.nome,
        sub: resumoDoGrupo(grupoEscolhido),
        acoes: podeEditar ? (
          <>
            <Botao onClick={() => abrirNovo(grupoEscolhido)}>{rotuloDeNovoItem(grupoEscolhido)}</Botao>
            <Botao onClick={() => setEditando(grupoEscolhido)}>Editar</Botao>
          </>
        ) : undefined,
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

  return (
    <Pagina {...cabecalho}>
      {podeEditar && celular && !noDetalhe ? (
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

      {noDetalhe ? null : (
        <div className="es-barra">
          <Segmentado
            className="es-aba"
            valor={aba}
            aoMudar={(a) => {
              setAba(a)
              setBusca('')
            }}
            opcoes={[
              { valor: 'materiais', rotulo: 'Materiais' },
              { valor: 'razao', rotulo: 'Movimentações' },
            ]}
          />
          <Busca
            className="es-busca"
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            placeholder={aba === 'materiais' ? 'Buscar material ou fornecedor' : 'Buscar material, pedido ou pessoa'}
            aria-label="Buscar"
          />
          {aba === 'materiais' ? (
            <div className="es-chips">
              <Chip ligado={filtro === ''} onClick={() => setFiltro('')}>
                Todos <span className="es-conta">{materiais.length}</span>
              </Chip>
              {CATEGORIAS.map((c) => (
                <Chip key={c} ligado={filtro === c} onClick={() => setFiltro(filtro === c ? '' : c)}>
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
          ) : (
            <div className="es-chips">
              <Chip ligado={motivo === ''} onClick={() => setMotivo('')}>
                Todos <span className="es-conta">{movimentos.length}</span>
              </Chip>
              {MOTIVOS.map((m) => (
                <Chip key={m} ligado={motivo === m} onClick={() => setMotivo(motivo === m ? '' : m)}>
                  {NOME_DO_MOTIVO[m]} <span className="es-conta">{contagemDoMotivo(m)}</span>
                </Chip>
              ))}
            </div>
          )}
          {aba === 'materiais' ? (
            <Segmentado
              className="es-ver"
              valor={vista}
              aoMudar={setVista}
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
          ) : (
            <Segmentado
              className="es-ver"
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
          )}
        </div>
      )}

      {erro ? (
        <section className="cartao es-quadro">
          <Vazio titulo="Não consegui ler o estoque" texto={erro} />
        </section>
      ) : carregando ? (
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
      ) : aba === 'razao' ? (
        <section className="cartao es-quadro">
          <Movimentacoes
            movimentos={movimentosFiltrados}
            agrupar={agrupar}
            estreita={estreita}
            haMovimentos={movimentos.length > 0}
          />
        </section>
      ) : mostraTabela ? (
        <section className="cartao es-quadro">
          <TabelaDeMateriais
            grupos={grupos}
            fornecimento={fornecimento}
            haMateriais={materiais.length > 0}
            aoAbrir={(m) => (podeEditar ? setNoMovimento(m) : undefined)}
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
        <div className={grupoEscolhido ? 'es-duas com-escolhido' : 'es-duas'}>
          <ListaDoEstoque
            grupos={grupos}
            escolhido={escolhido}
            fornecimento={fornecimento}
            aoEscolher={(chave) => setEscolhido(chave === escolhido && !estreita ? '' : chave)}
          />
          <div className="es-lado">
            {grupoEscolhido ? (
              <MaterialEscolhido
                grupo={grupoEscolhido}
                fornecedor={fornecedorDoGrupo(grupoEscolhido, fornecimento)}
                temFornecedores={fornecimento.disponivel}
                ultimaEntrada={
                  movimentos.find(
                    (v) => v.motivo === 'entrada' && grupoEscolhido.itens.some((m) => m.id === v.materialId),
                  )?.quando ?? ''
                }
                movimentos={movimentos.filter((v) => grupoEscolhido.itens.some((m) => m.id === v.materialId))}
                reservas={reservas.filter((r) => grupoEscolhido.itens.some((m) => m.id === r.materialId))}
                podeEditar={podeEditar}
                estreita={estreita}
                aoMovimentar={setNoMovimento}
                aoNovoItem={() => abrirNovo(grupoEscolhido)}
                aoEditar={() => setEditando(grupoEscolhido)}
                aoVerFornecedor={() => {
                  const f = fornecedorDoGrupo(grupoEscolhido, fornecimento)
                  navegar(f ? '/fornecedores?abrir=' + f.id : '/fornecedores')
                }}
                aoVerMovimentos={() => {
                  setBusca(grupoEscolhido.nome)
                  setAba('razao')
                }}
              />
            ) : (
              <VisaoGeral
                materiais={materiais}
                grupos={todosOsGrupos}
                movimentos={movimentos}
                fornecimento={fornecimento}
                aoEscolher={setEscolhido}
                aoVerMovimentos={() => setAba('razao')}
              />
            )}
          </div>
        </div>
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
      <NovoMaterial
        inicio={novo}
        materiais={materiais}
        fornecimento={fornecimento}
        aoFechar={() => setNovo(null)}
        aoCriar={async (_id, categoria, tecidoId, grupo) => {
          setNovo(null)
          await recarregar()
          setAba('materiais')
          setEscolhido(
            categoria === 'tecido'
              ? tecidoId
                ? 'tecido:' + tecidoId
                : ''
              : grupo
                ? categoria + ':' + grupo.toLowerCase()
                : '',
          )
        }}
        aoCriarFornecedor={recarregarFornecedores}
      />
      <EditarGrupo
        grupo={editando}
        fornecimento={fornecimento}
        aoFechar={() => setEditando(null)}
        aoSalvar={async (grupoNovo) => {
          const antes = editando
          setEditando(null)
          await recarregar()
          if (antes && antes.categoria !== 'tecido' && grupoNovo) {
            setEscolhido(antes.categoria + ':' + grupoNovo.toLowerCase())
          }
        }}
        aoCriarFornecedor={recarregarFornecedores}
      />
    </Pagina>
  )
}

/* --- a lista ---------------------------------------------------------------
   Uma faixa por categoria e uma linha por grupo: o nome, o fornecedor, um vão
   miúdo por item e o ponto vermelho quando algum deles é para comprar. */
function ListaDoEstoque({
  grupos,
  escolhido,
  fornecimento,
  aoEscolher,
}: {
  grupos: GrupoDoEstoque[]
  escolhido: string
  fornecimento: Fornecimento
  aoEscolher: (chave: string) => void
}) {
  if (!grupos.length) {
    return (
      <section className="cartao es-lista">
        <Vazio titulo="Nada neste filtro" texto="Nenhum material combina com o que está escolhido." />
      </section>
    )
  }
  return (
    <section className="cartao es-lista">
      {CATEGORIAS.map((c) => {
        const daCategoria = grupos.filter((g) => g.categoria === c)
        if (!daCategoria.length) return null
        return (
          <div key={c} className="es-lista-bloco">
            <div className="es-faixa">
              {NOME_DA_CATEGORIA[c]}
              <span>
                {c === 'tecido'
                  ? plural(daCategoria.length, 'malha', 'malhas')
                  : plural(daCategoria.length, 'grupo', 'grupos')}
              </span>
            </div>
            {daCategoria.map((g) => {
              const f = fornecedorDoGrupo(g, fornecimento)
              return (
                <button
                  type="button"
                  key={g.chave}
                  className={g.chave === escolhido ? 'es-item escolhido' : 'es-item'}
                  aria-pressed={g.chave === escolhido}
                  onClick={() => aoEscolher(g.chave)}
                >
                  <span className="es-texto">
                    <b>{g.nome}</b>
                    {f ? (
                      <small>{f.nome}</small>
                    ) : fornecimento.disponivel ? (
                      <small className="es-falta">falta escolher o fornecedor</small>
                    ) : (
                      <small>
                        {c === 'tecido'
                          ? plural(g.itens.length, 'cor', 'cores')
                          : plural(g.itens.length, 'material', 'materiais')}
                      </small>
                    )}
                  </span>
                  <span className="es-minis">
                    {g.itens.slice(0, 6).map((m) => (
                      <VaoDoMaterial key={m.id} m={m} mini />
                    ))}
                  </span>
                  <span className={g.paraComprar ? 'es-ponto' : 'es-ponto apagado'} />
                  <CaretRight size={16} className="es-seta" />
                </button>
              )
            })}
          </div>
        )
      })}
    </section>
  )
}
