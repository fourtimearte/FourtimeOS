/* Arquivos.

   O Supabase guarda arquivo em baldes, e o caminho dentro do balde e o que a
   regra de acesso enxerga. Por isso a foto de cada pessoa mora em
   <id dela>/foto.jpg: a pasta com o id no comeco deixa a regra dizer "voce so
   mexe no que esta na sua pasta" sem precisar consultar o banco. */

import { crachaValido } from './auth'
import { SUPABASE_CHAVE, SUPABASE_URL } from './config'
import { SESSAO_VENCIDA } from './rest'

/* O endereco publico de um arquivo, para usar direto num <img>.

   Vale so em balde publico. O `desde` vira o final do endereco e existe por um
   motivo pratico: quando a pessoa troca a foto, o caminho continua o mesmo, e
   sem isso o navegador mostraria a foto velha por horas. */
export function enderecoPublico(balde: string, caminho: string, desde?: string | null): string {
  const base = `${SUPABASE_URL}/storage/v1/object/public/${balde}/${caminho}`
  return desde ? `${base}?v=${encodeURIComponent(desde)}` : base
}

function recadoDoBalde(bruto: string, situacao: number): string {
  if (/exceeded the maximum allowed size|payload too large/i.test(bruto) || situacao === 413) {
    return 'O arquivo é grande demais.'
  }
  if (/mime type|not supported/i.test(bruto)) {
    return 'Esse tipo de arquivo não é aceito aqui.'
  }
  if (situacao === 403) return 'Seu acesso não permite gravar este arquivo.'
  return bruto || `Não consegui gravar o arquivo (${situacao}).`
}

export async function subirArquivo(
  balde: string,
  caminho: string,
  conteudo: Blob,
): Promise<void> {
  const cracha = await crachaValido()
  if (!cracha) throw new Error(SESSAO_VENCIDA)

  let resposta: Response
  try {
    resposta = await fetch(`${SUPABASE_URL}/storage/v1/object/${balde}/${caminho}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_CHAVE,
        Authorization: `Bearer ${cracha.acesso}`,
        'Content-Type': conteudo.type || 'application/octet-stream',
        /* trocar a foto e gravar por cima da mesma, nao criar uma segunda */
        'x-upsert': 'true',
      },
      body: conteudo,
    })
  } catch {
    throw new Error('Não consegui falar com o servidor. Confira a internet.')
  }

  if (!resposta.ok) {
    const erro = (await resposta.json().catch(() => ({}))) as { message?: string; error?: string }
    throw new Error(recadoDoBalde(erro.message || erro.error || '', resposta.status))
  }
}

export async function apagarArquivo(balde: string, caminho: string): Promise<void> {
  const cracha = await crachaValido()
  if (!cracha) throw new Error(SESSAO_VENCIDA)

  let resposta: Response
  try {
    resposta = await fetch(`${SUPABASE_URL}/storage/v1/object/${balde}/${caminho}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_CHAVE, Authorization: `Bearer ${cracha.acesso}` },
    })
  } catch {
    throw new Error('Não consegui falar com o servidor. Confira a internet.')
  }

  /* 404 nao e erro aqui: o arquivo ja nao estava la, que e onde a gente queria
     chegar de qualquer jeito. */
  if (!resposta.ok && resposta.status !== 404) {
    const erro = (await resposta.json().catch(() => ({}))) as { message?: string }
    throw new Error(recadoDoBalde(erro.message || '', resposta.status))
  }
}
