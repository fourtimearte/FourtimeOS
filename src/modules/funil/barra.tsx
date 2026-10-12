import { useMemo, useState } from 'react'
import { PuzzlePiece } from '@phosphor-icons/react'
import { Aviso, Botao, Busca, Modal, Segmentado, Seletor } from '@ds'
import { noComputador, versaoDaExtensao } from '@shared'
import {
  NOME_DA_ORIGEM,
  ORIGENS,
  type FiltroDoFunil,
  type Lead,
  type QuemVer,
} from '@dominio/funil'

/* ==========================================================================
   A barra do topo do funil (prancha 125): Meus, Todos e Esperando, a busca,
   a origem e o vendedor.

   OS NUMEROS DO SEGMENTADO SAO DE ANTES DO FILTRO DE BUSCA, ORIGEM E
   VENDEDOR. Eles respondem "quantos sao meus" e "quantos estao esperando",
   e nao "quantos sobraram depois do que eu digitei": um numero que encolhe
   enquanto a pessoa digita parece que o funil esta perdendo lead.
   ========================================================================== */
export function BarraDoFunil({
  filtro,
  aoMudar,
  contas,
  vendedores,
}: {
  filtro: FiltroDoFunil
  aoMudar: (f: Partial<FiltroDoFunil>) => void
  contas: Record<QuemVer, number>
  vendedores: { id: string; nome: string }[]
}) {
  const opcoesDeVendedor = useMemo(
    () => [
      ...vendedores.map(v => ({ valor: v.id, rotulo: v.nome })),
      { valor: 'sem', rotulo: 'Sem dono' },
    ],
    [vendedores],
  )
  return (
    <div className="fileira fn-barra">
      <Segmentado<QuemVer>
        valor={filtro.quem}
        aoMudar={quem => aoMudar({ quem })}
        opcoes={[
          { valor: 'meus', rotulo: <Conta texto="Meus" n={contas.meus} /> },
          { valor: 'todos', rotulo: <Conta texto="Todos" n={contas.todos} /> },
          { valor: 'esperando', rotulo: <Conta texto="Esperando" n={contas.esperando} /> },
        ]}
      />
      <Busca
        className="fn-busca"
        value={filtro.busca}
        onChange={e => aoMudar({ busca: e.target.value })}
        placeholder="Buscar nome, telefone ou cotação"
        aria-label="Buscar no funil"
      />
      <Seletor
        rotulo="ORIGEM"
        valor={filtro.origem}
        vazio="Todas"
        opcoes={ORIGENS.map(o => ({ valor: o, rotulo: NOME_DA_ORIGEM[o] }))}
        aoEscolher={origem => aoMudar({ origem })}
      />
      <Seletor
        rotulo="VENDEDOR"
        valor={filtro.vendedor}
        vazio="Todos"
        opcoes={opcoesDeVendedor}
        aoEscolher={vendedor => aoMudar({ vendedor })}
      />
    </div>
  )
}

function Conta({ texto, n }: { texto: string; n: number }) {
  return (
    <>
      {texto} <span className="fn-seg-n">{n}</span>
    </>
  )
}

/** Os vendedores que aparecem nos leads, em ordem de nome, sem repetir. */
export function vendedoresDosLeads(leads: Lead[]) {
  const vistos = new Map<string, string>()
  for (const l of leads)
    if (l.vendedorId && !vistos.has(l.vendedorId))
      vistos.set(l.vendedorId, l.vendedorNome || 'Sem nome')
  return [...vistos]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/* ==========================================================================
   O AVISO DA EXTENSAO (prancha 128).

   So no computador e so sem a extensao: no celular nao existe extensao, e o
   botao do WhatsApp ja abre o aplicativo. Fecha pelo dia: quem decidiu
   instalar depois nao precisa ver o mesmo aviso a cada clique no menu, e
   quem esqueceu ve de novo amanha.

   ENQUANTO A EXTENSAO NAO ESTA NA CHROME WEB STORE (prova 0.1.0, 11/10/2026)
   o botao explica a instalacao pelo arquivo. Quando ela for publicada como
   nao listada, LINK_DA_EXTENSAO recebe o endereco e o botao vira "Instalar a
   extensao", que abre a pagina dela na loja.
   ========================================================================== */
const LINK_DA_EXTENSAO = ''
const CHAVE_FECHADO = 'ft.aviso-extensao'
const hoje = () => new Date().toISOString().slice(0, 10)

function fechadoHoje() {
  try {
    return localStorage.getItem(CHAVE_FECHADO) === hoje()
  } catch {
    return false
  }
}

/* fixo: o aviso do modo WhatsApp, que nao fecha (sem a extensao ali nao ha
   o que mostrar) */
export function AvisoDaExtensao({ fixo = false }: { fixo?: boolean }) {
  const [fechado, setFechado] = useState(fechadoHoje)
  const [comoInstalar, setComoInstalar] = useState(false)
  if ((fechado && !fixo) || !noComputador() || versaoDaExtensao()) return null

  function fechar() {
    try {
      localStorage.setItem(CHAVE_FECHADO, hoje())
    } catch {
      /* sem armazenamento: fecha so nesta visita */
    }
    setFechado(true)
  }

  return (
    <>
      <Aviso
        tom="warn"
        titulo="Você precisa da extensão Fourtime OS para usar o WhatsApp aqui"
        acao={
          <div className="fileira">
            {LINK_DA_EXTENSAO ? (
              <Botao
                tom="forte"
                onClick={() => window.open(LINK_DA_EXTENSAO, '_blank', 'noopener')}
              >
                <PuzzlePiece size={17} />
                Instalar a extensão
              </Botao>
            ) : (
              <Botao tom="forte" onClick={() => setComoInstalar(true)}>
                <PuzzlePiece size={17} />
                Como instalar
              </Botao>
            )}
            {fixo ? null : (
              <Botao tom="contorno" onClick={fechar}>
                Agora não
              </Botao>
            )}
          </div>
        }
      >
        O WhatsApp não deixa ser aberto dentro de outro site, e a extensão libera só para o Fourtime
        OS, neste computador. Sem ela, o botão do WhatsApp abre uma aba nova a cada clique.
      </Aviso>

      <Modal
        aberto={comoInstalar}
        aoFechar={() => setComoInstalar(false)}
        titulo="Instalar a extensão Fourtime OS"
      >
        <div className="pilha fn-instalar">
          <p>
            A extensão ainda está em teste e não está na Chrome Web Store. Peça o arquivo{' '}
            <b>fourtime-os-0.4.1.zip</b> ao administrador e siga os passos neste computador:
          </p>
          <ol>
            <li>Descompacte o arquivo numa pasta que não vá ser apagada.</li>
            <li>
              No Chrome, abra o endereço <code>chrome://extensions</code>.
            </li>
            <li>Ligue o Modo do desenvolvedor, no canto de cima à direita.</li>
            <li>
              Clique em Carregar sem compactação e escolha a pasta <b>fourtime-os-0.2.0</b>.
            </li>
            <li>
              Volte para esta página e recarregue: este aviso some sozinho. Se uma versão anterior já
              estava instalada, aperte o botão de recarregar dela em <code>chrome://extensions</code>.
            </li>
          </ol>
        </div>
      </Modal>
    </>
  )
}
