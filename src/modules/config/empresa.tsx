import { useState } from 'react'
import { Aviso, Botao, Campo, Cartao, Entrada, Pagina, TituloCartao, avisar } from '@ds'
import {
  CAMPOS_DO_DOCUMENTO,
  EMPRESA,
  camposEmBranco,
  mascaraDeCep,
  mascaraDeCnpj,
  mascaraDeTelefone,
  salvarEmpresa,
  type DadosDaEmpresa,
} from '@dominio/empresa'
import { AbasDaConfig } from './abas'
import './config.css'

/* ==========================================================================
   Os dados da fábrica, agora preenchidos aqui.

   Eles saem impressos no rodapé de toda folha, no cabeçalho do PDF que o
   cliente recebe e na ficha que vai para o galpão. Até ontem moravam num
   arquivo do código e esta tela só mostrava; agora ela grava.

   OS CAMPOS QUE SAEM NO PAPEL SÃO COBRADOS, E OS OUTROS NÃO. Um endereço em
   branco no rodapé de um orçamento é o tipo de erro que só aparece depois de
   o cliente receber, e por isso ele fica marcado em vermelho até ser
   preenchido. Inscrição estadual e e-mail não estão no papel hoje: cobrá-los
   junto ensinaria a ignorar o aviso inteiro.

   A MÁSCARA MORA NO DOMÍNIO, e não aqui. O formato do CNPJ e do CEP é do
   dado: um arquivo importado amanhã tem que passar pela mesma régua que o
   campo digitado hoje.
   ========================================================================== */

const ROTULOS: Record<keyof DadosDaEmpresa, string> = {
  nome: 'Nome',
  razaoSocial: 'Razão social',
  descricao: 'Descrição',
  cnpj: 'CNPJ',
  inscricaoEstadual: 'Inscrição estadual',
  endereco: 'Endereço',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
  cep: 'CEP',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  site: 'Site',
}

export function TelaEmpresa() {
  const [d, setD] = useState<DadosDaEmpresa>({ ...EMPRESA })
  const [sujo, setSujo] = useState(false)

  const mudar = (parte: Partial<DadosDaEmpresa>) => {
    setD((x) => ({ ...x, ...parte }))
    setSujo(true)
  }

  const faltando = camposEmBranco(d)
  const noPapel = (k: keyof DadosDaEmpresa) => CAMPOS_DO_DOCUMENTO.includes(k)

  function gravar() {
    salvarEmpresa(d)
    setSujo(false)
    avisar('Dados da empresa salvos', 'ok')
  }

  /* o campo, com a dica de onde ele aparece e o aviso de que está em branco */
  const campo = (
    k: keyof DadosDaEmpresa,
    opcoes?: { largo?: boolean; estreito?: boolean; mascara?: (v: string) => string; dica?: string },
  ) => (
    <Campo
      rotulo={ROTULOS[k]}
      dica={opcoes?.dica ?? (noPapel(k) ? 'sai no documento impresso' : undefined)}
      className={opcoes?.largo ? 'col-2' : opcoes?.estreito ? 'estreito' : undefined}
    >
      <Entrada
        value={d[k]}
        placeholder={noPapel(k) ? 'precisa ser preenchido' : ''}
        onChange={(e) =>
          mudar({ [k]: opcoes?.mascara ? opcoes.mascara(e.target.value) : e.target.value } as Partial<DadosDaEmpresa>)
        }
      />
    </Campo>
  )

  return (
    <Pagina
      acima="Configurações"
      titulo="Empresa"
      sub="O que vai impresso no rodapé da folha, no cabeçalho do PDF do cliente e na ficha da produção."
      acoes={
        <Botao tom="primario" onClick={gravar} disabled={!sujo}>
          {sujo ? 'Salvar' : 'Salvo'}
        </Botao>
      }
    >
      <AbasDaConfig atual="empresa" />

      {faltando.length ? (
        <Aviso
          tom="brand"
          titulo={
            faltando.length === 1
              ? 'Falta 1 campo que sai no documento'
              : 'Faltam ' + faltando.length + ' campos que saem no documento'
          }
        >
          {faltando.map((k) => ROTULOS[k]).join(', ')}. Enquanto estiverem em branco, eles saem
          como um buraco no documento que o cliente recebe.
        </Aviso>
      ) : null}

      <Cartao>
        <TituloCartao>Quem é a empresa</TituloCartao>
        <div className="cfg-grade">
          {campo('nome')}
          {campo('descricao', { largo: true })}
          {campo('razaoSocial', { largo: true })}
          {campo('cnpj', { mascara: mascaraDeCnpj })}
          {campo('inscricaoEstadual')}
        </div>
      </Cartao>

      <Cartao>
        <TituloCartao>Onde ela fica</TituloCartao>
        <div className="cfg-grade">
          {campo('endereco', { largo: true })}
          {campo('bairro')}
          {campo('cep', { mascara: mascaraDeCep })}
          {campo('cidade')}
          {campo('uf', { estreito: true })}
        </div>
      </Cartao>

      <Cartao>
        <TituloCartao>Como falam com ela</TituloCartao>
        <div className="cfg-grade">
          {campo('telefone', { mascara: mascaraDeTelefone })}
          {campo('whatsapp', { mascara: mascaraDeTelefone })}
          {campo('email')}
          {campo('site')}
        </div>
        <p className="cfg-nada">
          Hoje estes dados ficam gravados neste navegador. Quando a tabela da empresa entrar no
          banco, eles passam a valer para todo mundo da fábrica, e este arquivo é o único que
          muda: quem imprime continua lendo do mesmo lugar.
        </p>
      </Cartao>
    </Pagina>
  )
}
