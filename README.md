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
| `npm run build` | conferência de tipos e build de produção |
| `npm run preview` | serve o build local |
| `npm run lint` | ESLint |
| `npm run fmt` | Prettier em tudo |

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

1. **Um módulo nunca importa outro módulo.** Se a cotação precisa de cliente, entra pela porta da
   frente, o `index.ts` do módulo de clientes, e por nada mais. O que está dentro é privado.
2. **O `ds/` não conhece o domínio.** Ele não sabe o que é pedido, cliente ou fatia de produção. É
   isso que faz ser impossível mexer numa tela e torcer um botão.
3. **Cada módulo tem um lugar só que fala com o banco**, o `api.ts` dele. Mudança de schema toca um
   arquivo.

No passo 4 essa regra passa a ser cobrada pelo `dependency-cruiser` no CI, e um import proibido
falha o build. Até lá ela vale por combinado.

## Atalhos de importação

`@ds/…`, `@dominio/…`, `@shared/…`, `@modules/…`

## Onde estão as decisões

No projeto do Claude, em `claude/`:

- `PASSOS-E-ARQUITETURA.md` o passo a passo e a arquitetura
- `DESIGN-SYSTEM-V7.md` o contrato visual
- `DECISAO-COTACAO-E-FICHA-DOIS-EDITORES.md` por que são dois editores
- `REGRA-VERSAO-E-PROTOTIPO.md` a regra de versão do editor

## Estado

Passo 2 de 22: repositório e esqueleto. O sistema abre com uma tela provisória.
