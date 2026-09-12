import { Pagina, Vazio } from '@ds'

/* ==========================================================================
   A tela que ainda nao existe.

   Ela existe para o menu do v5 estar inteiro desde agora: quem abre o sistema
   ve os mesmos doze destinos do mockup, e nenhum deles leva a lugar nenhum.
   Cada uma some quando o modulo dela nasce.
   ========================================================================== */
export function TelaEmBreve({
  acima,
  titulo,
  sub,
  fase,
  texto,
}: {
  acima: string
  titulo: string
  sub: string
  fase: string
  texto: string
}) {
  return (
    <Pagina acima={acima} titulo={titulo} sub={sub}>
      <Vazio titulo={'Entra na ' + fase} texto={texto} />
    </Pagina>
  )
}
