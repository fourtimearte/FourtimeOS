/* Tela provisória. Some no passo 8, quando a casca do app entrar.
   Por enquanto ela serve de prova de que o porteiro está funcionando. */
export function Inicio() {
  return (
    <main
      style={{
        minHeight: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--sp-6)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
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
        <p style={{ color: 'var(--text-2)', margin: 0 }}>
          Você entrou. A casca do sistema, com menu e cabeçalho, entra no passo 8.
        </p>
      </div>
    </main>
  )
}
