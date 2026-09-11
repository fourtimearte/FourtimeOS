import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { aplicarTema, temaAtual, temaGuardado, type Tema } from './tema'
import './kit.css'

/* A rota /kit. Hoje ela mostra só os tokens, que é tudo o que o Design System
   tem dentro do React. Botão, campo, tabela, menu e o resto entram no passo 5,
   e cada um nasce aqui antes de aparecer em qualquer tela do sistema. */
export function TelaKit() {
  const [tema, setTema] = useState<Tema>(() => temaGuardado() ?? temaAtual())

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  return (
    <div className="kit">
      <header className="kit-topo">
        <span className="kit-selo">V7</span>
        <div>
          <h1>Design System Fourtime</h1>
          <p>A fonte única de aparência do sistema</p>
        </div>
        <div className="kit-empurra" />
        <div className="kit-tema" role="group" aria-label="Tema">
          <button
            type="button"
            className={tema === 'light' ? 'ligado' : ''}
            onClick={() => setTema('light')}
          >
            Gelo
          </button>
          <button
            type="button"
            className={tema === 'dark' ? 'ligado' : ''}
            onClick={() => setTema('dark')}
          >
            Grafite
          </button>
        </div>
      </header>

      <div className="kit-corpo">
        <p className="kit-aviso">
          <i />
          Esta página é o passo 3: os tokens já vivem dentro do React e os dois temas trocam de
          verdade. Os componentes entram no passo 5, e a regra é que nenhum apareça numa tela do
          sistema antes de nascer aqui.
        </p>

        <Secao
          titulo="Superfície e texto"
          texto="A base industrial minimalista: superfície clara sobre cinza, borda de 1 px, sombra baixa. Troque para Grafite no topo e confira que nada some."
        >
          <Cores nomes={BASE} />
        </Secao>

        <Secao
          titulo="Acento"
          texto="Vermelho é ação e atraso. Preto é seleção, navegação ativa e botão forte. Não existe terceira cor de marca."
        >
          <Cores nomes={ACENTO} />
        </Secao>

        <Secao
          titulo="Cor com significado"
          texto="Só entram quando querem dizer alguma coisa: confirmado, atenção, informação, WhatsApp."
        >
          <Cores nomes={SINAIS} />
        </Secao>

        <Secao
          titulo="Técnicas"
          texto="A matiz é o vocabulário da fábrica e não muda. O tom é acabamento. Cada técnica tem quatro formas: o sólido que carrega texto branco, o vivo que não carrega, o suave do chip e o texto sobre o suave."
        >
          <div className="kit-tecs">
            {TECNICAS.map(([chave, rotulo]) => (
              <div
                key={chave}
                className="kit-tec"
                style={
                  {
                    '--tec': `var(--tec-${chave})`,
                    '--tec-vivo': `var(--tec-${chave}-vivo)`,
                    '--tec-soft': `var(--tec-${chave}-soft)`,
                    '--tec-fg': `var(--tec-${chave}-fg)`,
                  } as CSSProperties
                }
              >
                <span className="kit-pill">{rotulo}</span>
                <span className="kit-ponto" />
                <span className="kit-chip">{rotulo} em chip</span>
                <small>--tec-{chave}</small>
              </div>
            ))}
          </div>
        </Secao>

        <Secao
          titulo="Medida"
          texto="Respiro é regra, não gosto: o sistema roda em celular e tablet no galpão. Alvo de toque mínimo de 44 px, botão de 40 px, folga de 10 px entre botões."
        >
          <div className="kit-medidas">
            <div className="kit-fila">
              {RAIOS.map(([nome, v]) => (
                <div className="kit-medida" key={nome}>
                  <i
                    style={{
                      width: 66,
                      height: 44,
                      borderRadius: `var(--radius${nome ? '-' + nome : ''})`,
                    }}
                  />
                  <b>{nome || 'base'}</b>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <div className="kit-fila">
              {ESPACOS.map(([n, v]) => (
                <div className="kit-medida" key={n}>
                  <i style={{ width: `var(--sp-${n})`, height: 44, borderRadius: 2 }} />
                  <b>sp-{n}</b>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <div className="kit-fila">
              {ALTURAS.map(([nome, token, v]) => (
                <div className="kit-medida" key={nome}>
                  <i
                    style={{
                      width: 96,
                      height: `var(${token})`,
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <b>{nome}</b>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Secao>

        <Secao
          titulo="Tipografia"
          texto="Urbanist na interface. Roboto só no papel, na folha A4 do relatório, que é outra peça de propósito."
        >
          <div className="kit-cartao kit-tipo">
            {TIPOS.map(([texto, css, nota]) => (
              <div key={nota}>
                <span style={{ font: css }}>{texto}</span>
                <small>{nota}</small>
              </div>
            ))}
          </div>
        </Secao>
      </div>
    </div>
  )
}

function Secao({
  titulo,
  texto,
  children,
}: {
  titulo: string
  texto: string
  children: ReactNode
}) {
  return (
    <section className="kit-sec">
      <h2>{titulo}</h2>
      <p>{texto}</p>
      {children}
    </section>
  )
}

function Cores({ nomes }: { nomes: [string, string][] }) {
  return (
    <div className="kit-cores">
      {nomes.map(([token, uso]) => (
        <div className="kit-cor" key={token}>
          <div className="kit-amostra" style={{ background: `var(${token})` }} />
          <b>{token}</b>
          <span>{uso}</span>
        </div>
      ))}
    </div>
  )
}

const BASE: [string, string][] = [
  ['--bg', 'fundo da página'],
  ['--surface', 'cartão, barra, menu'],
  ['--surface-2', 'campo, controle'],
  ['--surface-3', 'estado apertado'],
  ['--border', 'borda de 1 px'],
  ['--border-2', 'borda em destaque'],
  ['--text', 'texto principal'],
  ['--text-2', 'texto de apoio'],
  ['--text-3', 'rótulo miúdo'],
]

const ACENTO: [string, string][] = [
  ['--brand', 'ação e atraso'],
  ['--brand-hover', 'ação sob o dedo'],
  ['--brand-soft', 'fundo do aviso'],
  ['--brand-text', 'texto sobre o suave'],
  ['--ink', 'seleção e botão forte'],
  ['--ink-soft', 'anel de foco'],
]

const SINAIS: [string, string][] = [
  ['--ok', 'confirmado'],
  ['--warn', 'atenção'],
  ['--info', 'informação'],
  ['--wa', 'WhatsApp'],
]

const TECNICAS: [string, string][] = [
  ['dtf', 'DTF'],
  ['subli', 'SUB'],
  ['silk', 'SILK'],
  ['patch', 'PATCH'],
  ['bordado', 'BORDADO'],
  ['gola', 'GOLA'],
  ['ribana', 'RIBANA'],
  ['etiqueta', 'ETIQUETA'],
]

const RAIOS: [string, string][] = [
  ['xs', '5px'],
  ['sm', '7px'],
  ['', '10px'],
  ['lg', '14px'],
  ['xl', '18px'],
]

const ESPACOS: [string, string][] = [
  ['1', '4px'],
  ['2', '8px'],
  ['3', '12px'],
  ['4', '16px'],
  ['5', '20px'],
  ['6', '24px'],
  ['8', '32px'],
]

const ALTURAS: [string, string, string][] = [
  ['botão', '--btn-h', '40px'],
  ['botão miúdo', '--btn-h-sm', '34px'],
  ['linha', '--row-h', '48 a 50px'],
]

const TIPOS: [string, string, string][] = [
  ['Fourtime OS', '600 32px/1.15 var(--font)', '600 . 32px . título de tela'],
  ['Pedido 2.481, Colégio Delta', '600 20px/1.25 var(--font)', '600 . 20px . título de cartão'],
  ['Camiseta dry masculina, gola careca', '400 14.5px/1.5 var(--font)', '400 . 14.5px . corpo'],
  ['CONFECÇÃO', '800 11.5px/1 var(--font)', '800 . 11.5px . rótulo miúdo'],
]
