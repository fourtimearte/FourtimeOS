import { createBrowserRouter } from 'react-router-dom'
import { App } from './app'
import { Protegido } from '@dominio/sessao/protegido'
import { TelaKit } from '@ds'
import { TelaClientes } from '@modules/clientes'
import { DocumentoDaCotacao, EditorDeCotacao, TelaCotacao } from '@modules/cotacao'
import { TelaEntrar } from '@modules/entrar'
import { TelaAtividades } from '@modules/atividades'
import { TelaBanco } from '@modules/banco'
import { TelaEmBreve } from '@modules/em-breve'
import { TelaEstoque } from '@modules/estoque'
import { TelaFicha } from '@modules/ficha'
import { TelaFunil } from '@modules/funil'
import { TelaRelatorio } from '@modules/relatorio'
import { TelaKanban } from '@modules/kanban'
import { TelaPainel } from '@modules/painel'

/* Este arquivo é o ponto de montagem do sistema: o único lugar que conhece
   todas as camadas ao mesmo tempo. É de propósito que ele fique na raiz de src
   e não dentro de shared/, para a regra de dependência continuar de mão única:
   modules → dominio → shared → ds. */
export const rotas = createBrowserRouter([
  { path: '/entrar', element: <TelaEntrar /> },
  {
    path: '/',
    element: (
      <Protegido>
        <App />
      </Protegido>
    ),
    children: [
      { index: true, element: <TelaPainel /> },
      { path: 'funil', element: <TelaFunil /> },
      { path: 'clientes', element: <TelaClientes /> },
      { path: 'cotacao', element: <TelaCotacao /> },
      { path: 'cotacao/:id', element: <EditorDeCotacao /> },
      { path: 'cotacao/:id/folha', element: <DocumentoDaCotacao /> },
      { path: 'ficha', element: <TelaFicha /> },
      { path: 'kanban', element: <TelaKanban /> },
      { path: 'estoque', element: <TelaEstoque /> },
      { path: 'kit', element: <TelaKit /> },

      /* Os destinos do v5 que ainda nao tem modulo. Eles existem para o menu
         estar inteiro: nenhum item leva a lugar nenhum. */
      {
        path: 'produtos',
        element: (
          <TelaEmBreve
            acima="Produção"
            titulo="Fichas técnicas"
            sub="A referência de cada peça: molde, tecido, consumo e mínimo."
            fase="fase 2"
            texto="Ela nasce junto com a ficha de produção, porque as duas leem o mesmo cadastro de referência."
          />
        ),
      },
      { path: 'atividades', element: <TelaAtividades /> },
      { path: 'relatorio', element: <TelaRelatorio /> },
      { path: 'banco', element: <TelaBanco /> },
      {
        path: 'config',
        element: (
          <TelaEmBreve
            acima="Gestão"
            titulo="Configurações"
            sub="Empresa, pessoas, papéis e o que cada um pode fazer."
            fase="fase 1, junto com o Supabase"
            texto="O endereço e o CNPJ da Fourtime, que hoje estão como a conferir no rodapé da folha, passam a ser preenchidos aqui."
          />
        ),
      },
    ],
  },
])
