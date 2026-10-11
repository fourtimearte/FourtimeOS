import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChatsCircle, PaperPlaneRight } from '@phosphor-icons/react'
import { AreaTexto, Avatar, Botao, Esqueleto, Segmentado, Seletor, TituloCartao, avisar } from '@ds'
import { nomeDoPapel } from '@dominio/acessos'
import {
  carregarConversa,
  carregarEquipeParaConversa,
  falarNoPedido,
  type MensagemDoPedido,
  type PedidoNoPcp,
  type PessoaDaEquipe,
} from '@dominio/producao'
import { iniciaisDe } from '@dominio/sessao'
import { quando } from './fila'

/* ==========================================================================
   A CONVERSA DO PEDIDO (pranchas 88 e 92, parte P4).

   Uma aba por pessoa de fora do PCP: o vendedor do pedido sempre, e quem
   mais já conversou neste pedido. "Outra pessoa" abre conversa com alguém
   da equipe (a arte finalista, por exemplo). A mensagem fica guardada no
   pedido e avisa a pessoa no sino do topo (064).

   Quem não é do PCP (o vendedor que chegou pelo sino) só vê a conversa
   dele: o banco devolve só ela.

   Enter manda; Shift e Enter quebra a linha.
   ========================================================================== */

const LEITURA_A_CADA = 30000

export function CartaoDaConversa({
  p,
  eu,
  doPcp,
  aoContar,
}: {
  p: PedidoNoPcp
  eu: { id: string; nome: string }
  /** quem vê o PCP conversa com qualquer um; de fora, só na sua */
  doPcp: boolean
  aoContar?: (n: number) => void
}) {
  /* undefined: lendo; null: a 064 não rodou */
  const [mensagens, setMensagens] = useState<MensagemDoPedido[] | null | undefined>(undefined)
  const [com, setCom] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [equipe, setEquipe] = useState<PessoaDaEquipe[] | null>(null)
  const [outra, setOutra] = useState<{ id: string; nome: string; papel: string } | null>(null)

  const ler = useCallback(async () => {
    try {
      setMensagens(await carregarConversa(p.id))
    } catch {
      setMensagens(m => m ?? [])
    }
  }, [p.id])

  useEffect(() => {
    void ler()
    const t = window.setInterval(() => void ler(), LEITURA_A_CADA)
    return () => window.clearInterval(t)
  }, [ler])

  useEffect(() => {
    if (mensagens) aoContar?.(mensagens.length)
  }, [mensagens, aoContar])

  /* as conversas: a do vendedor primeiro, depois as que já existem, e a
     outra pessoa escolhida agora */
  const conversas = useMemo(() => {
    const lista: { id: string; nome: string; rotulo: string }[] = []
    const por = (id: string, nome: string, papel: string, vendedor: boolean) => {
      if (!id || lista.some(x => x.id === id)) return
      if (!doPcp && id !== eu.id) return
      lista.push({
        id,
        nome,
        rotulo: (vendedor ? 'Vendedor' : nomeDoPapel(papel) || 'Equipe') + ' · ' + primeiro(nome),
      })
    }
    por(p.vendedorId, p.vendedor, 'vendedor', true)
    for (const m of mensagens ?? []) por(m.com, m.comNome, m.comPapel, m.com === p.vendedorId)
    if (outra) por(outra.id, outra.nome, outra.papel, false)
    if (!doPcp && !lista.length)
      lista.push({ id: eu.id, nome: eu.nome, rotulo: 'Comigo · ' + primeiro(eu.nome) })
    return lista
  }, [p.vendedorId, p.vendedor, mensagens, outra, doPcp, eu.id, eu.nome])

  const atual = conversas.find(x => x.id === com) ?? conversas[0]
  const daConversa = (mensagens ?? []).filter(m => m.com === atual?.id)
  const falandoCom = atual ? (atual.id === eu.id ? 'o PCP' : primeiro(atual.nome)) : ''

  async function enviar() {
    if (!atual || !texto.trim()) return
    setEnviando(true)
    try {
      await falarNoPedido(p.id, atual.id, texto.trim())
      setTexto('')
      await ler()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'A mensagem não foi.', 'brand')
    } finally {
      setEnviando(false)
    }
  }

  function tecla(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void enviar()
    }
  }

  /* a equipe, para a "Outra pessoa": só quem é do PCP abre conversa nova */
  useEffect(() => {
    if (!doPcp) return
    let vivo = true
    carregarEquipeParaConversa()
      .then(l => vivo && setEquipe(l))
      .catch(() => vivo && setEquipe([]))
    return () => {
      vivo = false
    }
  }, [doPcp])

  return (
    <section className="cartao pc-conversa" aria-label="Conversa do pedido">
      <header className="pc-cab">
        <TituloCartao icone={ChatsCircle}>Conversa</TituloCartao>
        <span className="pc-cab-apoio">deste pedido</span>
      </header>
      {mensagens === undefined ? (
        <div className="pc-espera">
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </div>
      ) : mensagens === null ? (
        <p className="pc-nada">A conversa ainda não existe no banco: falta rodar a migração 064.</p>
      ) : (
        <div className="pc-conversa-corpo">
          {conversas.length > 1 || doPcp ? (
            <div className="pc-conversa-quem">
              {conversas.length ? (
                <Segmentado
                  className="pc-conversa-abas"
                  valor={atual?.id ?? ''}
                  aoMudar={setCom}
                  opcoes={conversas.map(x => ({ valor: x.id, rotulo: x.rotulo }))}
                />
              ) : null}
              {doPcp ? (
                <Seletor
                  tamanho="sm"
                  valor=""
                  vazio="Outra pessoa"
                  comBusca
                  opcoes={(equipe ?? [])
                    .filter(x => x.id !== eu.id && !conversas.some(c => c.id === x.id))
                    .map(x => ({ valor: x.id, rotulo: x.nome }))}
                  aoEscolher={id => {
                    const x = (equipe ?? []).find(y => y.id === id)
                    if (!x) return
                    setOutra(x)
                    setCom(x.id)
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {!atual ? (
            <p className="pc-nada">
              Este pedido não tem vendedor com conta. Escolha outra pessoa para conversar.
            </p>
          ) : (
            <>
              {!daConversa.length ? (
                <p className="pc-nada">Nenhuma mensagem com {falandoCom} ainda.</p>
              ) : (
                <ol className="pc-msgs">
                  {daConversa.map(m => (
                    <li key={m.id} className="pc-msg" data-mensagem="">
                      <Avatar iniciais={iniciaisDe(m.quemNome || '?')} tamanho={30} />
                      <div className="pc-msg-meio">
                        <span className="pc-msg-quem">
                          <b>{m.quemNome || 'alguém'}</b> <small>{quando(m.em)}</small>
                        </span>
                        <p>{m.texto}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="pc-escrever">
                <AreaTexto
                  rows={2}
                  value={texto}
                  aria-label={'Escrever para ' + falandoCom}
                  placeholder={'Escrever para ' + falandoCom}
                  maxLength={2000}
                  onChange={e => setTexto(e.currentTarget.value)}
                  onKeyDown={tecla}
                />
                <Botao
                  tom="forte"
                  icone
                  className="pc-enviar"
                  aria-label="Enviar a mensagem"
                  carregando={enviando}
                  disabled={!texto.trim() || enviando}
                  onClick={() => void enviar()}
                >
                  <PaperPlaneRight size={18} />
                </Botao>
              </div>
              <p className="pc-apoio pc-conversa-pe">
                A mensagem fica guardada no pedido e avisa a pessoa no sino do sistema.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

const primeiro = (nome: string) => (nome || '').trim().split(/\s+/)[0] || nome
