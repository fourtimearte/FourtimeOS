import { Pagina, Vazio } from '@ds'

/* Tela vazia do passo 8: a casca do sistema ja navega inteira, e cada modulo
   ja tem o seu lugar. O conteudo entra no passo do proprio modulo. */
export function TelaCotacao() {
  return (
    <Pagina acima="Fourtime OS" titulo="Cotação de venda" sub="O editor da proposta que vai para o cliente em PDF.">
      <Vazio titulo="Ainda sem conteúdo" texto="O editor entra no passo 12. Ele é um documento próprio, o .cft, ligado depois à ficha." />
    </Pagina>
  )
}
