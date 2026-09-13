import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useSessao } from '@dominio/sessao'
import fundo from '../../assets/fundo-entrar.jpg'
import { Olho } from './olho'
import './entrar.css'

type DeOnde = { de?: string }

export function TelaEntrar() {
  const local = useLocation()
  const destino = (local.state as DeOnde | null)?.de || '/'
  const { estado, entrar } = useSessao()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [vendo, setVendo] = useState(false)
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [fotoPronta, setFotoPronta] = useState(false)
  const campoEmail = useRef<HTMLInputElement>(null)

  /* a foto so aparece depois de carregada, para nao piscar cinza no celular */
  useEffect(() => {
    const img = new Image()
    img.onload = () => setFotoPronta(true)
    img.src = fundo
    campoEmail.current?.focus()
  }, [])

  /* Quem ja entrou nao ve a tela de entrada. Acontece de verdade: a pessoa
     aperta voltar depois de entrar, ou abre o link salvo de /entrar. */
  if (estado.fase === 'dentro') return <Navigate to={destino} replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (entrando) return
    if (!email.trim() || !senha) {
      setErro('Preencha o e-mail e a senha.')
      return
    }
    setErro('')
    setEntrando(true)
    try {
      await entrar(email, senha)
      /* nao navega aqui: assim que o estado vira dentro, o Navigate la em cima
         leva para o destino. Uma porta so, em vez de duas discordando. */
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui entrar agora.')
      setSenha('')
      setEntrando(false)
    }
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
            <span>E-mail</span>
            <div className={'ent-caixa' + (erro ? ' errada' : '')}>
              <input
                ref={campoEmail}
                type="email"
                name="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="voce@fourtimefit.com.br"
                value={email}
                disabled={entrando}
                onChange={(e) => {
                  setEmail(e.target.value)
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
                disabled={entrando}
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

        <button className="ent-botao" type="submit" disabled={entrando}>
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="ent-pe">
          Primeira vez? <Link to="/criar-conta">Criar conta</Link>
        </p>
      </form>
    </div>
  )
}
