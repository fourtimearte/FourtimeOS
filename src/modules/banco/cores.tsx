import { useMemo, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Botao, Busca, Entrada, Seletor, Vazio, avisar } from '@ds'
import {
  apagarCorDeTecido,
  combina,
  corDaSublimacao,
  coresDaTecnica,
  coresDeTecidoPorGrupo,
  criarCorDeTecido,
  mudarCorDeTecido,
  renomearCorDeImpressao,
} from '@dominio/banco'
import type { Banco, CorDeImpressao, CorDeTecido } from '@dominio/banco'
import { Bloco, Linha } from './pecas'
import type { AlvoDeApagar, AlvoDoNome } from './pecas'

/* ==========================================================================
   As três telas de cor.

   Cor de tecido é a malha, e ela sempre teve nome: é assim que o cliente pede.
   Cor de impressão é a tabela da máquina, e ela sempre foi número: 152, S40.
   O número continua sendo a identidade, porque é o que o operador lê. O nome
   é o que vai para o orçamento, porque "(152)" não diz nada para quem compra.
   ========================================================================== */

/* --- o cartão da cor ------------------------------------------------------
   A cor em cima, o número embaixo dela, e o nome embaixo do número. Nessa
   ordem porque é nessa ordem que a pessoa procura: ela bate o olho na cor,
   confere o número que vai escrever na ficha, e lê o nome que vai sair no
   orçamento. */
function CartaoDeCor({
  cor,
  podeMexer,
  aoRenomear,
}: {
  cor: CorDeImpressao
  podeMexer: boolean
  aoRenomear: () => void
}) {
  const conteudo = (
    <>
      <span className="bd-cor-amostra" style={{ background: cor.hex }} />
      <b className="bd-cor-numero">{cor.codigo}</b>
      <span className="bd-cor-nome">{cor.nome || 'sem nome'}</span>
    </>
  )

  if (!podeMexer) {
    return (
      <div className="bd-cartao-cor" title={cor.hex}>
        {conteudo}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="bd-cartao-cor mexivel"
      title={`${cor.hex} · clique para renomear`}
      onClick={aoRenomear}
    >
      {conteudo}
    </button>
  )
}

export function CoresDeImpressao({
  banco,
  tecnica,
  podeMexer,
  procurado,
  aoProcurar,
  aoTrocarCor,
  pedirNome,
}: {
  banco: Banco
  tecnica: 'dtf' | 'sublimacao'
  podeMexer: boolean
  procurado: string
  aoProcurar: (t: string) => void
  aoTrocarCor: (c: CorDeImpressao) => void
  pedirNome: (a: AlvoDoNome) => void
}) {
  const todas = useMemo(() => coresDaTecnica(banco, tecnica), [banco, tecnica])
  const lista = useMemo(
    () => todas.filter((c) => combina(procurado, c.codigo, c.nome, c.hex)),
    [todas, procurado],
  )
  const semNome = todas.filter((c) => !c.nome).length

  return (
    <>
      <div className="bd-barra">
        <Busca
          value={procurado}
          onChange={(e) => aoProcurar(e.target.value)}
          placeholder="Buscar número, nome ou hexadecimal..."
        />
        {podeMexer ? (
          <span className="bd-fixa">Clique num cartão para trocar o nome.</span>
        ) : null}
      </div>

      <p className="bd-conta">
        {lista.length} de {todas.length} cores
        {semNome > 0 ? ` · ${semNome} ainda sem nome` : null}
      </p>

      {lista.length === 0 ? (
        <Vazio titulo="Nada encontrado" texto="Nenhuma cor com esse número, nome ou hexadecimal." />
      ) : (
        <div className="bd-grade-cores">
          {lista.map((c) => (
            <CartaoDeCor
              key={c.codigo}
              cor={c}
              podeMexer={podeMexer}
              aoRenomear={() =>
                pedirNome({
                  titulo: `Cor ${c.codigo}`,
                  rotulo: 'Nome da cor',
                  dica: 'É este nome que sai no orçamento do cliente. O número continua o mesmo.',
                  valor: c.nome,
                  cor: c.hex,
                  gravar: async (novo) => {
                    aoTrocarCor(await renomearCorDeImpressao(c.codigo, novo))
                    avisar(`${c.codigo} agora é ${novo}.`, 'ok')
                  },
                })
              }
            />
          ))}
        </div>
      )}
    </>
  )
}

/* --- cor de tecido -------------------------------------------------------- */

function Pilha({ cores }: { cores: CorDeTecido[] }) {
  return (
    <span className="bd-pilha" aria-hidden="true">
      {cores.slice(0, 5).map((c) => (
        <i key={c.id} style={{ background: c.hex }} />
      ))}
    </span>
  )
}

export function CoresDeTecido({
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
  aoTrocar: (c: CorDeTecido) => void
  aoTirar: (id: string) => void
  aoPor: (c: CorDeTecido) => void
  pedirNome: (a: AlvoDoNome) => void
  pedirApagar: (a: AlvoDeApagar) => void
}) {
  const [grupo, setGrupo] = useState(banco.gruposDeCor.filter((g) => g.cod !== 'SUB')[0]?.cod ?? '')
  const [nome, setNome] = useState('')
  const [hex, setHex] = useState('#')
  const [salvando, setSalvando] = useState(false)
  const [abertos, setAbertos] = useState<string[]>([])

  const sub = useMemo(() => corDaSublimacao(banco), [banco])
  const blocos = useMemo(() => {
    const todos = coresDeTecidoPorGrupo(banco)
    if (!procurado.trim()) return todos
    return todos
      .map((b) => ({ ...b, itens: b.itens.filter((c) => combina(procurado, c.nome, c.hex)) }))
      .filter((b) => b.itens.length > 0)
  }, [banco, procurado])

  const procurando = procurado.trim().length > 0
  const aberto = (cod: string) => procurando || abertos.includes(cod)

  async function adicionar() {
    const texto = nome.trim()
    const cor = hex.trim().toUpperCase()
    if (!texto) {
      avisar('Escreva o nome da cor.', 'brand')
      return
    }
    if (!/^#[0-9A-F]{6}$/.test(cor)) {
      avisar('O hexadecimal é # e seis dígitos: #C6161B.', 'brand')
      return
    }
    setSalvando(true)
    try {
      aoPor(await criarCorDeTecido({ nome: texto, hex: cor, grupo: grupo || null }))
      setNome('')
      setHex('#')
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
        <Busca
          value={procurado}
          onChange={(e) => aoProcurar(e.target.value)}
          placeholder="Buscar cor ou hexadecimal..."
        />
        {podeMexer ? (
          <>
            <Entrada
              tamanho="sm"
              className="bd-cresce"
              value={nome}
              placeholder="Nome da cor..."
              onChange={(e) => setNome(e.target.value)}
            />
            <div className="bd-hex">
              <i style={{ background: /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : 'transparent' }} />
              <Entrada
                tamanho="sm"
                value={hex}
                maxLength={7}
                placeholder="#C6161B"
                onChange={(e) => setHex(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void adicionar()
                }}
              />
            </div>
            <Seletor
              campo
              tamanho="sm"
              valor={grupo}
              opcoes={banco.gruposDeCor
                .filter((g) => g.cod !== 'SUB')
                .map((g) => ({ valor: g.cod, rotulo: g.nome }))}
              aoEscolher={setGrupo}
            />
            <Botao tom="primario" tamanho="sm" carregando={salvando} onClick={() => void adicionar()}>
              <Plus size={15} />
              Adicionar
            </Botao>
          </>
        ) : null}
      </div>

      {/* A sublimação não é cor de malha: a cor vem da arte. Ela fica fora dos
          grupos, pregada no topo, como no editor. */}
      {sub && !procurando ? (
        <div className="bd-sub">
          <span className="bd-sub-amostra" />
          <div>
            <b>{sub.nome}</b>
            <span>
              Fora dos grupos porque não é cor de malha: a cor vem da arte. Aparece no topo do menu
              de cor do orçamento.
            </span>
          </div>
        </div>
      ) : null}

      {blocos.length === 0 ? (
        <Vazio titulo="Nada encontrado" texto="Nenhuma cor com esse nome ou hexadecimal." />
      ) : (
        <div className="bd-blocos">
          {blocos.map((b) => (
            <Bloco
              key={b.cod || 'sem'}
              cod={b.cod || undefined}
              nome={b.nome}
              conta={b.itens.length}
              enfeite={<Pilha cores={b.itens} />}
              aberto={aberto(b.cod)}
              aoAlternar={() =>
                setAbertos((l) => (l.includes(b.cod) ? l.filter((x) => x !== b.cod) : [...l, b.cod]))
              }
            >
              {b.itens.map((c) => (
                <Linha
                  key={c.id}
                  esquerda={<i className="bd-amostra" style={{ background: c.hex }} />}
                  nome={c.nome}
                  direita={<small className="bd-hexadecimal">{c.hex}</small>}
                  podeMexer={podeMexer}
                  aoRenomear={() =>
                    pedirNome({
                      titulo: c.nome,
                      rotulo: 'Nome da cor',
                      valor: c.nome,
                      cor: c.hex,
                      gravar: async (novo) => {
                        aoTrocar(await mudarCorDeTecido(c.id, { nome: novo }))
                        avisar('Nome trocado.', 'ok')
                      },
                    })
                  }
                  aoApagar={() =>
                    pedirApagar({
                      titulo: 'Apagar esta cor?',
                      texto: (
                        <>
                          <b>{c.nome}</b> sai do menu de cor do orçamento. As cotações antigas não
                          mudam: elas guardaram o texto, não o vínculo.
                        </>
                      ),
                      apagar: async () => {
                        await apagarCorDeTecido(c.id)
                        aoTirar(c.id)
                        avisar('Cor apagada.', 'ok')
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
