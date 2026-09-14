import { useCallback, useEffect, useState } from 'react'
import { Flask, Trash } from '@phosphor-icons/react'
import { Aviso, Botao, Cartao, Pagina, TituloCartao, avisar } from '@ds'
import {
  apagarDadosDeTeste,
  contarDadosDeTeste,
  semearClientes,
  totalDeTeste,
  type ContaDeTeste,
} from '@dominio/semente'
import { AbasDaConfig } from './abas'
import './config.css'

/* ==========================================================================
   O ensaio.

   O banco de verdade nasceu vazio, e tela vazia não se confere: ninguém sabe
   se a ordenação está certa olhando zero linhas. Esta tela grava conteúdo de
   mentira no banco de verdade, para as telas terem o que mostrar enquanto os
   1.901 contatos do Bling não entram.

   O que ela NÃO faz é fingir. O conteúdo é inventado, mas o caminho é o real:
   a mesma consulta, a mesma regra de acesso, o mesmo erro quando a internet
   cai. É isso que separa semear de ter uma lista de exemplo dentro do
   navegador, que é o que havia até ontem.

   Tudo que ela grava fica marcado como teste e sai inteiro num clique. A
   contagem embaixo lê a marca, e não um palpite: é a mesma marca que o
   pedido usa para nascer PD-TESTE-0001 até o dia do lançamento.
   ========================================================================== */

const ROTULO: Record<string, string> = {
  cliente: 'Clientes',
  lead: 'Leads',
  cotacao: 'Cotações',
  pedido: 'Pedidos',
}

export function TelaEnsaio() {
  const [contas, setContas] = useState<ContaDeTeste[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState('')
  const [falha, setFalha] = useState('')

  const recontar = useCallback(async () => {
    try {
      setContas(await contarDadosDeTeste())
      setFalha('')
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui contar o que está no banco.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recontar()
  }, [recontar])

  const total = totalDeTeste(contas)

  async function semear() {
    if (ocupado) return
    setOcupado('semeando')
    try {
      const r = await semearClientes()
      await recontar()
      if (r.gravados && !r.recusados) {
        avisar(r.gravados + ' clientes de teste gravados no banco', 'ok')
      } else if (r.gravados) {
        avisar(r.gravados + ' gravados, ' + r.recusados + ' recusados: ' + r.recados[0], 'warn')
      } else {
        avisar('Nenhum cliente entrou. ' + (r.recados[0] ?? ''), 'warn')
      }
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui semear', 'warn')
    } finally {
      setOcupado('')
    }
  }

  async function limpar() {
    if (ocupado) return
    setOcupado('limpando')
    try {
      const recado = await apagarDadosDeTeste()
      await recontar()
      avisar(recado, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui apagar', 'warn')
    } finally {
      setOcupado('')
    }
  }

  return (
    <Pagina
      acima="Configurações"
      titulo="Ensaio"
      sub="Conteúdo de mentira no caminho de verdade, até a base do Bling entrar."
    >
      <AbasDaConfig atual="ensaio" />

      <Aviso tom="info" titulo="O que é semeado fica marcado">
        Tudo que entra por aqui nasce com a marca de teste, e o pedido aprovado enquanto o sistema
        estiver em ensaio nasce <b>PD-TESTE-0001</b> em vez de um número de pedido de verdade.
        Nada disso se mistura com a base do Bling quando ela chegar, e sai inteiro em um clique.
      </Aviso>

      <Cartao>
        <TituloCartao>O que está no banco agora</TituloCartao>
        {carregando ? (
          <p className="cfg-nota">Contando...</p>
        ) : falha ? (
          <p className="cfg-nota cfg-falha">{falha}</p>
        ) : (
          <div className="cfg-contas">
            {contas.map((c) => (
              <div key={c.tabela} className={c.linhas ? 'cfg-conta tem' : 'cfg-conta'}>
                <b>{c.linhas.toLocaleString('pt-BR')}</b>
                <span>{ROTULO[c.tabela] ?? c.tabela}</span>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Cartao>
        <TituloCartao>Semear</TituloCartao>
        <p className="cfg-nota">
          Grava os clientes de exemplo no banco, com o histórico de compras no lugar em que a
          importação do Bling vai colocar o dela. Semear duas vezes não duplica ninguém: a trava
          do nome recusa o repetido e diz quantos ficaram de fora.
        </p>
        <div className="cfg-botoes">
          <Botao tom="primario" onClick={() => void semear()} disabled={!!ocupado}>
            <Flask size={16} weight="bold" />
            {ocupado === 'semeando' ? 'Semeando...' : 'Semear clientes'}
          </Botao>
        </div>
      </Cartao>

      <Cartao>
        <TituloCartao>Limpar</TituloCartao>
        <p className="cfg-nota">
          Apaga <b>só</b> o que está marcado como teste, na ordem que o banco permite: pedido,
          cotação, lead e cliente. O que não está marcado não é tocado.
        </p>
        <div className="cfg-botoes">
          <Botao tom="perigo" onClick={() => void limpar()} disabled={!!ocupado || !total}>
            <Trash size={16} weight="bold" />
            {ocupado === 'limpando' ? 'Apagando...' : 'Apagar os dados de teste'}
          </Botao>
        </div>
      </Cartao>
    </Pagina>
  )
}
