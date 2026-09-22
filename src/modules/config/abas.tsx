import { NavLink } from 'react-router-dom'
import {
  Buildings,
  Database,
  Flask,
  Lock,
  Palette,
  SquaresFour,
  Tag as IconeTag,
  UsersThree,
} from '@phosphor-icons/react'
import { podeVer, souAdmin, useSessao } from '@dominio/sessao'
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

export type AbaDaConfig =
  | 'pessoas'
  | 'acessos'
  | 'tags'
  | 'banco'
  | 'empresa'
  | 'paginas'
  | 'ensaio'
  | 'kit'

const ABAS: {
  chave: AbaDaConfig
  para: string
  rotulo: string
  painel: Painel
  /* ACESSOS É A ÚNICA ABA COM DONO. As outras seguem o painel de quem abriu;
     esta é de quem administra, porque ela é o lugar de onde sai o poder de
     todas as outras. Um gerente que só lê Configurações não pode se dar
     controle total aqui e sair lendo o sistema inteiro. */
  soAdmin?: boolean
}[] = [
  { chave: 'pessoas', para: '/config', rotulo: 'Pessoas', painel: 'config' },
  { chave: 'acessos', para: '/config/acessos', rotulo: 'Acessos', painel: 'config', soAdmin: true },
  { chave: 'tags', para: '/config/tags', rotulo: 'Tags do quadro', painel: 'config' },
  { chave: 'banco', para: '/banco', rotulo: 'Banco de dados', painel: 'banco' },
  { chave: 'empresa', para: '/config/empresa', rotulo: 'Empresa', painel: 'config' },
  { chave: 'paginas', para: '/config/paginas', rotulo: 'Páginas', painel: 'config' },
  { chave: 'ensaio', para: '/config/ensaio', rotulo: 'Ensaio', painel: 'config' },
  { chave: 'kit', para: '/kit', rotulo: 'Design System', painel: 'kit' },
]

const ICONE: Record<AbaDaConfig, typeof UsersThree> = {
  pessoas: UsersThree,
  acessos: Lock,
  tags: IconeTag,
  banco: Database,
  empresa: Buildings,
  paginas: SquaresFour,
  ensaio: Flask,
  kit: Palette,
}

export function AbasDaConfig({ atual }: { atual: AbaDaConfig }) {
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null

  /* Uma aba sozinha não é escolha nenhuma: ela vira um enfeite que a pessoa
     clica e continua no mesmo lugar. */
  const minhas = ABAS.filter(
    (a) => !!pessoa && podeVer(pessoa, a.painel) && (!a.soAdmin || souAdmin(pessoa)),
  )
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
