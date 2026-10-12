import { useRef, useState } from 'react'
import { DownloadSimple, FileArrowUp, Warning } from '@phosphor-icons/react'
import { Botao, Modal, Segmentado, avisar } from '@ds'
import { formatarTelefone } from '@shared'
import {
  clienteEmBranco,
  importarClientes,
  relatorioDaImportacao,
  separarImportacao,
  textoDoArquivo,
  type Cliente,
  type Importacao,
  type LinhaImportada,
} from '@dominio/cliente'

/* ==========================================================================
   IMPORTAR DO BLING (12/10/2026; pendencia 4.1 do FOURTIME OS - 12).

   Escolher o CSV, ver antes o que entra e o que nao entra (ja existe, repetido
   no arquivo, sem nome), baixar o relatorio do que ficou de fora para
   aprovar, e so entao gravar os novos. Nada e gravado antes do botao.
   ========================================================================== */

type Monte = LinhaImportada['situacao']

const MONTES: { valor: Monte; rotulo: string }[] = [
  { valor: 'novo', rotulo: 'Entram' },
  { valor: 'ja-existe', rotulo: 'Já existem' },
  { valor: 'repetido', rotulo: 'Repetidos' },
  { valor: 'sem-nome', rotulo: 'Sem nome' },
]

const A_VISTA = 60

export function ImportarDoBling({ aberto, base, aoFechar, aoImportar }: { aberto: boolean; base: Cliente[]; aoFechar: () => void; aoImportar: () => void }) {
  const campo = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState('')
  const [imp, setImp] = useState<Importacao | null>(null)
  const [monte, setMonte] = useState<Monte>('novo')
  const [confirmando, setConfirmando] = useState(false)
  const [gravando, setGravando] = useState(0)
  const [falha, setFalha] = useState('')

  function fechar() {
    if (gravando) return
    setArquivo('')
    setImp(null)
    setMonte('novo')
    setConfirmando(false)
    setFalha('')
    aoFechar()
  }

  async function ler(f: File) {
    setFalha('')
    setConfirmando(false)
    try {
      const texto = textoDoArquivo(await f.arrayBuffer())
      const r = separarImportacao(texto, base, clienteEmBranco())
      setArquivo(f.name)
      setImp(r)
      setMonte(r.conta.novo ? 'novo' : 'ja-existe')
    } catch {
      setFalha('Não consegui ler este arquivo. Ele precisa ser o CSV de contatos exportado do Bling.')
    }
  }

  function baixarRelatorio() {
    if (!imp) return
    const blob = new Blob([relatorioDaImportacao(imp)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'bling-o-que-ficou-de-fora.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importar() {
    if (!imp) return
    const novos = imp.linhas.filter((l) => l.situacao === 'novo').map((l) => l.cliente)
    setGravando(1)
    const r = await importarClientes(novos, (n) => setGravando(n || 1))
    setGravando(0)
    if (r.falha) {
      setFalha(`Entraram ${r.entraram} de ${novos.length}. Um lote foi recusado: ${r.falha}`)
      if (r.entraram) aoImportar()
      return
    }
    avisar(`${r.entraram.toLocaleString('pt-BR')} clientes do Bling entraram.`, 'ok')
    aoImportar()
    fechar()
  }

  const vistos = imp ? imp.linhas.filter((l) => l.situacao === monte) : []
  const novos = imp?.conta.novo ?? 0
  const deFora = imp ? imp.linhas.length - novos : 0

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Importar clientes do Bling"
      gigante
      pe={
        <>
          <Botao tom="limpo" onClick={fechar} disabled={!!gravando}>
            Cancelar
          </Botao>
          {imp && deFora ? (
            <Botao tom="contorno" onClick={baixarRelatorio}>
              <DownloadSimple size={16} />
              Baixar o que ficou de fora
            </Botao>
          ) : null}
          {imp && novos ? (
            confirmando ? (
              <Botao tom="primario" carregando={!!gravando} disabled={!!gravando} onClick={() => void importar()}>
                {gravando ? `Gravando ${gravando.toLocaleString('pt-BR')} de ${novos.toLocaleString('pt-BR')}...` : `Sim, gravar ${novos.toLocaleString('pt-BR')} clientes`}
              </Botao>
            ) : (
              <Botao tom="primario" onClick={() => setConfirmando(true)}>
                Importar {novos.toLocaleString('pt-BR')} {novos === 1 ? 'cliente novo' : 'clientes novos'}
              </Botao>
            )
          ) : null}
        </>
      }
    >
      <div className="pilha cl-imp">
        <input
          ref={campo}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void ler(f)
            e.target.value = ''
          }}
        />
        <div className="fileira entre cl-imp-topo">
          <p className="cl-imp-nota">
            {arquivo ? (
              <>
                <b>{arquivo}</b> · {imp?.linhas.length.toLocaleString('pt-BR')} linhas lidas. Nada foi gravado ainda.
              </>
            ) : (
              <>No Bling: Cadastros, Clientes e Fornecedores, Exportar, em CSV. Escolha aqui o arquivo que ele baixar.</>
            )}
          </p>
          <Botao tom={arquivo ? 'contorno' : 'forte'} onClick={() => campo.current?.click()} disabled={!!gravando}>
            <FileArrowUp size={16} />
            {arquivo ? 'Trocar o arquivo' : 'Escolher o CSV'}
          </Botao>
        </div>
        {falha ? (
          <p className="cl-imp-falha" role="alert">
            <Warning size={16} weight="bold" /> {falha}
          </p>
        ) : null}
        {imp?.semNome ? (
          <p className="cl-imp-falha" role="alert">
            <Warning size={16} weight="bold" /> Este arquivo não tem a coluna Nome. Confira se é o CSV de contatos do Bling.
          </p>
        ) : null}
        {imp && !imp.semNome ? (
          <>
            <Segmentado<Monte>
              valor={monte}
              aoMudar={setMonte}
              opcoes={MONTES.map((m) => ({ valor: m.valor, rotulo: `${m.rotulo} ${imp.conta[m.valor].toLocaleString('pt-BR')}` }))}
            />
            <p className="cl-imp-nota">
              {monte === 'novo'
                ? 'Estes entram como clientes novos, com o vendedor do Bling escrito no cadastro.'
                : monte === 'ja-existe'
                  ? 'Já estão no sistema: o mesmo CNPJ ou CPF, o mesmo final de telefone ou o mesmo nome. Não entram de novo.'
                  : monte === 'repetido'
                    ? 'Aparecem mais de uma vez no arquivo: entra a primeira, e estas ficam de fora para você conferir.'
                    : 'Linhas sem nome: o sistema não aceita cliente sem nome.'}
            </p>
            {vistos.length ? (
              <div className="cl-imp-rolo">
                <table className="cl-imp-tab">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Nome</th>
                      <th>CNPJ ou CPF</th>
                      <th>Telefone</th>
                      <th>Cidade</th>
                      {monte !== 'novo' ? <th>Por quê</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {vistos.slice(0, A_VISTA).map((l) => (
                      <tr key={l.linha}>
                        <td>{l.linha}</td>
                        <td>{l.cliente.nome || '-'}</td>
                        <td>{l.cliente.documento || '-'}</td>
                        <td>{formatarTelefone(l.cliente.celular || l.cliente.telefone) || '-'}</td>
                        <td>{l.cliente.cidade ? l.cliente.cidade + (l.cliente.uf ? ', ' + l.cliente.uf : '') : '-'}</td>
                        {monte !== 'novo' ? <td>{l.motivo}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {vistos.length > A_VISTA ? (
                  <p className="cl-imp-nota cl-imp-mais">
                    E mais {(vistos.length - A_VISTA).toLocaleString('pt-BR')}. {monte === 'novo' ? '' : 'O relatório para baixar tem todos.'}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="cl-imp-nota">Nenhuma linha neste monte.</p>
            )}
            {confirmando ? (
              <p className="cl-imp-falha cl-imp-confirma" role="status">
                <Warning size={16} weight="bold" /> Vão entrar {novos.toLocaleString('pt-BR')} clientes de verdade. Confira os montes antes; para tirar depois, é um por um.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  )
}
