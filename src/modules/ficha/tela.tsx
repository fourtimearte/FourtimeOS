import { Pagina, Vazio } from '@ds'

/* Tela vazia do passo 8: a casca do sistema ja navega inteira, e cada modulo
   ja tem o seu lugar. O conteudo entra no passo do proprio modulo. */
export function TelaFicha() {
  return (
    <Pagina acima="Fourtime OS" titulo="Ficha de produção" sub="O que a fábrica lê: referência, tecido, grade, layout e técnicas.">
      <Vazio titulo="Ainda sem conteúdo" texto="O editor entra no passo 15. Ele é o .ft, e nasce de uma cotação aprovada." />
    </Pagina>
  )
}
