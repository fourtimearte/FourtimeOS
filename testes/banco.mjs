/* ==========================================================================
   A AUDITORIA DO BANCO (17/10/2026). `npm run banco`.

   Sobe o banco inteiro pelas migrações num Postgres de mentira (o ensaio,
   banco/ferramentas/ensaio), tira o RETRATO dele (banco/ferramentas/
   catalogo.sql) e confere o retrato em quatro frentes:

     SEGURANÇA   tabela sem RLS; tabela com RLS e sem regra; regra que vale
                 para quem não entrou; grant para anon; view que passa por
                 cima da RLS; função SECURITY DEFINER sem search_path; função
                 DEFINER que quem não entrou consegue chamar e que não confere
                 quem chamou.
     INTEGRIDADE tabela sem chave primária; chave estrangeira sem índice.
     DESEMPENHO  índice repetido ou coberto por outro; regra de acesso que
                 chama função por linha (meu_papel(), posso(), auth.uid()) sem
                 o (select ...) que faz o Postgres calcular uma vez só; mais de
                 uma regra permissiva para a mesma ação; view que abre o corpo
                 da cotação (as imagens) linha a linha.
     REDUNDÂNCIA função com o mesmo nome em duas assinaturas.

   O que é de propósito mora em EXCECOES, cada um com o motivo. Achado de
   SEGURANÇA ou INTEGRIDADE fora da lista reprova. DESEMPENHO e REDUNDÂNCIA
   avisam, com a conta, para a conta não crescer calada (LIMITES).

   Depois grava o retrato enxuto em banco/retrato.json e roda o cruzamento
   do código (testes/cruzamento.mjs), que faz parte do npm run conferir.

   Uso:
     node testes/banco.mjs                       ensaio do zero + auditoria + cruzamento
     node testes/banco.mjs --sem-ensaio          usa o ensaio que já está de pé
     node testes/banco.mjs --retrato prod.json   audita outro retrato (o da produção)
     node testes/banco.mjs --comparar prod.json  o que a produção tem diferente do repositório
   ========================================================================== */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { cruzar, hashDasMigracoes } from './cruzamento.mjs'
import { usosDoBanco } from './banco-no-codigo.mjs'

const RAIZ = new URL('..', import.meta.url).pathname
const arg = (k) => {
  const i = process.argv.indexOf(k)
  return i < 0 ? null : process.argv[i + 1]
}
const PSQL = ['-h', '/tmp', '-p', process.env.PGPORTA ?? '5439', '-U', 'postgres', '-d', 'ft']

/* ---------------------------------------------------------------------------
   O QUE É DE PROPÓSITO, com o motivo. Chave: "regra:objeto".
   --------------------------------------------------------------------------- */
const EXCECOES = {
  'rls-sem-regra:contador': 'Os contadores de número (cotação, pedido) só andam pelas funções proximo_numero_de_*. Ninguém lê nem escreve direto.',
  'rls-sem-regra:envio_do_site': 'O envio do formulário do site só entra pela função registrar_lead_do_site, chamada pelo porteiro (Edge Function) com a chave de serviço.',
  'view-definer:equipe': 'De propósito (011): o funil escreve o nome do vendedor no cartão, e a tabela pessoa só deixa cada um ler o próprio cadastro. Quatro colunas: id, nome, papel, ativo.',
  'view-definer:frete_na_lista': 'De propósito (080): a logística vê o telefone e o modo de envio do pedido sem ter acesso à cotação. A própria view filtra por posso(transporte, ver).',
  'definer-anon:painel_do_parceiro': 'A página do parceiro é pública: entra com a chave e a senha do parceiro, conferidas dentro da função.',
  'fk-sem-indice:acao(painel)': 'Cadastro pequeno (as ações do sistema, dezenas de linhas): o índice custaria mais do que salva.',
  'fk-sem-indice:convite(papel)': 'Cadastro pequeno (um convite por pessoa da equipe).',
  'fk-sem-indice:cor_de_tecido(grupo)': 'Cadastro pequeno (as cores de tecido).',
  'fk-sem-indice:fornecedor_tipo(tipo)': 'Cadastro pequeno (o tipo de cada fornecedor).',
  'fk-sem-indice:permissao(painel)': 'Cadastro pequeno (a matriz de acessos, papéis x páginas).',
  'fk-sem-indice:permissao_da_acao(acao)': 'Cadastro pequeno (a matriz das ações).',
  'fk-sem-indice:pessoa(papel)': 'Cadastro pequeno (a equipe).',
  'fk-sem-indice:regra_do_lead_do_site(pessoa_id)': 'Cadastro pequeno (quem recebe o lead do site).',
  'fk-sem-indice:tecido(grupo)': 'Cadastro pequeno (os tecidos).',
  'definer-anon:erros_da_extensao_para_o_vigia': 'O vigia (tarefa agendada de 3 em 3 horas) lê com a chave pública. Só devolve versão, lugar e tipo do erro da extensão, sem conversa nem telefone.',
}

/* O PROBLEMA CONHECIDO, que já tem conserto escrito e espera a migração.
   Reprova quando some daqui sem ter sumido do banco, e quando aparece um novo. */
const CONHECIDOS = {}

/* quanto cada aviso de desempenho pode ter, para não crescer calado */
const LIMITES = {
  'fk-de-rastro-sem-indice': 50,
  'politica-por-linha': 200,
  'permissivas-repetidas': 25,
  'indice-repetido': 5,
}

/* a função DEFINER que não confere quem chamou: nenhuma destas palavras */
const TRAVAS = /auth\.uid\(\)|posso\(|posso_a_acao\(|sou_admin\(\)|meu_papel\(\)|auth\.role\(\)/

function lerRetratoDoEnsaio() {
  const sql = join(RAIZ, 'banco/ferramentas/catalogo.sql')
  const saida = execFileSync('psql', [...PSQL, '-At', '-v', 'ON_ERROR_STOP=1', '-f', sql], { encoding: 'utf8', maxBuffer: 1 << 28 })
  return JSON.parse(saida)
}

const L = (x) => x ?? []

export function auditar(r) {
  const achados = []
  const contas = {}
  const achar = (frente, regra, objeto, texto) => achados.push({ frente, regra, objeto, texto, chave: regra + ':' + objeto })
  const tab = r.tabelas.filter((t) => t.tipo === 'r' || t.tipo === 'p')
  const views = r.tabelas.filter((t) => t.tipo === 'v')

  /* --- SEGURANÇA ---------------------------------------------------------- */
  for (const t of tab) {
    if (!t.rls) achar('SEGURANÇA', 'rls-desligada', t.nome, `${t.nome} sem RLS: o grant sozinho decide quem lê e escreve`)
    else if (!L(t.politicas).length) achar('SEGURANÇA', 'rls-sem-regra', t.nome, `${t.nome} com RLS e nenhuma regra: ninguém lê nem escreve direto`)
    for (const p of L(t.politicas)) {
      const papeis = L(p.papeis)
      if (papeis.includes('public') || papeis.includes('anon'))
        achar('SEGURANÇA', 'regra-para-anon', `${t.nome}.${p.nome}`, `a regra "${p.nome}" de ${t.nome} vale também para quem não entrou`)
    }
  }
  for (const t of r.tabelas) {
    const g = L(t.grants).filter((x) => x.papel === 'anon' || x.papel === 'PUBLIC')
    if (g.length) achar('SEGURANÇA', 'grant-anon', t.nome, `${t.nome}: quem não entrou tem ${[...new Set(g.map((x) => x.priv))].join(', ')}`)
  }
  for (const v of views)
    if (!L(v.opcoes).some((o) => /security_invoker=(true|on)/.test(o)))
      achar('SEGURANÇA', 'view-definer', v.nome, `a view ${v.nome} roda como dona: passa por cima da RLS das tabelas de baixo`)
  for (const f of r.funcoes) {
    const ass = `${f.nome}(${f.args})`
    if (f.definer && !L(f.config).some((c) => c.startsWith('search_path')))
      achar('SEGURANÇA', 'definer-sem-search-path', ass, `${ass} é DEFINER sem search_path fixo`)
    if (f.definer && f.retorna !== 'trigger' && f.exec_anon && !TRAVAS.test(f.fonte))
      achar('SEGURANÇA', 'definer-anon', f.nome, `${ass} é DEFINER, quem não entrou consegue chamar e ela não confere quem chamou`)
  }
  contas['definer-com-trava-aberta-a-anon'] = r.funcoes.filter((f) => f.definer && f.retorna !== 'trigger' && f.exec_anon && TRAVAS.test(f.fonte)).length

  /* --- INTEGRIDADE -------------------------------------------------------- */
  for (const t of tab) {
    const rest = L(t.restricoes)
    if (!rest.some((k) => k.tipo === 'p')) achar('INTEGRIDADE', 'sem-chave-primaria', t.nome, `${t.nome} sem chave primária`)
    const idx = L(t.indices).map((i) => L(i.colunas))
    for (const k of rest.filter((k) => k.tipo === 'f')) {
      const c = L(k.colunas)
      if (!idx.some((i) => c.every((x, j) => i[j] === x))) {
        /* a chave que só guarda QUEM fez (criado_por, quem, pago_por) aponta para pessoa,
           que quase nunca se apaga: o índice ali custaria mais do que salva */
        const rastro = /^((public\.)?pessoa|auth\.users)$/.test(k.alvo) && !/_id$/.test(c[0])
        achar('DESEMPENHO', rastro ? 'fk-de-rastro-sem-indice' : 'fk-sem-indice', `${t.nome}(${c.join(',')})`, `${t.nome}(${c.join(', ')}) aponta para ${k.alvo} sem índice${k.ao_apagar === 'c' ? ' (e apaga em cascata)' : ''}: apagar ou juntar lá varre ${t.nome} inteira`)
      }
    }
  }

  /* --- DESEMPENHO --------------------------------------------------------- */
  for (const t of tab) {
    const ii = L(t.indices).map((i) => ({ ...i, cols: L(i.colunas).join(','), exp: /\(.*\(/.test(i.def.split(' USING ')[1] ?? '') }))
    for (const a of ii) {
      if (a.exp || a.parcial || a.unico) continue
      for (const b of ii) {
        if (a === b || b.exp || b.parcial || !a.cols || !b.cols) continue
        const ordemA = a.def.split(' USING ')[1]
        const ordemB = b.def.split(' USING ')[1]
        /* o igual: sobra o que não é único (ou, entre dois comuns, o segundo pelo nome) */
        if (a.cols === b.cols && ordemA === ordemB && (b.unico || a.nome > b.nome)) achar('DESEMPENHO', 'indice-repetido', `${t.nome}.${a.nome}`, `${a.nome} repete ${b.nome} em ${t.nome}`)
        else if (b.cols.startsWith(a.cols + ',') && !/ DESC/.test(ordemA)) achar('DESEMPENHO', 'indice-repetido', `${t.nome}.${a.nome}`, `${a.nome} (${a.cols}) é o começo de ${b.nome} (${b.cols}) em ${t.nome}`)
      }
    }
    for (const p of L(t.politicas))
      for (const e of [p.usando, p.checando]) {
        if (!e) continue
        const solta = e.replace(/\(\s*SELECT\s+[a-z_.]+\([^()]*\)\s*(AS\s+\w+\s*)?\)/gi, '')
        for (const m of solta.matchAll(/\b(auth\.uid|meu_papel|posso|posso_a_acao|sou_admin)\(/g))
          achar('DESEMPENHO', 'politica-por-linha', `${t.nome}.${p.nome}.${m[1]}.${m.index}`, `a regra "${p.nome}" de ${t.nome} chama ${m[1]}() em cada linha`)
      }
    const porAcao = {}
    for (const p of L(t.politicas)) {
      if (!p.permissiva) continue
      const cmds = { r: ['select'], a: ['insert'], w: ['update'], d: ['delete'], '*': ['select', 'insert', 'update', 'delete'] }[p.cmd]
      for (const c of cmds) for (const papel of L(p.papeis)) (porAcao[c + '/' + papel] ??= []).push(p.nome)
    }
    for (const [k, v] of Object.entries(porAcao))
      if (v.length > 1) achar('DESEMPENHO', 'permissivas-repetidas', `${t.nome}.${k}`, `${t.nome}: ${v.length} regras permissivas para ${k} (o Postgres roda todas)`)
  }
  for (const v of views)
    if (/\bc\.corpo\b|\bcorpo\s*->/.test(v.definicao ?? ''))
      achar('DESEMPENHO', 'view-abre-o-corpo', v.nome, `a view ${v.nome} abre cotacao.corpo (com as imagens) em cada linha`)

  /* --- REDUNDÂNCIA -------------------------------------------------------- */
  const porNome = {}
  for (const f of r.funcoes) (porNome[f.nome] ??= []).push(f.args)
  for (const [n, a] of Object.entries(porNome))
    if (a.length > 1) achar('REDUNDÂNCIA', 'funcao-repetida', n, `${n} existe em ${a.length} assinaturas: (${a.join(') e (')})`)

  return { achados, contas }
}

/* --- o retrato enxuto que o cruzamento usa ------------------------------- */
function retratoEnxuto(r) {
  const relacoes = {}
  const nomes = []
  for (const t of r.tabelas) {
    const chaves = {}
    for (const k of L(t.restricoes)) if (k.tipo === 'f' && L(k.colunas).length === 1) chaves[k.colunas[0]] = k.alvo.replace(/^public\./, '')
    relacoes[t.nome] = {
      tipo: t.tipo === 'v' ? 'view' : 'tabela',
      colunas: L(t.colunas).map((c) => c.nome),
      geradas: L(t.colunas).filter((c) => c.gerada).map((c) => c.nome),
      chaves,
      cresce: CRESCEM.has(t.nome),
    }
    nomes.push(t.nome)
  }
  const funcoes = {}
  for (const f of r.funcoes) {
    const ent = L(f.entradas)
    ;(funcoes[f.nome] ??= []).push({ args: ent, padrao: ent.slice(ent.length - (f.com_padrao ?? 0)), retorna: f.retorna, definer: f.definer, anon: f.exec_anon })
    nomes.push(f.nome)
  }
  /* o que o próprio banco usa: o texto das funções, das views, das regras e dos gatilhos */
  const textos = [
    ...r.funcoes.map((f) => f.fonte),
    ...r.tabelas.map((t) => t.definicao ?? ''),
    ...r.tabelas.flatMap((t) => L(t.politicas).flatMap((p) => [p.usando ?? '', p.checando ?? ''])),
    ...r.tabelas.flatMap((t) => L(t.gatilhos).map((g) => g.def)),
    ...r.tabelas.flatMap((t) => L(t.colunas).map((c) => c.padrao ?? '')),
    ...L(r.storage_politicas).flatMap((p) => [p.usando ?? '', p.checando ?? '']),
  ].join('\n')
  const usadas = [...new Set(nomes)].filter((n) => {
    const re = new RegExp(`\\b${n}\\b`, 'g')
    const m = textos.match(re)
    if (!m) return false
    /* a função não conta a si mesma: o create dela tem o nome dela */
    const proprio = r.funcoes.filter((f) => f.nome === n).length
    return m.length > 0 && (proprio === 0 || r.funcoes.some((f) => f.nome !== n && re.test(f.fonte)) || r.tabelas.some((t) => re.test(t.definicao ?? '') || L(t.politicas).some((p) => re.test((p.usando ?? '') + (p.checando ?? ''))) || L(t.gatilhos).some((g) => re.test(g.def)) || L(t.colunas).some((c) => re.test(c.padrao ?? ''))) || L(r.storage_politicas).some((p) => re.test((p.usando ?? '') + (p.checando ?? ''))))
  })
  return { migracoes: hashDasMigracoes(), relacoes, funcoes, usadas_no_banco: usadas.sort() }
}

/* as tabelas que crescem com o uso (as outras são cadastro e configuração) */
const CRESCEM = new Set([
  'lead', 'mensagem', 'cliente', 'cotacao', 'pedido', 'fatia', 'evento_da_fatia', 'tag_da_fatia', 'layout_do_pedido',
  'reserva', 'consumo_do_layout', 'negociado', 'movimento_de_estoque', 'movimento_de_peca', 'peca_pronta',
  'passo_do_pcp', 'aviso_do_sino', 'conversa_do_pedido', 'transferencia_de_lead', 'lancamento_de_transporte',
  'pedido_do_lancamento', 'frete_do_pedido', 'venda_da_loja', 'aviso_da_loja', 'erro_da_extensao', 'envio_do_site',
  'conferencia_de_boleto', 'juntada_de_cliente', 'documento_do_cliente', 'endereco_do_cliente', 'contato_do_cliente',
])

/* --- comparar dois retratos (repositório x produção) --------------------- */
export function comparar(a, b) {
  const dif = []
  const h = (s) => createHash('sha1').update(s ?? '').digest('hex').slice(0, 10)
  const mapa = (r) => Object.fromEntries(r.tabelas.map((t) => [t.nome, t]))
  const A = mapa(a)
  const Bm = mapa(b)
  for (const n of Object.keys(A)) if (!Bm[n]) dif.push(`só no repositório: ${A[n].tipo === 'v' ? 'view' : 'tabela'} ${n}`)
  for (const n of Object.keys(Bm)) if (!A[n]) dif.push(`só na produção: ${Bm[n].tipo === 'v' ? 'view' : 'tabela'} ${n}`)
  for (const n of Object.keys(A)) {
    const x = A[n]
    const y = Bm[n]
    if (!y) continue
    if (x.rls !== y.rls) dif.push(`${n}: RLS ${x.rls ? 'ligada' : 'desligada'} no repositório e ${y.rls ? 'ligada' : 'desligada'} na produção`)
    const cx = Object.fromEntries(L(x.colunas).map((c) => [c.nome, c]))
    const cy = Object.fromEntries(L(y.colunas).map((c) => [c.nome, c]))
    for (const c of Object.keys(cx)) {
      if (!cy[c]) dif.push(`${n}.${c}: só no repositório`)
      else {
        if (cx[c].tipo !== cy[c].tipo) dif.push(`${n}.${c}: tipo ${cx[c].tipo} x ${cy[c].tipo}`)
        if (cx[c].nulo !== cy[c].nulo) dif.push(`${n}.${c}: aceita nulo ${cx[c].nulo} x ${cy[c].nulo}`)
        if ((cx[c].padrao ?? '') !== (cy[c].padrao ?? '')) dif.push(`${n}.${c}: padrão "${cx[c].padrao}" x "${cy[c].padrao}"`)
      }
    }
    for (const c of Object.keys(cy)) if (!cx[c]) dif.push(`${n}.${c}: só na produção`)
    const lista = (t, k, f) => new Set(L(t[k]).map(f))
    for (const [k, f, nome] of [
      ['restricoes', (r) => r.nome + ' ' + r.def, 'restrição'],
      ['indices', (i) => i.def, 'índice'],
      ['gatilhos', (g) => g.def + (g.ligado ? '' : ' (desligado)'), 'gatilho'],
      ['politicas', (p) => `${p.nome} [${p.cmd} ${L(p.papeis).join(',')}] ${p.usando ?? ''} | ${p.checando ?? ''}`, 'regra'],
      ['grants', (g) => g.papel + ' ' + g.priv, 'grant'],
    ]) {
      const sx = lista(x, k, f)
      const sy = lista(y, k, f)
      for (const v of sx) if (!sy.has(v)) dif.push(`${n}: ${nome} só no repositório: ${v.slice(0, 160)}`)
      for (const v of sy) if (!sx.has(v)) dif.push(`${n}: ${nome} só na produção: ${v.slice(0, 160)}`)
    }
    if (x.tipo === 'v' && (x.definicao ?? '') !== (y.definicao ?? '')) dif.push(`${n}: a view tem outro texto na produção`)
    if (JSON.stringify(x.opcoes ?? null) !== JSON.stringify(y.opcoes ?? null)) dif.push(`${n}: opções ${JSON.stringify(x.opcoes)} x ${JSON.stringify(y.opcoes)}`)
  }
  const fx = Object.fromEntries(a.funcoes.map((f) => [`${f.nome}(${f.args})`, f]))
  const fy = Object.fromEntries(b.funcoes.map((f) => [`${f.nome}(${f.args})`, f]))
  for (const k of Object.keys(fx)) if (!fy[k]) dif.push(`função só no repositório: ${k}`)
  for (const k of Object.keys(fy)) if (!fx[k]) dif.push(`função só na produção: ${k}`)
  for (const k of Object.keys(fx)) {
    const x = fx[k]
    const y = fy[k]
    if (!y) continue
    if (h(x.fonte.trim()) !== h(y.fonte.trim())) dif.push(`função ${k}: o texto é outro na produção`)
    if (x.definer !== y.definer) dif.push(`função ${k}: DEFINER ${x.definer} x ${y.definer}`)
    if (JSON.stringify(x.config) !== JSON.stringify(y.config)) dif.push(`função ${k}: config ${JSON.stringify(x.config)} x ${JSON.stringify(y.config)}`)
    for (const p of ['exec_anon', 'exec_auth'])
      if (x[p] !== y[p]) dif.push(`função ${k}: ${p === 'exec_anon' ? 'quem não entrou' : 'quem entrou'} ${x[p] ? 'chama' : 'não chama'} no repositório e ${y[p] ? 'chama' : 'não chama'} na produção`)
  }
  const ex = JSON.stringify(a.enums)
  const ey = JSON.stringify(b.enums)
  if (ex !== ey) dif.push('os enums são diferentes')
  const sx = new Set(L(a.storage_politicas).map((p) => p.nome + ' ' + p.usando + ' ' + p.checando))
  for (const p of L(b.storage_politicas)) if (!sx.has(p.nome + ' ' + p.usando + ' ' + p.checando)) dif.push(`Storage: regra só na produção: ${p.nome}`)
  const sy = new Set(L(b.storage_politicas).map((p) => p.nome + ' ' + p.usando + ' ' + p.checando))
  for (const p of L(a.storage_politicas)) if (!sy.has(p.nome + ' ' + p.usando + ' ' + p.checando)) dif.push(`Storage: regra só no repositório: ${p.nome}`)
  return dif
}

function imprimir({ achados, contas }) {
  let reprova = 0
  const ordem = ['SEGURANÇA', 'INTEGRIDADE', 'DESEMPENHO', 'REDUNDÂNCIA']
  const vistosConhecidos = new Set()
  for (const frente of ordem) {
    const lista = achados.filter((a) => a.frente === frente)
    if (!lista.length) continue
    const porRegra = {}
    for (const a of lista) (porRegra[a.regra] ??= []).push(a)
    console.log(`\n${frente}`)
    for (const [regra, itens] of Object.entries(porRegra)) {
      const novos = itens.filter((a) => !EXCECOES[a.chave] && !CONHECIDOS[a.chave])
      const dePropo = itens.filter((a) => EXCECOES[a.chave])
      const conhecidos = itens.filter((a) => CONHECIDOS[a.chave])
      conhecidos.forEach((a) => vistosConhecidos.add(a.chave))
      const limite = LIMITES[regra]
      if (limite != null) {
        const passou = itens.length > limite
        console.log(`  ${passou ? 'RUIM' : 'ok  '} ${regra}: ${itens.length} (limite ${limite})`)
        if (passou) reprova++
        continue
      }
      for (const a of novos) {
        const grave = frente === 'SEGURANÇA' || frente === 'INTEGRIDADE'
        console.log(`  ${grave ? 'RUIM' : 'aviso'} ${a.texto}`)
        if (grave) reprova++
      }
      for (const a of conhecidos) console.log(`  conhecido ${a.texto}  (${CONHECIDOS[a.chave]})`)
      for (const a of dePropo) console.log(`  de propósito ${a.objeto}`)
    }
  }
  for (const k of Object.keys(CONHECIDOS))
    if (!vistosConhecidos.has(k)) {
      console.log(`  RUIM o problema conhecido ${k} sumiu do banco: tire ele de CONHECIDOS`)
      reprova++
    }
  for (const k of Object.keys(EXCECOES))
    if (!achados.some((a) => a.chave === k)) console.log(`  aviso a exceção ${k} não acontece mais: dá para tirar de EXCECOES`)
  console.log(`\n  funções DEFINER com trava que quem não entrou ainda consegue chamar (a trava recusa, mas a porta podia nem abrir): ${contas['definer-com-trava-aberta-a-anon']}`)
  return reprova
}

/* a prova da auditoria: um banco de mentira com um defeito de cada tipo */
function provar() {
  const t = (nome, extra = {}) => ({ nome, tipo: 'r', rls: true, colunas: [{ nome: 'id' }], restricoes: [{ nome: nome + '_pkey', tipo: 'p', colunas: ['id'] }], indices: [{ nome: nome + '_pkey', def: 'CREATE UNIQUE INDEX x USING btree (id)', colunas: ['id'], unico: true }], politicas: [{ nome: 'le', cmd: 'r', permissiva: true, papeis: ['authenticated'], usando: '(SELECT meu_papel())' }], grants: [], ...extra })
  const r = {
    tabelas: [
      t('certa'),
      t('sem_rls', { rls: false }),
      t('sem_chave', { restricoes: [], indices: [] }),
      t('com_fk', { colunas: [{ nome: 'id' }, { nome: 'certa_id' }], restricoes: [{ nome: 'p', tipo: 'p', colunas: ['id'] }, { nome: 'f', tipo: 'f', colunas: ['certa_id'], alvo: 'certa', ao_apagar: 'c' }] }),
      t('regra_solta', { politicas: [{ nome: 'por linha', cmd: 'r', permissiva: true, papeis: ['authenticated'], usando: 'meu_papel() IS NOT NULL' }] }),
      t('aberta', { grants: [{ papel: 'anon', priv: 'SELECT' }] }),
      { nome: 'vista', tipo: 'v', opcoes: null, colunas: [], definicao: 'select 1' },
    ],
    funcoes: [
      { nome: 'sem_trava', args: '', definer: true, config: ['search_path=public'], retorna: 'integer', exec_anon: true, fonte: 'update x set y = 1' },
      { nome: 'com_trava', args: '', definer: true, config: ['search_path=public'], retorna: 'integer', exec_anon: true, fonte: 'if not posso(1) then raise' },
      { nome: 'sem_caminho', args: '', definer: true, config: null, retorna: 'integer', exec_anon: false, fonte: 'select 1' },
    ],
  }
  const { achados } = auditar(r)
  const tem = (chave) => achados.some((a) => a.chave === chave)
  const esperado = ['rls-desligada:sem_rls', 'sem-chave-primaria:sem_chave', 'fk-sem-indice:com_fk(certa_id)', 'grant-anon:aberta', 'view-definer:vista', 'definer-anon:sem_trava', 'definer-sem-search-path:sem_caminho()']
  const calado = ['rls-desligada:certa', 'definer-anon:com_trava']
  let falhas = 0
  for (const k of esperado) if (!tem(k)) (falhas++, console.log(`RUIM  a prova da auditoria não acusou ${k}`))
  for (const k of calado) if (tem(k)) (falhas++, console.log(`RUIM  a prova da auditoria acusou ${k}, que está certo`))
  if (!achados.some((a) => a.regra === 'politica-por-linha' && a.objeto.startsWith('regra_solta'))) (falhas++, console.log('RUIM  a prova da auditoria não acusou a regra que chama função por linha'))
  if (achados.some((a) => a.regra === 'politica-por-linha' && a.objeto.startsWith('certa'))) (falhas++, console.log('RUIM  a prova da auditoria acusou o (SELECT meu_papel()), que está certo'))
  return falhas
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (provar()) process.exit(1)
  const outro = arg('--retrato')
  const comparando = arg('--comparar')
  let retrato
  if (outro) retrato = JSON.parse(readFileSync(outro, 'utf8'))
  else {
    if (!process.argv.includes('--sem-ensaio')) {
      process.stdout.write('ensaio: subindo o banco pelas migrações... ')
      const s = execFileSync('bash', [join(RAIZ, 'banco/ferramentas/ensaio/rodar.sh')], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] })
      if (/FALHOU|ERROR/.test(s)) {
        console.log('FALHOU\n' + s.split('\n').filter((l) => /FALHOU|ERROR/.test(l)).join('\n'))
        process.exit(1)
      }
      console.log('ok')
    }
    retrato = lerRetratoDoEnsaio()
  }
  if (comparando) {
    const dif = comparar(retrato, JSON.parse(readFileSync(comparando, 'utf8')))
    console.log(dif.length ? dif.join('\n') : 'o banco da produção é o das migrações')
    console.log(`\n${dif.length} ${dif.length === 1 ? 'diferença' : 'diferenças'}`)
    process.exit(dif.length ? 1 : 0)
  }
  console.log(`retrato: ${retrato.tabelas.filter((t) => t.tipo === 'r').length} tabelas, ${retrato.tabelas.filter((t) => t.tipo === 'v').length} views, ${retrato.funcoes.length} funções`)
  let reprova = imprimir(auditar(retrato))
  if (!outro) {
    const enxuto = retratoEnxuto(retrato)
    writeFileSync(join(RAIZ, 'banco/retrato.json'), JSON.stringify(enxuto, null, 1) + '\n')
    console.log('\nbanco/retrato.json gravado')
    const { achados } = cruzar(enxuto, usosDoBanco())
    const ruins = achados.filter((a) => a.nivel === 'ERRO' || a.nivel === 'EFICIÊNCIA')
    for (const a of ruins) console.log(`  RUIM ${a.arquivo}:${a.linha} ${a.texto}`)
    reprova += ruins.length
    console.log(`cruzamento do código: ${ruins.length ? ruins.length + ' problemas' : 'ok'}`)
  }
  console.log(reprova ? `\nbanco: ${reprova} ${reprova === 1 ? 'problema' : 'problemas'}` : '\nbanco ok')
  process.exit(reprova ? 1 : 0)
}
