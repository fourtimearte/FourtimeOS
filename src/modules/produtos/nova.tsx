import { useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Entrada, Modal, Segmentado, Seletor, avisar } from '@ds'
import { criarReferencia } from '@dominio/banco'
import {
  NOME_DO_GENERO,
  carregarFicha,
  carregarMolde,
  copiarFicha,
  montarCodigo,
  proximoNumero,
  salvarFicha,
  salvarMolde,
  type GrupoDeReferencia,
  type ReferenciaNaFicha,
} from '@dominio/produto'

/* ==========================================================================
   Nova referência, e duplicar uma que existe.

   O CÓDIGO NASCE AQUI E NÃO MUDA MAIS: FT, o grupo, o número e o gênero. O
   número já vem com o primeiro livre do grupo, e a caixa avisa se o código
   que está se formando já é de outra peça.

   DUPLICAR É CRIAR OUTRA PEÇA COM A FICHA DESTA: as medidas, as partes, o
   tecido, os aviamentos e o molde vão junto, e a pessoa ajusta o que muda.
   É o caminho para a variação (a mesma camiseta com gola V) e para quem
   precisa de outro código.
   ========================================================================== */

/** o grupo dos kits não entra: kit se monta no editor de kit, com as peças dele */
const GRUPO_DOS_KITS = 'KIT'

type Genero = 'M' | 'F' | 'C' | 'U'
const GENEROS: Genero[] = ['M', 'F', 'C', 'U']
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function NovaReferencia({
  aberta,
  grupos,
  referencias,
  aoFechar,
  aoCriou,
}: {
  /** nulo: fechada. Com `de`: duplicando aquela peça. */
  aberta: { de?: ReferenciaNaFicha } | null
  grupos: GrupoDeReferencia[]
  referencias: ReferenciaNaFicha[]
  aoFechar: () => void
  aoCriou: (id: string) => Promise<void>
}) {
  const de = aberta?.de
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState('')
  const [numero, setNumero] = useState('')
  /* enquanto ninguém digita o número, ele acompanha o grupo */
  const [numeroNaMao, setNumeroNaMao] = useState(false)
  const [genero, setGenero] = useState<Genero>('M')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  const gruposDePeca = useMemo(() => grupos.filter(g => g.cod !== GRUPO_DOS_KITS), [grupos])

  useEffect(() => {
    if (!aberta) return
    const g = de?.grupo && de.grupo !== GRUPO_DOS_KITS ? de.grupo : ''
    setNome(de ? de.nome : '')
    setGrupo(g)
    setNumero(g ? proximoNumero(referencias, g) : '')
    setNumeroNaMao(false)
    setGenero(de && GENEROS.includes(de.genero as Genero) ? (de.genero as Genero) : 'M')
    setErro('')
    /* só a abertura arruma os campos: a lista muda por baixo e não pode apagar o que foi digitado */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta])

  /* mexeu em qualquer campo, o aviso do que faltava sai: ele era da tentativa anterior */
  useEffect(() => {
    setErro('')
  }, [nome, grupo, numero, genero])

  function trocarGrupo(g: string) {
    setGrupo(g)
    if (!numeroNaMao) setNumero(g ? proximoNumero(referencias, g) : '')
  }

  const cod = montarCodigo(grupo, numero, genero)
  const dona = cod ? referencias.find(r => r.cod === cod) : undefined

  async function criar() {
    if (!nome.trim()) return setErro('Dê um nome à peça.')
    if (!grupo) return setErro('Escolha o grupo da peça.')
    if (!cod) return setErro('Escreva o número da peça, de 0 a 999.')
    if (dona) return setErro(`O código ${cod} já é de ${dona.nome}.`)
    setCriando(true)
    setErro('')
    try {
      const nova = await criarReferencia({ cod, nome, grupo, genero })
      if (de) {
        /* a peça já existe: se a cópia da ficha falhar, ela fica em branco e a pessoa é avisada */
        try {
          const [ficha, molde] = await Promise.all([carregarFicha(de), carregarMolde(de.id)])
          await salvarFicha(nova.id, copiarFicha(ficha, nome.trim()))
          if (molde) await salvarMolde(nova.id, molde)
        } catch (e) {
          avisar(
            'A referência foi criada, mas a ficha não foi copiada: ' +
              (e instanceof Error ? e.message : 'tente copiar pelo editor.'),
            'warn',
            9,
          )
        }
      }
      avisar(`${nova.nome} criada, com o código ${nova.cod}.`, 'ok')
      await aoCriou(nova.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui criar a referência.')
    } finally {
      setCriando(false)
    }
  }

  return (
    <Modal
      aberto={!!aberta}
      aoFechar={aoFechar}
      titulo={de ? 'Duplicar ' + de.nome : 'Nova referência'}
      pe={
        <>
          <Botao onClick={aoFechar} disabled={criando}>
            Cancelar
          </Botao>
          <Botao tom="primario" carregando={criando} onClick={() => void criar()}>
            {de ? 'Criar a cópia' : 'Criar a referência'}
          </Botao>
        </>
      }
    >
      <div className="pilha larga" data-nova-referencia="">
        {de ? (
          <p className="pd-nota">
            A peça nova nasce com a ficha de {de.nome}: as medidas, o tecido, os aviamentos e o molde. O que
            for diferente você ajusta em seguida.
          </p>
        ) : null}
        <Campo rotulo="Nome da peça">
          <Entrada
            value={nome}
            maxLength={120}
            autoFocus
            placeholder="CAMISETA MASC TRAD GOLA V"
            onChange={e => setNome(e.currentTarget.value)}
          />
        </Campo>
        <div className="pd-campo">
          <span className="pd-campo-topo">Grupo</span>
          <Seletor
            campo
            bloco
            valor={grupo}
            vazio="Escolha o grupo"
            opcoes={gruposDePeca.map(g => ({ valor: g.cod, rotulo: `${g.cod} · ${g.nome}` }))}
            aoEscolher={trocarGrupo}
          />
        </div>
        <div className="pd-form">
          <Campo rotulo="Número" dica="Já vem o primeiro livre do grupo.">
            <Entrada
              value={numero}
              inputMode="numeric"
              maxLength={3}
              placeholder="000"
              onChange={e => {
                setNumero(e.currentTarget.value.replace(/\D/g, ''))
                setNumeroNaMao(true)
              }}
            />
          </Campo>
          <div className="pd-campo">
            <span className="pd-campo-topo">Gênero</span>
            <Segmentado
              valor={genero}
              aoMudar={setGenero}
              opcoes={GENEROS.map(g => ({ valor: g, rotulo: maiuscula(NOME_DO_GENERO[g]) }))}
            />
          </div>
        </div>
        <p className={erro || dona ? 'pd-nota pd-erro' : 'pd-nota'} role={erro || dona ? 'alert' : undefined}>
          {erro ? (
            erro
          ) : dona ? (
            `O código ${cod} já é de ${dona.nome}. Troque o número.`
          ) : cod ? (
            <>
              O código fica <b>{cod}</b>: grupo, número e gênero. Depois de criado ele não muda.
            </>
          ) : (
            'O código é montado com o grupo, o número e o gênero. Depois de criado ele não muda.'
          )}
        </p>
      </div>
    </Modal>
  )
}
