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
