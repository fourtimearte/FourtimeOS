import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ClipboardText,
  FloppyDisk,
  ListChecks,
  Plus,
  PlusCircle,
  TShirt,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import {
  AreaTexto,
  Botao,
  Busca,
  Campo,
  Chip,
  ChipTecnica,
  Entrada,
  LINHA_ESCOLHIDA,
  Modal,
  Pagina,
  Seletor,
  TituloCartao,
  avisar,
} from '@ds'
import { apagarReferencia } from '@dominio/banco'
import {
  A_PECA_INTEIRA,
  DETALHES,
  ETIQUETAS,
  NOME_DA_ETIQUETA,
  NOME_DA_TECNICA,
  NOME_DO_GENERO,
  PAPEIS,
  TECNICAS,
  carregarFicha,
  casaComABusca,
  codigoCurto,
  codigoDoKit,
  gradeDoKit,
  gradeEmPalavras,
  kitParaOBanco,
  pecaNova,
  pendenciasDoKit,
  salvarKit,
  salvarMolde,
  type EtiquetaDoKit,
  type Kit,
  type KitNaLista,
  type PecaDoKit,
  type ReferenciaNaFicha,
  type TecidoDeConta,
  type TecnicaDoKit,
} from '@dominio/produto'
import { plural } from './apoio'
import { DesenhoDoMolde, SoltarOMolde, usarArquivoDoMolde } from './molde'

/* ==========================================================================
   O editor da ficha do kit (prancha 61). Toma a página inteira, em três
   colunas: as peças, a ficha de fabricação da peça escolhida, e o resumo com
   o que falta.

   SERVE PARA O KIT NOVO E PARA O QUE EXISTE. No novo as peças entram e saem,
   e o código vai se formando com o código delas. No que existe as peças estão
   travadas: o código é feito delas, e código não muda.

   GOLA, MANGA, PUNHO, BARRA E COSTURA NÃO SE EDITAM AQUI. São da referência,
   e aparecem para quem está montando o kit ver o que a peça já diz. O que se
   edita é o que é do kit: o papel, os tecidos de cada parte, o design
   impresso, a etiqueta e a observação.

   MAIS DE UM TECIDO NA MESMA PEÇA: "Tecidos da peça" é uma lista de parte do
   molde e tecido, e cada parte usa um tecido só. As partes são as que a ficha
   da referência tem; enquanto ela não tiver, dá para dizer "a peça inteira".
   ========================================================================== */

/** o que já existe com um código, para o kit novo não nascer repetido */
type DonoDoCodigo = { cod: string; nome: string }

export function EditorDoKit({
  kit,
  pecasIniciais,
  desenhoInicial,
  referencias,
  existentes,
  tecidos,
  podeExcluir,
  aoSair,
  aoSalvou,
  aoExcluiu,
}: {
  /** nulo: kit novo */
  kit: KitNaLista | null
  pecasIniciais: PecaDoKit[]
  desenhoInicial: string | null
  /** as referências de peça (sem os kits), para adicionar ao kit novo e ler as partes do molde */
  referencias: ReferenciaNaFicha[]
  existentes: DonoDoCodigo[]
  tecidos: TecidoDeConta[]
  podeExcluir: boolean
  aoSair: () => void
  aoSalvou: (id: string) => Promise<void>
  aoExcluiu: () => Promise<void>
}) {
  const [rasc, setRasc] = useState<Kit>(() => ({
    nome: kit?.nome ?? '',
    pecas: pecasIniciais.map(p => ({
      ...p,
      tecidos: p.tecidos.map(t => ({ ...t })),
      design: p.design.map(d => ({ ...d })),
    })),
  }))
  const [inicial] = useState(() => JSON.stringify(kitParaOBanco(rasc)))
  const [escolhida, setEscolhida] = useState(0)
  /* indefinido: ninguém mexeu no desenho. Texto: o SVG novo, que sobe no Salvar. */
  const [desenhoNovo, setDesenhoNovo] = useState<string | undefined>(undefined)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [saindo, setSaindo] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [apagando, setApagando] = useState(false)
  /* as partes de pano do molde de cada referência, lidas da ficha dela */
  const [partesDe, setPartesDe] = useState<Record<string, string[]>>({})

  const arquivo = usarArquivoDoMolde(setDesenhoNovo)
  const desenho = desenhoNovo ?? desenhoInicial
  const novo = !kit
  const sujo = JSON.stringify(kitParaOBanco(rasc)) !== inicial || desenhoNovo !== undefined

  useEffect(() => {
    if (!sujo) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  /* as partes do molde de cada peça que entrou: é com elas que se diz que tecido vai onde */
  const idsDasPecas = rasc.pecas.map(p => p.referenciaId).join(',')
  useEffect(() => {
    let vivo = true
    for (const id of idsDasPecas ? idsDasPecas.split(',') : []) {
      if (partesDe[id]) continue
      const r = referencias.find(x => x.id === id)
      if (!r) continue
      carregarFicha(r)
        .then(f => {
          if (vivo)
            setPartesDe(atual => ({
              ...atual,
              [id]: f.partes.filter(p => p.unidade === 'm2').map(p => p.nome),
            }))
        })
        .catch(() => {
          /* sem as partes, a peça inteira continua sendo uma escolha */
          if (vivo) setPartesDe(atual => ({ ...atual, [id]: [] }))
        })
    }
    return () => {
      vivo = false
    }
    /* as partes já lidas não precisam ler de novo */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsDasPecas, referencias])

  const mudarNome = (nome: string) => {
    setRasc(atual => ({ ...atual, nome }))
    setErro('')
  }
  const mudarPeca = (i: number, troca: Partial<PecaDoKit>) => {
    setRasc(atual => ({ ...atual, pecas: atual.pecas.map((p, k) => (k === i ? { ...p, ...troca } : p)) }))
    setErro('')
  }

  const codNovo = codigoDoKit(rasc.pecas.map(p => p.cod))
  const cod = kit ? kit.cod : codNovo
  const dono = novo && codNovo ? existentes.find(x => x.cod === codNovo) : undefined
  const grade = gradeDoKit(rasc.pecas)
  const pendencias = useMemo(() => {
    const lista = pendenciasDoKit(rasc, !!desenho)
    if (dono)
      lista.unshift({
        impede: true,
        deQuem: '',
        texto: `Já existe um kit com estas peças, nesta ordem: ${dono.nome}.`,
      })
    return lista
  }, [rasc, desenho, dono])
  const impedem = pendencias.filter(p => p.impede)
  const faltam = pendencias.filter(p => !p.impede)

  const peca = rasc.pecas[Math.min(escolhida, rasc.pecas.length - 1)] as PecaDoKit | undefined
  const iDaPeca = peca ? rasc.pecas.indexOf(peca) : -1
  const pendenciasDe = (p: PecaDoKit) =>
    pendencias.filter(x => x.deQuem && x.deQuem === (p.papel.trim() || p.nome)).length

  /* --- as peças do kit novo --- */
  const achadas =
    novo && busca.trim()
      ? referencias
          .filter(r => r.cod && !rasc.pecas.some(p => p.referenciaId === r.id) && casaComABusca(r, busca))
          .slice(0, 6)
      : []
  function adicionar(r: ReferenciaNaFicha) {
    if (rasc.pecas.length >= 6) {
      avisar('O kit leva até 6 peças.', 'info')
      return
    }
    setRasc(atual => ({ ...atual, pecas: [...atual.pecas, pecaNova(r, atual.pecas.length)] }))
    setEscolhida(rasc.pecas.length)
    setBusca('')
    setErro('')
  }
  function tirar(i: number) {
    setRasc(atual => ({ ...atual, pecas: atual.pecas.filter((_, k) => k !== i) }))
    setEscolhida(e => Math.max(0, e > i ? e - 1 : Math.min(e, rasc.pecas.length - 2)))
    setErro('')
  }

  /* --- a ficha da peça escolhida --- */
  const partesDaPeca = peca ? (partesDe[peca.referenciaId] ?? []) : []
  /** as partes que ainda podem ganhar tecido nesta linha: as livres e a que ela já tem */
  function partesPara(linha: number) {
    if (!peca) return []
    const usadas = peca.tecidos.filter((_, k) => k !== linha).map(t => t.parte.trim().toLowerCase())
    return [A_PECA_INTEIRA, ...partesDaPeca].filter(n => !usadas.includes(n.toLowerCase()))
  }
  function mudarTecido(linha: number, troca: { parte?: string; tecidoId?: string }) {
    if (!peca) return
    mudarPeca(iDaPeca, {
      tecidos: peca.tecidos.map((t, k) => {
        if (k !== linha) return t
        const tecidoId = troca.tecidoId ?? t.tecidoId
        return {
          parte: troca.parte ?? t.parte,
          tecidoId,
          tecido: tecidos.find(x => x.id === tecidoId)?.nome ?? '',
        }
      }),
    })
  }
  function virarTecnica(t: TecnicaDoKit) {
    if (!peca) return
    const tem = peca.design.some(d => d.tecnica === t)
    mudarPeca(iDaPeca, {
      design: tem
        ? peca.design.filter(d => d.tecnica !== t)
        : /* na ordem da lista, e não na ordem do clique */
          TECNICAS.filter(x => x.chave === t || peca.design.some(d => d.tecnica === x.chave)).map(
            x => peca.design.find(d => d.tecnica === x.chave) ?? { tecnica: x.chave, onde: '' },
          ),
    })
  }
  function escolherEtiqueta(e: Exclude<EtiquetaDoKit, ''>) {
    if (!peca) return
    mudarPeca(iDaPeca, {
      etiqueta: peca.etiqueta === e ? '' : e,
      etiquetaOnde: e === 'sem' ? '' : peca.etiquetaOnde,
    })
  }

  /* --- salvar, sair, excluir --- */
  async function salvar() {
    if (impedem.length) {
      setErro(impedem.map(p => (p.deQuem ? p.deQuem + ': ' : '') + p.texto).join(' '))
      return
    }
    setSalvando(true)
    setErro('')
    let id: string
    try {
      id = await salvarKit(kit?.id ?? null, rasc)
    } catch (e) {
      setSalvando(false)
      setErro(e instanceof Error ? e.message : 'Não consegui salvar o kit.')
      return
    }
    if (desenhoNovo !== undefined) {
      try {
        await salvarMolde(id, desenhoNovo)
      } catch (e) {
        avisar(
          'O kit foi salvo, mas o desenho não: ' + (e instanceof Error ? e.message : 'tente enviar o SVG de novo.'),
          'warn',
          9,
        )
      }
    }
    avisar(novo ? rasc.nome.trim() + ' criado.' : 'Kit salvo.', 'ok')
    try {
      await aoSalvou(id)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!kit) return
    setApagando(true)
    try {
      await apagarReferencia(kit.id)
      avisar(kit.nome + ' foi excluído.', 'ok')
      await aoExcluiu()
    } catch (e) {
      setExcluindo(false)
      setErro(e instanceof Error ? e.message : 'Não consegui excluir o kit.')
    } finally {
      setApagando(false)
    }
  }

  const tecnicasDoKit = [...new Set(rasc.pecas.flatMap(p => p.design.map(d => d.tecnica)))]
  const etiquetasDoKit = [...new Set(rasc.pecas.map(p => p.etiqueta).filter(Boolean))]
  const tecidosDoKit = new Set(rasc.pecas.flatMap(p => p.tecidos.map(t => t.tecidoId)).filter(Boolean))

  return (
    <Pagina
      acima="Fichas técnicas · Kits"
      titulo={novo ? 'Novo kit' : 'Editor da ficha do kit'}
      sub={
        <>
          {rasc.nome.trim() || 'kit sem nome'} · {plural(rasc.pecas.length, 'peça', 'peças')}
          {pendencias.length ? (
            <>
              {' · '}
              <b className="pd-pouco">{plural(pendencias.length, 'pendência', 'pendências')}</b>
            </>
          ) : null}
        </>
      }
      acoes={
        <>
          <Botao onClick={() => (sujo ? setSaindo(true) : aoSair())} disabled={salvando}>
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar
          </Botao>
          {kit && podeExcluir ? (
            <Botao onClick={() => setExcluindo(true)} disabled={salvando}>
              <Trash size={16} aria-hidden="true" />
              Excluir o kit
            </Botao>
          ) : null}
          <Botao tom="primario" carregando={salvando} onClick={() => void salvar()}>
            {novo ? 'Criar o kit' : 'Salvar o kit'}
          </Botao>
        </>
      }
    >
      <div className="pd-palco">
        <div className="pd-editor-kit" data-editor-do-kit={novo ? 'novo' : 'existe'}>
          {/* ---- as peças ---- */}
          <div className="pd-pilha">
            <section className="cartao pd-col" data-cartao="pecas-do-kit">
              <div className="pd-topo">
                <TituloCartao icone={TShirt}>Peças do kit</TituloCartao>
                <span className="pd-topo-n">{plural(rasc.pecas.length, 'peça', 'peças')}</span>
              </div>
              {rasc.pecas.map((p, i) => {
                const n = pendenciasDe(p)
                return (
                  <div className={i === iDaPeca ? 'pd-peca on ' + LINHA_ESCOLHIDA : 'pd-peca'} key={p.referenciaId} data-peca={codigoCurto(p.cod)}>
                    <button
                      type="button"
                      className="pd-peca-nome"
                      aria-pressed={i === iDaPeca}
                      onClick={() => setEscolhida(i)}
                    >
                      <span className="pd-papel">{p.papel || 'Peça'}</span>
                      <b>{p.nome}</b>
                      <small>
                        {codigoCurto(p.cod)}
                        {n ? ' · ' + plural(n, 'pendência', 'pendências') : ''}
                      </small>
                    </button>
                    {novo ? (
                      <Botao
                        tom="limpo"
                        tamanho="sm"
                        icone
                        className="pd-peca-tira"
                        aria-label={'Tirar ' + p.nome + ' do kit'}
                        onClick={() => tirar(i)}
                      >
                        <X size={16} aria-hidden="true" />
                      </Botao>
                    ) : null}
                  </div>
                )
              })}
              {!rasc.pecas.length ? (
                <div className="pd-corpo">
                  <p className="pd-nota">Nenhuma peça ainda. Busque a referência aqui embaixo e toque nela.</p>
                </div>
              ) : null}
              {!novo ? (
                <div className="pd-corpo pd-rodape">
                  <p className="pd-nota">
                    As peças não mudam depois que o kit é criado: o código dele é feito delas. Para outras
                    peças, crie outro kit.
                  </p>
                </div>
              ) : null}
            </section>

            {novo ? (
              <section className="cartao pd-col" data-cartao="adicionar-peca">
                <div className="pd-topo">
                  <TituloCartao icone={PlusCircle}>Adicionar peça</TituloCartao>
                </div>
                <div className="pd-corpo">
                  <Busca
                    value={busca}
                    onChange={e => setBusca(e.currentTarget.value)}
                    placeholder="Buscar referência"
                    aria-label="Buscar referência"
                  />
                </div>
                {achadas.map(r => (
                  <button type="button" className="pd-lin" key={r.id} onClick={() => adicionar(r)}>
                    <span className="pd-txt">
                      <b>{r.nome}</b>
                      <small>
                        {codigoCurto(r.cod)}
                        {NOME_DO_GENERO[r.genero] ? ' · ' + NOME_DO_GENERO[r.genero] : ''}
                      </small>
                    </span>
                    <span className="pd-val">
                      <Plus size={16} aria-hidden="true" />
                    </span>
                  </button>
                ))}
                <div className="pd-corpo">
                  <p className="pd-nota">
                    {busca.trim() && !achadas.length
                      ? 'Nenhuma referência com esse nome, ou ela já está no kit.'
                      : 'Só entram referências que já existem. Peça nova nasce antes em Nova referência. A ordem em que as peças entram é a ordem do código.'}
                  </p>
                </div>
              </section>
            ) : null}
          </div>

          {/* ---- a ficha de fabricação da peça escolhida ---- */}
          {peca ? (
            <section className="cartao pd-col" data-cartao="fabricacao-da-peca" key={peca.referenciaId}>
              <div className="pd-topo quebra">
                <TituloCartao icone={ClipboardText}>
                  Ficha de fabricação da {(peca.papel || 'peça').toLowerCase()}
                </TituloCartao>
                <span className="pd-topo-nome">{peca.nome}</span>
              </div>
              <div className="pd-corpo">
                <div className="pd-form">
                  <div className="pd-campo">
                    <span className="pd-campo-topo">Papel no kit</span>
                    <Seletor
                      campo
                      bloco
                      valor={peca.papel}
                      vazio="Sem papel"
                      opcoes={[...new Set([...PAPEIS, peca.papel].filter(Boolean))].map(p => ({
                        valor: p,
                        rotulo: p,
                      }))}
                      aoEscolher={papel => mudarPeca(iDaPeca, { papel })}
                    />
                  </div>
                </div>

                <div className="pd-campo" data-tecidos-da-peca="">
                  <span className="pd-campo-topo">
                    Tecidos da peça{' '}
                    <small>
                      {peca.tecidos.length
                        ? plural(peca.tecidos.length, 'tecido', 'tecidos') + ' · pode ter quantos precisar'
                        : 'nenhum ainda'}
                    </small>
                  </span>
                  {peca.tecidos.length ? (
                    <div className="pd-tecido-cab" aria-hidden="true">
                      <span>Parte do molde</span>
                      <span>Tecido</span>
                    </div>
                  ) : null}
                  {peca.tecidos.map((t, k) => (
                    <div className="pd-tecido-lin" key={k}>
                      <Seletor
                        campo
                        bloco
                        valor={t.parte}
                        vazio="Escolha a parte"
                        opcoes={[...new Set([...partesPara(k), t.parte].filter(Boolean))].map(n => ({
                          valor: n,
                          rotulo: n,
                        }))}
                        aoEscolher={parte => mudarTecido(k, { parte })}
                      />
                      <Seletor
                        campo
                        bloco
                        comBusca
                        valor={t.tecidoId}
                        vazio="Escolha o tecido"
                        opcoes={tecidos.map(x => ({ valor: x.id, rotulo: x.nome }))}
                        aoEscolher={tecidoId => mudarTecido(k, { tecidoId })}
                      />
                      <Botao
                        tom="limpo"
                        icone
                        aria-label="Tirar este tecido"
                        onClick={() => mudarPeca(iDaPeca, { tecidos: peca.tecidos.filter((_, x) => x !== k) })}
                      >
                        <Trash size={16} aria-hidden="true" />
                      </Botao>
                    </div>
                  ))}
                  <div className="fileira">
                    <Botao
                      tamanho="sm"
                      /* sem parte livre não há onde pôr outro tecido: cada parte usa um só */
                      disabled={partesPara(-1).length === 0}
                      onClick={() =>
                        mudarPeca(iDaPeca, {
                          tecidos: [
                            ...peca.tecidos,
                            /* o primeiro tecido já nasce como a peça inteira, que é o caso comum */
                            { parte: peca.tecidos.length ? '' : A_PECA_INTEIRA, tecidoId: '', tecido: '' },
                          ],
                        })
                      }
                    >
                      <Plus size={14} aria-hidden="true" />
                      Tecido
                    </Botao>
                  </div>
                  <span className="pd-nota">
                    {partesDaPeca.length
                      ? 'As partes são as do molde da referência, e cada parte usa um tecido só. A cor de cada tecido é escolhida no orçamento.'
                      : 'A ficha desta referência ainda não tem as partes do molde: por enquanto só dá para dizer o tecido da peça inteira. A cor de cada tecido é escolhida no orçamento.'}
                  </span>
                </div>

                <div className="pd-campo" data-da-referencia="">
                  <span className="pd-campo-topo">
                    Da ficha da referência <small>muda lá, e não aqui</small>
                  </span>
                  <dl className="pd-linhas">
                    {DETALHES.map(d => (
                      <div key={d.chave}>
                        <dt>{d.nome}</dt>
                        <dd>
                          {peca.detalhes[d.chave] ? (
                            <b>{peca.detalhes[d.chave]}</b>
                          ) : (
                            <span className="pd-vago">não informado</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="pd-campo" data-design="">
                  <span className="pd-campo-topo">
                    Design impresso <small>pode marcar mais de um</small>
                  </span>
                  <div className="pd-chips-soltos">
                    {TECNICAS.map(t => (
                      <Chip
                        key={t.chave}
                        ligado={peca.design.some(d => d.tecnica === t.chave)}
                        aria-pressed={peca.design.some(d => d.tecnica === t.chave)}
                        onClick={() => virarTecnica(t.chave)}
                      >
                        {t.nome}
                      </Chip>
                    ))}
                  </div>
                </div>
                {peca.design.length ? (
                  <div className="pd-campo" data-onde-vai="">
                    <span className="pd-campo-topo">Onde vai cada um</span>
                    {peca.design.map(d => (
                      <div className="pd-onde" key={d.tecnica}>
                        <ChipTecnica tecnica={d.tecnica}>{NOME_DA_TECNICA[d.tecnica]}</ChipTecnica>
                        <Entrada
                          tamanho="sm"
                          value={d.onde}
                          maxLength={120}
                          placeholder="onde vai na peça"
                          aria-label={'Onde vai ' + NOME_DA_TECNICA[d.tecnica]}
                          onChange={e =>
                            mudarPeca(iDaPeca, {
                              design: peca.design.map(x =>
                                x.tecnica === d.tecnica ? { ...x, onde: e.currentTarget.value } : x,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="pd-campo" data-etiqueta="">
                  <span className="pd-campo-topo">
                    Etiqueta <small>o padrão do kit</small>
                  </span>
                  <div className="pd-chips-soltos">
                    {ETIQUETAS.map(e => (
                      <Chip
                        key={e.chave}
                        ligado={peca.etiqueta === e.chave}
                        aria-pressed={peca.etiqueta === e.chave}
                        onClick={() => escolherEtiqueta(e.chave)}
                      >
                        {e.nome}
                      </Chip>
                    ))}
                  </div>
                  {peca.etiqueta && peca.etiqueta !== 'sem' ? (
                    <Entrada
                      tamanho="sm"
                      value={peca.etiquetaOnde}
                      maxLength={120}
                      placeholder="onde vai a etiqueta"
                      aria-label="Onde vai a etiqueta"
                      onChange={e => mudarPeca(iDaPeca, { etiquetaOnde: e.currentTarget.value })}
                    />
                  ) : null}
                  <span className="pd-nota">No orçamento dá para trocar pelo que o cliente pedir.</span>
                </div>

                <Campo rotulo="Observação para a fábrica">
                  <AreaTexto
                    rows={3}
                    value={peca.observacao}
                    maxLength={2000}
                    onChange={e => mudarPeca(iDaPeca, { observacao: e.currentTarget.value })}
                  />
                </Campo>
              </div>
            </section>
          ) : (
            <section className="cartao pd-col pd-quadro" data-cartao="fabricacao-da-peca">
              <div className="pd-topo">
                <TituloCartao icone={ClipboardText}>Ficha de fabricação</TituloCartao>
              </div>
              <div className="pd-corpo">
                <p className="pd-nota">
                  Adicione a primeira peça ao lado. A ficha de fabricação dela aparece aqui: os tecidos de
                  cada parte, o design impresso, a etiqueta e a observação para a fábrica.
                </p>
              </div>
            </section>
          )}

          {/* ---- o resumo e o que falta ---- */}
          <div className="pd-pilha">
            <section className="cartao pd-col" data-cartao="resumo">
              <div className="pd-topo">
                <TituloCartao icone={ListChecks}>Resumo do kit</TituloCartao>
                {desenhoNovo !== undefined ? <span className="pd-topo-n">sobe ao salvar</span> : null}
              </div>
              <div className="pd-corpo">
                {desenho ? <DesenhoDoMolde svg={desenho} nome={rasc.nome || 'kit'} rotulo="Desenho do kit" /> : null}
                <SoltarOMolde
                  arquivo={arquivo}
                  baixa
                  texto={desenho ? 'Para trocar o desenho, solte aqui outro SVG, ou' : 'Solte aqui o SVG do kit, ou'}
                />
                {arquivo.campo}
                <Campo rotulo="Nome do kit">
                  <Entrada
                    value={rasc.nome}
                    maxLength={120}
                    placeholder="KIT CAMISETA TRAD E CALÇAO"
                    onChange={e => mudarNome(e.currentTarget.value)}
                  />
                </Campo>
                <dl className="pd-resumo">
                  <dt>Código</dt>
                  <dd data-codigo-do-kit="">{cod ? codigoCurto(cod) : 'nasce com duas peças'}</dd>
                  <dt>Peças</dt>
                  <dd>{rasc.pecas.length}</dd>
                  <dt>Grade</dt>
                  <dd>
                    {!rasc.pecas.length ? 'sem peça' : grade.length ? gradeEmPalavras(grade) : 'sem tamanho em comum'}
                  </dd>
                  <dt>Tecidos</dt>
                  <dd>
                    {tecidosDoKit.size
                      ? plural(tecidosDoKit.size, 'tecido', 'diferentes')
                      : 'nenhum escolhido'}
                  </dd>
                  <dt>Design impresso</dt>
                  <dd>
                    {tecnicasDoKit.length
                      ? TECNICAS.filter(t => tecnicasDoKit.includes(t.chave))
                          .map(t => t.nome)
                          .join(', ')
                      : 'nenhum'}
                  </dd>
                  <dt>Etiqueta</dt>
                  <dd>
                    {etiquetasDoKit.length
                      ? etiquetasDoKit.map(e => NOME_DA_ETIQUETA[e]).join(', ')
                      : 'não escolhida'}
                  </dd>
                </dl>
              </div>
            </section>

            <section className="cartao pd-col" data-cartao="para-salvar">
              <div className="pd-topo">
                <TituloCartao icone={FloppyDisk}>Para salvar</TituloCartao>
                {pendencias.length ? (
                  <span className="pd-topo-n pd-pouco">{plural(pendencias.length, 'pendência', 'pendências')}</span>
                ) : null}
              </div>
              <div className="pd-corpo">
                {erro ? (
                  <div className="pd-pendencia" role="alert">
                    <WarningCircle size={18} aria-hidden="true" />
                    <span>{erro}</span>
                  </div>
                ) : null}
                {impedem.map((p, i) => (
                  <div className="pd-pendencia" key={'i' + i} data-impede="">
                    <WarningCircle size={18} aria-hidden="true" />
                    <span>
                      {p.deQuem ? <b>{p.deQuem}: </b> : null}
                      {p.texto}
                    </span>
                  </div>
                ))}
                {faltam.length ? (
                  <ul className="pd-faltas" data-ainda-falta="">
                    {faltam.map((p, i) => (
                      <li key={'f' + i}>
                        {p.deQuem ? <b>{p.deQuem}: </b> : null}
                        {p.texto}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="pd-nota">
                  {!pendencias.length
                    ? 'Não falta nada. '
                    : !impedem.length
                      ? 'Dá para salvar assim e completar depois. '
                      : ''}
                  O código é montado sozinho com o código das peças. A grade do kit é a que todas as peças
                  têm em comum.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Modal
        aberto={saindo}
        aoFechar={() => setSaindo(false)}
        titulo="Sair sem salvar?"
        pe={
          <>
            <Botao onClick={() => setSaindo(false)}>Continuar editando</Botao>
            <Botao tom="perigo" onClick={aoSair}>
              Descartar as mudanças
            </Botao>
          </>
        }
      >
        <p className="pd-nota">
          O kit tem mudança que ainda não foi salva. Se sair agora, o que foi feito aqui se perde.
        </p>
      </Modal>
      <Modal
        aberto={excluindo}
        aoFechar={() => setExcluindo(false)}
        titulo={'Excluir ' + (kit?.nome ?? 'o kit') + '?'}
        pe={
          <>
            <Botao onClick={() => setExcluindo(false)} disabled={apagando}>
              Manter
            </Botao>
            <Botao tom="perigo" carregando={apagando} onClick={() => void excluir()}>
              Excluir
            </Botao>
          </>
        }
      >
        <p className="pd-nota">
          O kit sai das listas, com a ficha de fabricação e o desenho dele. As referências que são as
          peças continuam como estão. Isso não volta atrás. Os orçamentos que já foram feitos continuam
          como estão.
        </p>
      </Modal>
    </Pagina>
  )
}
