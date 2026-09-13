/* ==========================================================================
   As cinco listas do cabeçalho do orçamento, como ponto de partida.

   ATENÇÃO, E É IMPORTANTE: estas listas NÃO foram inventadas. São o DB do
   editor de orçamentos da fábrica, versão 3.375, copiadas como estão. Foi por
   isso que elas vieram do editor e não do mockup: no mockup eram de enfeite
   (pagamento "50% entrada + 50% entrega", vendedor "Carla") e as de verdade
   são outras (ENTRADA + SAIDA, Lucas, Dani).

   A fonte viva delas hoje é a tabela lista_do_cabecalho no Supabase, que a
   tela do banco lê e edita. O que sobrou aqui é o valor de partida das telas
   que ainda não foram ligadas no banco: funil, relatório e o editor de
   cotação. Quando elas forem, este arquivo morre.
   ========================================================================== */

export const PAGAMENTOS: string[] = ["ENTRADA + SAIDA","LINK","ENTRADA + BOLETO","PIX TOTAL","DINHEIRO","BOLETO","ENTREGA","CARTAO DE CREDITO","PATROCINIO"]

export const ENTREGAS: string[] = ["AEREO","CORREIOS","FABRICA","MOTOBOY","TRANSPORTADORA"]

export const EMBALAGENS: string[] = ["Fardo","Sacola","Caixa","SACO CORREIOS"]

export const VENDEDORES: string[] = ["Lucas","Dani","Kev","Alam","Fabricio"]

export const DEPARTAMENTOS: string[] = ["Sublimação","DTF","Silk","DTF + Sublimação","DTF + Silk","BORDADO","SILK + SUBLIMAÇÃO"]
