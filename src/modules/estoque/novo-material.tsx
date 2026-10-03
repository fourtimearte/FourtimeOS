import { useEffect, useMemo, useState } from 'react'
import { Aviso, Botao, Campo, Chip, Entrada, Esqueleto, Modal, Segmentado, Seletor, avisar } from '@ds'
import {
  CATEGORIAS,
  NOME_DA_CATEGORIA,
  cadastrarMaterial,
  carregarCatalogoDeTecido,
  type Categoria,
  type CorDoCatalogo,
  type MalhaDoCatalogo,
  type Material,
} from '@dominio/estoque'
import { criarFornecedor, ligarMaterialAoFornecedor } from '@dominio/fornecedor'
import { EscolherFornecedor } from '@dominio/fornecedor/escolher'
import { lerNumero } from '@dominio/ferramentas'
import { idsDosFornecedores, type Fornecimento } from './apoio'
import { Bola } from './vao'

/* ==========================================================================
   O material novo.

   ELE ENTRA COM SALDO ZERO. O saldo só muda por movimento, e é por isso que
   não existe campo de "quanto tem" aqui: quem cadastra e já tem o material na
   prateleira registra uma entrada em seguida, e a entrada fica no razão com
   nome e hora.

   TECIDO SE ESCOLHE, NÃO SE ESCREVE. A malha e a cor vêm do banco de dados do
   editor, porque é por elas que a separação acha o tecido de um layout.
   Escrever "Dry fit preto" à mão criaria um material que nenhum pedido
   reserva. As cores que já estão no estoque daquela malha aparecem apagadas.

   AVIAMENTO E INSUMO TÊM GRUPO, que é o que junta "Linha 120 branca" e
   "Linha 120 preta" numa linha só da lista.
   ========================================================================== */

export type InicioDoNovo = { categoria: Categoria; tecidoId?: string; grupo?: string }

const UNIDADES = ['un', 'm', 'kg', 'L', 'cone', 'rolo', 'cx', 'par']

export function NovoMaterial({
  inicio,
  materiais,
  fornecimento,
  aoFechar,
  aoCriar,
  aoCriarFornecedor,
}: {
  /** com o que o modal abre; nulo fecha */
  inicio: InicioDoNovo | null
  materiais: Material[]
  fornecimento: Fornecimento
  aoFechar: () => void
  /** recebe o material criado, já com o id */
  aoCriar: (id: string, categoria: Categoria, tecidoId: string, grupo: string) => Promise<void>
  aoCriarFornecedor: () => Promise<void>
}) {
  const [categoria, setCategoria] = useState<Categoria>('tecido')
  const [malhaId, setMalhaId] = useState('')
  const [corId, setCorId] = useState('')
  const [grupo, setGrupo] = useState('')
  const [grupoNovo, setGrupoNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [minimo, setMinimo] = useState('')
  const [ondeFica, setOndeFica] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')

  const [malhas, setMalhas] = useState<MalhaDoCatalogo[] | null>(null)
  const [cores, setCores] = useState<CorDoCatalogo[]>([])
  const [falhaDoCatalogo, setFalhaDoCatalogo] = useState('')

  useEffect(() => {
    if (!inicio) return
    setCategoria(inicio.categoria)
    setMalhaId(inicio.tecidoId ?? '')
    setCorId('')
    setGrupo(inicio.grupo ?? '')
    setGrupoNovo(false)
    setNome('')
    setUnidade(inicio.categoria === 'tecido' ? 'kg' : 'un')
    setMinimo('')
    setOndeFica('')
    setFalha('')
  }, [inicio])

  /* o catálogo só é pedido quando alguém abre o modal em tecido */
  const precisaDoCatalogo = !!inicio && categoria === 'tecido' && malhas === null
  useEffect(() => {
    if (!precisaDoCatalogo) return
    let vivo = true
    carregarCatalogoDeTecido()
      .then((c) => {
        if (!vivo) return
        setMalhas(c.malhas)
        setCores(c.cores)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        setMalhas([])
        setFalhaDoCatalogo(e instanceof Error ? e.message : 'Não consegui ler o catálogo de tecidos.')
      })
    return () => {
      vivo = false
    }
  }, [precisaDoCatalogo])

  const ehTecido = categoria === 'tecido'
  const jaNoEstoque = useMemo(
    () => new Set(materiais.filter((m) => m.tecidoId === malhaId).map((m) => m.corId)),
    [materiais, malhaId],
  )
  const grupos = useMemo(
    () =>
      [...new Set(materiais.filter((m) => m.categoria === categoria && m.grupo).map((m) => m.grupo))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [materiais, categoria],
  )

  /* quem já entrega a mesma malha, ou o mesmo grupo, é o palpite do fornecedor */
  const vizinhos = useMemo(
    () =>
      materiais.filter((m) =>
        ehTecido ? !!malhaId && m.tecidoId === malhaId : !!grupo && m.categoria === categoria && m.grupo === grupo,
      ),
    [materiais, ehTecido, malhaId, grupo, categoria],
  )
  const jaFornecem = useMemo(
    () => [...new Set(vizinhos.flatMap((m) => idsDosFornecedores(fornecimento.ligacoes, m.id)))],
    [vizinhos, fornecimento.ligacoes],
  )
  const palpite = jaFornecem[0] ?? ''
  useEffect(() => {
    setFornecedorId(palpite)
  }, [palpite, inicio])

  const malha = malhas?.find((m) => m.id === malhaId)
  const cor = cores.find((c) => c.id === corId)
  const min = lerNumero(minimo)
  const minimoValido = min === null || (!Number.isNaN(min) && min >= 0)
  const nomeFinal = ehTecido ? (malha && cor ? `${malha.nome} · ${cor.nome}` : '') : nome.trim()
  const pronto = !!nomeFinal && minimoValido && (ehTecido || !!unidade)

  async function criar() {
    if (!pronto || gravando) return
    setGravando(true)
    setFalha('')
    try {
      const id = await cadastrarMaterial({
        categoria,
        nome: nomeFinal,
        unidade: ehTecido ? 'kg' : unidade,
        minimo: min ?? 0,
        tecidoId: ehTecido ? malhaId : undefined,
        corId: ehTecido ? corId : undefined,
        grupo: ehTecido ? undefined : grupo.trim(),
        ondeFica,
      })
      if (!id) throw new Error('O banco não confirmou a gravação do material.')
      if (fornecedorId) await ligarMaterialAoFornecedor(id, fornecedorId)
      avisar(`${nomeFinal} entrou no estoque, com saldo zero.`, 'ok')
      await aoCriar(id, categoria, ehTecido ? malhaId : '', ehTecido ? '' : grupo.trim())
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui criar o material.')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto={!!inicio}
      aoFechar={aoFechar}
      titulo="Novo material"
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="primario" onClick={criar} disabled={!pronto || gravando} carregando={gravando}>
            {gravando ? 'Criando' : 'Criar material'}
          </Botao>
        </>
      }
    >
      <div className="es-novo">
        <p className="es-ajuda">Ele entra com saldo zero. O saldo só muda por movimento.</p>

        <Campo rotulo="Categoria">
          <Segmentado
            className="es-largo"
            valor={categoria}
            aoMudar={(c) => {
              setCategoria(c)
              setUnidade(c === 'tecido' ? 'kg' : 'un')
              setGrupo('')
              setGrupoNovo(false)
            }}
            opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: NOME_DA_CATEGORIA[c] }))}
          />
        </Campo>

        {ehTecido ? (
          malhas === null ? (
            <div className="pilha">
              <Esqueleto altura={40} />
              <Esqueleto altura={40} />
            </div>
          ) : falhaDoCatalogo ? (
            <Aviso tom="brand" titulo="Não consegui ler o catálogo de tecidos">
              {falhaDoCatalogo}
            </Aviso>
          ) : (
            <>
              <div className="campo">
                <span className="es-campo-topo">
                  Malha <small>vem do catálogo de tecidos, e é ela que agrupa as cores</small>
                </span>
                <Seletor
                  campo
                  bloco
                  comBusca
                  valor={malhaId}
                  opcoes={malhas.map((m) => ({ valor: m.id, rotulo: m.nome }))}
                  aoEscolher={(v) => {
                    setMalhaId(v)
                    setCorId('')
                  }}
                  vazio="Escolha a malha"
                />
              </div>
              <div className="campo">
                <span className="es-campo-topo">
                  Cor {malhaId && jaNoEstoque.size ? <small>as apagadas já estão no estoque</small> : null}
                </span>
                <div className="es-novo-chips">
                  {cores.map((c) => {
                    const ja = jaNoEstoque.has(c.id)
                    return (
                      <Chip
                        key={c.id}
                        ligado={corId === c.id}
                        disabled={ja}
                        className={ja ? 'es-ja-tem' : ''}
                        onClick={() => setCorId(c.id)}
                      >
                        <Bola cor={c.hex} pequena />
                        {c.nome}
                      </Chip>
                    )
                  })}
                </div>
              </div>
            </>
          )
        ) : (
          <>
            <div className="campo">
              <span className="es-campo-topo">
                Grupo <small>é o que junta os parecidos numa linha só da lista</small>
              </span>
              <div className="es-novo-chips">
                {grupos.map((g) => (
                  <Chip
                    key={g}
                    ligado={!grupoNovo && grupo === g}
                    onClick={() => {
                      setGrupo(g)
                      setGrupoNovo(false)
                    }}
                  >
                    {g}
                  </Chip>
                ))}
                <Chip
                  ligado={grupoNovo}
                  onClick={() => {
                    setGrupoNovo(true)
                    setGrupo('')
                  }}
                >
                  Novo grupo
                </Chip>
              </div>
              {grupoNovo ? (
                <Entrada
                  value={grupo}
                  onChange={(e) => setGrupo(e.currentTarget.value)}
                  placeholder="Linha, Botão, DTF, Embalagem"
                  aria-label="Nome do grupo novo"
                />
              ) : null}
            </div>
            <Campo rotulo="Nome do material">
              <Entrada
                value={nome}
                onChange={(e) => setNome(e.currentTarget.value)}
                placeholder={categoria === 'aviamento' ? 'Linha poliéster 120 branca' : 'Filme DTF 60 cm'}
              />
            </Campo>
          </>
        )}

        <div className="es-novo-tres">
          {ehTecido ? (
            <Campo rotulo="Unidade">
              <Entrada value="kg" readOnly aria-label="Unidade, fixa em quilo para tecido" />
            </Campo>
          ) : (
            <Campo rotulo="Unidade">
              <Seletor
                campo
                bloco
                valor={unidade}
                opcoes={UNIDADES.map((u) => ({ valor: u, rotulo: u }))}
                aoEscolher={(v) => v && setUnidade(v)}
                vazio="Escolha"
              />
            </Campo>
          )}
          <Campo rotulo={'Mínimo, em ' + (ehTecido ? 'kg' : unidade)} erro={!minimoValido}>
            <Entrada
              inputMode="decimal"
              value={minimo}
              onChange={(e) => setMinimo(e.currentTarget.value)}
              placeholder="0"
            />
          </Campo>
          <Campo rotulo="Onde fica na fábrica">
            <Entrada
              value={ondeFica}
              onChange={(e) => setOndeFica(e.currentTarget.value)}
              placeholder="Prateleira, armário ou caixa"
            />
          </Campo>
        </div>

        {fornecimento.disponivel ? (
          <div className="campo">
            <span className="es-campo-topo">
              Fornecedor{' '}
              {fornecedorId && fornecedorId === palpite ? (
                <small>sugerido porque já fornece {ehTecido ? 'esta malha' : 'este grupo'}</small>
              ) : null}
            </span>
            <EscolherFornecedor
              valor={fornecedorId}
              aoEscolher={setFornecedorId}
              fornecedores={fornecimento.fornecedores}
              jaFornecem={jaFornecem}
              tipo={categoria}
              nomeDoTipo={NOME_DA_CATEGORIA[categoria]}
              oQue={ehTecido ? 'esta malha' : 'este grupo'}
              aoCriar={async (n) => {
                const id = await criarFornecedor({ nome: n, entrouPor: 'estoque', tipos: [categoria] })
                await aoCriarFornecedor()
                return id
              }}
            />
          </div>
        ) : null}

        {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
      </div>
    </Modal>
  )
}
