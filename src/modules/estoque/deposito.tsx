import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { MapPin, PencilSimple } from '@phosphor-icons/react'
import { Botao, Kpi, Vazio } from '@ds'
import { semAcento } from '@shared'
import {
  celulasDaPlanta,
  chaveDaCelula,
  contarLugares,
  lugarPorExtenso,
  metros,
  type Celula,
  type LugarDoMaterial,
  type Movel,
  type Planta,
} from '@dominio/deposito'
import { NOME_DA_CATEGORIA, quantoNaUnidade, type Material } from '@dominio/estoque'
import { plural } from './apoio'
import { EtiquetaDoLugar, FrenteDaPrateleira, Nv } from './frente'
import { PlantaDoDeposito, type EstadoDoLugar, type Ocupacao } from './planta'
import { Bola } from './vao'
import './deposito.css'

/* ==========================================================================
   O depósito visto de cima.

   A pergunta desta tela é "onde está?". O desenho é o centro: o chão, as
   prateleiras, os paletes e a escada, cada lugar dizendo se tem material. A
   busca põe um marcador em cada lugar onde o material procurado está, e o
   clique num lugar abre, ao lado, o que há nele.

   O material sem lugar não some: aparece numa lista embaixo, com o botão de
   marcar. É por ela que o depósito vai sendo preenchido.
   ========================================================================== */

/** o nome do material em duas linhas: o tecido em cima e a cor embaixo */
export function nomeEmDuas(m: Material): [string, string] {
  if (m.categoria === 'tecido' && m.tecido) return [m.tecido, m.cor]
  return [m.nome, NOME_DA_CATEGORIA[m.categoria] + (m.grupo ? ' · ' + m.grupo : '')]
}

const PRIMEIROS_SEM_LUGAR = 6
const MAIS_SEM_LUGAR = 20

export function Deposito({
  planta,
  lugares,
  materiais,
  busca,
  marcados,
  aoLimparMarcados,
  podeEditar,
  estreita,
  celular,
  aoEditar,
  aoMarcar,
  aoMovimentar,
}: {
  planta: Planta | null
  lugares: LugarDoMaterial[]
  materiais: Material[]
  busca: string
  /** o que outra tela pediu para ver no mapa: os materiais de um pedido, as
      cores de um tecido. Vale enquanto a busca está vazia. */
  marcados?: { ids: string[]; rotulo: string } | null
  aoLimparMarcados?: () => void
  podeEditar: boolean
  /** abaixo de 1100 px o painel do lugar desce para baixo do desenho */
  estreita: boolean
  celular: boolean
  aoEditar: () => void
  aoMarcar: (m: Material) => void
  aoMovimentar: (m: Material) => void
}) {
  const [aberta, setAberta] = useState('')
  const [escolhido, setEscolhido] = useState('')
  const [semLugarAVista, setSemLugarAVista] = useState(PRIMEIROS_SEM_LUGAR)

  const porId = useMemo(() => new Map(materiais.map(m => [m.id, m])), [materiais])
  const moveis = useMemo(() => new Map((planta?.moveis ?? []).map(m => [m.id, m])), [planta])
  const celulas = useMemo(() => (planta ? celulasDaPlanta(planta) : []), [planta])

  /* o que há em cada lugar do desenho */
  const porCelula = useMemo(() => {
    const mapa = new Map<string, { m: Material; l: LugarDoMaterial }[]>()
    for (const l of lugares) {
      const m = porId.get(l.materialId)
      if (!m || !moveis.has(l.movelId)) continue
      const chave = chaveDaCelula(l.movelId, l.vao)
      const lista = mapa.get(chave) ?? []
      lista.push({ m, l })
      mapa.set(chave, lista)
    }
    return mapa
  }, [lugares, porId, moveis])

  const ocupacao: Ocupacao = useMemo(() => {
    const o: Ocupacao = new Map()
    for (const [chave, lista] of porCelula) {
      o.set(chave, { quantos: lista.length, comprar: lista.some(x => x.m.livre < x.m.minimo) })
    }
    return o
  }, [porCelula])

  /* A BUSCA ACHA PELO QUE A PESSOA LEMBRA: o tecido, a cor, o nome ou o grupo.
     Cada lugar onde algum achado está vira um marcador, o principal primeiro. */
  const termo = semAcento(busca.trim())
  const pedidos = !termo && marcados ? marcados : null
  const achados = useMemo(() => {
    if (!termo) return new Set<string>(pedidos?.ids ?? [])
    const palavras = termo.split(/\s+/)
    return new Set(
      materiais
        .filter(m => {
          const texto = semAcento([m.nome, m.tecido, m.cor, m.grupo].join(' '))
          return palavras.every(p => texto.includes(p))
        })
        .map(m => m.id),
    )
  }, [materiais, termo, pedidos])
  const marcadores = useMemo(() => {
    const chaves: string[] = []
    for (const l of [...lugares].sort((a, b) => Number(b.principal) - Number(a.principal))) {
      if (!achados.has(l.materialId) || !moveis.has(l.movelId)) continue
      const chave = chaveDaCelula(l.movelId, l.vao)
      if (!chaves.includes(chave)) chaves.push(chave)
    }
    return chaves
  }, [lugares, achados, moveis])

  /* a busca abre o primeiro lugar achado; o lugar que saiu do desenho fecha */
  const primeiro = marcadores[0] ?? ''
  useEffect(() => {
    if (primeiro) setAberta(primeiro)
  }, [primeiro, termo, pedidos])
  useEffect(() => {
    if (aberta && !celulas.some(c => c.chave === aberta)) setAberta('')
  }, [aberta, celulas])
  useEffect(() => {
    setEscolhido('')
  }, [aberta])

  const estados = useMemo(() => {
    const e = new Map<string, EstadoDoLugar>()
    for (const c of celulas) {
      e.set(
        c.chave,
        c.chave === aberta
          ? 'aberto'
          : marcadores.includes(c.chave)
            ? 'achado'
            : ocupacao.has(c.chave)
              ? 'tem'
              : 'vazio',
      )
    }
    return e
  }, [celulas, aberta, marcadores, ocupacao])
  const comprar = useMemo(
    () => new Set([...ocupacao].filter(([, o]) => o.comprar).map(([chave]) => chave)),
    [ocupacao],
  )

  const comLugar = useMemo(
    () => new Set(lugares.filter(l => moveis.has(l.movelId)).map(l => l.materialId)),
    [lugares, moveis],
  )
  const semLugar = useMemo(() => materiais.filter(m => !comLugar.has(m.id)), [materiais, comLugar])

  if (!planta) {
    return (
      <section className="cartao dp-quadro">
        <Vazio
          titulo="O depósito ainda não foi desenhado"
          texto="Desenhe o chão, as prateleiras e os paletes. Depois é só marcar onde cada material está, e qualquer pessoa acha pelo desenho."
          acao={
            podeEditar && !celular ? (
              <Botao tom="primario" onClick={aoEditar}>
                Desenhar o depósito
              </Botao>
            ) : undefined
          }
        />
        {podeEditar && celular ? (
          <p className="dp-nota no-vazio">O editor do depósito abre no computador ou no tablet.</p>
        ) : null}
      </section>
    )
  }

  const celulaAberta = celulas.find(c => c.chave === aberta) ?? null
  const movelAberto = celulaAberta ? (moveis.get(celulaAberta.movelId) ?? null) : null
  const contagem = contarLugares(planta)
  const vazios = celulas.filter(c => !ocupacao.has(c.chave)).length
  const achadosSemLugar = termo ? semLugar.filter(m => achados.has(m.id)) : []
  const outros = marcadores.filter(chave => chave !== aberta)
  const semMarcador = !!termo && !marcadores.length

  const mapa = (
    <section className="cartao dp-cartao" data-mapa="">
      {/* no celular o desenho abre o cartão: o título e a medida saem, e a
          legenda desce para o pé (prancha 48) */}
      {celular ? null : (
        <div className="dp-topo">
          <h3 className="cartao-titulo">
            <span className="marca" />O depósito visto de cima
            <small>
              {metros(planta.largura)} × {metros(planta.fundo)} m
            </small>
          </h3>
          <LegendaDoMapa />
        </div>
      )}
      <div className="dp-area">
        <PlantaDoDeposito
          planta={planta}
          maxima={56}
          medidas={!celular}
          estados={estados}
          comprar={comprar}
          marcadores={marcadores}
          ocupacao={ocupacao}
          aoAbrir={c => setAberta(c.chave === aberta ? '' : c.chave)}
        />
      </div>
      <div className="dp-pe">
        {celular && !semMarcador && !pedidos ? null : (
          <p className="dp-nota">
            {semMarcador
              ? achados.size
                ? achadosSemLugar.length === 1
                  ? `${nomeEmDuas(achadosSemLugar[0]).filter(Boolean).join(' · ')} ainda está sem lugar marcado.`
                  : `Achei ${plural(achados.size, 'material', 'materiais')}, mas nenhum tem lugar marcado ainda.`
                : 'Nenhum material com esse nome.'
              : pedidos
                ? `Os marcadores mostram onde está ${pedidos.rotulo}.`
                : 'Clique num lugar para ver o que tem nele. A busca põe um marcador em cada lugar onde o material está.'}
            {pedidos && aoLimparMarcados ? (
              <>
                {' '}
                <button type="button" className="dp-limpar" onClick={aoLimparMarcados}>
                  Tirar os marcadores
                </button>
              </>
            ) : null}
          </p>
        )}
        {celular ? <LegendaDoMapa /> : null}
        <span className="dp-legenda-fila">
          <span>
            <i className="aberto" />
            lugar aberto
          </span>
          <span>
            <i className="achado" />o que você procurou
          </span>
        </span>
      </div>
    </section>
  )

  const numeros = (
    <div className="dp-numeros">
      <Kpi
        rotulo="Lugares"
        valor={celulas.length}
        sub={`${plural(contagem.vaos, 'vão', 'vãos')} em ${plural(contagem.prateleiras, 'prateleira', 'prateleiras')} e ${plural(contagem.paletes, 'palete', 'paletes')}`}
      />
      <Kpi
        rotulo="Com lugar marcado"
        valor={`${comLugar.size} de ${materiais.length}`}
        sub="materiais"
      />
      <Kpi
        rotulo="Lugares vazios"
        valor={`${vazios} de ${celulas.length}`}
        sub="vãos e paletes sem nada"
      />
    </div>
  )

  const listaSemLugar = semLugar.length ? (
    <section className="cartao dp-cartao">
      <div className="dp-topo">
        <h3 className="cartao-titulo">
          <span className="marca" />
          Sem lugar marcado
        </h3>
        <span className="dp-conta">{plural(semLugar.length, 'material', 'materiais')}</span>
      </div>
      {semLugar.slice(0, semLugarAVista).map(m => {
        const [em, baixo] = nomeEmDuas(m)
        return (
          <div key={m.id} className="dp-linha">
            {m.categoria === 'tecido' ? <Bola cor={m.corHex} /> : null}
            <span className="dp-texto">
              <b>{em}</b>
              {baixo ? (
                <small className={m.categoria === 'tecido' ? 'dp-cor' : ''}>{baixo}</small>
              ) : null}
            </span>
            <span className="dp-valor">
              {quantoNaUnidade(m.livre, m.unidade)}
              <small>livre</small>
            </span>
            {podeEditar ? (
              <Botao
                tamanho="sm"
                className="dp-marcar"
                aria-label={'Marcar no mapa: ' + [em, baixo].filter(Boolean).join(' · ')}
                onClick={() => aoMarcar(m)}
              >
                <MapPin size={15} aria-hidden="true" />
                <span className="dp-marcar-texto">Marcar no mapa</span>
              </Botao>
            ) : null}
          </div>
        )
      })}
      {semLugar.length > semLugarAVista ? (
        <button
          type="button"
          className="dp-ver-mais"
          onClick={() => setSemLugarAVista(semLugarAVista + MAIS_SEM_LUGAR)}
        >
          Ver mais {Math.min(MAIS_SEM_LUGAR, semLugar.length - semLugarAVista)} de{' '}
          {semLugar.length - semLugarAVista}
        </button>
      ) : semLugarAVista > PRIMEIROS_SEM_LUGAR ? (
        <button
          type="button"
          className="dp-ver-mais"
          onClick={() => setSemLugarAVista(PRIMEIROS_SEM_LUGAR)}
        >
          Ver menos
        </button>
      ) : null}
    </section>
  ) : null

  /* QUEM OS BOTÕES DO PÉ MOVEM. O que a pessoa clicou na lista; sem clique, o
     que ela procurou, se ele está neste lugar; e, num lugar de um material só,
     ele. Assim a busca já deixa o "Mover de lugar" pronto, como no wireframe,
     e num vão com seis cores ninguém move a cor errada sem ter escolhido. A
     linha só fica preta com o clique: a do que foi procurado já está marcada
     de vermelho, e duas marcas na mesma linha escondiam a primeira. */
  const dentroDoAberto = porCelula.get(aberta) ?? []
  const procuradosAqui = dentroDoAberto.filter(x => achados.has(x.m.id))
  const escolhidoDeFato =
    escolhido ||
    (procuradosAqui.length === 1
      ? procuradosAqui[0].m.id
      : dentroDoAberto.length === 1
        ? dentroDoAberto[0].m.id
        : '')
  const material = escolhidoDeFato ? (porId.get(escolhidoDeFato) ?? null) : null
  const painel =
    celulaAberta && movelAberto ? (
      <LugarAberto
        key={celulaAberta.chave}
        celula={celulaAberta}
        movel={movelAberto}
        dentro={porCelula.get(celulaAberta.chave) ?? []}
        daPrateleira={porCelula}
        achados={achados}
        fraseDoAchado={pedidos ? 'é do que você pediu para ver' : 'é o que você procurou'}
        escolhido={escolhido}
        aoEscolher={id => setEscolhido(id === escolhido ? '' : id)}
        pe={
          podeEditar ? (
            <div className="dp-pe botoes">
              <Botao
                disabled={!material}
                title={material ? undefined : 'Escolha um material da lista'}
                onClick={() => material && aoMarcar(material)}
              >
                Mover de lugar
              </Botao>
              <Botao
                tom="forte"
                disabled={!material}
                title={material ? undefined : 'Escolha um material da lista'}
                onClick={() => material && aoMovimentar(material)}
              >
                Registrar movimento
              </Botao>
            </div>
          ) : null
        }
      />
    ) : (
      <section className="cartao dp-cartao dp-painel">
        <div className="dp-topo">
          <h3 className="cartao-titulo">
            <span className="marca" />
            Nenhum lugar aberto
          </h3>
        </div>
        <p className="dp-nota dp-recheio">
          Clique numa prateleira ou num palete do desenho, ou procure um material na busca.
        </p>
      </section>
    )

  const tambem = outros.length ? (
    <section className="cartao dp-cartao">
      <div className="dp-topo">
        <h3 className="cartao-titulo">
          <span className="marca" />
          {celulaAberta && marcadores.includes(aberta) ? 'Também está em' : 'Onde achei'}
        </h3>
        <span className="dp-conta">{plural(outros.length, 'lugar', 'lugares')}</span>
      </div>
      {outros.map(chave => {
        const c = celulas.find(x => x.chave === chave)
        const mv = c ? moveis.get(c.movelId) : undefined
        if (!c || !mv) return null
        const la = (porCelula.get(chave) ?? []).filter(x => achados.has(x.m.id))
        return (
          <button
            key={chave}
            type="button"
            className="dp-linha clica achada"
            onClick={() => setAberta(chave)}
          >
            <span className="dp-passo">{marcadores.indexOf(chave) + 1}</span>
            <span className="dp-texto">
              <b>{lugarPorExtenso(mv, c.vao, null)}</b>
              <small>{la.map(x => nomeEmDuas(x.m).filter(Boolean).join(' · ')).join(', ')}</small>
            </span>
            <EtiquetaDoLugar
              movel={mv}
              lugar={{ movelId: mv.id, vao: c.vao, nivel: la.length === 1 ? la[0].l.nivel : null }}
            />
          </button>
        )
      })}
    </section>
  ) : null

  return (
    <div className={estreita ? 'dp-tela estreita' : 'dp-tela'}>
      <div className="dp-pilha">
        {mapa}
        {estreita ? (
          <>
            {painel}
            {tambem}
          </>
        ) : null}
        {numeros}
        {listaSemLugar}
      </div>
      {estreita ? null : (
        <div className="dp-pilha">
          {painel}
          {tambem}
        </div>
      )}
    </div>
  )
}

/* O botão de editar mora na barra da página, ao lado da busca: quem o desenha
   é a tela do Estoque, e ele vem daqui para o texto e o ícone serem um só. */
export function BotaoEditarODeposito({
  aoEditar,
  temDeposito,
}: {
  aoEditar: () => void
  temDeposito: boolean
}) {
  return (
    <Botao onClick={aoEditar}>
      <PencilSimple size={16} aria-hidden="true" />
      {temDeposito ? 'Editar o depósito' : 'Desenhar o depósito'}
    </Botao>
  )
}

/** o que cada lugar do desenho quer dizer */
export function LegendaDoMapa() {
  return (
    <span className="dp-legenda-fila">
      <span>
        <i className="tem" />
        tem estoque
      </span>
      <span>
        <i className="comprar" />
        tem item para comprar
      </span>
      <span>
        <i />
        vazio
      </span>
    </span>
  )
}

/* --- o lugar aberto ---------------------------------------------------------
   A prateleira aparece vista de frente, com o vão aberto em destaque, e
   embaixo o que há em cada nível, o de cima primeiro. O palete não tem nível:
   é uma lista só. */
function LugarAberto({
  celula,
  movel,
  dentro,
  daPrateleira,
  achados,
  fraseDoAchado,
  escolhido,
  aoEscolher,
  pe,
}: {
  celula: Celula
  movel: Movel
  dentro: { m: Material; l: LugarDoMaterial }[]
  daPrateleira: Map<string, { m: Material; l: LugarDoMaterial }[]>
  achados: Set<string>
  fraseDoAchado: string
  escolhido: string
  aoEscolher: (id: string) => void
  pe: ReactNode
}) {
  const linha = ({ m }: { m: Material }) => {
    const [em, baixo] = nomeEmDuas(m)
    const achado = achados.has(m.id)
    return (
      <button
        key={m.id}
        type="button"
        className={[
          'dp-linha',
          'clica',
          achado ? 'achada' : '',
          escolhido === m.id ? 'escolhida' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-pressed={escolhido === m.id}
        onClick={() => aoEscolher(m.id)}
      >
        {m.categoria === 'tecido' ? <Bola cor={m.corHex} /> : null}
        <span className="dp-texto">
          <b>{em}</b>
          {baixo ? (
            <small className={m.categoria === 'tecido' ? 'dp-cor' : ''}>{baixo}</small>
          ) : null}
          <small>{achado ? fraseDoAchado : 'livre ' + quantoNaUnidade(m.livre, m.unidade)}</small>
        </span>
        <span className={m.livre < m.minimo ? 'dp-valor pouco' : 'dp-valor'}>
          {quantoNaUnidade(m.saldo, m.unidade)}
          <small>na prateleira</small>
        </span>
      </button>
    )
  }

  let corpo: ReactNode
  if (movel.tipo === 'prateleira' && celula.vao !== null) {
    /* a frente mostra a prateleira inteira: junta o que há em todos os vãos dela */
    const guardados = new Map<string, Material[]>()
    for (let v = 1; v <= movel.vaos; v++) {
      for (const x of daPrateleira.get(chaveDaCelula(movel.id, v)) ?? []) {
        const chave = v + ':' + (x.l.nivel ?? 0)
        guardados.set(chave, [...(guardados.get(chave) ?? []), x.m])
      }
    }
    const niveis = Array.from({ length: movel.niveis }, (_, i) => movel.niveis - i)
    const semNivel = dentro.filter(x => x.l.nivel === null)
    corpo = (
      <>
        <div className="dp-recheio">
          <FrenteDaPrateleira movel={movel} guardados={guardados} vaoAberto={celula.vao} />
          <p className="dp-nota">
            A prateleira vista de frente, com o vão aberto em destaque. Cada nível tem a sua cor, a
            mesma que aparece ao lado do lugar em toda a página.
          </p>
        </div>
        {niveis.map(n => {
          const doNivel = dentro.filter(x => x.l.nivel === n)
          return (
            <div key={n} className="dp-nivel-bloco">
              <div className="dp-secao">
                <span>
                  <Nv nivel={n} />
                  Nível {n}
                </span>
                <span>{doNivel.length ? plural(doNivel.length, 'item', 'itens') : 'vazio'}</span>
              </div>
              {doNivel.map(linha)}
            </div>
          )
        })}
        {semNivel.length ? (
          <div className="dp-nivel-bloco">
            <div className="dp-secao">
              <span>Sem nível marcado</span>
              <span>{plural(semNivel.length, 'item', 'itens')}</span>
            </div>
            {semNivel.map(linha)}
          </div>
        ) : null}
      </>
    )
  } else {
    corpo = dentro.length ? (
      dentro.map(linha)
    ) : (
      <p className="dp-nota dp-recheio">Este palete está vazio.</p>
    )
  }

  return (
    <section className="cartao dp-cartao dp-painel" data-aberto={celula.nome}>
      <div className="dp-topo">
        <h3 className="cartao-titulo">
          <span className="marca" />
          {lugarPorExtenso(movel, celula.vao, null)}
        </h3>
        <span className="dp-conta">
          {dentro.length ? plural(dentro.length, 'material', 'materiais') : 'vazio'}
        </span>
      </div>
      {corpo}
      {pe}
    </section>
  )
}
