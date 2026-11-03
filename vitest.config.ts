import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared'), '@': resolve(__dirname, 'src/apt'), vue: resolve(__dirname, 'src/apt/shims/vue.ts'), '@vueuse/core': resolve(__dirname, 'src/apt/shims/vueuse.ts') } },
  test: { globals: true, include: ['test/**/*.test.ts'] }
})
