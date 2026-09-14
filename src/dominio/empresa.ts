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

   Hoje a gravação é no próprio navegador. Quando o Supabase entrar, SÓ ESTE
   ARQUIVO muda: quem imprime continua lendo EMPRESA.
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

export function salvarEmpresa(novo: DadosDaEmpresa): DadosDaEmpresa {
  Object.assign(EMPRESA, novo)
  try {
    localStorage.setItem(CHAVE, JSON.stringify(EMPRESA))
  } catch {
    /* navegador anônimo ou armazenamento cheio: vale só nesta aba */
  }
  return EMPRESA
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
export function mascaraDeCnpj(v: string): string {
  const n = String(v).replace(/\D/g, '').slice(0, 14)
  if (n.length <= 2) return n
  if (n.length <= 5) return n.slice(0, 2) + '.' + n.slice(2)
  if (n.length <= 8) return n.slice(0, 2) + '.' + n.slice(2, 5) + '.' + n.slice(5)
  if (n.length <= 12)
    return n.slice(0, 2) + '.' + n.slice(2, 5) + '.' + n.slice(5, 8) + '/' + n.slice(8)
  return (
    n.slice(0, 2) + '.' + n.slice(2, 5) + '.' + n.slice(5, 8) + '/' + n.slice(8, 12) + '-' + n.slice(12)
  )
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
