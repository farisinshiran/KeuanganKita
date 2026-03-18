import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv reads .env / .env.local files; '' prefix = include all vars.
  const env = loadEnv(mode, process.cwd(), '')

  // Demo mode: no Firebase API key found in env files OR CI environment.
  // When true, firebase/* imports are aliased to localStorage-backed mocks so
  // the GitHub Pages demo works without any Firebase project configuration.
  const apiKey   = env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || ''
  const demoMode = !apiKey

  // GitHub Pages sets VITE_BASE_URL as a CI env var (not in .env files),
  // so we check both loadEnv output and process.env.
  const base = env.VITE_BASE_URL || process.env.VITE_BASE_URL || '/'

  return {
    plugins: [react()],
    base,
    ...(demoMode && {
      resolve: {
        alias: {
          'firebase/app':       path.resolve(__dirname, 'src/lib/demoApp.js'),
          'firebase/auth':      path.resolve(__dirname, 'src/lib/demoAuth.js'),
          'firebase/firestore': path.resolve(__dirname, 'src/lib/demoDb.js'),
        },
      },
    }),
  }
})
