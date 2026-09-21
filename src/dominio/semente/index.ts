import { chamar, tabela } from '@shared/supabase'
import { CLIENTES_DE_EXEMPLO } from '@dominio/cliente'
import { ESTAGIOS, LEADS_DE_EXEMPLO, type LeadDeExemplo } from '@dominio/funil'
import {
  acharCotacao,
  aprovarNoBanco,
  COTACOES_DE_EXEMPLO,
  montarCotacaoDeExemplo,
  pecasDaCotacao,
  totalDaCotacao,
  VERSAO_DO_CFT,
} from '@dominio/cotacao'

/* ==========================================================================
   A semente.

   O banco de verdade nasce VAZIO, e tela vazia não se confere: não dá para
   saber se a ordenação está certa olhando zero linhas, nem se a paginação
   quebra em 1.901 contatos olhando nenhum.

   Então esta função grava o conteúdo de exemplo DENTRO do banco, marcado como
   teste. A diferença em relação ao que havia antes é o que importa: antes a
   lista de exemplo vivia dentro do navegador e o caminho que rodava era falso.
   Agora o conteúdo é de mentira mas o CAMINHO é o de verdade: mesma consulta,
   mesma regra de acesso, mesmo erro quando a internet cai, mesma conta da
   view somando o histórico do Bling com os pedidos do sistema.

   Tudo que ela grava leva teste = true, e some inteiro em uma chamada no dia
   do lançamento. A regra está na migração 014.
   ========================================================================== */

export type ContaDeTeste = { tabela: string; linhas: number }

export async function contarDadosDeTeste(): Promise<ContaDeTeste[]> {
  const linhas = await tabela<{ tabela: string; linhas: number }[]>(
    'dado_de_teste?select=tabela,linhas&order=tabela.asc',
  )
  return linhas.map((l) => ({ tabela: l.tabela, linhas: Number(l.linhas) || 0 }))
}

export function totalDeTeste(contas: ContaDeTeste[]): number {
  return contas.reduce((s, c) => s + c.linhas, 0)
}

/* O PostgREST aceita uma lista inteira num POST só, e é isso que faz a semente
   ser rápida. Mas não em um pedido só de 1.901 linhas: um erro no meio de um
   pedido gigante derruba o pedido inteiro, e a mensagem não diz qual linha
   causou. Em lotes, quem falha é o lote, e o resto entra. */
const LOTE = 100

/* Os três números do histórico entram nas colunas de ANTES do sistema (015):
   o cliente de exemplo tem 14 pedidos e R$ 66.280 comprados, e esses pedidos
   não existem na tabela pedido nem deveriam. É exatamente a forma do dado que
   vai chegar do Bling, e semear assim é o que faz a soma da view ser conferida
   de verdade em vez de ficar sempre zerada de um lado. */
function paraOBanco(c: (typeof CLIENTES_DE_EXEMPLO)[number]) {
  return {
    nome: c.nome,
    fantasia: c.fantasia,
    tipo: c.tipo,
    documento: c.documento,
    contato: c.contato,
    telefone: c.telefone,
    celular: c.celular,
    email: c.email,
    endereco: c.endereco,
    complemento: c.complemento,
    bairro: c.bairro,
    cidade: c.cidade,
    uf: c.uf,
    cep: c.cep,
    tipo_de_contato: c.tipoDeContato,
    segmento: c.segmento,
    vendedor: c.vendedor,
    pedidos_antigos: c.pedidos,
    total_antigo: c.total,
    ultimo_pedido_antigo: c.ultimoPedido || null,
    teste: true,
  }
}

export type ResultadoDaSemente = { gravados: number; recusados: number; recados: string[] }

export async function semearClientes(): Promise<ResultadoDaSemente> {
  const fila = CLIENTES_DE_EXEMPLO.map(paraOBanco)
  let gravados = 0
  let recusados = 0
  const recados: string[] = []

  for (let i = 0; i < fila.length; i += LOTE) {
    const lote = fila.slice(i, i + LOTE)
    try {
      await tabela('cliente', { metodo: 'POST', corpo: lote })
      gravados += lote.length
    } catch (e) {
      recusados += lote.length
      const recado = e instanceof Error ? e.message : 'lote recusado'
      /* O mesmo motivo repetido cem vezes não é cem informações. Nome repetido
         é o motivo esperado quando alguém semeia duas vezes. */
      if (!recados.includes(recado)) recados.push(recado)
    }
  }

  return { gravados, recusados, recados }
}

export async function apagarDadosDeTeste(): Promise<string> {
  return chamar<string>('apagar_dados_de_teste')
}

/* --- os leads ------------------------------------------------------------
   Duas gravações por lead: a linha e a conversa. E a conversa precisa do id
   que o banco acabou de dar, então ela vem depois, e não junto.

   O tempo é o detalhe que importa aqui. O exemplo diz "há 47 minutos", e isso
   vira uma DATA contada a partir de agora. Gravar o número 47 congelaria o
   relógio: o cartão diria 47 min para sempre, e a única pergunta que o funil
   responde é de quem a conversa está esperando. */

const MINUTO = 60_000

function quando(minutosAtras: number): string {
  return new Date(Date.now() - minutosAtras * MINUTO).toISOString()
}

/* A conversa que o v5 desenhava: o cliente pergunta, a gente responde, ele
   confirma. Quanto mais adiantado o estágio, mais trocas. */
function conversaDe(s: LeadDeExemplo, leadId: string) {
  const linhas: Record<string, unknown>[] = [
    {
      lead_id: leadId,
      quem: 'cliente',
      tipo: 'texto',
      texto: s.msg,
      em: quando(s.minutosAtras),
      situacao: s.novo ? '' : 'lida',
    },
  ]
  if (ESTAGIOS.indexOf(s.estagio) >= 1) {
    linhas.unshift(
      {
        lead_id: leadId,
        quem: 'cliente',
        tipo: 'texto',
        texto: 'Manda o que precisa que eu levanto aqui.',
        em: quando(s.minutosAtras + 60),
        situacao: 'lida',
      },
      {
        lead_id: leadId,
        quem: 'nos',
        tipo: 'texto',
        texto:
          'Oi ' +
          (s.contato.split(' ')[0] || '') +
          '! Aqui é a Carla da Fourtime. Consigo sim, me passa a grade de tamanhos?',
        em: quando(s.minutosAtras + 100),
        situacao: 'lida',
      },
    )
  }
  /* a ordem certa e do mais antigo para o mais novo */
  return linhas.sort((a, b) => String(a.em).localeCompare(String(b.em)))
}

/* O CLIENTE TEM TRAVA DE NOME; O LEAD NAO TEM, E NAO DEVE TER.

   Duas pessoas do mesmo time podem escrever do mesmo numero, e a mesma pessoa
   pode voltar meses depois com outro pedido: lead repetido e vida normal, e
   uma trava ali atrapalharia o WhatsApp de verdade.

   Mas isso significa que semear duas vezes duplicaria os oito, e ninguem quer
   um quadro com dezesseis cartoes iguais. Entao a checagem e aqui, na semente,
   e nao no banco: quem ja esta la fora fica de fora. */
export async function semearLeads(): Promise<ResultadoDaSemente> {
  let gravados = 0
  let recusados = 0
  const recados: string[] = []

  const jaExistem = new Set(
    (await tabela<{ telefone: string }[]>('lead?select=telefone')).map((l) =>
      (l.telefone || '').replace(/\D/g, '').slice(-8),
    ),
  )

  for (const s of LEADS_DE_EXEMPLO) {
    if (jaExistem.has(s.telefone.replace(/\D/g, '').slice(-8))) {
      recusados++
      const recado = 'Esses leads já estão no funil.'
      if (!recados.includes(recado)) recados.push(recado)
      continue
    }
    try {
      const criado = await tabela<{ id: string }[]>('lead', {
        metodo: 'POST',
        devolver: true,
        corpo: [
          {
            nome: s.nome,
            contato: s.contato,
            telefone: s.telefone,
            estagio: s.estagio,
            valor: s.valor,
            ultima_msg: s.msg,
            ultima_msg_em: quando(s.minutosAtras),
            nao_lidas: s.novo ?? 0,
            origem: 'whatsapp',
            teste: true,
          },
        ],
      })
      const id = criado[0]?.id
      if (!id) throw new Error('o banco não devolveu o lead')
      await tabela('mensagem', { metodo: 'POST', corpo: conversaDe(s, id) })
      gravados++
    } catch (e) {
      recusados++
      const recado = e instanceof Error ? e.message : 'lead recusado'
      if (!recados.includes(recado)) recados.push(recado)
    }
  }

  return { gravados, recusados, recados }
}


/* --- as cotacoes ---------------------------------------------------------
   Seis, com layouts, grades e precos sorteados sempre do mesmo jeito. Elas sao
   as mais pesadas da semente porque o corpo do documento vai inteiro numa
   coluna, e por isso entram uma a uma em vez de num lote so: um erro no meio
   de um lote gigante derruba o lote inteiro e a mensagem nao diz qual linha
   causou.

   O numero NAO e o do exemplo. Ele sai do contador do banco, como o de
   qualquer cotacao nova, senao a primeira cotacao de verdade depois da semente
   esbarraria num numero ja usado. */
export async function semearCotacoes(): Promise<ResultadoDaSemente> {
  let gravados = 0
  let recusados = 0
  const recados: string[] = []

  /* A cotação de exemplo traz o cliente com o id da era do Bling ("C0001"), que
     não é um uuid e não vincula nada. Semear assim daria seis cotações soltas,
     e a ficha do cliente continuaria dizendo "nenhum pedido neste sistema"
     depois de uma delas ser aprovada.

     Então o vínculo é refeito pelo NOME, que é a identidade do cliente neste
     sistema (a trava de nome único existe por isso). O que não achar cliente
     fica sem vínculo mesmo: cotação sem cliente cadastrado é uma situação real,
     e semear uma dessas exercita a tela que a mostra. */
  const porNome = new Map<string, string>()
  try {
    const lista = await tabela<{ id: string; nome: string }[]>('cliente?select=id,nome')
    for (const cl of lista) porNome.set(cl.nome.trim().toLowerCase(), cl.id)
  } catch {
    /* sem a lista, as cotações entram sem vínculo */
  }

  for (let i = 0; i < COTACOES_DE_EXEMPLO.length; i++) {
    try {
      const c = montarCotacaoDeExemplo(COTACOES_DE_EXEMPLO[i], i)
      const clienteId = porNome.get(c.cliente.nome.trim().toLowerCase()) ?? ''
      c.cliente = { ...c.cliente, id: clienteId }
      const numero = await chamar<string>('proximo_numero_de_cotacao')
      const { id: _id, criadaEm: _c, alteradaEm: _a, ...corpo } = { ...c, numero }
      await tabela('cotacao', {
        metodo: 'POST',
        corpo: [
          {
            numero,
            corpo,
            cliente_id: clienteId || null,
            versao_do_formato: VERSAO_DO_CFT,
            cliente_nome: c.cliente.nome,
            cliente_cidade: c.cliente.cidade,
            cliente_uf: c.cliente.uf,
            vendedor_nome: c.vendedor,
            estado: c.estado,
            total: totalDaCotacao(c),
            pecas: pecasDaCotacao(c),
            valida_ate: c.validaAte || null,
            teste: true,
          },
        ],
      })
      gravados++
    } catch (e) {
      recusados++
      const recado = e instanceof Error ? e.message : 'cotação recusada'
      if (!recados.includes(recado)) recados.push(recado)
    }
  }

  return { gravados, recusados, recados }
}

/* --- os pedidos ----------------------------------------------------------
   Aqui a semente não grava linha nenhuma na mão: ela APROVA cotações, pelo
   mesmo caminho que o vendedor usa quando o cliente diz sim.

   É de propósito, e é a diferença entre semear e falsificar. Um insert direto
   na tabela pedido daria uma fábrica cheia de cartões, e não provaria nada:
   não passaria pelo número do pedido, pelo congelamento do vendedor, pelo
   fechamento do lead, nem pelo cálculo dos números da fábrica. Aprovando,
   tudo isso roda, e se algo estiver quebrado a semente quebra junto, que é
   exatamente o que se quer de um ensaio.

   Depois de aprovar, ela espalha os pedidos pela semana e pelos postos, para o
   painel e o kanban terem o que mostrar em mais de uma coluna. */
const POSTOS_DO_ENSAIO = ['corte', 'subli', 'dtf', 'costura', 'embalagem', 'finalizado']

function diaDaSemanaCorrente(i: number): string {
  const hoje = new Date()
  /* segunda desta semana, e dali i dias */
  const segunda = new Date(hoje)
  segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7))
  segunda.setDate(segunda.getDate() + i)
  return segunda.toISOString().slice(0, 10)
}

export async function semearPedidos(): Promise<ResultadoDaSemente> {
  let gravados = 0
  let recusados = 0
  const recados: string[] = []

  /* Só as que ainda não viraram pedido, e só as que já saíram: aprovar um
     rascunho que ninguém enviou seria semear uma coisa que não acontece. */
  const candidatas = await tabela<{ id: string }[]>(
    'cotacao_na_lista?select=id&estado=in.(enviada,aprovada)&pedido_numero=is.null&teste=is.true',
  )

  for (let i = 0; i < candidatas.length; i++) {
    try {
      const c = await acharCotacao(candidatas[i].id)
      if (!c) throw new Error('cotação sumiu no meio')
      const novo = await aprovarNoBanco(c, c.enviadas.length || 1)

      /* espalha pela semana e pelos postos, senão a fábrica inteira nasce no
         corte da segunda-feira e o painel fica com uma coluna só */
      await tabela(`pedido?numero=eq.${encodeURIComponent(novo.numero)}`, {
        metodo: 'PATCH',
        corpo: {
          etapa: POSTOS_DO_ENSAIO[i % POSTOS_DO_ENSAIO.length],
          planejado_em: diaDaSemanaCorrente(i % 6),
          aviso: i % 5 === 2 ? 'falta-tecido' : '',
        },
      })
      gravados++
    } catch (e) {
      recusados++
      const recado = e instanceof Error ? e.message : 'pedido recusado'
      if (!recados.includes(recado)) recados.push(recado)
    }
  }

  if (!candidatas.length) {
    recados.push('Nenhuma cotação de teste enviada esperando aprovação. Semeie cotações antes.')
  }

  return { gravados, recusados, recados }
}

/* --- o estoque -----------------------------------------------------------
   O estoque de verdade nasceu na migração 025, e nasceu vazio: a tela mostra o
   razão, e razão nenhum tem linha antes de alguém mexer. Semear aqui é o que
   deixa a tela de estoque e o cartão "abaixo do mínimo" do início terem o que
   mostrar durante o ensaio.

   DUAS COISAS QUE ESTA FUNÇÃO FAZ DE PROPÓSITO, E PARECEM TRABALHO À TOA:

   O tecido aponta para o CATÁLOGO por id, e não pelo nome. Ela procura a malha
   e a cor na tabela do editor e grava os dois ids. É o que vai permitir, no
   passo da separação, achar "o tecido deste layout" sem comparar texto com
   texto. Um material cuja malha não está no catálogo entra sem ligação, e a
   tela mostra isso.

   E o saldo entra por MOVIMENTO, um de cada vez, e não escrevendo na coluna.
   Escrever direto seria uma chamada só e um segundo mais rápido, e criaria
   exatamente o que a migração 025 existe para impedir: um saldo sem linha que
   o explique. O ensaio usa o caminho de verdade, ou não prova nada. */

type MaterialDeExemplo = {
  categoria: 'tecido' | 'aviamento' | 'insumo'
  nome: string
  unidade: string
  minimo: number
  saldo: number
  /* nome no catálogo do editor, quando existe */
  malha?: string
  cor?: string
}

const ESTOQUE_DE_EXEMPLO: MaterialDeExemplo[] = [
  { categoria: 'tecido', nome: 'DRYFIT POLIESTER 100% · Branco', unidade: 'kg', minimo: 20, saldo: 42, malha: 'DRYFIT POLIESTER 100%', cor: 'Branco' },
  { categoria: 'tecido', nome: 'DRYFIT POLIESTER 100% · Preto', unidade: 'kg', minimo: 20, saldo: 9, malha: 'DRYFIT POLIESTER 100%', cor: 'Preto' },
  { categoria: 'tecido', nome: 'DRYFIT POLIESTER 100% · Azul Marinho', unidade: 'kg', minimo: 10, saldo: 28, malha: 'DRYFIT POLIESTER 100%', cor: 'Azul Marinho' },
  { categoria: 'tecido', nome: 'DRYFIT POLIESTER 100% · Vermelho Fourtime', unidade: 'kg', minimo: 10, saldo: 12, malha: 'DRYFIT POLIESTER 100%', cor: 'Vermelho Fourtime' },
  { categoria: 'tecido', nome: 'PIQUET 100% · Branco', unidade: 'kg', minimo: 15, saldo: 6, malha: 'PIQUET 100%', cor: 'Branco' },
  { categoria: 'tecido', nome: 'PIQUET 100% · Azul Marinho', unidade: 'kg', minimo: 15, saldo: 31, malha: 'PIQUET 100%', cor: 'Azul Marinho' },
  { categoria: 'tecido', nome: 'ALGODAO MESCLA SEM ELASTANO · Cinza Mescla', unidade: 'kg', minimo: 20, saldo: 58, malha: 'ALGODAO MESCLA SEM ELASTANO', cor: 'Cinza Mescla' },
  { categoria: 'tecido', nome: 'ALGODAO 100% · Preto', unidade: 'kg', minimo: 15, saldo: 22, malha: 'ALGODAO 100%', cor: 'Preto' },
  { categoria: 'tecido', nome: 'HELANCA COLEGIAL · Azul Marinho', unidade: 'kg', minimo: 3, saldo: 4, malha: 'HELANCA COLEGIAL', cor: 'Azul Marinho' },
  { categoria: 'tecido', nome: 'MOLETOM · Preto', unidade: 'kg', minimo: 10, saldo: 16, malha: 'MOLETOM', cor: 'Preto' },

  { categoria: 'aviamento', nome: 'Linha poliéster 120 branca', unidade: 'cone', minimo: 8, saldo: 18 },
  { categoria: 'aviamento', nome: 'Linha poliéster 120 preta', unidade: 'cone', minimo: 8, saldo: 11 },
  { categoria: 'aviamento', nome: 'Elástico 30 mm', unidade: 'm', minimo: 100, saldo: 210 },
  { categoria: 'aviamento', nome: 'Cadarço 6 mm branco', unidade: 'm', minimo: 60, saldo: 140 },
  { categoria: 'aviamento', nome: 'Etiqueta Fourtime tecida', unidade: 'un', minimo: 500, saldo: 1450 },
  { categoria: 'aviamento', nome: 'Gola retilínea piquet marinho', unidade: 'un', minimo: 60, saldo: 40 },
  { categoria: 'aviamento', nome: 'Botão 4 furos 18 mm', unidade: 'un', minimo: 800, saldo: 2200 },

  { categoria: 'insumo', nome: 'Filme DTF 60 cm', unidade: 'm', minimo: 100, saldo: 140 },
  { categoria: 'insumo', nome: 'Pó DTF hot melt', unidade: 'kg', minimo: 2, saldo: 4.5 },
  { categoria: 'insumo', nome: 'Tinta DTF branca', unidade: 'L', minimo: 1, saldo: 1.2 },
  { categoria: 'insumo', nome: 'Papel sublimático 100 g', unidade: 'm', minimo: 200, saldo: 380 },
  { categoria: 'insumo', nome: 'Tinta sublimática magenta', unidade: 'L', minimo: 1, saldo: 0.6 },
  { categoria: 'insumo', nome: 'Tinta sublimática ciano', unidade: 'L', minimo: 1, saldo: 2.4 },
  { categoria: 'insumo', nome: 'Tela de silk 120 fios', unidade: 'un', minimo: 8, saldo: 18 },
  { categoria: 'insumo', nome: 'Tinta silk plastisol branca', unidade: 'kg', minimo: 2, saldo: 3.2 },
  { categoria: 'insumo', nome: 'Saco de embalagem 30x40', unidade: 'un', minimo: 400, saldo: 900 },
]

/* O PostgREST filtra por lista com in.(a,b,c), separado por vírgula. Nome de
   malha tem espaço, ponto e porcentagem ("DRYFIT POLIESTER 100%"), e nome de
   cor tem acento. Cada item vai entre aspas, que é como o PostgREST aceita
   valor com pontuação, e a lista inteira passa por encodeURIComponent, senão o
   % do nome vira escape de URL e o servidor recebe outra coisa. */
function listaPara(nomes: string[]): string {
  return '(' + nomes.map((n) => '"' + n.replace(/"/g, '\\"') + '"').join(',') + ')'
}

async function idsDoCatalogo(): Promise<{ malha: Map<string, string>; cor: Map<string, string> }> {
  const malhas = [...new Set(ESTOQUE_DE_EXEMPLO.map((m) => m.malha).filter(Boolean))] as string[]
  const cores = [...new Set(ESTOQUE_DE_EXEMPLO.map((m) => m.cor).filter(Boolean))] as string[]

  const [t, c] = await Promise.all([
    tabela<{ id: string; nome: string }[]>(
      `tecido?select=id,nome&nome=in.${encodeURIComponent(listaPara(malhas))}`,
    ),
    tabela<{ id: string; nome: string }[]>(
      `cor_de_tecido?select=id,nome&nome=in.${encodeURIComponent(listaPara(cores))}`,
    ),
  ])

  return {
    malha: new Map(t.map((x) => [x.nome, x.id])),
    cor: new Map(c.map((x) => [x.nome, x.id])),
  }
}

export async function semearEstoque(): Promise<ResultadoDaSemente> {
  const recados: string[] = []
  const catalogo = await idsDoCatalogo()

  const semCatalogo = ESTOQUE_DE_EXEMPLO.filter(
    (m) => m.malha && !catalogo.malha.get(m.malha),
  ).map((m) => m.malha)
  if (semCatalogo.length) {
    recados.push('Sem ligação no catálogo: ' + [...new Set(semCatalogo)].join(', '))
  }

  const corpo = ESTOQUE_DE_EXEMPLO.map((m) => ({
    categoria: m.categoria,
    nome: m.nome,
    unidade: m.unidade,
    minimo: m.minimo,
    tecido_id: m.malha ? (catalogo.malha.get(m.malha) ?? null) : null,
    cor_id: m.cor ? (catalogo.cor.get(m.cor) ?? null) : null,
    teste: true,
  }))

  let gravados: { id: string; nome: string }[] = []
  try {
    gravados = await tabela<{ id: string; nome: string }[]>('material?select=id,nome', {
      metodo: 'POST',
      devolver: true,
      corpo,
    })
  } catch (e) {
    const recado = e instanceof Error ? e.message : 'cadastro recusado'
    recados.push(recado)
    return { gravados: 0, recusados: corpo.length, recados }
  }

  /* O saldo inicial entra como ENTRADA, uma linha por material. Uma de cada
     vez porque mexer_no_estoque é uma chamada por movimento de propósito: é
     ela que carimba quem e quando, e um atalho em lote aqui seria o primeiro
     saldo do sistema sem dono. */
  const porNome = new Map(ESTOQUE_DE_EXEMPLO.map((m) => [m.nome, m]))
  let movimentos = 0
  let recusados = 0

  for (const g of gravados) {
    const m = porNome.get(g.nome)
    if (!m || m.saldo <= 0) continue
    try {
      await chamar('mexer_no_estoque', {
        p_material: g.id,
        p_quantidade: m.saldo,
        p_motivo: 'entrada',
        p_observacao: 'saldo inicial do ensaio',
        p_pedido: null,
      })
      movimentos++
    } catch (e) {
      recusados++
      const recado = e instanceof Error ? e.message : 'movimento recusado'
      if (!recados.includes(recado)) recados.push(recado)
    }
  }

  recados.push(movimentos + ' entrada(s) de saldo inicial gravadas no razão')
  return { gravados: gravados.length, recusados, recados }
}
