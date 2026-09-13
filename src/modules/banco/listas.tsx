import { useMemo, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Botao, Busca, Entrada, Vazio, avisar } from '@ds'
import {
  apagarItemDeLista,
  combina,
  criarItemDeLista,
  itensDaLista,
  renomearItemDeLista,
} from '@dominio/banco'
import type { Banco, ItemDeLista, TipoDeLista } from '@dominio/banco'
import { Linha } from './pecas'
import type { AlvoDeApagar, AlvoDoNome } from './pecas'

/* ==========================================================================
   As cinco listas do cabeçalho: pagamento, entrega, embalagem, vendedor,
   departamento.

   São a mesma coisa com cinco nomes, e por isso são uma tela só. Elas moram
   na mesma tabela pelo mesmo motivo: cinco tabelas iguais seriam cinco
   lugares para esquecer de mexer.
   ========================================================================== */

const O_QUE_E: Record<TipoDeLista, string> = {
  pagamento: 'forma de pagamento',
  entrega: 'forma de entrega',
  embalagem: 'embalagem',
  vendedor: 'vendedor',
  departamento: 'departamento',
}

export function Listas({
  banco,
  tipo,
  podeMexer,
  procurado,
  aoProcurar,
  aoPor,
  aoTirar,
  pedirNome,
  pedirApagar,
}: {
  banco: Banco
  tipo: TipoDeLista
  podeMexer: boolean
  procurado: string
  aoProcurar: (t: string) => void
  aoPor: (i: ItemDeLista) => void
  aoTirar: (tipo: TipoDeLista, valor: string) => void
  pedirNome: (a: AlvoDoNome) => void
  pedirApagar: (a: AlvoDeApagar) => void
}) {
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  const todos = useMemo(() => itensDaLista(banco, tipo), [banco, tipo])
  const lista = useMemo(
    () => todos.filter((i) => combina(procurado, i.valor)),
    [todos, procurado],
  )

  async function adicionar() {
    const valor = texto.trim()
    if (!valor) {
      avisar(`Escreva a ${O_QUE_E[tipo]}.`, 'brand')
      return
    }
    if (todos.some((i) => i.valor === valor)) {
      avisar('Esse já está na lista.', 'brand')
      return
    }
    setSalvando(true)
    try {
      aoPor(await criarItemDeLista(tipo, valor))
      setTexto('')
      avisar('Entrou na lista.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div className="bd-barra">
        <Busca value={procurado} onChange={(e) => aoProcurar(e.target.value)} placeholder="Buscar..." />
        {podeMexer ? (
          <>
            <Entrada
              tamanho="sm"
              className="bd-cresce"
              value={texto}
              placeholder={`Nova ${O_QUE_E[tipo]}...`}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void adicionar()
              }}
            />
            <Botao tom="primario" tamanho="sm" carregando={salvando} onClick={() => void adicionar()}>
              <Plus size={15} />
              Adicionar
            </Botao>
          </>
        ) : null}
      </div>

      <p className="bd-conta">
        {lista.length} de {todos.length}
      </p>

      {lista.length === 0 ? (
        <Vazio titulo="Lista vazia" texto={`Nenhuma ${O_QUE_E[tipo]} cadastrada.`} />
      ) : (
        <div className="cartao bd-lista-simples">
          {lista.map((i) => (
            <Linha
              key={i.valor}
              nome={i.valor}
              podeMexer={podeMexer}
              aoRenomear={() =>
                pedirNome({
                  titulo: i.valor,
                  rotulo: `Nome d${tipo === 'embalagem' ? 'a' : 'o'} ${O_QUE_E[tipo]}`,
                  dica: 'Os orçamentos já feitos continuam com o texto antigo: eles guardaram o texto, não o vínculo.',
                  valor: i.valor,
                  gravar: async (novo) => {
                    aoPor(await renomearItemDeLista(tipo, i.valor, novo))
                    aoTirar(tipo, i.valor)
                    avisar('Nome trocado.', 'ok')
                  },
                })
              }
              aoApagar={() =>
                pedirApagar({
                  titulo: 'Apagar da lista?',
                  texto: (
                    <>
                      <b>{i.valor}</b> some do menu do orçamento. Os orçamentos já feitos continuam
                      com o texto que tinham.
                    </>
                  ),
                  apagar: async () => {
                    await apagarItemDeLista(tipo, i.valor)
                    aoTirar(tipo, i.valor)
                    avisar('Apagado.', 'ok')
                  },
                })
              }
            />
          ))}
        </div>
      )}
    </>
  )
}
