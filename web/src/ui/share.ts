// Share as a picture: the selected verse in the BSB under its own links,
// drawn as glowing arcs over a faint map of every cross-reference in the
// Bible, in three sizes (a phone story, a square post, a wide link card).
// Drawn here on a 2D canvas, not copied from the WebGL map, so the picture
// looks the same whatever the map is showing. Always the BSB (public domain),
// never the NET or the ESV, whose words may not be stored or copied.

import { type Atlas, label, linkCount } from "../data/atlas";
import { getVerse } from "../data/text";
import { verseX } from "../gl/layout";
import * as S from "../state";
import { SKY, SPECTRUM } from "./colors";

export type Format = "story" | "square" | "wide";

export const FORMATS: Record<
  Format,
  { w: number; h: number; name: string; about: string }
> = {
  story: { w: 1080, h: 1920, name: "Story", about: "Tall, for phone stories" },
  square: { w: 1080, h: 1080, name: "Square", about: "For posts" },
  wide: { w: 1200, h: 630, name: "Wide", about: "For messages and links" },
};

/** The look of each size: where the map's baseline sits, how tall its arcs
 * may be, and the text's sizes and box, all in pixels of the picture. */
interface Plan {
  pad: number;
  base: number;
  arcH: number;
  brand: number;
  ref: number;
  text: [number, number];
  textTop: number;
  textBottom: number;
  small: number;
}

function plan(f: Format): Plan {
  switch (f) {
    case "story":
      return {
        pad: 84,
        base: 900,
        arcH: 700,
        brand: 26,
        ref: 76,
        text: [60, 34],
        textTop: 1010,
        textBottom: 1700,
        small: 30,
      };
    case "square":
      return {
        pad: 72,
        base: 470,
        arcH: 330,
        brand: 22,
        ref: 56,
        text: [44, 26],
        textTop: 540,
        textBottom: 930,
        small: 24,
      };
    case "wide":
      return {
        pad: 56,
        base: 300,
        arcH: 220,
        brand: 18,
        ref: 40,
        text: [32, 20],
        textTop: 340,
        textBottom: 540,
        small: 19,
      };
  }
}

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const SPEC = SPECTRUM.map(hexRgb);

/** The map's spectrum at canon position x (0 Genesis, 1 Revelation). */
function spectrum(x: number, alpha: number): string {
  const f = Math.min(Math.max(x, 0), 1) * (SPEC.length - 1);
  const i = Math.min(Math.floor(f), SPEC.length - 2);
  const t = f - i;
  const c = SPEC[i].map((a, k) => Math.round(a + (SPEC[i + 1][k] - a) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/** Lines of `text` that fit `width` in the context's current font. */
function wrap(
  g: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && g.measureText(next).width > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** An arc as the map draws it: a half sine, taller the farther it reaches. */
function arc(
  g: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  base: number,
  hmax: number,
  width: number,
): void {
  const r = Math.abs(x1 - x0) / 2;
  const h = hmax * Math.pow(Math.min(1, r / (width / 2)), 0.6);
  const steps = Math.max(8, Math.min(48, Math.round(r / 8)));
  g.moveTo(x0, base);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    g.lineTo(x0 + (x1 - x0) * t, base - h * Math.sin(Math.PI * t));
  }
}

/** A small deterministic random, so the same verse draws the same stars. */
function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** The verses joined to `v` by a link with at least one net vote, either way,
 * with the strongest vote count for each. */
function links(a: Atlas, v: number): Map<number, number> {
  const out = new Map<number, number>();
  const add = (u: number, votes: number) => {
    if (votes > 0 && u !== v) out.set(u, Math.max(out.get(u) ?? 0, votes));
  };
  for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) add(a.xDst[e], a.xVotes[e]);
  for (let i = a.xInOff[v]; i < a.xInOff[v + 1]; i++) {
    const e = a.xInEdge[i];
    add(a.xSrc[e], a.xVotes[e]);
  }
  return out;
}

let xsCache: { a: Atlas; xs: Float32Array } | null = null;
function positions(a: Atlas): Float32Array {
  if (xsCache?.a !== a) xsCache = { a, xs: verseX(a) };
  return xsCache.xs;
}

/** Draw the picture for verse `v` (or the whole map when null). */
export async function drawPicture(
  a: Atlas,
  format: Format,
  v: number | null = S.selected.peek(),
): Promise<HTMLCanvasElement> {
  const { w: W, h: H } = FORMATS[format];
  const p = { ...plan(format) };
  const row = v === null ? null : await getVerse(a, v).catch(() => null);
  const read = css("--font-read", "Georgia, serif");
  const ui = css("--font-ui", "system-ui, sans-serif");
  await Promise.all(
    [
      `600 ${p.ref}px ${read}`,
      `${p.text[0]}px ${read}`,
      `${p.small}px ${ui}`,
      `600 ${p.brand}px ${ui}`,
    ].map((f) => document.fonts?.load(f).catch(() => null)),
  );
  const lamp = "#ffd27a";
  const ink = "#f3eee2";
  const muted = "#9aa2c4";

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  // The verse at the largest size that fits its box, so a short verse reads
  // large and a long one still fits whole.
  const textW = W - 2 * p.pad;
  const quoted = row ? `“${row[0]}”` : "";
  const room = p.textBottom - p.textTop - p.ref * 1.55 - p.small * 1.6;
  let size = p.text[0];
  let lines: string[] = [];
  if (row) {
    for (; size >= p.text[1] * 0.75; size -= 2) {
      g.font = `${size}px ${read}`;
      lines = wrap(g, quoted, textW);
      if (lines.length * size * 1.42 <= room) break;
    }
  }
  // Map and words together, centred between the top and the foot.
  const gap = p.textTop - p.base;
  const textH = row
    ? p.ref * 1.55 + lines.length * size * 1.42 + p.small * 1.6
    : p.ref * 2.4 + p.text[1] * 1.4;
  const top = p.pad;
  const bottom = H - p.pad * (format === "wide" ? 0.6 : 0.9) - p.brand * 2.5;
  const block = p.arcH + gap + textH;
  p.base = Math.round(top + p.arcH + Math.max(0, (bottom - top - block) / 2));
  p.textTop = p.base + gap;

  // The night sky, lighter towards the map's horizon.
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, SKY.top);
  sky.addColorStop(p.base / H, SKY.horizon);
  sky.addColorStop(Math.min(1, (p.base + 160) / H), "#080b18");
  sky.addColorStop(1, "#05070f");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(
    W / 2,
    p.base,
    0,
    W / 2,
    p.base,
    W * 0.75,
  );
  glow.addColorStop(0, "rgba(42, 35, 80, 0.55)");
  glow.addColorStop(1, "rgba(42, 35, 80, 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  const rnd = random(v === null ? 7 : v * 2654435761);
  for (let i = 0; i < (W * H) / 9000; i++) {
    const y = rnd() * p.base;
    g.fillStyle = `rgba(243, 238, 226, ${0.08 + rnd() * 0.35 * (1 - y / p.base)})`;
    g.fillRect(rnd() * W, y, rnd() < 0.08 ? 2 : 1, rnd() < 0.08 ? 2 : 1);
  }

  // Every cross-reference, faintly: the Bible's whole map behind the verse.
  const xs = positions(a);
  const left = p.pad * 0.5;
  const span = W - 2 * left;
  const X = (u: number) => left + xs[u] * span;
  g.globalCompositeOperation = "lighter";
  g.lineWidth = format === "wide" ? 0.8 : 1;
  const minVotes = v === null ? 30 : 40;
  const faint = v === null ? 0.045 : 0.035;
  const buckets = SPEC.length * 4;
  const paths: Path2D[] = Array.from({ length: buckets }, () => new Path2D());
  for (let u = 0; u < a.n; u++) {
    for (let e = a.xOff[u]; e < a.xOff[u + 1]; e++) {
      if (a.xVotes[e] < minVotes) continue;
      const d = a.xDst[e];
      const lo = Math.min(xs[u], xs[d]);
      const k = Math.min(buckets - 1, Math.floor(lo * buckets));
      const path = paths[k];
      // Path2D has the same moveTo and lineTo as the context.
      arc(
        path as unknown as CanvasRenderingContext2D,
        X(u),
        X(d),
        p.base,
        p.arcH,
        span,
      );
    }
  }
  paths.forEach((path, k) => {
    g.strokeStyle = spectrum((k + 0.5) / buckets, faint);
    g.stroke(path);
  });

  // The verse's own links, glowing.
  const mine = v === null ? new Map<number, number>() : links(a, v);
  if (v !== null) {
    const strongest = Math.max(1, ...mine.values());
    // Many links laid over each other add up to white; dim each a little.
    const crowd = Math.min(1, Math.sqrt(24 / Math.max(1, mine.size)));
    const order = [...mine.entries()].sort((x, y) => x[1] - y[1]);
    for (const pass of [0, 1]) {
      for (const [u, votes] of order) {
        const s = Math.log(1 + votes) / Math.log(1 + strongest);
        g.beginPath();
        arc(g, X(v), X(u), p.base, p.arcH, span);
        const lo = Math.min(xs[u], xs[v]);
        if (pass === 0) {
          g.shadowColor = spectrum(lo, 0.9);
          g.shadowBlur = format === "wide" ? 10 : 16;
          g.strokeStyle = spectrum(lo, (0.35 + 0.35 * s) * (0.5 + 0.5 * crowd));
          g.lineWidth = (format === "wide" ? 1.6 : 2.4) + 3 * s;
        } else {
          g.shadowBlur = 0;
          g.strokeStyle = `rgba(255, 248, 230, ${(0.2 + 0.5 * s) * crowd})`;
          g.lineWidth = 0.8 + 0.8 * s;
        }
        g.stroke();
      }
    }
    g.shadowBlur = 0;
  }
  g.globalCompositeOperation = "source-over";

  // The baseline: the books in order, Genesis to Revelation.
  const band = g.createLinearGradient(left, 0, left + span, 0);
  SPECTRUM.forEach((col, i) =>
    band.addColorStop(i / (SPECTRUM.length - 1), col),
  );
  g.globalAlpha = 0.55;
  g.fillStyle = band;
  g.fillRect(left, p.base, span, format === "wide" ? 2 : 3);
  g.globalAlpha = 1;
  g.font = `${Math.round(p.small * 0.62)}px ${ui}`;
  g.fillStyle = muted;
  g.textBaseline = "top";
  g.fillText("Genesis", left, p.base + 12);
  g.textAlign = "right";
  g.fillText("Revelation", left + span, p.base + 12);
  g.textAlign = "left";

  // The verse's place, lit like a lamp.
  if (v !== null) {
    const x = X(v);
    const lampGlow = g.createRadialGradient(
      x,
      p.base,
      0,
      x,
      p.base,
      p.arcH * 0.35,
    );
    lampGlow.addColorStop(0, "rgba(255, 210, 122, 0.55)");
    lampGlow.addColorStop(0.25, "rgba(255, 210, 122, 0.18)");
    lampGlow.addColorStop(1, "rgba(255, 210, 122, 0)");
    g.fillStyle = lampGlow;
    g.fillRect(x - p.arcH, p.base - p.arcH, 2 * p.arcH, 2 * p.arcH);
    g.beginPath();
    g.arc(x, p.base, format === "wide" ? 5 : 7, 0, 2 * Math.PI);
    g.fillStyle = lamp;
    g.fill();
    // Mark each linked verse where its arc lands.
    g.fillStyle = "rgba(255, 248, 230, 0.75)";
    for (const u of mine.keys()) g.fillRect(X(u) - 1, p.base - 1, 2, 3);
  }

  // The words.
  g.textBaseline = "alphabetic";
  if (v !== null && row) {
    let y = p.textTop;
    g.fillStyle = lamp;
    g.font = `600 ${p.ref}px ${read}`;
    y += p.ref;
    g.fillText(label(a, v), p.pad, y);
    y += p.ref * 0.55;
    g.font = `${size}px ${read}`;
    g.fillStyle = ink;
    for (const l of lines) {
      y += size * 1.42;
      g.fillText(l, p.pad, y - size * 0.3);
    }
    const n = linkCount(a, v);
    const books = new Set([...mine.keys()].map((u) => a.verseBook[u]));
    g.fillStyle = muted;
    g.font = `${p.small}px ${ui}`;
    y += p.small * 1.6;
    const linked =
      n === 0
        ? "Not yet linked to other passages"
        : `Linked to ${n.toLocaleString()} ${n === 1 ? "passage" : "passages"}${books.size > 1 ? ` in ${books.size} books` : ""}`;
    g.fillText(linked, p.pad, y);
  } else {
    let y = p.textTop + p.ref;
    g.fillStyle = lamp;
    g.font = `600 ${p.ref}px ${read}`;
    for (const l of wrap(g, "Every cross-reference in the Bible", textW)) {
      g.fillText(l, p.pad, y);
      y += p.ref * 1.2;
    }
    g.fillStyle = ink;
    g.font = `${p.text[1]}px ${read}`;
    g.fillText(
      `${a.xDst.length.toLocaleString()} links, Genesis to Revelation`,
      p.pad,
      y + p.text[1] * 0.4,
    );
  }

  // The foot: the app, and whose words these are.
  const foot = H - p.pad * (format === "wide" ? 0.6 : 0.9);
  g.font = `600 ${p.brand}px ${ui}`;
  g.fillStyle = lamp;
  g.fillText("Bible Atlas", p.pad, foot);
  const bw = g.measureText("Bible Atlas").width;
  g.font = `${p.brand}px ${ui}`;
  g.fillStyle = muted;
  g.fillText("  everyversemap.com", p.pad + bw, foot);
  if (v !== null) {
    g.textAlign = "right";
    g.fillText("Berean Standard Bible", W - p.pad, foot);
    g.textAlign = "left";
  }
  return c;
}

export function toBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((done) => c.toBlob(done, "image/png"));
}

/** The picture's file name: "John-3-16-story.png". */
export function fileName(a: Atlas, v: number | null, format: Format): string {
  return `${v === null ? "bible-atlas" : label(a, v).replace(/[^A-Za-z0-9]+/g, "-")}-${format}.png`;
}

/** Whether this device can share a picture file (most phones). */
export function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    const probe = new File([new Blob(["x"], { type: "image/png" })], "x.png", {
      type: "image/png",
    });
    return !!nav.share && !!nav.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/** Share the picture where the device can, else save it. */
export async function sendPicture(
  blob: Blob,
  name: string,
  title: string,
  share: boolean,
): Promise<void> {
  const file = new File([blob], name, { type: "image/png" });
  if (share && canShareFiles()) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
