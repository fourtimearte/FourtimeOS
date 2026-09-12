import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
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
  tecnicaDaTag,
} from './banco'
import type { Bloco, Design } from './bloco'
import { faixaDoTamanho } from './grade'
import './layout.css'

/* ==========================================================================
   A fileira do modulo, e as faixas de cor debaixo dela.

   Esta e a peca que a cotacao e a ficha de producao dividem. Ela recebe um
   bloco e devolve o bloco mudado: quem a usa nao precisa saber nada dos cinco
   menus, nem de qual tecnica lanca cor e qual nao lanca.

   Regra que veio do editor v3.375: escolher a referencia escolhe o genero
   junto, porque a ultima letra do codigo ja diz (M, F ou C). Quem quiser
   mudar depois clica na bolinha.
   ========================================================================== */

const SEM_COR = { nome: 'sem cor', hex: '' }

export function FileiraDoLayout({
  bloco,
  aoMudar,
}: {
  bloco: Bloco
  aoMudar: (b: Bloco) => void
}) {
  const [menu, setMenu] = useState('')
  const [ctx, setCtx] = useState<{ cabecalho: string; itens: ItemDeContexto[] } | null>(null)
  const [tagAberta, setTagAberta] = useState('')

  const btRef = useRef<HTMLButtonElement>(null)
  const btTecido = useRef<HTMLButtonElement>(null)
  const btCor = useRef<HTMLButtonElement>(null)
  const btDesign = useRef<HTMLButtonElement>(null)
  const ancoraSolta = useRef<HTMLElement | null>(null)

  const fechar = () => setMenu('')
  const tecido = bloco.tecidos[0] ?? { nome: '', cor: SEM_COR.nome, hex: SEM_COR.hex }
  const marcadas = bloco.design.map((d) => d.tag)

  function mudar(parte: Partial<Bloco>) {
    aoMudar({ ...bloco, ...parte })
  }

  function mudarDesign(tag: string, troca: (d: Design) => Design) {
    mudar({ design: bloco.design.map((d) => (d.tag === tag ? troca(d) : d)) })
  }

  /* As tecnicas valem ao FECHAR o menu. O que ja tinha cor lancada mantem a
     cor: remarcar DTF sem querer nao pode apagar seis codigos. */
  function aplicarTecnicas(novas: string[]) {
    const naOrdem = TODAS_AS_TAGS.filter((t) => novas.includes(t))
    mudar({
      design: naOrdem.map(
        (tag) =>
          bloco.design.find((d) => d.tag === tag) ?? {
            tag,
            tecnica: tecnicaDaTag(tag),
            cores: [],
          },
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

  return (
    <>
      <div className="lay-fileira">
        <div className="lay-combo" data-genero={bloco.genero}>
          <button ref={btRef} type="button" className="lay-bt" onClick={() => setMenu('ref')}>
            <span className="lb">REF</span>
            <span className="v">
              {bloco.referencia ? bloco.referencia + '  ' + bloco.nomeDaReferencia : 'escolher'}
            </span>
          </button>
          <BolinhasDeGenero
            genero={bloco.genero}
            aoEscolher={(g) =>
              mudar({ genero: g, faixa: g === 'infantil' ? 'infantil' : bloco.faixa })
            }
          />
        </div>

        <button ref={btTecido} type="button" className="lay-bt" onClick={() => setMenu('tecido')}>
          <span className="lb">TECIDO</span>
          <span className="v">{tecido.nome || 'escolher'}</span>
        </button>

        <button ref={btCor} type="button" className="lay-bt" onClick={() => setMenu('cor')}>
          <span className="qd" style={{ '--cor': tecido.hex } as CSSProperties} />
          <span className="v">{tecido.cor || 'sem cor'}</span>
        </button>

        <button ref={btDesign} type="button" className="lay-bt" onClick={() => setMenu('tecnica')}>
          <span className="lb">DESIGN</span>
          <span className="v">
            {marcadas.length ? marcadas.length + ' marcadas' : 'nenhuma'}
          </span>
        </button>
      </div>

      {bloco.design.length ? (
        <div className="lay-faixas">
          {bloco.design.map((d) => (
            <FaixaDeCores
              key={d.tag}
              tecnica={d.tecnica}
              rotulo={d.tag}
              cores={d.cores}
              aoAdicionar={
                lancaCor(d.tecnica)
                  ? (el) => {
                      ancoraSolta.current = el
                      setTagAberta(d.tag)
                      setMenu('codigo')
                    }
                  : undefined
              }
              aoAbrirMenuDaPilula={(el) => contextoDaPilula(el, d)}
              aoAbrirMenuDaCor={(el, cod) => contextoDaCor(el, d, cod)}
            />
          ))}
        </div>
      ) : null}

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
        ancora={btTecido}
        aoFechar={fechar}
        tipos={TIPOS_DE_TECIDO}
        valor={tecido.nome}
        aoEscolher={(nome) => mudar({ tecidos: [{ ...tecido, nome }] })}
        aoCriar={(nome) => mudar({ tecidos: [{ ...tecido, nome }] })}
      />

      <MenuCorDeTecido
        aberto={menu === 'cor'}
        ancora={btCor}
        aoFechar={fechar}
        grupos={GRUPOS_DE_COR_DE_TECIDO}
        valor={tecido.cor}
        aoEscolher={(cor, hex) => mudar({ tecidos: [{ ...tecido, cor, hex }] })}
        aoLimpar={() => mudar({ tecidos: [{ ...tecido, cor: SEM_COR.nome, hex: SEM_COR.hex }] })}
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
    </>
  )
}

/* A fileira sem menu nenhum, para a folha A4 e para a conferencia. */
export function FileiraEmLeitura({ bloco }: { bloco: Bloco }) {
  const tecido = bloco.tecidos[0]
  return (
    <div className="lay-leitura">
      <b>{bloco.referencia}</b>
      <span>{bloco.nomeDaReferencia}</span>
      {tecido?.nome ? <span className="sep">{tecido.nome}</span> : null}
      {tecido?.cor ? (
        <span className="sep">
          <span className="qd" style={{ '--cor': tecido.hex } as CSSProperties} />
          {tecido.cor}
        </span>
      ) : null}
    </div>
  )
}

/* Usada pela grade: um tamanho lancado fora da faixa do bloco precisa gritar. */
export const ehIntruso = (bloco: Bloco, tamanho: string) =>
  faixaDoTamanho(tamanho) !== bloco.faixa
