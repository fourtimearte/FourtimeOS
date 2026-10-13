import { useEffect, useRef, useState } from 'react'
import {
  ChatCircleText,
  ClockCounterClockwise,
  FileText,
  Globe,
  Kanban,
  Lightning,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Trash,
  User,
} from '@phosphor-icons/react'
import { AreaTexto, Aviso, Botao, Busca, Campo, Chip, Entrada, Interruptor, Modal, Segmentado, Seletor, Vazio, avisar } from '@ds'
import { formatarData, formatarDinheiroExato, formatarDocumento, formatarTelefone } from '@shared'
import { NOME_DO_ESTADO, acharCliente, pedidosDoCliente, type Cliente, type Pedido } from '@dominio/cliente'
import { carregarCotacoes, type CotacaoNaLista } from '@dominio/cotacao'
import {
  CAMPOS_DA_MENSAGEM,
  ESTAGIOS,
  NOME_DO_ESTAGIO,
  apagarRapida,
  camposVazios,
  carregarConversa,
  carregarRapidas,
  minutosDesde,
  nomeDoLead,
  pedacosDaRapida,
  porGrupo,
  possoMexerNaRapida,
  preencherRapida,
  salvarRapida,
  semResposta,
  seloDaOrigem,
  tempoCurto,
  temFichaDoSite,
  type Estagio,
  type Lead,
  type DadosDaConversa,
  type MensagemRapida,
  type Mensagem,
} from '@dominio/funil'
import { FichaDoSite } from './inbox'
import { useWhatsApp, type Escrita } from './whatsapp-vivo'

/* ==========================================================================
   O PAINEL AO LADO DO WHATSAPP (pranchas 150 a 152, aprovadas em 12/10/2026:
   "ok, pode colocar no ar, 150 ate 152").

   O WhatsApp fica no tamanho minimo e o resto da tela e este painel: o lead
   da conversa aberta preso em cima, e duas abas embaixo (a terceira, o
   quadro do funil, saiu a pedido dele em 12/10/2026: o Quadro ja e o outro
   modo da pagina).
     - ATENDIMENTO: as mensagens rapidas (070). Enviar escreve no WhatsApp da
       conversa aberta e envia (extensao 0.4.0); Shift + clique so escreve.
     - CLIENTE: o cadastro, as cotacoes e os pedidos, o que ja aconteceu e o
       pedido do site.

   A midia da conversa (as fotos e os audios) fica de fora: ler a conversa e
   a W3, que espera a decisao do Henrique.
   ========================================================================== */

export type { Escrita }
export type Eu = { id: string; nome: string; chefe: boolean }
type Aba = 'atendimento' | 'cliente'

const comPais = (t: string) => {
  const n = t.replace(/\D/g, '')
  return n.startsWith('55') ? n : '55' + n
}

export function PainelAoLado({
  lead,
  conversa,
  pronto,
  recarregou,
  leads,
  relogio,
  podeMexer,
  eu,
  pedir,
  escrever,
  aoAbrirNoQuadro,
  aoMontarCotacao,
  aoAbrirCotacao,
  aoMover,
  aoCriarLead,
  aoVirarCliente,
  aoAbrirCliente,
  aoRegistrar,
}: {
  lead: Lead | null
  conversa: { jid: string; telefone: string; nome: string; aberta: boolean }
  pronto: boolean
  recarregou: boolean
  leads: Lead[]
  relogio: number
  podeMexer: boolean
  eu: Eu
  pedir: (telefone: string, texto?: string) => void
  escrever: (texto: string, enviar: boolean) => Promise<Escrita>
  aoAbrirNoQuadro: (l: Lead) => void
  aoMontarCotacao: (l: Lead) => void
  aoAbrirCotacao: (id: string) => void
  aoMover: (id: string, e: Estagio) => void
  aoCriarLead: (telefone: string) => void
  aoVirarCliente: (l: Lead) => void
  aoAbrirCliente: (id: string) => void
  aoRegistrar: (l: Lead, texto: string) => void
}) {
  const [aba, setAba] = useState<Aba>('atendimento')

  return (
    <aside className="fn-pa" aria-label="O painel ao lado do WhatsApp">
      <TopoDaConversa
        lead={lead}
        conversa={conversa}
        pronto={pronto}
        recarregou={recarregou}
        leads={leads}
        relogio={relogio}
        podeMexer={podeMexer}
        pedir={pedir}
        aoAbrirNoQuadro={aoAbrirNoQuadro}
        aoMontarCotacao={aoMontarCotacao}
        aoAbrirCotacao={aoAbrirCotacao}
        aoMover={aoMover}
        aoCriarLead={aoCriarLead}
        aoVirarCliente={aoVirarCliente}
        aoAbrirCliente={aoAbrirCliente}
      />
      <div className="fn-pa-abas">
        <Segmentado<Aba>
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: 'atendimento', rotulo: <span className="fn-modo"><ChatCircleText size={16} /> Atendimento</span> },
            { valor: 'cliente', rotulo: <span className="fn-modo"><User size={16} /> Cliente</span> },
          ]}
        />
        <span className="fn-pa-nota">
          {aba === 'atendimento'
            ? 'Enviar escreve no WhatsApp e envia sozinho; Shift + clique só escreve'
            : 'Tudo de quem está na conversa aberta ao lado'}
        </span>
      </div>
      <div className="fn-pa-miolo">
        {aba === 'atendimento' ? (
          <AbaAtendimento
            lead={lead}
            telefone={conversa.telefone}
            aberta={conversa.aberta}
            nomeDaConversa={conversa.nome}
            eu={eu}
            podeMexer={podeMexer}
            pedir={pedir}
            escrever={escrever}
            aoRegistrar={aoRegistrar}
          />
        ) : (
          <AbaCliente
            lead={lead}
            aoAbrirCliente={aoAbrirCliente}
            aoVirarCliente={aoVirarCliente}
            aoAbrirCotacao={aoAbrirCotacao}
            aoMontarCotacao={aoMontarCotacao}
          />
        )}
      </div>
    </aside>
  )
}

/* --- o lead da conversa aberta, preso em cima ------------------------------ */
function TopoDaConversa({
  lead: l,
  conversa,
  pronto,
  recarregou,
  leads,
  relogio,
  podeMexer,
  pedir,
  aoAbrirNoQuadro,
  aoMontarCotacao,
  aoAbrirCotacao,
  aoMover,
  aoCriarLead,
  aoVirarCliente,
  aoAbrirCliente,
}: {
  lead: Lead | null
  conversa: { jid: string; telefone: string; nome: string; aberta: boolean }
  pronto: boolean
  recarregou: boolean
  leads: Lead[]
  relogio: number
  podeMexer: boolean
  pedir: (telefone: string, texto?: string) => void
  aoAbrirNoQuadro: (l: Lead) => void
  aoMontarCotacao: (l: Lead) => void
  aoAbrirCotacao: (id: string) => void
  aoMover: (id: string, e: Estagio) => void
  aoCriarLead: (telefone: string) => void
  aoVirarCliente: (l: Lead) => void
  aoAbrirCliente: (id: string) => void
}) {
  /* W3: a conversa de um lead fica registrada nele, e o topo diz isso, para
     ninguem ser pego de surpresa (decisao do Henrique em 13/10/2026) */
  const { registro } = useWhatsApp()
  const status = (
    <p className="fn-wa-status">
      <span className={pronto ? 'fn-wa-ponto ligado' : 'fn-wa-ponto'} aria-hidden="true" />
      {pronto ? 'WhatsApp aberto aqui dentro' : 'Abrindo o WhatsApp... na primeira vez, escaneie o QR Code'}
      {recarregou ? <small>trocou de conversa recarregando</small> : null}
      {pronto && l && conversa.jid ? (
        <small>{registro.parado ? 'o registro no lead ainda não está ligado no banco' : 'esta conversa fica registrada no lead'}</small>
      ) : null}
    </p>
  )

  if (!l) {
    /* SEM LEAD, O TOPO NUNCA FICA VAZIO: quem esta esperando resposta, a um
       clique de abrir a conversa ao lado */
    const esperando = leads
      .filter((x) => x.telefone && semResposta(x, relogio))
      .sort((a, b) => minutosDesde(b.ultimaMsgEm, relogio) - minutosDesde(a.ultimaMsgEm, relogio))
      .slice(0, 6)
    return (
      <div className="fn-pa-topo">
        {status}
        <div className="fn-pa-sem">
          {!conversa.jid && !conversa.telefone ? (
            <p className="fn-in-vazio">Abra uma conversa no WhatsApp e o lead dela aparece aqui.</p>
          ) : conversa.jid.endsWith('@g.us') ? (
            <p className="fn-in-vazio">Grupo não é lead. A extensão não lê grupos.</p>
          ) : !conversa.telefone ? (
            <p className="fn-in-vazio">O WhatsApp não mostrou o número desta conversa.</p>
          ) : (
            <div className="fileira">
              <div className="pilha fn-pa-nome">
                <span className="fn-wa-rot">{formatarTelefone(conversa.telefone.replace(/^55/, ''))}</span>
                <h2 className="fn-wa-nome">Não é lead nem cliente</h2>
              </div>
              {podeMexer ? (
                <Botao tom="contorno" onClick={() => aoCriarLead(conversa.telefone)}>
                  <Plus size={16} />
                  Criar lead com este telefone
                </Botao>
              ) : null}
            </div>
          )}
          {esperando.length ? (
            <div className="fn-pa-esperando">
              <span className="fn-wa-rot">
                Esperando resposta <span className="fn-seg-n">{esperando.length}</span>
              </span>
              <div className="fileira miuda">
                {esperando.map((x) => (
                  <button key={x.id} type="button" className="fn-wa-item" onClick={() => pedir(comPais(x.telefone))}>
                    <span className="corta">{nomeDoLead(x)}</span>
                    <small className="fn-tempo atrasado">há {tempoCurto(minutosDesde(x.ultimaMsgEm, relogio))}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const esperandoHa = l.ultimaMsgEm ? tempoCurto(minutosDesde(l.ultimaMsgEm, relogio)) : ''
  return (
    <div className="fn-pa-topo">
      {status}
      <div className="fn-pa-lead">
        <span className="fn-pa-av" aria-hidden="true">
          {nomeDoLead(l).trim().slice(0, 2).toUpperCase()}
        </span>
        <div className="pilha fn-pa-nome">
          <h2 className="fn-wa-nome">{nomeDoLead(l)}</h2>
          <span className="fn-wa-apoio">
            {[l.contato, formatarTelefone(l.telefone), l.vendedorNome ? 'de ' + l.vendedorNome : 'sem dono']
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="fn-etapa">
            {seloDaOrigem(l) ? <span className="fn-origem">{seloDaOrigem(l)}</span> : null}
            {l.prioridade ? <span className="fn-origem prioridade">PRIORIDADE</span> : null}
            {l.teste ? <span className="fn-origem teste">TESTE</span> : null}
            {esperandoHa ? (
              <span className={semResposta(l, relogio) ? 'fn-tempo atrasado' : 'fn-tempo'}>
                {semResposta(l, relogio) ? 'esperando você há ' : 'última fala há '}
                {esperandoHa}
              </span>
            ) : null}
          </span>
        </div>
        <div className="fn-pa-acoes">
          {podeMexer ? (
            <Seletor
              campo
              rotulo="ETAPA"
              valor={l.estagio}
              vazio={NOME_DO_ESTAGIO[l.estagio]}
              opcoes={ESTAGIOS.map((e) => ({ valor: e, rotulo: NOME_DO_ESTAGIO[e] }))}
              aoEscolher={(e) => e && e !== l.estagio && aoMover(l.id, e as Estagio)}
            />
          ) : (
            <span className="fn-etapa">
              <span className="nome">{NOME_DO_ESTAGIO[l.estagio]}</span>
            </span>
          )}
          {l.clienteId ? (
            <Botao tom="contorno" onClick={() => aoAbrirCliente(l.clienteId)}>
              Ver cliente
            </Botao>
          ) : (
            <Botao tom="contorno" onClick={() => aoVirarCliente(l)}>
              Cadastrar cliente
            </Botao>
          )}
          <Botao tom="contorno" onClick={() => aoAbrirNoQuadro(l)}>
            <Kanban size={17} />
            Abrir no quadro
          </Botao>
          {l.cotacao ? (
            <Botao tom="primario" onClick={() => aoAbrirCotacao(l.cotacao)}>
              <FileText size={17} />
              Ver cotação
            </Botao>
          ) : (
            <Botao tom="primario" onClick={() => aoMontarCotacao(l)}>
              <FileText size={17} />
              Montar cotação
            </Botao>
          )}
        </div>
      </div>
    </div>
  )
}

/* --- aba ATENDIMENTO: as mensagens rapidas ---------------------------------- */
const MOTIVO: Record<string, string> = {
  'outra-conversa': 'A conversa aberta no WhatsApp mudou. Nada foi escrito.',
  'sem-telefone': 'O WhatsApp não mostrou o número desta conversa. Nada foi escrito.',
  'sem-campo': 'Não achei o campo de escrever do WhatsApp. A conversa está aberta?',
  'nao-escreveu': 'O WhatsApp não aceitou o texto. Tente de novo.',
  'nao-enviou': 'Escrevi no WhatsApp, mas ele não enviou. Confira e aperte Enter.',
}
const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function AbaAtendimento({
  lead,
  telefone,
  aberta,
  nomeDaConversa,
  eu,
  podeMexer,
  pedir,
  escrever,
  aoRegistrar,
}: {
  lead: Lead | null
  telefone: string
  /** ha uma conversa aberta no WhatsApp, mesmo sem o numero a vista */
  aberta: boolean
  /** o nome que o WhatsApp mostra no topo da conversa, quando nao ha lead */
  nomeDaConversa: string
  eu: Eu
  podeMexer: boolean
  pedir: (telefone: string, texto?: string) => void
  escrever: (texto: string, enviar: boolean) => Promise<Escrita>
  aoRegistrar: (l: Lead, texto: string) => void
}) {
  const [lista, setLista] = useState<MensagemRapida[]>([])
  const [semBanco, setSemBanco] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<MensagemRapida | null>(null)
  const [apagando, setApagando] = useState<MensagemRapida | null>(null)
  const [enviando, setEnviando] = useState('')

  /* LER DE NOVO: o painel fica montado enquanto a pagina estiver aberta, e
     quem abriu antes da 070 rodar ficava com a lista de antes (sem o "Nova
     mensagem") ate recarregar a pagina. Agora le de novo ao voltar para a
     aba, ao voltar para a janela e pelo "Tentar de novo". */
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    let vivo = true
    carregarRapidas()
      .then((r) => {
        if (!vivo) return
        setLista(r.mensagens)
        setSemBanco(r.semBanco)
      })
      .catch((e: unknown) => avisar(e instanceof Error ? e.message : 'Não consegui carregar as mensagens rápidas', 'warn'))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [versao])
  useEffect(() => {
    if (!semBanco) return
    const deNovo = () => setVersao((v) => v + 1)
    window.addEventListener('focus', deNovo)
    return () => window.removeEventListener('focus', deNovo)
  }, [semBanco])

  const dados = { lead, vendedor: eu.nome, total: lead?.valor, contato: nomeDaConversa }
  const termo = semAcento(busca.trim())
  const visiveis = termo
    ? lista.filter((m) => semAcento(m.titulo + ' ' + m.texto + ' ' + m.grupo).includes(termo))
    : lista
  const grupos = porGrupo(visiveis)
  const nomesDeGrupo = [...new Set(lista.map((m) => m.grupo))]
  const podeCriar = podeMexer && !semBanco && !!eu.id

  async function enviar(m: MensagemRapida, soEscrever: boolean) {
    if (!aberta && !telefone) return avisar('Abra uma conversa no WhatsApp ao lado primeiro.', 'warn')
    const texto = preencherRapida(m.texto, dados)
    const vazios = camposVazios(m.texto, dados)
    const mandar = !soEscrever && !vazios.length
    setEnviando(m.id)
    try {
      const r = await escrever(texto, mandar)
      if (r.ok && r.enviado) {
        avisar(`"${m.titulo}" enviada${lead ? ' para ' + (lead.contato || nomeDoLead(lead)) : ''}.`, 'ok')
        if (lead) aoRegistrar(lead, texto)
      } else if (r.ok) {
        avisar(
          vazios.length
            ? `Escrevi no WhatsApp, sem enviar: falta ${vazios.join(', ')} nesta conversa. Complete e aperte Enter.`
            : 'Escrevi no WhatsApp. Confira e aperte Enter.',
          vazios.length ? 'warn' : 'ok',
        )
      } else if (r.motivo === 'extensao-antiga') {
        /* a extensao de antes da 0.4.0 so sabe abrir a conversa com o texto */
        if (telefone) {
          pedir(comPais(telefone), texto)
          avisar('Sua extensão é de antes do envio automático: o texto foi escrito, aperte Enter. Atualize a extensão para enviar sozinho.', 'warn')
        } else {
          void navigator.clipboard?.writeText(texto).catch(() => {})
          avisar('Sua extensão é de antes do envio automático. Copiei o texto: cole no WhatsApp (Ctrl + V). Atualize a extensão para enviar sozinho.', 'warn')
        }
      } else {
        avisar(MOTIVO[r.motivo ?? ''] ?? 'Não consegui escrever no WhatsApp.', 'warn')
      }
    } finally {
      setEnviando('')
    }
  }

  async function gravar(m: MensagemRapida) {
    try {
      const salva = await salvarRapida(m, eu.id)
      setLista((l) => (m.id ? l.map((x) => (x.id === m.id ? salva : x)) : [...l, salva]))
      setEditando(null)
      avisar(m.id ? 'Mensagem salva.' : 'Mensagem criada.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar a mensagem', 'warn')
    }
  }

  async function apagar(m: MensagemRapida) {
    try {
      await apagarRapida(m.id)
      setLista((l) => l.filter((x) => x.id !== m.id))
      avisar('Mensagem apagada.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui apagar a mensagem', 'warn')
    } finally {
      setApagando(null)
    }
  }

  const nova: MensagemRapida = { id: '', titulo: '', texto: '', grupo: nomesDeGrupo[0] ?? 'Geral', minha: false, criadoPor: eu.id, ordem: lista.length + 1 }

  return (
    <div className="pilha fn-pa-at">
      <div className="fileira fn-pa-barra">
        <Busca
          className="fn-pa-busca"
          placeholder="Buscar mensagem"
          aria-label="Buscar mensagem rápida"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {podeCriar ? (
          <Botao tom="contorno" onClick={() => setEditando(nova)} disabled={!!editando && !editando.id}>
            <Plus size={16} />
            Nova mensagem
          </Botao>
        ) : null}
      </div>
      {semBanco ? (
        <Aviso
          tom="warn"
          acao={
            <Botao tom="contorno" tamanho="sm" onClick={() => setVersao((v) => v + 1)}>
              Tentar de novo
            </Botao>
          }
        >
          Não achei as mensagens da equipe no banco. Estas são as quatro de sempre, só para usar; criar e editar voltam quando o banco
          responder.
        </Aviso>
      ) : null}
      {editando && !editando.id ? (
        <EditorDeRapida inicial={editando} grupos={nomesDeGrupo} dados={dados} conversa={!!(aberta || telefone)} aoCancelar={() => setEditando(null)} aoSalvar={(m) => void gravar(m)} />
      ) : null}
      {carregando ? <p className="fn-in-vazio">Carregando as mensagens...</p> : null}
      {!carregando && !visiveis.length ? (
        <Vazio
          titulo={termo ? 'Nenhuma mensagem com isso' : 'Nenhuma mensagem rápida ainda'}
          texto={termo ? 'Troque a busca.' : 'Crie a primeira: a saudação, o prazo, a chave do Pix.'}
        />
      ) : null}
      {grupos.map(([g, ms]) => (
        <section key={g} className="pilha fn-pa-grupo" aria-label={g}>
          <span className="fn-wa-rot">
            <Lightning size={14} /> {g} <span className="fn-seg-n">{ms.length}</span>
          </span>
          <div className="fn-pa-msgs">
            {ms.map((m) =>
              editando?.id === m.id ? (
                <EditorDeRapida
                  key={m.id}
                  inicial={editando}
                  grupos={nomesDeGrupo}
                  dados={dados}
                  conversa={!!(aberta || telefone)}
                  aoCancelar={() => setEditando(null)}
                  aoSalvar={(x) => void gravar(x)}
                />
              ) : (
                <article key={m.id} className="fn-pa-msg">
                  <div className="pilha fn-pa-msg-texto">
                    <b>
                      {m.titulo}
                      {m.minha ? <span className="fn-origem">SÓ MINHA</span> : null}
                    </b>
                    <p>
                      <TextoPreenchido texto={m.texto} dados={dados} />
                    </p>
                  </div>
                  <div className="fn-pa-msg-acoes">
                    {possoMexerNaRapida(m, eu.id, eu.chefe) && podeMexer ? (
                      <>
                        <Botao tom="limpo" tamanho="sm" icone aria-label={'Editar ' + m.titulo} onClick={() => setEditando(m)}>
                          <PencilSimple size={16} />
                        </Botao>
                        <Botao tom="limpo" tamanho="sm" icone aria-label={'Apagar ' + m.titulo} onClick={() => setApagando(m)}>
                          <Trash size={16} />
                        </Botao>
                      </>
                    ) : null}
                    <Botao
                      tom="primario"
                      tamanho="sm"
                      disabled={(!telefone && !aberta) || enviando === m.id}
                      carregando={enviando === m.id}
                      title={telefone || aberta ? 'Enviar para a conversa aberta. Shift + clique só escreve.' : 'Abra uma conversa no WhatsApp ao lado'}
                      onClick={(e) => void enviar(m, e.shiftKey)}
                    >
                      <PaperPlaneTilt size={15} />
                      Enviar
                    </Botao>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      ))}
      <Modal
        aberto={!!apagando}
        aoFechar={() => setApagando(null)}
        titulo="Apagar a mensagem rápida?"
        pe={
          <>
            <Botao tom="limpo" onClick={() => setApagando(null)}>
              Cancelar
            </Botao>
            <Botao tom="perigo" onClick={() => apagando && void apagar(apagando)}>
              Apagar
            </Botao>
          </>
        }
      >
        <p>
          "{apagando?.titulo}" sai da lista {apagando?.minha ? 'sua' : 'da equipe inteira'}. Isso não volta.
        </p>
      </Modal>
    </div>
  )
}

/* O TEXTO COMO FICA: cada campo com o valor da conversa aberta, e o que esta
   conversa nao tem marcado no lugar, antes de apertar Enviar (pedido de
   12/10/2026, depois do "falta empresa nesta conversa"). */
function TextoPreenchido({ texto, dados }: { texto: string; dados: DadosDaConversa }) {
  return (
    <>
      {pedacosDaRapida(texto, dados).map((p, i) =>
        'campo' in p ? (
          p.valor ? (
            <span key={i} className="fn-pa-cheio">
              {p.valor}
            </span>
          ) : (
            <span key={i} className="fn-pa-falta" title={'Esta conversa não tem ' + p.rotulo}>
              {p.rotulo}
            </span>
          )
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  )
}

type AbaDoEditor = 'escrever' | 'como-fica'

function EditorDeRapida({
  inicial,
  grupos,
  dados,
  conversa,
  aoCancelar,
  aoSalvar,
}: {
  inicial: MensagemRapida
  grupos: string[]
  dados: DadosDaConversa
  /** ha uma conversa aberta no WhatsApp ao lado */
  conversa: boolean
  aoCancelar: () => void
  aoSalvar: (m: MensagemRapida) => void
}) {
  const [m, setM] = useState(inicial)
  const [aba, setAba] = useState<AbaDoEditor>('escrever')
  const caixa = useRef<HTMLTextAreaElement>(null)
  const pronta = !!m.titulo.trim() && !!m.texto.trim()
  const faltam = [...new Set(pedacosDaRapida(m.texto, dados).flatMap((p) => ('campo' in p && !p.valor ? [p.rotulo] : [])))]
  const quem = dados.lead ? dados.lead.contato || nomeDoLead(dados.lead) : dados.contato

  /* o campo entra onde o cursor esta, e o cursor fica depois dele */
  function porCampo(c: string) {
    const el = caixa.current
    const t = '{' + c + '}'
    const i = el ? el.selectionStart : m.texto.length
    const j = el ? el.selectionEnd : m.texto.length
    const novo = m.texto.slice(0, i) + t + m.texto.slice(j)
    setM({ ...m, texto: novo })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(i + t.length, i + t.length)
    })
  }

  return (
    <div className="pilha fn-pa-editor" role="group" aria-label={m.id ? 'Editar a mensagem rápida' : 'Nova mensagem rápida'}>
      <Campo rotulo="Título">
        <Entrada autoFocus maxLength={60} value={m.titulo} onChange={(e) => setM({ ...m, titulo: e.target.value })} placeholder="Ex.: Prazo de produção" />
      </Campo>
      <div className="pilha fn-pa-texto">
        <div className="fileira entre">
          <span className="fn-pa-rot" id={'rot-texto-' + (m.id || 'nova')}>
            Texto
          </span>
          <Segmentado<AbaDoEditor>
            valor={aba}
            aoMudar={setAba}
            opcoes={[
              { valor: 'escrever', rotulo: 'Escrever' },
              { valor: 'como-fica', rotulo: 'Como fica' },
            ]}
          />
        </div>
        {aba === 'escrever' ? (
          <>
            <AreaTexto
              ref={caixa}
              rows={5}
              maxLength={2000}
              aria-labelledby={'rot-texto-' + (m.id || 'nova')}
              value={m.texto}
              onChange={(e) => setM({ ...m, texto: e.target.value })}
            />
            <div className="fileira miuda">
              <span className="fn-pa-nota">Pôr no texto:</span>
              {CAMPOS_DA_MENSAGEM.map((c) => (
                <Chip key={c.campo} tamanho="sm" title={c.explica} onClick={() => porCampo(c.campo)}>
                  {c.rotulo}
                </Chip>
              ))}
            </div>
            <span className="fn-pa-nota">Os campos entre chaves se preenchem com a conversa aberta na hora de enviar.</span>
          </>
        ) : (
          <>
            <div className="fn-pa-previa" aria-live="polite">
              {m.texto.trim() ? <TextoPreenchido texto={m.texto} dados={dados} /> : <span className="fn-pa-nota">Escreva o texto para ver como fica.</span>}
            </div>
            <span className="fn-pa-nota">
              {conversa
                ? 'Como sai para a conversa aberta' + (quem ? ' (' + quem + ')' : '') + '.'
                : 'Nenhuma conversa aberta: os campos aparecem marcados.'}
              {faltam.length ? ' Nesta conversa falta ' + faltam.join(', ') + ': ao enviar, a mensagem é escrita sem ir, para você completar.' : ''}
            </span>
          </>
        )}
      </div>
      <Campo rotulo="Grupo">
        <Entrada maxLength={40} value={m.grupo} onChange={(e) => setM({ ...m, grupo: e.target.value })} placeholder="Ex.: Pagamento" />
      </Campo>
      {grupos.length ? (
        <div className="fileira miuda">
          {grupos.map((g) => (
            <Chip key={g} tamanho="sm" ligado={m.grupo === g} onClick={() => setM({ ...m, grupo: g })}>
              {g}
            </Chip>
          ))}
        </div>
      ) : null}
      <Interruptor ligado={m.minha} aoMudar={(v) => setM({ ...m, minha: v })} rotulo="Só para mim (a equipe não vê)" />
      <div className="fileira fim">
        <Botao tom="limpo" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao tom="forte" disabled={!pronta} onClick={() => aoSalvar(m)}>
          {m.id ? 'Salvar' : 'Criar mensagem'}
        </Botao>
      </div>
    </div>
  )
}

/* --- aba CLIENTE ------------------------------------------------------------ */
function AbaCliente({
  lead: l,
  aoAbrirCliente,
  aoVirarCliente,
  aoAbrirCotacao,
  aoMontarCotacao,
}: {
  lead: Lead | null
  aoAbrirCliente: (id: string) => void
  aoVirarCliente: (l: Lead) => void
  aoAbrirCotacao: (id: string) => void
  aoMontarCotacao: (l: Lead) => void
}) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [cotacoes, setCotacoes] = useState<CotacaoNaLista[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [falas, setFalas] = useState<Mensagem[]>([])
  const [carregando, setCarregando] = useState(false)
  const leadId = l?.id ?? ''
  const clienteId = l?.clienteId ?? ''

  useEffect(() => {
    let vivo = true
    setCliente(null)
    setCotacoes([])
    setPedidos([])
    setFalas([])
    if (!leadId) return
    setCarregando(true)
    void Promise.allSettled([
      clienteId ? acharCliente(clienteId) : Promise.resolve(null),
      carregarCotacoes({ leadId, clienteId }),
      clienteId ? pedidosDoCliente(clienteId) : Promise.resolve([] as Pedido[]),
      carregarConversa(leadId),
    ]).then(([c, q, p, f]) => {
      if (!vivo) return
      if (c.status === 'fulfilled') setCliente(c.value ?? null)
      if (q.status === 'fulfilled') setCotacoes(q.value)
      if (p.status === 'fulfilled') setPedidos(p.value)
      if (f.status === 'fulfilled') setFalas(f.value)
      setCarregando(false)
    })
    return () => {
      vivo = false
    }
  }, [leadId, clienteId])

  if (!l) return <Vazio titulo="Nenhum lead nesta conversa" texto="Abra no WhatsApp a conversa de um lead para ver o cliente aqui." />

  const ultimas = [...falas].reverse().slice(0, 8)
  return (
    <div className="fn-pa-cl">
      <section className="cartao cartao-pad pilha fn-pa-bloco" aria-label="O cliente">
        <h3 className="fn-pa-t">
          <User size={17} /> O cliente
        </h3>
        {cliente ? (
          <>
            <dl className="pilha fn-wa-dl">
              <Linha rotulo="Cadastro" valor={cliente.nome + (cliente.documento ? ' · ' + formatarDocumento(cliente.documento) : '')} />
              {cliente.email ? <Linha rotulo="E-mail" valor={cliente.email} /> : null}
              {cliente.cidade ? <Linha rotulo="Cidade" valor={cliente.cidade + (cliente.uf ? ', ' + cliente.uf : '')} /> : null}
              <Linha
                rotulo="Comprou"
                valor={cliente.pedidos ? `${cliente.pedidos} ${cliente.pedidos === 1 ? 'pedido' : 'pedidos'} · ${formatarDinheiroExato(cliente.total)}` : 'nunca pediu'}
              />
              {cliente.ultimoPedido ? <Linha rotulo="Último pedido" valor={formatarData(cliente.ultimoPedido)} /> : null}
            </dl>
            <Botao tom="contorno" tamanho="sm" className="fn-pa-alinha" onClick={() => aoAbrirCliente(cliente.id)}>
              Ver a ficha do cliente
            </Botao>
          </>
        ) : clienteId && carregando ? (
          <p className="fn-in-vazio">Carregando o cadastro...</p>
        ) : (
          <>
            <p className="fn-wa-apoio">Este lead ainda não é cliente cadastrado.</p>
            <Botao tom="contorno" tamanho="sm" className="fn-pa-alinha" onClick={() => aoVirarCliente(l)}>
              Cadastrar cliente
            </Botao>
          </>
        )}
      </section>

      <section className="cartao cartao-pad pilha fn-pa-bloco" aria-label="Cotações e pedidos">
        <h3 className="fn-pa-t">
          <FileText size={17} /> Cotações e pedidos <span className="fn-seg-n">{cotacoes.length + pedidos.length}</span>
        </h3>
        {cotacoes.map((c) => (
          <button key={c.id} type="button" className="fn-pa-doc" onClick={() => aoAbrirCotacao(c.id)}>
            <FileText size={18} />
            <span className="pilha">
              <b>
                {c.numero} · {formatarDinheiroExato(c.total)}
              </b>
              <small>
                {c.pecas} peças · {c.estado}
                {c.pedido ? ' · virou ' + c.pedido : ''}
              </small>
            </span>
          </button>
        ))}
        {pedidos
          .filter((p) => !cotacoes.some((c) => c.pedido === p.numero))
          .map((p) => (
            <div key={p.numero} className="fn-pa-doc">
              <FileText size={18} />
              <span className="pilha">
                <b>
                  {p.numero} · {formatarDinheiroExato(p.valor)}
                </b>
                <small>
                  {NOME_DO_ESTADO[p.estado]} · {p.pecas} peças · {formatarData(p.data)}
                </small>
              </span>
            </div>
          ))}
        {!carregando && !cotacoes.length && !pedidos.length ? (
          <>
            <p className="fn-wa-apoio">Nenhuma cotação ainda.</p>
            <Botao tom="primario" tamanho="sm" className="fn-pa-alinha" onClick={() => aoMontarCotacao(l)}>
              Montar cotação
            </Botao>
          </>
        ) : null}
      </section>

      <section className="cartao cartao-pad pilha fn-pa-bloco" aria-label="O que já aconteceu">
        <h3 className="fn-pa-t">
          <ClockCounterClockwise size={17} /> O que já aconteceu
        </h3>
        {ultimas.length ? (
          <ul className="fn-pa-tl">
            {ultimas.map((m) => (
              <li key={m.id}>
                <span>{formatarData(m.em.slice(0, 10))}</span>
                <p>
                  <b>{m.quem === 'cliente' ? 'Cliente' : m.quem === 'nos' ? 'Fourtime' : 'Sistema'}:</b>{' '}
                  {m.texto || (m.tipo === 'audio' ? 'um áudio' : m.tipo === 'imagem' ? 'uma imagem' : m.nomeDoArquivo || 'um arquivo')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fn-wa-apoio">{carregando ? 'Carregando...' : 'Nada registrado ainda neste lead.'}</p>
        )}
      </section>

      {temFichaDoSite(l) ? (
        <section className="cartao cartao-pad pilha fn-pa-bloco" aria-label="O pedido do site">
          <h3 className="fn-pa-t">
            <Globe size={17} /> O pedido do site
          </h3>
          <FichaDoSite lead={l} />
        </section>
      ) : null}
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="fn-ficha-linha">
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  )
}
