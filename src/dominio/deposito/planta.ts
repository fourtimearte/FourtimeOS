/* ==========================================================================
   A planta do depósito: a conta, sem banco e sem tela.

   O depósito é um chão medido em metros e o que está em cima dele: prateleira
   (com vãos e níveis), palete, escada e porta. Este arquivo sabe onde cada
   lugar fica, como se chama, o que cabe e o que não cabe. Ele não importa
   nada: é o que o editor, o mapa e o teste usam, e o teste roda sem
   navegador.

   AS MEDIDAS SÃO EM METROS, COM DUAS CASAS. O editor encaixa de 10 em 10 cm,
   mas o que a pessoa digita vale como digitou.

   O CÓDIGO DO LUGAR é o que a pessoa lê e fala: "D2-3" é a prateleira D, vão
   2, nível 3; "P07" é o palete. O banco monta o mesmo código na view, e os
   dois precisam concordar.
   ========================================================================== */

export type TipoDeMovel = 'prateleira' | 'palete' | 'escada' | 'porta'

export type Movel = {
  id: string
  tipo: TipoDeMovel
  nome: string
  /** para que serve: Tecido, Aviamentos e insumos... só texto, para quem lê o desenho */
  uso: string
  /** o canto de cima, à esquerda, em metros */
  x: number
  y: number
  /** o retângulo como aparece no desenho, já girado */
  largura: number
  fundo: number
  /** os vãos correm de cima para baixo no desenho (prateleira encostada na parede do lado) */
  emPe: boolean
  vaos: number
  niveis: number
  /** um nome por vão; vazio quer dizer nome da prateleira mais o número */
  nomesDosVaos: string[]
  /** os paletes postos de uma vez dividem o mesmo número de grade */
  grade: string
}

export type Planta = {
  id: string
  nome: string
  largura: number
  fundo: number
  moveis: Movel[]
}

/** um lugar onde se guarda material: o palete inteiro, ou um vão de prateleira (com ou sem nível) */
export type Lugar = { movelId: string; vao: number | null; nivel: number | null }

/** o lugar como o desenho o mostra: um retângulo com nome */
export type Celula = {
  /** movel e vão, juntos: é a chave de quem guarda coisa ali, sem o nível */
  chave: string
  movelId: string
  vao: number | null
  tipo: 'prateleira' | 'palete'
  nome: string
  x: number
  y: number
  largura: number
  fundo: number
}

export const MAXIMO_DE_VAOS = 20
export const MAXIMO_DE_NIVEIS = 6
export const MENOR_LADO_DO_CHAO = 2
export const MAIOR_LADO_DO_CHAO = 200
/** o encaixe do editor: 10 cm */
export const ENCAIXE = 0.1

export const NOME_DO_TIPO: Record<TipoDeMovel, string> = {
  prateleira: 'Prateleira',
  palete: 'Palete',
  escada: 'Escada',
  porta: 'Porta',
}

export function guardaMaterial(m: Pick<Movel, 'tipo'>): boolean {
  return m.tipo === 'prateleira' || m.tipo === 'palete'
}

/* ---------- números ------------------------------------------------------- */

/** duas casas, sem o lixo da conta em ponto flutuante (0.1 + 0.2) */
export function duasCasas(v: number): number {
  return Math.round(v * 100) / 100
}

export function encaixar(v: number, passo = ENCAIXE): number {
  return duasCasas(Math.round(v / passo) * passo)
}

function prender(v: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(v, minimo), Math.max(minimo, maximo))
}

/** 1,3 e 15: metro como a fábrica escreve, sem zero sobrando */
export function metros(v: number): string {
  return String(duasCasas(v)).replace('.', ',')
}

/* ---------- nomes e códigos ----------------------------------------------- */

export function chaveDaCelula(movelId: string, vao: number | null): string {
  return movelId + ':' + (vao ?? 0)
}

export function nomeDoVao(m: Pick<Movel, 'nome' | 'nomesDosVaos'>, vao: number): string {
  const escrito = (m.nomesDosVaos[vao - 1] ?? '').trim()
  return escrito || m.nome + vao
}

/** "D2-3", "D2" ou "P07" */
export function codigoDoLugar(m: Movel, vao: number | null, nivel: number | null): string {
  if (m.tipo !== 'prateleira' || vao === null) return m.nome
  return nomeDoVao(m, vao) + (nivel === null ? '' : '-' + nivel)
}

/** "Prateleira D · vão 2 · nível 3" ou "Palete P07" */
export function lugarPorExtenso(m: Movel, vao: number | null, nivel: number | null): string {
  if (m.tipo !== 'prateleira' || vao === null) return NOME_DO_TIPO[m.tipo] + ' ' + m.nome
  const escrito = (m.nomesDosVaos[vao - 1] ?? '').trim()
  const doVao = escrito && escrito !== m.nome + vao ? escrito : 'vão ' + vao
  return 'Prateleira ' + m.nome + ' · ' + doVao + (nivel === null ? '' : ' · nível ' + nivel)
}

function semAcentoEMinusculo(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/* O QUE A PESSOA ESCREVE VIRA LUGAR: "d2-3", "D2", "p07". O nível vem depois
   do último hífen, e só vale se a prateleira tiver aquele nível. Nome de vão
   pode ter hífen ("A-1"), então o texto inteiro é tentado primeiro. */
export function lugarPeloCodigo(planta: Planta, texto: string): Lugar | null {
  const alvo = semAcentoEMinusculo(texto)
  if (!alvo) return null
  const tentar = (codigo: string, nivel: number | null): Lugar | null => {
    for (const m of planta.moveis) {
      if (m.tipo === 'palete') {
        if (nivel === null && semAcentoEMinusculo(m.nome) === codigo) {
          return { movelId: m.id, vao: null, nivel: null }
        }
      } else if (m.tipo === 'prateleira') {
        for (let v = 1; v <= m.vaos; v++) {
          if (semAcentoEMinusculo(nomeDoVao(m, v)) !== codigo) continue
          if (nivel !== null && (nivel < 1 || nivel > m.niveis)) return null
          return { movelId: m.id, vao: v, nivel }
        }
      }
    }
    return null
  }
  const inteiro = tentar(alvo, null)
  if (inteiro) return inteiro
  const corte = alvo.lastIndexOf('-')
  if (corte <= 0) return null
  const nivel = Number(alvo.slice(corte + 1))
  if (!Number.isInteger(nivel)) return null
  return tentar(alvo.slice(0, corte).trim(), nivel)
}

/* ---------- geometria ------------------------------------------------------ */

type Retangulo = { x: number; y: number; largura: number; fundo: number }

/** os dois se pisam? Encostar não é pisar. */
export function sobrepoe(a: Retangulo, b: Retangulo): boolean {
  const folga = 0.001
  return (
    a.x < b.x + b.largura - folga &&
    b.x < a.x + a.largura - folga &&
    a.y < b.y + b.fundo - folga &&
    b.y < a.y + a.fundo - folga
  )
}

export function cabeNoChao(m: Retangulo, planta: Pick<Planta, 'largura' | 'fundo'>): boolean {
  return (
    m.x >= -0.001 &&
    m.y >= -0.001 &&
    m.x + m.largura <= planta.largura + 0.001 &&
    m.y + m.fundo <= planta.fundo + 0.001
  )
}

/** devolve o retângulo dentro do chão, sem mudar o tamanho (a não ser que não caiba) */
export function porDentroDoChao<T extends Retangulo>(
  m: T,
  planta: Pick<Planta, 'largura' | 'fundo'>,
): T {
  const largura = Math.min(m.largura, planta.largura)
  const fundo = Math.min(m.fundo, planta.fundo)
  return {
    ...m,
    largura: duasCasas(largura),
    fundo: duasCasas(fundo),
    x: duasCasas(prender(m.x, 0, planta.largura - largura)),
    y: duasCasas(prender(m.y, 0, planta.fundo - fundo)),
  }
}

/** os lugares do móvel: um retângulo por vão, ou o palete inteiro */
export function celulasDoMovel(m: Movel): Celula[] {
  if (m.tipo === 'palete') {
    return [
      {
        chave: chaveDaCelula(m.id, null),
        movelId: m.id,
        vao: null,
        tipo: 'palete',
        nome: m.nome,
        x: m.x,
        y: m.y,
        largura: m.largura,
        fundo: m.fundo,
      },
    ]
  }
  if (m.tipo !== 'prateleira') return []
  const n = Math.max(1, m.vaos)
  const saida: Celula[] = []
  for (let i = 0; i < n; i++) {
    saida.push({
      chave: chaveDaCelula(m.id, i + 1),
      movelId: m.id,
      vao: i + 1,
      tipo: 'prateleira',
      nome: nomeDoVao(m, i + 1),
      x: m.emPe ? m.x : m.x + (i * m.largura) / n,
      y: m.emPe ? m.y + (i * m.fundo) / n : m.y,
      largura: m.emPe ? m.largura : m.largura / n,
      fundo: m.emPe ? m.fundo / n : m.fundo,
    })
  }
  return saida
}

export function celulasDaPlanta(planta: Planta): Celula[] {
  return planta.moveis.flatMap(celulasDoMovel)
}

/** quantos vãos de prateleira e quantos paletes: os lugares onde cabe material */
export function contarLugares(planta: Planta): {
  prateleiras: number
  vaos: number
  paletes: number
} {
  let prateleiras = 0
  let vaos = 0
  let paletes = 0
  for (const m of planta.moveis) {
    if (m.tipo === 'prateleira') {
      prateleiras++
      vaos += m.vaos
    } else if (m.tipo === 'palete') paletes++
  }
  return { prateleiras, vaos, paletes }
}

/* ---------- girar ----------------------------------------------------------
   Girar troca a largura pelo fundo em volta do meio, e os vãos passam a correr
   para o outro lado. Se depois de girar a peça sair do chão, ela é empurrada
   para dentro. */
export function girar(m: Movel, planta: Pick<Planta, 'largura' | 'fundo'>): Movel {
  const cx = m.x + m.largura / 2
  const cy = m.y + m.fundo / 2
  return porDentroDoChao(
    {
      ...m,
      largura: m.fundo,
      fundo: m.largura,
      x: encaixar(cx - m.fundo / 2),
      y: encaixar(cy - m.largura / 2),
      emPe: m.tipo === 'prateleira' ? !m.emPe : m.emPe,
    },
    planta,
  )
}

/* ---------- peça nova ------------------------------------------------------ */

function nomesEmUso(planta: Planta): Set<string> {
  const usados = new Set<string>()
  for (const m of planta.moveis) {
    usados.add(semAcentoEMinusculo(m.nome))
    if (m.tipo === 'prateleira') {
      for (let v = 1; v <= m.vaos; v++) usados.add(semAcentoEMinusculo(nomeDoVao(m, v)))
    }
  }
  return usados
}

/** a próxima letra livre para prateleira: A, B, C... e depois A2, B2 */
export function proximoNomeDePrateleira(planta: Planta): string {
  const usados = new Set(
    planta.moveis.filter(m => m.tipo === 'prateleira').map(m => m.nome.trim().toUpperCase()),
  )
  for (let volta = 1; volta < 20; volta++) {
    for (let i = 0; i < 26; i++) {
      const nome = String.fromCharCode(65 + i) + (volta === 1 ? '' : volta)
      if (!usados.has(nome)) return nome
    }
  }
  return 'Prateleira ' + (usados.size + 1)
}

function doisDigitos(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

/** o próximo "P07" livre a partir de um número */
export function proximoNomeDePalete(
  planta: Planta,
  prefixo = 'P',
  aPartirDe = 1,
  alem: string[] = [],
): string {
  const usados = nomesEmUso(planta)
  for (const a of alem) usados.add(semAcentoEMinusculo(a))
  for (let n = Math.max(1, aPartirDe); n < 10000; n++) {
    const nome = prefixo + doisDigitos(n)
    if (!usados.has(semAcentoEMinusculo(nome))) return nome
  }
  return prefixo + Date.now()
}

/** um lugar vago no chão para a peça nova: anda de meio em meio metro até não pisar em ninguém */
function vagaNoChao(planta: Planta, largura: number, fundo: number): { x: number; y: number } {
  const l = Math.min(largura, planta.largura)
  const f = Math.min(fundo, planta.fundo)
  for (let y = 0.5; y + f <= planta.fundo + 0.001; y = duasCasas(y + 0.5)) {
    for (let x = 0.5; x + l <= planta.largura + 0.001; x = duasCasas(x + 0.5)) {
      const r = { x, y, largura: l, fundo: f }
      if (!planta.moveis.some(m => sobrepoe(r, m))) return { x, y }
    }
  }
  return { x: 0, y: 0 }
}

function base(id: string, tipo: TipoDeMovel, nome: string): Movel {
  return {
    id,
    tipo,
    nome,
    uso: '',
    x: 0,
    y: 0,
    largura: 1,
    fundo: 1,
    emPe: false,
    vaos: 1,
    niveis: 1,
    nomesDosVaos: [],
    grade: '',
  }
}

export function novaPrateleira(planta: Planta, id: string): Movel {
  const largura = Math.min(4, planta.largura)
  const fundo = 0.7
  return porDentroDoChao(
    {
      ...base(id, 'prateleira', proximoNomeDePrateleira(planta)),
      largura,
      fundo,
      vaos: 4,
      niveis: 4,
      ...vagaNoChao(planta, largura, fundo),
    },
    planta,
  )
}

export function novoPalete(planta: Planta, id: string): Movel {
  const lado = 1.2
  return porDentroDoChao(
    {
      ...base(id, 'palete', proximoNomeDePalete(planta)),
      largura: lado,
      fundo: lado,
      ...vagaNoChao(planta, lado, lado),
    },
    planta,
  )
}

export function novaEscada(planta: Planta, id: string): Movel {
  const largura = Math.min(4, planta.largura)
  const fundo = Math.min(1.2, planta.fundo)
  const tem = planta.moveis.filter(m => m.tipo === 'escada').length
  return porDentroDoChao(
    {
      ...base(id, 'escada', tem ? 'Escada ' + (tem + 1) : 'Escada'),
      largura,
      fundo,
      ...vagaNoChao(planta, largura, fundo),
    },
    planta,
  )
}

export function novaPorta(planta: Planta, id: string): Movel {
  const largura = Math.min(1.6, planta.largura)
  const fundo = 0.3
  const tem = planta.moveis.filter(m => m.tipo === 'porta').length
  /* a porta nasce na parede de baixo, no meio: é onde quase toda porta está */
  return porDentroDoChao(
    {
      ...base(id, 'porta', tem ? 'Porta ' + (tem + 1) : 'Porta'),
      largura,
      fundo,
      x: encaixar((planta.largura - largura) / 2),
      y: duasCasas(planta.fundo - fundo),
    },
    planta,
  )
}

/* ---------- a grade de paletes ----------------------------------------------
   Pôr palete um por um num chão de trinta paletes é castigo. A grade põe todos
   de uma vez: fileiras, colunas, tamanho e espaço. Onde ela cairia em cima de
   outra peça (a escada, uma prateleira) ou fora do chão, o palete não nasce.

   A grade não é guardada como grade: cada palete é um palete, e o que os junta
   é o número dela. As medidas são lidas de volta dos próprios paletes. */
export type Grade = {
  id: string
  x: number
  y: number
  fileiras: number
  colunas: number
  /** o lado do palete */
  largura: number
  fundo: number
  /** o vão entre um palete e o vizinho do lado (entre colunas) */
  espacoX: number
  /** o vão entre um palete e o de baixo (entre fileiras) */
  espacoY: number
}

/** o vão de uma grade que acabou de nascer */
export const ESPACO_DA_GRADE = 0.8

export type OrdemDosNomes = 'fileira' | 'coluna'

export const MAXIMO_DA_GRADE = 30

/** lê a grade de volta dos paletes que a formam */
export function gradeDosPaletes(planta: Planta, gradeId: string): Grade | null {
  const membros = planta.moveis.filter(
    m => m.tipo === 'palete' && m.grade === gradeId && gradeId !== '',
  )
  if (!membros.length) return null
  const xs = [...new Set(membros.map(m => duasCasas(m.x)))].sort((a, b) => a - b)
  const ys = [...new Set(membros.map(m => duasCasas(m.y)))].sort((a, b) => a - b)
  const largura = membros[0].largura
  const fundo = membros[0].fundo
  /* o passo é a menor distância entre duas colunas (ou fileiras) vizinhas: um
     palete que não nasceu deixa um buraco, e o buraco é múltiplo do passo */
  const menorPasso = (vs: number[], lado: number): number => {
    let menor = 0
    for (let i = 1; i < vs.length; i++) {
      const d = duasCasas(vs[i] - vs[i - 1])
      if (d > 0 && (menor === 0 || d < menor)) menor = d
    }
    return menor || lado
  }
  const passoX = menorPasso(xs, largura)
  const passoY = menorPasso(ys, fundo)
  /* CADA EIXO TEM O SEU VÃO. O eixo com um palete só não tem vão para medir:
     copia o do outro, e a grade de um palete só nasce com o de sempre. */
  const medidoX = xs.length > 1 ? duasCasas(Math.max(0, passoX - largura)) : null
  const medidoY = ys.length > 1 ? duasCasas(Math.max(0, passoY - fundo)) : null
  const espacoX = medidoX ?? medidoY ?? ESPACO_DA_GRADE
  const espacoY = medidoY ?? medidoX ?? ESPACO_DA_GRADE
  return {
    id: gradeId,
    x: xs[0],
    y: ys[0],
    colunas: Math.round((xs[xs.length - 1] - xs[0]) / (largura + espacoX)) + 1,
    fileiras: Math.round((ys[ys.length - 1] - ys[0]) / (fundo + espacoY)) + 1,
    largura,
    fundo,
    espacoX,
    espacoY,
  }
}

/** o retângulo que abraça a grade inteira */
export function contornoDaGrade(g: Grade): Retangulo {
  return {
    x: g.x,
    y: g.y,
    largura: duasCasas(g.colunas * g.largura + (g.colunas - 1) * g.espacoX),
    fundo: duasCasas(g.fileiras * g.fundo + (g.fileiras - 1) * g.espacoY),
  }
}

/* MUDAR QUANTAS FILEIRAS OU COLUNAS A GRADE TEM.

   O defeito de 05/10/2026: o Henrique esticou a grade pelo canto até ela
   ocupar o chão (2 fileiras por 3 colunas, com 4,3 m entre os paletes) e
   depois quis mais fileiras e colunas. A conta antiga só sabia ESTENDER a
   grade com o mesmo vão: a fileira nova caía fora do chão, não era criada, e o
   campo voltava para 2 e 3 sem dizer por quê.

   A regra agora, na ordem:
     1. menos do que tem: tira as últimas, e o vão fica;
     2. mais, e cabe no chão com o vão de hoje: estende, como sempre;
     3. não cabe: reparte no MESMO espaço que a grade já ocupa, diminuindo o
        vão. É o caso de quem esticou a grade e agora quer encher o lugar: a
        borda que a pessoa escolheu fica onde está;
     4. se no mesmo espaço os paletes ficariam espremidos (menos de meio metro
        entre eles), usa o chão até a parede, que dá mais vão. É o caso da
        grade que acabou de nascer e ainda é pequena;
     5. nem encostados cabem até a parede: não muda nada, e diz isso.

   Só mexe no eixo pedido: mudar as fileiras não tira as colunas do lugar. */
export type MudancaDaGrade = {
  grade: Grade
  como: 'tirou' | 'estendeu' | 'repartiu' | 'ate-a-parede' | 'nao-cabe'
  /** o vão do eixo, antes e depois */
  antes: number
  depois: number
}

export function mudarContagemDaGrade(
  planta: Pick<Planta, 'largura' | 'fundo'>,
  g: Grade,
  eixo: 'fileiras' | 'colunas',
  quantos: number,
): MudancaDaGrade {
  const emY = eixo === 'fileiras'
  const lado = emY ? g.fundo : g.largura
  const origem = emY ? g.y : g.x
  const parede = emY ? planta.fundo : planta.largura
  const vao = emY ? g.espacoY : g.espacoX
  const atual = emY ? g.fileiras : g.colunas
  const n = Math.max(1, Math.min(MAXIMO_DA_GRADE, Math.round(quantos)))
  const com = (como: MudancaDaGrade['como'], vaoNovo: number): MudancaDaGrade => ({
    como,
    antes: vao,
    depois: vaoNovo,
    grade: {
      ...g,
      ...(emY ? { fileiras: n, espacoY: vaoNovo } : { colunas: n, espacoX: vaoNovo }),
    },
  })
  if (n <= atual) return com('tirou', vao)
  const folga = 0.001
  if (origem + n * lado + (n - 1) * vao <= parede + folga) return com('estendeu', vao)
  /* arredonda para baixo, ao centímetro: para cima o último palete passaria da conta */
  const emCentimetro = (v: number) => Math.floor(v * 100 + folga) / 100
  const ocupado = atual * lado + (atual - 1) * vao
  const noMesmoEspaco = (ocupado - n * lado) / (n - 1)
  if (atual > 1 && noMesmoEspaco >= VAO_QUE_DA_PARA_PASSAR - folga)
    return com('repartiu', emCentimetro(noMesmoEspaco))
  const ateAParede = (parede - origem - n * lado) / (n - 1)
  if (ateAParede >= -folga) return com('ate-a-parede', Math.max(0, emCentimetro(ateAParede)))
  return { como: 'nao-cabe', antes: vao, depois: vao, grade: g }
}

/** abaixo disto entre dois paletes ninguém passa: a grade prefere ir até a parede */
export const VAO_QUE_DA_PARA_PASSAR = 0.5

/** O maior vão que ainda deixa a grade inteira dentro do chão, no eixo pedido.
    Infinito quando o eixo tem um palete só. */
export function maiorVaoDaGrade(
  planta: Pick<Planta, 'largura' | 'fundo'>,
  g: Grade,
  eixo: 'espacoX' | 'espacoY',
): number {
  const emY = eixo === 'espacoY'
  const n = emY ? g.fileiras : g.colunas
  if (n < 2) return Infinity
  const sobra =
    (emY ? planta.fundo - g.y - n * g.fundo : planta.largura - g.x - n * g.largura) / (n - 1)
  return Math.max(0, Math.floor(sobra * 100 + 0.001) / 100)
}

/* MONTAR A GRADE: devolve os móveis da planta com os paletes da grade no
   lugar dos antigos dela.

   Palete que já existia na mesma casa (fileira e coluna) continua sendo o
   mesmo: guarda o id, e com ele o material marcado ali, e guarda o nome que a
   pessoa deu. Só ganha nome novo quem nasceu agora, ou todos, quando `renomear`
   pede (a pessoa mexeu em "os nomes começam em" ou na ordem). */
export function montarGrade(
  planta: Planta,
  g: Grade,
  opcoes: {
    novoId: () => string
    prefixo?: string
    comecaEm?: number
    ordem?: OrdemDosNomes
    renomear?: boolean
  },
): Movel[] {
  const antiga = gradeDosPaletes(planta, g.id)
  const antigos = planta.moveis.filter(m => m.tipo === 'palete' && m.grade === g.id)
  const outros = planta.moveis.filter(m => !(m.tipo === 'palete' && m.grade === g.id))
  const passoAntigoX = antiga ? antiga.largura + antiga.espacoX : 0
  const passoAntigoY = antiga ? antiga.fundo + antiga.espacoY : 0
  const naCasa = (f: number, c: number): Movel | undefined =>
    antiga
      ? antigos.find(
          m =>
            Math.round((m.x - antiga.x) / (passoAntigoX || 1)) === c &&
            Math.round((m.y - antiga.y) / (passoAntigoY || 1)) === f,
        )
      : undefined

  type Casa = { f: number; c: number; movel: Movel; novo: boolean }
  const casas: Casa[] = []
  for (let f = 0; f < g.fileiras; f++) {
    for (let c = 0; c < g.colunas; c++) {
      const r = {
        x: duasCasas(g.x + c * (g.largura + g.espacoX)),
        y: duasCasas(g.y + f * (g.fundo + g.espacoY)),
        largura: g.largura,
        fundo: g.fundo,
      }
      if (!cabeNoChao(r, planta)) continue
      if (outros.some(m => sobrepoe(r, m))) continue
      const velho = naCasa(f, c)
      casas.push({
        f,
        c,
        novo: !velho,
        movel: velho
          ? { ...velho, ...r }
          : {
              ...base(opcoes.novoId(), 'palete', ''),
              ...r,
              grade: g.id,
              uso: antigos[0]?.uso ?? '',
            },
      })
    }
  }

  const ordem = opcoes.ordem ?? 'fileira'
  const naOrdem = [...casas].sort((a, b) =>
    ordem === 'coluna' ? a.c - b.c || a.f - b.f : a.f - b.f || a.c - b.c,
  )
  const plantaDosOutros: Planta = { ...planta, moveis: outros }
  const dados: string[] = opcoes.renomear ? [] : casas.filter(k => !k.novo).map(k => k.movel.nome)
  let proximo = opcoes.comecaEm ?? 1
  for (const casa of naOrdem) {
    if (!opcoes.renomear && !casa.novo) continue
    const nome = proximoNomeDePalete(plantaDosOutros, opcoes.prefixo ?? 'P', proximo, dados)
    casa.movel = { ...casa.movel, nome }
    dados.push(nome)
    proximo = Number(nome.slice((opcoes.prefixo ?? 'P').length)) + 1 || proximo + 1
  }
  return [...outros, ...naOrdem.map(k => k.movel)]
}

/** "P01" vira o prefixo "P" e o número 1: é o que "os nomes começam em" guarda */
export function partirNomeDePalete(nome: string): { prefixo: string; numero: number } {
  const achado = /^(.*?)(\d+)$/.exec(nome.trim())
  if (!achado) return { prefixo: nome.trim() || 'P', numero: 1 }
  return { prefixo: achado[1], numero: Number(achado[2]) || 1 }
}

/* ---------- conferir antes de salvar ---------------------------------------
   A mesma conferência que o banco faz (047), feita antes de mandar: a pessoa
   lê o motivo ao lado do desenho, e não numa mensagem de erro depois de
   esperar. Devolve a frase, ou vazio quando está tudo certo. */
export function conferirPlanta(planta: Planta): string {
  if (
    !(planta.largura >= MENOR_LADO_DO_CHAO && planta.largura <= MAIOR_LADO_DO_CHAO) ||
    !(planta.fundo >= MENOR_LADO_DO_CHAO && planta.fundo <= MAIOR_LADO_DO_CHAO)
  ) {
    return 'O chão do depósito precisa ter de 2 a 200 metros de cada lado.'
  }
  const codigos = new Map<string, string>()
  for (const m of planta.moveis) {
    const nome = m.nome.trim()
    if (!nome) return 'Toda peça do depósito precisa de um nome.'
    if (!(m.largura > 0 && m.fundo > 0)) return nome + ' está com medida inválida.'
    if (!cabeNoChao(m, planta)) return nome + ' está fora do chão do depósito.'
    if (m.tipo === 'prateleira') {
      if (!(m.vaos >= 1 && m.vaos <= MAXIMO_DE_VAOS))
        return 'A prateleira ' + nome + ' precisa ter de 1 a 20 vãos.'
      if (!(m.niveis >= 1 && m.niveis <= MAXIMO_DE_NIVEIS))
        return 'A prateleira ' + nome + ' precisa ter de 1 a 6 níveis.'
      for (let v = 1; v <= m.vaos; v++) {
        const c = nomeDoVao(m, v)
        const chave = c.toLowerCase()
        if (codigos.has(chave)) return 'O nome ' + c + ' aparece em mais de um lugar do depósito.'
        codigos.set(chave, c)
      }
    } else if (m.tipo === 'palete') {
      const chave = nome.toLowerCase()
      if (codigos.has(chave)) return 'O nome ' + nome + ' aparece em mais de um lugar do depósito.'
      codigos.set(chave, nome)
    }
  }
  return ''
}

/* QUEM PERDERIA O LUGAR com o desenho novo: o móvel saiu, ou o vão ou o nível
   marcado deixou de existir. Devolve os materiais, sem repetir. */
export function quemPerdeOLugar(
  nova: Planta,
  lugares: { materialId: string; movelId: string; vao: number | null; nivel: number | null }[],
): string[] {
  const porId = new Map(nova.moveis.map(m => [m.id, m]))
  const perdem = new Set<string>()
  for (const l of lugares) {
    const m = porId.get(l.movelId)
    const some =
      !m ||
      !guardaMaterial(m) ||
      (m.tipo === 'palete' && l.vao !== null) ||
      (m.tipo === 'prateleira' && (l.vao === null || l.vao > m.vaos || (l.nivel ?? 1) > m.niveis))
    if (some) perdem.add(l.materialId)
  }
  return [...perdem]
}

/* ---------- o que está igual ------------------------------------------------ */

/** o desenho mudou? É o que acende o Salvar e o que pergunta antes de descartar. */
export function plantasIguais(a: Planta, b: Planta): boolean {
  const limpa = (p: Planta) =>
    JSON.stringify({
      nome: p.nome.trim(),
      largura: duasCasas(p.largura),
      fundo: duasCasas(p.fundo),
      moveis: [...p.moveis]
        .sort((x, y) => (x.id < y.id ? -1 : 1))
        .map(m => ({
          ...m,
          nome: m.nome.trim(),
          uso: m.uso.trim(),
          x: duasCasas(m.x),
          y: duasCasas(m.y),
          largura: duasCasas(m.largura),
          fundo: duasCasas(m.fundo),
          nomesDosVaos:
            m.tipo === 'prateleira'
              ? Array.from({ length: m.vaos }, (_, i) => nomeDoVao(m, i + 1))
              : [],
        })),
    })
  return limpa(a) === limpa(b)
}
