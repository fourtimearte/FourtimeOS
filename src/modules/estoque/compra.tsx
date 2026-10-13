import { useMemo } from 'react'
import { Copy, ShoppingCart, WhatsappLogo } from '@phosphor-icons/react'
import { Botao, Modal, TituloCartao, Vazio, avisar } from '@ds'
import { EMPRESA } from '@dominio/empresa'
import { compraSugerida, quantoNaUnidade, textoDaCompra, type CompraDoFornecedor, type Material } from '@dominio/estoque'
import { fornecedorDoMaterial, plural, type Fornecimento } from './apoio'
import { Bola } from './vao'

/* ==========================================================================
   A COMPRA SUGERIDA POR FORNECEDOR (12/10/2026; FOURTIME OS - 12, 4.4 item 5).

   A coluna Para comprar ja dizia o que esta abaixo do minimo. Aqui a mesma
   lista se separa por quem vende, com quanto comprar para voltar ao minimo, e
   cada fornecedor ganha o pedido pronto: copiar o texto, ou abrir o WhatsApp
   quando o contato dele tem telefone. Nada e gravado: a compra acontece fora,
   e a entrada continua sendo o Registrar movimento, quando o material chega.
   ========================================================================== */

/** o telefone do contato, com o 55 na frente, ou vazio */
function telefoneDoContato(contato: string): string {
  const n = (contato.match(/\(?\d{2}\)?\s*9?\s*\d{4}[\s-]?\d{4}/)?.[0] ?? '').replace(/\D/g, '')
  if (n.length < 10) return ''
  return n.startsWith('55') && n.length >= 12 ? n : '55' + n
}

export function CompraSugerida({
  aberto,
  abaixo,
  fornecimento,
  aoFechar,
  aoEscolher,
}: {
  aberto: boolean
  abaixo: Material[]
  fornecimento: Fornecimento
  aoFechar: () => void
  /** abre o material, para escolher o fornecedor de quem nao tem */
  aoEscolher: (m: Material) => void
}) {
  const grupos = useMemo(
    () =>
      compraSugerida(abaixo, (m) => {
        const f = fornecedorDoMaterial(m, fornecimento)
        return f ? { id: f.id, nome: f.nome, contato: f.contato } : null
      }),
    [abaixo, fornecimento],
  )

  async function copiar(g: CompraDoFornecedor) {
    try {
      await navigator.clipboard.writeText(textoDaCompra(g, EMPRESA.nome || 'Fourtime'))
      avisar('Pedido de ' + (g.fornecedor || 'compra') + ' copiado.', 'ok')
    } catch {
      avisar('O navegador não deixou copiar. Selecione o texto e copie à mão.', 'warn')
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Compra sugerida" largo>
      {!grupos.length ? (
        <Vazio titulo="Nada para comprar" texto="Nenhum material está abaixo do mínimo." />
      ) : (
        <div className="pilha">
          <p className="es-compra-nota">
            O que falta para cada material voltar ao mínimo, arredondado para cima, separado por
            quem vende. Nada é gravado aqui: quando chegar, registre a entrada.
          </p>
          {grupos.map((g) => {
            const fone = g.fornecedorId ? telefoneDoContato(g.contato) : ''
            return (
              <section key={g.fornecedorId || 'sem'} className="cartao es-compra-grupo" aria-label={g.fornecedor || 'Sem fornecedor'}>
                <header className="es-compra-cab">
                  <TituloCartao icone={ShoppingCart}>{g.fornecedor || 'Sem fornecedor'}</TituloCartao>
                  <span className="es-compra-conta">{plural(g.itens.length, 'material', 'materiais')}</span>
                </header>
                <ul className="es-compra-lista">
                  {g.itens.map((i) => (
                    <li key={i.material.id} className="es-compra-item">
                      <Bola cor={i.material.corHex} />
                      <span className="es-compra-nome">
                        <b>{i.material.nome}</b>
                        <small>
                          tem {quantoNaUnidade(i.material.livre, i.material.unidade)} · mínimo{' '}
                          {quantoNaUnidade(i.material.minimo, i.material.unidade)}
                        </small>
                      </span>
                      <b className="es-compra-qtd">{quantoNaUnidade(i.comprar, i.material.unidade)}</b>
                      {!g.fornecedorId ? (
                        <Botao tamanho="sm" tom="limpo" onClick={() => aoEscolher(i.material)}>
                          Escolher fornecedor
                        </Botao>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {g.fornecedorId ? (
                  <footer className="es-compra-pe">
                    <Botao tom="contorno" tamanho="sm" onClick={() => void copiar(g)}>
                      <Copy size={16} />
                      Copiar o pedido
                    </Botao>
                    {fone ? (
                      <Botao
                        tom="contorno"
                        tamanho="sm"
                        onClick={() =>
                          window.open(
                            'https://wa.me/' + fone + '?text=' + encodeURIComponent(textoDaCompra(g, EMPRESA.nome || 'Fourtime')),
                            '_blank',
                            'noopener',
                          )
                        }
                      >
                        <WhatsappLogo size={16} />
                        Mandar no WhatsApp
                      </Botao>
                    ) : null}
                  </footer>
                ) : (
                  <p className="es-compra-nota">Sem fornecedor ligado, não dá para montar o pedido. Escolha na ficha do material.</p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
