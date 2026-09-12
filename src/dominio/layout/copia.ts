import { migrarBloco, VERSAO_DO_BLOCO, type Bloco } from './bloco'

/* ==========================================================================
   Copiar e colar layout.

   Copiar um bloco inteiro e o atalho mais usado do editor antigo: a maioria
   dos pedidos e o mesmo produto em duas cores, ou a mesma arte em masculino e
   infantil. Copiar e colar poupa relancar referencia, tecido, design e cores.

   A copia vive no armazenamento do navegador e nao na memoria da tela, para
   funcionar entre duas abas e entre duas cotacoes diferentes. Ela guarda a
   versao do bloco junto, porque uma copia feita hoje pode ser colada depois
   de uma mudanca de formato.
   ========================================================================== */

const CHAVE = 'ft.layout.copia'

type Guardado = { versao: number; bloco: unknown }

export function copiarBloco(b: Bloco) {
  const g: Guardado = { versao: VERSAO_DO_BLOCO, bloco: b }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(g))
  } catch {
    /* armazenamento bloqueado: nao da para copiar entre abas, e so isso */
  }
}

export function temCopia(): boolean {
  try {
    return !!localStorage.getItem(CHAVE)
  } catch {
    return false
  }
}

/** O bloco copiado, com id e numero novos: colar cria uma peca, nao clona. */
export function colarBloco(n: number): Bloco | null {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return null
    const g = JSON.parse(cru) as Guardado
    const bruto = { ...(g.bloco as Record<string, unknown>), versao: g.versao ?? 0 }
    const b = migrarBloco(bruto)
    return { ...b, id: 'B' + Math.random().toString(36).slice(2, 9), n }
  } catch {
    return null
  }
}
