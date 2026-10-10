/* ==========================================================================
   AS CORES DE IMPRESSÃO DO BANCO (Configurações, Banco de dados): as 300 do
   DTF e as 87 da sublimação, tabela `cor_de_impressao` (migrações 008 a 010).

   ATÉ 11/10/2026 o menu de código de cor do editor lia as listas de exemplo
   do /kit (38 do DTF e 30 da sublimação, com cores de mentira), e o
   Henrique viu que as tabelas do editor estavam erradas. Agora a fonte é uma
   só, a do banco, lida UMA vez por visita e guardada aqui: o editor abre o
   menu dezenas de vezes, e cada abertura não pode virar uma ida ao servidor.

   Este arquivo é só o GUARDADOR, sem React e sem servidor, para o dominio
   que roda em node (hexDaCor, o arquivo da ficha) poder ler daqui. Quem lê
   o banco e avisa a tela é usar-cores-de-impressao.ts.
   ========================================================================== */

export type CorDeImpressaoNoMenu = [codigo: string, hex: string, nome: string]

export type CoresDeImpressao = {
  fase: 'nada' | 'lendo' | 'pronto' | 'falhou'
  dtf: CorDeImpressaoNoMenu[]
  sub: CorDeImpressaoNoMenu[]
  falha: string
}

let estado: CoresDeImpressao = { fase: 'nada', dtf: [], sub: [], falha: '' }
const ouvintes = new Set<() => void>()

/** o que já foi lido: para quem só precisa do hex de um código */
export function coresJaLidas(): CoresDeImpressao {
  return estado
}

export function guardarCoresDeImpressao(novo: CoresDeImpressao): void {
  estado = novo
  ouvintes.forEach((o) => o())
}

export function assinarCoresDeImpressao(o: () => void): () => void {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}
