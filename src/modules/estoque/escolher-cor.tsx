import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, PencilSimple, Plus } from '@phosphor-icons/react'
import { Aviso, Botao, Chip, Entrada, Seletor, avisar } from '@ds'
import { criarCorDeTecido, mudarCorDeTecido } from '@dominio/banco'
import {
  FAMILIA_OUTRAS,
  GRUPO_DA_SUBLIMACAO,
  coresPorFamilia,
  familiaDaCor,
  hexDaCor,
  type CorDoCatalogo,
  type FamiliaDeCor,
} from '@dominio/estoque'
import { semAcento } from '@shared'
import { Bola } from './vao'

/* ==========================================================================
   A cor do tecido, no cadastro de material: PRIMEIRO A FAMÍLIA, DEPOIS A COR
   (prancha 55 do wireframe, escolhida pelo Henrique em 05/10/2026).

   O catálogo tem mais de cem cores. Todas em pílulas, uma atrás da outra,
   ocupavam 1.696 px de altura. Aqui a pessoa vê uma fileira com as famílias
   (Branco e Cru, Azul, Metálicos...), clica numa, e só as cores dela aparecem.

   ADICIONAR E EDITAR A COR, sem sair do cadastro (pedido dele junto com a
   escolha). A pílula "Nova cor" fica no fim da família aberta, e "Editar
   cores" troca o clique: em vez de escolher, a pílula abre a ficha da cor
   (nome, cor e família). É o mesmo catálogo de Configurações, Banco de dados,
   Cores de tecido, e vale a mesma regra de lá: só administrador e gerente
   mexem. Para os outros, as duas opções não aparecem.

   TROCAR O NOME TEM CONSEQUÊNCIA, e a ficha diz qual: o pedido guarda a cor
   pelo nome escrito, então o que já foi escrito com o nome antigo continua
   com ele.
   ========================================================================== */

type Ficha = { id: string | null; nome: string; hex: string; grupo: string; antes: string }

export function EscolherCor({
  cores,
  familias,
  valor,
  jaTem,
  aoEscolher,
  podeMexer,
  aoMudarCatalogo,
  aoAbrirFicha,
}: {
  cores: CorDoCatalogo[]
  familias: FamiliaDeCor[]
  /** o id da cor escolhida, ou vazio */
  valor: string
  /** as cores que este tecido já tem no estoque: aparecem apagadas */
  jaTem: Set<string>
  aoEscolher: (id: string) => void
  /** administrador e gerente: põem cor na família e editam a que existe */
  podeMexer: boolean
  /** relê o catálogo depois de uma cor nascer ou mudar */
  aoMudarCatalogo: () => Promise<void>
  /** a ficha de uma cor abriu ou fechou: enquanto ela está aberta, o cadastro espera */
  aoAbrirFicha?: (aberta: boolean) => void
}) {
  const blocos = useMemo(
    () => coresPorFamilia(cores, familias, podeMexer),
    [cores, familias, podeMexer],
  )
  const escolhida = cores.find(c => c.id === valor)
  /* nula: nenhuma família aberta */
  const [aberta, setAberta] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [gravando, setGravando] = useState(false)
  const [falha, setFalha] = useState('')

  /* a cor escolhida abre a família dela: é o que mostra a escolha na tela */
  const familiaDaEscolhida = escolhida ? familiaDaCor(escolhida, familias) : null
  useEffect(() => {
    if (familiaDaEscolhida !== null) setAberta(familiaDaEscolhida)
  }, [familiaDaEscolhida, valor])

  /* a ficha abre debaixo das pílulas, e o cadastro rola: ela vem para a vista */
  const caixaDaFicha = useRef<HTMLDivElement>(null)
  const fichaAberta = ficha ? (ficha.id ?? 'nova') : ''
  useEffect(() => {
    if (fichaAberta) caixaDaFicha.current?.scrollIntoView({ block: 'nearest' })
    aoAbrirFicha?.(!!fichaAberta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaAberta])

  const bloco = aberta === null ? undefined : blocos.find(b => b.cod === aberta)
  const total = cores.length
  const sairDaFicha = () => {
    setFicha(null)
    setFalha('')
  }
  const abrirFamilia = (cod: string) => {
    setAberta(a => (a === cod ? null : cod))
    setEditando(false)
    sairDaFicha()
  }

  const nomeLimpo = ficha?.nome.trim() ?? ''
  const hexLimpo = ficha ? hexDaCor(ficha.hex) : ''
  const repetida =
    !!ficha &&
    !!nomeLimpo &&
    cores.some(c => c.id !== ficha.id && semAcento(c.nome) === semAcento(nomeLimpo))
  const mudouONome = !!ficha?.id && !!nomeLimpo && nomeLimpo !== ficha.antes
  const podeGravar = !!ficha && !!nomeLimpo && !!hexLimpo && !repetida && !gravando

  async function gravar() {
    if (!ficha || !podeGravar) return
    setGravando(true)
    setFalha('')
    try {
      const grupo = ficha.grupo || null
      if (ficha.id) {
        await mudarCorDeTecido(ficha.id, { nome: nomeLimpo, hex: hexLimpo, grupo })
        await aoMudarCatalogo()
        avisar(`${nomeLimpo} foi atualizada no catálogo de cores.`, 'ok')
        setAberta(ficha.grupo)
      } else {
        const nova = await criarCorDeTecido({ nome: nomeLimpo, hex: hexLimpo, grupo })
        await aoMudarCatalogo()
        avisar(`${nomeLimpo} entrou no catálogo de cores e já está escolhida.`, 'ok')
        setEditando(false)
        aoEscolher(nova.id)
      }
      sairDaFicha()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui gravar a cor.')
    } finally {
      setGravando(false)
    }
  }

  const naFamilia = bloco ? bloco.cores.filter(c => jaTem.has(c.id)).length : 0
  const editaveis = bloco ? bloco.cores.filter(c => c.grupo !== GRUPO_DA_SUBLIMACAO).length : 0

  return (
    <div className="es-cor" data-escolher-cor="">
      <div className="es-familias" role="group" aria-label="Famílias de cor">
        {blocos.map(b => (
          <button
            key={b.cod || 'outras'}
            type="button"
            className={b.cod === aberta ? 'es-familia ligada' : 'es-familia'}
            data-familia={b.cod || 'outras'}
            aria-label={b.nome}
            title={b.nome}
            aria-pressed={b.cod === aberta}
            onClick={() => abrirFamilia(b.cod)}
          >
            <span
              className={b.rosto ? 'es-bola es-rosto' : 'es-bola es-rosto varias'}
              style={b.rosto ? ({ '--bola': b.rosto } as CSSProperties) : undefined}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      {!bloco ? (
        escolhida ? (
          <p className="es-cor-escolhida" data-cor-escolhida="">
            <Bola cor={escolhida.hex} pequena />
            <b>{escolhida.nome}</b>
            <span>é a cor escolhida</span>
          </p>
        ) : (
          <p className="es-cor-dica">
            Clique numa família para ver as cores dela. São {blocos.length} famílias e {total}{' '}
            cores.
          </p>
        )
      ) : (
        <>
          <div className="es-familia-titulo" data-familia-aberta={bloco.cod || 'outras'}>
            <b>{bloco.nome}</b>
            <span>
              {bloco.cores.length === 1 ? '1 cor' : bloco.cores.length + ' cores'}
              {naFamilia
                ? ' · ' + (naFamilia === 1 ? '1 já está' : naFamilia + ' já estão') + ' no estoque'
                : ''}
            </span>
            {podeMexer && editaveis && !ficha ? (
              <Botao
                tom="limpo"
                tamanho="sm"
                className="es-editar-cores"
                aria-pressed={editando}
                onClick={() => setEditando(e => !e)}
              >
                {editando ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <PencilSimple size={15} aria-hidden="true" />
                )}
                {editando ? 'Pronto' : 'Editar cores'}
              </Botao>
            ) : null}
          </div>

          {editando && !ficha ? (
            <p className="es-cor-dica">Clique na cor que você quer editar.</p>
          ) : null}

          <div className="es-novo-chips">
            {bloco.cores.map(c => {
              const ja = jaTem.has(c.id)
              const fixa = c.grupo === GRUPO_DA_SUBLIMACAO
              if (editando) {
                return (
                  <Chip
                    key={c.id}
                    ligado={ficha?.id === c.id}
                    disabled={fixa}
                    className={fixa ? 'es-ja-tem' : 'es-chip-editar'}
                    title={
                      fixa ? 'A sublimação não é cor de malha, e não se edita aqui' : undefined
                    }
                    onClick={() => {
                      setFalha('')
                      setFicha({
                        id: c.id,
                        nome: c.nome,
                        hex: c.hex,
                        grupo: familiaDaCor(c, familias),
                        antes: c.nome,
                      })
                    }}
                  >
                    <Bola cor={c.hex} pequena />
                    {c.nome}
                    {fixa ? null : <PencilSimple size={14} aria-hidden="true" />}
                  </Chip>
                )
              }
              return (
                <Chip
                  key={c.id}
                  ligado={valor === c.id}
                  disabled={ja}
                  className={ja ? 'es-ja-tem' : ''}
                  onClick={() => aoEscolher(c.id)}
                >
                  <Bola cor={c.hex} pequena />
                  {c.nome}
                </Chip>
              )
            })}
            {podeMexer && !editando ? (
              <Chip
                className="es-chip-nova"
                ligado={!!ficha && !ficha.id}
                onClick={() => {
                  setFalha('')
                  setFicha({ id: null, nome: '', hex: '', grupo: bloco.cod, antes: '' })
                }}
              >
                <Plus size={15} aria-hidden="true" />
                Nova cor
              </Chip>
            ) : null}
            {!bloco.cores.length && !podeMexer ? (
              <span className="es-cor-dica">Nenhuma cor nesta família.</span>
            ) : null}
          </div>
        </>
      )}

      {ficha ? (
        <div
          className="es-cor-ficha"
          data-ficha-da-cor={ficha.id ? 'editar' : 'nova'}
          ref={caixaDaFicha}
        >
          <b className="es-cor-ficha-titulo">
            {ficha.id ? 'Editar ' + ficha.antes : 'Nova cor em ' + (bloco?.nome ?? 'Outras')}
          </b>
          <div className="es-cor-ficha-campos">
            <span
              className={hexLimpo ? 'es-bola es-amostra' : 'es-bola es-amostra sem-cor'}
              style={hexLimpo ? ({ '--bola': hexLimpo } as CSSProperties) : undefined}
              aria-hidden="true"
            />
            <label className="campo">
              <span>Nome da cor</span>
              <Entrada
                value={ficha.nome}
                onChange={e => setFicha({ ...ficha, nome: e.currentTarget.value })}
                placeholder="Azul Bic"
                aria-invalid={repetida}
              />
            </label>
            <label className="campo">
              <span>Cor, em hexadecimal</span>
              <Entrada
                value={ficha.hex}
                maxLength={7}
                onChange={e => setFicha({ ...ficha, hex: e.currentTarget.value })}
                placeholder="#1E46B4"
                aria-invalid={!!ficha.hex.trim() && !hexLimpo}
              />
            </label>
          </div>
          <div className="campo">
            <span>Família</span>
            <Seletor
              campo
              bloco
              valor={ficha.grupo}
              comBusca={false}
              /* a opção vazia do seletor é a "Outras": cor sem família */
              vazio="Outras (sem família)"
              opcoes={familias
                .filter(f => f.cod !== GRUPO_DA_SUBLIMACAO && f.cod !== FAMILIA_OUTRAS)
                .map(f => ({ valor: f.cod, rotulo: f.nome }))}
              aoEscolher={g => setFicha({ ...ficha, grupo: g || FAMILIA_OUTRAS })}
            />
          </div>
          {repetida ? (
            <p className="es-cor-ficha-nota erro">Já existe uma cor com esse nome no catálogo.</p>
          ) : ficha.hex.trim() && !hexLimpo ? (
            <p className="es-cor-ficha-nota erro">
              O hexadecimal é # e seis dígitos, como #1E46B4.
            </p>
          ) : mudouONome ? (
            <p className="es-cor-ficha-nota">
              O nome antigo continua escrito nos pedidos e nos materiais que já existem. Um pedido
              com o nome antigo não acha mais esta cor quando as reservas forem refeitas.
            </p>
          ) : (
            <p className="es-cor-ficha-nota">
              A cor vale para o sistema inteiro: é o mesmo catálogo de Configurações, Banco de
              dados, Cores de tecido.
            </p>
          )}
          {falha ? <Aviso tom="brand">{falha}</Aviso> : null}
          <div className="fileira fim">
            <Botao tamanho="sm" onClick={sairDaFicha} disabled={gravando}>
              Cancelar
            </Botao>
            {/* preto, e não vermelho: o vermelho da caixa é o "Criar material" */}
            <Botao
              tom="forte"
              tamanho="sm"
              onClick={gravar}
              disabled={!podeGravar}
              carregando={gravando}
            >
              {ficha.id ? 'Salvar a cor' : 'Adicionar a cor'}
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  )
}
