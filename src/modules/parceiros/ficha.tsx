import { useState } from 'react'
import { ArrowSquareOut, Copy } from '@phosphor-icons/react'
import {
  Botao,
  Campo,
  CampoDeData,
  Entrada,
  Gaveta,
  Interruptor,
  Modal,
  Segmentado,
  Seletor,
  TituloCartao,
  avisar,
} from '@ds'
import { hojeEmData } from '@shared'
import {
  NOME_DA_BASE,
  NOME_DO_TIPO,
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
} from '@dominio/parceiro'
import { plural } from './apoio'

/* ==========================================================================
   A ficha do parceiro: o cadastro, o acordo e a página dele.

   É onde o Henrique diz quanto cada parceiro recebe. O acordo tem data: o que
   foi vendido antes dela continua com o acordo anterior.

   O LINK E A SENHA NASCEM NO BANCO, quando o parceiro é salvo pela primeira
   vez. A tela só mostra, copia e pede outro. Trocar qualquer um dos dois vale
   na hora, e por isso pergunta antes.

   ELA MORA EM DOIS LUGARES: ao lado da lista, na tela larga, e numa folha, na
   estreita. O conteúdo é o mesmo; só a moldura muda.
   ========================================================================== */

type Pergunta = { tipo: 'senha' } | { tipo: 'link' } | { tipo: 'acordo'; texto: string; acordo: Acordo; id: string } | null

export function FichaDoParceiro({
  parceiro,
  novo,
  moldura,
  podeEditar,
  colecoes,
  semColecoes,
  hoje,
  aoFechar,
  aoSalvo,
  aoMudar,
}: {
  /** o parceiro aberto; nulo quando é um cadastro novo, ou quando não há nada aberto */
  parceiro: Parceiro | null
  novo: boolean
  moldura: 'cartao' | 'folha'
  podeEditar: boolean
  colecoes: Colecao[]
  /** o porteiro não devolveu as coleções da loja: a ficha diz, e não cai */
  semColecoes: string
  hoje: Date
  aoFechar: () => void
  /** salvou: a lista é relida e a ficha passa a ser a do id devolvido */
  aoSalvo: (id: string) => Promise<void>
  /** a senha ou o link mudou: só reler */
  aoMudar: () => Promise<void>
}) {
  const acordoDeAgora = parceiro?.ultimo ?? null

  const [nome, setNome] = useState(parceiro?.nome ?? '')
  const [colecao, setColecao] = useState(parceiro?.colecao ?? '')
  const [tipo, setTipo] = useState<TipoDeAcordo>(acordoDeAgora?.tipo ?? 'percentual')
  const [valor, setValor] = useState(acordoDeAgora ? numeroNoCampo(acordoDeAgora.valor, acordoDeAgora.tipo) : '')
  const [base, setBase] = useState<BaseDoAcordo>(acordoDeAgora?.base ?? 'valor_pago')
  const [desde, setDesde] = useState(acordoDeAgora?.desde ?? hojeEmData(hoje))
  const [ativo, setAtivo] = useState(parceiro ? parceiro.ativo : false)
  const [mostrando, setMostrando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [pergunta, setPergunta] = useState<Pergunta>(null)
  const [respondendo, setRespondendo] = useState(false)

  const aberto = novo || !!parceiro

  /* A loja devolve só o endereço e o nome de cada coleção. A contagem que
     aparece é a dos produtos que o sistema já leu da coleção DESTE parceiro,
     e por isso só a coleção dele traz número. Ela aparece na lista mesmo
     quando a loja não respondeu, ou quando a coleção saiu de lá. */
  const comContagem = (nome: string) => `${nome} (${plural(parceiro?.produtos ?? 0, 'produto', 'produtos')})`
  const opcoes = colecoes.map((c) => ({
    valor: c.colecao,
    rotulo: c.colecao === parceiro?.colecao ? comContagem(c.nome) : c.nome,
  }))
  if (parceiro?.colecao && !opcoes.some((o) => o.valor === parceiro.colecao)) {
    opcoes.unshift({ valor: parceiro.colecao, rotulo: comContagem(parceiro.colecaoNome || parceiro.colecao) })
  }
  const nomeDaColecao =
    colecoes.find((c) => c.colecao === colecao)?.nome ?? (colecao === parceiro?.colecao ? parceiro.colecaoNome : '')

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

  async function gravar() {
    if (!valido || gravando) return
    setGravando(true)
    try {
      const id = await salvarParceiro({ id: parceiro?.id, nome, colecao, colecaoNome: nomeDaColecao, ativo })

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
        avisar('Salvei o parceiro, mas não consegui ler os produtos da coleção na loja agora. Salve de novo mais tarde.', 'warn', 8)
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

  const corpo = (
    <div className="pa-ficha-corpo">
      <Campo rotulo="Nome do parceiro">
        <Entrada
          value={nome}
          onChange={(e) => setNome(e.currentTarget.value)}
          placeholder="Como o parceiro é chamado"
          disabled={!podeEditar}
          data-foco-inicial={novo ? true : undefined}
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
          <Seletor campo bloco valor={colecao} opcoes={opcoes} aoEscolher={setColecao} vazio="Escolher a coleção" />
        ) : (
          <Entrada value={nomeDaColecao || 'Sem coleção'} readOnly />
        )}
      </Campo>

      <div className="pa-grupo">
        <Campo rotulo="Acordo">
          <Segmentado
            className="pa-seg-cheio"
            valor={tipo}
            aoMudar={(t) => {
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
                onChange={(e) => setValor(e.currentTarget.value)}
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
              aoMudar={(b) => {
                if (podeEditar) setBase(b)
              }}
              opcoes={[
                { valor: 'valor_pago', rotulo: NOME_DA_BASE.valor_pago },
                { valor: 'preco_cheio', rotulo: NOME_DA_BASE.preco_cheio },
              ]}
            />
          </Campo>
        ) : null}
        <p className="pa-ajuda">
          {sobreOQue}{' '}
          {noPassado
            ? 'A data está no passado: as vendas dela em diante serão recalculadas com este acordo.'
            : 'Mudar o acordo não mexe nas vendas já registradas.'}
        </p>
      </div>

      <div className="pa-risco" />

      {parceiro ? (
        <>
          <Campo rotulo="Link da página do parceiro">
            <div className="pa-com-botoes">
              <Entrada value={link.replace(/^https:\/\//, '')} readOnly aria-label="Link da página do parceiro" />
              <Botao onClick={() => void copiar(link, 'Link copiado.')}>
                <Copy size={16} />
                Copiar
              </Botao>
              {podeEditar ? <Botao onClick={() => setPergunta({ tipo: 'link' })}>Trocar</Botao> : null}
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
              <Botao onClick={() => setMostrando((m) => !m)}>{mostrando ? 'Esconder' : 'Mostrar'}</Botao>
              {podeEditar ? <Botao onClick={() => setPergunta({ tipo: 'senha' })}>Gerar outra</Botao> : null}
            </div>
          </Campo>
        </>
      ) : (
        <p className="pa-ajuda">O link e a senha da página nascem quando você salvar.</p>
      )}

      <div className="pa-chave">
        <div className="pa-nome">
          <b>Página ativa</b>
          <small>Desligada, o link mostra "página indisponível".</small>
        </div>
        <Interruptor
          ligado={ativo}
          aoMudar={(v) => {
            if (podeEditar) setAtivo(v)
          }}
        />
      </div>
    </div>
  )

  const pe =
    parceiro || podeEditar ? (
      <>
        {parceiro ? (
          <Botao onClick={() => window.open(link, '_blank', 'noopener')}>
            <ArrowSquareOut size={16} />
            Abrir a página
          </Botao>
        ) : null}
        {podeEditar ? (
          <Botao tom="primario" onClick={() => void gravar()} disabled={!valido || gravando} carregando={gravando}>
            {gravando ? 'Salvando' : 'Salvar'}
          </Botao>
        ) : null}
      </>
    ) : null

  const titulo = parceiro ? parceiro.nome : 'Novo parceiro'

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
          <Botao tom="forte" onClick={() => void responder()} disabled={respondendo} carregando={respondendo}>
            {pergunta?.tipo === 'senha' ? 'Gerar outra' : pergunta?.tipo === 'link' ? 'Trocar o link' : 'Confirmar e refazer'}
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

  if (moldura === 'folha') {
    return (
      <>
        <Gaveta aberto={aberto} aoFechar={aoFechar} titulo={titulo} pe={pe ?? undefined}>
          {aberto ? <div className="pa-na-folha">{corpo}</div> : null}
        </Gaveta>
        {perguntas}
      </>
    )
  }

  if (!aberto) return null
  return (
    <section className="cartao pa-ficha">
      <div className="pa-ficha-topo">
        <TituloCartao>{titulo}</TituloCartao>
      </div>
      {corpo}
      {pe ? <div className="pa-ficha-pe">{pe}</div> : null}
      {perguntas}
    </section>
  )
}
