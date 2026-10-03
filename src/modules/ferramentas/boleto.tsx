import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Circle, Copy, FilePdf, WarningCircle, X, XCircle } from '@phosphor-icons/react'
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Entrada,
  Esqueleto,
  Marcacao,
  Modal,
  Pagina,
  TituloCartao,
  Vazio,
  avisar,
} from '@ds'
import { formatarDinheiroExato } from '@shared'
import {
  AS_OITO,
  COR_DO_RESULTADO,
  NOME_DO_RESULTADO,
  bancoNaTela,
  carregarConferencias,
  conferirBoleto,
  dadosDoBoleto,
  decidirBoleto,
  lerLinha,
  lerPdfDoBoleto,
  liberadaParaPagar,
  linhaNaTela,
  pedirAprovacao,
  registrarConferencia,
  resultadoNaLista,
  type BoletoLido,
  type Checagem,
  type Conferencia,
  type Conferido,
  type Decisao,
  type Estado,
  type Resultado,
} from '@dominio/boleto'
import { EMPRESA } from '@dominio/empresa'
import {
  carregarFornecedores,
  cnpjNaTela,
  cnpjValido,
  consultarNaReceita,
  limparCnpj,
  mascaraDoCnpj,
  salvarFornecedor,
  criarFornecedor,
  type Fornecedor,
  type NaReceita,
} from '@dominio/fornecedor'
import { pode, souAdmin, useSessao } from '@dominio/sessao'
import './boleto.css'

/* ==========================================================================
   O Verificador de Boleto.

   Antes de pagar, o boleto passa por aqui. A pessoa solta o PDF (ou cola a
   linha digitável), o sistema faz oito conferências e responde uma de três
   coisas: pode pagar, precisa de aprovação, não pague.

   O ARQUIVO NÃO FICA GUARDADO. Ele é lido neste navegador e esquecido. O
   registro guarda o que estava escrito no boleto e o resultado.

   A LINHA DIGITÁVEL SÓ APARECE PARA COPIAR QUANDO PODE PAGAR. Enquanto o
   boleto espera aprovação, ou quando o resultado é vermelho, a linha fica
   escondida: quem confere não tem o que colar no banco. Não é segurança (a
   pessoa tem o PDF), é o sistema não entregando de bandeja o que ele mesmo
   acabou de dizer para não pagar.

   QUEM APROVA É O ADMINISTRADOR, numa caixa que mostra o boleto ao lado do
   que a Receita diz daquele CNPJ. Ele escolhe entre aprovar só este boleto
   e aprovar e pôr o fornecedor na lista de confiáveis.
   ========================================================================== */

const COR_DO_ESTADO: Record<Estado, string> = {
  ok: 'var(--ok)',
  atencao: 'var(--warn)',
  erro: 'var(--brand)',
}

function Icone({ estado, tamanho = 24 }: { estado?: Estado; tamanho?: number }) {
  if (estado === 'ok') return <CheckCircle size={tamanho} />
  if (estado === 'atencao') return <WarningCircle size={tamanho} />
  if (estado === 'erro') return <XCircle size={tamanho} />
  return <Circle size={tamanho} />
}

function cor(c: string): CSSProperties {
  return { '--c': c } as CSSProperties
}

function meiaNoite(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
/** "hoje, 09:12", "ontem, 16:40", "30/09, 15:22" */
function quandoFoi(iso: string): string {
  const dias = Math.round((meiaNoite(new Date()) - meiaNoite(new Date(iso))) / 86400000)
  const dia =
    dias === 0
      ? 'hoje'
      : dias === 1
        ? 'ontem'
        : new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${dia}, ${horaDe(iso)}`
}
function dataBr(iso: string): string {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function contaDasChecagens(cs: Checagem[]): string {
  const certos = cs.filter((c) => c.estado === 'ok').length
  const erros = cs.filter((c) => c.estado === 'erro').length
  const atencao = cs.filter((c) => c.estado === 'atencao').length
  if (certos === cs.length) return `${certos} de ${cs.length} certos`
  const partes = [certos === 1 ? '1 certo' : `${certos} certos`]
  if (erros) partes.push(erros === 1 ? '1 errado' : `${erros} errados`)
  if (atencao) partes.push(atencao === 1 ? '1 pede atenção' : `${atencao} pedem atenção`)
  return partes.join(', ')
}

export function TelaVerificadorDeBoleto() {
  const navegar = useNavigate()
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const admin = souAdmin(pessoa)
  const veFornecedores = !!pessoa && pode(pessoa, 'estoque', 'ver')

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [conferencias, setConferencias] = useState<Conferencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semRegistro, setSemRegistro] = useState('')

  const [lido, setLido] = useState<BoletoLido | null>(null)
  const [lendo, setLendo] = useState(false)
  const [emCima, setEmCima] = useState(false)
  const [linhaTexto, setLinhaTexto] = useState('')
  const [cnpjTexto, setCnpjTexto] = useState('')
  const [falha, setFalha] = useState('')
  const [conferindo, setConferindo] = useState(false)
  const [conferido, setConferido] = useState<Conferido | null>(null)
  const [registro, setRegistro] = useState<Conferencia | null>(null)
  const [motivo, setMotivo] = useState('')
  const [pedindo, setPedindo] = useState(false)

  const [aberta, setAberta] = useState<Conferencia | null>(null)
  const [bloqueando, setBloqueando] = useState(false)
  const arquivoRef = useRef<HTMLInputElement>(null)

  const lerRegistro = useCallback(async () => {
    const [cs, fs] = await Promise.all([carregarConferencias(), carregarFornecedores()])
    setConferencias(cs)
    setFornecedores(fs)
    setSemRegistro('')
    return fs
  }, [])

  useEffect(() => {
    let vivo = true
    lerRegistro()
      .catch((e: unknown) => {
        if (vivo) setSemRegistro(e instanceof Error ? e.message : 'Não consegui ler o registro.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [lerRegistro])

  function limpar() {
    setLido(null)
    setLinhaTexto('')
    setCnpjTexto('')
    setFalha('')
    setConferido(null)
    setRegistro(null)
    setMotivo('')
    if (arquivoRef.current) arquivoRef.current.value = ''
  }

  async function conferir(doPdf: BoletoLido | null, texto: string, cnpj: string) {
    if (conferindo) return
    setFalha('')
    const linha = doPdf?.linha ?? lerLinha(texto)
    if (!linha) {
      setFalha(
        doPdf
          ? 'Não achei a linha digitável neste PDF. Cole a linha no campo de baixo e confira de novo.'
          : texto.trim()
            ? 'A linha digitável tem 47 números (ou 48, na guia de arrecadação). Confira se colou inteira.'
            : 'Solte o PDF do boleto ou cole a linha digitável.',
      )
      return
    }
    const digitado = limparCnpj(cnpj)
    if (digitado && !cnpjValido(digitado)) {
      setFalha('O CNPJ de quem recebe não fecha a conta dos dígitos. Confira os números.')
      return
    }
    setConferindo(true)
    try {
      const dados = dadosDoBoleto(linha, doPdf, cnpj)
      const feito = await conferirBoleto(dados, fornecedores)
      /* o boleto que já foi aprovado, ou que já espera decisão, não ganha uma
         segunda linha no registro: ele já está lá */
      if (feito.aprovacaoAnterior || feito.esperaAnterior) {
        setConferido(feito)
        setRegistro(feito.aprovacaoAnterior ?? feito.esperaAnterior)
        return
      }
      let gravado: Conferencia | null = null
      try {
        gravado = await registrarConferencia(feito)
      } catch (e) {
        avisar(
          'A conferência foi feita, mas não ficou no registro: ' +
            (e instanceof Error ? e.message : 'o banco recusou.'),
          'brand',
        )
      }
      /* a última palavra é do banco: se ele rebaixou o resultado, vale o dele */
      setConferido(gravado ? { ...feito, resultado: gravado.resultado } : feito)
      setRegistro(gravado)
      if (gravado) void lerRegistro().catch(() => undefined)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui conferir este boleto.')
    } finally {
      setConferindo(false)
    }
  }

  async function receber(arquivo: File | undefined) {
    if (!arquivo || lendo) return
    if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
      setFalha('O verificador lê PDF. Para foto ou imagem, cole a linha digitável no campo de baixo.')
      return
    }
    setLendo(true)
    setFalha('')
    setConferido(null)
    setRegistro(null)
    try {
      const boleto = await lerPdfDoBoleto(arquivo)
      setLido(boleto)
      if (boleto.linha) setLinhaTexto(linhaNaTela(boleto.linha.linha))
      setLendo(false)
      await conferir(boleto, linhaTexto, cnpjTexto)
    } catch (e) {
      setLido(null)
      setFalha(e instanceof Error ? e.message : 'Não consegui ler este arquivo.')
    } finally {
      setLendo(false)
    }
  }

  function soltou(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setEmCima(false)
    void receber(e.dataTransfer.files?.[0])
  }

  async function pedir() {
    if (!registro || pedindo) return
    setPedindo(true)
    try {
      const novo = await pedirAprovacao(registro.id, motivo.trim())
      setRegistro(novo)
      avisar('Aprovação pedida. Um administrador decide.', 'ok')
      await lerRegistro().catch(() => undefined)
      if (admin) setAberta(novo)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui pedir a aprovação.', 'brand')
    } finally {
      setPedindo(false)
    }
  }

  async function copiar(linha: string) {
    try {
      await navigator.clipboard.writeText(linha)
      avisar('Linha digitável copiada.', 'ok')
    } catch {
      avisar('O navegador não deixou copiar. Selecione a linha e copie à mão.', 'brand')
    }
  }

  const dados = conferido?.dados ?? null
  const resultado: Resultado | null = conferido?.resultado ?? null
  const corDoResultado = resultado ? COR_DO_RESULTADO[resultado] : ''
  const esperando = registro?.situacao === 'esperando'
  const aprovado = registro?.situacao === 'aprovado'
  const fornecedorDoBoleto = dados?.cnpj ? (fornecedores.find((f) => f.cnpj === dados.cnpj) ?? null) : null

  return (
    <Pagina
      acima="Ferramentas"
      titulo="Verificador de Boleto"
      sub="Confira antes de pagar. O arquivo do boleto não fica guardado, só o resultado da conferência."
      acoes={
        <>
          {veFornecedores ? (
            <Botao onClick={() => navegar('/fornecedores?situacao=confiavel')}>Fornecedores confiáveis</Botao>
          ) : null}
          {conferido ? <Botao onClick={limpar}>Conferir outro boleto</Botao> : null}
        </>
      }
    >
      {semRegistro ? (
        <Aviso tom="warn" titulo="O registro das conferências não respondeu">
          {semRegistro} Dá para conferir os dígitos da linha, mas a lista de fornecedores e o histórico não entram
          na conta enquanto isto não voltar.
        </Aviso>
      ) : null}

      <div className="bo-duas">
        {/* ------------------------------------------------ o boleto */}
        <section className="cartao bo-caixa">
          <div className="bo-topo">
            <TituloCartao>O boleto</TituloCartao>
            <span className="bo-nota">lido aqui no navegador, sem guardar o arquivo</span>
          </div>

          {conferido && dados ? (
            <>
              {dados.arquivo ? (
                <div className="bo-arquivo">
                  <FilePdf size={20} />
                  <b>{dados.arquivo}</b>
                  <small>lido, não guardado</small>
                  <button type="button" className="bo-icone-botao" aria-label="Conferir outro boleto" onClick={limpar}>
                    <X size={16} />
                  </button>
                </div>
              ) : null}
              <div className="pilha">
                <div className="bo-linha-topo">
                  Linha digitável
                  <small>
                    {resultado === 'pode_pagar'
                      ? 'liberada para copiar'
                      : resultado === 'precisa_aprovacao'
                        ? 'escondida até a aprovação'
                        : 'escondida: não pague'}
                  </small>
                </div>
                {resultado === 'pode_pagar' ? (
                  <div className="bo-linha">
                    <span>{linhaNaTela(dados.linha.linha)}</span>
                    <button
                      type="button"
                      className="bo-icone-botao"
                      aria-label="Copiar a linha digitável"
                      onClick={() => void copiar(dados.linha.linha)}
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="bo-linha escondida" aria-label="Linha digitável escondida">
                    <span>••••• ••••• ••••• •••••• ••••• •••••• • ••••••••••••••</span>
                  </div>
                )}
              </div>
              <div className="bo-diz">
                <p className="bo-diz-titulo">O que o boleto diz</p>
                <div className="bo-dado inteiro">
                  <span>Beneficiário</span>
                  {dados.beneficiario ? <b>{dados.beneficiario}</b> : <b className="falta">não achei o nome</b>}
                </div>
                <div className="bo-dado">
                  <span>CNPJ do beneficiário</span>
                  {dados.cnpj ? <b>{cnpjNaTela(dados.cnpj)}</b> : <b className="falta">não achei</b>}
                </div>
                <div className="bo-dado">
                  <span>Banco emissor</span>
                  {dados.linha.banco ? <b>{bancoNaTela(dados.linha.banco)}</b> : <b className="falta">guia de arrecadação</b>}
                </div>
                <div className="bo-dado">
                  <span>Valor</span>
                  {dados.linha.valor !== null ? (
                    <b>{formatarDinheiroExato(dados.linha.valor)}</b>
                  ) : (
                    <b className="falta">a linha não traz</b>
                  )}
                </div>
                <div className="bo-dado">
                  <span>Vencimento</span>
                  {dados.linha.vencimento ? <b>{dataBr(dados.linha.vencimento)}</b> : <b className="falta">a linha não traz</b>}
                </div>
                <div className="bo-dado inteiro">
                  <span>Pagador</span>
                  {dados.pagadorEhAEmpresa ? (
                    <b>{EMPRESA.nome}, com o CNPJ da empresa</b>
                  ) : dados.pagadorEhAEmpresa === false ? (
                    <b>O CNPJ da {EMPRESA.nome} não está no boleto</b>
                  ) : (
                    <b className="falta">{dados.temPdf ? 'falta o CNPJ da empresa em Configurações' : 'sem PDF para ler'}</b>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {lido ? (
                <div className="bo-arquivo">
                  <FilePdf size={20} />
                  <b>{lido.arquivo}</b>
                  <small>lido, não guardado</small>
                  <button type="button" className="bo-icone-botao" aria-label="Tirar este arquivo" onClick={limpar}>
                    <X size={16} />
                  </button>
                </div>
              ) : null}
              <div
                className={emCima ? 'bo-solta em-cima' : 'bo-solta'}
                onDragOver={(e) => {
                  e.preventDefault()
                  setEmCima(true)
                }}
                onDragLeave={() => setEmCima(false)}
                onDrop={soltou}
              >
                <FilePdf size={28} />
                <b>{lendo ? 'Lendo o boleto' : 'Arraste o PDF do boleto para cá'}</b>
                <Botao onClick={() => arquivoRef.current?.click()} carregando={lendo} disabled={lendo}>
                  Escolher arquivo
                </Botao>
                <input
                  ref={arquivoRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => void receber(e.currentTarget.files?.[0])}
                />
              </div>
              <div className="bo-ou">ou cole a linha digitável</div>
              <Campo rotulo="Linha digitável" dica="47 números. Pode colar com ponto e espaço.">
                <Entrada
                  inputMode="numeric"
                  value={linhaTexto}
                  onChange={(e) => setLinhaTexto(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void conferir(lido, linhaTexto, cnpjTexto)
                  }}
                  placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                />
              </Campo>
              <Campo
                rotulo="CNPJ de quem recebe"
                dica="Só quando não há PDF: está escrito no boleto, ao lado do beneficiário."
              >
                <Entrada
                  value={cnpjTexto}
                  onChange={(e) => setCnpjTexto(mascaraDoCnpj(e.currentTarget.value))}
                  placeholder="00.000.000/0000-00"
                />
              </Campo>
              {falha ? <p className="bo-erro">{falha}</p> : null}
              <div className="bo-pe">
                <p>Do boleto saem beneficiário, CNPJ, banco, valor, vencimento e pagador.</p>
                <span className="bo-pe-botoes">
                  <Botao onClick={limpar}>Limpar</Botao>
                  <Botao
                    tom="primario"
                    onClick={() => void conferir(lido, linhaTexto, cnpjTexto)}
                    carregando={conferindo}
                    disabled={conferindo || lendo}
                  >
                    {conferindo ? 'Conferindo' : 'Conferir boleto'}
                  </Botao>
                </span>
              </div>
            </>
          )}
        </section>

        {/* ------------------------------------------------ o resultado */}
        <section className="cartao bo-caixa">
          <div className="bo-topo">
            <TituloCartao>O resultado</TituloCartao>
            <span className="bo-nota">
              {conferido ? (registro ? 'conferido ' + quandoFoi(registro.quando) : 'conferido agora') : 'aparece aqui depois de conferir'}
            </span>
          </div>

          {conferido && resultado && dados ? (
            <>
              <div className="bo-veredito" style={cor(corDoResultado)}>
                <div className="bo-veredito-rosto">
                  <Icone
                    estado={resultado === 'pode_pagar' ? 'ok' : resultado === 'nao_pague' ? 'erro' : 'atencao'}
                    tamanho={48}
                  />
                  <div>
                    <h2>{NOME_DO_RESULTADO[resultado]}</h2>
                    <p>
                      {resultado === 'pode_pagar'
                        ? aprovado
                          ? `Aprovado por ${registro?.decididoPor.split(' ')[0] || 'um administrador'}. Este boleto está liberado.`
                          : 'Fornecedor conhecido, e tudo bate com o que a Fourtime já pagou a ele antes.'
                        : resultado === 'precisa_aprovacao'
                          ? 'O boleto pode estar certo, mas a Fourtime não conhece quem recebe. Fica bloqueado até alguém com permissão aprovar.'
                          : (conferido.checagens.find((c) => c.estado === 'erro')?.texto ?? 'Alguma conferência falhou.') + '.'}
                    </p>
                  </div>
                </div>
                <div className="bo-veredito-lado">
                  {resultado === 'pode_pagar' ? (
                    <>
                      <span>No banco tem que aparecer</span>
                      <b>{dados.beneficiario || 'o nome do boleto'}</b>
                      {dados.cnpj ? <b>{cnpjNaTela(dados.cnpj)}</b> : null}
                      <small>Se aparecer outro, não pague.</small>
                    </>
                  ) : resultado === 'precisa_aprovacao' ? (
                    <>
                      <span>Enquanto não aprovar</span>
                      A linha digitável fica escondida e o boleto não é liberado. Quem aprova é um administrador.
                    </>
                  ) : (
                    <>
                      <span>O que fazer</span>
                      Não pague. Fale com quem pediu a compra e peça o boleto de novo, por outro canal.
                    </>
                  )}
                </div>
              </div>

              <div className="bo-conta">
                O que foi conferido
                <b>{contaDasChecagens(conferido.checagens)}</b>
              </div>
              <div className="bo-oito">
                {conferido.checagens.map((c) => (
                  <div key={c.chave} className="bo-checagem" style={cor(COR_DO_ESTADO[c.estado])}>
                    <Icone estado={c.estado} />
                    <div>
                      <b>{c.titulo}</b>
                      <small>{c.texto}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bo-acao">
                {resultado === 'pode_pagar' ? (
                  <>
                    <p>
                      {registro
                        ? `Conferido por ${registro.quem.split(' ')[0] || 'você'}, ${quandoFoi(registro.quando)}. Ficou no registro.`
                        : 'Conferido agora.'}
                    </p>
                    <Botao tom="primario" onClick={() => void copiar(dados.linha.linha)}>
                      Copiar linha digitável
                    </Botao>
                  </>
                ) : resultado === 'precisa_aprovacao' ? (
                  esperando ? (
                    <>
                      <p>Aprovação pedida {registro ? quandoFoi(registro.quando) : ''}. Um administrador decide.</p>
                      {admin && registro ? (
                        <Botao tom="primario" onClick={() => setAberta(registro)}>
                          Decidir agora
                        </Botao>
                      ) : null}
                    </>
                  ) : registro ? (
                    <>
                      <Entrada
                        className="bo-motivo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.currentTarget.value)}
                        placeholder="Do que é esta compra? Quem aprova vai ler isto."
                        aria-label="Do que é esta compra"
                      />
                      <Botao tom="primario" onClick={pedir} carregando={pedindo} disabled={pedindo}>
                        {admin ? 'Abrir a aprovação' : 'Pedir aprovação do fornecedor'}
                      </Botao>
                    </>
                  ) : (
                    <p>Sem o registro não dá para pedir aprovação. Fale com um administrador.</p>
                  )
                ) : (
                  <>
                    <p>Ficou no registro como não pague. Se o boleto veio por e-mail ou WhatsApp, desconfie de quem mandou.</p>
                    {admin && dados.cnpj && fornecedorDoBoleto?.gravada !== 'bloqueado' ? (
                      <Botao tom="perigo" onClick={() => setBloqueando(true)}>
                        Bloquear este CNPJ
                      </Botao>
                    ) : null}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="bo-niveis">
                <div className="bo-nivel">
                  <b>
                    <i style={cor('var(--ok)')} />
                    Pode pagar
                  </b>
                  <span>Fornecedor conhecido e tudo bate.</span>
                </div>
                <div className="bo-nivel">
                  <b>
                    <i style={cor('var(--warn)')} />
                    Precisa de aprovação
                  </b>
                  <span>Boleto válido, mas de quem a Fourtime nunca pagou. Fica bloqueado até alguém aprovar.</span>
                </div>
                <div className="bo-nivel">
                  <b>
                    <i style={cor('var(--brand)')} />
                    Não pague
                  </b>
                  <span>Dígito errado, valor divergente ou pagador que não é a Fourtime.</span>
                </div>
              </div>
              <div className="bo-conta">
                O que é conferido
                <small>8 conferências em cada boleto</small>
              </div>
              <div className="bo-oito">
                {AS_OITO.map((c) => (
                  <div key={c.chave} className="bo-checagem">
                    <Icone />
                    <div>
                      <b>{c.titulo}</b>
                      <small>{c.oQueE}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bo-acao">
                <p>
                  Na hora de pagar, o banco mostra o nome e o CNPJ de quem recebe. Tem que ser o mesmo que aparece
                  aqui. Se for outro, não pague.
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ------------------------------------------------ o registro */}
      <section className="cartao bo-registro">
        <div className="bo-registro-topo">
          <TituloCartao>Últimas conferências</TituloCartao>
          <span className="bo-nota">o registro guarda os dados lidos e o resultado, nunca o arquivo</span>
        </div>
        {carregando ? (
          <div className="bo-caixa">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        ) : conferencias.length === 0 ? (
          <Vazio
            titulo={semRegistro ? 'Registro fora do ar' : 'Nenhum boleto conferido ainda'}
            texto={semRegistro ? semRegistro : 'O primeiro boleto que passar por aqui aparece nesta lista.'}
          />
        ) : (
          <div className="tabela-rola">
            <table className="tabela bo-tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th className="bo-some-estreito">Quem conferiu</th>
                  <th>Beneficiário</th>
                  <th className="bo-some-medio">CNPJ</th>
                  <th className="dir">Valor</th>
                  <th className="bo-some-estreito">Vencimento</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {conferencias.map((c) => {
                  const r = resultadoNaLista(c)
                  return (
                    <tr key={c.id} className="bo-abre" onClick={() => setAberta(c)}>
                      <td className="bo-apoio">{quandoFoi(c.quando)}</td>
                      <td className="bo-some-estreito">{c.quem || 'sistema'}</td>
                      <td>
                        <b>{c.beneficiario || 'sem nome'}</b>
                      </td>
                      <td className="bo-apoio bo-numero bo-some-medio">{c.cnpj ? cnpjNaTela(c.cnpj) : ''}</td>
                      <td className="dir">
                        <b>{c.valor !== null ? formatarDinheiroExato(c.valor) : ''}</b>
                      </td>
                      <td className="bo-apoio bo-numero bo-some-estreito">{dataBr(c.vencimento)}</td>
                      <td>
                        <span className="bo-resultado">
                          <i className="bo-ponto" style={cor(r.cor)} />
                          {r.texto}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DecisaoDoBoleto
        conferencia={aberta}
        fornecedores={fornecedores}
        admin={admin}
        aoFechar={() => setAberta(null)}
        aoCopiar={(linha) => void copiar(linha)}
        aoDecidir={async (nova) => {
          setAberta(null)
          const fs = await lerRegistro().catch(() => fornecedores)
          /* a decisão sobre o boleto que está na tela muda o que a tela diz */
          if (registro && nova.id === registro.id && conferido) {
            setRegistro(nova)
            if (nova.situacao === 'aprovado') {
              setConferido({ ...conferido, resultado: 'pode_pagar', aprovacaoAnterior: nova })
            }
          }
          void fs
        }}
      />
      <BloquearCnpj
        aberto={bloqueando}
        nome={dados?.beneficiario ?? ''}
        cnpj={dados?.cnpj ?? ''}
        fornecedor={fornecedorDoBoleto}
        aoFechar={() => setBloqueando(false)}
        aoFeito={async () => {
          setBloqueando(false)
          await lerRegistro().catch(() => undefined)
        }}
      />
    </Pagina>
  )
}

/* --- a decisão ---------------------------------------------------------------
   A mesma caixa serve para decidir (administrador, boleto esperando) e para
   reler uma conferência do registro. O que muda é o rodapé. */
function DecisaoDoBoleto({
  conferencia,
  fornecedores,
  admin,
  aoFechar,
  aoCopiar,
  aoDecidir,
}: {
  conferencia: Conferencia | null
  fornecedores: Fornecedor[]
  admin: boolean
  aoFechar: () => void
  aoCopiar: (linha: string) => void
  aoDecidir: (nova: Conferencia) => Promise<void>
}) {
  const [receita, setReceita] = useState<NaReceita | null>(null)
  const [semReceita, setSemReceita] = useState('')
  const [confirmei, setConfirmei] = useState(false)
  const [nota, setNota] = useState('')
  const [decidindo, setDecidindo] = useState<Decisao | ''>('')
  const [falha, setFalha] = useState('')

  const c = conferencia
  const fornecedor = c?.cnpj ? (fornecedores.find((f) => f.cnpj === c.cnpj) ?? null) : null
  const decide = !!c && admin && c.situacao === 'esperando'

  useEffect(() => {
    if (!c) return
    setConfirmei(false)
    setNota('')
    setFalha('')
    setSemReceita('')
    setReceita(fornecedor?.receita ?? null)
    /* quem decide olha a Receita de agora, e não a do dia do cadastro */
    if (!decide || !c.cnpj) return
    let vivo = true
    void consultarNaReceita(c.cnpj).then((r) => {
      if (!vivo) return
      if (r.receita) setReceita(r.receita)
      else setSemReceita(r.motivo)
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id])

  async function decidir(decisao: Decisao) {
    if (!c || decidindo) return
    setDecidindo(decisao)
    setFalha('')
    try {
      const nova = await decidirBoleto(c.id, decisao, nota.trim())
      avisar(
        decisao === 'recusar'
          ? 'Boleto recusado.'
          : decisao === 'aprovar_e_listar'
            ? `Boleto aprovado, e ${c.beneficiario} entrou na lista de confiáveis.`
            : 'Boleto aprovado. O fornecedor continua fora da lista.',
        'ok',
      )
      await aoDecidir(nova)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui gravar a decisão.')
    } finally {
      setDecidindo('')
    }
  }

  const checagem = (chave: string) => c?.checagens.find((k) => k.chave === chave)
  const sabe = (['fornecedor', 'historico', 'receita', 'banco'] as const)
    .map((k) => checagem(k))
    .filter((k): k is Checagem => !!k && !!k.texto)
  const r = c ? resultadoNaLista(c) : null

  return (
    <Modal
      aberto={!!c}
      aoFechar={aoFechar}
      largo
      titulo={c ? c.beneficiario || 'Conferência de boleto' : ''}
      pe={
        decide ? (
          <>
            <span className="bo-pe-esquerda">
              <Botao onClick={() => void decidir('recusar')} carregando={decidindo === 'recusar'} disabled={!!decidindo}>
                Recusar
              </Botao>
            </span>
            <Botao
              onClick={() => void decidir('aprovar')}
              carregando={decidindo === 'aprovar'}
              disabled={!confirmei || !!decidindo}
            >
              Aprovar só este boleto
            </Botao>
            <Botao
              tom="primario"
              onClick={() => void decidir('aprovar_e_listar')}
              carregando={decidindo === 'aprovar_e_listar'}
              disabled={!confirmei || !!decidindo || !c?.cnpj}
            >
              Aprovar e pôr na lista
            </Botao>
          </>
        ) : (
          <>
            <Botao onClick={aoFechar}>Fechar</Botao>
            {c && liberadaParaPagar(c) ? (
              <Botao tom="primario" onClick={() => aoCopiar(c.linha)}>
                Copiar linha digitável
              </Botao>
            ) : null}
          </>
        )
      }
    >
      {c ? (
        <div className="bo-decisao">
          <p className="bo-decisao-sub">
            {decide
              ? `Aprovação de fornecedor novo. Pedido por ${c.quem || 'alguém da equipe'}, ${quandoFoi(c.quando)}. O boleto está bloqueado esperando esta decisão.`
              : `Conferido por ${c.quem || 'alguém da equipe'}, ${quandoFoi(c.quando)}.`}{' '}
            {!decide && r ? (
              <span className="bo-resultado">
                <i className="bo-ponto" style={cor(r.cor)} />
                {r.texto}
                {c.decididoEm ? ', ' + quandoFoi(c.decididoEm) : ''}
              </span>
            ) : null}
          </p>

          {c.motivo ? (
            <div className="bo-escreveu">
              <span>O que {c.quem ? c.quem.split(' ')[0] : 'quem pediu'} escreveu</span>
              {c.motivo}
            </div>
          ) : null}
          {c.notaDaDecisao ? (
            <div className="bo-escreveu">
              <span>A nota de quem decidiu</span>
              {c.notaDaDecisao}
            </div>
          ) : null}

          <div className="bo-colunas">
            <div className="bo-coluna">
              <h3>O boleto</h3>
              <div className="bo-par">
                <span>Valor</span>
                <b>{c.valor !== null ? formatarDinheiroExato(c.valor) : 'a linha não traz'}</b>
              </div>
              <div className="bo-par">
                <span>Vencimento</span>
                <b>{dataBr(c.vencimento) || 'a linha não traz'}</b>
              </div>
              <div className="bo-par">
                <span>Banco emissor</span>
                <b>{bancoNaTela(c.banco) || 'guia de arrecadação'}</b>
              </div>
              <div className="bo-par">
                <span>Pagador</span>
                <b>{checagem('pagador')?.texto || c.pagador || 'não lido'}</b>
              </div>
              <div className="bo-par">
                <span>Linha digitável</span>
                <b>{checagem('linha')?.estado === 'ok' ? 'os dígitos conferem' : 'os dígitos não conferem'}</b>
              </div>
              <div className="bo-par">
                <span>Boleto repetido</span>
                <b>{checagem('repetido')?.texto.toLowerCase() || 'sem registro'}</b>
              </div>
            </div>
            <div className="bo-coluna">
              <h3>O que a Receita diz</h3>
              <div className="bo-par">
                <span>CNPJ</span>
                <b>{c.cnpj ? cnpjNaTela(c.cnpj) : 'o boleto não traz'}</b>
              </div>
              {receita ? (
                <>
                  <div className="bo-par">
                    <span>Razão social</span>
                    <b>{receita.razaoSocial}</b>
                  </div>
                  <div className="bo-par">
                    <span>Situação</span>
                    <b>{receita.situacao || 'não informada'}</b>
                  </div>
                  <div className="bo-par">
                    <span>Aberta em</span>
                    <b>{dataBr(receita.abertura) || 'não informada'}</b>
                  </div>
                  <div className="bo-par">
                    <span>Atividade</span>
                    <b>{receita.atividade || 'não informada'}</b>
                  </div>
                  <div className="bo-par">
                    <span>Cidade</span>
                    <b>{[receita.cidade, receita.uf].filter(Boolean).join(', ') || 'não informada'}</b>
                  </div>
                </>
              ) : (
                <div className="bo-par">
                  <span>Consulta</span>
                  <b>{semReceita || checagem('receita')?.texto || 'sem resposta'}</b>
                </div>
              )}
            </div>
          </div>

          {sabe.length ? (
            <div className="bo-sabe">
              <h3>O que a Fourtime sabe deste CNPJ</h3>
              {sabe.map((k) => (
                <div key={k.chave} className="bo-sabe-linha" style={cor(COR_DO_ESTADO[k.estado])}>
                  <Icone estado={k.estado} />
                  {k.texto}
                </div>
              ))}
            </div>
          ) : null}

          {decide ? (
            <>
              <Campo rotulo="Nota da decisão" dica="Opcional. Fica no registro, ao lado do seu nome.">
                <Entrada
                  value={nota}
                  onChange={(e) => setNota(e.currentTarget.value)}
                  placeholder="Com quem você confirmou, por exemplo"
                />
              </Campo>
              <Marcacao checked={confirmei} onChange={(e) => setConfirmei(e.currentTarget.checked)}>
                <b>Confirmei com quem pediu a compra que este boleto é esperado.</b>
              </Marcacao>
            </>
          ) : null}
          {c.situacao === 'esperando' && !admin ? (
            <Aviso tom="warn">Este boleto espera a decisão de um administrador.</Aviso>
          ) : null}
          {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
        </div>
      ) : null}
    </Modal>
  )
}

/* BLOQUEAR O CNPJ DE UM BOLETO VERMELHO. Vira um fornecedor bloqueado: é ele
   que faz o próximo boleto do mesmo CNPJ nascer vermelho, com o motivo
   escrito, e que recusa a entrada dele no estoque. */
function BloquearCnpj({
  aberto,
  nome,
  cnpj,
  fornecedor,
  aoFechar,
  aoFeito,
}: {
  aberto: boolean
  nome: string
  cnpj: string
  fornecedor: Fornecedor | null
  aoFechar: () => void
  aoFeito: () => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')
  useEffect(() => {
    if (aberto) {
      setMotivo('')
      setFalha('')
    }
  }, [aberto])

  async function bloquear() {
    if (!motivo.trim() || gravando) return
    setGravando(true)
    try {
      if (fornecedor) {
        await salvarFornecedor(fornecedor.id, { situacao: 'bloqueado', motivoDoBloqueio: motivo })
      } else {
        const id = await criarFornecedor({
          nome: nome || 'CNPJ ' + cnpjNaTela(cnpj),
          razaoSocial: nome,
          cnpj,
          entrouPor: 'boleto',
        })
        await salvarFornecedor(id, { situacao: 'bloqueado', motivoDoBloqueio: motivo })
      }
      avisar('CNPJ bloqueado. O próximo boleto dele já nasce vermelho.', 'ok')
      await aoFeito()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui bloquear.')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Bloquear este CNPJ"
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="perigo" onClick={bloquear} disabled={!motivo.trim() || gravando} carregando={gravando}>
            Bloquear
          </Botao>
        </>
      }
    >
      <div className="bo-decisao">
        <p className="bo-decisao-sub">
          {nome ? nome + ', ' : ''}
          {cnpjNaTela(cnpj)}. Bloqueado, todo boleto deste CNPJ sai como não pague, e a entrada dele no estoque é
          recusada. Só um administrador desbloqueia, em Fornecedores.
        </p>
        <Campo rotulo="Por que bloquear">
          <AreaTexto
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
            placeholder="O que aconteceu, para quem ler isto daqui a seis meses"
          />
        </Campo>
        {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
      </div>
    </Modal>
  )
}
