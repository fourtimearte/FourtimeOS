import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { Botao, Busca, Chip, Esqueleto, Gaveta, Pagina, Segmentado, Seletor, Tag, Vazio, avisar } from '@ds'
import { usarConsulta } from '@shared'
import { carregarMateriais, gruposDoEstoque, type Material } from '@dominio/estoque'
import {
  NOME_DA_ENTRADA,
  NOME_DA_SITUACAO,
  carregarFornecedores,
  carregarLigacoes,
  carregarTiposDeFornecedor,
  cnpjNaTela,
  combinaComFornecedor,
  ondeFica,
  salvarFornecedor,
  situacaoDe,
  ultimoMovimentoDe,
  type Fornecedor,
  type Ligacao,
  type Situacao,
  type TipoDeFornecedor,
} from '@dominio/fornecedor'
import { SituacaoDoFornecedor } from '@dominio/fornecedor/escolher'
import { pode, souAdmin, useSessao } from '@dominio/sessao'
import { BloquearFornecedor, JuntarFornecedores, TiposDeFornecedor } from './acoes'
import { BotoesDaFicha, CabecalhoDaFicha, CorpoDaFicha } from './ficha'
import { FormularioDeFornecedor, type InicioDoFormulario } from './formulario'
import './fornecedores.css'

/* ==========================================================================
   Fornecedores.

   De quem a Fourtime compra. A lista não é digitada aqui e só aqui: quem
   registra uma entrada no estoque, quem confere um boleto e quem cadastra à
   mão alimentam a mesma lista, e a coluna "Entrou por" diz por onde cada um
   chegou.

   DOIS JEITOS DE OLHAR. Por tipo responde "de quem eu compro tecido": uma
   faixa por família, e o fornecedor que vende duas coisas aparece nas duas.
   Por fornecedor responde "quem é este": de A a Z, com a ficha ao lado.

   A SITUAÇÃO É O QUE O VERIFICADOR DE BOLETO LÊ. Confiável é a lista dele.
   ========================================================================== */

type Vista = 'tipo' | 'fornecedor'
const SEM_TIPO = '__sem_tipo__'
const SITUACOES: Situacao[] = ['confiavel', 'novo', 'esperando', 'sem-cnpj', 'bloqueado']

export function TelaFornecedores() {
  const navegar = useNavigate()
  const [endereco, setEndereco] = useSearchParams()
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const podeEditar = !!pessoa && pode(pessoa, 'estoque', 'editar')
  const admin = souAdmin(pessoa)

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [tipos, setTipos] = useState<TipoDeFornecedor[]>([])
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([])
  const [materiais, setMateriais] = useState<Material[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [vista, setVista] = useState<Vista>('tipo')
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [situacao, setSituacao] = useState<'' | Situacao>(
    endereco.get('situacao') === 'confiavel' ? 'confiavel' : '',
  )
  const [fechados, setFechados] = useState<Set<string>>(new Set())
  const [aberto, setAberto] = useState(endereco.get('abrir') ?? '')

  const [formulario, setFormulario] = useState<InicioDoFormulario | null>(null)
  const [bloqueando, setBloqueando] = useState<Fornecedor | null>(null)
  const [juntando, setJuntando] = useState<Fornecedor | null>(null)
  const [verTipos, setVerTipos] = useState(false)

  const larga = usarConsulta('(min-width: 1200px)')

  const ler = useCallback(async () => {
    const [fs, ts, ls, ms] = await Promise.all([
      carregarFornecedores(),
      carregarTiposDeFornecedor(),
      carregarLigacoes(),
      /* o material é apoio aqui: sem ele a página ainda lista os fornecedores */
      carregarMateriais().catch(() => [] as Material[]),
    ])
    setFornecedores(fs)
    setTipos(ts)
    setLigacoes(ls)
    setMateriais(ms)
    setErro('')
  }, [])

  const recarregar = useCallback(async () => {
    try {
      await ler()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler os fornecedores.')
    }
  }, [ler])

  useEffect(() => {
    let vivo = true
    ler()
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler os fornecedores.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [ler])

  /* a ficha aberta mora no endereço, para o link "Ver fornecedor" do estoque
     cair nela e para o voltar do navegador fechar */
  function abrir(id: string) {
    setAberto(id)
    const novo = new URLSearchParams(endereco)
    if (id) novo.set('abrir', id)
    else novo.delete('abrir')
    setEndereco(novo, { replace: true })
  }

  const materiaisDe = useCallback(
    (id: string) => {
      const ids = new Set(ligacoes.filter((l) => l.fornecedorId === id).map((l) => l.materialId))
      return materiais.filter((m) => ids.has(m.id))
    },
    [ligacoes, materiais],
  )

  /* "DRYFIT POLIESTER 100%, PIQUET 100% e mais 2": os grupos do estoque que
     ele entrega, ou o que está escrito no cadastro quando não é material */
  const oQueFornece = useCallback(
    (f: Fornecedor) => {
      const nomes = gruposDoEstoque(materiaisDe(f.id)).map((g) => g.nome)
      if (!nomes.length) return f.oQueFornece
      const texto = nomes.length <= 2 ? nomes.join(', ') : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`
      return f.oQueFornece ? texto + ' · ' + f.oQueFornece : texto
    },
    [materiaisDe],
  )

  const filtrados = useMemo(
    () =>
      [...fornecedores].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')).filter((f) => {
        if (situacao && situacaoDe(f) !== situacao) return false
        if (tipo && !(tipo === SEM_TIPO ? f.tipos.length === 0 : f.tipos.includes(tipo))) return false
        if (!busca.trim()) return true
        return (
          combinaComFornecedor(f, busca) ||
          materiaisDe(f.id).some((m) =>
            [m.nome, m.tecido, m.grupo].join(' ').toLowerCase().includes(busca.trim().toLowerCase()),
          )
        )
      }),
    [fornecedores, situacao, tipo, busca, materiaisDe],
  )

  const escolhido = fornecedores.find((f) => f.id === aberto) ?? null
  const semTipo = fornecedores.filter((f) => f.tipos.length === 0).length
  const nomeDoTipo = (chave: string) => tipos.find((t) => t.chave === chave)?.nome ?? chave

  async function marcarConfiavel(f: Fornecedor) {
    try {
      await salvarFornecedor(f.id, { situacao: 'confiavel' })
      avisar(`${f.nome} entrou na lista de confiáveis.`, 'ok')
      await recarregar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui marcar como confiável.', 'brand')
    }
  }

  async function desbloquear(f: Fornecedor) {
    try {
      await salvarFornecedor(f.id, { situacao: 'novo' })
      avisar(`${f.nome} foi desbloqueado, e voltou como Novo.`, 'ok')
      await recarregar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui desbloquear.', 'brand')
    }
  }

  function irPara(f: Fornecedor, onde: 'estoque' | 'movimentos' | 'boleto') {
    if (onde === 'boleto') navegar('/ferramentas/boleto')
    else if (onde === 'movimentos') navegar('/estoque?aba=razao&busca=' + encodeURIComponent(f.nome))
    else navegar('/estoque?busca=' + encodeURIComponent(f.nome))
  }

  const virar = (chave: string) =>
    setFechados((antes) => {
      const novo = new Set(antes)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })

  const linhaDeSituacao = (f: Fornecedor) => <SituacaoDoFornecedor f={f} />

  const fichaAoLado = larga && vista === 'fornecedor' && !!escolhido
  const fichaNaFolha = !!escolhido && !fichaAoLado

  const corpoDaFicha = escolhido ? (
    <CorpoDaFicha
      f={escolhido}
      tipos={tipos}
      materiais={materiaisDe(escolhido.id)}
      admin={admin}
      aoMarcarConfiavel={() => void marcarConfiavel(escolhido)}
      aoIrPara={(onde) => irPara(escolhido, onde)}
    />
  ) : null
  const botoesDaFicha = escolhido ? (
    <BotoesDaFicha
      f={escolhido}
      podeEditar={podeEditar}
      admin={admin}
      aoBloquear={() => setBloqueando(escolhido)}
      aoDesbloquear={() => void desbloquear(escolhido)}
      aoJuntar={() => setJuntando(escolhido)}
      aoEditar={() =>
        setFormulario({
          modo: 'editar',
          fornecedor: escolhido,
          materiais: materiaisDe(escolhido.id).map((m) => m.id),
        })
      }
    />
  ) : null

  return (
    <Pagina
      acima="Materiais"
      titulo="Fornecedores"
      sub="De quem a Fourtime compra. Tecido, aviamento, insumo, frete e serviço: todo fornecedor que entra por qualquer página aparece aqui."
      acoes={
        <>
          <Botao onClick={() => setVerTipos(true)}>Tipos de fornecedor</Botao>
          {podeEditar ? (
            <Botao tom="primario" onClick={() => setFormulario({ modo: 'novo', tipo: tipo && tipo !== SEM_TIPO ? tipo : undefined })}>
              Novo fornecedor
            </Botao>
          ) : null}
        </>
      }
    >
      <div className="fo-barra">
        <Busca
          className="fo-busca"
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          placeholder="Buscar por nome, CNPJ ou material"
          aria-label="Buscar fornecedor"
        />
        <Segmentado
          className="fo-vista"
          valor={vista}
          aoMudar={setVista}
          opcoes={[
            { valor: 'tipo', rotulo: 'Por tipo' },
            { valor: 'fornecedor', rotulo: 'Por fornecedor' },
          ]}
        />
        <div className="fo-chips">
          <Chip ligado={tipo === ''} onClick={() => setTipo('')}>
            Todos <span className="fo-conta">{fornecedores.length}</span>
          </Chip>
          {tipos.map((t) => (
            <Chip key={t.chave} ligado={tipo === t.chave} onClick={() => setTipo(tipo === t.chave ? '' : t.chave)}>
              {t.nome} <span className="fo-conta">{fornecedores.filter((f) => f.tipos.includes(t.chave)).length}</span>
            </Chip>
          ))}
          {semTipo ? (
            <Chip ligado={tipo === SEM_TIPO} onClick={() => setTipo(tipo === SEM_TIPO ? '' : SEM_TIPO)}>
              Sem tipo <span className="fo-conta">{semTipo}</span>
            </Chip>
          ) : null}
        </div>
        <span className="fo-fim">
          <Seletor
            rotulo="Situação"
            valor={situacao}
            opcoes={SITUACOES.map((s) => ({
              valor: s,
              rotulo: NOME_DA_SITUACAO[s],
              contagem: fornecedores.filter((f) => situacaoDe(f) === s).length,
            }))}
            aoEscolher={(v) => setSituacao(v as '' | Situacao)}
            vazio="Todas"
          />
        </span>
      </div>

      {erro ? (
        <section className="cartao fo-quadro">
          <Vazio titulo="Não consegui ler os fornecedores" texto={erro} />
        </section>
      ) : carregando ? (
        <section className="cartao fo-quadro">
          <div className="fo-espera">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        </section>
      ) : fornecedores.length === 0 ? (
        <section className="cartao fo-quadro">
          <Vazio
            titulo="Nenhum fornecedor ainda"
            texto="Eles nascem aqui, na entrada de material do estoque ou no primeiro boleto conferido."
            acao={
              podeEditar ? <Botao onClick={() => setFormulario({ modo: 'novo' })}>Novo fornecedor</Botao> : undefined
            }
          />
        </section>
      ) : filtrados.length === 0 ? (
        <section className="cartao fo-quadro">
          <Vazio titulo="Nada neste filtro" texto="Nenhum fornecedor combina com o que está escolhido." />
        </section>
      ) : vista === 'tipo' ? (
        <section className="cartao fo-quadro">
          <div className="tabela-rola">
            <table className="tabela fo-tabela">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th className="fo-some-estreito">CNPJ</th>
                  <th className="fo-some-medio">O que fornece</th>
                  <th className="fo-some-medio">Entrou por</th>
                  <th className="fo-some-estreito">Último movimento</th>
                  <th>Situação</th>
                  <th className="fo-some-estreito" aria-label="Abrir" />
                </tr>
              </thead>
              <tbody>
                {[...tipos.map((t) => t.chave), SEM_TIPO].map((chave) => {
                  if (tipo && tipo !== chave) return null
                  const doTipo = filtrados.filter((f) =>
                    chave === SEM_TIPO ? f.tipos.length === 0 : f.tipos.includes(chave),
                  )
                  if (!doTipo.length && (chave === SEM_TIPO || busca || situacao)) return null
                  const fechado = fechados.has(chave)
                  const nMateriais = new Set(
                    doTipo.flatMap((f) =>
                      materiaisDe(f.id)
                        .filter((m) => m.categoria === chave)
                        .map((m) => m.id),
                    ),
                  ).size
                  return (
                    <Fragment key={chave}>
                      <tr className="grupo fo-recolhe" onClick={() => virar(chave)}>
                        <td colSpan={5}>
                          <span className="fo-grupo">
                            {fechado ? <CaretRight size={14} /> : <CaretDown size={14} />}
                            <b>{chave === SEM_TIPO ? 'Sem tipo' : nomeDoTipo(chave)}</b>
                            <span>
                              {doTipo.length === 1 ? '1 fornecedor' : `${doTipo.length} fornecedores`}
                              {nMateriais ? ` · ${nMateriais === 1 ? '1 material' : nMateriais + ' materiais'}` : ''}
                            </span>
                          </span>
                        </td>
                        <td colSpan={2}>
                          {podeEditar && chave !== SEM_TIPO ? (
                            <span className="fo-grupo-fim">
                              <Botao
                                tamanho="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setFormulario({ modo: 'novo', tipo: chave })
                                }}
                              >
                                Novo em {nomeDoTipo(chave)}
                              </Botao>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                      {fechado
                        ? null
                        : doTipo.map((f) => {
                            const outros = f.tipos.filter((t) => t !== chave).map(nomeDoTipo)
                            return (
                              <tr
                                key={chave + f.id}
                                className={f.id === aberto ? 'fo-linha marcada' : 'fo-linha'}
                                onClick={() => abrir(f.id)}
                              >
                                <td>
                                  <span className="fo-nome">
                                    <b>{f.nome}</b>
                                    <small>
                                      {[ondeFica(f), outros.length ? 'também em ' + outros.join(' e ') : '']
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </small>
                                  </span>
                                </td>
                                <td className="fo-numero fo-some-estreito">
                                  {f.cnpj ? cnpjNaTela(f.cnpj) : <span className="fo-falta">falta o CNPJ</span>}
                                </td>
                                <td className="fo-some-medio">
                                  <span className="fo-corta">{oQueFornece(f)}</span>
                                </td>
                                <td className="fo-apoio fo-some-medio">{NOME_DA_ENTRADA[f.entrouPor]}</td>
                                <td className="fo-apoio fo-numero fo-some-estreito">{ultimoMovimentoDe(f)}</td>
                                <td>{linhaDeSituacao(f)}</td>
                                <td className="fo-some-estreito">
                                  <span className="fo-direita">
                                    <CaretRight size={16} />
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className={fichaAoLado ? 'fo-duas com-ficha' : 'fo-duas'}>
          <section className="cartao fo-quadro">
            <div className="tabela-rola">
              <table className="tabela fo-tabela">
                <thead>
                  <tr>
                    <th>Fornecedor, de A a Z</th>
                    <th className="fo-some-estreito">Tipo</th>
                    <th className="fo-some-estreito">CNPJ</th>
                    <th>Situação</th>
                    <th className="fo-some-estreito" aria-label="Abrir" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((f) => (
                    <tr
                      key={f.id}
                      className={f.id === aberto ? 'fo-linha marcada' : 'fo-linha'}
                      onClick={() => abrir(f.id === aberto && fichaAoLado ? '' : f.id)}
                    >
                      <td>
                        <span className="fo-nome">
                          <b>{f.nome}</b>
                          <small>{ondeFica(f)}</small>
                        </span>
                      </td>
                      <td className="fo-some-estreito">
                        <span className="fo-tags">
                          {f.tipos.length ? (
                            f.tipos.map((t) => <Tag key={t}>{nomeDoTipo(t)}</Tag>)
                          ) : (
                            <span className="fo-falta">sem tipo</span>
                          )}
                        </span>
                      </td>
                      <td className="fo-numero fo-some-estreito">
                        {f.cnpj ? cnpjNaTela(f.cnpj) : <span className="fo-falta">falta o CNPJ</span>}
                      </td>
                      <td>{linhaDeSituacao(f)}</td>
                      <td className="fo-some-estreito">
                        <span className="fo-direita">
                          <CaretRight size={16} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {fichaAoLado && escolhido ? (
            <section className="cartao fo-ficha">
              <CabecalhoDaFicha f={escolhido} aoFechar={() => abrir('')} />
              {corpoDaFicha}
              <div className="fo-ficha-pe">{botoesDaFicha}</div>
            </section>
          ) : null}
        </div>
      )}

      <Gaveta
        aberto={fichaNaFolha}
        aoFechar={() => abrir('')}
        titulo={escolhido?.nome ?? ''}
        pe={botoesDaFicha ?? undefined}
      >
        <div className="fo-na-folha">{corpoDaFicha}</div>
      </Gaveta>

      <FormularioDeFornecedor
        inicio={formulario}
        tipos={tipos}
        materiais={materiais}
        admin={admin}
        aoFechar={() => setFormulario(null)}
        aoSalvar={async (id) => {
          setFormulario(null)
          await recarregar()
          abrir(id)
        }}
        aoMudarTipos={async () => setTipos(await carregarTiposDeFornecedor())}
      />
      <BloquearFornecedor
        fornecedor={bloqueando}
        aoFechar={() => setBloqueando(null)}
        aoFeito={async () => {
          setBloqueando(null)
          await recarregar()
        }}
      />
      <JuntarFornecedores
        fornecedor={juntando}
        outros={fornecedores.filter((f) => f.id !== juntando?.id)}
        aoFechar={() => setJuntando(null)}
        aoFeito={async () => {
          setJuntando(null)
          await recarregar()
        }}
      />
      <TiposDeFornecedor
        aberto={verTipos}
        tipos={tipos}
        fornecedores={fornecedores}
        podeEditar={podeEditar}
        aoFechar={() => setVerTipos(false)}
        aoMudar={recarregar}
      />
    </Pagina>
  )
}
