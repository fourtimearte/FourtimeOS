import { useEffect, useMemo, useState } from 'react'
import { Plus, Star, X } from '@phosphor-icons/react'
import { Aviso, Botao, Campo, Entrada, Modal, avisar } from '@ds'
import {
  celulasDaPlanta,
  chaveDaCelula,
  codigoDoLugar,
  definirLugares,
  lugarPeloCodigo,
  lugarPorExtenso,
  lugaresDoMaterial,
  type Celula,
  type Lugar,
  type LugarDoMaterial,
  type Planta,
} from '@dominio/deposito'
import type { Material } from '@dominio/estoque'
import { LegendaDoMapa, nomeEmDuas } from './deposito'
import { EtiquetaDoLugar, FrenteDaPrateleira, Grupo } from './frente'
import { PlantaDoDeposito, type EstadoDoLugar, type Ocupacao } from './planta'

/* ==========================================================================
   Marcar onde o material está.

   A pessoa clica no lugar do desenho. Se for prateleira, a prateleira aparece
   vista de frente e ela escolhe o vão e o nível. Quem já sabe o código escreve
   ("D2-3", "P07") e o desenho acompanha.

   UM MATERIAL PODE ESTAR EM MAIS DE UM LUGAR. O primeiro da lista é o
   principal: é o que a lista do estoque e a separação mostram. O que não coube
   na prateleira e foi para um palete entra como "outro lugar".

   NADA É GRAVADO ANTES DO BOTÃO. A caixa mexe numa cópia; Cancelar devolve
   tudo como estava.
   ========================================================================== */

const MAXIMO_DE_LUGARES = 6

function mesmoLugar(a: Lugar | null, b: Lugar | null): boolean {
  if (!a || !b) return a === b
  return a.movelId === b.movelId && a.vao === b.vao && a.nivel === b.nivel
}

export function MarcarLugar({
  material,
  planta,
  lugares,
  materiais,
  outroLugar: comOutroLugar,
  tambem,
  novo,
  aoFechar,
  aoGravar,
}: {
  material: Material | null
  /** abre já pedindo um lugar a mais, além dos que o material tem */
  outroLugar?: boolean
  /** o lote da tabela: os outros materiais que vão para o mesmo lugar */
  tambem?: Material[]
  /** O MATERIAL QUE AINDA NÃO EXISTE (o cadastro de cor nova): a caixa só
      escolhe o lugar e devolve; quem grava é o cadastro, depois de criar o
      material. Nada vai para o banco daqui. */
  novo?: { nome: string; lugares: Lugar[]; aoEscolher: (lugares: Lugar[]) => void } | null
  planta: Planta | null
  lugares: LugarDoMaterial[]
  materiais: Material[]
  aoFechar: () => void
  aoGravar: () => Promise<void>
}) {
  /* null é o lugar que a pessoa pediu ("outro lugar") e ainda não apontou */
  const [lista, setLista] = useState<(Lugar | null)[]>([])
  const [atual, setAtual] = useState(0)
  const [codigo, setCodigo] = useState('')
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')

  /* NO LOTE a caixa abre vazia: cada material tem hoje o seu lugar, e o que
     for marcado aqui passa a ser o lugar de todos. */
  const todos = useMemo(() => (material ? [material, ...(tambem ?? [])] : []), [material, tambem])
  const emLote = todos.length > 1
  const chave = novo ? 'novo:' + JSON.stringify(novo.lugares) : todos.map(m => m.id).join(',')
  const deAntes = useMemo(
    () =>
      novo
        ? novo.lugares
        : material && !emLote
          ? lugaresDoMaterial(lugares, material.id).map(l => ({
              movelId: l.movelId,
              vao: l.vao,
              nivel: l.nivel,
            }))
          : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [material, lugares, emLote, chave],
  )
  useEffect(() => {
    if (!material && !novo) return
    const comMaisUm = !!comOutroLugar && deAntes.length > 0 && deAntes.length < MAXIMO_DE_LUGARES
    setLista(deAntes.length ? (comMaisUm ? [...deAntes, null] : deAntes) : [null])
    setAtual(comMaisUm ? deAntes.length : 0)
    setCodigo('')
    setFalha('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  const moveis = useMemo(() => new Map((planta?.moveis ?? []).map(m => [m.id, m])), [planta])
  const celulas = useMemo(() => (planta ? celulasDaPlanta(planta) : []), [planta])
  const porId = useMemo(() => new Map(materiais.map(m => [m.id, m])), [materiais])

  /* o que já está guardado em cada lugar, sem contar este material */
  const { ocupacao, porCasa } = useMemo(() => {
    const o: Ocupacao = new Map()
    const casas = new Map<string, Material[]>()
    const destes = new Set(todos.map(m => m.id))
    for (const l of lugares) {
      if (destes.has(l.materialId)) continue
      const m = porId.get(l.materialId)
      if (!m) continue
      const chave = chaveDaCelula(l.movelId, l.vao)
      const ja = o.get(chave)
      o.set(chave, {
        quantos: (ja?.quantos ?? 0) + 1,
        comprar: !!ja?.comprar || m.livre < m.minimo,
      })
      const casa = l.movelId + '|' + (l.vao ?? 0) + ':' + (l.nivel ?? 0)
      casas.set(casa, [...(casas.get(casa) ?? []), m])
    }
    return { ocupacao: o, porCasa: casas }
  }, [lugares, todos, porId])

  const lugarAtual = lista[atual] ?? null
  const movelAtual = lugarAtual ? (moveis.get(lugarAtual.movelId) ?? null) : null
  const validos = lista.filter((l): l is Lugar => !!l && moveis.has(l.movelId))
  const mudou = emLote
    ? validos.length > 0
    : validos.length !== deAntes.length ||
      validos.some((l, i) => !mesmoLugar(l, deAntes[i] ?? null))

  /* o campo do código acompanha o lugar apontado */
  useEffect(() => {
    setCodigo(
      lugarAtual && movelAtual ? codigoDoLugar(movelAtual, lugarAtual.vao, lugarAtual.nivel) : '',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, lugarAtual?.movelId, lugarAtual?.vao, lugarAtual?.nivel])

  function trocarAtual(novo: Lugar) {
    setFalha('')
    setLista(antes => {
      const repetido = antes.findIndex((l, i) => i !== atual && mesmoLugar(l, novo))
      if (repetido >= 0) {
        setAtual(repetido > atual && antes[atual] === null ? repetido - 1 : repetido)
        /* o lugar já está na lista: em vez de repetir, some o que estava vazio */
        return antes[atual] === null ? antes.filter((_, i) => i !== atual) : antes
      }
      const copia = [...antes]
      copia[Math.min(atual, copia.length)] = novo
      return copia
    })
  }

  function aoAbrir(c: Celula) {
    const mesmoMovel = lugarAtual?.movelId === c.movelId && lugarAtual.vao === c.vao
    trocarAtual({ movelId: c.movelId, vao: c.vao, nivel: mesmoMovel ? lugarAtual.nivel : null })
  }

  function aoEscrever(texto: string) {
    setCodigo(texto)
    if (!planta) return
    const achado = lugarPeloCodigo(planta, texto)
    if (achado) trocarAtual(achado)
  }

  function outroLugar() {
    if (lista.length >= MAXIMO_DE_LUGARES) return
    const vazio = lista.findIndex(l => l === null)
    if (vazio >= 0) {
      setAtual(vazio)
      return
    }
    setLista([...lista, null])
    setAtual(lista.length)
  }

  function tirar(i: number) {
    const copia = lista.filter((_, k) => k !== i)
    setLista(copia.length ? copia : [null])
    setAtual(Math.max(0, Math.min(atual > i ? atual - 1 : atual, copia.length - 1)))
  }

  function tornarPrincipal(i: number) {
    const l = lista[i]
    if (!l || i === 0) return
    setLista([l, ...lista.filter((_, k) => k !== i)])
    setAtual(0)
  }

  async function gravar() {
    if (novo) {
      /* o material ainda não existe: devolve a escolha, sem gravar nada */
      if (mudou) novo.aoEscolher(validos)
      return
    }
    if (!material || gravando || !mudou) return
    setGravando(true)
    setFalha('')
    try {
      await definirLugares(
        todos.map(m => m.id),
        validos,
      )
      avisar(
        emLote
          ? `Lugar marcado em ${todos.length} materiais.`
          : validos.length
            ? 'Lugar marcado.'
            : 'O material ficou sem lugar marcado.',
        'ok',
      )
      await aoGravar()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui marcar o lugar.')
    } finally {
      setGravando(false)
    }
  }

  const estados = useMemo(() => {
    const e = new Map<string, EstadoDoLugar>()
    const chaveAtual = lugarAtual ? chaveDaCelula(lugarAtual.movelId, lugarAtual.vao) : ''
    for (const c of celulas)
      e.set(c.chave, c.chave === chaveAtual ? 'aberto' : ocupacao.has(c.chave) ? 'tem' : 'vazio')
    return e
  }, [celulas, lugarAtual, ocupacao])
  const marcadores = useMemo(() => {
    const chaves: string[] = []
    for (const l of validos) {
      const chave = chaveDaCelula(l.movelId, l.vao)
      if (!chaves.includes(chave)) chaves.push(chave)
    }
    return chaves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, moveis])

  const [em, baixo] = material ? nomeEmDuas(material) : ['', '']
  const titulo = novo
    ? `Onde vai ficar ${novo.nome}?`
    : emLote
      ? `Onde estão os ${todos.length} materiais?`
      : material
        ? 'Onde está ' +
          [em, material.categoria === 'tecido' ? baixo : ''].filter(Boolean).join(' · ') +
          '?'
        : ''

  /* o que mais está guardado na casa apontada */
  const vizinhos =
    lugarAtual && movelAtual
      ? (porCasa.get(
          lugarAtual.movelId + '|' + (lugarAtual.vao ?? 0) + ':' + (lugarAtual.nivel ?? 0),
        ) ?? [])
      : []
  const guardados = useMemo(() => {
    const g = new Map<string, Material[]>()
    if (!movelAtual || movelAtual.tipo !== 'prateleira') return g
    for (const [casa, ms] of porCasa) {
      const [id, resto] = casa.split('|')
      if (id === movelAtual.id) g.set(resto, ms)
    }
    return g
  }, [porCasa, movelAtual])

  const rodape =
    lugarAtual && movelAtual
      ? vizinhos.length
        ? `Em ${lugarPorExtenso(movelAtual, lugarAtual.vao, lugarAtual.nivel)} também ${vizinhos.length === 1 ? 'está' : 'estão'}: ${vizinhos
            .slice(0, 3)
            .map(m => nomeEmDuas(m).filter(Boolean).join(' · '))
            .join(', ')}${vizinhos.length > 3 ? ' e mais ' + (vizinhos.length - 3) : ''}.`
        : `Em ${lugarPorExtenso(movelAtual, lugarAtual.vao, lugarAtual.nivel)} hoje não tem mais nada guardado.`
      : 'Clique no lugar do desenho onde o material está.'

  return (
    <Modal
      aberto={!!material || !!novo}
      aoFechar={aoFechar}
      largo
      titulo={titulo}
      pe={
        <>
          <p className="dp-nota dp-no-pe">{rodape}</p>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            tom="primario"
            onClick={gravar}
            disabled={!mudou || gravando}
            carregando={gravando}
          >
            {gravando
              ? 'Marcando'
              : validos.length || !deAntes.length
                ? novo
                  ? 'Usar este lugar'
                  : 'Marcar aqui'
                : 'Deixar sem lugar'}
          </Botao>
        </>
      }
    >
      {(material || novo) && planta ? (
        <div className="dp-marcar-caixa">
          <div className="dp-marcar-corpo">
            <div className="dp-pilha">
              {emLote ? (
                <p className="dp-nota" data-lote-de-lugar="">
                  O lugar marcado aqui passa a ser o de todos os {todos.length}, no lugar do que
                  cada um tem hoje.
                </p>
              ) : null}
              <p className="dp-nota">
                Clique na prateleira ou no palete. Na prateleira, escolha depois o vão e o nível. O
                palete não tem nível.
              </p>
              <PlantaDoDeposito
                planta={planta}
                maxima={48}
                estados={estados}
                marcadores={marcadores}
                ocupacao={ocupacao}
                aoAbrir={aoAbrir}
              />
              <LegendaDoMapa />
            </div>
            <div className="dp-pilha">
              {movelAtual && movelAtual.tipo === 'prateleira' && lugarAtual ? (
                <Grupo rotulo={'A Prateleira ' + movelAtual.nome + ' vista de frente'}>
                  <FrenteDaPrateleira
                    movel={movelAtual}
                    guardados={guardados}
                    escolhido={
                      lugarAtual.vao !== null
                        ? { vao: lugarAtual.vao, nivel: lugarAtual.nivel }
                        : undefined
                    }
                    aoEscolher={(vao, nivel) =>
                      trocarAtual({
                        movelId: movelAtual.id,
                        vao,
                        /* clicar de novo na casa marcada tira o nível: fica só o vão */
                        nivel: lugarAtual.vao === vao && lugarAtual.nivel === nivel ? null : nivel,
                      })
                    }
                  />
                </Grupo>
              ) : null}
              <Campo
                rotulo="Ou escreva o código"
                dica="Como D2-3 (prateleira D, vão 2, nível 3), P07 (palete) ou o nome do palete."
              >
                <Entrada
                  value={codigo}
                  onChange={e => aoEscrever(e.currentTarget.value)}
                  placeholder="D2-3"
                  aria-label="Código do lugar"
                  autoComplete="off"
                />
              </Campo>
              <Grupo
                rotulo={
                  validos.length > 1
                    ? `Os ${validos.length} lugares ${emLote ? 'destes materiais' : 'deste material'}`
                    : emLote
                      ? 'Lugar destes materiais'
                      : 'Lugar deste material'
                }
              >
                <div className="dp-lugares">
                  {lista.map((l, i) => {
                    const mv = l ? moveis.get(l.movelId) : undefined
                    return (
                      <span
                        key={i}
                        className={i === atual ? 'dp-lugar-da-lista atual' : 'dp-lugar-da-lista'}
                      >
                        <button
                          type="button"
                          className="dp-lugar-botao"
                          aria-pressed={i === atual}
                          onClick={() => setAtual(i)}
                        >
                          {l && mv ? (
                            <EtiquetaDoLugar movel={mv} lugar={l} porExtenso forte={i === 0} />
                          ) : (
                            <span className="dp-etiqueta sem">clique no desenho</span>
                          )}
                        </button>
                        {l && i > 0 ? (
                          <button
                            type="button"
                            className="dp-miudo"
                            aria-label="Tornar o principal"
                            title="Tornar o principal"
                            onClick={() => tornarPrincipal(i)}
                          >
                            <Star size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                        {l || lista.length > 1 ? (
                          <button
                            type="button"
                            className="dp-miudo"
                            aria-label="Tirar este lugar"
                            title="Tirar este lugar"
                            onClick={() => tirar(i)}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </span>
                    )
                  })}
                </div>
              </Grupo>
              <Botao
                onClick={outroLugar}
                disabled={lista.length >= MAXIMO_DE_LUGARES || lista.some(l => l === null)}
              >
                <Plus size={16} aria-hidden="true" />
                Outro lugar
              </Botao>
              <p className="dp-nota">
                O primeiro lugar é o principal: é ele que aparece na lista e na separação.
              </p>
              {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
