/* ==========================================================================
   A planilha do Excel (.xlsx), sem pacote nenhum.

   Pedido do Henrique de 05/11/2026: "quero também poder baixar um XLS com
   todo o estoque de tecidos". O CSV que o Relatório e o Transporte baixam
   abre no Excel, mas perde o acento quando o Excel escolhe a codificação
   errada, junta tudo numa coluna quando o separador não é o do Windows, e não
   guarda largura nem negrito. O .xlsx de verdade não tem nenhum desses
   problemas.

   O .xlsx é um ZIP de alguns XML. O ZIP aqui é o mais simples que existe:
   cada arquivo guardado sem compressão (método 0), com o CRC32 dele. O Excel,
   o LibreOffice e o Google Planilhas abrem.

   Texto vai como "inlineStr", número como número: a coluna de saldo soma no
   Excel sem precisar converter nada.
   ========================================================================== */

export type Celula = string | number | null

export type AbaDaPlanilha = {
  nome: string
  colunas: { titulo: string; largura?: number }[]
  linhas: Celula[][]
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(b: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** junta os arquivos num ZIP sem compressão */
export function zipar(arquivos: { nome: string; dados: Uint8Array }[]): Uint8Array {
  const cod = new TextEncoder()
  const partes: Uint8Array[] = []
  const centrais: Uint8Array[] = []
  let deslocamento = 0
  for (const a of arquivos) {
    const nome = cod.encode(a.nome)
    const crc = crc32(a.dados)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // o nome em UTF-8
    local.setUint16(8, 0, true) // guardado, sem compressão
    local.setUint32(14, crc, true)
    local.setUint32(18, a.dados.length, true)
    local.setUint32(22, a.dados.length, true)
    local.setUint16(26, nome.length, true)
    partes.push(new Uint8Array(local.buffer), nome, a.dados)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint16(8, 0x0800, true)
    central.setUint16(10, 0, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, a.dados.length, true)
    central.setUint32(24, a.dados.length, true)
    central.setUint16(28, nome.length, true)
    central.setUint32(42, deslocamento, true)
    centrais.push(new Uint8Array(central.buffer), nome)
    deslocamento += 30 + nome.length + a.dados.length
  }
  const tamanhoCentral = centrais.reduce((s, c) => s + c.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true)
  fim.setUint16(8, arquivos.length, true)
  fim.setUint16(10, arquivos.length, true)
  fim.setUint32(12, tamanhoCentral, true)
  fim.setUint32(16, deslocamento, true)
  const tudo = [...partes, ...centrais, new Uint8Array(fim.buffer)]
  const saida = new Uint8Array(tudo.reduce((s, p) => s + p.length, 0))
  let i = 0
  for (const p of tudo) {
    saida.set(p, i)
    i += p.length
  }
  return saida
}

const escapar = (t: string) =>
  t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // o que o XML não aceita (controle) sai; quebra de linha e tab ficam
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

/** A1, B1, ..., Z1, AA1 */
function letraDaColuna(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function folha(aba: AbaDaPlanilha): string {
  const cols = aba.colunas
    .map(
      (c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura ?? 14}" customWidth="1"/>`,
    )
    .join('')
  const celula = (v: Celula, ref: string, estilo: number) => {
    if (v === null || v === '') return ''
    if (typeof v === 'number' && Number.isFinite(v))
      return `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`
    return `<c r="${ref}" t="inlineStr" s="${estilo}"><is><t xml:space="preserve">${escapar(String(v))}</t></is></c>`
  }
  const linhas = [
    `<row r="1">${aba.colunas.map((c, i) => celula(c.titulo, letraDaColuna(i) + 1, 1)).join('')}</row>`,
    ...aba.linhas.map(
      (l, j) =>
        `<row r="${j + 2}">${l.map((v, i) => celula(v, letraDaColuna(i) + (j + 2), 0)).join('')}</row>`,
    ),
  ].join('')
  const ultima = letraDaColuna(Math.max(0, aba.colunas.length - 1)) + (aba.linhas.length + 1)
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${linhas}</sheetData>` +
    `<autoFilter ref="A1:${ultima}"/>` +
    '</worksheet>'
  )
}

/** o nome da aba: até 31 letras, sem os caracteres que o Excel recusa */
const nomeDaAba = (n: string) => n.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Planilha'

export function planilhaXlsx(abas: AbaDaPlanilha[]): Blob {
  const cod = new TextEncoder()
  const xml = (s: string) => cod.encode(s)
  const arquivos = [
    {
      nome: '[Content_Types].xml',
      dados: xml(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          abas
            .map(
              (_, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
            )
            .join('') +
          '</Types>',
      ),
    },
    {
      nome: '_rels/.rels',
      dados: xml(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
      ),
    },
    {
      nome: 'xl/workbook.xml',
      dados: xml(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
          abas
            .map(
              (a, i) =>
                `<sheet name="${escapar(nomeDaAba(a.nome))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
            )
            .join('') +
          '</sheets></workbook>',
      ),
    },
    {
      nome: 'xl/_rels/workbook.xml.rels',
      dados: xml(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          abas
            .map(
              (_, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
            )
            .join('') +
          `<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          '</Relationships>',
      ),
    },
    {
      /* dois estilos: 0 o normal, 1 o cabeçalho em negrito com fundo cinza */
      nome: 'xl/styles.xml',
      dados: xml(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
          '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
          '<fill><patternFill patternType="solid"><fgColor rgb="FFE0E3E9"/><bgColor indexed="64"/></patternFill></fill></fills>' +
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
          '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
          '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
          '</styleSheet>',
      ),
    },
    ...abas.map((a, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, dados: xml(folha(a)) })),
  ]
  return new Blob([zipar(arquivos) as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** baixa um arquivo pelo navegador */
export function baixarArquivo(arquivo: Blob, nome: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(arquivo)
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
