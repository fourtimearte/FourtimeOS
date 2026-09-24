import { vinculo } from '@shared'
import { chamar, tabela } from '@shared/supabase'
import { ESTAGIOS, type Estagio, type Lead, type Mensagem } from './tipos'

/* ==========================================================================
   A conversa do funil com o Supabase.

   DUAS LEITURAS SEPARADAS, E ISSO É O DESENHO.

   O quadro mostra oito, vinte, cem cartões, e de cada um ele precisa de uma
   linha só: o trecho da última mensagem e há quanto tempo ela chegou. A
   conversa inteira, com os áudios, só interessa quando alguém abre um cartão
   para conversar.

   Se a conversa viesse junto com o quadro, abrir o funil baixaria toda a
   troca de mensagens de todo mundo para mostrar cem trechos de uma linha. Por
   isso `lead` guarda a última mensagem repetida numa coluna sua, e
   `carregarConversa` só roda quando o inbox abre.
   ========================================================================== */

type LinhaDoLead = {
  id: string
  nome: string
  contato: string
  telefone: string
  cliente_id: string | null
  estagio: Estagio
  valor: number
  vendedor_id: string | null
  ultima_msg: string
  ultima_msg_em: string | null
  nao_lidas: number
  janela_ate: string | null
  teste: boolean
  equipe: { nome: string } | null
  cotacao: { id: string }[] | null
  pedido: { numero: string }[] | null
}

/* O PostgREST monta o join pelo nome da tabela apontada. `cotacao(id)` e
   `pedido(numero)` vêm como lista porque a chave estrangeira está do lado
   deles: um lead pode ter mais de uma cotação, e é a mais recente que o cartão
   mostra. */
const COLUNAS =
  'id,nome,contato,telefone,cliente_id,estagio,valor,vendedor_id,ultima_msg,' +
  'ultima_msg_em,nao_lidas,janela_ate,teste,equipe(nome),' +
  'cotacao(id),pedido(numero)'

function deLinha(l: LinhaDoLead): Lead {
  return {
    id: l.id,
    clienteId: l.cliente_id ?? '',
    nomeLivre: l.nome,
    contato: l.contato ?? '',
    telefone: l.telefone ?? '',
    estagio: l.estagio,
    msg: l.ultima_msg ?? '',
    ultimaMsgEm: l.ultima_msg_em ?? '',
    novo: Number(l.nao_lidas) || 0,
    valor: Number(l.valor) || 0,
    cotacao: l.cotacao?.[0]?.id ?? '',
    pedido: l.pedido?.[0]?.numero ?? '',
    janelaAte: l.janela_ate ?? '',
    vendedorId: l.vendedor_id ?? '',
    vendedorNome: l.equipe?.nome ?? '',
    teste: !!l.teste,
  }
}

function paraLinha(l: Lead) {
  return {
    nome: l.nomeLivre.trim() || 'Novo lead',
    contato: l.contato,
    telefone: l.telefone,
    cliente_id: vinculo(l.clienteId),
    estagio: l.estagio,
    valor: l.valor,
    vendedor_id: vinculo(l.vendedorId),
  }
}

export async function carregarLeads(): Promise<Lead[]> {
  const linhas = await tabela<LinhaDoLead[]>(
    `lead?select=${COLUNAS}&order=ultima_msg_em.desc.nullslast,criado_em.desc`,
  )
  return linhas.map(deLinha)
}

export async function acharLead(id: string): Promise<Lead | null> {
  const linhas = await tabela<LinhaDoLead[]>(
    `lead?select=${COLUNAS}&id=eq.${encodeURIComponent(id)}`,
  )
  return linhas.length ? deLinha(linhas[0]) : null
}

export async function salvarLead(l: Lead): Promise<Lead> {
  if (l.id) {
    await tabela(`lead?id=eq.${encodeURIComponent(l.id)}`, { metodo: 'PATCH', corpo: paraLinha(l) })
    const salvo = await acharLead(l.id)
    if (!salvo) throw new Error('Gravei, mas não consegui ler o lead de volta.')
    return salvo
  }
  const criado = await tabela<{ id: string }[]>('lead', {
    metodo: 'POST',
    devolver: true,
    corpo: [paraLinha(l)],
  })
  const id = criado[0]?.id
  if (!id) throw new Error('O banco aceitou mas não devolveu a linha.')
  const salvo = await acharLead(id)
  if (!salvo) throw new Error('Gravei, mas não consegui ler o lead de volta.')
  return salvo
}

/* Mover e mexer: as não lidas somem, porque alguém olhou.

   Só as duas colunas vão no PATCH, e não o lead inteiro. Arrastar um cartão
   enquanto outra pessoa corrige o telefone do mesmo lead não pode desfazer a
   correção dela, e mandar o objeto inteiro é exatamente o que faria isso. */
export async function moverLead(id: string, estagio: Estagio): Promise<Lead | null> {
  await tabela(`lead?id=eq.${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    corpo: { estagio, nao_lidas: 0 },
  })
  return acharLead(id)
}

/** Abrir a conversa zera o contador vermelho, como em qualquer mensageiro. */
export async function marcarLido(id: string): Promise<void> {
  await tabela(`lead?id=eq.${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    corpo: { nao_lidas: 0 },
  })
}

/* O LEAD VIRA CLIENTE, e quem faz isso e o banco.

   A funcao `lead_vira_cliente` existe desde a migracao 011 e ficou parada:
   ela acha o cliente que ja existe pela chave do nome em vez de criar o
   segundo (foi a falta dessa trava que virou 225 clientes em 900), passa a
   carteira ao vendedor do lead quando o cliente ainda nao tinha dono, e liga o
   lead ao cliente. Tres coisas numa transacao so.

   Ela devolve a LINHA do cliente. Aqui so o id volta, de proposito: quem sabe
   montar um Cliente e o dominio de cliente, e ele tem uma view com mais coluna
   do que a tabela crua que a funcao devolve. Devolver o id e deixar a tela de
   clientes ler pela porta dela mantem a montagem num lugar so. */
export async function leadViraCliente(leadId: string): Promise<string> {
  const c = await chamar<{ id: string } | { id: string }[]>('lead_vira_cliente', {
    p_lead: leadId,
  })
  const linha = Array.isArray(c) ? c[0] : c
  const id = linha?.id
  if (!id) throw new Error('O banco criou o cliente mas não devolveu o id.')
  return id
}

export async function apagarLead(id: string): Promise<void> {
  await tabela(`lead?id=eq.${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

/* QUEM PODE SER DONO DE UM LEAD.

   Sai da view `equipe`, e nao da lista escrita a mao em dominio/banco. Aquela
   lista e texto: cinco nomes que nao sao pessoas. O dono do lead e a ponta da
   corrente que leva ate o pedido (lead -> cotacao -> pedido), e corrente que
   comeca num texto nao chega em ninguem.

   So quem esta APROVADO. Pessoa esperando aprovacao nao pode receber lead:
   ela ainda nao entra no sistema, e o lead ficaria com dono que nao abre a
   tela onde ele aparece.

   E nao filtra por papel de proposito. Quem pode mexer no lead quem decide e o
   banco, e o papel e configuravel desde a 028: uma lista fixa de papeis aqui
   envelheceria na primeira vez que a fabrica criasse um papel novo. */
export type DonoPossivel = { id: string; nome: string }

export async function carregarDonosPossiveis(): Promise<DonoPossivel[]> {
  return tabela<DonoPossivel[]>(
    'equipe?select=id,nome&situacao=eq.aprovado&order=nome.asc',
  )
}

/* --- a conversa ---------------------------------------------------------- */

type LinhaDaMensagem = {
  id: string
  quem: 'nos' | 'cliente' | 'sistema'
  tipo: 'texto' | 'audio' | 'imagem' | 'arquivo' | 'modelo'
  texto: string
  arquivo: string
  nome_do_arquivo: string
  situacao: string
  em: string
}

export async function carregarConversa(leadId: string): Promise<Mensagem[]> {
  if (!leadId) return []
  const linhas = await tabela<LinhaDaMensagem[]>(
    'mensagem?select=id,quem,tipo,texto,arquivo,nome_do_arquivo,situacao,em' +
      '&lead_id=eq.' +
      encodeURIComponent(leadId) +
      '&order=em.asc',
  )
  return linhas.map((m) => ({
    id: m.id,
    quem: m.quem,
    tipo: m.tipo,
    texto: m.texto ?? '',
    arquivo: m.arquivo ?? '',
    nomeDoArquivo: m.nome_do_arquivo ?? '',
    em: m.em,
    lida: m.situacao === 'lida',
  }))
}

/* Registrar o que foi mandado por fora.

   Enquanto a integração do WhatsApp não existe, quem manda a mensagem é o
   vendedor, no celular dele, e isto aqui é o registro do que ele mandou. Por
   isso grava DUAS coisas: a linha na conversa e o resumo no cartão. Gravar só
   a conversa deixaria o cartão dizendo que o cliente falou por último. */
export async function registrarMensagem(leadId: string, texto: string): Promise<Mensagem[]> {
  const agora = new Date().toISOString()
  await tabela('mensagem', {
    metodo: 'POST',
    corpo: [{ lead_id: leadId, quem: 'nos', tipo: 'texto', texto, em: agora }],
  })
  await tabela(`lead?id=eq.${encodeURIComponent(leadId)}`, {
    metodo: 'PATCH',
    corpo: { ultima_msg: texto, ultima_msg_em: agora, nao_lidas: 0 },
  })
  return carregarConversa(leadId)
}

export function porEstagio(leads: Lead[]): Record<Estagio, Lead[]> {
  const saida = {} as Record<Estagio, Lead[]>
  ESTAGIOS.forEach((e) => {
    saida[e] = leads.filter((l) => l.estagio === e)
  })
  return saida
}
