import { useState } from 'react'
import { ArrowSquareOut, Browser, Copy, Handshake } from '@phosphor-icons/react'
import {
  Botao,
  Campo,
  CampoDeData,
  Entrada,
  Interruptor,
  Aviso,
  Modal,
  Segmentado,
  Seletor,
  TituloCartao,
  avisar,
} from '@ds'
import { hojeEmData, quandoFoi } from '@shared'
import {
  NOME_DA_BASE,
  NOME_DO_TIPO,
  dataNaLoja,
  lerNumero,
  linkDaPagina,
  mesmoAcordo,
  numeroNoCampo,
  relerProdutos,
  salvarAcordo,
  salvarParceiro,
  trocarLink,
  trocarSenha,
  type Acordo,
  type BaseDoAcordo,
  type Colecao,
  type Parceiro,
  type TipoDeAcordo,
  type VendaDoParceiro,
} from '@dominio/parceiro'
import { plural } from './apoio'

/* ==========================================================================
   A aba "Acordo e página" de um parceiro: o cadastro, o acordo e a página dele.

   É onde o Henrique diz quanto cada parceiro recebe. O acordo tem data: o que
   foi vendido antes dela continua com o acordo anterior.

   O LINK E A SENHA NASCEM NO BANCO, quando o parceiro é salvo pela primeira
   vez. A tela só mostra, copia e pede outro. Trocar qualquer um dos dois vale
   na hora, e por isso pergunta antes.

   DOIS CARTÕES E UM PÉ. "Acordo" de um lado, "Página do parceiro" do outro, e
   embaixo dos dois "Abrir a página" e "Salvar". Copiar o link e abrir a página
   moram só aqui: saíram do cabeçalho do parceiro na versão 2 do wireframe, de
   04/10/2026, para a tela ter duas fileiras de controle em vez de quatro. O
   parceiro novo usa os mesmos dois cartões, sem as abas em cima.
   ========================================================================== */

type Pergunta =
  | { tipo: 'senha' }
  | { tipo: 'link' }
  | { tipo: 'acordo'; texto: string; acordo: Acordo; id: string }
  | null

export function FichaDoParceiro({
  parceiro,
  vendas,
  novo,
  podeEditar,
  colecoes,
  semColecoes,
  hoje,
  aoDesistir,
  aoSalvo,
  aoMudar,
}: {
  /** o parceiro aberto; nulo quando é um cadastro novo */
  parceiro: Parceiro | null
  /** as vendas dele, para dizer quantas ficam de fora da data do acordo */
  vendas?: VendaDoParceiro[]
  novo: boolean
  podeEditar: boolean
  colecoes: Colecao[]
  /** o porteiro não devolveu as coleções da loja: a ficha diz, e não cai */
  semColecoes: string
  hoje: Date
  /** desistir do cadastro novo: volta para a visão geral */
  aoDesistir: () => void
  /** salvou: a lista é relida e a ficha passa a ser a do id devolvido */
  aoSalvo: (id: string) => Promise<void>
  /** a senha ou o link mudou: só reler */
  aoMudar: () => Promise<void>
}) {
  const acordoDeAgora = parceiro?.ultimo ?? null

  const [nome, setNome] = useState(parceiro?.nome ?? '')
  const [colecao, setColecao] = useState(parceiro?.colecao ?? '')
  const [tipo, setTipo] = useState<TipoDeAcordo>(acordoDeAgora?.tipo ?? 'percentual')
  const [valor, setValor] = useState(
    acordoDeAgora ? numeroNoCampo(acordoDeAgora.valor, acordoDeAgora.tipo) : '',
  )
  const [base, setBase] = useState<BaseDoAcordo>(acordoDeAgora?.base ?? 'valor_pago')
  const [desde, setDesde] = useState(acordoDeAgora?.desde ?? hojeEmData(hoje))
  const [ativo, setAtivo] = useState(parceiro ? parceiro.ativo : false)
  const [mostrando, setMostrando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [pergunta, setPergunta] = useState<Pergunta>(null)
  const [respondendo, setRespondendo] = useState(false)

  /* A loja devolve só o endereço e o nome de cada coleção. A contagem que
     aparece é a dos produtos que o sistema já leu da coleção DESTE parceiro,
     e por isso só a coleção dele traz número. Ela aparece na lista mesmo
     quando a loja não respondeu, ou quando a coleção saiu de lá. */
  const comContagem = (nome: string) =>
    `${nome} (${plural(parceiro?.produtos ?? 0, 'produto', 'produtos')})`
  const opcoes = colecoes.map(c => ({
    valor: c.colecao,
    rotulo: c.colecao === parceiro?.colecao ? comContagem(c.nome) : c.nome,
  }))
  if (parceiro?.colecao && !opcoes.some(o => o.valor === parceiro.colecao)) {
    opcoes.unshift({
      valor: parceiro.colecao,
      rotulo: comContagem(parceiro.colecaoNome || parceiro.colecao),
    })
  }
  const nomeDaColecao =
    colecoes.find(c => c.colecao === colecao)?.nome ??
    (colecao === parceiro?.colecao ? parceiro.colecaoNome : '')

  const numero = lerNumero(valor)
  const semValor = valor.trim() === ''
  const valorRuim = !semValor && (numero === null || (tipo === 'percentual' && numero > 100))
  /* quem já tem acordo não fica sem: apagar o campo não apaga o acordo */
  const faltaValor = semValor && !!acordoDeAgora
  const acordoNovo: Acordo | null =
    numero !== null && !valorRuim && desde ? { tipo, valor: numero, base, desde } : null
  const valido = nome.trim() !== '' && !valorRuim && !faltaValor && (semValor || !!desde)
  /* só é aviso quando o acordo mudou: o acordo que já vale desde o mês passado
     não recalcula nada ao ser salvo de novo */
  const noPassado =
    !!acordoNovo && !mesmoAcordo(acordoNovo, acordoDeAgora) && acordoNovo.desde < hojeEmData(hoje)

  /* AS VENDAS QUE A DATA DEIXA DE FORA (06/10/2026). O Henrique pôs 17% com a
     data de hoje, que é a que o campo traz, e a página do parceiro continuou em
     zero: todas as vendas eram de antes. A ficha agora conta as peças que hoje
     não têm acordo e foram vendidas antes da data escolhida, e oferece a data
     da primeira delas. */
  const semParteAntes = (vendas ?? []).filter(
    v => v.conta && v.parte === null && !!desde && dataNaLoja(v.quando) < desde,
  )
  const pecasDeFora = !semValor && !valorRuim ? semParteAntes.reduce((n, v) => n + v.pecas, 0) : 0
  const primeiraDeFora = semParteAntes.map(v => dataNaLoja(v.quando)).sort()[0] ?? ''
  const porExtenso = (d: string) => d.split('-').reverse().join('/')

  async function gravar() {
    if (!valido || gravando) return
    setGravando(true)
    try {
      const id = await salvarParceiro({
        id: parceiro?.id,
        nome,
        colecao,
        colecaoNome: nomeDaColecao,
        ativo,
      })

      if (acordoNovo && !mesmoAcordo(acordoNovo, acordoDeAgora)) {
        const r = await salvarAcordo(id, acordoNovo)
        if (r.confirmar) {
          /* o cadastro já está salvo; falta só a resposta sobre o acordo */
          setPergunta({ tipo: 'acordo', texto: r.confirmar, acordo: acordoNovo, id })
          return
        }
      }
      await depoisDeSalvar(id)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar.', 'brand')
    } finally {
      setGravando(false)
    }
  }

  /* A lista de produtos é derivada da coleção. Reler a cada salvar custa uma
     ida à loja e pega o produto novo que entrou na coleção desde a última. */
  async function depoisDeSalvar(id: string) {
    let recado = `${nome.trim()} ${parceiro ? 'foi atualizado' : 'entrou em Parceiros'}.`
    if (colecao) {
      try {
        const n = await relerProdutos(id)
        recado += ` ${plural(n, 'produto', 'produtos')} na coleção.`
      } catch {
        avisar(
          'Salvei o parceiro, mas não consegui ler os produtos da coleção na loja agora. Salve de novo mais tarde.',
          'warn',
          8,
        )
      }
    }
    avisar(recado, 'ok')
    await aoSalvo(id)
  }

  async function responder() {
    if (!pergunta || respondendo) return
    setRespondendo(true)
    try {
      if (pergunta.tipo === 'acordo') {
        await salvarAcordo(pergunta.id, pergunta.acordo, true)
        setPergunta(null)
        await depoisDeSalvar(pergunta.id)
        return
      }
      if (!parceiro) return
      if (pergunta.tipo === 'senha') {
        await trocarSenha(parceiro.id)
        setMostrando(true)
        avisar('Senha nova gerada. A antiga não abre mais.', 'ok')
      } else {
        await trocarLink(parceiro.id)
        avisar('Link trocado. O antigo não abre mais.', 'ok')
      }
      setPergunta(null)
      await aoMudar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui fazer isso agora.', 'brand')
    } finally {
      setRespondendo(false)
    }
  }

  /* Fechar a pergunta do acordo sem confirmar: o cadastro já foi salvo, então
     a lista é relida do mesmo jeito. Só o acordo fica como estava. */
  function desistir() {
    if (respondendo) return
    const era = pergunta
    setPergunta(null)
    if (era?.tipo === 'acordo') void aoSalvo(era.id)
  }

  async function copiar(texto: string, recado: string) {
    try {
      await navigator.clipboard.writeText(texto)
      avisar(recado, 'ok')
    } catch {
      avisar('Não consegui copiar. Selecione o texto e copie à mão.', 'brand')
    }
  }

  const link = parceiro ? linkDaPagina(parceiro.chave) : ''

  const sobreOQue =
    tipo === 'valor_por_peca'
      ? 'Valor fixo por peça vendida, qualquer que seja o preço dela.'
      : base === 'preco_cheio'
        ? 'Sobre o preço cheio de cada peça, antes de cupom e desconto, sem o frete.'
        : 'Sobre o valor que o cliente pagou em cada peça, já com cupom e desconto, sem o frete.'

  const acordo = (
    <section className="cartao cartao-pad pa-cartao">
      <TituloCartao icone={Handshake}>Acordo</TituloCartao>
      <Campo rotulo="Nome do parceiro">
        <Entrada
          value={nome}
          onChange={e => setNome(e.currentTarget.value)}
          placeholder="Como o parceiro é chamado"
          disabled={!podeEditar}
          autoFocus={novo}
        />
      </Campo>

      <Campo
        rotulo="Coleção da loja"
        dica={
          semColecoes
            ? `Não consegui ler as coleções da loja agora (${semColecoes}). A coleção atual continua valendo.`
            : 'As vendas dos produtos desta coleção contam para este parceiro.'
        }
      >
        {podeEditar ? (
          <Seletor
            campo
            bloco
            valor={colecao}
            opcoes={opcoes}
            aoEscolher={setColecao}
            vazio="Escolher a coleção"
          />
        ) : (
          <Entrada value={nomeDaColecao || 'Sem coleção'} readOnly />
        )}
      </Campo>

      <div className="pa-grupo">
        <Campo rotulo="Acordo">
          <Segmentado
            className="pa-seg-cheio"
            valor={tipo}
            aoMudar={t => {
              if (!podeEditar) return
              setTipo(t)
              setValor('')
            }}
            opcoes={[
              { valor: 'percentual', rotulo: NOME_DO_TIPO.percentual },
              { valor: 'valor_por_peca', rotulo: NOME_DO_TIPO.valor_por_peca },
            ]}
          />
        </Campo>
        <div className="pa-dois">
          <Campo
            rotulo={tipo === 'percentual' ? 'Percentual por peça' : 'Valor por peça'}
            erro={valorRuim || faltaValor}
            dica={
              valorRuim
                ? tipo === 'percentual'
                  ? 'Um número de 0 a 100.'
                  : 'Um valor em reais, como 25,00.'
                : faltaValor
                  ? 'Escreva o valor do acordo.'
                  : undefined
            }
          >
            <span className={tipo === 'percentual' ? 'pa-unidade depois' : 'pa-unidade antes'}>
              <Entrada
                inputMode="decimal"
                value={valor}
                onChange={e => setValor(e.currentTarget.value)}
                placeholder={tipo === 'percentual' ? '10' : '25,00'}
                disabled={!podeEditar}
                aria-label={tipo === 'percentual' ? 'Percentual por peça' : 'Valor por peça'}
              />
              <i aria-hidden="true">{tipo === 'percentual' ? '%' : 'R$'}</i>
            </span>
          </Campo>
          <Campo rotulo="Vale a partir de">
            {podeEditar ? (
              <CampoDeData valor={desde} aoMudar={setDesde} bloco />
            ) : (
              <Entrada value={desde.split('-').reverse().join('/')} readOnly />
            )}
          </Campo>
        </div>
        {tipo === 'percentual' ? (
          <Campo rotulo="O percentual é sobre">
            <Segmentado
              className="pa-seg-cheio"
              valor={base}
              aoMudar={b => {
                if (podeEditar) setBase(b)
              }}
              opcoes={[
                { valor: 'valor_pago', rotulo: NOME_DA_BASE.valor_pago },
                { valor: 'preco_cheio', rotulo: NOME_DA_BASE.preco_cheio },
              ]}
            />
          </Campo>
        ) : null}
        {pecasDeFora > 0 ? (
          <Aviso tom="warn">
            {/* o botão vai embaixo do texto: ao lado, no cartão estreito, ele não cabe */}
            <span className="pa-fora">
              <span data-fora-do-acordo="">
                {plural(pecasDeFora, 'peça foi vendida', 'peças foram vendidas')} antes de{' '}
                {porExtenso(desde)} e {pecasDeFora === 1 ? 'fica' : 'ficam'} sem parte: na página
                do parceiro {pecasDeFora === 1 ? 'ela aparece' : 'elas aparecem'} como "sem
                acordo". A primeira é de {porExtenso(primeiraDeFora)}.
              </span>
              {podeEditar ? (
                <Botao tamanho="sm" onClick={() => setDesde(primeiraDeFora)}>
                  Valer desde a primeira venda
                </Botao>
              ) : null}
            </span>
          </Aviso>
        ) : null}
        <p className="pa-ajuda">
          {sobreOQue}{' '}
          {noPassado
            ? 'A data está no passado: as vendas dela em diante serão recalculadas com este acordo.'
            : 'Mudar o acordo não mexe nas vendas já registradas.'}
        </p>
      </div>
    </section>
  )

  const pagina = (
    <section className="cartao cartao-pad pa-cartao">
      <TituloCartao icone={Browser}>Página do parceiro</TituloCartao>
      {parceiro ? (
        <>
          <Campo rotulo="Link da página do parceiro">
            <div className="pa-com-botoes">
              <Entrada
                value={link.replace(/^https:\/\//, '')}
                readOnly
                aria-label="Link da página do parceiro"
              />
              <Botao onClick={() => void copiar(link, 'Link copiado.')}>
                <Copy size={16} />
                Copiar
              </Botao>
              {podeEditar ? (
                <Botao onClick={() => setPergunta({ tipo: 'link' })}>Trocar</Botao>
              ) : null}
            </div>
          </Campo>

          <Campo
            rotulo="Senha da página"
            dica="Se o link vazar, gere outra senha ou troque o link. O antigo para de abrir na hora."
          >
            <div className="pa-com-botoes">
              <Entrada
                type={mostrando ? 'text' : 'password'}
                value={parceiro.senha}
                readOnly
                autoComplete="off"
                aria-label="Senha da página"
              />
              <Botao onClick={() => setMostrando(m => !m)}>
                {mostrando ? 'Esconder' : 'Mostrar'}
              </Botao>
              {podeEditar ? (
                <Botao onClick={() => setPergunta({ tipo: 'senha' })}>Gerar outra</Botao>
              ) : null}
            </div>
          </Campo>
        </>
      ) : (
        <p className="pa-ajuda">O link e a senha da página nascem quando você salvar.</p>
      )}

      <div className="pa-risco" />

      <div className="pa-chave">
        <div className="pa-nome">
          <b>Página ativa</b>
          <small>Desligada, o link mostra "página indisponível".</small>
        </div>
        <Interruptor
          ligado={ativo}
          aoMudar={v => {
            if (podeEditar) setAtivo(v)
          }}
        />
      </div>

      {parceiro ? (
        <div className="pa-grupo pa-notas">
          <p className="pa-ajuda">
            {parceiro.abertaEm
              ? `Aberta pelo parceiro pela última vez: ${quandoFoi(parceiro.abertaEm, hoje)}.`
              : 'O parceiro ainda não abriu a página.'}
          </p>
          <p className="pa-ajuda">O parceiro vê na página dele as mesmas vendas da aba Vendas.</p>
        </div>
      ) : null}
    </section>
  )

  const pe =
    parceiro || podeEditar ? (
      <>
        {novo ? <Botao onClick={aoDesistir}>Cancelar</Botao> : null}
        {parceiro ? (
          <Botao onClick={() => window.open(link, '_blank', 'noopener')}>
            <ArrowSquareOut size={16} />
            Abrir a página
          </Botao>
        ) : null}
        {podeEditar ? (
          <Botao
            tom="primario"
            onClick={() => void gravar()}
            disabled={!valido || gravando}
            carregando={gravando}
          >
            {gravando ? 'Salvando' : 'Salvar'}
          </Botao>
        ) : null}
      </>
    ) : null

  const perguntas = (
    <Modal
      aberto={!!pergunta}
      aoFechar={desistir}
      titulo={
        pergunta?.tipo === 'senha'
          ? 'Gerar outra senha?'
          : pergunta?.tipo === 'link'
            ? 'Trocar o link?'
            : 'Refazer a conta das vendas?'
      }
      pe={
        <>
          <Botao onClick={desistir} disabled={respondendo}>
            Cancelar
          </Botao>
          <Botao
            tom="forte"
            onClick={() => void responder()}
            disabled={respondendo}
            carregando={respondendo}
          >
            {pergunta?.tipo === 'senha'
              ? 'Gerar outra'
              : pergunta?.tipo === 'link'
                ? 'Trocar o link'
                : 'Confirmar e refazer'}
          </Botao>
        </>
      }
    >
      <p className="pa-pergunta">
        {pergunta?.tipo === 'senha'
          ? 'A senha atual para de abrir a página na hora. Você vai precisar enviar a nova ao parceiro.'
          : pergunta?.tipo === 'link'
            ? 'O link atual para de abrir na hora. Você vai precisar enviar o novo ao parceiro. A senha continua a mesma.'
            : pergunta?.tipo === 'acordo'
              ? `${pergunta.texto} O cadastro já foi salvo; o acordo só muda se você confirmar.`
              : ''}
      </p>
    </Modal>
  )

  return (
    <>
      <div className="pa-cartoes">
        {acordo}
        {pagina}
      </div>
      {pe ? <div className="pa-pe">{pe}</div> : null}
      {perguntas}
    </>
  )
}
