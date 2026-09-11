import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { entrar } from '@dominio/sessao'
import fundo from '../../assets/fundo-entrar.jpg'
import './entrar.css'

type DeOnde = { de?: string }

export function TelaEntrar() {
  const navegar = useNavigate()
  const local = useLocation()
  const destino = (local.state as DeOnde | null)?.de || '/'

  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [vendo, setVendo] = useState(false)
  const [erro, setErro] = useState('')
  const [fotoPronta, setFotoPronta] = useState(false)
  const campoUsuario = useRef<HTMLInputElement>(null)

  /* a foto so aparece depois de carregada, para nao piscar cinza no celular */
  useEffect(() => {
    const img = new Image()
    img.onload = () => setFotoPronta(true)
    img.src = fundo
    campoUsuario.current?.focus()
  }, [])

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!usuario.trim() || !senha) {
      setErro('Preencha usuário e senha.')
      return
    }
    if (entrar(usuario, senha)) {
      navegar(destino, { replace: true })
      return
    }
    setErro('Usuário ou senha não conferem.')
    setSenha('')
  }

  return (
    <div className="ent">
      <div
        className={'ent-foto' + (fotoPronta ? ' pronta' : '')}
        style={{ backgroundImage: `url(${fundo})` }}
      />
      <div className="ent-veu" />

      <form className="ent-cartao" onSubmit={enviar} noValidate>
        <div className="ent-marca">
          <div className="ent-selo">F</div>
          <b>Fourtime</b>
        </div>

        <div>
          <h1 className="ent-titulo">Bem-vindo ao Fourtime OS</h1>
          <p className="ent-linha">Entre para abrir o painel da fábrica.</p>
        </div>

        <div className="ent-campos">
          <label className="ent-campo">
            <span>Usuário</span>
            <div className={'ent-caixa' + (erro ? ' errada' : '')}>
              <input
                ref={campoUsuario}
                type="text"
                name="usuario"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="seu usuário"
                value={usuario}
                onChange={(e) => {
                  setUsuario(e.target.value)
                  setErro('')
                }}
              />
            </div>
          </label>

          <label className="ent-campo">
            <span>Senha</span>
            <div className={'ent-caixa' + (erro ? ' errada' : '')}>
              <input
                type={vendo ? 'text' : 'password'}
                name="senha"
                autoComplete="current-password"
                placeholder="sua senha"
                value={senha}
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
        </div>

        {erro ? (
          <p className="ent-recado" role="alert">
            <i />
            {erro}
          </p>
        ) : null}

        <button className="ent-botao" type="submit">
          Entrar
        </button>

        <p className="ent-pe">Acesso restrito à equipe Fourtime.</p>
      </form>
    </div>
  )
}

/* Phosphor entra de verdade no passo 5. Até lá, o olho é desenhado aqui. */
function Olho({ aberto }: { aberto: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      {aberto ? null : (
        <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  )
}
