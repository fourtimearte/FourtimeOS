import { Pagina, Vazio } from '@ds'

/* ==========================================================================
   PCP, planejamento e controle de produção.

   A primeira página de Produção, e o portão que o pedido atravessa antes de
   existir no chão de fábrica.

   O CAMINHO DECIDIDO EM 21/09/2026:

     funil -> cotação -> pedido -> separação -> PCP -> kanban

   A separação vem ANTES do PCP de propósito. Ela é quem descobre a verdade
   sobre o estoque, e o PCP é quem decide o que fazer com o que faltou: assim
   o operador de PCP abre a tela com os avisos prontos na frente, em vez de
   ter que sair procurando o que existe na fábrica.

   E é o botão "Liberar para produção" desta tela que cria, de uma vez só, a
   entrada no kanban, a linha no painel de atividades e o registro no
   relatório mensal. Um pedido não aparece na fábrica porque alguém aprovou a
   venda: aparece porque o PCP disse que ele pode começar.
   ========================================================================== */
export function TelaPcp() {
  return (
    <Pagina
      acima="Produção"
      titulo="PCP"
      sub="A fila dos pedidos aprovados por data de entrega, conferidos antes de entrar na fábrica."
    >
      <Vazio
        titulo="Ainda sem conteúdo"
        texto="A timeline por data de entrega, a conferência da cotação e os avisos de falta entram no passo 9 do plano, depois do estoque e da separação."
      />
    </Pagina>
  )
}
