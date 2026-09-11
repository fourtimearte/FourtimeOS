import { Link } from 'react-router-dom'

/* Tela provisória. Some no passo 8, quando a casca do app entrar.
   Por enquanto ela prova que o porteiro funciona e leva ao kit. */
export function Inicio() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--sp-6)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--brand)',
            color: 'var(--on-brand)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
            fontWeight: 800,
            margin: '0 auto var(--sp-5)',
          }}
        >
          F
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 var(--sp-2)' }}>Fourtime OS</h1>
        <p style={{ color: 'var(--text-2)', margin: '0 0 var(--sp-6)' }}>
          Você entrou. A casca do sistema, com menu e cabeçalho, entra no passo 8.
        </p>
        <Link
          to="/kit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 'var(--btn-h)',
            padding: '0 var(--sp-5)',
            borderRadius: 'var(--radius)',
            background: 'var(--ink)',
            color: 'var(--on-ink)',
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Abrir o Design System
        </Link>
      </div>
    </main>
  )
}
