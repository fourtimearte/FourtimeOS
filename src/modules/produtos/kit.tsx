import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ClipboardText, Image, Needle, PencilSimple, Printer, Scroll, TShirt, X } from '@phosphor-icons/react'
import { Botao, ChipTecnica, Esqueleto, TituloCartao, Vazio, avisar } from '@ds'
import {
  DETALHES,
  NOME_DA_ETIQUETA,
  NOME_DA_TECNICA,
  NOME_DO_GENERO,
  aviamentosDoKit,
  carregarFicha,
  carregarMolde,
  carregarPecasDoKit,
  casasDaArea,
  codigoCurto,
  emArea,
  gradeDoKit,
  gradeEmPalavras,
  paraOCampo,
  salvarMolde,
  tecidoDoKit,
  type KitNaLista,
  type PecaComFicha,
  type PecaDoKit,
  type ReferenciaNaFicha,
  type TecidoDoKit,
} from '@dominio/produto'
import { LARGURA_DA_TABELA_DEITADA, plural, usarLargura } from './apoio'
import { GradePorTamanho } from './grade'
import { CartaoDoMolde } from './molde'

/* ==========================================================================
   A ficha de um kit: o lado direito da página, com a aba Kits.

   O KIT É FEITO DAS FICHAS DAS PEÇAS. O tecido de um kit e os aviamentos de
   um kit não são digitados em lugar nenhum: são a soma da ficha de cada
   referência, tecido por tecido. Por isso a ficha do kit lê, além das peças,
   a ficha de cada uma.

   A FICHA DE FABRICAÇÃO É UMA TABELA, com uma coluna por peça. A gola, a
   manga, o punho, a barra e a costura vêm da referência; os tecidos, o design
   impresso e a etiqueta são do kit.
   ========================================================================== */

const NAO_INFORMADO = <span className="pd-vago">não informado</span>

/** O que a ficha do kit carrega de uma vez, e o editor reaproveita. */
export type KitCarregado = {
  pecas: PecaDoKit[]
  /** a ficha de cada peça, na mesma ordem: as partes do molde e os aviamentos */
  fichas: PecaComFicha[]
  desenho: string | null
}

export async function carregarKitInteiro(
  kit: KitNaLista,
  referencias: ReferenciaNaFicha[],
): Promise<KitCarregado> {
  const [pecas, desenho] = await Promise.all([carregarPecasDoKit(kit.id), carregarMolde(kit.id)])
  const fichas = await Promise.all(
    pecas.map(async (p): Promise<PecaComFicha> => {
      const r = referencias.find(x => x.id === p.referenciaId)
      const f = r ? await carregarFicha(r) : null
      return {
        papel: p.papel,
        nome: p.nome,
        tecidos: p.tecidos,
        partes: f?.partes ?? [],
        materiais: f?.materiais ?? [],
      }
    }),
  )
  return { pecas, fichas, desenho }
}

/** A etiqueta de uma peça do kit, como a ficha mostra. */
function Etiqueta({ p }: { p: PecaDoKit }) {
  if (!p.etiqueta) return <span className="pd-vago">não escolhida</span>
  if (p.etiqueta === 'sem') return <>Sem etiqueta</>
  return (
    <>
      <span className="pd-tecnicas">
        <ChipTecnica tecnica={p.etiqueta}>{NOME_DA_ETIQUETA[p.etiqueta]}</ChipTecnica>
      </span>
      {p.etiquetaOnde ? <small>{p.etiquetaOnde}</small> : null}
    </>
  )
}

/* O tecido de um kit. É um cartão à parte, e não um pedaço da ficha, porque
   ele mede a própria largura para decidir se a tabela deita ou fica em pé, e
   só dá para medir o que já está na tela: dentro da ficha, a medida seria
   tirada enquanto o kit ainda está sendo lido, e daria zero. */
function TecidoDeUmKit({ tecidos, grade }: { tecidos: TecidoDoKit[]; grade: string[] }) {
  const caixa = useRef<HTMLElement>(null)
  const emPe = usarLargura(caixa) < LARGURA_DA_TABELA_DEITADA
  /* só há o que mostrar quando algum tamanho de algum tecido tem número */
  const temNumero = grade.length > 0 && tecidos.some(t => t.areas.some(a => a !== null))
  return (
    <section className="cartao pd-col" data-cartao="tecido-do-kit" ref={caixa}>
      <div className="pd-topo">
        <TituloCartao icone={Scroll}>Tecido de um kit, em cada tamanho</TituloCartao>
      </div>
      {temNumero ? (
        <GradePorTamanho
          primeira="Tecido, em m²"
          tamanhos={grade}
          linhas={tecidos.map(t => {
            const casas = casasDaArea(t.areas)
            return {
              chave: t.tecidoId,
              nome: t.tecido || 'tecido que saiu do catálogo',
              apoio: t.onde,
              valores: t.areas.map(a => emArea(a, casas)),
            }
          })}
          emPe={emPe}
          rotulo="Tecido de um kit, em cada tamanho"
        />
      ) : null}
      <div className="pd-corpo">
        <p className="pd-nota">
          {temNumero
            ? 'O kit não tem número próprio: ele soma a ficha de cada peça, tecido por tecido, em m² e já com a perda do corte. Mudou a referência, mudou aqui também. Tamanho com ponto é tamanho em que nenhuma parte daquele tecido foi medida na ficha da referência.'
            : !tecidos.length
              ? 'Ainda não dá para somar o tecido deste kit: falta escolher o tecido de cada peça, no Editar a ficha.'
              : 'Ainda não dá para somar o tecido deste kit: o tecido já foi escolhido, mas falta medir o tecido (a área de cada parte do molde) na ficha de cada referência.'}
        </p>
      </div>
    </section>
  )
}

export function FichaDoKit({
  kit,
  referencias,
  celular,
  podeEditar,
  aoEditar,
  aoImprimir,
  aoAbrirReferencia,
  aoMudou,
  aoFechar,
}: {
  kit: KitNaLista
  referencias: ReferenciaNaFicha[]
  celular: boolean
  podeEditar: boolean
  aoEditar: (carregado: KitCarregado) => void
  /** a folha impressa toma a página, com o que a ficha já leu */
  aoImprimir: (carregado: KitCarregado) => void
  aoAbrirReferencia: (id: string) => void
  /** o desenho mudou no banco: a lista precisa reler a linha deste kit */
  aoMudou: () => Promise<void>
  aoFechar: () => void
}) {
  const [dado, setDado] = useState<KitCarregado | null>(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const ler = useCallback(async () => {
    setErro('')
    try {
      setDado(await carregarKitInteiro(kit, referencias))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler o kit.')
    }
    /* só o kit decide quando ler de novo */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit.id, kit.fichaEm])

  useEffect(() => {
    setDado(null)
    void ler()
  }, [ler])

  async function trocarDesenho(svg: string) {
    setEnviando(true)
    try {
      await salvarMolde(kit.id, svg)
      setDado(atual => (atual ? { ...atual, desenho: svg } : atual))
      await aoMudou()
      avisar('Desenho do kit trocado.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui guardar o desenho.', 'warn', 7)
    } finally {
      setEnviando(false)
    }
  }

  if (erro) {
    return (
      <section className="cartao pd-quadro">
        <Vazio
          titulo="Não consegui ler o kit"
          texto={erro}
          acao={<Botao onClick={() => void ler()}>Tentar de novo</Botao>}
        />
      </section>
    )
  }
  if (!dado) {
    return (
      <section className="cartao pd-quadro" aria-busy="true">
        <div className="pd-espera">
          <Esqueleto altura={22} largura="40%" />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </div>
      </section>
    )
  }

  const { pecas, fichas, desenho } = dado
  const grade = gradeDoKit(pecas)
  const tecidos = tecidoDoKit(fichas, grade)
  const aviamentos = aviamentosDoKit(fichas)

  return (
    <div className="pd-ficha" data-ficha="kit">
      <div className="pd-ficha-topo">
        <div className="pd-ficha-nome">
          <div className="pd-trilha">
            <span className="pd-cod">KIT</span>
            Kits
            <span aria-hidden="true">›</span>
            {plural(pecas.length, 'peça', 'peças')}
          </div>
          <h2>{kit.nome}</h2>
          <p>
            {codigoCurto(kit.cod) || 'sem código'}
            {NOME_DO_GENERO[kit.genero] ? ' · ' + NOME_DO_GENERO[kit.genero] : ''}
            {pecas.length ? ' · ' + (grade.length ? gradeEmPalavras(grade) : 'as peças não têm tamanho em comum') : ''}
          </p>
        </div>
        <div className="fileira">
          {celular ? (
            <Botao onClick={aoFechar}>
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar
            </Botao>
          ) : null}
          {podeEditar && pecas.length ? (
            <Botao onClick={() => aoEditar(dado)}>
              <PencilSimple size={16} aria-hidden="true" />
              Editar a ficha
            </Botao>
          ) : null}
          {pecas.length ? (
            <Botao onClick={() => aoImprimir(dado)}>
              <Printer size={16} aria-hidden="true" />
              Imprimir
            </Botao>
          ) : null}
          {celular ? null : (
            <Botao onClick={aoFechar}>
              <X size={16} aria-hidden="true" />
              Fechar
            </Botao>
          )}
        </div>
      </div>

      {!pecas.length ? (
        <section className="cartao pd-quadro" data-kit-sem-pecas="">
          <Vazio
            titulo="Este kit está sem as peças"
            texto="Ele veio do catálogo antigo, e o código dele não diz de que referências é feito. Crie um kit novo com as peças certas, e exclua este em Configurações, Banco de dados, Referências."
          />
        </section>
      ) : (
        <>
          <div className="pd-dois largo-estreito">
            <CartaoDoMolde
              titulo="Desenho do kit"
              icone={Image}
              nome={kit.nome}
              svg={desenho}
              partes={[]}
              podeEditar={podeEditar}
              enviando={enviando}
              aoTrocar={svg => void trocarDesenho(svg)}
              vazio="Este kit ainda não tem desenho."
              soltar="Solte aqui o SVG do kit, ou"
              nota="Um SVG do kit inteiro, tirado do Affinity."
            />
            <section className="cartao pd-col" data-cartao="pecas">
              <div className="pd-topo">
                <TituloCartao icone={TShirt}>Peças do kit</TituloCartao>
                <span className="pd-topo-n">{plural(pecas.length, 'peça', 'peças')}</span>
              </div>
              {pecas.map(p => (
                <div className="pd-lin" key={p.referenciaId} data-peca={codigoCurto(p.cod)}>
                  <span className="pd-txt">
                    {p.papel ? <small className="pd-papel">{p.papel}</small> : null}
                    <b>{p.nome}</b>
                    <small>
                      {codigoCurto(p.cod)}
                      {NOME_DO_GENERO[p.genero] ? ' · ' + NOME_DO_GENERO[p.genero] : ''}
                    </small>
                  </span>
                  <Botao tom="limpo" tamanho="sm" onClick={() => aoAbrirReferencia(p.referenciaId)}>
                    Abrir
                    <ArrowRight size={14} aria-hidden="true" />
                  </Botao>
                </div>
              ))}
            </section>
          </div>

          <section className="cartao pd-col" data-cartao="fabricacao">
            <div className="pd-topo">
              <TituloCartao icone={ClipboardText}>Ficha de fabricação</TituloCartao>
            </div>
            <div className="pd-grade-rola">
              <table className="pd-fab" style={{ minWidth: 200 + pecas.length * 220 }}>
                <thead>
                  <tr>
                    <th scope="col">Característica</th>
                    {pecas.map(p => (
                      <th scope="col" key={p.referenciaId}>
                        {p.papel || 'Peça'}
                        <b>{p.nome}</b>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr data-linha="tecidos">
                    <th scope="row">Tecidos</th>
                    {pecas.map(p => (
                      <td key={p.referenciaId}>
                        {p.tecidos.length
                          ? p.tecidos.map(t => (
                              <span className="pd-pano" key={t.parte}>
                                {t.tecido || 'tecido que saiu do catálogo'}
                                <small>{t.parte.toLowerCase()}</small>
                              </span>
                            ))
                          : <span className="pd-vago">não escolhido</span>}
                      </td>
                    ))}
                  </tr>
                  {DETALHES.map(d => (
                    <tr key={d.chave} data-linha={d.chave}>
                      <th scope="row">{d.nome}</th>
                      {pecas.map(p => (
                        <td key={p.referenciaId}>{p.detalhes[d.chave] || NAO_INFORMADO}</td>
                      ))}
                    </tr>
                  ))}
                  <tr data-linha="design">
                    <th scope="row">Design impresso</th>
                    {pecas.map(p => (
                      <td key={p.referenciaId}>
                        {p.design.length ? (
                          <>
                            <span className="pd-tecnicas">
                              {p.design.map(d => (
                                <ChipTecnica tecnica={d.tecnica} key={d.tecnica}>
                                  {NOME_DA_TECNICA[d.tecnica]}
                                </ChipTecnica>
                              ))}
                            </span>
                            {p.design.some(d => d.onde) ? (
                              <small>
                                {p.design
                                  .filter(d => d.onde)
                                  .map(d => NOME_DA_TECNICA[d.tecnica].toLowerCase() + ': ' + d.onde)
                                  .join('; ')}
                              </small>
                            ) : null}
                          </>
                        ) : (
                          <span className="pd-vago">nenhum</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr data-linha="etiqueta">
                    <th scope="row">Etiqueta</th>
                    {pecas.map(p => (
                      <td key={p.referenciaId}>
                        <Etiqueta p={p} />
                      </td>
                    ))}
                  </tr>
                  {pecas.some(p => p.observacao) ? (
                    <tr data-linha="observacao">
                      <th scope="row">Observação</th>
                      {pecas.map(p => (
                        <td key={p.referenciaId} className="pd-texto">
                          {p.observacao || <span className="pd-vago">nenhuma</span>}
                        </td>
                      ))}
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="pd-corpo pd-rodape">
              <p className="pd-nota">
                Gola, manga, punho, barra e costura vêm da ficha de cada referência. A etiqueta é o padrão
                do kit: no orçamento ela pode ser trocada pelo que o cliente pedir (silk, DTF ou
                sublimação).
              </p>
            </div>
          </section>

          <TecidoDeUmKit tecidos={tecidos} grade={grade} />

          <section className="cartao pd-col" data-cartao="aviamentos-do-kit">
            <div className="pd-topo">
              <TituloCartao icone={Needle}>Aviamentos e insumos de um kit</TituloCartao>
            </div>
            {aviamentos.length ? (
              aviamentos.map(a => (
                <div className="pd-lin" key={a.nome + a.unidade}>
                  <span className="pd-txt">
                    <b>{a.nome}</b>
                    <small>{a.deQuem}</small>
                  </span>
                  <span className="pd-val">
                    {paraOCampo(a.quantidade)} {a.unidade}
                    <small>por kit</small>
                  </span>
                </div>
              ))
            ) : (
              <div className="pd-corpo">
                <p className="pd-nota">
                  Nenhuma peça deste kit tem aviamento na ficha. Eles entram na ficha de cada referência.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
