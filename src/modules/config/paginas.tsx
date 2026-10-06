import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, List } from '@phosphor-icons/react'
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
    porque:
      'A ficha de cada referência: molde, medidas, tecido por tamanho e aviamentos. Guardar a página não apaga as fichas, e a Separação continua lendo o tecido delas.',
  },
  {
    chave: 'fornecedores',
    nome: 'Fornecedores',
    onde: 'Materiais',
    rota: '/fornecedores',
    porque:
      'De quem a Fourtime compra. Guardar a página não apaga a lista: o estoque e o verificador de boleto continuam lendo dela.',
  },
  {
    chave: 'transporte',
    nome: 'Transporte',
    onde: 'Gestão',
    rota: '/transporte',
    porque: 'O que a Fourtime paga para levar e buscar. Guardar a página não apaga os lançamentos.',
  },
  {
    chave: 'parceiros',
    nome: 'Parceiros',
    onde: 'Gestão',
    rota: '/parceiros',
    porque:
      'Quem vende peças na loja e quanto recebe. Guardar a página não apaga as vendas nem desliga a página de cada parceiro na loja.',
  },
  {
    chave: 'dtf',
    nome: 'Calculadora de DTF',
    onde: 'Ferramentas',
    rota: '/ferramentas/dtf',
    porque: 'Conta solta do custo do filme por metragem. Não lê nem grava nada do sistema.',
  },
  {
    chave: 'boleto',
    nome: 'Verificador de Boleto',
    onde: 'Ferramentas',
    rota: '/ferramentas/boleto',
    porque: 'Confere o boleto antes de pagar. O registro das conferências fica guardado mesmo com a página fora do menu.',
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
        <TituloCartao icone={List}>Menu</TituloCartao>
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
        <TituloCartao icone={FolderOpen}>Abrir uma página guardada</TituloCartao>
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
