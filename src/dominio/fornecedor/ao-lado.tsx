import { useEffect, useState } from 'react'
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import { Aviso, Botao, Campo, Entrada } from '@ds'
import {
  cnpjValido,
  consultarNaReceita,
  criarFornecedor,
  limparCnpj,
  mascaraDoCnpj,
  type NaReceita,
} from './index'
import './fornecedor.css'

/* ==========================================================================
   O fornecedor novo, AO LADO do que a pessoa estava fazendo.

   Pedido do Henrique (05/10/2026): quem está cadastrando uma cor e descobre
   que o fornecedor ainda não existe não pode ter de sair dali. Um botão abre
   esta coluna na mesma tela; o fornecedor é salvo, a coluna fecha, e o
   cadastro da cor continua com ele já escolhido.

   É O MESMO CADASTRO DA PÁGINA FORNECEDORES, só o essencial: o CNPJ com a
   consulta na Receita, o nome do dia a dia, o contato, e como paga. O tipo
   não se pergunta: quem nasce no cadastro de um tecido fornece tecido. O
   resto (materiais que fornece, marcar como confiável) fica na página dele.

   Mora no domínio pelo mesmo motivo do campo de escolher: o material novo, a
   ficha da cor e a entrada de material desenham a mesma coluna.
   ========================================================================== */
export function NovoFornecedorAoLado({
  tipo,
  nomeDoTipo,
  nomeInicial = '',
  aoFechar,
  aoCriar,
}: {
  /** a chave do tipo com que ele nasce: tecido, aviamento, insumo */
  tipo: string
  nomeDoTipo: string
  /** o que a pessoa já tinha escrito na busca do fornecedor, se escreveu */
  nomeInicial?: string
  aoFechar: () => void
  /** recebe o id e o nome do fornecedor criado */
  aoCriar: (id: string, nome: string) => Promise<void> | void
}) {
  const [cnpj, setCnpj] = useState('')
  const [semCnpj, setSemCnpj] = useState(false)
  const [receita, setReceita] = useState<NaReceita | null>(null)
  const [avisoDaReceita, setAvisoDaReceita] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [nome, setNome] = useState(nomeInicial)
  const [contato, setContato] = useState('')
  const [pagamento, setPagamento] = useState('')
  const [prazo, setPrazo] = useState('')
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')

  useEffect(() => setNome(nomeInicial), [nomeInicial])

  const limpo = limparCnpj(cnpj)
  const cnpjCompleto = limpo.length === 14
  const cnpjCerto = cnpjCompleto && cnpjValido(limpo)
  const pronto = nome.trim() !== '' && (semCnpj || cnpjCerto)

  async function buscar() {
    if (!cnpjCerto || buscando) return
    setBuscando(true)
    setAvisoDaReceita('')
    const r = await consultarNaReceita(limpo)
    setBuscando(false)
    if (!r.receita) {
      setReceita(null)
      setAvisoDaReceita(r.motivo)
      return
    }
    setReceita(r.receita)
    if (!nome.trim()) setNome(r.nomeFantasia || r.receita.razaoSocial)
  }

  async function salvar() {
    if (!pronto || gravando) return
    setGravando(true)
    setFalha('')
    try {
      const id = await criarFornecedor({
        nome,
        razaoSocial: receita?.razaoSocial ?? '',
        cnpj: semCnpj ? '' : limpo,
        cidade: receita?.cidade ?? '',
        uf: receita?.uf ?? '',
        contato,
        pagamento,
        prazo,
        receita: semCnpj ? null : receita,
        entrouPor: 'estoque',
        tipos: [tipo],
      })
      await aoCriar(id, nome.trim())
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui salvar o fornecedor.')
    } finally {
      setGravando(false)
    }
  }

  return (
    <section className="fn-lado" aria-label="Novo fornecedor" data-novo-fornecedor="">
      <header className="fn-lado-topo">
        <div className="pilha colada">
          <b>Novo fornecedor</b>
          <small>
            Entra como fornecedor de {nomeDoTipo.toLowerCase()}, e o cadastro ao lado continua com
            ele escolhido.
          </small>
        </div>
        <Botao
          tom="limpo"
          tamanho="sm"
          icone
          aria-label="Fechar o novo fornecedor"
          onClick={aoFechar}
        >
          <X size={16} aria-hidden="true" />
        </Botao>
      </header>

      <div className="campo">
        <span>CNPJ</span>
        <div className="fn-lado-cnpj">
          <Campo className="fn-lado-cresce" erro={!semCnpj && cnpjCompleto && !cnpjCerto}>
            <Entrada
              value={cnpj}
              disabled={semCnpj}
              onChange={e => {
                setCnpj(mascaraDoCnpj(e.currentTarget.value))
                setReceita(null)
                setAvisoDaReceita('')
              }}
              placeholder="00.000.000/0000-00"
              aria-label="CNPJ do fornecedor novo"
            />
          </Campo>
          <Botao
            onClick={buscar}
            disabled={semCnpj || !cnpjCerto || buscando}
            carregando={buscando}
          >
            {buscando ? 'Buscando' : 'Buscar na Receita'}
          </Botao>
        </div>
        {!semCnpj && cnpjCompleto && !cnpjCerto ? (
          <span className="dica">Este CNPJ não fecha a conta dos dígitos. Confira os números.</span>
        ) : null}
        <button
          type="button"
          className="fn-lado-link"
          onClick={() => {
            setSemCnpj(s => !s)
            setReceita(null)
            setAvisoDaReceita('')
          }}
        >
          {semCnpj ? 'Ele tem CNPJ' : 'Ele não tem CNPJ, ou não sei agora'}
        </button>
      </div>

      {semCnpj ? (
        <div className="fn-lado-receita ruim">
          <WarningCircle size={22} aria-hidden="true" />
          <div>
            <b>Sem CNPJ</b>
            <small>
              Dá para pôr depois, na página Fornecedores. Sem ele, todo boleto deste fornecedor pede
              aprovação.
            </small>
          </div>
        </div>
      ) : receita ? (
        <div className="fn-lado-receita">
          <CheckCircle size={22} aria-hidden="true" />
          <div>
            <b>{receita.razaoSocial}</b>
            <small>
              {[receita.situacao, [receita.cidade, receita.uf].filter(Boolean).join(', ')]
                .filter(Boolean)
                .join(' · ')}
            </small>
          </div>
        </div>
      ) : avisoDaReceita ? (
        <div className="fn-lado-receita ruim">
          <WarningCircle size={22} aria-hidden="true" />
          <div>
            <b>{avisoDaReceita}</b>
            <small>Dá para salvar assim mesmo e consultar depois.</small>
          </div>
        </div>
      ) : null}

      <Campo rotulo="Nome no dia a dia">
        <Entrada
          value={nome}
          onChange={e => setNome(e.currentTarget.value)}
          placeholder="Como a fábrica chama este fornecedor"
        />
      </Campo>
      <Campo rotulo="Contato e WhatsApp">
        <Entrada
          value={contato}
          onChange={e => setContato(e.currentTarget.value)}
          placeholder="Nome de quem atende e o número"
        />
      </Campo>
      <div className="fn-lado-dois">
        <Campo rotulo="Como paga">
          <Entrada
            value={pagamento}
            onChange={e => setPagamento(e.currentTarget.value)}
            placeholder="Boleto, PIX"
          />
        </Campo>
        <Campo rotulo="Prazo">
          <Entrada
            value={prazo}
            onChange={e => setPrazo(e.currentTarget.value)}
            placeholder="28 dias"
          />
        </Campo>
      </div>

      {falha ? <Aviso tom="brand">{falha}</Aviso> : null}

      <div className="fn-lado-pe">
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao tom="forte" onClick={salvar} disabled={!pronto || gravando} carregando={gravando}>
          {gravando ? 'Salvando' : 'Salvar fornecedor'}
        </Botao>
      </div>
    </section>
  )
}
