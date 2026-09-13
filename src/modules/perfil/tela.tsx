import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { ArrowClockwise, Camera, SignOut, Trash } from '@phosphor-icons/react'
import {
  Avatar,
  Aviso,
  avisar,
  Botao,
  Campo,
  Cartao,
  Entrada,
  Pagina,
  Selo,
  TituloCartao,
} from '@ds'
import { listarPaineis } from '@dominio/equipe'
import type { PainelDoSistema } from '@dominio/equipe'
import {
  fotoDe,
  iniciaisDe,
  NOME_DA_SITUACAO,
  NOME_DO_PAPEL,
  useSessao,
} from '@dominio/sessao'
import './perfil.css'

/* A camera do tablet entrega arquivo de 4 a 8 MB. O balde recusa acima de
   512 KB, mas quem encolhe e o navegador antes de subir: este limite aqui e
   so para nao pedir ao navegador que abra um arquivo absurdo. */
const MAIOR_ARQUIVO = 25 * 1024 * 1024

/* Meu perfil.

   Esta e a unica tela que uma conta recem criada enxerga. Ela existe para dar
   uma resposta clara para a pergunta que a pessoa faz nesse momento: "criei a
   conta, e agora?". Um menu vazio sem explicacao parece defeito. */

export function TelaPerfil() {
  const { estado, mudarMeuNome, trocarMinhaFoto, tirarMinhaFoto, reconferir, sair } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null

  const [nome, setNome] = useState(pessoa?.nome ?? '')
  const [salvando, setSalvando] = useState(false)
  const [conferindo, setConferindo] = useState(false)
  const [paineis, setPaineis] = useState<PainelDoSistema[]>([])
  const [mexendoNaFoto, setMexendoNaFoto] = useState(false)
  const escolherArquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pessoa) setNome(pessoa.nome)
  }, [pessoa?.nome])

  useEffect(() => {
    let cancelado = false
    void listarPaineis()
      .then((lista) => {
        if (!cancelado) setPaineis(lista)
      })
      .catch(() => {
        /* a lista de nomes e enfeite: sem ela a tela ainda diz o que importa */
      })
    return () => {
      cancelado = true
    }
  }, [])

  if (!pessoa) return null

  const esperando = pessoa.situacao === 'esperando'
  const bloqueado = pessoa.situacao === 'bloqueado'
  const mudouONome = nome.trim() !== pessoa.nome && nome.trim() !== ''

  async function salvarNome(e: FormEvent) {
    e.preventDefault()
    if (!mudouONome || salvando) return
    setSalvando(true)
    try {
      await mudarMeuNome(nome)
      avisar('Nome salvo.', 'ok')
    } catch (falha) {
      avisar(falha instanceof Error ? falha.message : 'Não consegui salvar o nome.', 'brand')
    } finally {
      setSalvando(false)
    }
  }

  async function pegarFoto(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    /* limpa o campo na hora: sem isso, escolher a MESMA foto de novo depois de
       um erro nao dispara evento nenhum e parece que o botao morreu */
    e.target.value = ''
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
      avisar('Escolha uma imagem.', 'brand')
      return
    }
    if (arquivo.size > MAIOR_ARQUIVO) {
      avisar('Essa imagem é grande demais.', 'brand')
      return
    }
    setMexendoNaFoto(true)
    try {
      await trocarMinhaFoto(arquivo)
      avisar('Foto trocada.', 'ok')
    } catch (falha) {
      avisar(falha instanceof Error ? falha.message : 'Não consegui trocar a foto.', 'brand')
    } finally {
      setMexendoNaFoto(false)
    }
  }

  async function removerFoto() {
    setMexendoNaFoto(true)
    try {
      await tirarMinhaFoto()
      avisar('Foto removida.', 'ok')
    } catch (falha) {
      avisar(falha instanceof Error ? falha.message : 'Não consegui remover a foto.', 'brand')
    } finally {
      setMexendoNaFoto(false)
    }
  }

  async function conferirDeNovo() {
    setConferindo(true)
    try {
      await reconferir()
    } finally {
      setConferindo(false)
    }
  }

  const meus = paineis.filter((p) => pessoa.paineis.includes(p.chave))

  return (
    <Pagina
      acima="Sua conta"
      titulo="Meu perfil"
      sub={pessoa.email}
      acoes={
        <Botao tom="contorno" onClick={() => void sair()} title="Sair do sistema">
          <SignOut size={18} />
          Sair
        </Botao>
      }
    >
      {esperando ? (
        <Aviso
          tom="warn"
          titulo="Sua conta está esperando aprovação"
          acao={
            <Botao
              tom="contorno"
              tamanho="sm"
              carregando={conferindo}
              onClick={() => void conferirDeNovo()}
            >
              <ArrowClockwise size={16} />
              Conferir de novo
            </Botao>
          }
        >
          O administrador precisa liberar o seu acesso. Enquanto isso, esta é a única tela que
          abre. Assim que ele aprovar, aperte conferir de novo aqui mesmo.
        </Aviso>
      ) : null}

      {bloqueado ? (
        <Aviso tom="brand" titulo="Seu acesso está bloqueado">
          Fale com o administrador para entender o motivo e voltar a usar o sistema.
        </Aviso>
      ) : null}

      <div className="pf-grade">
        <Cartao>
          <TituloCartao>Seus dados</TituloCartao>
          <div className="pf-foto">
            <Avatar iniciais={iniciaisDe(pessoa.nome)} foto={fotoDe(pessoa)} tamanho={72} />
            <div>
              <Botao
                tom="contorno"
                tamanho="sm"
                carregando={mexendoNaFoto}
                onClick={() => escolherArquivo.current?.click()}
              >
                <Camera size={16} />
                {fotoDe(pessoa) ? 'Trocar foto' : 'Pôr uma foto'}
              </Botao>
              {fotoDe(pessoa) ? (
                <Botao
                  tom="limpo"
                  tamanho="sm"
                  icone
                  title="Remover a foto"
                  disabled={mexendoNaFoto}
                  onClick={() => void removerFoto()}
                >
                  <Trash size={16} />
                </Botao>
              ) : null}
              <p>Ela é cortada no quadrado e encolhida aqui no navegador antes de subir.</p>
            </div>
            <input
              ref={escolherArquivo}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void pegarFoto(e)}
            />
          </div>

          <form className="pf-form" onSubmit={salvarNome}>
            <Campo rotulo="Nome" dica="É como você aparece para o resto da equipe.">
              <Entrada
                value={nome}
                maxLength={80}
                onChange={(e) => setNome(e.target.value)}
                placeholder="seu nome"
              />
            </Campo>

            <Campo rotulo="E-mail" dica="Só o administrador troca o e-mail de uma conta.">
              <Entrada value={pessoa.email} readOnly disabled />
            </Campo>

            <div className="pf-linha">
              <span className="pf-rotulo">Papel</span>
              <Selo tom={pessoa.papel === 'admin' ? 'brand' : 'neutro'}>
                {NOME_DO_PAPEL[pessoa.papel]}
              </Selo>
            </div>

            <div className="pf-linha">
              <span className="pf-rotulo">Situação</span>
              <Selo tom={esperando ? 'warn' : bloqueado ? 'brand' : 'ok'}>
                {NOME_DA_SITUACAO[pessoa.situacao]}
              </Selo>
            </div>

            <Botao tom="primario" type="submit" disabled={!mudouONome} carregando={salvando}>
              Salvar nome
            </Botao>
          </form>
        </Cartao>

        <Cartao>
          <TituloCartao>Seus painéis</TituloCartao>
          {meus.length === 0 ? (
            <p className="pf-nada">
              {esperando
                ? 'Nenhum ainda. Eles aparecem aqui quando o administrador aprovar sua conta.'
                : 'Nenhum painel liberado. Fale com o administrador.'}
            </p>
          ) : (
            <ul className="pf-paineis">
              {meus.map((p) => (
                <li key={p.chave}>
                  <b>{p.nome}</b>
                  <span>{p.grupo}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </Pagina>
  )
}
