import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Copy, Needle, PencilSimple, Printer, TShirt, TreeStructure, X } from '@phosphor-icons/react'
import { Botao, Esqueleto, TituloCartao, Vazio, avisar } from '@ds'
import {
  DETALHES,
  NOME_DO_GENERO,
  carregarFicha,
  carregarKitsDaReferencia,
  carregarMolde,
  gradeEmPalavras,
  paraOCampo,
  salvarMolde,
  type Ficha,
  type GrupoDeReferencia,
  type KitDaReferencia,
  type MaterialDoEstoque,
  type ReferenciaNaFicha,
  type TecidoDeConta,
} from '@dominio/produto'
import { Editor } from './editor'
import { MedidasETecido, type AbaDoModulo } from './medidas'
import { CartaoDoMolde } from './molde'
import { SEM_ETIQUETA, Trilha, apoioDoMaterial } from './pecas'
import { VisorDoMolde } from './visor'

/* ==========================================================================
   A ficha de uma referência: o lado direito da página.

   A FICHA INTEIRA SÓ É LIDA QUANDO ALGUÉM ABRE A PEÇA. A lista é leve; as
   medidas, as partes, os aviamentos e o molde vêm aqui, de uma vez.

   VER E EDITAR SÃO A MESMA COLUNA. O editor não é um modal: a ficha tem cinco
   cartões e duas tabelas, e isso não cabe numa caixa por cima da página. Ele
   toma o lugar da ficha e devolve quando a pessoa salva ou cancela.
   ========================================================================== */

function Vista({
  r,
  grupo,
  ficha,
  molde,
  tecidos,
  doEstoque,
  aba,
  aoTrocarAba,
  celular,
  podeEditar,
  podeCriar,
  enviandoMolde,
  aoTrocarMolde,
  aoEditar,
  aoDuplicar,
  aoFechar,
  kits,
  aoAbrirKit,
  aoAmpliarMolde,
  aoImprimir,
}: {
  kits: KitDaReferencia[]
  aoAbrirKit: (id: string) => void
  aoAmpliarMolde: () => void
  aoImprimir: () => void
  r: ReferenciaNaFicha
  grupo: GrupoDeReferencia | null
  ficha: Ficha
  molde: string | null
  tecidos: TecidoDeConta[]
  doEstoque: MaterialDoEstoque[]
  aba: AbaDoModulo
  aoTrocarAba: (a: AbaDoModulo) => void
  celular: boolean
  podeEditar: boolean
  podeCriar: boolean
  enviandoMolde: boolean
  aoTrocarMolde: (svg: string) => void
  aoEditar: (aba?: AbaDoModulo) => void
  aoDuplicar: () => void
  aoFechar: () => void
}) {
  return (
    <div className="pd-ficha" data-ficha="referencia">
      <div className="pd-ficha-topo">
        <div className="pd-ficha-nome">
          <Trilha grupo={grupo} fim="referência" />
          <h2>{r.nome}</h2>
          <p>
            {r.cod || 'sem código'}
            {NOME_DO_GENERO[r.genero] ? ' · ' + NOME_DO_GENERO[r.genero] : ''} ·{' '}
            {gradeEmPalavras(ficha.tamanhos)}
          </p>
        </div>
        <div className="fileira">
          {celular ? (
            <Botao onClick={aoFechar}>
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar
            </Botao>
          ) : null}
          {podeEditar ? (
            <Botao onClick={() => aoEditar()}>
              <PencilSimple size={16} aria-hidden="true" />
              Editar
            </Botao>
          ) : null}
          <Botao onClick={aoImprimir}>
            <Printer size={16} aria-hidden="true" />
            Imprimir
          </Botao>
          {podeCriar && !celular ? (
            <Botao onClick={aoDuplicar}>
              <Copy size={16} aria-hidden="true" />
              Duplicar
            </Botao>
          ) : null}
          {celular ? null : (
            <Botao onClick={aoFechar}>
              <X size={16} aria-hidden="true" />
              Fechar
            </Botao>
          )}
        </div>
      </div>

      <div className="pd-dois largo-estreito">
        <CartaoDoMolde
          nome={r.nome}
          svg={molde}
          partes={ficha.partes}
          podeEditar={podeEditar}
          enviando={enviandoMolde}
          aoTrocar={aoTrocarMolde}
          aoAmpliar={aoAmpliarMolde}
          nota="O desenho é um SVG tirado do molde no Affinity. Toque nele para abrir em tela cheia, com a largura e a altura de cada parte."
        />
        <section className="cartao pd-col" data-cartao="detalhes">
          <div className="pd-topo">
            <TituloCartao icone={TShirt}>Detalhes da peça</TituloCartao>
          </div>
          <div className="pd-corpo">
            <dl className="pd-linhas">
              {DETALHES.map(d => (
                <div key={d.chave}>
                  <dt>{d.nome}</dt>
                  <dd>
                    {ficha.detalhes[d.chave] ? (
                      <b>{ficha.detalhes[d.chave]}</b>
                    ) : (
                      <span className="pd-vago">não informado</span>
                    )}
                  </dd>
                </div>
              ))}
              {ficha.observacao ? (
                <div>
                  <dt>Observação</dt>
                  <dd className="pd-texto">{ficha.observacao}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="pd-corpo pd-rodape">
            <p className="pd-nota">{SEM_ETIQUETA}</p>
          </div>
        </section>
      </div>

      <MedidasETecido
        ficha={ficha}
        tecidos={tecidos}
        aba={aba}
        aoTrocarAba={aoTrocarAba}
        podeEditar={podeEditar}
        aoEditar={aoEditar}
      />

      <div className="pd-dois">
      <section className="cartao pd-col" data-cartao="aviamentos">
        <div className="pd-topo">
          <TituloCartao icone={Needle}>Aviamentos e insumos por peça</TituloCartao>
          {ficha.materiais.length ? <span className="pd-topo-n">igual em toda a grade</span> : null}
        </div>
        {ficha.materiais.length ? (
          ficha.materiais.map(m => (
            <div className="pd-lin" key={m.nome}>
              <span className="pd-txt">
                <b>{m.nome}</b>
                <small>{apoioDoMaterial(m.materialId, doEstoque)}</small>
              </span>
              <span className="pd-val">
                {paraOCampo(m.quantidade)} {m.unidade}
                <small>por peça</small>
              </span>
            </div>
          ))
        ) : (
          <div className="pd-corpo">
            <p className="pd-nota">
              Nenhum aviamento nem insumo na ficha desta peça. Linha, fio, elástico, cordão e embalagem
              entram pelo Editar.
            </p>
          </div>
        )}
      </section>

      <section className="cartao pd-col" data-cartao="onde-entra">
        <div className="pd-topo">
          <TituloCartao icone={TreeStructure}>Onde esta peça entra</TituloCartao>
        </div>
        <div className="pd-sub">Kits</div>
        {kits.length ? (
          kits.map(k => (
            <div className="pd-lin" key={k.kitId} data-kit-da-peca={k.kitCod}>
              <span className="pd-txt">
                <b>{k.kitNome}</b>
                <small>{k.papel ? k.papel.toLowerCase() + ' do kit' : 'peça do kit'}</small>
              </span>
              <Botao tom="limpo" tamanho="sm" onClick={() => aoAbrirKit(k.kitId)}>
                Abrir
                <ArrowRight size={14} aria-hidden="true" />
              </Botao>
            </div>
          ))
        ) : (
          <div className="pd-corpo">
            <p className="pd-nota">Esta peça não está em nenhum kit.</p>
          </div>
        )}
      </section>
      </div>
    </div>
  )
}

export function FichaDaReferencia({
  r,
  grupo,
  todas,
  tecidos,
  doEstoque,
  celular,
  podeEditar,
  podeCriar,
  podeExcluir,
  editando,
  abaInicial,
  aoEditar,
  aoCancelarEdicao,
  aoSalvouEdicao,
  aoSujar,
  aoMudou,
  aoExcluiu,
  aoDuplicar,
  aoFechar,
  aoAbrirKit,
  aoImprimir,
}: {
  r: ReferenciaNaFicha
  grupo: GrupoDeReferencia | null
  /** as outras referências, para copiar medidas e tecido de uma delas */
  todas: ReferenciaNaFicha[]
  tecidos: TecidoDeConta[]
  doEstoque: MaterialDoEstoque[]
  celular: boolean
  podeEditar: boolean
  podeCriar: boolean
  podeExcluir: boolean
  editando: boolean
  abaInicial?: AbaDoModulo
  aoEditar: () => void
  /** Cancelar no editor: a página pergunta antes, se tiver mudança sem salvar */
  aoCancelarEdicao: () => void
  /** a ficha foi salva: o editor fecha sem pergunta */
  aoSalvouEdicao: () => void
  /** o editor avisa quando tem mudança sem salvar, para a página não trocar de peça calada */
  aoSujar: (sujo: boolean) => void
  /** a ficha ou o molde mudou no banco: a lista precisa reler a linha desta peça */
  aoMudou: () => Promise<void>
  aoExcluiu: () => Promise<void>
  aoDuplicar: () => void
  aoFechar: () => void
  aoAbrirKit: (id: string) => void
  /** a folha impressa toma a página: a ficha entrega o que já leu, para ninguém ler de novo */
  aoImprimir: (lido: { ficha: Ficha; molde: string | null }) => void
}) {
  /* em que kits a peça entra: apoio, que pode falhar sem derrubar a ficha */
  const [kits, setKits] = useState<KitDaReferencia[]>([])
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [molde, setMolde] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<AbaDoModulo>(abaInicial ?? 'medidas')
  const [enviandoMolde, setEnviandoMolde] = useState(false)
  const [visor, setVisor] = useState(false)

  const ler = useCallback(async () => {
    setErro('')
    try {
      const [f, m] = await Promise.all([carregarFicha(r), carregarMolde(r.id)])
      setFicha(f)
      setMolde(m)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler a ficha.')
    }
    /* só a peça decide quando ler de novo: o que muda nela depois de salvar já chega pronto */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id])

  useEffect(() => {
    setFicha(null)
    setMolde(null)
    setKits([])
    void ler()
    let vivo = true
    carregarKitsDaReferencia(r.id)
      .then(lista => {
        if (vivo) setKits(lista)
      })
      .catch(() => {
        /* sem a lista de kits a ficha continua inteira */
      })
    return () => {
      vivo = false
    }
  }, [ler, r.id])

  async function trocarMolde(svg: string) {
    setEnviandoMolde(true)
    try {
      await salvarMolde(r.id, svg)
      setMolde(svg)
      await aoMudou()
      avisar('Molde trocado.', 'ok')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui guardar o molde.', 'warn', 7)
    } finally {
      setEnviandoMolde(false)
    }
  }

  if (erro) {
    return (
      <section className="cartao pd-quadro">
        <Vazio
          titulo="Não consegui ler a ficha"
          texto={erro}
          acao={<Botao onClick={() => void ler()}>Tentar de novo</Botao>}
        />
      </section>
    )
  }
  if (!ficha) {
    return (
      <section className="cartao pd-quadro" aria-busy="true">
        <div className="pd-espera">
          <Esqueleto altura={22} largura="40%" />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </div>
      </section>
    )
  }

  if (editando && podeEditar) {
    return (
      <Editor
        r={r}
        grupo={grupo}
        ficha={ficha}
        molde={molde}
        todas={todas}
        tecidos={tecidos}
        doEstoque={doEstoque}
        abaInicial={aba}
        emKits={kits.length}
        podeExcluir={podeExcluir}
        aoSujar={aoSujar}
        aoCancelar={aoCancelarEdicao}
        aoSalvou={async (nova, moldeNovo) => {
          setFicha(nova)
          setMolde(moldeNovo)
          await aoMudou()
          aoSalvouEdicao()
        }}
        aoExcluiu={aoExcluiu}
      />
    )
  }

  return (
    <>
    <Vista
      r={r}
      grupo={grupo}
      ficha={ficha}
      molde={molde}
      tecidos={tecidos}
      doEstoque={doEstoque}
      aba={aba}
      aoTrocarAba={setAba}
      celular={celular}
      podeEditar={podeEditar}
      podeCriar={podeCriar}
      enviandoMolde={enviandoMolde}
      aoTrocarMolde={svg => void trocarMolde(svg)}
      aoEditar={qual => {
        if (qual) setAba(qual)
        aoEditar()
      }}
      aoDuplicar={aoDuplicar}
      aoFechar={aoFechar}
      kits={kits}
      aoAbrirKit={aoAbrirKit}
      aoAmpliarMolde={() => setVisor(true)}
      aoImprimir={() => aoImprimir({ ficha, molde })}
    />
    {visor ? (
      <VisorDoMolde
        aberto
        aoFechar={() => setVisor(false)}
        r={r}
        ficha={ficha}
        geral={molde}
        tecidos={tecidos}
        podeEditar={podeEditar}
      />
    ) : null}
    </>
  )
}
