// Downloads that hold up on a phone. On mobile data, on a VPN or on hotel
// wifi, a request can fail outright, stall without ever finishing, come back
// cut short, or come back as someone else's web page (a sign-in or "you are
// offline" page put in by the network). Plain fetch() treats a stall as
// "still loading" for ever, so a panel waited on "…" until the page was
// reloaded. Everything the app downloads from its own site goes through here:
//
// - A request that has not answered in HEADERS_MS, or whose body has stopped
//   arriving for STALL_MS, is dropped and asked again. A large file that is
//   still coming in slowly is never cut off.
// - A failed try is repeated up to TRIES times in all, waiting a little
//   longer each time, and while the device says it is offline, until it is
//   back (or OFFLINE_MS has passed).
// - A web page that comes back for a data file counts as a failed try.
// - A later try asks past the browser's own cache (cache: 'no-cache'), so a
//   bad copy kept there is not served again.
// - A missing file (404) is not asked again: it will not appear.
//
// It has no page-only parts, so the workers use it too.

const TRIES = 4;
const HEADERS_MS = 20_000;
const STALL_MS = 20_000;
const WAITS_MS = [800, 2500, 6000];
const OFFLINE_MS = 30_000;

/** A failed download. `status` is the HTTP status when the server answered. */
export class LoadError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    /** Worth asking again: a dropped connection, a stall, a busy server. */
    readonly retry = true,
  ) {
    super(message);
    this.name = 'LoadError';
  }
}

/** Statuses a later try may get past. */
const PASSING = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Wait while the device reports no connection, for OFFLINE_MS at most. */
function whileOffline(): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine !== false || typeof addEventListener !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      removeEventListener('online', done);
      resolve();
    };
    const timer = setTimeout(done, OFFLINE_MS);
    addEventListener('online', done);
  });
}

/** A file that should never be a web page. */
function notPage(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  return !/(\/|\.html?)$/i.test(path);
}

async function once(url: string, init: RequestInit, name: string): Promise<Response> {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let why = '';
  const arm = (ms: number, what: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      why = what;
      ctl?.abort();
    }, ms);
  };
  try {
    arm(HEADERS_MS, 'no answer');
    let r: Response;
    try {
      r = await fetch(url, { ...init, signal: ctl?.signal });
    } catch (e) {
      throw new LoadError(`${name}: ${why || (e instanceof Error ? e.message : String(e))}`);
    }
    if (!r.ok) throw new LoadError(`${name}: HTTP ${r.status}`, r.status, PASSING.has(r.status));
    if (notPage(url) && (r.headers.get('content-type') ?? '').includes('text/html')) {
      throw new LoadError(`${name}: the network sent a web page instead`, r.status);
    }
    // Read the whole body here, watching for a stall, so a body that stops
    // half way is a failed try rather than a wait for ever.
    let body: ArrayBuffer;
    try {
      if (!r.body || !ctl) {
        arm(STALL_MS * 6, 'stalled');
        body = await r.arrayBuffer();
      } else {
        const reader = r.body.getReader();
        const parts: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          arm(STALL_MS, 'stalled');
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          size += value.byteLength;
        }
        const all = new Uint8Array(size);
        let at = 0;
        for (const p of parts) {
          all.set(p, at);
          at += p.byteLength;
        }
        body = all.buffer;
      }
    } catch (e) {
      throw new LoadError(`${name}: ${why || (e instanceof Error ? e.message : String(e))}`);
    }
    return new Response(body, { status: r.status, statusText: r.statusText, headers: r.headers });
  } finally {
    clearTimeout(timer);
  }
}

/** fetch(), made sturdy as described at the top of this file. Resolves with
 * the whole response already downloaded, so .json(), .text(), .arrayBuffer()
 * and WebAssembly.instantiateStreaming work on it as usual. Rejects with a
 * LoadError once every try has failed. Only for GET requests to this site. */
export async function fetchRetry(url: string, init: RequestInit = {}): Promise<Response> {
  const name = url.split(/[?#]/, 1)[0].split('/').pop() || url;
  let last: unknown;
  for (let i = 0; i < TRIES; i++) {
    if (i > 0) {
      await sleepMs(WAITS_MS[Math.min(i - 1, WAITS_MS.length - 1)] * (0.75 + Math.random() * 0.5));
      await whileOffline();
    }
    try {
      return await once(url, i > 0 && !init.cache ? { ...init, cache: 'no-cache' } : init, name);
    } catch (e) {
      last = e;
      if (e instanceof LoadError && !e.retry) break;
    }
  }
  throw last;
}

/** Run a loader (a dynamic import of the app's own code, say) again when it
 * fails, waiting as fetchRetry does. A failed import of a code file is
 * usually a dropped connection, and a second try gets it. */
export async function retry<T>(load: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    if (i > 0) {
      await sleepMs(WAITS_MS[Math.min(i - 1, WAITS_MS.length - 1)]);
      await whileOffline();
    }
    try {
      return await load();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Call `again` when the connection comes back or the page is shown again,
 * the moments a failed download is most likely to work. Returns a function
 * that stops listening. */
export function onBackOnline(again: () => void): () => void {
  if (typeof addEventListener !== 'function') return () => {};
  const visible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') again();
  };
  addEventListener('online', again);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible);
  return () => {
    removeEventListener('online', again);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible);
  };
}
