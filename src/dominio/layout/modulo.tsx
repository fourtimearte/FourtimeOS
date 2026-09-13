import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  AreaDeTextoRico,
  BolinhasDeGenero,
  FaixaDeCores,
  MenuCodigoDeCor,
  MenuCorDeTecido,
  MenuDeContexto,
  MenuReferencia,
  MenuTecido,
  MenuTecnica,
  type ItemDeContexto,
} from '@ds'
import {
  ABAS_DE_COR,
  CATEGORIAS,
  GRUPOS_DE_COR_DE_TECIDO,
  ORDEM_DAS_CATEGORIAS,
  REFERENCIAS,
  SECOES_DE_TECNICA,
  TIPOS_DE_TECIDO,
  TODAS_AS_TAGS,
  lancaCor,
  secaoDaTag,
  tecnicaDaTag,
} from './banco'
import type { Bloco, Design, TecidoDoBloco } from './bloco'
import './modulo.css'

/* ==========================================================================
   O módulo de layout, no arranjo do editor v3.375.

   Duas colunas de mesma largura. À esquerda a barra da referência e a arte;
   à direita a ficha técnica: a tabela de tamanhos, o cartão de tecido, o
   cartão de design e a observação.

   A arte é metade da largura porque é o que a produção olha primeiro, e a
   ficha é a outra metade porque é o que ela lê depois. Esse equilíbrio veio
   da v3.375 e não é decoração: com a arte pequena ninguém confere a estampa
   na tela, e com a ficha espremida o nome do tecido corta.

   Um módulo pode virar MÓDULO DE INFORMAÇÕES: aí ele é anexo, e não peça de
   produção. Tecido, design e tabela somem, porque como layout normal ele
   levava junto uma ficha inteira em branco que a fábrica lia como "alguém
   esqueceu de preencher". É um botão, e não um automatismo: a v3.328 tentou
   adivinhar pela imagem e atrapalhou justamente quem estava montando, porque
   a ordem natural é colar a arte primeiro e preencher olhando para ela.
   ========================================================================== */

const SEM_COR = { nome: 'sem cor', hex: '' }
const TECIDO_VAZIO: TecidoDoBloco = { nome: '', cor: SEM_COR.nome, hex: SEM_COR.hex }

export function ModuloDeLayout({
  bloco,
  aoMudar,
  arte,
  tabela,
  acoes,
  leitura,
  semValor,
}: {
  bloco: Bloco
  aoMudar: (b: Bloco) => void
  /** a caixa de imagem, que chega de fora porque quem guarda arquivo é o módulo de cima */
  arte: ReactNode
  /** a tabela de tamanhos, pelo mesmo motivo: o preço não é do bloco */
  tabela: ReactNode
  /** os botões do canto: informações, copiar e apagar */
  acoes?: ReactNode
  leitura?: boolean
  /** modo sem valor: a tabela encolhe e a ficha vira duas colunas */
  semValor?: boolean
}) {
  const [menu, setMenu] = useState('')
  const [ctx, setCtx] = useState<{ cabecalho: string; itens: ItemDeContexto[] } | null>(null)
  const [tagAberta, setTagAberta] = useState('')
  /* qual linha de tecido está com o menu aberto. Sem isso, abrir o menu da
     segunda linha escreveria na primeira, que foi o defeito de ter uma
     variável só quando o cartão passou a ter várias linhas. */
  const [linha, setLinha] = useState(0)

  const btRef = useRef<HTMLButtonElement>(null)
  const btDesign = useRef<HTMLButtonElement>(null)
  const ancoraSolta = useRef<HTMLElement | null>(null)

  const fechar = () => setMenu('')
  const tecidos = bloco.tecidos.length ? bloco.tecidos : [TECIDO_VAZIO]
  const marcadas = bloco.design.map((d) => d.tag)
  const info = bloco.informacoes === true

  function mudar(parte: Partial<Bloco>) {
    aoMudar({ ...bloco, ...parte })
  }

  function mudarTecido(i: number, parte: Partial<TecidoDoBloco>) {
    const lista = tecidos.map((t, k) => (k === i ? { ...t, ...parte } : t))
    mudar({ tecidos: lista })
  }

  function acrescentarTecido() {
    mudar({ tecidos: [...tecidos, { ...TECIDO_VAZIO }] })
  }

  function tirarTecido(i: number) {
    mudar({ tecidos: tecidos.filter((_, k) => k !== i) })
  }

  function mudarDesign(tag: string, troca: (d: Design) => Design) {
    mudar({ design: bloco.design.map((d) => (d.tag === tag ? troca(d) : d)) })
  }

  /* As técnicas valem ao FECHAR o menu. O que já tinha cor lançada mantém a
     cor: remarcar DTF sem querer não pode apagar seis códigos. */
  function aplicarTecnicas(novas: string[]) {
    const naOrdem = TODAS_AS_TAGS.filter((t) => novas.includes(t))
    mudar({
      design: naOrdem.map(
        (tag) =>
          bloco.design.find((d) => d.tag === tag) ?? { tag, tecnica: tecnicaDaTag(tag), cores: [] },
      ),
    })
  }

  function contextoDaPilula(el: HTMLElement, d: Design) {
    ancoraSolta.current = el
    const itens: ItemDeContexto[] = []
    if (lancaCor(d.tecnica)) {
      itens.push({
        rotulo: 'Abrir as cores',
        aoEscolher: () => {
          setTagAberta(d.tag)
          setMenu('codigo')
        },
      })
    }
    itens.push({
      rotulo: 'Remover a técnica e as cores',
      risco: true,
      aoEscolher: () => mudar({ design: bloco.design.filter((x) => x.tag !== d.tag) }),
    })
    setCtx({ cabecalho: d.tag, itens })
    setMenu('ctx')
  }

  function contextoDaCor(el: HTMLElement, d: Design, cod: string) {
    ancoraSolta.current = el
    setCtx({
      cabecalho: 'Cor ' + cod,
      itens: [
        {
          rotulo: 'Abrir a paleta',
          aoEscolher: () => {
            setTagAberta(d.tag)
            setMenu('codigo')
          },
        },
        {
          rotulo: 'Remover só esta cor',
          risco: true,
          aoEscolher: () =>
            mudarDesign(d.tag, (x) => ({ ...x, cores: x.cores.filter((c) => c.cod !== cod) })),
        },
      ],
    })
    setMenu('ctx')
  }

  const aberta = bloco.design.find((d) => d.tag === tagAberta)

  /* AS FILEIRAS DO CARTAO DE DESIGN, na regra da v3.375:

       1a  as etiquetas, todas juntas. Sem nenhuma, ela vira o convite
           "Etiqueta", porque a fileira existe sempre: é a primeira coisa
           que a produção procura no cartão.
       2a  uma fileira para cada técnica QUE TEM COR lançada, porque a
           bandeja de códigos precisa da largura inteira.
       3a  todas as técnicas sem cor juntas, lado a lado.
       4a  o acabamento fecha o cartão, e só existe se houver acabamento.

   Elas são fileiras de verdade, e não quebra de linha, porque entre uma e
   outra corre um filete e não há onde desenhá-lo numa quebra. */
  const fileiras = (() => {
    const naOrdem = TODAS_AS_TAGS.map((t) => bloco.design.find((d) => d.tag === t)).filter(
      (d): d is Design => !!d,
    )
    const lista: { chave: string; tipo: string; itens: Design[] }[] = [
      { chave: 'eti', tipo: 'eti', itens: naOrdem.filter((d) => secaoDaTag(d.tag) === 'etiqueta') },
    ]
    const tecnicas = naOrdem.filter((d) => secaoDaTag(d.tag) === 'tecnica')
    tecnicas
      .filter((d) => d.cores.length > 0)
      .forEach((d) => lista.push({ chave: 'cor:' + d.tag, tipo: 'cor', itens: [d] }))
    const semCor = tecnicas.filter((d) => d.cores.length === 0)
    if (semCor.length) lista.push({ chave: 'tec', tipo: 'tec', itens: semCor })
    const acab = naOrdem.filter((d) => secaoDaTag(d.tag) === 'acabamento')
    if (acab.length) lista.push({ chave: 'acab', tipo: 'acab', itens: acab })
    return lista
  })()

  return (
    <div className={info ? 'mod info' : 'mod'}>
      {/* ================= coluna da esquerda: referência e arte ============ */}
      <div className="mod-esq">
        <div className="mod-topo">
          <span className="mod-selo">L-{String(bloco.n).padStart(2, '0')}</span>

          <div className="mod-ref" data-genero={bloco.genero}>
            {/* O selo de informações é um PREFIXO, e não uma tampa. Na v3.328
                ele ficava POR CIMA do campo, com o texto digitado invisível
                por baixo: dava para escrever e não dava para ler. */}
            {info ? <span className="mod-info-selo">INFORMAÇÕES</span> : null}
            <button
              ref={btRef}
              type="button"
              className="mod-ref-bt"
              disabled={leitura}
              onClick={() => setMenu('ref')}
            >
              <span className="v">
                {bloco.referencia
                  ? bloco.referencia + '  ' + bloco.nomeDaReferencia
                  : info
                    ? 'do que se trata este anexo'
                    : 'Referência'}
              </span>
            </button>
            {/* A BOLINHA SÓ PINTA O CAMPO. Ela não mexe na grade de tamanhos,
                e isso é da v3.375: quem troca a grade é o botão dentro da
                tabela, e só ele. Gênero infantil e grade infantil são duas
                perguntas diferentes, e uma peça infantil pode muito bem ser
                vendida na grade adulta do mesmo pedido. */}
            {info ? null : (
              <BolinhasDeGenero genero={bloco.genero} aoEscolher={(g) => mudar({ genero: g })} />
            )}
          </div>

          {acoes}
        </div>

        <div className="mod-arte">{arte}</div>
      </div>

      {/* ================= coluna da direita: a ficha técnica ===============
          A ORDEM E O ARRANJO SÃO OS DA v3.375, e a razão é largura. Com valor
          a ficha é uma pilha: tecido, design, tabela e observação, cada um com
          a largura inteira da coluna. Quatro colunas de tabela (tamanho,
          peças, valor e total) não cabem em metade de meia coluna, e foi
          exatamente isso que aconteceu quando a tabela ficou ao lado dos
          cartões: a coluna do total sumia atrás de uma barra de rolagem.

          Sem valor a tabela perde duas colunas e sobra espaço: aí ela encosta
          à esquerda e os cartões ocupam o que ela deixou. */}
      <div className={semValor ? 'mod-ficha sem-valor' : 'mod-ficha'}>
        {info ? (
          <p className="mod-so-anexo">
            Módulo de informações. Ele é anexo do pedido, não peça de produção:
            não tem tecido, design nem grade, e não entra em soma nenhuma.
          </p>
        ) : (
          <>
            {/* --- tecido, uma linha por tecido --- */}
              <section className="mod-cartao mod-tec">
                <header>
                  <span>Tecido</span>
                  {leitura ? null : (
                    <button
                      type="button"
                      className="mod-add"
                      title="Acrescentar tecido"
                      aria-label="Acrescentar tecido"
                      onClick={acrescentarTecido}
                    >
                      <Mais />
                    </button>
                  )}
                </header>

                <div className="mod-tecidos">
                  {tecidos.map((t, i) => (
                    <TecidoNaLinha
                      key={i}
                      tecido={t}
                      leitura={leitura}
                      podeTirar={tecidos.length > 1}
                      aoAbrirTecido={(el) => {
                        ancoraSolta.current = el
                        setLinha(i)
                        setMenu('tecido')
                      }}
                      aoAbrirCor={(el) => {
                        ancoraSolta.current = el
                        setLinha(i)
                        setMenu('cor')
                      }}
                      aoTirar={() => tirarTecido(i)}
                    />
                  ))}
                </div>
              </section>

              {/* --- design: as técnicas e as cores lançadas nelas --- */}
              {leitura && bloco.design.length === 0 ? null : (
              <section className="mod-cartao mod-design">
                <header>
                  <span>Design</span>
                  {leitura ? null : (
                    <button
                      ref={btDesign}
                      type="button"
                      className="mod-add"
                      title="Marcar as técnicas"
                      aria-label="Marcar as técnicas"
                      onClick={() => setMenu('tecnica')}
                    >
                      <Mais />
                    </button>
                  )}
                </header>

                <div className="mod-faixas">
                  {fileiras.map((f) => (
                    <div className={'mod-fila mod-fila-' + f.tipo} key={f.chave}>
                      {f.itens.length ? (
                        f.itens.map((d) => (
                          <FaixaDeCores
                            key={d.tag}
                            tecnica={d.tecnica}
                            rotulo={d.tag}
                            cores={d.cores}
                            aoAdicionar={
                              leitura || !lancaCor(d.tecnica)
                                ? undefined
                                : (el) => {
                                    ancoraSolta.current = el
                                    setTagAberta(d.tag)
                                    setMenu('codigo')
                                  }
                            }
                            aoAbrirMenuDaPilula={
                              leitura ? undefined : (el) => contextoDaPilula(el, d)
                            }
                            aoAbrirMenuDaCor={
                              leitura ? undefined : (el, cod) => contextoDaCor(el, d, cod)
                            }
                          />
                        ))
                      ) : leitura ? null : (
                        /* o convite é para quem está preenchendo. Numa folha
                           impressa ele vira uma etiqueta que não existe */
                        <span className="mod-fila-ph">Etiqueta</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              )}

              <div className="mod-tabela">{tabela}</div>

              {/* --- a observação do layout --- */}
              <section className="mod-cartao mod-obs">
                {leitura && !bloco.observacao ? null : (
                  <AreaDeTextoRico
                    valor={bloco.observacao}
                    aoMudar={(html) => mudar({ observacao: html })}
                    convite="Observações do layout..."
                    leitura={leitura}
                  />
                )}
              </section>
          </>
        )}
      </div>

      {/* ================= os menus ========================================= */}
      <MenuReferencia
        aberto={menu === 'ref'}
        ancora={btRef}
        aoFechar={fechar}
        refs={REFERENCIAS}
        categorias={CATEGORIAS}
        ordem={ORDEM_DAS_CATEGORIAS}
        valor={bloco.referencia}
        aoEscolher={(r) =>
          mudar({
            referencia: r.cod,
            nomeDaReferencia: r.nome,
            genero: r.genero,
            faixa: r.genero === 'infantil' ? 'infantil' : 'adulto',
          })
        }
        aoCriar={(t) => mudar({ referencia: t, nomeDaReferencia: '', genero: '' })}
      />

      <MenuTecido
        aberto={menu === 'tecido'}
        ancora={ancoraSolta}
        aoFechar={fechar}
        tipos={TIPOS_DE_TECIDO}
        valor={tecidos[linha]?.nome ?? ''}
        aoEscolher={(nome) => mudarTecido(linha, { nome })}
        aoCriar={(nome) => mudarTecido(linha, { nome })}
      />

      <MenuCorDeTecido
        aberto={menu === 'cor'}
        ancora={ancoraSolta}
        aoFechar={fechar}
        grupos={GRUPOS_DE_COR_DE_TECIDO}
        valor={tecidos[linha]?.cor ?? ''}
        aoEscolher={(cor, hex) => mudarTecido(linha, { cor, hex })}
        aoLimpar={() => mudarTecido(linha, { cor: SEM_COR.nome, hex: SEM_COR.hex })}
      />

      <MenuTecnica
        aberto={menu === 'tecnica'}
        ancora={btDesign}
        aoFechar={fechar}
        secoes={SECOES_DE_TECNICA}
        marcadas={marcadas}
        aoAplicar={aplicarTecnicas}
      />

      <MenuCodigoDeCor
        aberto={menu === 'codigo'}
        ancora={ancoraSolta}
        aoFechar={fechar}
        abas={ABAS_DE_COR}
        noLayout={aberta?.cores.map((c) => c.cod) ?? []}
        aoAlternar={(cod, hex) =>
          mudarDesign(tagAberta, (d) => ({
            ...d,
            cores: d.cores.some((c) => c.cod === cod)
              ? d.cores.filter((c) => c.cod !== cod)
              : [...d.cores, { cod, hex }],
          }))
        }
      />

      <MenuDeContexto
        aberto={menu === 'ctx'}
        ancora={ancoraSolta}
        aoFechar={fechar}
        cabecalho={ctx?.cabecalho}
        itens={ctx?.itens ?? []}
      />
    </div>
  )
}

/* --- uma linha do cartão de tecido ---------------------------------------- */
function TecidoNaLinha({
  tecido,
  leitura,
  podeTirar,
  aoAbrirTecido,
  aoAbrirCor,
  aoTirar,
}: {
  tecido: TecidoDoBloco
  leitura?: boolean
  podeTirar: boolean
  aoAbrirTecido: (el: HTMLElement) => void
  aoAbrirCor: (el: HTMLElement) => void
  aoTirar: () => void
}) {
  /* O NOME DA COR É A SEGUNDA LINHA DO TECIDO, e não uma coluna ao lado.
     Em coluna, os dois nomes disputavam a mesma largura e os dois cortavam
     no meio: "Dry fit peletiz..." e "Azul marinho esc...". Empilhados, cada
     um tem a largura inteira do cartão, e a cor lida como legenda do tecido,
     que é o que ela é.

     O quadrado mora no canto direito e cobre as duas linhas: ele é do PAR,
     e não do nome da cor. O menos fica à esquerda dele porque apagar é o
     último gesto da linha, e o primeiro lugar onde o dedo não deve cair
     por acidente é em cima da cor. */
  return (
    <div className="mod-tec-linha">
      <button
        type="button"
        className="mod-tec-nome"
        disabled={leitura}
        onClick={(e) => aoAbrirTecido(e.currentTarget)}
      >
        {tecido.nome || (leitura ? '-' : 'Escolha o tecido')}
      </button>

      <button
        type="button"
        className="mod-tec-cor"
        disabled={leitura}
        title={tecido.cor || 'sem cor'}
        onClick={(e) => aoAbrirCor(e.currentTarget)}
      >
        <span>{tecido.cor || (leitura ? '-' : 'sem cor')}</span>
      </button>

      {leitura || !podeTirar ? null : (
        <button
          type="button"
          className="mod-tec-tirar"
          title="Tirar este tecido"
          aria-label="Tirar este tecido"
          onClick={aoTirar}
        >
          <Menos />
        </button>
      )}

      <button
        type="button"
        className="mod-tec-sw"
        disabled={leitura}
        title={'Cor do tecido: ' + (tecido.cor || 'sem cor')}
        aria-label={'Cor do tecido: ' + (tecido.cor || 'sem cor')}
        onClick={(e) => aoAbrirCor(e.currentTarget)}
      >
        <i
          className={tecido.hex ? 'mod-sw' : 'mod-sw vazia'}
          style={{ '--cor': tecido.hex } as CSSProperties}
        />
      </button>
    </div>
  )
}

function Mais() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function Menos() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
