import { carregarListasDoCabecalho } from '@dominio/banco'
import { enderecoEmLinha, type Cliente } from '@dominio/cliente'
import { carregarTabelasDePreco, type TabelaDePreco } from '@dominio/preco'
import { informesParaCotacaoNova } from './informes-da-casa'
import { cotacaoEmBranco, mascaraDeDocumento, type Cotacao } from './tipos'

/* ==========================================================================
   A COTAÇÃO NOVA DA CASA: em branco, com o que a casa decidiu em
   Configurações.

     1. os informes e termos da casa (060), copiados;
     2. o vendedor é quem cria (nome e id), a não ser que quem chama já saiba
        de quem é (o lead que vira cotação traz o dono dele);
     3. o pagamento e a entrega de partida só ficam se ainda estiverem
        ativos nas listas do cabeçalho: valor que saiu da lista não nasce
        numa cotação nova;
     4. a tabela de preço é a PADRÃO das tabelas de preço (068), nome e id.
        Sem a 068 no banco (ou sem tabela criada), fica o nome de antes;
        com tabelas e nenhuma
        padrão, nasce sem tabela, para ninguém cotar numa tabela que não
        existe.

   A lista do Orçamento e o funil nascem a cotação por aqui, e só por aqui.
   ========================================================================== */
export async function cotacaoNovaDaCasa(numero: string, vendedor: { id: string; nome: string } | null): Promise<Cotacao> {
  const c = cotacaoEmBranco(numero)
  const [informes, listas, tabelas] = await Promise.all([
    informesParaCotacaoNova(),
    carregarListasDoCabecalho(),
    carregarTabelasDePreco().catch(() => ({ tabelas: [] as TabelaDePreco[], semBanco: true })),
  ])
  c.informes = informes
  if (!tabelas.semBanco && tabelas.tabelas.length) {
    const padrao = tabelas.tabelas.find((t) => t.padrao && t.situacao === 'ativa')
    c.informe.tabelaDePreco = padrao?.nome ?? ''
    c.informe.tabelaDePrecoId = padrao?.id ?? ''
  }
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

/* O CADASTRO MANDA NOS CAMPOS, MAS NAO PRENDE. Escolher um cliente de Clientes
   (ou criar a cotacao de um lead que ja tem cadastro) preenche o cabecalho e
   guarda o id, que e o que liga a cotacao a carteira; quem quiser outro nome
   na proposta corrige depois, que o cadastro nao muda. Um lugar so para as
   duas portas: o cabecalho do editor e o "Criar cotacao" do funil. */
export function clienteDaCotacao(x: Cliente): Partial<Cotacao['cliente']> {
  return {
    id: x.id,
    nome: x.nome,
    documento: mascaraDeDocumento(x.documento),
    contato: x.contato,
    telefone: x.celular || x.telefone,
    email: x.email,
    cidade: x.cidade,
    uf: x.uf,
    /* o principal da ficha; a cotação troca por outro cadastro (082) */
    endereco: enderecoEmLinha(x),
    documentoDe: x.documento ? 'principal' : '',
    contatoDe: x.contato || x.celular || x.telefone || x.email ? 'principal' : '',
    enderecoDe: x.endereco || x.cidade || x.cep ? 'principal' : '',
  }
}
