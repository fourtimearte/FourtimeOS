import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao, Pagina, Selo, Vazio, avisar } from '@ds'
import {
  CORES_POR_GRUPO,
  LISTA_SIMPLES,
  REFERENCIAS,
  TECIDOS_POR_TIPO,
  abas,
  type Categoria,
} from '@dominio/banco'
import { listarClientes } from '@dominio/cliente'
import './banco.css'

/* ==========================================================================
   Banco de dados, no arranjo do v5.

   Nove categorias em abas, e cada uma com o corpo que ela pede: referencia em
   tabela, tecido e cor em cartoes por grupo, e o resto em lista simples.

   O conteudo e o do EDITOR, nao o do mockup. No mockup as listas eram de
   enfeite; as de verdade sao outras, e sao estas.
   ========================================================================== */

const NOME_DO_GENERO: Record<string, string> = {
  masculino: 'M',
  feminino: 'F',
  infantil: 'C',
  '': 'U',
}

export function TelaBanco() {
  const navegar = useNavigate()
  const clientes = useMemo(() => listarClientes().length, [])
  const lista = useMemo(() => abas(clientes), [clientes])
  const [aba, setAba] = useState<Categoria>('referencias')

  const total = lista.reduce((s, a) => s + a.conta, 0)
  const naoMexe = () =>
    avisar('Editar o banco entra junto com o Supabase. Por enquanto ele é só leitura.', 'info')

  return (
    <Pagina
      acima="Banco · cadastro global do editor"
      titulo="Banco de dados"
      sub={
        total.toLocaleString('pt-BR') +
        ' itens em ' +
        lista.length +
        ' categorias · vindos do banco do editor, não inventados'
      }
      acoes={
        <>
          <Botao tom="contorno" onClick={naoMexe}>
            Exportar DB
          </Botao>
          <Botao tom="contorno" onClick={naoMexe}>
            Importar DB
          </Botao>
          <Botao tom="primario" onClick={naoMexe}>
            Sincronizar
          </Botao>
        </>
      }
    >
      <div className="bc-abas">
        {lista.map((a) => (
          <button
            key={a.chave}
            type="button"
            className={aba === a.chave ? 'bc-aba ligada' : 'bc-aba'}
            onClick={() => setAba(a.chave)}
          >
            {a.nome}
            <span className="n">{a.conta.toLocaleString('pt-BR')}</span>
          </button>
        ))}
      </div>

      {aba === 'referencias' ? (
        <>
          <p className="bc-nota">
            Código FT-CCC-NNNG: categoria, sequencial e gênero (M, F, U, C). O gênero sai da última
            letra do código, e é ele que pinta a tarja.
          </p>
          <div className="cartao bc-rolo">
            <table className="bc-tab">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Referência</th>
                  <th className="esconde">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {REFERENCIAS.map((r) => (
                  <tr key={r.cod}>
                    <td className="bc-cod">{r.cod}</td>
                    <td>
                      <span className="bc-ref">
                        <span className={'tag gen-' + (r.genero || 'masculino')}>
                          {NOME_DO_GENERO[r.genero] ?? 'U'}
                        </span>
                        <b>{r.nome}</b>
                      </span>
                    </td>
                    <td className="esconde bc-suave">{r.categoria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {aba === 'tecidos' ? (
        <>
          <p className="bc-nota">
            Tecidos agrupados por tipo, que é a família comercial e nunca a construção. Dentro do
            tipo a ordem é alfabética, e o tipo vazio não some: é para onde vai o primeiro tecido.
          </p>
          <div className="bc-cartoes">
            {TECIDOS_POR_TIPO.map((t) => (
              <section key={t.cod || 'sem'} className="bc-grupo">
                <header>
                  <span className="cod">{t.cod || 'sem tipo'}</span>
                  <span className="nm">{t.nome}</span>
                  <span className="n">{t.itens.length}</span>
                </header>
                <div className="bc-itens">
                  {t.itens.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}

      {aba === 'cores' ? (
        <>
          <p className="bc-nota">
            Cada cor tem nome, hexadecimal e grupo. O hexadecimal existe para pintar o quadrado, e
            aparece aqui porque esta é a tela onde ele se conserta.
          </p>
          <div className="bc-cartoes">
            {CORES_POR_GRUPO.map((g) => (
              <section key={g.cod} className="bc-grupo">
                <header>
                  <span className="cod">{g.cod}</span>
                  <span className="nm">{g.nome}</span>
                  <span className="n">{g.cores.length}</span>
                </header>
                <div className="bc-itens">
                  {g.cores.map((c) => (
                    <span key={c.n + c.c}>
                      <i className="bc-amostra" style={{ background: c.c }} />
                      <span className="bc-cor-nome">{c.n}</span>
                      <small>{c.c}</small>
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}

      {aba === 'clientes' ? (
        <div className="cartao">
          <Vazio
            titulo="Clientes moram na tela Clientes"
            texto="Os do banco do editor foram mesclados com a base Bling. Nome e documento são a chave."
            acao={
              <Botao tom="primario" onClick={() => navegar('/clientes')}>
                Abrir Clientes
              </Botao>
            }
          />
        </div>
      ) : null}

      {LISTA_SIMPLES[aba] ? (
        <>
          <p className="bc-nota">
            Esta lista é o que aparece no cabeçalho do orçamento. Ela vem do editor como está: o
            nome que a fábrica usa, não o nome bonito.
          </p>
          <div className="cartao bc-simples">
            {LISTA_SIMPLES[aba].map((v) => (
              <div key={v} className="bc-linha">
                <span>{v}</span>
                <Selo>somente leitura</Selo>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Pagina>
  )
}
