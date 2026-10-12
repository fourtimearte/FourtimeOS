import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowsClockwise } from '@phosphor-icons/react'
import { Botao, Cartao, Interruptor, Modal, Selo, TituloCartao, avisar } from '@ds'
import type { PessoaDaEquipe } from '@dominio/equipe'
import { carregarRodizio, daVez, salvarNaFila, zerarRodizio, type NaFila } from '@dominio/funil'

/* ==========================================================================
   A FILA DO RODIZIO DOS LEADS (011, secao 12; a tela, 12/10/2026).

   Quem entra na fila, em que ordem, quantos leads cada um ja levou e de quem
   e a vez. Vale para todo lead de telefone novo que o banco distribui (o do
   site, quando a regra dele esta em rodizio, e o do WhatsApp oficial, quando
   ele entrar). Cliente que ja tem vendedor volta para o dono da carteira,
   antes da fila. So o admin ve e mexe.
   ========================================================================== */

const VENDE = ['admin', 'gerente', 'vendedor']

export function FilaDoRodizio({ equipe }: { equipe: PessoaDaEquipe[] }) {
  const [fila, setFila] = useState<NaFila[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [mexendo, setMexendo] = useState('')
  const [zerando, setZerando] = useState(false)

  useEffect(() => {
    let vivo = true
    carregarRodizio()
      .then((f) => vivo && setFila(f))
      .catch(() => vivo && setFalhou(true))
    return () => {
      vivo = false
    }
  }, [])

  const aprovados = equipe.filter((p) => p.situacao === 'aprovado' && VENDE.includes(p.papel))
  const idsAprovados = new Set(aprovados.map((p) => p.id))
  const linhaDe = (id: string) => fila?.find((f) => f.pessoaId === id)
  /* na fila primeiro, pela ordem; quem esta fora vem depois, pelo nome */
  const pessoas = [...aprovados].sort((a, b) => {
    const fa = linhaDe(a.id), fb = linhaDe(b.id)
    const na = fa?.ativo ? 0 : 1, nb = fb?.ativo ? 0 : 1
    if (na !== nb) return na - nb
    if (na === 0) return (fa?.ordem ?? 0) - (fb?.ordem ?? 0)
    return (a.nome || a.email).localeCompare(b.nome || b.email)
  })
  const naFila = pessoas.filter((p) => linhaDe(p.id)?.ativo)
  const vez = fila ? daVez(fila, idsAprovados) : ''

  async function gravar(mudancas: Pick<NaFila, 'pessoaId' | 'ordem' | 'ativo'>[]) {
    if (!fila) return
    setMexendo(mudancas[0]?.pessoaId ?? '')
    try {
      for (const m of mudancas) await salvarNaFila(m)
      setFila(await carregarRodizio())
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui mexer na fila.', 'warn')
    } finally {
      setMexendo('')
    }
  }

  /* entrar vai para o fim da fila; sair so desliga (a contagem fica) */
  function ligar(p: PessoaDaEquipe, ativo: boolean) {
    const fim = Math.max(0, ...naFila.map((x) => linhaDe(x.id)?.ordem ?? 0)) + 1
    void gravar([{ pessoaId: p.id, ativo, ordem: ativo ? fim : linhaDe(p.id)?.ordem ?? fim }])
  }

  /* trocar de lugar com o vizinho: as duas ordens viram as posicoes de agora */
  function mover(i: number, para: -1 | 1) {
    const j = i + para
    if (j < 0 || j >= naFila.length) return
    const ordem = naFila.map((p) => p.id)
    ;[ordem[i], ordem[j]] = [ordem[j], ordem[i]]
    void gravar(ordem.map((id, k) => ({ pessoaId: id, ativo: true, ordem: k + 1 })).filter((_m, k) => k === i || k === j))
  }

  async function zerar() {
    setZerando(false)
    try {
      await zerarRodizio()
      setFila(await carregarRodizio())
      avisar('A contagem recomeçou do zero para todos.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui zerar a contagem.', 'warn')
    }
  }

  return (
    <Cartao>
      <TituloCartao icone={ArrowsClockwise}>Rodízio dos leads</TituloCartao>
      {falhou ? (
        <p className="cfg-nada">Não consegui ler a fila do rodízio.</p>
      ) : !fila ? (
        <p className="cfg-nada">Carregando...</p>
      ) : (
        <div className="pilha cfg-rod">
          <p className="cfg-nada">
            Lead de telefone novo vai para quem levou menos até agora; no empate, pela ordem da fila. Telefone de cliente que já
            tem vendedor volta para ele, antes da fila.
          </p>
          {aprovados.length ? (
            <ul className="cfg-rod-lista">
              {pessoas.map((p) => {
                const f = linhaDe(p.id)
                const i = naFila.findIndex((x) => x.id === p.id)
                return (
                  <li key={p.id} className={f?.ativo ? 'cfg-rod-lin' : 'cfg-rod-lin cfg-rod-fora'}>
                    <span className="cfg-rod-n">{f?.ativo ? i + 1 : '-'}</span>
                    <span className="pilha cfg-rod-quem">
                      <b>
                        <span className="corta">{p.nome || p.email}</span>
                        {vez === p.id ? (
                          <Selo tom="ok" forma="suave">
                            é a vez
                          </Selo>
                        ) : null}
                      </b>
                      <small>
                        {f
                          ? `levou ${f.levou} ${f.levou === 1 ? 'lead' : 'leads'}` +
                            (f.ultimoEm ? ' · o último em ' + new Date(f.ultimoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '')
                          : 'nunca entrou na fila'}
                      </small>
                    </span>
                    {f?.ativo ? (
                      <span className="fileira colada">
                        <Botao tom="limpo" tamanho="sm" icone aria-label={'Subir ' + (p.nome || p.email)} disabled={!!mexendo || i === 0} onClick={() => mover(i, -1)}>
                          <ArrowUp size={16} />
                        </Botao>
                        <Botao
                          tom="limpo"
                          tamanho="sm"
                          icone
                          aria-label={'Descer ' + (p.nome || p.email)}
                          disabled={!!mexendo || i === naFila.length - 1}
                          onClick={() => mover(i, 1)}
                        >
                          <ArrowDown size={16} />
                        </Botao>
                      </span>
                    ) : null}
                    <Interruptor ligado={!!f?.ativo} nome={'Na fila: ' + (p.nome || p.email)} aoMudar={(v) => ligar(p, v)} />
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="cfg-nada">Ninguém aprovado que venda ainda.</p>
          )}
          <div className="fileira entre">
            <small className="cfg-nada">
              {naFila.length ? `${naFila.length} na fila` : 'A fila está vazia: o lead de telefone novo nasce sem dono.'}
            </small>
            <Botao tom="contorno" tamanho="sm" disabled={!fila.some((f) => f.levou > 0)} onClick={() => setZerando(true)}>
              Zerar a contagem
            </Botao>
          </div>
        </div>
      )}
      <Modal
        aberto={zerando}
        aoFechar={() => setZerando(false)}
        titulo="Zerar a contagem do rodízio?"
        pe={
          <>
            <Botao tom="limpo" onClick={() => setZerando(false)}>
              Não zerar
            </Botao>
            <Botao tom="forte" onClick={() => void zerar()}>
              Zerar
            </Botao>
          </>
        }
      >
        <p>Todo mundo volta para zero lead levado, e a vez segue pela ordem da fila. Os leads que já foram distribuídos não mudam de dono.</p>
      </Modal>
    </Cartao>
  )
}
