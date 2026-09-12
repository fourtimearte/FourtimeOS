import { createBrowserRouter } from 'react-router-dom'
import { App } from './app'
import { Protegido } from '@dominio/sessao/protegido'
import { TelaKit } from '@ds'
import { TelaClientes } from '@modules/clientes'
import { EditorDeCotacao, TelaCotacao } from '@modules/cotacao'
import { TelaEntrar } from '@modules/entrar'
import { TelaEstoque } from '@modules/estoque'
import { TelaFicha } from '@modules/ficha'
import { TelaFunil } from '@modules/funil'
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
      { path: 'ficha', element: <TelaFicha /> },
      { path: 'kanban', element: <TelaKanban /> },
      { path: 'estoque', element: <TelaEstoque /> },
      { path: 'kit', element: <TelaKit /> },
    ],
  },
])
