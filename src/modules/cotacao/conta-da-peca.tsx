import { useState } from 'react'
import { ArrowsLeftRight, X } from '@phosphor-icons/react'
import { Botao, Entrada, Modal, Passo, PilulaTecnica, Selo, Seletor, lerNumero, type Tecnica } from '@ds'
import type { Design } from '@dominio/layout'
import { CamisasDoDtf, type ParteDaConta, type TabelaDePreco } from '@dominio/preco'
import { origemDoPreco, precoSemMao, tabelaDoLayout, type Cotacao, type ProdutoCotado } from '@dominio/cotacao'
import { comDtf, comOpcaoDoAplique, comQuantidade, daTecnica, desligarTecnica } from './design-do-layout'
import { usarTabelasDaCotacao } from './tabelas-da-cotacao'

/* ==========================================================================
   A CONTA DA PEÇA (083, telas 5 e 6 do wireframe de 16/10/2026): embaixo da
   grade, o preço de uma peça em blocos, um por parte, cada um com o seu
   controle. A peça (a faixa da tabela), o tecido, a técnica e os extras.

   O que está aqui é o MESMO dado da ficha do layout: as telas do Silk, o
   tipo do Patch e o tamanho do Bordado moram no design do bloco, e o botão
   direito no interruptor muda a mesma coisa. Só a técnica ligada na ficha
   aparece na conta.
   ========================================================================== */

const n2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TAG: Record<ParteDaConta['tipo'], { rotulo: string; tecnica?: Tecnica }> = {
  material: { rotulo: 'TECIDO' },
  sub: { rotulo: 'SUB', tecnica: 'subli' },
  silk: { rotulo: 'SILK', tecnica: 'silk' },
  dtf: { rotulo: 'DTF', tecnica: 'dtf' },
  patch: { rotulo: 'PATCH', tecnica: 'patch' },
  bordado: { rotulo: 'BORDADO', tecnica: 'bordado' },
  extra: { rotulo: 'EXTRA' },
}

function Etiqueta({ tipo, nome }: { tipo: ParteDaConta['tipo'] | 'peca'; nome?: string }) {
  if (tipo === 'peca') return <Selo forma="forte">PEÇA</Selo>
  const t = TAG[tipo]
  return t.tecnica ? (
    <PilulaTecnica tecnica={t.tecnica} tamanho="sm">
      {t.rotulo}
    </PilulaTecnica>
  ) : (
    <Selo forma="contorno">{nome ? nome.toUpperCase() : t.rotulo}</Selo>
  )
}

export function ContaDaPeca({
  c,
  produto,
  travado,
  aoMudarProduto,
}: {
  c: Cotacao
  produto: ProdutoCotado
  travado: boolean
  aoMudarProduto: (troca: (p: ProdutoCotado) => ProdutoCotado) => void
}) {
  const { todas } = usarTabelasDaCotacao()
  const [dtfAberto, setDtfAberto] = useState(false)
  const id = tabelaDoLayout(c, produto)
  const t = id ? todas.find((x) => x.id === id) : undefined
  const cod = produto.bloco.referencia.trim()
  if (!t || !cod || !t.itens.some((i) => i.codigo === cod)) return null

  const origem = origemDoPreco(c, produto, todas)
  const partes = produto.conta ?? []
  const design = produto.bloco.design
  const d = (tec: string) => design.find((x) => x.tecnica === tec)
  const mudarDesign = (f: (ds: Design[]) => Design[]) => aoMudarProduto((p) => ({ ...p, bloco: { ...p.bloco, design: f(p.bloco.design) } }))
  const novos = t.adicionais.extras.filter((e) => !e.tecnica)
  const meus = produto.extras ?? []
  /* o tamanho da conta: o M, ou o primeiro da grade com peças */
  const comPecas = Object.entries(produto.bloco.grade).filter(([, n]) => (n ?? 0) > 0).map(([k]) => k)
  const tam = comPecas.includes('M') ? 'M' : (comPecas[0] ?? 'M')
  const plus = t.regras.plusReais

  function controle(parte: ParteDaConta, i: number) {
    if (travado) return null
    if (parte.tipo === 'silk')
      return <Passo valor={parte.qtd} unidade={parte.qtd === 1 ? 'tela' : 'telas'} rotulo="telas do Silk" aoMudar={(n) => mudarDesign((ds) => comQuantidade(ds, daTecnica('silk'), n))} />
    if (parte.tipo === 'dtf')
      return (
        <Botao tom="contorno" tamanho="sm" onClick={() => setDtfAberto(true)}>
          <ArrowsLeftRight size={15} />
          {d('dtf')?.combinacao || d('dtf')?.dtfPorPeca != null ? 'Trocar' : 'Escolher'}
        </Botao>
      )
    if (parte.tipo === 'patch' || parte.tipo === 'bordado') {
      const tec = daTecnica(parte.tipo)
      const ex = t!.adicionais.extras.find((e) => e.tecnica === parte.tipo)
      const atual = parte.tipo === 'patch' ? String(d('patch')?.tipoDePatch ?? '') : String(d('bordado')?.tamanho ?? '')
      return (
        <>
          <Seletor
            tamanho="sm"
            campo
            valor={atual}
            vazio={parte.tipo === 'patch' ? 'Tipo' : 'Tamanho'}
            opcoes={(ex?.opcoes ?? []).map((o) => ({ valor: o.id, rotulo: o.nome + (o.medida ? ' · ' + o.medida : '') }))}
            aoEscolher={(v) => {
              const o = ex?.opcoes.find((x) => x.id === v)
              if (o) mudarDesign((ds) => comOpcaoDoAplique(ds, tec, o.id, o.nome))
            }}
          />
          <Passo valor={parte.qtd} rotulo={parte.tipo === 'patch' ? 'patches por peça' : 'bordados por peça'} aoMudar={(n) => mudarDesign((ds) => comQuantidade(ds, tec, n))} />
        </>
      )
    }
    if (parte.tipo === 'extra') {
      const k = i - partes.findIndex((p) => p.tipo === 'extra')
      const meu = meus[k]
      const ex = meu ? t!.adicionais.extras.find((e) => e.id === meu.extra) : undefined
      if (!meu) return null
      const trocar = (f: (x: typeof meu) => typeof meu | null) =>
        aoMudarProduto((p) => {
          const lista = [...(p.extras ?? [])]
          const novo = f(lista[k])
          if (novo) lista[k] = novo
          else lista.splice(k, 1)
          return { ...p, extras: lista }
        })
      return (
        <>
          <Seletor
            tamanho="sm"
            campo
            valor={meu.opcao}
            vazio="Opção"
            opcoes={(ex?.opcoes ?? []).map((o) => ({ valor: o.id, rotulo: o.nome + (o.medida ? ' · ' + o.medida : '') }))}
            aoEscolher={(v) => v && trocar((x) => ({ ...x, opcao: v }))}
          />
          <Passo valor={meu.qtd} rotulo={'quantos ' + (ex?.nome ?? 'extras') + ' por peça'} aoMudar={(n) => trocar((x) => ({ ...x, qtd: n }))} />
          <Botao tom="limpo" tamanho="sm" icone aria-label={'Tirar ' + (ex?.nome ?? 'o extra')} onClick={() => trocar(() => null)}>
            <X size={15} />
          </Botao>
        </>
      )
    }
    return null
  }

  return (
    <div className="ct-conta" aria-label="A conta da peça">
      <div className="ct-conta-cab">
        <b>A conta da peça, tamanho {tam}</b>
        <span className="ct-conta-nota">
          {t.nome}
          {plus ? ` · G1 a G4 somam R$ ${n2(plus)} na peça` : ''}
        </span>
      </div>
      <div className="ct-conta-partes">
        <div className="ct-conta-p">
          <span className="fileira miuda">
            <Etiqueta tipo="peca" />
            <span className="corta">{produto.bloco.nomeDaReferencia || cod}</span>
          </span>
          <b className="ct-conta-v">{n2(produto.precoDaTabela?.[tam] ?? produto.precoBase)}</b>
          <small>{origem ? 'faixa ' + origem.faixa : ''}</small>
        </div>
        {partes.map((parte, i) => (
          <div key={parte.tipo + i} className={'ct-conta-p' + (parte.falta ? ' falta' : '')} data-parte={parte.tipo}>
            <span className="fileira miuda">
              <Etiqueta tipo={parte.tipo} nome={parte.tipo === 'extra' ? t.adicionais.extras.find((e) => e.id === meus[i - partes.findIndex((p) => p.tipo === 'extra')]?.extra)?.nome : undefined} />
              <span className="corta">{parte.rotulo}</span>
            </span>
            <b className="ct-conta-v">{n2(parte.valor)}</b>
            <small>{parte.falta ? parte.falta : parte.qtd > 1 ? `${parte.qtd} x R$ ${n2(parte.cada)}` : ''}</small>
            {controle(parte, i) ? <span className="fileira miuda ct-conta-ctl">{controle(parte, i)}</span> : null}
          </div>
        ))}
        {!travado && novos.length ? (
          <div className="ct-conta-p ct-conta-mais">
            <Seletor
              tamanho="sm"
              rotulo="+"
              valor=""
              vazio="Outro extra"
              opcoes={novos.map((e) => ({ valor: e.id, rotulo: e.nome }))}
              aoEscolher={(v) => {
                const e = novos.find((x) => x.id === v)
                if (e) aoMudarProduto((p) => ({ ...p, extras: [...(p.extras ?? []), { extra: e.id, opcao: e.opcoes[0]?.id ?? '', qtd: 1 }] }))
              }}
            />
          </div>
        ) : null}
        <div className="ct-conta-igual">
          <small>por peça</small>
          <b>R$ {n2(precoSemMao(produto, tam))}</b>
          {produto.precoPorTamanho[tam] != null ? <small>o {tam} escrito à mão na grade ({n2(produto.precoPorTamanho[tam]!)}) ganha desta soma</small> : null}
        </div>
      </div>
      {dtfAberto ? (
        <EscolhaDoDtf
          tabela={t}
          titulo={'O DTF do L-' + String(produto.bloco.n).padStart(2, '0')}
          atual={d('dtf')}
          aoFechar={() => setDtfAberto(false)}
          aoUsar={(f) => {
            mudarDesign(f)
            setDtfAberto(false)
          }}
        />
      ) : null}
    </div>
  )
}

/* O MODAL DO DTF: as combinações da tabela, Sem DTF, ou vender na metragem
   com o preço por peça escrito aqui, que passa por cima da tabela só neste
   layout. Nada muda até o Usar esta. */
function EscolhaDoDtf({
  tabela,
  titulo,
  atual,
  aoFechar,
  aoUsar,
}: {
  tabela: TabelaDePreco
  titulo: string
  atual: Design | undefined
  aoFechar: () => void
  aoUsar: (f: (ds: Design[]) => Design[]) => void
}) {
  const [escolha, setEscolha] = useState<string>(atual?.dtfPorPeca != null ? 'metragem' : (atual?.combinacao ?? ''))
  const [metro, setMetro] = useState(atual?.dtfPorPeca != null ? n2(atual.dtfPorPeca) : '')
  const valorDoMetro = lerNumero(metro)
  const pode = escolha === 'sem' || (escolha === 'metragem' ? valorDoMetro != null && Number.isFinite(valorDoMetro) && valorDoMetro >= 0 : tabela.adicionais.dtf.some((c) => c.id === escolha))

  function usar() {
    if (escolha === 'sem') return aoUsar((ds) => desligarTecnica(ds, daTecnica('dtf')))
    if (escolha === 'metragem') return aoUsar((ds) => comDtf(ds, { porPeca: valorDoMetro ?? 0 }))
    const c = tabela.adicionais.dtf.find((x) => x.id === escolha)
    if (c) aoUsar((ds) => comDtf(ds, { combinacao: c.id, nome: c.nome }))
  }

  return (
    <Modal
      aberto
      largo
      aoFechar={aoFechar}
      titulo={titulo + ' · tabela ' + tabela.nome}
      pe={
        <div className="fileira entre ct-dtf-pe">
          <span className="ct-conta-nota">A soma muda em todos os tamanhos do layout.</span>
          <span className="fileira">
            <Botao tom="contorno" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao tom="primario" disabled={!pode} onClick={usar}>
              Usar esta
            </Botao>
          </span>
        </div>
      }
    >
      <div className="pilha ct-dtf">
        <span className="ct-dtf-sobre">As combinações da tabela</span>
        <div className="ct-dtf-grade" role="radiogroup" aria-label="As combinações de DTF">
          {tabela.adicionais.dtf.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={escolha === c.id}
              className={'ct-dtf-op' + (escolha === c.id ? ' ligado' : '')}
              onClick={() => setEscolha(c.id)}
            >
              <CamisasDoDtf ligadas={c.posicoes} tamanhos={tabela.adicionais.tamanhosDtf} className="ct-dtf-camisas" />
              <span className="fileira entre">
                <b>{c.nome}</b>
                <span className="ct-dtf-preco">{c.valor == null ? 'sem preço' : 'R$ ' + n2(c.valor)}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={escolha === 'sem'}
            className={'ct-dtf-op ct-dtf-sem' + (escolha === 'sem' ? ' ligado' : '')}
            onClick={() => setEscolha('sem')}
          >
            <b>Sem DTF</b>
            <span>tira o DTF da conta e da ficha</span>
          </button>
        </div>
        {!tabela.adicionais.dtf.length ? <p className="ct-conta-nota">A tabela {tabela.nome} ainda não tem combinações: elas se criam na aba DTF da tabela de preço.</p> : null}
        <div className={'ct-dtf-metro' + (escolha === 'metragem' ? ' ligado' : '')}>
          <button type="button" role="radio" aria-checked={escolha === 'metragem'} className="ct-dtf-radio" aria-label="Vender na metragem" onClick={() => setEscolha('metragem')} />
          <span className="pilha" onClick={() => setEscolha('metragem')}>
            <b>Vender na metragem</b>
            <span>O preço do DTF por peça, escrito aqui, passa por cima da tabela só neste layout.</span>
          </span>
          <Entrada
            className="ct-dtf-valor"
            inputMode="decimal"
            aria-label="Preço do DTF por peça"
            placeholder="R$ por peça"
            value={metro}
            onFocus={() => setEscolha('metragem')}
            onChange={(e) => setMetro(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
