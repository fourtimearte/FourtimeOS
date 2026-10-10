import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, DotsSixVertical, Factory, FloppyDisk, Plus, Scales, Trash } from '@phosphor-icons/react'
import { AreaTexto, avisar, Aviso, Botao, Esqueleto, Interruptor, Pagina, TituloCartao } from '@ds'
import { useSessao } from '@dominio/sessao'
import {
  carregarInformesDaCasa,
  GRUPOS_DO_INFORME,
  idNovo,
  mudancasDosInformes,
  naOrdem,
  NOME_DO_GRUPO,
  salvarInformesDaCasa,
  vazios,
  type GrupoDoInforme,
  type InformeDaCasa,
  type OndeMoramOsInformes,
} from '@dominio/cotacao'
import './cotacao.css'

/* ==========================================================================
   A PÁGINA INFORMES E TERMOS (prancha 123b, aprovada em 11/10/2026).

   Os textos que toda cotação nova traz na página 1 da folha, nos dois grupos
   da folha: "Sobre a produção" (coluna da esquerda, nas duas folhas) e
   "Termos" (coluna da direita, só na folha com valor). Cada linha tem a alça
   da ordem, o texto, o "Nasce marcado" e a lixeira; cada grupo tem o seu
   Adicionar. Abre pela engrenagem do editor.

   Ela trabalha num rascunho e só grava no Salvar. Mudar aqui não mexe nas
   cotações já feitas: cada uma guardou a sua cópia quando nasceu.

   Só o administrador e o gerente mexem (a regra mora no banco, na 060); os
   outros veem a lista sem poder mudar.
   ========================================================================== */

const ICONE = { producao: Factory, termos: Scales }
const ONDE_SAI: Record<GrupoDoInforme, string> = {
  producao: 'coluna da esquerda, nas duas folhas',
  termos: 'coluna da direita, só na folha com valor',
}
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function TelaInformesDaCasa() {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const de = params.get('de') ?? ''
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const chefia = !!pessoa && (pessoa.papel === 'admin' || pessoa.papel === 'gerente')

  const [salvo, setSalvo] = useState<InformeDaCasa[]>([])
  const [rasc, setRasc] = useState<InformeDaCasa[]>([])
  const [onde, setOnde] = useState<OndeMoramOsInformes>('banco')
  const [falha, setFalha] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [gravando, setGravando] = useState(false)
  const [sairSemSalvar, setSairSemSalvar] = useState(false)

  useEffect(() => {
    let vivo = true
    carregarInformesDaCasa().then((r) => {
      if (!vivo) return
      setSalvo(r.lista)
      setRasc(r.lista)
      setOnde(r.onde)
      setFalha(r.falha)
      setCarregando(false)
    })
    return () => {
      vivo = false
    }
  }, [])

  const mudou = mudancasDosInformes(salvo, rasc)
  const podeMexer = chefia && onde === 'banco' && !falha

  useEffect(() => {
    if (!mudou) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [mudou])

  function voltar() {
    if (mudou && !sairSemSalvar) {
      setSairSemSalvar(true)
      avisar('Há mudanças sem salvar. Clique de novo em Voltar para sair sem salvar.', 'warn')
      return
    }
    navegar(de ? '/cotacao/' + de : '/cotacao')
  }

  async function salvar() {
    if (gravando || !mudou) return
    if (vazios(rasc)) {
      avisar('Há texto em branco. Escreva ou apague antes de salvar.', 'warn')
      return
    }
    setGravando(true)
    try {
      const nova = await salvarInformesDaCasa(salvo, rasc)
      setSalvo(nova)
      setRasc(nova)
      setSairSemSalvar(false)
      avisar('Informes e termos salvos. Valem para as cotações novas.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar os informes', 'warn')
    } finally {
      setGravando(false)
    }
  }

  const mudarUm = (id: string, troca: (x: InformeDaCasa) => InformeDaCasa) =>
    setRasc((l) => l.map((x) => (x.id === id ? troca(x) : x)))

  function adicionar(g: GrupoDoInforme) {
    const novo: InformeDaCasa = { id: idNovo(), grupo: g, texto: '', nasceMarcado: true }
    setRasc((l) => naOrdem([...l, novo]))
    focoNoTexto.current = novo.id
  }

  /* o texto novo já nasce com o cursor dentro */
  const focoNoTexto = useRef<string | null>(null)
  useEffect(() => {
    if (!focoNoTexto.current) return
    const campo = document.querySelector<HTMLTextAreaElement>(`[data-informe="${focoNoTexto.current}"] textarea`)
    focoNoTexto.current = null
    campo?.focus()
  })

  /* PELO TECLADO, a alça sobe e desce a linha dentro do grupo e continua com
     o foco: senão a segunda seta não acha ninguém */
  const focoNaAlca = useRef<string | null>(null)
  useEffect(() => {
    if (!focoNaAlca.current) return
    const alca = document.querySelector<HTMLButtonElement>(`[data-informe="${focoNaAlca.current}"] .ct-ic-pega`)
    focoNaAlca.current = null
    if (alca && document.activeElement !== alca) alca.focus()
  })
  function mover(id: string, passo: number) {
    setRasc((l) => {
      const x = l.find((i) => i.id === id)
      if (!x) return l
      const grupo = l.filter((i) => i.grupo === x.grupo)
      const de = grupo.indexOf(x)
      const para = de + passo
      if (para < 0 || para >= grupo.length) return l
      grupo.splice(de, 1)
      grupo.splice(para, 0, x)
      return naOrdem([...l.filter((i) => i.grupo !== x.grupo), ...grupo])
    })
    focoNaAlca.current = id
  }

  /* O ARRASTO PELA ALÇA, igual ao das listas de detalhe: enquanto o ponteiro
     passa por cima de outra linha do mesmo grupo, o texto vai para o lugar
     dela. Quem ouve o movimento é a janela, porque a linha que muda de lugar
     perde o ponteiro. */
  const [presa, setPresa] = useState<string | null>(null)
  const largar = useRef<(() => void) | null>(null)
  useEffect(() => () => largar.current?.(), [])
  function pegar(e: PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return
    largar.current?.()
    setPresa(id)
    const aoMover = (ev: globalThis.PointerEvent) => {
      const alvo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-informe]')
      const sobre = alvo?.dataset.informe
      if (!sobre || sobre === id) return
      setRasc((l) => {
        const x = l.find((i) => i.id === id)
        const y = l.find((i) => i.id === sobre)
        if (!x || !y || x.grupo !== y.grupo) return l
        const grupo = l.filter((i) => i.grupo === x.grupo)
        const de = grupo.indexOf(x)
        const para = grupo.indexOf(y)
        grupo.splice(de, 1)
        grupo.splice(para, 0, x)
        return naOrdem([...l.filter((i) => i.grupo !== x.grupo), ...grupo])
      })
    }
    const aoLargar = () => {
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoLargar)
      window.removeEventListener('pointercancel', aoLargar)
      largar.current = null
      setPresa(null)
    }
    largar.current = aoLargar
    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoLargar)
    window.addEventListener('pointercancel', aoLargar)
  }

  return (
    <Pagina
      acima={
        <button type="button" className="ct-ic-volta" onClick={voltar}>
          {de ? 'Voltar ao editor' : 'Voltar às cotações'}
        </button>
      }
      titulo="Informes e termos"
      sub="Os textos que toda cotação nova traz, na página 1 da folha. Só o administrador e o gerente mexem."
      acoes={
        <>
          <Botao tom="contorno" onClick={voltar}>
            <ArrowLeft size={17} />
            {de ? 'Voltar ao editor' : 'Voltar às cotações'}
          </Botao>
          {chefia ? (
            <Botao tom="primario" disabled={!podeMexer || !mudou || gravando} onClick={() => void salvar()}>
              <FloppyDisk size={17} />
              {gravando ? 'Salvando...' : mudou ? 'Salvar' : 'Salvo'}
            </Botao>
          ) : null}
        </>
      }
    >
      {carregando ? (
        <Esqueleto altura={420} />
      ) : (
        <>
          {falha ? (
            <Aviso tom="warn" titulo="Não consegui ler os informes da casa">
              {falha}
            </Aviso>
          ) : onde === 'codigo' ? (
            <Aviso tom="warn" titulo="A tabela dos informes ainda não existe no banco">
              Falta rodar a migração 060. Até lá, as cotações novas nascem com a lista de sempre, que é esta, e a
              página não salva.
            </Aviso>
          ) : (
            <Aviso tom="info" titulo="Vale para as cotações novas.">
              Cada cotação guarda a cópia dela: mudar ou apagar aqui não mexe no que já foi feito nem no que já foi
              enviado. Os marcados entram na folha; os desmarcados vêm junto, desligados.
              {chefia ? null : ' Só o administrador e o gerente mudam estes textos.'}
            </Aviso>
          )}

          <div className="ct-ic">
            {GRUPOS_DO_INFORME.map((g) => {
              const lista = rasc.filter((x) => x.grupo === g)
              const marcados = lista.filter((x) => x.nasceMarcado).length
              const ehProducao = g === 'producao'
              return (
                <section className="cartao ct-mc ct-ic-grupo" key={g} data-grupo={g}>
                  <header className="ct-mc-cab">
                    <TituloCartao icone={ICONE[g]}>{NOME_DO_GRUPO[g]}</TituloCartao>
                    <span className="ct-mc-apoio">
                      {plural(lista.length, ehProducao ? 'informe' : 'termo', ehProducao ? 'informes' : 'termos')} ·{' '}
                      {plural(marcados, 'nasce marcado', 'nascem marcados')} · {ONDE_SAI[g]}
                    </span>
                  </header>
                  <div className="ct-ic-lista">
                    {lista.length ? null : (
                      <p className="ct-nada ct-ic-nada">
                        {ehProducao ? 'Nenhum informe neste grupo.' : 'Nenhum termo neste grupo.'}
                      </p>
                    )}
                    {lista.map((x, n) => (
                      <div
                        key={x.id}
                        data-informe={x.id}
                        className={['ct-ic-linha', presa === x.id ? 'presa' : '', x.nasceMarcado ? '' : 'fora']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {podeMexer ? (
                          <button
                            type="button"
                            className="ct-ic-pega"
                            aria-label={'Mudar a ordem do texto ' + (n + 1) + '. Arraste, ou use as setas para cima e para baixo.'}
                            onPointerDown={(e) => pegar(e, x.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                mover(x.id, -1)
                              } else if (e.key === 'ArrowDown') {
                                e.preventDefault()
                                mover(x.id, 1)
                              }
                            }}
                          >
                            <DotsSixVertical size={16} weight="bold" aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="ct-ic-pega parada" aria-hidden="true">
                            {n + 1}
                          </span>
                        )}
                        <AreaTexto
                          rows={2}
                          value={x.texto}
                          maxLength={600}
                          readOnly={!podeMexer}
                          aria-label={'Texto ' + (n + 1) + ', ' + NOME_DO_GRUPO[g]}
                          placeholder={ehProducao ? 'Escreva o informe' : 'Escreva o termo'}
                          onChange={(e) => mudarUm(x.id, (i) => ({ ...i, texto: e.target.value }))}
                        />
                        <div className="ct-ic-lado">
                          {podeMexer ? (
                            <Interruptor
                              ligado={x.nasceMarcado}
                              nome={'Nasce marcado, texto ' + (n + 1)}
                              rotulo="Nasce marcado"
                              aoMudar={(v) => mudarUm(x.id, (i) => ({ ...i, nasceMarcado: v }))}
                            />
                          ) : (
                            <span className="ct-ic-lido">{x.nasceMarcado ? 'Nasce marcado' : 'Nasce desmarcado'}</span>
                          )}
                          {podeMexer ? (
                            <Botao
                              tom="limpo"
                              tamanho="sm"
                              icone
                              aria-label={'Apagar o texto ' + (n + 1)}
                              title="Apagar"
                              onClick={() => setRasc((l) => l.filter((i) => i.id !== x.id))}
                            >
                              <Trash size={16} aria-hidden="true" />
                            </Botao>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {podeMexer ? (
                    <footer className="ct-ic-pe">
                      <Botao tom="limpo" tamanho="sm" onClick={() => adicionar(g)}>
                        <Plus size={15} />
                        {ehProducao ? 'Adicionar informe' : 'Adicionar termo'}
                      </Botao>
                      <small>Arraste pela alça para mudar a ordem: é a ordem da folha.</small>
                    </footer>
                  ) : null}
                </section>
              )
            })}
          </div>
        </>
      )}
    </Pagina>
  )
}
