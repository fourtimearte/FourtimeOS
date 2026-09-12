import { Pagina, Vazio } from '@ds'

/* Tela vazia do passo 8: a casca do sistema ja navega inteira, e cada modulo
   ja tem o seu lugar. O conteudo entra no passo do proprio modulo. */
export function TelaClientes() {
  return (
    <Pagina acima="Fourtime OS" titulo="Clientes" sub="A base que vem do Bling na importação única, e depois vive aqui.">
      <Vazio titulo="Ainda sem conteúdo" texto="A tabela, a ficha do cliente e a busca entram no passo 9." />
    </Pagina>
  )
}
