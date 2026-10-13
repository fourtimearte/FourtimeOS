# Publicar a extensão Fourtime OS na Chrome Web Store (não listada)

Preparado em 12/10/2026. Decisão de 11/10/2026: a extensão vai para a Chrome
Web Store como NÃO LISTADA, na conta arte@fourtimefit.com.br. Só quem tem o
link acha; ela se atualiza sozinha nos computadores dos vendedores.

## O que só o Henrique faz

1. Criar a conta de desenvolvedor em https://chrome.google.com/webstore/devconsole
   com arte@fourtimefit.com.br (a Google cobra uma taxa única de cadastro).
2. Subir o pacote `fourtime-os-<versão>-loja.zip` (o Claude gera; abaixo).
3. Colar os textos e as imagens desta pasta nos campos da loja.
4. Em Visibilidade, escolher **Não listado**.
5. Mandar para revisão. A Google revisa também as não listadas.

## O pacote

```
LOJA=1 VITE_SUPABASE_URL=https://uwbniyqixpwacnwybfis.supabase.co VITE_SUPABASE_ANON_KEY=<a chave publicável> sh extensao/empacotar.sh
```

Sai `dist-extensao/fourtime-os-<versão>-loja.zip`, com o manifest.json na raiz
e sem os endereços de teste (127.0.0.1 e localhost). Cada versão nova sobe com
o número de versão maior no manifest.json.

## Os textos

**Nome:** Fourtime OS

**Resumo (até 132 caracteres):**
O WhatsApp Web do vendedor dentro do Fourtime OS, o sistema interno da Fourtime, com o lead da conversa ao lado.

**Descrição:**
Ferramenta interna da Fourtime Arte Esportiva para a equipe de vendas.

Com a extensão, a página Funil e WhatsApp do Fourtime OS abre o WhatsApp Web do próprio vendedor dentro do sistema, com as cores do Fourtime OS, e mostra ao lado o lead ou o cliente da conversa aberta: etapa do funil, vendedor, há quanto tempo o cliente espera, a cotação e o pedido que veio do site.

Na aba comum do WhatsApp Web, a extensão abre uma coluna lateral com o mesmo resumo do lead.

Funciona só para quem tem conta aprovada no Fourtime OS. Não é feita, mantida nem endossada pelo WhatsApp ou pela Meta.

**Categoria:** Ferramentas (ou Comunicação)

**Idioma:** Português (Brasil)

**Política de privacidade (endereço):**
https://fourtimeos.arte-adc.workers.dev/privacidade-extensao.html

## A finalidade única (campo "Single purpose")

Mostrar o WhatsApp Web do vendedor dentro do sistema interno Fourtime OS e, ao lado da conversa aberta, o lead ou o cliente daquele telefone no sistema.

## Por que cada permissão (campos de justificativa)

- **sidePanel:** a coluna lateral com o lead da conversa aberta, na aba comum do WhatsApp Web.
- **storage:** guardar a sessão de quem entrou na coluna lateral e o número da conversa aberta (este só durante a sessão do navegador).
- **tabs:** achar a aba do WhatsApp Web para abrir a conversa que o vendedor escolheu no Fourtime OS, e ligar a coluna lateral só na aba do WhatsApp.
- **declarativeNetRequest:** permitir que o WhatsApp Web apareça dentro das páginas do Fourtime OS (e só delas), retirando para esse quadro os cabeçalhos que impedem a página de ser mostrada dentro de outra.
- **alarms:** a cada 30 segundos, conferir se o arquivo da própria extensão mudou de versão (só tem efeito quando ela é carregada de uma pasta, no computador de quem desenvolve; instalada pela loja, a versão nunca muda por ali).
- **scripting:** depois de a extensão ser atualizada, religar as abas do Fourtime OS que já estavam abertas e recarregar o WhatsApp Web dentro delas, para o código novo valer sem a pessoa recarregar o sistema.
- **Acesso a web.whatsapp.com:** aplicar as cores do sistema e ler o número da conversa aberta (o texto das mensagens não é lido).
- **Acesso a *.supabase.co:** consultar no banco do Fourtime OS o lead daquele telefone, com as permissões de quem entrou.
- **Acesso a fourtimeos.arte-adc.workers.dev:** avisar o sistema de que a extensão está instalada e receber o pedido de abrir uma conversa.
- **Código remoto:** não usa. Todo o código vai no pacote.

## Uso de dados (formulário da loja)

- Coleta: "Informações de identificação pessoal" NÃO; "Comunicações pessoais": o número de telefone da conversa aberta, usado só para achar o lead (marcar se o formulário perguntar sobre dados de contato); "Autenticação": a sessão do Fourtime OS na coluna lateral.
- Marcar as três declarações: não vende dados a terceiros; não usa nem transfere dados para fins não relacionados à finalidade única; não usa para avaliar crédito ou empréstimo.

## As imagens desta pasta

| Arquivo | Para quê | Tamanho |
|---|---|---|
| `../icone.png` | ícone da loja | 128 × 128 |
| `tela-1-funil.png` | captura de tela 1: o funil | 1280 × 800 |
| `tela-2-whatsapp-dentro.png` | captura de tela 2: o WhatsApp dentro do sistema (do wireframe 131; trocar por uma foto da tela de verdade quando der, sem conversa pessoal) | 1280 × 800 |
| `promo-440x280.png` | bloco promocional pequeno | 440 × 280 |

## O risco da revisão

A permissão declarativeNetRequest tira, só nas abas do Fourtime OS, a proteção
do WhatsApp Web contra ser aberto dentro de outra página. A revisão da Google
pode perguntar ou recusar por isso. Se recusar, a extensão continua instalável
por "Carregar sem compactação", como hoje, e a coluna lateral (sem o
WhatsApp dentro do sistema) pode ir sozinha para a loja.
