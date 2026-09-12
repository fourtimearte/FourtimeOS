/* ==========================================================================
   O vocabulário de exemplo do kit.

   São as listas reais do editor v3.375, copiadas para cá para os menus
   aparecerem no /kit com o mesmo conteúdo que a fábrica usa todo dia. Elas
   moram aqui, e não em dominio/, por causa da regra de dependência: ds/ não
   pode conhecer o domínio. Quando o Supabase entrar, o banco de verdade nasce
   em dominio/layout/ e as telas passam a ler de lá; estes dados continuam
   servindo só ao kit.
   ========================================================================== */

/* REFERÊNCIA: o código decide o grupo e decide a tarja de gênero */
export const REFS: string[] = ["FT-010-000M — CAMISETA MASC TRAD","FT-010-001M — CAMISETA MASC TRAD GOLA V","FT-010-002M — CAMISETA MASC TRAD ML",
"FT-010-003M — CAMISETA MASC TRAD ML GOLA V","FT-010-004F — BABY LOOK","FT-010-006F — BABY LOOK ML","FT-010-005F — BABY LOOK GOLA V",
"FT-010-007F — BABY LOOK ML GOLA V","FT-010-008C — CAMISETA INFANTIL UNISSEX","FT-010-009C — CAMISETA INFANTIL UNISSEX ML",
"FT-010-010M — CAMISETA OVERSIZE MASC","FT-010-011M — CAMISETA POLO MASC SEM PUNHO","FT-010-012M — CAMISETA POLO MASC COM PUNHO",
"FT-010-013F — CAMISETA POLO FEM SEM PUNHO","FT-010-014F — CAMISETA POLO FEM COM PUNHO","FT-010-015M — CAMISETA COM CAPUZ MASC ML",
"FT-010-016F — BABY LOOK COM CAPUZ ML",
"FT-020-000M — RAGLAN MASC SEM PUNHO","FT-020-001M — RAGLAN MASC COM PUNHO","FT-020-002M — RAGLAN MASC SEM PUNHO GOLA V",
"FT-020-003M — RAGLAN MASC COM PUNHO GOLA V","FT-020-004M — RAGLAN MASC SEM PUNHO GOLA PADRE","FT-020-005M — RAGLAN MASC COM PUNHO GOLA PADRE",
"FT-020-006M — RAGLAN MASC ML","FT-020-007F — RAGLAN FEM SEM PUNHO","FT-020-008C — RAGLAN INFANTIL UNISSEX",
"FT-030-000M — REGATA MASC NADADOR","FT-030-001M — REGATA MASC CAVADA","FT-030-002F — REGATA FEM ALCINHA",
"FT-050-001F — CROPPED MC","FT-050-002F — CROPPED ML","FT-060-002F — TOP NADADOR","FT-060-003F — TOP ALCINHA",
"FT-070-001F — LEGGING CÓS ALTO","FT-070-002M — CALÇA MOLETOM MASC",
"FT-080-002M — BERMUDA MOLETOM","FT-080-003F — BERMUDA FEM",
"FT-090-001M — CALÇÃO MASC BASQUETE",
"FT-100-000M — SHORTS MASC COM BOLSO","FT-100-001M — SHORTS MASC SEM BOLSO","FT-100-002F — SHORTS FEM CINTURA ALTA","FT-100-004C — SHORTS ED. FÍSICA",
"FT-040-001M — MOLETOM CANGURU","FT-040-002M — MOLETOM CARECA","FT-040-003F — MOLETOM FEM CROPPED","FT-040-004C — MOLETOM INFANTIL",
"FT-110-001M — JALECO MANGA LONGA","FT-110-002F — JALECO FEM",
"FT-120-003M — AVENTAL","FT-120-004M — BONÉ ABA CURVA",
"FT-130-001M — CAMISA SOCIAL MC","FT-130-002F — CAMISA SOCIAL FEM"];

export const CATS_REF: Record<string, string> = {'010':'Camisetas','020':'Raglan','030':'Regatas','040':'Moletom','050':'Cropped','060':'Tops',
 '070':'Calças','080':'Bermudas','090':'Calções','100':'Shorts','110':'Jalecos','120':'Outros','130':'Social'};
export const CATS_ORDEM = ['010','020','030','040','050','060','070','080','090','100','110','120','130'];
export const refCategoria = (c: string) => String(c).slice(3, 6)
export type Genero = 'masculino' | 'feminino' | 'infantil' | ''
const GEN: Record<string, Genero> = { M: 'masculino', F: 'feminino', C: 'infantil' }
export const refGenero = (c: string): Genero => GEN[String(c).trim().slice(-1)] || ''


/* TECIDO: por tipo, família comercial, nunca construção */
export const TIPOS_TECIDO: { cod: string; nome: string; itens: string[] }[] = [
 {cod:'ALG',nome:'ALGODÃO',itens:["ALGODAO 100%","ALGODAO COM ELASTANO","ALGODAO FLAME","ALGODAO MESCLA COM ELASTANO","ALGODAO MESCLA SEM ELASTANO","ALGODAO STRONG","CONFORT MIX MESCLA","NATURALINHO","TERBRIM 65% POLIESTER 35% ALGODAO"]},
 {cod:'POL',nome:'POLIAMIDA',itens:["POLIAMIDA 96% ELASTANO 4%","POLIAMIDA FLOW","POLIAMIDA FRESH","POLIAMIDA FURADINHA COM ELASTANO","SUPLEX POLIAMIDA","VIS UP LIGTH"]},
 {cod:'DRY',nome:'DRY FIT',itens:["DRYFIT COM ELASTANO PROTEÇÃO UV50","DRYFIT FURADINHO COM ELASTANO","DRYFIT FURADINHO SEM ELASTANO","DRYFIT POLIESTER 100%","PV ANTIPILING","CREPE DE POLIESTER 100%"]},
 {cod:'PIQ',nome:'PIQUE',itens:["PIQUET 100%","PIQUET COM ELASTANO","PIQUET MISTO"]},
 {cod:'MOL',nome:'MOLETOM',itens:["MOLETINHO COM ELASTANO","MOLETOM","MOLETOM FLANELADO","MOLETOM PELUCIADO"]},
 {cod:'SPX',nome:'SUPLEX',itens:["SUPLEX 84% POLIESTER 16% ELASTANO","SUPLEX ALTA COMPRESSÃO"]},
 {cod:'VIS',nome:'VISCOSE',itens:["VISCOLYCRA","VISCOSE 100%"]},
 {cod:'PP',nome:'POLIESTER',itens:["POLIESTER 100% LISO"]},
 {cod:'TPA',nome:'TECIDO PLANO',itens:["BRIM LEVE","BRIM PESADO","NEOPRENE","OXFORD","TACTEL COM ELASTANO"]},
 {cod:'ESP',nome:'MATERIAIS',itens:["RIBANA"]},
 {cod:'',nome:'Sem tipo',itens:["PROFIT","SG PARIS"]}];
TIPOS_TECIDO.forEach((t) => t.itens.sort((a, b) => a.localeCompare(b, 'pt')))
export const TIPO_DO_TECIDO: Record<string, string> = {}
TIPOS_TECIDO.forEach((t) => t.itens.forEach((n) => (TIPO_DO_TECIDO[n] = t.cod)))
export const TECIDOS = TIPOS_TECIDO.flatMap((t) => t.itens)

/* COR DE TECIDO: doze grupos */
export const GRUPOS_DE_COR: { cod: string; nome: string; cores: [string, string][] }[] = [
{cod:'BR',nome:"Branco e Cru",cores:[["Branco","#FFFFFF"],["Branco Gelo","#F7F9FA"],["Off White","#F2EFE9"],["Creme","#F3E9D2"],["Marfim","#EFE7D2"],["Pérola","#EDE9E3"],["Areia Clara","#EAE0CE"],["Palha","#E8DFC0"],["Champagne","#E4D9C3"],["Cru","#DED3BC"]]},
{cod:'PC',nome:"Preto e Cinza",cores:[["Preto","#111111"],["Preto Ônix","#1B1B1F"],["Grafite","#3A3F47"],["Cinza Chumbo","#4A4E52"],["Cinza Escuro","#5F646A"],["Cinza Mescla Escuro","#6E7378"],["Cinza Médio","#8A8F95"],["Cinza Mescla","#A8A9AD"],["Cinza Claro","#D3D5D8"],["Cinza Pérola","#E5E7EA"]]},
{cod:'VM',nome:"Vermelho",cores:[["Vermelho","#D0021B"],["Vermelho Fourtime","#C6161B"],["Vermelho Tomate","#E23B2E"],["Vermelho Escarlate","#B3161C"],["Vermelho Neon","#FF1E1E"],["Vermelho Escuro","#8E1218"],["Cereja","#A81232"],["Marsala","#7B3540"],["Vinho","#6B1F2B"],["Bordô","#5C1A2B"]]},
{cod:'RS',nome:"Rosa",cores:[["Rosa Bebê","#F7C6D9"],["Rosé","#E8A0A0"],["Rosa","#F48FB1"],["Salmão","#FA8072"],["Coral","#FF6F5E"],["Rosa Chiclete","#FF6FB5"],["Rosa Neon","#FF2D95"],["Rosa Pink","#E91E8C"],["Fúcsia","#D4157E"],["Magenta","#C2007B"]]},
{cod:'LR',nome:"Laranja",cores:[["Pêssego","#FFCBA4"],["Damasco","#F0A868"],["Laranja Claro","#FFA24D"],["Laranja","#F57C00"],["Laranja Neon","#FF6D00"],["Tangerina","#F2670A"],["Cenoura","#ED7014"],["Abóbora","#D97D1E"],["Terracota","#B4543A"],["Ferrugem","#8E4B2E"]]},
{cod:'AM',nome:"Amarelo",cores:[["Amarelo Bebê","#FBEFA0"],["Amarelo Limão","#F4F062"],["Amarelo Neon","#EFFF00"],["Amarelo Canário","#FFE000"],["Milho","#F5CE3E"],["Girassol","#F2C200"],["Amarelo Ouro","#E7B400"],["Âmbar","#D99A00"],["Dourado","#C9A227"],["Mostarda","#C99700"]]},
{cod:'VD',nome:"Verde",cores:[["Verde Menta","#B7E4C7"],["Verde Água","#8FD3C4"],["Verde Neon","#39FF14"],["Verde Limão","#9BD200"],["Verde Bandeira","#00963F"],["Verde Esmeralda","#068A5B"],["Verde Oliva","#7C864A"],["Verde Militar","#5A6650"],["Verde Musgo","#4A5D23"],["Verde Floresta","#1E4D2B"]]},
{cod:'AZ',nome:"Azul",cores:[["Azul Bebê","#BBDDFB"],["Azul Celeste","#7EC8E3"],["Ciano","#00BFFF"],["Azul Piscina","#29A8C9"],["Azul Turquesa","#00B2A9"],["Azul Cobalto","#1A4FBF"],["Azul Royal","#12489E"],["Azul Jeans","#4A6D8C"],["Azul Petróleo","#12556B"],["Azul Marinho","#12213F"]]},
{cod:'RX',nome:"Roxo e Lilás",cores:[["Lavanda","#C9B6E4"],["Lilás","#B491C8"],["Roxo Neon","#B026FF"],["Orquídea","#A45EE5"],["Ametista","#8A5FBF"],["Violeta","#7A4FBF"],["Púrpura","#6A0D5B"],["Roxo","#5E2A84"],["Uva","#4B2354"],["Berinjela","#3F2140"]]},
{cod:'MR',nome:"Marrom e Terra",cores:[["Areia Escura","#C2A878"],["Caqui","#B5A16B"],["Canela","#A9703F"],["Caramelo","#9A5B22"],["Tabaco","#7A5230"],["Marrom","#6B4423"],["Chocolate","#5C3317"],["Castanho","#5A3A22"],["Café","#4B3621"],["Cacau","#3E2A1E"]]},
{cod:'BG',nome:"Bege e Nude",cores:[["Linho","#E6DCC8"],["Nude Rosado","#E7C9BC"],["Nude","#E3C4A8"],["Trigo","#E0CBA4"],["Amêndoa","#DCC3A5"],["Bege","#D9C7A7"],["Café com Leite","#C8A784"],["Bege Escuro","#C3AE8A"],["Argila","#C08F72"],["Camurça","#BFA37C"]]},
{cod:'MT',nome:"Metálicos e Especiais",cores:[["Perolado","#E8E6E1"],["Champanhe Metálico","#CBB78F"],["Holográfico","#C9D6E8"],["Dourado Metálico","#C6A140"],["Prata","#C0C4C8"],["Refletivo","#B8C0C6"],["Cobre","#B06C3B"],["Bronze","#A9773F"],["Chumbo Metálico","#7E858B"],["Grafite Metálico","#6E7276"]]}];


/* DESIGN: etiqueta, técnica e acabamento, nessa ordem fixa */
export const TAG_ETIQUETA = ["Eti. Fourtime","Eti. DTF","Eti. Silk","Eti. Subli","Eti. Cliente"];
export const TAG_TECNICA = ["DTF","Subli","Silk","Patch","Bordado"];
export const TAG_ACABAMENTO = ["Gola Tecido","Ribana"];
export const TAG_ORDEM = TAG_ETIQUETA.concat(TAG_TECNICA, TAG_ACABAMENTO)

/* CÓDIGO DE COR: 001 a 300 no DTF, S01 a S87 na sublimação.
   O hexadecimal existe só para pintar o quadrado, nunca aparece escrito. */
export const DTF_CORES: [string, string][] = [["001","#FFFFFF"],["002","#202121"],["003","#25251F"],["004","#37363A"],["005","#494B59"],["006","#666877"],
["007","#626672"],["008","#767985"],["009","#858994"],["010","#9698A4"],["011","#BFC1CB"],["012","#000000"],["013","#BB8859"],
["036","#00AAC2"],["054","#00ACEC"],["080","#0073C1"],["089","#52509E"],["115","#CC33FF"],["135","#CA0088"],["152","#CD1C39"],
["170","#FF7A13"],["179","#FFB300"],["197","#FFE000"],["224","#8FF700"],["235","#00C719"],["252","#44C6A6"],["108","#3F2A8C"],
["121","#8E44AD"],["144","#E0218A"],["160","#E8402A"],["188","#F9A826"],["205","#D6E64B"],["241","#00A86B"],["266","#0F7B6C"],
["278","#6B4423"],["290","#9C6B3F"],["296","#C0C4C8"],["300","#7E858B"]];

export const SB_CORES: [string, string][] = [["S01","#1E1E1E"],["S02","#141414"],["S03","#000000"],["S04","#3C3C3C"],["S05","#323232"],["S06","#282828"],
["S07","#E5E5E6"],["S08","#D0D1D2"],["S09","#BABBBE"],["S10","#C5A455"],["S11","#B1944D"],["S12","#9F8545"],["S13","#F2C92F"],
["S19","#FF5109"],["S22","#BB251D"],["S34","#70139E"],["S37","#CD2D96"],["S46","#C9A687"],["S55","#49802F"],["S64","#97C62D"],
["S70","#81D9D7"],["S73","#0085B7"],["S28","#2B4FA2"],["S41","#A0197E"],["S50","#7B4B2A"],["S60","#1C6E3B"],["S79","#00A3A1"],
["S84","#5A6650"],["S86","#D9C7A7"],["S87","#FFFFFF"]];
