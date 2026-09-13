import { useMemo, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Botao, Busca, Entrada, Seletor, Vazio, avisar } from '@ds'
import {
  apagarTecido,
  combina,
  criarTecido,
  renomearTecido,
  tecidosPorGrupo,
} from '@dominio/banco'
import type { Banco, Tecido } from '@dominio/banco'
import { Bloco, Linha } from './pecas'
import type { AlvoDeApagar, AlvoDoNome } from './pecas'

/* ==========================================================================
   Tecidos.

   Agrupados pela família comercial, que é como o vendedor pergunta ("é dry ou
   é malha?"), e nunca pela construção. O nome é único no banco: dois "Dry
   Fit" na mesma lista viram duas linhas idênticas no menu do orçamento e
   ninguém sabe qual escolher.
   ========================================================================== */

export function Tecidos({
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
  aoTrocar: (t: Tecido) => void
  aoTirar: (id: string) => void
  aoPor: (t: Tecido) => void
  pedirNome: (a: AlvoDoNome) => void
  pedirApagar: (a: AlvoDeApagar) => void
}) {
  const [grupo, setGrupo] = useState(banco.gruposDeTecido[0]?.cod ?? '')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [abertos, setAbertos] = useState<string[]>([])

  const blocos = useMemo(() => {
    const todos = tecidosPorGrupo(banco)
    if (!procurado.trim()) return todos
    return todos
      .map((b) => ({ ...b, itens: b.itens.filter((t) => combina(procurado, t.nome)) }))
      .filter((b) => b.itens.length > 0)
  }, [banco, procurado])

  const procurando = procurado.trim().length > 0
  const aberto = (cod: string) => procurando || abertos.includes(cod)

  async function adicionar() {
    const texto = nome.trim()
    if (!texto) {
      avisar('Escreva o nome do tecido.', 'brand')
      return
    }
    setSalvando(true)
    try {
      aoPor(await criarTecido(texto, grupo || null))
      setNome('')
      avisar(`${texto} entrou no banco.`, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div className="bd-barra">
        <Busca value={procurado} onChange={(e) => aoProcurar(e.target.value)} placeholder="Buscar tecido..." />
        {podeMexer ? (
          <>
            <Entrada
              tamanho="sm"
              className="bd-cresce"
              value={nome}
              placeholder="Nome do tecido..."
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void adicionar()
              }}
            />
            <Seletor
              campo
              tamanho="sm"
              valor={grupo}
              opcoes={banco.gruposDeTecido.map((g) => ({ valor: g.cod, rotulo: g.nome }))}
              aoEscolher={setGrupo}
            />
            <Botao tom="primario" tamanho="sm" carregando={salvando} onClick={() => void adicionar()}>
              <Plus size={15} />
              Adicionar
            </Botao>
          </>
        ) : null}
      </div>

      {blocos.length === 0 ? (
        <Vazio titulo="Nada encontrado" texto="Nenhum tecido com esse nome." />
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
              {b.itens.map((t) => (
                <Linha
                  key={t.id}
                  nome={t.nome}
                  podeMexer={podeMexer}
                  aoRenomear={() =>
                    pedirNome({
                      titulo: t.nome,
                      rotulo: 'Nome do tecido',
                      valor: t.nome,
                      gravar: async (novo) => {
                        aoTrocar(await renomearTecido(t.id, novo))
                        avisar('Nome trocado.', 'ok')
                      },
                    })
                  }
                  aoApagar={() =>
                    pedirApagar({
                      titulo: 'Apagar este tecido?',
                      texto: (
                        <>
                          <b>{t.nome}</b> sai do menu do orçamento e da ficha. As cotações antigas
                          não mudam: elas guardaram o texto, não o vínculo.
                        </>
                      ),
                      apagar: async () => {
                        await apagarTecido(t.id)
                        aoTirar(t.id)
                        avisar('Tecido apagado.', 'ok')
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
