import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { marcaDeFonte } from './ferramentas/marca-de-fonte'

/* o endereço de cada elemento para o inspetor (temporário; ferramentas/marca-de-fonte.ts) */
const comInspetor = process.env.VITE_SEM_INSPETOR !== '1'
const raiz = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react(comInspetor ? { babel: { plugins: [marcaDeFonte(raiz)] } } : {}), tailwind()],
  resolve: {
    alias: {
      '@ds': fileURLToPath(new URL('./src/ds', import.meta.url)),
      '@dominio': fileURLToPath(new URL('./src/dominio', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
    },
  },
  server: { port: 5173, host: true },
})
