import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSessao } from '@dominio/sessao'
import fundo from '../../assets/fundo-entrar.jpg'
import { Olho } from './olho'
import './entrar.css'

/* Criar conta.

   Quem libera o e-mail e o administrador, e a trava disso mora no banco: sem
   convite, a conta nao chega a nascer e o servidor devolve o motivo escrito.
   Esta tela nao confere nada disso por conta propria, so mostra a resposta. */

const MINIMO_DA_SENHA = 8

export function TelaCriarConta() {
  const { estado, criarConta } = useSessao()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [repetida, setRepetida] = useState('')
  const [vendo, setVendo] = useState(false)
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  const [fotoPronta, setFotoPronta] = useState(false)
  const campoNome = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setFotoPronta(true)
    img.src = fundo
    campoNome.current?.focus()
  }, [])

  /* Assim que a conta nasce a pessoa ja esta dentro, esperando aprovacao, e o
     lugar dela e o proprio perfil. */
  if (estado.fase === 'dentro') return <Navigate to="/perfil" replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (criando) return

    if (!nome.trim()) return setErro('Escreva seu nome.')
    if (!email.trim()) return setErro('Escreva seu e-mail.')
    if (senha.length < MINIMO_DA_SENHA) {
      return setErro(`A senha precisa de pelo menos ${MINIMO_DA_SENHA} caracteres.`)
    }
    if (senha !== repetida) return setErro('As duas senhas não são iguais.')

    setErro('')
    setCriando(true)
    try {
      await criarConta(nome, email, senha)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui criar a conta agora.')
      setCriando(false)
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
          <h1 className="ent-titulo">Criar sua conta</h1>
          <p className="ent-linha">
            Use o e-mail que o administrador liberou. Depois de criar, ele aprova o seu acesso.
          </p>
        </div>

        <div className="ent-campos">
          <label className="ent-campo">
            <span>Nome</span>
            <div className={'ent-caixa' + (erro ? ' errada' : '')}>
              <input
                ref={campoNome}
                type="text"
                name="nome"
                autoComplete="name"
                placeholder="como a equipe te chama"
                value={nome}
                disabled={criando}
                onChange={(e) => {
                  setNome(e.target.value)
                  setErro('')
                }}
              />
            </div>
          </label>

          <label className="ent-campo">
            <span>E-mail</span>
            <div className={'ent-caixa' + (erro ? ' errada' : '')}>
              <input
                type="email"
                name="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="voce@fourtimefit.com.br"
                value={email}
                disabled={criando}
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
                autoComplete="new-password"
                placeholder={`pelo menos ${MINIMO_DA_SENHA} caracteres`}
                value={senha}
                disabled={criando}
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
            <span>Repita a senha</span>
            <div className={'ent-caixa' + (erro ? ' errada' : '')}>
              <input
                type={vendo ? 'text' : 'password'}
                name="repetida"
                autoComplete="new-password"
                placeholder="a mesma de cima"
                value={repetida}
                disabled={criando}
                onChange={(e) => {
                  setRepetida(e.target.value)
                  setErro('')
                }}
              />
            </div>
          </label>
        </div>

        {erro ? (
          <p className="ent-recado" role="alert">
            <i />
            {erro}
          </p>
        ) : null}

        <button className="ent-botao" type="submit" disabled={criando}>
          {criando ? 'Criando...' : 'Criar conta'}
        </button>

        <p className="ent-pe">
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </p>
      </form>
    </div>
  )
}
