/* ==========================================================================
   As travas de arquitetura.

   A regra do projeto e uma so, e ela e de mao unica:

       modules  ->  dominio  ->  shared  ->  ds

   Quem esta na frente pode conhecer quem esta atras. O contrario nunca.
   Traduzindo para o dia a dia: o Design System nao sabe o que e uma cotacao,
   e por isso mexer em cotacao nao quebra o botao. Um modulo nao conversa com
   outro modulo direto, e por isso mexer no kanban nao quebra o estoque.

   Este arquivo nao e documentacao, e verificacao: ele roda dentro do
   `npm run build`, que e o mesmo comando que o Cloudflare usa para publicar.
   Import na direcao errada nao vira aviso, vira build quebrado, e o site
   simplesmente nao sobe.
   ========================================================================== */

/** os arquivos de montagem na raiz de src: app, rotas e main */
const RAIZ = '^src/[^/]+\\.tsx?$'

module.exports = {
  forbidden: [
    {
      name: 'sem-ciclo',
      comment:
        'A importa B que importa A. Ciclo faz o carregamento depender da ordem e transforma ' +
        'qualquer mudanca em surpresa. Quebre extraindo a parte comum.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },

    {
      name: 'ds-nao-conhece-o-negocio',
      comment:
        'O Design System e a camada do fundo: cor, medida, botao, campo. Ele nao pode saber o ' +
        'que e cliente, cotacao ou ficha. Se um componente precisa disso, ele nao e do ds.',
      severity: 'error',
      from: { path: '^src/ds/' },
      to: { path: ['^src/dominio/', '^src/shared/', '^src/modules/', RAIZ] },
    },

    {
      name: 'shared-nao-conhece-o-negocio',
      comment:
        'shared/ e utilidade sem dono: formatador, ajudante, peca de apoio. Ele so pode ' +
        'importar de ds/. Se precisou do dominio, o lugar dele e dominio/.',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: ['^src/dominio/', '^src/modules/', RAIZ] },
    },

    {
      name: 'dominio-nao-conhece-tela',
      comment:
        'dominio/ e a regra da fabrica: o que e uma tecnica, como uma cotacao vira ficha, ' +
        'quem esta na sessao. Ele nao pode depender de nenhum modulo de tela.',
      severity: 'error',
      from: { path: '^src/dominio/' },
      to: { path: ['^src/modules/', RAIZ] },
    },

    {
      name: 'modulo-so-entra-pela-porta-da-frente',
      comment:
        'Esta e a trava que mais importa no dia a dia. Um modulo pode precisar de outro, e tudo ' +
        'bem, mas so pelo index.ts dele, que e a porta da frente. O que esta dentro da pasta e ' +
        'privado: ninguem de fora alcanca uma tela, um estado ou um arquivo solto do vizinho. ' +
        'Assim mexer por dentro do kanban nunca quebra o estoque, porque ninguem de fora estava ' +
        'olhando para dentro. E quando dois modulos precisam da mesma regra, ela nao vira import ' +
        'cruzado: ela sobe para dominio/.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.tsx?$'],
      },
    },

    {
      name: 'so-a-raiz-monta-o-sistema',
      comment:
        'app.tsx, rotas.tsx e main.tsx sao o ponto de montagem: eles conhecem todas as ' +
        'camadas. Ninguem importa de volta para eles, se nao a mao unica vira mao dupla.',
      severity: 'error',
      from: { path: '^src/(ds|dominio|shared|modules)/' },
      to: { path: RAIZ },
    },

    {
      name: 'sem-dependencia-de-desenvolvimento-no-sistema',
      comment:
        'Pacote que so existe para construir ou testar nao pode entrar no que vai para o ' +
        'navegador do galpao.',
      severity: 'error',
      from: { path: '^src/.+\\.tsx?$', pathNot: '\\.(spec|test)\\.tsx?$' },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)node_modules/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
