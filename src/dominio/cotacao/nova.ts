import { carregarListasDoCabecalho } from '@dominio/banco'
import { informesParaCotacaoNova } from './informes-da-casa'
import { cotacaoEmBranco, type Cotacao } from './tipos'

/* ==========================================================================
   A COTAÇÃO NOVA DA CASA: em branco, com o que a casa decidiu em
   Configurações.

     1. os informes e termos da casa (060), copiados;
     2. o vendedor é quem cria (nome e id), a não ser que quem chama já saiba
        de quem é (o lead que vira cotação traz o dono dele);
     3. o pagamento e a entrega de partida só ficam se ainda estiverem
        ativos nas listas do cabeçalho: valor que saiu da lista não nasce
        numa cotação nova.

   A lista do Orçamento e o funil nascem a cotação por aqui, e só por aqui.
   ========================================================================== */
export async function cotacaoNovaDaCasa(numero: string, vendedor: { id: string; nome: string } | null): Promise<Cotacao> {
  const c = cotacaoEmBranco(numero)
  const [informes, listas] = await Promise.all([informesParaCotacaoNova(), carregarListasDoCabecalho()])
  c.informes = informes
  if (vendedor) {
    c.vendedor = vendedor.nome
    c.vendedorId = vendedor.id
  }
  if (listas.de === 'banco') {
    if (!listas.pagamento.includes(c.informe.pagamento)) c.informe.pagamento = ''
    if (!listas.entrega.includes(c.informe.entrega)) c.informe.entrega = ''
  }
  return c
}
