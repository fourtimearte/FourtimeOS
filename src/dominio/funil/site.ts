import type { Lead } from './tipos'

/* ==========================================================================
   A FICHA DO CHAT DA LOJA, LEGIVEL (065, prancha 127).

   O banco guarda os CODIGOS do orcamento (o contrato com a loja: o texto do
   botao muda, o codigo nao). A tela mostra o nome de cada um. Codigo que a
   tela nao conhece aparece como veio, em vez de sumir.

   Tudo que vem daqui e texto digitado por desconhecido: a tela mostra como
   texto, nunca como HTML.
   ========================================================================== */
const NOMES: Record<string, Record<string, string>> = {
  tipo_peca: {
    kit_camiseta_short: 'Kit camiseta e short',
    camiseta: 'Camiseta',
    short: 'Short',
    uniforme_completo: 'Uniforme completo',
  },
  modelo_camiseta: { tradicional: 'Tradicional', raglan: 'Raglan', nao_sei: 'Não sabe ainda' },
  finalidade: {
    time: 'Time',
    escola: 'Escola',
    empresa: 'Empresa',
    evento: 'Evento',
    academia: 'Academia',
    outro: 'Outro',
  },
  quantidade_faixa: {
    ate_20: 'Até 20 peças',
    '20_50': '20 a 50 peças',
    '50_100': '50 a 100 peças',
    mais_100: 'Mais de 100 peças',
  },
  prazo: { urgente: 'Urgente', ate_30_dias: 'Até 30 dias', sem_pressa: 'Sem pressa' },
  arte: { pronta: 'Já tem a arte', ideia: 'Tem a ideia', criar_do_zero: 'Precisa criar do zero' },
  motivo: {
    orcamento: 'Pediu orçamento',
    pediu_vendedor: 'Pediu um vendedor',
    sem_resposta: 'Pergunta sem resposta',
    prioridade: 'Prioridade',
  },
}

export type LinhaDaFicha = { rotulo: string; valor: string; link?: string }
export type BlocoDaFicha = { titulo: string; linhas: LinhaDaFicha[] }

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v))
const nome = (campo: string, v: unknown) => {
  const c = txt(v)
  return c ? (NOMES[campo]?.[c] ?? c) : ''
}
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** Link so se for endereco web de verdade: o que vem do site e desconhecido. */
function endereco(v: unknown): string {
  const t = txt(v)
  try {
    const u = new URL(t)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''
  } catch {
    return ''
  }
}

function quando(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function temFichaDoSite(l: Lead): boolean {
  return l.origem === 'site-chat' || Object.keys(l.briefing).length > 0
}

export function fichaDoSite(l: Lead): BlocoDaFicha[] {
  const b = l.briefing
  const so = (linhas: LinhaDaFicha[]) => linhas.filter((x) => x.valor)

  const pedido = so([
    { rotulo: 'Peça', valor: nome('tipo_peca', b.tipo_peca) },
    { rotulo: 'Modelo', valor: nome('modelo_camiseta', b.modelo_camiseta) },
    { rotulo: 'Para', valor: nome('finalidade', b.finalidade) },
    { rotulo: 'Quantidade', valor: nome('quantidade_faixa', b.quantidade_faixa) },
    { rotulo: 'Prazo', valor: nome('prazo', b.prazo) },
    { rotulo: 'Arte', valor: nome('arte', b.arte) },
    { rotulo: 'Detalhe', valor: txt(b.detalhe) },
    { rotulo: 'Motivo', valor: nome('motivo', b.motivo) },
  ])

  const produto = obj(b.produto)
  const utm = obj(b.utm)
  const anuncio = [txt(utm.source), txt(utm.campaign)].filter(Boolean).join(' · ')
  const origem = so([
    { rotulo: 'Produto', valor: txt(produto.titulo), link: endereco(produto.url) || undefined },
    { rotulo: 'Página', valor: txt(b.pagina_titulo) || txt(b.pagina_origem), link: endereco(b.pagina_origem) || undefined },
    { rotulo: 'Anúncio', valor: anuncio },
    { rotulo: 'Aparelho', valor: txt(b.dispositivo) === 'celular' ? 'Celular' : txt(b.dispositivo) === 'computador' ? 'Computador' : '' },
    { rotulo: 'Horário', valor: b.fora_do_horario === true ? 'Fora do horário de atendimento' : '' },
    { rotulo: 'Enviado', valor: quando(txt(b.enviado_em)) },
    { rotulo: 'Envios', valor: Number(b.envio_numero) > 1 ? String(b.envio_numero) + ' (voltou com dúvida nova)' : '' },
  ])

  const contato = so([
    { rotulo: 'E-mail', valor: l.email },
    {
      rotulo: 'Aceite',
      valor: l.consentimentoEm ? quando(l.consentimentoEm) + (l.consentimentoTexto ? ' · ' + l.consentimentoTexto : '') : '',
    },
  ])

  return [
    { titulo: 'O pedido', linhas: pedido },
    { titulo: 'De onde veio', linhas: origem },
    { titulo: 'Contato e LGPD', linhas: contato },
  ].filter((x) => x.linhas.length)
}
