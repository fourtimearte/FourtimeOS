import { chamar, tabela } from '@shared/supabase'
import type { Painel, Papel } from '../sessao/tipos'
import type { Convite, PainelDoSistema, PessoaDaEquipe } from './tipos'

/* A conversa com o banco sobre gente.

   Nenhuma destas funcoes confere se quem chamou e administrador, e isso e de
   proposito: conferir aqui seria conferir no navegador, que e onde a conferencia
   nao vale nada. Quem recusa e a regra de acesso da tabela. Se um vendedor
   chamar aprovar() na mao, o banco devolve zero linhas alteradas. */

const CAMPOS = 'id,nome,email,papel,situacao,paineis,criado_em,aprovado_em,foto_em'

/** Os paineis que existem, na ordem do menu. Qualquer pessoa que entrou le. */
export function listarPaineis(): Promise<PainelDoSistema[]> {
  return tabela<PainelDoSistema[]>('painel?select=chave,nome,grupo,ordem&order=ordem.asc')
}

/* O padrao de um papel, perguntado ao banco.

   A tentacao era copiar essa lista para ca e pronto. Nao da: e o banco que
   resolve o padrao quando a coluna paineis esta vazia, e duas listas escritas
   separado discordam em silencio no dia em que uma delas muda. Quem pergunta,
   nao erra. */
export function paineisDoPapel(papel: Papel): Promise<Painel[]> {
  return chamar<Painel[]>('paineis_do_papel', { p: papel })
}

type LinhaDaPessoa = {
  id: string
  nome: string
  email: string
  papel: Papel
  situacao: PessoaDaEquipe['situacao']
  paineis: Painel[] | null
  criado_em: string
  aprovado_em: string | null
  foto_em: string | null
}

function arrumar(l: LinhaDaPessoa): PessoaDaEquipe {
  return {
    id: l.id,
    nome: l.nome,
    email: l.email,
    papel: l.papel,
    situacao: l.situacao,
    paineis: l.paineis,
    criadoEm: l.criado_em,
    aprovadoEm: l.aprovado_em,
    fotoEm: l.foto_em,
  }
}

export async function listarEquipe(): Promise<PessoaDaEquipe[]> {
  const linhas = await tabela<LinhaDaPessoa[]>(`pessoa?select=${CAMPOS}&order=criado_em.asc`)
  return linhas.map(arrumar)
}

/* Quantas pessoas estao na fila.

   Existe para o menu poder mostrar o numero em Configuracoes. Sem isso, uma
   conta nova fica esperando indefinidamente: ninguem abre uma tela para
   conferir se apareceu gente, e a fila so seria descoberta quando a pessoa
   reclamasse. Le so o id, que e o suficiente para contar. */
export async function contarEsperando(): Promise<number> {
  const linhas = await tabela<{ id: string }[]>('pessoa?select=id&situacao=eq.esperando')
  return linhas.length
}

async function mexer(id: string, mudanca: Record<string, unknown>): Promise<PessoaDaEquipe> {
  const linhas = await tabela<LinhaDaPessoa[]>(
    `pessoa?id=eq.${encodeURIComponent(id)}&select=${CAMPOS}`,
    { metodo: 'PATCH', corpo: mudanca, devolver: true },
  )
  const linha = linhas[0]
  /* Zero linhas nao e erro do servidor: e a regra de acesso dizendo nao, em
     silencio. Sem este aviso a tela mostraria sucesso sem ter mudado nada. */
  if (!linha) throw new Error('Seu acesso não permite mudar esta pessoa.')
  return arrumar(linha)
}

export function aprovar(
  id: string,
  papel: Papel,
  paineis: Painel[] | null,
  euSou: string,
): Promise<PessoaDaEquipe> {
  return mexer(id, {
    situacao: 'aprovado',
    papel,
    paineis,
    aprovado_em: new Date().toISOString(),
    aprovado_por: euSou,
  })
}

export function mudarPapel(id: string, papel: Papel): Promise<PessoaDaEquipe> {
  return mexer(id, { papel })
}

/** Nulo devolve a pessoa para o padrao do papel dela. */
export function mudarPaineis(id: string, paineis: Painel[] | null): Promise<PessoaDaEquipe> {
  return mexer(id, { paineis })
}

export function bloquear(id: string): Promise<PessoaDaEquipe> {
  return mexer(id, { situacao: 'bloqueado' })
}

export function desbloquear(id: string, euSou: string): Promise<PessoaDaEquipe> {
  return mexer(id, {
    situacao: 'aprovado',
    aprovado_em: new Date().toISOString(),
    aprovado_por: euSou,
  })
}

export async function apagarPessoa(id: string): Promise<void> {
  await tabela<null>(`pessoa?id=eq.${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

/* --- os e-mails liberados ------------------------------------------------- */

type LinhaDoConvite = {
  email: string
  papel: Papel
  paineis: Painel[] | null
  criado_em: string
  usado_em: string | null
}

export async function listarConvites(): Promise<Convite[]> {
  const linhas = await tabela<LinhaDoConvite[]>(
    'convite?select=email,papel,paineis,criado_em,usado_em&order=criado_em.desc',
  )
  return linhas.map((l) => ({
    email: l.email,
    papel: l.papel,
    paineis: l.paineis,
    criadoEm: l.criado_em,
    usadoEm: l.usado_em,
  }))
}

export async function convidar(email: string, papel: Papel, euSou: string): Promise<void> {
  await tabela<null>('convite', {
    metodo: 'POST',
    corpo: { email: email.trim().toLowerCase(), papel, criado_por: euSou },
  })
}

export async function tirarConvite(email: string): Promise<void> {
  await tabela<null>(`convite?email=eq.${encodeURIComponent(email)}`, { metodo: 'DELETE' })
}
