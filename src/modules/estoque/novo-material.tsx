import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Plus } from '@phosphor-icons/react'
import {
  Aviso,
  Botao,
  Campo,
  Chip,
  Entrada,
  Esqueleto,
  Modal,
  Segmentado,
  Seletor,
  avisar,
} from '@ds'
import {
  CATEGORIAS,
  NOME_DA_CATEGORIA,
  cadastrarMaterial,
  carregarCatalogoDeTecido,
  reativarMaterialArquivado,
  type Categoria,
  type CorDoCatalogo,
  type FamiliaDeCor,
  type MalhaDoCatalogo,
  type Material,
} from '@dominio/estoque'
import { criarFornecedor, ligarMaterialAoFornecedor } from '@dominio/fornecedor'
import { NovoFornecedorAoLado } from '@dominio/fornecedor/ao-lado'
import { EscolherFornecedor } from '@dominio/fornecedor/escolher'
import { lerNumero } from '@dominio/ferramentas'
import { definirLugares, type Lugar } from '@dominio/deposito'
import { idsDosFornecedores, type Fornecimento, type Guardado } from './apoio'
import { EtiquetaDoLugar } from './frente'
import { EscolherCor } from './escolher-cor'
import { MarcarLugar } from './marcar-lugar'

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

   A COR SE ESCOLHE PELA FAMÍLIA (`escolher-cor.tsx`): o catálogo tem mais de
   cem cores, e administrador e gerente põem cor nova e editam a que existe
   sem sair daqui.

   AVIAMENTO E INSUMO TÊM GRUPO, que é o que junta "Linha 120 branca" e
   "Linha 120 preta" numa linha só da lista.

   O FORNECEDOR QUE AINDA NÃO EXISTE NASCE AQUI DO LADO (pedido do Henrique,
   05/10/2026). "Novo fornecedor" abre uma coluna na mesma tela, com o CNPJ, o
   nome e o contato; salvo, a coluna fecha e o cadastro continua com ele já
   escolhido. Nada do que a pessoa escreveu da cor se perde no caminho.

   O MÍNIMO É O NÍVEL DO AVISO: quando o livre cai abaixo dele, o material
   entra em Para comprar e no trilho do que está acabando.
   ========================================================================== */

export type InicioDoNovo = { categoria: Categoria; tecidoId?: string; grupo?: string }

const UNIDADES = ['un', 'm', 'kg', 'L', 'cone', 'rolo', 'cx', 'par']
const SEM_NENHUMA = new Set<string>()

export function NovoMaterial({
  inicio,
  materiais,
  fornecimento,
  guardado,
  podeMexerNasCores,
  aoFechar,
  aoCriar,
  aoCriarFornecedor,
  aoMudarCores,
}: {
  /** com o que o modal abre; nulo fecha */
  inicio: InicioDoNovo | null
  materiais: Material[]
  fornecimento: Fornecimento
  /** o depósito desenhado e o lugar de cada material; sem desenho, `planta` é nula */
  guardado: Guardado
  /** administrador e gerente: põem cor no catálogo e editam a que existe */
  podeMexerNasCores: boolean
  aoFechar: () => void
  /** recebe o material criado, já com o id */
  aoCriar: (id: string, categoria: Categoria, tecidoId: string, grupo: string) => Promise<void>
  aoCriarFornecedor: () => Promise<void>
  /** uma cor do catálogo mudou de nome ou de cor: quem mostra material relê */
  aoMudarCores: () => Promise<void>
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
  /* o lugar apontado no desenho do depósito, e a caixa de apontar */
  const [lugares, setLugares] = useState<Lugar[]>([])
  const [marcando, setMarcando] = useState(false)
  const [fornecedorId, setFornecedorId] = useState('')
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')
  /* a coluna do fornecedor novo, aberta ao lado do cadastro */
  const [aoLado, setAoLado] = useState(false)
  /* o fornecedor que a pessoa escolheu ou criou não é trocado pelo palpite */
  const naMao = useRef(false)

  const [malhas, setMalhas] = useState<MalhaDoCatalogo[] | null>(null)
  const [cores, setCores] = useState<CorDoCatalogo[]>([])
  const [familias, setFamilias] = useState<FamiliaDeCor[]>([])
  /* com a ficha de uma cor aberta, "Criar material" espera: senão a pessoa
     escreve a cor nova, clica no botão vermelho e perde o que escreveu */
  const [naFichaDaCor, setNaFichaDaCor] = useState(false)
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
    setLugares([])
    setMarcando(false)
    setFalha('')
    setAoLado(false)
    setNaFichaDaCor(false)
    naMao.current = false
  }, [inicio])

  /* o catálogo só é pedido quando alguém abre o modal em tecido */
  const precisaDoCatalogo = !!inicio && categoria === 'tecido' && malhas === null
  useEffect(() => {
    if (!precisaDoCatalogo) return
    let vivo = true
    carregarCatalogoDeTecido()
      .then(c => {
        if (!vivo) return
        setMalhas(c.malhas)
        setCores(c.cores)
        setFamilias(c.familias)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        setMalhas([])
        setFalhaDoCatalogo(
          e instanceof Error ? e.message : 'Não consegui ler o catálogo de tecidos.',
        )
      })
    return () => {
      vivo = false
    }
  }, [precisaDoCatalogo])

  /* depois de uma cor nascer ou mudar no catálogo, o cadastro e a página
     releem: a cor nova já aparece na família, e a bolinha da árvore muda */
  async function relerAsCores() {
    const c = await carregarCatalogoDeTecido()
    setMalhas(c.malhas)
    setCores(c.cores)
    setFamilias(c.familias)
    await aoMudarCores().catch(() => undefined)
  }

  const ehTecido = categoria === 'tecido'
  const jaNoEstoque = useMemo(
    () => new Set(materiais.filter(m => m.tecidoId === malhaId).map(m => m.corId)),
    [materiais, malhaId],
  )
  const grupos = useMemo(
    () =>
      [
        ...new Set(materiais.filter(m => m.categoria === categoria && m.grupo).map(m => m.grupo)),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [materiais, categoria],
  )

  /* quem já entrega a mesma malha, ou o mesmo grupo, é o palpite do fornecedor */
  const vizinhos = useMemo(
    () =>
      materiais.filter(m =>
        ehTecido
          ? !!malhaId && m.tecidoId === malhaId
          : !!grupo && m.categoria === categoria && m.grupo === grupo,
      ),
    [materiais, ehTecido, malhaId, grupo, categoria],
  )
  const jaFornecem = useMemo(
    () => [...new Set(vizinhos.flatMap(m => idsDosFornecedores(fornecimento.ligacoes, m.id)))],
    [vizinhos, fornecimento.ligacoes],
  )
  const palpite = jaFornecem[0] ?? ''
  useEffect(() => {
    if (!naMao.current) setFornecedorId(palpite)
  }, [palpite, inicio])

  const malha = malhas?.find(m => m.id === malhaId)
  const cor = cores.find(c => c.id === corId)
  const min = lerNumero(minimo)
  const minimoValido = min === null || (!Number.isNaN(min) && min >= 0)
  const nomeFinal = ehTecido ? (malha && cor ? `${malha.nome} · ${cor.nome}` : '') : nome.trim()
  const pronto = !!nomeFinal && minimoValido && (ehTecido || !!unidade)

  async function criar() {
    if (!pronto || gravando) return
    setGravando(true)
    setFalha('')
    try {
      const novo = {
        categoria,
        nome: nomeFinal,
        unidade: ehTecido ? 'kg' : unidade,
        minimo: min ?? 0,
        tecidoId: ehTecido ? malhaId : undefined,
        corId: ehTecido ? corId : undefined,
        grupo: ehTecido ? undefined : grupo.trim(),
        ondeFica,
      }
      /* o que estava arquivado volta, em vez de bater na trava do nome repetido */
      const voltou = await reativarMaterialArquivado(novo)
      const id = voltou || (await cadastrarMaterial(novo))
      if (!id) throw new Error('O banco não confirmou a gravação do material.')
      if (fornecedorId) await ligarMaterialAoFornecedor(id, fornecedorId)
      /* O LUGAR VAI DEPOIS DO MATERIAL EXISTIR. Se o lugar falhar, o material
         já entrou: a pessoa é avisada e marca pela ficha, em vez de o cadastro
         inteiro parecer que não aconteceu. */
      let semLugar = false
      if (lugares.length) {
        try {
          await definirLugares([id], lugares)
        } catch {
          semLugar = true
        }
      }
      avisar(
        voltou
          ? `${nomeFinal} estava arquivado e voltou para o estoque, com o saldo que tinha.`
          : `${nomeFinal} entrou no estoque, com saldo zero.`,
        'ok',
      )
      if (semLugar) {
        avisar(
          'O material entrou, mas não consegui marcar o lugar dele. Marque pela ficha, em "Onde está guardado".',
          'warn',
          8,
        )
      }
      await aoCriar(id, categoria, ehTecido ? malhaId : '', ehTecido ? '' : grupo.trim())
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui criar o material.')
    } finally {
      setGravando(false)
    }
  }

  return (
    <>
      <Modal
        aberto={!!inicio}
        aoFechar={aoFechar}
        largo={aoLado}
        titulo="Novo material"
        pe={
          <>
            <Botao onClick={aoFechar}>Cancelar</Botao>
            <Botao
              tom="primario"
              onClick={criar}
              disabled={!pronto || gravando || (ehTecido && naFichaDaCor)}
              title={
                ehTecido && naFichaDaCor ? 'Salve ou cancele a cor que está aberta' : undefined
              }
              carregando={gravando}
            >
              {gravando ? 'Criando' : 'Criar material'}
            </Botao>
          </>
        }
      >
        <div className={aoLado ? 'es-novo-lados aberto' : 'es-novo-lados'}>
          <div className="es-novo">
            <p className="es-ajuda">Ele entra com saldo zero. O saldo só muda por movimento.</p>

            <Campo rotulo="Categoria">
              <Segmentado
                className="es-largo"
                valor={categoria}
                aoMudar={c => {
                  setCategoria(c)
                  setUnidade(c === 'tecido' ? 'kg' : 'un')
                  setGrupo('')
                  setGrupoNovo(false)
                }}
                opcoes={CATEGORIAS.map(c => ({ valor: c, rotulo: NOME_DA_CATEGORIA[c] }))}
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
                      opcoes={malhas.map(m => ({ valor: m.id, rotulo: m.nome }))}
                      aoEscolher={v => {
                        setMalhaId(v)
                        setCorId('')
                      }}
                      vazio="Escolha a malha"
                    />
                  </div>
                  <div className="campo">
                    <span className="es-campo-topo">
                      Cor{' '}
                      <small>
                        {malhaId && jaNoEstoque.size
                          ? 'as apagadas já estão no estoque'
                          : 'primeiro a família, depois a cor'}
                      </small>
                    </span>
                    <EscolherCor
                      cores={cores}
                      familias={familias}
                      valor={corId}
                      jaTem={malhaId ? jaNoEstoque : SEM_NENHUMA}
                      aoEscolher={setCorId}
                      podeMexer={podeMexerNasCores}
                      aoMudarCatalogo={relerAsCores}
                      aoAbrirFicha={setNaFichaDaCor}
                    />
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
                    {grupos.map(g => (
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
                      onChange={e => setGrupo(e.currentTarget.value)}
                      placeholder="Linha, Botão, DTF, Embalagem"
                      aria-label="Nome do grupo novo"
                    />
                  ) : null}
                </div>
                <Campo rotulo="Nome do material">
                  <Entrada
                    value={nome}
                    onChange={e => setNome(e.currentTarget.value)}
                    placeholder={
                      categoria === 'aviamento' ? 'Linha poliéster 120 branca' : 'Filme DTF 60 cm'
                    }
                  />
                </Campo>
              </>
            )}

            <div className={guardado.planta ? 'es-novo-tres es-novo-dois' : 'es-novo-tres'}>
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
                    opcoes={UNIDADES.map(u => ({ valor: u, rotulo: u }))}
                    aoEscolher={v => v && setUnidade(v)}
                    vazio="Escolha"
                  />
                </Campo>
              )}
              <Campo
                rotulo={'Mínimo no estoque, em ' + (ehTecido ? 'kg' : unidade)}
                erro={!minimoValido}
              >
                <Entrada
                  inputMode="decimal"
                  value={minimo}
                  onChange={e => setMinimo(e.currentTarget.value)}
                  placeholder="0"
                />
              </Campo>
              {guardado.planta ? null : (
                <Campo rotulo="Onde fica na fábrica">
                  <Entrada
                    value={ondeFica}
                    onChange={e => setOndeFica(e.currentTarget.value)}
                    placeholder="Prateleira, armário ou caixa"
                  />
                </Campo>
              )}
            </div>

            {/* COM O DEPÓSITO DESENHADO, o lugar se aponta no desenho (pedido do
              Henrique, 05/10/2026): o botão abre a planta, a pessoa clica na
              prateleira ou no palete, e o lugar já fica marcado quando o
              material nascer. Sem desenho, vale o texto de sempre, acima. */}
            {guardado.planta ? (
              <div className="campo" data-onde-fica="">
                <span className="es-campo-topo">
                  Onde fica no depósito <small>dá para marcar depois, pela ficha</small>
                </span>
                <div className="es-onde">
                  {lugares.length ? (
                    lugares.map((l, i) => (
                      <EtiquetaDoLugar
                        key={l.movelId + ':' + l.vao + ':' + l.nivel}
                        movel={guardado.planta?.moveis.find(m => m.id === l.movelId)}
                        lugar={l}
                        porExtenso
                        forte={i === 0}
                      />
                    ))
                  ) : (
                    <span className="es-onde-vazio">ainda sem lugar</span>
                  )}
                  <Botao disabled={!nomeFinal} onClick={() => setMarcando(true)}>
                    <MapPin size={16} aria-hidden="true" />
                    {lugares.length ? 'Mudar o lugar' : 'Marcar no depósito'}
                  </Botao>
                </div>
                {!nomeFinal ? (
                  <span className="dica">
                    {ehTecido ? 'Escolha a malha e a cor' : 'Escreva o nome do material'} para
                    marcar o lugar.
                  </span>
                ) : null}
              </div>
            ) : null}

            <p className="es-ajuda">
              O mínimo é quanto tem de ficar no estoque. Quando o livre cai abaixo dele, o material
              aparece em Para comprar e no trilho do que está acabando.
            </p>

            {fornecimento.disponivel ? (
              <div className="campo">
                <span className="es-campo-topo">
                  Fornecedor{' '}
                  {fornecedorId && fornecedorId === palpite ? (
                    <small>
                      sugerido porque já fornece {ehTecido ? 'esta malha' : 'este grupo'}
                    </small>
                  ) : null}
                </span>
                <div className="es-fornecedor-e-novo">
                  <EscolherFornecedor
                    valor={fornecedorId}
                    aoEscolher={id => {
                      naMao.current = true
                      setFornecedorId(id)
                    }}
                    fornecedores={fornecimento.fornecedores}
                    jaFornecem={jaFornecem}
                    tipo={categoria}
                    nomeDoTipo={NOME_DA_CATEGORIA[categoria]}
                    oQue={ehTecido ? 'esta malha' : 'este grupo'}
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
              </div>
            ) : null}

            {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
          </div>
          {aoLado ? (
            <NovoFornecedorAoLado
              tipo={categoria}
              nomeDoTipo={NOME_DA_CATEGORIA[categoria]}
              aoFechar={() => setAoLado(false)}
              aoCriar={async (id, nomeDele) => {
                await aoCriarFornecedor()
                naMao.current = true
                setFornecedorId(id)
                setAoLado(false)
                avisar(`${nomeDele} entrou em Fornecedores e já está escolhido aqui.`, 'ok')
              }}
            />
          ) : null}
        </div>
      </Modal>
      {/* A caixa de apontar o lugar é IRMÃ do cadastro, e não filha: uma caixa
          dentro da outra deixaria o botão principal dela dentro do cadastro
          mesmo fechada. Ela abre por cima, na camada de cima do navegador. */}
      <MarcarLugar
        material={null}
        novo={
          marcando
            ? {
                nome: nomeFinal,
                lugares,
                aoEscolher: escolhidos => {
                  setLugares(escolhidos)
                  setMarcando(false)
                },
              }
            : null
        }
        planta={guardado.planta}
        lugares={guardado.lugares}
        materiais={materiais}
        aoFechar={() => setMarcando(false)}
        aoGravar={async () => undefined}
      />
    </>
  )
}
