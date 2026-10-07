// Runs the Rust graph engine (atlas-core compiled to WebAssembly) off the main
// thread. The page never blocks on a graph query, however heavy.

/// <reference lib="webworker" />
import wasmUrl from './atlas.wasm?url';

interface Exports {
  memory: WebAssembly.Memory;
  atlas_alloc(len: number): number;
  atlas_free(ptr: number, len: number): void;
  atlas_out_ptr(): number;
  atlas_out_len(): number;
  atlas_load(ptr: number, len: number): number;
  atlas_path(a: number, b: number, minVotes: number): number;
  atlas_near(seed: number, hops: number, minVotes: number, limit: number): number;
  atlas_links_within(mask: number, len: number, minVotes: number): number;
  atlas_parse_ref(ptr: number, len: number): number;
}

export type Request =
  | { id: number; op: 'init'; binUrl: string }
  | { id: number; op: 'path'; from: number; to: number; minVotes: number }
  | { id: number; op: 'near'; seed: number; hops: number; minVotes: number; limit: number }
  | { id: number; op: 'linksWithin'; mask: Uint8Array; minVotes: number }
  | { id: number; op: 'parseRef'; text: string };

export type Response = { id: number; ok: true; result: unknown; ms: number } | { id: number; ok: false; error: string };

let x: Exports | null = null;
const enc = new TextEncoder();

function withBytes<T>(bytes: Uint8Array, f: (ptr: number, len: number) => T): T {
  const ex = x!;
  const ptr = ex.atlas_alloc(bytes.length);
  new Uint8Array(ex.memory.buffer, ptr, bytes.length).set(bytes);
  try {
    return f(ptr, bytes.length);
  } finally {
    ex.atlas_free(ptr, bytes.length);
  }
}

/** Copy the engine's output buffer out of WebAssembly memory. */
function output(): Uint32Array {
  const ex = x!;
  return new Uint32Array(ex.memory.buffer, ex.atlas_out_ptr(), ex.atlas_out_len()).slice();
}

const ERRORS: Record<number, string> = { [-1]: 'engine not loaded', [-2]: 'atlas.bin is invalid', [-3]: 'not found', [-4]: 'could not read that' };

async function handle(req: Request): Promise<unknown> {
  if (req.op === 'init') {
    const [mod, bin] = await Promise.all([
      WebAssembly.instantiateStreaming(fetch(wasmUrl), {}),
      fetch(req.binUrl).then((r) => r.arrayBuffer()),
    ]);
    x = mod.instance.exports as unknown as Exports;
    const n = withBytes(new Uint8Array(bin), (p, l) => x!.atlas_load(p, l));
    if (n < 0) throw new Error(ERRORS[n]);
    return n;
  }
  if (!x) throw new Error(ERRORS[-1]);
  switch (req.op) {
    case 'path': {
      const k = x.atlas_path(req.from, req.to, req.minVotes);
      if (k === -3) return null;
      if (k < 0) throw new Error(ERRORS[k]);
      const out = output();
      return { verses: Array.from(out.subarray(0, k)), edges: Array.from(out.subarray(k)) };
    }
    case 'near': {
      const k = x.atlas_near(req.seed, req.hops, req.minVotes, req.limit);
      if (k < 0) throw new Error(ERRORS[k]);
      const out = output();
      const verses: number[] = [];
      const hops: number[] = [];
      for (let i = 0; i < k; i++) {
        verses.push(out[2 * i]);
        hops.push(out[2 * i + 1]);
      }
      return { verses, hops, edges: Array.from(out.subarray(2 * k)) };
    }
    case 'linksWithin': {
      const k = withBytes(req.mask, (p, l) => x!.atlas_links_within(p, l, req.minVotes));
      if (k < 0) throw new Error(ERRORS[k]);
      return output();
    }
    case 'parseRef': {
      const k = withBytes(enc.encode(req.text), (p, l) => x!.atlas_parse_ref(p, l));
      if (k < 0) return null;
      const out = output();
      return [out[0], out[1]];
    }
  }
}

self.onmessage = async (e: MessageEvent<Request>) => {
  const t = performance.now();
  try {
    const result = await handle(e.data);
    const msg: Response = { id: e.data.id, ok: true, result, ms: performance.now() - t };
    (self as unknown as Worker).postMessage(msg);
  } catch (err) {
    const msg: Response = { id: e.data.id, ok: false, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(msg);
  }
};
