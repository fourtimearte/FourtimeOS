import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Envelope, Prohibit, Trash, UserPlus } from '@phosphor-icons/react'
import {
  Aviso,
  avisar,
  Botao,
  Campo,
  Cartao,
  Entrada,
  Gaveta,
  Marcacao,
  Pagina,
  Selo,
  Seletor,
  TituloCartao,
  Vazio,
} from '@ds'
import {
  aprovar,
  apagarPessoa,
  bloquear,
  convidar,
  convitesAbertos,
  desbloquear,
  emailValido,
  listarConvites,
  listarEquipe,
  listarPaineis,
  mudarPaineis,
  mudarPapel,
  naOrdemDaFila,
  paineisDoPapel,
  porGrupo,
  quantosEsperando,
  tirarConvite,
} from '@dominio/equipe'
import type { Convite, PainelDoSistema, PessoaDaEquipe } from '@dominio/equipe'
import {
  LINHA_DO_PAPEL,
  NOME_DA_SITUACAO,
  NOME_DO_PAPEL,
  PAPEIS,
  useSessao,
} from '@dominio/sessao'
import type { Painel, Papel } from '@dominio/sessao'
import './config.css'

/* Configuracoes: quem entra, com qual papel, em quais paineis.

   O fluxo combinado tem quatro passos, e a tela segue a mesma ordem de cima
   para baixo: libero o e-mail, a pessoa se cadastra sozinha, ela cai na fila,
   eu aprovo escolhendo o papel.

   Nenhum botao daqui e a tranca. Se um vendedor abrir esta tela na marra, o
   banco devolve zero linhas alteradas em tudo que ele tentar: a regra de
   acesso e que decide, e ela mora la. */

const OPCOES_DE_PAPEL = PAPEIS.map((p) => ({ valor: p, rotulo: NOME_DO_PAPEL[p] }))

export function TelaConfig() {
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null

  const [equipe, setEquipe] = useState<PessoaDaEquipe[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [paineis, setPaineis] = useState<PainelDoSistema[]>([])
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')
  const [editando, setEditando] = useState<PessoaDaEquipe | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setFalha('')
    try {
      const [gente, liberados, telas] = await Promise.all([
        listarEquipe(),
        listarConvites(),
        listarPaineis(),
      ])
      setEquipe(gente)
      setConvites(liberados)
      setPaineis(telas)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui carregar a equipe.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const trocar = useCallback((p: PessoaDaEquipe) => {
    setEquipe((lista) => lista.map((x) => (x.id === p.id ? p : x)))
  }, [])

  const naFila = useMemo(() => equipe.filter((p) => p.situacao === 'esperando'), [equipe])
  const jaDentro = useMemo(
    () => naOrdemDaFila(equipe.filter((p) => p.situacao !== 'esperando')),
    [equipe],
  )
  const abertos = useMemo(() => convitesAbertos(convites), [convites])

  if (!eu) return null

  return (
    <Pagina
      acima="Gestão"
      titulo="Configurações"
      sub="Quem entra no sistema, com qual papel e em quais painéis."
    >
      {falha ? (
        <Aviso tom="brand" titulo="Não consegui carregar">
          {falha}
        </Aviso>
      ) : null}

      {carregando ? (
        <Cartao>
          <p className="cfg-nada">Carregando a equipe...</p>
        </Cartao>
      ) : (
        <div className="cfg-colunas">
          <div className="cfg-larga">
            <FilaDeAprovacao
              fila={naFila}
              euSou={eu.id}
              aoMudar={trocar}
              aoErrar={(m) => avisar(m, 'brand')}
            />

            <Cartao>
              <TituloCartao>
                Equipe {jaDentro.length ? <span className="cfg-conta">{jaDentro.length}</span> : null}
              </TituloCartao>
              {jaDentro.length === 0 ? (
                <p className="cfg-nada">Ninguém aprovado ainda além de você.</p>
              ) : (
                <ul className="cfg-lista">
                  {jaDentro.map((p) => (
                    <LinhaDaPessoa
                      key={p.id}
                      p={p}
                      souEu={p.id === eu.id}
                      euSou={eu.id}
                      aoMudar={trocar}
                      aoRemover={(id) => setEquipe((l) => l.filter((x) => x.id !== id))}
                      aoAbrirPaineis={() => setEditando(p)}
                    />
                  ))}
                </ul>
              )}
            </Cartao>
          </div>

          <Convites
            abertos={abertos}
            euSou={eu.id}
            aoRecarregar={() => void carregar()}
            aoMudar={setConvites}
          />
        </div>
      )}

      <EditorDePaineis
        pessoa={editando}
        paineis={paineis}
        aoFechar={() => setEditando(null)}
        aoSalvar={(p) => {
          trocar(p)
          setEditando(null)
        }}
      />
    </Pagina>
  )
}

/* --- a fila ---------------------------------------------------------------
   So aparece quando tem gente esperando. Uma fila vazia nao merece um cartao
   vazio ocupando o topo da tela todo dia. */
function FilaDeAprovacao({
  fila,
  euSou,
  aoMudar,
  aoErrar,
}: {
  fila: PessoaDaEquipe[]
  euSou: string
  aoMudar: (p: PessoaDaEquipe) => void
  aoErrar: (m: string) => void
}) {
  const [papeis, setPapeis] = useState<Record<string, Papel>>({})
  const [ocupado, setOcupado] = useState('')

  if (fila.length === 0) return null

  async function liberar(p: PessoaDaEquipe) {
    const papel = papeis[p.id] ?? p.papel
    setOcupado(p.id)
    try {
      aoMudar(await aprovar(p.id, papel, null, euSou))
      avisar(`${p.nome} entrou como ${NOME_DO_PAPEL[papel].toLowerCase()}.`, 'ok')
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : 'Não consegui aprovar.')
    } finally {
      setOcupado('')
    }
  }

  async function recusar(p: PessoaDaEquipe) {
    setOcupado(p.id)
    try {
      aoMudar(await bloquear(p.id))
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : 'Não consegui recusar.')
    } finally {
      setOcupado('')
    }
  }

  return (
    <Cartao className="cfg-fila">
      <TituloCartao>
        Esperando aprovação <span className="cfg-conta forte">{quantosEsperando(fila)}</span>
      </TituloCartao>

      <ul className="cfg-lista">
        {fila.map((p) => {
          const papel = papeis[p.id] ?? p.papel
          return (
            <li key={p.id} className="cfg-item">
              <div className="cfg-quem">
                <b>{p.nome}</b>
                <span>{p.email}</span>
              </div>

              <div className="cfg-acoes">
                <Seletor
                  rotulo="PAPEL"
                  campo
                  tamanho="sm"
                  valor={papel}
                  opcoes={OPCOES_DE_PAPEL}
                  aoEscolher={(v) => setPapeis((m) => ({ ...m, [p.id]: v as Papel }))}
                />
                <Botao
                  tom="primario"
                  tamanho="sm"
                  carregando={ocupado === p.id}
                  onClick={() => void liberar(p)}
                >
                  <Check size={16} />
                  Aprovar
                </Botao>
                <Botao
                  tom="limpo"
                  tamanho="sm"
                  icone
                  title="Recusar este acesso"
                  onClick={() => void recusar(p)}
                >
                  <Prohibit size={16} />
                </Botao>
              </div>

              <p className="cfg-dica">{LINHA_DO_PAPEL[papel]}</p>
            </li>
          )
        })}
      </ul>
    </Cartao>
  )
}

/* --- quem ja esta dentro -------------------------------------------------- */
function LinhaDaPessoa({
  p,
  souEu,
  euSou,
  aoMudar,
  aoRemover,
  aoAbrirPaineis,
}: {
  p: PessoaDaEquipe
  souEu: boolean
  euSou: string
  aoMudar: (p: PessoaDaEquipe) => void
  aoRemover: (id: string) => void
  aoAbrirPaineis: () => void
}) {
  const [ocupado, setOcupado] = useState(false)

  async function fazer(o_que: () => Promise<PessoaDaEquipe>) {
    setOcupado(true)
    try {
      aoMudar(await o_que())
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui mudar.', 'brand')
    } finally {
      setOcupado(false)
    }
  }

  async function remover() {
    setOcupado(true)
    try {
      await apagarPessoa(p.id)
      aoRemover(p.id)
      avisar(`${p.nome} saiu da equipe.`, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui remover.', 'brand')
    } finally {
      setOcupado(false)
    }
  }

  const bloqueado = p.situacao === 'bloqueado'

  return (
    <li className="cfg-item">
      <div className="cfg-quem">
        <b>
          {p.nome}
          {souEu ? <span className="cfg-voce">você</span> : null}
        </b>
        <span>{p.email}</span>
      </div>

      <div className="cfg-acoes">
        <Selo tom={bloqueado ? 'brand' : 'ok'}>{NOME_DA_SITUACAO[p.situacao]}</Selo>

        <Seletor
          rotulo="PAPEL"
          campo
          tamanho="sm"
          valor={p.papel}
          opcoes={OPCOES_DE_PAPEL}
          aoEscolher={(v) => void fazer(() => mudarPapel(p.id, v as Papel))}
        />

        <Botao tom="contorno" tamanho="sm" onClick={aoAbrirPaineis} disabled={ocupado}>
          {p.paineis ? `Painéis: ${p.paineis.length}` : 'Painéis do papel'}
        </Botao>

        {bloqueado ? (
          <Botao
            tom="contorno"
            tamanho="sm"
            disabled={ocupado}
            onClick={() => void fazer(() => desbloquear(p.id, euSou))}
          >
            Liberar de novo
          </Botao>
        ) : (
          <Botao
            tom="limpo"
            tamanho="sm"
            icone
            title="Bloquear o acesso"
            disabled={ocupado || souEu}
            onClick={() => void fazer(() => bloquear(p.id))}
          >
            <Prohibit size={16} />
          </Botao>
        )}

        <Botao
          tom="limpo"
          tamanho="sm"
          icone
          title={souEu ? 'Você não pode se remover' : 'Remover da equipe'}
          disabled={ocupado || souEu}
          onClick={() => void remover()}
        >
          <Trash size={16} />
        </Botao>
      </div>
    </li>
  )
}

/* --- os e-mails liberados ------------------------------------------------- */
function Convites({
  abertos,
  euSou,
  aoRecarregar,
  aoMudar,
}: {
  abertos: Convite[]
  euSou: string
  aoRecarregar: () => void
  aoMudar: (f: (c: Convite[]) => Convite[]) => void
}) {
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('producao')
  const [salvando, setSalvando] = useState(false)

  async function liberar(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    if (!emailValido(email)) {
      avisar('Escreva um e-mail válido.', 'brand')
      return
    }
    setSalvando(true)
    try {
      await convidar(email, papel, euSou)
      setEmail('')
      aoRecarregar()
      avisar('E-mail liberado. Agora a pessoa pode criar a conta.', 'ok')
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Não consegui liberar.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  async function tirar(alvo: string) {
    try {
      await tirarConvite(alvo)
      aoMudar((lista) => lista.filter((c) => c.email !== alvo))
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Não consegui tirar.', 'brand')
    }
  }

  return (
    <Cartao>
      <TituloCartao>E-mails liberados</TituloCartao>
      <p className="cfg-nada">
        Só quem está nesta lista consegue criar conta. Quem não está recebe uma recusa do banco,
        e a conta nem chega a nascer.
      </p>

      <form className="cfg-form" onSubmit={liberar}>
        <Campo rotulo="E-mail">
          <Entrada
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="pessoa@fourtimefit.com.br"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
        </Campo>

        <Campo rotulo="Papel sugerido" dica="Dá para trocar na hora de aprovar.">
          <Seletor
            campo
            bloco
            valor={papel}
            opcoes={OPCOES_DE_PAPEL}
            aoEscolher={(v) => setPapel(v as Papel)}
          />
        </Campo>

        <Botao tom="primario" type="submit" bloco carregando={salvando}>
          <UserPlus size={18} />
          Liberar e-mail
        </Botao>
      </form>

      {abertos.length === 0 ? (
        <p className="cfg-nada">Nenhum e-mail esperando cadastro.</p>
      ) : (
        <ul className="cfg-convites">
          {abertos.map((c) => (
            <li key={c.email}>
              <Envelope size={16} />
              <div>
                <b>{c.email}</b>
                <span>{NOME_DO_PAPEL[c.papel]}</span>
              </div>
              <Botao
                tom="limpo"
                tamanho="sm"
                icone
                title="Tirar da lista"
                onClick={() => void tirar(c.email)}
              >
                <Trash size={15} />
              </Botao>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}

/* --- painel por painel ----------------------------------------------------
   Vazio aqui nao e "nenhum painel": e "usa o padrao do papel". Sao coisas
   diferentes e a tela diz qual esta valendo, porque marcar tudo e nao marcar
   nada levariam ao mesmo lugar visualmente sem esse aviso. */
function EditorDePaineis({
  pessoa,
  paineis,
  aoFechar,
  aoSalvar,
}: {
  pessoa: PessoaDaEquipe | null
  paineis: PainelDoSistema[]
  aoFechar: () => void
  aoSalvar: (p: PessoaDaEquipe) => void
}) {
  const [marcados, setMarcados] = useState<Painel[]>([])
  const [proprio, setProprio] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!pessoa) return
    setProprio(pessoa.paineis !== null)
    setMarcados(pessoa.paineis ?? [])
  }, [pessoa])

  /* Sair do padrao com a lista vazia deixaria o admin marcando treze caixas do
     zero. Comeca do padrao do papel, que e onde ele ia chegar de qualquer
     jeito, e a partir dai ele tira ou poe uma. */
  async function trocarModo(usarPadrao: boolean) {
    setProprio(!usarPadrao)
    if (usarPadrao || !pessoa || marcados.length > 0) return
    try {
      setMarcados(await paineisDoPapel(pessoa.papel))
    } catch {
      /* sem o padrao, comeca vazio: chato, nao quebrado */
    }
  }

  async function salvar() {
    if (!pessoa || salvando) return
    setSalvando(true)
    try {
      aoSalvar(await mudarPaineis(pessoa.id, proprio ? marcados : null))
      avisar('Painéis salvos.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Gaveta
      aberto={!!pessoa}
      aoFechar={aoFechar}
      titulo={pessoa ? `Painéis de ${pessoa.nome}` : ''}
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" carregando={salvando} onClick={() => void salvar()}>
            Salvar
          </Botao>
        </>
      }
    >
      {pessoa ? (
        <>
          {/* Marcacao ja e um <label>: um label dentro de outro nao e HTML
              valido e confunde o leitor de tela. */}
          <div className="cfg-padrao">
            <Marcacao
              checked={!proprio}
              onChange={(e) => void trocarModo(e.target.checked)}
            >
              Usar o padrão de {NOME_DO_PAPEL[pessoa.papel].toLowerCase()}
            </Marcacao>
            <span>{LINHA_DO_PAPEL[pessoa.papel]}</span>
          </div>

          <div className={'cfg-paineis' + (proprio ? '' : ' desligado')}>
            {porGrupo(paineis).map((g) => (
              <div key={g.grupo}>
                <h4>{g.grupo}</h4>
                {g.itens.map((t) => (
                  <Marcacao
                    key={t.chave}
                    disabled={!proprio}
                    checked={marcados.includes(t.chave)}
                    onChange={(e) =>
                      setMarcados((m) =>
                        e.target.checked ? [...m, t.chave] : m.filter((x) => x !== t.chave),
                      )
                    }
                  >
                    {t.nome}
                  </Marcacao>
                ))}
              </div>
            ))}
          </div>

          {proprio && marcados.length === 0 ? (
            <Vazio
              titulo="Nenhum painel marcado"
              texto="Assim ela entra e não abre nada além do próprio perfil."
            />
          ) : null}
        </>
      ) : null}
    </Gaveta>
  )
}
