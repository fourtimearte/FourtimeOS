import { Outlet, useNavigate } from 'react-router-dom'
import { sair } from '@dominio/sessao'

/* A casca do app, com menu lateral, cabeçalho e barra do celular, entra no
   passo 8. Aqui ela é só o lugar onde as telas aparecem, mais um botão de sair
   provisório para dar para testar a entrada de novo. */
export function App() {
  const navegar = useNavigate()
  return (
    <div style={{ minHeight: '100dvh', position: 'relative' }}>
      <Outlet />
      <button
        type="button"
        onClick={() => {
          sair()
          navegar('/entrar', { replace: true })
        }}
        style={{
          position: 'fixed',
          right: 'var(--sp-4)',
          top: 'var(--sp-4)',
          height: 'var(--btn-h-sm)',
          padding: '0 var(--sp-4)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text-2)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Sair
      </button>
    </div>
  )
}
