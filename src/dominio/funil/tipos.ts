import { formatarDinheiro as dinheiro, linkDoWhatsApp as linkDoZap } from '@shared'

/* ==========================================================================
   O funil de vendas, do jeito que o mockup v5 desenhou.

   Seis colunas, e o lead e uma CONVERSA de WhatsApp que ainda nao virou
   pedido. Por isso o cartao mostra o trecho da ultima mensagem e o tempo
   desde ela, e nao um resumo de cadastro: quem olha o funil esta perguntando
   de quem a conversa esta esperando.
   ========================================================================== */

export type Estagio = 'novo' | 'atendimento' | 'cotacao' | 'negociando' | 'fechado' | 'perdido'

export const ESTAGIOS: Estagio[] = [
  'novo',
  'atendimento',
  'cotacao',
  'negociando',
  'fechado',
  'perdido',
]

export const NOME_DO_ESTAGIO: Record<Estagio, string> = {
  novo: 'Novo lead',
  atendimento: 'Em atendimento',
  cotacao: 'Cotação enviada',
  negociando: 'Negociando',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

/** Os dois estagios em que o relogio nao corre mais. */
export const ESTAGIO_FECHADO: Estagio[] = ['fechado', 'perdido']

/* ==========================================================================
   A COR DE CADA ESTÁGIO É UMA PROGRESSÃO, E NÃO UMA PALETA.

   As quatro primeiras esquentam na ordem em que a negociação anda: ardósia
   fria no lead que ninguém tocou, azul quando alguém está falando com ele,
   turquesa quando o número já saiu, âmbar quando está quente e esperando
   resposta. Quem bate o olho no quadro lê o avanço pela temperatura, antes
   de ler o nome da coluna.

   As duas últimas saem da rampa DE PROPÓSITO, porque não são degraus do
   mesmo caminho: são os dois fins. Verde é o sim, e cinza lavado é o não,
   que some da vista em vez de disputar atenção com quem ainda está vivo.

   São hexadecimais e não tokens do tema: a cor aqui é significado, e não
   superfície. Ela tem que dizer a mesma coisa no claro e no escuro, e um
   token de tema mudaria de valor entre os dois. A saturação é média de
   propósito, para o filete continuar legível sobre fundo claro e escuro.
   ========================================================================== */
export const COR_DO_ESTAGIO: Record<Estagio, string> = {
  novo: '#64748B',
  atendimento: '#2F6FB8',
  cotacao: '#0E8C93',
  negociando: '#B7791F',
  fechado: '#1F8A50',
  perdido: '#A8B0BA',
}

/** A cor da coluna, do filete do cartão e da pílula do topo. */
export function corDoEstagio(e: Estagio): string {
  return COR_DO_ESTAGIO[e] ?? 'var(--ink)'
}

export type Mensagem = {
  id: string
  quem: 'nos' | 'cliente' | 'sistema'
  tipo: 'texto' | 'audio' | 'imagem' | 'arquivo' | 'modelo'
  texto: string
  /** caminho do arquivo no balde, para audio, imagem e arquivo */
  arquivo: string
  nomeDoArquivo: string
  /** QUANDO, em ISO. Nao "ha quantos minutos". */
  em: string
  lida?: boolean
}

export type Lead = {
  id: string
  /** id do cliente cadastrado, quando ja existe */
  clienteId: string
  /** o nome quando o lead ainda nao virou cliente */
  nomeLivre: string
  contato: string
  telefone: string
  estagio: Estagio
  /** a ultima mensagem, que e o que o cartao mostra */
  msg: string
  /* QUANDO foi a ultima mensagem, em ISO, e nao ha quantos minutos.

     Esta foi a troca que mais importou na virada para o banco. Guardar
     "47 minutos" congela o relogio: o cartao que dizia 47 min as nove da manha
     continuava dizendo 47 min ao meio-dia, porque o numero foi gravado e nao
     medido. E o funil inteiro existe para responder de quem a conversa esta
     esperando, o que e uma pergunta sobre o relogio de agora. */
  ultimaMsgEm: string
  /** quantas nao lidas: o numero vermelho no cartao */
  novo: number
  valor: number
  /** id da cotacao ligada, quando existe */
  cotacao: string
  /** numero do pedido, quando fechou */
  pedido: string
  /** quando a janela de 24 h do WhatsApp fecha, em ISO */
  janelaAte: string
  /** de quem e o lead: e por aqui que a venda e creditada la no fim */
  vendedorId: string
  vendedorNome: string
  teste: boolean
}

/** Quantos minutos desde um instante em ISO. Vazio devolve zero. */
export function minutosDesde(iso: string, agora = Date.now()): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.round((agora - t) / 60000))
}

/** O tempo do cartao: 12 min, 3 h, 1 d. */
export function tempoCurto(min: number): string {
  if (min < 60) return min + ' min'
  if (min < 1440) return Math.round(min / 60) + ' h'
  return Math.round(min / 1440) + ' d'
}

/* No v5 o vermelho do tempo so aparece nas duas primeiras colunas: uma hora
   sem responder quem acabou de chegar e ruim, uma hora esperando o cliente
   decidir e normal. */
export function semResposta(l: Lead, agora = Date.now()): boolean {
  return (
    (l.estagio === 'novo' || l.estagio === 'atendimento') &&
    minutosDesde(l.ultimaMsgEm, agora) > 60
  )
}

/* ==========================================================================
   A JANELA DE 24 HORAS DO WHATSAPP.

   Ela abre quando O CLIENTE fala e dura 24 horas. Dentro dela dá para escrever
   o que quiser; fora dela, pela API oficial, só um modelo aprovado pela Meta.

   O CÁLCULO NÃO SAI DE `ultimaMsgEm`, e isso é o principal. Aquela coluna é a
   última mensagem de qualquer um, inclusive nossa, e contar dali reabriria a
   janela toda vez que o vendedor respondesse. Responder não estende nada. Por
   isso a janela tem coluna própria no banco, escrita por gatilho, e aqui só se
   lê o que ele escreveu.

   A JANELA AINDA NÃO TRANCA NADA, e o texto na tela diz isso. Hoje a mensagem
   sai pelo `wa.me`, quer dizer, pelo WhatsApp da própria pessoa, onde a regra
   das 24 horas não existe: ela é uma restrição da API oficial. Uma tela que
   bloqueasse o envio hoje estaria inventando uma trava que a Meta não aplica
   neste caminho, e ensinando a equipe a desconfiar do aviso justamente antes
   do dia em que ele passa a valer.
   ========================================================================== */

export type JanelaDaConversa =
  | { estado: 'sem'; minutos: 0 }
  | { estado: 'aberta'; minutos: number }
  | { estado: 'fechada'; minutos: number }

export function janelaDaConversa(l: Lead, agora = Date.now()): JanelaDaConversa {
  /* SEM JANELA NÃO É JANELA FECHADA. Lead que nunca recebeu fala de cliente
     nunca teve janela: dizer "fechada" faria parecer que ela existiu e
     passou. */
  if (!l.janelaAte) return { estado: 'sem', minutos: 0 }
  const t = new Date(l.janelaAte).getTime()
  if (!Number.isFinite(t)) return { estado: 'sem', minutos: 0 }
  const min = Math.round((t - agora) / 60000)
  return min > 0 ? { estado: 'aberta', minutos: min } : { estado: 'fechada', minutos: -min }
}

/** Menos de duas horas para fechar: é o que ainda dá para resolver hoje. */
export function janelaApertada(j: JanelaDaConversa): boolean {
  return j.estado === 'aberta' && j.minutos <= 120
}

export function nomeDoLead(l: Lead): string {
  return l.nomeLivre
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function leadEmBranco(): Lead {
  return {
    id: '',
    clienteId: '',
    /* O NOME NASCE VAZIO, e não com o texto "Novo lead" dentro dele.

       Campo que já vem preenchido com um rótulo é campo que a pessoa salva
       sem ler: o funil acabaria com três leads chamados "Novo lead" na
       primeira semana. O banco continua tendo essa palavra como último
       recurso (em `paraLinha`), porque a tabela recusa nome vazio, mas isso é
       rede de segurança e não valor inicial. */
    nomeLivre: '',
    contato: '',
    telefone: '',
    estagio: 'novo',
    msg: '',
    ultimaMsgEm: '',
    novo: 0,
    valor: 0,
    cotacao: '',
    pedido: '',
    janelaAte: '',
    vendedorId: '',
    vendedorNome: '',
    teste: false,
  }
}

/* --- as respostas rapidas -----------------------------------------------
   As quatro do v5, na mesma ordem. Elas nao enviam sozinhas: escrevem a frase
   no campo, para a pessoa ler antes de mandar. */
export type RespostaRapida = { id: string; titulo: string; texto: string }

export const RESPOSTAS: RespostaRapida[] = [
  {
    id: 'precos',
    titulo: 'Tabela de preços',
    texto:
      'Oi {contato}! Nossa tabela começa em 10 peças. O valor por peça depende do modelo, do tecido e da técnica de estampa. Me diz o que você precisa que eu fecho o número certinho.',
  },
  {
    id: 'grade',
    titulo: 'Pedir grade',
    texto:
      'Oi {contato}! Para eu montar o orçamento preciso da grade de tamanhos, tipo 2 P, 6 M, 5 G, 1 GG. Pode mandar por aqui mesmo.',
  },
  {
    id: 'prazo',
    titulo: 'Prazo médio',
    texto:
      'O prazo de produção é de 12 dias úteis, contando a partir da aprovação da arte final e da confirmação do pagamento da entrada.',
  },
  {
    id: 'catalogo',
    titulo: 'Catálogo',
    texto:
      'Oi {contato}! Te mando o catálogo com os modelos e tecidos que a gente trabalha. Qualquer peça de lá sai personalizada com a sua arte.',
  },
]

export function preencher(texto: string, l: Lead): string {
  return texto.replace(/\{contato\}/g, l.contato || nomeDoLead(l) || 'tudo bem')
}

export function linkDoWhatsApp(l: Lead, mensagem: string): string {
  return linkDoZap(l.telefone, mensagem)
}

/** O v5 escreve dinheiro sem centavos no cartao e no topo da coluna. */
export const formatarDinheiro = dinheiro

/** R$ 16,1 mil, como sai no subtitulo da tela. */
export function emMil(v: number): string {
  return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
}
