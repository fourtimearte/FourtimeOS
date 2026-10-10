import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { emEnsaio } from '@dominio/regulagem'
import { souAdmin, useSessao } from '@dominio/sessao'
import { avisar, Aviso, Botao, Esqueleto, Pagina, Vazio } from '@ds'
import { blocoEmBranco, colarBloco, copiarBloco, temCopia } from '@dominio/layout'
import {
  apagarCotacao,
  aprovar,
  baixarCft,
  aprovarNoBanco,
  montarKitDeTeste,
  registrarEnvio,
  travada,
  salvarCotacao,
  type Cotacao,
  type ProdutoCotado,
} from '@dominio/cotacao'
import { AbasDoEditor } from './abas-do-editor'
import { CorpoDoEditor } from './corpo-do-editor'
import { ModalDosDados } from './modal-dos-dados'
import { PerguntaDeApagar } from './pergunta-de-apagar'
import { TopoDoEditor, type Porta } from './topo-do-editor'
import './cotacao.css'
import { usarCotacao } from './usar-cotacao'

/* ==========================================================================
   O editor de cotação, no desenho fechado em 08/10/2026 (decisão 163,
   pranchas 109 e 75 do canvas; especificação em FOURTIME OS - 07, 6.1).

   Em cima, o cabeçalho com o resumo no lugar do título e os quatro botões em
   duas fileiras (topo-do-editor). Embaixo dele, a fileira das cotações
   abertas, com os três pontos e a engrenagem do administrador
   (abas-do-editor). Dados do pedido e Fechamento moram no modal
   (modal-dos-dados). A coluna fixa de 300 px da direita, com o resumo, os
   botões e o cartão Ferramentas, deixou de existir.

   Salvar é explícito, não automático: o vendedor precisa poder mexer no
   preço, olhar, e desistir.
   ========================================================================== */

/* A porta: acha a cotacao e some do caminho. Quem edita e o Editor logo
   abaixo, e ele so nasce com uma cotacao na mao. */
export function EditorDeCotacao() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const { cotacao: original, carregando, falha } = usarCotacao(id)

  if (carregando) {
    return (
      <Pagina acima="Comercial" titulo="Abrindo a cotação...">
        <Esqueleto altura={480} />
      </Pagina>
    )
  }

  if (!original) {
    return (
      <Pagina acima="Comercial" titulo={falha ? 'Não consegui abrir' : 'Cotação não encontrada'}>
        <Vazio
          titulo={falha ? 'Não consegui abrir esta cotação' : 'Esta cotação não existe mais'}
          texto={
            falha ||
            'Ela pode ter sido apagada por outra pessoa. Volte para a lista e escolha outra.'
          }
          acao={
            <Botao tom="primario" onClick={() => navegar('/cotacao')}>
              Voltar para a lista
            </Botao>
          }
        />
      </Pagina>
    )
  }

  return <Editor key={original.id} inicial={original} />
}

function Editor({ inicial }: { inicial: Cotacao }) {
  const navegar = useNavigate()
  const { estado } = useSessao()
  const admin = souAdmin(estado.fase === 'dentro' ? estado.pessoa : null)
  const [c, setC] = useState<Cotacao>(inicial)
  const [sujo, setSujo] = useState(false)
  const [podeColar, setPodeColar] = useState(() => temCopia())
  const [porta, setPorta] = useState<Porta>('')
  /* o layout aberto no corpo: um por vez, escolhido na coluna da direita */
  const [escolhido, setEscolhido] = useState(0)
  const atual = Math.min(escolhido, Math.max(0, c.produtos.length - 1))
  const [perguntaApagar, setPerguntaApagar] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [gravando, setGravando] = useState(false)
  /* Comeca falso: o kit de teste aparecendo meio segundo depois e inofensivo;
     ele aparecer indevidamente num sistema que ja esta valendo, nao. */
  const [ensaio, setEnsaio] = useState(false)
  useEffect(() => {
    let vivo = true
    emEnsaio()
      .then((e) => vivo && setEnsaio(e))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (!sujo) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  const mudar = (parte: Partial<Cotacao>) => {
    setC((x) => ({ ...x, ...parte }))
    setSujo(true)
  }

  const mudarProduto = (i: number, troca: (p: ProdutoCotado) => ProdutoCotado) =>
    mudar({ produtos: c.produtos.map((p, k) => (k === i ? troca(p) : p)) })

  function novoProduto() {
    mudar({
      produtos: [...c.produtos, { bloco: blocoEmBranco(c.produtos.length + 1), precoPorTamanho: {}, precoBase: 0 }],
    })
    setEscolhido(c.produtos.length)
  }

  /* DUPLICAR põe a cópia logo depois do layout, já aberta, e guarda também na
     cópia do navegador: dá para colar o mesmo layout em outra cotação */
  function duplicar(i: number) {
    const origem = c.produtos[i]
    if (!origem) return
    copiarBloco(origem.bloco)
    setPodeColar(true)
    const copia: ProdutoCotado = {
      ...origem,
      precoPorTamanho: { ...origem.precoPorTamanho },
      bloco: { ...origem.bloco, id: blocoEmBranco(0).id, grade: { ...origem.bloco.grade } },
    }
    const lista = [...c.produtos.slice(0, i + 1), copia, ...c.produtos.slice(i + 1)]
    mudar({ produtos: lista.map((p, k) => ({ ...p, bloco: { ...p.bloco, n: k + 1 } })) })
    setEscolhido(i + 1)
    avisar('Layout duplicado. A cópia também pode ser colada em outra cotação.', 'ok')
  }

  function colar() {
    const b = colarBloco(c.produtos.length + 1)
    if (!b) {
      avisar('Nada copiado ainda. Use Copiar num layout primeiro.', 'warn')
      return
    }
    mudar({ produtos: [...c.produtos, { bloco: b, precoPorTamanho: {}, precoBase: 0 }] })
    setEscolhido(c.produtos.length)
    avisar('Layout colado como layout ' + (c.produtos.length + 1), 'ok')
  }

  function removerProduto(i: number) {
    mudar({
      produtos: c.produtos.filter((_, k) => k !== i).map((p, k) => ({ ...p, bloco: { ...p.bloco, n: k + 1 } })),
    })
    setEscolhido(Math.max(0, i - 1))
  }

  /* GRAVAR E UMA COISA SO, E TODO MUNDO PASSA POR AQUI.

     Imprimir, baixar o .cft, enviar e aprovar comecam todos por uma ida ao
     banco que pode demorar ou falhar. Um lugar so, e quem chama recebe a
     cotacao salva ou nada, e decide o que fazer. */
  async function gravar(qual: Cotacao = c): Promise<Cotacao | null> {
    if (gravando) return null
    setGravando(true)
    try {
      const salva = await salvarCotacao(qual)
      setC(salva)
      setSujo(false)
      return salva
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar a cotação', 'warn')
      return null
    } finally {
      setGravando(false)
    }
  }

  async function salvar() {
    const salva = await gravar()
    if (salva) avisar('Cotação ' + salva.numero + ' salva', 'ok')
  }

  /* A SETA DO SALVAR (decisão 155): salva e baixa o .cft. O arquivo sai do que
     ESTA NA TELA mesmo que a gravacao falhe: ele e a ultima saida de quem esta
     com a internet caindo, e recusar o download porque o banco nao respondeu
     seria tirar a corda de quem esta afundando. */
  async function salvarEBaixar() {
    const salva = await gravar()
    baixarCft(salva ?? c)
  }

  async function apagar() {
    const numero = c.numero
    setApagando(true)
    try {
      await apagarCotacao(c.id)
      setPerguntaApagar(false)
      avisar('Cotação ' + numero + ' apagada', 'ok')
      navegar('/cotacao')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui apagar a cotação', 'warn')
    } finally {
      setApagando(false)
    }
  }

  /* A folha e feita do que esta GRAVADO, e por isso ela so abre depois de
     gravar. Abrir a folha com o banco tendo recusado mostraria ao cliente uma
     versao do documento que nao existe em lugar nenhum. */
  async function imprimir() {
    const salva = await gravar()
    if (salva) navegar('/cotacao/' + salva.id + '/folha')
  }

  /* O KIT DE TESTE, herdado do editor v3.375: seis layouts em tres folhas, com
     os casos que ja quebraram a folha. Mora na engrenagem do administrador e
     so monta com o sistema em ENSAIO, a mesma chave que faz o pedido nascer
     PD-TESTE-0001: no dia do lancamento a chave vira e ele para sozinho. */
  async function kitDeTeste() {
    if (!ensaio) return
    const nova = await montarKitDeTeste(c)
    setC(nova)
    setSujo(true)
    avisar('Kit de teste montado: 6 layouts, 3 folhas de impressão.', 'ok')
  }

  /* A FOLHA DO GALPAO. Mesma cotacao, outro leitor: ela nasce sem valor
     nenhum, e nao por um botao que alguem tem que lembrar de apertar. */
  async function verFolhaDaProducao() {
    const salva = await gravar()
    if (salva) navegar('/cotacao/' + salva.id + '/producao')
  }

  /* Enviar grava o que saiu. O total vai congelado junto: a conversa tres
     semanas depois e sobre o numero que o cliente viu, e nao sobre o de hoje.
     E o que vai para o cliente vai com valor, sempre: a folha abre com valor. */
  async function enviar() {
    const nova = registrarEnvio(c, c.cliente.contato || c.cliente.nome, '')
    const salva = await gravar(nova)
    if (!salva) return
    avisar('Envio ' + salva.enviadas.length + ' registrado. Esta é a folha que vai para ele.', 'ok')
    navegar('/cotacao/' + salva.id + '/folha')
  }

  /* O SIM DO CLIENTE ACONTECE NO BANCO, E NAO AQUI.

     Quem tira o numero do pedido e o banco, numa chamada que faz tudo de uma
     vez ou nada: numero do pedido, linha do pedido com o VENDEDOR copiado,
     cotacao aprovada e lead fechado. Duas pessoas aprovando no mesmo minuto
     nao tiram o mesmo PD. A cotacao precisa estar GRAVADA antes: o banco
     aprova uma linha que existe, e nao o que esta na tela. */
  async function dizerSim() {
    const salva = await gravar()
    if (!salva) return
    try {
      const pedido = await aprovarNoBanco(salva, salva.enviadas.length || 1)
      const nova = aprovar(salva, pedido.numero, salva.vendedor || 'admin')
      await gravar(nova)
      avisar(
        'Pedido ' +
          pedido.numero +
          ' gerado. A grade está travada a partir de agora.' +
          (pedido.teste ? ' (número de ensaio, o real sai no lançamento)' : ''),
        'ok',
      )
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui aprovar a cotação', 'warn')
    }
  }

  const fechada = travada(c)

  return (
    <div className="pagina ct-ed">
      <TopoDoEditor
        c={c}
        sujo={sujo}
        porta={porta}
        gravando={gravando}
        fechada={fechada}
        aoVoltar={() => navegar('/cotacao')}
        aoAbrir={setPorta}
        aoImprimir={() => void imprimir()}
        aoAprovar={() => void dizerSim()}
        aoFolhaDaProducao={() => void verFolhaDaProducao()}
        aoEnviar={() => void enviar()}
        aoSalvar={() => void salvar()}
        aoSalvarEBaixar={() => void salvarEBaixar()}
      />

      <AbasDoEditor
        atual={c.id}
        admin={admin}
        ensaio={ensaio}
        aoIr={(id) => navegar('/cotacao/' + id)}
        aoLista={() => navegar('/cotacao')}
        aoApagar={() => setPerguntaApagar(true)}
        aoKitDeTeste={() => void kitDeTeste()}
      />

      {fechada && c.aprovacao ? (
        <Aviso tom="ok" titulo={'Aprovada, e virou o pedido ' + c.aprovacao.pedido}>
          {c.aprovacao.quem} registrou o sim em {new Date(c.aprovacao.em).toLocaleString('pt-BR')}, sobre o envio{' '}
          {c.aprovacao.versao}. A grade e os valores estão travados a partir daqui: a produção já corta por eles, e
          mudar quantidade depois do corte é o jeito clássico de sobrar pano e faltar peça. Se o cliente mudar de
          ideia, o caminho é uma cotação nova.
        </Aviso>
      ) : null}

      {c.produtos.length ? (
        <CorpoDoEditor
          produtos={c.produtos}
          escolhido={atual}
          travado={fechada}
          podeColar={podeColar}
          aoEscolher={setEscolhido}
          aoMudarProduto={mudarProduto}
          aoAdicionar={novoProduto}
          aoColar={colar}
          aoDuplicar={duplicar}
          aoRemover={removerProduto}
        />
      ) : (
        <Vazio
          titulo="Nenhum layout ainda"
          texto="Um layout é uma peça: referência, tecido, arte e grade de tamanhos."
          acao={
            fechada ? null : (
              <Botao tom="primario" onClick={novoProduto}>
                Primeiro layout
              </Botao>
            )
          }
        />
      )}

      <ModalDosDados
        aberto={porta !== ''}
        c={c}
        travado={fechada}
        aoFechar={() => setPorta('')}
        aoConcluir={(r) => {
          setPorta('')
          if (r !== c) mudar(r)
        }}
      />
      <PerguntaDeApagar
        aberto={perguntaApagar}
        c={c}
        apagando={apagando}
        aoConfirmar={() => void apagar()}
        aoFechar={() => setPerguntaApagar(false)}
      />
    </div>
  )
}
