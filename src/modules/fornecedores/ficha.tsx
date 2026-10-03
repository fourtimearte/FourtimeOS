import { useEffect, useState } from 'react'
import { CaretRight, X } from '@phosphor-icons/react'
import { Botao, Tag } from '@ds'
import {
  CATEGORIAS,
  gruposDoEstoque,
  type Categoria,
  type Material,
} from '@dominio/estoque'
import {
  NOME_DA_ENTRADA,
  cnpjNaTela,
  ondeFica,
  resumoDaReceita,
  situacaoDe,
  ultimasEntradasDoFornecedor,
  type Fornecedor,
  type TipoDeFornecedor,
} from '@dominio/fornecedor'
import { SituacaoDoFornecedor } from '@dominio/fornecedor/escolher'

/* ==========================================================================
   A ficha do fornecedor.

   Quem é, o que ele fornece e onde ele aparece no resto do sistema. A ficha
   não tem aba: ela é uma coluna só, na ordem em que as perguntas vêm.

   "O QUE ELE FORNECE" SAI DO ESTOQUE, e não de um texto. São os materiais
   ligados a ele, agrupados do mesmo jeito que o estoque agrupa: a malha com
   as cores dentro, o grupo com os itens dentro.

   "ONDE ELE APARECE" SÃO PORTAS, não resumos: cada linha leva para a página
   que tem o detalhe.
   ========================================================================== */

function mesEAno(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function diaEMes(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function diaMesAno(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function situacaoPorExtenso(f: Fornecedor): string {
  const s = situacaoDe(f)
  if (s === 'confiavel') return 'Confiável' + (f.aprovadoPor ? ', aprovado por ' + f.aprovadoPor.split(' ')[0] : '')
  if (s === 'sem-cnpj') return 'Sem CNPJ, e por isso o boleto dele não é reconhecido'
  if (s === 'esperando') return 'Esperando aprovação de um administrador'
  if (s === 'bloqueado') return 'Bloqueado'
  return 'Novo: o primeiro boleto dele pede aprovação'
}

export function CabecalhoDaFicha({ f, aoFechar }: { f: Fornecedor; aoFechar?: () => void }) {
  const onde = ondeFica(f)
  return (
    <div className="fo-ficha-topo">
      <div>
        <h2>{f.nome}</h2>
        <p>
          {[onde, `entrou por ${NOME_DA_ENTRADA[f.entrouPor]} em ${mesEAno(f.criadoEm)}`].filter(Boolean).join(' · ')}
        </p>
      </div>
      {aoFechar ? (
        <button type="button" className="fo-fechar" aria-label="Fechar a ficha" onClick={aoFechar}>
          <X size={18} />
        </button>
      ) : null}
    </div>
  )
}

export function CorpoDaFicha({
  f,
  tipos,
  materiais,
  admin,
  aoMarcarConfiavel,
  aoIrPara,
}: {
  f: Fornecedor
  tipos: TipoDeFornecedor[]
  /** os materiais do estoque ligados a este fornecedor */
  materiais: Material[]
  admin: boolean
  aoMarcarConfiavel: () => void
  aoIrPara: (onde: 'estoque' | 'movimentos' | 'boleto') => void
}) {
  const [entradas, setEntradas] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let vivo = true
    setEntradas(new Map())
    void ultimasEntradasDoFornecedor(f.id).then((m) => {
      if (vivo) setEntradas(m)
    })
    return () => {
      vivo = false
    }
  }, [f.id])

  const situacao = situacaoDe(f)
  const grupos = gruposDoEstoque(materiais)
  const nomeDoTipo = (chave: string) => tipos.find((t) => t.chave === chave)?.nome ?? chave
  const podeConfiar = admin && situacao !== 'confiavel' && situacao !== 'bloqueado' && !!f.cnpj

  return (
    <div className="fo-ficha-corpo">
      <div className="fo-ficha-estado">
        <span className="fo-tags">
          {f.tipos.length ? f.tipos.map((t) => <Tag key={t}>{nomeDoTipo(t)}</Tag>) : <Tag>Sem tipo</Tag>}
        </span>
        <SituacaoDoFornecedor f={f} texto={situacaoPorExtenso(f)} />
      </div>
      {situacao === 'bloqueado' && f.motivoDoBloqueio ? (
        <p className="fo-bloqueio">Motivo do bloqueio: {f.motivoDoBloqueio}</p>
      ) : null}
      {podeConfiar ? (
        <div className="fo-ficha-botoes">
          <Botao tom="forte" onClick={aoMarcarConfiavel}>
            Marcar como confiável
          </Botao>
        </div>
      ) : null}

      <div className="fo-dados">
        <div className="fo-dado">
          <span>CNPJ</span>
          {f.cnpj ? <b>{cnpjNaTela(f.cnpj)}</b> : <b className="fo-falta">falta o CNPJ</b>}
        </div>
        {f.razaoSocial && f.razaoSocial !== f.nome ? (
          <div className="fo-dado">
            <span>Razão social</span>
            <b>{f.razaoSocial}</b>
          </div>
        ) : null}
        <div className="fo-dado">
          <span>Na Receita</span>
          {resumoDaReceita(f.receita) ? (
            <b>{resumoDaReceita(f.receita)}</b>
          ) : (
            <b className="fo-falta">não consultado</b>
          )}
        </div>
        <div className="fo-dado">
          <span>Contato</span>
          {f.contato ? <b>{f.contato}</b> : <b className="fo-falta">sem contato</b>}
        </div>
        <div className="fo-dado">
          <span>Pagamento</span>
          {f.pagamento ? <b>{f.pagamento}</b> : <b className="fo-falta">não combinado</b>}
        </div>
        <div className="fo-dado">
          <span>Prazo de entrega</span>
          {f.prazo ? <b>{f.prazo}</b> : <b className="fo-falta">não combinado</b>}
        </div>
      </div>

      <div className="fo-secao">
        <div className="fo-secao-topo">
          O que ele fornece, por tipo
          <small>
            {materiais.length === 1 ? '1 material do Estoque' : `${materiais.length} materiais do Estoque`}
          </small>
        </div>
        {grupos.length === 0 && !f.oQueFornece ? (
          <div className="fo-lista">
            <div className="fo-vazio-dentro">
              Nenhum material do estoque ligado a ele ainda. A ligação nasce na primeira entrada, ou no botão
              Editar.
            </div>
          </div>
        ) : (
          <div className="fo-lista">
            {CATEGORIAS.map((c: Categoria) => {
              const daCategoria = grupos.filter((g) => g.categoria === c)
              if (!daCategoria.length) return null
              return (
                <div key={c}>
                  <div className="fo-lista-faixa">{nomeDoTipo(c)}</div>
                  {daCategoria.map((g) => {
                    const ultima = g.itens
                      .map((m) => entradas.get(m.id) ?? '')
                      .sort()
                      .pop()
                    return (
                      <div key={g.chave} className="fo-lista-linha">
                        <span>
                          <b>{g.nome}</b>
                          {g.itens.length > 1 || c === 'tecido'
                            ? ' · ' +
                              (c === 'tecido'
                                ? g.itens.length === 1
                                  ? g.itens[0].cor
                                  : `${g.itens.length} cores`
                                : `${g.itens.length} materiais`)
                            : ''}
                        </span>
                        <small>{ultima ? 'entrada em ' + diaEMes(ultima) : 'sem entrada'}</small>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {f.oQueFornece ? (
              <div>
                {grupos.length ? <div className="fo-lista-faixa">Fora do estoque</div> : null}
                <div className="fo-lista-linha">
                  <span>
                    <b>{f.oQueFornece}</b>
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="fo-secao">
        <div className="fo-secao-topo">Onde ele aparece no sistema</div>
        <div>
          <button type="button" className="fo-onde" onClick={() => aoIrPara('estoque')}>
            <b>Estoque</b>
            <span>
              {materiais.length
                ? materiais.length === 1
                  ? '1 material com este fornecedor'
                  : `${materiais.length} materiais com este fornecedor`
                : 'nenhum material ligado'}
            </span>
            <CaretRight size={16} />
          </button>
          <button type="button" className="fo-onde" onClick={() => aoIrPara('movimentos')}>
            <b>Movimentações</b>
            <span>
              {f.entradas
                ? `${f.entradas === 1 ? '1 entrada' : f.entradas + ' entradas'}, a última em ${diaMesAno(f.ultimaEntrada)}`
                : 'nenhuma entrada registrada'}
            </span>
            <CaretRight size={16} />
          </button>
          <button type="button" className="fo-onde" onClick={() => aoIrPara('boleto')}>
            <b>Verificador de Boleto</b>
            <span>
              {f.boletos
                ? `${f.boletos === 1 ? '1 boleto conferido' : f.boletos + ' boletos conferidos'}, o último em ${diaMesAno(f.ultimoBoleto)}`
                : 'nenhum boleto conferido'}
            </span>
            <CaretRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function BotoesDaFicha({
  f,
  podeEditar,
  admin,
  aoBloquear,
  aoDesbloquear,
  aoJuntar,
  aoEditar,
}: {
  f: Fornecedor
  podeEditar: boolean
  admin: boolean
  aoBloquear: () => void
  aoDesbloquear: () => void
  aoJuntar: () => void
  aoEditar: () => void
}) {
  if (!podeEditar && !admin) return null
  return (
    <>
      {admin ? (
        f.gravada === 'bloqueado' ? (
          <Botao onClick={aoDesbloquear}>Desbloquear</Botao>
        ) : (
          <Botao onClick={aoBloquear}>Bloquear fornecedor</Botao>
        )
      ) : (
        <span />
      )}
      <span className="fo-ficha-botoes">
        {admin ? <Botao onClick={aoJuntar}>Juntar com outro</Botao> : null}
        {podeEditar ? <Botao onClick={aoEditar}>Editar</Botao> : null}
      </span>
    </>
  )
}
