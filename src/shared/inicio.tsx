/* Tela provisória do passo 2. Some no passo 8, quando a casca do app entrar. */
export function Inicio() {
  return (
    <main
      style={{
        minHeight: '100%',
        display: 'grid',
        placeItems: 'center',
        background: '#EBEDF1',
        color: '#1A1D23',
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: '#C6161B',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            font: '800 22px/1 system-ui',
            margin: '0 auto 18px',
          }}
        >
          F
        </div>
        <h1 style={{ font: '600 24px/1.2 system-ui', margin: '0 0 8px' }}>Fourtime OS</h1>
        <p style={{ font: '400 14.5px/1.5 system-ui', color: '#5C6470', margin: 0 }}>
          Esqueleto no ar. Os tokens do V7 e a rota <code>/kit</code> entram no passo 3.
        </p>
      </div>
    </main>
  )
}
