import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import { Aviso, Botao, Campo, Chip, Entrada, Marcacao, Modal, Seletor, avisar } from '@ds'
import { gruposDoEstoque, type Material } from '@dominio/estoque'
import {
  cnpjValido,
  consultarNaReceita,
  criarFornecedor,
  criarTipoDeFornecedor,
  limparCnpj,
  mascaraDoCnpj,
  salvarFornecedor,
  type Fornecedor,
  type NaReceita,
  type TipoDeFornecedor,
} from '@dominio/fornecedor'

/* ==========================================================================
   O fornecedor novo, e a edição do que já existe.

   COMEÇA PELO CNPJ. A razão social, a situação e a cidade vêm da Receita, e
   quem cadastra escreve só o que a Receita não sabe: como a fábrica chama
   aquele fornecedor, com quem fala e como paga.

   SEM CNPJ TAMBÉM VALE, com o aviso do que isso custa: o Verificador de
   Boleto reconhece fornecedor pelo CNPJ, então sem ele o boleto sempre pede
   aprovação.

   OS MATERIAIS SÃO OS DO ESTOQUE, escolhidos pelo mesmo agrupamento de lá: a
   malha inteira, o grupo inteiro. Frete e serviço não têm material, e para
   eles há uma linha de texto.

   "JÁ MARCAR COMO CONFIÁVEL" É SÓ DO ADMINISTRADOR, e só com CNPJ. O banco
   recusa de qualquer outro (041); a caixa aparece apagada para quem não é.
   ========================================================================== */

export type InicioDoFormulario =
  | { modo: 'novo'; tipo?: string }
  | { modo: 'editar'; fornecedor: Fornecedor; materiais: string[] }

export function FormularioDeFornecedor({
  inicio,
  tipos,
  materiais,
  admin,
  aoFechar,
  aoSalvar,
  aoMudarTipos,
}: {
  inicio: InicioDoFormulario | null
  tipos: TipoDeFornecedor[]
  /** todos os materiais do estoque, para escolher o que ele fornece */
  materiais: Material[]
  admin: boolean
  aoFechar: () => void
  aoSalvar: (id: string) => Promise<void>
  aoMudarTipos: () => Promise<void>
}) {
  const [cnpj, setCnpj] = useState('')
  const [semCnpj, setSemCnpj] = useState(false)
  const [receita, setReceita] = useState<NaReceita | null>(null)
  const [avisoDaReceita, setAvisoDaReceita] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [dosTipos, setDosTipos] = useState<string[]>([])
  const [grupos, setGrupos] = useState<string[]>([])
  const [oQueFornece, setOQueFornece] = useState('')
  const [pagamento, setPagamento] = useState('')
  const [prazo, setPrazo] = useState('')
  const [confiavel, setConfiavel] = useState(false)
  const [tipoNovo, setTipoNovo] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')

  const todosOsGrupos = useMemo(() => gruposDoEstoque(materiais), [materiais])
  const editando = inicio?.modo === 'editar' ? inicio.fornecedor : null

  useEffect(() => {
    if (!inicio) return
    setFalha('')
    setAvisoDaReceita('')
    setTipoNovo(null)
    setConfiavel(false)
    if (inicio.modo === 'editar') {
      const f = inicio.fornecedor
      setCnpj(mascaraDoCnpj(f.cnpj))
      setSemCnpj(!f.cnpj)
      setReceita(f.receita)
      setNome(f.nome)
      setContato(f.contato)
      setDosTipos(f.tipos)
      setGrupos(
        todosOsGrupos.filter((g) => g.itens.some((m) => inicio.materiais.includes(m.id))).map((g) => g.chave),
      )
      setOQueFornece(f.oQueFornece)
      setPagamento(f.pagamento)
      setPrazo(f.prazo)
    } else {
      setCnpj('')
      setSemCnpj(false)
      setReceita(null)
      setNome('')
      setContato('')
      setDosTipos(inicio.tipo ? [inicio.tipo] : [])
      setGrupos([])
      setOQueFornece('')
      setPagamento('')
      setPrazo('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio])

  const limpo = limparCnpj(cnpj)
  const cnpjCompleto = limpo.length === 14
  const cnpjCerto = cnpjCompleto && cnpjValido(limpo)
  const temMaterial = dosTipos.some((t) => ['tecido', 'aviamento', 'insumo'].includes(t))
  const temServico = dosTipos.some((t) => !['tecido', 'aviamento', 'insumo'].includes(t))
  const pronto = nome.trim() !== '' && (semCnpj || cnpjCerto)

  async function buscar() {
    if (!cnpjCerto || buscando) return
    setBuscando(true)
    setAvisoDaReceita('')
    const r = await consultarNaReceita(limpo)
    setBuscando(false)
    if (!r.receita) {
      setReceita(null)
      setAvisoDaReceita(r.motivo)
      return
    }
    setReceita(r.receita)
    if (!nome.trim()) setNome(r.nomeFantasia || nomeCurto(r.receita.razaoSocial))
  }

  async function criarTipo() {
    if (!tipoNovo?.trim()) return
    try {
      const ordem = Math.max(0, ...tipos.map((t) => t.ordem)) + 10
      const t = await criarTipoDeFornecedor(tipoNovo, ordem)
      await aoMudarTipos()
      setDosTipos((a) => [...a, t.chave])
      setTipoNovo(null)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui criar o tipo.')
    }
  }

  async function salvar() {
    if (!pronto || gravando) return
    setGravando(true)
    setFalha('')
    const idsDosMateriais = todosOsGrupos
      .filter((g) => grupos.includes(g.chave))
      .flatMap((g) => g.itens.map((m) => m.id))
    const dados = {
      nome,
      razaoSocial: receita?.razaoSocial ?? editando?.razaoSocial ?? '',
      cnpj: semCnpj ? '' : limpo,
      cidade: receita?.cidade ?? editando?.cidade ?? '',
      uf: receita?.uf ?? editando?.uf ?? '',
      contato,
      pagamento,
      prazo,
      oQueFornece,
      receita: semCnpj ? null : receita,
      tipos: dosTipos,
      materiais: idsDosMateriais,
    }
    try {
      let id: string
      if (editando) {
        id = editando.id
        await salvarFornecedor(id, { ...dados, ...(confiavel ? { situacao: 'confiavel' as const } : {}) })
      } else {
        id = await criarFornecedor({ ...dados, confiavel, entrouPor: 'cadastro' })
      }
      avisar(editando ? 'Fornecedor salvo.' : `${nome.trim()} entrou em Fornecedores.`, 'ok')
      await aoSalvar(id)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui salvar o fornecedor.')
    } finally {
      setGravando(false)
    }
  }

  const gruposLivres = todosOsGrupos.filter((g) => !grupos.includes(g.chave))
  const jaConfiavel = editando?.gravada === 'confiavel'

  return (
    <Modal
      aberto={!!inicio}
      aoFechar={aoFechar}
      largo
      titulo={editando ? 'Editar fornecedor' : 'Novo fornecedor'}
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="primario" onClick={salvar} disabled={!pronto || gravando} carregando={gravando}>
            {gravando ? 'Salvando' : 'Salvar fornecedor'}
          </Botao>
        </>
      }
    >
      <div className="fo-form">
        <p className="fo-ajuda">Comece pelo CNPJ. Razão social, situação e cidade vêm da Receita.</p>

        <div className="campo">
          <span>CNPJ</span>
          <div className="fo-cnpj">
            <Campo className="fo-cnpj-campo" erro={!semCnpj && cnpjCompleto && !cnpjCerto}>
              <Entrada
                value={cnpj}
                disabled={semCnpj}
                onChange={(e) => {
                  setCnpj(mascaraDoCnpj(e.currentTarget.value))
                  setReceita(null)
                  setAvisoDaReceita('')
                }}
                placeholder="00.000.000/0000-00"
                aria-label="CNPJ"
              />
            </Campo>
            <Botao onClick={buscar} disabled={semCnpj || !cnpjCerto || buscando} carregando={buscando}>
              {buscando ? 'Buscando' : 'Buscar na Receita'}
            </Botao>
            <button
              type="button"
              className="fo-link"
              onClick={() => {
                setSemCnpj((s) => !s)
                setReceita(null)
                setAvisoDaReceita('')
                setConfiavel(false)
              }}
            >
              {semCnpj ? 'Ele tem CNPJ' : 'Ele não tem CNPJ'}
            </button>
          </div>
          {!semCnpj && cnpjCompleto && !cnpjCerto ? (
            <span className="dica">Este CNPJ não fecha a conta dos dígitos. Confira os números.</span>
          ) : null}
        </div>

        {semCnpj ? (
          <div className="fo-receita ruim">
            <WarningCircle size={24} />
            <div>
              <b>Sem CNPJ</b>
              <small>
                O Verificador de Boleto reconhece fornecedor pelo CNPJ. Sem ele, todo boleto deste fornecedor
                pede aprovação.
              </small>
            </div>
          </div>
        ) : receita ? (
          <div className="fo-receita">
            <CheckCircle size={24} />
            <div>
              <b>{receita.razaoSocial}</b>
              <small>
                {[
                  receita.situacao + (receita.abertura ? ' desde ' + receita.abertura.slice(0, 4) : ''),
                  receita.atividade,
                  [receita.cidade, receita.uf].filter(Boolean).join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </div>
          </div>
        ) : avisoDaReceita ? (
          <div className="fo-receita ruim">
            <WarningCircle size={24} />
            <div>
              <b>{avisoDaReceita}</b>
              <small>Dá para salvar assim mesmo e consultar depois, pelo botão Editar.</small>
            </div>
          </div>
        ) : null}

        <div className="fo-dois">
          <Campo rotulo="Nome no dia a dia">
            <Entrada
              value={nome}
              onChange={(e) => setNome(e.currentTarget.value)}
              placeholder="Como a fábrica chama este fornecedor"
            />
          </Campo>
          <Campo rotulo="Contato e WhatsApp">
            <Entrada
              value={contato}
              onChange={(e) => setContato(e.currentTarget.value)}
              placeholder="Nome de quem atende e o número"
            />
          </Campo>
        </div>

        <div className="campo">
          <span className="fo-campo-topo">
            Tipo <small>pode marcar mais de um</small>
          </span>
          <div className="fo-form-chips">
            {tipos.map((t) => (
              <Chip
                key={t.chave}
                ligado={dosTipos.includes(t.chave)}
                onClick={() =>
                  setDosTipos((a) => (a.includes(t.chave) ? a.filter((x) => x !== t.chave) : [...a, t.chave]))
                }
              >
                {t.nome}
              </Chip>
            ))}
            {tipoNovo === null ? (
              <Chip className="fo-tracejado" onClick={() => setTipoNovo('')}>
                Novo tipo
              </Chip>
            ) : null}
          </div>
          {tipoNovo !== null ? (
            <div className="fo-novo-tipo">
              <Entrada
                autoFocus
                value={tipoNovo}
                onChange={(e) => setTipoNovo(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void criarTipo()
                  }
                }}
                placeholder="Lavanderia, manutenção, gráfica"
                aria-label="Nome do tipo novo"
              />
              <Botao onClick={criarTipo} disabled={!tipoNovo.trim()}>
                Criar tipo
              </Botao>
              <Botao tom="limpo" onClick={() => setTipoNovo(null)}>
                Desistir
              </Botao>
            </div>
          ) : null}
        </div>

        {temMaterial || grupos.length ? (
          <div className="campo">
            <span className="fo-campo-topo">
              O que ele fornece <small>os materiais são os do Estoque</small>
            </span>
            <div className="fo-form-chips">
              {grupos.map((chave) => {
                const g = todosOsGrupos.find((x) => x.chave === chave)
                if (!g) return null
                return (
                  <span key={chave} className="fo-material">
                    {g.nome}
                    <button
                      type="button"
                      aria-label={'Tirar ' + g.nome}
                      onClick={() => setGrupos((a) => a.filter((x) => x !== chave))}
                    >
                      <X size={14} />
                    </button>
                  </span>
                )
              })}
              {gruposLivres.length ? (
                <Seletor
                  campo
                  comBusca
                  valor=""
                  opcoes={gruposLivres.map((g) => ({ valor: g.chave, rotulo: g.nome }))}
                  aoEscolher={(v) => v && setGrupos((a) => [...a, v])}
                  vazio="Adicionar material"
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {temServico || oQueFornece ? (
          <Campo rotulo="O que ele faz, em palavras" dica="Para frete e serviço, que não são material do estoque.">
            <Entrada
              value={oQueFornece}
              onChange={(e) => setOQueFornece(e.currentTarget.value)}
              placeholder="Entrega ao cliente, costura de camiseta básica"
            />
          </Campo>
        ) : null}

        <div className="fo-dois">
          <Campo rotulo="Pagamento">
            <Entrada value={pagamento} onChange={(e) => setPagamento(e.currentTarget.value)} placeholder="Boleto, 28 dias" />
          </Campo>
          <Campo rotulo="Prazo de entrega">
            <Entrada value={prazo} onChange={(e) => setPrazo(e.currentTarget.value)} placeholder="7 dias úteis" />
          </Campo>
        </div>

        {jaConfiavel ? null : (
          <div className="fo-marcar">
            <Marcacao
              checked={confiavel}
              disabled={!admin || semCnpj || !cnpjCerto}
              onChange={(e) => setConfiavel(e.currentTarget.checked)}
            >
              <b>Já marcar como confiável</b>
            </Marcacao>
            <small>
              Só administrador, e só com CNPJ. Sem isto ele entra como Novo, e o primeiro boleto dele pede
              aprovação.
            </small>
          </div>
        )}

        {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
      </div>
    </Modal>
  )
}

/* "MALHAS EXEMPLO DO SUL LTDA" vira "Malhas Exemplo do Sul": o palpite do
   nome do dia a dia, que a pessoa troca se quiser. */
function nomeCurto(razao: string): string {
  const miudas = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  return razao
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\/?A|S\.A\.?)\.?$/i, '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && miudas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}
