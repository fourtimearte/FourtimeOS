import { useEffect, useMemo, useState } from 'react'
import { Botao, Busca, Entrada, Gaveta, Selo, Vazio, avisar } from '@ds'
import { apagarConsumo, combina, gravarConsumo, referenciasPorGrupo } from '@dominio/banco'
import type { Banco, Consumo, Referencia } from '@dominio/banco'
import { TAMANHOS_ADULTO, TAMANHOS_INFANTIL } from '@dominio/layout'
import { Bloco, Linha } from './pecas'

/* ==========================================================================
   Consumo de tecido.

   Quanto uma peça come, por referência e por tamanho. É daqui que sai a
   reserva do pedido aprovado (migração 026), e é a única coisa que transforma
   "120 camisetas G em dry fit preto" em quilos que o estoque entende.

   CONSUMO É CADASTRO, E NÃO CONTA. Quem sabe quanto uma camiseta G come é a
   mesa de corte, e não uma fórmula. O mockup inventava, com área de molde
   dividida por um aproveitamento chutado, e número inventado em conta de
   compra é pior que conta nenhuma, porque ele parece resposta.

   POR TAMANHO, E NÃO POR REFERÊNCIA SÓ. Entre as pontas da grade a diferença
   passa de 20%. Uma média por referência erraria para os dois lados ao mesmo
   tempo, e erraria mais justamente no pedido de escola, que é o que leva a
   grade inteira.

   Os dois campos, metros e quilos, existem porque ainda não está decidido qual
   dos dois a fábrica vai preencher na prática. Um deles basta quando o tecido
   tem largura e gramatura cadastradas: o banco converte.
   ========================================================================== */

/* O gênero C é infantil; o resto usa a grade adulta. É a mesma regra que a
   grade do orçamento usa, e ela mora no layout. */
function tamanhosDa(r: Referencia): readonly string[] {
  return r.genero === 'C' ? TAMANHOS_INFANTIL : TAMANHOS_ADULTO
}

function texto(v: number | null): string {
  return v === null ? '' : String(v).replace('.', ',')
}

function lido(t: string): number | null {
  const s = t.trim()
  if (!s) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function ConsumoDeTecido({
  banco,
  podeMexer,
  procurado,
  aoProcurar,
  aoTrocarConsumo,
}: {
  banco: Banco
  podeMexer: boolean
  procurado: string
  aoProcurar: (t: string) => void
  aoTrocarConsumo: (referenciaId: string, linhas: Consumo[]) => void
}) {
  const [abertos, setAbertos] = useState<string[]>([])
  const [naGrade, setNaGrade] = useState<Referencia | null>(null)
  const [soSemConsumo, setSoSemConsumo] = useState(false)

  /* quantos tamanhos cada referência já tem, para a linha dizer isso sem que
     a tela precise varrer a lista de novo a cada desenho */
  const porReferencia = useMemo(() => {
    const m = new Map<string, Consumo[]>()
    banco.consumo.forEach((c) => {
      const ja = m.get(c.referenciaId)
      if (ja) ja.push(c)
      else m.set(c.referenciaId, [c])
    })
    return m
  }, [banco.consumo])

  const blocos = useMemo(() => {
    const todos = referenciasPorGrupo(banco)
    return todos
      .map((b) => ({
        ...b,
        itens: b.itens.filter((r) => {
          if (soSemConsumo && porReferencia.has(r.id)) return false
          if (!procurado.trim()) return true
          return combina(procurado, r.nome) || combina(procurado, r.cod)
        }),
      }))
      .filter((b) => b.itens.length > 0)
  }, [banco, procurado, soSemConsumo, porReferencia])

  const procurando = procurado.trim().length > 0 || soSemConsumo
  const aberto = (cod: string) => procurando || abertos.includes(cod)

  const cadastradas = porReferencia.size
  const semMedida = banco.tecidos.filter((t) => t.gramatura === null || t.largura === null).length

  return (
    <>
      <div className="bd-barra">
        <Busca
          value={procurado}
          onChange={(e) => aoProcurar(e.target.value)}
          placeholder="Buscar referência..."
        />
        <Botao
          tom={soSemConsumo ? 'forte' : 'contorno'}
          tamanho="sm"
          onClick={() => setSoSemConsumo((v) => !v)}
        >
          Só as sem consumo
        </Botao>
      </div>

      <p className="bd-conta">
        {cadastradas} de {banco.referencias.length} referências com consumo cadastrado
        {semMedida
          ? ' · ' + semMedida + ' tecido(s) ainda sem largura ou gramatura, e sem elas metro não vira quilo'
          : ' · todos os tecidos têm largura e gramatura'}
      </p>

      {blocos.length === 0 ? (
        <Vazio
          titulo="Nada encontrado"
          texto={
            soSemConsumo
              ? 'Todas as referências desta busca já têm consumo cadastrado.'
              : 'Nenhuma referência com esse nome.'
          }
        />
      ) : (
        <div className="bd-blocos">
          {blocos.map((b) => (
            <Bloco
              key={b.cod || 'sem'}
              cod={b.cod || undefined}
              nome={b.nome}
              conta={b.itens.length}
              aberto={aberto(b.cod)}
              aoAlternar={() =>
                setAbertos((l) => (l.includes(b.cod) ? l.filter((x) => x !== b.cod) : [...l, b.cod]))
              }
            >
              {b.itens.map((r) => {
                const tem = porReferencia.get(r.id)?.length ?? 0
                const total = tamanhosDa(r).length
                return (
                  <Linha
                    key={r.id}
                    esquerda={r.cod ? <span className="bd-cod">{r.cod}</span> : null}
                    nome={
                      <button type="button" className="bd-abrir" onClick={() => setNaGrade(r)}>
                        {r.nome}
                      </button>
                    }
                    direita={
                      tem === 0 ? (
                        <Selo tom="warn">sem consumo</Selo>
                      ) : tem < total ? (
                        <Selo tom="info">
                          {tem} de {total} tamanhos
                        </Selo>
                      ) : (
                        <Selo tom="ok">grade inteira</Selo>
                      )
                    }
                    podeMexer={false}
                  />
                )
              })}
            </Bloco>
          ))}
        </div>
      )}

      <GradeDoConsumo
        referencia={naGrade}
        linhas={naGrade ? (porReferencia.get(naGrade.id) ?? []) : []}
        podeMexer={podeMexer}
        aoFechar={() => setNaGrade(null)}
        aoTrocar={aoTrocarConsumo}
      />
    </>
  )
}

/* --- a grade de um tamanho por linha ---------------------------------------
   Grava ao sair do campo, e um tamanho de cada vez. Um botão "salvar tudo" no
   pé pareceria mais seguro e seria pior: quem preenche isso preenche olhando a
   ficha de corte, tamanho por tamanho, e perder oito linhas porque a página
   recarregou no meio é o tipo de coisa que faz a pessoa nunca mais voltar.

   Apagar os dois campos apaga a linha, em vez de gravar dois nulos: o banco
   recusaria a linha sem medida nenhuma, e "não sei" já tem representação, que
   é a linha não existir. */
function GradeDoConsumo({
  referencia,
  linhas,
  podeMexer,
  aoFechar,
  aoTrocar,
}: {
  referencia: Referencia | null
  linhas: Consumo[]
  podeMexer: boolean
  aoFechar: () => void
  aoTrocar: (referenciaId: string, l: Consumo[]) => void
}) {
  const [rascunho, setRascunho] = useState<Record<string, { m: string; q: string }>>({})
  const [gravando, setGravando] = useState('')

  useEffect(() => {
    if (!referencia) return
    const r: Record<string, { m: string; q: string }> = {}
    linhas.forEach((c) => {
      r[c.tamanho] = { m: texto(c.metros), q: texto(c.quilos) }
    })
    setRascunho(r)
    /* `linhas` entra de fora e muda de identidade a cada gravação; seguir ele
       aqui daria um laço. O que importa é qual referência está aberta. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referencia])

  /* A gaveta e desenhada SEMPRE, e o que muda e `aberto`. Desmontar ela ao
     fechar cortaria a animacao de saida no meio, porque o <dialog> precisa
     existir para poder fechar. E o mesmo padrao da gaveta de renomear. */
  const tamanhos = referencia ? tamanhosDa(referencia) : []
  const jaTem = new Map(linhas.map((c) => [c.tamanho, c]))

  async function gravar(tamanho: string) {
    if (!podeMexer || !referencia) return
    const r = rascunho[tamanho] ?? { m: '', q: '' }
    const metros = lido(r.m)
    const quilos = lido(r.q)
    const antiga = jaTem.get(tamanho)

    if (metros === (antiga?.metros ?? null) && quilos === (antiga?.quilos ?? null)) return

    setGravando(tamanho)
    try {
      if (metros === null && quilos === null) {
        if (!antiga) return
        await apagarConsumo(antiga.id)
        /* o id da referência vai junto, e não sai da lista: apagar o último
           tamanho devolve lista vazia, e uma lista vazia não diz de quem é */
        aoTrocar(referencia.id, linhas.filter((c) => c.id !== antiga.id))
        avisar(`${tamanho} saiu do consumo de ${referencia.nome}.`, 'ok')
        return
      }
      const nova = await gravarConsumo({
        referenciaId: referencia.id,
        tamanho,
        metros,
        quilos,
      })
      aoTrocar(referencia.id, [...linhas.filter((c) => c.tamanho !== tamanho), nova])
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar o consumo.', 'brand')
    } finally {
      setGravando('')
    }
  }

  return (
    <Gaveta
      aberto={!!referencia}
      aoFechar={aoFechar}
      titulo={
        referencia
          ? referencia.cod
            ? referencia.cod + ' · ' + referencia.nome
            : referencia.nome
          : ''
      }
      pe={
        <Botao tom="limpo" onClick={aoFechar}>
          Fechar
        </Botao>
      }
    >
      <p className="bd-linha-da-categoria">
        Quanto UMA peça come, por tamanho. Preencha metros ou quilos: com largura e gramatura
        cadastradas no tecido, o banco converte um no outro. Tamanho em branco entra na reserva do
        pedido como falta, e não como zero.
      </p>

      <table className="tabela bd-consumo">
        <thead>
          <tr>
            <th>Tamanho</th>
            <th className="dir">Metros</th>
            <th className="dir">Quilos</th>
          </tr>
        </thead>
        <tbody>
          {tamanhos.map((t) => {
            const r = rascunho[t] ?? { m: '', q: '' }
            const preenchido = !!(r.m.trim() || r.q.trim())
            return (
              <tr key={t} className={preenchido ? '' : 'bd-vazia'}>
                <td>
                  <b>{t}</b>
                </td>
                <td className="dir">
                  <Entrada
                    tamanho="sm"
                    inputMode="decimal"
                    className="bd-consumo-campo"
                    value={r.m}
                    placeholder="0,00"
                    disabled={!podeMexer || gravando === t}
                    aria-label={'Metros por peça no tamanho ' + t}
                    onChange={(e) =>
                      setRascunho((x) => ({ ...x, [t]: { ...r, m: e.currentTarget.value } }))
                    }
                    onBlur={() => void gravar(t)}
                  />
                </td>
                <td className="dir">
                  <Entrada
                    tamanho="sm"
                    inputMode="decimal"
                    className="bd-consumo-campo"
                    value={r.q}
                    placeholder="0,000"
                    disabled={!podeMexer || gravando === t}
                    aria-label={'Quilos por peça no tamanho ' + t}
                    onChange={(e) =>
                      setRascunho((x) => ({ ...x, [t]: { ...r, q: e.currentTarget.value } }))
                    }
                    onBlur={() => void gravar(t)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Gaveta>
  )
}
