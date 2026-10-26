import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // three is ~600kB and never changes between your builds — splitting it
        // out means editing app code doesn't bust its cache.
        // Vite 8 (Rolldown) only accepts the function form.
        manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined),
      },
    },
  },
})
