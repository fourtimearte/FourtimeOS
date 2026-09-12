/* ==========================================================================
   Os dados da fabrica, num lugar so.

   Eles aparecem no rodape de toda folha impressa e no cabecalho do PDF que
   vai para o cliente. Estao aqui, e nao espalhados pelo documento, para
   mudarem em um lugar quando mudarem.

   ATENCAO, HENRIQUE: os valores abaixo sao um molde. Troque pelos de verdade
   (endereco completo e CNPJ) antes de mandar a primeira cotacao para um
   cliente. Nao inventei nada que precise ser conferido depois em silencio.
   ========================================================================== */

export const EMPRESA = {
  nome: 'Fourtime',
  descricao: 'Uniformes e camisetas personalizadas',
  endereco: 'a conferir',
  cidade: 'Goiânia',
  uf: 'GO',
  cnpj: 'a conferir',
  telefone: 'a conferir',
  site: 'fourtimefit.com.br',
}

/** true enquanto algum campo ainda for o molde: a tela avisa em vez de imprimir errado */
export const EMPRESA_A_CONFERIR = Object.values(EMPRESA).some((v) => v === 'a conferir')
