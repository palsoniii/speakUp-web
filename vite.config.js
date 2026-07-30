import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Forces a single React instance across all deps (incl. lucide-react's
  // internal context hook). Without this, a stale/duplicate pre-bundle can
  // leave the app and a dependency reading from two different React copies,
  // which surfaces as "Invalid hook call" / "Cannot read properties of null
  // (reading 'useContext')".
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
