import { useEffect, useMemo, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { Aviso, Botao, Campo, Entrada, Modal, avisar } from '@ds'
import {
  NOME_DA_CATEGORIA,
  minimoRecomendado,
  nomeNoGrupo,
  quantoNaUnidade,
  salvarCadastroDoMaterial,
  type GrupoDoEstoque,
  type UsoDoMaterial,
} from '@dominio/estoque'
import {
  criarFornecedor,
  desligarMaterialDoFornecedor,
  ligarMaterialAoFornecedor,
} from '@dominio/fornecedor'
import { EscolherFornecedor } from '@dominio/fornecedor/escolher'
import { lerNumero } from '@dominio/ferramentas'
import { idsDosFornecedores, type Fornecimento } from './apoio'
import { Bola } from './vao'

/* ==========================================================================
   Editar o grupo: o cadastro, e nunca o saldo.

   O que se edita aqui é o mínimo de cada item, onde ele fica na fábrica, o
   nome (de aviamento e insumo: o nome do tecido é a malha e a cor do
   catálogo) e de quem a fábrica compra. O quanto tem é movimento, e
   movimento tem a sua folha.

   O FORNECEDOR É DO GRUPO INTEIRO. Quem vende o dry fit branco vende o preto.
   Escolher aqui liga o fornecedor a todos os itens do grupo, e tirar desliga
   de todos.
   ========================================================================== */

type Linha = { id: string; nome: string; minimo: string; ondeFica: string }

export function EditarGrupo({
  grupo,
  usos,
  fornecimento,
  aoFechar,
  aoSalvar,
  aoCriarFornecedor,
}: {
  grupo: GrupoDoEstoque | null
  /** o que saiu de cada material, para o mínimo recomendado; nulo enquanto não leu */
  usos?: UsoDoMaterial[] | null
  fornecimento: Fornecimento
  aoFechar: () => void
  aoSalvar: (grupoNovo: string) => Promise<void>
  aoCriarFornecedor: () => Promise<void>
}) {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [nomeDoGrupo, setNomeDoGrupo] = useState('')
  const [fornecedores, setFornecedores] = useState<string[]>([])
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')

  const deAntes = useMemo(
    () =>
      grupo
        ? [...new Set(grupo.itens.flatMap((m) => idsDosFornecedores(fornecimento.ligacoes, m.id)))]
        : [],
    [grupo, fornecimento.ligacoes],
  )

  useEffect(() => {
    if (!grupo) return
    setLinhas(
      grupo.itens.map((m) => ({
        id: m.id,
        nome: m.nome,
        minimo: String(m.minimo).replace('.', ','),
        ondeFica: m.ondeFica,
      })),
    )
    setNomeDoGrupo(grupo.itens[0]?.grupo ?? '')
    setFalha('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo?.chave])

  useEffect(() => {
    setFornecedores(deAntes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo?.chave, deAntes.join(',')])

  const ehTecido = grupo?.categoria === 'tecido'
  const mudar = (id: string, campo: keyof Linha, valor: string) =>
    setLinhas((antes) => antes.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))

  const valido = linhas.every((l) => {
    const n = lerNumero(l.minimo)
    return l.nome.trim() !== '' && (n === null || (!Number.isNaN(n) && n >= 0))
  })

  async function salvar() {
    if (!grupo || !valido || gravando) return
    setGravando(true)
    setFalha('')
    try {
      for (const l of linhas) {
        const m = grupo.itens.find((x) => x.id === l.id)
        if (!m) continue
        const minimo = lerNumero(l.minimo) ?? 0
        const grupoNovo = ehTecido ? m.grupo : nomeDoGrupo.trim()
        if (
          l.nome.trim() !== m.nome ||
          minimo !== m.minimo ||
          l.ondeFica.trim() !== m.ondeFica ||
          grupoNovo !== m.grupo
        ) {
          await salvarCadastroDoMaterial(m.id, {
            nome: l.nome.trim(),
            unidade: m.unidade,
            minimo,
            grupo: grupoNovo,
            ondeFica: l.ondeFica,
          })
        }
        if (fornecimento.disponivel) {
          const tinha = idsDosFornecedores(fornecimento.ligacoes, m.id)
          for (const f of fornecedores) {
            if (!tinha.includes(f)) await ligarMaterialAoFornecedor(m.id, f)
          }
          for (const f of deAntes) {
            if (!fornecedores.includes(f) && tinha.includes(f)) await desligarMaterialDoFornecedor(m.id, f)
          }
        }
      }
      avisar('Cadastro salvo.', 'ok')
      await aoSalvar(ehTecido ? '' : nomeDoGrupo.trim())
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui salvar.')
    } finally {
      setGravando(false)
    }
  }

  const livres = fornecimento.fornecedores.filter((f) => !fornecedores.includes(f.id))

  return (
    <Modal
      aberto={!!grupo}
      aoFechar={aoFechar}
      largo
      titulo={grupo ? (ehTecido ? 'Editar tecido' : 'Editar grupo') + ' · ' + grupo.nome : ''}
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="primario" onClick={salvar} disabled={!valido || gravando} carregando={gravando}>
            {gravando ? 'Salvando' : 'Salvar'}
          </Botao>
        </>
      }
    >
      {grupo ? (
        <div className="es-novo">
          <p className="es-ajuda">
            Aqui muda o cadastro: mínimo, lugar e fornecedor. O quanto tem só muda por movimento.
          </p>

          {!ehTecido ? (
            <Campo rotulo={'Grupo, em ' + NOME_DA_CATEGORIA[grupo.categoria].toLowerCase()}>
              <Entrada value={nomeDoGrupo} onChange={(e) => setNomeDoGrupo(e.currentTarget.value)} />
            </Campo>
          ) : null}

          <div className="es-editar">
            <div className="es-editar-topo">
              <span>{ehTecido ? 'Cor' : 'Material'}</span>
              <span>Mínimo</span>
              <span>Onde fica na fábrica</span>
            </div>
            {linhas.map((l) => {
              const m = grupo.itens.find((x) => x.id === l.id)
              if (!m) return null
              const n = lerNumero(l.minimo)
              /* o mínimo recomendado pela saída: aparece debaixo do campo, e um
                 clique põe o número lá */
              const recomendado = usos
                ? minimoRecomendado(
                    usos.find((u) => u.materialId === m.id),
                    m.unidade,
                  )
                : 0
              const emTexto = String(recomendado).replace('.', ',')
              return (
                <div key={l.id} className="es-editar-linha">
                  {ehTecido ? (
                    <span className="es-celula">
                      <Bola cor={m.corHex} />
                      <b>{nomeNoGrupo(m)}</b>
                    </span>
                  ) : (
                    <Entrada
                      value={l.nome}
                      onChange={(e) => mudar(l.id, 'nome', e.currentTarget.value)}
                      aria-label="Nome do material"
                    />
                  )}
                  <div className="pilha colada">
                    <Campo erro={n !== null && (Number.isNaN(n) || n < 0)}>
                      <Entrada
                        inputMode="decimal"
                        value={l.minimo}
                        onChange={(e) => mudar(l.id, 'minimo', e.currentTarget.value)}
                        aria-label={'Mínimo, em ' + m.unidade}
                      />
                    </Campo>
                    {recomendado > 0 ? (
                      <button
                        type="button"
                        className="es-recomendado-miudo"
                        data-recomendado={m.nome}
                        title={'Usar ' + quantoNaUnidade(recomendado, m.unidade) + ', a média do que saiu no último mês e nos últimos três'}
                        disabled={l.minimo.trim() === emTexto}
                        onClick={() => mudar(l.id, 'minimo', emTexto)}
                      >
                        recomendado {emTexto}
                      </button>
                    ) : null}
                  </div>
                  <Entrada
                    value={l.ondeFica}
                    onChange={(e) => mudar(l.id, 'ondeFica', e.currentTarget.value)}
                    placeholder="Prateleira, armário ou caixa"
                    aria-label="Onde fica na fábrica"
                  />
                </div>
              )
            })}
          </div>

          {fornecimento.disponivel ? (
            <div className="campo">
              <span className="es-campo-topo">
                Fornecedor <small>vale para {ehTecido ? 'todas as cores' : 'o grupo inteiro'}</small>
              </span>
              {fornecedores.length ? (
                <div className="es-novo-chips">
                  {fornecedores.map((id) => {
                    const f = fornecimento.fornecedores.find((x) => x.id === id)
                    if (!f) return null
                    return (
                      <span key={id} className="es-escolhido-chip">
                        {f.nome}
                        <button
                          type="button"
                          aria-label={'Tirar ' + f.nome}
                          onClick={() => setFornecedores((a) => a.filter((x) => x !== id))}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    )
                  })}
                </div>
              ) : null}
              <EscolherFornecedor
                valor=""
                aoEscolher={(id) => id && setFornecedores((a) => (a.includes(id) ? a : [...a, id]))}
                fornecedores={livres}
                jaFornecem={[]}
                tipo={grupo.categoria}
                nomeDoTipo={NOME_DA_CATEGORIA[grupo.categoria]}
                aoCriar={async (nome) => {
                  const id = await criarFornecedor({ nome, entrouPor: 'estoque', tipos: [grupo.categoria] })
                  await aoCriarFornecedor()
                  return id
                }}
              />
            </div>
          ) : null}

          {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
        </div>
      ) : null}
    </Modal>
  )
}
