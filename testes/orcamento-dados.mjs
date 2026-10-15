/* ==========================================================================
   O banco de mentira da prova do orçamento (testes/orcamento.mjs).

   Seis cotações abertas na lista, e a CO2026-0131 do Atlético Exemplo inteira,
   com três layouts, um desconto de fidelidade, os informes e um envio: o
   exemplo das pranchas 109 e 75. As artes são desenhos simples em SVG, feitos
   aqui: os mockups de verdade da Fourtime não vão para o repositório, que é
   público (decisão 158).

   O banco guarda o que a página grava (PATCH e DELETE em cotacao), para a
   prova ver a página lendo de volta o que mandou.
   ========================================================================== */
import { perfil as perfilBase } from './materiais-dados.mjs'

export const HOJE_DA_PROVA = '2026-10-10T13:00:00-03:00'

const arte = (cor, alta = false) => {
  const w = 1000, h = alta ? 1178 : 857
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f4f1ec"/><path d="M300 ${h * 0.18}l120-60h160l120 60 120 120-90 70-60-50v${h * 0.55}H330V${h * 0.18 + 70}l-60 50-90-70z" fill="${cor}"/><text x="${w / 2}" y="${h * 0.45}" font-family="Arial" font-size="64" font-weight="700" fill="#fff" text-anchor="middle">EXEMPLO</text></svg>`
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
}

const preco = (v, tamanhos) => Object.fromEntries(tamanhos.map((t) => [t, v]))
const ADULTO = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', 'G4']

const bloco = (n, ref, nome, genero, grade, design, tecido, cor, hex, imagem) => ({
  id: 'B' + n,
  n,
  referencia: ref,
  nomeDaReferencia: nome,
  genero,
  faixa: 'adulto',
  grade,
  tecidos: [{ nome: tecido, cor, hex }],
  design,
  informacoes: false,
  arte: ref + ' ' + nome,
  imagem,
  observacao: n === 1 ? 'Reforço de ombro a ombro.' : '',
  destaques: { regs: [], travado: false },
  versao: 6,
})

export function cotacaoDoAtletico() {
  return {
    numero: 'CO2026-0131',
    versaoDoFormato: 4,
    estado: 'enviada',
    validaAte: '2026-10-20',
    vendedor: 'Dani',
    cliente: { id: '', nome: 'Atlético Exemplo', documento: '12.345.678/0001-90', contato: 'Marcos', telefone: '(62) 99999-0000', email: '', cidade: 'Goiânia', uf: 'GO' },
    produtos: [
      {
        bloco: bloco(1, 'FT-010-000M', 'CAMISETA MASC TRAD', 'masculino', { P: 10, M: 32, G: 30, GG: 14, XG: 3 },
          [{ tag: 'Eti. Fourtime', tecnica: 'etiqueta', cores: [] }, { tag: 'Eti. Silk', tecnica: 'etiqueta', cores: [] }, { tag: 'Subli', tecnica: 'subli', cores: [{ cod: 'S14', hex: '#1d4ed8' }] }],
          'DRYFIT POLIESTER 100%', 'Azul Royal', '#1d4ed8', arte('#c6161b')),
        precoPorTamanho: { ...preco(62, ADULTO), XG: 68 },
        precoBase: 62,
      },
      {
        bloco: bloco(2, 'FT-090-000M', 'CALÇAO MASC SEM BOLSO', 'masculino', { P: 10, M: 32, G: 30, GG: 14, XG: 3 },
          [{ tag: 'Eti. Cliente', tecnica: 'etiqueta', cores: [] }, { tag: 'Eti. DTF', tecnica: 'etiqueta', cores: [] }, { tag: 'Subli', tecnica: 'subli', cores: [] }], 'DRYFIT POLIESTER 100%', 'Preto', '#111111', arte('#4338ca', true)),
        precoPorTamanho: preco(38, ADULTO),
        precoBase: 38,
      },
      {
        bloco: bloco(3, 'FT-010-000M', 'CAMISETA MASC TRAD', 'masculino', { M: 4, G: 4 }, [{ tag: 'DTF', tecnica: 'dtf', cores: [] }],
          'ALGODAO 100%', 'Branco', '#ffffff', arte('#0f766e')),
        precoPorTamanho: preco(74, ADULTO),
        precoBase: 74,
      },
    ],
    ajustes: [{ id: 'AJ1', descricao: 'fidelidade', tipo: 'porcento', valor: -5 }],
    informe: { prazo: '12 dias úteis', pagamento: '50% NA APROVAÇÃO, 50% NA ENTREGA', entrega: 'TRANSPORTADORA', tabelaDePreco: 'Atacado 2026' },
    informes: [
      { id: 'IF1', texto: 'A produção começa depois da aprovação da arte e do pagamento da entrada.', noDocumento: true, grupo: 'producao' },
      { id: 'IF2', texto: 'Cores de tela e de impressão podem ter pequena diferença.', noDocumento: true, grupo: 'producao' },
      { id: 'IF3', texto: 'Pedido mínimo de 10 peças por layout.', noDocumento: false, grupo: 'termos' },
      /* sem grupo, de propósito: o degrau 4 para 5 reconhece o termo da casa pelo texto */
      { id: 'IF4', texto: 'Frete por conta do cliente, salvo combinação em contrário.', noDocumento: true },
    ],
    producao: { pedido: '', dataDeEnvio: '2026-10-20', departamento: 'ESPORTIVO', embalagem: 'CAIXA', marcas: ['URGENTE'], observacao: 'Entregar junto com o pedido do clube.' },
    enviadas: [{ numero: 1, data: '2026-10-02T14:10:00-03:00', total: 9870, pecas: 186, para: 'Marcos', observacao: '' }],
    aprovacao: null,
  }
}

const NOMES = ['Atlético Exemplo', 'Academia Exemplo', 'Auto Peças Exemplo', 'Escola Exemplo', 'Clube Exemplo', 'Pelada dos Amigos', 'Colégio Exemplo', 'Time da Firma Exemplo']

/* muitos: a CO2026-0131 com 14 layouts, para o resumo da folha virar duas
   tabelas (acima de 10 layouts, FOURTIME OS - 14 seção 4) */
/* rica: a CO2026-0131 com o que a folha das páginas de layout precisa
   mostrar: destaques na arte larga (L-01) e na alta (L-02), Silk e Bordado
   sem cor ao lado da Sublimação, e uma grade com infantil no L-03 */
export function bancoDoOrcamento({ papel = 'admin', ensaio = true, abertas = 6, muitos = false, rica = false, semPresets = false, semInformes = false } = {}) {
  /* a lista mistura os estados para a página do orçamento (parte 8): três
     enviadas (uma vence em 2 dias, outra amanhã), uma recusada, um rascunho
     mexido ontem e uma aprovada, que virou o pedido PD004410 */
  const ESTADOS = ['enviada', 'enviada', 'enviada', 'recusada', 'rascunho', 'aprovada']
  const VALE = ['2026-10-20', '2026-10-12', '2026-10-11', '2026-10-05', '2026-10-25', '2026-10-15']
  const lista = NOMES.slice(0, abertas).map((nome, i) => ({
    id: 'c' + (i + 1),
    numero: 'CO2026-0' + (131 - i),
    cliente_id: null,
    cliente_nome: nome,
    cliente_cidade: 'Goiânia',
    cliente_uf: 'GO',
    lead_id: null,
    estado: ESTADOS[i] ?? 'enviada',
    vendedor_nome: 'Dani',
    total: 9034.5 - i * 700,
    pecas: 186 - i * 10,
    valida_ate: VALE[i] ?? '2026-10-20',
    criada_em: new Date(Date.parse('2026-10-01T10:00:00-03:00') - i * 3600000).toISOString(),
    atualizado_em: i === 4 ? '2026-10-09T16:00:00-03:00' : '2026-10-02T14:10:00-03:00',
    pedido_numero: i === 5 ? 'PD004410' : null,
    teste: true,
  }))
  /* os pedidos: o da c6 no PCP, um do Rafa de uma cotação que não está na
     lista, e um de setembro, que não conta no mês */
  const PEDIDOS = [
    { id: 'p1', numero: 'PD004410', cotacao_id: 'c6', estado: 'pcp', aprovado_em: '2026-10-08T11:00:00-03:00', pecas: 136, total: 5534.5, vendedor_nome: 'Dani' },
    { id: 'p2', numero: 'PD004401', cotacao_id: 'cx1', estado: 'producao', aprovado_em: '2026-10-03T09:00:00-03:00', pecas: 84, total: 2880, vendedor_nome: 'Rafa' },
    { id: 'p3', numero: 'PD004390', cotacao_id: 'cx2', estado: 'entregue', aprovado_em: '2026-09-20T09:00:00-03:00', pecas: 40, total: 1900, vendedor_nome: 'Dani' },
    /* o fim do caminho (12/10/2026): um pedido pronto, esperando o envio, de
       setembro (não mexe nas contas do mês nem nas últimas aprovadas) */
    { id: 'p4', numero: 'PD004380', cotacao_id: 'cx3', estado: 'pronto', aprovado_em: '2026-09-15T09:00:00-03:00', pecas: 60, total: 2100, vendedor_nome: 'Dani' },
  ]
  /* a matriz de ações do caminho do pedido, como a 030 nasce */
  const ACOES = [
    ...['pedido.enviar', 'pedido.entregar', 'pedido.voltar', 'pedido.cancelar'].flatMap((acao) => [{ papel: 'admin', acao }, { papel: 'gerente', acao }]),
    { papel: 'vendedor', acao: 'pedido.enviar' },
    { papel: 'vendedor', acao: 'pedido.entregar' },
  ]
  const primeira = () => {
    const c = cotacaoDoAtletico()
    if (rica) {
      const [l1, l2, l3] = c.produtos.map((p) => p.bloco)
      l1.destaques = { travado: true, regs: [
        { x: 0.3, y: 0.12, w: 0.4, h: 0.2, z: 1, dx: 0, dy: 0 },
        { x: 0.38, y: 0.38, w: 0.24, h: 0.3, z: 1.2, dx: 0, dy: 0 },
      ] }
      l1.design.push({ tag: 'Silk', tecnica: 'silk', cores: [] }, { tag: 'Bordado', tecnica: 'bordado', cores: [] })
      l1.design[2].cores.push({ cod: 'S03', hex: '#c6161b' }, { cod: 'S40', hex: '#111111' })
      l2.destaques = { travado: true, regs: [
        { x: 0.3, y: 0.1, w: 0.4, h: 0.15, z: 1, dx: 0, dy: 0 },
        { x: 0.32, y: 0.4, w: 0.36, h: 0.36, z: 1, dx: 0, dy: 0 },
        { x: 0.2, y: 0.05, w: 0.2, h: 0.3, z: 1, dx: 0, dy: 0 },
      ] }
      l2.design.push({ tag: 'DTF', tecnica: 'dtf', cores: [{ cod: '012', hex: '#f5b800' }] })
      l3.genero = 'infantil'
      l3.grade = { M: 4, G: 4, '4A': 6, '6A': 8, '8A': 5, '12A': 2 }
      c.produtos[2].precoPorTamanho = { ...c.produtos[2].precoPorTamanho, '4A': 55, '6A': 55, '8A': 55, '12A': 58 }
      return c
    }
    if (!muitos) return c
    const base = c.produtos
    c.produtos = Array.from({ length: 14 }, (_, i) => {
      const p = structuredClone(base[i % 3])
      p.bloco.id = 'B' + (i + 1)
      p.bloco.n = i + 1
      if (i % 4 === 3) { p.bloco.genero = 'feminino'; p.bloco.nomeDaReferencia = 'CAMISETA BABY LOOK COM UM NOME COMPRIDO DE VERDADE' }
      if (i % 5 === 4) p.bloco.genero = 'infantil'
      return p
    })
    return c
  }
  const corpos = new Map(lista.map((l, i) => [l.id, i === 0 ? primeira() : { ...cotacaoDoAtletico(), numero: l.numero, cliente: { ...cotacaoDoAtletico().cliente, nome: l.cliente_nome } }]))
  const gravados = []
  const clientes = [
    { id: 'k1', nome: 'Atlético Exemplo', fantasia: '', tipo: 'J', documento: '12345678000190', contato: 'Marcos', telefone: '', celular: '62999990000', email: '', endereco: '', complemento: '', bairro: '', cidade: 'Goiânia', uf: 'GO', cep: '', tipo_de_contato: 'Cliente', segmento: '', vendedor: '', pedidos: 3, total: 1000, ultimo_pedido: null, criado_em: '2026-01-01' },
    { id: 'k2', nome: 'Clube Novo Exemplo', fantasia: '', tipo: 'J', documento: '98765432000110', contato: 'Ana', telefone: '', celular: '62988880000', email: 'ana@exemplo.com', endereco: '', complemento: '', bairro: '', cidade: 'Anápolis', uf: 'GO', cep: '', tipo_de_contato: 'Cliente', segmento: '', vendedor: '', pedidos: 0, total: 0, ultimo_pedido: null, criado_em: '2026-01-01' },
  ]

  /* as fichas técnicas das duas referências do exemplo (a construção que o editor mostra) */
  const REFS = [
    { id: 'r010', cod: 'FT-010-000M', nome: 'CAMISETA MASC TRAD', detalhes: { gola: 'Redonda, ribana 1x1 de 2 cm', manga: 'Curta, com bainha de 2 cm', punho: 'Sem punho', barra: 'Bainha de 2 cm', costura: 'Overloque de 4 fios, galoneira na barra' }, observacao: 'Reforço de ombro a ombro.' },
    { id: 'r090', cod: 'FT-090-000M', nome: 'CALÇAO MASC SEM BOLSO', detalhes: { barra: 'Bainha de 2 cm', costura: 'Overloque de 4 fios' }, observacao: '' },
  ]
  const MATERIAIS = [
    { referencia_id: 'r010', material_id: null, nome: 'Ribana 1x1 · Preta', quantidade: 0.05, unidade: 'm' },
    { referencia_id: 'r010', material_id: 'm2', nome: 'Linha poliéster 120', quantidade: 0.02, unidade: 'cone' },
    { referencia_id: 'r010', material_id: 'm3', nome: 'Saco de embalagem 30x40', quantidade: 1, unidade: 'un' },
    { referencia_id: 'r090', material_id: 'm4', nome: 'Elástico de 30 mm', quantidade: 0.8, unidade: 'm' },
  ]

  /* os presets de impressão salvos (migração 059): um de equipe que outra
     pessoa salvou, e o banco grava o que a tela mandar */
  const presets = semPresets ? null : [
    { id: 'pr1', dono: '9', nome: 'Separação', equipe: true, valor: false, campos: ['cliente', 'cnpj', 'pd', 'vendedor', 'contato', 'departamento', 'embalagem', 'envio', 'pecas'], fora: ['cond', 'inf', 'dest', 'fab', 'obs'], abre: '', alterado_em: '2026-10-09T10:00:00Z' },
  ]
  let nPreset = 1

  /* as cores de impressão do banco (Configurações, Banco de dados): 300 do
     DTF e 87 da sublimação, com um hex e um nome que a prova reconhece */
  const hexDe = (n, k) => '#' + [n * 37 + k, n * 91 + 3 * k, n * 53 + 7 * k].map((v) => (v % 256).toString(16).padStart(2, '0')).join('')
  const CORES = [
    ...Array.from({ length: 300 }, (_, i) => ({ codigo: String(i + 1).padStart(3, '0'), tecnica: 'dtf', numero: i + 1, hex: hexDe(i + 1, 11), nome: 'DTF DA PROVA ' + (i + 1) })),
    ...Array.from({ length: 87 }, (_, i) => ({ codigo: 'S' + String(i + 1).padStart(2, '0'), tecnica: 'sublimacao', numero: i + 1, hex: hexDe(i + 1, 29), nome: 'SUB DA PROVA ' + (i + 1) })),
  ]

  /* as referências e os grupos do banco (Configurações, Banco de dados): os
     treze grupos de produção com os nomes de lá, as duas do exemplo, e o
     resto até 122, como no banco de produção em 11/10/2026 */
  const GRUPOS_REF = [['010', 'Camisetas e polos'], ['020', 'Raglan'], ['030', 'Regatas'], ['040', 'Moletom'], ['050', 'Cropped'], ['060', 'Tops'], ['070', 'Calças'], ['080', 'Bermudas'], ['090', 'Calções'], ['100', 'Shorts'], ['110', 'Uniformes e social'], ['120', 'Acessórios'], ['KIT', 'Kits (conjuntos)']].map(([cod, nome], i) => ({ cod, nome, ordem: (i + 1) * 10 }))
  const REFERENCIAS_DO_BANCO = [
    { cod: 'FT-010-000M', nome: 'CAMISETA MASC TRAD', grupo: '010', genero: 'M', ordem: 0 },
    { cod: 'FT-090-000M', nome: 'CALÇAO MASC SEM BOLSO', grupo: '090', genero: 'M', ordem: 0 },
    { cod: 'FT-120-001U', nome: 'BONÉ DA PROVA SÓ NO BANCO', grupo: '120', genero: 'U', ordem: 0 },
    { cod: 'FT-KIT-010-000M-090-000M', nome: 'KIT CAMISETA E CALÇAO', grupo: 'KIT', genero: 'M', ordem: 0 },
    ...Array.from({ length: 118 }, (_, i) => {
      const g = GRUPOS_REF[i % 12].cod
      const gen = ['M', 'F', 'C'][i % 3]
      return { cod: 'FT-' + g + '-' + String(100 + i).padStart(3, '0') + gen, nome: 'REFERÊNCIA DA PROVA ' + (i + 1), grupo: g, genero: gen, ordem: 0 }
    }),
  ]

  /* as listas do cabeçalho (Configurações > Banco de dados): uma desativada
     e uma só do banco, para provar que o editor lê daqui */
  const LISTAS = [
    { tipo: 'pagamento', valor: 'PIX TOTAL', ordem: 1, ativo: true },
    { tipo: 'pagamento', valor: 'PAGAMENTO DA PROVA', ordem: 2, ativo: true },
    { tipo: 'entrega', valor: 'TRANSPORTADORA', ordem: 1, ativo: true },
    { tipo: 'entrega', valor: 'MOTOBOY', ordem: 2, ativo: true },
    { tipo: 'embalagem', valor: 'CAIXA', ordem: 1, ativo: true },
    { tipo: 'embalagem', valor: 'SACOLA DA PROVA', ordem: 2, ativo: true },
    { tipo: 'departamento', valor: 'ESPORTIVO', ordem: 1, ativo: true },
    { tipo: 'departamento', valor: 'DTF', ordem: 2, ativo: true },
  ]
  /* os informes da casa (060): três de produção e três termos, um desmarcado */
  const informesDaCasa = semInformes
    ? null
    : [
        { id: 'ic-p1', grupo: 'producao', texto: 'O prazo começa na aprovação da arte e do pagamento.', nasce_marcado: true, ordem: 1 },
        { id: 'ic-p2', grupo: 'producao', texto: 'Tolerância de 2 cm nas medidas.', nasce_marcado: true, ordem: 2 },
        { id: 'ic-p3', grupo: 'producao', texto: 'Mínimo de 10 peças por modelo.', nasce_marcado: false, ordem: 3 },
        { id: 'ic-t1', grupo: 'termos', texto: 'Válida até a data do cabeçalho.', nasce_marcado: true, ordem: 1 },
        { id: 'ic-t2', grupo: 'termos', texto: 'Pagamento: 50% na aprovação.', nasce_marcado: true, ordem: 2 },
        { id: 'ic-t3', grupo: 'termos', texto: 'Frete por conta do cliente.', nasce_marcado: false, ordem: 3 },
      ]
  /* o estoque de tecido (11/10/2026): o menu do tecido do editor lê as cores
     cadastradas, agrupadas pelo catálogo */
  const GRUPOS_DE_TECIDO = [{ cod: 'DRY', nome: 'Dryfit', ordem: 1 }, { cod: 'ALG', nome: 'Algodão', ordem: 2 }]
  const TECIDOS = [
    { id: 't-dry', nome: 'DRYFIT POLIESTER 100%', grupo: 'DRY', gramatura: 160, largura: 1.6, ordem: 1, ativo: true },
    { id: 't-pique', nome: 'PIQUET DE PROVA', grupo: 'DRY', gramatura: 180, largura: 1.6, ordem: 2, ativo: true },
    { id: 't-pv', nome: 'ALGODÃO PENTEADO', grupo: 'ALG', gramatura: 170, largura: 1.8, ordem: 1, ativo: true },
  ]
  const mat = (id, tecido_id, tecido, cor, cor_hex, livre) => ({ id, categoria: 'tecido', nome: tecido + ' · ' + cor, unidade: 'kg', minimo: 0, saldo: livre, reservado: 0, livre, pedidos_reservando: 0, reserva_sem_consumo: false, tecido_id, cor_id: 'c-' + id, tecido, cor, cor_hex, abaixo_do_minimo: false, ultimo_movimento: null })
  const MATERIAIS_DE_TECIDO = [
    mat('m1', 't-dry', 'DRYFIT POLIESTER 100%', 'Azul Royal', '#1d4ed8', 42.5),
    mat('m2', 't-dry', 'DRYFIT POLIESTER 100%', 'Branco', '#ffffff', 80),
    mat('m3', 't-dry', 'DRYFIT POLIESTER 100%', 'Preto', '#111111', 0),
    mat('m4', 't-pique', 'PIQUET DE PROVA', 'Vermelho', '#c6161b', 12),
    mat('m5', 't-pv', 'ALGODÃO PENTEADO', 'Mescla', '#9ca3af', 30),
    { ...mat('a1', null, null, null, null, 100), categoria: 'aviamento', nome: 'Linha de prova' },
  ]
  function responder(metodo, u, corpo) {
    if (u.includes('/rest/v1/material_na_prateleira')) return { status: 200, corpo: MATERIAIS_DE_TECIDO }
    if (u.includes('/rest/v1/grupo_de_tecido')) return { status: 200, corpo: GRUPOS_DE_TECIDO }
    if (u.includes('/rest/v1/tecido?')) return { status: 200, corpo: TECIDOS }
    if (u.includes('/rest/v1/lista_do_cabecalho')) return { status: 200, corpo: LISTAS }
    if (u.includes('/rest/v1/permissao?')) return { status: 200, corpo: [{ papel: 'admin' }, { papel: 'vendedor' }] }
    if (u.includes('/rest/v1/equipe?')) return { status: 200, corpo: [{ id: '00000000-0000-4000-8000-0000000000da', nome: 'Dani' }, { id: '00000000-0000-4000-8000-00000000000e', nome: 'Henrique' }, { id: '00000000-0000-4000-8000-0000000000ac', nome: 'Lucas Prova' }] }
    if (u.includes('/rest/v1/informe_da_casa')) {
      if (!informesDaCasa) return { status: 404, corpo: { code: 'PGRST205', message: "Could not find the table 'public.informe_da_casa' in the schema cache" } }
      if (metodo === 'GET') {
        const ordem = (x) => (x.grupo === 'producao' ? 0 : 1000) + x.ordem
        return { status: 200, corpo: [...informesDaCasa].sort((a, b) => ordem(a) - ordem(b)) }
      }
      if (metodo === 'POST') {
        gravados.push({ metodo, u: 'informe_da_casa', corpo })
        for (const l of corpo) {
          const i = informesDaCasa.findIndex((x) => x.id === l.id)
          if (i >= 0) informesDaCasa[i] = { ...informesDaCasa[i], ...l }
          else informesDaCasa.push(l)
        }
        return { status: 201, corpo: null }
      }
      if (metodo === 'DELETE') {
        const ids = (u.match(/id=in\.\(([^)]*)\)/) || [])[1]?.split(',') ?? []
        gravados.push({ metodo, u: 'informe_da_casa', ids })
        for (const id of ids) {
          const i = informesDaCasa.findIndex((x) => x.id === id)
          if (i >= 0) informesDaCasa.splice(i, 1)
        }
        return { status: 204, corpo: null }
      }
    }
    if (u.includes('/rest/v1/cor_de_impressao')) return { status: 200, corpo: CORES }
    if (u.includes('/rest/v1/grupo_de_referencia')) return { status: 200, corpo: GRUPOS_REF }
    if (u.includes('/rest/v1/referencia?')) return { status: 200, corpo: REFERENCIAS_DO_BANCO }
    if (u.includes('/rest/v1/preset_de_impressao')) {
      if (!presets) return { status: 404, corpo: { code: 'PGRST205', message: "Could not find the table 'public.preset_de_impressao' in the schema cache" } }
      const so = (u.match(/id=eq\.([^&]+)/) || [])[1]
      if (metodo === 'GET') return { status: 200, corpo: presets }
      if (metodo === 'POST') {
        const novo = { ...corpo, id: 'pr-novo-' + ++nPreset, dono: '1', alterado_em: '2026-10-10T16:00:00Z' }
        presets.push(novo); gravados.push({ metodo, u: 'preset', corpo })
        return { status: 201, corpo: [novo] }
      }
      if (metodo === 'PATCH') {
        const i = presets.findIndex((x) => x.id === so)
        gravados.push({ metodo, u: 'preset', id: so, corpo })
        if (i < 0 || presets[i].dono !== '1') return { status: 200, corpo: [] }
        presets[i] = { ...presets[i], ...corpo }
        return { status: 200, corpo: [presets[i]] }
      }
      if (metodo === 'DELETE') {
        const i = presets.findIndex((x) => x.id === so)
        if (i >= 0 && presets[i].dono === '1') presets.splice(i, 1)
        gravados.push({ metodo, u: 'preset', id: so })
        return { status: 204, corpo: null }
      }
    }
    if (u.includes('/rest/v1/referencia_na_ficha') && u.includes('cod=eq.')) {
      const cod = u.split('cod=eq.')[1].split('&')[0]
      return { status: 200, corpo: REFS.filter((r) => r.cod === cod) }
    }
    if (u.includes('/rest/v1/material_da_referencia')) {
      const ids = (u.match(/referencia_id=in\.\(([^)]*)\)/) || [])[1]?.split(',') ?? []
      return { status: 200, corpo: MATERIAIS.filter((m) => ids.includes(m.referencia_id)) }
    }
    if (u.includes('/rest/v1/kit_na_ficha')) return { status: 200, corpo: [] }
    if (u.includes('/rest/v1/item_de_detalhe_na_lista')) return { status: 200, corpo: [
      { id: 'd1', detalhe: 'gola', nome: 'Redonda', ordem: 1, referencias: 2, kits: 0 },
      { id: 'd2', detalhe: 'gola', nome: 'Gola V', ordem: 2, referencias: 1, kits: 0 },
      { id: 'd3', detalhe: 'costura', nome: 'Overloque de 4 fios', ordem: 1, referencias: 2, kits: 0 },
      { id: 'd4', detalhe: 'costura', nome: 'Costura reta com galoneira', ordem: 2, referencias: 0, kits: 0 },
    ] }
    if (u.includes('/rest/v1/permissao_da_acao')) return { status: 200, corpo: ACOES }
    if (u.includes('/rest/v1/rpc/mover_pedido')) {
      const p = PEDIDOS.find((x) => x.id === corpo?.p_pedido)
      gravados.push({ metodo, u: 'mover_pedido', corpo })
      if (!p) return { status: 404, corpo: { message: 'Pedido não encontrado.' } }
      p.estado = corpo.p_para
      return { status: 200, corpo: p }
    }
    if (u.includes('/rest/v1/pedido?')) {
      const so = (u.match(/cotacao_id=eq\.([^&]+)/) || [])[1]
      return { status: 200, corpo: so ? PEDIDOS.filter((p) => p.cotacao_id === so) : PEDIDOS }
    }
    if (u.includes('/rest/v1/meu_perfil')) return { status: 200, corpo: perfilBase(papel) }
    if (u.includes('/rest/v1/regulagem')) return { status: 200, corpo: [{ valor: ensaio ? 'teste' : 'real' }] }
    if (u.includes('/rest/v1/cotacao_na_lista')) return { status: 200, corpo: lista.filter((l) => corpos.has(l.id)) }
    if (u.includes('/rest/v1/cliente_na_lista')) {
      const so = (u.match(/id=eq\.([^&]+)/) || [])[1]
      return { status: 200, corpo: so ? clientes.filter((c) => c.id === so) : clientes }
    }
    /* os outros cadastros e o frete de costume do Clube Novo (082) */
    if (u.includes('/rest/v1/extras_do_cliente')) return { status: 200, corpo: u.includes('k2') ? [{ cliente_id: 'k2',
      documentos: [{ id: 'D9', tipo: 'J', documento: '11222333000181', nome: 'Clube Novo Filial Ltda' }],
      enderecos: [{ id: 'E9', apelido: 'Quadra do clube', endereco: 'Rua da Quadra, 9', complemento: '', bairro: 'Jundiaí', cidade: 'Anápolis', uf: 'GO', cep: '75110000' }],
      contatos: [{ id: 'K9', nome: 'Bia', cargo: 'Compras', celular: '62977776666', telefone: '', email: 'bia@exemplo.com' }],
    }] : [] }
    if (u.includes('/rest/v1/frete_do_cliente')) return { status: 200, corpo: u.includes('k2') ? [{ modo: 'TRANSPORTADORA', vezes: 2, pedidos: 3, ultimo_envio: '', ultimo_transportador: 'Jadlog' }] : [] }
    const id = (u.match(/cotacao\?.*id=eq\.([^&]+)/) || [])[1]
    if (u.includes('/rest/v1/cotacao?') && id) {
      if (metodo === 'GET') {
        const c = corpos.get(id)
        const l = lista.find((x) => x.id === id)
        return { status: 200, corpo: c ? [{ id, numero: l.numero, corpo: c, versao_do_formato: 4, estado: l.estado === 'enviada' ? c.estado : l.estado, criada_em: l.criada_em, atualizado_em: l.atualizado_em }] : [] }
      }
      if (metodo === 'PATCH') {
        gravados.push({ metodo, u: 'cotacao', id, corpo })
        corpos.set(id, corpo.corpo)
        return { status: 204, corpo: null }
      }
      if (metodo === 'DELETE') {
        gravados.push({ metodo, u: 'cotacao', id })
        corpos.delete(id)
        return { status: 204, corpo: null }
      }
    }
    return null
  }
  return { responder, gravados, corpos, presets, informesDaCasa, CORES, REFERENCIAS_DO_BANCO }
}
