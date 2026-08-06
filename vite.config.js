import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // three is ~600kB and never changes between your builds — splitting it
        // out means editing app code doesn't bust its cache.
        manualChunks: { three: ['three'] },
      },
    },
  },
})
