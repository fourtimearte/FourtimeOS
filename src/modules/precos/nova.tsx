import { useState } from 'react'
import { Botao, Campo, Entrada, Interruptor, Modal, Segmentado, Seletor, avisar } from '@ds'
import {
  FAIXAS_PADRAO,
  copiarDe,
  nomeDaFaixa,
  tabelaEmBranco,
  type Arredondar,
  type Faixa,
  type TabelaDePreco,
} from '@dominio/preco'

/* ==========================================================================
   TABELA NOVA (prancha 135): em branco ou copiando outra tabela com um
   ajuste em por cento; as faixas de quantidade, o arredondamento, a
   validade e quem escolhe na cotação. Nasce como rascunho: só aparece na
   cotação depois de Ativar.

   "Pelo custo da ficha técnica" ficou de fora desta primeira versão: a ficha
   técnica ainda não guarda o custo da peça. Entra quando o custo existir.
   ========================================================================== */

export function NovaTabela({
  tabelas,
  aoFechar,
  aoCriar,
}: {
  tabelas: TabelaDePreco[]
  aoFechar: () => void
  aoCriar: (t: TabelaDePreco) => Promise<void>
}) {
  const ativas = tabelas.filter((t) => t.situacao !== 'arquivada')
  const [nome, setNome] = useState('')
  const [comeco, setComeco] = useState<'branco' | 'copia'>(ativas.length ? 'copia' : 'branco')
  const [origem, setOrigem] = useState(ativas.find((t) => t.padrao)?.id ?? ativas[0]?.id ?? '')
  const [pct, setPct] = useState('0')
  const [arredondar, setArredondar] = useState<Arredondar>('90')
  const [faixas, setFaixas] = useState<Faixa[]>(() => {
    const o = ativas.find((t) => t.padrao) ?? ativas[0]
    return (o?.faixas ?? FAIXAS_PADRAO).map((f) => ({ ...f }))
  })
  const [novaFaixa, setNovaFaixa] = useState('')
  const [valeAte, setValeAte] = useState('')
  const [soGerente, setSoGerente] = useState(false)
  const [criando, setCriando] = useState(false)

  /* as faixas sao os comecos: 10, 21, 51, 101. O fim de cada uma e o comeco da
     seguinte menos um, e a ultima e "ou mais" */
  const comecos = faixas.map((f) => f.de)
  const deComecos = (cs: number[]): Faixa[] => {
    const o = [...new Set(cs)].filter((n) => n > 0).sort((a, b) => a - b)
    return o.map((de, i) => ({ de, ate: i < o.length - 1 ? o[i + 1] - 1 : null }))
  }

  async function criar() {
    const n = nome.trim()
    if (!n) return avisar('Dê um nome para a tabela', 'warn')
    if (tabelas.some((t) => t.nome.trim().toLowerCase() === n.toLowerCase())) return avisar('Já existe uma tabela com esse nome', 'warn')
    let nova: TabelaDePreco
    if (comeco === 'copia') {
      const o = tabelas.find((t) => t.id === origem)
      if (!o) return avisar('Escolha de qual tabela copiar', 'warn')
      const p = Number(pct.replace(',', '.'))
      if (!Number.isFinite(p)) return avisar('O ajuste é um número em por cento (0 copia igual)', 'warn')
      nova = copiarDe(o, n, p, arredondar)
      /* faixas diferentes das da origem: os itens ficam, e o escrito a mao
         nas faixas sai, porque ele era de outra faixa */
      if (JSON.stringify(o.faixas) !== JSON.stringify(faixas)) {
        nova = { ...nova, faixas, itens: nova.itens.map((i) => ({ ...i, precos: faixas.map(() => null) })) }
      }
    } else {
      nova = { ...tabelaEmBranco(n), faixas, regras: { ...tabelaEmBranco().regras, arredondar } }
    }
    setCriando(true)
    try {
      await aoCriar({ ...nova, valeAte, soGerente })
    } finally {
      setCriando(false)
    }
  }

  return (
    <Modal
      aberto
      largo
      fechaFora={false}
      aoFechar={aoFechar}
      titulo="Nova tabela de preço"
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" disabled={criando} onClick={() => void criar()}>
            {criando ? 'Criando...' : 'Criar a tabela'}
          </Botao>
        </>
      }
    >
      <div className="pilha pr-nova">
        <Campo rotulo="Nome" dica="Como aparece na cotação e na folha impressa">
          <Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Parceiro Goiás" />
        </Campo>

        <Campo rotulo="Começar de">
          <Segmentado<'branco' | 'copia'>
            valor={comeco}
            aoMudar={setComeco}
            opcoes={[
              { valor: 'copia', rotulo: 'Outra tabela' },
              { valor: 'branco', rotulo: 'Em branco' },
            ]}
          />
        </Campo>
        {comeco === 'copia' ? (
          <div className="pr-2col">
            <Campo rotulo="Copiar de" dica="Os itens, os preços e as regras">
              <Seletor
                campo
                bloco
                valor={origem}
                vazio="Escolher"
                opcoes={ativas.map((t) => ({ valor: t.id, rotulo: t.nome }))}
                aoEscolher={setOrigem}
              />
            </Campo>
            <Campo rotulo="Com ajuste de (%)" dica="8 para 8% a mais; menos 5 para 5% a menos; 0 copia igual">
              <Entrada inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
            </Campo>
          </div>
        ) : null}

        <Campo rotulo="Faixas de quantidade" dica="Cada faixa começa onde a anterior termina; a última é ‘ou mais’. As do chat da loja são 10, 21, 51 e 101.">
          <div className="fileira">
            {faixas.map((f) => (
              <span key={f.de} className="pr-chip">
                {nomeDaFaixa(f)}
                {faixas.length > 1 ? (
                  <button
                    type="button"
                    className="pr-chip-x"
                    aria-label={'Tirar a faixa ' + nomeDaFaixa(f)}
                    onClick={() => setFaixas(deComecos(comecos.filter((c) => c !== f.de)))}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
            {faixas.length < 8 ? (
              <span className="fileira miuda">
                <Entrada
                  className="pr-faixa-nova"
                  inputMode="numeric"
                  aria-label="Começo da faixa nova"
                  placeholder="começa em"
                  value={novaFaixa}
                  onChange={(e) => setNovaFaixa(e.target.value.replace(/\D/g, ''))}
                />
                <Botao
                  tom="contorno"
                  tamanho="sm"
                  onClick={() => {
                    const n = Number(novaFaixa)
                    if (!n) return
                    setFaixas(deComecos([...comecos, n]))
                    setNovaFaixa('')
                  }}
                >
                  Faixa
                </Botao>
              </span>
            ) : null}
          </div>
        </Campo>

        <div className="pr-2col">
          <Campo rotulo="Arredondar para">
            <Segmentado<Arredondar>
              valor={arredondar}
              aoMudar={setArredondar}
              opcoes={[
                { valor: '90', rotulo: ',90' },
                { valor: '00', rotulo: ',00' },
                { valor: '', rotulo: 'Não arredondar' },
              ]}
            />
          </Campo>
          <Campo rotulo="Vale até" dica="Vazio: sem data para acabar">
            <Entrada type="date" value={valeAte} onChange={(e) => setValeAte(e.target.value)} />
          </Campo>
        </div>
        <Interruptor ligado={soGerente} aoMudar={setSoGerente} rotulo="Só gerente e admin escolhem esta tabela na cotação" />
      </div>
    </Modal>
  )
}
