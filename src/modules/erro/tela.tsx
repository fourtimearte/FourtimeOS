import { Link, useLocation, useRouteError } from 'react-router-dom'
import { Botao, Pagina, Vazio } from '@ds'
import './erro.css'

/* ==========================================================================
   O ENDERECO QUE NAO EXISTE, E A TELA QUE QUEBROU.

   Sem isto, um endereco digitado errado mostrava o erro cru do React Router
   ("Unexpected Application Error! 404 Not Found"), em ingles e sem saida
   (FOURTIME OS - 12, secao 2, item 8). Agora:
     - endereco que nao existe, com a pessoa dentro: a casca do sistema com
       "Esta página não existe" e o caminho de volta;
     - uma tela que quebrou ao desenhar: a mensagem em portugues e o botao de
       recarregar, sem derrubar a pessoa para fora.
   ========================================================================== */

export function TelaNaoEncontrada() {
  const { pathname } = useLocation()
  return (
    <Pagina titulo="Esta página não existe">
      <Vazio
        titulo="Nada neste endereço"
        texto={<>O endereço {pathname} não é de nenhuma tela do Fourtime OS. Pode ter sido digitado errado, ou a tela mudou de lugar.</>}
        acao={
          <Link to="/" className="btn btn-primario">
            Voltar ao início
          </Link>
        }
      />
    </Pagina>
  )
}

export function TelaDeErro() {
  const erro = useRouteError()
  const texto = erro instanceof Error ? erro.message : ''
  return (
    <div className="erro-tela" role="alert">
      <Vazio
        titulo="Esta tela parou de funcionar"
        texto={
          <>
            Algo deu errado ao montar a tela. Recarregar costuma resolver; se continuar, avise o administrador
            {texto ? <> com esta mensagem: <code>{texto}</code></> : null}.
          </>
        }
        acao={
          <Botao tom="primario" onClick={() => window.location.reload()}>
            Recarregar
          </Botao>
        }
      />
    </div>
  )
}
