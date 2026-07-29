import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Validate required environment variables for production builds
  if (mode === 'production') {
    const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_URL']
    const missing = required.filter((key) => !process.env[key])
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for production build: ${missing.join(', ')}`
      )
    }
  }

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
    },
  }
})
