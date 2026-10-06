import { TAMANHOS_ADULTO, TAMANHOS_INFANTIL, type Faixa } from '../layout/grade'

/* ==========================================================================
   A ficha técnica da referência.

   Cada peça que a fábrica faz tem um código (FT-010-000M) e um nome. Isso já
   existia, em Configurações, Banco de dados, Referências. A ficha técnica é o
   que faltava saber de cada uma: o molde, os detalhes de costura, a tabela de
   medidas, o tecido que ela gasta em cada tamanho e os aviamentos.

   SÃO DUAS LEITURAS. A lista (a sanfona) lê a view `referencia_na_ficha`, que
   é leve e diz só o que já foi preenchido. A ficha inteira, e o molde, só são
   lidos quando alguém abre a referência.

   A FICHA É SALVA INTEIRA, por uma função do banco: ou entra tudo, ou não
   entra nada. Ninguém escreve medida, parte ou aviamento por fora dela.

   O TECIDO É DIGITADO EM ÁREA, por parte do molde. Área não depende do
   tecido: os metros saem da largura e os gramas da gramatura do tecido que o
   orçamento escolher. E é por parte porque a peça esportiva pode levar mais
   de um tecido, e é a parte que diz quanto de cada um.

   A ETIQUETA NÃO MORA AQUI, por decisão do Henrique em 05/10/2026: ela é caso
   a caso (silk, DTF ou sublimação). Ela é do kit e do orçamento.
   ========================================================================== */

export type GrupoDeReferencia = { cod: string; nome: string; ordem: number }

export type ChaveDeDetalhe = 'gola' | 'manga' | 'punho' | 'barra' | 'costura'
export const DETALHES: { chave: ChaveDeDetalhe; nome: string; exemplo: string }[] = [
  { chave: 'gola', nome: 'Gola', exemplo: 'Redonda, ribana 1x1 de 2 cm' },
  { chave: 'manga', nome: 'Manga', exemplo: 'Curta, com bainha' },
  { chave: 'punho', nome: 'Punho', exemplo: 'Sem punho' },
  { chave: 'barra', nome: 'Barra', exemplo: 'Bainha de 2 cm' },
  { chave: 'costura', nome: 'Costura', exemplo: 'Overloque de 4 fios e galoneira' },
]
export type Detalhes = Partial<Record<ChaveDeDetalhe, string>>

/** A referência como a lista a conhece: o cadastro e o que a ficha já tem. */
export type ReferenciaNaFicha = {
  id: string
  cod: string
  nome: string
  grupo: string | null
  /** M masculino, F feminino, C infantil, U unissex */
  genero: string
  ordem: number
  ativo: boolean
  detalhes: Detalhes
  observacao: string
  /** os tamanhos ligados; vazio enquanto ninguém preencheu a ficha */
  tamanhos: string[]
  /** quando a ficha foi salva pela última vez; nulo, ela está em branco */
  fichaEm: string | null
  /** quantas medidas têm número */
  medidas: number
  /** quantas partes do molde têm tecido digitado */
  partesComTecido: number
  materiais: number
  temMolde: boolean
}

export type Medida = {
  nome: string
  comoMedir: string
  /** centímetros por tamanho; tamanho sem número não está aqui */
  valores: Record<string, number>
}

export type UnidadeDaParte = 'm2' | 'm'
export type Parte = {
  nome: string
  /** quantas vezes a parte é cortada numa peça */
  vezes: number
  /** m2 para o pano, m para a ribana e o viés */
  unidade: UnidadeDaParte
  /** o tecido da parte em cada tamanho, já com a perda e com todos os cortes */
  quantidades: Record<string, number>
}

export type MaterialDaPeca = {
  /** o material do Estoque, quando é um só; nulo quando depende da cor da peça */
  materialId: string | null
  nome: string
  quantidade: number
  unidade: string
}

export type Ficha = {
  nome: string
  detalhes: Detalhes
  observacao: string
  tamanhos: string[]
  medidas: Medida[]
  partes: Parte[]
  materiais: MaterialDaPeca[]
}

/** Um tecido do catálogo, com o que converte área em metro e em grama. */
export type TecidoDeConta = {
  id: string
  nome: string
  gramatura: number | null
  largura: number | null
}

/** Um aviamento ou insumo do Estoque, para escolher na ficha. */
export type MaterialDoEstoque = {
  id: string
  nome: string
  categoria: 'aviamento' | 'insumo'
  unidade: string
  grupo: string
}

/* --- a grade ---------------------------------------------------------------- */

export const TODOS_OS_TAMANHOS: string[] = [...TAMANHOS_ADULTO, ...TAMANHOS_INFANTIL]

export const NOME_DO_GENERO: Record<string, string> = {
  M: 'masculino',
  F: 'feminino',
  C: 'infantil',
  U: 'unissex',
}

/** A peça é infantil pelo gênero ou pelo nome: na base há infantil marcada como unissex. */
export function ehInfantil(r: { genero: string; nome: string }): boolean {
  return r.genero === 'C' || /\bINF(ANTIL)?\b/i.test(r.nome)
}

/** Os tamanhos da referência: os que a ficha ligou, ou a grade do gênero enquanto ela está em branco. */
export function tamanhosDaReferencia(r: { tamanhos: string[]; genero: string; nome: string }): string[] {
  if (r.tamanhos.length) return naOrdemDaFabrica(r.tamanhos)
  return ehInfantil(r) ? [...TAMANHOS_INFANTIL] : [...TAMANHOS_ADULTO]
}

export function naOrdemDaFabrica(tamanhos: string[]): string[] {
  return TODOS_OS_TAMANHOS.filter(t => tamanhos.includes(t))
}

export function tamanhosDaFaixa(tamanhos: string[], faixa: Faixa): string[] {
  const daFaixa: readonly string[] = faixa === 'adulto' ? TAMANHOS_ADULTO : TAMANHOS_INFANTIL
  return daFaixa.filter(t => tamanhos.includes(t))
}

/** As faixas que a grade tem, para a tela saber se mostra a troca entre Adulta e Infantil. */
export function faixasDaGrade(tamanhos: string[]): Faixa[] {
  const sai: Faixa[] = []
  if (tamanhosDaFaixa(tamanhos, 'adulto').length) sai.push('adulto')
  if (tamanhosDaFaixa(tamanhos, 'infantil').length) sai.push('infantil')
  return sai
}

/** "grade adulta, PP a G4", "grade infantil, 2A a 14A", "PP a G4 e 2A a 14A" */
export function gradeEmPalavras(tamanhos: string[]): string {
  const a = tamanhosDaFaixa(tamanhos, 'adulto')
  const i = tamanhosDaFaixa(tamanhos, 'infantil')
  const faixa = (l: string[]) => (l.length === 1 ? l[0] : `${l[0]} a ${l[l.length - 1]}`)
  if (a.length && i.length) return `${faixa(a)} e ${faixa(i)}`
  if (a.length) return `grade adulta, ${faixa(a)}`
  if (i.length) return `grade infantil, ${faixa(i)}`
  return 'sem tamanho'
}

/* --- o código --------------------------------------------------------------- */

/** FT-GGG-NNNX: o grupo, o número de três dígitos e o gênero. */
export function montarCodigo(grupo: string, numero: string, genero: string): string {
  const n = numero.replace(/\D/g, '').slice(0, 3)
  if (!grupo || n === '' || !genero) return ''
  return `FT-${grupo}-${n.padStart(3, '0')}${genero}`
}

/** O código sem o "FT-", que é como a fábrica fala: 010-000M. */
export function codigoCurto(cod: string): string {
  return cod.startsWith('FT-') ? cod.slice(3) : cod
}

/** O primeiro número livre do grupo, para a referência nova já nascer com um. */
export function proximoNumero(referencias: { cod: string; grupo: string | null }[], grupo: string): string {
  const usados = new Set<number>()
  for (const r of referencias) {
    const m = /^FT-(\d{3})-(\d{3})[A-Z]$/.exec(r.cod)
    if (m && m[1] === grupo) usados.add(Number(m[2]))
  }
  let n = 0
  while (usados.has(n)) n++
  return String(n).padStart(3, '0')
}

/* --- o que a ficha já tem ---------------------------------------------------- */

export type FaltaNaFicha = 'medidas' | 'tecido' | 'molde'

/** O que ainda falta numa ficha. Vazio: está completa. */
export function oQueFalta(r: ReferenciaNaFicha): FaltaNaFicha[] {
  const falta: FaltaNaFicha[] = []
  if (!r.medidas) falta.push('medidas')
  if (!r.partesComTecido) falta.push('tecido')
  if (!r.temMolde) falta.push('molde')
  return falta
}

/** A ficha nunca foi tocada: nem salva, nem com molde. */
export function emBranco(r: ReferenciaNaFicha): boolean {
  return !r.fichaEm && !r.temMolde
}

export function faltaEmPalavras(falta: FaltaNaFicha[]): string {
  if (!falta.length) return ''
  const nomes = falta.map(f => (f === 'medidas' ? 'medidas' : f === 'tecido' ? 'tecido' : 'molde'))
  if (nomes.length === 1) return 'falta ' + nomes[0]
  return 'faltam ' + nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]
}

/* --- as contas do tecido ----------------------------------------------------- */

/** A área da peça inteira num tamanho: a soma das partes de pano. Nulo se nenhuma parte tem número ali. */
export function areaDaPeca(partes: Parte[], tamanho: string): number | null {
  let soma = 0
  let tem = false
  for (const p of partes) {
    if (p.unidade !== 'm2') continue
    const v = p.quantidades[tamanho]
    if (typeof v === 'number') {
      soma += v
      tem = true
    }
  }
  return tem ? soma : null
}

/** A área em metros de tecido, pela largura do rolo. */
export function areaEmMetros(area: number | null, tecido: TecidoDeConta | null): number | null {
  if (area === null || !tecido || !tecido.largura || tecido.largura <= 0) return null
  return area / tecido.largura
}

/** A área em gramas de tecido, pela gramatura. */
export function areaEmGramas(area: number | null, tecido: TecidoDeConta | null): number | null {
  if (area === null || !tecido || !tecido.gramatura || tecido.gramatura <= 0) return null
  return area * tecido.gramatura
}

/** O tecido que serve para a conta: tem largura e gramatura. O primeiro deles, se ninguém escolheu. */
export function tecidosQueConvertem(tecidos: TecidoDeConta[]): TecidoDeConta[] {
  return tecidos.filter(t => (t.largura ?? 0) > 0 && (t.gramatura ?? 0) > 0)
}

/* --- o número digitado ------------------------------------------------------- */

/** "1,12" ou "1.12" vira 1.12. Vazio vira nulo. O que não é número vira NaN, para a tela acusar. */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '')
  if (limpo === '') return null
  if (!/^\d{1,5}([.,]\d{1,4})?$/.test(limpo)) return NaN
  return Number(limpo.replace(',', '.'))
}

/** O número como a fábrica escreve, com vírgula e as casas pedidas. */
export function emNumero(v: number | null | undefined, casas: number): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** O número para o campo de edição: sem zero sobrando no fim, com vírgula. */
export function paraOCampo(v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return ''
  return String(v).replace('.', ',')
}

/* --- as medidas sugeridas ---------------------------------------------------- */

/** As medidas que mais aparecem em peça de roupa, para adicionar com um toque. */
export const MEDIDAS_SUGERIDAS: { nome: string; comoMedir: string }[] = [
  { nome: 'Comprimento', comoMedir: 'do ombro à barra' },
  { nome: 'Largura', comoMedir: 'de axila a axila' },
  { nome: 'Manga', comoMedir: 'do ombro à bainha' },
  { nome: 'Ombro a ombro', comoMedir: 'de costura a costura' },
  { nome: 'Cintura', comoMedir: 'de lado a lado, sem esticar' },
  { nome: 'Quadril', comoMedir: 'de lado a lado, na parte mais larga' },
  { nome: 'Gancho', comoMedir: 'do cós ao fundo' },
  { nome: 'Entrepernas', comoMedir: 'do fundo à barra' },
  { nome: 'Boca da perna', comoMedir: 'de lado a lado, na barra' },
  { nome: 'Punho', comoMedir: 'de lado a lado' },
  { nome: 'Abertura da gola', comoMedir: 'de ombro a ombro, por dentro' },
  { nome: 'Capuz', comoMedir: 'da costura ao topo' },
]

/* --- a ficha em branco -------------------------------------------------------- */

export function fichaEmBranco(r: ReferenciaNaFicha): Ficha {
  return {
    nome: r.nome,
    detalhes: { ...r.detalhes },
    observacao: r.observacao,
    tamanhos: tamanhosDaReferencia(r),
    medidas: [],
    partes: [],
    materiais: [],
  }
}

/** A ficha de uma peça para servir de começo a outra: tudo menos o nome. */
export function copiarFicha(de: Ficha, nome: string): Ficha {
  return {
    nome,
    detalhes: { ...de.detalhes },
    observacao: de.observacao,
    tamanhos: [...de.tamanhos],
    medidas: de.medidas.map(m => ({ ...m, valores: { ...m.valores } })),
    partes: de.partes.map(p => ({ ...p, quantidades: { ...p.quantidades } })),
    materiais: de.materiais.map(m => ({ ...m })),
  }
}

/* --- o SVG do molde ----------------------------------------------------------- */

/** O maior SVG que a ficha aceita, em letras. O banco confere a mesma medida. */
export const TETO_DO_MOLDE = 600000

/** O que há de errado no arquivo do molde, em palavras. Vazio: pode subir. */
export function erroNoMolde(svg: string): string {
  const texto = svg.trim()
  if (!/<svg[\s>]/i.test(texto)) return 'O arquivo não é um SVG. Exporte o molde do Affinity em SVG.'
  if (texto.length > TETO_DO_MOLDE)
    return 'O SVG é grande demais. Exporte o molde sem imagem dentro, só o desenho.'
  if (/<script|<foreignobject|javascript:|\son[a-z]+\s*=/i.test(texto))
    return 'O SVG tem programa dentro (script ou evento). Exporte só o desenho.'
  return ''
}

/** O SVG como endereço de imagem. Mostrado assim, nada do que estiver dentro dele roda. */
export function moldeComoImagem(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/* --- o número de área na tela -------------------------------------------------- */

/** Quantas casas uma linha de área pede: duas, e a terceira só se algum tamanho precisar dela.
    A linha inteira usa a mesma conta de casas, para os números ficarem um embaixo do outro. */
export function casasDaArea(valores: (number | null | undefined)[]): 2 | 3 {
  return valores.some(v => typeof v === 'number' && Math.round(v * 1000) % 10 !== 0) ? 3 : 2
}

/** A área como a ficha mostra, com as casas da linha dela. */
export function emArea(v: number | null | undefined, casas: 2 | 3 = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** "cortada 1 vez", "cortada 2 vezes" */
export function vezesEmPalavras(vezes: number): string {
  return vezes === 1 ? 'cortada 1 vez' : `cortada ${vezes} vezes`
}

/* ==========================================================================
   O rascunho: a ficha enquanto é digitada.

   No campo o número é TEXTO. "1," ainda não é um número e não pode sumir da
   mão de quem está digitando, e o campo vazio não é zero. A ficha só vira
   número na hora de salvar, e é ali que o erro ganha nome: qual linha e qual
   tamanho.

   TAMANHO DESLIGADO NÃO PERDE O QUE TINHA enquanto o editor está aberto:
   desligou sem querer, liga de novo e o número está lá. Só na hora de salvar
   é que o que está fora da grade fica de fora.
   ========================================================================== */

export type MedidaNoRascunho = {
  chave: number
  nome: string
  comoMedir: string
  valores: Record<string, string>
}
export type ParteNoRascunho = {
  chave: number
  nome: string
  vezes: string
  unidade: UnidadeDaParte
  quantidades: Record<string, string>
}
export type MaterialNoRascunho = {
  chave: number
  materialId: string | null
  nome: string
  quantidade: string
  unidade: string
}
export type Rascunho = {
  nome: string
  detalhes: Record<ChaveDeDetalhe, string>
  observacao: string
  tamanhos: string[]
  medidas: MedidaNoRascunho[]
  partes: ParteNoRascunho[]
  materiais: MaterialNoRascunho[]
}

let ultimaChave = 0
/** Uma chave nova para uma linha do rascunho: é ela que segura o campo no lugar quando a ordem muda. */
export function chaveNova(): number {
  ultimaChave += 1
  return ultimaChave
}

const emTexto = (numeros: Record<string, number>): Record<string, string> =>
  Object.fromEntries(Object.entries(numeros).map(([t, v]) => [t, paraOCampo(v)]))

export function abrirRascunho(f: Ficha): Rascunho {
  return {
    nome: f.nome,
    detalhes: {
      gola: f.detalhes.gola ?? '',
      manga: f.detalhes.manga ?? '',
      punho: f.detalhes.punho ?? '',
      barra: f.detalhes.barra ?? '',
      costura: f.detalhes.costura ?? '',
    },
    observacao: f.observacao,
    tamanhos: naOrdemDaFabrica(f.tamanhos),
    medidas: f.medidas.map(m => ({
      chave: chaveNova(),
      nome: m.nome,
      comoMedir: m.comoMedir,
      valores: emTexto(m.valores),
    })),
    partes: f.partes.map(p => ({
      chave: chaveNova(),
      nome: p.nome,
      vezes: String(p.vezes),
      unidade: p.unidade,
      quantidades: emTexto(p.quantidades),
    })),
    materiais: f.materiais.map(m => ({
      chave: chaveNova(),
      materialId: m.materialId,
      nome: m.nome,
      quantidade: paraOCampo(m.quantidade),
      unidade: m.unidade,
    })),
  }
}

/** O rascunho sem as chaves, para saber se alguma coisa mudou desde que abriu. */
export function retratoDoRascunho(r: Rascunho): string {
  return JSON.stringify({
    ...r,
    medidas: r.medidas.map(({ chave: _c, ...m }) => m),
    partes: r.partes.map(({ chave: _c, ...p }) => p),
    materiais: r.materiais.map(({ chave: _c, ...m }) => m),
  })
}

/** Onde na tela está o que não deixou salvar, para a página levar a pessoa até lá. */
export type OndeEstaOErro = 'identificacao' | 'grade' | 'detalhes' | 'medidas' | 'tecido' | 'materiais'

export type RascunhoFechado =
  | { ficha: Ficha; erro: '' }
  | { ficha: null; erro: string; onde: OndeEstaOErro }

function lerOsTamanhos(
  textos: Record<string, string>,
  tamanhos: string[],
  teto: number,
  deQuem: string,
): { numeros: Record<string, number>; erro: string } {
  const numeros: Record<string, number> = {}
  for (const t of tamanhos) {
    const v = lerNumero(textos[t] ?? '')
    if (v === null) continue
    if (Number.isNaN(v)) return { numeros, erro: `Em "${deQuem}", o tamanho ${t} não é um número.` }
    if (v > teto)
      return { numeros, erro: `Em "${deQuem}", o tamanho ${t} passa de ${teto}. Confira a vírgula.` }
    numeros[t] = v
  }
  return { numeros, erro: '' }
}

/** A linha foi adicionada e ninguém escreveu nada nela: some sozinha, sem virar erro. */
const semNada = (nome: string, textos: Record<string, string>) =>
  nome.trim() === '' && Object.values(textos).every(v => v.trim() === '')

/** Fecha o rascunho numa ficha pronta para salvar, ou diz o que falta e onde. */
export function fecharRascunho(r: Rascunho): RascunhoFechado {
  const nao = (erro: string, onde: OndeEstaOErro): RascunhoFechado => ({ ficha: null, erro, onde })

  const nome = r.nome.trim()
  if (!nome) return nao('A referência precisa de um nome.', 'identificacao')
  if (nome.length > 120) return nao('O nome da referência passa de 120 letras.', 'identificacao')

  const tamanhos = naOrdemDaFabrica(r.tamanhos)
  if (!tamanhos.length) return nao('Ligue pelo menos um tamanho na grade.', 'grade')

  const detalhes: Detalhes = {}
  for (const d of DETALHES) {
    const texto = r.detalhes[d.chave].trim()
    if (texto.length > 200) return nao(`${d.nome}: o texto passa de 200 letras.`, 'detalhes')
    if (texto) detalhes[d.chave] = texto
  }
  const observacao = r.observacao.trim()
  if (observacao.length > 2000) return nao('A observação passa de 2.000 letras.', 'detalhes')

  const medidas: Medida[] = []
  const nomesDeMedida = new Set<string>()
  for (const m of r.medidas) {
    if (semNada(m.nome, m.valores) && !m.comoMedir.trim()) continue
    const n = m.nome.trim()
    if (!n) return nao('Tem uma medida sem nome. Dê um nome a ela ou tire a linha.', 'medidas')
    if (n.length > 60) return nao(`O nome da medida "${n}" passa de 60 letras.`, 'medidas')
    if (m.comoMedir.trim().length > 120)
      return nao(`Em "${n}", o "como medir" passa de 120 letras.`, 'medidas')
    if (nomesDeMedida.has(n.toLowerCase()))
      return nao(`A medida "${n}" está duas vezes na tabela.`, 'medidas')
    nomesDeMedida.add(n.toLowerCase())
    const lido = lerOsTamanhos(m.valores, tamanhos, 999, n)
    if (lido.erro) return nao(lido.erro, 'medidas')
    medidas.push({ nome: n, comoMedir: m.comoMedir.trim(), valores: lido.numeros })
  }
  if (medidas.length > 40) return nao('São muitas medidas. A tabela leva até 40.', 'medidas')

  const partes: Parte[] = []
  const nomesDeParte = new Set<string>()
  for (const p of r.partes) {
    const n = p.nome.trim()
    if (!n) return nao('Tem uma parte do molde sem nome.', 'tecido')
    if (n.length > 60) return nao(`O nome da parte "${n}" passa de 60 letras.`, 'tecido')
    if (nomesDeParte.has(n.toLowerCase())) return nao(`A parte "${n}" está duas vezes no molde.`, 'tecido')
    nomesDeParte.add(n.toLowerCase())
    const vezes = Number(p.vezes.trim())
    if (!/^\d{1,2}$/.test(p.vezes.trim()) || vezes < 1 || vezes > 20)
      return nao(`A parte "${n}" é cortada de 1 a 20 vezes.`, 'tecido')
    const lido = lerOsTamanhos(p.quantidades, tamanhos, 99, n)
    if (lido.erro) return nao(lido.erro, 'tecido')
    partes.push({ nome: n, vezes, unidade: p.unidade, quantidades: lido.numeros })
  }
  if (partes.length > 30) return nao('São muitas partes. O molde leva até 30.', 'tecido')

  const materiais: MaterialDaPeca[] = []
  for (const m of r.materiais) {
    const n = m.nome.trim()
    if (!n) return nao('Tem um aviamento sem nome.', 'materiais')
    if (n.length > 120) return nao(`O nome do aviamento "${n}" passa de 120 letras.`, 'materiais')
    const unidade = m.unidade.trim()
    if (unidade.length > 12) return nao(`A unidade de "${n}" passa de 12 letras.`, 'materiais')
    const q = lerNumero(m.quantidade)
    if (q === null || Number.isNaN(q) || q <= 0)
      return nao(`Diga quanto de "${n}" vai em cada peça, em número maior que zero.`, 'materiais')
    materiais.push({ materialId: m.materialId, nome: n, quantidade: q, unidade })
  }
  if (materiais.length > 60) return nao('São muitos aviamentos. A ficha leva até 60.', 'materiais')

  return {
    ficha: { nome, detalhes, observacao, tamanhos, medidas, partes, materiais },
    erro: '',
  }
}

/** As partes do rascunho como número, para a soma andar junto com o que é digitado. */
export function partesEmNumero(partes: ParteNoRascunho[], tamanhos: string[]): Parte[] {
  return partes.map(p => {
    const quantidades: Record<string, number> = {}
    for (const t of tamanhos) {
      const v = lerNumero(p.quantidades[t] ?? '')
      if (v !== null && !Number.isNaN(v)) quantidades[t] = v
    }
    const vezes = Number(p.vezes)
    return {
      nome: p.nome,
      vezes: Number.isInteger(vezes) && vezes > 0 ? vezes : 1,
      unidade: p.unidade,
      quantidades,
    }
  })
}

/** O que está no campo não é um número que a ficha aceita. */
export function campoComErro(texto: string): boolean {
  return Number.isNaN(lerNumero(texto) ?? 0)
}
