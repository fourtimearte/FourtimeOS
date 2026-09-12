import { Pagina, Vazio } from '@ds'

/* Tela vazia do passo 8: a casca do sistema ja navega inteira, e cada modulo
   ja tem o seu lugar. O conteudo entra no passo do proprio modulo. */
export function TelaFunil() {
  return (
    <Pagina acima="Fourtime OS" titulo="Funil de vendas" sub="As oportunidades por etapa, do primeiro contato até a cotação aprovada.">
      <Vazio titulo="Ainda sem conteúdo" texto="As colunas e o arrastar entram no passo 10." />
    </Pagina>
  )
}
