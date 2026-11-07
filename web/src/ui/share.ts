// Share as a picture: the arc map as it is now, with the selected verse in the
// BSB under it, drawn to one PNG. Phones that can share files open the share
// sheet; elsewhere the picture is saved. Always the BSB (public domain), never
// the NET or the ESV, whose words may not be stored or copied.

import { type Atlas, label, linkCount } from '../data/atlas';
import { getVerse } from '../data/text';
import { settle } from '../gl/arcs';
import { BASELINE } from '../gl/layout';
import * as S from '../state';

const W = 1200;
const PAD = 64;

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Lines of `text` that fit `width` in the context's current font. */
function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
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

/** Draw the picture; null when the map is not on screen. */
export async function drawPicture(a: Atlas): Promise<Blob | null> {
  const map = document.querySelector<HTMLCanvasElement>('canvas.arcs');
  if (!map || !map.width || !map.height) return null;
  const v = S.selected.peek();
  const row = v === null ? null : await getVerse(a, v).catch(() => null);
  await document.fonts?.ready;

  const sky = css('--sky', '#070a16');
  const ink = css('--sky-ink', '#f3eee2');
  const muted = css('--sky-muted', '#949cbd');
  const lamp = css('--lamp', '#ffd27a');
  const read = css('--font-read', 'Georgia, serif');
  const ui = css('--font-ui', 'system-ui, sans-serif');

  // Only the sky down to the baseline: below it the map has its book band,
  // which is drawn on the page, not on this canvas.
  const srcH = Math.round(map.height * BASELINE) + 2;
  const mapH = Math.round((W * srcH) / map.width);
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `30px ${read}`;
  const lines = row ? wrap(probe, row[0], W - 2 * PAD) : [];
  const textH = v === null ? 0 : 56 + 44 * lines.length + 40;
  const H = mapH + 40 + textH + 70;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // The WebGL map keeps no copy of its last frame: draw one now and copy it
  // before the browser can clear it.
  settle(map);
  g.drawImage(map, 0, 0, map.width, srcH, 0, 0, W, mapH);

  let y = mapH + 40;
  if (v !== null) {
    g.fillStyle = lamp;
    g.font = `600 34px ${read}`;
    g.fillText(label(a, v), PAD, y + 34);
    y += 56;
    g.fillStyle = ink;
    g.font = `30px ${read}`;
    for (const l of lines) {
      y += 44;
      g.fillText(l, PAD, y - 10);
    }
    y += 10;
    const n = linkCount(a, v);
    g.fillStyle = muted;
    g.font = `20px ${ui}`;
    g.fillText(`Linked to ${n.toLocaleString()} ${n === 1 ? 'passage' : 'passages'}`, PAD, y + 20);
    y += 40;
  }
  g.fillStyle = muted;
  g.font = `18px ${ui}`;
  g.fillText(v === null ? 'Bible Atlas · everyversemap.com' : 'Berean Standard Bible · Bible Atlas · everyversemap.com', PAD, H - 32);
  return new Promise((done) => c.toBlob(done, 'image/png'));
}

/** Share the picture where the device can, else save it. */
export async function sharePicture(a: Atlas): Promise<boolean> {
  const blob = await drawPicture(a);
  if (!blob) return false;
  const v = S.selected.peek();
  const name = `${v === null ? 'bible-atlas' : label(a, v).replace(/[^A-Za-z0-9]+/g, '-')}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: v === null ? 'Bible Atlas' : label(a, v) });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return true;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
