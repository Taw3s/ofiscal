/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * A Content-Security-Policy restritiva fica em `index.html` e é a que vai
 * para o build de produção (`dist/index.html`).
 *
 * Em `npm run dev`, o Vite precisa injetar scripts e estilos inline e abrir um
 * WebSocket para recarregar a página. Este plugin afrouxa a política SOMENTE
 * no servidor de desenvolvimento. O build nunca passa por aqui.
 */
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; connect-src 'self' ws: wss:; base-uri 'none'; form-action 'none'; object-src 'none'";

function relaxCspInDev(): Plugin {
  return {
    name: 'relax-csp-in-dev',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/,
        `$1${DEV_CSP}$2`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), relaxCspInDev()],
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    restoreMocks: true,
    setupFiles: ['src/test-setup.ts'],
  },
});
