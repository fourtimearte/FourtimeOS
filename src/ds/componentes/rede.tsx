import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { apagarRascunho, quandoFoiOrascunho, ultimoRascunhoQueVoltou } from './rascunho'

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
/* `rascunho`: o ultimo rascunho que voltou nesta visita, lido na hora do
   tombo. Um rascunho guardado por uma versao anterior pode derrubar a tela
   toda vez que ela abre, porque ele volta sempre: "Tentar de novo" caia de
   novo. Com ele, a rede oferece descartar SO aquele rascunho (19/10/2026). */
type Estado = { erro: Error | null; rascunho: { chave: string; em: number } | null }

export class RedeDeSeguranca extends Component<Props, Estado> {
  state: Estado = { erro: null, rascunho: null }

  static getDerivedStateFromError(erro: Error): Partial<Estado> {
    return { erro, rascunho: ultimoRascunhoQueVoltou() }
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
        {this.state.rascunho ? (
          <p>
            Esta tela tinha uma mudança não salva de {quandoFoiOrascunho(this.state.rascunho.em)}, guardada pelo
            navegador. Se ela for de uma versão anterior do sistema, pode ser o que derrubou a tela.
          </p>
        ) : null}
        <div className="rede-bts">
          {this.state.rascunho ? (
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => {
                const { chave } = this.state.rascunho!
                void apagarRascunho(chave).then(() => {
                  this.props.aoTentar?.()
                  this.setState({ erro: null, rascunho: null })
                })
              }}
            >
              Descartar a mudança não salva e abrir de novo
            </button>
          ) : null}
          <button
            type="button"
            className={this.state.rascunho ? 'btn btn-contorno' : 'btn btn-primario'}
            onClick={() => {
              this.props.aoTentar?.()
              this.setState({ erro: null, rascunho: null })
            }}
          >
            Tentar de novo
          </button>
          <button
            type="button"
            className="btn btn-contorno"
            onClick={() => {
              this.setState({ erro: null, rascunho: null })
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
