import { useCallback, useEffect, useState } from 'react'
import { Botao, Esqueleto, Vazio, avisar } from '@ds'
import {
  NOME_DO_MEIO,
  NOME_DO_MOTIVO,
  carregarLixeira,
  devolverLancamento,
  type NaLixeira,
} from '@dominio/transporte'
import { dinheiro, quandoFoi } from './apoio'
import { IconeDoMeio } from './resumo'

/* ==========================================================================
   A lixeira do Transporte (079).

   Apagar um lançamento manda ele para cá, com a coleta junto: some da lista
   e de todas as contas, mas não se perde. Quem devolve é o administrador.
   ========================================================================== */

export function Lixeira({
  podeDevolver,
  hoje,
  aoDevolver,
}: {
  podeDevolver: boolean
  hoje: Date
  aoDevolver: () => Promise<void>
}) {
  const [itens, setItens] = useState<NaLixeira[] | null>(null)
  const [erro, setErro] = useState('')
  const [devolvendo, setDevolvendo] = useState('')

  const ler = useCallback(async () => {
    try {
      setItens(await carregarLixeira())
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler a lixeira.')
    }
  }, [])

  useEffect(() => {
    void ler()
  }, [ler])

  async function devolver(x: NaLixeira) {
    setDevolvendo(x.id)
    try {
      await devolverLancamento(x.id)
      avisar(`${x.transportador}, ${dinheiro(x.valor)}, voltou para os lançamentos.`, 'ok')
      await Promise.all([ler(), aoDevolver()])
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui devolver.', 'brand')
    } finally {
      setDevolvendo('')
    }
  }

  return (
    <section className="cartao tp-quadro">
      {erro ? (
        <Vazio titulo="Não consegui ler a lixeira" texto={erro} />
      ) : !itens ? (
        <div className="tp-espera">
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </div>
      ) : itens.length === 0 ? (
        <Vazio titulo="A lixeira está vazia" texto="O lançamento apagado vem para cá, e o administrador pode devolver." />
      ) : (
        <ul className="tp-lixeira">
          {itens.map((x) => (
            <li key={x.id} className="tp-lixo">
              <IconeDoMeio meio={x.meio} />
              <span className="tp-nome">
                <b>
                  {x.transportador} · {dinheiro(x.valor)}
                </b>
                <small>
                  {[NOME_DO_MEIO[x.meio], NOME_DO_MOTIVO[x.motivo], x.pedido, x.destino, quandoFoi(x.quando, hoje)]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
                <small>
                  Apagado {quandoFoi(x.apagadoEm, hoje)}
                  {x.apagadoPor ? ` por ${x.apagadoPor}` : ''}
                </small>
              </span>
              {podeDevolver ? (
                <Botao
                  tamanho="sm"
                  onClick={() => void devolver(x)}
                  disabled={!!devolvendo}
                  carregando={devolvendo === x.id}
                >
                  Devolver
                </Botao>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
