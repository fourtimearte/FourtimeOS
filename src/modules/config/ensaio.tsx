import { useCallback, useEffect, useState } from 'react'
import { Flask, Trash } from '@phosphor-icons/react'
import { Aviso, Botao, Cartao, Pagina, TituloCartao, avisar } from '@ds'
import {
  apagarDadosDeTeste,
  contarDadosDeTeste,
  semearClientes,
  semearCotacoes,
  semearEstoque,
  semearLeads,
  semearPedidos,
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
  material: 'Materiais',
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

  async function semear(oQue: 'clientes' | 'leads' | 'cotações' | 'pedidos' | 'estoque') {
    if (ocupado) return
    setOcupado(oQue)
    try {
      const r =
        oQue === 'clientes'
          ? await semearClientes()
          : oQue === 'leads'
            ? await semearLeads()
            : oQue === 'cotações'
              ? await semearCotacoes()
              : oQue === 'estoque'
                ? await semearEstoque()
                : await semearPedidos()
      await recontar()
      if (r.gravados && !r.recusados) {
        /* O recado sobrevive ao sucesso de propósito: semear estoque pode dar
           certo e ainda assim deixar uma malha sem ligação no catálogo, e essa
           é justamente a informação que some se só o número aparecer. */
        avisar(
          r.gravados + ' ' + oQue + ' de teste gravados no banco' +
            (r.recados[0] ? ' · ' + r.recados[0] : ''),
          'ok',
        )
      } else if (r.gravados) {
        avisar(r.gravados + ' gravados, ' + r.recusados + ' recusados: ' + r.recados[0], 'warn')
      } else {
        avisar('Nada entrou. ' + (r.recados[0] ?? ''), 'warn')
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
              <div key={c.tabela} className={c.linhas ? 'cfg-caixa tem' : 'cfg-caixa'}>
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
          <b>Clientes</b>: grava os 136 de exemplo com o histórico de compras no lugar em que a
          importação do Bling vai colocar o dela. Semear duas vezes não duplica ninguém: a trava
          do nome recusa o repetido e diz quantos ficaram de fora.
        </p>
        <p className="cfg-nota">
          <b>Cotações</b>: grava seis com layouts, grades e preços, uma em cada situação. O número
          sai do contador do banco, e não do exemplo: assim a primeira cotação de verdade não
          esbarra num número já usado.
        </p>
        <p className="cfg-nota">
          <b>Pedidos</b>: aprova as cotações de teste que já foram enviadas, pelo mesmo caminho que
          o vendedor usa quando o cliente diz sim, e espalha os pedidos pela semana e pelos postos.
          Um insert direto daria uma fábrica cheia de cartões sem provar nada; aprovando, o número
          do pedido, o vendedor congelado e os números da fábrica rodam de verdade.
        </p>
        <p className="cfg-nota">
          <b>Estoque</b>: cadastra 26 materiais e dá entrada no saldo de cada um, um movimento de
          cada vez. O tecido aponta para o catálogo do editor por id, e não pelo nome, que é o que
          vai deixar a separação achar a malha do layout. O saldo não é escrito na coluna: ele
          nasce do razão, igual ao que vai acontecer quando a nota fiscal chegar.
        </p>
        <p className="cfg-nota">
          <b>Leads</b>: grava os oito do funil com a conversa de cada um. O tempo vira data na
          hora de semear, então os cartões nascem com o relógio certo e ele anda de verdade
          enquanto a tela fica aberta.
        </p>
        <div className="cfg-botoes">
          <Botao tom="primario" onClick={() => void semear('clientes')} disabled={!!ocupado}>
            <Flask size={16} weight="bold" />
            {ocupado === 'clientes' ? 'Semeando...' : 'Semear clientes'}
          </Botao>
          <Botao tom="forte" onClick={() => void semear('leads')} disabled={!!ocupado}>
            <Flask size={16} weight="bold" />
            {ocupado === 'leads' ? 'Semeando...' : 'Semear leads'}
          </Botao>
          <Botao tom="contorno" onClick={() => void semear('cotações')} disabled={!!ocupado}>
            <Flask size={16} weight="bold" />
            {ocupado === 'cotações' ? 'Semeando...' : 'Semear cotações'}
          </Botao>
          <Botao tom="contorno" onClick={() => void semear('pedidos')} disabled={!!ocupado}>
            <Flask size={16} weight="bold" />
            {ocupado === 'pedidos' ? 'Aprovando...' : 'Aprovar as cotações'}
          </Botao>
          <Botao tom="contorno" onClick={() => void semear('estoque')} disabled={!!ocupado}>
            <Flask size={16} weight="bold" />
            {ocupado === 'estoque' ? 'Semeando...' : 'Semear estoque'}
          </Botao>
        </div>
      </Cartao>

      <Cartao>
        <TituloCartao>Limpar</TituloCartao>
        <p className="cfg-nota">
          Apaga <b>só</b> o que está marcado como teste, na ordem que o banco permite: pedido,
          cotação, lead, cliente e material. O que não está marcado não é tocado. O razão do
          material sai junto com ele, porque movimento de material que não existe mais não explica
          nada.
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
