/* Os pacotes de fora, declarados como qualquer coisa.

   Este ambiente nao instala node_modules, e sem os tipos do React todo .tsx
   vira uma parede de erro que nao diz nada sobre o codigo. Aqui os modulos de
   fora viram `any`, o ruido some NA ORIGEM, e o tsc continua conferindo por
   inteiro tudo que e nosso: nome repetido, import que nao e usado, tipo que
   nao bate, apelido que nao resolve.

   ESTE ARQUIVO EXISTE POR CAUSA DE UM ERRO REAL. Em 21/09 a conferencia daqui
   era um tsc solto com um filtro que jogava fora TS2307 ("nao achei o
   modulo"). Como o apelido `@ds` tambem caia nesse filtro, um nome repetido
   entre o import do Design System e um tipo local passou batido, e a
   publicacao quebrou duas vezes sem ninguem ver. Filtrar erro por codigo e
   apostar que aquele codigo so aparece no ruido, e essa aposta se perde. */

declare namespace JSX {
  interface Element {
    [k: string]: any
  }
  /* `any` de proposito, e nao Record<string, unknown>: com unknown, o
     parametro de um `onPointerDown={(ev) => ...}` fica sem tipo de contexto e
     vira uma chuva de TS7006 falsos. */
  interface IntrinsicElements {
    [k: string]: any
  }
  /* O `key` do React nao mora nas props do componente, e sim aqui. Sem esta
     linha, todo `<Linha key={...} />` vira "propriedade key nao existe". */
  interface IntrinsicAttributes {
    key?: unknown
  }
  interface IntrinsicClassAttributes<T> {
    ref?: unknown
  }
  interface ElementAttributesProperty {
    props: unknown
  }
  interface ElementChildrenAttribute {
    children: unknown
  }
}

declare module 'react' {
  /* So os tipos que o sistema importa de verdade. A lista sai de
     `grep -rhoP "import type \{[^}]*\} from 'react'" src/`, e crescer aqui e
     o preco de importar um tipo novo do React. */
  export type ReactNode = any
  export type CSSProperties = any
  export type ErrorInfo = any
  export type RefObject<T = any> = any
  export type HTMLAttributes<T = any> = any
  export type InputHTMLAttributes<T = any> = any
  export type TextareaHTMLAttributes<T = any> = any
  export type SelectHTMLAttributes<T = any> = any
  export type AnchorHTMLAttributes<T = any> = any
  export type ButtonHTMLAttributes<T = any> = any
  export type ChangeEvent<T = any> = any
  export type FormEvent<T = any> = any
  export type KeyboardEvent<T = any> = any
  export type MouseEvent<T = any> = any
  export type PointerEvent<T = any> = any
  const react: any
  export default react
  /* Classe de verdade, e nao `any`: a barreira de erro e um componente de
     classe, e com `any` o JSX reclama que ele nao tem `props`. */
  export class Component<P = any, S = any> {
    constructor(props?: P)
    props: P
    state: S
    setState(s: Partial<S> | ((p: S) => Partial<S>)): void
    render(): any
  }
  export const StrictMode: any
  export const createElement: any
  export const Fragment: any
  export const forwardRef: any

  /* OS GANCHOS PRECISAM DE ASSINATURA DE VERDADE, e nao de `any`.

     Com `any`, `useState<Pedido[]>([])` vira "chamada sem tipo nao aceita
     argumento de tipo" (TS2347), e a partir dali TUDO que sai dela e any, o
     que gera centenas de TS7006 falsos. O ruido volta pela janela, e um erro
     nosso no meio dele passa despercebido outra vez. */
  export function useState<S>(inicial: S | (() => S)): [S, (v: S | ((p: S) => S)) => void]
  export function useState<S = undefined>(): [S | undefined, (v: S | undefined) => void]
  export function useCallback<T>(f: T, deps?: readonly unknown[]): T
  export function useMemo<T>(f: () => T, deps?: readonly unknown[]): T
  /* Duas assinaturas: `useRef<HTMLDivElement>(null)` e o caso comum, e com
     uma so ele nao passa. */
  export function useRef<T>(inicial: T): { current: T }
  export function useRef<T>(inicial: T | null): { current: T | null }
  export function useEffect(f: () => void | (() => void), deps?: readonly unknown[]): void
  export function useLayoutEffect(f: () => void | (() => void), deps?: readonly unknown[]): void
  export function useId(): string
  export function createContext<T>(inicial: T): any
  export function useContext<T = any>(ctx: any): T
  export function memo<T>(componente: T): T
}

/* As folhas de estilo entram por import de efeito colateral. Sem isto o tsc
   reclama de cada `import './tela.css'`, que e ruido puro: quem resolve CSS e
   o Vite, e nao ele. */
declare module '*.css'
declare module '*.svg'
declare module '*.png'
declare module '*.jpg'

declare module 'react/jsx-runtime' {
  export const jsx: any
  export const jsxs: any
  export const Fragment: any
}
declare module 'react/jsx-dev-runtime' {
  export const jsxDEV: any
  export const Fragment: any
}
declare module 'react-dom' {
  const x: any
  export default x
}
declare module 'react-dom/client' {
  export const createRoot: any
}
declare module 'react-router-dom' {
  export const Link: any
  export const NavLink: any
  export const Navigate: any
  export const Outlet: any
  export const RouterProvider: any
  export const createBrowserRouter: any
  export const useLocation: any
  export const useNavigate: any
  export const useParams: any
  export const useSearchParams: any
}
/* Sem chaves: o modulo abreviado faz TODO import dele virar `any`, e e o
   unico jeito de um pacote com centenas de icones nomeados nao precisar de
   uma lista escrita a mao aqui. */
declare module '@phosphor-icons/react'
