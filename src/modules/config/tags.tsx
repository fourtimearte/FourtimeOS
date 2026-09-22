import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import {
  Aviso,
  Botao,
  Cartao,
  Entrada,
  Etiqueta,
  Esqueleto,
  Marcacao,
  Pagina,
  TituloCartao,
  Vazio,
  avisar,
} from '@ds'
import {
  COLUNAS,
  TONS_DE_TAG,
  apagarTag,
  carregarAsTags,
  chaveDaTag,
  nomeDoPosto,
  salvarPostosDaTag,
  salvarTag,
  type Etapa,
  type Tag,
  type TomDeTag,
} from '@dominio/producao'
import { AbasDaConfig } from './abas'
import './config.css'
import './tags.css'

/* ==========================================================================
   As tags do quadro.

   A TAG DIZ O QUE ESTÁ ACONTECENDO COM O PEDIDO AGORA, dentro do posto em que
   ele está. Se o cartão está em DTF e tem a tag montagem, qualquer um que
   olhe sabe em que pé aquilo está sem abrir nada.

   DUAS COISAS ELA NÃO FAZ, de propósito: a tag NÃO move o cartão e NÃO troca o
   estado do pedido. Ela é um recado. No dia em que uma tag mandar no fluxo,
   ninguém vai saber mais o que move o quê, e o quadro passa a ter duas regras
   escondidas brigando.

   AS TAGS MESTRE NÃO SE CRIAM AQUI. Evento, urgente, vip e prioridade vêm do
   cabeçalho da cotação, então quem as define é a tela de cotação. Uma tag
   mestre posta no chão de fábrica seria o vendedor descobrindo pelo quadro
   que o pedido dele virou VIP.
   ========================================================================== */

type Rascunho = {
  chave: string
  nome: string
  tom: TomDeTag
  emTodoPosto: boolean
  postos: Etapa[]
  nova: boolean
}

const EM_BRANCO: Rascunho = {
  chave: '',
  nome: '',
  tom: 'cinza',
  emTodoPosto: false,
  postos: [],
  nova: true,
}

/* Finalizado fica de fora da lista de postos: o cartão que chegou lá acabou, e
   pôr recado em trabalho terminado é escrever para ninguém. */
const POSTOS = COLUNAS.filter((p) => p !== 'finalizado')

export function TelaTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setTags(await carregarAsTags())
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler as tags.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function salvar() {
    if (!rascunho || salvando) return
    const nome = rascunho.nome.trim()
    if (nome.length < 2) {
      avisar('Escreva o nome da tag.', 'warn')
      return
    }
    /* A CHAVE NASCE DO NOME E NUNCA MAIS MUDA. Ela é a identidade da tag no
       banco, e o histórico de quem já pôs aquela tag aponta para ela: mudar a
       chave ao renomear apagaria o passado de quem trabalhou com ela. */
    const chave = rascunho.nova ? chaveDaTag(nome) : rascunho.chave
    if (!chave) {
      avisar('Este nome não vira uma chave. Use letras.', 'warn')
      return
    }
    setSalvando(true)
    try {
      await salvarTag({
        chave,
        nome,
        tom: rascunho.tom,
        emTodoPosto: rascunho.emTodoPosto,
        ordem: rascunho.nova ? (tags.length + 1) * 10 : (tags.find((t) => t.chave === chave)?.ordem ?? 100),
        ativa: true,
      })
      await salvarPostosDaTag(chave, rascunho.emTodoPosto ? [] : rascunho.postos)
      await carregar()
      setRascunho(null)
      avisar('Tag guardada.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui guardar.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  async function apagar(t: Tag) {
    try {
      await apagarTag(t.chave)
      await carregar()
      if (rascunho?.chave === t.chave) setRascunho(null)
      avisar('Tag apagada.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui apagar.', 'brand')
    }
  }

  function editar(t: Tag) {
    setRascunho({
      chave: t.chave,
      nome: t.nome,
      tom: t.tom,
      emTodoPosto: t.emTodoPosto,
      postos: t.postos,
      nova: false,
    })
  }

  return (
    <Pagina
      acima="Configurações"
      titulo="Tags do quadro"
      sub="A tag diz o que está acontecendo com o pedido agora, dentro do posto em que ele está."
      acoes={
        <Botao tom="primario" onClick={() => setRascunho({ ...EM_BRANCO })}>
          <Plus size={16} weight="bold" />
          Criar tag
        </Botao>
      }
    >
      <AbasDaConfig atual="tags" />

      <Aviso tom="info" titulo="A tag é um recado, e não um comando">
        Ela <b>não move o cartão</b> e <b>não troca o estado do pedido</b>. Quem move o cartão é o
        Terminei, e quem troca o estado é o caminho do pedido. As tags mestre,{' '}
        <b>evento, urgente, vip e prioridade</b>, não se criam aqui: elas vêm do cabeçalho da
        cotação e valem para o pedido inteiro.
      </Aviso>

      <div className="tg-colunas">
        <Cartao>
          <TituloCartao>As tags que existem</TituloCartao>
          {erro ? (
            <Vazio titulo="Não consegui ler as tags" texto={erro} />
          ) : carregando ? (
            <>
              <Esqueleto altura={38} />
              <Esqueleto altura={38} />
              <Esqueleto altura={38} />
            </>
          ) : !tags.length ? (
            <Vazio
              titulo="Nenhuma tag ainda"
              texto="Crie a primeira e escolha em que postos ela aparece."
            />
          ) : (
            <ul className="tg-lista">
              {tags.map((t) => (
                <li className="tg-linha" key={t.chave}>
                  <Etiqueta tom={t.tom}>{t.nome}</Etiqueta>
                  <div className="tg-postos">
                    {t.emTodoPosto ? (
                      <span className="tg-todos">todos os postos</span>
                    ) : t.postos.length ? (
                      t.postos.map((p) => (
                        <span className="tg-posto" key={p}>
                          {nomeDoPosto(p)}
                        </span>
                      ))
                    ) : (
                      <span className="tg-nenhum">nenhum posto, ela está guardada</span>
                    )}
                  </div>
                  <Botao tamanho="sm" tom="contorno" onClick={() => editar(t)}>
                    Editar
                  </Botao>
                  <Botao
                    tamanho="sm"
                    tom="perigo"
                    icone
                    aria-label={'Apagar a tag ' + t.nome}
                    onClick={() => void apagar(t)}
                  >
                    <Trash size={16} />
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {rascunho ? (
          <Cartao>
            <TituloCartao>{rascunho.nova ? 'Nova tag' : 'Editar ' + rascunho.nome}</TituloCartao>

            <label className="tg-rot" htmlFor="tg-nome">
              Nome
            </label>
            <Entrada
              id="tg-nome"
              value={rascunho.nome}
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
              placeholder="prova de cor"
            />
            {rascunho.nova && rascunho.nome ? (
              <p className="tg-chave">
                a chave vai ser <b>{chaveDaTag(rascunho.nome) || 'nenhuma'}</b>, e ela não muda
                depois
              </p>
            ) : null}

            <div className="tg-rot">Cor</div>
            <div className="tg-tons">
              {TONS_DE_TAG.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={t === rascunho.tom ? 'tg-tom escolhido' : 'tg-tom'}
                  aria-pressed={t === rascunho.tom}
                  aria-label={'Tom ' + t}
                  onClick={() => setRascunho({ ...rascunho, tom: t })}
                >
                  <Etiqueta tom={t} pequena>
                    {rascunho.nome.trim() || t}
                  </Etiqueta>
                </button>
              ))}
            </div>

            <div className="tg-rot">Em que postos ela aparece</div>
            <Marcacao
              checked={rascunho.emTodoPosto}
              onChange={(e) => setRascunho({ ...rascunho, emTodoPosto: e.target.checked })}
            >
              Em todos os postos
            </Marcacao>

            {/* A LISTA SOME QUANDO A TAG VALE EM TODO POSTO, e não fica
                apagada: com ela acesa e sem efeito, a pessoa marca posto por
                posto e depois descobre que nada daquilo valeu. */}
            {!rascunho.emTodoPosto ? (
              <div className="tg-grade">
                {POSTOS.map((p) => (
                  <Marcacao
                    key={p}
                    checked={rascunho.postos.includes(p)}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        postos: e.target.checked
                          ? [...rascunho.postos, p]
                          : rascunho.postos.filter((x) => x !== p),
                      })
                    }
                  >
                    {nomeDoPosto(p)}
                  </Marcacao>
                ))}
              </div>
            ) : null}

            <div className="tg-pe">
              <Botao tom="contorno" onClick={() => setRascunho(null)}>
                Cancelar
              </Botao>
              <Botao tom="primario" disabled={salvando} onClick={() => void salvar()}>
                {salvando ? 'Guardando...' : 'Salvar a tag'}
              </Botao>
            </div>
          </Cartao>
        ) : null}
      </div>
    </Pagina>
  )
}
