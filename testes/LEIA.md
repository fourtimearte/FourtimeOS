# O teste visual do /kit

## Para que serve

O Design System só vale enquanto ninguém o torce sem perceber. Este teste tira
uma foto de cada seção do `/kit`, nos dois temas, e compara com as fotos
aprovadas. Se alguém mexe num token e o botão muda de cor sem querer, o teste
reprova e mostra em qual seção, com o estrago pintado de vermelho.

## Como roda

```
npm run visual                          confere contra o site publicado
node testes/visual.mjs http://127.0.0.1:5173 && python3 testes/comparar.py
npm run visual:aprovar                  adota as fotos novas como as boas
```

Precisa do `playwright` e do Python com Pillow. O `playwright` **não** está nas
dependências do projeto de propósito: ele baixa navegadores na instalação, e
isso atrasaria cada publicação no Cloudflare sem servir para nada lá. Para rodar
o teste numa máquina nova: `npm i -D playwright && npx playwright install chromium`.

## O que fica no repositório

- `testes/fotos/` as fotos aprovadas. Vão para o repositório.
- `testes/atual/` as fotos recém-tiradas. Fora do repositório.
- `testes/diferenca/` o estrago em vermelho. Fora do repositório.

Quando uma seção muda **de propósito**, roda `npm run visual:aprovar` e comita.
O diff do repositório vira o registro visual da mudança: dá para ver no histórico
o dia em que o botão mudou de tom.

## Os dois limiares

- um pixel só conta como mudado se a diferença passa de **24**, de 0 a 255. Sem
  isso, uma letra que cai meio pixel diferente já reprovaria.
- a seção só reprova se mais de **0,20 por cento** dos pixels mudaram. Abaixo
  disso é ruído de renderização, não mudança de design.

O preço desses limiares é honesto: uma mudança minúscula, como um ponto de 8 px
trocando de cor dentro de uma seção larga, pode passar. O teste é uma rede para
mudança de token e quebra de layout, não uma lupa para um pixel.

## O que mais ele pega, sem ser foto

Junto com as fotos, o `visual.mjs` reprova quando:

- alguma seção do kit sumiu da página
- a página rola para o lado em 1440, 820 ou 390
- houve erro de JavaScript ao abrir o kit

## As fotos são do ambiente onde foram tiradas

A Urbanist vem do Google Fonts, que é bloqueado no ambiente onde estas fotos
foram geradas, então elas saem com a fonte de sistema. Numa máquina com a fonte
carregada, **todas** as seções vão acusar mudança na primeira rodada. Isso não é
defeito: é o teste dizendo que o ambiente é outro. Nesse caso, `npm run
visual:aprovar` uma vez naquela máquina, e daí para a frente ele compara contra
aquele ambiente.

## npm run tipos

A mesma conferencia de tipo que o build do Cloudflare faz, com as mesmas travas:
`strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.

**Ela existe por causa de um erro real.** Em 21/09 a conferencia de tipo daqui
era um `tsc` solto com um filtro que jogava fora `TS2307` ("nao achei o
modulo"), para calar o ruido de `node_modules` nao existir neste ambiente. So
que o apelido `@ds` tambem caia nesse filtro. Resultado: um nome repetido entre
um import do Design System e um tipo local passou batido, e duas publicacoes
seguidas quebraram no Cloudflare sem ninguem ver. O sistema no ar ficou seis
dias atras do repositorio.

A licao: **filtrar erro por codigo e apostar que aquele codigo so aparece no
ruido**, e essa aposta se perde. Agora os pacotes que faltam sao resolvidos em
`testes/tipos-falsos.d.ts`, o ruido some na origem, e nada e filtrado por
codigo, com uma excecao escrita: `TS7006` dentro de `.tsx`, que e o parametro
de um `onClick` sem os tipos do React. Em `.ts` ele continua derrubando, porque
dominio nao tem JSX dentro.

## npm run conferir

Roda tudo de uma vez: tipos, classes, contas e semana. **Antes de empurrar.**

## npm run tokens

A conferencia de leitura. Varre todo o CSS do `src/` e acusa: travessao em
qualquer texto, elemento padrao do navegador, `outline:none` sem substituto,
`font-family` sem token, cor literal, raio fora da escala e `transition` fora da
faixa de 150 a 260ms.

Ela le a escala de raio do proprio `tokens.css`, entao mudar a escala nao exige
mexer no teste. Tres arquivos sao livres de cor literal por natureza e estao
escritos dentro dela: `ds/tokens.css`, que e a origem, e `dominio/layout/folha.css`
com `modules/cotacao/documento.css`, que sao papel A4, branco nos dois temas de
proposito.

Ela sabe distinguir o separador de dado do editor (`FT-010-000M — CAMISETA`) de
um travessao escrito em texto, e sabe que a unica caixa de marcacao crua
permitida e a que o proprio Design System esconde dentro de
`ds/componentes/formulario.tsx`.

## npm run prova

A bancada. A conferencia de tokens le texto e nao ve tela torta; esta ve.

```
npm run prova pedaco.html                      so o Design System
npm run prova pedaco.html modules/funil/funil  com a folha do modulo
```

Monta uma pagina com as folhas REAIS, na ordem de `estilo.css`, poe o pedaco de
HTML dentro e fotografa em 390, 820 e 1440, nos dois temas, em `testes/prova/`.
O `pedaco.html` e so o corpo: sem `<html>`, sem `<head>`, sem `<style>`.

Ela mede sozinha rolagem horizontal, alvo de toque abaixo de 44px em 820 ou
menos, e elemento passando da borda direita. **E ela nao mede contraste,
alinhamento, peso de fonte, espaco torto nem cor que sumiu no tema escuro.** Por
isso ela termina mandando olhar as fotos. Rodar e nao olhar e o mesmo que nao
rodar.

## npm run ligacoes

A terceira conferencia, e a que faltava. `tokens` le VALOR escrito na mao;
`ligacoes` le o contrario, que e pior: um NOME que aponta para o vazio.

```css
background: var(--sup-2);       /* --sup-2 nao existe */
border: 1px solid var(--linha); /* --linha nao existe */
border-radius: var(--r-md);     /* --r-md nao existe */
```

O navegador nao reclama de nenhuma dessas. Ele joga a declaracao inteira fora,
e o elemento fica sem fundo, sem borda e com canto reto, parecendo que ninguem
estilizou. Foi assim que a tela de Ensaio ficou com quatro numeros soltos por
cima do cartao, e a conferencia de tokens passou por eles sem ver nada, porque
do ponto de vista dela `var(--sup-2)` e um token sendo usado direitinho.

Esses nomes sao vocabulario do Design Kit V6, que morreu no V7: `--ink-2`,
`--linha`, `--sup-2`, `--r-md`, `--r-sm`. Ninguem digitou errado; foi codigo
velho copiado.

Ela faz quatro perguntas:

1. **Variavel que aponta para o vazio.** Usada e definida em lugar nenhum. Ela
   procura a definicao no CSS, no `style={{ '--x': ... }}` do componente e no
   `setProperty('--x', ...)`, senao metade do sistema viraria falso positivo.
2. **Classe usada que CSS nenhum define.** Um `className` sem regra e um
   elemento sem estilo, e ninguem percebe porque a pagina quase funciona.
3. **Mesma classe brigando consigo mesma no mesmo arquivo.** Dois blocos da
   mesma classe nao sao erro por si; erro e quando os dois escrevem a mesma
   propriedade com valores diferentes. Dentro de `@media` redefinir e o
   proposito, entao `@media` fica de fora.
4. **CSS que componente nenhum usa**, so como aviso, porque classe montada em
   template (`` `btn-${tom}` ``) escapa da conta. Confira antes de apagar.

Ela entrou no `npm run conferir`.

### O irmao colado

`npm run prova` mede, alem do resto, o **vao entre os filhos diretos de
`.pagina`**. Menos de 12px e acusado.

Ele existe por causa do defeito que mais voltou: dois cartoes encostados um no
outro. A causa nunca esteve na tela onde aparecia. O respiro entre um bloco e o
proximo estava escrito na mao dentro do CSS de cada modulo, um `margin-bottom`
de cada vez; onde alguem lembrou ficou certo, onde ninguem lembrou os cartoes
nasceram colados. Por isso o mesmo defeito aparecia em varias telas ao mesmo
tempo: ele nao estava em nenhuma delas, estava na falta de regra.

Agora `.pagina` empilha em coluna com um vao unico, e o espaco entre blocos e
responsabilidade dela. **Bloco que PRECISA ficar colado no de baixo entra
dentro de um filho so**, como `.at-tabela`, que guarda o cabecalho de colunas e
os dias do painel de atividades porque os tres dividem a mesma borda.

Escrever `margin-bottom` num bloco de pagina dentro de CSS de modulo virou erro
de novo tipo: nao quebra nada sozinho, mas devolve o espacamento para o lugar
de onde ele acabou de sair.
