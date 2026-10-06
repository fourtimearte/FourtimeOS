import type { CSSProperties } from 'react'
import { Car, Motorcycle, NotePencil, Taxi, Truck, Wallet } from '@phosphor-icons/react'
import { Botao, IconeDoTitulo, TituloCartao } from '@ds'
import {
  MEIOS,
  NOME_DA_FORMA,
  NOME_DO_MEIO,
  NOME_DO_MOTIVO,
  abertos,
  repartir,
  somaDe,
  type Fatia,
  type Lancamento,
  type Meio,
} from '@dominio/transporte'
import { diaEMes, dinheiro, dinheiroCurto, lerMes, mesAnterior, MES_LONGO, plural, quandoFoi } from './apoio'

/* ==========================================================================
   O lado da página de Transporte: o resumo do mês quando nada está
   escolhido, e a corrida quando uma está.
   ========================================================================== */

export function IconeDoMeio({ meio, tamanho = 18 }: { meio: Meio; tamanho?: number }) {
  const Icone = meio === 'motoboy' ? Motorcycle : meio === 'uber' ? Car : meio === 'taxi' ? Taxi : Truck
  return (
    <span className="tp-icone" aria-hidden="true">
      <Icone size={tamanho} />
    </span>
  )
}

/* Situação é ponto e texto, como em Fornecedores: nunca fundo colorido. */
export function Situacao({ pago, texto }: { pago: boolean; texto?: string }) {
  return (
    <span className="tp-situacao" style={{ '--c': pago ? 'var(--ok)' : 'var(--warn)' } as CSSProperties}>
      <i />
      {texto ?? (pago ? 'Pago' : 'A pagar')}
    </span>
  )
}

/* As barras: uma linha por fatia, da maior para a menor. Uma cor só, a tinta
   do sistema, porque aqui a barra mede tamanho e não diz quem é quem: o nome
   está escrito ao lado. */
export function Barras({ fatias, vazio, empilhada }: { fatias: Fatia[]; vazio: string; empilhada?: boolean }) {
  if (!fatias.length) return <p className="tp-vazio-dentro">{vazio}</p>
  const maior = Math.max(...fatias.map((f) => f.valor)) || 1
  return (
    <div className={empilhada ? 'tp-barras empilhada' : 'tp-barras'}>
      {fatias.map((f) => (
        <div
          key={f.chave}
          className="tp-barra-linha"
          title={`${f.nome}: ${dinheiro(f.valor)} em ${plural(f.corridas, 'corrida', 'corridas')}`}
        >
          <span className="tp-barra-nome">
            <b>{f.nome}</b>
            <small>{plural(f.corridas, 'corrida', 'corridas')}</small>
          </span>
          <span className="tp-trilho">
            <span className="tp-cheio" style={{ '--l': `${Math.max(2, (f.valor / maior) * 100)}%` } as CSSProperties} />
          </span>
          <span className="tp-barra-valor">{dinheiro(f.valor)}</span>
          <span className="tp-barra-parte">{Math.round(f.parte * 100)}%</span>
        </div>
      ))}
    </div>
  )
}

/** Quanto o mês anterior tinha gasto até o mesmo dia: comparar mês cheio com mês pela metade engana. */
export function comparacao(lancamentos: Lancamento[], anteriores: Lancamento[], mes: string, hoje: Date) {
  const { ano, mes: m } = lerMes(mes)
  const mesCorrente = hoje.getFullYear() === ano && hoje.getMonth() === m
  const ate = mesCorrente ? hoje.getDate() : 31
  const antes = somaDe(anteriores.filter((l) => new Date(l.quando).getDate() <= ate))
  const agora = somaDe(lancamentos)
  const nomeAntes = MES_LONGO[lerMes(mesAnterior(mes)).mes]
  if (!antes) return { texto: `Sem lançamento em ${nomeAntes} para comparar.`, mesCorrente, ate }
  const dif = Math.round(((agora - antes) / antes) * 100)
  const quando = mesCorrente ? `até o dia ${ate} de ${nomeAntes}` : `em ${nomeAntes}`
  const texto =
    dif === 0
      ? `O mesmo que ${quando}.`
      : `${Math.abs(dif)}% ${dif > 0 ? 'a mais' : 'a menos'} que ${quando}, que foi ${dinheiro(antes)}.`
  return { texto, mesCorrente, ate }
}

type Aberto = { id: string; nome: string; meio: Meio; ids: string[]; valor: number; desde: string }

/** O que está aberto, juntado por quem vai receber. */
export function abertosPorQuem(lancamentos: Lancamento[]): Aberto[] {
  const mapa = new Map<string, Aberto>()
  abertos(lancamentos).forEach((l) => {
    const ja = mapa.get(l.transportadorId)
    if (!ja) {
      mapa.set(l.transportadorId, {
        id: l.transportadorId,
        nome: l.transportador,
        meio: l.meio,
        ids: [l.id],
        valor: l.valor,
        desde: l.quando,
      })
    } else {
      ja.ids.push(l.id)
      ja.valor += l.valor
      if (l.quando < ja.desde) ja.desde = l.quando
    }
  })
  return [...mapa.values()].sort((a, b) => b.valor - a.valor)
}

export function ResumoDoMes({
  lancamentos,
  anteriores,
  mes,
  hoje,
  podeEditar,
  aoAcertar,
  aoVerAbertos,
}: {
  lancamentos: Lancamento[]
  anteriores: Lancamento[]
  mes: string
  hoje: Date
  podeEditar: boolean
  aoAcertar: (ids: string[], quem: string) => Promise<void>
  aoVerAbertos: () => void
}) {
  const total = somaDe(lancamentos)
  const emAberto = abertos(lancamentos)
  const porQuem = abertosPorQuem(lancamentos)
  const { texto } = comparacao(lancamentos, anteriores, mes, hoje)
  const nome = MES_LONGO[lerMes(mes).mes]
  const porMeio = repartir(
    lancamentos,
    (l) => l.meio,
    (k) => NOME_DO_MEIO[k as Meio],
  ).sort((a, b) => MEIOS.indexOf(a.chave as Meio) - MEIOS.indexOf(b.chave as Meio))

  return (
    <>
      <section className="cartao tp-heroi">
        <span className="tp-heroi-numero">{dinheiroCurto(total)}</span>
        <div>
          <h2>gasto com transporte em {nome}</h2>
          <p>{lancamentos.length ? texto : 'Nenhuma corrida lançada neste mês.'}</p>
        </div>
      </section>

      <div className="tp-minis">
        <div className="cartao tp-numero-caixa">
          <b>{lancamentos.length}</b>
          <span>{lancamentos.length === 1 ? 'corrida' : 'corridas'}</span>
        </div>
        <div className="cartao tp-numero-caixa">
          <b>{dinheiroCurto(lancamentos.length ? Math.round((total / lancamentos.length) * 100) / 100 : 0)}</b>
          <span>por corrida</span>
        </div>
        <div className="cartao tp-numero-caixa">
          <b className={emAberto.length ? 'tp-alerta' : ''}>{dinheiroCurto(somaDe(emAberto))}</b>
          <span>a pagar</span>
        </div>
      </div>

      <section className="cartao tp-caixa">
        <div className="tp-caixa-topo">
          <TituloCartao icone={Wallet}>A pagar</TituloCartao>
          {emAberto.length ? (
            <button type="button" className="tp-link" onClick={aoVerAbertos}>
              ver {plural(emAberto.length, 'corrida', 'corridas')}
            </button>
          ) : null}
        </div>
        {porQuem.length ? (
          porQuem.map((a) => (
            <div key={a.id} className="tp-linha-caixa">
              <IconeDoMeio meio={a.meio} />
              <span className="tp-nome">
                <b>{a.nome}</b>
                <small>
                  {plural(a.ids.length, 'corrida', 'corridas')}, desde {diaEMes(a.desde)}
                </small>
              </span>
              <span className="tp-valor">{dinheiro(a.valor)}</span>
              {podeEditar ? (
                <Botao tamanho="sm" onClick={() => void aoAcertar(a.ids, a.nome)}>
                  Acertar
                </Botao>
              ) : null}
            </div>
          ))
        ) : (
          <p className="tp-vazio-dentro">Nada em aberto. Tudo que foi lançado neste mês já está pago.</p>
        )}
      </section>

      <section className="cartao tp-caixa">
        <div className="tp-caixa-topo">
          <TituloCartao icone={Truck}>Por meio</TituloCartao>
          <span className="tp-caixa-nota">onde o dinheiro foi</span>
        </div>
        <div className="tp-caixa-corpo">
          <Barras fatias={porMeio} vazio="Sem corrida neste mês." empilhada />
        </div>
      </section>
    </>
  )
}

export function CorpoDoLancamento({ l, hoje }: { l: Lancamento; hoje: Date }) {
  return (
    <div className="tp-ficha-corpo">
      <div className="tp-ficha-estado">
        <Situacao pago={l.pago} texto={l.pago ? `Pago${l.pagoEm ? ' em ' + diaEMes(l.pagoEm) : ''}` : 'A pagar'} />
        <span className="tp-apoio">{quandoFoi(l.quando, hoje)}</span>
      </div>
      <div className="tp-dados">
        <div className="tp-dado">
          <span>Quem levou</span>
          <b>{l.transportador}</b>
        </div>
        <div className="tp-dado">
          <span>Para quê</span>
          <b>{NOME_DO_MOTIVO[l.motivo]}</b>
        </div>
        {l.pedido ? (
          <div className="tp-dado">
            <span>Pedido</span>
            <b>{[l.pedido, l.cliente].filter(Boolean).join(' · ')}</b>
          </div>
        ) : null}
        {l.fornecedor ? (
          <div className="tp-dado">
            <span>Fornecedor</span>
            <b>{l.fornecedor}</b>
          </div>
        ) : null}
        <div className="tp-dado">
          <span>{l.motivo === 'busca' ? 'De onde veio' : 'Para onde foi'}</span>
          {l.destino ? <b>{l.destino}</b> : <b className="tp-falta">não foi escrito</b>}
        </div>
        <div className="tp-dado">
          <span>Pagamento</span>
          <b>{NOME_DA_FORMA[l.forma]}</b>
        </div>
        <div className="tp-dado">
          <span>Lançado por</span>
          <b>{l.quem || 'sistema'}</b>
        </div>
      </div>
      {l.observacao ? (
        <div className="tp-secao">
          <div className="tp-secao-topo">
            <span className="tp-secao-nome">
              <IconeDoTitulo icone={NotePencil} miudo />
              Observação
            </span>
          </div>
          <p className="tp-obs">{l.observacao}</p>
        </div>
      ) : null}
    </div>
  )
}

export function BotoesDoLancamento({
  l,
  podeEditar,
  aoAcertar,
  aoEditar,
}: {
  l: Lancamento
  podeEditar: boolean
  aoAcertar: () => void
  aoEditar: () => void
}) {
  if (!podeEditar) return null
  return (
    <>
      <Botao onClick={aoEditar}>Editar</Botao>
      {l.pago ? null : (
        <Botao tom="primario" onClick={aoAcertar}>
          Marcar como pago
        </Botao>
      )}
    </>
  )
}
