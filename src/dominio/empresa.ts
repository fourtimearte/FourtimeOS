import { chamar, tabela } from '@shared/supabase'
import { mascaraDoCnpj } from './fornecedor/cnpj'
/* ==========================================================================
   Os dados da fábrica, num lugar só.

   Eles aparecem no rodapé de toda folha impressa, no cabeçalho do PDF que vai
   para o cliente e na ficha que vai para o galpão. Estão aqui, e não
   espalhados pelos documentos, para mudarem em um lugar quando mudarem.

   ELES SÃO EDITÁVEIS, e é por isso que EMPRESA é um objeto que se altera por
   dentro em vez de um novo objeto a cada gravação. Toda tela que imprime
   escreve `EMPRESA.cnpj` no meio do desenho; se a gravação trocasse o objeto,
   cada uma dessas telas teria de descobrir sozinha que houve troca. Alterado
   por dentro, o próximo desenho já lê o valor novo, e não existe uma segunda
   cópia em lugar nenhum para divergir da primeira.

   DESDE A 075 ELES MORAM NO BANCO (tabela `empresa`, uma linha só): todo
   mundo lê, quem edita as Configurações grava. O navegador guarda uma cópia
   (`ft.empresa`) para a folha impressa sair certa antes de o banco responder.
   Só este arquivo mudou: quem imprime continua lendo EMPRESA.
   ========================================================================== */

export type DadosDaEmpresa = {
  /** o nome curto, que sai na logo e no rodapé */
  nome: string
  /** a razão social, que é o que vale num documento fiscal */
  razaoSocial: string
  /** a linha embaixo da logo no cabeçalho do PDF */
  descricao: string
  cnpj: string
  inscricaoEstadual: string
  endereco: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  telefone: string
  whatsapp: string
  email: string
  site: string
}

/* O MOLDE NÃO INVENTA NADA QUE PRECISE SER CONFERIDO DEPOIS EM SILÊNCIO.
   Campo que não sei fica vazio, e vazio a tela aponta em vermelho. Um CNPJ
   plausível escrito aqui seria pior que um campo em branco: ninguém confere o
   que já parece certo. */
export const EMPRESA_PADRAO: DadosDaEmpresa = {
  nome: 'Fourtime',
  razaoSocial: '',
  descricao: 'Uniformes e camisetas personalizadas',
  cnpj: '',
  inscricaoEstadual: '',
  endereco: '',
  bairro: '',
  cidade: 'Goiânia',
  uf: 'GO',
  cep: '',
  telefone: '',
  whatsapp: '',
  email: '',
  site: 'fourtimefit.com.br',
}

/* OS CAMPOS QUE SAEM IMPRESSOS. Eles são os que a tela cobra em vermelho: um
   endereço em branco no rodapé de um orçamento é o tipo de erro que só
   aparece depois de o cliente receber. Os outros não são menos importantes,
   só não estão no papel hoje, e cobrar o que não se usa ensina a ignorar o
   aviso. */
export const CAMPOS_DO_DOCUMENTO: (keyof DadosDaEmpresa)[] = [
  'nome',
  'descricao',
  'cnpj',
  'endereco',
  'cidade',
  'uf',
]

const CHAVE = 'ft.empresa'

function lerGuardado(): Partial<DadosDaEmpresa> {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return {}
    const lido = JSON.parse(cru)
    return lido && typeof lido === 'object' ? (lido as Partial<DadosDaEmpresa>) : {}
  } catch {
    return {}
  }
}

/** Os dados de verdade. Ver o comentário do topo para o porquê de ser um
    objeto alterado por dentro, e não substituído. */
export const EMPRESA: DadosDaEmpresa = { ...EMPRESA_PADRAO, ...lerGuardado() }

function guardarCopia() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(EMPRESA))
  } catch {
    /* navegador anônimo ou armazenamento cheio: vale só nesta aba */
  }
}

/* Só texto, e só os campos que existem: o que vier a mais do banco ou do
   navegador não entra no objeto que a folha imprime. */
function soOsCampos(x: unknown): Partial<DadosDaEmpresa> {
  const saida: Partial<DadosDaEmpresa> = {}
  if (!x || typeof x !== 'object') return saida
  for (const k of Object.keys(EMPRESA_PADRAO) as (keyof DadosDaEmpresa)[]) {
    const v = (x as Record<string, unknown>)[k]
    if (typeof v === 'string') saida[k] = v
  }
  return saida
}

/** De onde vieram os dados que estão na tela agora. */
export type OrigemDaEmpresa =
  /** do banco, iguais para a fábrica inteira */
  | 'banco'
  /** o banco ainda está vazio, e o que aparece foi gravado só neste navegador */
  | 'navegador'
  /** a 075 não rodou: o banco não tem onde guardar */
  | 'sem-tabela'

let origem: OrigemDaEmpresa = 'navegador'
export const origemDaEmpresa = () => origem

const semTabela = (e: unknown) =>
  e instanceof Error && /PGRST20[25]|42P01|42883|schema cache|Não encontrei/i.test(e.message)

/* Lê do banco e põe dentro de EMPRESA. Banco vazio não apaga o que este
   navegador já tinha: os dados de antes da 075 continuam saindo na folha, e
   a tela da empresa avisa que falta salvar para valer para todo mundo. */
export async function carregarEmpresa(): Promise<OrigemDaEmpresa> {
  try {
    const linhas = await tabela<{ dados: unknown }[]>('empresa?select=dados&limit=1')
    const dados = soOsCampos(linhas[0]?.dados)
    if (Object.keys(dados).length) {
      Object.assign(EMPRESA, EMPRESA_PADRAO, dados)
      guardarCopia()
      origem = 'banco'
    } else {
      origem = 'navegador'
    }
  } catch (e) {
    if (!semTabela(e)) throw e
    origem = 'sem-tabela'
  }
  return origem
}

/* Grava no banco, pela funcao da 075, e o banco devolve o que guardou (so os
   campos conhecidos, aparados). Sem a 075, grava so neste navegador, como
   antes, e diz isso. */
export async function salvarEmpresa(novo: DadosDaEmpresa): Promise<OrigemDaEmpresa> {
  try {
    const gravado = await chamar<unknown>('salvar_empresa', { p_dados: novo })
    Object.assign(EMPRESA, EMPRESA_PADRAO, soOsCampos(gravado))
    origem = 'banco'
  } catch (e) {
    if (!semTabela(e)) throw e
    Object.assign(EMPRESA, novo)
    origem = 'sem-tabela'
  }
  guardarCopia()
  return origem
}

/** Quais campos do documento ainda estão em branco. */
export function camposEmBranco(d: DadosDaEmpresa = EMPRESA): (keyof DadosDaEmpresa)[] {
  return CAMPOS_DO_DOCUMENTO.filter((k) => !String(d[k] ?? '').trim())
}

/** true enquanto faltar algum campo que sai impresso: a tela avisa em vez de
    imprimir um documento com buraco. */
export function empresaAConferir(d: DadosDaEmpresa = EMPRESA): boolean {
  return camposEmBranco(d).length > 0
}

/* --- as máscaras ---------------------------------------------------------
   Elas moram aqui, e não na tela, porque o formato do CNPJ e do CEP é do
   DADO: um arquivo importado amanhã tem que passar pela mesma régua que o
   campo digitado hoje. */
/* O CNPJ NOVO TEM LETRA (alfanumérico, a partir de julho de 2026): os doze
   primeiros podem ser letra ou número, os dois do fim são número. A máscara
   é a mesma dos fornecedores, e mora lá, num lugar só. */
export function mascaraDeCnpj(v: string): string {
  return mascaraDoCnpj(v)
}

export function mascaraDeCep(v: string): string {
  const n = String(v).replace(/\D/g, '').slice(0, 8)
  return n.length <= 5 ? n : n.slice(0, 5) + '-' + n.slice(5)
}

export function mascaraDeTelefone(v: string): string {
  const n = String(v).replace(/\D/g, '').slice(0, 11)
  if (n.length <= 2) return n
  if (n.length <= 6) return '(' + n.slice(0, 2) + ') ' + n.slice(2)
  if (n.length <= 10) return '(' + n.slice(0, 2) + ') ' + n.slice(2, 6) + '-' + n.slice(6)
  return '(' + n.slice(0, 2) + ') ' + n.slice(2, 7) + '-' + n.slice(7)
}
