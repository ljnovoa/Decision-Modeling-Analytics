import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'singlefile' ? [viteSingleFile()] : []),
  ],
  base: mode === 'singlefile' ? './' : '/Decision-Modeling-Analytics/',
  build: {
    outDir: mode === 'singlefile' ? 'dist-single' : 'dist',
  },
}))
