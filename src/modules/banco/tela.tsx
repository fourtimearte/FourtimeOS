import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Buildings,
  CreditCard,
  Drop,
  Package,
  Printer,
  Ruler,
  Stack,
  Tag,
  Truck,
  User,
} from '@phosphor-icons/react'
import { Aviso, Cartao, Esqueleto, Pagina, Selo } from '@ds'
import {
  BANCO_VAZIO,
  LINHA_DA_CATEGORIA,
  NOME_DA_CATEGORIA,
  SECOES,
  carregarBanco,
  contar,
  ehListaSimples,
} from '@dominio/banco'
import type {
  Banco,
  Categoria,
  Consumo,
  CorDeImpressao,
  CorDeTecido,
  ItemDeLista,
  Referencia,
  Tecido,
  TipoDeLista,
} from '@dominio/banco'
import { AbasDaConfig } from '@modules/config'
import { useSessao } from '@dominio/sessao'
import { ConsumoDeTecido } from './consumo'
import { CoresDeImpressao, CoresDeTecido } from './cores'
import { GavetaDeNome, ModalDeApagar } from './pecas'
import type { AlvoDeApagar, AlvoDoNome } from './pecas'
import { Listas } from './listas'
import { Referencias } from './referencias'
import { Tecidos } from './tecidos'
import './banco.css'

/* ==========================================================================
   Banco de dados: a subpágina de Configurações que guarda o cadastro da
   fábrica.

   O arranjo é o do editor v3.375, olhado na tela e copiado: menu à esquerda
   com três seções (Layout, Cabeçalho, Cores), dez categorias com o número de
   itens do lado, e o corpo da categoria à direita.

   Copiado de propósito. Quem mexe nisso mexe no editor todo dia, e não
   deveria ter que reaprender onde ficam as coisas só porque a tela é outra.

   Quem pode mexer é admin e gerente, e quem decide isso é a regra de acesso
   escrita nas tabelas. Esconder os botões dos outros é educação, não tranca:
   mudar o nome de uma referência muda o que sai impresso na ficha que vai
   para a mesa de corte.
   ========================================================================== */

const ICONE: Record<Categoria, typeof Tag> = {
  referencias: Tag,
  tecidos: Stack,
  consumo: Ruler,
  pagamento: CreditCard,
  entrega: Truck,
  embalagem: Package,
  vendedor: User,
  departamento: Buildings,
  'cor-tecido': Drop,
  dtf: Printer,
  sublimacao: Drop,
}

export function TelaBanco() {
  const { estado } = useSessao()
  const papel = estado.fase === 'dentro' ? estado.pessoa.papel : null
  const podeMexer = papel === 'admin' || papel === 'gerente'

  const [banco, setBanco] = useState<Banco>(BANCO_VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('referencias')
  const [procurado, setProcurado] = useState('')
  const [aRenomear, setARenomear] = useState<AlvoDoNome | null>(null)
  const [aApagar, setAApagar] = useState<AlvoDeApagar | null>(null)

  useEffect(() => {
    let vivo = true
    carregarBanco()
      .then((b) => vivo && setBanco(b))
      .catch((e) => vivo && setFalha(e instanceof Error ? e.message : 'Não consegui carregar.'))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [])

  /* Trocar de categoria zera a busca. Procurar "azul" em Referências e voltar
     para Cores com a lista já filtrada por "azul" parece tela quebrada. */
  const irPara = useCallback((c: Categoria) => {
    setCategoria(c)
    setProcurado('')
  }, [])

  const contas = useMemo(() => contar(banco), [banco])

  /* Um mexedor para cada tabela. Trocar a linha no estado em vez de recarregar
     o banco inteiro: renomear uma cor não deveria custar nove pedidos. */
  const trocarReferencia = (r: Referencia) =>
    setBanco((b) => ({ ...b, referencias: b.referencias.map((x) => (x.id === r.id ? r : x)) }))
  const porReferencia = (r: Referencia) =>
    setBanco((b) => ({ ...b, referencias: [...b.referencias, r] }))
  const tirarReferencia = (id: string) =>
    setBanco((b) => ({ ...b, referencias: b.referencias.filter((x) => x.id !== id) }))

  const trocarTecido = (t: Tecido) =>
    setBanco((b) => ({ ...b, tecidos: b.tecidos.map((x) => (x.id === t.id ? t : x)) }))
  const porTecido = (t: Tecido) => setBanco((b) => ({ ...b, tecidos: [...b.tecidos, t] }))
  const tirarTecido = (id: string) =>
    setBanco((b) => ({ ...b, tecidos: b.tecidos.filter((x) => x.id !== id) }))

  const trocarCorDeTecido = (c: CorDeTecido) =>
    setBanco((b) => ({ ...b, coresDeTecido: b.coresDeTecido.map((x) => (x.id === c.id ? c : x)) }))
  const porCorDeTecido = (c: CorDeTecido) =>
    setBanco((b) => ({ ...b, coresDeTecido: [...b.coresDeTecido, c] }))
  const tirarCorDeTecido = (id: string) =>
    setBanco((b) => ({ ...b, coresDeTecido: b.coresDeTecido.filter((x) => x.id !== id) }))

  const trocarCorDeImpressao = (c: CorDeImpressao) =>
    setBanco((b) => ({
      ...b,
      coresDeImpressao: b.coresDeImpressao.map((x) => (x.codigo === c.codigo ? c : x)),
    }))

  /* O consumo chega por referência inteira, e não linha a linha: a gaveta da
     grade já sabe quais tamanhos daquela referência sobraram, e devolver a
     lista pronta evita a tela ter que adivinhar o que entrou e o que saiu. */
  const trocarConsumo = (referenciaId: string, linhas: Consumo[]) =>
    setBanco((b) => ({
      ...b,
      consumo: [...b.consumo.filter((c) => c.referenciaId !== referenciaId), ...linhas],
    }))

  const porItemDeLista = (i: ItemDeLista) => setBanco((b) => ({ ...b, listas: [...b.listas, i] }))
  const tirarItemDeLista = (tipo: TipoDeLista, valor: string) =>
    setBanco((b) => ({
      ...b,
      listas: b.listas.filter((x) => !(x.tipo === tipo && x.valor === valor)),
    }))

  const comum = {
    banco,
    podeMexer,
    procurado,
    aoProcurar: setProcurado,
    pedirNome: setARenomear,
    pedirApagar: setAApagar,
  }

  return (
    <Pagina
      acima="Configurações"
      titulo="Banco de dados"
      sub="Estas listas alimentam os menus do orçamento e da ficha. O que mudar aqui vale para todos."
      acoes={podeMexer ? null : <Selo tom="info">somente leitura</Selo>}
    >
      <AbasDaConfig atual="banco" />

      {falha ? (
        <Aviso tom="brand" titulo="Não consegui carregar o banco">
          {falha}
        </Aviso>
      ) : null}

      <div className="bd">
        <nav className="bd-rail" aria-label="Categorias do banco">
          {SECOES.map((s) => (
            <div key={s.titulo} className="bd-secao">
              <h3>{s.titulo}</h3>
              {s.itens.map((c) => {
                const Icone = ICONE[c]
                return (
                  <button
                    key={c}
                    type="button"
                    className={c === categoria ? 'bd-item ligado' : 'bd-item'}
                    onClick={() => irPara(c)}
                    aria-current={c === categoria ? 'true' : undefined}
                  >
                    <Icone size={18} />
                    <span>{NOME_DA_CATEGORIA[c]}</span>
                    <b>{carregando ? '' : contas[c].toLocaleString('pt-BR')}</b>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="bd-corpo">
          <p className="bd-linha-da-categoria">{LINHA_DA_CATEGORIA[categoria]}</p>

          {carregando ? (
            <Cartao>
              <div className="bd-carregando">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Esqueleto key={i} altura={38} raio="var(--radius)" />
                ))}
              </div>
            </Cartao>
          ) : categoria === 'referencias' ? (
            <Referencias
              {...comum}
              aoTrocar={trocarReferencia}
              aoPor={porReferencia}
              aoTirar={tirarReferencia}
            />
          ) : categoria === 'tecidos' ? (
            <Tecidos {...comum} aoTrocar={trocarTecido} aoPor={porTecido} aoTirar={tirarTecido} />
          ) : categoria === 'consumo' ? (
            <ConsumoDeTecido
              banco={banco}
              podeMexer={podeMexer}
              procurado={procurado}
              aoProcurar={setProcurado}
              aoTrocarConsumo={trocarConsumo}
            />
          ) : categoria === 'cor-tecido' ? (
            <CoresDeTecido
              {...comum}
              aoTrocar={trocarCorDeTecido}
              aoPor={porCorDeTecido}
              aoTirar={tirarCorDeTecido}
            />
          ) : categoria === 'dtf' || categoria === 'sublimacao' ? (
            <CoresDeImpressao {...comum} tecnica={categoria === 'dtf' ? 'dtf' : 'sublimacao'} aoTrocarCor={trocarCorDeImpressao} />
          ) : ehListaSimples(categoria) ? (
            <Listas
              {...comum}
              tipo={categoria}
              aoPor={porItemDeLista}
              aoTirar={tirarItemDeLista}
            />
          ) : null}
        </div>
      </div>

      <GavetaDeNome alvo={aRenomear} aoFechar={() => setARenomear(null)} />
      <ModalDeApagar alvo={aApagar} aoFechar={() => setAApagar(null)} />
    </Pagina>
  )
}
