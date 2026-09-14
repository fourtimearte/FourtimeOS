import { tabela } from '@shared/supabase'
import type { Cliente, Segmento, TipoDePessoa } from './tipos'

/* ==========================================================================
   A conversa do cliente com o Supabase.

   Aqui não tem nenhuma trava de permissão: quem decide é a regra de acesso
   escrita na tabela. Se alguém da produção chamar salvarCliente na marra, o
   banco devolve "seu acesso não permite fazer isso" e nada acontece. A tela
   esconde os botões por educação, não por segurança.

   A LISTA VEM DA VIEW, E NÃO DA TABELA. Em cliente_na_lista (migração 015) os
   três números do topo da tela já vêm somados: quantos pedidos, quanto
   comprou, quando foi a última vez. E eles somam duas coisas que a tabela
   sozinha não sabe juntar: o histórico que veio do Bling e os pedidos que
   este sistema fechou. Refazer essa conta aqui seria a mesma conta em dois
   lugares, e no dia em que elas discordarem ninguém vai saber qual está certa.
   ========================================================================== */

/** O nome das colunas no banco é com underline; no sistema é como se fala. */
type LinhaDoCliente = {
  id: string
  nome: string
  fantasia: string
  tipo: TipoDePessoa
  documento: string
  contato: string
  telefone: string
  celular: string
  email: string
  endereco: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  tipo_de_contato: string
  segmento: Segmento
  vendedor: string
  teste: boolean
  criado_em: string
  pedidos: number
  total: number
  ultimo_pedido: string
}

const COLUNAS =
  'id,nome,fantasia,tipo,documento,contato,telefone,celular,email,endereco,' +
  'complemento,bairro,cidade,uf,cep,tipo_de_contato,segmento,vendedor,teste,' +
  'criado_em,pedidos,total,ultimo_pedido'

function deLinha(l: LinhaDoCliente): Cliente {
  return {
    id: l.id,
    nome: l.nome,
    fantasia: l.fantasia ?? '',
    tipo: l.tipo,
    documento: l.documento ?? '',
    contato: l.contato ?? '',
    telefone: l.telefone ?? '',
    celular: l.celular ?? '',
    email: l.email ?? '',
    endereco: l.endereco ?? '',
    complemento: l.complemento ?? '',
    bairro: l.bairro ?? '',
    cidade: l.cidade ?? '',
    uf: l.uf ?? '',
    cep: l.cep ?? '',
    tipoDeContato: l.tipo_de_contato ?? '',
    segmento: l.segmento,
    vendedor: l.vendedor ?? '',
    /* numeric do Postgres chega como texto no JSON, e "66280.00" + 1 daria
       "66280.001". Number aqui, uma vez, em vez de em cada tela. */
    pedidos: Number(l.pedidos) || 0,
    total: Number(l.total) || 0,
    ultimoPedido: l.ultimo_pedido ?? '',
    criadoEm: (l.criado_em ?? '').slice(0, 10),
  }
}

/* O que vai para o banco na hora de gravar. Os três números do topo NÃO entram:
   eles são conta da view, e mandar eles de volta seria gravar por cima de um
   resultado com um palpite. */
function paraLinha(c: Cliente) {
  return {
    nome: c.nome.trim(),
    fantasia: c.fantasia,
    tipo: c.tipo,
    documento: c.documento,
    contato: c.contato,
    telefone: c.telefone,
    celular: c.celular,
    email: c.email,
    endereco: c.endereco,
    complemento: c.complemento,
    bairro: c.bairro,
    cidade: c.cidade,
    uf: c.uf,
    cep: c.cep,
    tipo_de_contato: c.tipoDeContato,
    segmento: c.segmento,
    vendedor: c.vendedor,
  }
}

export async function carregarClientes(): Promise<Cliente[]> {
  const linhas = await tabela<LinhaDoCliente[]>(`cliente_na_lista?select=${COLUNAS}&order=nome.asc`)
  return linhas.map(deLinha)
}

export async function acharCliente(id: string): Promise<Cliente | null> {
  const linhas = await tabela<LinhaDoCliente[]>(
    `cliente_na_lista?select=${COLUNAS}&id=eq.${encodeURIComponent(id)}`,
  )
  return linhas.length ? deLinha(linhas[0]) : null
}

/* Gravar devolve a linha da TABELA, que não tem os três números da view. Então
   a leitura vem da view logo depois, num pedido separado.

   São dois pedidos onde poderia ser um, e é de propósito: o contrário seria a
   tela mostrar zero pedidos para um cliente que tem catorze, por um instante,
   toda vez que alguém corrigisse um telefone. */
export async function salvarCliente(c: Cliente): Promise<Cliente> {
  if (c.id) {
    await tabela(`cliente?id=eq.${encodeURIComponent(c.id)}`, {
      metodo: 'PATCH',
      corpo: paraLinha(c),
    })
    const salvo = await acharCliente(c.id)
    if (!salvo) throw new Error('Gravei, mas não consegui ler o cliente de volta.')
    return salvo
  }

  const criado = await tabela<{ id: string }[]>('cliente', {
    metodo: 'POST',
    devolver: true,
    corpo: [paraLinha(c)],
  })
  const id = criado[0]?.id
  if (!id) throw new Error('O banco aceitou mas não devolveu a linha.')
  const salvo = await acharCliente(id)
  if (!salvo) throw new Error('Gravei, mas não consegui ler o cliente de volta.')
  return salvo
}

export async function apagarCliente(id: string): Promise<void> {
  await tabela(`cliente?id=eq.${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

/** O molde de um cliente que ainda não existe. */
export function clienteEmBranco(): Cliente {
  return {
    id: '',
    nome: '',
    fantasia: '',
    tipo: 'F',
    documento: '',
    contato: '',
    telefone: '',
    celular: '',
    email: '',
    endereco: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: 'GO',
    cep: '',
    tipoDeContato: 'Cliente',
    segmento: 'outros',
    vendedor: '',
    pedidos: 0,
    total: 0,
    ultimoPedido: '',
    criadoEm: new Date().toISOString().slice(0, 10),
  }
}
