import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso, Botao, Busca, Kpi, Pagina, Seletor, avisar } from '@ds'
import {
  cotacaoEmBranco,
  proximoNumero,
  salvarCotacao,
} from '@dominio/cotacao'
import {
  DADO_DE_EXEMPLO,
  ESTAGIO_FECHADO,
  esquecido,
  formatarDinheiro,
  leadEmBranco,
  listarLeads,
  moverLead,
  salvarLead,
  type Estagio,
  type Lead,
} from '@dominio/funil'
import { Conversa } from './conversa'
import { Quadro } from './quadro'
import './funil.css'

const limpar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function TelaFunil() {
  const navegar = useNavigate()
  const [versao, setVersao] = useState(0)
  const todos = useMemo(() => listarLeads(), [versao])
  const [busca, setBusca] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [soEsquecidos, setSoEsquecidos] = useState(false)
  const [naConversa, setNaConversa] = useState<Lead | null>(null)
  const hoje = useMemo(() => Date.now(), [])

  const vendedores = useMemo(
    () => [...new Set(todos.map((l) => l.vendedor).filter(Boolean))].sort(),
    [todos],
  )

  const filtrados = useMemo(() => {
    const b = limpar(busca.trim())
    return todos.filter((l) => {
      if (vendedor && l.vendedor !== vendedor) return false
      if (soEsquecidos && !esquecido(l, hoje)) return false
      if (!b) return true
      return limpar(l.nome + ' ' + l.contato + ' ' + l.cidade).includes(b)
    })
  }, [todos, busca, vendedor, soEsquecidos, hoje])

  const contas = useMemo(() => {
    const abertos = todos.filter((l) => !ESTAGIO_FECHADO.includes(l.estagio))
    const ganhos = todos.filter((l) => l.estagio === 'ganho')
    const fechados = todos.filter((l) => ESTAGIO_FECHADO.includes(l.estagio))
    return {
      abertos: abertos.length,
      valorAberto: abertos.reduce((s, l) => s + l.valor, 0),
      esquecidos: todos.filter((l) => esquecido(l, hoje)).length,
      conversao: fechados.length ? Math.round((ganhos.length / fechados.length) * 100) : 0,
    }
  }, [todos, hoje])

  function mexeu() {
    setVersao((v) => v + 1)
  }

  function mover(id: string, estagio: Estagio) {
    moverLead(id, estagio)
    mexeu()
  }

  /* A cotacao nasce do lead com o que ja se sabe do cliente, e o lead passa a
     apontar para ela. E aqui que o funil encosta na cotacao, e e so aqui: o
     modulo do funil nao sabe nada de dentro do modulo da cotacao, so do
     dominio dela. */
  function montarCotacao(l: Lead) {
    const c = cotacaoEmBranco(proximoNumero())
    c.vendedor = l.vendedor
    c.cliente = {
      ...c.cliente,
      id: l.clienteId,
      nome: l.nome,
      contato: l.contato,
      telefone: l.telefone,
      cidade: l.cidade,
    }
    salvarCotacao(c)
    salvarLead({ ...l, cotacao: c.id, estagio: l.estagio === 'novo' || l.estagio === 'contato' ? 'orcando' : l.estagio })
    mexeu()
    avisar('Cotação ' + c.numero + ' criada a partir do lead', 'ok')
    navegar('/cotacao/' + c.id)
  }

  return (
    <Pagina
      acima="Comercial"
      titulo="Funil de vendas"
      sub="A conversa que ainda não virou pedido, e de quem ela está esperando."
      acoes={
        <Botao
          tom="primario"
          onClick={() => {
            const l = salvarLead({ ...leadEmBranco(), nome: 'Novo lead', vendedor: 'Marcela' })
            mexeu()
            setNaConversa(l)
          }}
        >
          Novo lead
        </Botao>
      }
    >
      {DADO_DE_EXEMPLO ? (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <Aviso tom="info" titulo="Estes leads são inventados">
            Ninguém aqui existe. O que você mover ou escrever fica guardado neste navegador até o
            banco entrar. O botão do WhatsApp é de verdade: ele abre a conversa com o número do
            cartão, e nada é enviado sem você mandar.
          </Aviso>
        </div>
      ) : null}

      <div className="fila-kpi" style={{ marginBottom: 'var(--sp-5)' }}>
        <Kpi rotulo="Em aberto" valor={contas.abertos} sub="ainda andando no funil" />
        <Kpi rotulo="Valor em conversa" valor={formatarDinheiro(contas.valorAberto)} sub="por alto, antes da cotação" />
        <Kpi
          rotulo="Esquecidos"
          valor={contas.esquecidos}
          sub="três dias ou mais sem ninguém mexer"
          aviso={contas.esquecidos > 0}
          ligado={soEsquecidos}
          aoClicar={() => setSoEsquecidos((x) => !x)}
        />
        <Kpi rotulo="Conversão" valor={contas.conversao} unidade="por cento" sub="dos que fecharam" />
      </div>

      <div className="ct-filtros">
        <Busca
          placeholder="Nome, contato ou cidade"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Seletor
          rotulo="VENDEDOR"
          valor={vendedor}
          opcoes={vendedores.map((v) => ({ valor: v, rotulo: v }))}
          vazio="Todos"
          aoEscolher={setVendedor}
        />
      </div>

      <Quadro leads={filtrados} aoMover={mover} aoAbrir={setNaConversa} />

      <p className="fn-rodape">
        Arraste o cartão para mudar de coluna, ou use o botão de três pontos. No tablet os dois
        funcionam.
      </p>

      <Conversa
        lead={naConversa}
        aoFechar={() => setNaConversa(null)}
        aoSalvar={(l) => {
          setNaConversa(l)
          mexeu()
        }}
        aoAbrirCotacao={(id) => navegar('/cotacao/' + id)}
        aoMontarCotacao={montarCotacao}
      />
    </Pagina>
  )
}
