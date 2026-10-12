import { useEffect, useState } from 'react'
import { Globe } from '@phosphor-icons/react'
import { Cartao, Segmentado, Seletor, TituloCartao, avisar } from '@ds'
import type { PessoaDaEquipe } from '@dominio/equipe'
import { carregarRegraDoLeadDoSite, salvarRegraDoLeadDoSite, type ModoDoLeadDoSite, type RegraDoLeadDoSite } from '@dominio/funil'

/* ==========================================================================
   QUEM RECEBE O LEAD DO SITE (065, plano 15, decisao 1).

   Pessoa fixa ou rodizio ("no futuro rodizio", 11/10/2026; a escolha entrou
   em 12/10/2026, com a fila no cartao Rodizio dos leads). So o admin ve este
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

  async function gravar(nova: RegraDoLeadDoSite, aviso: string) {
    setGravando(true)
    try {
      await salvarRegraDoLeadDoSite(nova)
      setRegra(nova)
      avisar(aviso, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar', 'brand')
    } finally {
      setGravando(false)
    }
  }
  const escolher = (pessoaId: string) =>
    regra && void gravar({ ...regra, modo: 'pessoa_fixa', pessoaId }, pessoaId ? 'O lead do site passa a ir para essa pessoa' : 'O lead do site nasce sem dono')
  const mudarModo = (modo: ModoDoLeadDoSite) =>
    regra &&
    modo !== regra.modo &&
    void gravar({ ...regra, modo }, modo === 'rodizio' ? 'O lead do site passa a seguir o rodízio' : 'O lead do site volta para a pessoa fixa')

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
            O cliente que deixa o contato no chat da loja vira lead de uma pessoa fixa, ou de quem é a
            vez no rodízio. Cliente que já tem vendedor volta para ele. Sem ninguém, o lead nasce sem
            dono e o sino avisa administrador e gerente.
          </p>
          <Segmentado<ModoDoLeadDoSite>
            valor={regra.modo}
            aoMudar={mudarModo}
            opcoes={[
              { valor: 'pessoa_fixa', rotulo: 'Pessoa fixa' },
              { valor: 'rodizio', rotulo: 'Rodízio' },
            ]}
          />
          {regra.modo === 'pessoa_fixa' ? (
            <Seletor
              campo
              rotulo="PESSOA FIXA"
              valor={regra.pessoaId}
              vazio="Ninguém (sem dono)"
              opcoes={quem}
              aoEscolher={(v) => escolher(v)}
            />
          ) : (
            <small className="cfg-nada">
              O lead vai para quem é a vez na fila do cartão Rodízio dos leads. Com a fila vazia, ele nasce sem dono e o sino avisa.
            </small>
          )}
          {gravando ? <small className="cfg-nada">Gravando...</small> : null}
        </div>
      )}
    </Cartao>
  )
}
