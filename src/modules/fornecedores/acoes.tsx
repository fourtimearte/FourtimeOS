import { useEffect, useState } from 'react'
import { Trash } from '@phosphor-icons/react'
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal, Seletor, avisar } from '@ds'
import {
  apagarTipoDeFornecedor,
  criarTipoDeFornecedor,
  juntarFornecedores,
  salvarFornecedor,
  type Fornecedor,
  type TipoDeFornecedor,
} from '@dominio/fornecedor'

/* ==========================================================================
   As três decisões que não cabem na ficha: bloquear, juntar e os tipos.

   Cada uma é um modal pequeno, porque cada uma pede uma confirmação com
   motivo. Nenhuma usa a caixa de confirmação do navegador.
   ========================================================================== */

/* BLOQUEAR PEDE O MOTIVO, e o motivo aparece no Verificador de Boleto na hora
   em que um boleto daquele CNPJ for conferido: "CNPJ bloqueado: boleto falso
   em março". Bloqueio sem motivo é uma trava que ninguém lembra por que
   existe. */
export function BloquearFornecedor({
  fornecedor,
  aoFechar,
  aoFeito,
}: {
  fornecedor: Fornecedor | null
  aoFechar: () => void
  aoFeito: () => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')
  useEffect(() => {
    setMotivo('')
    setFalha('')
  }, [fornecedor])

  async function bloquear() {
    if (!fornecedor || !motivo.trim() || gravando) return
    setGravando(true)
    try {
      await salvarFornecedor(fornecedor.id, { situacao: 'bloqueado', motivoDoBloqueio: motivo })
      avisar(`${fornecedor.nome} está bloqueado.`, 'ok')
      await aoFeito()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui bloquear.')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto={!!fornecedor}
      aoFechar={aoFechar}
      titulo={fornecedor ? 'Bloquear ' + fornecedor.nome : ''}
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="perigo" onClick={bloquear} disabled={!motivo.trim() || gravando} carregando={gravando}>
            Bloquear fornecedor
          </Botao>
        </>
      }
    >
      <div className="fo-form">
        <p className="fo-ajuda">
          Bloqueado, nenhum boleto deste CNPJ passa no Verificador e nenhuma entrada dele é aceita no estoque. Só
          um administrador desbloqueia.
        </p>
        <Campo rotulo="Por que bloquear">
          <AreaTexto
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
            placeholder="O que aconteceu, para quem ler isto daqui a seis meses"
          />
        </Campo>
        {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
      </div>
    </Modal>
  )
}

/* JUNTAR É PARA O MESMO FORNECEDOR CADASTRADO DUAS VEZES: o estoque criou um
   sem CNPJ e o boleto criou outro com. Quem está aberto fica; o escolhido
   some, e tudo que era dele (materiais, entradas, boletos) passa para o que
   ficou. */
export function JuntarFornecedores({
  fornecedor,
  outros,
  aoFechar,
  aoFeito,
}: {
  fornecedor: Fornecedor | null
  outros: Fornecedor[]
  aoFechar: () => void
  aoFeito: () => Promise<void>
}) {
  const [outro, setOutro] = useState('')
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')
  useEffect(() => {
    setOutro('')
    setFalha('')
  }, [fornecedor])

  const escolhido = outros.find((f) => f.id === outro)

  async function juntar() {
    if (!fornecedor || !escolhido || gravando) return
    setGravando(true)
    try {
      await juntarFornecedores(fornecedor.id, escolhido.id)
      avisar(`${escolhido.nome} agora é ${fornecedor.nome}.`, 'ok')
      await aoFeito()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui juntar.')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto={!!fornecedor}
      aoFechar={aoFechar}
      titulo={fornecedor ? 'Juntar ' + fornecedor.nome + ' com outro' : ''}
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="forte" onClick={juntar} disabled={!escolhido || gravando} carregando={gravando}>
            Juntar os dois
          </Botao>
        </>
      }
    >
      <div className="fo-form">
        <p className="fo-ajuda">
          Para quando o mesmo fornecedor foi cadastrado duas vezes. {fornecedor?.nome} fica. O outro some, e os
          materiais, as entradas e os boletos dele passam para este. Não dá para desfazer.
        </p>
        <Campo rotulo="Qual é o cadastro repetido">
          <Seletor
            campo
            bloco
            comBusca
            valor={outro}
            opcoes={outros.map((f) => ({ valor: f.id, rotulo: f.nome }))}
            aoEscolher={setOutro}
            vazio="Escolha o fornecedor que vai sumir"
          />
        </Campo>
        {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
      </div>
    </Modal>
  )
}

/* OS TIPOS. Os cinco de nascença não se apagam, porque três deles são as
   categorias do estoque. Tipo criado pela fábrica só se apaga quando nenhum
   fornecedor usa. */
export function TiposDeFornecedor({
  aberto,
  tipos,
  fornecedores,
  podeEditar,
  aoFechar,
  aoMudar,
}: {
  aberto: boolean
  tipos: TipoDeFornecedor[]
  fornecedores: Fornecedor[]
  podeEditar: boolean
  aoFechar: () => void
  aoMudar: () => Promise<void>
}) {
  const [nome, setNome] = useState('')
  const [falha, setFalha] = useState('')
  useEffect(() => {
    if (aberto) {
      setNome('')
      setFalha('')
    }
  }, [aberto])

  const quantos = (chave: string) => fornecedores.filter((f) => f.tipos.includes(chave)).length

  async function criar() {
    if (!nome.trim()) return
    try {
      await criarTipoDeFornecedor(nome, Math.max(0, ...tipos.map((t) => t.ordem)) + 10)
      setNome('')
      setFalha('')
      await aoMudar()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui criar o tipo.')
    }
  }

  async function apagar(t: TipoDeFornecedor) {
    try {
      await apagarTipoDeFornecedor(t.chave)
      setFalha('')
      await aoMudar()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui apagar o tipo.')
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Tipos de fornecedor"
      pe={<Botao onClick={aoFechar}>Fechar</Botao>}
    >
      <div className="fo-form">
        <p className="fo-ajuda">
          O tipo é a família do fornecedor, e é por ele que a lista se agrupa. Tecido, aviamento e insumo são as
          categorias do estoque.
        </p>
        <div className="fo-tipos">
          {tipos.map((t) => {
            const n = quantos(t.chave)
            return (
              <div key={t.chave} className="fo-tipo">
                <span>
                  <b>{t.nome}</b>{' '}
                  <small>
                    {n === 1 ? '1 fornecedor' : `${n} fornecedores`}
                    {t.fixo ? ' · de nascença' : ''}
                  </small>
                </span>
                {podeEditar && !t.fixo && n === 0 ? (
                  <Botao tamanho="sm" icone aria-label={'Apagar o tipo ' + t.nome} onClick={() => void apagar(t)}>
                    <Trash size={16} />
                  </Botao>
                ) : null}
              </div>
            )
          })}
        </div>
        {podeEditar ? (
          <div className="fo-novo-tipo">
            <Entrada
              value={nome}
              onChange={(e) => setNome(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void criar()
                }
              }}
              placeholder="Nome do tipo novo"
              aria-label="Nome do tipo novo"
            />
            <Botao onClick={criar} disabled={!nome.trim()}>
              Criar tipo
            </Botao>
          </div>
        ) : null}
        {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
      </div>
    </Modal>
  )
}
