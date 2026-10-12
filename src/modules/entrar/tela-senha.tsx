import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { crachaDoLink, pedirLinkDeSenha, trocarASenha } from '@shared/supabase'
import fundo from '../../assets/fundo-entrar.jpg'
import { Olho } from './olho'
import './entrar.css'

/* ==========================================================================
   ESQUECI A SENHA (12/10/2026; pendencia do 12, secao 2, item 8).

   /esqueci-a-senha pede o e-mail e manda o link; /nova-senha recebe o link do
   e-mail e grava a senha nova. Depois de gravar, a pessoa ja esta dentro: o
   link do e-mail vale como entrada, e a pagina recarrega no Inicio.
   ========================================================================== */

const MINIMO_DA_SENHA = 8

function Moldura({ titulo, linha, children, onSubmit }: { titulo: string; linha: ReactNode; children: ReactNode; onSubmit?: (e: FormEvent) => void }) {
  const [fotoPronta, setFotoPronta] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setFotoPronta(true)
    img.src = fundo
  }, [])
  return (
    <div className="ent">
      <div className={'ent-foto' + (fotoPronta ? ' pronta' : '')} style={{ backgroundImage: `url(${fundo})` }} />
      <div className="ent-veu" />
      <form className="ent-cartao" onSubmit={onSubmit ?? ((e) => e.preventDefault())} noValidate>
        <div className="ent-marca">
          <div className="ent-selo">F</div>
          <b>Fourtime</b>
        </div>
        <div>
          <h1 className="ent-titulo">{titulo}</h1>
          <p className="ent-linha">{linha}</p>
        </div>
        {children}
      </form>
    </div>
  )
}

function Recado({ erro, certo }: { erro?: string; certo?: string }) {
  if (erro)
    return (
      <p className="ent-recado" role="alert">
        <i />
        {erro}
      </p>
    )
  if (certo)
    return (
      <p className="ent-recado ent-certo" role="status">
        <i />
        {certo}
      </p>
    )
  return null
}

export function TelaEsqueciASenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [mandando, setMandando] = useState(false)
  const [mandou, setMandou] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  useEffect(() => campo.current?.focus(), [])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (mandando) return
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Escreva o e-mail da sua conta.')
    setErro('')
    setMandando(true)
    try {
      await pedirLinkDeSenha(email, window.location.origin + '/nova-senha')
      setMandou(true)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui mandar o link agora.')
    } finally {
      setMandando(false)
    }
  }

  return (
    <Moldura titulo="Esqueci a senha" linha="Mandamos um link para o seu e-mail. Ele abre uma tela para você escolher a senha nova." onSubmit={enviar}>
      <div className="ent-campos">
        <label className="ent-campo">
          <span>E-mail</span>
          <div className={'ent-caixa' + (erro ? ' errada' : '')}>
            <input
              ref={campo}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="voce@fourtimefit.com.br"
              value={email}
              disabled={mandando}
              onChange={(e) => {
                setEmail(e.target.value)
                setErro('')
                setMandou(false)
              }}
            />
          </div>
        </label>
      </div>
      <Recado
        erro={erro}
        certo={mandou ? 'Se este e-mail tem conta, o link chega em alguns minutos. Olhe também o lixo eletrônico. O link vale uma vez só.' : ''}
      />
      <button className="ent-botao" type="submit" disabled={mandando}>
        {mandando ? 'Mandando...' : mandou ? 'Mandar de novo' : 'Mandar o link'}
      </button>
      <p className="ent-pe">
        Lembrou? <Link to="/entrar">Voltar para a entrada</Link>
      </p>
    </Moldura>
  )
}

export function TelaNovaSenha() {
  const [fase, setFase] = useState<'lendo' | 'pronta' | 'sem-link'>('lendo')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [repetida, setRepetida] = useState('')
  const [vendo, setVendo] = useState(false)
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)

  /* o cracha vem no fragmento do endereco; depois de lido, o fragmento sai
     do endereco, para nao ficar no historico do navegador */
  const lido = useRef(false)
  useEffect(() => {
    if (lido.current) return
    lido.current = true
    const fragmento = window.location.hash
    window.history.replaceState(null, '', window.location.pathname)
    void crachaDoLink(fragmento).then((r) => {
      if ('erro' in r) {
        setErro(r.erro)
        setFase('sem-link')
      } else {
        setEmail(r.cracha.email)
        setFase('pronta')
      }
    })
  }, [])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (gravando || fase !== 'pronta') return
    if (senha.length < MINIMO_DA_SENHA) return setErro(`A senha precisa de pelo menos ${MINIMO_DA_SENHA} caracteres.`)
    if (senha !== repetida) return setErro('As duas senhas não são iguais.')
    setErro('')
    setGravando(true)
    try {
      await trocarASenha(senha)
      /* a sessao do link ja esta guardada: recarregar entra no sistema */
      window.location.replace('/')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui trocar a senha agora.')
      setGravando(false)
    }
  }

  if (fase !== 'pronta') {
    return (
      <Moldura titulo="Senha nova" linha={fase === 'lendo' ? 'Conferindo o link do e-mail...' : 'O link não serviu.'}>
        <Recado erro={erro} />
        {fase === 'sem-link' ? (
          <p className="ent-pe">
            <Link to="/esqueci-a-senha">Pedir um link novo</Link> · <Link to="/entrar">Voltar para a entrada</Link>
          </p>
        ) : null}
      </Moldura>
    )
  }

  return (
    <Moldura titulo="Senha nova" linha={email ? 'Para a conta ' + email + '.' : 'Escolha a senha nova da sua conta.'} onSubmit={enviar}>
      <div className="ent-campos">
        <label className="ent-campo">
          <span>Senha nova</span>
          <div className={'ent-caixa' + (erro ? ' errada' : '')}>
            <input
              type={vendo ? 'text' : 'password'}
              name="senha"
              autoComplete="new-password"
              placeholder={`pelo menos ${MINIMO_DA_SENHA} caracteres`}
              value={senha}
              disabled={gravando}
              onChange={(e) => {
                setSenha(e.target.value)
                setErro('')
              }}
            />
            <button
              type="button"
              className="ent-olho"
              onClick={() => setVendo((v) => !v)}
              aria-label={vendo ? 'Esconder a senha' : 'Mostrar a senha'}
              title={vendo ? 'Esconder a senha' : 'Mostrar a senha'}
            >
              <Olho aberto={vendo} />
            </button>
          </div>
        </label>
        <label className="ent-campo">
          <span>Repita a senha nova</span>
          <div className={'ent-caixa' + (erro ? ' errada' : '')}>
            <input
              type={vendo ? 'text' : 'password'}
              name="repetida"
              autoComplete="new-password"
              value={repetida}
              disabled={gravando}
              onChange={(e) => {
                setRepetida(e.target.value)
                setErro('')
              }}
            />
          </div>
        </label>
      </div>
      <Recado erro={erro} />
      <button className="ent-botao" type="submit" disabled={gravando}>
        {gravando ? 'Gravando...' : 'Gravar a senha e entrar'}
      </button>
    </Moldura>
  )
}
