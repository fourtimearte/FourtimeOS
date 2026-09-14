import type { Estagio } from './tipos'

/* ==========================================================================
   Os leads de exemplo.

   ATENÇÃO: são inventados. Nenhum nome, telefone ou conversa aqui pertence a
   alguém de verdade.

   São os oito do mockup v5, com os mesmos textos, valores e tempos, para a
   tela do funil poder ser conferida foto contra foto com o desenho.

   O `minutosAtras` NÃO é gravado no banco. A semente converte ele numa data,
   contando para trás a partir da hora em que você semeia, e é a data que vai
   para a coluna. Guardar "47 minutos" congelaria o relógio: o cartão diria
   47 min para sempre, e o funil inteiro existe para responder de quem a
   conversa está esperando, que é uma pergunta sobre o relógio de agora.
   ========================================================================== */

export type LeadDeExemplo = {
  id: string
  nome: string
  contato: string
  telefone: string
  clienteId: string
  estagio: Estagio
  msg: string
  /** ha quantos minutos foi a ultima mensagem, na hora de semear */
  minutosAtras: number
  novo?: number
  valor: number
  cotacao?: string
  pedido?: string
}

export const LEADS_DE_EXEMPLO: LeadDeExemplo[] = [
  {
    id: 'L-118',
    nome: 'Futsal Vila Nova',
    contato: 'Anderson Luz',
    telefone: '62993214455',
    clienteId: '',
    estagio: 'novo',
    msg: 'Boa tarde! Quanto fica 18 camisas de futsal com número nas costas?',
    minutosAtras: 12,
    novo: 2,
    valor: 1620,
  },
  {
    id: 'L-119',
    nome: 'Studio Pilates Flor',
    contato: 'Nice Prado',
    telefone: '62990102030',
    clienteId: '',
    estagio: 'novo',
    msg: 'Vi o trabalho de vocês no Instagram. Fazem legging com logo?',
    minutosAtras: 47,
    novo: 1,
    valor: 2400,
  },
  {
    id: 'L-115',
    nome: 'Supermercado Bom Preço',
    contato: 'Juliana Prado',
    telefone: '6233556677',
    clienteId: '',
    estagio: 'atendimento',
    msg: 'Pode ser 40 camisetas polo azul marinho, bordado no peito.',
    minutosAtras: 180,
    valor: 2800,
  },
  {
    id: 'L-116',
    nome: 'Atlética Medicina UFX',
    contato: 'Bruno Sá',
    telefone: '62996667788',
    clienteId: '',
    estagio: 'atendimento',
    msg: 'Vamos precisar de 60 regatas para o interatlética.',
    minutosAtras: 320,
    valor: 3300,
  },
  {
    id: 'L-113',
    nome: 'Vôlei Clube Araras',
    contato: 'Juliana Prado',
    telefone: '64997772211',
    clienteId: '',
    estagio: 'cotacao',
    msg: 'Recebi a cotação, vou mostrar pra diretoria amanhã.',
    minutosAtras: 1440,
    valor: 1860,
    cotacao: 'CT20260183',
  },
  {
    id: 'L-110',
    nome: 'Escola Girassol',
    contato: 'Paulo',
    telefone: '62975279785',
    clienteId: 'C0002',
    estagio: 'negociando',
    msg: 'Se fechar o 2º lote junto, consegue 10% no total?',
    minutosAtras: 2880,
    valor: 4140,
  },
  {
    id: 'L-104',
    nome: 'Igreja Rio Claro',
    contato: 'Renata',
    telefone: '62943742169',
    clienteId: 'C0003',
    estagio: 'fechado',
    msg: 'Fechado. Segue o pagamento da entrada.',
    minutosAtras: 9800,
    valor: 14700,
    cotacao: 'CT20260182',
    pedido: 'PD20260001',
  },
  {
    id: 'L-101',
    nome: 'Corrida Noturna 5k',
    contato: 'Dona Lia',
    telefone: '62991234567',
    clienteId: '',
    estagio: 'perdido',
    msg: 'Fechamos com outro fornecedor pelo prazo, obrigado.',
    minutosAtras: 12000,
    valor: 5200,
  },
]

