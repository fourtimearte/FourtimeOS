/* ==========================================================================
   O CRUZAMENTO DO CÓDIGO COM O BANCO (17/10/2026, pedido do Henrique: "um
   processo de verificação e cruzamento com outras partes do database, para
   ter certeza que vai funcionar e que o código é eficiente").

   Confere cada conversa do código com o banco (testes/banco-no-codigo.mjs)
   contra o RETRATO do banco (banco/retrato.json, tirado do ensaio pelas
   migrações, com `npm run banco`):

     ERRO        a tabela, a view, a coluna, a função ou o argumento que o
                 código pede e o banco não tem; PATCH ou DELETE sem filtro.
                 Reprova: no ar, isso é um 400 na cara de quem está usando.
     EFICIÊNCIA  select=* (traz o que não precisa), ida ao banco dentro de um
                 laço (uma viagem por volta), a lista de cotações pedindo o
                 corpo (as imagens), leitura sem limite de tabela que cresce.
                 Não reprova sozinho: o que é de propósito vai em DE_PROPOSITO,
                 com o motivo. Achado novo fora da lista reprova.
     SOBRA       tabela, view ou função que nem o código nem o próprio banco
                 usam. Só avisa: pode ser coisa do Supabase ou de uma tela que
                 ainda vem.

   Também reprova quando o retrato está velho: uma migração nova sem o
   `npm run banco` depois.

   Uso:  node testes/cruzamento.mjs          (faz parte do npm run conferir)
         node testes/cruzamento.mjs --tudo   (lista também cada SOBRA)
   ========================================================================== */
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { lerSelect, usosDoBanco } from './banco-no-codigo.mjs'

const RAIZ = new URL('..', import.meta.url).pathname
const TUDO = process.argv.includes('--tudo')
const B = '\u0000'

/* O QUE É DE PROPÓSITO. Cada linha: o arquivo, o que o achado diz (um pedaço
   do texto) e o porquê. Achado de eficiência que não está aqui reprova. */
const DE_PROPOSITO = [
  ['src/dominio/semente/', 'laço', 'A semente é a carga do lançamento, rodada uma vez por um admin: vai de lote em lote de propósito, para o erro de um lote não derrubar os outros.'],
  ['src/dominio/produto/index.ts', 'laço', 'lerTudo pagina de mil em mil: o PostgREST devolve no máximo mil linhas, e a soma das vendas precisa de todas.'],
  ['supabase/functions/loja/index.ts', 'laço', 'O porteiro da loja grava os produtos de cada parceiro, um parceiro por vez, porque a função do banco recebe um parceiro só.'],
  ['src/dominio/parceiro/index.ts', 'laço', 'Salvar a página do parceiro grava o acordo e a exibição de cada parceiro marcado: poucos, e cada um com a sua trava no banco.'],
  ['src/dominio/semente/', 'inteira', 'A semente confere o que já existe antes de carregar: precisa da lista inteira, uma vez, no lançamento.'],
  ['src/dominio/boleto/index.ts', 'conferencia_de_boleto select=*', 'A conferência de boleto é lida inteira de propósito (a tela mostra cada campo do histórico), sempre com limite (60 ou 200).'],
  ['src/dominio/produto/index.ts', 'peca_pronta inteira', 'CONHECIDO (auditoria de 17/10/2026): o depósito lê todos os lotes, inclusive os já baixados, e a tela filtra os vivos. Pequeno hoje; quando passar de algumas centenas de lotes, filtrar no banco.'],
  ['src/dominio/cliente/repositorio.ts', 'laço', 'A importação de clientes grava em lotes de cem, e para no primeiro lote que o banco recusar, dizendo qual.'],
]

export function hashDasMigracoes() {
  const h = createHash('sha256')
  const pasta = join(RAIZ, 'banco')
  for (const f of readdirSync(pasta).filter((n) => /^\d{3}-.*\.sql$/.test(n)).sort()) {
    h.update(f)
    h.update(readFileSync(join(pasta, f)))
  }
  return h.digest('hex')
}

function deProposito(arquivo, texto) {
  return DE_PROPOSITO.find(([a, t]) => arquivo.startsWith(a) && texto.includes(t))
}

export function cruzar(retrato, usos) {
  const achados = []
  const R = retrato.relacoes
  const F = retrato.funcoes
  const achar = (nivel, u, texto) => achados.push({ nivel, arquivo: u.arquivo, linha: u.linha, texto })
  const usadas = new Set()
  const funcoesUsadas = new Set()

  function conferirSelect(tabela, itens, u) {
    for (const it of itens) {
      const n = it.nome
      if (!n || n === '*' || n.includes(B)) continue
      if (it.filhos) {
        /* recurso embutido: outra tabela (pelo nome ou pela coluna da chave) */
        let alvo = R[n] ? n : null
        if (!alvo && R[tabela]?.colunas.includes(n)) alvo = R[tabela].chaves[n] ?? null
        if (!alvo && it.dica && R[it.dica]) alvo = it.dica
        if (!alvo) {
          achar('ERRO', u, `${tabela}: o recurso embutido "${n}" não existe no banco`)
          continue
        }
        usadas.add(alvo)
        conferirSelect(alvo, it.filhos, u)
      } else if (!R[tabela].colunas.includes(n)) {
        achar('ERRO', u, `${tabela}.${n} não existe (no select)`)
      }
    }
  }

  for (const u of usos) {
    const c = u.caminho
    if (c == null) {
      achar('AVISO', u, 'conversa com o banco que o cruzamento não consegue ler (caminho montado na hora)')
      continue
    }
    const [alvo, busca = ''] = c.split('?')
    if (u.tipo === 'rpc') {
      const nome = alvo.slice(4)
      if (nome.includes(B)) continue
      funcoesUsadas.add(nome)
      const versoes = F[nome]
      if (!versoes) {
        achar('ERRO', u, `a função ${nome} não existe no banco`)
        continue
      }
      if (u.corpo && !u.corpo.aberto) {
        const ks = u.corpo.chaves
        /* o PostgREST casa a função pelo NOME dos argumentos: todos os que o
           código manda têm de existir, e os que faltam precisam de padrão */
        const serve = versoes.some((v) => ks.every((k) => v.args.includes(k)) && v.args.filter((a) => !ks.includes(a)).every((a) => v.padrao.includes(a)))
        if (!serve)
          achar('ERRO', u, `${nome}: o código manda {${ks.join(', ')}} e o banco espera ${versoes.map((v) => '(' + v.args.join(', ') + ')').join(' ou ')}`)
      }
      if (u.laco && !deProposito(u.arquivo, 'laço')) achar('EFICIÊNCIA', u, `${nome}: chamada dentro de um laço (uma viagem por volta)`)
      continue
    }
    if (alvo.includes(B)) continue
    if (!R[alvo]) {
      achar('ERRO', u, `a tabela ou view "${alvo}" não existe no banco`)
      continue
    }
    usadas.add(alvo)
    const cols = R[alvo].colunas
    let temLimite = false
    let temFiltro = false
    for (const par of busca.split('&')) {
      if (!par) continue
      const i = par.indexOf('=')
      const k = i < 0 ? par : par.slice(0, i)
      const v = i < 0 ? '' : par.slice(i + 1)
      if (k.includes(B)) continue
      if (k === 'select') {
        if (v.replaceAll(B, '') === '') continue
        conferirSelect(alvo, lerSelect(v), u)
        /* a view feita para a tela já é o recorte; select=* numa TABELA traz o que ela tiver amanhã */
        if (v.trim() === '*' && R[alvo].tipo === 'tabela' && !deProposito(u.arquivo, alvo + ' select=*')) achar('EFICIÊNCIA', u, `${alvo}: select=* numa tabela traz todas as colunas, as de hoje e as que vierem`)
        if (alvo === 'cotacao' && /(^|,)\s*(corpo|\*)\s*(,|$)/.test(v) && /limit=|order=/.test(busca) && !/id=eq\./.test(busca))
          achar('ERRO', u, 'a lista de cotações pede o corpo (as imagens): use a view cotacao_na_lista (regra do banco/LEIA.md)')
      } else if (k === 'order') {
        for (const o of v.split(',')) {
          const cn = o.split('.')[0]
          if (cn && !cn.includes(B) && !cols.includes(cn)) achar('ERRO', u, `${alvo}.${cn} não existe (no order)`)
        }
      } else if (k === 'on_conflict') {
        for (const cn of v.split(',')) if (cn && !cols.includes(cn)) achar('ERRO', u, `${alvo}.${cn} não existe (no on_conflict)`)
      } else if (k === 'limit') temLimite = true
      else if (['offset', 'columns'].includes(k)) continue
      else if (k === 'or' || k === 'and' || k === 'not.or' || k === 'not.and') {
        temFiltro = true
        for (const m of v.matchAll(/([a-z_][a-z0-9_]*)\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|fts|not)\b/g))
          if (!cols.includes(m[1]) && !['and', 'or', 'not'].includes(m[1])) achar('ERRO', u, `${alvo}.${m[1]} não existe (no filtro ${k})`)
      } else {
        temFiltro = true
        const cn = k.split('->')[0]
        if (!cols.includes(cn)) achar('ERRO', u, `${alvo}.${cn} não existe (no filtro)`)
      }
    }
    if (u.corpo && !u.corpo.aberto && (u.metodo === 'POST' || u.metodo === 'PATCH'))
      for (const k of u.corpo.chaves) {
        if (!cols.includes(k)) achar('ERRO', u, `${alvo}.${k} não existe (gravando)`)
        else if ((R[alvo].geradas ?? []).includes(k)) achar('ERRO', u, `${alvo}.${k} é gerada pelo banco: gravar nela devolve erro`)
      }
    if ((u.metodo === 'PATCH' || u.metodo === 'DELETE') && !temFiltro) achar('ERRO', u, `${u.metodo} em ${alvo} sem filtro: mexeria em todas as linhas`)
    if (u.laco && !deProposito(u.arquivo, 'laço')) achar('EFICIÊNCIA', u, `${alvo}: ida ao banco dentro de um laço (uma viagem por volta)`)
    if (u.metodo === 'GET' && !temLimite && !temFiltro && !busca.includes(B) && R[alvo].cresce && !deProposito(u.arquivo, alvo + ' inteira')) achar('EFICIÊNCIA', u, `${alvo}: lê a tabela inteira, sem filtro nem limite, e ela cresce com o uso`)
  }

  /* SOBRA: o que ninguém usa */
  const internas = new Set(retrato.usadas_no_banco)
  const sobraR = Object.keys(R).filter((n) => !usadas.has(n) && !internas.has(n))
  const sobraF = Object.keys(F).filter((n) => !funcoesUsadas.has(n) && !internas.has(n) && !F[n].every((v) => v.retorna === 'trigger'))
  return { achados, sobraR, sobraF }
}

/* A PROVA DA PRÓPRIA CONFERÊNCIA: conferência que nunca acusou nada não está
   provada. Cada caso quebrado de propósito tem de acusar, e o certo tem de
   ficar calado (a regra dos dois sentidos, skill fourtime-conferir-visual). */
function provar(retrato) {
  const u = (caminho, extra = {}) => ({ arquivo: 'prova', linha: 1, tipo: caminho.startsWith('rpc/') ? 'rpc' : 'rest', caminho, metodo: 'GET', corpo: null, laco: false, ...extra })
  const casos = [
    [u('cliente?select=id,nome&id=eq.1'), null],
    [u('cliente?select=id,nome_que_nao_existe'), 'não existe (no select)'],
    [u('tabela_que_nao_existe?select=id'), 'não existe no banco'],
    [u('cliente?select=id&coluna_falsa=eq.1'), 'não existe (no filtro)'],
    [u('cliente?select=id&order=coluna_falsa.desc'), 'não existe (no order)'],
    [u('cliente?id=eq.1', { metodo: 'PATCH', corpo: { chaves: ['nome', 'coluna_falsa'], aberto: false } }), 'não existe (gravando)'],
    [u('cliente', { metodo: 'DELETE' }), 'sem filtro'],
    [u('rpc/funcao_que_nao_existe', { metodo: 'POST', corpo: { chaves: [], aberto: false } }), 'não existe no banco'],
    [u('rpc/salvar_kit', { metodo: 'POST', corpo: { chaves: ['p_kit', 'p_ficha'], aberto: false } }), null],
    [u('rpc/salvar_kit', { metodo: 'POST', corpo: { chaves: ['p_kit', 'p_errado'], aberto: false } }), 'o código manda'],
    [u('cliente?select=id,vendedor_id(nome_falso)'), 'não existe (no select)'],
    [u('cotacao?select=id,corpo&order=criada_em.desc&limit=50'), 'use a view cotacao_na_lista'],
    [u('cotacao?id=eq.1', { metodo: 'PATCH', corpo: { chaves: ['corpo', 'marcas'], aberto: false } }), 'é gerada pelo banco'],
  ]
  let falhas = 0
  for (const [uso, espera] of casos) {
    const { achados } = cruzar(retrato, [uso])
    const erros = achados.filter((a) => a.nivel === 'ERRO')
    const ok = espera ? erros.some((a) => a.texto.includes(espera)) : erros.length === 0
    if (!ok) {
      falhas++
      console.log(`RUIM  a prova do cruzamento: "${uso.caminho}" devia ${espera ? 'acusar "' + espera + '"' : 'passar calado'} e deu: ${erros.map((a) => a.texto).join(' | ') || 'nada'}`)
    }
  }
  return falhas
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const retrato = JSON.parse(readFileSync(join(RAIZ, 'banco/retrato.json'), 'utf8'))
  let ruim = provar(retrato)
  if (retrato.migracoes !== hashDasMigracoes()) {
    console.log('RUIM  o retrato do banco está velho: uma migração mudou ou entrou depois dele. Rode npm run banco.')
    ruim++
  }
  const usos = usosDoBanco()
  const { achados, sobraR, sobraF } = cruzar(retrato, usos)
  const grupos = { ERRO: [], 'EFICIÊNCIA': [], AVISO: [] }
  for (const a of achados) (grupos[a.nivel] ??= []).push(a)
  for (const [nivel, lista] of Object.entries(grupos)) {
    if (!lista.length) continue
    console.log(`\n${nivel} (${lista.length})`)
    for (const a of lista) console.log(`  ${a.arquivo}:${a.linha}  ${a.texto}`)
  }
  ruim += grupos.ERRO.length + grupos['EFICIÊNCIA'].length
  console.log(`\nSOBRA: ${sobraR.length} tabelas ou views e ${sobraF.length} funções que nem o código nem o banco usam` + (TUDO ? '' : ' (--tudo lista)'))
  if (TUDO) {
    console.log('  ' + sobraR.join(', '))
    console.log('  ' + sobraF.join(', '))
  }
  console.log(`\ncruzamento: ${usos.length} conversas com o banco lidas, ${Object.keys(retrato.relacoes).length} tabelas e views, ${Object.keys(retrato.funcoes).length} funções no retrato`)
  if (ruim) {
    console.log(`cruzamento: ${ruim} ${ruim === 1 ? 'problema' : 'problemas'}`)
    process.exit(1)
  }
  console.log('cruzamento ok: o código só pede ao banco o que o banco tem')
}
