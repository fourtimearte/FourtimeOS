import { CaretRight } from '@phosphor-icons/react'
import { LINHA_ESCOLHIDA, Segmentado, Vazio } from '@ds'
import {
  NOME_DO_GENERO,
  codigoCurto,
  emBranco,
  faltaEmPalavras,
  faltasDoKit,
  kitEmBranco,
  oQueFalta,
  type GrupoDeReferencia,
  type KitNaLista,
  type ReferenciaNaFicha,
} from '@dominio/produto'
import { plural } from './apoio'
import { emKits, emPecas } from './vendas'

/* ==========================================================================
   A primeira coluna: Referências e Kits em abas, e os grupos em sanfona.

   ABRIR NÃO É ESCOLHER, como no Estoque. O grupo abre e fecha; o clique no
   nome da peça escolhe, e aí o lado direito da página vira a ficha dela.

   FICHA EM BRANCO NÃO É ALERTA. No dia em que a página nasceu as 112
   referências estavam em branco, e 112 pontos vermelhos não avisam nada. O
   ponto vermelho é da ficha que alguém COMEÇOU e não terminou: ele diz
   quantas coisas faltam (medidas, tecido, molde), e a linha diz quais.

   O QUE VENDEU NO MÊS fica do lado do nome: quem abre um grupo vê de uma vez
   qual peça dele está saindo. Peça que não vendeu no mês não ganha um zero.
   ========================================================================== */

export type Lista = 'referencias' | 'kits'

/** o grupo de quem não tem grupo, ou tem um que saiu do cadastro */
const SEM_GRUPO = ''

type Gaveta = { cod: string; nome: string; itens: ReferenciaNaFicha[] }

function emGavetas(grupos: GrupoDeReferencia[], referencias: ReferenciaNaFicha[]): Gaveta[] {
  const conhecidos = new Set(grupos.map(g => g.cod))
  const gavetas: Gaveta[] = grupos.map(g => ({
    cod: g.cod,
    nome: g.nome,
    itens: referencias.filter(r => r.grupo === g.cod),
  }))
  const soltas = referencias.filter(r => !r.grupo || !conhecidos.has(r.grupo))
  if (soltas.length) gavetas.push({ cod: SEM_GRUPO, nome: 'Sem grupo', itens: soltas })
  return gavetas
}

/** quantas coisas faltam numa ficha que já foi começada; em branco não conta */
const pendencias = (r: ReferenciaNaFicha) => (emBranco(r) ? 0 : oQueFalta(r).length)

function Alerta({ n, frase }: { n: number; frase?: string }) {
  return (
    <span className={n ? 'pd-alerta' : 'pd-alerta nada'} aria-label={n ? frase : undefined}>
      <i />
      {n}
    </span>
  )
}

/** quanto saiu no mês, do lado do nome */
function NoMes({ quanto }: { quanto: string }) {
  return (
    <span className="pd-fim" data-no-mes="">
      <b>{quanto}</b>
      <small>no mês</small>
    </span>
  )
}

function Linha({
  r,
  escolhida,
  aoEscolher,
  noMes,
}: {
  r: ReferenciaNaFicha
  escolhida: boolean
  aoEscolher: () => void
  noMes: number
}) {
  const falta = oQueFalta(r)
  const branco = emBranco(r)
  const n = pendencias(r)
  return (
    <div className={escolhida ? 'pd-t pd-sel ' + LINHA_ESCOLHIDA : 'pd-t'} data-ref={codigoCurto(r.cod)}>
      <span className="pd-t-seta" aria-hidden="true" />
      <button type="button" className="pd-t-nome" aria-pressed={escolhida} onClick={aoEscolher}>
        <span className="pd-nomes">
          <b>{r.nome}</b>
          <small className={n ? 'pd-falta' : undefined}>
            {codigoCurto(r.cod)} · {NOME_DO_GENERO[r.genero] ?? r.genero}
            {branco ? ' · ficha em branco' : falta.length ? ' · ' + faltaEmPalavras(falta) : ''}
          </small>
        </span>
        {noMes ? <NoMes quanto={emPecas(noMes)} /> : null}
        {n ? <Alerta n={n} frase={faltaEmPalavras(falta)} /> : null}
      </button>
    </div>
  )
}

function LinhaDoKit({
  k,
  escolhido,
  aoEscolher,
  noMes,
}: {
  k: KitNaLista
  escolhido: boolean
  aoEscolher: () => void
  noMes: number
}) {
  const branco = kitEmBranco(k)
  const n = branco || !k.pecas ? 0 : faltasDoKit(k)
  return (
    <div className={escolhido ? 'pd-t pd-solta-na-lista pd-sel ' + LINHA_ESCOLHIDA : 'pd-t pd-solta-na-lista'} data-kit={codigoCurto(k.cod)}>
      <button type="button" className="pd-t-nome" aria-pressed={escolhido} onClick={aoEscolher}>
        <span className="pd-nomes">
          <b>{k.nome}</b>
          <small className={n ? 'pd-falta' : undefined}>
            {k.pecas
              ? plural(k.pecas, 'peça', 'peças') + ' · ' + k.pecasCod.map(codigoCurto).join(' + ')
              : 'sem as peças'}
            {!k.pecas ? '' : branco ? ' · ficha em branco' : n ? ' · ' + plural(n, 'coisa por fazer', 'coisas por fazer') : ''}
          </small>
        </span>
        {noMes ? <NoMes quanto={emKits(noMes)} /> : null}
        {n ? <Alerta n={n} frase={plural(n, 'coisa por fazer', 'coisas por fazer')} /> : null}
      </button>
    </div>
  )
}

export function Arvore({
  grupos,
  referencias,
  haReferencias,
  kits,
  haKits,
  termo,
  lista,
  aoTrocarLista,
  abertos,
  aoAbrir,
  escolhida,
  aoEscolher,
  kitEscolhido,
  aoEscolherKit,
  pecasNoMes,
  kitsNoMes,
}: {
  grupos: GrupoDeReferencia[]
  /** já filtradas pela busca */
  referencias: ReferenciaNaFicha[]
  /** existe alguma referência, antes da busca */
  haReferencias: boolean
  /** os kits, já filtrados pela busca */
  kits: KitNaLista[]
  haKits: boolean
  termo: string
  lista: Lista
  aoTrocarLista: (l: Lista) => void
  abertos: Set<string>
  aoAbrir: (cod: string) => void
  escolhida: string
  aoEscolher: (id: string) => void
  kitEscolhido: string
  aoEscolherKit: (id: string) => void
  /** as peças de cada referência vendidas no mês, pelo id; vazio enquanto as vendas não chegam */
  pecasNoMes: Map<string, number>
  /** os kits vendidos no mês, pelo id do kit */
  kitsNoMes: Map<string, number>
}) {
  const gavetas = emGavetas(grupos, referencias).filter(g => !termo || g.itens.length)

  return (
    <section className="cartao pd-col pd-arvore" data-arvore="">
      <div className="pd-abas">
        <Segmentado
          className="pd-seg"
          valor={lista}
          aoMudar={aoTrocarLista}
          opcoes={[
            {
              valor: 'referencias',
              rotulo: (
                <>
                  Referências <small>{referencias.length}</small>
                </>
              ),
            },
            {
              valor: 'kits',
              rotulo: (
                <>
                  Kits <small>{kits.length}</small>
                </>
              ),
            },
          ]}
        />
      </div>

      {lista === 'kits' ? (
        !haKits ? (
          <Vazio
            titulo="Nenhum kit cadastrado"
            texto="O kit junta duas ou mais referências numa ficha de fabricação só: camiseta e calção, agasalho. Monte o primeiro em Novo kit."
          />
        ) : !kits.length ? (
          <Vazio titulo="Nenhum kit com esse nome" texto="Tente o nome do kit ou o código de uma das peças dele." />
        ) : (
          <div className="pd-kits">
            {kits.map(k => (
              <LinhaDoKit
                key={k.id}
                k={k}
                escolhido={k.id === kitEscolhido}
                aoEscolher={() => aoEscolherKit(k.id)}
                noMes={kitsNoMes.get(k.id) ?? 0}
              />
            ))}
          </div>
        )
      ) : !haReferencias ? (
        <Vazio
          titulo="Nenhuma referência cadastrada"
          texto="A referência é a peça que a fábrica faz: uma camiseta, um calção, um moletom. Cadastre a primeira em Nova referência."
        />
      ) : !gavetas.length ? (
        <Vazio titulo="Nada com esse nome" texto="Tente o nome da peça ou um pedaço do código, como 010 ou 000M." />
      ) : (
        gavetas.map(g => {
          /* com busca, todo grupo que sobrou fica aberto: quem buscou quer ver o que achou */
          const aberto = !!termo || abertos.has(g.cod)
          const faltam = g.itens.filter(r => pendencias(r) > 0).length
          return (
            <div className="pd-gaveta" key={g.cod || 'sem-grupo'}>
              <button
                type="button"
                className={aberto ? 'pd-g aberto' : 'pd-g'}
                aria-expanded={aberto}
                data-grupo={g.cod}
                onClick={() => aoAbrir(g.cod)}
              >
                <CaretRight
                  size={14}
                  weight="bold"
                  className={aberto ? 'pd-seta aberta' : 'pd-seta'}
                  aria-hidden="true"
                />
                <span className={g.cod ? 'pd-cod' : 'pd-cod sem'}>{g.cod || 'sem'}</span>
                <b>{g.nome}</b>
                <span className="pd-conta">{plural(g.itens.length, 'referência', 'referências')}</span>
                <Alerta
                  n={faltam}
                  frase={plural(faltam, 'ficha começada e incompleta', 'fichas começadas e incompletas')}
                />
              </button>
              {aberto ? (
                <div className="pd-dentro">
                  {g.itens.map(r => (
                    <Linha
                      key={r.id}
                      r={r}
                      escolhida={r.id === escolhida}
                      aoEscolher={() => aoEscolher(r.id)}
                      noMes={pecasNoMes.get(r.id) ?? 0}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })
      )}
    </section>
  )
}
