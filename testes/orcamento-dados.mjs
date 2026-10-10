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
      { id: 'IF1', texto: 'A produção começa depois da aprovação da arte e do pagamento da entrada.', noDocumento: true },
      { id: 'IF2', texto: 'Cores de tela e de impressão podem ter pequena diferença.', noDocumento: true },
      { id: 'IF3', texto: 'Pedido mínimo de 10 peças por layout.', noDocumento: false },
    ],
    producao: { pedido: '', dataDeEnvio: '2026-10-20', departamento: 'ESPORTIVO', embalagem: 'CAIXA', marcas: ['URGENTE'], observacao: 'Entregar junto com o pedido do clube.' },
    enviadas: [{ numero: 1, data: '2026-10-02T14:10:00-03:00', total: 9870, pecas: 186, para: 'Marcos', observacao: '' }],
    aprovacao: null,
  }
}

const NOMES = ['Atlético Exemplo', 'Academia Exemplo', 'Auto Peças Exemplo', 'Escola Exemplo', 'Clube Exemplo', 'Pelada dos Amigos', 'Colégio Exemplo', 'Time da Firma Exemplo']

/* muitos: a CO2026-0131 com 14 layouts, para o resumo da folha virar duas
   tabelas (acima de 10 layouts, FOURTIME OS - 14 seção 4) */
export function bancoDoOrcamento({ papel = 'admin', ensaio = true, abertas = 6, muitos = false } = {}) {
  const lista = NOMES.slice(0, abertas).map((nome, i) => ({
    id: 'c' + (i + 1),
    numero: 'CO2026-0' + (131 - i),
    cliente_id: null,
    cliente_nome: nome,
    cliente_cidade: 'Goiânia',
    cliente_uf: 'GO',
    lead_id: null,
    estado: 'enviada',
    vendedor_nome: 'Dani',
    total: 9034.5 - i * 700,
    pecas: 186 - i * 10,
    valida_ate: '2026-10-20',
    criada_em: new Date(Date.parse('2026-10-01T10:00:00-03:00') - i * 3600000).toISOString(),
    atualizado_em: '2026-10-02T14:10:00-03:00',
    pedido_numero: null,
    teste: true,
  }))
  const primeira = () => {
    const c = cotacaoDoAtletico()
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

  function responder(metodo, u, corpo) {
    if (u.includes('/rest/v1/referencia_na_ficha') && u.includes('cod=eq.')) {
      const cod = u.split('cod=eq.')[1].split('&')[0]
      return { status: 200, corpo: REFS.filter((r) => r.cod === cod) }
    }
    if (u.includes('/rest/v1/material_da_referencia')) {
      const ids = (u.match(/referencia_id=in\.\(([^)]*)\)/) || [])[1]?.split(',') ?? []
      return { status: 200, corpo: MATERIAIS.filter((m) => ids.includes(m.referencia_id)) }
    }
    if (u.includes('/rest/v1/kit_na_ficha')) return { status: 200, corpo: [] }
    if (u.includes('/rest/v1/meu_perfil')) return { status: 200, corpo: perfilBase(papel) }
    if (u.includes('/rest/v1/regulagem')) return { status: 200, corpo: [{ valor: ensaio ? 'teste' : 'real' }] }
    if (u.includes('/rest/v1/cotacao_na_lista')) return { status: 200, corpo: lista.filter((l) => corpos.has(l.id)) }
    if (u.includes('/rest/v1/cliente_na_lista')) return { status: 200, corpo: clientes }
    const id = (u.match(/cotacao\?.*id=eq\.([^&]+)/) || [])[1]
    if (u.includes('/rest/v1/cotacao?') && id) {
      if (metodo === 'GET') {
        const c = corpos.get(id)
        const l = lista.find((x) => x.id === id)
        return { status: 200, corpo: c ? [{ id, numero: l.numero, corpo: c, versao_do_formato: 4, estado: c.estado, criada_em: l.criada_em, atualizado_em: l.atualizado_em }] : [] }
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
  return { responder, gravados, corpos }
}
