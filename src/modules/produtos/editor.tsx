import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type PointerEvent } from 'react'
import {
  Copy,
  DotsSixVertical,
  GridFour,
  IdentificationCard,
  Needle,
  PencilSimple,
  Plus,
  Scissors,
  TShirt,
  Trash,
  X,
} from '@phosphor-icons/react'
import {
  AreaTexto,
  Aviso,
  Botao,
  Busca,
  Campo,
  Chip,
  Entrada,
  Modal,
  Segmentado,
  Seletor,
  TituloCartao,
  avisar,
} from '@ds'
import { apagarReferencia } from '@dominio/banco'
import { TAMANHOS_ADULTO, TAMANHOS_INFANTIL } from '@dominio/layout/grade'
import {
  DETALHES,
  MEDIDAS_SUGERIDAS,
  NOME_DO_GENERO,
  abrirRascunho,
  areaDaPeca,
  campoComErro,
  casasDaArea,
  carregarFicha,
  casaComABusca,
  chaveNova,
  codigoCurto,
  emArea,
  fecharRascunho,
  partesEmNumero,
  retratoDoRascunho,
  salvarFicha,
  salvarMolde,
  vezesEmPalavras,
  type Ficha,
  type GrupoDeReferencia,
  type MaterialDoEstoque,
  type OndeEstaOErro,
  type ParteNoRascunho,
  type Rascunho,
  type ReferenciaNaFicha,
  type TecidoDeConta,
  type UnidadeDaParte,
} from '@dominio/produto'
import { plural } from './apoio'
import {
  EscolhaDoTecidoDeConta,
  TopoDoModulo,
  linhasDeConta,
  usarFaixa,
  usarTecidoDeConta,
  type AbaDoModulo,
} from './medidas'
import { DesenhoDoMolde, SoltarOMolde, usarArquivoDoMolde } from './molde'
import { SEM_ETIQUETA, Trilha, apoioDoMaterial } from './pecas'

/* ==========================================================================
   O editor da referência. Toma o lugar da ficha, na mesma coluna.

   O QUE SE EDITA AQUI É UM RASCUNHO. Nada vai para o banco antes do Salvar, e
   o Salvar manda a ficha inteira para uma função que grava tudo ou nada.
   Cancelar joga o rascunho fora.

   O CÓDIGO NÃO SE EDITA. FT-010-000M é o nome da peça em orçamento, em
   pedido e em reserva de tecido que já existem: trocar o código de uma peça
   é criar outra peça. Quem precisa de outro código duplica a referência.

   AS DUAS TABELAS ACEITAM COLAR. Quem tem a tabela de medidas numa planilha
   copia o bloco e cola no primeiro campo: as linhas e as colunas se
   distribuem sozinhas a partir dali.
   ========================================================================== */

type Erro = { texto: string; onde: OndeEstaOErro | null }

const NOME_DA_UNIDADE: Record<UnidadeDaParte, string> = {
  m2: 'Pano, em m²',
  m: 'Fita, em metros',
}

/** O texto colado, em linhas e colunas: do jeito que a planilha copia. */
function emMatriz(texto: string): string[][] {
  return texto
    .replace(/\r/g, '')
    .split('\n')
    .filter((l, i, todas) => l !== '' || i < todas.length - 1)
    .map(l => l.split('\t').map(c => c.trim()))
}

function Celula({
  valor,
  rotulo,
  aoMudar,
  aoColar,
}: {
  valor: string
  rotulo: string
  aoMudar: (v: string) => void
  /** um bloco de planilha colado neste campo */
  aoColar: (matriz: string[][]) => void
}) {
  const erro = campoComErro(valor)
  const colar = (e: ClipboardEvent<HTMLInputElement>) => {
    const texto = e.clipboardData.getData('text')
    if (!/[\t\n]/.test(texto.trim())) return
    e.preventDefault()
    aoColar(emMatriz(texto))
  }
  return (
    <td className={erro ? 'erro' : valor.trim() === '' ? 'vazia' : undefined}>
      <Entrada
        tamanho="sm"
        inputMode="decimal"
        autoComplete="off"
        value={valor}
        placeholder="0"
        aria-label={rotulo}
        aria-invalid={erro || undefined}
        onChange={e => aoMudar(e.currentTarget.value)}
        onPaste={colar}
      />
    </td>
  )
}

/* --- a parte do molde: nome, quantas vezes e a unidade ---------------------- */
function ParteDoMolde({
  parte,
  outras,
  aoFechar,
  aoGuardar,
  aoTirar,
}: {
  /** nulo: fechado. Sem chave: parte nova. */
  parte: { chave?: number; nome: string; vezes: string; unidade: UnidadeDaParte } | null
  /** os nomes das outras partes, para não repetir */
  outras: string[]
  aoFechar: () => void
  aoGuardar: (p: { chave?: number; nome: string; vezes: string; unidade: UnidadeDaParte }) => void
  aoTirar: (chave: number) => void
}) {
  const [nome, setNome] = useState('')
  const [vezes, setVezes] = useState('1')
  const [unidade, setUnidade] = useState<UnidadeDaParte>('m2')
  const [erro, setErro] = useState('')
  useEffect(() => {
    if (!parte) return
    setNome(parte.nome)
    setVezes(parte.vezes)
    setUnidade(parte.unidade)
    setErro('')
  }, [parte])

  function guardar() {
    const n = nome.trim()
    if (!n) return setErro('Dê um nome à parte: Frente, Costas, Manga, Gola.')
    if (outras.some(o => o.trim().toLowerCase() === n.toLowerCase()))
      return setErro(`Já existe uma parte chamada "${n}".`)
    if (!/^\d{1,2}$/.test(vezes.trim()) || Number(vezes) < 1 || Number(vezes) > 20)
      return setErro('A parte é cortada de 1 a 20 vezes em cada peça.')
    aoGuardar({ chave: parte?.chave, nome: n, vezes: vezes.trim(), unidade })
  }

  return (
    <Modal
      aberto={!!parte}
      aoFechar={aoFechar}
      titulo={parte?.chave ? 'Parte do molde' : 'Nova parte do molde'}
      pe={
        <>
          {parte?.chave ? (
            <Botao tom="limpo" className="pd-pe-esquerda" onClick={() => aoTirar(parte.chave as number)}>
              <Trash size={16} aria-hidden="true" />
              Tirar a parte
            </Botao>
          ) : null}
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="forte" onClick={guardar}>
            Guardar
          </Botao>
        </>
      }
    >
      <div className="pilha larga" data-parte-do-molde="">
        <Campo rotulo="Nome da parte" erro={!!erro} dica={erro || undefined}>
          <Entrada
            value={nome}
            maxLength={60}
            autoFocus
            placeholder="Frente"
            onChange={e => setNome(e.currentTarget.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') guardar()
            }}
          />
        </Campo>
        <Campo rotulo="Cortada quantas vezes em cada peça" dica="A manga é cortada 2 vezes; a frente, 1.">
          <Entrada
            value={vezes}
            inputMode="numeric"
            maxLength={2}
            onChange={e => setVezes(e.currentTarget.value)}
          />
        </Campo>
        <div className="pd-campo">
          <span className="pd-campo-topo">Como se mede o tecido desta parte</span>
          <Segmentado
            valor={unidade}
            aoMudar={setUnidade}
            opcoes={[
              { valor: 'm2', rotulo: NOME_DA_UNIDADE.m2 },
              { valor: 'm', rotulo: NOME_DA_UNIDADE.m },
            ]}
          />
          <span className="pd-nota">
            Pano é o que sai do rolo e entra na soma da peça. Fita é ribana, viés ou elástico: mede em
            metro e não entra na soma.
          </span>
        </div>
      </div>
    </Modal>
  )
}

/* --- copiar de outra referência ---------------------------------------------- */
function CopiarDeOutra({
  oQue,
  de,
  aoFechar,
  aoCopiar,
}: {
  oQue: 'medidas' | 'tecido' | null
  /** as referências que têm o que copiar */
  de: ReferenciaNaFicha[]
  aoFechar: () => void
  aoCopiar: (ficha: Ficha) => void
}) {
  const [busca, setBusca] = useState('')
  const [lendo, setLendo] = useState('')
  useEffect(() => {
    if (oQue) setBusca('')
  }, [oQue])
  const achadas = de.filter(r => casaComABusca(r, busca)).slice(0, 40)

  async function escolher(r: ReferenciaNaFicha) {
    setLendo(r.id)
    try {
      aoCopiar(await carregarFicha(r))
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui ler a outra ficha.', 'warn')
    } finally {
      setLendo('')
    }
  }

  return (
    <Modal
      aberto={!!oQue}
      aoFechar={aoFechar}
      titulo={oQue === 'tecido' ? 'Copiar o tecido de outra referência' : 'Copiar as medidas de outra referência'}
    >
      <div className="pilha larga" data-copiar={oQue ?? ''}>
        <p className="pd-nota">
          {oQue === 'tecido'
            ? 'As partes e o tecido desta peça são trocados pelos da que você escolher.'
            : 'A tabela de medidas desta peça é trocada pela da que você escolher.'}{' '}
          Nada é salvo ainda: dá para ajustar os números antes de salvar a referência.
        </p>
        <Busca
          value={busca}
          onChange={e => setBusca(e.currentTarget.value)}
          placeholder="Buscar referência ou código"
          aria-label="Buscar referência"
        />
        {achadas.length ? (
          <div className="pd-lista-de-escolha">
            {achadas.map(r => (
              <button
                type="button"
                className="pd-lin"
                key={r.id}
                disabled={!!lendo}
                onClick={() => void escolher(r)}
              >
                <span className="pd-txt">
                  <b>{r.nome}</b>
                  <small>
                    {codigoCurto(r.cod) || 'sem código'}
                    {NOME_DO_GENERO[r.genero] ? ' · ' + NOME_DO_GENERO[r.genero] : ''}
                  </small>
                </span>
                <span className="pd-val">
                  {oQue === 'tecido'
                    ? plural(r.partesComTecido, 'parte', 'partes')
                    : plural(r.medidas, 'medida', 'medidas')}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="pd-nota">
            {de.length
              ? 'Nenhuma referência com esse nome.'
              : oQue === 'tecido'
                ? 'Nenhuma outra referência tem o tecido medido ainda.'
                : 'Nenhuma outra referência tem tabela de medidas ainda.'}
          </p>
        )}
      </div>
    </Modal>
  )
}

export function Editor({
  r,
  grupo,
  ficha,
  molde,
  todas,
  tecidos,
  doEstoque,
  abaInicial,
  emKits,
  podeExcluir,
  aoSujar,
  aoCancelar,
  aoSalvou,
  aoExcluiu,
}: {
  r: ReferenciaNaFicha
  grupo: GrupoDeReferencia | null
  ficha: Ficha
  molde: string | null
  todas: ReferenciaNaFicha[]
  tecidos: TecidoDeConta[]
  doEstoque: MaterialDoEstoque[]
  abaInicial: AbaDoModulo
  /** em quantos kits a peça entra: excluir a peça tira ela deles */
  emKits: number
  podeExcluir: boolean
  aoSujar: (sujo: boolean) => void
  aoCancelar: () => void
  aoSalvou: (ficha: Ficha, molde: string | null) => Promise<void>
  aoExcluiu: () => Promise<void>
}) {
  const [rasc, setRasc] = useState<Rascunho>(() => abrirRascunho(ficha))
  const inicial = useRef(retratoDoRascunho(rasc))
  /* indefinido: ninguém mexeu no molde. Texto: o SVG novo, que sobe no Salvar. */
  const [moldeNovo, setMoldeNovo] = useState<string | undefined>(undefined)
  const [aba, setAba] = useState<AbaDoModulo>(abaInicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<Erro | null>(null)
  const [novaMedida, setNovaMedida] = useState('')
  const [parteAberta, setParteAberta] = useState<{
    chave?: number
    nome: string
    vezes: string
    unidade: UnidadeDaParte
  } | null>(null)
  const [copiando, setCopiando] = useState<'medidas' | 'tecido' | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [outroNome, setOutroNome] = useState('')
  const [outraUnidade, setOutraUnidade] = useState('')

  const lugares = useRef<Partial<Record<OndeEstaOErro | 'topo', HTMLElement | null>>>({})
  const grade = usarFaixa(rasc.tamanhos)
  const conta = usarTecidoDeConta(tecidos)
  const arquivo = usarArquivoDoMolde(setMoldeNovo)
  const moldeAVista = moldeNovo ?? molde

  const sujo = retratoDoRascunho(rasc) !== inicial.current || moldeNovo !== undefined
  useEffect(() => {
    aoSujar(sujo)
  }, [sujo, aoSujar])
  useEffect(() => () => aoSujar(false), [aoSujar])
  /* fechar a aba ou recarregar com a tabela digitada pela metade: o navegador pergunta antes */
  useEffect(() => {
    if (!sujo) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  const mudar = (troca: Partial<Rascunho>) => {
    setRasc(atual => ({ ...atual, ...troca }))
    /* o aviso era do que estava na tela na hora do Salvar: mexeu, ele sai */
    setErro(null)
  }

  /* --- a grade --- */
  function virarTamanho(t: string) {
    mudar({
      tamanhos: rasc.tamanhos.includes(t) ? rasc.tamanhos.filter(x => x !== t) : [...rasc.tamanhos, t],
    })
  }

  /* --- as medidas --- */
  const mudarMedida = (chave: number, troca: Partial<Rascunho['medidas'][number]>) =>
    mudar({ medidas: rasc.medidas.map(m => (m.chave === chave ? { ...m, ...troca } : m)) })

  function adicionarMedida(nome: string, comoMedir = '') {
    const n = nome.trim()
    if (!n) return
    if (rasc.medidas.some(m => m.nome.trim().toLowerCase() === n.toLowerCase())) {
      avisar(`A medida "${n}" já está na tabela.`, 'info')
      return
    }
    mudar({ medidas: [...rasc.medidas, { chave: chaveNova(), nome: n, comoMedir, valores: {} }] })
    setNovaMedida('')
  }

  function moverMedida(de: number, para: number) {
    if (para < 0 || para >= rasc.medidas.length || de === para) return
    const lista = [...rasc.medidas]
    const [m] = lista.splice(de, 1)
    lista.splice(para, 0, m)
    mudar({ medidas: lista })
  }

  /* O arrasto pela alça: enquanto o dedo ou o mouse passa por cima de outra
     linha, a medida vai para o lugar dela. Sem fantasma e sem soltar: a
     tabela já mostra a ordem que vai ficar.

     QUEM OUVE O MOVIMENTO É A JANELA, e não a alça. Quando a linha muda de
     lugar o navegador tira e põe de volta o pedaço da página, e a alça perde
     o ponteiro que tinha agarrado: o arrasto morria na primeira troca. */
  const [alcaPresa, setAlcaPresa] = useState<number | null>(null)
  const largarAAlca = useRef<(() => void) | null>(null)
  useEffect(() => () => largarAAlca.current?.(), [])
  function pegar(e: PointerEvent<HTMLButtonElement>, chave: number) {
    if (e.button !== 0) return
    largarAAlca.current?.()
    setAlcaPresa(chave)
    const mover = (ev: globalThis.PointerEvent) => {
      const alvo = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('tr[data-medida]')
      if (!alvo) return
      setRasc(atual => {
        const de = atual.medidas.findIndex(m => m.chave === chave)
        const para = atual.medidas.findIndex(m => String(m.chave) === alvo.dataset.medida)
        if (de < 0 || para < 0 || de === para) return atual
        const lista = [...atual.medidas]
        const [m] = lista.splice(de, 1)
        lista.splice(para, 0, m)
        return { ...atual, medidas: lista }
      })
    }
    const largar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', largar)
      window.removeEventListener('pointercancel', largar)
      largarAAlca.current = null
      setAlcaPresa(null)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', largar)
    window.addEventListener('pointercancel', largar)
    largarAAlca.current = largar
  }

  function colarNasMedidas(linha: number, coluna: number, matriz: string[][]) {
    const tamanhos = grade.tamanhos
    mudar({
      medidas: rasc.medidas.map((m, i) => {
        const colada = matriz[i - linha]
        if (i < linha || !colada) return m
        const valores = { ...m.valores }
        colada.forEach((texto, k) => {
          const t = tamanhos[coluna + k]
          if (t) valores[t] = texto
        })
        return { ...m, valores }
      }),
    })
  }

  /* --- as partes e o tecido --- */
  const pano = rasc.partes.filter(p => p.unidade === 'm2')
  const fita = rasc.partes.filter(p => p.unidade === 'm')
  /* a ordem em que a tabela mostra: é nela que o bloco colado se distribui */
  const naTabela = [...pano, ...fita]
  const emNumeros = useMemo(() => partesEmNumero(rasc.partes, rasc.tamanhos), [rasc.partes, rasc.tamanhos])
  const areas = grade.tamanhos.map(t => areaDaPeca(emNumeros, t))

  const mudarParte = (chave: number, troca: Partial<ParteNoRascunho>) =>
    mudar({ partes: rasc.partes.map(p => (p.chave === chave ? { ...p, ...troca } : p)) })

  function guardarParte(p: { chave?: number; nome: string; vezes: string; unidade: UnidadeDaParte }) {
    if (p.chave) mudarParte(p.chave, { nome: p.nome, vezes: p.vezes, unidade: p.unidade })
    else
      mudar({
        partes: [
          ...rasc.partes,
          { chave: chaveNova(), nome: p.nome, vezes: p.vezes, unidade: p.unidade, quantidades: {} },
        ],
      })
    setParteAberta(null)
  }

  function colarNoTecido(linha: number, coluna: number, matriz: string[][]) {
    const tamanhos = grade.tamanhos
    const trocadas = new Map<number, Record<string, string>>()
    naTabela.forEach((p, i) => {
      const colada = matriz[i - linha]
      if (i < linha || !colada) return
      const quantidades = { ...p.quantidades }
      colada.forEach((texto, k) => {
        const t = tamanhos[coluna + k]
        if (t) quantidades[t] = texto
      })
      trocadas.set(p.chave, quantidades)
    })
    mudar({
      partes: rasc.partes.map(p => (trocadas.has(p.chave) ? { ...p, quantidades: trocadas.get(p.chave)! } : p)),
    })
  }

  /* --- os aviamentos --- */
  const mudarMaterial = (chave: number, quantidade: string) =>
    mudar({ materiais: rasc.materiais.map(m => (m.chave === chave ? { ...m, quantidade } : m)) })
  const livres = doEstoque.filter(m => !rasc.materiais.some(x => x.materialId === m.id))

  function adicionarDoEstoque(id: string) {
    const m = doEstoque.find(x => x.id === id)
    if (!m) return
    mudar({
      materiais: [
        ...rasc.materiais,
        { chave: chaveNova(), materialId: m.id, nome: m.nome, quantidade: '', unidade: m.unidade },
      ],
    })
  }
  function adicionarPeloNome() {
    const n = outroNome.trim()
    if (!n) return
    if (rasc.materiais.some(m => m.nome.trim().toLowerCase() === n.toLowerCase())) {
      avisar(`"${n}" já está na lista.`, 'info')
      return
    }
    mudar({
      materiais: [
        ...rasc.materiais,
        { chave: chaveNova(), materialId: null, nome: n, quantidade: '', unidade: outraUnidade.trim() || 'un' },
      ],
    })
    setOutroNome('')
    setOutraUnidade('')
  }

  /* --- copiar de outra --- */
  const comMedidas = todas.filter(x => x.id !== r.id && x.medidas > 0)
  const comTecido = todas.filter(x => x.id !== r.id && x.partesComTecido > 0)
  function copiar(outra: Ficha) {
    const aberta = abrirRascunho(outra)
    if (copiando === 'tecido') mudar({ partes: aberta.partes })
    else mudar({ medidas: aberta.medidas })
    avisar(
      copiando === 'tecido'
        ? 'Tecido copiado de ' + outra.nome + '. Confira os números antes de salvar.'
        : 'Medidas copiadas de ' + outra.nome + '. Confira os números antes de salvar.',
      'ok',
    )
    setCopiando(null)
  }

  /* --- salvar, cancelar, excluir --- */
  function mostrarErro(e: Erro) {
    setErro(e)
    if (e.onde === 'medidas' || e.onde === 'tecido') setAba(e.onde)
    const lugar = lugares.current[e.onde ?? 'topo'] ?? lugares.current.topo
    /* depois de pintar, para a aba certa já estar à vista */
    requestAnimationFrame(() => lugar?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  async function salvar() {
    const fechado = fecharRascunho(rasc)
    if (fechado.ficha === null) {
      mostrarErro({ texto: fechado.erro, onde: fechado.onde })
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await salvarFicha(r.id, fechado.ficha)
    } catch (e) {
      setSalvando(false)
      mostrarErro({ texto: e instanceof Error ? e.message : 'Não consegui salvar a ficha.', onde: null })
      return
    }
    let moldeFinal = molde
    if (moldeNovo !== undefined) {
      try {
        await salvarMolde(r.id, moldeNovo)
        moldeFinal = moldeNovo
      } catch (e) {
        avisar(
          'A ficha foi salva, mas o molde não: ' + (e instanceof Error ? e.message : 'tente enviar o SVG de novo.'),
          'warn',
          9,
        )
      }
    }
    avisar('Ficha de ' + fechado.ficha.nome + ' salva.', 'ok')
    try {
      await aoSalvou(fechado.ficha, moldeFinal)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    setApagando(true)
    try {
      await apagarReferencia(r.id)
      avisar(r.nome + ' foi excluída.', 'ok')
      await aoExcluiu()
    } catch (e) {
      setExcluindo(false)
      mostrarErro({ texto: e instanceof Error ? e.message : 'Não consegui excluir a referência.', onde: null })
    } finally {
      setApagando(false)
    }
  }

  /* a linha de uma parte na tabela de tecido: o pano em cima da soma, a fita embaixo */
  const linhaDaParte = (p: ParteNoRascunho) => {
    const i = naTabela.indexOf(p)
    return (
      <tr key={p.chave} data-parte={p.nome} className={p.unidade === 'm' ? 'fita' : undefined}>
        <th scope="row">
          <div className="pd-parte-nome">
            <span className="pd-nomes">
              <b>{p.nome}</b>
              <small>{p.unidade === 'm' ? 'em metros' : vezesEmPalavras(Number(p.vezes) || 1)}</small>
            </span>
            <Botao
              tom="limpo"
              tamanho="sm"
              icone
              aria-label={'Mudar a parte ' + p.nome}
              onClick={() =>
                setParteAberta({ chave: p.chave, nome: p.nome, vezes: p.vezes, unidade: p.unidade })
              }
            >
              <PencilSimple size={16} aria-hidden="true" />
            </Botao>
          </div>
        </th>
        {grade.tamanhos.map((t, k) => (
          <Celula
            key={t}
            valor={p.quantidades[t] ?? ''}
            rotulo={p.nome + ' no ' + t}
            aoMudar={v => mudarParte(p.chave, { quantidades: { ...p.quantidades, [t]: v } })}
            aoColar={matriz => colarNoTecido(i, k, matriz)}
          />
        ))}
      </tr>
    )
  }

  const guardarLugar = (onde: OndeEstaOErro | 'topo') => (el: HTMLElement | null) => {
    lugares.current[onde] = el
  }
  const sugestoes = MEDIDAS_SUGERIDAS.filter(
    s => !rasc.medidas.some(m => m.nome.trim().toLowerCase() === s.nome.toLowerCase()),
  )
  const ligados = (lista: readonly string[]) => lista.filter(t => rasc.tamanhos.includes(t)).length
  const contaDeLigados = (lista: readonly string[]) => {
    const n = ligados(lista)
    return n === 0 ? 'nenhum ligado' : `${n} de ${lista.length} ligados`
  }

  return (
    <div className="pd-ficha" data-ficha="editar">
      <div className="pd-ficha-topo" ref={guardarLugar('topo')}>
        <div className="pd-ficha-nome">
          <Trilha grupo={grupo} fim="editando a referência" />
          <h2>{rasc.nome.trim() || r.nome}</h2>
          <p>{r.cod || 'sem código'} · o que mudar aqui vale para os próximos orçamentos</p>
        </div>
        <div className="fileira">
          <Botao onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao tom="primario" carregando={salvando} onClick={() => void salvar()}>
            Salvar referência
          </Botao>
        </div>
      </div>

      {erro ? (
        <Aviso tom="brand" titulo="Ainda não deu para salvar">
          {erro.texto}
        </Aviso>
      ) : null}

      <div className="pd-dois">
        <section className="cartao pd-col" data-cartao="identificacao" ref={guardarLugar('identificacao')}>
          <div className="pd-topo">
            <TituloCartao icone={IdentificationCard}>Identificação</TituloCartao>
          </div>
          <div className="pd-corpo">
            <Campo rotulo="Nome da peça">
              <Entrada
                value={rasc.nome}
                maxLength={120}
                onChange={e => mudar({ nome: e.currentTarget.value })}
              />
            </Campo>
            <p className="pd-nota">
              {r.cod ? (
                <>
                  O código é <b>{r.cod}</b> e não muda
                  {grupo ? `: ${grupo.cod} · ${grupo.nome}` : ''}
                  {NOME_DO_GENERO[r.genero] ? ', ' + NOME_DO_GENERO[r.genero] : ''}. Ele já está em
                  orçamento e em pedido. Para outro código, duplique a referência.
                </>
              ) : (
                'Esta referência está sem código. Ele se arruma em Configurações, Banco de dados, Referências.'
              )}
            </p>
          </div>
        </section>

        <section className="cartao pd-col" data-cartao="grade" ref={guardarLugar('grade')}>
          <div className="pd-topo">
            <TituloCartao icone={GridFour}>Grade</TituloCartao>
          </div>
          <div className="pd-corpo">
            {(
              [
                ['Adulta', TAMANHOS_ADULTO],
                ['Infantil', TAMANHOS_INFANTIL],
              ] as [string, readonly string[]][]
            ).map(([nome, lista]) => (
              <div className="pd-campo" key={nome}>
                <span className="pd-campo-topo">
                  {nome} <small>{contaDeLigados(lista)}</small>
                </span>
                <div className="pd-tamanhos" role="group" aria-label={'Grade ' + nome.toLowerCase()}>
                  {lista.map(t => (
                    <button
                      type="button"
                      key={t}
                      className={rasc.tamanhos.includes(t) ? 'pd-tam on' : 'pd-tam'}
                      aria-pressed={rasc.tamanhos.includes(t)}
                      onClick={() => virarTamanho(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="pd-nota">
              Tamanho desligado não aparece nas tabelas de medidas e de tecido desta peça.
            </p>
          </div>
        </section>
      </div>

      <div className="pd-dois">
        <section className="cartao pd-col" data-cartao="molde">
          <div className="pd-topo">
            <TituloCartao icone={Scissors}>Molde</TituloCartao>
            {moldeNovo !== undefined ? <span className="pd-topo-n">sobe ao salvar</span> : null}
          </div>
          <div className="pd-corpo">
            {moldeAVista ? <DesenhoDoMolde svg={moldeAVista} nome={r.nome} /> : null}
            <SoltarOMolde
              arquivo={arquivo}
              baixa
              texto={moldeAVista ? 'Para trocar, solte aqui outro SVG, ou' : 'Solte aqui o SVG do molde, ou'}
            />
            {arquivo.campo}
            <div className="pd-campo">
              <span className="pd-campo-topo">
                Partes do molde <small>e quantas vezes cada uma é cortada</small>
              </span>
              <div className="pd-partes">
                {rasc.partes.map(p => (
                  <span className="pd-tag" key={p.chave}>
                    <button
                      type="button"
                      className="pd-tag-nome"
                      aria-label={'Mudar a parte ' + p.nome}
                      onClick={() =>
                        setParteAberta({ chave: p.chave, nome: p.nome, vezes: p.vezes, unidade: p.unidade })
                      }
                    >
                      {p.nome} {p.vezes}x
                    </button>
                    <button
                      type="button"
                      className="pd-tag-tira"
                      aria-label={'Tirar ' + p.nome}
                      onClick={() => mudar({ partes: rasc.partes.filter(x => x.chave !== p.chave) })}
                    >
                      <X size={11} weight="bold" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <Botao
                  tamanho="sm"
                  onClick={() => setParteAberta({ nome: '', vezes: '1', unidade: 'm2' })}
                >
                  <Plus size={14} aria-hidden="true" />
                  Parte
                </Botao>
              </div>
            </div>
          </div>
        </section>

        <section className="cartao pd-col" data-cartao="detalhes" ref={guardarLugar('detalhes')}>
          <div className="pd-topo">
            <TituloCartao icone={TShirt}>Detalhes da peça</TituloCartao>
          </div>
          <div className="pd-corpo">
            <div className="pd-form">
              {DETALHES.map(d => (
                <Campo rotulo={d.nome} key={d.chave} className={d.chave === 'costura' ? 'pd-inteiro' : ''}>
                  <Entrada
                    value={rasc.detalhes[d.chave]}
                    maxLength={200}
                    placeholder={d.exemplo}
                    onChange={e =>
                      mudar({ detalhes: { ...rasc.detalhes, [d.chave]: e.currentTarget.value } })
                    }
                  />
                </Campo>
              ))}
              <Campo rotulo="Observação para a costura" className="pd-inteiro">
                <AreaTexto
                  rows={3}
                  value={rasc.observacao}
                  maxLength={2000}
                  onChange={e => mudar({ observacao: e.currentTarget.value })}
                />
              </Campo>
            </div>
            <p className="pd-nota">{SEM_ETIQUETA}</p>
          </div>
        </section>
      </div>

      <section
        className="cartao pd-col"
        data-modulo-ed={aba}
        ref={el => {
          lugares.current.medidas = el
          lugares.current.tecido = el
        }}
      >
        <TopoDoModulo
          aba={aba}
          aoTrocarAba={setAba}
          faixas={grade.faixas}
          faixa={grade.faixa}
          aoTrocarFaixa={grade.setFaixa}
        />

        {aba === 'medidas' ? (
          <>
            {rasc.medidas.length ? (
              <div className="pd-grade-rola">
                <table className="pd-grade pd-ed" aria-label="Tabela de medidas, em centímetros">
                  <thead>
                    <tr>
                      <th scope="col">Medida, em cm</th>
                      {grade.tamanhos.map(t => (
                        <th scope="col" key={t}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rasc.medidas.map((m, i) => (
                      <tr
                        key={m.chave}
                        data-medida={m.chave}
                        className={alcaPresa === m.chave ? 'presa' : undefined}
                      >
                        <th scope="row">
                          <div className="pd-med-nome">
                            <button
                              type="button"
                              className="pd-pega"
                              aria-label={
                                'Mudar a ordem de ' + (m.nome || 'medida') + '. Arraste, ou use as setas para cima e para baixo.'
                              }
                              onPointerDown={e => pegar(e, m.chave)}
                              onKeyDown={e => {
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault()
                                  moverMedida(i, i - 1)
                                } else if (e.key === 'ArrowDown') {
                                  e.preventDefault()
                                  moverMedida(i, i + 1)
                                }
                              }}
                            >
                              <DotsSixVertical size={16} weight="bold" aria-hidden="true" />
                            </button>
                            <Entrada
                              tamanho="sm"
                              className="pd-nome-da-medida"
                              value={m.nome}
                              maxLength={60}
                              placeholder="nome da medida"
                              aria-label="Nome da medida"
                              onChange={e => mudarMedida(m.chave, { nome: e.currentTarget.value })}
                            />
                            <Botao
                              tom="limpo"
                              tamanho="sm"
                              icone
                              aria-label={'Tirar a medida ' + m.nome}
                              onClick={() => mudar({ medidas: rasc.medidas.filter(x => x.chave !== m.chave) })}
                            >
                              <Trash size={16} aria-hidden="true" />
                            </Botao>
                          </div>
                          <Entrada
                            tamanho="sm"
                            className="pd-como"
                            value={m.comoMedir}
                            maxLength={120}
                            placeholder="como medir (se quiser)"
                            aria-label={'Como medir ' + m.nome}
                            onChange={e => mudarMedida(m.chave, { comoMedir: e.currentTarget.value })}
                          />
                        </th>
                        {grade.tamanhos.map((t, k) => (
                          <Celula
                            key={t}
                            valor={m.valores[t] ?? ''}
                            rotulo={(m.nome || 'Medida') + ' no ' + t}
                            aoMudar={v => mudarMedida(m.chave, { valores: { ...m.valores, [t]: v } })}
                            aoColar={matriz => colarNasMedidas(i, k, matriz)}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="pd-corpo">
              <div className="pd-campo">
                <span className="pd-campo-topo">
                  Adicionar medida <small>toque numa sugestão ou escreva o nome</small>
                </span>
                {sugestoes.length ? (
                  <div className="pd-chips-soltos">
                    {sugestoes.map(s => (
                      <Chip key={s.nome} onClick={() => adicionarMedida(s.nome, s.comoMedir)}>
                        <span className="pd-rotulo-com-icone">
                          <Plus size={14} aria-hidden="true" />
                          {s.nome}
                        </span>
                      </Chip>
                    ))}
                  </div>
                ) : null}
                <div className="pd-outra">
                  <Entrada
                    value={novaMedida}
                    maxLength={60}
                    placeholder="Nome de outra medida, por exemplo: Altura do bolso"
                    aria-label="Nome de outra medida"
                    onChange={e => setNovaMedida(e.currentTarget.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') adicionarMedida(novaMedida)
                    }}
                  />
                  <Botao tom="forte" onClick={() => adicionarMedida(novaMedida)}>
                    <Plus size={16} aria-hidden="true" />
                    Adicionar
                  </Botao>
                </div>
              </div>
              <div className="fileira">
                <Botao tamanho="sm" onClick={() => setCopiando('medidas')}>
                  <Copy size={14} aria-hidden="true" />
                  Copiar as medidas de outra referência
                </Botao>
              </div>
              <p className="pd-nota">
                Não tem limite de medidas, e cada referência tem as dela: uma calça leva cintura, quadril,
                gancho e entrepernas. Arraste pela alça para mudar a ordem, troque o nome no próprio campo e
                tire pela lixeira. Campo vermelho é tamanho ligado que ainda está sem número. Dá para colar
                um bloco copiado de uma planilha: clique no primeiro campo e cole.
              </p>
            </div>
          </>
        ) : (
          <>
            {naTabela.length ? (
              <div className="pd-grade-rola">
                <table className="pd-grade pd-ed" aria-label="Tecido por parte do molde, em cada tamanho">
                  <thead>
                    <tr>
                      <th scope="col">Parte do molde, em m²</th>
                      {grade.tamanhos.map(t => (
                        <th scope="col" key={t}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pano.map(p => linhaDaParte(p))}
                    {pano.length ? (
                      <>
                        <tr className="soma" data-linha="soma">
                          <th scope="row">
                            <b>A peça inteira</b>
                            <small>em m², só o pano, já com a perda do corte</small>
                          </th>
                          {areas.map((a, k) => (
                            <td key={grade.tamanhos[k]} className={a === null ? 'sem' : undefined}>
                              {a === null ? '·' : emArea(a, casasDaArea(areas))}
                            </td>
                          ))}
                        </tr>
                        {linhasDeConta(areas, conta.tecido).map(l => (
                          <tr className="apagada" key={l.chave} data-linha={l.chave}>
                            <th scope="row">
                              <small>{l.nome}</small>
                            </th>
                            {l.valores.map((v, k) => (
                              <td key={grade.tamanhos[k]} className={v ? undefined : 'sem'}>
                                {v || '·'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ) : null}
                    {fita.map(p => linhaDaParte(p))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="pd-corpo">
              <div className="fileira">
                <Botao tamanho="sm" onClick={() => setParteAberta({ nome: '', vezes: '1', unidade: 'm2' })}>
                  <Plus size={14} aria-hidden="true" />
                  Parte do molde
                </Botao>
                <Botao tamanho="sm" onClick={() => setCopiando('tecido')}>
                  <Copy size={14} aria-hidden="true" />
                  Copiar o tecido de outra referência
                </Botao>
              </div>
              {pano.length ? <EscolhaDoTecidoDeConta conta={conta} /> : null}
              <p className="pd-nota">
                Só se digita a área de cada parte, em m², já com a perda do corte. A soma, os metros e os
                gramas o sistema calcula, com a largura e a gramatura do tecido escolhido no orçamento.
                Campo vermelho é tamanho ligado que ainda está sem número. Dá para colar um bloco copiado de
                uma planilha.
              </p>
            </div>
          </>
        )}
      </section>

      <div className={podeExcluir ? 'pd-dois largo-estreito' : 'pd-dois um'}>
        <section className="cartao pd-col" data-cartao="aviamentos" ref={guardarLugar('materiais')}>
          <div className="pd-topo">
            <TituloCartao icone={Needle}>Aviamentos e insumos por peça</TituloCartao>
            <span className="pd-topo-n">vêm do Estoque</span>
          </div>
          {rasc.materiais.map(m => (
            <div className="pd-lin" key={m.chave} data-material={m.nome}>
              <span className="pd-txt">
                <b>{m.nome}</b>
                <small>{apoioDoMaterial(m.materialId, doEstoque)}</small>
              </span>
              <span className={campoComErro(m.quantidade) ? 'pd-qtd-ed erro' : 'pd-qtd-ed'}>
                <Entrada
                  tamanho="sm"
                  inputMode="decimal"
                  autoComplete="off"
                  value={m.quantidade}
                  placeholder="0"
                  aria-label={'Quanto de ' + m.nome + ' por peça'}
                  onChange={e => mudarMaterial(m.chave, e.currentTarget.value)}
                />
                <small>{m.unidade}</small>
              </span>
              <Botao
                tom="limpo"
                tamanho="sm"
                icone
                aria-label={'Tirar ' + m.nome}
                onClick={() => mudar({ materiais: rasc.materiais.filter(x => x.chave !== m.chave) })}
              >
                <Trash size={16} aria-hidden="true" />
              </Botao>
            </div>
          ))}
          <div className="pd-corpo">
            {doEstoque.length ? (
              <Seletor
                campo
                bloco
                comBusca
                valor=""
                vazio="Adicionar um material do Estoque"
                opcoes={livres.map(m => ({
                  valor: m.id,
                  rotulo: m.grupo ? `${m.nome} · ${m.grupo}` : m.nome,
                }))}
                aoEscolher={adicionarDoEstoque}
              />
            ) : (
              <p className="pd-nota">O Estoque ainda não tem aviamento nem insumo cadastrado.</p>
            )}
            <div className="pd-campo">
              <span className="pd-campo-topo">
                Ou pelo nome <small>para o que muda com a cor da peça, como a linha</small>
              </span>
              <div className="pd-outro-material">
                <Entrada
                  value={outroNome}
                  maxLength={120}
                  placeholder="Linha, na cor do tecido"
                  aria-label="Nome do aviamento"
                  onChange={e => setOutroNome(e.currentTarget.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') adicionarPeloNome()
                  }}
                />
                <Entrada
                  value={outraUnidade}
                  maxLength={12}
                  placeholder="un"
                  aria-label="Unidade"
                  onChange={e => setOutraUnidade(e.currentTarget.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') adicionarPeloNome()
                  }}
                />
                <Botao onClick={adicionarPeloNome}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar
                </Botao>
              </div>
            </div>
          </div>
        </section>

        {podeExcluir ? (
          <section className="cartao pd-col" data-cartao="excluir">
            <div className="pd-topo">
              <TituloCartao icone={Trash}>Excluir a referência</TituloCartao>
            </div>
            <div className="pd-corpo">
              <p className="pd-nota">
                {emKits ? (
                  <>
                    Esta referência está em <b>{plural(emKits, 'kit', 'kits')}</b>.{' '}
                  </>
                ) : null}
                Excluir tira a peça das listas{emKits ? ' e do kit' : ''}, junto com a ficha, o molde e o
                tecido medido dela. Os orçamentos que já foram feitos continuam como estão.
              </p>
              <div className="fileira">
                <Botao tom="perigo" onClick={() => setExcluindo(true)}>
                  <Trash size={16} aria-hidden="true" />
                  Excluir a referência
                </Botao>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <ParteDoMolde
        parte={parteAberta}
        outras={rasc.partes.filter(p => p.chave !== parteAberta?.chave).map(p => p.nome)}
        aoFechar={() => setParteAberta(null)}
        aoGuardar={guardarParte}
        aoTirar={chave => {
          mudar({ partes: rasc.partes.filter(p => p.chave !== chave) })
          setParteAberta(null)
        }}
      />
      <CopiarDeOutra
        oQue={copiando}
        de={copiando === 'tecido' ? comTecido : comMedidas}
        aoFechar={() => setCopiando(null)}
        aoCopiar={copiar}
      />
      <Modal
        aberto={excluindo}
        aoFechar={() => setExcluindo(false)}
        titulo={'Excluir ' + r.nome + '?'}
        pe={
          <>
            <Botao onClick={() => setExcluindo(false)} disabled={apagando}>
              Manter
            </Botao>
            <Botao tom="perigo" carregando={apagando} onClick={() => void excluir()}>
              Excluir
            </Botao>
          </>
        }
      >
        <p className="pd-nota">
          A referência {r.cod} sai das listas{emKits ? ' e de ' + plural(emKits, 'kit', 'kits') : ''}, e a
          ficha técnica dela vai junto: as medidas, o tecido, os aviamentos e o molde. Isso não volta atrás. Os orçamentos que já foram feitos continuam como estão.
        </p>
      </Modal>
    </div>
  )
}
