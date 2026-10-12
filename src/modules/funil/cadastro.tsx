import { useEffect, useState } from 'react'
import { Botao, Modal, avisar } from '@ds'
import { formatarDocumento, formatarTelefone } from '@shared'
import {
  acharCliente,
  carregarClientes,
  clienteEmBranco,
  clientesParecidos,
  type Cliente,
  type Segmento,
} from '@dominio/cliente'
import { leadViraCliente, nomeDoLead, type Lead } from '@dominio/funil'
import { FichaDoCliente } from '../clientes'

/* ==========================================================================
   O CLIENTE QUE NASCE DO LEAD (pedido do Henrique, 12/10/2026).

   Antes, "Criar cliente" gravava so nome, contato e celular, e o cabecalho da
   cotacao saia pela metade. Agora:
     1. procura na base quem ja pode ser este cliente (mesmo telefone, mesmo
        nome). Achou: a tela oferece LIGAR o lead a ele, em vez de criar o
        segundo cadastro da mesma pessoa;
     2. nao achou (ou a pessoa escolheu "Cadastrar novo"): abre a MESMA ficha
        da tela de Clientes, ja preenchida com o que o lead sabe, e quem grava
        e o banco (067), que cria o cliente e liga o lead na mesma conta.
   ========================================================================== */

/* para quem e o pedido, no chat da loja, vira o segmento do cadastro */
const SEGMENTO_DA_FINALIDADE: Record<string, Segmento> = {
  time: 'time',
  escola: 'escola',
  empresa: 'empresa',
  evento: 'evento',
  academia: 'academia',
  outro: 'outros',
}

/* o telefone do lead pode vir como +55 e o numero; o do cliente e DDD e numero */
function celularDoLead(t: string): string {
  const n = (t || '').replace(/\D/g, '')
  return (n.length === 12 || n.length === 13) && n.startsWith('55') ? n.slice(2) : n
}

export function cadastroDoLead(l: Lead): Cliente {
  const finalidade = typeof l.briefing.finalidade === 'string' ? l.briefing.finalidade : ''
  return {
    ...clienteEmBranco(),
    nome: nomeDoLead(l),
    contato: l.contato,
    celular: celularDoLead(l.telefone),
    email: l.email,
    segmento: SEGMENTO_DA_FINALIDADE[finalidade] ?? 'outros',
    vendedor: l.vendedorNome,
  }
}

export function CadastroDoLead({
  lead,
  aoFechar,
  aoCadastrar,
}: {
  lead: Lead
  aoFechar: () => void
  /** o lead ficou ligado a este cliente; `novo` diz se o cadastro nasceu agora */
  aoCadastrar: (clienteId: string, novo: boolean) => void
}) {
  const [base, setBase] = useState<Cliente[] | null>(null)
  const [parecidos, setParecidos] = useState<Cliente[]>([])
  const [novo, setNovo] = useState(false)
  const [ligando, setLigando] = useState('')

  useEffect(() => {
    let vivo = true
    carregarClientes()
      .then((lista) => {
        if (!vivo) return
        setBase(lista)
        setParecidos(clientesParecidos(lista, nomeDoLead(lead), lead.telefone))
      })
      /* sem a base, nao da para procurar: segue direto para o cadastro, e a
         trava do nome no banco continua valendo */
      .catch(() => vivo && setBase([]))
    return () => {
      vivo = false
    }
  }, [lead])

  async function ligar(c: Cliente) {
    if (ligando) return
    setLigando(c.id)
    try {
      const id = await leadViraCliente(lead.id, { clienteId: c.id })
      aoCadastrar(id, false)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui ligar o lead ao cliente', 'warn')
      setLigando('')
    }
  }

  if (!base) {
    return (
      <Modal aberto aoFechar={aoFechar} titulo="Cadastrar cliente">
        <p className="fn-cad-apoio">Procurando na base de clientes...</p>
      </Modal>
    )
  }

  if (parecidos.length && !novo) {
    return (
      <Modal
        aberto
        aoFechar={aoFechar}
        titulo="Este cliente já pode estar cadastrado"
        pe={
          <>
            <Botao tom="limpo" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao tom="contorno" onClick={() => setNovo(true)}>
              Cadastrar novo
            </Botao>
          </>
        }
      >
        <p className="fn-cad-apoio">
          Achei {parecidos.length === 1 ? 'um cadastro parecido' : 'cadastros parecidos'} com{' '}
          <b>{nomeDoLead(lead)}</b>. Se for a mesma pessoa, ligue o lead ao cadastro que já existe.
        </p>
        <ul className="fn-cad-lista">
          {parecidos.map((c) => (
            <li key={c.id} className="fn-cad-item">
              <div className="pilha">
                <b className="corta">{c.nome}</b>
                <small>
                  {[
                    formatarTelefone(c.celular || c.telefone),
                    c.cidade ? c.cidade + (c.uf ? ', ' + c.uf : '') : '',
                    c.documento ? formatarDocumento(c.documento) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'cadastro sem telefone nem cidade'}
                </small>
              </div>
              <Botao tom="primario" tamanho="sm" disabled={!!ligando} onClick={() => void ligar(c)}>
                {ligando === c.id ? 'Ligando...' : 'Ligar a este'}
              </Botao>
            </li>
          ))}
        </ul>
      </Modal>
    )
  }

  return (
    <FichaDoCliente
      cliente={cadastroDoLead(lead)}
      base={base}
      titulo="Cadastrar cliente do lead"
      aoFechar={aoFechar}
      gravar={async (c) => {
        const id = await leadViraCliente(lead.id, { cadastro: c })
        const salvo = await acharCliente(id)
        if (!salvo) throw new Error('Cadastrei, mas não consegui ler o cliente de volta.')
        return salvo
      }}
      aoSalvar={(c) => aoCadastrar(c.id, true)}
    />
  )
}
