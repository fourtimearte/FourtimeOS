import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import {
  Amostra,
  Botao,
  Busca,
  CampoDeCelula,
  Entrada,
  Marcacao,
  Vazio,
  avisar,
  lerNumero,
  useSelecaoDeLinhas,
  usarAlcaDeCelulas,
  usarEdicaoDeCelulas,
} from '@ds'
import { carregarHierarquiaDeTecido, carregarMateriais } from '@dominio/estoque'
import { chaveDoTecido, comPrecoDoTecido, valorDoTecido, type TabelaDePreco } from '@dominio/preco'
import { achaNaBusca } from './catalogo'

/* ==========================================================================
   A ABA MATERIAL (083, tela 2 do wireframe de 16/10/2026): os tecidos do
   Estoque, por grupo, com o que cada um soma na peça. O tecido escolhido no
   layout da cotação puxa este valor; com dois tecidos no layout, vale o mais
   caro.

   O comportamento é o do resto do sistema (Kit, seções 2 e 3): a célula se
   escreve como planilha, a alça repete o valor, marcar várias linhas abre a
   barra escura e um valor vale para todas de uma vez. Apagar o valor tira o
   tecido da tabela: ele deixa de somar.
   ========================================================================== */

type LinhaDoTecido = { id: string; nome: string; grupo: string; cores: string[] }

export function AbaMaterial({
  tabela,
  podeMexer,
  mudar,
}: {
  tabela: TabelaDePreco
  podeMexer: boolean
  mudar: (f: (x: TabelaDePreco) => TabelaDePreco) => void
}) {
  const [linhas, setLinhas] = useState<LinhaDoTecido[]>([])
  const [grupos, setGrupos] = useState<{ cod: string; nome: string }[]>([])
  const [lendo, setLendo] = useState(true)
  const [busca, setBusca] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])
  const [valorDoLote, setValorDoLote] = useState('')

  useEffect(() => {
    let vivo = true
    void (async () => {
      const [h, mats] = await Promise.all([carregarHierarquiaDeTecido(), carregarMateriais().catch(() => [])])
      if (!vivo) return
      const cores = new Map<string, string[]>()
      for (const m of mats)
        if (m.tecidoId && m.corHex) {
          const l = cores.get(m.tecidoId) ?? []
          if (!l.includes(m.corHex)) l.push(m.corHex)
          cores.set(m.tecidoId, l)
        }
      setGrupos(h.grupos)
      setLinhas(h.tecidos.filter((t) => t.ativo).map((t) => ({ id: t.id, nome: t.nome, grupo: t.grupo, cores: cores.get(t.id) ?? [] })))
      setLendo(false)
    })()
    return () => {
      vivo = false
    }
  }, [])

  /* o tecido que está na tabela e não está mais no Estoque continua à vista, no fim */
  const todas = useMemo(() => {
    const ks = new Set(linhas.map((l) => chaveDoTecido(l.nome)))
    const soltos = tabela.adicionais.materiais
      .filter((m) => !ks.has(chaveDoTecido(m.tecido)))
      .map((m) => ({ id: 'solto:' + m.tecido, nome: m.tecido, grupo: '', cores: [] }))
    return [...linhas, ...soltos]
  }, [linhas, tabela.adicionais.materiais])

  const nomeDoGrupo = (cod: string) => grupos.find((g) => g.cod === cod)?.nome ?? ''
  const visiveis = todas.filter((l) => achaNaBusca(busca, l.nome, l.grupo, nomeDoGrupo(l.grupo)))
  const porGrupo: [string, LinhaDoTecido[]][] = []
  for (const cod of [...grupos.map((g) => g.cod), '']) {
    const ls = visiveis.filter((l) => (l.grupo || '') === cod || (cod === '' && !grupos.some((g) => g.cod === l.grupo)))
    if (ls.length) porGrupo.push([cod, ls])
  }
  const ordem = porGrupo.flatMap(([, ls]) => ls.map((l) => l.id))
  const nomeDe = (id: string) => todas.find((l) => l.id === id)?.nome ?? ''
  const valorDe = (id: string) => valorDoTecido(tabela.adicionais, nomeDe(id)) ?? null
  const gravar = (ids: string[], v: number | null) =>
    mudar((x) => {
      const nomes = ids.map(nomeDe).filter(Boolean)
      const a = comPrecoDoTecido(x.adicionais, nomes, v)
      /* apagar o valor tira o tecido: ele deixa de somar */
      return { ...x, adicionais: v == null ? { ...a, materiais: a.materiais.filter((m) => m.valor != null) } : a }
    })

  const edicao = usarEdicaoDeCelulas({
    ordem,
    colunas: 1,
    valorDe: (id) => valorDe(id),
    aoEscrever: (id, _c, v) => gravar([id], v),
    aoColar: (id, _c, texto) => {
      const valores = texto.replace(/\r/g, '').split('\n').filter((l, i, a) => l.trim() || i < a.length - 1).map((l) => lerNumero(l.split('\t')[0]))
      const i0 = ordem.indexOf(id)
      let n = 0
      mudar((x) => {
        let a = x.adicionais
        valores.forEach((v, k) => {
          const alvo = ordem[i0 + k]
          if (!alvo || (v != null && !(Number.isFinite(v) && v >= 0))) return
          a = comPrecoDoTecido(a, [nomeDe(alvo)], v)
          n++
        })
        return { ...x, adicionais: { ...a, materiais: a.materiais.filter((m) => m.valor != null) } }
      })
      setTimeout(() => avisar(`${n} ${n === 1 ? 'valor colado' : 'valores colados'} da planilha`, 'ok'), 0)
    },
  })
  const alca = usarAlcaDeCelulas({ ordem, valorDe: (id) => valorDe(id), aoPreencher: (alvos, v) => gravar(alvos.map((a) => a.id), v) })
  const selecao = useSelecaoDeLinhas(ordem, marcados, setMarcados)
  const marcouTodos = ordem.length > 0 && ordem.every((id) => marcados.includes(id))
  const comPreco = tabela.adicionais.materiais.length

  function aplicarLote() {
    const v = lerNumero(valorDoLote)
    if (v != null && !(Number.isFinite(v) && v >= 0)) return avisar('Escreva quanto o tecido soma em cada peça', 'warn')
    gravar(marcados, v)
    avisar(
      v == null
        ? `${marcados.length} ${marcados.length === 1 ? 'tecido deixou' : 'tecidos deixaram'} de somar`
        : `${marcados.length} ${marcados.length === 1 ? 'tecido' : 'tecidos'} com R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      'ok',
    )
  }

  return (
    <>
      <div className="fileira pr-ferr">
        <Busca placeholder="Buscar tecido" aria-label="Buscar tecido" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="pr-ferr-fim pr-nota">
          {comPreco} {comPreco === 1 ? 'tecido soma' : 'tecidos somam'} na peça
        </span>
      </div>
      {podeMexer && marcados.length ? (
        <div className="pr-lote" role="group" aria-label="Mudar em lote">
          <b>
            {marcados.length} {marcados.length === 1 ? 'marcado' : 'marcados'}
          </b>
          <span>Soma por peça</span>
          <Entrada
            className="pr-lote-pct"
            aria-label="Soma por peça"
            inputMode="decimal"
            placeholder="0,00"
            value={valorDoLote}
            onChange={(e) => setValorDoLote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aplicarLote()
            }}
          />
          <Botao tom="primario" tamanho="sm" onClick={aplicarLote}>
            Aplicar {marcados.length === 1 ? 'no marcado' : `nos ${marcados.length}`}
          </Botao>
          <Botao tom="contorno" tamanho="sm" icone className="pr-lote-fim" aria-label="Desmarcar todos" onClick={() => setMarcados([])}>
            <X size={16} />
          </Botao>
        </div>
      ) : null}
      {!ordem.length ? (
        <Vazio
          titulo={lendo ? 'Lendo os tecidos do Estoque...' : busca ? 'Nenhum tecido com essa busca' : 'Nenhum tecido no Estoque'}
          texto={lendo ? '' : 'Os tecidos vêm do cadastro do Estoque.'}
        />
      ) : (
        <div className="pr-rola" onKeyDown={podeMexer ? selecao.naTecla : undefined}>
          <table className="pr-grade pr-mat">
            <thead>
              <tr>
                <th className="pr-ck-col">
                  {podeMexer ? (
                    <Marcacao
                      aria-label="Marcar todos"
                      checked={marcouTodos}
                      meio={!marcouTodos && marcados.length > 0}
                      onChange={() => setMarcados(marcouTodos ? [] : ordem)}
                    />
                  ) : null}
                </th>
                <th className="pr-nm">Tecido do Estoque</th>
                <th className="pr-col-base">
                  Soma por peça<small>em reais</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {porGrupo.map(([cod, ls]) => (
                <GrupoDoTecido key={cod || 'sem'} cod={cod} nome={cod ? nomeDoGrupo(cod) : 'Sem grupo'}>
                  {ls.map((l) => {
                    const v = valorDoTecido(tabela.adicionais, l.nome)
                    const marcado = marcados.includes(l.id)
                    return (
                      <tr
                        key={l.id}
                        className={marcado ? 'pr-marcada' : ''}
                        aria-selected={marcado}
                        onClick={podeMexer ? (e) => selecao.naLinha(l.id, e) : undefined}
                      >
                        <td className="pr-ck-col">
                          {podeMexer ? (
                            <Marcacao aria-label={'Marcar ' + l.nome} checked={marcado} onChange={() => {}} onClick={(e) => selecao.naCaixa(l.id, e)} />
                          ) : null}
                        </td>
                        <td className="pr-nm">
                          <span className="fileira miuda pr-mat-nome">
                            <b>{l.nome}</b>
                            {l.cores.length ? (
                              <span className="pr-amostras" aria-label={l.cores.length + ' cores no Estoque'}>
                                {l.cores.slice(0, 6).map((c) => (
                                  <Amostra key={c} cor={c} />
                                ))}
                                {l.cores.length > 6 ? <small>+{l.cores.length - 6}</small> : null}
                              </span>
                            ) : null}
                          </span>
                          {l.id.startsWith('solto:') ? <small>não está mais no Estoque</small> : null}
                        </td>
                        <td className="pr-col-base">
                          <CampoDeCelula
                            id={l.id}
                            coluna={0}
                            valor={v ?? null}
                            estado={v == null ? 'espera' : 'base'}
                            texto={v == null ? 'não soma' : undefined}
                            rotulo={l.nome + ', soma por peça'}
                            podeMexer={podeMexer}
                            edicao={edicao}
                            alca={alca}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </GrupoDoTecido>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="pr-pe">O tecido escolhido no layout da cotação soma este valor em cada peça; com dois tecidos, vale o mais caro.</p>
    </>
  )
}

function GrupoDoTecido({ cod, nome, children }: { cod: string; nome: string; children: ReactNode }) {
  return (
    <>
      <tr className="pr-grupo">
        <td colSpan={3}>
          {cod ? <span className="pr-gcod">{cod}</span> : null}
          {nome}
        </td>
      </tr>
      {children}
    </>
  )
}
