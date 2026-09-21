import { useCallback, useEffect, useState } from 'react'
import { Aviso, Botao, Cartao, Interruptor, Pagina, TituloCartao, avisar } from '@ds'
import { mostrarPagina, paginasEscondidas } from '@dominio/regulagem'
import { AbasDaConfig } from './abas'
import './config.css'

/* ==========================================================================
   As páginas do sistema.

   Uma página que talvez não vá ser usada não se apaga. Apagar é uma decisão
   que ninguém desfaz num sábado, e "talvez a gente use" é exatamente o estado
   em que a Ficha de produção está: ela existe inteira, funciona, e o caminho
   novo (separação, PCP, kanban) pode acabar tornando ela desnecessária.

   Então ela sai do menu e fica esperando. O código continua no lugar, a rota
   continua de pé, e o dia em que a decisão amadurecer é um interruptor.

   ESCONDER É DECISÃO DA EMPRESA, E NÃO PREFERÊNCIA DE QUEM OLHA. Por isso a
   lista mora na regulagem, no banco, e não na memória do navegador: guardada
   por navegador, cada pessoa da fábrica veria um menu diferente, e o próprio
   motivo de esconder deixaria de valer.
   ========================================================================== */

type Pagina = { chave: string; nome: string; onde: string; porque: string; rota: string }

/* Só entram aqui as páginas que fazem sentido desligar. Início, Configurações
   e o próprio perfil não: sistema sem porta de entrada não é sistema
   configurável, é sistema quebrado. */
const PAGINAS: Pagina[] = [
  {
    chave: 'ficha',
    nome: 'Ficha de produção',
    onde: 'Produção',
    rota: '/ficha',
    porque:
      'Guardada enquanto o caminho novo (separação, PCP e kanban) não provar que ela é desnecessária. O código está inteiro.',
  },
  {
    chave: 'produtos',
    nome: 'Fichas técnicas',
    onde: 'Materiais',
    rota: '/produtos',
    porque: 'Ainda é uma tela de aviso, e não uma tela de trabalho.',
  },
]

export function TelaPaginas() {
  const [escondidas, setEscondidas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [ocupada, setOcupada] = useState('')
  const [falha, setFalha] = useState('')

  const ler = useCallback(async () => {
    try {
      setEscondidas(new Set(await paginasEscondidas()))
      setFalha('')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void ler()
  }, [ler])

  async function virar(pagina: Pagina, ligada: boolean) {
    setOcupada(pagina.chave)
    try {
      setEscondidas(new Set(await mostrarPagina(pagina.chave, ligada)))
      avisar(pagina.nome + (ligada ? ' voltou para o menu' : ' saiu do menu'), 'ok')
      /* O menu lateral lê a mesma lista na montagem. Recarregar é o jeito
         honesto de a mudança valer na tela inteira agora, e não na próxima
         vez que alguém abrir o sistema. */
      setTimeout(() => window.location.reload(), 700)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui gravar')
    } finally {
      setOcupada('')
    }
  }

  return (
    <Pagina
      acima="Configurações"
      titulo="Páginas"
      sub="O que aparece no menu do sistema. Desligar guarda a página, e não apaga nada."
    >
      <AbasDaConfig atual="paginas" />

      {falha ? <Aviso tom="warn">{falha}</Aviso> : null}

      <Cartao>
        <TituloCartao>Menu</TituloCartao>
        <p className="cfg-texto">
          Desligar tira a página do menu de todo mundo. O endereço continua funcionando para quem o
          tiver, e é assim que dá para conferir uma página guardada sem religar ela para a fábrica
          inteira.
        </p>

        <div className="cfg-paginas">
          {PAGINAS.map((p) => {
            const ligada = !escondidas.has(p.chave)
            return (
              <div key={p.chave} className="cfg-pagina">
                <div className="cfg-pagina-txt">
                  <b>{p.nome}</b>
                  <small>
                    {p.onde} · {p.rota}
                  </small>
                  <small className="cfg-porque">{p.porque}</small>
                </div>
                <Interruptor
                  ligado={ligada}
                  aoMudar={(v) => {
                    if (carregando || ocupada) return
                    void virar(p, v)
                  }}
                  rotulo={ligada ? 'No menu' : 'Guardada'}
                />
              </div>
            )
          })}
        </div>
      </Cartao>

      <Cartao>
        <TituloCartao>Abrir uma página guardada</TituloCartao>
        <p className="cfg-texto">
          A rota continua de pé. Para ver a Ficha de produção mesmo com ela fora do menu, abra{' '}
          <code>/ficha</code> direto no endereço.
        </p>
        <Botao tom="contorno" onClick={() => window.open('/ficha', '_blank')}>
          Abrir a ficha numa aba
        </Botao>
      </Cartao>
    </Pagina>
  )
}
