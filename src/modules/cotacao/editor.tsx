import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { emEnsaio } from '@dominio/regulagem'
import { souAdmin, useSessao } from '@dominio/sessao'
import { Copy, Plus, Trash } from '@phosphor-icons/react'
import { avisar, Aviso, Botao, Esqueleto, Pagina, Vazio } from '@ds'
import {
  CaixaDeImagem,
  ModuloDeLayout,
  GradeDeTamanhos,
  blocoEmBranco,
  colarBloco,
  copiarBloco,
  temCopia,
  type Bloco,
  type Faixa,
  type Grade,
} from '@dominio/layout'
import {
  apagarCotacao,
  aprovar,
  baixarCft,
  aprovarNoBanco,
  montarKitDeTeste,
  registrarEnvio,
  travada,
  pecasDoProduto,
  salvarCotacao,
  totalDoProduto,
  type Cotacao,
  type ProdutoCotado,
} from '@dominio/cotacao'
import { AbasDoEditor } from './abas-do-editor'
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

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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

  const mudarBloco = (i: number, b: Bloco) => mudarProduto(i, (p) => ({ ...p, bloco: b }))

  function novoProduto() {
    mudar({
      produtos: [...c.produtos, { bloco: blocoEmBranco(c.produtos.length + 1), precoPorTamanho: {}, precoBase: 0 }],
    })
  }

  function colar() {
    const b = colarBloco(c.produtos.length + 1)
    if (!b) {
      avisar('Nada copiado ainda. Use Copiar num layout primeiro.', 'warn')
      return
    }
    mudar({ produtos: [...c.produtos, { bloco: b, precoPorTamanho: {}, precoBase: 0 }] })
    avisar('Layout colado como layout ' + (c.produtos.length + 1), 'ok')
  }

  function removerProduto(i: number) {
    mudar({
      produtos: c.produtos.filter((_, k) => k !== i).map((p, k) => ({ ...p, bloco: { ...p.bloco, n: k + 1 } })),
    })
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

      <div className="ct-corpo">
        {c.produtos.map((p, i) => (
          <Produto
            key={p.bloco.id}
            produto={p}
            travado={fechada}
            aoMudarBloco={(b) => mudarBloco(i, b)}
            aoMudarProduto={(troca) => mudarProduto(i, troca)}
            aoCopiar={() => {
              copiarBloco(p.bloco)
              setPodeColar(true)
              avisar('Layout copiado. Use Colar layout para repetir.', 'ok')
            }}
            aoRemover={() => removerProduto(i)}
          />
        ))}

        {!c.produtos.length ? (
          <Vazio
            titulo="Nenhum layout ainda"
            texto="Um layout é uma peça: referência, tecido, arte e grade de tamanhos."
            acao={
              <Botao tom="primario" onClick={novoProduto}>
                Primeiro layout
              </Botao>
            }
          />
        ) : !fechada ? (
          <div className="ct-mais">
            <button type="button" className="ct-mais-bt" onClick={novoProduto}>
              <Plus size={17} />
              Adicionar layout
            </button>
            {podeColar ? (
              <Botao tom="limpo" tamanho="sm" onClick={colar}>
                Colar layout
              </Botao>
            ) : null}
          </div>
        ) : null}
      </div>

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

/* --- um produto: selo, referencia, imagem, campos e grade ---------------- */
function Produto({
  produto,
  travado,
  aoMudarBloco,
  aoMudarProduto,
  aoCopiar,
  aoRemover,
}: {
  produto: ProdutoCotado
  travado?: boolean
  aoMudarBloco: (b: Bloco) => void
  aoMudarProduto: (troca: (p: ProdutoCotado) => ProdutoCotado) => void
  aoCopiar: () => void
  aoRemover: () => void
}) {
  const b = produto.bloco
  /* O SELO SAIU DAQUI. O módulo desenha o dele a partir do `bloco.n`, e desde
     a fusão o produto da cotação e o layout da ficha são a mesma peça: dois
     números para a mesma coisa era o que fazia o vendedor falar em P-02 e a
     produção em L-02 sobre a mesma camiseta. */
  const acoes = (
    <span className="ct-produto-bts">
      <button type="button" className="ct-bt-icone" onClick={aoCopiar} title="Duplicar produto">
        <Copy size={17} />
      </button>
      {!travado ? (
        <button
          type="button"
          className="ct-bt-icone risco"
          onClick={aoRemover}
          title="Remover produto"
        >
          <Trash size={17} />
        </button>
      ) : null}
    </span>
  )

  /* O MÓDULO DE LAYOUT DA v3.375 É O MESMO DOS DOIS LADOS desde a fusão. Ele
     traz consigo o que a cotação não tinha: vários tecidos com a cor de cada
     um, o cartão de design com as fileiras de etiqueta, técnica e acabamento,
     e a observação em texto rico. Ver o comentário do topo deste arquivo. */
  return (
    <section className="cartao ct-produto">
      {/* O MIOLO EXISTE POR CAUSA DA MARGEM. O corpo antigo do produto era um
          .ct-produto-corpo, e era ELE que tinha o respiro de 20px. Quando o
          corpo virou o modulo de layout, o respiro foi junto e o modulo passou
          a encostar nas quatro bordas do cartao, enquanto todos os outros
          cartoes da tela seguiam com 20px. O rodape fica de fora porque ele e
          uma faixa que atravessa o cartao inteiro e tem o respiro dele. */}
      <div className="ct-produto-miolo">
        <ModuloDeLayout
          bloco={b}
          aoMudar={aoMudarBloco}
          leitura={travado}
          acoes={acoes}
          arte={
            <CaixaDeImagem
              leitura={travado}
              imagem={b.imagem}
              arte={b.arte}
              aoMudarImagem={(img) => aoMudarBloco({ ...b, imagem: img })}
            />
          }
          /* O VALOR BASE SAIU DO MODULO. Ele era um campo a mais para dizer
             o que a coluna VALOR da tabela ja diz: escreve o valor na
             primeira linha, arrasta a alca para baixo, e todos os tamanhos
             ficam com ele. Dois lugares para o mesmo numero e um convite a
             divergencia, e quem digita num e esquece o outro descobre pelo
             total errado.

             O DADO continua vivo: orcamento antigo guardou precoBase, e ele
             segue valendo para o tamanho que nao tem valor proprio. O que
             saiu foi o campo, e nao o numero. */
          tabela={
            <GradeDeTamanhos
              leitura={travado}
              faixa={b.faixa}
              grade={b.grade}
              aoMudar={travado ? undefined : (g: Grade) => aoMudarBloco({ ...b, grade: g })}
              aoTrocarFaixa={travado ? undefined : (f: Faixa) => aoMudarBloco({ ...b, faixa: f })}
              precoBase={produto.precoBase}
              precoPorTamanho={produto.precoPorTamanho}
              aoMudarPreco={(tamanho, valor) =>
                aoMudarProduto((p) => {
                  const novo = { ...p.precoPorTamanho }
                  if (valor === null) delete novo[tamanho]
                  else novo[tamanho] = valor
                  return { ...p, precoPorTamanho: novo }
                })
              }
            />
          }
          pe={<SobreAPeca bloco={b} travado={travado} />}
        />
      </div>
      <footer className="ct-produto-pe">
        <span className="ct-selo-conta">
          {pecasDoProduto(produto)} peças
          {' · ' + dinheiro(totalDoProduto(produto))}
        </span>
      </footer>
    </section>
  )
}

/* --- os campos sobre a peça ----------------------------------------------
   PROVISÓRIO, E DE PROPÓSITO. O Henrique ainda não decidiu se estes atributos
   ficam como pílula ou como dropdown, e o encaixe existe para a decisão poder
   ser tomada olhando para a tela, e não para uma descrição.

   Eles NÃO guardam um dado novo: apontam para os mesmos campos que os cartões
   de tecido e design já mostram logo acima. Duas formas de mexer na mesma
   coisa é aceitável enquanto se escolhe uma; duas cópias do mesmo dado nunca
   seria, porque uma delas começaria a mentir no dia seguinte. */
function SobreAPeca({ bloco, travado }: { bloco: Bloco; travado?: boolean }) {
  const tecido = bloco.tecidos[0]
  const tecnicas = bloco.design.map((d) => d.tag)
  const cores = bloco.design.reduce((n, d) => n + d.cores.length, 0)

  const itens = [
    ['Tecido', bloco.tecidos.length > 1 ? bloco.tecidos.length + ' tecidos' : tecido?.nome || ''],
    ['Cor do tecido', bloco.tecidos.length > 1 ? 'por tecido' : tecido?.cor || ''],
    ['Técnica de estampa', tecnicas.length ? tecnicas.join(' + ') : ''],
    ['Cores da estampa', cores ? cores + (cores === 1 ? ' código' : ' códigos') : ''],
    ['Gênero', bloco.genero],
    ['Grade', bloco.faixa === 'infantil' ? 'Infantil' : 'Adulto'],
  ] as const

  return (
    <div className="ct-sobre">
      <span className="ct-sobre-rot">Sobre a peça</span>
      <div className="ct-sobre-itens">
        {itens.map(([rotulo, valor]) => (
          <span key={rotulo} className={valor ? 'ct-atributo' : 'ct-atributo ct-sem'}>
            <b>{rotulo}</b>
            {valor || 'a definir'}
          </span>
        ))}
      </div>
      {travado ? null : (
        <p className="ct-sobre-nota">
          Provisório: estes atributos leem o que já foi escolhido nos cartões acima. Falta decidir
          se aqui eles viram pílula ou campo com lista.
        </p>
      )}
    </div>
  )
}
