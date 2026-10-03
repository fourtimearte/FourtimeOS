import { chamar, tabela } from '@shared/supabase'
import { semAcento } from '@shared'
import { cnpjValido, limparCnpj } from './cnpj'

/* ==========================================================================
   Os fornecedores.

   De quem a Fourtime compra. Tecido, aviamento, insumo, frete e serviço: todo
   fornecedor que entra por qualquer página mora aqui, e as páginas que
   precisam dele (o estoque na entrada, o verificador de boleto na
   conferência) leem deste arquivo.

   A SITUAÇÃO É A TRAVA CONTRA BOLETO FALSO. Confiável é quem o administrador
   aprovou, e é a lista que o verificador consulta. Bloqueado é quem nunca
   mais passa. Quem marca as duas é só o administrador, e quem cobra isso é um
   gatilho no banco (041): a tela só não oferece o botão a quem o banco ia
   recusar.

   "SEM CNPJ" NÃO É SITUAÇÃO GRAVADA, é o que a tela mostra quando o CNPJ
   está vazio. O banco guarda novo, esperando, confiável e bloqueado; a falta
   do CNPJ é um fato do cadastro, e escrever o mesmo fato em dois campos é o
   começo de os dois discordarem.
   ========================================================================== */

export type SituacaoGravada = 'novo' | 'esperando' | 'confiavel' | 'bloqueado'
export type Situacao = SituacaoGravada | 'sem-cnpj'
export type EntrouPor = 'cadastro' | 'estoque' | 'entrega' | 'boleto'

export const NOME_DA_SITUACAO: Record<Situacao, string> = {
  confiavel: 'Confiável',
  novo: 'Novo',
  esperando: 'Esperando aprovação',
  'sem-cnpj': 'Sem CNPJ',
  bloqueado: 'Bloqueado',
}

/* A cor do ponto da situação. Verde é quem já foi aprovado, âmbar é o que
   pede atenção de alguém, vermelho é o que nunca passa, e o novo fica neutro:
   ele não é problema, só ainda não foi olhado. */
export const COR_DA_SITUACAO: Record<Situacao, string> = {
  confiavel: 'var(--ok)',
  novo: 'var(--text-3)',
  esperando: 'var(--warn)',
  'sem-cnpj': 'var(--warn)',
  bloqueado: 'var(--brand)',
}

export const NOME_DA_ENTRADA: Record<EntrouPor, string> = {
  cadastro: 'Cadastro',
  estoque: 'Estoque',
  entrega: 'Entrega',
  boleto: 'Verificador de Boleto',
}

export type TipoDeFornecedor = { chave: string; nome: string; ordem: number; fixo: boolean }

/** O que a Receita respondeu no dia da consulta. */
export type NaReceita = {
  razaoSocial: string
  situacao: string
  abertura: string
  atividade: string
  cidade: string
  uf: string
  consultadoEm: string
}

export type Fornecedor = {
  id: string
  nome: string
  razaoSocial: string
  /** só os 14 caracteres, ou vazio */
  cnpj: string
  cidade: string
  uf: string
  contato: string
  pagamento: string
  prazo: string
  /** o que ele fornece quando não é material do estoque */
  oQueFornece: string
  gravada: SituacaoGravada
  entrouPor: EntrouPor
  receita: NaReceita | null
  aprovadoPor: string
  aprovadoEm: string
  motivoDoBloqueio: string
  criadoEm: string
  tipos: string[]
  materiais: number
  entradas: number
  ultimaEntrada: string
  boletos: number
  ultimoBoleto: string
}

export { cnpjNaTela, cnpjValido, limparCnpj, mascaraDoCnpj } from './cnpj'

/* ---------- a leitura ----------------------------------------------------- */

type LinhaDaReceita = {
  razao_social?: string
  situacao?: string
  abertura?: string
  atividade?: string
  cidade?: string
  uf?: string
  consultado_em?: string
}

type LinhaDoFornecedor = {
  id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  cidade: string | null
  uf: string | null
  contato: string | null
  pagamento: string | null
  prazo: string | null
  o_que_fornece: string | null
  situacao: SituacaoGravada
  entrou_por: EntrouPor
  receita: LinhaDaReceita | null
  aprovado_por_nome?: string | null
  aprovado_em: string | null
  motivo_do_bloqueio: string | null
  criado_em: string
  tipos?: string[] | null
  materiais?: number | string | null
  entradas?: number | string | null
  ultima_entrada?: string | null
  boletos?: number | string | null
  ultimo_boleto?: string | null
}

function daReceita(r: LinhaDaReceita | null): NaReceita | null {
  if (!r) return null
  return {
    razaoSocial: r.razao_social ?? '',
    situacao: r.situacao ?? '',
    abertura: r.abertura ?? '',
    atividade: r.atividade ?? '',
    cidade: r.cidade ?? '',
    uf: r.uf ?? '',
    consultadoEm: r.consultado_em ?? '',
  }
}

function paraReceita(r: NaReceita | null): LinhaDaReceita | null {
  if (!r) return null
  return {
    razao_social: r.razaoSocial,
    situacao: r.situacao,
    abertura: r.abertura,
    atividade: r.atividade,
    cidade: r.cidade,
    uf: r.uf,
    consultado_em: r.consultadoEm,
  }
}

function deLinha(l: LinhaDoFornecedor): Fornecedor {
  return {
    id: l.id,
    nome: l.nome,
    razaoSocial: l.razao_social ?? '',
    cnpj: l.cnpj ?? '',
    cidade: l.cidade ?? '',
    uf: l.uf ?? '',
    contato: l.contato ?? '',
    pagamento: l.pagamento ?? '',
    prazo: l.prazo ?? '',
    oQueFornece: l.o_que_fornece ?? '',
    gravada: l.situacao,
    entrouPor: l.entrou_por,
    receita: daReceita(l.receita),
    aprovadoPor: l.aprovado_por_nome ?? '',
    aprovadoEm: l.aprovado_em ?? '',
    motivoDoBloqueio: l.motivo_do_bloqueio ?? '',
    criadoEm: l.criado_em,
    tipos: l.tipos ?? [],
    materiais: Number(l.materiais ?? 0) || 0,
    entradas: Number(l.entradas ?? 0) || 0,
    ultimaEntrada: l.ultima_entrada ?? '',
    boletos: Number(l.boletos ?? 0) || 0,
    ultimoBoleto: l.ultimo_boleto ?? '',
  }
}

export async function carregarFornecedores(): Promise<Fornecedor[]> {
  const linhas = await tabela<LinhaDoFornecedor[]>('fornecedor_na_lista?select=*&order=nome.asc')
  return linhas.map(deLinha)
}

export async function carregarTiposDeFornecedor(): Promise<TipoDeFornecedor[]> {
  return tabela<TipoDeFornecedor[]>('tipo_de_fornecedor?select=chave,nome,ordem,fixo&order=ordem.asc,nome.asc')
}

/** Qual fornecedor entrega qual material. */
export type Ligacao = { materialId: string; fornecedorId: string; criadoEm: string }

export async function carregarLigacoes(): Promise<Ligacao[]> {
  const linhas = await tabela<{ material_id: string; fornecedor_id: string; criado_em: string }[]>(
    'material_fornecedor?select=material_id,fornecedor_id,criado_em&order=criado_em.asc',
  )
  return linhas.map((l) => ({
    materialId: l.material_id,
    fornecedorId: l.fornecedor_id,
    criadoEm: l.criado_em,
  }))
}

/* O ESTOQUE NÃO PODE CAIR PORQUE A LISTA DE FORNECEDORES NÃO VEIO. Quem
   abre o estoque quer saber se tem ou não tem; o fornecedor é apoio. Então a
   página dele pede os fornecedores por aqui, e uma falha vira lista vazia em
   vez de tela de erro. A página de Fornecedores usa as funções de cima, que
   gritam, porque lá a lista é o assunto. */
export async function fornecedoresParaOEstoque(): Promise<{
  fornecedores: Fornecedor[]
  ligacoes: Ligacao[]
  disponivel: boolean
}> {
  try {
    const [fornecedores, ligacoes] = await Promise.all([carregarFornecedores(), carregarLigacoes()])
    return { fornecedores, ligacoes, disponivel: true }
  } catch {
    return { fornecedores: [], ligacoes: [], disponivel: false }
  }
}

/** A última entrada de cada material que este fornecedor entregou. */
export async function ultimasEntradasDoFornecedor(id: string): Promise<Map<string, string>> {
  const fora = new Map<string, string>()
  try {
    const linhas = await tabela<{ material_id: string; quando: string }[]>(
      `movimento_do_estoque?select=material_id,quando&fornecedor_id=eq.${id}&order=quando.desc&limit=300`,
    )
    for (const l of linhas) if (!fora.has(l.material_id)) fora.set(l.material_id, l.quando)
  } catch {
    /* a ficha abre sem as datas: elas são apoio, e não o assunto */
  }
  return fora
}

/* ---------- as regras de leitura ------------------------------------------ */

/* A ordem das perguntas importa: bloqueado ganha de tudo, esperando ganha do
   CNPJ vazio (alguém já pediu a decisão), e o CNPJ vazio ganha de confiável e
   de novo, porque sem CNPJ o verificador não tem como reconhecer o boleto. */
export function situacaoDe(f: Pick<Fornecedor, 'gravada' | 'cnpj'>): Situacao {
  if (f.gravada === 'bloqueado') return 'bloqueado'
  if (f.gravada === 'esperando') return 'esperando'
  if (!f.cnpj) return 'sem-cnpj'
  return f.gravada
}

export function ondeFica(f: Pick<Fornecedor, 'cidade' | 'uf'>): string {
  if (f.cidade && f.uf) return `${f.cidade}, ${f.uf}`
  return f.cidade || f.uf
}

/** "entrada em 24/09/2026", "boleto em 02/10/2026" ou "nenhum ainda". */
export function ultimoMovimentoDe(f: Fornecedor): string {
  const dia = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const entrada = f.ultimaEntrada ? new Date(f.ultimaEntrada).getTime() : 0
  const boleto = f.ultimoBoleto ? new Date(f.ultimoBoleto).getTime() : 0
  if (!entrada && !boleto) return 'nenhum ainda'
  return entrada >= boleto ? 'entrada em ' + dia(f.ultimaEntrada) : 'boleto em ' + dia(f.ultimoBoleto)
}

export function combinaComFornecedor(f: Fornecedor, termo: string): boolean {
  const t = semAcento(termo.trim())
  if (!t) return true
  const so = limparCnpj(termo)
  return (
    semAcento(f.nome).includes(t) ||
    semAcento(f.razaoSocial).includes(t) ||
    semAcento(f.oQueFornece).includes(t) ||
    semAcento(f.cidade).includes(t) ||
    (so.length >= 3 && f.cnpj.includes(so))
  )
}

/* ---------- a escrita ----------------------------------------------------- */

export type FornecedorNovo = {
  nome: string
  razaoSocial?: string
  cnpj?: string
  cidade?: string
  uf?: string
  contato?: string
  pagamento?: string
  prazo?: string
  oQueFornece?: string
  receita?: NaReceita | null
  entrouPor?: EntrouPor
  /** só o administrador consegue: o banco recusa de qualquer outro */
  confiavel?: boolean
  tipos?: string[]
  materiais?: string[]
}

function corpoDoCadastro(f: Partial<FornecedorNovo>): Record<string, unknown> {
  const corpo: Record<string, unknown> = {}
  if (f.nome !== undefined) corpo.nome = f.nome.trim()
  if (f.razaoSocial !== undefined) corpo.razao_social = f.razaoSocial.trim()
  if (f.cnpj !== undefined) corpo.cnpj = limparCnpj(f.cnpj) || null
  if (f.cidade !== undefined) corpo.cidade = f.cidade.trim()
  if (f.uf !== undefined) corpo.uf = f.uf.trim().toUpperCase()
  if (f.contato !== undefined) corpo.contato = f.contato.trim()
  if (f.pagamento !== undefined) corpo.pagamento = f.pagamento.trim()
  if (f.prazo !== undefined) corpo.prazo = f.prazo.trim()
  if (f.oQueFornece !== undefined) corpo.o_que_fornece = f.oQueFornece.trim()
  if (f.receita !== undefined) corpo.receita = paraReceita(f.receita)
  return corpo
}

async function gravarTipos(id: string, tipos: string[]): Promise<void> {
  await tabela<void>(`fornecedor_tipo?fornecedor_id=eq.${id}`, { metodo: 'DELETE' })
  if (!tipos.length) return
  await tabela<void>('fornecedor_tipo', {
    metodo: 'POST',
    corpo: tipos.map((tipo) => ({ fornecedor_id: id, tipo })),
  })
}

async function gravarMateriais(id: string, materiais: string[]): Promise<void> {
  await tabela<void>(`material_fornecedor?fornecedor_id=eq.${id}`, { metodo: 'DELETE' })
  if (!materiais.length) return
  await tabela<void>('material_fornecedor', {
    metodo: 'POST',
    corpo: materiais.map((material_id) => ({ fornecedor_id: id, material_id })),
  })
}

export async function criarFornecedor(f: FornecedorNovo): Promise<string> {
  const linhas = await tabela<{ id: string }[]>('fornecedor?select=id', {
    metodo: 'POST',
    devolver: true,
    corpo: {
      ...corpoDoCadastro(f),
      situacao: f.confiavel ? 'confiavel' : 'novo',
      entrou_por: f.entrouPor ?? 'cadastro',
    },
  })
  const id = linhas[0]?.id ?? ''
  if (!id) throw new Error('O banco não confirmou a gravação do fornecedor.')
  if (f.tipos?.length) await gravarTipos(id, f.tipos)
  if (f.materiais?.length) await gravarMateriais(id, f.materiais)
  return id
}

export async function salvarFornecedor(
  id: string,
  f: Partial<FornecedorNovo> & { situacao?: SituacaoGravada; motivoDoBloqueio?: string },
): Promise<void> {
  const corpo = corpoDoCadastro(f)
  if (f.situacao !== undefined) corpo.situacao = f.situacao
  if (f.motivoDoBloqueio !== undefined) corpo.motivo_do_bloqueio = f.motivoDoBloqueio.trim()
  if (Object.keys(corpo).length) {
    /* devolver: a linha que volta é a prova de que gravou. Uma regra de
       acesso que recusa em silêncio pareceria sucesso na tela. */
    const linhas = await tabela<{ id: string }[]>(`fornecedor?id=eq.${id}&select=id`, {
      metodo: 'PATCH',
      devolver: true,
      corpo,
    })
    if (!linhas?.length) throw new Error('Seu acesso não permite mudar este fornecedor.')
  }
  if (f.tipos !== undefined) await gravarTipos(id, f.tipos)
  if (f.materiais !== undefined) await gravarMateriais(id, f.materiais)
}

export async function ligarMaterialAoFornecedor(materialId: string, fornecedorId: string): Promise<void> {
  await tabela<void>('material_fornecedor?on_conflict=material_id,fornecedor_id', {
    metodo: 'POST',
    mesclar: true,
    corpo: { material_id: materialId, fornecedor_id: fornecedorId },
  })
}

export async function desligarMaterialDoFornecedor(materialId: string, fornecedorId: string): Promise<void> {
  await tabela<void>(`material_fornecedor?material_id=eq.${materialId}&fornecedor_id=eq.${fornecedorId}`, {
    metodo: 'DELETE',
  })
}

export async function juntarFornecedores(ficaId: string, someId: string): Promise<void> {
  await chamar('juntar_fornecedores', { p_fica: ficaId, p_some: someId })
}

/* A chave do tipo sai do nome: "Lavanderia e tinturaria" vira
   lavanderia_e_tinturaria. O banco só aceita letra minúscula, número e
   sublinhado, porque a chave vai em endereço e em comparação. */
export async function criarTipoDeFornecedor(nome: string, ordem: number): Promise<TipoDeFornecedor> {
  const limpo = nome.trim()
  const chave = semAcento(limpo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!chave) throw new Error('Escreva o nome do tipo.')
  const linhas = await tabela<TipoDeFornecedor[]>('tipo_de_fornecedor?select=chave,nome,ordem,fixo', {
    metodo: 'POST',
    devolver: true,
    corpo: { chave, nome: limpo, ordem },
  })
  if (!linhas.length) throw new Error('O banco não confirmou a gravação do tipo.')
  return linhas[0]
}

export async function apagarTipoDeFornecedor(chave: string): Promise<void> {
  await tabela<void>(`tipo_de_fornecedor?chave=eq.${chave}`, { metodo: 'DELETE' })
}

/* ---------- a Receita ----------------------------------------------------- */

type RespostaDaBrasilApi = {
  razao_social?: string
  nome_fantasia?: string
  descricao_situacao_cadastral?: string
  data_inicio_atividade?: string
  cnae_fiscal_descricao?: string
  municipio?: string
  uf?: string
}

function comInicialMaiuscula(texto: string): string {
  const miudas = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && miudas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

/* A CONSULTA SAI DO NAVEGADOR DE QUEM ESTÁ CONFERINDO, direto para a
   BrasilAPI, que espelha o cadastro público da Receita. Ela é de graça, não
   pede chave e não passa pelo banco da Fourtime.

   ELA PODE NÃO RESPONDER, e isso não é erro de digitação: serviço público de
   graça cai e limita. Por isso a falta de resposta volta como `null` com o
   motivo, e quem chama decide o que fazer: o cadastro deixa gravar sem a
   Receita, e o verificador marca a conferência como "não deu para conferir". */
export async function consultarNaReceita(
  cnpj: string,
): Promise<{ receita: NaReceita; nomeFantasia: string } | { receita: null; motivo: string }> {
  const c = limparCnpj(cnpj)
  if (!cnpjValido(c)) return { receita: null, motivo: 'O CNPJ não fecha a conta dos dígitos.' }
  let resposta: Response
  try {
    resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    return { receita: null, motivo: 'Não consegui falar com a consulta da Receita.' }
  }
  if (resposta.status === 404) {
    return { receita: null, motivo: 'A Receita não tem este CNPJ.' }
  }
  if (!resposta.ok) {
    return { receita: null, motivo: 'A consulta da Receita não respondeu agora.' }
  }
  const r = (await resposta.json().catch(() => null)) as RespostaDaBrasilApi | null
  if (!r || !r.razao_social) {
    return { receita: null, motivo: 'A consulta da Receita respondeu algo que não consegui ler.' }
  }
  return {
    nomeFantasia: r.nome_fantasia ? comInicialMaiuscula(r.nome_fantasia) : '',
    receita: {
      razaoSocial: r.razao_social,
      situacao: comInicialMaiuscula(r.descricao_situacao_cadastral ?? ''),
      abertura: r.data_inicio_atividade ?? '',
      atividade: r.cnae_fiscal_descricao ?? '',
      cidade: comInicialMaiuscula(r.municipio ?? ''),
      uf: (r.uf ?? '').toUpperCase(),
      consultadoEm: new Date().toISOString(),
    },
  }
}

/** "Ativa desde 2011", "Baixada", ou vazio quando não houve consulta. */
export function resumoDaReceita(r: NaReceita | null): string {
  if (!r || !r.situacao) return ''
  const ano = r.abertura ? r.abertura.slice(0, 4) : ''
  return ano ? `${r.situacao} desde ${ano}` : r.situacao
}

/* DOIS NOMES SÃO O MESMO quando, tirando acento, pontuação e o tipo de
   sociedade do fim, sobra o mesmo texto. "MALHARIA EXEMPLO LTDA." e
   "Malharia Exemplo Ltda" são a mesma empresa; "Malharia Exemplo" e
   "Malharia Exemplar" não. É de propósito uma comparação dura: no boleto, um
   nome parecido com o de um fornecedor conhecido é exatamente o golpe. */
export function mesmoNome(a: string, b: string): boolean {
  const limpo = (t: string) =>
    semAcento(t)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\b(ltda|me|epp|eireli|s a|sa|s\/a|cia|mei)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const x = limpo(a)
  const y = limpo(b)
  return !!x && x === y
}
