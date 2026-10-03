import { chamar, tabela } from '@shared/supabase'
import { formatarDinheiroExato } from '@shared'
import { EMPRESA } from '../empresa'
import {
  cnpjValido,
  consultarNaReceita,
  limparCnpj,
  mesmoNome,
  resumoDaReceita,
  type Fornecedor,
  type NaReceita,
} from '../fornecedor'
import { bancoNaTela, nomeDoBanco, type LinhaLida } from './linha'
import {
  cnpjDoBeneficiario,
  datasDoTexto,
  nomeAoLadoDoCnpj,
  nomeApareceNoTexto,
  valoresDoTexto,
  type BoletoLido,
} from './texto'

/* ==========================================================================
   O Verificador de Boleto.

   Antes de pagar, o boleto passa por oito conferências, e o resultado é um
   de três: pode pagar, precisa de aprovação, não pague.

   A REGRA DO RESULTADO É CURTA DE PROPÓSITO:
     qualquer conferência em erro        não pague
     qualquer conferência em atenção     precisa de aprovação
     as oito certas                      pode pagar

   O QUE CADA COR QUER DIZER:
     erro     o boleto está errado em si: dígito que não fecha, valor que não
              bate, pagador que não é a Fourtime, CNPJ bloqueado ou baixado
     atenção  o boleto pode estar certo, mas a Fourtime não conhece quem
              recebe: é a hora em que alguém com permissão olha antes de sair
              dinheiro

   O ARQUIVO NUNCA É GUARDADO. O registro tem o que estava escrito e o que foi
   decidido; o PDF morre no navegador de quem conferiu.

   A ÚLTIMA PALAVRA É DO BANCO. A tela faz as contas, mas quem grava o
   registro passa por um gatilho (041) que não aceita "pode pagar" de um CNPJ
   que não está na lista de confiáveis. Uma tela adulterada registra, no
   máximo, um pedido de aprovação.
   ========================================================================== */

export type Resultado = 'pode_pagar' | 'precisa_aprovacao' | 'nao_pague'
export type SituacaoDaConferencia = 'conferido' | 'esperando' | 'aprovado' | 'recusado'
export type Estado = 'ok' | 'atencao' | 'erro'

export const NOME_DO_RESULTADO: Record<Resultado, string> = {
  pode_pagar: 'Pode pagar',
  precisa_aprovacao: 'Precisa de aprovação',
  nao_pague: 'Não pague',
}

export const COR_DO_RESULTADO: Record<Resultado, string> = {
  pode_pagar: 'var(--ok)',
  precisa_aprovacao: 'var(--warn)',
  nao_pague: 'var(--brand)',
}

export type ChaveDaChecagem =
  | 'linha'
  | 'valor'
  | 'pagador'
  | 'receita'
  | 'fornecedor'
  | 'historico'
  | 'repetido'
  | 'banco'

export type Checagem = { chave: ChaveDaChecagem; titulo: string; estado: Estado; texto: string }

/* As oito, na ordem em que a tela mostra, com a frase de quando ainda não há
   boleto nenhum. A ordem é de leitura em duas colunas: a esquerda desce por
   linha, pagador, fornecedor, repetido; a direita por valor, receita,
   histórico, banco. */
export const AS_OITO: { chave: ChaveDaChecagem; titulo: string; oQueE: string }[] = [
  { chave: 'linha', titulo: 'Linha digitável', oQueE: 'Os dígitos de controle da linha têm que fechar a conta' },
  { chave: 'valor', titulo: 'Valor e vencimento', oQueE: 'O que a linha diz tem que ser igual ao que está escrito no PDF' },
  { chave: 'pagador', titulo: 'Pagador', oQueE: 'O boleto tem que estar no nome e no CNPJ da Fourtime' },
  { chave: 'receita', titulo: 'Beneficiário na Receita', oQueE: 'CNPJ ativo, e a razão social igual ao nome do boleto' },
  { chave: 'fornecedor', titulo: 'Fornecedor conhecido', oQueE: 'O CNPJ tem que estar na lista de fornecedores confiáveis' },
  { chave: 'historico', titulo: 'Histórico com a Fourtime', oQueE: 'Se a Fourtime já pagou este CNPJ, e quanto costuma ser' },
  { chave: 'repetido', titulo: 'Boleto repetido', oQueE: 'Se este mesmo boleto já passou por aqui' },
  { chave: 'banco', titulo: 'Banco emissor', oQueE: 'Se o banco é o mesmo dos boletos anteriores do fornecedor' },
]

export type Conferencia = {
  id: string
  quando: string
  quem: string
  linha: string
  arquivo: string
  banco: string
  bancoNome: string
  valor: number | null
  vencimento: string
  beneficiario: string
  cnpj: string
  pagador: string
  pagadorDocumento: string
  resultado: Resultado
  situacao: SituacaoDaConferencia
  checagens: Checagem[]
  motivo: string
  fornecedorId: string
  decididoPor: string
  decididoEm: string
  notaDaDecisao: string
}

type LinhaDaConferencia = {
  id: string
  quando: string
  quem_nome: string | null
  linha: string
  arquivo: string | null
  banco: string | null
  banco_nome: string | null
  valor: number | string | null
  vencimento: string | null
  beneficiario: string | null
  cnpj: string | null
  pagador: string | null
  pagador_documento: string | null
  resultado: Resultado
  situacao: SituacaoDaConferencia
  checagens: Checagem[] | null
  motivo: string | null
  fornecedor_id: string | null
  decidido_por_nome: string | null
  decidido_em: string | null
  nota_da_decisao: string | null
}

function deLinha(l: LinhaDaConferencia): Conferencia {
  return {
    id: l.id,
    quando: l.quando,
    quem: l.quem_nome ?? '',
    linha: l.linha,
    arquivo: l.arquivo ?? '',
    banco: l.banco ?? '',
    bancoNome: l.banco_nome ?? '',
    valor: l.valor === null || l.valor === undefined ? null : Number(l.valor),
    vencimento: l.vencimento ?? '',
    beneficiario: l.beneficiario ?? '',
    cnpj: l.cnpj ?? '',
    pagador: l.pagador ?? '',
    pagadorDocumento: l.pagador_documento ?? '',
    resultado: l.resultado,
    situacao: l.situacao,
    checagens: Array.isArray(l.checagens) ? l.checagens : [],
    motivo: l.motivo ?? '',
    fornecedorId: l.fornecedor_id ?? '',
    decididoPor: l.decidido_por_nome ?? '',
    decididoEm: l.decidido_em ?? '',
    notaDaDecisao: l.nota_da_decisao ?? '',
  }
}

export async function carregarConferencias(limite = 60): Promise<Conferencia[]> {
  const linhas = await tabela<LinhaDaConferencia[]>(
    `conferencia_de_boleto?select=*&order=quando.desc&limit=${limite}`,
  )
  return linhas.map(deLinha)
}

/** Tudo que já passou por aqui com este CNPJ ou com esta mesma linha. */
export async function carregarPassadoDoBoleto(linha: string, cnpj: string): Promise<Conferencia[]> {
  const filtros = [`linha.eq.${linha}`]
  if (cnpj) filtros.push(`cnpj.eq.${cnpj}`)
  const linhas = await tabela<LinhaDaConferencia[]>(
    `conferencia_de_boleto?select=*&or=(${filtros.join(',')})&order=quando.desc&limit=200`,
  )
  return linhas.map(deLinha)
}

/* ---------- o que o boleto diz ------------------------------------------- */

export type DadosDoBoleto = {
  linha: LinhaLida
  arquivo: string
  beneficiario: string
  cnpj: string
  /** o nome veio do PDF (palpite) ou a pessoa escreveu */
  temPdf: boolean
  /** o CNPJ da empresa aparece no texto do PDF */
  pagadorEhAEmpresa: boolean | null
  /** os valores e as datas escritos no PDF, para comparar com a linha */
  valoresNoPdf: number[]
  datasNoPdf: string[]
  /** o texto inteiro do PDF, só na memória: é nele que o nome é procurado */
  texto: string
}

/** Junta o que o PDF e a linha dizem num retrato só. */
export function dadosDoBoleto(
  linha: LinhaLida,
  lido: BoletoLido | null,
  cnpjDigitado = '',
): DadosDoBoleto {
  const meu = limparCnpj(EMPRESA.cnpj)
  const digitado = limparCnpj(cnpjDigitado)
  const cnpj = lido ? cnpjDoBeneficiario(lido, meu) || digitado : digitado
  return {
    linha,
    arquivo: lido?.arquivo ?? '',
    beneficiario: lido ? nomeAoLadoDoCnpj(lido, cnpj) : '',
    cnpj,
    temPdf: !!lido,
    pagadorEhAEmpresa: lido ? (meu ? lido.cnpjs.includes(meu) : null) : null,
    valoresNoPdf: lido ? valoresDoTexto(lido.texto) : [],
    datasNoPdf: lido ? datasDoTexto(lido.texto) : [],
    texto: lido?.texto ?? '',
  }
}

/* ---------- as oito conferências ----------------------------------------- */

function dia(iso: string): string {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function mesEAno(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/** O passado que conta como "a Fourtime já pagou": o que saiu verde ou foi aprovado. */
function pagos(passado: Conferencia[]): Conferencia[] {
  return passado.filter(
    (c) => (c.resultado === 'pode_pagar' && c.situacao === 'conferido') || c.situacao === 'aprovado',
  )
}

export type Conferido = {
  dados: DadosDoBoleto
  receita: NaReceita | null
  checagens: Checagem[]
  resultado: Resultado
  /** a conferência anterior desta mesma linha, quando ela já foi aprovada */
  aprovacaoAnterior: Conferencia | null
  /** a conferência anterior desta mesma linha que ainda espera decisão */
  esperaAnterior: Conferencia | null
}

export function conferir(
  dados: DadosDoBoleto,
  receita: NaReceita | null,
  motivoSemReceita: string,
  fornecedor: Fornecedor | null,
  passado: Conferencia[],
  hoje: Date = new Date(),
  nomeFantasia = '',
): Conferido {
  const { linha } = dados
  const fora: Checagem[] = []
  const por = (chave: ChaveDaChecagem, estado: Estado, texto: string) => {
    const titulo = AS_OITO.find((c) => c.chave === chave)?.titulo ?? chave
    /* as frases da lista não terminam em ponto, venham de onde vierem */
    fora.push({ chave, titulo, estado, texto: texto.replace(/\.$/, '') })
  }

  /* 1. a linha */
  if (linha.valida) por('linha', 'ok', 'Os dígitos de controle conferem')
  else por('linha', 'erro', linha.problema || 'Os dígitos de controle não conferem')

  /* 2. valor e vencimento */
  const valorEscrito = linha.valor !== null ? formatarDinheiroExato(linha.valor) : ''
  const hojeIso = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()))
    .toISOString()
    .slice(0, 10)
  if (linha.valor === null) {
    por('valor', 'atencao', 'A linha não traz o valor: quem define é quem paga')
  } else if (dados.temPdf && !dados.valoresNoPdf.some((v) => Math.abs(v - (linha.valor as number)) < 0.005)) {
    por('valor', 'erro', `A linha diz ${valorEscrito} e esse valor não está escrito no PDF`)
  } else if (dados.temPdf && linha.vencimento && !dados.datasNoPdf.includes(linha.vencimento)) {
    por('valor', 'erro', `A linha diz vencimento em ${dia(linha.vencimento)} e essa data não está no PDF`)
  } else if (linha.vencimento && linha.vencimento < hojeIso) {
    por('valor', 'atencao', `${valorEscrito}, vencido em ${dia(linha.vencimento)}`)
  } else if (dados.temPdf) {
    por(
      'valor',
      'ok',
      linha.vencimento
        ? `${valorEscrito} em ${dia(linha.vencimento)}, igual na linha e no PDF`
        : `${valorEscrito}, igual na linha e no PDF`,
    )
  } else {
    por(
      'valor',
      'ok',
      (linha.vencimento ? `${valorEscrito} em ${dia(linha.vencimento)}` : valorEscrito) +
        ', lido da linha',
    )
  }

  /* 3. o pagador */
  if (!dados.temPdf) {
    por('pagador', 'atencao', 'Sem o PDF não dá para ler quem é o pagador')
  } else if (dados.pagadorEhAEmpresa === null) {
    por('pagador', 'atencao', 'O CNPJ da empresa não está preenchido em Configurações, Empresa')
  } else if (dados.pagadorEhAEmpresa) {
    por('pagador', 'ok', `${EMPRESA.nome}, com o CNPJ da empresa`)
  } else {
    por('pagador', 'erro', `O CNPJ da ${EMPRESA.nome} não aparece neste boleto`)
  }

  /* 4. a Receita */
  if (linha.tipo === 'arrecadacao') {
    por('receita', 'atencao', 'Guia de arrecadação não traz o CNPJ de quem recebe')
  } else if (!dados.cnpj) {
    por('receita', 'atencao', 'Não achei o CNPJ do beneficiário')
  } else if (!cnpjValido(dados.cnpj)) {
    por('receita', 'erro', 'O CNPJ do beneficiário não fecha a conta dos dígitos')
  } else if (!receita) {
    por('receita', 'atencao', motivoSemReceita || 'A consulta da Receita não respondeu agora')
  } else if (receita.situacao && !/^ativa$/i.test(receita.situacao)) {
    por('receita', 'erro', `Na Receita este CNPJ está como ${receita.situacao.toLowerCase()}`)
  } else if (
    dados.temPdf &&
    !nomeApareceNoTexto(receita.razaoSocial, dados.texto) &&
    !(nomeFantasia && nomeApareceNoTexto(nomeFantasia, dados.texto)) &&
    !mesmoNome(dados.beneficiario, receita.razaoSocial)
  ) {
    /* O NOME É PROCURADO NO TEXTO INTEIRO, e não comparado com um palpite de
       onde o banco escreveu o beneficiário. Boleto de fornecedor conhecido
       não pode ficar amarelo porque a ficha daquele banco é diferente. */
    por('receita', 'atencao', `Na Receita este CNPJ é de ${receita.razaoSocial}, e esse nome não está no boleto`)
  } else {
    const desde = resumoDaReceita(receita)
    por(
      'receita',
      'ok',
      dados.temPdf
        ? `${desde || 'CNPJ encontrado'}. A razão social é a mesma do boleto`
        : `${desde || 'CNPJ encontrado'}, de ${receita.razaoSocial}`,
    )
  }

  /* 5. o fornecedor */
  if (!dados.cnpj) {
    por('fornecedor', 'atencao', 'Sem CNPJ não dá para procurar na lista')
  } else if (!fornecedor) {
    por('fornecedor', 'atencao', 'Não está na lista de fornecedores confiáveis')
  } else if (fornecedor.gravada === 'bloqueado') {
    por(
      'fornecedor',
      'erro',
      'CNPJ bloqueado' + (fornecedor.motivoDoBloqueio ? ': ' + fornecedor.motivoDoBloqueio : ''),
    )
  } else if (fornecedor.gravada === 'confiavel') {
    por(
      'fornecedor',
      'ok',
      'Na lista' +
        (fornecedor.aprovadoEm ? ' desde ' + mesEAno(fornecedor.aprovadoEm) : '') +
        (fornecedor.aprovadoPor ? ', aprovado por ' + fornecedor.aprovadoPor.split(' ')[0] : ''),
    )
  } else {
    por('fornecedor', 'atencao', `${fornecedor.nome} está no cadastro, mas não na lista de confiáveis`)
  }

  /* 6. o histórico */
  const mesmoCnpj = dados.cnpj ? passado.filter((c) => c.cnpj === dados.cnpj && c.linha !== linha.linha) : []
  const jaPagos = pagos(mesmoCnpj)
  if (!dados.cnpj) {
    por('historico', 'atencao', 'Sem CNPJ não há histórico para olhar')
  } else if (!jaPagos.length) {
    por('historico', 'atencao', 'Nenhum boleto deste CNPJ passou por aqui antes')
  } else {
    const valores = jaPagos.map((c) => c.valor).filter((v): v is number => v !== null)
    const menor = Math.min(...valores)
    const maior = Math.max(...valores)
    const quantos = jaPagos.length === 1 ? '1 boleto conferido antes' : `${jaPagos.length} boletos conferidos antes`
    const faixa = !valores.length
      ? ''
      : menor === maior
        ? `, de ${formatarDinheiroExato(maior)}`
        : `, de ${formatarDinheiroExato(menor)} a ${formatarDinheiroExato(maior)}`
    /* três vezes o maior valor já pago é longe o bastante do costume para
       alguém olhar, e perto o bastante para não gritar em toda compra maior */
    if (linha.valor !== null && valores.length && linha.valor > maior * 3) {
      por('historico', 'atencao', `${quantos}${faixa}. Este é bem acima do costume`)
    } else {
      por('historico', 'ok', quantos + faixa)
    }
  }

  /* 7. repetido */
  const mesmaLinha = passado.filter((c) => c.linha === linha.linha)
  const aprovacaoAnterior = mesmaLinha.find((c) => c.situacao === 'aprovado') ?? null
  const esperaAnterior = mesmaLinha.find((c) => c.situacao === 'esperando') ?? null
  const recusado = mesmaLinha.find((c) => c.situacao === 'recusado')
  const quemEQuando = (c: Conferencia) =>
    `${dia(c.quando)}${c.quem ? ' por ' + c.quem.split(' ')[0] : ''}`
  if (!mesmaLinha.length) {
    por('repetido', 'ok', 'Primeira vez que este boleto aparece')
  } else if (recusado) {
    por(
      'repetido',
      'erro',
      `Recusado em ${dia(recusado.decididoEm || recusado.quando)}` +
        (recusado.decididoPor ? ' por ' + recusado.decididoPor.split(' ')[0] : ''),
    )
  } else if (aprovacaoAnterior) {
    por(
      'repetido',
      'ok',
      `Aprovado em ${dia(aprovacaoAnterior.decididoEm || aprovacaoAnterior.quando)}` +
        (aprovacaoAnterior.decididoPor ? ' por ' + aprovacaoAnterior.decididoPor.split(' ')[0] : ''),
    )
  } else if (esperaAnterior) {
    por('repetido', 'atencao', `Já está esperando aprovação desde ${quemEQuando(esperaAnterior)}`)
  } else {
    por('repetido', 'atencao', `Já foi conferido em ${quemEQuando(mesmaLinha[0])}. Confira se não foi pago`)
  }

  /* 8. o banco */
  if (linha.tipo === 'arrecadacao') {
    por('banco', 'ok', 'Guia de arrecadação, sem banco emissor')
  } else {
    const anteriores = [...new Set(jaPagos.map((c) => c.banco).filter(Boolean))]
    const escrito = bancoNaTela(linha.banco)
    if (anteriores.length && !anteriores.includes(linha.banco)) {
      por(
        'banco',
        'atencao',
        `Os boletos anteriores vieram de ${anteriores.map((b) => nomeDoBanco(b) || 'banco ' + b).join(' e ')}. Este vem de ${escrito}`,
      )
    } else if (anteriores.length) {
      por('banco', 'ok', `${escrito}, o mesmo dos boletos anteriores`)
    } else if (nomeDoBanco(linha.banco)) {
      por('banco', 'ok', `${escrito}, banco conhecido`)
    } else {
      por('banco', 'atencao', `Não reconheço o ${escrito}`)
    }
  }

  /* A APROVAÇÃO DESTE BOLETO VALE PARA ESTE BOLETO. Quando a mesma linha já
     foi aprovada por um administrador, as atenções que pediram a aprovação
     estão respondidas; um erro continua sendo erro. */
  const temErro = fora.some((c) => c.estado === 'erro')
  const temAtencao = fora.some((c) => c.estado === 'atencao')
  const resultado: Resultado = temErro
    ? 'nao_pague'
    : aprovacaoAnterior
      ? 'pode_pagar'
      : temAtencao
        ? 'precisa_aprovacao'
        : 'pode_pagar'

  return { dados, receita, checagens: fora, resultado, aprovacaoAnterior, esperaAnterior }
}

/* A conferência inteira, com as duas consultas que dependem de rede. */
export async function conferirBoleto(
  dados: DadosDoBoleto,
  fornecedores: Fornecedor[],
  hoje: Date = new Date(),
): Promise<Conferido> {
  const fornecedor = dados.cnpj ? (fornecedores.find((f) => f.cnpj === dados.cnpj) ?? null) : null
  const [consulta, passado] = await Promise.all([
    dados.cnpj && cnpjValido(dados.cnpj) && dados.linha.tipo === 'cobranca'
      ? consultarNaReceita(dados.cnpj)
      : Promise.resolve({ receita: null as null, motivo: '' }),
    carregarPassadoDoBoleto(dados.linha.linha, dados.cnpj),
  ])
  /* O NOME QUE A TELA MOSTRA É O DA RECEITA sempre que ele está escrito no
     boleto, ou quando não há PDF. O palpite tirado da posição só sobra para
     o caso em que os dois discordam, que é justamente o que a conferência
     acusa. */
  const nomeFantasia = consulta.receita ? consulta.nomeFantasia : ''
  const daReceita =
    consulta.receita &&
    (!dados.temPdf ||
      !dados.beneficiario ||
      nomeApareceNoTexto(consulta.receita.razaoSocial, dados.texto))
      ? consulta.receita.razaoSocial
      : ''
  const comNome: DadosDoBoleto = daReceita ? { ...dados, beneficiario: daReceita } : dados
  const feito = conferir(
    dados,
    consulta.receita,
    consulta.receita ? '' : consulta.motivo,
    fornecedor,
    passado,
    hoje,
    nomeFantasia,
  )
  return { ...feito, dados: comNome }
}

/* ---------- o registro ---------------------------------------------------- */

export async function registrarConferencia(c: Conferido): Promise<Conferencia> {
  const { dados } = c
  const linhas = await tabela<LinhaDaConferencia[]>('conferencia_de_boleto?select=*', {
    metodo: 'POST',
    devolver: true,
    corpo: {
      linha: dados.linha.linha,
      arquivo: dados.arquivo,
      banco: dados.linha.banco,
      banco_nome: nomeDoBanco(dados.linha.banco),
      valor: dados.linha.valor,
      vencimento: dados.linha.vencimento || null,
      beneficiario: dados.beneficiario,
      cnpj: dados.cnpj && cnpjValido(dados.cnpj) ? dados.cnpj : null,
      pagador: dados.pagadorEhAEmpresa ? EMPRESA.razaoSocial || EMPRESA.nome : '',
      pagador_documento: dados.pagadorEhAEmpresa ? limparCnpj(EMPRESA.cnpj) : '',
      resultado: c.resultado,
      checagens: c.checagens,
    },
  })
  if (!linhas?.length) throw new Error('O banco não confirmou o registro da conferência.')
  return deLinha(linhas[0])
}

export async function pedirAprovacao(conferenciaId: string, motivo: string): Promise<Conferencia> {
  return deLinha(
    await chamar<LinhaDaConferencia>('pedir_aprovacao_do_boleto', {
      p_conferencia: conferenciaId,
      p_motivo: motivo,
    }),
  )
}

export type Decisao = 'aprovar' | 'aprovar_e_listar' | 'recusar'

export async function decidirBoleto(conferenciaId: string, decisao: Decisao, nota = ''): Promise<Conferencia> {
  return deLinha(
    await chamar<LinhaDaConferencia>('decidir_o_boleto', {
      p_conferencia: conferenciaId,
      p_decisao: decisao,
      p_nota: nota,
    }),
  )
}

/* ---------- o que a lista mostra ------------------------------------------ */

/** A frase da última coluna de "Últimas conferências". */
export function resultadoNaLista(c: Conferencia): { cor: string; texto: string } {
  const primeiro = (nome: string) => nome.split(' ')[0]
  if (c.situacao === 'esperando') return { cor: 'var(--warn)', texto: 'Esperando aprovação' }
  if (c.situacao === 'aprovado') {
    return { cor: 'var(--ok)', texto: 'Aprovado' + (c.decididoPor ? ' por ' + primeiro(c.decididoPor) : '') }
  }
  if (c.situacao === 'recusado') {
    return { cor: 'var(--brand)', texto: 'Recusado' + (c.decididoPor ? ' por ' + primeiro(c.decididoPor) : '') }
  }
  if (c.resultado === 'nao_pague') {
    const erro = c.checagens.find((k) => k.estado === 'erro')
    return { cor: 'var(--brand)', texto: 'Não pague' + (erro ? ', ' + motivoCurto(erro) : '') }
  }
  if (c.resultado === 'precisa_aprovacao') return { cor: 'var(--warn)', texto: 'Precisa de aprovação' }
  return { cor: 'var(--ok)', texto: 'Pode pagar' }
}

function motivoCurto(c: Checagem): string {
  switch (c.chave) {
    case 'linha':
      return 'dígito errado'
    case 'valor':
      return 'valor ou data diferente'
    case 'pagador':
      return 'pagador não é a empresa'
    case 'receita':
      return 'CNPJ irregular'
    case 'fornecedor':
      return 'CNPJ bloqueado'
    case 'repetido':
      return 'já recusado'
    default:
      return c.titulo.toLowerCase()
  }
}

/** Uma conferência do registro pode ter a linha copiada para pagar? */
export function liberadaParaPagar(c: Conferencia): boolean {
  return c.situacao === 'aprovado' || (c.situacao === 'conferido' && c.resultado === 'pode_pagar')
}

export * from './linha'
export { lerPdfDoBoleto } from './pdf'
export { cnpjsDoTexto, lerTextoDoBoleto } from './texto'
export type { BoletoLido } from './texto'
