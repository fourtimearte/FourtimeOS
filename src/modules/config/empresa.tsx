import { Aviso, Cartao, Pagina, Selo, TituloCartao } from '@ds'
import { EMPRESA, EMPRESA_A_CONFERIR } from '@dominio/empresa'
import { AbasDaConfig } from './abas'
import './config.css'

/* ==========================================================================
   Os dados da fábrica.

   Eles saem impressos no rodapé de toda folha e no cabeçalho do PDF que vai
   para o cliente. Hoje moram num arquivo do código, e por isso esta tela é de
   leitura: mostrar um campo editável que não grava seria pior que mostrar o
   valor como ele é.

   O que ela faz de útil é a única coisa que importa agora: apontar, em
   vermelho, os campos que ainda são molde. Endereço "a conferir" no rodapé de
   um orçamento é o tipo de erro que só aparece depois de o cliente receber.
   ========================================================================== */

const CAMPOS: { rotulo: string; valor: string }[] = [
  { rotulo: 'Nome', valor: EMPRESA.nome },
  { rotulo: 'Descrição', valor: EMPRESA.descricao },
  { rotulo: 'CNPJ', valor: EMPRESA.cnpj },
  { rotulo: 'Endereço', valor: EMPRESA.endereco },
  { rotulo: 'Cidade', valor: `${EMPRESA.cidade} · ${EMPRESA.uf}` },
  { rotulo: 'Telefone', valor: EMPRESA.telefone },
  { rotulo: 'Site', valor: EMPRESA.site },
]

export function TelaEmpresa() {
  const faltando = CAMPOS.filter((c) => c.valor === 'a conferir')

  return (
    <Pagina
      acima="Configurações"
      titulo="Empresa"
      sub="O que vai impresso no rodapé da folha e no cabeçalho do PDF do cliente."
    >
      <AbasDaConfig atual="empresa" />

      {EMPRESA_A_CONFERIR ? (
        <Aviso tom="brand" titulo={`${faltando.length} campos ainda são molde`}>
          Enquanto estiverem assim, eles saem escritos "a conferir" no documento que o cliente
          recebe. Me passe os valores de verdade e eu troco.
        </Aviso>
      ) : null}

      <Cartao>
        <TituloCartao>Dados da fábrica</TituloCartao>
        <dl className="cfg-dados">
          {CAMPOS.map((c) => (
            <div key={c.rotulo}>
              <dt>{c.rotulo}</dt>
              <dd>
                {c.valor === 'a conferir' ? <Selo tom="brand">a conferir</Selo> : c.valor}
              </dd>
            </div>
          ))}
        </dl>
        <p className="cfg-nada">
          Estes campos moram no código hoje, e por isso a tela só mostra. Eles ficam editáveis
          quando a tabela da empresa entrar no banco, junto com logo e dados bancários.
        </p>
      </Cartao>
    </Pagina>
  )
}
