import { useEffect, useState } from 'react'

/* A tela cabe nesta consulta de mídia? Serve para a página que muda de
   ESTRUTURA entre o computador e o celular, e não só de medida: quando a
   mudança é só de medida, o lugar dela é o CSS, e este gancho não entra. */
export function usarConsulta(consulta: string): boolean {
  const [cabe, setCabe] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(consulta).matches : false,
  )
  useEffect(() => {
    if (!window.matchMedia) return
    const m = window.matchMedia(consulta)
    const ouvir = () => setCabe(m.matches)
    ouvir()
    m.addEventListener('change', ouvir)
    return () => m.removeEventListener('change', ouvir)
  }, [consulta])
  return cabe
}
