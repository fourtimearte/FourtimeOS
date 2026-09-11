import { createBrowserRouter } from 'react-router-dom'
import { App } from '../app'
import { Inicio } from './inicio'

export const rotas = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [{ index: true, element: <Inicio /> }],
  },
])
