import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { rotas } from './rotas'
import { aplicarTema, temaGuardado } from '@ds'
import './estilo.css'

/* o tema escolhido antes vale desde o primeiro quadro, sem piscar */
const guardado = temaGuardado()
if (guardado) aplicarTema(guardado)

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Elemento #raiz não encontrado no index.html')

createRoot(raiz).render(
  <StrictMode>
    <RouterProvider router={rotas} />
  </StrictMode>,
)
