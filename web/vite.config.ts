import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

/** The key web/scripts/ask-meaning.mjs gave the Ask matcher it trained (the
 * prebuild runs it before vite), read from the head of ask/meaning.json. The
 * page puts it in the address of ask/meaning.json and ask/model.bin. Empty if
 * the file is missing. */
function askKey(): string {
  try {
    const file = fileURLToPath(new URL('./public/data/ask/meaning.json', import.meta.url));
    return /^\{"format":\d+,"key":"([0-9a-f]+)"/.exec(readFileSync(file, 'utf8').slice(0, 100))?.[1] ?? '';
  } catch {
    return '';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [preact(), esvProxy(env.ESV_API_KEY)],
    define: { __ASK_KEY__: JSON.stringify(askKey()) },
    worker: { format: 'es' },
    build: { target: 'es2022', assetsInlineLimit: 0 },
    server: { port: 5173 },
  };
});
