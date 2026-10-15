import { useMemo, useState, type ReactNode } from 'react'
import { ArrowsMerge, ArrowUp, Plus, X } from '@phosphor-icons/react'
import { avisar, Botao, Busca, Campo, Entrada, Seletor, semAcento } from '@ds'
import {
  contatoEmBranco,
  documentoEmBranco,
  enderecoEmBranco,
  enderecoEmLinha,
  formatarDocumento,
  formatarTelefone,
  juntarClientes,
  tornarContatoPrincipal,
  tornarDocumentoPrincipal,
  tornarEnderecoPrincipal,
  clientesParecidos,
  type Cliente,
  type ContatoExtra,
  type DocumentoExtra,
  type EnderecoExtra,
  type ExtrasDoCliente,
} from '@dominio/cliente'

/* ==========================================================================
   OS OUTROS CADASTROS DA FICHA (082): os outros CPF/CNPJ, os outros
   endereços de entrega e os outros contatos. O principal continua no
   formulário de cima; aqui moram os que vêm junto, e cada cotação escolhe.
   ========================================================================== */

type Edicao = {
  c: Cliente
  x: ExtrasDoCliente
  aoMudar: (c: Cliente, x: ExtrasDoCliente) => void
}

const UFS = ['GO', 'DF', 'MG', 'SP', 'BA', 'MT', 'MS', 'TO', 'PR', 'RJ'].map((u) => ({ valor: u, rotulo: u }))

/** Os três blocos no formulário de edição. */
export function ExtrasNoFormulario({ c, x, aoMudar }: Edicao) {
  const docs = (documentos: DocumentoExtra[]) => aoMudar(c, { ...x, documentos })
  const ends = (enderecos: EnderecoExtra[]) => aoMudar(c, { ...x, enderecos })
  const cons = (contatos: ContatoExtra[]) => aoMudar(c, { ...x, contatos })
  const trocar = <T,>(lista: T[], i: number, parte: Partial<T>) => lista.map((v, k) => (k === i ? { ...v, ...parte } : v))

  return (
    <div className="cl-extras">
      <BlocoDeExtras
        titulo="Outros CPF/CNPJ"
        explica="A filial com outro CNPJ, o CPF do responsável. A cotação escolhe qual sai no documento."
        vazio="Nenhum outro documento."
        adicionar="Outro CPF/CNPJ"
        aoAdicionar={() => docs([...x.documentos, documentoEmBranco()])}
      >
        {x.documentos.map((d, i) => (
          <LinhaDeExtra
            key={d.id ?? 'novo' + i}
            rotulo={'Documento ' + (i + 2)}
            aoTirar={() => docs(x.documentos.filter((_, k) => k !== i))}
            aoPrincipal={() => aoMudar(...tornarDocumentoPrincipal(c, x, i))}
          >
            <Campo rotulo="Tipo">
              <Seletor
                bloco
                campo
                valor={d.tipo}
                opcoes={[
                  { valor: 'J', rotulo: 'CNPJ' },
                  { valor: 'F', rotulo: 'CPF' },
                ]}
                aoEscolher={(v) => docs(trocar(x.documentos, i, { tipo: v === 'F' ? 'F' : 'J' }))}
              />
            </Campo>
            <Campo rotulo="Número">
              <Entrada inputMode="numeric" value={d.documento} onChange={(e) => docs(trocar(x.documentos, i, { documento: e.target.value }))} />
            </Campo>
            <Campo rotulo="Razão social deste documento" className="col-2" dica="Quando não é o nome da ficha">
              <Entrada value={d.nome} onChange={(e) => docs(trocar(x.documentos, i, { nome: e.target.value }))} />
            </Campo>
          </LinhaDeExtra>
        ))}
      </BlocoDeExtras>

      <BlocoDeExtras
        titulo="Outros endereços de entrega"
        explica="A quadra do time, a filial, a casa do técnico. A cotação escolhe para onde vai."
        vazio="Nenhum outro endereço."
        adicionar="Outro endereço"
        aoAdicionar={() => ends([...x.enderecos, enderecoEmBranco()])}
      >
        {x.enderecos.map((e, i) => (
          <LinhaDeExtra
            key={e.id ?? 'novo' + i}
            rotulo={e.apelido || 'Endereço ' + (i + 2)}
            aoTirar={() => ends(x.enderecos.filter((_, k) => k !== i))}
            aoPrincipal={() => aoMudar(...tornarEnderecoPrincipal(c, x, i))}
          >
            <Campo rotulo="Como chamar" className="col-2">
              <Entrada value={e.apelido} placeholder="Filial Anápolis" onChange={(v) => ends(trocar(x.enderecos, i, { apelido: v.target.value }))} />
            </Campo>
            <Campo rotulo="Endereço" className="col-2">
              <Entrada value={e.endereco} placeholder="Rua e número" onChange={(v) => ends(trocar(x.enderecos, i, { endereco: v.target.value }))} />
            </Campo>
            <Campo rotulo="Complemento">
              <Entrada value={e.complemento} onChange={(v) => ends(trocar(x.enderecos, i, { complemento: v.target.value }))} />
            </Campo>
            <Campo rotulo="Bairro">
              <Entrada value={e.bairro} onChange={(v) => ends(trocar(x.enderecos, i, { bairro: v.target.value }))} />
            </Campo>
            <Campo rotulo="Cidade">
              <Entrada value={e.cidade} onChange={(v) => ends(trocar(x.enderecos, i, { cidade: v.target.value }))} />
            </Campo>
            <Campo rotulo="Estado">
              <Seletor bloco campo valor={e.uf} opcoes={UFS} vazio="Escolher" aoEscolher={(v) => ends(trocar(x.enderecos, i, { uf: v }))} />
            </Campo>
            <Campo rotulo="CEP">
              <Entrada inputMode="numeric" value={e.cep} onChange={(v) => ends(trocar(x.enderecos, i, { cep: v.target.value }))} />
            </Campo>
          </LinhaDeExtra>
        ))}
      </BlocoDeExtras>

      <BlocoDeExtras
        titulo="Outros contatos"
        explica="O financeiro, o comprador, o técnico. A cotação escolhe com quem fala."
        vazio="Nenhum outro contato."
        adicionar="Outro contato"
        aoAdicionar={() => cons([...x.contatos, contatoEmBranco()])}
      >
        {x.contatos.map((k, i) => (
          <LinhaDeExtra
            key={k.id ?? 'novo' + i}
            rotulo={k.nome || 'Contato ' + (i + 2)}
            aoTirar={() => cons(x.contatos.filter((_, n) => n !== i))}
            aoPrincipal={() => aoMudar(...tornarContatoPrincipal(c, x, i))}
          >
            <Campo rotulo="Nome">
              <Entrada value={k.nome} onChange={(v) => cons(trocar(x.contatos, i, { nome: v.target.value }))} />
            </Campo>
            <Campo rotulo="Função">
              <Entrada value={k.cargo} placeholder="Financeiro" onChange={(v) => cons(trocar(x.contatos, i, { cargo: v.target.value }))} />
            </Campo>
            <Campo rotulo="Celular" dica="Com DDD">
              <Entrada inputMode="tel" value={k.celular} onChange={(v) => cons(trocar(x.contatos, i, { celular: v.target.value }))} />
            </Campo>
            <Campo rotulo="Telefone fixo">
              <Entrada inputMode="tel" value={k.telefone} onChange={(v) => cons(trocar(x.contatos, i, { telefone: v.target.value }))} />
            </Campo>
            <Campo rotulo="E-mail" className="col-2">
              <Entrada type="email" value={k.email} onChange={(v) => cons(trocar(x.contatos, i, { email: v.target.value }))} />
            </Campo>
          </LinhaDeExtra>
        ))}
      </BlocoDeExtras>
    </div>
  )
}

function BlocoDeExtras({
  titulo,
  explica,
  vazio,
  adicionar,
  aoAdicionar,
  children,
}: {
  titulo: string
  explica: string
  vazio: string
  adicionar: string
  aoAdicionar: () => void
  children: ReactNode[]
}) {
  return (
    <section className="cl-extra-bloco" aria-label={titulo}>
      <header className="pilha">
        <b>{titulo}</b>
        <small>{explica}</small>
      </header>
      {children.length ? children : <p className="cl-extra-vazio">{vazio}</p>}
      <span>
        <Botao tom="contorno" tamanho="sm" onClick={aoAdicionar}>
          <Plus size={14} weight="bold" />
          {adicionar}
        </Botao>
      </span>
    </section>
  )
}

function LinhaDeExtra({
  rotulo,
  aoTirar,
  aoPrincipal,
  children,
}: {
  rotulo: string
  aoTirar: () => void
  aoPrincipal: () => void
  children: ReactNode
}) {
  return (
    <div className="cl-extra">
      <div className="cl-extra-cab">
        <b className="corta">{rotulo}</b>
        <Botao tom="limpo" tamanho="sm" onClick={aoPrincipal} title="Troca de lugar com o principal da ficha">
          <ArrowUp size={14} />
          Tornar principal
        </Botao>
        <Botao tom="limpo" tamanho="sm" icone onClick={aoTirar} aria-label={'Tirar ' + rotulo} title="Tirar">
          <X size={14} />
        </Botao>
      </div>
      <div className="ficha-form">{children}</div>
    </div>
  )
}

/** Na leitura: só aparece o que existe. */
export function ExtrasNaLeitura({ x }: { x: ExtrasDoCliente }) {
  if (!x.documentos.length && !x.enderecos.length && !x.contatos.length) return null
  return (
    <dl className="ficha-dados cl-extras-lidos">
      {x.documentos.map((d, i) => (
        <Par key={'d' + i} rotulo={i ? '' : 'Outros documentos'} valor={formatarDocumento(d.documento) + (d.nome ? ' · ' + d.nome : '')} />
      ))}
      {x.enderecos.map((e, i) => (
        <Par key={'e' + i} rotulo={i ? '' : 'Outros endereços'} valor={(e.apelido ? e.apelido + ': ' : '') + enderecoEmLinha(e)} />
      ))}
      {x.contatos.map((k, i) => (
        <Par
          key={'k' + i}
          rotulo={i ? '' : 'Outros contatos'}
          valor={[k.nome, k.cargo, formatarTelefone(k.celular || k.telefone), k.email].filter(Boolean).join(' · ')}
        />
      ))}
    </dl>
  )
}

function Par({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </>
  )
}

/* --- JUNTAR COM OUTRO CLIENTE --------------------------------------------
   Escolhe a outra ficha, diz o que vai acontecer, e só junta no segundo
   clique. Quem FICA é esta ficha, a não ser que a pessoa troque. */
export function JuntarClientes({
  c,
  base,
  aoJuntar,
  aoVoltar,
}: {
  c: Cliente
  base: Cliente[]
  aoJuntar: (ficouId: string, saiuId: string) => void
  aoVoltar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [outroId, setOutroId] = useState('')
  const [estaFica, setEstaFica] = useState(true)
  const [juntando, setJuntando] = useState(false)
  const outro = base.find((b) => b.id === outroId) ?? null

  /* sem busca, os parecidos: mesmo documento, mesmo nome ou mesmo celular */
  const parecidos = useMemo(() => {
    const doc = c.documento.replace(/\D/g, '')
    const porDoc = doc ? base.filter((b) => b.id !== c.id && b.documento.replace(/\D/g, '') === doc) : []
    const porNome = clientesParecidos(base.filter((b) => b.id !== c.id), c.nome, c.celular || c.telefone)
    return [...porDoc, ...porNome.filter((b) => !porDoc.includes(b))].slice(0, 8)
  }, [base, c])

  const achados = useMemo(() => {
    const q = semAcento(busca.trim()).toLowerCase()
    const so = busca.replace(/\D/g, '')
    if (!q) return parecidos
    return base
      .filter((b) => b.id !== c.id)
      .filter((b) => semAcento([b.nome, b.fantasia, b.cidade].join(' ')).toLowerCase().includes(q) || (so.length >= 4 && (b.documento.includes(so) || b.celular.includes(so))))
      .slice(0, 8)
  }, [busca, base, c.id, parecidos])

  const fica = estaFica ? c : outro
  const sai = estaFica ? outro : c

  async function juntar() {
    if (!fica || !sai || juntando) return
    setJuntando(true)
    try {
      await juntarClientes(fica.id, sai.id)
      avisar(sai.nome + ' entrou em ' + fica.nome, 'ok')
      aoJuntar(fica.id, sai.id)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui juntar as fichas', 'warn')
    } finally {
      setJuntando(false)
    }
  }

  return (
    <section className="cl-juntar" aria-label="Juntar com outro cliente">
      <header className="cl-juntar-cab">
        <ArrowsMerge size={18} weight="duotone" />
        <b>Juntar com outro cliente</b>
      </header>
      {!outro ? (
        <>
          <p className="cl-juntar-texto">Procure a outra ficha da mesma pessoa ou empresa.</p>
          <Busca autoFocus value={busca} placeholder="Nome, CNPJ, cidade ou celular" aria-label="Buscar a outra ficha" onChange={(e) => setBusca(e.target.value)} />
          {!busca.trim() && achados.length ? <small className="cl-juntar-texto">Parecidos com esta ficha:</small> : null}
          {busca.trim() || achados.length ? (
            achados.length ? (
              <div className="cl-juntar-lista">
                {achados.map((b) => (
                  <button key={b.id} type="button" className="cl-juntar-item" onClick={() => setOutroId(b.id)}>
                    <b className="corta">{b.nome}</b>
                    <small className="corta">
                      {[formatarDocumento(b.documento), [b.cidade, b.uf].filter(Boolean).join('/'), b.pedidos ? b.pedidos + ' pedidos' : ''].filter(Boolean).join(' · ') || 'sem documento e sem cidade'}
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="cl-extra-vazio">Nenhuma outra ficha com isso.</p>
            )
          ) : null}
          <span>
            <Botao tom="limpo" onClick={aoVoltar}>
              Voltar
            </Botao>
          </span>
        </>
      ) : (
        <>
          <div className="cl-juntar-par">
            <div className="cl-juntar-lado fica">
              <small>Fica</small>
              <b>{fica?.nome}</b>
              <span>{fica?.pedidos ?? 0} pedidos</span>
            </div>
            <div className="cl-juntar-lado">
              <small>Entra e some</small>
              <b>{sai?.nome}</b>
              <span>{sai?.pedidos ?? 0} pedidos</span>
            </div>
          </div>
          <p className="cl-juntar-texto">
            O nome e o cadastro principal de <b>{fica?.nome}</b> continuam. O documento, o endereço e o contato de{' '}
            <b>{sai?.nome}</b> viram outros cadastros desta ficha, o que estiver vazio é preenchido, e as cotações, os
            pedidos e os leads passam para cá. A ficha que sai fica guardada no registro.
          </p>
          <div className="fileira">
            <Botao tom="limpo" onClick={() => setOutroId('')} disabled={juntando}>
              Escolher outra
            </Botao>
            <Botao tom="contorno" onClick={() => setEstaFica((v) => !v)} disabled={juntando}>
              Trocar quem fica
            </Botao>
            <Botao tom="forte" onClick={() => void juntar()} disabled={juntando} carregando={juntando}>
              Juntar as duas
            </Botao>
          </div>
        </>
      )}
    </section>
  )
}
