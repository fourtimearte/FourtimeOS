import { useEffect, useState } from 'react'
import { Trash } from '@phosphor-icons/react'
import { Botao, Campo, Entrada, Modal, Seletor, avisar } from '@ds'
import { formatarTelefone } from '@shared'
import {
  ESTAGIOS,
  NOME_DO_ESTAGIO,
  apagarLead,
  carregarDonosPossiveis,
  corDoEstagio,
  nomeDoLead,
  salvarLead,
  type DonoPossivel,
  type Estagio,
  type Lead,
} from '@dominio/funil'

/* ==========================================================================
   Criar e editar um lead.

   POR QUE ISTO EXISTIA COMO BURACO. Até 24/09 não havia como cadastrar um lead
   pela tela, nem mudar nome, telefone, valor ou dono: todo lead que existia
   tinha vindo da semente. O funil era uma vitrine de dados de demonstração.

   Enquanto o WhatsApp oficial não entra, quem recebe a conversa é o celular de
   uma pessoa, e alguém precisa poder trazer essa conversa para dentro. Sem
   isso, a fábrica continua com o funil de verdade no WhatsApp e este aqui como
   enfeite.

   O DONO SAI DA EQUIPE DE VERDADE, e não da lista de cinco nomes escrita à mão
   em dominio/banco. Aquela lista é texto; o dono do lead é a primeira ponta da
   corrente que leva até o pedido, e corrente que começa num texto não chega em
   ninguém.
   ========================================================================== */

export function EditarLead({
  lead,
  podeApagar,
  aoFechar,
  aoSalvar,
  aoApagar,
}: {
  /* null significa fechado. O lead em branco é um Lead com id vazio, e não um
     null: assim o formulário é um só, e criar e editar não viram dois
     caminhos que divergem com o tempo. */
  lead: Lead | null
  podeApagar: boolean
  aoFechar: () => void
  aoSalvar: (l: Lead) => void
  aoApagar: (id: string) => void
}) {
  const [rascunho, setRascunho] = useState<Lead | null>(lead)
  const [donos, setDonos] = useState<DonoPossivel[]>([])
  const [gravando, setGravando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  /* TUDO NASCE DE NOVO A CADA ABERTURA, e `gravando` junto.

     O rascunho é o motivo óbvio: guardar o que a pessoa digitou e mostrar no
     próximo lead é o jeito clássico de gravar o telefone de um no cadastro do
     outro.

     `gravando` é o motivo que só o teste achou. Ele é ligado antes de gravar e
     só volta a false quando a gravação FALHA: no sucesso quem fecha o modal é
     o pai, e o estado fica ligado aqui dentro. Criar um lead e abrir outro em
     seguida mostrava "Gravando..." para sempre, com Salvar e Apagar mortos, e
     a única saída era recarregar a página. A foto do teste mostrou o botão
     preso; a medida sozinha só dizia que a confirmação não aparecia. */
  useEffect(() => {
    setRascunho(lead)
    setConfirmando(false)
    setGravando(false)
  }, [lead])

  useEffect(() => {
    if (!lead) return
    let vivo = true
    carregarDonosPossiveis()
      .then((d) => vivo && setDonos(d))
      .catch(() => vivo && setDonos([]))
    return () => {
      vivo = false
    }
  }, [lead])

  if (!lead || !rascunho) return null

  const novo = !rascunho.id
  const r = rascunho
  const mexer = (mudanca: Partial<Lead>) => setRascunho({ ...r, ...mudanca })

  /* O NOME É O ÚNICO OBRIGATÓRIO, e o banco concorda: a única trava da tabela
     é `lead_nome_nao_vazio`. Telefone parece obrigatório e não é: muita
     conversa começa por Instagram, e exigir telefone faria a pessoa inventar
     um para conseguir salvar. */
  const nomeVazio = !r.nomeLivre.trim()

  async function gravar() {
    if (nomeVazio || gravando) return
    setGravando(true)
    try {
      const salvo = await salvarLead(r)
      avisar(novo ? 'Lead criado' : 'Lead salvo', 'ok')
      aoSalvar(salvo)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui gravar o lead', 'warn')
      setGravando(false)
    }
  }

  async function apagar() {
    if (gravando) return
    setGravando(true)
    try {
      await apagarLead(r.id)
      avisar(nomeDoLead(r) + ' foi apagado', 'ok')
      aoApagar(r.id)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui apagar o lead', 'warn')
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={novo ? 'Novo lead' : nomeDoLead(r)}
      pe={
        <>
          {/* APAGAR FICA NO RODAPÉ, À ESQUERDA, longe de Salvar. Botão que não
              tem volta não divide vizinhança com o botão que a pessoa aperta
              cem vezes por dia. */}
          {podeApagar && !novo ? (
            <Botao tom="limpo" disabled={gravando} onClick={() => setConfirmando(true)}>
              <Trash size={16} />
              Apagar
            </Botao>
          ) : null}
          <Botao tom="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tom="primario" disabled={gravando || nomeVazio} onClick={() => void gravar()}>
            {gravando ? 'Gravando...' : novo ? 'Criar lead' : 'Salvar'}
          </Botao>
        </>
      }
    >
      {confirmando ? (
        <div className="fn-apagar">
          <b>Apagar {nomeDoLead(r)}?</b>
          <p>
            A conversa inteira vai junto, com os áudios, e não tem como trazer de volta. Lead que
            não deu em nada normalmente vai para <b>Perdido</b>, que some da vista sem sumir do
            histórico.
          </p>
          <div className="fn-apagar-botoes">
            <Botao tom="primario" disabled={gravando} onClick={() => void apagar()}>
              Apagar mesmo assim
            </Botao>
            <Botao tom="limpo" onClick={() => setConfirmando(false)}>
              Voltar
            </Botao>
          </div>
        </div>
      ) : null}

      <div className="fn-form">
        <Campo rotulo="Nome" erro={nomeVazio} dica={nomeVazio ? 'O nome é obrigatório' : undefined}>
          <Entrada
            value={r.nomeLivre}
            placeholder="Como a conversa chegou: Futsal Vila Nova"
            onChange={(e) => mexer({ nomeLivre: e.target.value })}
          />
        </Campo>

        <Campo rotulo="Contato">
          <Entrada
            value={r.contato}
            placeholder="A pessoa que fala: Rafa"
            onChange={(e) => mexer({ contato: e.target.value })}
          />
        </Campo>

        {/* O TELEFONE É GRAVADO SÓ COM DÍGITOS e desenhado formatado. Guardar
            "(62) 99999-0001" faria a busca por telefone depender de a pessoa
            ter digitado o parêntese, e o índice do banco já procura pelos
            últimos oito dígitos. */}
        <Campo rotulo="Telefone" dica="É por ele que o WhatsApp abre">
          <Entrada
            value={formatarTelefone(r.telefone)}
            placeholder="(62) 99999-0000"
            inputMode="tel"
            onChange={(e) => mexer({ telefone: e.target.value.replace(/\D/g, '').slice(0, 13) })}
          />
        </Campo>

        <Campo rotulo="Valor em negociação" dica="O que este lead vale se fechar">
          <Entrada
            value={r.valor ? String(r.valor).replace('.', ',') : ''}
            placeholder="0"
            inputMode="decimal"
            onChange={(e) => {
              const limpo = e.target.value.replace(/[^\d,.]/g, '').replace(',', '.')
              mexer({ valor: Number(limpo) || 0 })
            }}
          />
        </Campo>

        <Campo rotulo="Estágio">
          <Seletor
            campo
            bloco
            comBusca={false}
            valor={r.estagio}
            cor={corDoEstagio(r.estagio)}
            opcoes={ESTAGIOS.map((e) => ({ valor: e, rotulo: NOME_DO_ESTAGIO[e] }))}
            vazio="Novo lead"
            aoEscolher={(v) => mexer({ estagio: (v || 'novo') as Estagio })}
          />
        </Campo>

        {/* DE QUEM É O LEAD. É esta linha que faz a venda ser creditada à
            pessoa certa lá no fim: lead.vendedor_id vira cotacao.vendedor_id,
            que vira pedido.vendedor_id. */}
        <Campo
          rotulo="Dono do lead"
          dica={
            donos.length
              ? 'A venda segue o dono, e não o telefone'
              : 'Ninguém aprovado ainda: cadastre a equipe em Configurações'
          }
        >
          <Seletor
            campo
            bloco
            valor={r.vendedorId}
            opcoes={donos.map((d) => ({ valor: d.id, rotulo: d.nome }))}
            vazio="Sem dono"
            aoEscolher={(v) => mexer({ vendedorId: v })}
          />
        </Campo>
      </div>
    </Modal>
  )
}
