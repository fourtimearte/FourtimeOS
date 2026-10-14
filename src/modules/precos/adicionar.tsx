import { useState } from 'react'
import type { RefObject } from 'react'
import { CaretRight, Plus } from '@phosphor-icons/react'
import { Botao, Busca, Entrada, Flutuante, Marcacao, Segmentado, avisar, useSelecaoDeLinhas } from '@ds'
import { numeroDoTexto, type EntradaDoCatalogo } from '@dominio/preco'
import { achaNaBusca, type GrupoDoCatalogo } from './catalogo'

/* ==========================================================================
   ADICIONAR REFERÊNCIA OU KIT, AGRUPADO (prancha 140): como o menu de
   referência da cotação, os grupos da ficha técnica com o código na caixa,
   em sanfona. Marca-se o grupo inteiro ou peça por peça; o que já está na
   tabela aparece apagado. Embaixo, um preço base opcional para todas as
   marcadas e "Pôr na tabela".
   ========================================================================== */

export function AdicionarDoCatalogo({
  aberto,
  ancora,
  grupos,
  naTabela,
  aoFechar,
  aoPor,
}: {
  aberto: boolean
  ancora: RefObject<HTMLElement | null>
  grupos: GrupoDoCatalogo[]
  naTabela: Set<string>
  aoFechar: () => void
  aoPor: (entradas: EntradaDoCatalogo[], base: number | null) => void
}) {
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'ref' | 'kit'>('ref')
  const [abertos, setAbertos] = useState<string[]>([])
  const [marcados, setMarcados] = useState<string[]>([])
  const [base, setBase] = useState('')

  const daAba = grupos.filter((g) => (aba === 'kit' ? g.cod === 'KIT' : g.cod !== 'KIT'))
  const comBusca = daAba
    .map((g) => ({ ...g, pecas: g.pecas.filter((p) => achaNaBusca(busca, p.codigo, p.nome, g.cod, g.nome)) }))
    .filter((g) => g.pecas.length)
  const todas = grupos.flatMap((g) => g.pecas)
  /* a seleção do Kit de Comportamento: o Shift pega a faixa das peças à vista
     (grupos abertos, fora as que já estão na tabela); Esc solta; Ctrl+A marca */
  const abertoNaTela = (cod: string) => !!busca.trim() || abertos.includes(cod) || comBusca.length === 1
  const selecao = useSelecaoDeLinhas(
    comBusca.flatMap((g) => (abertoNaTela(g.cod) ? g.pecas.filter((p) => !naTabela.has(p.codigo)).map((p) => p.codigo) : [])),
    marcados,
    setMarcados,
  )
  const nRef = grupos.filter((g) => g.cod !== 'KIT').reduce((n, g) => n + g.pecas.length, 0)
  const nKit = grupos.find((g) => g.cod === 'KIT')?.pecas.length ?? 0

  function por() {
    const v = base.trim() ? numeroDoTexto(base) : null
    if (v != null && (!Number.isFinite(v) || v < 0)) return avisar('O preço base é um número, como 49,90', 'warn')
    const entradas = todas.filter((p) => marcados.includes(p.codigo)).map((p) => ({ codigo: p.codigo, tipo: p.tipo }))
    aoPor(entradas, v)
    setMarcados([])
    setBase('')
  }

  return (
    <Flutuante
      aberto={aberto}
      ancora={ancora}
      aoFechar={aoFechar}
      opcoes={{ alinhar: 'direita', largura: 560, maior: true }}
      className="pr-ad"
      versao={abertos.join() + '|' + busca + '|' + aba}
    >
      <div className="pilha pr-ad-topo">
        <Busca
          autoFocus
          placeholder="Buscar código, nome ou grupo"
          aria-label="Buscar no catálogo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Segmentado<'ref' | 'kit'>
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: 'ref', rotulo: `Referências ${nRef}` },
            { valor: 'kit', rotulo: `Kits ${nKit}` },
          ]}
        />
      </div>
      <div className="pr-ad-lista" onKeyDown={selecao.naTecla}>
        {comBusca.length === 0 ? <p className="pr-nada">Nada no catálogo com isso.</p> : null}
        {comBusca.map((g) => {
          const livres = g.pecas.filter((p) => !naTabela.has(p.codigo)).map((p) => p.codigo)
          const quantos = livres.filter((c) => marcados.includes(c)).length
          const aberta = !!busca.trim() || abertos.includes(g.cod) || comBusca.length === 1
          const jaTem = g.pecas.length - livres.length
          return (
            <div key={g.cod} className="pr-ad-g">
              <div className="pr-ad-gcab">
                <button
                  type="button"
                  className={'pr-ad-seta' + (aberta ? ' aberta' : '')}
                  aria-label={(aberta ? 'Fechar ' : 'Abrir ') + g.nome}
                  aria-expanded={aberta}
                  onClick={() => setAbertos((a) => (a.includes(g.cod) ? a.filter((x) => x !== g.cod) : [...a, g.cod]))}
                >
                  <CaretRight size={14} />
                </button>
                <Marcacao
                  aria-label={'Marcar o grupo ' + g.nome}
                  disabled={!livres.length}
                  checked={!!livres.length && quantos === livres.length}
                  meio={quantos > 0 && quantos < livres.length}
                  onChange={() =>
                    setMarcados((m) => (quantos === livres.length ? m.filter((c) => !livres.includes(c)) : [...new Set([...m, ...livres])]))
                  }
                />
                <span className={'pr-gcod' + (quantos ? ' ligado' : '')}>{g.cod === 'sem' ? '...' : g.cod}</span>
                <b>{g.nome}</b>
                <small>
                  {g.pecas.length} {g.pecas.length === 1 ? 'peça' : 'peças'} ·{' '}
                  {jaTem ? `${jaTem} já na tabela` : 'nenhuma na tabela'}
                </small>
              </div>
              {aberta
                ? g.pecas.map((p) => {
                    const ja = naTabela.has(p.codigo)
                    const marcada = marcados.includes(p.codigo)
                    return (
                      <label key={p.codigo} className={'pr-ad-p' + (ja ? ' ja' : marcada ? ' marcada' : '')}>
                        <Marcacao
                          aria-label={'Marcar ' + p.codigo}
                          disabled={ja}
                          checked={marcada}
                          onChange={() => {}}
                          onClick={(e) => selecao.naCaixa(p.codigo, e)}
                        />
                        <span className="pr-cod">{p.codigo}</span>
                        <b className="corta">{p.nome}</b>
                        <small>{ja ? 'já na tabela' : p.sub}</small>
                      </label>
                    )
                  })
                : null}
            </div>
          )
        })}
      </div>
      <div className="fileira pr-ad-pe">
        <b>
          {marcados.length} {marcados.length === 1 ? 'marcada' : 'marcadas'}
        </b>
        <Entrada
          className="pr-ad-base"
          inputMode="decimal"
          aria-label="Preço base para as marcadas (opcional)"
          placeholder="Preço base (opcional)"
          value={base}
          onChange={(e) => setBase(e.target.value)}
        />
        <Botao tom="primario" tamanho="sm" disabled={!marcados.length} onClick={por}>
          <Plus size={15} />
          {marcados.length > 1 ? `Pôr as ${marcados.length} na tabela` : 'Pôr na tabela'}
        </Botao>
      </div>
    </Flutuante>
  )
}
