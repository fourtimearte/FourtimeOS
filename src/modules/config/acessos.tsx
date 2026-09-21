import { useCallback, useEffect, useMemo, useState } from 'react'
import { Prohibit, ShieldCheck, Trash, UserPlus } from '@phosphor-icons/react'
import {
  Botao,
  Campo,
  Cartao,
  Entrada,
  Esqueleto,
  Kpi,
  Marcacao,
  Pagina,
  Selo,
  TituloCartao,
  Vazio,
  avisar,
} from '@ds'
import { listarPaineis, porGrupo } from '@dominio/equipe'
import type { PainelDoSistema } from '@dominio/equipe'
import { souAdmin, useSessao } from '@dominio/sessao'
import {
  NADA,
  NIVEIS,
  NOME_DO_NIVEL,
  apagarPapel,
  carregarAcoes,
  carregarAcoesDosPapeis,
  carregarMatriz,
  carregarPapeis,
  marcarAcao,
  podeAAcao,
  chaveLimpa,
  chaveValida,
  criarPapel,
  escada,
  permissaoDe,
  salvarPapel,
  salvarPermissao,
} from '@dominio/acessos'
import type { Acao, Matriz, Nivel, PapelDoSistema, Permissao } from '@dominio/acessos'

/* NO CELULAR O CABECALHO VIRA LETRA, e a legenda acima da tabela ensina qual
   e qual. Quatro rotulos por extenso empurram duas das quatro colunas para
   fora da tela, e rolar de lado para achar a caixa e o mesmo que nao ter a
   caixa: a pessoa marca o que ve e vai embora achando que terminou. */
const LETRA_DO_NIVEL: Record<Nivel, string> = {
  ver: 'V',
  editar: 'E',
  deletar: 'D',
  total: 'T',
}
import { AbasDaConfig } from './abas'
import './acessos.css'

/* ==========================================================================
   Acessos: quem é cada papel e o que ele pode em cada página.

   ESTA TELA É DO ADMINISTRADOR E DE MAIS NINGUÉM. Quem não for admin nem vê
   a aba, e se digitar o endereço encontra o aviso em vez da matriz. A tranca
   de verdade continua no banco: salvar_permissao, criar_papel e apagar_papel
   recusam quem não é admin, e a tela só evita o clique inútil.

   CADA CAIXA GRAVA SOZINHA, sem botão de salvar. Uma matriz de 15 páginas por
   papel juntaria dezenas de mudanças atrás de um botão, e o dia em que alguém
   fechasse a aba antes de clicar perderia tudo sem avisar. Gravando na hora,
   o que está na tela é o que está no banco.

   A ESCADA APARECE NA HORA E É COBRADA NO BANCO. Marcar deletar acende ver e
   editar aqui, para a caixa responder sem esperar a viagem, e a constraint da
   028 recusa o contrário venha de onde vier. As duas dizem a mesma coisa de
   propósito: uma é conforto, a outra é a regra.
   ========================================================================== */

type Forma = { chave: string; nome: string; linha: string } | null

function nomeDaPagina(lista: PainelDoSistema[], chave: string): string {
  return lista.find((p) => p.chave === chave)?.nome || chave
}

export function TelaAcessos() {
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null
  const admin = souAdmin(eu)

  const [papeis, setPapeis] = useState<PapelDoSistema[]>([])
  const [paginas, setPaginas] = useState<PainelDoSistema[]>([])
  const [matriz, setMatriz] = useState<Matriz>({})
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [quemFaz, setQuemFaz] = useState<Set<string>>(new Set())
  const [escolhido, setEscolhido] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')
  const [ocupado, setOcupado] = useState('')

  /* null: ninguém editando. chave vazia: criando. chave cheia: renomeando. */
  const [forma, setForma] = useState<Forma>(null)
  const [apagando, setApagando] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setFalha('')
    try {
      const [ps, pgs, m, ac, qf] = await Promise.all([
        carregarPapeis(),
        listarPaineis(),
        carregarMatriz(),
        carregarAcoes(),
        carregarAcoesDosPapeis(),
      ])
      setPapeis(ps)
      setPaginas(pgs)
      setMatriz(m)
      setAcoes(ac)
      setQuemFaz(qf)
      setEscolhido((atual) => (ps.some((p) => p.chave === atual) ? atual : (ps[0]?.chave ?? '')))
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui ler os acessos.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (admin) void carregar()
    else setCarregando(false)
  }, [admin, carregar])

  const grupos = useMemo(() => porGrupo(paginas), [paginas])

  const gruposDeAcao = useMemo(() => {
    const fora: { grupo: string; itens: Acao[] }[] = []
    for (const a of [...acoes].sort((x, y) => x.ordem - y.ordem)) {
      const ultimo = fora[fora.length - 1]
      if (ultimo && ultimo.grupo === a.grupo) ultimo.itens.push(a)
      else fora.push({ grupo: a.grupo, itens: [a] })
    }
    return fora
  }, [acoes])

  const conta = useMemo(() => {
    const doPapel = matriz[escolhido] ?? {}
    const linhas = Object.values(doPapel)
    return {
      paginas: linhas.filter((l) => l.ver).length,
      editam: linhas.filter((l) => l.editar).length,
      apagam: linhas.filter((l) => l.deletar).length,
      totais: linhas.filter((l) => l.total).length,
      acoes: acoes.filter((a) => podeAAcao(quemFaz, escolhido, a.chave)).length,
    }
  }, [matriz, escolhido, acoes, quemFaz])

  /* Grava primeiro na tela e depois no banco, e se o banco recusar, desfaz.
     A caixa de marcação que espera a viagem para mudar de cor faz a pessoa
     clicar duas vezes achando que não pegou. */
  async function mexer(painel: string, nivel: Nivel, ligado: boolean) {
    if (!escolhido) return
    const antes = permissaoDe(matriz, escolhido, painel)
    const depois = escada(antes, nivel, ligado)
    const marca = escolhido + '/' + painel
    setMatriz((m) => ({ ...m, [escolhido]: { ...(m[escolhido] ?? {}), [painel]: depois } }))
    setOcupado(marca)
    try {
      await salvarPermissao(escolhido, painel, depois)
    } catch (e) {
      setMatriz((m) => ({ ...m, [escolhido]: { ...(m[escolhido] ?? {}), [painel]: antes } }))
      avisar(e instanceof Error ? e.message : 'Não consegui gravar.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  /* A coluna inteira de uma vez. Ela é o que torna a matriz preenchível: sem
     ela, decidir um papel novo são quarenta e cinco cliques. */
  async function colunaInteira(nivel: Nivel) {
    if (!escolhido || ocupado) return
    const doPapel = matriz[escolhido] ?? {}
    const todas = paginas.every((p) => (doPapel[p.chave] ?? NADA)[nivel])
    setOcupado('coluna')
    const novo: Record<string, Permissao> = { ...doPapel }
    try {
      for (const p of paginas) {
        const antes = novo[p.chave] ?? NADA
        const depois = escada(antes, nivel, !todas)
        if (JSON.stringify(antes) === JSON.stringify(depois)) continue
        await salvarPermissao(escolhido, p.chave, depois)
        novo[p.chave] = depois
      }
      setMatriz((m) => ({ ...m, [escolhido]: novo }))
      avisar(todas ? `${NOME_DO_NIVEL[nivel]} desmarcado em tudo.` : `${NOME_DO_NIVEL[nivel]} marcado em tudo.`, 'ok')
    } catch (e) {
      setMatriz((m) => ({ ...m, [escolhido]: novo }))
      avisar(e instanceof Error ? e.message : 'Parei no meio. Confira a lista.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  /* Mesmo jeito da matriz de páginas: muda na tela, grava, e volta atrás se o
     banco recusar. */
  async function mexerNaAcao(acao: Acao, ligado: boolean) {
    if (!escolhido || ocupado) return
    const marca = escolhido + '/' + acao.chave
    setQuemFaz((s) => {
      const novo = new Set(s)
      if (ligado) novo.add(marca)
      else novo.delete(marca)
      return novo
    })
    setOcupado(marca)
    try {
      await marcarAcao(escolhido, acao.chave, ligado)
    } catch (e) {
      setQuemFaz((s) => {
        const novo = new Set(s)
        if (ligado) novo.delete(marca)
        else novo.add(marca)
        return novo
      })
      avisar(e instanceof Error ? e.message : 'Não consegui gravar.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  async function salvarForma() {
    if (!forma) return
    const nome = forma.nome.trim()
    const chave = chaveLimpa(forma.chave)
    if (!nome) {
      avisar('Escreva o nome do papel.', 'warn')
      return
    }
    if (!chaveValida(chave)) {
      avisar('A chave precisa começar com letra e ter ao menos duas letras, sem acento e sem espaço.', 'warn')
      return
    }
    setOcupado('forma')
    try {
      const novo = forma.chave && papeis.some((p) => p.chave === forma.chave)
        ? await salvarPapel(forma.chave, chave, nome, forma.linha)
        : await criarPapel(chave, nome, forma.linha)
      setForma(null)
      await carregar()
      setEscolhido(novo.chave)
      avisar('Papel salvo.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar o papel.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  async function confirmarApagar() {
    setOcupado('apagar')
    try {
      const recado = await apagarPapel(apagando)
      setApagando('')
      await carregar()
      avisar(recado, 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui apagar.', 'brand')
    } finally {
      setOcupado('')
    }
  }

  if (!eu) return null

  if (!admin) {
    return (
      <Pagina acima="Configurações" titulo="Acessos">
        <AbasDaConfig atual="acessos" />
        <Vazio
          titulo="Esta página é do administrador"
          texto="Quem decide o que cada papel pode é quem administra o sistema. Se você precisa de um acesso que não tem, peça a ele."
        />
      </Pagina>
    )
  }

  const papelAtual = papeis.find((p) => p.chave === escolhido) ?? null

  return (
    <Pagina
      acima="Configurações"
      titulo="Acessos"
      sub="Uma linha por página do sistema, quatro níveis por papel. Cada caixa grava na hora."
      acoes={
        <Botao tom="forte" onClick={() => setForma({ chave: '', nome: '', linha: '' })}>
          <UserPlus size={17} />
          Novo papel
        </Botao>
      }
    >
      <AbasDaConfig atual="acessos" />

      {falha ? (
        <Vazio titulo="Não consegui ler os acessos" texto={falha} />
      ) : carregando ? (
        <Cartao>
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </Cartao>
      ) : (
        <>
          <div className="ac-kpis">
            <Kpi rotulo="Páginas que ele abre" valor={conta.paginas} sub={`de ${paginas.length}`} />
            <Kpi rotulo="Onde ele edita" valor={conta.editam} sub="mexe no que tem dentro" />
            <Kpi rotulo="Onde ele apaga" valor={conta.apagam} sub="a mais perigosa" aviso={conta.apagam > 0} />
            <Kpi rotulo="Controle total" valor={conta.totais} sub="sem freio nenhum" aviso={conta.totais > 0} />
            <Kpi rotulo="Ações que ele faz" valor={conta.acoes} sub={`de ${acoes.length}`} />
          </div>

          <div className="ac-mesa">
            <Cartao className="ac-papeis">
              <TituloCartao>Papéis</TituloCartao>
              <div className="ac-lista">
                {papeis.map((p) => {
                  const quantas = Object.values(matriz[p.chave] ?? {}).filter((l) => l.ver).length
                  return (
                    <button
                      key={p.chave}
                      type="button"
                      className={p.chave === escolhido ? 'ac-item escolhido' : 'ac-item'}
                      onClick={() => {
                        setEscolhido(p.chave)
                        setForma(null)
                        setApagando('')
                      }}
                    >
                      <span className="ac-item-topo">
                        <b>{p.nome}</b>
                        <small className="ac-conta">
                          {quantas} de {paginas.length}
                        </small>
                      </span>
                      <small className="ac-chave">{p.chave}</small>
                    </button>
                  )
                })}
              </div>

              {forma ? (
                <div className="ac-forma">
                  <Campo rotulo="Nome que aparece na tela">
                    <Entrada
                      value={forma.nome}
                      placeholder="Diretor de produção"
                      onChange={(e) => {
                        const nome = e.currentTarget.value
                        setForma((f) =>
                          f
                            ? { ...f, nome, chave: f.chave && papeis.some((p) => p.chave === f.chave) ? f.chave : chaveLimpa(nome) }
                            : f,
                        )
                      }}
                    />
                  </Campo>
                  <Campo rotulo="Chave no banco" dica="Minúscula, sem acento e sem espaço. É o que vai para a coluna papel.">
                    <Entrada
                      value={forma.chave}
                      placeholder="diretor"
                      onChange={(e) => setForma((f) => (f ? { ...f, chave: e.currentTarget.value } : f))}
                    />
                  </Campo>
                  <Campo rotulo="Uma linha do que ele faz">
                    <Entrada
                      value={forma.linha}
                      placeholder="Aprova o pedido para a fábrica descer."
                      onChange={(e) => setForma((f) => (f ? { ...f, linha: e.currentTarget.value } : f))}
                    />
                  </Campo>
                  <div className="ac-botoes">
                    <Botao tom="forte" tamanho="sm" carregando={ocupado === 'forma'} onClick={() => void salvarForma()}>
                      Salvar
                    </Botao>
                    <Botao tom="limpo" tamanho="sm" onClick={() => setForma(null)}>
                      Cancelar
                    </Botao>
                  </div>
                </div>
              ) : apagando ? (
                <div className="ac-perigo">
                  <p>Apagar o papel {papeis.find((p) => p.chave === apagando)?.nome}? Os acessos dele somem junto.</p>
                  <div className="ac-botoes">
                    <Botao tom="primario" tamanho="sm" carregando={ocupado === 'apagar'} onClick={() => void confirmarApagar()}>
                      <Trash size={16} />
                      Apagar
                    </Botao>
                    <Botao tom="limpo" tamanho="sm" onClick={() => setApagando('')}>
                      Cancelar
                    </Botao>
                  </div>
                </div>
              ) : papelAtual ? (
                <div className="ac-forma">
                  <p className="ac-linha">{papelAtual.linha || 'Sem descrição.'}</p>
                  <div className="ac-botoes">
                    <Botao
                      tamanho="sm"
                      onClick={() =>
                        setForma({ chave: papelAtual.chave, nome: papelAtual.nome, linha: papelAtual.linha })
                      }
                    >
                      Renomear
                    </Botao>
                    {papelAtual.fixo ? (
                      <Selo tom="info">
                        <ShieldCheck size={14} />
                        não se apaga
                      </Selo>
                    ) : (
                      <Botao tom="limpo" tamanho="sm" onClick={() => setApagando(papelAtual.chave)}>
                        Apagar
                      </Botao>
                    )}
                  </div>
                </div>
              ) : null}
            </Cartao>

            <Cartao className="ac-quadro">
              <TituloCartao>
                {papelAtual ? `O que o ${papelAtual.nome.toLowerCase()} pode` : 'Permissões'}
              </TituloCartao>

              {!papelAtual ? (
                <Vazio titulo="Nenhum papel" texto="Crie um papel para começar a marcar." />
              ) : (
                <>
                <p className="ac-legenda">
                  V ver · E editar · D deletar · T controle total
                </p>
                <table className="ac-grade">
                  <thead>
                    <tr>
                      <th>Página</th>
                      {NIVEIS.map((n) => (
                        <th key={n} className="ac-cel">
                          <span className="ac-largo">{NOME_DO_NIVEL[n]}</span>
                          <span className="ac-curto">{LETRA_DO_NIVEL[n]}</span>
                        </th>
                      ))}
                    </tr>
                    <tr className="ac-tudo">
                      <th>
                        <span className="ac-largo">marcar a coluna inteira</span>
                        <span className="ac-curto">a coluna</span>
                      </th>
                      {NIVEIS.map((n) => (
                        <th key={n} className="ac-cel">
                          <Botao tom="limpo" tamanho="sm" disabled={!!ocupado} onClick={() => void colunaInteira(n)}>
                            tudo
                          </Botao>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g) => (
                      <GrupoDeLinhas
                        key={g.grupo}
                        grupo={g.grupo}
                        itens={g.itens}
                        papel={escolhido}
                        matriz={matriz}
                        ocupado={ocupado}
                        aoMexer={(painel, nivel, ligado) => void mexer(painel, nivel, ligado)}
                      />
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </Cartao>
          </div>

          {papelAtual ? (
            <Cartao className="ac-acoes">
              <TituloCartao>O que o {papelAtual.nome.toLowerCase()} pode fazer</TituloCartao>
              <p className="ac-legenda-acao">
                Isto não é página, é botão. Só entra aqui a ação que o banco já pergunta à
                matriz antes de deixar acontecer.
              </p>
              {gruposDeAcao.map((g) => (
                <section key={g.grupo} className="ac-bloco">
                  <h4 className="ac-grupo-acao">{g.grupo}</h4>
                  {g.itens.map((a) => {
                    /* Ação que mora numa página exige ENXERGAR a página. Marcar
                       aqui com a página fechada gravaria uma promessa que o
                       banco não cumpre, então a caixa trava e diz por quê. */
                    const semPagina = !!a.painel && !permissaoDe(matriz, escolhido, a.painel).ver
                    const ligado = podeAAcao(quemFaz, escolhido, a.chave)
                    return (
                      <label key={a.chave} className={semPagina ? 'ac-acao travada' : 'ac-acao'}>
                        <Marcacao
                          checked={ligado && !semPagina}
                          disabled={semPagina || !!ocupado}
                          aria-label={a.nome}
                          onChange={(e) => void mexerNaAcao(a, e.currentTarget.checked)}
                        />
                        <span className="pilha colada">
                          <b>{a.nome}</b>
                          <small className="ac-apoio">
                            {semPagina
                              ? `Precisa enxergar a página ${nomeDaPagina(paginas, a.painel)}.`
                              : a.linha || a.chave}
                          </small>
                        </span>
                      </label>
                    )
                  })}
                </section>
              ))}
            </Cartao>
          ) : null}

          <p className="ac-rodape">
            <Prohibit size={15} />
            Não existe deletar sem ver: marcar um nível acende os de baixo, e o banco recusa o
            contrário. Por enquanto a matriz manda no menu, nas rotas e nos botões; as regras de
            acesso do próprio banco continuam com a lista de papéis escrita à mão, e vão ser
            trocadas uma por uma.
          </p>
        </>
      )}
    </Pagina>
  )
}

function GrupoDeLinhas({
  grupo,
  itens,
  papel,
  matriz,
  ocupado,
  aoMexer,
}: {
  grupo: string
  itens: PainelDoSistema[]
  papel: string
  matriz: Matriz
  ocupado: string
  aoMexer: (painel: string, nivel: Nivel, ligado: boolean) => void
}) {
  return (
    <>
      <tr className="ac-grupo">
        <td colSpan={5}>{grupo}</td>
      </tr>
      {itens.map((p) => {
        const c = permissaoDe(matriz, papel, p.chave)
        return (
          <tr key={p.chave} className={c.total ? 'ac-linha-total' : undefined}>
            <td className="ac-pagina">
              <span className="ac-nome">
                {p.nome}
                <small className="ac-chave">{p.chave}</small>
              </span>
            </td>
            {NIVEIS.map((n) => (
              <td key={n} className={n === 'total' ? 'ac-cel ac-cel-total' : 'ac-cel'}>
                <Marcacao
                  checked={c[n]}
                  disabled={ocupado === 'coluna'}
                  aria-label={`${NOME_DO_NIVEL[n]} ${p.nome}`}
                  onChange={(e) => aoMexer(p.chave, n, e.currentTarget.checked)}
                />
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}
