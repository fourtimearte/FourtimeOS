import { Pagina, Vazio } from '@ds'

/* Tela vazia do passo 8: a casca do sistema ja navega inteira, e cada modulo
   ja tem o seu lugar. O conteudo entra no passo do proprio modulo. */
export function TelaPainel() {
  return (
    <Pagina acima="Fourtime OS" titulo="Início" sub="O resumo do dia: o que entrou, o que está atrasado e o que sai hoje.">
      <Vazio titulo="Ainda sem conteúdo" texto="Os números e os gráficos entram na fase 3, quando houver dado real para mostrar." />
    </Pagina>
  )
}
