import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Tag } from '@phosphor-icons/react'
import { Aviso, Botao, Chip, Interruptor, LogoFourtime, Pagina, TituloCartao, Vazio } from '@ds'
import { formatarNumeroExato } from '@shared'
import { imprimir } from '@dominio/layout'
import { EMPRESA } from '@dominio/empresa'
import { useSessao } from '@dominio/sessao'
import { carregarTabelasDePreco, celula, nomeDaFaixa, type TabelaDePreco } from '@dominio/preco'
import { contextoDe, linhasDe, usarCatalogo } from './catalogo'
import './precos.css'
import './papel.css'

/* ==========================================================================
   A TABELA IMPRESSA (prancha 138): folha A4 em Roboto, branca nos dois temas,
   como a folha da cotação. Só preço: o que é interno não sai. À direita, o
   que sai na folha e quais grupos e faixas.

   Mais de uma página: o cabeçalho das colunas se repete (thead) e um grupo
   não se parte no meio quando cabe inteiro na página seguinte.
   ========================================================================== */

export function TelaTabelaImpressa() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null
  const [tabela, setTabela] = useState<TabelaDePreco | null>(null)
  const [lendo, setLendo] = useState(true)
  const [semBanco, setSemBanco] = useState(false)
  const { catalogo } = usarCatalogo()

  const [codigo, setCodigo] = useState(true)
  const [descricao, setDescricao] = useState(true)
  const [pe, setPe] = useState(true)
  const [vendedor, setVendedor] = useState(true)
  const [foraGrupos, setForaGrupos] = useState<string[]>([])
  const [foraFaixas, setForaFaixas] = useState<number[]>([])

  useEffect(() => {
    let vivo = true
    carregarTabelasDePreco()
      .then((r) => {
        if (!vivo) return
        setSemBanco(r.semBanco)
        setTabela(r.tabelas.find((t) => t.id === id) ?? null)
      })
      .catch(() => vivo && setTabela(null))
      .finally(() => vivo && setLendo(false))
    return () => {
      vivo = false
    }
  }, [id])

  const linhas = useMemo(() => (tabela ? linhasDe(tabela, catalogo) : []), [tabela, catalogo])
  const ctx = useMemo(() => (tabela ? contextoDe(tabela, catalogo) : null), [tabela, catalogo])
  const grupos = [...new Set(linhas.map((l) => l.grupo))]

  if (!tabela || !ctx) {
    return (
      <Pagina acima="Comercial · Tabelas de preço" titulo="Imprimir a tabela">
        {semBanco ? (
          <Aviso tom="warn" titulo="As tabelas de preço ainda não estão no banco">
            Falta rodar a migração 068 no Supabase.
          </Aviso>
        ) : (
          <Vazio titulo={lendo ? 'Lendo a tabela...' : 'Tabela não encontrada'} />
        )}
      </Pagina>
    )
  }

  const faixas = tabela.faixas.map((f, i) => ({ f, i })).filter(({ i }) => !foraFaixas.includes(i))
  const visiveis = linhas.filter((l) => !foraGrupos.includes(l.grupo))
  const porGrupo = grupos.filter((g) => !foraGrupos.includes(g)).map((g) => [g, visiveis.filter((l) => l.grupo === g)] as const)
  const r = tabela.regras
  const menos = (p: number) => (p < 0 ? `${-p}% a menos` : `${p}% a mais`)

  return (
    <Pagina
      acima="Comercial · Tabelas de preço"
      titulo={'Imprimir a ' + tabela.nome}
      sub="A folha que vai para o cliente: só preço"
      acoes={
        <Botao tom="contorno" onClick={() => navegar('/tabelas?t=' + tabela.id)}>
          <ArrowLeft size={18} />
          Voltar à tabela
        </Botao>
      }
    >
      <div className="pr-imp">
        <div className="pr-palco">
          <article className="pr-folha" aria-label={'Tabela de preços ' + tabela.nome}>
            <header className="pr-f-cab">
              <LogoFourtime />
              <div>
                <h1>Tabela de preços · {tabela.nome}</h1>
                <p>Uniformes e kits esportivos personalizados · preço por peça</p>
              </div>
            </header>
            <div className="pr-f-info">
              <div>
                <small>Vale até</small>
                <b>{tabela.valeAte ? tabela.valeAte.split('-').reverse().join('/') : 'sem data'}</b>
              </div>
              <div>
                <small>Preço por</small>
                <b>faixa de peças do pedido</b>
              </div>
              {vendedor && eu ? (
                <div>
                  <small>Vendedor</small>
                  <b>{eu.nome}</b>
                </div>
              ) : null}
            </div>
            <table className="pr-f-tab">
              <thead>
                <tr>
                  {codigo ? <th className="pr-f-cod">Código</th> : null}
                  <th className="pr-f-peca">Peça</th>
                  {faixas.map(({ f }) => (
                    <th key={nomeDaFaixa(f)}>{nomeDaFaixa(f)}</th>
                  ))}
                </tr>
              </thead>
              {porGrupo.map(([g, ls]) => (
                <tbody key={g} className="pr-f-grupo">
                  <tr className="pr-f-g">
                    <td colSpan={faixas.length + (codigo ? 2 : 1)}>{g}</td>
                  </tr>
                  {ls.map((l) => (
                    <tr key={l.item.codigo}>
                      {codigo ? <td className="pr-f-cod">{l.item.codigo}</td> : null}
                      <td className="pr-f-peca">
                        {l.nome}
                        {descricao && l.sub ? <span>{l.sub}</span> : null}
                      </td>
                      {faixas.map(({ f, i }) => {
                        const v = celula(tabela, l.item, i, ctx).valor
                        return <td key={nomeDaFaixa(f)}>{v == null ? 'a consultar' : 'R$ ' + formatarNumeroExato(v)}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
            {pe ? (
              <div className="pr-f-obs">
                <div>
                  <h4>Tamanhos</h4>
                  <ol>
                    <li>Adulto pelo preço da tabela.</li>
                    {r.plusReais ? <li>Plus G1 a G4: mais R$ {formatarNumeroExato(r.plusReais)} por peça.</li> : null}
                    {r.infantilPct ? <li>Infantil 2 a 14 anos: {menos(r.infantilPct)}.</li> : null}
                  </ol>
                </div>
                <div>
                  <h4>Condições</h4>
                  <ol>
                    <li>A faixa vale pelo total de peças do pedido.</li>
                    {tabela.observacao ? <li>{tabela.observacao}</li> : null}
                  </ol>
                </div>
              </div>
            ) : null}
            <footer className="pr-f-pe">
              <span>{[EMPRESA.nome || 'Fourtime', EMPRESA.cnpj, 'fourtimefit.com.br'].filter(Boolean).join(' · ')}</span>
              <span>{tabela.nome}</span>
            </footer>
          </article>
        </div>

        <aside className="pilha pr-col fl-nao-imprime">
          <div className="cartao cartao-pad pilha pr-bloco">
            <TituloCartao icone={Printer}>O que sai na folha</TituloCartao>
            <Interruptor ligado={codigo} aoMudar={setCodigo} rotulo="Código da peça" />
            <Interruptor ligado={descricao} aoMudar={setDescricao} rotulo="Descrição embaixo do nome" />
            <Interruptor ligado={pe} aoMudar={setPe} rotulo="Tamanhos e condições no pé" />
            <Interruptor ligado={vendedor} aoMudar={setVendedor} rotulo="Nome de quem imprime, como vendedor" />
          </div>
          <div className="cartao cartao-pad pilha pr-bloco">
            <TituloCartao icone={Tag}>Quais peças</TituloCartao>
            <div className="fileira">
              {grupos.map((g) => (
                <Chip
                  key={g}
                  ligado={!foraGrupos.includes(g)}
                  onClick={() => setForaGrupos((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))}
                >
                  {g}
                </Chip>
              ))}
            </div>
            <div className="fileira">
              {tabela.faixas.map((f, i) => (
                <Chip
                  key={nomeDaFaixa(f)}
                  ligado={!foraFaixas.includes(i)}
                  onClick={() =>
                    setForaFaixas((x) =>
                      x.includes(i) ? x.filter((y) => y !== i) : x.length < tabela.faixas.length - 1 ? [...x, i] : x,
                    )
                  }
                >
                  {nomeDaFaixa(f)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="cartao cartao-pad pilha pr-bloco">
            <p className="pr-nota">Sai em Roboto, papel branco nos dois temas. Para PDF, escolha "Salvar como PDF" na impressora.</p>
            <Botao tom="primario" onClick={imprimir}>
              <Printer size={18} />
              Imprimir
            </Botao>
          </div>
        </aside>
      </div>
    </Pagina>
  )
}
