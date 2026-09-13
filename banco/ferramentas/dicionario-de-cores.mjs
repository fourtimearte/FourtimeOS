/* Um dicionário de cores em português do Brasil.

   Existe porque o nome de cor é escolha de gente, não conta de matemática.
   A primeira tentativa de nomear as 387 cores de impressão usava só família
   de matiz mais tom, e produzia "Ciano 5" e "Roxo 8": um rótulo que não diz
   nada a mais que o número já dizia.

   Aqui cada nome vem com a cor que ele representa. O programa então procura,
   para cada cor da fábrica, o nome mais próximo dentro deste dicionário. O
   nome é de gente; a escolha de qual usar é da máquina.

   As 122 cores de tecido da Fourtime entram junto, e ganham do dicionário
   quando empatam: palavra que a casa já usa vale mais que palavra de fora.
*/

export const DICIONARIO = [
  // neutros
  ['Branco', '#FFFFFF'], ['Branco Gelo', '#F7F9FA'], ['Off White', '#F2EFE9'],
  ['Marfim', '#EFE7D2'], ['Cinza Pérola', '#E5E7EA'], ['Cinza Claro', '#D3D5D8'],
  ['Cinza Prata', '#BFC1CB'], ['Cinza', '#9698A4'], ['Cinza Médio', '#8A8F95'],
  ['Cinza Aço', '#767985'], ['Cinza Chumbo', '#4A4E52'], ['Grafite', '#3A3F47'],
  ['Carvão', '#2E2E33'], ['Preto Ônix', '#1B1B1F'], ['Preto', '#000000'],

  // vermelhos
  ['Vermelho', '#D0021B'], ['Vermelho Fourtime', '#C6161B'], ['Vermelho Tomate', '#E23B2E'],
  ['Vermelho Neon', '#FF1E1E'], ['Coral', '#FF6F5E'], ['Salmão', '#FA8072'],
  ['Goiaba', '#EE6352'], ['Telha', '#C1502E'], ['Escarlate', '#B3161C'],
  ['Carmim', '#A91328'], ['Cereja', '#A81232'], ['Framboesa', '#BC2A4B'],
  ['Rubi', '#9B1D2B'], ['Grená', '#802741'], ['Vinho', '#6B1F2B'],
  ['Bordô', '#5C1A2B'], ['Marsala', '#7B3540'], ['Sangue de Boi', '#691713'],

  // rosas e pinks
  ['Rosa Bebê', '#F7C6D9'], ['Rosa Quartzo', '#F1D2D0'], ['Rosa Antigo', '#E8A0A0'],
  ['Rosé', '#E9C1D7'], ['Rosa', '#F48FB1'], ['Rosa Chiclete', '#FF6FB5'],
  ['Rosa Neon', '#FF2D95'], ['Rosa Pink', '#E91E8C'], ['Pink', '#D12968'],
  ['Fúcsia', '#D4157E'], ['Magenta', '#C2007B'], ['Orquídea Rosa', '#C367A6'],
  ['Amora', '#91316C'], ['Uva Rosada', '#82346D'],

  // laranjas
  ['Pêssego', '#FFCBA4'], ['Damasco', '#F0A868'], ['Laranja Claro', '#FFA24D'],
  ['Laranja', '#F57C00'], ['Laranja Neon', '#FF6D00'], ['Tangerina', '#F2670A'],
  ['Cenoura', '#ED7014'], ['Abóbora', '#D97D1E'], ['Terracota', '#B4543A'],
  ['Ferrugem', '#8E4B2E'], ['Páprica', '#C54426'], ['Cobre Queimado', '#9E5127'],

  // amarelos e âmbares
  ['Amarelo Bebê', '#FBEFA0'], ['Baunilha', '#FFF8B9'], ['Amarelo Limão', '#F4F062'],
  ['Amarelo Canário', '#FFE000'], ['Amarelo Neon', '#EFFF00'], ['Girassol', '#F2C200'],
  ['Milho', '#F5CE3E'], ['Amarelo Ouro', '#E7B400'], ['Âmbar', '#D99A00'],
  ['Mostarda', '#C99700'], ['Dourado', '#C9A227'], ['Ocre', '#B5975A'],
  ['Mel', '#DB9B2C'], ['Caramelo', '#9A5B22'],

  // verdes
  ['Verde Menta', '#B7E4C7'], ['Verde Água', '#8FD3C4'], ['Verde Limão', '#9BD200'],
  ['Verde Neon', '#39FF14'], ['Verde Abacate', '#A0C32D'], ['Verde Maçã', '#6DCC54'],
  ['Verde Bandeira', '#00963F'], ['Verde Esmeralda', '#068A5B'], ['Verde Jade', '#33C477'],
  ['Verde Pinho', '#478740'], ['Verde Oliva', '#7C864A'], ['Verde Militar', '#5A6650'],
  ['Verde Musgo', '#4A5D23'], ['Verde Floresta', '#1E4D2B'], ['Verde Sálvia', '#B2D6B3'],
  ['Verde Chá', '#D5E09C'],

  // turquesas e cianos
  ['Verde Piscina', '#7AD8C4'], ['Turquesa', '#00B2A9'], ['Água Marinha', '#A8D5E1'],
  ['Ciano', '#00BFFF'], ['Ciano Claro', '#7EC9D3'], ['Azul Piscina', '#29A8C9'],
  ['Azul Petróleo', '#12556B'], ['Petróleo Escuro', '#005A67'], ['Azul Gelo', '#D1E9EE'],

  // azuis
  ['Azul Bebê', '#BBDDFB'], ['Azul Serenity', '#A6D7F6'], ['Azul Celeste', '#7EC8E3'],
  ['Azul Céu', '#4BB8EF'], ['Azul Claro', '#00ACEC'], ['Azul Médio', '#0090C5'],
  ['Azul Cobalto', '#1A4FBF'], ['Azul Royal', '#12489E'], ['Azul Jeans', '#4A6D8C'],
  ['Azul Denim', '#2B648F'], ['Azul Naval', '#2B3E71'], ['Azul Marinho', '#12213F'],
  ['Azul Meia-Noite', '#101534'],

  // roxos e violetas
  ['Lavanda', '#C9B6E4'], ['Lilás', '#B491C8'], ['Violeta', '#7A4FBF'],
  ['Orquídea', '#A45EE5'], ['Ametista', '#8A5FBF'], ['Roxo Neon', '#B026FF'],
  ['Roxo', '#5E2A84'], ['Púrpura', '#6A0D5B'], ['Uva', '#4B2354'],
  ['Berinjela', '#3F2140'], ['Índigo', '#484185'], ['Anil', '#52509E'],

  // marrons, beges e terras
  ['Linho', '#E6DCC8'], ['Areia', '#EAE0CE'], ['Palha', '#E8DFC0'],
  ['Trigo', '#E0CBA4'], ['Amêndoa', '#DCC3A5'], ['Nude', '#E3C4A8'],
  ['Nude Rosado', '#E7C9BC'], ['Bege', '#D9C7A7'], ['Camurça', '#BFA37C'],
  ['Café com Leite', '#C8A784'], ['Argila', '#C08F72'], ['Canela', '#A9703F'],
  ['Castanho', '#5A3A22'], ['Tabaco', '#7A5230'], ['Chocolate', '#5C3317'],
  ['Café', '#4B3621'], ['Cacau', '#3E2A1E'], ['Marrom', '#6B4423'],
  ['Caqui', '#B5A16B'], ['Taupe', '#B6A594'],

  // metálicos e especiais
  ['Prata', '#C0C4C8'], ['Perolado', '#E8E6E1'], ['Champanhe', '#E4D9C3'],
  ['Champanhe Metálico', '#CBB78F'], ['Dourado Metálico', '#C6A140'],
  ['Cobre', '#B06C3B'], ['Bronze', '#A9773F'], ['Chumbo Metálico', '#7E858B'],
  ['Grafite Metálico', '#6E7276'], ['Holográfico', '#C9D6E8'], ['Refletivo', '#B8C0C6'],
  // reforço nas faixas onde a paleta da fábrica é densa: rampas de nove tons
  // de azul, âmbar e roxo que sem nome próprio virariam "Ciano 5"
  ['Azul Elétrico', '#00ACEC'], ['Azul Lagoa', '#009DD7'], ['Azul Cerúleo', '#0091CA'],
  ['Azul Oceano', '#0083B2'], ['Azul Marítimo', '#0076A0'], ['Azul Abissal', '#005B7D'],
  ['Azul Profundo', '#004D6B'], ['Azul Aço', '#7197CF'], ['Azul Névoa', '#CAD4EC'],
  ['Turquesa Profundo', '#00AAC2'], ['Verde Lagoa', '#2BA478'], ['Verde Tiffany', '#81D9D7'],
  ['Açafrão', '#F49713'], ['Ouro Claro', '#D7AA1F'], ['Ouro Velho', '#CB9E0F'],
  ['Latão', '#BD912A'], ['Bronze Claro', '#AC8F55'], ['Areia Dourada', '#E2C27B'],
  ['Roxo Profundo', '#4C2477'], ['Malva', '#9865A3'], ['Ameixa', '#8B4E97'],
  ['Lilás Escuro', '#674575'], ['Magenta Neon', '#C500B2'], ['Vinho Rosado', '#AB518F'],
  ['Ameixa Rosada', '#994887'], ['Beterraba', '#A23B7E'], ['Ameixa Escura', '#72294D'],
  ['Vermelho Coral', '#E9502A'], ['Rubi Claro', '#CD1C39'], ['Terra Rosada', '#683842'],
  ['Musgo Claro', '#8DB82D'], ['Verde Bosque', '#385928'], ['Verde Grama', '#82A440'],
  ['Cinza Esverdeado', '#9F9F98'], ['Cinza Rosado', '#C9B1B2'], ['Cinza Azulado', '#A5B6C9'],
]
