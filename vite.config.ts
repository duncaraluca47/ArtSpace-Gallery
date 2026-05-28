import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const hasLocalCerts = fs.existsSync('certs/key.pem') && fs.existsSync('certs/cert.pem')

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // bind to network so other machines can reach the dev server
    host: true,
    https: hasLocalCerts
      ? {
          key: fs.readFileSync('certs/key.pem'),
          cert: fs.readFileSync('certs/cert.pem'),
        }
      : undefined,
    // Proxy API and socket traffic to the backend to keep same-origin
    proxy: (() => {
      const defaultBackendUrl = hasLocalCerts ? "https://localhost:4443" : "http://localhost:4443";
      const target = process.env.VITE_BACKEND_URL ?? defaultBackendUrl;
      return {
        // Proxy REST and GraphQL API calls
        "/api": {
          target,
          changeOrigin: true,
          secure: false,
        },
        // Proxy Socket.IO websocket connections
        "/socket.io": {
          target,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      };
    })(),
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  test: {
    globals: true,
    environment: 'jsdom',
    fileParallelism: false,
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/app/pages/**/*.ts',
        'src/app/pages/**/*.tsx',
        'src/app/context/**/*.tsx',
        'src/app/monitoring/**/*.ts',
        'src/app/services/**/*.ts',
        'src/app/state/**/*.ts',
        'src/app/validation/**/*.ts',
        'src/app/data/**/*.ts',
        'src/components/AuthGuards.tsx',
        'src/components/AuthStatusPill.tsx',
        'src/components/LoginPage.tsx',
        'src/components/RegisterPage.tsx',
        'src/context/**/*.tsx',
        'src/middleware/**/*.ts',
        'src/routes/**/*.ts',
        'src/utils/**/*.ts',
        'src/backend/app.ts',
        'src/backend/graphql/**/*.ts',
        'src/backend/routes/**/*.ts',
        'src/backend/services/**/*.ts',
        'src/backend/store/**/*.ts',
        'src/backend/validation/**/*.ts',
        'src/prismaArtworkStore.ts',
        'src/prismaClient.ts',
      ],
      exclude: [
        'src/app/components/ui/**',
        'src/app/components/figma/**',
        'src/app/pages/galleryStats.ts',
        'src/app/pages/splitCrud.ts',
        'src/components/ChatPanel.tsx',
        'src/chatSocket.ts',
        'src/hooks/useChat.ts',
        'src/main.tsx',
        'src/mongoClient.ts',
        'src/backend/server.ts',
        'src/backend/types.ts',
        'src/models/**',
        'src/generated/**',
        'src/test/**',
        'src/**/*.d.ts',
      ],
    },
  },
})
