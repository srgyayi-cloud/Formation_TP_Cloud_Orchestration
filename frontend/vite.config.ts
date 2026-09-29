import { defineConfig } from 'vite';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// En développement, Vite relaie les appels vers l'API (même rôle que nginx en conteneur)
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': API_URL,
      '/version': API_URL,
    },
  },
});
