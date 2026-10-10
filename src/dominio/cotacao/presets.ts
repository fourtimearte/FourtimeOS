import { tabela } from '@shared/supabase'

/* ==========================================================================
   OS PRESETS DE IMPRESSÃO DA FOLHA A4 (wireframe de 11/10/2026, pranchas 121
   a 121c, segunda versão).

   Um preset diz o que sai no papel: com valor ou sem valor, que campos o
   cabeçalho mostra, e que módulos ficam de fora, na página 1 e nas páginas de
   layout. Dois por página ou um por página NÃO é do preset, por pedido do
   Henrique: decide-se na hora de imprimir.

   OS DOIS DA FÁBRICA moram aqui, no código: Cliente e Produção são o template
   padrão do FOURTIME OS - 14 e não mudam. Mudança neles vira preset novo. Os
   que alguém salvou moram no banco (migração 059).

   ENQUANTO A 059 NÃO RODOU, eles moram no navegador. A tela abre igual, e o
   rodapé da barra diz onde estão guardados. Não é o lugar certo para "toda a
   equipe", e por isso a tela avisa em vez de fingir.
   ========================================================================== */

/** os campos do cabeçalho: o catálogo inteiro da folha (FOURTIME OS - 14, seção 2), na ordem em que descem */
export const CAMPOS_DO_CABECALHO = [
  { k: 'cliente', r: 'Cliente' },
  { k: 'cnpj', r: 'CPF ou CNPJ' },
  { k: 'pd', r: 'Pedido' },
  { k: 'criada', r: 'Criada em' },
  { k: 'vendedor', r: 'Vendedor' },
  { k: 'contato', r: 'Contato' },
  { k: 'telefone', r: 'Telefone' },
  { k: 'email', r: 'E-mail' },
  { k: 'cidade', r: 'Cidade' },
  { k: 'vale', r: 'Vale até', soComValor: true },
  { k: 'situacao', r: 'Situação' },
  { k: 'prazo', r: 'Prazo' },
  { k: 'pagamento', r: 'Pagamento', soComValor: true },
  { k: 'entrega', r: 'Envio' },
  { k: 'tabela', r: 'Tabela', soComValor: true },
  { k: 'departamento', r: 'Departamento' },
  { k: 'embalagem', r: 'Embalagem' },
  { k: 'envio', r: 'Data de envio' },
  { k: 'pecas', r: 'Peças' },
  { k: 'total', r: 'Total', soComValor: true },
] as const satisfies readonly { k: string; r: string; soComValor?: boolean }[]

export type CampoDoCabecalho = (typeof CAMPOS_DO_CABECALHO)[number]['k']

/** o campo que só existe com valor (sai da folha sem valor, mesmo marcado) */
export function soComValor(k: string): boolean {
  return CAMPOS_DO_CABECALHO.some((c) => c.k === k && 'soComValor' in c && c.soComValor)
}

/** os módulos que se tiram da folha. O cabeçalho, o cabeçalho do layout e o rodapé não saem nunca */
export const MODULOS_DA_PAGINA_UM = [
  { k: 'res', r: 'Resumo do orçamento' },
  { k: 'cond', r: 'Condições' },
  { k: 'inf', r: 'Informes e termos' },
  { k: 'ace', r: 'Aceite' },
] as const
export const MODULOS_DO_LAYOUT = [
  { k: 'arte', r: 'Arte' },
  { k: 'dest', r: 'Destaques' },
  { k: 'grade', r: 'Grade' },
  { k: 'ficha', r: 'Ficha' },
  { k: 'fab', r: 'Fabricação' },
  { k: 'avi', r: 'Aviamentos' },
  { k: 'obs', r: 'Observação' },
  { k: 'soma', r: 'Soma' },
] as const
export type ModuloDaFolha =
  | (typeof MODULOS_DA_PAGINA_UM)[number]['k']
  | (typeof MODULOS_DO_LAYOUT)[number]['k']

/** o que a folha precisa saber para desenhar: a parte do preset que muda o papel */
export type VistaDaFolha = {
  valor: boolean
  campos: string[]
  fora: string[]
}

export type AbreEm = '' | 'cliente' | 'producao'

export type PresetDeImpressao = VistaDaFolha & {
  id: string
  nome: string
  /** Cliente e Produção: não mudam, não se apagam, não se renomeiam */
  fabrica: boolean
  /** quem salvou ('' nos da fábrica) */
  dono: string
  /** true: toda a equipe vê; false: só quem salvou */
  equipe: boolean
  abre: AbreEm
  alteradoEm: string
}

export const PRESET_CLIENTE: PresetDeImpressao = {
  id: 'fabrica:cliente',
  nome: 'Cliente',
  fabrica: true,
  dono: '',
  equipe: true,
  abre: 'cliente',
  alteradoEm: '',
  valor: true,
  campos: ['cliente', 'cnpj', 'pd', 'vendedor', 'contato', 'situacao', 'prazo', 'pagamento', 'total'],
  fora: [],
}

export const PRESET_PRODUCAO: PresetDeImpressao = {
  id: 'fabrica:producao',
  nome: 'Produção',
  fabrica: true,
  dono: '',
  equipe: true,
  abre: 'producao',
  alteradoEm: '',
  valor: false,
  campos: ['cliente', 'cnpj', 'pd', 'vendedor', 'contato', 'departamento', 'embalagem', 'envio', 'pecas'],
  fora: [],
}

export const PRESETS_DA_FABRICA = [PRESET_CLIENTE, PRESET_PRODUCAO]

/** a vista de um preset, com as listas na ordem do catálogo e sem repetição */
export function vistaDe(p: VistaDaFolha): VistaDaFolha {
  const ordem = CAMPOS_DO_CABECALHO.map((c) => c.k as string)
  const mods = [...MODULOS_DA_PAGINA_UM, ...MODULOS_DO_LAYOUT].map((m) => m.k as string)
  return {
    valor: p.valor,
    campos: ordem.filter((k) => p.campos.includes(k)),
    fora: mods.filter((k) => p.fora.includes(k)),
  }
}

/* O QUE MUDOU entre a folha de agora e o preset salvo: uma chave por coisa
   trocada. 'valor' quando trocou com e sem valor; a chave do campo ou do
   módulo quando ele entrou ou saiu. É o que pinta o anel âmbar no diagrama e
   conta "N mudanças nesta impressão". */
export function mudancas(agora: VistaDaFolha, salvo: VistaDaFolha): string[] {
  const out: string[] = []
  if (agora.valor !== salvo.valor) out.push('valor')
  const dif = (a: string[], b: string[]) => [...a.filter((k) => !b.includes(k)), ...b.filter((k) => !a.includes(k))]
  for (const k of dif(agora.campos, salvo.campos)) out.push(k)
  for (const k of dif(agora.fora, salvo.fora)) out.push(k)
  return out
}

/* QUAL ABRE SOZINHO. O que a pessoa marcou para aquela folha ganha do da
   fábrica: primeiro o dela, depois o de equipe, o mais novo na frente. Sem
   nenhum marcado, a folha do cliente abre o Cliente e a da produção, o
   Produção. */
export function presetQueAbre(lista: PresetDeImpressao[], para: 'cliente' | 'producao', eu: string): PresetDeImpressao {
  const marcados = lista
    .filter((p) => !p.fabrica && p.abre === para)
    .sort((a, b) => Number(b.dono === eu) - Number(a.dono === eu) || b.alteradoEm.localeCompare(a.alteradoEm))
  return marcados[0] ?? (para === 'producao' ? PRESET_PRODUCAO : PRESET_CLIENTE)
}

/* ==========================================================================
   ONDE OS SALVOS MORAM: no banco (059) e, enquanto ela não rodou, no
   navegador. A primeira leitura decide: a tabela respondeu, é o banco.
   ========================================================================== */
export type OndeMoram = 'banco' | 'navegador'

type LinhaDoPreset = {
  id: string
  dono: string
  nome: string
  equipe: boolean
  valor: boolean
  campos: unknown
  fora: unknown
  abre: string
  alterado_em: string
}

const COLUNAS = 'id,dono,nome,equipe,valor,campos,fora,abre,alterado_em'
const GUARDADOS = 'ft.folha.presets'

const lista = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [])
const abreDe = (x: unknown): AbreEm => (x === 'cliente' || x === 'producao' ? x : '')

function dePreset(l: LinhaDoPreset): PresetDeImpressao {
  return {
    id: l.id,
    nome: l.nome,
    fabrica: false,
    dono: l.dono,
    equipe: !!l.equipe,
    abre: abreDe(l.abre),
    alteradoEm: l.alterado_em ?? '',
    ...vistaDe({ valor: !!l.valor, campos: lista(l.campos), fora: lista(l.fora) }),
  }
}

function paraLinha(p: Omit<PresetDeImpressao, 'id' | 'fabrica' | 'dono' | 'alteradoEm'>) {
  const v = vistaDe(p)
  return { nome: p.nome.trim(), equipe: p.equipe, valor: v.valor, campos: v.campos, fora: v.fora, abre: p.abre }
}

function lerGuardados(): PresetDeImpressao[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(GUARDADOS) ?? '[]') as LinhaDoPreset[]
    return Array.isArray(bruto) ? bruto.map(dePreset) : []
  } catch {
    return []
  }
}

function guardar(lista: PresetDeImpressao[]) {
  try {
    const linhas: LinhaDoPreset[] = lista.map((p) => ({
      id: p.id,
      dono: p.dono,
      nome: p.nome,
      equipe: p.equipe,
      valor: p.valor,
      campos: p.campos,
      fora: p.fora,
      abre: p.abre,
      alterado_em: p.alteradoEm,
    }))
    localStorage.setItem(GUARDADOS, JSON.stringify(linhas))
  } catch {
    /* sem armazenamento: o preset vale até fechar a aba */
  }
}

/** os presets que alguém salvou e esta pessoa enxerga, sem os da fábrica */
export async function carregarPresets(): Promise<{ presets: PresetDeImpressao[]; onde: OndeMoram; falha: string }> {
  try {
    const linhas = await tabela<LinhaDoPreset[]>('preset_de_impressao?select=' + COLUNAS + '&order=nome.asc')
    return { presets: linhas.map(dePreset), onde: 'banco', falha: '' }
  } catch (e) {
    const recado = e instanceof Error ? e.message : String(e)
    /* SÓ A TABELA QUE NÃO EXISTE manda para o navegador: o PostgREST responde
       404 (PGRST205) antes da 059. Internet caída ou sessão vencida não podem
       virar "guardado neste navegador" em silêncio. */
    if (/Não encontrei|schema cache|preset_de_impressao/i.test(recado)) {
      return { presets: lerGuardados(), onde: 'navegador', falha: '' }
    }
    return { presets: [], onde: 'banco', falha: recado }
  }
}

export type PresetNovo = Omit<PresetDeImpressao, 'id' | 'fabrica' | 'dono' | 'alteradoEm'>

export async function criarPreset(p: PresetNovo, onde: OndeMoram, eu: string): Promise<PresetDeImpressao> {
  if (onde === 'banco') {
    const linhas = await tabela<LinhaDoPreset[]>('preset_de_impressao?select=' + COLUNAS, {
      metodo: 'POST',
      corpo: paraLinha(p),
      devolver: true,
    })
    return dePreset(linhas[0])
  }
  const novo: PresetDeImpressao = {
    ...p,
    ...vistaDe(p),
    nome: p.nome.trim(),
    id: 'aqui:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    fabrica: false,
    dono: eu,
    alteradoEm: new Date().toISOString(),
  }
  guardar([...lerGuardados(), novo])
  return novo
}

export async function salvarPreset(p: PresetDeImpressao, onde: OndeMoram): Promise<PresetDeImpressao> {
  if (p.fabrica) throw new Error('Os presets da fábrica não mudam: salve como novo.')
  if (onde === 'banco') {
    const linhas = await tabela<LinhaDoPreset[]>(
      'preset_de_impressao?id=eq.' + encodeURIComponent(p.id) + '&select=' + COLUNAS,
      { metodo: 'PATCH', corpo: paraLinha(p), devolver: true },
    )
    if (!linhas.length) throw new Error('Este preset não é seu: salve como novo.')
    return dePreset(linhas[0])
  }
  const salvo = { ...p, ...vistaDe(p), nome: p.nome.trim(), alteradoEm: new Date().toISOString() }
  guardar(lerGuardados().map((x) => (x.id === p.id ? salvo : x)))
  return salvo
}

export async function apagarPreset(p: PresetDeImpressao, onde: OndeMoram): Promise<void> {
  if (p.fabrica) throw new Error('Os presets da fábrica não se apagam.')
  if (onde === 'banco') {
    await tabela<null>('preset_de_impressao?id=eq.' + encodeURIComponent(p.id), { metodo: 'DELETE' })
    return
  }
  guardar(lerGuardados().filter((x) => x.id !== p.id))
}
