import { useEffect, useState } from 'react'
import { Globe } from '@phosphor-icons/react'
import { Cartao, Seletor, TituloCartao, avisar } from '@ds'
import type { PessoaDaEquipe } from '@dominio/equipe'
import { carregarRegraDoLeadDoSite, salvarRegraDoLeadDoSite, type RegraDoLeadDoSite } from '@dominio/funil'

/* ==========================================================================
   QUEM RECEBE O LEAD DO SITE (065, plano 15, decisao 1).

   Hoje e uma pessoa fixa; o rodizio ja existe no banco e entra aqui quando o
   Henrique decidir ("no futuro rodizio", 11/10/2026). So o admin ve este
   cartao, e o banco recusa a troca de quem nao e.
   ========================================================================== */
export function QuemRecebeOLeadDoSite({ equipe }: { equipe: PessoaDaEquipe[] }) {
  const [regra, setRegra] = useState<RegraDoLeadDoSite | null | undefined>(undefined)
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    let vivo = true
    carregarRegraDoLeadDoSite()
      .then((r) => vivo && setRegra(r))
      .catch(() => vivo && setRegra(null))
    return () => {
      vivo = false
    }
  }, [])

  const quem = equipe
    .filter((p) => p.situacao === 'aprovado' && ['admin', 'gerente', 'vendedor'].includes(p.papel))
    .map((p) => ({ valor: p.id, rotulo: p.nome || p.email }))

  async function escolher(pessoaId: string) {
    if (!regra) return
    const nova = { ...regra, modo: 'pessoa_fixa' as const, pessoaId }
    setGravando(true)
    try {
      await salvarRegraDoLeadDoSite(nova)
      setRegra(nova)
      avisar(pessoaId ? 'O lead do site passa a ir para essa pessoa' : 'O lead do site nasce sem dono', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar', 'brand')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Cartao>
      <TituloCartao icone={Globe}>Quem recebe o lead do site</TituloCartao>
      {regra === undefined ? (
        <p className="cfg-nada">Carregando...</p>
      ) : regra === null ? (
        <p className="cfg-nada">Falta rodar a migração 065 no banco para esta escolha aparecer.</p>
      ) : (
        <div className="pilha cfg-lead-do-site">
          <p className="cfg-nada">
            O cliente que deixa o contato no chat da loja vira lead desta pessoa. Cliente que já tem
            vendedor volta para ele. Sem ninguém escolhido, o lead nasce sem dono e o sino avisa
            administrador e gerente.
          </p>
          <Seletor
            campo
            rotulo="PESSOA FIXA"
            valor={regra.pessoaId}
            vazio="Ninguém (sem dono)"
            opcoes={quem}
            aoEscolher={(v) => void escolher(v)}
          />
          {gravando ? <small className="cfg-nada">Gravando...</small> : null}
          <small className="cfg-nada">
            {regra.modo === 'rodizio'
              ? 'O banco está em rodízio. Escolher uma pessoa aqui volta para pessoa fixa.'
              : 'O rodízio entre os vendedores entra aqui quando for ligado.'}
          </small>
        </div>
      )}
    </Cartao>
  )
}
