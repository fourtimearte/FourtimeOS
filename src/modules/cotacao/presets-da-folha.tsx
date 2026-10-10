import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowCounterClockwise,
  Check,
  CheckCircle,
  CurrencyDollar,
  DotsThree,
  FloppyDisk,
  HandPointing,
  LockSimple,
  PencilSimpleLine,
  Plus,
  Printer,
  Prohibit,
  SlidersHorizontal,
  Trash,
} from '@phosphor-icons/react'
import {
  Botao,
  Campo,
  Entrada,
  MenuDeContexto,
  Modal,
  Segmentado,
  Seletor,
  TituloCartao,
  avisar,
} from '@ds'
import { useSessao } from '@dominio/sessao'
import {
  CAMPOS_DO_CABECALHO,
  PRESETS_DA_FABRICA,
  apagarPreset,
  carregarPresets,
  criarPreset,
  mudancas,
  presetQueAbre,
  salvarPreset,
  soComValor,
  vistaDe,
  type AbreEm,
  type OndeMoram,
  type PresetDeImpressao,
  type VistaDaFolha,
} from '@dominio/cotacao'
import './cotacao.css'

/* ==========================================================================
   OS PRESETS DE IMPRESSÃO DA FOLHA A4 (wireframe de 11/10/2026, pranchas 121
   a 121c, segunda versão, aprovada pelo Henrique).

   NO TOPO, ao lado de Editar, os presets salvos num segmentado: um clique
   troca. A BARRA DA DIREITA edita o escolhido: com valor ou sem valor, e o
   DIAGRAMA da folha, uma página por vez, com cada módulo e cada campo do
   cabeçalho num bloco simples. Apertar tira da folha, e o bloco fica meio
   apagado; apertar de novo põe de volta.

   O QUE MUDA AQUI VALE PARA ESTA IMPRESSÃO. O preset só muda se alguém
   salvar, e os dois da fábrica nunca mudam: o que se faz neles vira preset
   novo. O pé da barra diz se a folha está igual ao preset ou quantas
   mudanças ela tem.
   ========================================================================== */

export type Destino = 'cliente' | 'producao'

/* ---------- o estado ------------------------------------------------------ */
export function usarPresetsDaFolha(para: Destino, inicial = '') {
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa.id : ''
  const admin = estado.fase === 'dentro' && estado.pessoa.papel === 'admin'

  const [salvos, setSalvos] = useState<PresetDeImpressao[]>([])
  const [onde, setOnde] = useState<OndeMoram>('banco')
  const [falha, setFalha] = useState('')
  const [escolhidoId, setEscolhidoId] = useState('')
  /* a folha desta impressão; null é "igual ao preset escolhido" */
  const [agora, setAgora] = useState<VistaDaFolha | null>(null)
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    let vivo = true
    void carregarPresets().then(r => {
      if (!vivo) return
      setSalvos(r.presets)
      setOnde(r.onde)
      setFalha(r.falha)
      /* quem chega com ?preset= (o modal da folha abre a página assim) fica com ele */
      const pedido = [...PRESETS_DA_FABRICA, ...r.presets].find(x => x.id === inicial)
      setEscolhidoId(id => id || pedido?.id || presetQueAbre(r.presets, para, eu).id)
    })
    return () => {
      vivo = false
    }
  }, [para, eu, inicial])

  const lista = useMemo(
    () => [
      ...PRESETS_DA_FABRICA,
      ...[...salvos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    ],
    [salvos],
  )
  const escolhido =
    lista.find(p => p.id === escolhidoId) ??
    (para === 'producao' ? PRESETS_DA_FABRICA[1] : PRESETS_DA_FABRICA[0])
  const salvo = useMemo(() => vistaDe(escolhido), [escolhido])
  const vista = agora ?? salvo
  const mudou = useMemo(() => mudancas(vista, salvo), [vista, salvo])
  const podeSalvar =
    !escolhido.fabrica &&
    (escolhido.dono === eu || (escolhido.equipe && admin) || onde === 'navegador')

  const mexer = useCallback(
    (m: (v: VistaDaFolha) => VistaDaFolha) => setAgora(a => vistaDe(m(a ?? salvo))),
    [salvo],
  )

  const escolher = (id: string) => {
    setEscolhidoId(id)
    setAgora(null)
  }

  const alternar = (lista: string[], k: string) =>
    lista.includes(k) ? lista.filter(x => x !== k) : [...lista, k]

  async function gravar<T>(fazer: () => Promise<T>, ok: string): Promise<T | null> {
    setGravando(true)
    try {
      const r = await fazer()
      avisar(ok, 'ok')
      return r
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar o preset.', 'brand', 6)
      return null
    } finally {
      setGravando(false)
    }
  }

  return {
    lista,
    escolhido,
    vista,
    mudou,
    onde,
    falha,
    gravando,
    podeSalvar,
    podeMexerNoPreset: podeSalvar,
    escolher,
    trocarValor: (valor: boolean) => mexer(v => ({ ...v, valor })),
    alternarCampo: (k: string) => mexer(v => ({ ...v, campos: alternar(v.campos, k) })),
    alternarModulo: (k: string) => mexer(v => ({ ...v, fora: alternar(v.fora, k) })),
    desfazer: () => setAgora(null),
    async salvar() {
      const r = await gravar(
        () => salvarPreset({ ...escolhido, ...vista }, onde),
        'Preset ' + escolhido.nome + ' salvo.',
      )
      if (!r) return
      setSalvos(s => s.map(x => (x.id === r.id ? r : x)))
      setAgora(null)
    },
    async criar(
      dados: { nome: string; equipe: boolean; abre: AbreEm },
      base: VistaDaFolha = vista,
    ) {
      const r = await gravar(
        () => criarPreset({ ...base, ...dados }, onde, eu),
        'Preset ' + dados.nome.trim() + ' criado.',
      )
      if (!r) return false
      setSalvos(s => [...s, r])
      setEscolhidoId(r.id)
      setAgora(null)
      return true
    },
    async editar(dados: { nome: string; equipe: boolean; abre: AbreEm }) {
      /* renomear não leva junto o que mudou nesta impressão: só nome, quem e onde abre */
      const r = await gravar(
        () => salvarPreset({ ...escolhido, ...dados }, onde),
        'Preset ' + dados.nome.trim() + ' salvo.',
      )
      if (!r) return false
      setSalvos(s => s.map(x => (x.id === r.id ? r : x)))
      return true
    },
    async apagar() {
      const qual = escolhido
      const r = await gravar(
        () => apagarPreset(qual, onde).then(() => true),
        'Preset ' + qual.nome + ' apagado.',
      )
      if (!r) return
      setSalvos(s => s.filter(x => x.id !== qual.id))
      setEscolhidoId(presetQueAbre([], para, eu).id)
      setAgora(null)
    },
  }
}

export type PresetsDaFolha = ReturnType<typeof usarPresetsDaFolha>

/* ---------- o topo: os presets salvos, ao lado de Editar ---------------------- */
export function PresetsNoTopo({ p, aoNovo }: { p: PresetsDaFolha; aoNovo: () => void }) {
  return (
    <div className="ct-pr-topo">
      <span className="ct-pr-topo-rot">
        <Printer size={16} />
        Preset
      </span>
      <Segmentado
        className="ct-pr-topo-seg"
        valor={p.escolhido.id}
        opcoes={p.lista.map(x => ({
          valor: x.id,
          rotulo:
            x.id === p.escolhido.id && p.mudou.length ? (
              <>
                {x.nome}
                <i className="ct-pr-topo-ponto" aria-label="mudado nesta impressão" />
              </>
            ) : (
              x.nome
            ),
        }))}
        aoMudar={p.escolher}
      />
      <Botao tom="contorno" icone aria-label="Novo preset" title="Novo preset" onClick={aoNovo}>
        <Plus size={18} />
      </Botao>
    </div>
  )
}

/* ---------- o diagrama ------------------------------------------------------------ */
type OpcoesDoBloco = {
  h: number
  traco?: number
  classe?: string
  fixo?: boolean
  travado?: string
}

function Bloco({
  k,
  nome,
  fora,
  mudou,
  aoApertar,
  o,
}: {
  k: string
  nome: string
  fora: boolean
  mudou: boolean
  aoApertar?: (k: string) => void
  o: OpcoesDoBloco
}) {
  const fixo = !!o.fixo || !!o.travado
  return (
    <button
      type="button"
      className={[
        'ct-dg-b',
        fora ? 'fora' : '',
        mudou ? 'mudou' : '',
        o.fixo ? 'fixo' : '',
        o.classe ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--h': o.h + 'px' } as CSSProperties}
      aria-pressed={!fora}
      aria-label={nome + (fora ? ': fora da folha' : ': na folha')}
      data-modulo={k}
      disabled={fixo}
      title={
        o.travado || (o.fixo ? 'Sai sempre' : fora ? 'Pôr de volta na folha' : 'Tirar da folha')
      }
      onClick={() => aoApertar?.(k)}
    >
      <span className="ct-dg-n">
        {o.fixo ? <LockSimple size={10} /> : null}
        {nome}
      </span>
      {o.traco ? (
        <span className="ct-dg-l">
          {Array.from({ length: o.traco }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      ) : null}
      {o.travado && fora ? <em>{o.travado}</em> : null}
      {mudou ? <b className="ct-dg-ponto" aria-hidden="true" /> : null}
    </button>
  )
}

function PaginaUmDesenhada({ p, numero }: { p: PresetsDaFolha; numero: string }) {
  const v = p.vista
  const b = (k: string, nome: string, o: OpcoesDoBloco) => (
    <Bloco
      k={k}
      nome={nome}
      fora={v.fora.includes(k)}
      mudou={p.mudou.includes(k)}
      aoApertar={p.alternarModulo}
      o={o}
    />
  )
  const naFolha = v.campos.filter(k => v.valor || !soComValor(k)).length
  return (
    <div className="ct-dg-pag" aria-label="A página 1 da folha">
      <div className="ct-dg-cab">
        <div className="ct-dg-cab-topo">
          <span className="ct-dg-marca">FOURTIME</span>
          <span className="ct-dg-num" title="O número da cotação sai sempre">
            <LockSimple size={10} />
            {numero}
          </span>
        </div>
        <div className="ct-dg-campos">
          {CAMPOS_DO_CABECALHO.map(c => {
            const semRs = soComValor(c.k) && !v.valor
            const fora = !v.campos.includes(c.k) || semRs
            return (
              <button
                key={c.k}
                type="button"
                className={['ct-dg-c', fora ? 'fora' : '', p.mudou.includes(c.k) ? 'mudou' : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={!fora}
                aria-label={c.r + (fora ? ': fora do cabeçalho' : ': no cabeçalho')}
                data-campo={c.k}
                disabled={semRs}
                title={
                  semRs ? 'Só sai com valor' : fora ? 'Pôr no cabeçalho' : 'Tirar do cabeçalho'
                }
                onClick={() => p.alternarCampo(c.k)}
              >
                <span>{c.r}</span>
                {semRs ? <em>R$</em> : null}
              </button>
            )
          })}
        </div>
        <span className="ct-dg-cab-rot">
          Cabeçalho · {naFolha} {naFolha === 1 ? 'campo' : 'campos'}
        </span>
      </div>
      {b('res', 'Resumo do orçamento', { h: 56, traco: 4 })}
      {b('cond', 'Condições', { h: 26, traco: 1 })}
      {b('inf', 'Informes e termos', { h: 44, traco: 3 })}
      <Bloco
        k="ace"
        nome="Aceite"
        fora={!v.valor || v.fora.includes('ace')}
        mudou={p.mudou.includes('ace')}
        aoApertar={p.alternarModulo}
        o={{ h: 30, traco: 1, travado: v.valor ? '' : 'só com valor' }}
      />
      <span className="ct-dg-vao" />
      <Bloco k="pe" nome="Rodapé" fora={false} mudou={false} o={{ h: 16, fixo: true }} />
    </div>
  )
}

const COLUNA_DO_LAYOUT: [string, string, OpcoesDoBloco][] = [
  ['arte', 'Arte', { h: 96, classe: 'arte' }],
  ['dest', 'Destaques', { h: 22 }],
  ['grade', 'Grade', { h: 28 }],
  ['ficha', 'Ficha', { h: 38, traco: 2 }],
  ['fab', 'Fabricação', { h: 30, traco: 2 }],
  ['avi', 'Aviamentos', { h: 30, traco: 2 }],
  ['obs', 'Observação', { h: 18 }],
  ['soma', 'Soma', { h: 14 }],
]

function PaginaDeLayoutDesenhada({ p }: { p: PresetsDaFolha }) {
  const v = p.vista
  /* a coluna da esquerda é a que se aperta; a da direita repete, mais clara,
     só para mostrar o arranjo de dois por página */
  const coluna = (espelho: boolean) => (
    <div className={espelho ? 'ct-dg-col espelho' : 'ct-dg-col'} aria-hidden={espelho || undefined}>
      <Bloco
        k="lcab"
        nome="Cabeçalho do layout"
        fora={false}
        mudou={false}
        o={{ h: 20, fixo: true }}
      />
      {COLUNA_DO_LAYOUT.map(([k, nome, o]) => (
        <Bloco
          key={k}
          k={k}
          nome={nome}
          fora={v.fora.includes(k)}
          mudou={!espelho && p.mudou.includes(k)}
          aoApertar={espelho ? undefined : p.alternarModulo}
          o={espelho ? { ...o, travado: '' } : o}
        />
      ))}
    </div>
  )
  return (
    <div className="ct-dg-pag" aria-label="Uma página de layout da folha">
      <div className="ct-dg-dupla">
        {coluna(false)}
        {coluna(true)}
      </div>
      <span className="ct-dg-vao" />
      <Bloco k="pe" nome="Rodapé" fora={false} mudou={false} o={{ h: 16, fixo: true }} />
    </div>
  )
}

/* ---------- a barra da direita ----------------------------------------------------------- */
const NOME_DA_MUDANCA = (k: string): string =>
  k === 'valor'
    ? 'os valores'
    : (CAMPOS_DO_CABECALHO.find(c => c.k === k)?.r ??
      COLUNA_DO_LAYOUT.find(c => c[0] === k)?.[1] ??
      { res: 'o Resumo', cond: 'as Condições', inf: 'os Informes', ace: 'o Aceite' }[k] ??
      k)

export function BarraDoPreset({
  p,
  numero,
  aoNovo,
  aoEditar,
  aoApagar,
}: {
  p: PresetsDaFolha
  /** o número da cotação, que o diagrama mostra travado no cabeçalho */
  numero: string
  aoNovo: () => void
  aoEditar: () => void
  aoApagar: () => void
}) {
  const [pagina, setPagina] = useState<'um' | 'layout'>('um')
  const [menu, setMenu] = useState(false)
  const btMais = useRef<HTMLButtonElement>(null)
  const v = p.vista
  const n = p.mudou.length

  const itens = [
    ...(p.podeMexerNoPreset ? [{ rotulo: 'Renomear e quem usa', aoEscolher: aoEditar }] : []),
    { rotulo: 'Duplicar', aoEscolher: aoNovo },
    ...(p.podeMexerNoPreset
      ? [{ rotulo: 'Apagar o preset', risco: true, aoEscolher: aoApagar }]
      : []),
  ]

  return (
    /* A COLUNA ACOMPANHA A ROLAGEM: quem fica presa é esta caixa, e não o
       cartão, porque a regra .cartao do Design System (position: relative)
       chega depois no pacote e ganhava do sticky (11/10/2026: na página 2 a
       barra já tinha sumido) */
    <div className="ct-pr-lado fl-nao-imprime">
      <aside className="cartao ct-pr-barra" aria-label={'Editar o preset ' + p.escolhido.nome}>
        <div className="ct-pr-cab">
          <TituloCartao icone={SlidersHorizontal}>Preset {p.escolhido.nome}</TituloCartao>
          <button
            ref={btMais}
            type="button"
            className="btn btn-limpo icone"
            aria-label="Renomear, duplicar ou apagar o preset"
            title="Renomear, duplicar ou apagar"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu(m => !m)}
          >
            <DotsThree size={18} weight="bold" />
          </button>
          <MenuDeContexto
            aberto={menu}
            ancora={btMais}
            aoFechar={() => setMenu(false)}
            cabecalho={p.escolhido.fabrica ? 'Preset da fábrica: não muda' : undefined}
            itens={itens}
          />
        </div>

        <div className="ct-pr-sec">
          <div className="ct-pr-valores" role="radiogroup" aria-label="Valores na folha">
            <button
              type="button"
              role="radio"
              aria-checked={v.valor}
              className={[
                'ct-pr-v',
                v.valor ? 'sim' : '',
                v.valor && p.mudou.includes('valor') ? 'mudou' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => p.trocarValor(true)}
            >
              <CurrencyDollar size={18} />
              <span>
                <b>Com valor</b>
                <small>preços, totais e aceite</small>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!v.valor}
              className={[
                'ct-pr-v',
                v.valor ? '' : 'sim',
                !v.valor && p.mudou.includes('valor') ? 'mudou' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => p.trocarValor(false)}
            >
              <Prohibit size={18} />
              <span>
                <b>Sem valor</b>
                <small>a folha da fábrica</small>
              </span>
            </button>
          </div>
        </div>

        <div className="ct-pr-sec">
          <Segmentado
            className="ct-pr-seg"
            valor={pagina}
            opcoes={[
              { valor: 'um', rotulo: 'Página 1' },
              { valor: 'layout', rotulo: 'Página de layout' },
            ]}
            aoMudar={setPagina}
          />
          {pagina === 'um' ? (
            <PaginaUmDesenhada p={p} numero={numero} />
          ) : (
            <PaginaDeLayoutDesenhada p={p} />
          )}
          <small className="ct-pr-dica">
            <HandPointing size={14} />
            Aperte um bloco para tirar ou pôr de volta.
          </small>
        </div>

        <div className="ct-pr-pe">
          {n === 0 ? (
            <p className="ct-pr-igual">
              <CheckCircle size={16} />
              <span>
                Igual ao preset salvo. O que mudar aqui vale para esta impressão; para guardar,
                aparece o salvar.
              </span>
            </p>
          ) : (
            <>
              <div className="ct-pr-aviso">
                <PencilSimpleLine size={16} />
                <span>
                  <b>
                    {n} {n === 1 ? 'mudança' : 'mudanças'} nesta impressão
                  </b>
                  <small>
                    {n === 1 ? 'Mudou ' + NOME_DA_MUDANCA(p.mudou[0]) + '. ' : ''}
                    {p.escolhido.fabrica
                      ? 'O preset da fábrica não muda: salve como novo.'
                      : p.podeSalvar
                        ? 'O preset só muda se salvar.'
                        : 'Este preset é de outra pessoa: salve como novo.'}
                  </small>
                </span>
              </div>
              <div className="ct-pr-botoes">
                <Botao
                  tom="limpo"
                  icone
                  aria-label="Desfazer: volta ao preset"
                  title="Desfazer: volta ao preset"
                  onClick={p.desfazer}
                >
                  <ArrowCounterClockwise size={18} />
                </Botao>
                <span className="ct-pr-cresce" />
                <Botao tom="contorno" onClick={aoNovo}>
                  Salvar como novo
                </Botao>
                {p.podeSalvar ? (
                  <Botao
                    tom="forte"
                    disabled={p.gravando}
                    title={'Salvar em ' + p.escolhido.nome}
                    onClick={() => void p.salvar()}
                  >
                    <FloppyDisk size={17} />
                    Salvar
                  </Botao>
                ) : null}
              </div>
            </>
          )}
          {p.onde === 'navegador' ? (
            <p className="ct-pr-onde">
              Os presets salvos estão guardados só neste navegador até o banco ganhar a tabela deles
              (migração 059).
            </p>
          ) : null}
          {p.falha ? (
            <p className="ct-pr-onde">Não consegui ler os presets salvos: {p.falha}</p>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

/* ---------- salvar como novo, e renomear ---------------------------------------------- */
const OPCOES_DO_ABRE = [
  { valor: 'cliente', rotulo: 'A folha do cliente' },
  { valor: 'producao', rotulo: 'A folha da produção' },
]

export function ModalDoPreset({
  modo,
  p,
  aoFechar,
}: {
  /** novo: salvar como novo (e o "+" e o duplicar); editar: renomear, quem usa e onde abre */
  modo: 'novo' | 'editar'
  p: PresetsDaFolha
  aoFechar: () => void
}) {
  const e = p.escolhido
  const [nome, setNome] = useState(
    modo === 'editar' ? e.nome : e.fabrica || !p.mudou.length ? e.nome + ' (cópia)' : '',
  )
  const [equipe, setEquipe] = useState(modo === 'editar' ? e.equipe : true)
  const [abre, setAbre] = useState<AbreEm>(modo === 'editar' ? e.abre : '')
  const v = p.vista
  const naFolha = v.campos.filter(k => v.valor || !soComValor(k)).length
  const modulos = 12 - v.fora.length - (v.valor || v.fora.includes('ace') ? 0 : 1)
  const vazio = !nome.trim()

  async function confirmar() {
    if (vazio) return
    const ok =
      modo === 'editar'
        ? await p.editar({ nome, equipe, abre })
        : await p.criar({ nome, equipe, abre })
    if (ok) aoFechar()
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={modo === 'editar' ? 'Renomear o preset' : 'Salvar como novo preset'}
      pe={
        <>
          <Botao tom="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" disabled={vazio || p.gravando} onClick={() => void confirmar()}>
            <Check size={17} weight="bold" />
            {modo === 'editar' ? 'Salvar' : 'Salvar preset'}
          </Botao>
        </>
      }
    >
      <div className="ct-pr-modal">
        {modo === 'novo' ? (
          <p className="ct-pr-modal-sub">
            Com o que está na folha agora: {v.valor ? 'com valor' : 'sem valor'}, {naFolha}{' '}
            {naFolha === 1 ? 'campo' : 'campos'} no cabeçalho, {modulos}{' '}
            {modulos === 1 ? 'módulo' : 'módulos'}.
          </p>
        ) : null}
        <Campo
          rotulo="Nome do preset"
          erro={vazio}
          dica={vazio ? 'O preset precisa de um nome.' : undefined}
        >
          <Entrada
            value={nome}
            maxLength={60}
            autoFocus
            onChange={ev => setNome(ev.target.value)}
            onKeyDown={ev => {
              if (ev.key === 'Enter') void confirmar()
            }}
          />
        </Campo>
        <div className="campo">
          <span>Quem usa</span>
          <Segmentado
            className="ct-pr-seg"
            valor={equipe ? 'todos' : 'eu'}
            opcoes={[
              { valor: 'eu', rotulo: 'Só eu' },
              { valor: 'todos', rotulo: 'Toda a equipe' },
            ]}
            aoMudar={x => setEquipe(x === 'todos')}
          />
        </div>
        <div className="campo">
          <span>Abre sozinho em</span>
          <Seletor
            bloco
            campo
            valor={abre}
            vazio="Nenhuma folha: escolho na hora"
            opcoes={OPCOES_DO_ABRE}
            aoEscolher={x => setAbre(x === 'cliente' || x === 'producao' ? x : '')}
          />
          <span className="dica">
            Ele entra no topo, ao lado dos outros presets, e abre sozinho na folha escolhida.
          </span>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- a pergunta antes de apagar ------------------------------------------------- */
export function PerguntaDeApagarPreset({
  p,
  aoFechar,
}: {
  p: PresetsDaFolha
  aoFechar: () => void
}) {
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Apagar este preset?"
      pe={
        <>
          <Botao tom="contorno" onClick={aoFechar} data-foco-inicial="">
            Cancelar
          </Botao>
          <Botao
            tom="perigo"
            disabled={p.gravando}
            onClick={() => {
              void p.apagar().then(aoFechar)
            }}
          >
            <Trash size={17} />
            Apagar preset
          </Botao>
        </>
      }
    >
      <p className="ct-pr-modal-sub">
        O preset <b>{p.escolhido.nome}</b> sai do topo
        {p.escolhido.equipe ? ' de toda a equipe' : ''}. As folhas já impressas não mudam.
      </p>
    </Modal>
  )
}
