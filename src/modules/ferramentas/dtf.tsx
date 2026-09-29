import { useEffect, useId, useState } from 'react'
import { ArrowCounterClockwise, Copy } from '@phosphor-icons/react'
import { Aviso, Botao, Cartao, Chip, Pagina, TituloCartao, avisar } from '@ds'
import {
  contaDoDtf,
  lerNumero,
  lerPrecoDoMetro,
  metragemPorExtenso,
  PRECO_DO_METRO_PADRAO,
} from '@dominio/ferramentas'
import { formatarDinheiroExato, formatarNumeroExato } from '@shared'
import './dtf.css'

/* ==========================================================================
   A CALCULADORA DE DTF.

   Quanto custa um pedaço de filme. É a conta que a arte faz dez vezes por
   dia no balcão e no WhatsApp, e que até hoje era feita de cabeça ou na
   calculadora do celular.

   ELA É SOLTA DE PROPÓSITO. Não lê pedido, não grava resultado e não mexe em
   nada do sistema. O que a pessoa digita mora só nesta tela e some quando ela
   sai. O único número que vem do banco é o preço do metro, e ele vem de
   Configurações porque é decisão da empresa, e não de quem está calculando.

   METRO E CENTÍMETRO EM DOIS CAMPOS, e não um campo só em metros. Quem mede
   filme fala "dois metros e dezesseis", e pedir "2,16" obrigaria a pessoa a
   converter antes de digitar, que é exatamente a conta que a calculadora
   existe para tirar da cabeça dela. Quem prefere "2,16" digita no campo dos
   metros e funciona igual.

   O PREÇO TAMBÉM SE MUDA AQUI, e isso não é contradição com Configurações.
   Configurações diz o preço da casa; aqui é a pergunta "e se fosse 55?", ou
   um fornecedor diferente naquele dia. Por isso o preço trocado aqui vale só
   para esta conta e a tela avisa que ele não é o da casa.
   ========================================================================== */

/* "60" vira "60,00" no campo, que é como preço se escreve */
const comoPreco = (n: number) => formatarNumeroExato(n)

export function TelaCalculadoraDeDtf() {
  const [metros, setMetros] = useState('')
  const [centimetros, setCentimetros] = useState('')

  const [daCasa, setDaCasa] = useState<number | null>(null)
  const [falhaDaCasa, setFalhaDaCasa] = useState('')
  const [preco, setPreco] = useState('')
  const [manual, setManual] = useState(false)

  useEffect(() => {
    let vivo = true
    lerPrecoDoMetro()
      .then((p) => {
        if (!vivo) return
        setDaCasa(p.preco)
      })
      .catch((e) => {
        if (!vivo) return
        /* Sem o banco, a conta continua possível com o padrão, e a tela diz
           isso em voz alta. Travar a calculadora inteira por causa de um
           número que a pessoa pode digitar à mão seria pior. */
        setDaCasa(PRECO_DO_METRO_PADRAO)
        setFalhaDaCasa(e instanceof Error ? e.message : 'sem resposta do banco')
      })
    return () => {
      vivo = false
    }
  }, [])

  /* o preço da casa só entra no campo enquanto a pessoa não mexeu nele */
  useEffect(() => {
    if (daCasa !== null && !manual) setPreco(comoPreco(daCasa))
  }, [daCasa, manual])

  const m = lerNumero(metros)
  const cm = lerNumero(centimetros)
  const p = lerNumero(preco)

  const erroM = m !== null && (Number.isNaN(m) || m < 0)
  const erroCm = cm !== null && (Number.isNaN(cm) || cm < 0)
  const erroP = p !== null && (Number.isNaN(p) || p <= 0)

  const precoValido = !erroP && p !== null ? p : null
  const conta = contaDoDtf(erroM ? 0 : (m ?? 0), erroCm ? 0 : (cm ?? 0), precoValido ?? 0)
  const temMedida = conta.centimetros > 0
  const pronta = temMedida && precoValido !== null && !erroM && !erroCm

  const vazio = !metros && !centimetros && !manual

  function limpar() {
    setMetros('')
    setCentimetros('')
    setManual(false)
    if (daCasa !== null) setPreco(comoPreco(daCasa))
  }

  /* SOMAR, e não trocar. O atalho existe para "mais meio metro" em cima do
     que já está escrito, que é como a medida cresce no balcão. Depois de
     somar, a medida volta arrumada: 2 m e 110 cm vira 3 m e 10 cm. */
  function somar(mais: number) {
    const total = conta.centimetros + mais
    const inteiros = Math.floor(total / 100)
    const sobra = Math.round((total - inteiros * 100) * 10) / 10
    setMetros(inteiros ? String(inteiros) : '')
    setCentimetros(sobra ? String(sobra).replace('.', ',') : '')
  }

  function voltarAoDaCasa() {
    setManual(false)
    if (daCasa !== null) setPreco(comoPreco(daCasa))
  }

  async function copiar() {
    /* o toLocaleString separa o R$ do número com espaço inquebrável, que em
       alguns aplicativos cola como um caractere estranho */
    const texto = formatarDinheiroExato(conta.custo).replace(/ /g, ' ')
    try {
      await navigator.clipboard.writeText(texto)
      avisar(texto + ' copiado', 'ok')
    } catch {
      avisar('Não consegui copiar. Selecione o valor e copie à mão.', 'warn')
    }
  }

  return (
    <Pagina
      acima="Ferramentas"
      titulo="Calculadora de DTF"
      sub="Quanto custa um pedaço de filme DTF. É uma conta solta: não grava nada e não mexe em pedido nenhum."
      acoes={
        <Botao onClick={limpar} disabled={vazio}>
          <ArrowCounterClockwise size={18} />
          Limpar
        </Botao>
      }
    >
      {falhaDaCasa ? (
        <Aviso tom="warn" titulo="Não consegui ler o preço de Configurações">
          A conta está usando {formatarDinheiroExato(PRECO_DO_METRO_PADRAO)} o metro, que é o
          padrão. Confira o preço antes de passar o valor para alguém. ({falhaDaCasa})
        </Aviso>
      ) : null}

      <div className="dtf-palco">
        <div className="dtf-grade">
          <Cartao className="dtf-lado">
            <TituloCartao>A medida</TituloCartao>

            <div className="dtf-medidas">
              <Numero
                rotulo="Metros"
                unidade="m"
                valor={metros}
                aoMudar={setMetros}
                erro={erroM}
                autoFocus
              />
              <span className="dtf-mais" aria-hidden="true">
                +
              </span>
              <Numero
                rotulo="Centímetros"
                unidade="cm"
                valor={centimetros}
                aoMudar={setCentimetros}
                erro={erroCm}
              />
            </div>
            {erroM || erroCm ? (
              <p className="dtf-erro">Só número, como 2 ou 2,16.</p>
            ) : null}

            <div className="dtf-atalhos" aria-label="Somar à medida">
              <span>Somar</span>
              <Chip onClick={() => somar(10)}>+10 cm</Chip>
              <Chip onClick={() => somar(50)}>+50 cm</Chip>
              <Chip onClick={() => somar(100)}>+1 m</Chip>
            </div>

            <div className="dtf-preco">
              <Numero
                rotulo="Preço do metro"
                antes="R$"
                unidade="o metro"
                valor={preco}
                aoMudar={(v) => {
                  setPreco(v)
                  setManual(true)
                }}
                erro={erroP}
                pequeno
                placeholder={daCasa === null ? 'lendo' : '0,00'}
              />
              {erroP ? (
                <p className="dtf-erro">O preço precisa ser um número maior que zero.</p>
              ) : manual && daCasa !== null ? (
                <p className="dtf-origem manual">
                  Preço manual, vale só para esta conta. O de Configurações é{' '}
                  {formatarDinheiroExato(daCasa)}.
                  <button type="button" className="dtf-voltar" onClick={voltarAoDaCasa}>
                    Voltar para ele
                  </button>
                </p>
              ) : (
                <p className="dtf-origem">
                  Vem de Configurações. Mudar aqui vale só para esta conta.
                </p>
              )}
            </div>
          </Cartao>

          <Cartao className={pronta ? 'dtf-lado dtf-resultado' : 'dtf-lado dtf-resultado apagado'}>
            <p className="dtf-sobre">Custo do DTF</p>
            <p className="dtf-valor" aria-live="polite">
              {formatarDinheiroExato(pronta ? conta.custo : 0)}
            </p>
            <p className="dtf-como">
              {pronta && precoValido !== null
                ? metragemPorExtenso(conta.centimetros) +
                  ' × ' +
                  formatarDinheiroExato(precoValido) +
                  ' o metro'
                : 'Digite a medida para ver o custo.'}
            </p>

            <Filme centimetros={pronta ? conta.centimetros : 0} />

            {pronta && conta.custoDosInteiros > 0 && conta.custoDaSobra > 0 ? (
              <dl className="dtf-partes">
                <div>
                  <dt>
                    {Math.floor(conta.centimetros / 100)}{' '}
                    {Math.floor(conta.centimetros / 100) === 1 ? 'metro inteiro' : 'metros inteiros'}
                  </dt>
                  <dd>{formatarDinheiroExato(conta.custoDosInteiros)}</dd>
                </div>
                <div>
                  <dt>mais {metragemPorExtenso(conta.centimetros % 100)}</dt>
                  <dd>{formatarDinheiroExato(conta.custoDaSobra)}</dd>
                </div>
              </dl>
            ) : null}

            <Botao bloco onClick={() => void copiar()} disabled={!pronta}>
              <Copy size={18} />
              Copiar o valor
            </Botao>
          </Cartao>
        </div>
      </div>
    </Pagina>
  )
}

/* ==========================================================================
   O CAMPO DE NÚMERO GRANDE.

   Não é a Entrada do Design System porque a pergunta dele é outra: o número
   é o assunto da tela, e ele precisa ser lido de longe, no balcão, com a
   unidade colada nele. A Entrada é um campo de formulário de 40px; este é o
   visor de uma calculadora.

   `inputMode="decimal"` abre o teclado numérico com vírgula no celular, e o
   tipo continua texto: `type="number"` do navegador recusa vírgula em metade
   dos aparelhos e desenha as setinhas que o V7 proíbe.
   ========================================================================== */

function Numero({
  rotulo,
  unidade,
  antes,
  valor,
  aoMudar,
  erro,
  pequeno,
  placeholder = '0',
  autoFocus,
}: {
  rotulo: string
  unidade: string
  antes?: string
  valor: string
  aoMudar: (v: string) => void
  erro?: boolean
  pequeno?: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  const id = useId()
  return (
    <div className={['dtf-num', pequeno ? 'pequeno' : '', erro ? 'erro' : ''].filter(Boolean).join(' ')}>
      <label htmlFor={id}>{rotulo}</label>
      <div className="dtf-caixa">
        {antes ? <span className="dtf-antes">{antes}</span> : null}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={valor}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={erro || undefined}
          onChange={(e) => aoMudar(e.target.value.replace(/[^\d.,]/g, ''))}
          onFocus={(e) => e.target.select()}
        />
        <span className="dtf-unidade">{unidade}</span>
      </div>
    </div>
  )
}

/* ==========================================================================
   O FILME.

   O desenho do pedaço medido contra a régua, em metros. Ele não enfeita: é o
   jeito de conferir a medida sem ler número. Quem digitou 216 no campo dos
   metros querendo dizer 2,16 vê na hora um rolo de duzentos metros, e
   percebe o erro antes de mandar o valor para o cliente.

   A régua cresce com a medida, e as marcas se espaçam sozinhas (1, 2, 5, 10,
   20 metros) para nunca passar de umas dez etiquetas.
   ========================================================================== */

function passoDaRegua(metros: number) {
  for (const base of [1, 10, 100, 1000]) {
    for (const k of [1, 2, 5]) {
      if (metros / (k * base) <= 10) return k * base
    }
  }
  return 10000
}

function Filme({ centimetros }: { centimetros: number }) {
  const metros = centimetros / 100
  const passo = passoDaRegua(Math.max(1, metros))
  /* a régua fecha na próxima marca, com folga para o fim do filme não
     encostar na borda */
  const vao = Math.max(passo, Math.ceil(metros / passo) * passo)
  const marcas: number[] = []
  for (let x = 0; x <= vao + 1e-9; x += passo) marcas.push(x)
  const cheio = Math.min(100, (metros / vao) * 100)

  return (
    <div className="dtf-filme" aria-hidden="true">
      <div className="dtf-trilho">
        <div className="dtf-rolo" style={{ transform: 'scaleX(' + cheio / 100 + ')' }} />
        {/* no fim exato da régua a linha do corte cairia fora do trilho, então
            ela para dois pixels antes, do lado de dentro */}
        <div
          className={cheio > 0 ? 'dtf-corte' : 'dtf-corte escondido'}
          style={{
            transform: cheio >= 100 ? 'translateX(calc(100% - 2px))' : 'translateX(' + cheio + '%)',
          }}
        />
      </div>
      <div className="dtf-regua">
        {marcas.map((x) => (
          <span key={x} style={{ left: (x / vao) * 100 + '%' }}>
            {x} m
          </span>
        ))}
      </div>
    </div>
  )
}
