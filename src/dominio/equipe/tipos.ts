import type { Painel, Papel, Situacao } from '../sessao/tipos'

/* A equipe vista pelo administrador. So ele le esta lista: a regra de acesso
   da tabela pessoa deixa cada um enxergar a propria linha e mais nada. */

/* Um painel do sistema, como o banco conhece. A lista vem de la, e nao de uma
   constante aqui, porque e o banco que guarda quais paineis cada pessoa tem:
   se as duas listas fossem escritas separado, um dia iam discordar em
   silencio e alguem ficaria com um painel que nao existe mais. */
export type PainelDoSistema = {
  chave: Painel
  nome: string
  grupo: string
  ordem: number
}

export function porGrupo(lista: PainelDoSistema[]): { grupo: string; itens: PainelDoSistema[] }[] {
  const grupos: { grupo: string; itens: PainelDoSistema[] }[] = []
  for (const p of [...lista].sort((a, b) => a.ordem - b.ordem)) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.grupo === p.grupo) ultimo.itens.push(p)
    else grupos.push({ grupo: p.grupo, itens: [p] })
  }
  return grupos
}

export type PessoaDaEquipe = {
  id: string
  nome: string
  email: string
  papel: Papel
  situacao: Situacao
  /** nulo significa: usa o padrao do papel */
  paineis: Painel[] | null
  criadoEm: string
  aprovadoEm: string | null
  fotoEm: string | null
}

/** Um e-mail liberado para se cadastrar. Sem ele a conta nao nasce. */
export type Convite = {
  email: string
  papel: Papel
  paineis: Painel[] | null
  criadoEm: string
  usadoEm: string | null
}

/* Quem esta esperando aparece primeiro, e dentro de cada grupo o mais antigo
   na frente: fila e fila. */
const ORDEM: Record<Situacao, number> = { esperando: 0, aprovado: 1, bloqueado: 2 }

export function naOrdemDaFila(lista: PessoaDaEquipe[]): PessoaDaEquipe[] {
  return [...lista].sort(
    (a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || a.criadoEm.localeCompare(b.criadoEm),
  )
}

export function quantosEsperando(lista: PessoaDaEquipe[]): number {
  return lista.filter((p) => p.situacao === 'esperando').length
}

/** Convite que ja virou conta nao precisa mais aparecer como pendente. */
export function convitesAbertos(lista: Convite[]): Convite[] {
  return lista.filter((c) => !c.usadoEm)
}

export function emailValido(email: string): boolean {
  const e = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
}
