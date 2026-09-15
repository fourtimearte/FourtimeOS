import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { rotas } from './rotas'
import { aplicarTema, ligarLuz, temaGuardado } from '@ds'
import { ProvedorDeSessao } from '@dominio/sessao'
import './estilo.css'

/* o tema escolhido antes vale desde o primeiro quadro, sem piscar */
const guardado = temaGuardado()
if (guardado) aplicarTema(guardado)

/* a luz que segue o ponteiro nos cartoes. Um ouvinte para o documento todo,
   e ela mesma se recusa a ligar no toque e em prefers-reduced-motion. */
ligarLuz()

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Elemento #raiz não encontrado no index.html')

createRoot(raiz).render(
  <StrictMode>
    <ProvedorDeSessao>
      <RouterProvider router={rotas} />
    </ProvedorDeSessao>
  </StrictMode>,
)
