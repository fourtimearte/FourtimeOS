import { ESTAGIOS, type Estagio, type Lead, type Mensagem } from './tipos'

/* ==========================================================================
   A porta de entrada do funil.

   Os oito leads sao os mesmos do mockup v5, com os mesmos textos, valores e
   tempos, para a tela do sistema poder ser conferida foto contra foto com o
   desenho. Quando o Supabase entrar, SO ESTE ARQUIVO muda.

   ATENCAO: sao inventados. Nenhum nome ou telefone aqui pertence a alguem.
   ========================================================================== */

export const DADO_DE_EXEMPLO = true

const CHAVE = 'ft.funil.v5'

type Semente = {
  id: string
  nome: string
  contato: string
  telefone: string
  clienteId: string
  estagio: Estagio
  msg: string
  min: number
  novo?: number
  valor: number
  cotacao?: string
  pedido?: string
}

const SEMENTES: Semente[] = [
  {
    id: 'L-118',
    nome: 'Futsal Vila Nova',
    contato: 'Anderson Luz',
    telefone: '62993214455',
    clienteId: '',
    estagio: 'novo',
    msg: 'Boa tarde! Quanto fica 18 camisas de futsal com número nas costas?',
    min: 12,
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
    min: 47,
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
    min: 180,
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
    min: 320,
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
    min: 1440,
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
    min: 2880,
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
    min: 9800,
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
    min: 12000,
    valor: 5200,
  },
]

/* A conversa nasce do estagio, como no v5: quanto mais longe o lead andou,
   mais coisa foi dita. */
function conversaDe(s: Semente): Mensagem[] {
  const ordem = ESTAGIOS.indexOf(s.estagio)
  const c: Mensagem[] = [{ id: s.id + 'm1', quem: 'cliente', texto: s.msg, min: s.min }]
  if (ordem >= 1) {
    c.push({
      id: s.id + 'm2',
      quem: 'nos',
      texto:
        'Oi ' +
        (s.contato.split(' ')[0] || '') +
        '! Aqui é a Carla da Fourtime. Consigo sim, me passa a grade de tamanhos?',
      min: Math.max(1, s.min - 40),
      lida: true,
    })
    c.push({
      id: s.id + 'm3',
      quem: 'cliente',
      texto: 'Manda o que precisa que eu levanto aqui.',
      min: Math.max(1, s.min - 60),
    })
  }
  if (s.cotacao) {
    c.push({
      id: s.id + 'm4',
      quem: 'nos',
      texto: 'Cotação ' + s.cotacao + ' enviada em PDF. Válida até 22/09.',
      min: Math.max(1, Math.round(s.min / 2)),
      lida: true,
    })
  }
  return c
}

function montar(s: Semente): Lead {
  return {
    id: s.id,
    clienteId: s.clienteId,
    nomeLivre: s.nome,
    contato: s.contato,
    telefone: s.telefone,
    estagio: s.estagio,
    msg: s.msg,
    min: s.min,
    novo: s.novo ?? 0,
    valor: s.valor,
    cotacao: s.cotacao ?? '',
    pedido: s.pedido ?? '',
    conversa: conversaDe(s),
  }
}

function lerGuardado(): Lead[] | null {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return null
    const lista = JSON.parse(cru) as Lead[]
    return Array.isArray(lista) && lista.length ? lista : null
  } catch {
    return null
  }
}

function guardar(lista: Lead[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
  } catch {
    /* armazenamento bloqueado: o funil vive so nesta aba */
  }
}

let base: Lead[] = lerGuardado() ?? SEMENTES.map(montar)

export function listarLeads(): Lead[] {
  return base
}

export function acharLead(id: string): Lead | null {
  return base.find((l) => l.id === id) ?? null
}

export function salvarLead(l: Lead): Lead {
  const i = base.findIndex((x) => x.id === l.id)
  if (i >= 0) base = base.map((x, k) => (k === i ? l : x))
  else base = [l, ...base]
  guardar(base)
  return l
}

/** Mover e mexer: as nao lidas somem, porque alguem olhou. */
export function moverLead(id: string, estagio: Estagio): Lead | null {
  const l = acharLead(id)
  if (!l || l.estagio === estagio) return l
  return salvarLead({ ...l, estagio, novo: 0 })
}

/** Abrir a conversa zera o contador vermelho, como em qualquer mensageiro. */
export function marcarLido(id: string): Lead | null {
  const l = acharLead(id)
  if (!l || !l.novo) return l
  return salvarLead({ ...l, novo: 0 })
}

export function apagarLead(id: string) {
  base = base.filter((l) => l.id !== id)
  guardar(base)
}

export function recomecarDoExemplo() {
  base = SEMENTES.map(montar)
  guardar(base)
}

export function porEstagio(leads: Lead[]): Record<Estagio, Lead[]> {
  const saida = {} as Record<Estagio, Lead[]>
  ESTAGIOS.forEach((e) => {
    saida[e] = leads.filter((l) => l.estagio === e)
  })
  return saida
}
