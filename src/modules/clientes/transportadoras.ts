import { useEffect, useState } from 'react'
import { carregarTransportadorasDoCadastro, type Transportadora } from '@dominio/entrega'

/* As transportadoras e os motoboys do cadastro de Transporte (042), para a
   sugestao de frete. null enquanto le; lista vazia se a leitura falhar ou se
   ninguem cadastrou, e a tela diz isso. */
export function usarTransportadoras(): Transportadora[] | null {
  const [lista, setLista] = useState<Transportadora[] | null>(null)
  useEffect(() => {
    let vivo = true
    carregarTransportadorasDoCadastro()
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setLista([]))
    return () => {
      vivo = false
    }
  }, [])
  return lista
}
