/* ==========================================================================
   O DICIONÁRIO DO BANCO (17/10/2026). Escreve, a partir do retrato do
   ensaio (as migrações), um capítulo em Markdown com TUDO o que o banco tem:
   cada tabela por área, com as colunas, as chaves, os índices, os gatilhos
   na ordem em que disparam, as regras de acesso e quem no código lê ou
   grava; cada view; cada função com quem pode chamar.

   É gerado, e não escrito à mão, para não envelhecer: mudou o banco, roda de
   novo. Vai para o projeto como "BANCO 10 DICIONÁRIO DE DADOS".

   Uso:  node testes/dicionario-do-banco.mjs saida.md      (ensaio de pé)
   ========================================================================== */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { usosDoBanco } from './banco-no-codigo.mjs'

const RAIZ = new URL('..', import.meta.url).pathname
const saida = process.argv[2]
if (!saida) {
  console.log('uso: node testes/dicionario-do-banco.mjs saida.md')
  process.exit(1)
}
const r = JSON.parse(execFileSync('psql', ['-h', '/tmp', '-p', process.env.PGPORTA ?? '5439', '-U', 'postgres', '-d', 'ft', '-At', '-v', 'ON_ERROR_STOP=1', '-f', join(RAIZ, 'banco/ferramentas/catalogo.sql')], { encoding: 'utf8', maxBuffer: 1 << 28 }))
const L = (x) => x ?? []

/* as áreas, na ordem do caminho do pedido */
export const AREAS = [
  ['Acesso e equipe', ['pessoa', 'convite', 'painel', 'papel_do_sistema', 'permissao', 'acao', 'permissao_da_acao', 'equipe', 'meu_perfil']],
  ['Comercial: funil e lead', ['lead', 'mensagem', 'mensagem_rapida', 'rodizio', 'transferencia_de_lead', 'regra_do_lead_do_site', 'envio_do_site', 'conversa_na_lista']],
  ['Comercial: clientes', ['cliente', 'documento_do_cliente', 'endereco_do_cliente', 'contato_do_cliente', 'juntada_de_cliente', 'cliente_na_lista', 'extras_do_cliente', 'frete_do_cliente']],
  ['Comercial: cotação e preço', ['cotacao', 'contador', 'tabela_de_preco', 'informe_da_casa', 'preset_de_impressao', 'lista_do_cabecalho', 'cotacao_na_lista', 'cotacao_sem_vendedor', 'venda_por_mes', 'venda_por_pedido']],
  ['Comercial: loja e parceiros', ['parceiro', 'acordo_do_parceiro', 'produto_do_parceiro', 'venda_da_loja', 'aviso_da_loja', 'parceiro_na_lista', 'venda_do_parceiro']],
  ['Produção: pedido, PCP e kanban', ['pedido', 'layout_do_pedido', 'passo_do_pcp', 'fatia', 'evento_da_fatia', 'rota_da_tecnica', 'tag', 'tag_da_fatia', 'tag_do_posto', 'familia_do_posto', 'conversa_do_pedido', 'aviso_do_sino', 'regulagem', 'pedido_na_fabrica', 'pedido_no_pcp', 'pedido_liberado', 'passo_do_pcp_na_lista', 'fatia_na_fabrica', 'layout_na_fabrica', 'linha_do_tempo_da_fatia', 'aviso_na_lista', 'dado_de_teste']],
  ['Materiais: estoque, separação e compra', ['material', 'movimento_de_estoque', 'reserva', 'consumo_do_layout', 'negociado', 'consumo_da_referencia', 'fornecedor', 'tipo_de_fornecedor', 'fornecedor_tipo', 'material_fornecedor', 'conferencia_de_boleto', 'deposito', 'movel_do_deposito', 'lugar_do_material', 'material_na_prateleira', 'movimento_do_estoque', 'reserva_do_pedido', 'reserva_em_aberto', 'pedido_na_separacao', 'material_da_fila', 'pedido_separado', 'negociado_na_lista', 'fornecedor_na_lista', 'lugar_do_material_na_lista']],
  ['Materiais: ficha técnica e catálogo', ['referencia', 'grupo_de_referencia', 'tecido', 'grupo_de_tecido', 'cor_de_tecido', 'grupo_de_cor', 'cor_de_impressao', 'material_da_referencia', 'medida_da_referencia', 'molde_da_referencia', 'parte_da_referencia', 'item_de_detalhe', 'simbolo_de_cuidado', 'peca_do_kit', 'peca_pronta', 'movimento_de_peca', 'referencia_na_ficha', 'referencia_com_problema', 'kit_na_ficha', 'peca_do_kit_na_lista', 'item_de_detalhe_na_lista']],
  ['Gestão: transporte e frete', ['transportador', 'lancamento_de_transporte', 'pedido_do_lancamento', 'frete_do_pedido', 'transportador_na_lista', 'lancamento_de_transporte_na_lista', 'lancamento_na_lixeira', 'corrida_de_transporte', 'frete_na_lista']],
  ['Sistema', ['empresa', 'erro_da_extensao']],
]

/* quem usa: o código (arquivo) */
const usos = usosDoBanco()
const noCodigo = {}
const funcNoCodigo = {}
for (const u of usos) {
  if (!u.caminho) continue
  const alvo = u.caminho.split('?')[0]
  if (alvo.startsWith('rpc/')) (funcNoCodigo[alvo.slice(4)] ??= new Set()).add(u.arquivo)
  else (noCodigo[alvo] ??= new Set()).add(u.arquivo)
  /* o que vem embutido no select também conta */
  const sel = /select=([^&]*)/.exec(u.caminho)?.[1] ?? ''
  for (const m of sel.matchAll(/([a-z_]+)(?:![a-z_]+)?\(/g)) (noCodigo[m[1]] ??= new Set()).add(u.arquivo)
}

/* a migração que criou cada objeto e as que mexeram depois */
const historia = {}
for (const f of readdirSync(join(RAIZ, 'banco')).filter((n) => /^\d{3}-.*\.sql$/.test(n)).sort()) {
  const s = readFileSync(join(RAIZ, 'banco', f), 'utf8').replace(/--.*$/gm, '')
  const n = f.slice(0, 3)
  for (const m of s.matchAll(/(?:create|alter)\s+(?:or\s+replace\s+)?(?:table|view|function)\s+(?:if\s+(?:not\s+)?exists\s+)?public\.([a-z_]+)/gi))
    (historia[m[1]] ??= new Set()).add(n)
}
const hist = (nome) => [...(historia[nome] ?? [])].sort().join(', ')

const esc = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
const curto = (t, n = 160) => {
  const s = esc(t)
  return s.length > n ? s.slice(0, n - 3) + '...' : s
}
const CMD = { r: 'ler', a: 'criar', w: 'mudar', d: 'apagar', '*': 'tudo' }
const APAGAR = { a: 'nada (recusa)', r: 'recusa', c: 'apaga junto', n: 'fica nulo', d: 'volta ao padrão' }

const porNome = Object.fromEntries(r.tabelas.map((t) => [t.nome, t]))
const vistos = new Set()
const md = []
md.push('# BANCO 10 DICIONÁRIO DE DADOS')
md.push('')
md.push(`Gerado em ${new Date().toISOString().slice(0, 10)} por \`node testes/dicionario-do-banco.mjs\`, a partir do banco montado pelas migrações (o ensaio). Não editar à mão: rodar de novo depois de cada migração.`)
md.push('')
md.push(`Conteúdo: ${r.tabelas.filter((t) => t.tipo === 'r').length} tabelas, ${r.tabelas.filter((t) => t.tipo === 'v').length} views e ${r.funcoes.length} funções no schema public; ${L(r.enums).length} enums; ${L(r.storage_baldes).length} baldes no Storage.`)
md.push('')
md.push('Como ler: **Origem** é a migração que criou o objeto e as que mexeram nele depois. **No código** é cada arquivo do aplicativo, da extensão ou das Edge Functions que lê ou grava ali (achado pelo cruzamento). Os gatilhos aparecem na ordem em que o Postgres dispara: primeiro os BEFORE, depois os AFTER, e dentro de cada grupo em ordem ALFABÉTICA do nome. Mudar o nome de um gatilho muda a ordem.')
md.push('')

function tabela(t) {
  vistos.add(t.nome)
  const out = []
  if (t.tipo === 'v') {
    const inv = L(t.opcoes).some((o) => /security_invoker=(true|on)/.test(o))
    out.push(`### view ${t.nome}`)
    out.push('')
    out.push(`- **Origem:** ${hist(t.nome) || '?'}${inv ? '' : ' · **roda como dona** (passa por cima da RLS)'}`)
    if (t.comentario) out.push(`- **O que é:** ${esc(t.comentario)}`)
    out.push(`- **Colunas:** ${L(t.colunas).map((c) => c.nome).join(', ')}`)
    const de = [...new Set((t.definicao ?? '').match(/\b(?:FROM|JOIN)\s+([a-z_]+)/g)?.map((x) => x.split(/\s+/)[1]) ?? [])]
    if (de.length) out.push(`- **Lê de:** ${de.join(', ')}`)
    out.push(`- **No código:** ${noCodigo[t.nome] ? [...noCodigo[t.nome]].sort().join(', ') : 'nenhum arquivo (só o banco usa, ou sobrou)'}`)
    out.push('')
    return out
  }
  out.push(`### ${t.nome}`)
  out.push('')
  out.push(`- **Origem:** ${hist(t.nome) || '?'}`)
  if (t.comentario) out.push(`- **O que é:** ${esc(t.comentario)}`)
  out.push(`- **RLS:** ${t.rls ? 'ligada' : '**desligada**'}`)
  out.push(`- **No código:** ${noCodigo[t.nome] ? [...noCodigo[t.nome]].sort().join(', ') : 'nenhum arquivo (só pelas funções do banco)'}`)
  out.push('')
  out.push('| Coluna | Tipo | Nulo | Padrão | Nota |')
  out.push('|---|---|---|---|---|')
  for (const c of L(t.colunas)) out.push(`| ${c.nome} | ${esc(c.tipo)} | ${c.nulo ? 'sim' : 'não'} | ${curto(c.padrao, 60)} | ${c.gerada ? 'gerada: ' : ''}${curto(c.comentario, 200)} |`)
  out.push('')
  const rest = L(t.restricoes)
  const pk = rest.find((k) => k.tipo === 'p')
  if (pk) out.push(`- **Chave primária:** ${L(pk.colunas).join(', ')}`)
  for (const k of rest.filter((k) => k.tipo === 'f')) out.push(`- **Aponta para** ${k.alvo.replace('public.', '')} por (${L(k.colunas).join(', ')}); apagar lá: ${APAGAR[k.ao_apagar] ?? k.ao_apagar}`)
  for (const k of rest.filter((k) => k.tipo === 'u')) out.push(`- **Único:** (${L(k.colunas).join(', ')})`)
  for (const k of rest.filter((k) => k.tipo === 'c')) out.push(`- **Confere:** \`${curto(k.def, 220)}\``)
  const idx = L(t.indices).filter((i) => !i.primaria)
  if (idx.length) out.push(`- **Índices:** ${idx.map((i) => `${i.nome}${i.unico ? ' (único)' : ''} \`${curto(i.def.split(' USING ')[1], 120)}\``).join('; ')}`)
  const gat = L(t.gatilhos)
  if (gat.length) {
    const ordem = [...gat].sort((a, b) => (/ BEFORE /.test(a.def) === / BEFORE /.test(b.def) ? a.nome.localeCompare(b.nome) : / BEFORE /.test(a.def) ? -1 : 1))
    out.push('- **Gatilhos (na ordem em que disparam):**')
    for (const g of ordem) {
      const quando = /(BEFORE|AFTER|INSTEAD OF) (.*?) ON /.exec(g.def)
      out.push(`  - ${g.nome}: ${quando ? quando[1].toLowerCase() + ' ' + quando[2].toLowerCase() : ''} → ${g.funcao}()${g.ligado ? '' : ' (desligado)'}`)
    }
  }
  const pol = L(t.politicas)
  if (pol.length) {
    out.push('- **Regras de acesso:**')
    for (const p of pol) out.push(`  - "${p.nome}" (${CMD[p.cmd]}, ${L(p.papeis).join(', ')}): \`${curto(p.usando ?? p.checando, 160)}\``)
  }
  out.push('')
  return out
}

for (const [area, nomes] of AREAS) {
  md.push(`## ${area}`)
  md.push('')
  for (const n of nomes) if (porNome[n]) md.push(...tabela(porNome[n]))
}
const resto = r.tabelas.filter((t) => !vistos.has(t.nome))
if (resto.length) {
  md.push('## Sem área (pôr na lista AREAS de testes/dicionario-do-banco.mjs)')
  md.push('')
  for (const t of resto) md.push(...tabela(t))
}

md.push('## Funções')
md.push('')
md.push('Quem chama: **fora** é quem não entrou (a chave pública do site); **equipe** é quem entrou. As de gatilho não se chamam direto. DEFINER roda com os poderes do dono do banco e precisa conferir quem chamou lá dentro.')
md.push('')
md.push('| Função | Retorna | Tipo | Quem chama | Usada por | Origem | O que faz |')
md.push('|---|---|---|---|---|---|---|')
const internas = new Set()
const textos = [...r.funcoes.map((f) => f.fonte), ...r.tabelas.map((t) => (t.definicao ?? '') + L(t.politicas).map((p) => (p.usando ?? '') + (p.checando ?? '')).join(' ') + L(t.gatilhos).map((g) => g.def).join(' ') + L(t.colunas).map((c) => c.padrao ?? '').join(' ')), ...L(r.storage_politicas).map((p) => (p.usando ?? '') + (p.checando ?? ''))].join('\n')
for (const f of r.funcoes) {
  const re = new RegExp(`\\b${f.nome}\\(`, 'g')
  const vezes = (textos.match(re) ?? []).length
  if (vezes > 1 || (vezes === 1 && !f.fonte.match(re))) internas.add(f.nome)
}
for (const f of r.funcoes) {
  const quem = f.retorna === 'trigger' ? 'gatilho' : [f.exec_anon ? 'fora' : '', f.exec_auth ? 'equipe' : ''].filter(Boolean).join(' e ') || 'só o banco'
  const FORA = { painel_do_parceiro: 'a página do parceiro (loja)', erros_da_extensao_para_o_vigia: 'o vigia agendado', liberar_pedido_real: 'o admin, no SQL Editor, no lançamento', ao_criar_conta: 'gatilho em auth.users' }
  const usada = [funcNoCodigo[f.nome] ? 'código' : '', internas.has(f.nome) ? 'banco' : '', FORA[f.nome] ?? ''].filter(Boolean).join(' e ') || '**ninguém aqui**'
  md.push(`| ${f.nome}(${curto(f.args, 120)}) | ${curto(f.retorna, 50)} | ${f.definer ? 'DEFINER' : 'invoker'}${f.volatil === 'i' ? ', imutável' : f.volatil === 's' ? ', estável' : ''} | ${quem} | ${usada} | ${hist(f.nome)} | ${curto(f.comentario, 220)} |`)
}
md.push('')
md.push('## Enums')
md.push('')
for (const e of L(r.enums)) md.push(`- **${e.nome}:** ${L(e.valores).join(', ')}`)
md.push('')
md.push('## Storage')
md.push('')
for (const b of L(r.storage_baldes)) md.push(`- **${b.id}:** ${b.publico ? 'público (qualquer um com o endereço lê)' : 'privado'}, até ${Math.round((b.limite ?? 0) / 1024)} KB, tipos ${L(b.tipos).join(', ')}`)
for (const p of L(r.storage_politicas)) md.push(`  - "${p.nome}" (${p.cmd}): \`${curto(p.usando ?? p.checando, 160)}\``)
md.push('')
writeFileSync(saida, md.join('\n'))
console.log(`dicionário: ${md.length} linhas em ${saida}`)
