import { useEffect, useState } from 'react'
import { Calculator, PencilSimple } from '@phosphor-icons/react'
import { Botao, Campo, Entrada, avisar, lerNumero } from '@ds'
import { CUSTO_DO_DTF_PADRAO, custoPorCm2, gravarCustoDoDtf, lerCustoDoDtf, type CustoDoDtf } from '@dominio/preco'

/* ==========================================================================
   A CALCULADORA DO CUSTO DO DTF, NA ABA DTF (pedido dele em 22/10/2026:
   "uma calculadora automática que já coloca o preço a cada DTF que eu crio").

   Três números da fábrica inteira (o metro com tudo dentro, a largura do
   filme e quanto dele vira estampa) dão o custo do cm², e dele sai o custo
   de cada tamanho e de cada combinação, sozinho. Só o administrador muda os
   três números; todo mundo vê a conta.
   ========================================================================== */

export function usarCustoDoDtf() {
  const [custo, setCusto] = useState<CustoDoDtf>(CUSTO_DO_DTF_PADRAO)
  const [falha, setFalha] = useState(false)
  useEffect(() => {
    let vivo = true
    lerCustoDoDtf()
      .then((c) => vivo && setCusto(c))
      .catch(() => vivo && setFalha(true))
    return () => {
      vivo = false
    }
  }, [])
  return { custo, setCusto, falha }
}

const reais = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const dinheiro = reais
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export function FaixaDoCusto({
  custo,
  falha,
  souAdmin,
  aoGravar,
}: {
  custo: CustoDoDtf
  falha: boolean
  souAdmin: boolean
  /** recebe o custo novo depois que o banco confirmou */
  aoGravar: (novo: CustoDoDtf) => void
}) {
  const [editando, setEditando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [txt, setTxt] = useState({ metro: '', largura: '', aproveitamento: '' })

  function abrir() {
    setTxt({ metro: num(custo.metro), largura: num(custo.largura), aproveitamento: num(custo.aproveitamento) })
    setEditando(true)
  }

  const lido = { metro: lerNumero(txt.metro), largura: lerNumero(txt.largura), aproveitamento: lerNumero(txt.aproveitamento) }
  const valido = (lido.metro ?? 0) > 0 && (lido.largura ?? 0) > 0 && (lido.aproveitamento ?? 0) > 0 && (lido.aproveitamento ?? 0) <= 100

  async function gravar() {
    if (!valido) return
    setGravando(true)
    try {
      const novo = await gravarCustoDoDtf(lido as CustoDoDtf)
      aoGravar(novo)
      setEditando(false)
      avisar('Custo do DTF gravado para a fábrica inteira', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não gravou', 'warn')
    } finally {
      setGravando(false)
    }
  }

  return (
    <div className="pr-dtf-custo">
      <div className="fileira entre">
        <span className="pr-sobre">
          <Calculator size={14} weight="bold" /> Custo do DTF
        </span>
        {souAdmin && !editando ? (
          <Botao tom="limpo" tamanho="sm" onClick={abrir}>
            <PencilSimple size={14} />
            Mudar
          </Botao>
        ) : null}
      </div>
      {editando ? (
        <div className="pilha pr-dtf-custo-campos">
          <div className="pr-dtf-custo-grade">
            <Campo rotulo="Metro (R$)">
              <Entrada inputMode="decimal" value={txt.metro} onChange={(e) => setTxt({ ...txt, metro: e.target.value })} />
            </Campo>
            <Campo rotulo="Filme (cm)">
              <Entrada inputMode="decimal" value={txt.largura} onChange={(e) => setTxt({ ...txt, largura: e.target.value })} />
            </Campo>
            <Campo rotulo="Aproveita (%)">
              <Entrada inputMode="decimal" value={txt.aproveitamento} onChange={(e) => setTxt({ ...txt, aproveitamento: e.target.value })} />
            </Campo>
          </div>
          <span className="pr-dtf-custo-conta">{valido ? 'Fica ' + custoPorCm2(lido as CustoDoDtf).toLocaleString('pt-BR', { maximumFractionDigits: 6 }) + ' por cm²' : 'Três números maiores que zero; aproveitamento até 100%'}</span>
          <div className="fileira fim">
            <Botao tom="contorno" tamanho="sm" onClick={() => setEditando(false)}>
              Cancelar
            </Botao>
            <Botao tom="primario" tamanho="sm" disabled={!valido || gravando} carregando={gravando} onClick={gravar}>
              Gravar
            </Botao>
          </div>
        </div>
      ) : (
        <>
          <b className="pr-dtf-custo-cm">
            R$ {custoPorCm2(custo).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })} <small>por cm²</small>
          </b>
          <small className="pr-dtf-custo-de">
            {reais(custo.metro)} o metro · filme de {num(custo.largura)} cm · {num(custo.aproveitamento)}% aproveitado
            {falha ? ' (o banco não respondeu: valendo o padrão)' : ''}
          </small>
        </>
      )}
    </div>
  )
}
