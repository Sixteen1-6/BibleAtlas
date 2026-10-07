// Promise API over the engine worker.

import type { Request, Response } from './engine.worker';

export interface PathResult {
  verses: number[];
  edges: number[];
}
export interface NearResult {
  verses: number[];
  hops: number[];
  edges: number[];
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type Op = Request extends infer R ? (R extends { op: infer O } ? O : never) : never;
type Body<O extends Op> = Omit<Extract<Request, { op: O }>, 'id' | 'op'>;

export class Engine {
  private worker: Worker;
  private next = 1;
  private pending = new Map<number, Pending>();
  /** Duration of the last query inside the engine, in ms. */
  lastMs = 0;
  ready: Promise<number>;

  constructor(binUrl: string) {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<Response>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.ok) {
        this.lastMs = e.data.ms;
        p.resolve(e.data.result);
      } else p.reject(new Error(e.data.error));
    };
    this.ready = this.call('init', { binUrl }) as Promise<number>;
  }

  private call<O extends Op>(op: O, body: Body<O>, transfer: Transferable[] = []): Promise<unknown> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, op, ...body }, transfer);
    });
  }

  async path(from: number, to: number, minVotes = 1): Promise<PathResult | null> {
    await this.ready;
    return this.call('path', { from, to, minVotes }) as Promise<PathResult | null>;
  }

  async near(seed: number, hops = 2, minVotes = 5, limit = 60): Promise<NearResult> {
    await this.ready;
    return this.call('near', { seed, hops, minVotes, limit }) as Promise<NearResult>;
  }

  /** Cross-references whose both ends are in `verses`. */
  async linksWithin(n: number, verses: ArrayLike<number>, minVotes = 1): Promise<Uint32Array> {
    await this.ready;
    const mask = new Uint8Array(n);
    for (let i = 0; i < verses.length; i++) mask[verses[i]] = 1;
    return this.call('linksWithin', { mask, minVotes }, [mask.buffer]) as Promise<Uint32Array>;
  }

  /** Parse a typed reference into an inclusive verse range. */
  async parseRef(text: string): Promise<[number, number] | null> {
    await this.ready;
    return this.call('parseRef', { text }) as Promise<[number, number] | null>;
  }
}
