import { useEffect, useMemo, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Botao, Busca, Entrada, Seletor, Vazio, avisar } from '@ds'
import {
  apagarTecido,
  combina,
  criarTecido,
  medirTecido,
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
                  direita={<Medidas tecido={t} podeMexer={podeMexer} aoTrocar={aoTrocar} />}
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


/* --- a largura e a gramatura do rolo ---------------------------------------
   As duas medidas que ligam metro a quilo, e sem as quais o consumo cadastrado
   em metros nunca vira baixa no estoque, que está em quilos.

   CAMPO VAZIO GRAVA NULO, E NÃO ZERO. Zero diria que o tecido não pesa nada, e
   a conversa de metro para quilo devolveria zero quilo com cara de resposta.
   Nulo diz "ninguém cadastrou", que é a verdade, e a reserva do pedido mostra
   a falta em vez de inventar um número.

   Grava ao sair do campo, e não a cada tecla: são quarenta e poucos tecidos e
   um PATCH por dígito seria quarenta pedidos para escrever "145". */
function Medidas({
  tecido,
  podeMexer,
  aoTrocar,
}: {
  tecido: Tecido
  podeMexer: boolean
  aoTrocar: (t: Tecido) => void
}) {
  const [gramatura, setGramatura] = useState('')
  const [largura, setLargura] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setGramatura(tecido.gramatura === null ? '' : String(tecido.gramatura).replace('.', ','))
    setLargura(tecido.largura === null ? '' : String(tecido.largura).replace('.', ','))
  }, [tecido.gramatura, tecido.largura])

  function lido(texto: string): number | null {
    const t = texto.trim()
    if (!t) return null
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  async function gravar() {
    const g = lido(gramatura)
    const l = lido(largura)
    if (g === tecido.gramatura && l === tecido.largura) return
    setSalvando(true)
    try {
      aoTrocar(await medirTecido(tecido.id, { gramatura: g, largura: l }))
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar a medida.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  if (!podeMexer) {
    return (
      <span className="bd-medidas">
        <span className="bd-medida-lida">
          {tecido.gramatura === null ? 'sem gramatura' : tecido.gramatura + ' g/m²'}
        </span>
        <span className="bd-medida-lida">
          {tecido.largura === null ? 'sem largura' : String(tecido.largura).replace('.', ',') + ' m'}
        </span>
      </span>
    )
  }

  return (
    <span className="bd-medidas">
      <label className="bd-medida">
        <Entrada
          tamanho="sm"
          inputMode="decimal"
          value={gramatura}
          placeholder="145"
          disabled={salvando}
          aria-label={'Gramatura de ' + tecido.nome + ' em gramas por metro quadrado'}
          onChange={(e) => setGramatura(e.currentTarget.value)}
          onBlur={() => void gravar()}
        />
        <small>g/m²</small>
      </label>
      <label className="bd-medida">
        <Entrada
          tamanho="sm"
          inputMode="decimal"
          value={largura}
          placeholder="1,60"
          disabled={salvando}
          aria-label={'Largura do rolo de ' + tecido.nome + ' em metros'}
          onChange={(e) => setLargura(e.currentTarget.value)}
          onBlur={() => void gravar()}
        />
        <small>m</small>
      </label>
    </span>
  )
}
