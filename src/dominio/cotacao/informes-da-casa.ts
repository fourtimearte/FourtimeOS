import { tabela } from '@shared/supabase'
import { INFORMES_PADRAO, GRUPOS_DO_INFORME, type GrupoDoInforme, type InformeDoDocumento } from './tipos'

/* ==========================================================================
   OS INFORMES DA CASA (060; pranchas 123 e 123b, aprovadas em 11/10/2026).

   Os textos que toda cotação nova traz na página 1 da folha. Moram na tabela
   informe_da_casa, e quem mexe é o administrador e o gerente, pela página
   "Informes e termos" que a engrenagem do editor abre.

   A COTAÇÃO GUARDA A CÓPIA: quando ela nasce, copia a lista para o próprio
   corpo. Mudar aqui não mexe no que já foi feito nem no que já foi enviado.

   Antes da 060 rodar, a tabela não existe: a lista é a de sempre, a que
   morava no código (INFORMES_PADRAO), e a página avisa que ainda não salva.
   ========================================================================== */

export type InformeDaCasa = {
  id: string
  grupo: GrupoDoInforme
  texto: string
  nasceMarcado: boolean
}

/** de onde a lista veio: do banco, ou do código porque a 060 ainda não rodou */
export type OndeMoramOsInformes = 'banco' | 'codigo'

type Linha = { id: string; grupo: string; texto: string; nasce_marcado: boolean; ordem: number }
const COLUNAS = 'id,grupo,texto,nasce_marcado,ordem'

const grupoDe = (g: string): GrupoDoInforme => (g === 'termos' ? 'termos' : 'producao')

/** os da casa na ordem da folha: o grupo da produção primeiro, cada um na sua ordem */
export function naOrdem(lista: InformeDaCasa[]): InformeDaCasa[] {
  return GRUPOS_DO_INFORME.flatMap((g) => lista.filter((x) => x.grupo === g))
}

export function informesDoCodigo(): InformeDaCasa[] {
  return naOrdem(
    INFORMES_PADRAO.map((x, i) => ({ id: 'codigo-' + (i + 1), grupo: x.grupo, texto: x.texto, nasceMarcado: x.noDocumento })),
  )
}

/* a tabela que não existe responde 404 (PGRST205) antes da 060. Internet
   caída ou sessão vencida não podem virar "a lista do código" em silêncio. */
const semTabela = (recado: string) => /Não encontrei|schema cache|informe_da_casa/i.test(recado)

export async function carregarInformesDaCasa(): Promise<{
  lista: InformeDaCasa[]
  onde: OndeMoramOsInformes
  falha: string
}> {
  try {
    const linhas = await tabela<Linha[]>('informe_da_casa?select=' + COLUNAS + '&order=grupo.asc,ordem.asc,criado_em.asc')
    return {
      lista: naOrdem(linhas.map((l) => ({ id: l.id, grupo: grupoDe(l.grupo), texto: l.texto, nasceMarcado: !!l.nasce_marcado }))),
      onde: 'banco',
      falha: '',
    }
  } catch (e) {
    const recado = e instanceof Error ? e.message : String(e)
    if (semTabela(recado)) return { lista: informesDoCodigo(), onde: 'codigo', falha: '' }
    return { lista: [], onde: 'banco', falha: recado }
  }
}

/** um id novo, que já serve de chave na tabela (o banco aceita o que vem) */
export function idNovo(): string {
  const c = globalThis.crypto
  if (c && 'randomUUID' in c) return c.randomUUID()
  /* sem crypto.randomUUID (navegador antigo): um uuid v4 montado à mão */
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** o que a página tem de diferente do que o banco tem */
export function mudancasDosInformes(antes: InformeDaCasa[], agora: InformeDaCasa[]): number {
  const a = new Map(antes.map((x, i) => [x.id, { ...x, i }]))
  let n = antes.filter((x) => !agora.some((y) => y.id === x.id)).length
  agora.forEach((y) => {
    const x = a.get(y.id)
    const ordemDe = (lista: InformeDaCasa[], z: InformeDaCasa) => lista.filter((w) => w.grupo === z.grupo).findIndex((w) => w.id === z.id)
    if (!x || x.texto !== y.texto || x.grupo !== y.grupo || x.nasceMarcado !== y.nasceMarcado || ordemDe(antes, x) !== ordemDe(agora, y)) n++
  })
  return n
}

/** o texto em branco não vai para o banco: a página avisa antes */
export const vazios = (lista: InformeDaCasa[]) => lista.filter((x) => !x.texto.trim()).length

/* SALVAR É UMA IDA SÓ PARA OS QUE FICAM: um upsert com a lista inteira (a
   ordem de cada um é a posição no grupo) e um delete para os que saíram. */
export async function salvarInformesDaCasa(antes: InformeDaCasa[], agora: InformeDaCasa[]): Promise<InformeDaCasa[]> {
  if (vazios(agora)) throw new Error('Há texto em branco. Escreva ou apague antes de salvar.')
  const sairam = antes.filter((x) => !agora.some((y) => y.id === x.id)).map((x) => x.id)
  const linhas = GRUPOS_DO_INFORME.flatMap((g) =>
    agora
      .filter((x) => x.grupo === g)
      .map((x, i) => ({ id: x.id, grupo: g, texto: x.texto.trim(), nasce_marcado: x.nasceMarcado, ordem: i + 1 })),
  )
  if (linhas.length) {
    await tabela<null>('informe_da_casa', { metodo: 'POST', corpo: linhas, mesclar: true })
  }
  if (sairam.length) {
    await tabela<null>('informe_da_casa?id=in.(' + sairam.map(encodeURIComponent).join(',') + ')', { metodo: 'DELETE' })
  }
  const lida = await carregarInformesDaCasa()
  if (lida.falha) throw new Error(lida.falha)
  return lida.lista
}

/* A CÓPIA QUE A COTAÇÃO NOVA LEVA. Se o banco não responder, ela nasce com a
   lista do código, que é a de sempre: uma cotação não pode deixar de nascer
   porque a lista de textos não carregou. */
export async function informesParaCotacaoNova(): Promise<InformeDoDocumento[]> {
  const { lista, falha } = await carregarInformesDaCasa()
  /* lista vazia do banco é escolha da casa (apagou todos), e vale */
  const base = falha ? informesDoCodigo() : lista
  return base.map((x, i) => ({ id: 'IF' + (i + 1), texto: x.texto, noDocumento: x.nasceMarcado, grupo: x.grupo }))
}
