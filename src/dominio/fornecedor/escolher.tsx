import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Flutuante, semAcento } from '@ds'
import {
  COR_DA_SITUACAO,
  NOME_DA_SITUACAO,
  combinaComFornecedor,
  situacaoDe,
  type Fornecedor,
} from './index'
import './fornecedor.css'

/* ==========================================================================
   Escolher o fornecedor, e criar na hora quando ele ainda não existe.

   É a peça que liga as outras páginas a esta lista. Quem registra uma entrada
   no estoque diz de quem veio; se o nome não está aqui, ele nasce no mesmo
   lugar, sem a pessoa sair da entrada para ir cadastrar e voltar.

   A LISTA ABRE COM QUEM JÁ FORNECE AQUILO. Para um tecido, primeiro quem já
   entregou aquele tecido, depois os outros fornecedores de tecido, e só então
   o resto. O nome certo quase sempre está nas duas primeiras linhas.

   QUEM NASCE AQUI NASCE "NOVO", sem CNPJ, e é assim de propósito: o estoque
   não é o lugar de conferir CNPJ. Ele aparece em Fornecedores pedindo o CNPJ,
   e o primeiro boleto dele pede aprovação.

   BLOQUEADO NÃO APARECE. O banco recusa a entrada de um fornecedor bloqueado
   (041), e oferecer na lista o que vai ser recusado é armar o erro.
   ========================================================================== */

export function EscolherFornecedor({
  valor,
  aoEscolher,
  fornecedores,
  jaFornecem,
  tipo,
  nomeDoTipo,
  oQue = 'este material',
  apoio,
  aoCriar,
}: {
  /** o id escolhido, ou vazio */
  valor: string
  aoEscolher: (id: string) => void
  fornecedores: Fornecedor[]
  /** os ids de quem já entrega este material, na ordem em que entregaram */
  jaFornecem: string[]
  /** a chave do tipo que este material pede: tecido, aviamento, insumo */
  tipo: string
  nomeDoTipo: string
  /** "este tecido", "este material": como a lista chama o que está entrando */
  oQue?: string
  /** a linha miúda embaixo do nome escolhido */
  apoio?: (f: Fornecedor) => string
  /** cria e devolve o id; quando ausente, a lista não oferece criar */
  aoCriar?: (nome: string) => Promise<string>
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [criando, setCriando] = useState(false)
  const [falha, setFalha] = useState('')
  const bt = useRef<HTMLButtonElement>(null)

  const escolhido = fornecedores.find((f) => f.id === valor) ?? null

  const grupos = useMemo(() => {
    const vivos = fornecedores.filter((f) => f.gravada !== 'bloqueado' && combinaComFornecedor(f, busca))
    const ja = jaFornecem
      .map((id) => vivos.find((f) => f.id === id))
      .filter((f): f is Fornecedor => !!f)
    const doTipo = vivos.filter((f) => !jaFornecem.includes(f.id) && f.tipos.includes(tipo))
    const resto = vivos.filter((f) => !jaFornecem.includes(f.id) && !f.tipos.includes(tipo))
    return [
      { titulo: `Já fornecem ${oQue}`, itens: ja },
      { titulo: `Outros de ${nomeDoTipo.toLowerCase()}`, itens: doTipo },
      { titulo: 'Outros fornecedores', itens: resto },
    ].filter((g) => g.itens.length > 0)
  }, [fornecedores, jaFornecem, tipo, nomeDoTipo, oQue, busca])

  const nome = busca.trim()
  const jaExiste = !!nome && fornecedores.some((f) => semAcento(f.nome) === semAcento(nome))

  function fechar() {
    setAberto(false)
    setBusca('')
    setFalha('')
  }

  async function criar() {
    if (!aoCriar || !nome || criando) return
    setCriando(true)
    setFalha('')
    try {
      const id = await aoCriar(nome)
      aoEscolher(id)
      fechar()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui criar o fornecedor.')
    } finally {
      setCriando(false)
    }
  }

  return (
    <span className={['fn-escolher', aberto ? 'aberto' : ''].filter(Boolean).join(' ')}>
      <button
        ref={bt}
        type="button"
        className={['fn-gatilho', escolhido ? 'cheio' : ''].filter(Boolean).join(' ')}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <span className="fn-gatilho-texto">
          {escolhido ? (
            <>
              <b>{escolhido.nome}</b>
              {apoio ? <small>{apoio(escolhido)}</small> : null}
            </>
          ) : (
            <span className="fn-gatilho-vazio">Escolha de quem veio</span>
          )}
        </span>
        <Seta />
      </button>

      <Flutuante aberto={aberto} ancora={bt} aoFechar={fechar} opcoes={{ maior: true }} versao={busca}>
        <div className="mn-topo">
          <div className={['mn-busca', busca ? 'tem' : ''].filter(Boolean).join(' ')}>
            <Lupa />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nome && !jaExiste && aoCriar && grupos.length === 0) {
                  e.preventDefault()
                  void criar()
                }
              }}
              placeholder="Buscar ou escrever um nome novo"
              aria-label="Buscar fornecedor"
            />
            <button type="button" className="mn-limpa" aria-label="Limpar a busca" onClick={() => setBusca('')}>
              &times;
            </button>
          </div>
        </div>
        <div className="mn-lista">
          {valor ? (
            <button
              type="button"
              className="mn-item"
              onClick={() => {
                aoEscolher('')
                fechar()
              }}
            >
              <span className="nm">Sem fornecedor</span>
            </button>
          ) : null}
          {grupos.map((g) => (
            <div key={g.titulo} className="fn-grupo">
              <span className="mn-sep">{g.titulo}</span>
              {g.itens.map((f) => {
                const s = situacaoDe(f)
                return (
                  <button
                    type="button"
                    key={f.id}
                    className={['mn-item', f.id === valor ? 'on' : ''].filter(Boolean).join(' ')}
                    onClick={() => {
                      aoEscolher(f.id)
                      fechar()
                    }}
                  >
                    <span className="nm">{f.nome}</span>
                    <span className="fn-situacao" style={{ '--c': COR_DA_SITUACAO[s] } as CSSProperties}>
                      <i />
                      {NOME_DA_SITUACAO[s]}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
          {grupos.length === 0 && !nome ? (
            <div className="mn-vazio">Nenhum fornecedor cadastrado ainda. Escreva o nome para criar.</div>
          ) : null}
          {grupos.length === 0 && nome && (jaExiste || !aoCriar) ? (
            <div className="mn-vazio">Nada com esse nome</div>
          ) : null}
          {aoCriar && nome && !jaExiste ? (
            <button type="button" className="mn-item mn-novo" onClick={criar} disabled={criando}>
              <span className="fn-mais" aria-hidden="true">
                +
              </span>
              <span className="nm">
                {criando ? 'Criando' : `Criar fornecedor novo com o nome "${nome}"`}
              </span>
            </button>
          ) : null}
          {falha ? <div className="fn-falha">{falha}</div> : null}
        </div>
      </Flutuante>
    </span>
  )
}

function Seta() {
  return (
    <svg className="fn-seta" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Lupa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

/** O ponto colorido e o nome da situação, do jeito que a lista e a ficha mostram. */
export function SituacaoDoFornecedor({ f, texto }: { f: Pick<Fornecedor, 'gravada' | 'cnpj'>; texto?: string }) {
  const s = situacaoDe(f)
  return (
    <span className="fn-situacao forte" style={{ '--c': COR_DA_SITUACAO[s] } as CSSProperties}>
      <i />
      {texto ?? NOME_DA_SITUACAO[s]}
    </span>
  )
}
