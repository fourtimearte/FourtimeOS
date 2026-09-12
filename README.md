# Fourtime OS

CRM, ERP, cotação de venda, ficha de produção, kanban de produção e estoque da Fourtime.

## Rodar

```
npm install
npm run dev
```

Abre em http://localhost:5173

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | travas de arquitetura, conferência de tipos e build de produção |
| `npm run arquitetura` | só as travas de arquitetura |
| `npm run preview` | serve o build local |
| `npm run lint` | ESLint |
| `npm run fmt` | Prettier em tudo |
| `npm run visual` | teste visual do `/kit`, foto por foto |
| `npm run visual:aprovar` | adota as fotos novas como as aprovadas |

## A regra que organiza o código

A direção das importações só corre para baixo, e **nunca** para os lados:

```
src/modules/     clientes, cotacao, funil, ficha, kanban, estoque
   ↓ pode importar
src/dominio/     layout: o tipo Layout, a grade, a combo de referência, os menus, a folha A4
   ↓ pode importar
src/shared/      sessão, supabase, rotas, formatadores
   ↓ pode importar
src/ds/          o Design System V7: tokens e componentes
```

Três consequências, e são elas que evitam que mexer numa parte quebre outra:

1. **Um módulo só entra em outro pela porta da frente.** Se a cotação precisa de cliente, ela
   importa o `index.ts` do módulo de clientes, e nada mais. O que está dentro da pasta é privado,
   então mexer por dentro do kanban nunca quebra o estoque: ninguém de fora estava olhando para
   dentro. Quando dois módulos precisam da mesma regra, ela sobe para `dominio/`.
2. **O `ds/` não conhece o domínio.** Ele não sabe o que é pedido, cliente ou fatia de produção. É
   isso que faz ser impossível mexer numa tela e torcer um botão.
3. **Cada módulo tem um lugar só que fala com o banco**, o `api.ts` dele. Mudança de schema toca um
   arquivo.

### A regra é cobrada, não combinada

O `.dependency-cruiser.cjs` verifica tudo isso dentro do `npm run build`, que é o mesmo comando que
o Cloudflare roda para publicar. Import na direção errada não vira aviso: vira build quebrado, e o
site não sobe. Cada regra tem um texto explicando por que ela existe, então o erro diz o que fazer.

Para conferir antes de subir: `npm run arquitetura`.

## Atalhos de importação

`@ds/…`, `@dominio/…`, `@shared/…`, `@modules/…`

## Onde estão as decisões

No projeto do Claude, em `claude/`:

- `PASSOS-E-ARQUITETURA.md` o passo a passo e a arquitetura
- `DESIGN-SYSTEM-V7.md` o contrato visual
- `DECISAO-COTACAO-E-FICHA-DOIS-EDITORES.md` por que são dois editores
- `REGRA-VERSAO-E-PROTOTIPO.md` a regra de versão do editor

## O teste visual

`testes/LEIA.md` explica. Em resumo: uma foto de cada seção do `/kit` nos dois
temas, comparada com as aprovadas em `testes/fotos/`. Mexeu num token sem querer,
o teste reprova e pinta de vermelho onde mudou.

## Estado

O que já existe:

- tela de entrada em `/entrar`, com sessão provisória no navegador
- os tokens do Design System V7 e a página viva em `/kit`, com Gelo e Grafite
- os componentes base, incluindo os cinco menus do módulo de layout
- as travas de arquitetura cobradas no build
- o teste visual do `/kit`, do início e da tela de clientes
- a casca do app: menu lateral, barra do celular, busca global, troca de tema
- a tela de clientes, com busca, filtros, KPIs clicáveis, ordenação e paginação

Falta o passo 7, o Supabase, que precisa de conta e chaves. Enquanto ele não
entra, o dado de cliente vem de `dominio/cliente/repositorio.ts`, que é o único
arquivo que muda quando o banco chegar.

No ar em https://fourtimeos.arte-adc.workers.dev
