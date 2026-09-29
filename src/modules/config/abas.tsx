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
  Wrench,
} from '@phosphor-icons/react'
import { podeVer, souAdmin, useSessao } from '@dominio/sessao'
import type { Painel, Pessoa } from '@dominio/sessao'

/* ==========================================================================
   As subpáginas de Configurações.

   Configurações deixou de ser uma tela só: ela virou uma área com três
   destinos, e o banco de dados da fábrica é um deles. Esta barra é o que
   amarra os três, e ela aparece igual nos três, porque quem está em Banco
   precisa voltar para Pessoas sem passar pelo menu.

   Cada aba tem o painel dela. O banco tem painel próprio de propósito: um
   gerente de produção precisa consertar o nome de uma referência sem ganhar,
   junto, o poder de aprovar conta de gente.

   ESTA LISTA É A ÚNICA. O menu lateral e a barra de baixo leem daqui, e não
   têm cópia própria. Enquanto tinham, cada página nova de Configurações
   entrava nas abas e esquecia o menu: em 29/09 o menu mostrava quatro das
   oito. A regra está em claude/REGRA-MENU-DE-CONFIGURACOES.md, e
   testes/menu-config.mjs reprova a rota de Configurações que não estiver
   aqui.
   ========================================================================== */

export type AbaDaConfig =
  | 'pessoas'
  | 'acessos'
  | 'tags'
  | 'banco'
  | 'empresa'
  | 'paginas'
  | 'ferramentas'
  | 'ensaio'
  | 'kit'

export type AbaDeConfig = {
  chave: AbaDaConfig
  para: string
  rotulo: string
  painel: Painel
  /* ACESSOS É A ÚNICA ABA COM DONO. As outras seguem o painel de quem abriu;
     esta é de quem administra, porque ela é o lugar de onde sai o poder de
     todas as outras. Um gerente que só lê Configurações não pode se dar
     controle total aqui e sair lendo o sistema inteiro. */
  soAdmin?: boolean
}

export const ABAS_DA_CONFIG: AbaDeConfig[] = [
  { chave: 'pessoas', para: '/config', rotulo: 'Pessoas', painel: 'config' },
  { chave: 'acessos', para: '/config/acessos', rotulo: 'Acessos', painel: 'config', soAdmin: true },
  { chave: 'tags', para: '/config/tags', rotulo: 'Tags do quadro', painel: 'config' },
  { chave: 'banco', para: '/banco', rotulo: 'Banco de dados', painel: 'banco' },
  { chave: 'empresa', para: '/config/empresa', rotulo: 'Empresa', painel: 'config' },
  { chave: 'paginas', para: '/config/paginas', rotulo: 'Páginas', painel: 'config' },
  { chave: 'ferramentas', para: '/config/ferramentas', rotulo: 'Ferramentas', painel: 'config' },
  { chave: 'ensaio', para: '/config/ensaio', rotulo: 'Ensaio', painel: 'config' },
  { chave: 'kit', para: '/kit', rotulo: 'Design System', painel: 'kit' },
]

export const ICONE_DA_ABA: Record<AbaDaConfig, typeof UsersThree> = {
  pessoas: UsersThree,
  acessos: Lock,
  tags: IconeTag,
  banco: Database,
  empresa: Buildings,
  paginas: SquaresFour,
  ferramentas: Wrench,
  ensaio: Flask,
  kit: Palette,
}

/** As abas que esta pessoa alcança. O menu lateral usa a mesma peneira. */
export function abasDaConfigDe(pessoa: Pessoa | null): AbaDeConfig[] {
  return ABAS_DA_CONFIG.filter(
    (a) => !!pessoa && podeVer(pessoa, a.painel) && (!a.soAdmin || souAdmin(pessoa)),
  )
}

export function AbasDaConfig({ atual }: { atual: AbaDaConfig }) {
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null

  /* Uma aba sozinha não é escolha nenhuma: ela vira um enfeite que a pessoa
     clica e continua no mesmo lugar. */
  const minhas = abasDaConfigDe(pessoa)
  if (minhas.length < 2) return null

  return (
    <nav className="cfg-abas" aria-label="Configurações">
      {minhas.map((a) => {
        const Icone = ICONE_DA_ABA[a.chave]
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
