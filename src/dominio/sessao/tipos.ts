/* Quem esta usando o sistema, e o que essa pessoa pode. */

export type Papel = 'dono' | 'vendedor' | 'producao'

export const NOME_DO_PAPEL: Record<Papel, string> = {
  dono: 'Dono',
  vendedor: 'Vendedor',
  producao: 'Produção',
}

export type Pessoa = {
  id: string
  nome: string
  papel: Papel
  email: string
}

/* Tres fases, e a primeira e a que costuma ser esquecida. Ao abrir o sistema o
   cracha guardado ainda esta sendo conferido com o servidor, e nesse instante
   a resposta nao e "entrou" nem "nao entrou": e "espera". Sem essa fase, a
   pessoa que ja estava dentro pisca na tela de entrada a cada recarga. */
export type Estado =
  | { fase: 'conferindo' }
  | { fase: 'fora' }
  | { fase: 'dentro'; pessoa: Pessoa }

/** As iniciais que aparecem na bolinha do topo. */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '??'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** O primeiro nome, que e como a fabrica chama todo mundo. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome
}
