import { ESTAGIOS, type Estagio, type Lead, type Mensagem, type Origem } from './tipos'

/* ==========================================================================
   A porta de entrada do funil.

   Igual as outras: lista de exemplo aqui dentro, alteracoes guardadas no
   proprio navegador. Quando o Supabase entrar, SO ESTE ARQUIVO muda.

   ATENCAO: os leads abaixo sao inventados.
   ========================================================================== */

export const DADO_DE_EXEMPLO = true

const CHAVE = 'ft.funil'
const DIA = 24 * 60 * 60 * 1000

function sorteio(semente: number) {
  let x = semente
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

type Semente = [string, string, string, Estagio, Origem, string, number, number, number]

/* nome, contato, cidade, estagio, origem, vendedor, pecas, valor, dias parado */
const SEMENTES: Semente[] = [
  ['Escola Bem Viver', 'Marta', 'Goiânia', 'novo', 'whatsapp', 'Marcela', 120, 9000, 0],
  ['CrossFit Norte', 'Tiago', 'Anápolis', 'novo', 'instagram', 'Rafael', 40, 3600, 1],
  ['Loja Pedal GO', 'Nice', 'Goiânia', 'novo', 'indicacao', 'Marcela', 25, 2800, 4],
  ['Time Vila Nova FC', 'Edson', 'Goiânia', 'contato', 'whatsapp', 'Rafael', 60, 5400, 1],
  ['Buffet Encanto', 'Cida', 'Aparecida de Goiânia', 'contato', 'site', 'Marcela', 30, 2100, 5],
  ['Igreja Nova Vida', 'Pastor Elias', 'Trindade', 'orcando', 'indicacao', 'Rafael', 220, 15400, 0],
  ['Clínica Sorriso', 'Dra. Paula', 'Goiânia', 'orcando', 'whatsapp', 'Marcela', 18, 2340, 2],
  ['Colégio Passo Certo', 'Wagner', 'Rio Verde', 'enviado', 'site', 'Rafael', 300, 21000, 3],
  ['Academia Corpo e Cia', 'Léo', 'Goiânia', 'enviado', 'instagram', 'Marcela', 85, 7650, 1],
  ['Transporte Rota Sul', 'Seu Ari', 'Itumbiara', 'enviado', 'loja', 'Rafael', 45, 4050, 8],
  ['Escola Girassol', 'Paulo', 'Goiânia', 'ganho', 'whatsapp', 'Rafael', 243, 18759, 2],
  ['Mercado Bom Preço', 'Juliana', 'Goiânia', 'ganho', 'indicacao', 'Marcela', 60, 4800, 6],
  ['Festa Arraiá do Bairro', 'Dona Lia', 'Goiânia', 'perdido', 'whatsapp', 'Marcela', 150, 6000, 12],
  ['Startup Malha Verde', 'Bruno', 'Brasília', 'perdido', 'site', 'Rafael', 20, 1800, 20],
]

const CONVERSAS: Record<Estagio, [string, 'nos' | 'cliente'][]> = {
  novo: [['Oi, vocês fazem camiseta personalizada para time?', 'cliente']],
  contato: [
    ['Oi, vocês fazem uniforme para escola?', 'cliente'],
    ['Fazemos sim! Me conta quantas peças e para quando você precisa.', 'nos'],
    ['São umas 60, para o começo do mês que vem.', 'cliente'],
  ],
  orcando: [
    ['Bom dia, preciso de uniforme para a equipe toda.', 'cliente'],
    ['Bom dia! Já estou montando o orçamento, te mando hoje ainda.', 'nos'],
  ],
  enviado: [
    ['Pode me mandar uma proposta?', 'cliente'],
    ['Acabei de te mandar a proposta por e-mail. Qualquer dúvida me chama.', 'nos'],
  ],
  ganho: [
    ['Fechado, pode produzir!', 'cliente'],
    ['Perfeito, já mandei para a produção. Obrigado pela confiança!', 'nos'],
  ],
  perdido: [
    ['Obrigado, mas dessa vez fechamos com outro fornecedor.', 'cliente'],
    ['Sem problema! Fico à disposição para a próxima.', 'nos'],
  ],
}

function montar(s: Semente, i: number): Lead {
  const [nome, contato, cidade, estagio, origem, vendedor, pecas, valor, parado] = s
  const r = sorteio(7919 * (i + 5))
  const criado = new Date(Date.now() - (parado + 4 + Math.floor(r() * 25)) * DIA)
  const mexido = new Date(Date.now() - parado * DIA)
  const conversa: Mensagem[] = CONVERSAS[estagio].map(([texto, quem], k) => ({
    id: 'M' + i + k,
    quem,
    texto,
    em: new Date(mexido.getTime() - (CONVERSAS[estagio].length - k) * 3600000).toISOString(),
  }))
  return {
    id: 'LD' + String(1000 + i * 7),
    nome,
    contato,
    telefone: '62' + String(900000000 + Math.floor(r() * 99999999)).slice(0, 9),
    cidade,
    origem,
    estagio,
    vendedor,
    pecas,
    valor,
    criadoEm: criado.toISOString(),
    mexidoEm: mexido.toISOString(),
    cotacao: estagio === 'ganho' && nome === 'Escola Girassol' ? 'CT20260183' : '',
    clienteId: nome === 'Escola Girassol' ? 'C0002' : '',
    observacao: '',
    conversa,
  }
}

function lerGuardado(): Lead[] | null {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return null
    const lista = JSON.parse(cru) as Lead[]
    return Array.isArray(lista) ? lista : null
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
  const salvo: Lead = { ...l, mexidoEm: new Date().toISOString() }
  const i = base.findIndex((x) => x.id === salvo.id)
  if (i >= 0) base = base.map((x, k) => (k === i ? salvo : x))
  else base = [salvo, ...base]
  guardar(base)
  return salvo
}

/** Mover e salvar, porque mover E mexer: o relogio do esquecimento zera. */
export function moverLead(id: string, estagio: Estagio): Lead | null {
  const l = acharLead(id)
  if (!l || l.estagio === estagio) return l
  return salvarLead({ ...l, estagio })
}

export function apagarLead(id: string) {
  base = base.filter((l) => l.id !== id)
  guardar(base)
}

export function recomecarDoExemplo() {
  base = SEMENTES.map(montar)
  guardar(base)
}

/** Os leads de cada estagio, na ordem em que a coluna mostra. */
export function porEstagio(leads: Lead[]): Record<Estagio, Lead[]> {
  const saida = {} as Record<Estagio, Lead[]>
  ESTAGIOS.forEach((e) => {
    saida[e] = leads.filter((l) => l.estagio === e)
  })
  return saida
}
