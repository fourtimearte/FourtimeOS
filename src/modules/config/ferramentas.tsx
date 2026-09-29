import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso, Botao, Campo, Cartao, Entrada, Esqueleto, Pagina, TituloCartao, avisar } from '@ds'
import { gravarPrecoDoMetro, lerNumero, lerPrecoDoMetro, type PrecoDoMetro } from '@dominio/ferramentas'
import { souAdmin, useSessao } from '@dominio/sessao'
import { AbasDaConfig } from './abas'
import './config.css'

/* ==========================================================================
   Os números das ferramentas.

   Hoje é um só: quanto custa o metro de DTF. A calculadora de Ferramentas
   abre com ele, e quem está calculando pode trocar na hora sem mexer aqui.

   ELE VALE PARA A FÁBRICA INTEIRA, e por isso mora no banco e não no
   navegador. Guardado por computador, a arte cobraria um preço e o comercial
   outro, e ninguém saberia qual dos dois estava certo.

   SÓ O ADMINISTRADOR GRAVA. A regra é do banco, da mesma regulagem que liga o
   ensaio e esconde página; a tela só não oferece o botão a quem o banco ia
   recusar.
   ========================================================================== */

/* "29/09/2026 às 14:30": o dia e a hora da última mudança do preço */
function quando(iso: string) {
  return new Date(iso)
    .toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(', ', ' às ')
}

export function TelaConfigDeFerramentas() {
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const admin = souAdmin(pessoa)

  const [lido, setLido] = useState<PrecoDoMetro | null>(null)
  const [texto, setTexto] = useState('')
  const [falha, setFalha] = useState('')
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    let vivo = true
    lerPrecoDoMetro()
      .then((p) => {
        if (!vivo) return
        setLido(p)
        setTexto(p.preco.toFixed(2).replace('.', ','))
      })
      .catch((e) => vivo && setFalha(e instanceof Error ? e.message : 'Não consegui ler o preço'))
    return () => {
      vivo = false
    }
  }, [])

  const n = lerNumero(texto)
  const invalido = n === null || Number.isNaN(n) || n <= 0
  const sujo = !!lido && !invalido && Math.round((n as number) * 100) !== Math.round(lido.preco * 100)

  async function gravar() {
    if (invalido || n === null) return
    setGravando(true)
    try {
      const p = await gravarPrecoDoMetro(n)
      setLido(p)
      setTexto(p.preco.toFixed(2).replace('.', ','))
      setFalha('')
      avisar('Preço do metro de DTF salvo', 'ok')
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui gravar')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Pagina
      acima="Configurações"
      titulo="Ferramentas"
      sub="Os números que as ferramentas usam. Eles valem para todos os computadores da fábrica."
      acoes={
        admin ? (
          <Botao
            tom="primario"
            onClick={() => void gravar()}
            disabled={!sujo || gravando}
            carregando={gravando}
          >
            {sujo ? 'Salvar' : 'Salvo'}
          </Botao>
        ) : null
      }
    >
      <AbasDaConfig atual="ferramentas" />

      {falha ? <Aviso tom="warn">{falha}</Aviso> : null}

      {!admin ? (
        <Aviso tom="info" titulo="Só o administrador muda estes números">
          Você enxerga o preço que a calculadora usa, mas quem grava é o administrador. Na
          calculadora dá para trocar o preço na hora, só para aquela conta.
        </Aviso>
      ) : null}

      <Cartao>
        <TituloCartao>Calculadora de DTF</TituloCartao>
        {!lido && !falha ? (
          <Esqueleto altura={64} />
        ) : (
          <div className="cfg-grade">
            <Campo
              rotulo="Custo do metro de DTF (R$)"
              erro={!!texto && invalido}
              dica={
                !!texto && invalido
                  ? 'Um número maior que zero, como 60 ou 62,50.'
                  : 'A calculadora abre com este preço.'
              }
            >
              <Entrada
                value={texto}
                inputMode="decimal"
                placeholder="60,00"
                readOnly={!admin}
                onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && sujo) void gravar()
                }}
              />
            </Campo>
          </div>
        )}
        <p className="cfg-nada">
          {lido?.gravado && lido.atualizadoEm
            ? 'Última mudança em ' + quando(lido.atualizadoEm) + '. '
            : lido && !lido.gravado
              ? 'Ninguém gravou um preço ainda: a calculadora está usando o padrão de R$ 60,00. '
              : ''}
          <Link to="/ferramentas/dtf">Abrir a calculadora</Link>
        </p>
      </Cartao>
    </Pagina>
  )
}
