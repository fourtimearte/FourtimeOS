/* O banco de mentira de testes/transporte.mjs: os mesmos nomes e numeros do
   wireframe de Transporte de 03/10/2026. O dia de hoje do wireframe e sexta,
   23 de outubro de 2026, 16:40, e o teste congela o relogio nele. Nada aqui e
   dado de verdade: os nomes sao inventados e o CNPJ so fecha a conta dos
   digitos. */
import { cn } from './materiais-dados.mjs'
export const HOJE = '2026-10-23T16:40:00Z'

export const transportadores = [
  { id: 't1', nome: 'João', meio: 'motoboy', cnpj: null, contato: '(62) 9 0000-0001', onde_atende: 'Goiânia e Aparecida de Goiânia', prazo: 'mesmo dia', observacao: 'Recebe por Pix, toda sexta.' },
  { id: 't2', nome: 'Wesley', meio: 'motoboy', cnpj: null, contato: '(62) 9 0000-0002', onde_atende: 'Goiânia', prazo: 'mesmo dia', observacao: '' },
  { id: 't3', nome: 'Uber', meio: 'uber', cnpj: null, contato: 'conta da empresa', onde_atende: 'Goiânia e região', prazo: '', observacao: '' },
  { id: 't4', nome: '99', meio: 'uber', cnpj: null, contato: 'conta da empresa', onde_atende: 'Goiânia e região', prazo: '', observacao: '' },
  { id: 't5', nome: 'Táxi', meio: 'taxi', cnpj: null, contato: '', onde_atende: 'Goiânia', prazo: '', observacao: '' },
  { id: 't6', nome: 'Correios', meio: 'transportadora', cnpj: null, contato: '', onde_atende: 'Brasil inteiro', prazo: '2 a 8 dias úteis', observacao: 'PAC e SEDEX' },
  { id: 't7', nome: 'Jadlog', meio: 'transportadora', cnpj: null, contato: '', onde_atende: 'GO e DF', prazo: '1 a 3 dias úteis', observacao: '' },
  { id: 't8', nome: 'Braspress', meio: 'transportadora', cnpj: null, contato: '', onde_atende: 'Capitais SP e GO', prazo: '2 a 5 dias úteis', observacao: '' },
  { id: 't9', nome: 'Total Express', meio: 'transportadora', cnpj: null, contato: '', onde_atende: 'Estado de São Paulo', prazo: '1 a 4 dias úteis', observacao: '' },
  { id: 't10', nome: 'Transportadora Exemplo Ltda', meio: 'transportadora', cnpj: cn('678901230001'), contato: 'Comercial · (62) 3000-0000', onde_atende: 'Goiás e Triângulo Mineiro', prazo: '2 a 4 dias úteis', observacao: 'Traz a malha da Malharia Exemplo.' },
]
const T = (id) => transportadores.find((t) => t.id === id)

export const pedidos = [
  ['PD-0423', 'Clínica Bem Viver'], ['PD-0420', 'Vôlei Clube Araras'], ['PD-0418', 'Escola Girassol'], ['PD-0415', 'Studio Pilates Flor'],
  ['PD-0412', 'Futsal Vila Nova'], ['PD-0410', 'Corrida Solidária 10K'], ['PD-0407', 'Camisa Congresso 2026'], ['PD-0405', 'Uniforme Equipe Verão'],
  ['PD-0398', 'Interclasse Colégio Atena'], ['PD-0391', 'Academia Corpo Ativo'], ['PD-0388', 'Drogaria Viver Bem'], ['PD-0380', 'Igreja Nova Aliança'],
].map(([numero, cliente]) => ({ numero, cliente }))
const P = (n) => pedidos.find((p) => p.numero === n)

let n = 0
const L = (dia, hora, quem, motivo, alvo, destino, valor, forma, pago, extra = {}) => {
  const t = T(quem)
  const p = motivo === 'entrega' && alvo ? P(alvo) : null
  return {
    id: 'l' + (++n), quando: `2026-${dia.slice(3)}-${dia.slice(0, 2)}T${hora}:00Z`, meio: t.meio, transportador_id: t.id, transportador: t.nome,
    motivo, pedido: p?.numero ?? null, cliente: p?.cliente ?? null, fornecedor: motivo === 'busca' ? alvo : null, destino, valor, forma,
    pago, pago_em: pago ? `2026-${dia.slice(3)}-${dia.slice(0, 2)}T18:00:00Z` : null, quem_nome: extra.quem ?? 'Expedição', observacao: extra.obs ?? '',
  }
}
/* outubro, do dia 23 para tras. O motoboy recebe na sexta: o que e desta semana esta aberto. */
export const outubro = [
  L('23/10', '14:10', 't1', 'entrega', 'PD-0412', 'Vila Nova, Goiânia', 25, 'pix', false),
  L('23/10', '11:32', 't3', 'busca', 'Aviamentos Exemplo Ltda', 'Campinas, Goiânia', 31.9, 'cartao', true, { quem: 'Henrique', obs: 'Linha e elástico que faltaram para o PD-0418.' }),
  L('23/10', '10:05', 't1', 'entrega', 'PD-0410', 'Setor Bueno, Goiânia', 20, 'pix', false),
  L('23/10', '09:12', 't10', 'busca', 'Malharia Exemplo Ltda', 'Goiânia, GO', 640, 'boleto', false, { quem: 'Financeiro', obs: 'Frete da malha da NF 1907. Boleto para o dia 30.' }),
  L('22/10', '16:48', 't2', 'entrega', 'PD-0407', 'Jardim Goiás, Goiânia', 22, 'pix', false),
  L('22/10', '15:20', 't1', 'entrega', 'PD-0405', 'Aparecida de Goiânia', 35, 'pix', false),
  L('22/10', '09:40', 't5', 'outro', '', 'Setor Oeste, Goiânia', 38, 'dinheiro', true, { quem: 'Henrique', obs: 'Levar amostras para a reunião com a Escola Girassol.' }),
  L('21/10', '17:05', 't1', 'entrega', 'PD-0398', 'Setor Marista, Goiânia', 22, 'pix', false),
  L('21/10', '13:15', 't7', 'entrega', 'PD-0391', 'Brasília, DF', 148.5, 'boleto', false, { quem: 'Financeiro' }),
  L('21/10', '10:30', 't4', 'busca', 'Etiquetas Exemplo Ltda', 'Setor Central, Goiânia', 24.6, 'cartao', true),
  L('20/10', '16:02', 't1', 'entrega', 'PD-0398', 'Setor Marista, Goiânia', 22, 'pix', false, { obs: 'Segunda viagem: faltaram 12 camisetas.' }),
  L('20/10', '11:20', 't2', 'entrega', 'PD-0388', 'Setor Coimbra, Goiânia', 20, 'pix', false),
  L('19/10', '15:45', 't1', 'entrega', 'PD-0380', 'Jardim América, Goiânia', 25, 'pix', false),
  L('19/10', '09:50', 't3', 'busca', 'Suprimentos DTF Exemplo Ltda', 'Setor Aeroporto, Goiânia', 27.4, 'cartao', true),
  L('16/10', '16:30', 't1', 'entrega', 'PD-0407', 'Jardim Goiás, Goiânia', 22, 'pix', true),
  L('16/10', '14:12', 't6', 'entrega', 'PD-0388', 'Anápolis, GO', 64.3, 'cartao', true, { obs: 'SEDEX.' }),
  L('16/10', '10:10', 't2', 'entrega', 'PD-0405', 'Aparecida de Goiânia', 35, 'pix', true),
  L('15/10', '15:00', 't1', 'entrega', 'PD-0410', 'Setor Bueno, Goiânia', 20, 'pix', true),
  L('15/10', '11:05', 't3', 'outro', '', 'Setor Sul, Goiânia', 19.8, 'cartao', true, { quem: 'Henrique', obs: 'Buscar a tela de silk no conserto.' }),
  L('14/10', '16:20', 't8', 'entrega', 'PD-0380', 'São Paulo, SP', 286, 'boleto', true, { quem: 'Financeiro' }),
  L('14/10', '09:30', 't1', 'entrega', 'PD-0391', 'Setor Oeste, Goiânia', 20, 'pix', true),
  L('13/10', '14:40', 't2', 'entrega', 'PD-0398', 'Setor Marista, Goiânia', 22, 'pix', true),
  L('13/10', '10:15', 't4', 'busca', 'Aviamentos Exemplo Ltda', 'Campinas, Goiânia', 29.9, 'cartao', true),
  L('09/10', '17:10', 't1', 'entrega', 'PD-0388', 'Setor Coimbra, Goiânia', 20, 'pix', true),
  L('09/10', '11:45', 't5', 'entrega', 'PD-0380', 'Jardim América, Goiânia', 42, 'dinheiro', true, { obs: 'Motoboy não podia, pedido com hora marcada.' }),
  L('08/10', '15:30', 't1', 'entrega', 'PD-0391', 'Setor Oeste, Goiânia', 20, 'pix', true),
  L('08/10', '09:20', 't10', 'busca', 'Malharia Exemplo Ltda', 'Goiânia, GO', 480, 'boleto', true, { quem: 'Financeiro', obs: 'Frete da malha da NF 1882.' }),
  L('07/10', '16:15', 't2', 'entrega', 'PD-0380', 'Jardim América, Goiânia', 25, 'pix', true),
  L('07/10', '10:40', 't3', 'busca', 'Gráfica Exemplo Ltda', 'Setor Pedro Ludovico, Goiânia', 26.3, 'cartao', true),
  L('06/10', '14:00', 't1', 'entrega', 'PD-0388', 'Setor Coimbra, Goiânia', 20, 'pix', true),
  L('06/10', '11:10', 't6', 'entrega', 'PD-0391', 'Uberlândia, MG', 58.9, 'cartao', true, { obs: 'PAC.' }),
  L('05/10', '15:35', 't1', 'entrega', 'PD-0380', 'Jardim América, Goiânia', 25, 'pix', true),
  L('02/10', '16:45', 't2', 'entrega', 'PD-0388', 'Setor Coimbra, Goiânia', 20, 'pix', true),
  L('02/10', '10:25', 't3', 'busca', 'Aviamentos Exemplo Ltda', 'Campinas, Goiânia', 30.2, 'cartao', true),
  L('01/10', '14:20', 't1', 'entrega', 'PD-0380', 'Jardim América, Goiânia', 25, 'pix', true),
]
/* setembro inteiro, so para a comparacao: mesmo ritmo, um pouco mais barato */
export const setembro = []
for (let d = 1; d <= 30; d++) {
  const semana = new Date(Date.UTC(2026, 8, d)).getUTCDay()
  if (semana === 0 || semana === 6) continue
  const dia = String(d).padStart(2, '0') + '/09'
  setembro.push(L(dia, '15:00', d % 2 ? 't1' : 't2', 'entrega', 'PD-0380', 'Goiânia', 20 + (d % 3) * 2, 'pix', true))
  if (d % 3 === 0) setembro.push(L(dia, '10:30', 't3', 'busca', 'Aviamentos Exemplo Ltda', 'Campinas, Goiânia', 26 + (d % 5), 'cartao', true))
  if (d === 9) setembro.push(L(dia, '09:00', 't10', 'busca', 'Malharia Exemplo Ltda', 'Goiânia, GO', 480, 'boleto', true))
  if (d === 3) setembro.push(L(dia, '11:00', 't7', 'entrega', 'PD-0380', 'Brasília, DF', 180, 'boleto', true))
  if (d === 15) setembro.push(L(dia, '11:00', 't7', 'entrega', 'PD-0380', 'Brasília, DF', 148.5, 'boleto', true))
  if (d === 22) setembro.push(L(dia, '09:00', 't10', 'busca', 'Malharia Exemplo Ltda', 'Goiânia, GO', 480, 'boleto', true))
  if (d === 18) setembro.push(L(dia, '13:00', 't8', 'entrega', 'PD-0380', 'São Paulo, SP', 240, 'boleto', true))
}
export const lancamentos = [...outubro, ...setembro]

/* a resposta do Supabase de mentira para o que e de transporte */
export function bancoDoTransporte() {
  let lista = [...lancamentos]
  const gravados = []
  const extra = async (u, m, req) => {
    if (u.includes('transportador_na_lista')) return transportadores
    if (u.includes('lancamento_de_transporte_na_lista')) {
      const de = /quando=gte\.([0-9-]+)/.exec(u)?.[1] ?? '0000'; const ate = /quando=lt\.([0-9-]+)/.exec(u)?.[1] ?? '9999'
      return lista.filter((l) => l.quando >= de && l.quando < ate).sort((a, b) => (a.quando < b.quando ? 1 : -1))
    }
    if (u.includes('pedido_na_fabrica') && u.includes('select=numero,cliente')) return pedidos
    if (u.includes('rpc/acertar_transporte')) { const a = JSON.parse(req.postData()); gravados.push(['acertar', a]); lista = lista.map((l) => a.p_lancamentos.includes(l.id) ? { ...l, pago: true, pago_em: HOJE } : l); return {} }
    if (u.includes('rpc/lancar_transporte')) { const a = JSON.parse(req.postData()); gravados.push(['lancar', a]); const t = T(a.p_transportador); lista = [{ id: 'novo' + gravados.length, quando: a.p_quando, meio: t.meio, transportador_id: t.id, transportador: t.nome, motivo: a.p_motivo, pedido: a.p_pedido, cliente: P(a.p_pedido)?.cliente ?? null, fornecedor_id: a.p_fornecedor, fornecedor: null, destino: a.p_destino, valor: a.p_valor, forma: a.p_forma, pago: a.p_pago, pago_em: a.p_pago ? HOJE : null, quem_nome: 'Henrique', observacao: a.p_observacao }, ...lista]; return {} }
    return undefined
  }
  return { extra, gravados }
}
