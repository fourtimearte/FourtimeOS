import { createBrowserRouter } from 'react-router-dom'
import { App } from './app'
import { Protegido } from '@dominio/sessao/protegido'
import { TelaEntrar } from '@modules/entrar'
import { Inicio } from '@shared/inicio'
import { TelaKit } from '@ds'

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
      { index: true, element: <Inicio /> },
      { path: 'kit', element: <TelaKit /> },
    ],
  },
])
