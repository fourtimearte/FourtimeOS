import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/* ==========================================================================
   A rede de seguranca.

   Um erro solto em React derruba a arvore inteira e deixa a tela BRANCA. Numa
   fabrica isso e pior do que o erro: ninguem sabe se travou, se caiu a
   internet, ou se apagou o trabalho. A rede pega o tombo, diz o que houve, e
   deixa duas saidas: tentar de novo sem perder a aba, ou voltar para o inicio.

   Ela precisa ser classe. O React so oferece componentDidCatch em classe, e
   nao existe versao em funcao ate hoje.
   ========================================================================== */

type Props = {
  children: ReactNode
  aoVoltar?: () => void
  /** chamado ao tentar de novo, para quem quiser desfazer o que causou o tombo */
  aoTentar?: () => void
}
type Estado = { erro: Error | null }

export class RedeDeSeguranca extends Component<Props, Estado> {
  state: Estado = { erro: null }

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    /* o console e o unico lugar de registro enquanto nao existe servidor de
       erro: pelo menos quem abrir o inspetor acha o rastro */
    console.error('[fourtime] tela caiu:', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="rede">
        <h2>Esta tela caiu</h2>
        <p>
          Alguma coisa quebrou aqui dentro e a tela parou. O que você já tinha salvo continua salvo:
          o tombo foi no desenho, não no dado.
        </p>
        <pre>{this.state.erro.message}</pre>
        <div className="rede-bts">
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => {
              this.props.aoTentar?.()
              this.setState({ erro: null })
            }}
          >
            Tentar de novo
          </button>
          <button
            type="button"
            className="btn btn-contorno"
            onClick={() => {
              this.setState({ erro: null })
              this.props.aoVoltar?.()
            }}
          >
            Voltar para o início
          </button>
        </div>
      </div>
    )
  }
}
