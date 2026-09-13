import { NavLink } from 'react-router-dom'
import { Buildings, Database, UsersThree } from '@phosphor-icons/react'
import { podeVer, useSessao } from '@dominio/sessao'
import type { Painel } from '@dominio/sessao'

/* ==========================================================================
   As subpáginas de Configurações.

   Configurações deixou de ser uma tela só: ela virou uma área com três
   destinos, e o banco de dados da fábrica é um deles. Esta barra é o que
   amarra os três, e ela aparece igual nos três, porque quem está em Banco
   precisa voltar para Pessoas sem passar pelo menu.

   Cada aba tem o painel dela. O banco tem painel próprio de propósito: um
   gerente de produção precisa consertar o nome de uma referência sem ganhar,
   junto, o poder de aprovar conta de gente.
   ========================================================================== */

export type AbaDaConfig = 'pessoas' | 'banco' | 'empresa'

const ABAS: { chave: AbaDaConfig; para: string; rotulo: string; painel: Painel }[] = [
  { chave: 'pessoas', para: '/config', rotulo: 'Pessoas', painel: 'config' },
  { chave: 'banco', para: '/banco', rotulo: 'Banco de dados', painel: 'banco' },
  { chave: 'empresa', para: '/config/empresa', rotulo: 'Empresa', painel: 'config' },
]

const ICONE: Record<AbaDaConfig, typeof UsersThree> = {
  pessoas: UsersThree,
  banco: Database,
  empresa: Buildings,
}

export function AbasDaConfig({ atual }: { atual: AbaDaConfig }) {
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null

  /* Uma aba sozinha não é escolha nenhuma: ela vira um enfeite que a pessoa
     clica e continua no mesmo lugar. */
  const minhas = ABAS.filter((a) => !!pessoa && podeVer(pessoa, a.painel))
  if (minhas.length < 2) return null

  return (
    <nav className="cfg-abas" aria-label="Configurações">
      {minhas.map((a) => {
        const Icone = ICONE[a.chave]
        return (
          <NavLink
            key={a.chave}
            to={a.para}
            end
            className={a.chave === atual ? 'cfg-aba ligada' : 'cfg-aba'}
            aria-current={a.chave === atual ? 'page' : undefined}
          >
            <Icone size={17} />
            {a.rotulo}
          </NavLink>
        )
      })}
    </nav>
  )
}
