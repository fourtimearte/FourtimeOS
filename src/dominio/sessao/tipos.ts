import { enderecoPublico } from '@shared/supabase'

/* Quem esta usando o sistema, e o que essa pessoa pode. */

/* O PAPEL DEIXOU DE SER UMA LISTA FECHADA na migração 028. Ele virou tabela
   no banco, para o administrador criar um papel novo pela tela em vez de
   pedir migração. Por isso aqui ele é texto: a lista de verdade mora em
   `papel_do_sistema`, e o nome de cada um vem de @dominio/acessos. */
export type Papel = string

/* esperando: a conta existe e o admin ainda nao liberou. Ela nao ve nada alem
   do proprio perfil, e isso e decidido no banco, nao aqui. */
export type Situacao = 'esperando' | 'aprovado' | 'bloqueado'

export const NOME_DA_SITUACAO: Record<Situacao, string> = {
  esperando: 'Esperando aprovação',
  aprovado: 'Aprovado',
  bloqueado: 'Bloqueado',
}

/* As chaves dos paineis. A mesma lista existe na tabela painel do banco, e e a
   do banco que vale na hora de gravar: aqui elas servem para a rota e o menu
   saberem do que estao falando sem escrever texto solto. */
export type Painel =
  | 'inicio'
  | 'funil'
  | 'clientes'
  | 'cotacao'
  | 'separacao'
  | 'pcp'
  | 'ficha'
  | 'kanban'
  | 'produtos'
  | 'estoque'
  | 'atividades'
  | 'relatorio'
  | 'banco'
  | 'config'
  | 'kit'

/** Os quatro niveis de uma pagina. A escada e cobrada pelo banco. */
export type Nivel4 = { ver: boolean; editar: boolean; deletar: boolean; total: boolean }

export type Pessoa = {
  id: string
  nome: string
  papel: Papel
  situacao: Situacao
  /** ja vem resolvido pelo banco: o padrao do papel, ou a lista so dela */
  paineis: Painel[]
  /** o que ela pode em cada pagina, ja cruzado com a lista propria dela */
  permissoes: Record<string, Nivel4>
  email: string
  /** quando a foto foi trocada pela ultima vez; nulo significa sem foto */
  fotoEm: string | null
}

/** O balde e o caminho da foto de perfil. O id no comeco do caminho e o que
    deixa a regra de acesso dizer "voce so mexe no que esta na sua pasta". */
export const BALDE_DAS_FOTOS = 'avatares'

export function caminhoDaFoto(id: string): string {
  return `${id}/foto.jpg`
}

/** O endereco da foto para usar num <img>, ou nulo quando nao tem foto. */
export function fotoDe(p: { id: string; fotoEm: string | null }): string | null {
  if (!p.fotoEm) return null
  return enderecoPublico(BALDE_DAS_FOTOS, caminhoDaFoto(p.id), p.fotoEm)
}

/* Tres fases, e a esquecida e 'conferindo'. Ao abrir o sistema o cracha
   guardado ainda esta sendo conferido com o servidor, e nesse instante a
   resposta nao e "entrou" nem "nao entrou": e "espera". Sem essa fase, quem ja
   estava dentro pisca na tela de entrada a cada recarga. */
export type Estado =
  | { fase: 'conferindo' }
  | { fase: 'fora' }
  | { fase: 'dentro'; pessoa: Pessoa }

/** Entrou de verdade, com a conta ja liberada pelo admin. */
export function liberada(p: Pessoa): boolean {
  return p.situacao === 'aprovado'
}

export function podeVer(p: Pessoa, painel: Painel): boolean {
  return liberada(p) && p.paineis.includes(painel)
}

/* A PERGUNTA QUE O BOTAO FAZ.

   podeVer responde se a pagina aparece; esta responde se a pessoa pode mexer
   no que tem dentro. A matriz vem pronta do banco, entao a tela nao recalcula
   regra nenhuma: ela so le a resposta.

   Quem nao tem a linha da pagina nao pode nada, e isso e de proposito: o
   padrao de qualquer acesso e nao. */
export function pode(p: Pessoa, painel: Painel, nivel: 'ver' | 'editar' | 'deletar' | 'total'): boolean {
  if (!liberada(p)) return false
  const linha = p.permissoes[painel]
  return !!linha && !!linha[nivel]
}

/** O administrador. Algumas telas sao dele e de mais ninguem. */
export function souAdmin(p: Pessoa | null): boolean {
  return !!p && liberada(p) && p.papel === 'admin'
}

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
