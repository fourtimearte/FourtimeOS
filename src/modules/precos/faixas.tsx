import { useState } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import { Botao, Chip, Entrada, Modal } from '@ds'
import {
  MAXIMO_DE_FAIXAS,
  MODELOS_DE_FAIXAS,
  conferirFaixas,
  faixasDosFins,
  nomeDaFaixa,
  type Faixa,
} from '@dominio/preco'

/* ==========================================================================
   AS FAIXAS DE QUANTIDADE, ESCRITAS DE VERDADE (prancha 141).

   Antes havia um campo "começa em" que só aceitava um número, e ninguém
   conseguia montar "1 a 30". Agora cada faixa tem DE e ATÉ: escreve-se onde
   ela acaba e a seguinte começa sozinha no número depois (sem buraco e sem
   peça sobrando); a última é sempre "ou mais". O começo da primeira é o
   pedido mínimo. Três modelos prontos. O mesmo editor serve a tabela nova e
   o "Mudar as faixas" de uma tabela que já existe.
   ========================================================================== */

export function EditorDeFaixas({ faixas, aoMudar }: { faixas: Faixa[]; aoMudar: (f: Faixa[]) => void }) {
  /* o que está sendo digitado, antes de virar número */
  const [digitando, setDigitando] = useState<Record<string, string>>({})
  const primeira = faixas[0]?.de ?? 1
  const fins = faixas.slice(0, -1).map((f) => f.ate ?? f.de)
  const erro = conferirFaixas(faixas)

  function escrever(chave: string, texto: string, aplicar: (n: number) => Faixa[]) {
    setDigitando((d) => ({ ...d, [chave]: texto }))
    const n = Number(texto.replace(/\D/g, ''))
    if (texto.trim() && Number.isInteger(n) && n > 0) aoMudar(aplicar(n))
  }
  const soltar = (chave: string) =>
    setDigitando((d) => {
      const { [chave]: _fora, ...resto } = d
      return resto
    })

  function maisUma() {
    if (faixas.length >= MAXIMO_DE_FAIXAS) return
    const ultima = faixas[faixas.length - 1]
    aoMudar(faixasDosFins(primeira, [...fins, ultima.de + Math.max(9, ultima.de - 2)]))
  }
  function tirar(i: number) {
    /* tirar a faixa i junta ela com a de baixo: some o fim dela */
    const novos = fins.filter((_, k) => k !== (i === faixas.length - 1 ? i - 1 : i))
    aoMudar(faixasDosFins(primeira, novos))
  }

  return (
    <div className="pilha pr-fx">
      <div className="fileira miuda pr-fx-modelos">
        <span className="pr-nota">Começar de um modelo:</span>
        {MODELOS_DE_FAIXAS.map((m) => (
          <Chip
            key={m.nome}
            ligado={JSON.stringify(m.faixas) === JSON.stringify(faixas)}
            onClick={() => {
              setDigitando({})
              aoMudar(m.faixas.map((f) => ({ ...f })))
            }}
          >
            {m.nome === 'Do chat da loja' ? 'Do chat da loja: ' + m.faixas.map(nomeDaFaixa).join(', ') : m.nome}
          </Chip>
        ))}
      </div>
      <div className="pr-fx-caixa" role="group" aria-label="Faixas de quantidade">
        {faixas.map((f, i) => {
          const ultima = i === faixas.length - 1
          return (
            <div className="pr-fx-l" key={i}>
              <b>Faixa {i + 1}</b>
              <span>de</span>
              {i === 0 ? (
                <Entrada
                  className="pr-fx-n"
                  inputMode="numeric"
                  aria-label="Começo da faixa 1"
                  value={digitando.de0 ?? String(f.de)}
                  onChange={(e) => escrever('de0', e.target.value, (n) => faixasDosFins(n, fins))}
                  onBlur={() => soltar('de0')}
                />
              ) : (
                <span className="pr-fx-auto" aria-label={`A faixa ${i + 1} começa em ${f.de}`}>
                  {f.de}
                </span>
              )}
              <span>até</span>
              {ultima ? (
                <span className="pr-fx-mais">ou mais</span>
              ) : (
                <Entrada
                  className="pr-fx-n"
                  inputMode="numeric"
                  aria-label={`Fim da faixa ${i + 1}`}
                  value={digitando['ate' + i] ?? String(f.ate ?? '')}
                  onChange={(e) =>
                    escrever('ate' + i, e.target.value, (n) => faixasDosFins(primeira, fins.map((x, k) => (k === i ? n : x))))
                  }
                  onBlur={() => soltar('ate' + i)}
                />
              )}
              <small className="pr-nota">
                {i === 0 ? 'o começo é o pedido mínimo' : ultima ? 'a última é sempre “ou mais”' : 'começa sozinha no número seguinte'}
              </small>
              {faixas.length > 1 ? (
                <Botao tom="limpo" tamanho="sm" icone aria-label={'Tirar a faixa ' + (i + 1)} onClick={() => tirar(i)}>
                  <X size={15} />
                </Botao>
              ) : (
                <span />
              )}
            </div>
          )
        })}
        <div className="pr-fx-add">
          <Botao tom="contorno" tamanho="sm" disabled={faixas.length >= MAXIMO_DE_FAIXAS} onClick={maisUma}>
            <Plus size={15} />
            Faixa
          </Botao>
          <span className="pr-nota">A faixa nova entra antes da última. Até {MAXIMO_DE_FAIXAS} faixas.</span>
        </div>
      </div>
      {erro ? (
        <p className="pr-fx-erro" role="alert">
          {erro}
        </p>
      ) : (
        <div className="fileira miuda">
          <span className="pr-nota">Na cotação e na folha:</span>
          {faixas.map((f) => (
            <span key={f.de} className="pr-chip">
              {nomeDaFaixa(f)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** "Mudar as faixas" de uma tabela que já existe. */
export function MudarAsFaixas({
  atuais,
  aoFechar,
  aoAplicar,
}: {
  atuais: Faixa[]
  aoFechar: () => void
  aoAplicar: (f: Faixa[]) => void
}) {
  const [faixas, setFaixas] = useState<Faixa[]>(() => atuais.map((f) => ({ ...f })))
  const erro = conferirFaixas(faixas)
  return (
    <Modal
      aberto
      largo
      fechaFora={false}
      aoFechar={aoFechar}
      titulo="As faixas de quantidade"
      pe={
        <>
          <Botao tom="limpo" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" disabled={!!erro} onClick={() => aoAplicar(faixas)}>
            Usar estas faixas
          </Botao>
        </>
      }
    >
      <div className="pilha pr-nova">
        <EditorDeFaixas faixas={faixas} aoMudar={setFaixas} />
        <p className="pr-nota">
          O preço base de cada peça fica. O que foi escrito à mão numa faixa que mudou volta para a regra. A mudança só vale
          depois do Salvar da tabela.
        </p>
      </div>
    </Modal>
  )
}
