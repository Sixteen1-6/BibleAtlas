// Promise API over the engine worker.

import { DATA_BASE } from '../data/atlas';
import * as S from '../state';
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
  /** Set once the worker itself has failed; every later call rejects with it. */
  private failed: Error | null = null;
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
    // Without these, a worker that fails to load or crashes leaves every query waiting forever.
    this.worker.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      this.fail(`The path engine stopped working${e.message ? ` (${e.message})` : ''}.`);
    };
    this.worker.onmessageerror = () => this.fail('The path engine sent a reply the page could not read.');
    // The page has already downloaded this atlas.bin (its typed arrays are views
    // over the whole file), so hand the worker a copy rather than fetch it twice.
    // A copy, because the page keeps using its own.
    const a = S.atlas.peek();
    const whole = a && binUrl === `${DATA_BASE}atlas.bin?${a.version}` ? a.xOff.buffer : null;
    const bin = whole instanceof ArrayBuffer ? whole.slice(0) : undefined;
    this.ready = this.call('init', { binUrl, bin }, bin ? [bin] : []) as Promise<number>;
    // Callers see a failed start when they await `ready`; don't also report it as unhandled.
    this.ready.catch(() => {});
  }

  /** Reject everything still waiting, and everything asked from now on. */
  private fail(message: string): void {
    const err = new Error(message);
    this.failed = err;
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private call<O extends Op>(op: O, body: Body<O>, transfer: Transferable[] = []): Promise<unknown> {
    if (this.failed) return Promise.reject(this.failed);
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

  /** Up to `k` roads between two verses: chains of links that share no verse
   *  except their two ends, cheapest first. The first is `path()`'s chain;
   *  an empty list means no chain joins them. */
  async paths(from: number, to: number, minVotes = 1, k = 3): Promise<PathResult[]> {
    await this.ready;
    return this.call('paths', { from, to, minVotes, k }) as Promise<PathResult[]>;
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
