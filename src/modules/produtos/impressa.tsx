import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PencilSimple, Printer } from '@phosphor-icons/react'
import { Botao, Chip, Pagina } from '@ds'
import {
  CabecalhoDaFolha,
  Folha,
  Medidor,
  Palco,
  imprimir,
  usarPaginacao,
  type BlocoDaFolha,
  type CelulaDaFolha,
} from '@dominio/layout'
import {
  DETALHES,
  NOME_DA_ETIQUETA,
  NOME_DA_TECNICA,
  NOME_DO_GENERO,
  areaDaPeca,
  areaEmGramas,
  areaEmMetros,
  aviamentosDoKit,
  carregarEscalasDoMolde,
  carregarFicha,
  carregarMolde,
  casasDaArea,
  codigoCurto,
  emArea,
  emNumero,
  encaixar,
  escalaDoMolde,
  gradeDoKit,
  gradeEmPalavras,
  moldeComoImagem,
  naOrdemDaFabrica,
  paraOCampo,
  partesNoMolde,
  tecidoDoKit,
  vezesEmPalavras,
  type Ficha,
  type GrupoDeReferencia,
  type KitNaLista,
  type MaterialDoEstoque,
  type MoldeMedido,
  type PecaDoKit,
  type ReferenciaNaFicha,
  type TecidoDeConta,
} from '@dominio/produto'
import { plural } from './apoio'
import { Cotas } from './cotas'
import type { KitCarregado } from './kit'
import { emCm, usarTecidoDeConta } from './medidas'
import { medirMolde } from './medir'
import { apoioDoMaterial } from './pecas'
import './papel.css'

/* ==========================================================================
   A FICHA TÉCNICA IMPRESSA: uma por referência e uma por kit.

   É A MESMA FOLHA DA COTAÇÃO (dominio/layout): A4, o cabeçalho de quatro
   colunas por três fileiras, a paginação medida. O que é daqui é o recheio.

   A FOLHA TOMA A PÁGINA, com os próprios botões no topo, e devolve quando a
   pessoa volta. As pílulas de "Sai na folha" ligam e desligam cada seção: a
   costura não precisa do tecido por tamanho, o corte não precisa da tabela de
   medidas.

   O MOLDE SAI COM AS MEDIDAS quando a escala está acertada (ver visor.tsx).
   Sem escala, sai só o desenho: centímetro inventado no papel é pior que
   nenhum, porque no papel ninguém vê o aviso.
   ========================================================================== */

/* o palpite inicial do corpo da folha com cabeçalho, em pixel de papel; logo
   depois do primeiro desenho ele é MEDIDO (ver a cotação, que usa o mesmo) */
const ALTURA_COM_CABECALHO = 806

type Documento = {
  id: string
  /** o que diz que o conteúdo mudou de verdade, para a paginação remedir */
  chave: string
  celulas: CelulaDaFolha[]
  sub: string
  /** o que vai à direita no rodapé: o código da peça ou do kit */
  codigo: string
  blocos: BlocoDaFolha[]
}

const maiuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')
const diaEHora = (d: Date) =>
  d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
/** "grade adulta, PP a G4" vira "Adulta, PP a G4": o rótulo da célula já diz Grade */
const gradeNoPapel = (tamanhos: string[]) => maiuscula(gradeEmPalavras(tamanhos).replace(/^grade /, ''))
const lista = (itens: string[]) =>
  itens.length <= 1 ? (itens[0] ?? '') : itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1]

function Titulo({ children, apoio }: { children: ReactNode; apoio?: string }) {
  return (
    <h3 className="fl-h">
      {children}
      {apoio ? <small className="pd-p-apoio">{apoio}</small> : null}
    </h3>
  )
}

/* --- o molde no papel ---------------------------------------------------------- */

type MoldeDaFolha = { svg: string | null; medido: MoldeMedido | null; cmPorUnidade: number | null }

/** Lê a escala acertada do molde geral e mede o desenho, para a folha. */
function usarMoldeDaFolha(referenciaId: string, svg: string | null): MoldeDaFolha {
  const [acertada, setAcertada] = useState<number | null>(null)
  const [medido, setMedido] = useState<MoldeMedido | null>(null)
  useEffect(() => {
    let vivo = true
    setAcertada(null)
    carregarEscalasDoMolde(referenciaId)
      .then(l => {
        if (vivo) setAcertada(l.find(e => e.tamanho === '')?.cmPorUnidade ?? null)
      })
      .catch(() => {
        /* sem a escala a folha sai com o desenho, sem número */
      })
    return () => {
      vivo = false
    }
  }, [referenciaId])
  useEffect(() => {
    if (!svg) return setMedido(null)
    try {
      setMedido(medirMolde(svg))
    } catch {
      setMedido(null)
    }
  }, [svg])
  return { svg, medido, cmPorUnidade: medido ? escalaDoMolde(acertada, medido).cmPorUnidade : null }
}

const LARGURA_DO_DESENHO = 720
const TETO_DO_DESENHO = 330
const FOLGA_DO_DESENHO = 40

function MoldeNoPapel({ molde, nome }: { molde: MoldeDaFolha; nome: string }) {
  const { svg, medido, cmPorUnidade } = molde
  if (!svg) return <p className="pd-p-vazio">Esta peça ainda não tem o desenho do molde.</p>
  /* sem medição, ou sem escala, sai o desenho puro */
  if (!medido || !cmPorUnidade) return <img src={moldeComoImagem(svg)} alt={'Molde de ' + nome} />
  const partes = partesNoMolde(medido)
  const q = medido.quadro
  /* O PAPEL É PEQUENO: o que se encaixa nele são as partes, e não a prancha
     inteira. A margem em branco que o Affinity deixa em volta do molde fica de
     fora, e as partes saem do maior tamanho que cabe. */
  const caixas = partes.flatMap(p => p.caixas)
  const alvo = caixas.length
    ? (() => {
        const x0 = Math.min(...caixas.map(c => c.x))
        const y0 = Math.min(...caixas.map(c => c.y))
        return {
          x: x0,
          y: y0,
          w: Math.max(...caixas.map(c => c.x + c.w)) - x0,
          h: Math.max(...caixas.map(c => c.y + c.h)) - y0,
        }
      })()
    : q
  const z = Math.min(
    (LARGURA_DO_DESENHO - FOLGA_DO_DESENHO * 2) / alvo.w,
    (TETO_DO_DESENHO - FOLGA_DO_DESENHO * 2) / alvo.h,
  )
  const altura = Math.round(alvo.h * z + FOLGA_DO_DESENHO * 2)
  const vista = encaixar(alvo, { w: LARGURA_DO_DESENHO, h: altura }, FOLGA_DO_DESENHO)
  return (
    <svg
      viewBox={`0 0 ${LARGURA_DO_DESENHO} ${altura}`}
      role="img"
      aria-label={'Molde de ' + nome + ', com a largura e a altura de cada parte'}
      data-molde-com-medidas=""
    >
      <image
        href={moldeComoImagem(svg)}
        x={vista.x + q.x * vista.z}
        y={vista.y + q.y * vista.z}
        width={q.w * vista.z}
        height={q.h * vista.z}
      />
      <Cotas partes={partes} vista={vista} cmPorUnidade={cmPorUnidade} recuo={12} comUnidade={false} />
    </svg>
  )
}

/* --- a tabela por tamanho, no papel -------------------------------------------- */

type LinhaNoPapel = { nome: string; apoio?: string; valores: string[]; tipo?: 'pd-p-soma' | 'pd-p-fraco' }

function GradeNoPapel({ primeira, tamanhos, linhas }: { primeira: string; tamanhos: string[]; linhas: LinhaNoPapel[] }) {
  return (
    <table className="fl-tab pd-p-tab pd-p-grade">
      <thead>
        <tr>
          <th>{primeira}</th>
          {tamanhos.map(t => (
            <th key={t}>{t}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map(l => (
          <tr key={l.nome} className={l.tipo}>
            <td>
              {l.nome}
              {/* o espaço é de verdade, e não só margem: quem copia a tabela leva as duas palavras separadas */}
              {l.apoio ? <> <small>{l.apoio}</small></> : null}
            </td>
            {l.valores.map((v, i) => (
              <td key={tamanhos[i]}>{v || '·'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* --- o documento de uma referência ---------------------------------------------- */

const SECOES_DA_REFERENCIA = [
  { chave: 'molde', nome: 'Molde com as medidas' },
  { chave: 'detalhes', nome: 'Detalhes da peça' },
  { chave: 'medidas', nome: 'Tabela de medidas' },
  { chave: 'tecido', nome: 'Tecido por peça' },
  { chave: 'aviamentos', nome: 'Aviamentos' },
  { chave: 'observacao', nome: 'Observação' },
]

function documentoDaReferencia({
  r,
  grupo,
  ficha,
  molde,
  tecido,
  doEstoque,
  quem,
  agora,
  sai,
}: {
  r: ReferenciaNaFicha
  grupo: GrupoDeReferencia | null
  ficha: Ficha
  molde: MoldeDaFolha
  /** o tecido de conta, para o metro e o grama; nulo: só a área */
  tecido: TecidoDeConta | null
  doEstoque: MaterialDoEstoque[]
  quem: string
  agora: Date
  sai: Set<string>
}): Documento {
  const tamanhos = naOrdemDaFabrica(ficha.tamanhos)
  const pano = ficha.partes.filter(p => p.unidade === 'm2')
  const fita = ficha.partes.filter(p => p.unidade === 'm')
  const cortes = pano.reduce((s, p) => s + p.vezes, 0)
  const areas = tamanhos.map(t => areaDaPeca(ficha.partes, t))

  const celulas: CelulaDaFolha[] = [
    { rotulo: 'Referência', valor: r.cod || 'sem código', forte: true },
    { rotulo: 'Peça', valor: r.nome },
    { rotulo: 'Grupo', valor: grupo ? grupo.cod + ' · ' + grupo.nome : '' },
    { rotulo: 'Gênero', valor: maiuscula(NOME_DO_GENERO[r.genero] ?? '') },
    { rotulo: 'Grade', valor: gradeNoPapel(tamanhos) },
    { rotulo: 'Tamanhos', valor: String(tamanhos.length) },
    {
      rotulo: 'Partes do molde',
      valor: pano.length ? pano.length + ', em ' + plural(cortes, 'corte', 'cortes') : '',
    },
    { rotulo: 'Atualizada em', valor: dia(r.fichaEm) },
    { rotulo: 'Impressa em', valor: diaEHora(agora) },
    { rotulo: 'Por', valor: quem },
  ]

  const blocos: BlocoDaFolha[] = []

  const oMolde = sai.has('molde') ? (
    <section data-secao="molde">
      <Titulo
        apoio={
          molde.svg && molde.cmPorUnidade
            ? 'largura e altura de cada parte, em cm'
            : molde.svg
              ? 'sem as medidas: falta acertar a escala do desenho'
              : undefined
        }
      >
        Molde
      </Titulo>
      <div className="pd-p-molde">
        <MoldeNoPapel molde={molde} nome={r.nome} />
      </div>
    </section>
  ) : null
  const osDetalhes = sai.has('detalhes') ? (
    <section data-secao="detalhes">
      <Titulo>Detalhes da peça</Titulo>
      <dl className="fl-informe pd-p-detalhes">
        {DETALHES.map(d => (
          <Fragment key={d.chave}>
            <dt>{d.nome}</dt>
            <dd className={ficha.detalhes[d.chave] ? undefined : 'pd-p-sem'}>
              {ficha.detalhes[d.chave] || 'não informado'}
            </dd>
          </Fragment>
        ))}
      </dl>
    </section>
  ) : null
  if (oMolde && osDetalhes) {
    blocos.push({
      id: 'molde-e-detalhes',
      conteudo: (
        <div className="pd-p pd-p-dois molde">
          {oMolde}
          {osDetalhes}
        </div>
      ),
    })
  } else if (oMolde || osDetalhes) {
    blocos.push({ id: 'molde-ou-detalhes', conteudo: <div className="pd-p">{oMolde ?? osDetalhes}</div> })
  }

  if (sai.has('medidas')) {
    blocos.push({
      id: 'medidas',
      conteudo: (
        <section className="pd-p" data-secao="medidas">
          <Titulo apoio="a peça pronta, em cm">Tabela de medidas</Titulo>
          {ficha.medidas.length ? (
            <GradeNoPapel
              primeira="Medida"
              tamanhos={tamanhos}
              linhas={ficha.medidas.map(m => ({
                nome: m.nome,
                apoio: m.comoMedir,
                valores: tamanhos.map(t => emCm(m.valores[t])),
              }))}
            />
          ) : (
            <p className="pd-p-nota">A ficha desta peça ainda não tem a tabela de medidas.</p>
          )}
        </section>
      ),
    })
  }

  if (sai.has('tecido')) {
    const linhas: LinhaNoPapel[] = [
      ...pano.map(p => {
        const daLinha = tamanhos.map(t => p.quantidades[t])
        const casas = casasDaArea(daLinha)
        return { nome: p.nome, apoio: vezesEmPalavras(p.vezes), valores: daLinha.map(v => emArea(v, casas)) }
      }),
      ...(pano.length
        ? [
            {
              nome: 'A peça inteira',
              apoio: 'em m²',
              valores: areas.map(a => emArea(a, casasDaArea(areas))),
              tipo: 'pd-p-soma' as const,
            },
          ]
        : []),
      ...(pano.length && tecido
        ? [
            {
              nome: 'Em metros',
              apoio: 'com ' + emNumero(tecido.largura, 2) + ' m de largura',
              valores: areas.map(a => emNumero(areaEmMetros(a, tecido), 2)),
              tipo: 'pd-p-fraco' as const,
            },
            {
              nome: 'Em gramas',
              apoio: 'com malha de ' + emNumero(tecido.gramatura, 0) + ' g/m²',
              valores: areas.map(a => emNumero(areaEmGramas(a, tecido), 0)),
              tipo: 'pd-p-fraco' as const,
            },
          ]
        : []),
      ...fita.map(p => ({
        nome: p.nome,
        apoio: 'em metros',
        valores: tamanhos.map(t => emNumero(p.quantidades[t], 2)),
      })),
    ]
    blocos.push({
      id: 'tecido',
      conteudo: (
        <section className="pd-p" data-secao="tecido">
          <Titulo apoio="cada parte do molde em m², já com a perda do corte">Tecido por peça</Titulo>
          {linhas.length ? (
            <GradeNoPapel primeira="Parte do molde" tamanhos={tamanhos} linhas={linhas} />
          ) : (
            <p className="pd-p-nota">A ficha desta peça ainda não tem o tecido medido.</p>
          )}
        </section>
      ),
    })
  }

  const osAviamentos = sai.has('aviamentos') ? (
    <section data-secao="aviamentos">
      <Titulo>Aviamentos e insumos por peça</Titulo>
      {ficha.materiais.length ? (
        <table className="fl-tab pd-p-tab">
          <thead>
            <tr>
              <th>Material</th>
              <th>Tipo</th>
              <th className="num">Por peça</th>
            </tr>
          </thead>
          <tbody>
            {ficha.materiais.map(m => (
              <tr key={m.nome}>
                <td>{m.nome}</td>
                <td>{m.materialId ? apoioDoMaterial(m.materialId, doEstoque) : 'pelo nome'}</td>
                <td className="num">
                  {paraOCampo(m.quantidade)} {m.unidade}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="pd-p-nota">Nenhum aviamento nem insumo na ficha desta peça.</p>
      )}
    </section>
  ) : null
  const aObservacao = sai.has('observacao') ? (
    <section data-secao="observacao">
      <Titulo>Observação para a costura</Titulo>
      <p className="pd-p-obs">{ficha.observacao || 'Nenhuma observação na ficha.'}</p>
    </section>
  ) : null
  if (osAviamentos && aObservacao) {
    blocos.push({
      id: 'aviamentos-e-observacao',
      conteudo: (
        <div className="pd-p pd-p-dois lista">
          {osAviamentos}
          {aObservacao}
        </div>
      ),
    })
  } else if (osAviamentos || aObservacao) {
    blocos.push({ id: 'aviamentos-ou-observacao', conteudo: <div className="pd-p">{osAviamentos ?? aObservacao}</div> })
  }

  return {
    id: 'ref-' + r.id,
    chave: [r.id, r.fichaEm, [...sai].join(), tecido?.id ?? '', molde.svg ? molde.svg.length : 0, molde.cmPorUnidade ?? 0].join(':'),
    celulas,
    sub: 'Ficha técnica da referência',
    codigo: r.cod || r.nome,
    blocos,
  }
}

/* --- o documento de um kit ------------------------------------------------------- */

const SECOES_DO_KIT = [
  { chave: 'desenho', nome: 'Desenho do kit' },
  { chave: 'pecas', nome: 'Peças do kit' },
  { chave: 'fabricacao', nome: 'Ficha de fabricação' },
  { chave: 'tecido', nome: 'Tecido por tamanho' },
  { chave: 'aviamentos', nome: 'Aviamentos' },
  { chave: 'observacao', nome: 'Observação' },
]

function etiquetaNoPapel(p: PecaDoKit): string {
  if (!p.etiqueta) return 'não escolhida'
  if (p.etiqueta === 'sem') return 'Sem etiqueta'
  return NOME_DA_ETIQUETA[p.etiqueta] + (p.etiquetaOnde ? ', ' + p.etiquetaOnde : '')
}

function documentoDoKit({
  kit,
  dado,
  quem,
  agora,
  sai,
}: {
  kit: KitNaLista
  dado: KitCarregado
  quem: string
  agora: Date
  sai: Set<string>
}): Documento {
  const { pecas, fichas, desenho } = dado
  const grade = gradeDoKit(pecas)
  const tecidos = tecidoDoKit(fichas, grade)
  const aviamentos = aviamentosDoKit(fichas)
  const distintos = new Set(pecas.flatMap(p => p.tecidos.map(t => t.tecidoId)).filter(Boolean))
  const tecnicas = [...new Set(pecas.flatMap(p => p.design.map(d => d.tecnica)))]
  const etiquetas = [...new Set(pecas.map(p => p.etiqueta).filter(Boolean))]
  const comObservacao = pecas.filter(p => p.observacao)

  const celulas: CelulaDaFolha[] = [
    /* sem o destaque da referência: o código do kit é comprido e quebraria em duas linhas */
    { rotulo: 'Kit', valor: codigoCurto(kit.cod) || 'sem código' },
    { rotulo: 'Peças', valor: String(pecas.length) },
    { rotulo: 'Grade', valor: grade.length ? gradeNoPapel(grade) : '' },
    { rotulo: 'Gênero', valor: maiuscula(NOME_DO_GENERO[kit.genero] ?? '') },
    { rotulo: 'Tecidos', valor: distintos.size ? String(distintos.size) : '' },
    {
      rotulo: 'Etiqueta',
      valor: lista(etiquetas.map(e => (e === 'sem' ? 'Sem etiqueta' : NOME_DA_ETIQUETA[e as keyof typeof NOME_DA_ETIQUETA]))),
    },
    {
      rotulo: 'Design impresso',
      valor: maiuscula(lista(tecnicas.map(t => NOME_DA_TECNICA[t].toLowerCase()))),
    },
    { rotulo: 'Atualizada em', valor: dia(kit.fichaEm) },
    { rotulo: 'Impressa em', valor: diaEHora(agora) },
    { rotulo: 'Por', valor: quem },
  ]

  const blocos: BlocoDaFolha[] = []

  const oDesenho = sai.has('desenho') ? (
    <section data-secao="desenho">
      <Titulo>Desenho do kit</Titulo>
      <div className="pd-p-molde">
        {desenho ? (
          <img src={moldeComoImagem(desenho)} alt={'Desenho de ' + kit.nome} />
        ) : (
          <p className="pd-p-vazio">Este kit ainda não tem desenho.</p>
        )}
      </div>
    </section>
  ) : null
  const asPecas = sai.has('pecas') ? (
    <section data-secao="pecas">
      <Titulo>Peças do kit</Titulo>
      <table className="fl-tab pd-p-tab">
        <thead>
          <tr>
            <th>Papel</th>
            <th>Referência</th>
            <th>Peça</th>
          </tr>
        </thead>
        <tbody>
          {pecas.map(p => (
            <tr key={p.referenciaId}>
              <td>{p.papel || 'Peça'}</td>
              <td className="pd-p-cod">{p.cod}</td>
              <td>{p.nome}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pd-p-nota">As medidas e o molde de cada peça saem na ficha da própria referência.</p>
    </section>
  ) : null
  blocos.push({
    id: 'titulo-desenho-e-pecas',
    conteudo: (
      <div className="pd-p">
        <h2 className="pd-p-titulo">{kit.nome}</h2>
        {oDesenho && asPecas ? (
          <div className="pd-p-dois">
            {oDesenho}
            {asPecas}
          </div>
        ) : (
          (oDesenho ?? asPecas)
        )}
      </div>
    ),
  })

  if (sai.has('fabricacao')) {
    blocos.push({
      id: 'fabricacao',
      conteudo: (
        <section className="pd-p" data-secao="fabricacao">
          <Titulo>Ficha de fabricação</Titulo>
          <table className="fl-tab pd-p-tab pd-p-fab">
            <thead>
              <tr>
                <th>Característica</th>
                {pecas.map(p => (
                  <th key={p.referenciaId}>
                    {(p.papel || 'Peça') + ' · ' + p.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tecidos</td>
                {pecas.map(p => (
                  <td key={p.referenciaId}>
                    {p.tecidos.length
                      ? p.tecidos.map(t => (
                          <span className="pd-p-linha" key={t.parte}>
                            {(t.tecido || 'tecido que saiu do catálogo') + ' (' + t.parte.toLowerCase() + ')'}
                          </span>
                        ))
                      : 'não escolhido'}
                  </td>
                ))}
              </tr>
              {DETALHES.map(d => (
                <tr key={d.chave}>
                  <td>{d.nome}</td>
                  {pecas.map(p => (
                    <td key={p.referenciaId}>{p.detalhes[d.chave] || 'não informado'}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>Design impresso</td>
                {pecas.map(p => (
                  <td key={p.referenciaId}>
                    {p.design.length
                      ? p.design.map(d => (
                          <span className="pd-p-linha" key={d.tecnica}>
                            {NOME_DA_TECNICA[d.tecnica] + (d.onde ? ': ' + d.onde : '')}
                          </span>
                        ))
                      : 'nenhum'}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Etiqueta</td>
                {pecas.map(p => (
                  <td key={p.referenciaId}>{etiquetaNoPapel(p)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      ),
    })
  }

  if (sai.has('tecido')) {
    const temNumero = grade.length > 0 && tecidos.some(t => t.areas.some(a => a !== null))
    blocos.push({
      id: 'tecido',
      conteudo: (
        <section className="pd-p" data-secao="tecido">
          <Titulo apoio="em m², tecido por tecido, já com a perda do corte">Tecido de um kit, em cada tamanho</Titulo>
          {temNumero ? (
            <GradeNoPapel
              primeira="Tecido"
              tamanhos={grade}
              linhas={tecidos.map(t => {
                const casas = casasDaArea(t.areas)
                return {
                  nome: t.tecido || 'tecido que saiu do catálogo',
                  apoio: t.onde,
                  valores: t.areas.map(a => emArea(a, casas)),
                }
              })}
            />
          ) : (
            <p className="pd-p-nota">
              {tecidos.length
                ? 'O tecido já foi escolhido, mas falta medir o tecido na ficha de cada referência.'
                : 'Falta escolher o tecido de cada peça.'}
            </p>
          )}
        </section>
      ),
    })
  }

  const osAviamentos = sai.has('aviamentos') ? (
    <section data-secao="aviamentos">
      <Titulo>Aviamentos e insumos de um kit</Titulo>
      {aviamentos.length ? (
        <table className="fl-tab pd-p-tab">
          <thead>
            <tr>
              <th>Material</th>
              <th>Onde</th>
              <th className="num">Por kit</th>
            </tr>
          </thead>
          <tbody>
            {aviamentos.map(a => (
              <tr key={a.nome + a.unidade}>
                <td>{a.nome}</td>
                <td>{a.deQuem.replace(/^d([aeo]s?) /, '$1 ')}</td>
                <td className="num">
                  {paraOCampo(a.quantidade)} {a.unidade}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="pd-p-nota">Nenhuma peça deste kit tem aviamento na ficha.</p>
      )}
    </section>
  ) : null
  const aObservacao = sai.has('observacao') ? (
    <section data-secao="observacao">
      <Titulo>Observação para a fábrica</Titulo>
      <p className="pd-p-obs">
        {comObservacao.length
          ? comObservacao.map(p => (
              <span className="pd-p-linha" key={p.referenciaId}>
                <b>{p.papel || p.nome}:</b> {p.observacao}
              </span>
            ))
          : 'Nenhuma observação na ficha do kit.'}
      </p>
    </section>
  ) : null
  if (osAviamentos && aObservacao) {
    blocos.push({
      id: 'aviamentos-e-observacao',
      conteudo: (
        <div className="pd-p pd-p-dois lista">
          {osAviamentos}
          {aObservacao}
        </div>
      ),
    })
  } else if (osAviamentos || aObservacao) {
    blocos.push({ id: 'aviamentos-ou-observacao', conteudo: <div className="pd-p">{osAviamentos ?? aObservacao}</div> })
  }

  return {
    id: 'kit-' + kit.id,
    chave: [kit.id, kit.fichaEm, [...sai].join(), desenho ? desenho.length : 0].join(':'),
    celulas,
    sub: 'Ficha técnica do kit',
    codigo: codigoCurto(kit.cod) || kit.nome,
    blocos,
  }
}

/* --- as folhas: medir e distribuir ---------------------------------------------- */

function FolhasDoDocumento({
  doc,
  alto,
  medidorEm,
  aoContar,
}: {
  doc: Documento
  alto: number
  /** onde a área de medição é pendurada: FORA do palco, que encolhe a folha na tela estreita */
  medidorEm: HTMLElement | null
  aoContar: (id: string, paginas: number) => void
}) {
  const pag = usarPaginacao(doc.blocos, alto, doc.chave)
  const quantas = pag.paginas.length
  useEffect(() => {
    aoContar(doc.id, quantas)
  }, [doc.id, quantas, aoContar])
  return (
    <>
      {medidorEm ? createPortal(<Medidor aoMedir={pag.medidor} blocos={doc.blocos} />, medidorEm) : null}
      {pag.paginas.map((blocos, i) => (
        <Folha
          key={doc.id + '-' + i}
          numero={i + 1}
          de={quantas}
          /* o cabeçalho é da primeira folha, como na cotação */
          cabecalho={
            i === 0 ? (
              <div className="pd-p-cab">
                <CabecalhoDaFolha sub={doc.sub} celulas={doc.celulas} />
              </div>
            ) : undefined
          }
          rodape={
            <div className="fl-rodape">
              <span>
                <b>Fourtime</b> · ficha técnica de uso interno · os números valem na data da impressão
              </span>
              <span className="fl-rodape-total">{doc.codigo}</span>
            </div>
          }
        >
          {blocos.map(b => (
            <div key={b.id}>{b.conteudo}</div>
          ))}
        </Folha>
      ))}
    </>
  )
}

function Pilha({ documentos, aoContar }: { documentos: Documento[]; aoContar: (paginas: number) => void }) {
  const [medidorEm, setMedidorEm] = useState<HTMLDivElement | null>(null)
  const palco = useRef<HTMLDivElement>(null)
  const [alto, setAlto] = useState(ALTURA_COM_CABECALHO)
  const [contas, setContas] = useState<Record<string, number>>({})

  /* A ALTURA DO CORPO, MEDIDA NA FOLHA DE VERDADE (clientHeight, que não
     encolhe com o zoom do palco). Todas as fichas têm o mesmo cabeçalho, então
     uma medida serve a todas. */
  useEffect(() => {
    const comCabecalho = [...(palco.current?.querySelectorAll('.fl') ?? [])].find(f => !!f.querySelector('.fl-topo'))
    const corpo = comCabecalho?.querySelector('.fl-corpo')
    const medida = corpo instanceof HTMLElement ? corpo.clientHeight : 0
    if (medida > 200 && Math.abs(medida - alto) > 2) setAlto(medida)
  })

  const contar = useRef((id: string, n: number) => {
    setContas(atual => (atual[id] === n ? atual : { ...atual, [id]: n }))
  }).current
  const total = documentos.reduce((s, d) => s + (contas[d.id] ?? 1), 0)
  useEffect(() => {
    aoContar(total)
  }, [total, aoContar])

  return (
    <div ref={palco} data-folhas="">
      <div className="pd-mede-aqui" ref={setMedidorEm} />
      <Palco>
        {documentos.map(d => (
          <FolhasDoDocumento key={d.id} doc={d} alto={alto} medidorEm={medidorEm} aoContar={contar} />
        ))}
      </Palco>
    </div>
  )
}

function SaiNaFolha({
  secoes,
  sai,
  aoVirar,
  children,
}: {
  secoes: { chave: string; nome: string }[]
  sai: Set<string>
  aoVirar: (chave: string) => void
  children?: ReactNode
}) {
  return (
    <div className="fl-nao-imprime pd-sai" data-sai-na-folha="">
      <span className="pd-sai-rot">
        <Printer size={16} aria-hidden="true" />
        Sai na folha
      </span>
      {secoes.map(s => (
        <Chip key={s.chave} ligado={sai.has(s.chave)} aria-pressed={sai.has(s.chave)} onClick={() => aoVirar(s.chave)}>
          {s.nome}
        </Chip>
      ))}
      {children}
    </div>
  )
}

function usarSecoes(secoes: { chave: string }[]) {
  const [sai, setSai] = useState(() => new Set(secoes.map(s => s.chave)))
  const virar = (chave: string) =>
    setSai(atual => {
      const outro = new Set(atual)
      if (outro.has(chave)) outro.delete(chave)
      else outro.add(chave)
      return outro
    })
  return { sai, virar }
}

function Acoes({ podeEditar, aoEditar }: { podeEditar: boolean; aoEditar: () => void }) {
  return (
    <>
      {podeEditar ? (
        <Botao onClick={aoEditar}>
          <PencilSimple size={16} aria-hidden="true" />
          Editar
        </Botao>
      ) : null}
      <Botao tom="primario" onClick={imprimir}>
        <Printer size={16} aria-hidden="true" />
        Imprimir ou salvar em PDF
      </Botao>
    </>
  )
}

/* --- as duas páginas -------------------------------------------------------------- */

export function ImpressaoDaReferencia({
  r,
  grupo,
  ficha,
  molde,
  tecidos,
  doEstoque,
  quem,
  podeEditar,
  aoVoltar,
  aoEditar,
}: {
  r: ReferenciaNaFicha
  grupo: GrupoDeReferencia | null
  ficha: Ficha
  molde: string | null
  tecidos: TecidoDeConta[]
  doEstoque: MaterialDoEstoque[]
  quem: string
  podeEditar: boolean
  aoVoltar: () => void
  aoEditar: () => void
}) {
  const [agora] = useState(() => new Date())
  const { sai, virar } = usarSecoes(SECOES_DA_REFERENCIA)
  const conta = usarTecidoDeConta(tecidos)
  const doMolde = usarMoldeDaFolha(r.id, molde)
  const [paginas, setPaginas] = useState(1)

  const doc = useMemo(
    () => documentoDaReferencia({ r, grupo, ficha, molde: doMolde, tecido: conta.tecido, doEstoque, quem, agora, sai }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r, grupo, ficha, doMolde.svg, doMolde.medido, doMolde.cmPorUnidade, conta.tecido, doEstoque, quem, agora, sai],
  )

  return (
    <Pagina
      acima={
        <button type="button" className="pd-volta" onClick={aoVoltar}>
          Voltar à referência
        </button>
      }
      titulo={'Ficha técnica impressa ' + (r.cod || r.nome)}
      sub={'A ficha desta referência, do jeito que sai na impressora. ' + plural(paginas, 'página', 'páginas') + '.'}
      acoes={<Acoes podeEditar={podeEditar} aoEditar={aoEditar} />}
    >
      <SaiNaFolha secoes={SECOES_DA_REFERENCIA} sai={sai} aoVirar={virar} />
      <div data-impressa="referencia">
        <Pilha documentos={[doc]} aoContar={setPaginas} />
      </div>
    </Pagina>
  )
}

type PecaLida = { r: ReferenciaNaFicha; ficha: Ficha; molde: MoldeDaFolha }

export function ImpressaoDoKit({
  kit,
  dado,
  referencias,
  grupos,
  tecidos,
  doEstoque,
  quem,
  podeEditar,
  aoVoltar,
  aoEditar,
}: {
  kit: KitNaLista
  dado: KitCarregado
  referencias: ReferenciaNaFicha[]
  grupos: GrupoDeReferencia[]
  tecidos: TecidoDeConta[]
  doEstoque: MaterialDoEstoque[]
  quem: string
  podeEditar: boolean
  aoVoltar: () => void
  aoEditar: () => void
}) {
  const [agora] = useState(() => new Date())
  const { sai, virar } = usarSecoes(SECOES_DO_KIT)
  const conta = usarTecidoDeConta(tecidos)
  const [paginas, setPaginas] = useState(1)
  /* juntar a ficha de cada peça: desligado até alguém pedir, e só então as fichas são lidas */
  const [juntar, setJuntar] = useState(false)
  const [lidas, setLidas] = useState<PecaLida[] | null>(null)
  const [todasAsSecoes] = useState(() => new Set(SECOES_DA_REFERENCIA.map(s => s.chave)))

  useEffect(() => {
    if (!juntar || lidas) return
    let vivo = true
    Promise.all(
      dado.pecas.map(async (p): Promise<PecaLida | null> => {
        const r = referencias.find(x => x.id === p.referenciaId)
        if (!r) return null
        const [ficha, svg, escalas] = await Promise.all([
          carregarFicha(r),
          carregarMolde(r.id),
          carregarEscalasDoMolde(r.id).catch(() => []),
        ])
        let medido: MoldeMedido | null = null
        try {
          medido = svg ? medirMolde(svg) : null
        } catch {
          medido = null
        }
        const acertada = escalas.find(e => e.tamanho === '')?.cmPorUnidade ?? null
        return {
          r,
          ficha,
          molde: { svg, medido, cmPorUnidade: medido ? escalaDoMolde(acertada, medido).cmPorUnidade : null },
        }
      }),
    )
      .then(l => {
        if (vivo) setLidas(l.filter((x): x is PecaLida => !!x))
      })
      .catch(() => {
        if (vivo) setLidas([])
      })
    return () => {
      vivo = false
    }
  }, [juntar, lidas, dado.pecas, referencias])

  const documentos = useMemo(() => {
    const doKit = documentoDoKit({ kit, dado, quem, agora, sai })
    const dasPecas =
      juntar && lidas
        ? lidas.map(l =>
            documentoDaReferencia({
              r: l.r,
              grupo: grupos.find(g => g.cod === l.r.grupo) ?? null,
              ficha: l.ficha,
              molde: l.molde,
              tecido: conta.tecido,
              doEstoque,
              quem,
              agora,
              sai: todasAsSecoes,
            }),
          )
        : []
    return [doKit, ...dasPecas]
  }, [kit, dado, quem, agora, sai, juntar, lidas, grupos, conta.tecido, doEstoque, todasAsSecoes])

  return (
    <Pagina
      acima={
        <button type="button" className="pd-volta" onClick={aoVoltar}>
          Voltar ao kit
        </button>
      }
      titulo="Ficha técnica impressa do kit"
      sub={kit.nome + ', do jeito que sai na impressora. ' + plural(paginas, 'página', 'páginas') + '.'}
      acoes={<Acoes podeEditar={podeEditar} aoEditar={aoEditar} />}
    >
      <SaiNaFolha secoes={SECOES_DO_KIT} sai={sai} aoVirar={virar}>
        <Chip ligado={juntar} aria-pressed={juntar} data-juntar="" onClick={() => setJuntar(x => !x)}>
          Juntar a ficha de cada peça · mais {plural(dado.pecas.length, 'folha', 'folhas')}
        </Chip>
      </SaiNaFolha>
      <div data-impressa="kit">
        <Pilha documentos={documentos} aoContar={setPaginas} />
      </div>
    </Pagina>
  )
}
