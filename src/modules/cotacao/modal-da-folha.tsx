import { useCallback, useState } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { Botao, Esqueleto, Modal, Seletor, Vazio } from '@ds'
import { PRESET_PRODUCAO } from '@dominio/cotacao'
import { FolhaDaCotacao } from './documento'
import { usarModoDaFolha } from './paginas-de-layout'
import { usarPresetsDaFolha } from './presets-da-folha'
import { usarCotacao } from './usar-cotacao'

/* ==========================================================================
   A folha da cotação, por cima da tela em que se estava.

   POR QUE ELA EXISTE. No PCP, "Ver a folha" era um link: conferir um pedido
   custava sair da tela, e voltar custava recarregar a fila, reencontrar o
   pedido na coluna e refazer a rolagem. Quem confere quinze pedidos numa manhã
   pagava esse preço trinta vezes. A folha é uma CONSULTA, e consulta não muda
   de lugar: ela abre por cima e fecha.

   IMPRIMIR CONTINUA NA PÁGINA INTEIRA, e isso é decisão e não preguiça. A
   folha impressa depende de um CSS que apaga a casca e deixa só a vista, e o
   conteúdo de um <dialog> vive na camada de topo do navegador, fora dessa
   árvore. Um botão de imprimir aqui dentro sairia certo num navegador e
   errado no outro, e folha de produção que sai errada na impressora do galpão
   é pior do que folha que pede um clique a mais.

   E o botão abre em ABA NOVA, não navega. Trocar de página era exatamente o
   que esta tela veio resolver: abrir para imprimir não pode desfazer o
   conserto.
   ========================================================================== */

export function ModalDaFolha({
  cotacaoId,
  numeroDoPedido,
  aoFechar,
}: {
  cotacaoId: string
  /* o número do PEDIDO, e não o da cotação: quem abre isto no PCP está
     olhando para um pedido, e o título tem que dizer o que ele pediu */
  numeroDoPedido?: string
  aoFechar: () => void
}) {
  const { cotacao: c, carregando, falha } = usarCotacao(cotacaoId)

  /* NASCE NO PRESET PRODUÇÃO. Quem abre a folha a partir do PCP está
     conferindo o que vai para o chão de fábrica, e preço não é assunto de lá.
     A regra está em claude/REGRA-COM-VALOR-E-SEM-VALOR.md. Os outros presets
     se escolhem aqui; editar um preset é na página de impressão. */
  const presets = usarPresetsDaFolha('producao')
  const [modo, setModo] = usarModoDaFolha()
  const [paginas, setPaginas] = useState(0)
  const contar = useCallback((n: number) => setPaginas(n), [])

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      gigante
      titulo={
        (numeroDoPedido ? numeroDoPedido + ' · ' : '') +
        (c ? 'folha ' + c.numero : 'abrindo a folha...') +
        (paginas ? ' · ' + paginas + (paginas === 1 ? ' página' : ' páginas') : '')
      }
      pe={
        <>
          <Seletor
            rotulo="PRESET"
            valor={presets.escolhido.id === PRESET_PRODUCAO.id ? '' : presets.escolhido.id}
            vazio={PRESET_PRODUCAO.nome}
            opcoes={presets.lista
              .filter((x) => x.id !== PRESET_PRODUCAO.id)
              .map((x) => ({ valor: x.id, rotulo: x.nome }))}
            aoEscolher={(v) => presets.escolher(v || PRESET_PRODUCAO.id)}
          />
          <Seletor
            rotulo="LAYOUTS"
            valor={modo === 'cheia' ? 'cheia' : ''}
            vazio="2 por página"
            opcoes={[{ valor: 'cheia', rotulo: '1 por página' }]}
            aoEscolher={(v) => setModo(v === 'cheia' ? 'cheia' : 'dupla')}
          />
          <Botao tom="contorno" onClick={aoFechar}>
            Fechar
          </Botao>
          {c ? (
            <Botao
              tom="primario"
              onClick={() =>
                window.open(
                  '/cotacao/' +
                    c.id +
                    (presets.vista.valor ? '/folha' : '/producao') +
                    '?preset=' +
                    encodeURIComponent(presets.escolhido.id),
                  '_blank',
                  'noopener',
                )
              }
            >
              Abrir para imprimir
              <ArrowSquareOut size={16} weight="bold" />
            </Botao>
          ) : null}
        </>
      }
    >
      {carregando ? <Esqueleto altura={420} /> : null}

      {!carregando && !c ? (
        <Vazio
          titulo={falha ? 'Não consegui abrir esta folha' : 'Esta cotação não existe mais'}
          texto={falha || 'Ela pode ter sido apagada por outra pessoa.'}
        />
      ) : null}

      {c ? <FolhaDaCotacao key={modo} cotacao={c} vista={presets.vista} modo={modo} aoContar={contar} /> : null}
    </Modal>
  )
}
