import type { ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { App } from './app'
import { ExigePainel, Protegido } from '@dominio/sessao/protegido'
import type { Painel } from '@dominio/sessao'
import { TelaKit } from '@ds'
import { TelaClientes } from '@modules/clientes'
import { AbasDaConfig, TelaEmpresa, TelaEnsaio, TelaEquipe, TelaPaginas } from '@modules/config'
import { DocumentoDaCotacao, EditorDeCotacao, TelaCotacao } from '@modules/cotacao'
import { TelaCriarConta, TelaEntrar } from '@modules/entrar'
import { TelaAtividades } from '@modules/atividades'
import { TelaBanco } from '@modules/banco'
import { TelaEmBreve } from '@modules/em-breve'
import { TelaEstoque } from '@modules/estoque'
import { TelaFicha } from '@modules/ficha'
import { TelaFunil } from '@modules/funil'
import { TelaPcp } from '@modules/pcp'
import { TelaSeparacao } from '@modules/separacao'
import { TelaPerfil } from '@modules/perfil'
import { TelaRelatorio } from '@modules/relatorio'
import { TelaKanban } from '@modules/kanban'
import { TelaPainel } from '@modules/painel'

/* Este arquivo é o ponto de montagem do sistema: o único lugar que conhece
   todas as camadas ao mesmo tempo. É de propósito que ele fique na raiz de src
   e não dentro de shared/, para a regra de dependência continuar de mão única:
   modules → dominio → shared → ds. */

/* Cada tela declara de qual painel ela é, e o porteiro decide. Quem não foi
   aprovado vai para o próprio perfil; quem foi aprovado mas não tem este
   painel vê o aviso de que a tela não é do acesso dela. */
const pede = (painel: Painel, tela: ReactNode) => (
  <ExigePainel painel={painel}>{tela}</ExigePainel>
)

export const rotas = createBrowserRouter([
  { path: '/entrar', element: <TelaEntrar /> },
  { path: '/criar-conta', element: <TelaCriarConta /> },
  {
    path: '/',
    element: (
      <Protegido>
        <App />
      </Protegido>
    ),
    children: [
      { index: true, element: pede('inicio', <TelaPainel />) },

      /* O perfil é a única tela que abre sem aprovação. É onde quem acabou de
         criar a conta descobre que está na fila, em vez de encarar um menu
         vazio sem explicação nenhuma. */
      { path: 'perfil', element: <TelaPerfil /> },

      { path: 'funil', element: pede('funil', <TelaFunil />) },
      { path: 'clientes', element: pede('clientes', <TelaClientes />) },
      { path: 'cotacao', element: pede('cotacao', <TelaCotacao />) },
      { path: 'cotacao/:id', element: pede('cotacao', <EditorDeCotacao />) },
      { path: 'cotacao/:id/folha', element: pede('cotacao', <DocumentoDaCotacao />) },
      /* A MESMA FOLHA, OUTRO LEITOR. A do cliente nasce com valor e a da
         producao nasce sem: e o endereco que decide, para ninguem precisar
         lembrar de apagar preco antes de mandar papel para o galpao. */
      {
        path: 'cotacao/:id/producao',
        element: pede('cotacao', <DocumentoDaCotacao para="producao" />),
      },
      /* A SEPARACAO VEM ANTES DO PCP, no menu e no caminho. Ela e quem
         descobre a verdade sobre o estoque; o PCP e quem decide o que fazer
         com o que faltou. */
      { path: 'separacao', element: pede('separacao', <TelaSeparacao />) },
      { path: 'pcp', element: pede('pcp', <TelaPcp />) },
      /* A ROTA DA FICHA CONTINUA DE PE mesmo com a pagina escondida no menu.
         Esconder e guardar, e nao apagar: quem tem o endereco ainda abre, e e
         assim que da para conferir a pagina guardada sem religar ela para a
         fabrica inteira. */
      { path: 'ficha', element: pede('ficha', <TelaFicha />) },
      { path: 'kanban', element: pede('kanban', <TelaKanban />) },
      { path: 'estoque', element: pede('estoque', <TelaEstoque />) },
      { path: 'kit', element: pede('kit', <TelaKit abas={<AbasDaConfig atual="kit" />} />) },
      { path: 'atividades', element: pede('atividades', <TelaAtividades />) },
      { path: 'relatorio', element: pede('relatorio', <TelaRelatorio />) },
      { path: 'banco', element: pede('banco', <TelaBanco />) },
      { path: 'config', element: pede('config', <TelaEquipe />) },
      { path: 'config/empresa', element: pede('config', <TelaEmpresa />) },
      { path: 'config/ensaio', element: pede('config', <TelaEnsaio />) },
      { path: 'config/paginas', element: pede('config', <TelaPaginas />) },

      /* O destino do v5 que ainda não tem módulo. Ele existe para o menu estar
         inteiro: nenhum item leva a lugar nenhum. */
      {
        path: 'produtos',
        element: pede(
          'produtos',
          <TelaEmBreve
            acima="Produção"
            titulo="Fichas técnicas"
            sub="A referência de cada peça: molde, tecido, consumo e mínimo."
            fase="fase 2"
            texto="Ela nasce junto com a ficha de produção, porque as duas leem o mesmo cadastro de referência."
          />,
        ),
      },
    ],
  },
])
