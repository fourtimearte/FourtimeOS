import type { NodePath, PluginObj, types as T } from '@babel/core'

/* ==========================================================================
   A MARCA DE FONTE (temporária, pedido do Henrique em 12/10/2026; sai quando o
   sistema ficar pronto). Na hora do build, todo elemento de HTML escrito em JSX
   dentro de src/ ganha o atributo data-ft com o arquivo, a linha e o nome do
   componente onde ele foi escrito:

     <button data-ft="modules/cotacao/corpo-do-editor.tsx:93 CorpoDoEditor">

   E todo COMPONENTE usado em JSX (Botao, Seletor...) ganha data-ft-uso com o
   lugar onde ele foi usado. O componente que repassa as props para o HTML
   (quase todos os do Design System) leva essa marca até o elemento, e é ela
   que diz em que tela o botão foi posto. Ela entra na FRENTE das props: quem
   repassa um data-ft-uso de fora passa por cima, e fica o lugar mais de fora.

   O inspetor do sistema (src/modules/inspetor, atalho Ctrl+Shift+X) lê essa
   marca do elemento escolhido e dos pais dele, e copia o endereço exato para
   colar no chat. Sem a marca, o inspetor ainda copia a página, as classes e o
   estilo, só não sabe o arquivo.

   Desligar sem tirar o código: VITE_SEM_INSPETOR=1 no build.
   ========================================================================== */

/* desenho de dentro do SVG não precisa de endereço: o <svg> já tem */
const SEM_MARCA = new Set([
  'path', 'circle', 'rect', 'line', 'g', 'polyline', 'polygon', 'ellipse', 'stop',
  'defs', 'use', 'tspan', 'clipPath', 'linearGradient', 'radialGradient', 'mask', 'option',
])

/* componentes que não aceitam props desconhecidas */
const SEM_USO = new Set(['Fragment', 'Suspense', 'StrictMode', 'Profiler'])

export function marcaDeFonte(raiz: string) {
  const prefixo = raiz.replace(/\\/g, '/').replace(/\/$/, '') + '/src/'
  return ({ types: t }: { types: typeof T }): PluginObj => ({
    name: 'marca-de-fonte',
    visitor: {
      JSXOpeningElement(path, state) {
        const nome = path.node.name
        if (nome.type !== 'JSXIdentifier' || SEM_MARCA.has(nome.name) || SEM_USO.has(nome.name)) return
        const html = /^[a-z]/.test(nome.name)
        const atributo = html ? 'data-ft' : 'data-ft-uso'
        const arquivo = (state.filename ?? '').replace(/\\/g, '/')
        if (!arquivo.startsWith(prefixo)) return
        const ja = path.node.attributes.some(
          (a) => a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' && a.name.name === atributo,
        )
        if (ja) return
        /* o componente: a função com nome mais perto, de dentro para fora */
        let componente = ''
        for (let p: NodePath | null = path.parentPath; p; p = p.parentPath) {
          if (p.isFunctionDeclaration() && p.node.id) {
            componente = p.node.id.name
            break
          }
          if ((p.isArrowFunctionExpression() || p.isFunctionExpression()) && p.parentPath?.isVariableDeclarator()) {
            const id = p.parentPath.node.id
            if (id.type === 'Identifier') {
              componente = id.name
              break
            }
          }
        }
        const linha = path.node.loc?.start.line ?? 0
        const valor = arquivo.slice(prefixo.length) + ':' + linha + (componente ? ' ' + componente : '')
        const marca = t.jsxAttribute(t.jsxIdentifier(atributo), t.stringLiteral(valor))
        if (html) path.node.attributes.push(marca)
        else path.node.attributes.unshift(marca)
      },
    },
  })
}
