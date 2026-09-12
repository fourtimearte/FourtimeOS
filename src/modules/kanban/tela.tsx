import { Pagina, Vazio } from '@ds'

/* Tela vazia do passo 8: a casca do sistema ja navega inteira, e cada modulo
   ja tem o seu lugar. O conteudo entra no passo do proprio modulo. */
export function TelaKanban() {
  return (
    <Pagina acima="Fourtime OS" titulo="Produção MARK42" sub="O pipeline por setor, com a tag de design decidindo a rota.">
      <Vazio titulo="Ainda sem conteúdo" texto="As colunas, os cartões e o arrastar entram no passo 17." />
    </Pagina>
  )
}
