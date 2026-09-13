import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSessao } from './contexto'
import { liberada, podeVer } from './tipos'
import type { Painel } from './tipos'

/* Porteiro da entrada: sem sessao nao passa.

   Guarda de onde a pessoa veio para devolver ela no lugar certo depois de
   entrar, que e o que evita o "entrei e cai na tela inicial de novo". */
export function Protegido({ children }: { children: ReactNode }) {
  const { estado } = useSessao()
  const local = useLocation()

  /* Enquanto o cracha guardado esta sendo conferido, nao decide nada. Mandar
     para a entrada aqui faria quem ja estava dentro piscar na tela de login a
     cada recarga da pagina. */
  if (estado.fase === 'conferindo') return <Conferindo />

  if (estado.fase === 'fora') {
    return <Navigate to="/entrar" replace state={{ de: local.pathname + local.search }} />
  }
  return <>{children}</>
}

/* Porteiro de cada painel.

   Duas recusas diferentes, de proposito. Quem ainda nao foi aprovado vai para
   o proprio perfil, porque nao ha nada que ela possa fazer e mostrar "sem
   acesso" seria falar de uma porta que nem existe para ela ainda. Quem foi
   aprovada mas nao tem este painel ve o aviso, porque para ela a porta existe
   e a informacao util e de quem pedir a chave.

   Isto e organizacao, nao tranca. O que protege o dado e a regra de acesso das
   tabelas no banco, que olha o papel. Esconder um item de menu so evita que a
   pessoa esbarre no que nao e dela. */
export function ExigePainel({ painel, children }: { painel: Painel; children: ReactNode }) {
  const { estado } = useSessao()
  if (estado.fase !== 'dentro') return null

  const { pessoa } = estado
  if (!liberada(pessoa)) return <Navigate to="/perfil" replace />
  if (!podeVer(pessoa, painel)) return <SemAcesso />
  return <>{children}</>
}

function SemAcesso() {
  return (
    <div className="vazio">
      <h3>Esta tela não faz parte do seu acesso</h3>
      <p>
        Peça ao administrador para liberar este painel para você. Ele faz isso em Configurações,
        na ficha da sua conta.
      </p>
    </div>
  )
}

/* Um instante so, entao nao merece tela: o mesmo circulo do botao carregando,
   sozinho no meio do fundo, na cor do tema que ja esta aplicado. */
function Conferindo() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
        color: 'var(--text-3)',
      }}
      role="status"
      aria-label="Conferindo o acesso"
    >
      <span className="girando" />
    </div>
  )
}
