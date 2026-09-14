import { chamar, tabela } from '@shared/supabase'
import { CLIENTES_DE_EXEMPLO } from '@dominio/cliente'

/* ==========================================================================
   A semente.

   O banco de verdade nasce VAZIO, e tela vazia não se confere: não dá para
   saber se a ordenação está certa olhando zero linhas, nem se a paginação
   quebra em 1.901 contatos olhando nenhum.

   Então esta função grava o conteúdo de exemplo DENTRO do banco, marcado como
   teste. A diferença em relação ao que havia antes é o que importa: antes a
   lista de exemplo vivia dentro do navegador e o caminho que rodava era falso.
   Agora o conteúdo é de mentira mas o CAMINHO é o de verdade: mesma consulta,
   mesma regra de acesso, mesmo erro quando a internet cai, mesma conta da
   view somando o histórico do Bling com os pedidos do sistema.

   Tudo que ela grava leva teste = true, e some inteiro em uma chamada no dia
   do lançamento. A regra está na migração 014.
   ========================================================================== */

export type ContaDeTeste = { tabela: string; linhas: number }

export async function contarDadosDeTeste(): Promise<ContaDeTeste[]> {
  const linhas = await tabela<{ tabela: string; linhas: number }[]>(
    'dado_de_teste?select=tabela,linhas&order=tabela.asc',
  )
  return linhas.map((l) => ({ tabela: l.tabela, linhas: Number(l.linhas) || 0 }))
}

export function totalDeTeste(contas: ContaDeTeste[]): number {
  return contas.reduce((s, c) => s + c.linhas, 0)
}

/* O PostgREST aceita uma lista inteira num POST só, e é isso que faz a semente
   ser rápida. Mas não em um pedido só de 1.901 linhas: um erro no meio de um
   pedido gigante derruba o pedido inteiro, e a mensagem não diz qual linha
   causou. Em lotes, quem falha é o lote, e o resto entra. */
const LOTE = 100

/* Os três números do histórico entram nas colunas de ANTES do sistema (015):
   o cliente de exemplo tem 14 pedidos e R$ 66.280 comprados, e esses pedidos
   não existem na tabela pedido nem deveriam. É exatamente a forma do dado que
   vai chegar do Bling, e semear assim é o que faz a soma da view ser conferida
   de verdade em vez de ficar sempre zerada de um lado. */
function paraOBanco(c: (typeof CLIENTES_DE_EXEMPLO)[number]) {
  return {
    nome: c.nome,
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
    pedidos_antigos: c.pedidos,
    total_antigo: c.total,
    ultimo_pedido_antigo: c.ultimoPedido || null,
    teste: true,
  }
}

export type ResultadoDaSemente = { gravados: number; recusados: number; recados: string[] }

export async function semearClientes(): Promise<ResultadoDaSemente> {
  const fila = CLIENTES_DE_EXEMPLO.map(paraOBanco)
  let gravados = 0
  let recusados = 0
  const recados: string[] = []

  for (let i = 0; i < fila.length; i += LOTE) {
    const lote = fila.slice(i, i + LOTE)
    try {
      await tabela('cliente', { metodo: 'POST', corpo: lote })
      gravados += lote.length
    } catch (e) {
      recusados += lote.length
      const recado = e instanceof Error ? e.message : 'lote recusado'
      /* O mesmo motivo repetido cem vezes não é cem informações. Nome repetido
         é o motivo esperado quando alguém semeia duas vezes. */
      if (!recados.includes(recado)) recados.push(recado)
    }
  }

  return { gravados, recusados, recados }
}

export async function apagarDadosDeTeste(): Promise<string> {
  return chamar<string>('apagar_dados_de_teste')
}
