import { useEffect, useMemo, useState } from 'react'
import {
  AreaTexto,
  Botao,
  Busca,
  Campo,
  Entrada,
  Esqueleto,
  Gaveta,
  Kpi,
  Nivel,
  Pagina,
  Segmentado,
  Selo,
  Seletor,
  Tabela,
  Tag,
  Vazio,
  avisar,
  type Coluna,
  type TomSelo,
} from '@ds'
import { semAcento } from '@shared'
import {
  CATEGORIAS,
  NOME_DA_CATEGORIA,
  NOME_DO_MOTIVO,
  abaixoDoMinimo,
  carregarMateriais,
  carregarMovimentos,
  casasDaUnidade,
  conferirORazao,
  corDoNivel,
  mexerNoEstoque,
  nivel,
  numeroNaUnidade,
  type Material,
  type Motivo,
  type Movimento,
} from '@dominio/estoque'
import './estoque.css'

/* ==========================================================================
   Estoque.

   Esta foi a última tela do sistema em dado de exemplo. Até a migração 025 ela
   era uma lista de sete materiais escrita em TypeScript, com os números do
   mockup, e o cartão "abaixo do mínimo" do início lia dali: a primeira tela que
   a fábrica abre todo dia mostrava um alerta inventado.

   O QUE ESTA TELA MOSTRA É O RAZÃO, E NÃO UM SALDO DIGITÁVEL. Não existe campo
   para corrigir o quanto tem. Quem erra a contagem lança um ajuste, e o ajuste
   fica no histórico com nome e hora. É mais trabalho no dia em que se erra, e é
   a única forma de, seis meses depois, alguém conseguir responder por que o
   saldo é o que é.

   Separação, reserva e compra não estão aqui ainda de propósito: a reserva
   nasce na aprovação da cotação (passo 7) e a separação tem tela própria
   (passo 8). Uma aba vazia prometendo as duas seria pior que a ausência delas.
   ========================================================================== */

type Aba = 'materiais' | 'razao'
type Faixa = '' | 'baixo' | 'atencao' | 'folga'

const NOME_DA_FAIXA: Record<Exclude<Faixa, ''>, string> = {
  baixo: 'Abaixo do mínimo',
  atencao: 'Até 30% acima',
  folga: 'Com folga',
}

/* O motivo pinta o selo: entrada e devolução somam, saída e separação tiram, e
   o ajuste é o único que anda para os dois lados, então fica neutro. */
const TOM_DO_MOTIVO: Record<Motivo, TomSelo> = {
  entrada: 'ok',
  devolucao: 'ok',
  saida: 'brand',
  separacao: 'info',
  ajuste: 'warn',
}

function faixaDoMaterial(m: Material): Exclude<Faixa, ''> {
  if (m.saldo < m.minimo) return 'baixo'
  if (m.saldo < m.minimo * 1.3) return 'atencao'
  return 'folga'
}

function dataCurta(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function dataEHora(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' · ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

export function TelaEstoque() {
  const [materiais, setMateriais] = useState<Material[]>([])
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [aba, setAba] = useState<Aba>('materiais')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [faixa, setFaixa] = useState<Faixa>('')

  const [noMovimento, setNoMovimento] = useState<Material | null>(null)

  async function recarregar() {
    setCarregando(true)
    try {
      const [ms, vs] = await Promise.all([carregarMateriais(), carregarMovimentos()])
      setMateriais(ms)
      setMovimentos(vs)
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler o estoque.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    let vivo = true
    Promise.all([carregarMateriais(), carregarMovimentos()])
      .then(([ms, vs]) => {
        if (!vivo) return
        setMateriais(ms)
        setMovimentos(vs)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        setErro(e instanceof Error ? e.message : 'Não consegui ler o estoque.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  const baixo = useMemo(() => abaixoDoMinimo(materiais), [materiais])

  /* Movimento dos últimos sete dias, que é a pergunta "o estoque andou esta
     semana?". Um razão parado com saldo mudando é sinal de que alguém está
     escrevendo por fora, e é justamente o que a conferência do razão pega. */
  const daSemana = useMemo(() => {
    const corte = Date.now() - 7 * 86400000
    return movimentos.filter((v) => new Date(v.quando).getTime() >= corte)
  }, [movimentos])

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim())
    return materiais.filter((m) => {
      if (categoria && m.categoria !== categoria) return false
      if (faixa && faixaDoMaterial(m) !== faixa) return false
      if (termo && !semAcento(m.nome).includes(termo)) return false
      return true
    })
  }, [materiais, busca, categoria, faixa])

  const opcoesDeCategoria = useMemo(
    () =>
      CATEGORIAS.map((c) => ({
        valor: c,
        rotulo: NOME_DA_CATEGORIA[c],
        contagem: materiais.filter((m) => m.categoria === c).length,
      })),
    [materiais],
  )

  const opcoesDeFaixa = useMemo(
    () =>
      (['baixo', 'atencao', 'folga'] as const).map((f) => ({
        valor: f,
        rotulo: NOME_DA_FAIXA[f],
        contagem: materiais.filter((m) => faixaDoMaterial(m) === f).length,
      })),
    [materiais],
  )

  async function conferir() {
    try {
      const fora = await conferirORazao()
      if (!fora.length) {
        avisar('O saldo de todos os materiais bate com a soma do razão.', 'ok')
        return
      }
      avisar(
        fora.length === 1
          ? `O saldo de ${fora[0].material} não bate com o razão.`
          : `${fora.length} materiais com saldo diferente da soma do razão.`,
        'brand',
      )
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui conferir o razão.', 'brand')
    }
  }

  const colunasDoMaterial: Coluna<Material>[] = [
    {
      chave: 'nome',
      titulo: 'Material',
      ordenarPor: (m) => semAcento(m.nome),
      celula: (m) => (
        <span className="es-material">
          {m.corHex ? (
            <span className="es-cor" style={{ background: m.corHex }} />
          ) : (
            <span className="es-cor vazia" aria-hidden="true" />
          )}
          <span className="pilha colada">
            <b className="es-nome">{m.nome}</b>
            <small className="es-apoio es-nome">
              {NOME_DA_CATEGORIA[m.categoria]}
              {m.tecidoId ? ' · ligado ao catálogo' : ''}
              <span className="es-no-celular"> · mín {numeroNaUnidade(m.minimo, m.unidade)}</span>
            </small>
          </span>
        </span>
      ),
    },
    {
      chave: 'nivel',
      titulo: 'Nível',
      celula: (m) => (
        <Nivel
          valor={nivel(m)}
          cor={corDoNivel(m)}
          titulo={`${numeroNaUnidade(m.saldo, m.unidade)} de um mínimo de ${numeroNaUnidade(m.minimo, m.unidade)}`}
        />
      ),
    },
    {
      chave: 'saldo',
      titulo: 'Tem',
      numero: true,
      ordenarPor: (m) => m.saldo,
      celula: (m) => (
        <b className={m.saldo < m.minimo ? 'es-pouco' : ''}>{numeroNaUnidade(m.saldo, m.unidade)}</b>
      ),
    },
    {
      chave: 'minimo',
      titulo: 'Mínimo',
      numero: true,
      ordenarPor: (m) => m.minimo,
      celula: (m) => <span className="es-apoio">{numeroNaUnidade(m.minimo, m.unidade)}</span>,
    },
    {
      chave: 'ultimo',
      titulo: 'Mexeu em',
      numero: true,
      ordenarPor: (m) => m.ultimoMovimento,
      celula: (m) => (
        <span className="es-apoio">{m.ultimoMovimento ? dataCurta(m.ultimoMovimento) : 'nunca'}</span>
      ),
    },
  ]

  const colunasDoRazao: Coluna<Movimento>[] = [
    {
      chave: 'quando',
      titulo: 'Quando',
      ordenarPor: (v) => v.quando,
      celula: (v) => <span className="es-apoio">{dataEHora(v.quando)}</span>,
    },
    {
      chave: 'motivo',
      titulo: 'Motivo',
      celula: (v) => <Selo tom={TOM_DO_MOTIVO[v.motivo]}>{NOME_DO_MOTIVO[v.motivo]}</Selo>,
    },
    {
      chave: 'material',
      titulo: 'Material',
      ordenarPor: (v) => semAcento(v.material),
      celula: (v) => (
        <span className="pilha colada">
          <b className="es-nome">{v.material}</b>
          {/* NO CELULAR A COLUNA DO MOTIVO SOME, E ELE DESCE PARA CA. Quatro
              colunas nao cabem em 390, e um razao sem motivo e so uma lista de
              numeros: "-8,0 kg" nao diz se saiu para a producao ou se alguem
              corrigiu a contagem. */}
          <small className="es-apoio es-nome">
            <span className="es-no-celular">
              {NOME_DO_MOTIVO[v.motivo]}
              {v.observacao ? ' · ' : ''}
            </span>
            {v.observacao}
          </small>
        </span>
      ),
    },
    {
      chave: 'quantidade',
      titulo: 'Quanto',
      numero: true,
      ordenarPor: (v) => v.quantidade,
      celula: (v) => (
        <b className={v.quantidade < 0 ? 'es-pouco' : 'es-entrou'}>
          {(v.quantidade > 0 ? '+' : '') + numeroNaUnidade(v.quantidade, v.unidade)}
        </b>
      ),
    },
    {
      chave: 'pedido',
      titulo: 'Pedido',
      celula: (v) => (v.pedido ? <Tag>{v.pedido}</Tag> : <span className="es-apoio">·</span>),
    },
    {
      chave: 'quem',
      titulo: 'Quem',
      celula: (v) => <span className="es-apoio corta">{v.quem || 'sistema'}</span>,
    },
  ]

  return (
    <Pagina
      acima="Produção · materiais"
      titulo="Estoque"
      sub={
        <>
          <b>{materiais.length}</b> materiais ·{' '}
          {baixo.length ? (
            <b className="es-pouco">{baixo.length} abaixo do mínimo</b>
          ) : (
            <>nenhum abaixo do mínimo</>
          )}{' '}
          · o saldo vem do razão, e não de um campo
        </>
      }
      acoes={
        <>
          <Botao tom="contorno" onClick={conferir}>
            Conferir o razão
          </Botao>
          <Botao
            tom="primario"
            onClick={() => {
              if (!materiais.length) {
                avisar('Cadastre um material antes de movimentar o estoque.', 'info')
                return
              }
              setNoMovimento(materiais[0])
            }}
          >
            Registrar movimento
          </Botao>
        </>
      }
    >
      <div className="es-kpis">
        <Kpi rotulo="Materiais" valor={materiais.length} sub="ativos no cadastro" />
        <Kpi
          rotulo="Abaixo do mínimo"
          valor={baixo.length}
          sub={baixo.length ? 'precisa de compra' : 'estoque em dia'}
          aviso={baixo.length > 0}
          ligado={faixa === 'baixo'}
          aoClicar={() => {
            setAba('materiais')
            setFaixa(faixa === 'baixo' ? '' : 'baixo')
          }}
        />
        <Kpi rotulo="Movimentos na semana" valor={daSemana.length} sub="últimos sete dias" />
        <Kpi
          rotulo="Linhas no razão"
          valor={movimentos.length}
          sub="histórico carregado"
          ligado={aba === 'razao'}
          aoClicar={() => setAba('razao')}
        />
      </div>

      <div className="es-barra">
        <Segmentado
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: 'materiais', rotulo: 'Materiais' },
            { valor: 'razao', rotulo: 'Movimentações' },
          ]}
        />
        {aba === 'materiais' ? (
          <>
            <Busca
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              placeholder="Buscar material"
              aria-label="Buscar material"
            />
            <Seletor
              rotulo="Categoria"
              valor={categoria}
              opcoes={opcoesDeCategoria}
              aoEscolher={setCategoria}
              vazio="Todas"
            />
            <Seletor
              rotulo="Nível"
              valor={faixa}
              opcoes={opcoesDeFaixa}
              aoEscolher={(v) => setFaixa(v as Faixa)}
              vazio="Todos"
            />
          </>
        ) : null}
      </div>

      <section className={aba === 'materiais' ? 'cartao es-quadro es-materiais' : 'cartao es-quadro es-razao'}>
        {erro ? (
          <Vazio titulo="Não consegui ler o estoque" texto={erro} />
        ) : carregando ? (
          <div className="es-espera">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        ) : aba === 'materiais' ? (
          <Tabela
            colunas={colunasDoMaterial}
            linhas={filtrados}
            chaveDaLinha={(m) => m.id}
            aoClicarNaLinha={(m) => setNoMovimento(m)}
            vazio={
              materiais.length ? (
                <Vazio titulo="Nada neste filtro" texto="Nenhum material combina com o que está escolhido." />
              ) : (
                <Vazio
                  titulo="Nenhum material cadastrado"
                  texto="O estoque nasce vazio. Cadastre a malha, o aviamento e o insumo que a fábrica guarda, ou rode o ensaio para conferir a tela com conteúdo."
                />
              )
            }
          />
        ) : (
          <Tabela
            colunas={colunasDoRazao}
            linhas={movimentos}
            chaveDaLinha={(v) => v.id}
            vazio={
              <Vazio
                titulo="Razão vazio"
                texto="Nenhuma entrada, saída ou ajuste registrado ainda."
              />
            }
          />
        )}
      </section>

      <p className="es-rodape">
        Vermelho abaixo do mínimo, âmbar até 30% acima, verde com folga. O saldo é a soma do razão:
        para corrigir uma contagem errada lance um ajuste, que fica no histórico com nome e hora. A
        reserva do pedido aprovado e a separação de material entram nos passos 7 e 8.
      </p>

      <FolhaDeMovimento
        material={noMovimento}
        materiais={materiais}
        aoFechar={() => setNoMovimento(null)}
        aoGravar={async () => {
          setNoMovimento(null)
          await recarregar()
        }}
      />
    </Pagina>
  )
}

/* --- a folha de movimento -------------------------------------------------
   Três motivos e não cinco: separação nasce da tela de separação e devolução
   nasce do que voltou dela. Nenhuma das duas é alguém digitando, então oferecer
   as duas aqui só criaria um caminho para o razão contar uma história que não
   aconteceu.

   O sinal não é digitado: quem escolhe "Saída" digita 8 e o sistema grava -8.
   Pedir o menos na mão é pedir o dia em que alguém esquece dele e a saída vira
   entrada sem ninguém perceber. */
function FolhaDeMovimento({
  material,
  materiais,
  aoFechar,
  aoGravar,
}: {
  material: Material | null
  materiais: Material[]
  aoFechar: () => void
  aoGravar: () => Promise<void>
}) {
  const [escolhido, setEscolhido] = useState('')
  const [motivo, setMotivo] = useState<'entrada' | 'saida' | 'ajuste'>('entrada')
  const [quanto, setQuanto] = useState('')
  const [observacao, setObservacao] = useState('')
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    if (!material) return
    setEscolhido(material.id)
    setMotivo('entrada')
    setQuanto('')
    setObservacao('')
  }, [material])

  const alvo = materiais.find((m) => m.id === escolhido) ?? material
  const valor = Number(quanto.replace(',', '.'))
  const valido = !!alvo && Number.isFinite(valor) && valor > 0

  /* O ajuste é o único que pode tirar mais do que tem, porque ele existe
     justamente para o dia em que o número guardado está errado. */
  const depois = alvo ? alvo.saldo + (motivo === 'saida' ? -valor : valor) : 0

  async function gravar() {
    if (!alvo || !valido || gravando) return
    setGravando(true)
    try {
      await mexerNoEstoque(alvo.id, motivo === 'saida' ? -valor : valor, motivo, observacao.trim())
      avisar(
        `${NOME_DO_MOTIVO[motivo]} de ${numeroNaUnidade(valor, alvo.unidade)} em ${alvo.nome}.`,
        'ok',
      )
      await aoGravar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar o movimento.', 'brand')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Gaveta
      aberto={!!material}
      aoFechar={aoFechar}
      titulo="Movimento de estoque"
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" onClick={gravar} disabled={!valido || gravando} carregando={gravando}>
            {gravando ? 'Gravando' : 'Gravar no razão'}
          </Botao>
        </>
      }
    >
      <div className="pilha solta">
        <Campo rotulo="Material">
          <Seletor
            campo
            bloco
            valor={escolhido}
            opcoes={materiais.map((m) => ({ valor: m.id, rotulo: m.nome }))}
            aoEscolher={setEscolhido}
            vazio="Escolha o material"
            comBusca
          />
        </Campo>

        <Campo rotulo="Motivo">
          <Segmentado
            valor={motivo}
            aoMudar={setMotivo}
            opcoes={[
              { valor: 'entrada', rotulo: 'Entrada' },
              { valor: 'saida', rotulo: 'Saída' },
              { valor: 'ajuste', rotulo: 'Ajuste' },
            ]}
          />
        </Campo>

        <Campo
          rotulo={'Quanto' + (alvo ? ' (' + alvo.unidade + ')' : '')}
          dica={
            alvo && valido
              ? `Tem ${numeroNaUnidade(alvo.saldo, alvo.unidade)} e fica com ${numeroNaUnidade(depois, alvo.unidade)}.`
              : 'Só o número, sempre positivo. O sinal sai do motivo.'
          }
          erro={!!alvo && motivo === 'saida' && valido && depois < 0}
        >
          <Entrada
            inputMode="decimal"
            value={quanto}
            onChange={(e) => setQuanto(e.currentTarget.value)}
            placeholder={alvo ? '0' + (casasDaUnidade(alvo.unidade) ? ',0' : '') : '0'}
          />
        </Campo>

        <Campo
          rotulo="Observação"
          dica="A nota fiscal, a contagem que gerou o ajuste, o fornecedor. É o que alguém vai ler daqui a seis meses."
        >
          <AreaTexto
            rows={3}
            value={observacao}
            onChange={(e) => setObservacao(e.currentTarget.value)}
            placeholder="NF 4471, contagem de sexta, devolução do corte"
          />
        </Campo>
      </div>
    </Gaveta>
  )
}
