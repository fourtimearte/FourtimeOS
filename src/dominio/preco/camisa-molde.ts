/* ==========================================================================
   O DESENHO DA CAMISA DO DTF, TIRADO DO MOLDE DE VERDADE (22/10/2026, pedido
   dele: "pegue no Affinity o molde M da camiseta tradicional, está em vetor,
   use como a base da camiseta").

   De onde veio: arquivo "FT-010 GOLA O e GOLA V (PLT)", grupo FT-010-000M.M
   (camiseta tradicional, tamanho M), as curvas FRENTE, COSTAS e MANGA_01,
   lidas em cm. Montagem:
     o corpo é a peça do molde como está (frente 56 x 73,2 cm; costas
     56 x 76,5 cm);
     a manga é a metade da MANGA_01, com o topo da cabeça no ombro e a ponta
     da cabeça na axila, virada para fora; a costura com o corpo segue a
     cava da própria peça, então manga e corpo dividem a mesma linha;
     a gola é a linha do decote recuada 1,8 cm (a ribana).
   ESCALA: 1 unidade do desenho = 1 cm (ESCALA_DA_CAMISA = 1). O desenho tem
   100 x 100: o centro da camisa fica em x = 50 e o ponto do ombro junto do
   pescoço em y = 12, na frente e nas costas.

   Para refazer com outro molde: ler as curvas no Affinity em cm, montar e
   simplificar (Douglas-Peucker com 0,1 cm) e trocar os caminhos abaixo.
   ========================================================================== */

export type DesenhoDoLado = { corpo: string; mangaE: string; mangaD: string; gola: string }

export const DESENHO_DA_CAMISA: Record<'frente' | 'costas', DesenhoDoLado> = {
  frente: {
    corpo: 'M22 85.2 L78 85.2 L77.6 36.3 L75.3 34.9 L73.4 33 L72.4 31.6 L71.5 29.4 L71.1 27 L70.9 23 L71.3 19.1 L72 16.4 L59.1 12 L57.2 17.5 L56.5 18.7 L55.6 19.8 L54.5 20.7 L53.2 21.4 L51.7 21.9 L50 22.1 L48.3 21.9 L46.8 21.4 L45.5 20.7 L44.4 19.8 L43.5 18.7 L42.8 17.5 L40.9 12 L28 16.4 L28.7 19.1 L29.1 23 L28.9 27 L28.5 29.4 L27.6 31.6 L26.6 33 L24.7 34.9 L22.4 36.3 Z',
    mangaE: 'M28 16.4 L5 22.4 L9.7 40.4 L11.5 38.8 L21.2 40.8 L22.4 36.3 L24.7 34.9 L26.6 33 L27.6 31.6 L28.5 29.4 L28.9 27 L29.1 23 L28.7 19.1 Z',
    mangaD: 'M72 16.4 L95 22.4 L90.3 40.4 L88.5 38.8 L78.8 40.8 L77.6 36.3 L75.3 34.9 L73.4 33 L72.4 31.6 L71.5 29.4 L71.1 27 L70.9 23 L71.3 19.1 Z',
    gola: 'M39.1 12.5 L40.3 15.9 L41.2 18.3 L42 19.7 L43.1 21 L44.5 22.2 L46.1 23.1 L47.9 23.6 L50 23.9 L52.1 23.6 L53.9 23.1 L55.5 22.2 L56.9 21 L58 19.7 L58.8 18.3 L59.7 15.9 L60.9 12.5',
  },
  costas: {
    corpo: 'M22.5 39.5 L22 88.5 L78 88.5 L77.5 39.5 L74.8 37.3 L73.4 35.4 L72.5 33.7 L72.2 32.6 L71.7 29 L71.9 25.4 L72.2 22.7 L72.7 20 L73.7 16.1 L60.6 12 L57.4 13.4 L55.2 14.2 L50 14.9 L44.8 14.2 L42.6 13.4 L39.4 12 L26.4 16.1 L27.6 21.4 L28.1 25.4 L28.3 29 L28 31.4 L27.5 33.7 L26.2 36.1 L24.6 37.9 Z',
    mangaE: 'M26.4 16.1 L4.1 24.5 L10.7 42 L12.4 40.2 L22.2 41.1 L22.5 39.5 L25.1 37.3 L26.6 35.4 L27.5 33.7 L27.8 32.6 L28.2 30.2 L28.3 27.8 L27.8 22.7 Z',
    mangaD: 'M73.6 16.1 L95.9 24.5 L89.3 42 L87.6 40.2 L77.8 41.1 L77.5 39.5 L74.8 37.3 L73.4 35.4 L72.5 33.7 L72.2 32.6 L71.8 30.2 L71.7 27.8 L72.2 22.7 Z',
    gola: 'M42 15.1 L44.4 15.9 L48 16.5 L50 16.7 L52 16.5 L55.6 15.9 L58 15.1',
  },
}
