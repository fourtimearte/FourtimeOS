import { useMemo, useRef, useState } from 'react'
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
  type Referencia,
} from '../componentes/menus'
import type { Tecnica } from '../componentes/superficie'
import {
  CATS_ORDEM,
  CATS_REF,
  DTF_CORES,
  GRUPOS_DE_COR,
  refCategoria,
  refGenero,
  REFS,
  SB_CORES,
  TAG_ACABAMENTO,
  TAG_ETIQUETA,
  TAG_TECNICA,
  TIPOS_TECIDO,
} from './banco-de-exemplo'

/* o banco guarda a referencia como "codigo <traco> nome" numa linha so */
const SEPARADOR = /\s*\u2014\s*/

function lerReferencias(): Referencia[] {
  return REFS.map((linha) => {
    const [cod, ...resto] = linha.split(SEPARADOR)
    return {
      cod,
      nome: resto.join(' '),
      genero: refGenero(cod),
      categoria: refCategoria(cod),
    }
  })
}

const COR_DA_TECNICA: Record<string, string> = {
  DTF: 'var(--tec-dtf-vivo)',
  Subli: 'var(--tec-subli-vivo)',
  Silk: 'var(--tec-silk-vivo)',
  Patch: 'var(--tec-patch-vivo)',
  Bordado: 'var(--tec-bordado-vivo)',
  'Gola Tecido': 'var(--tec-gola-vivo)',
  Ribana: 'var(--tec-ribana-vivo)',
}

const TECNICA_DA_TAG: Record<string, Tecnica> = {
  DTF: 'dtf',
  Subli: 'subli',
  Silk: 'silk',
  Patch: 'patch',
  Bordado: 'bordado',
  'Gola Tecido': 'gola',
  Ribana: 'ribana',
}

type Cor = { cod: string; hex: string }

export function DemoMenusDoModulo() {
  const referencias = useMemo(lerReferencias, [])

  const [ref, setRef] = useState<Referencia | null>(referencias[0] ?? null)
  const [genero, setGenero] = useState('')
  const [tecido, setTecido] = useState('DRYFIT POLIESTER 100%')
  const [corTecido, setCorTecido] = useState<{ nome: string; hex: string }>({
    nome: 'Preto',
    hex: '#111111',
  })
  const [tecnicas, setTecnicas] = useState<string[]>(['DTF', 'Eti. Fourtime'])
  const [coresDtf, setCoresDtf] = useState<Cor[]>([
    { cod: '001', hex: '#FFFFFF' },
    { cod: '002', hex: '#202121' },
    { cod: '121', hex: '#8E44AD' },
  ])

  const [menu, setMenu] = useState('')
  const fechar = () => setMenu('')

  const btRef = useRef<HTMLButtonElement>(null)
  const btTecido = useRef<HTMLButtonElement>(null)
  const btCor = useRef<HTMLButtonElement>(null)
  const btTecnica = useRef<HTMLButtonElement>(null)
  const ancoraSolta = useRef<HTMLElement | null>(null)

  const [ctx, setCtx] = useState<{ cabecalho: string; itens: ItemDeContexto[] } | null>(null)

  function abrirContextoDaPilula(el: HTMLElement) {
    ancoraSolta.current = el
    setCtx({
      cabecalho: 'DTF',
      itens: [
        {
          rotulo: 'Abrir as cores',
          aoEscolher: () => {
            ancoraSolta.current = el
            setMenu('codigo')
          },
        },
        {
          rotulo: 'Remover a técnica e as cores',
          risco: true,
          aoEscolher: () => {
            setTecnicas((t) => t.filter((x) => x !== 'DTF'))
            setCoresDtf([])
          },
        },
      ],
    })
    setMenu('ctx')
  }

  function abrirContextoDaCor(el: HTMLElement, cod: string) {
    ancoraSolta.current = el
    setCtx({
      cabecalho: 'Cor ' + cod,
      itens: [
        {
          rotulo: 'Abrir a paleta',
          aoEscolher: () => {
            ancoraSolta.current = el
            setMenu('codigo')
          },
        },
        {
          rotulo: 'Remover só esta cor',
          risco: true,
          aoEscolher: () => setCoresDtf((c) => c.filter((x) => x.cod !== cod)),
        },
      ],
    })
    setMenu('ctx')
  }

  const secoes = [
    {
      titulo: 'Etiqueta',
      itens: TAG_ETIQUETA.map((n) => ({ nome: n, cor: 'var(--brand)' })),
    },
    {
      titulo: 'Tipo de impressão',
      itens: TAG_TECNICA.map((n) => ({ nome: n, cor: COR_DA_TECNICA[n] })),
    },
    {
      titulo: 'Acabamento',
      itens: TAG_ACABAMENTO.map((n) => ({ nome: n, cor: COR_DA_TECNICA[n] })),
    },
  ]

  return (
    <>
      <div className="kit-bancada">
        <span className="kit-nota">A fileira do módulo, como ela aparece no editor</span>

        <div className="lay-combo" data-genero={genero}>
          <button ref={btRef} type="button" className="lay-bt" onClick={() => setMenu('ref')}>
            <span className="lb">REF</span>
            <span className="v">{ref ? ref.cod + '  ' + ref.nome : 'escolher'}</span>
          </button>
          <BolinhasDeGenero genero={genero} aoEscolher={setGenero} />
        </div>

        <button ref={btTecido} type="button" className="lay-bt" onClick={() => setMenu('tecido')}>
          <span className="lb">TECIDO</span>
          <span className="v">{tecido}</span>
        </button>

        <button ref={btCor} type="button" className="lay-bt" onClick={() => setMenu('cor')}>
          <span className="qd" style={{ '--cor': corTecido.hex } as CSSProperties} />
          <span className="v">{corTecido.nome}</span>
        </button>

        <button ref={btTecnica} type="button" className="lay-bt" onClick={() => setMenu('tecnica')}>
          <span className="lb">DESIGN</span>
          <span className="v">{tecnicas.length} marcadas</span>
        </button>
      </div>

      <div className="kit-bancada coluna">
        <span className="kit-nota">
          A faixa C1: o mais abre as cores, o botão direito na pílula ou na cor apaga
        </span>
        {tecnicas.includes('DTF') ? (
          <FaixaDeCores
            tecnica="dtf"
            rotulo="DTF"
            cores={coresDtf}
            aoAdicionar={(el) => {
              ancoraSolta.current = el
              setMenu('codigo')
            }}
            aoAbrirMenuDaPilula={abrirContextoDaPilula}
            aoAbrirMenuDaCor={abrirContextoDaCor}
          />
        ) : null}
        {tecnicas.some((t) => TAG_ETIQUETA.includes(t)) ? (
          <FaixaDeCores
            tecnica="etiqueta"
            rotulo="ETIQUETA"
            cores={[]}
            aoAbrirMenuDaPilula={() => {}}
          />
        ) : null}
        {tecnicas.filter((t) => TAG_ACABAMENTO.includes(t)).length ? (
          <FaixaDeCores
            tecnica={TECNICA_DA_TAG[tecnicas.filter((t) => TAG_ACABAMENTO.includes(t))[0]] ?? 'gola'}
            rotulo={tecnicas.filter((t) => TAG_ACABAMENTO.includes(t))[0]}
            cores={[]}
          />
        ) : null}
      </div>

      <div className="kit-bancada coluna">
        <span className="kit-nota">Na folha A4 e no arquivo do cliente, a mesma faixa vira a opção B</span>
        <FaixaDeCores tecnica="dtf" rotulo="DTF" cores={coresDtf} impressao />
      </div>

      <MenuReferencia
        aberto={menu === 'ref'}
        ancora={btRef}
        aoFechar={fechar}
        refs={referencias}
        categorias={CATS_REF}
        ordem={CATS_ORDEM}
        valor={ref?.cod}
        aoEscolher={(r) => {
          setRef(r)
          setGenero(r.genero)
        }}
        aoCriar={(t) => setRef({ cod: t, nome: '', genero: '', categoria: '' })}
      />

      <MenuTecido
        aberto={menu === 'tecido'}
        ancora={btTecido}
        aoFechar={fechar}
        tipos={TIPOS_TECIDO}
        valor={tecido}
        aoEscolher={setTecido}
        aoCriar={setTecido}
      />

      <MenuCorDeTecido
        aberto={menu === 'cor'}
        ancora={btCor}
        aoFechar={fechar}
        grupos={GRUPOS_DE_COR}
        valor={corTecido.nome}
        aoEscolher={(nome, hex) => setCorTecido({ nome, hex })}
        aoLimpar={() => setCorTecido({ nome: 'sem cor', hex: '' })}
      />

      <MenuTecnica
        aberto={menu === 'tecnica'}
        ancora={btTecnica}
        aoFechar={fechar}
        secoes={secoes}
        marcadas={tecnicas}
        aoAplicar={setTecnicas}
      />

      <MenuCodigoDeCor
        aberto={menu === 'codigo'}
        ancora={ancoraSolta}
        aoFechar={fechar}
        abas={[
          { id: 'dtf', rotulo: 'DTF', cor: 'var(--tec-dtf-vivo)', cores: DTF_CORES },
          { id: 'sub', rotulo: 'SUB', cor: 'var(--tec-subli-vivo)', cores: SB_CORES },
        ]}
        noLayout={coresDtf.map((c) => c.cod)}
        aoAlternar={(cod, hex) =>
          setCoresDtf((c) =>
            c.some((x) => x.cod === cod) ? c.filter((x) => x.cod !== cod) : [...c, { cod, hex }],
          )
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
