import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
// @ts-expect-error plain ES module without type declarations
import { createEsvHandler } from '../server/esv.mjs';

/** Serves /api/esv in `vite dev` and `vite preview`, with the key from web/.env. */
function esvProxy(apiKey: string | undefined): Plugin {
  const handler = createEsvHandler({ apiKey });
  return {
    name: 'esv-proxy',
    configureServer(server) {
      server.middlewares.use('/api/esv', (req, res) => handler(req, res));
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/esv', (req, res) => handler(req, res));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [preact(), esvProxy(env.ESV_API_KEY)],
    worker: { format: 'es' },
    build: { target: 'es2022', assetsInlineLimit: 0 },
    server: { port: 5173 },
  };
});
