import { Pagina, Vazio } from '@ds'

/* Tela vazia do passo 8: a casca do sistema ja navega inteira, e cada modulo
   ja tem o seu lugar. O conteudo entra no passo do proprio modulo. */
export function TelaEstoque() {
  return (
    <Pagina acima="Fourtime OS" titulo="Estoque" sub="Malha, insumo e o que a ficha consome.">
      <Vazio titulo="Ainda sem conteúdo" texto="A tabela, o mínimo e a separação entram no passo 19." />
    </Pagina>
  )
}
