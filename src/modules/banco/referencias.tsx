import { useMemo, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Aviso, Botao, Busca, Entrada, Seletor, Selo, Vazio, avisar } from '@ds'
import {
  apagarReferencia,
  codigoCurto,
  combina,
  criarReferencia,
  generoDoCodigo,
  referenciasPorGrupo,
  renomearReferencia,
} from '@dominio/banco'
import type { Banco, Referencia } from '@dominio/banco'
import { Bloco, Linha, TarjaDeGenero } from './pecas'
import type { AlvoDeApagar, AlvoDoNome } from './pecas'

/* ==========================================================================
   Referências.

   O código FT-GGG-NNNX é a identidade da peça na fábrica: é ele que está
   escrito na ficha que chega na mesa de corte. Por isso a tela deixa escolher
   o grupo e escrever o resto, mas o prefixo vem travado, e renomear muda o
   nome e nunca o código.
   ========================================================================== */

export function Referencias({
  banco,
  podeMexer,
  procurado,
  aoProcurar,
  aoTrocar,
  aoTirar,
  aoPor,
  pedirNome,
  pedirApagar,
}: {
  banco: Banco
  podeMexer: boolean
  procurado: string
  aoProcurar: (t: string) => void
  aoTrocar: (r: Referencia) => void
  aoTirar: (id: string) => void
  aoPor: (r: Referencia) => void
  pedirNome: (a: AlvoDoNome) => void
  pedirApagar: (a: AlvoDeApagar) => void
}) {
  const [grupo, setGrupo] = useState(banco.gruposDeReferencia[0]?.cod ?? '')
  const [resto, setResto] = useState('')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [abertos, setAbertos] = useState<string[]>([])

  const blocos = useMemo(() => {
    const todos = referenciasPorGrupo(banco)
    if (!procurado.trim()) return todos
    return todos
      .map((b) => ({ ...b, itens: b.itens.filter((r) => combina(procurado, r.cod, r.nome)) }))
      .filter((b) => b.itens.length > 0)
  }, [banco, procurado])

  /* Procurando, tudo abre: fechar o resultado da busca dentro de um bloco
     fechado é o mesmo que não ter encontrado. */
  const procurando = procurado.trim().length > 0
  const aberto = (cod: string) => procurando || abertos.includes(cod)

  const prefixo = grupo ? `FT-${grupo}-` : 'FT-'

  async function adicionar() {
    const codFim = resto.trim().toUpperCase()
    const texto = nome.trim()
    if (!texto) {
      avisar('Escreva o nome da peça.', 'brand')
      return
    }
    if (!/^\d{3}[MFCU]$/.test(codFim)) {
      avisar('O fim do código é três números e a letra do gênero: 021M, 004F, 008C, 002U.', 'brand')
      return
    }
    const cod = prefixo + codFim
    if (banco.referencias.some((r) => r.cod === cod)) {
      avisar(`${cod} já existe. Dois códigos iguais viram duas peças diferentes na ficha.`, 'brand')
      return
    }
    setSalvando(true)
    try {
      aoPor(
        await criarReferencia({ cod, nome: texto, grupo, genero: generoDoCodigo(cod) }),
      )
      setResto('')
      setNome('')
      avisar(`${cod} entrou no banco.`, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {podeMexer ? (
        <div className="bd-barra">
          <Busca value={procurado} onChange={(e) => aoProcurar(e.target.value)} placeholder="Buscar código ou nome..." />
          <Seletor
            campo
            tamanho="sm"
            valor={grupo}
            opcoes={banco.gruposDeReferencia.map((g) => ({
              valor: g.cod,
              rotulo: `${g.cod} · ${g.nome}`,
            }))}
            aoEscolher={setGrupo}
          />
          <div className="bd-codigo-novo">
            <span>{prefixo}</span>
            <Entrada
              tamanho="sm"
              value={resto}
              maxLength={4}
              placeholder="000M"
              onChange={(e) => setResto(e.target.value)}
            />
          </div>
          <Entrada
            tamanho="sm"
            className="bd-cresce"
            value={nome}
            placeholder="NOME DA PEÇA..."
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void adicionar()
            }}
          />
          <Botao tom="primario" tamanho="sm" carregando={salvando} onClick={() => void adicionar()}>
            <Plus size={15} />
            Adicionar
          </Botao>
        </div>
      ) : (
        <div className="bd-barra">
          <Busca value={procurado} onChange={(e) => aoProcurar(e.target.value)} placeholder="Buscar código ou nome..." />
        </div>
      )}

      {banco.problemas.length > 0 ? (
        <Aviso tom="brand" titulo={`${banco.problemas.length} referências com o código torto`}>
          {banco.problemas.filter((p) => p.problema === 'sem codigo').length} estão sem código
          nenhum e o resto tem código repetido, cada um apontando para duas peças. Elas continuam
          aparecendo na lista, marcadas, porque esconder cadastro torto é o jeito de ele nunca ser
          consertado. Quando estiverem certas, o código vira trava de verdade no banco.
        </Aviso>
      ) : null}

      {blocos.length === 0 ? (
        <Vazio titulo="Nada encontrado" texto="Nenhuma referência com esse código ou nome." />
      ) : (
        <div className="bd-blocos">
          {blocos.map((b) => (
            <Bloco
              key={b.cod || 'sem'}
              cod={b.cod || undefined}
              nome={b.nome}
              conta={b.itens.length}
              aberto={aberto(b.cod)}
              aoAlternar={() =>
                setAbertos((l) => (l.includes(b.cod) ? l.filter((x) => x !== b.cod) : [...l, b.cod]))
              }
            >
              {b.itens.map((r) => (
                <Linha
                  key={r.id}
                  esquerda={
                    <>
                      <TarjaDeGenero letra={r.genero || generoDoCodigo(r.cod)} />
                      {r.cod ? (
                        <span className="bd-cod">{codigoCurto(r.cod)}</span>
                      ) : (
                        <Selo tom="brand">sem código</Selo>
                      )}
                    </>
                  }
                  nome={r.nome}
                  podeMexer={podeMexer}
                  aoRenomear={() =>
                    pedirNome({
                      titulo: r.cod || r.nome,
                      rotulo: 'Nome da peça',
                      dica: 'O código não muda: ele já está impresso nas fichas antigas.',
                      valor: r.nome,
                      gravar: async (novo) => {
                        aoTrocar(await renomearReferencia(r.id, novo))
                        avisar('Nome trocado.', 'ok')
                      },
                    })
                  }
                  aoApagar={() =>
                    pedirApagar({
                      titulo: 'Apagar esta referência?',
                      texto: (
                        <>
                          <b>{r.cod ? `${r.cod} ` : ''}{r.nome}</b> sai do menu do orçamento e da
                          ficha. As cotações antigas não mudam: elas guardaram o texto, não o
                          vínculo.
                        </>
                      ),
                      apagar: async () => {
                        await apagarReferencia(r.id)
                        aoTirar(r.id)
                        avisar('Referência apagada.', 'ok')
                      },
                    })
                  }
                />
              ))}
            </Bloco>
          ))}
        </div>
      )}
    </>
  )
}
