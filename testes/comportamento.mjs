/* ==========================================================================
   A conferência do Kit de Comportamento (FOURTIME OS - 17).

   O Design System cuida de como a tela PARECE; o Kit de Comportamento cuida
   de como ela RESPONDE. Esta conferência pega o que dá para pegar lendo o
   código, para uma tela nova não nascer com o comportamento de antes:

     1. SELEÇÃO DE LINHAS. Todo arquivo que desenha a caixa de marcar
        (`<Marcacao`) para marcar linhas de uma lista ou tabela usa a peça
        `useSelecaoDeLinhas` do Design System (caixa, clique na linha, Ctrl,
        Shift, Esc e Ctrl+A). A caixa que é uma opção de cadastro (uma só, ou
        a permissão de uma pessoa) entra na lista EXCECOES, com o motivo.
        Arquivo novo com caixa de marcar reprova até ser uma coisa ou outra.
     2. NINGUÉM REESCREVE A FAIXA DO SHIFT. A conta "da última marcada até
        esta" (`shiftKey` com `slice(Math.min(`) só mora em `src/ds`.

   Rodar:  node testes/comportamento.mjs
   ========================================================================== */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname

/* a caixa de marcar que NÃO marca linhas para lote, cada uma com o motivo */
const EXCECOES = {
  'src/modules/config/tags.tsx': 'os postos de uma tag: opção do cadastro da tag',
  'src/modules/config/equipe.tsx': 'as páginas de uma pessoa: opção do cadastro da pessoa',
  'src/modules/config/acessos.tsx': 'a matriz de acessos: cada caixa é uma permissão',
  'src/modules/transporte/folha.tsx': 'caixas soltas de um formulário (pago do envio e da coleta), não é lista',
  'src/modules/fornecedores/formulario.tsx': 'uma caixa só (já marcar como confiável)',
  'src/modules/ferramentas/boleto.tsx': 'uma caixa só (confirmei)',
  'src/modules/estoque/ficha-tecnica.tsx': 'opções do cadastro da ficha',
  'src/ds/kit/tela-kit.tsx': 'a vitrine do /kit',
}

function arquivos(dir, achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, achados)
    else if (/\.tsx?$/.test(nome)) achados.push(caminho)
  }
  return achados
}

const achados = []
const vistos = new Set()
for (const caminho of arquivos(join(RAIZ, 'src'))) {
  const nome = relative(RAIZ, caminho)
  const texto = readFileSync(caminho, 'utf8')
  if (texto.includes('<Marcacao')) {
    vistos.add(nome)
    if (!texto.includes('useSelecaoDeLinhas') && !EXCECOES[nome]) {
      achados.push(
        `${nome}  desenha a caixa de marcar sem a seleção do Kit de Comportamento: use useSelecaoDeLinhas (caixa, clique na linha, Ctrl, Shift, Esc, Ctrl+A), ou ponha o arquivo nas EXCECOES com o motivo`,
      )
    }
  }
  if (!nome.startsWith('src/ds/') && /shiftKey/.test(texto) && /slice\(Math\.min\(/.test(texto)) {
    achados.push(`${nome}  calcula a faixa do Shift por conta própria: a conta mora em useSelecaoDeLinhas (src/ds/componentes/selecao.ts)`)
  }
}
/* exceção que não tem mais caixa de marcar é exceção velha: sai da lista */
for (const nome of Object.keys(EXCECOES)) {
  if (!vistos.has(nome)) achados.push(`${nome}  está nas EXCECOES mas não desenha mais caixa de marcar: tire da lista`)
}

if (achados.length) {
  console.log(`\nComportamento fora do Kit  (${achados.length})`)
  for (const a of achados) console.log('  ' + a)
  console.log(`\n${achados.length} achados`)
  process.exit(1)
}
console.log('comportamento ok: toda caixa de marcar de linha usa a seleção do Kit')
