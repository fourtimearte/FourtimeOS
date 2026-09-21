import { tabela } from '@shared/supabase'

/* ==========================================================================
   A regulagem do sistema.

   O punhado de decisões que valem para o sistema inteiro e que mudam de vez em
   quando. Hoje é uma só: o sistema está em ENSAIO ou já está valendo?

   Enquanto vale "teste", o pedido nasce PD-TESTE-0001 em vez de um número de
   pedido de verdade, e as ferramentas de conferência (o kit de teste, por
   exemplo) aparecem na tela. No dia do lançamento a chave vira, e elas somem
   sozinhas, sem ninguém precisar lembrar de tirá-las antes de a fábrica usar.

   A resposta é guardada na memória da aba. Não é economia de rede: é que a
   chave não muda no meio de um expediente, e uma consulta por tela aberta
   custaria mais do que vale. Recarregar a página relê.
   ========================================================================== */

let lembrado: boolean | null = null

export async function emEnsaio(): Promise<boolean> {
  if (lembrado !== null) return lembrado
  try {
    const linhas = await tabela<{ valor: string }[]>(
      'regulagem?select=valor&chave=eq.pedido',
    )
    /* Sem linha nenhuma, o sistema está em ensaio. O padrão prudente aqui é o
       contrário do usual: se a regulagem sumiu, é melhor o pedido sair marcado
       como teste do que sair com um número de pedido real que ninguém pediu. */
    lembrado = (linhas[0]?.valor ?? 'teste') === 'teste'
  } catch {
    lembrado = true
  }
  return lembrado
}

/** Esquece o que foi lido. Serve para depois de virar a chave. */
export function esquecerRegulagem() {
  lembrado = null
  paginas = null
}

/* ==========================================================================
   AS PAGINAS QUE ESTAO ESCONDIDAS
   ==========================================================================

   Uma pagina que talvez nao seja usada nao se apaga: some do menu e fica
   esperando. Apagar e uma decisao que nao da para voltar atras num sabado, e
   "talvez a gente use" e o estado em que a Ficha de producao esta.

   A lista mora na MESMA regulagem do ensaio, e nao na memoria do navegador,
   por um motivo so: esconder uma pagina e uma decisao da empresa, e nao a
   preferencia de quem esta olhando. Guardada por navegador, cada pessoa da
   fabrica veria um menu diferente, e o proprio motivo de esconder (a equipe
   nao entrar ali) deixaria de valer.

   O valor e uma lista simples separada por virgula, com as chaves do menu:
   'ficha,produtos'. Chave que nao esta na lista esta ligada, entao o padrao
   de qualquer pagina nova e aparecer.

   A ROTA CONTINUA DE PE. Esconder tira do menu, e nao do sistema: quem tem o
   endereco ainda abre, e e assim que voce consegue conferir a pagina guardada
   sem religar ela para a fabrica inteira. */

let paginas: Set<string> | null = null

export async function paginasEscondidas(): Promise<Set<string>> {
  if (paginas) return paginas
  try {
    const linhas = await tabela<{ valor: string }[]>('regulagem?select=valor&chave=eq.paginas')
    paginas = new Set(
      (linhas[0]?.valor ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    )
  } catch {
    /* Sem resposta do banco, nada some. O padrao prudente aqui e o contrario
       do ensaio: menu a mais e incomodo, menu a menos e gente sem conseguir
       trabalhar. */
    paginas = new Set()
  }
  return paginas
}

/** Liga ou desliga uma pagina. So admin passa pela regra de acesso do banco. */
export async function mostrarPagina(chave: string, ligada: boolean): Promise<Set<string>> {
  const atual = new Set(await paginasEscondidas())
  if (ligada) atual.delete(chave)
  else atual.add(chave)
  const valor = [...atual].sort().join(',')
  /* upsert numa chave so: a linha pode nunca ter existido. O cabecalho de
     resolucao e o que transforma o insert em update quando ela ja existe. */
  await tabela('regulagem?on_conflict=chave', {
    metodo: 'POST',
    mesclar: true,
    corpo: { chave: 'paginas', valor, nota: 'paginas escondidas do menu' },
  })
  paginas = atual
  return atual
}
