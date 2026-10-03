import { useEffect, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { AreaTexto, Botao, Campo, Entrada, Gaveta, Segmentado, Seletor, avisar } from '@ds'
import {
  NOME_DA_CATEGORIA,
  NOME_DO_MOTIVO,
  enchimentoDoVao,
  mexerNoEstoque,
  nomeInteiro,
  quantoNaUnidade,
  type Material,
} from '@dominio/estoque'
import { criarFornecedor } from '@dominio/fornecedor'
import { EscolherFornecedor } from '@dominio/fornecedor/escolher'
import { lerNumero } from '@dominio/ferramentas'
import { diaMesEAno, idsDosFornecedores, type Fornecimento } from './apoio'
import { Bola, Vao } from './vao'

/* ==========================================================================
   A folha de movimento.

   Três motivos e não cinco: separação nasce da tela de separação e devolução
   nasce do que voltou dela. Nenhuma das duas é alguém digitando, então
   oferecer as duas aqui só criaria um caminho para o razão contar uma
   história que não aconteceu.

   O SINAL NÃO É DIGITADO. Quem escolhe "Saída" digita 8 e o sistema grava -8.

   O AJUSTE É A CONTAGEM, E NÃO A DIFERENÇA. Quem conta a prateleira sabe
   quanto achou, e não quanto falta para o número do sistema: a pessoa escreve
   o que contou e a conta de quanto ajustar é do sistema. Antes o ajuste só
   somava, e não havia como registrar a contagem que achou menos.

   OS DOIS VÃOS MOSTRAM O ANTES E O DEPOIS, porque "43 kg" não diz se isso
   resolve a compra; o tecido passando do risco do mínimo diz.
   ========================================================================== */

type MotivoDaFolha = 'entrada' | 'saida' | 'ajuste'

export function FolhaDeMovimento({
  material,
  materiais,
  fornecimento,
  aoFechar,
  aoGravar,
  aoCriarFornecedor,
}: {
  /** o material com que a folha abre; nulo fecha */
  material: Material | null
  materiais: Material[]
  fornecimento: Fornecimento
  aoFechar: () => void
  aoGravar: () => Promise<void>
  /** avisa a tela de que nasceu um fornecedor, para ela reler a lista */
  aoCriarFornecedor: () => Promise<void>
}) {
  const [escolhido, setEscolhido] = useState('')
  const [motivo, setMotivo] = useState<MotivoDaFolha>('entrada')
  const [quanto, setQuanto] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    if (!material) return
    setEscolhido(material.id)
    setMotivo('entrada')
    setQuanto('')
    setObservacao('')
  }, [material])

  const alvo = materiais.find((m) => m.id === escolhido) ?? material
  const jaFornecem = alvo ? idsDosFornecedores(fornecimento.ligacoes, alvo.id) : []

  /* trocar o material troca a sugestão: o fornecedor de sempre daquele material */
  const sugerido = jaFornecem[0] ?? ''
  useEffect(() => {
    setFornecedorId(sugerido)
  }, [escolhido, sugerido])

  const lido = lerNumero(quanto)
  const numero = lido === null || Number.isNaN(lido) ? null : lido
  const delta =
    !alvo || numero === null
      ? 0
      : motivo === 'entrada'
        ? numero
        : motivo === 'saida'
          ? -numero
          : Math.round((numero - alvo.saldo) * 1000) / 1000
  const valido =
    !!alvo && numero !== null && (motivo === 'ajuste' ? numero >= 0 && delta !== 0 : numero > 0)
  const livreDepois = alvo ? alvo.livre + delta : 0
  const saldoDepois = alvo ? alvo.saldo + delta : 0
  const saiDemais = !!alvo && valido && saldoDepois < 0

  async function gravar() {
    if (!alvo || !valido || gravando) return
    setGravando(true)
    try {
      await mexerNoEstoque(
        alvo.id,
        delta,
        motivo,
        observacao.trim(),
        '',
        motivo === 'entrada' ? fornecedorId : '',
      )
      avisar(
        `${NOME_DO_MOTIVO[motivo]} de ${quantoNaUnidade(Math.abs(delta), alvo.unidade)} em ${nomeInteiro(alvo)}.`,
        'ok',
      )
      await aoGravar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar o movimento.', 'brand')
    } finally {
      setGravando(false)
    }
  }

  const sinal = delta > 0 ? '+' : ''
  const rotuloDoBotao = !alvo || !valido
    ? 'Registrar ' + NOME_DO_MOTIVO[motivo].toLowerCase()
    : motivo === 'ajuste'
      ? `Registrar ajuste de ${sinal}${quantoNaUnidade(delta, alvo.unidade)}`
      : `Registrar ${NOME_DO_MOTIVO[motivo].toLowerCase()} de ${quantoNaUnidade(Math.abs(delta), alvo.unidade)}`

  return (
    <Gaveta
      aberto={!!material}
      aoFechar={aoFechar}
      titulo="Registrar movimento"
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            tom="primario"
            onClick={gravar}
            disabled={!valido || saiDemais || gravando}
            carregando={gravando}
          >
            {gravando ? 'Gravando' : rotuloDoBotao}
          </Botao>
        </>
      }
    >
      <div className="pilha solta">
        <Campo rotulo="Material">
          <Seletor
            campo
            bloco
            comBusca
            valor={escolhido}
            opcoes={materiais.map((m) => ({ valor: m.id, rotulo: nomeInteiro(m) }))}
            aoEscolher={(v) => v && setEscolhido(v)}
            vazio="Escolha o material"
          />
        </Campo>

        {alvo ? (
          <div className="es-antes-depois">
            <div className="es-ad-vaos">
              <span className="es-ad-vao">
                <Vao pct={enchimentoDoVao(alvo)} cor={alvo.corHex} />
                agora
              </span>
              <ArrowRight size={16} className="es-ad-seta" />
              <span className="es-ad-vao">
                <Vao
                  pct={enchimentoDoVao({ livre: valido ? livreDepois : alvo.livre, minimo: alvo.minimo })}
                  cor={alvo.corHex}
                />
                depois
              </span>
            </div>
            <div className="es-ad-texto">
              <span className="es-ad-nome">
                {alvo.categoria === 'tecido' && alvo.tecido ? alvo.tecido : alvo.nome}
              </span>
              {alvo.categoria === 'tecido' && alvo.cor ? (
                <span className="es-ad-cor">
                  <Bola cor={alvo.corHex} />
                  {alvo.cor}
                </span>
              ) : null}
              <span>
                {valido ? (
                  <>
                    Vai de <b className={alvo.livre < alvo.minimo ? 'es-pouco' : ''}>{quantoNaUnidade(alvo.livre, alvo.unidade)}</b>{' '}
                    para <b className={livreDepois < alvo.minimo ? 'es-pouco' : ''}>{quantoNaUnidade(livreDepois, alvo.unidade)}</b>{' '}
                    livres.{' '}
                    {alvo.minimo <= 0
                      ? ''
                      : livreDepois >= alvo.minimo && alvo.livre < alvo.minimo
                        ? `Passa do mínimo, que é ${quantoNaUnidade(alvo.minimo, alvo.unidade)}.`
                        : livreDepois < alvo.minimo
                          ? `Fica abaixo do mínimo, que é ${quantoNaUnidade(alvo.minimo, alvo.unidade)}.`
                          : `O mínimo é ${quantoNaUnidade(alvo.minimo, alvo.unidade)}.`}
                  </>
                ) : (
                  <>
                    Tem <b className={alvo.livre < alvo.minimo ? 'es-pouco' : ''}>{quantoNaUnidade(alvo.livre, alvo.unidade)}</b>{' '}
                    livres{alvo.reservado > 0 ? `, com ${quantoNaUnidade(alvo.reservado, alvo.unidade)} reservados` : ''}. O
                    mínimo é {quantoNaUnidade(alvo.minimo, alvo.unidade)}.
                  </>
                )}
              </span>
            </div>
          </div>
        ) : null}

        <div className="es-dois-campos">
          <Campo rotulo="Motivo">
            <Segmentado
              valor={motivo}
              aoMudar={setMotivo}
              opcoes={[
                { valor: 'entrada', rotulo: 'Entrada' },
                { valor: 'saida', rotulo: 'Saída' },
                { valor: 'ajuste', rotulo: 'Ajuste' },
              ]}
            />
          </Campo>
          <Campo
            rotulo={(motivo === 'ajuste' ? 'Contagem' : 'Quanto') + (alvo ? ', em ' + alvo.unidade : '')}
            erro={saiDemais || (quanto.trim() !== '' && numero === null)}
          >
            <Entrada
              inputMode="decimal"
              value={quanto}
              onChange={(e) => setQuanto(e.currentTarget.value)}
              placeholder="0"
              aria-label={motivo === 'ajuste' ? 'Quanto a contagem achou' : 'Quanto'}
            />
          </Campo>
        </div>
        {motivo === 'ajuste' && alvo ? (
          <p className="es-ajuda">
            Escreva quanto a contagem achou na prateleira. O sistema tem{' '}
            {quantoNaUnidade(alvo.saldo, alvo.unidade)} e lança a diferença, com o seu nome e a hora.
          </p>
        ) : null}
        {saiDemais && alvo ? (
          <p className="es-ajuda es-pouco">
            Só tem {quantoNaUnidade(alvo.saldo, alvo.unidade)} na prateleira. Se a contagem está errada, use o
            ajuste.
          </p>
        ) : null}

        {motivo === 'entrada' && fornecimento.disponivel && alvo ? (
          <div className="pilha">
            <div className="campo">
              <span className="es-campo-topo">
                Fornecedor <small>toda entrada diz de quem veio</small>
              </span>
              <EscolherFornecedor
                valor={fornecedorId}
                aoEscolher={setFornecedorId}
                fornecedores={fornecimento.fornecedores}
                jaFornecem={jaFornecem}
                tipo={alvo.categoria}
                nomeDoTipo={NOME_DA_CATEGORIA[alvo.categoria]}
                oQue={alvo.categoria === 'tecido' ? 'este tecido' : 'este material'}
                apoio={(f) =>
                  (jaFornecem.includes(f.id)
                    ? 'já fornece ' + (alvo.categoria === 'tecido' ? 'este tecido' : 'este material')
                    : 'primeira entrada dele aqui') +
                  (f.ultimaEntrada ? ' · última entrada em ' + diaMesEAno(f.ultimaEntrada) : '')
                }
                aoCriar={async (nome) => {
                  const id = await criarFornecedor({ nome, entrouPor: 'estoque', tipos: [alvo.categoria] })
                  await aoCriarFornecedor()
                  return id
                }}
              />
            </div>
            <p className="es-ajuda">
              Ao abrir, a lista mostra primeiro quem já fornece este material e deixa criar um fornecedor novo
              ali mesmo.
            </p>
          </div>
        ) : null}

        <Campo rotulo="Observação">
          <AreaTexto
            rows={3}
            value={observacao}
            onChange={(e) => setObservacao(e.currentTarget.value)}
            placeholder="O número da nota fiscal, por exemplo"
          />
        </Campo>
      </div>
    </Gaveta>
  )
}
