import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Tag } from '@phosphor-icons/react'
import { Botao, TituloCartao } from '@ds'
import { formatarNumeroExato } from '@shared'
import { carregarKits } from '@dominio/produto'
import { carregarTabelasDePreco, celula, nomeDaFaixa, type TabelaDePreco } from '@dominio/preco'

/* ==========================================================================
   OS PREÇOS DA PEÇA NAS TABELAS (prancha 136, opção B): só leitura, dentro
   da ficha técnica. Quanto esta referência (ou este kit) custa em cada tabela
   que não está arquivada, faixa por faixa, e o Abrir que leva à tabela, que
   é onde o preço se muda. As tabelas que não têm a peça ficam numa linha só.

   Sem a 068 no banco, ou sem tabela nenhuma, o cartão não aparece: a ficha
   não ganha um cartão vazio por causa de uma coisa que ainda não existe.
   ========================================================================== */

type Lido = { tabelas: TabelaDePreco[]; pecasDoKit: (c: string) => string[] }

export function CartaoDosPrecos({ codigo }: { codigo: string }) {
  const navegar = useNavigate()
  const [lido, setLido] = useState<Lido | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([
      carregarTabelasDePreco().catch(() => ({ tabelas: [] as TabelaDePreco[], semBanco: true })),
      carregarKits().catch(() => []),
    ]).then(([r, kits]) => {
      if (!vivo) return
      const pecas = new Map(kits.map((k) => [k.cod, k.pecasCod]))
      setLido({ tabelas: r.tabelas.filter((t) => t.situacao !== 'arquivada'), pecasDoKit: (c) => pecas.get(c) ?? [] })
    })
    return () => {
      vivo = false
    }
  }, [])

  if (!lido || !lido.tabelas.length || !codigo) return null
  const comAPeca = lido.tabelas.filter((t) => t.itens.some((i) => i.codigo === codigo))
  const semAPeca = lido.tabelas.filter((t) => !t.itens.some((i) => i.codigo === codigo))

  return (
    <section className="cartao pd-col" data-cartao="precos">
      <div className="pd-topo">
        <TituloCartao icone={Tag}>Preços nas tabelas</TituloCartao>
        <span className="pd-topo-n">por peça, pela faixa do pedido</span>
      </div>
      {comAPeca.map((t) => {
        const item = t.itens.find((i) => i.codigo === codigo)
        if (!item) return null
        const ctx = { achar: (c: string) => t.itens.find((i) => i.codigo === c), pecasDoKit: lido.pecasDoKit }
        return (
          <div className="pd-lin pd-preco-lin" key={t.id} data-tabela={t.nome}>
            <span className="pd-txt">
              <b>{t.nome}</b>
              <small>
                {[t.padrao ? 'padrão' : '', t.situacao === 'rascunho' ? 'rascunho' : '', t.soGerente ? 'só gerente' : '']
                  .filter(Boolean)
                  .join(' · ') || 'ativa'}
              </small>
            </span>
            <span className="pd-precos">
              {t.faixas.map((f, i) => {
                const v = celula(t, item, i, ctx).valor
                return (
                  <span className="pd-preco" key={nomeDaFaixa(f)}>
                    <small>{nomeDaFaixa(f)}</small>
                    <b>{v == null ? 'a consultar' : 'R$ ' + formatarNumeroExato(v)}</b>
                  </span>
                )
              })}
            </span>
            <Botao tom="limpo" tamanho="sm" onClick={() => navegar('/tabelas?t=' + t.id)}>
              Abrir
              <ArrowRight size={14} aria-hidden="true" />
            </Botao>
          </div>
        )
      })}
      {semAPeca.length ? (
        <div className="pd-corpo">
          <p className="pd-nota">
            {comAPeca.length ? 'Não está em: ' : 'Ainda não está em nenhuma tabela: '}
            {semAPeca.map((t) => t.nome).join(', ')}. Para pôr, abra a tabela e use o Adicionar.
          </p>
        </div>
      ) : null}
    </section>
  )
}
