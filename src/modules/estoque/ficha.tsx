import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { MapPin, PencilSimple, Plus, X } from '@phosphor-icons/react'
import { Botao } from '@ds'
import { chaveDaCelula, lugarPorExtenso, type Lugar, type Movel } from '@dominio/deposito'
import {
  NOME_DA_CATEGORIA,
  NOME_DO_MOTIVO,
  faltaDoMaterial,
  medidasDoTecido,
  nomeNoGrupo,
  quantoNaUnidade,
  type GrupoNaArvore,
  type Material,
  type Movimento,
  type ReservaEmAberto,
  type TecidoNaArvore,
} from '@dominio/estoque'
import type { Fornecedor } from '@dominio/fornecedor'
import {
  diaEMes,
  fornecedorDoGrupo,
  fornecedorDoMaterial,
  fornecedorProprio,
  linhaDoMovimento,
  lugaresDe,
  plural,
  porQue,
  quandoFoi,
  quantoMexeu,
  type Fornecimento,
  type Guardado,
} from './apoio'
import { Codigo, chaveDoMaterial } from './arvore'
import { EtiquetaDoLugar } from './frente'
import { PlantaDoDeposito, type EstadoDoLugar } from './planta'
import { Bola, VaoDoMaterial } from './vao'

/* ==========================================================================
   A ficha do que foi escolhido: o tecido, ou uma cor (ou um item).

   A do tecido responde "como está este tecido": os quatro números, as cores
   lado a lado na prateleira, de quem vem, onde está e o que andou. A da cor
   responde "quanto tenho desta cor": o livre em número grande, quem reserva,
   onde está guardada e de quem vem.

   O NÚMERO GRANDE É O LIVRE, e não o que está na prateleira: a pergunta de
   quem compra é o que sobra depois da reserva.
   ========================================================================== */

function Caixa({
  titulo,
  direita,
  solta,
  children,
}: {
  titulo: string
  direita?: ReactNode
  /** as linhas encostam nas bordas: é a caixa de lista */
  solta?: boolean
  children: ReactNode
}) {
  return (
    <section className="cartao em-col">
      <div className="em-topo">
        <h3 className="cartao-titulo">
          <span className="marca" />
          {titulo}
        </h3>
        {direita}
      </div>
      {solta ? children : <div className="em-corpo">{children}</div>}
    </section>
  )
}

function Topo({
  trilha,
  titulo,
  sub,
  podeEditar,
  noCelular,
  aoEditar,
  aoMovimentar,
  aoFechar,
  acoes,
}: {
  trilha: ReactNode
  titulo: ReactNode
  sub: string
  podeEditar: boolean
  /** no celular o nome e a volta estão no topo da página: aqui ficam a trilha e os botões */
  noCelular: boolean
  aoEditar: () => void
  aoMovimentar: () => void
  aoFechar: () => void
  /** no lugar de Editar e Registrar movimento, para a ficha que não tem o que editar nem movimentar */
  acoes?: ReactNode
}) {
  return (
    <div className="em-ficha-topo">
      <div className="em-ficha-nome">
        <div className="em-trilha">{trilha}</div>
        {noCelular ? null : (
          <>
            <h2>{titulo}</h2>
            {sub ? <p>{sub}</p> : null}
          </>
        )}
      </div>
      {podeEditar || !noCelular ? (
        <div className="fileira">
          {!podeEditar ? null : acoes !== undefined ? (
            acoes
          ) : (
            <>
              <Botao onClick={aoEditar}>
                <PencilSimple size={16} aria-hidden="true" />
                Editar
              </Botao>
              <Botao tom="primario" onClick={aoMovimentar}>
                Registrar movimento
              </Botao>
            </>
          )}
          {noCelular ? null : (
            <Botao onClick={aoFechar}>
              <X size={16} aria-hidden="true" />
              Fechar
            </Botao>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* o que andou: uma linha por movimento, o mais novo primeiro */
function OQueAndou({
  movimentos,
  rotulo,
  apoio,
  aoVerTodos,
}: {
  movimentos: Movimento[]
  /** o que vai em negrito na linha */
  rotulo: (v: Movimento) => string
  /** a linha miúda de baixo */
  apoio: (v: Movimento) => string
  aoVerTodos: () => void
}) {
  return (
    <Caixa
      titulo="O que andou"
      solta
      direita={
        movimentos.length > 5 ? (
          <button type="button" className="em-ver-todos" onClick={aoVerTodos}>
            Ver todos
          </button>
        ) : undefined
      }
    >
      {movimentos.length === 0 ? (
        <p className="em-sem-linhas">Nada entrou nem saiu ainda.</p>
      ) : (
        movimentos.slice(0, 5).map(v => (
          <div key={v.id} className="em-lin">
            <span className="em-txt">
              <b>{rotulo(v)}</b>
              <small>{apoio(v)}</small>
            </span>
            <span className={v.quantidade > 0 ? 'em-val entrou' : 'em-val'}>{quantoMexeu(v)}</span>
          </div>
        ))
      )}
    </Caixa>
  )
}

/* A planta miúda: só os lugares do que foi escolhido ficam acesos. */
function PlantaMiuda({
  guardado,
  acesos,
  estado,
}: {
  guardado: Guardado
  /** as chaves dos lugares acesos */
  acesos: string[]
  estado: EstadoDoLugar
}) {
  const estados = useMemo(() => {
    const e = new Map<string, EstadoDoLugar>()
    if (!guardado.planta) return e
    for (const mv of guardado.planta.moveis) {
      if (mv.tipo === 'prateleira') {
        for (let v = 1; v <= mv.vaos; v++) e.set(chaveDaCelula(mv.id, v), 'apagado')
      } else if (mv.tipo === 'palete') {
        e.set(chaveDaCelula(mv.id, null), 'apagado')
      }
    }
    for (const chave of acesos) e.set(chave, estado)
    return e
  }, [guardado.planta, acesos, estado])
  if (!guardado.planta) return null
  return (
    <div className="em-planta">
      <PlantaDoDeposito planta={guardado.planta} maxima={22} medidas={false} estados={estados} />
    </div>
  )
}

/* ==========================================================================
   A FICHA DO TECIDO
   ========================================================================== */
export function FichaDoTecido({
  tecido,
  grupo,
  movimentos,
  reservas,
  fornecimento,
  guardado,
  podeEditar,
  noCelular,
  aoEditar,
  aoMovimentar,
  aoFechar,
  aoEscolher,
  aoNovaCor,
  aoVerNoDeposito,
  aoVerFornecedor,
  aoVerMovimentos,
}: {
  tecido: TecidoNaArvore
  grupo: GrupoNaArvore | null
  movimentos: Movimento[]
  reservas: ReservaEmAberto[]
  fornecimento: Fornecimento
  guardado: Guardado
  podeEditar: boolean
  noCelular: boolean
  aoEditar: () => void
  aoMovimentar: (m: Material) => void
  aoFechar: () => void
  aoEscolher: (chave: string) => void
  aoNovaCor: () => void
  aoVerNoDeposito: (ids: string[], rotulo: string) => void
  aoVerFornecedor: (f: Fornecedor | null) => void
  aoVerMovimentos: () => void
}) {
  const porId = new Map(tecido.cores.map(m => [m.id, m]))
  const unidade = tecido.doEstoque.unidade || 'kg'
  const pedidos = new Set(reservas.map(r => r.pedidoId)).size
  const comprar = tecido.cores
    .filter(m => m.livre < m.minimo)
    .sort((a, b) => a.livre / (a.minimo || 1) - b.livre / (b.minimo || 1))
  const doTecido = fornecedorDoGrupo(tecido.doEstoque, fornecimento)
  const deOutro = tecido.cores
    .map(m => ({ m, f: fornecedorProprio(m, doTecido, fornecimento) }))
    .filter((x): x is { m: Material; f: Fornecedor } => !!x.f)
  const semNenhum = tecido.cores.filter(m => !fornecedorDoMaterial(m, fornecimento)).length

  /* onde está: um lugar do desenho por linha, com as cores que ele guarda */
  const lugares = useMemo(() => {
    const porLugar = new Map<
      string,
      { movel: Movel; lugar: Lugar; cores: Set<string>; niveis: Set<number> }
    >()
    for (const m of tecido.cores) {
      for (const { lugar, movel } of lugaresDe(guardado, m.id)) {
        const vao = movel.tipo === 'prateleira' ? lugar.vao : null
        const chave = chaveDaCelula(movel.id, vao)
        const ja = porLugar.get(chave) ?? {
          movel,
          lugar: { movelId: movel.id, vao, nivel: null },
          cores: new Set<string>(),
          niveis: new Set<number>(),
        }
        ja.cores.add(m.id)
        if (lugar.nivel) ja.niveis.add(lugar.nivel)
        porLugar.set(chave, ja)
      }
    }
    return [...porLugar.entries()]
      .map(([chave, v]) => ({ chave, ...v }))
      .sort((a, b) => b.cores.size - a.cores.size)
  }, [tecido.cores, guardado])
  const comLugar = tecido.cores.filter(m => lugaresDe(guardado, m.id).length > 0)

  /* O TECIDO DO CATÁLOGO QUE AINDA NÃO TEM COR NO ESTOQUE. Não há número,
     movimento nem lugar para mostrar: a ficha diz isso e convida a cadastrar a
     primeira cor. Editar e Registrar movimento saem, porque os dois mexem em
     material, e aqui ainda não há nenhum. */
  if (tecido.cores.length === 0) {
    const novaCor = (
      <Botao tom="primario" onClick={aoNovaCor}>
        <Plus size={16} aria-hidden="true" />
        Nova cor
      </Botao>
    )
    return (
      <div className="em-ficha" data-ficha="tecido" data-sem-estoque="">
        <Topo
          trilha={
            <>
              <Codigo cod={grupo?.cod ?? ''} />
              {grupo?.nome ?? 'Tecido'}
              <span aria-hidden="true">›</span>
              tecido
            </>
          }
          titulo={tecido.nome}
          sub={['sem estoque', medidasDoTecido(tecido)].filter(Boolean).join(' · ')}
          podeEditar={podeEditar}
          noCelular={noCelular}
          aoEditar={aoEditar}
          aoMovimentar={aoNovaCor}
          aoFechar={aoFechar}
          acoes={novaCor}
        />
        <div className="em-metades">
          <div className="pilha larga">
            <section className="cartao em-col">
              <div className="em-topo">
                <h3 className="cartao-titulo">
                  <span className="marca" />
                  As cores deste tecido
                </h3>
              </div>
              <div className="em-corpo">
                <p className="em-nota">
                  Este tecido está no catálogo, mas nenhuma cor dele foi cadastrada no estoque.
                  {podeEditar
                    ? ' A cor nova entra com saldo zero; a entrada de material é que põe o saldo.'
                    : ''}
                </p>
              </div>
              {podeEditar ? (
                <div className="em-grade-cores">
                  <button type="button" className="em-cor-nova" onClick={aoNovaCor}>
                    <Plus size={18} aria-hidden="true" />
                    Nova cor
                  </button>
                </div>
              ) : null}
            </section>
          </div>
          <div className="pilha larga">
            {fornecimento.disponivel ? (
              <Caixa titulo="Fornecedor">
                <div className="em-campo">
                  <span>Fornecedor do tecido</span>
                  <div className="em-fornecedor">
                    <b className="em-falta">Falta escolher</b>
                  </div>
                </div>
                <p className="em-nota">
                  Sem cor no estoque, ainda não há de quem veio. A entrada de material pergunta o
                  fornecedor.
                </p>
              </Caixa>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="em-ficha" data-ficha="tecido">
      <Topo
        trilha={
          <>
            <Codigo cod={grupo?.cod ?? ''} />
            {grupo?.nome ?? 'Tecido'}
            <span aria-hidden="true">›</span>
            tecido
          </>
        }
        titulo={tecido.nome}
        sub={[plural(tecido.cores.length, 'cor', 'cores'), medidasDoTecido(tecido)]
          .filter(Boolean)
          .join(' · ')}
        podeEditar={podeEditar}
        noCelular={noCelular}
        aoEditar={aoEditar}
        aoMovimentar={() => aoMovimentar(tecido.cores[0])}
        aoFechar={aoFechar}
      />

      <div className="em-nums">
        <div className="cartao em-num">
          <span>Livre</span>
          <b>{quantoNaUnidade(tecido.livre, unidade)}</b>
          <small>
            {tecido.cores.length === 1 ? 'em 1 cor' : 'nas ' + tecido.cores.length + ' cores'}
          </small>
        </div>
        <div className="cartao em-num">
          <span>Na prateleira</span>
          <b>{quantoNaUnidade(tecido.saldo, unidade)}</b>
        </div>
        <div className="cartao em-num">
          <span>Reservado</span>
          <b>{quantoNaUnidade(tecido.reservado, unidade)}</b>
          <small>
            {pedidos ? 'para ' + plural(pedidos, 'pedido', 'pedidos') : 'nenhum pedido reservando'}
          </small>
        </div>
        <div className="cartao em-num">
          <span>Para comprar</span>
          <b className={comprar.length ? 'pouco' : ''}>
            {comprar.length ? plural(comprar.length, 'cor', 'cores') : 'nada'}
          </b>
          {comprar.length ? (
            <small>
              {nomeNoGrupo(comprar[0])}, {faltaDoMaterial(comprar[0]) === 1 ? 'falta' : 'faltam'}{' '}
              {quantoNaUnidade(faltaDoMaterial(comprar[0]), comprar[0].unidade)}
              {comprar.length > 1 ? ' e mais ' + (comprar.length - 1) : ''}
            </small>
          ) : (
            <small>todas acima do mínimo</small>
          )}
        </div>
      </div>

      <div className="em-metades">
        <div className="pilha larga">
          <section className="cartao em-col">
            <div className="em-topo">
              <h3 className="cartao-titulo">
                <span className="marca" />
                As cores deste tecido
              </h3>
              <span className="em-topo-nota">a altura é o livre · o risco é o mínimo</span>
            </div>
            <div className="em-grade-cores">
              {tecido.cores.map(m => {
                const lugar = lugaresDe(guardado, m.id)[0]
                return (
                  <button
                    type="button"
                    key={m.id}
                    className="em-cor-col"
                    data-cor={m.cor || m.nome}
                    onClick={() => aoEscolher(chaveDoMaterial(m.id))}
                  >
                    <VaoDoMaterial m={m} />
                    <b className={m.livre < m.minimo ? 'pouco' : ''}>
                      {quantoNaUnidade(m.livre, m.unidade)}
                    </b>
                    <span className="em-cor-nome">{nomeNoGrupo(m)}</span>
                    {guardado.planta ? (
                      <EtiquetaDoLugar movel={lugar?.movel} lugar={lugar?.lugar} />
                    ) : null}
                  </button>
                )
              })}
              {podeEditar ? (
                <button type="button" className="em-cor-nova" onClick={aoNovaCor}>
                  <Plus size={18} aria-hidden="true" />
                  Nova cor
                </button>
              ) : null}
            </div>
          </section>

          <OQueAndou
            movimentos={movimentos}
            rotulo={v => {
              const m = porId.get(v.materialId)
              return m ? nomeNoGrupo(m) : v.material
            }}
            apoio={linhaDoMovimento}
            aoVerTodos={aoVerMovimentos}
          />
        </div>

        <div className="pilha larga">
          {fornecimento.disponivel ? (
            <Caixa titulo="Fornecedor">
              <div className="em-campo">
                <span>Fornecedor do tecido</span>
                <div className="em-fornecedor">
                  {doTecido ? <b>{doTecido.nome}</b> : <b className="em-falta">Falta escolher</b>}
                  {doTecido ? (
                    <Botao tamanho="sm" onClick={() => aoVerFornecedor(doTecido)}>
                      Ver fornecedor
                    </Botao>
                  ) : podeEditar ? (
                    <Botao tamanho="sm" onClick={aoEditar}>
                      Escolher
                    </Botao>
                  ) : null}
                </div>
              </div>
              <p className="em-nota">
                {doTecido
                  ? semNenhum
                    ? `${plural(semNenhum, 'cor está', 'cores estão')} sem fornecedor marcado.`
                    : 'Todas as cores têm fornecedor marcado.'
                  : semNenhum === tecido.cores.length
                    ? 'Nenhuma cor deste tecido tem fornecedor. A entrada de material pergunta de quem veio.'
                    : `${plural(semNenhum, 'cor está', 'cores estão')} sem fornecedor marcado.`}
              </p>
              {deOutro.map(({ m, f }) => (
                <div key={m.id} className="em-mat">
                  <Bola cor={m.corHex} />
                  <span className="em-txt">
                    <b>{nomeNoGrupo(m)} vem de outro fornecedor</b>
                    <small>{f.nome}</small>
                  </span>
                  <span className="em-marca">só esta cor</span>
                </div>
              ))}
            </Caixa>
          ) : null}

          <Caixa
            titulo="Onde está"
            direita={
              lugares.length ? (
                <Botao
                  tamanho="sm"
                  onClick={() =>
                    aoVerNoDeposito(
                      comLugar.map(m => m.id),
                      tecido.nome,
                    )
                  }
                >
                  <MapPin size={15} aria-hidden="true" />
                  Ver no depósito
                </Botao>
              ) : undefined
            }
          >
            {!guardado.planta ? (
              <p className="em-nota">
                O depósito ainda não foi desenhado. Depois de desenhado, cada cor ganha o seu lugar
                no mapa.
              </p>
            ) : lugares.length === 0 ? (
              <p className="em-nota">
                Nenhuma cor deste tecido tem lugar marcado. O lugar se marca na ficha de cada cor.
              </p>
            ) : (
              <>
                <PlantaMiuda
                  guardado={guardado}
                  acesos={lugares.map(l => l.chave)}
                  estado="aberto"
                />
                {lugares.map(l => {
                  const niveis = [...l.niveis].sort((a, b) => a - b)
                  return (
                    <div key={l.chave} className="em-mat">
                      <EtiquetaDoLugar movel={l.movel} lugar={l.lugar} forte semIcone />
                      <span className="em-txt">
                        <b>{lugarPorExtenso(l.movel, l.lugar.vao, null)}</b>
                        <small>
                          {l.cores.size === tecido.cores.length && tecido.cores.length > 1
                            ? 'as ' + l.cores.size + ' cores'
                            : [...l.cores]
                                .map(id => porId.get(id))
                                .filter((m): m is Material => !!m)
                                .map(nomeNoGrupo)
                                .join(', ')}
                          {niveis.length > 1
                            ? `, do nível ${niveis[0]} ao ${niveis[niveis.length - 1]}`
                            : niveis.length === 1
                              ? ', nível ' + niveis[0]
                              : ''}
                        </small>
                      </span>
                    </div>
                  )
                })}
                {comLugar.length < tecido.cores.length ? (
                  <p className="em-nota">
                    {plural(
                      tecido.cores.length - comLugar.length,
                      'cor ainda está',
                      'cores ainda estão',
                    )}{' '}
                    sem lugar marcado.
                  </p>
                ) : null}
              </>
            )}
          </Caixa>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   A FICHA DA COR, que também é a do item de aviamento ou de insumo
   ========================================================================== */
export function FichaDoMaterial({
  m,
  tecido,
  grupo,
  movimentos,
  reservas,
  fornecimento,
  guardado,
  podeEditar,
  noCelular,
  aoEditar,
  aoMovimentar,
  aoFechar,
  aoEscolher,
  aoMarcar,
  aoVerNoDeposito,
  aoVerFornecedor,
  aoVerMovimentos,
}: {
  m: Material
  /** o tecido da cor; nulo no aviamento e no insumo */
  tecido: TecidoNaArvore | null
  grupo: GrupoNaArvore | null
  movimentos: Movimento[]
  reservas: ReservaEmAberto[]
  fornecimento: Fornecimento
  guardado: Guardado
  podeEditar: boolean
  noCelular: boolean
  aoEditar: () => void
  aoMovimentar: (m: Material) => void
  aoFechar: () => void
  aoEscolher: (chave: string) => void
  aoMarcar: (m: Material, outroLugar: boolean) => void
  aoVerNoDeposito: (ids: string[], rotulo: string) => void
  aoVerFornecedor: (f: Fornecedor | null) => void
  aoVerMovimentos: () => void
}) {
  const comprar = m.livre < m.minimo
  const falta = faltaDoMaterial(m)
  const lugares = lugaresDe(guardado, m.id)
  const dele = fornecedorDoMaterial(m, fornecimento)
  const doTecido = tecido ? fornecedorDoGrupo(tecido.doEstoque, fornecimento) : null
  const soEsta = !!tecido && !!dele && dele.id !== doTecido?.id
  const nome = nomeNoGrupo(m)

  return (
    <div className="em-ficha" data-ficha="material">
      <Topo
        trilha={
          tecido ? (
            <>
              <Codigo cod={grupo?.cod ?? ''} />
              {grupo?.nome ?? 'Tecido'}
              <span aria-hidden="true">›</span>
              <button
                type="button"
                className="em-trilha-volta"
                onClick={() => aoEscolher(tecido.chave)}
              >
                {tecido.nome}
              </button>
              <span aria-hidden="true">›</span>
              cor
            </>
          ) : (
            <>
              {NOME_DA_CATEGORIA[m.categoria]}
              {m.grupo ? (
                <>
                  <span aria-hidden="true">›</span>
                  {m.grupo}
                </>
              ) : null}
              <span aria-hidden="true">›</span>
              item
            </>
          )
        }
        titulo={
          <>
            {m.categoria === 'tecido' ? <Bola cor={m.corHex} /> : null}
            {nome}
            {comprar ? <span className="em-marca alerta">comprar</span> : null}
          </>
        }
        sub={
          tecido
            ? [tecido.nome, medidasDoTecido(tecido)].filter(Boolean).join(' · ')
            : m.ondeFica
              ? 'anotado no cadastro: ' + m.ondeFica
              : ''
        }
        podeEditar={podeEditar}
        noCelular={noCelular}
        aoEditar={aoEditar}
        aoMovimentar={() => aoMovimentar(m)}
        aoFechar={aoFechar}
      />

      <div className="em-metades">
        <div className="pilha larga">
          <section className="cartao em-heroi">
            <VaoDoMaterial m={m} />
            <div className="em-heroi-texto">
              <span className="em-heroi-sobre">Livre, já tirando o que está reservado</span>
              <span className={comprar ? 'em-heroi-numero pouco' : 'em-heroi-numero'}>
                {quantoNaUnidade(m.livre, m.unidade)}
              </span>
              <div className="em-heroi-linha">
                <span>
                  na prateleira <b>{quantoNaUnidade(m.saldo, m.unidade)}</b>
                </span>
                <span>
                  reservado <b>{quantoNaUnidade(m.reservado, m.unidade)}</b>
                </span>
                <span>
                  mínimo <b>{quantoNaUnidade(m.minimo, m.unidade)}</b>
                </span>
                {comprar ? (
                  <span className="pouco">
                    {falta === 1 ? 'falta' : 'faltam'} <b>{quantoNaUnidade(falta, m.unidade)}</b>
                  </span>
                ) : null}
              </div>
              {m.reservaSemConsumo ? (
                <span className="em-nota">Há pedido reservando sem consumo cadastrado.</span>
              ) : null}
            </div>
          </section>

          <Caixa
            titulo="Reservas em aberto"
            solta
            direita={
              reservas.length ? (
                <span className="em-topo-n">
                  {plural(new Set(reservas.map(r => r.pedidoId)).size, 'pedido', 'pedidos')}
                </span>
              ) : undefined
            }
          >
            {reservas.length === 0 ? (
              <p className="em-sem-linhas">
                {m.reservado > 0
                  ? 'Há reserva, e a lista dos pedidos não veio.'
                  : 'Nada reservado.'}
              </p>
            ) : (
              reservas.slice(0, 6).map(r => (
                <div key={r.id} className="em-lin">
                  <span className="em-txt">
                    <b>{r.pedido}</b>
                    <small>
                      {r.entrega
                        ? 'entrega ' + diaEMes(r.entrega + 'T12:00:00')
                        : 'sem data de entrega'}
                      {r.semConsumo ? ' · sem consumo cadastrado' : ''}
                    </small>
                  </span>
                  <span className="em-val">{quantoNaUnidade(r.quantidade, r.unidade)}</span>
                </div>
              ))
            )}
          </Caixa>

          <OQueAndou
            movimentos={movimentos}
            rotulo={v => [NOME_DO_MOTIVO[v.motivo], porQue(v)].filter(Boolean).join(' · ')}
            apoio={v =>
              [quandoFoi(v.quando), v.quem ? 'por ' + v.quem : ''].filter(Boolean).join(' · ')
            }
            aoVerTodos={aoVerMovimentos}
          />
        </div>

        <div className="pilha larga">
          <Caixa titulo="Onde está guardado">
            {!guardado.planta ? (
              <p className="em-nota">
                O depósito ainda não foi desenhado. Depois de desenhado, é aqui que se marca o lugar
                deste material.
              </p>
            ) : (
              <>
                <div className="fileira dentro">
                  {lugares.length ? (
                    lugares.map(({ lugar, movel }, i) => (
                      <EtiquetaDoLugar
                        key={lugar.id}
                        movel={movel}
                        lugar={lugar}
                        porExtenso
                        forte={i === 0}
                      />
                    ))
                  ) : (
                    <EtiquetaDoLugar />
                  )}
                </div>
                {lugares.length ? (
                  <PlantaMiuda
                    guardado={guardado}
                    acesos={lugares.map(({ lugar, movel }) =>
                      chaveDaCelula(movel.id, movel.tipo === 'prateleira' ? lugar.vao : null),
                    )}
                    estado="achado"
                  />
                ) : null}
                <div className="fileira">
                  {podeEditar ? (
                    <>
                      <Botao tom="forte" onClick={() => aoMarcar(m, false)}>
                        <MapPin size={16} aria-hidden="true" />
                        {lugares.length ? 'Mudar o lugar' : 'Marcar no mapa'}
                      </Botao>
                      {lugares.length ? (
                        <Botao onClick={() => aoMarcar(m, true)}>
                          <Plus size={16} aria-hidden="true" />
                          Outro lugar
                        </Botao>
                      ) : null}
                    </>
                  ) : null}
                  {lugares.length ? (
                    <Botao
                      onClick={() =>
                        aoVerNoDeposito([m.id], tecido ? tecido.nome + ' · ' + nome : nome)
                      }
                    >
                      Ver no depósito
                    </Botao>
                  ) : null}
                </div>
                <p className="em-nota">
                  O primeiro lugar é o principal: é ele que aparece na lista e na Separação. A cor
                  do quadradinho é a do nível da prateleira.
                </p>
              </>
            )}
          </Caixa>

          {fornecimento.disponivel ? (
            <Caixa titulo="Fornecedor">
              <div className="em-campo">
                <span>{tecido ? 'Fornecedor desta cor' : 'Fornecedor deste item'}</span>
                <div className="em-fornecedor">
                  {dele ? (
                    <b>
                      {dele.nome}
                      {soEsta ? <span className="em-marca">só esta cor</span> : null}
                    </b>
                  ) : (
                    <b className="em-falta">Falta escolher</b>
                  )}
                  {dele ? (
                    <Botao tamanho="sm" onClick={() => aoVerFornecedor(dele)}>
                      Ver fornecedor
                    </Botao>
                  ) : podeEditar ? (
                    <Botao tamanho="sm" onClick={aoEditar}>
                      Escolher
                    </Botao>
                  ) : null}
                </div>
              </div>
              <p className="em-nota">
                {tecido
                  ? soEsta
                    ? doTecido
                      ? `O tecido ${tecido.nome} vem de ${doTecido.nome}. Esta cor vem de outro.`
                      : `O tecido ${tecido.nome} ainda não tem fornecedor escolhido. Esta cor tem o dela.`
                    : dele
                      ? 'É o mesmo fornecedor do tecido.'
                      : 'A entrada de material pergunta de quem veio, e o fornecedor fica marcado.'
                  : dele
                    ? 'Quem entregou uma vez vira fornecedor do item.'
                    : 'A entrada de material pergunta de quem veio, e o fornecedor fica marcado.'}
              </p>
            </Caixa>
          ) : null}
        </div>
      </div>
    </div>
  )
}
