import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = { '@shared': resolve(__dirname, 'src/shared'), '@': resolve(__dirname, 'src/apt'), vue: resolve(__dirname, 'src/apt/shims/vue.ts'), '@vueuse/core': resolve(__dirname, 'src/apt/shims/vueuse.ts') }

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], resolve: { alias } },
  preload: { plugins: [externalizeDepsPlugin()], resolve: { alias } },
  renderer: { plugins: [react()], resolve: { alias } }
})
