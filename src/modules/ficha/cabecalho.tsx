import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import { CampoDeData, Flutuante, Seletor } from '@ds'
import { DEPARTAMENTOS, EMBALAGENS, ENTREGAS, PAGAMENTOS, VENDEDORES } from '@dominio/banco'
import { EMPRESA } from '@dominio/empresa'
import {
  COR_DA_MARCA,
  MARCAS,
  formataPedido,
  mascaraDeDocumento,
  nomeEspelhado,
  type CabecalhoDaFicha,
} from '@dominio/ficha'
import './ficha.css'

/* ==========================================================================
   O cabeçalho da ficha.

   Quatro colunas por três fileiras, como na v3.375. A coluna 1 é da marca: a
   logo em cima, o CNPJ da Fourtime no meio, e as marcas do documento embaixo,
   atrás do mais.

   O rótulo fica EM CIMA do valor, e não ao lado. Com o rótulo ao lado,
   Cliente, CPF e Pagamento cortavam com reticência nas telas estreitas do
   galpão, e o que some numa reticência é sempre o fim, que é onde mora o
   dígito verificador.

   As três fileiras têm a mesma altura de propósito: a altura do cabeçalho não
   depende do que foi digitado, e por isso a folha impressa não muda de quebra
   quando alguém escreve um nome comprido.
   ========================================================================== */

const emOpcoes = (lista: string[]) => lista.map((x) => ({ valor: x, rotulo: x }))

const LISTAS: Record<string, string[]> = {
  vendedor: VENDEDORES,
  departamento: DEPARTAMENTOS,
  entrega: ENTREGAS,
  embalagem: EMBALAGENS,
  pagamento: PAGAMENTOS,
}

export function CabecalhoDaProducao({
  cab,
  aoMudar,
  totalDePecas,
  totalEmReais,
  comDinheiro,
  leitura,
}: {
  cab: CabecalhoDaFicha
  aoMudar: (parte: Partial<CabecalhoDaFicha>) => void
  totalDePecas: number
  totalEmReais: number
  comDinheiro: boolean
  leitura?: boolean
}) {
  const [menuDeMarcas, setMenuDeMarcas] = useState(false)
  const btMarcas = useRef<HTMLButtonElement>(null)

  const campoDeMenu = (campo: keyof CabecalhoDaFicha, rotulo: string, classe = 'fc-campo') => (
    <div className={classe}>
      <span className="fc-rot">{rotulo}</span>
      {leitura ? (
        <span className="fc-val">{String(cab[campo] || '') || '-'}</span>
      ) : (
        <Seletor
          campo
          bloco
          tamanho="sm"
          valor={String(cab[campo] || '')}
          opcoes={emOpcoes(LISTAS[campo] ?? [])}
          vazio="Selecione..."
          aoEscolher={(v) => aoMudar({ [campo]: v } as Partial<CabecalhoDaFicha>)}
        />
      )}
    </div>
  )

  return (
    <div className="fc-cab">
      {/* --- coluna 1: a marca, o CNPJ e as marcas do documento --- */}
      <div className="fc-marca">
        <span className="fc-logo">FOURTIME</span>
      </div>

            {/* --- fileira 1 --- */}
      <div className="fc-campo">
        <span className="fc-rot">Cliente</span>
        {leitura ? (
          <span className="fc-val">{cab.cliente || '-'}</span>
        ) : (
          <input
            className="fc-entrada"
            value={cab.cliente}
            placeholder="Selecione ou digite..."
            onChange={(e) =>
              aoMudar({
                cliente: e.target.value,
                nome: nomeEspelhado(cab.nome, cab.cliente, e.target.value),
              })
            }
          />
        )}
      </div>

      <div className="fc-campo">
        <span className="fc-rot">CPF / CNPJ</span>
        {leitura ? (
          <span className="fc-val">{cab.documento || '-'}</span>
        ) : (
          <input
            className="fc-entrada"
            inputMode="numeric"
            value={cab.documento}
            placeholder="-"
            onChange={(e) => aoMudar({ documento: mascaraDeDocumento(e.target.value) })}
          />
        )}
      </div>

      <div className="fc-campo meia">
        <span className="fc-rot">Pedido nº</span>
        {leitura ? (
          <span className="fc-val">{cab.pedido || '-'}</span>
        ) : (
          <input
            className="fc-entrada"
            inputMode="numeric"
            value={cab.pedido}
            placeholder="PD000000"
            onChange={(e) => aoMudar({ pedido: e.target.value })}
            /* a formatação acontece ao SAIR do campo. Formatar a cada tecla
               joga o cursor para o fim, e quem estava corrigindo o meio do
               número perde o lugar */
            onBlur={(e) => aoMudar({ pedido: formataPedido(e.target.value) })}
          />
        )}
      </div>

      <div className="fc-campo meia">
        <span className="fc-rot">Envio</span>
        {leitura ? (
          <span className="fc-val">{cab.envio || '-'}</span>
        ) : (
          <CampoDeData bloco valor={cab.envio} aoMudar={(iso) => aoMudar({ envio: iso })} />
        )}
      </div>

      {/* --- fileira 2: a coluna 1 e o CNPJ --- */}
      <div className="fc-cnpj">
        <span className="fc-rot">CNPJ</span>
        <span className="fc-cnpj-num">{EMPRESA.cnpj}</span>
      </div>

      {campoDeMenu('vendedor', 'Vendedor')}
      {campoDeMenu('departamento', 'Departamento')}
      {campoDeMenu('entrega', 'Entrega')}

      {/* --- fileira 3: a coluna 1 sao as marcas do documento --- */}
<div className="fc-marcas">
        {cab.marcas.map((m) => (
          <span
            key={m}
            className="fc-selo"
            style={{ '--c': COR_DA_MARCA[m] ?? 'var(--brand)' } as CSSProperties}
          >
            {m}
            {leitura ? null : (
              <button
                type="button"
                aria-label={'Tirar a marca ' + m}
                onClick={() => aoMudar({ marcas: cab.marcas.filter((x) => x !== m) })}
              >
                <X size={11} weight="bold" />
              </button>
            )}
          </span>
        ))}
        {leitura || cab.marcas.length >= MARCAS.length ? null : (
          <button
            type="button"
            ref={btMarcas}
            className="fc-mais"
            title="Marcar o documento"
            aria-label="Marcar o documento"
            onClick={() => setMenuDeMarcas((a) => !a)}
          >
            <Plus size={13} weight="bold" />
          </button>
        )}
      </div>

      {campoDeMenu('embalagem', 'Embalagem')}
      {campoDeMenu('pagamento', 'Pagamento')}

      <div className="fc-campo fc-caixa-total">
        <span className="fc-rot">Total</span>
        <span className="fc-tot">
          <b>{totalDePecas.toLocaleString('pt-BR')}</b>
          <small>pç</small>
          {comDinheiro ? (
            <>
              <i aria-hidden="true" />
              <b>
                {totalEmReais.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </b>
            </>
          ) : null}
        </span>
      </div>

      <Flutuante aberto={menuDeMarcas} ancora={btMarcas} aoFechar={() => setMenuDeMarcas(false)}>
        <div className="fc-menu-marcas">
          {MARCAS.filter((m) => !cab.marcas.includes(m)).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                aoMudar({ marcas: [...cab.marcas, m] })
                setMenuDeMarcas(false)
              }}
            >
              <i style={{ background: COR_DA_MARCA[m] }} />
              {m}
            </button>
          ))}
        </div>
      </Flutuante>
    </div>
  )
}
