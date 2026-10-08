// WebGL2 arc field.
//
// Pass 1 (accumulate): the cross-references are drawn as instanced line
// strips into a half-float framebuffer with additive blending, so light from
// overlapping arcs adds up instead of saturating. The instances are sorted
// into vote buckets (30 or more, 8 to 29, 1 to 7, 0 or fewer), each in canon
// order, so only the buckets that can pass the vote filter are issued.
// Pass 2 (tone map): the summed light is compressed with 1 - exp(-k·x), like
// an HDR photo, and composited over the night sky: a gradient, the horizon
// glow, faint fixed stars and a soft vignette.
// Pass 3 (focus): the selected verse's, path's or theme's arcs are drawn
// bright on top.
//
// Motion (none at all under prefers-reduced-motion):
// - The opening reveal: the sky draws itself from Genesis to Revelation. Pass
//   1 adds each bucket's next slice of the canon to the HDR target, and pass 2
//   uncovers the light behind a soft front.
// - A selected verse's links grow out of it, strongest first, then one pulse
//   runs out along them. A path lights step by step in reading order. A theme
//   sweeps from the Old Testament into the New. A hovered verse fades in.
// - The sky dims and brightens behind a focus.
// One requestAnimationFrame loop (motion.ts) drives it all and stops when
// nothing moves. Pass 1 only reruns when the view, the size, the vote filter
// or the color mode changes; hovering, selecting and animating only rerun
// passes 2 and 3.
//
// Sturdiness: a field whose canvas has left the page is freed when the next
// one is made (AtlasMap makes one per mount), and a lost context is rebuilt
// when the browser restores it. For tests the canvas carries data-drawn (the
// instances issued by the last full accumulate), data-anim ("1" while
// anything moves) and data-focus (what is lit: hover, path, verse or group,
// with " waiting" while a verse waits for the reveal).

import type { Atlas } from '../data/atlas';
import * as S from '../state';
import { ARC, type ArcColorMode, GENRE, GENRE_IDS, SKY, SPECTRUM, rgb } from '../ui/colors';
import { BASELINE, HEIGHT, SHAPE, type View, verseX } from './layout';
import { clamp01, easeInOut, easeOut, now, reducedMotion, sleep, wake } from './motion';

const MODES: Record<ArcColorMode, number> = { spectrum: 0, reach: 1, genre: 2 };

const SEGMENTS = 28;

/** Vote buckets, strongest first: the fewest net votes an arc in each bucket has. */
const BUCKET_MIN = [30, 8, 1, -Infinity];

// Timings, in seconds.
/** The page's first map draws its sky slowly; a map that comes back (from the Wheel) is quick. */
const REVEAL_FIRST = 2.0;
const REVEAL_AGAIN = 0.6;
/** Width of the reveal's soft front, as a fraction of the canvas width. */
const REVEAL_EDGE = 0.06;
const HOVER_FADE = 0.2;
const RETIRE_FADE = 0.2;
const DIM_EASE = 0.25;
/** A verse's links grow strongest first; the weakest starts this much after the strongest. */
const VERSE_STAGGER = 0.3;
const VERSE_GROW = 0.5;
/** Then one pulse runs out along every link. */
const VERSE_PULSE_AT = VERSE_STAGGER + VERSE_GROW;
const VERSE_PULSE = 0.7;
/** Step i of a path starts at i × PATH_STEP, in step with the SVG path drawn over the map. */
const PATH_STEP = 0.5;
const PATH_GROW = 0.7;
/** A theme sweeps from its first verse to its last. */
const SWEEP = 1.2;
/** Soft edge of the sweep, as a fraction of the theme's span. */
const SWEEP_EDGE = 0.04;

/** Stars stay below this share of the faintest arc, so they never compete with the links.
 *  With fewer arcs ("Strongest") more stars come out; with all of them they fade. */
const STAR_SHARE = 0.95;
/** And never brighter than this, however few arcs are shown. */
const STAR_MAX = 0.03;
/** The dimmest hue an arc can take keeps about this much of full brightness (Reach mode's mid blue-orange). */
const DIMMEST_HUE = 0.7;
/** Stars on the light page theme, where the dark map sits in a bright page. */
const STARS_ON_LIGHT = 0.3;

// ------------------------------------------------------------ shaders

/** The arc vertex shader. The focus variant also says where each point sits
 *  along its arc and how far its light has grown. */
const arcVs = (focus: boolean) => `#version 300 es
precision highp float;
layout(location = 0) in vec4 aEdge;   // x0, x1 (normalized), votes, class + 4 * genre
uniform vec2 uView;                   // scale, offset
uniform vec2 uSize;                   // canvas size in pixels
uniform float uSeg;
uniform float uMinVotes;
uniform float uIntensity;
uniform float uLift;                  // vertical offset in pixels (for thicker focus lines)
uniform int uMode;                    // 0 spectrum, 1 reach, 2 genre
uniform vec3 uReach[4];               // same book, near, far, across testaments
uniform vec3 uSpec[${SPECTRUM.length}];
uniform vec3 uGenre[${GENRE_IDS.length}];
out vec4 vColor;
${
  focus
    ? `layout(location = 1) in vec2 aAnim;   // delay and grow time, in seconds
uniform float uTime;                  // seconds since this focus set began
out float vS;                         // along the arc: 0 where its light starts, 1 at the far end
out float vX;                         // canon position (normalized x)
flat out float vGrow;                 // how far the light has grown along the arc, 0 to 1`
    : ''
}
const float PI = 3.14159265;
vec3 spectrum(float x) {
  float f = clamp(x, 0.0, 1.0) * float(${SPECTRUM.length - 1});
  int i = int(min(floor(f), float(${SPECTRUM.length - 2})));
  return mix(uSpec[i], uSpec[i + 1], f - float(i));
}
void main() {
  if (aEdge.z < uMinVotes) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vColor = vec4(0.0); return; }
  float t = float(gl_VertexID) / uSeg;
  float x0 = (aEdge.x - uView.y) * uView.x * uSize.x;
  float x1 = (aEdge.y - uView.y) * uView.x * uSize.x;
  float base = uSize.y * ${BASELINE.toFixed(3)};
  float hmax = base * ${HEIGHT.toFixed(3)};
  float r = abs(x1 - x0) * 0.5;
  float h = hmax * pow(min(1.0, r / (uSize.x * 0.5)), ${SHAPE.toFixed(3)});
  float px = mix(x0, x1, t);
  float py = base - h * sin(PI * t) - uLift;
  gl_Position = vec4(px / uSize.x * 2.0 - 1.0, 1.0 - py / uSize.y * 2.0, 0.0, 1.0);
  float reach = clamp(log(1.0 + abs(aEdge.y - aEdge.x) * 400.0) / log(401.0), 0.0, 1.0);
  float cls = mod(aEdge.w, 4.0);
  vec3 c;
  if (uMode == 0) c = spectrum(min(aEdge.x, aEdge.y));
  else if (uMode == 2) c = uGenre[int(floor(aEdge.w / 4.0 + 0.01))];
  else c = cls < 0.5 ? uReach[0] : (cls < 1.5 ? mix(uReach[1], uReach[2], reach) : uReach[3]);
  float w = clamp(log(max(aEdge.z, 1.0)) / log(150.0), 0.0, 1.0);
  float a = (0.25 + 0.75 * w) * uIntensity;
  vColor = vec4(c * a, a);${
    focus
      ? `
  vS = t;
  vX = mix(aEdge.x, aEdge.y, t);
  float g = clamp((uTime - aAnim.x) / max(aAnim.y, 1e-4), 0.0, 1.0);
  vGrow = 1.0 - (1.0 - g) * (1.0 - g);`
      : ''
  }
}`;

const ACCUM_FS = `#version 300 es
precision highp float;
in vec4 vColor;
out vec4 o;
void main() { o = vColor; }`;

const FOCUS_FS = `#version 300 es
precision highp float;
in vec4 vColor;
in float vS;
in float vX;
flat in float vGrow;
uniform float uGrowOn;   // 1 while light grows out from each arc's start
uniform float uFront;    // sweep front in canon units (far right when there is none)
uniform float uSoft;     // width of the sweep's soft edge
uniform float uPulse;    // centre of the pulse along the arc (far off when there is none)
uniform float uFade;     // opacity of the whole set
out vec4 o;
void main() {
  float a = 1.0 - smoothstep(uFront - uSoft, uFront, vX);
  float glow = 0.0;
  if (uGrowOn > 0.5) {
    // The light grows from the arc's start behind a soft, brighter tip.
    float tip = vGrow * 1.08;
    a *= 1.0 - smoothstep(tip - 0.08, tip, vS);
    float d = (vS - tip + 0.045) / 0.035;
    glow += (1.0 - vGrow) * 1.4 * exp(-d * d);
  }
  float p = (vS - uPulse) / 0.075;
  glow += 0.9 * exp(-p * p);
  float k = a * uFade;
  o = vec4(min(vColor.rgb * k * (1.0 + glow), vec3(1.0)), min(vColor.a * k * (1.0 + 0.6 * glow), 1.0));
}`;

const TONE_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const TONE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uExposure;
uniform float uDim;
uniform vec3 uBg;      // zenith
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uBase;   // baseline height in uv (0 at the bottom)
uniform float uPx;     // device pixels per CSS pixel
uniform float uStars;  // brightness of the brightest star (0: none)
uniform float uFront;  // opening reveal: its front in uv.x (far right once the sky is drawn)
out vec4 o;

// PCG 2D hash (Jarzynski and Olano, "Hash Functions for GPU Rendering", 2020).
uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}

// Fixed stars: at most one in each 9 px cell, more of them toward the zenith
// and none at the horizon. Mostly faint, a few brighter.
float star(vec2 frag, float above) {
  float cell = 9.0 * uPx;
  vec2 c = floor(frag / cell);
  uvec2 h = pcg2d(uvec2(c));
  vec4 r = vec4(h.x & 65535u, h.x >> 16u, h.y & 65535u, h.y >> 16u) / 65535.0;
  if (r.x > 0.2 * smoothstep(0.06, 0.9, above)) return 0.0;
  vec2 at = (c + 0.2 + 0.6 * r.yz) * cell;
  float d = length(frag - at) / uPx;
  return (0.65 + 0.35 * r.w * r.w * r.w) * exp(-0.55 * d * d);
}

void main() {
  // Hue-preserving tone map: compress the brightest channel and scale the
  // others with it, so dense regions glow in their own color instead of
  // washing out to white. Only the very densest cores get a touch of white.
  vec3 a = texture(uTex, vUv).rgb * uExposure;
  float peak = max(max(a.r, a.g), a.b);
  vec3 c = peak > 0.0 ? a / peak * (1.0 - exp(-peak)) : vec3(0.0);
  c = mix(c, vec3(1.0), smoothstep(2.5, 9.0, peak) * 0.35);
  // The opening reveal uncovers the light left to right, with a brighter
  // band just behind its front, like ink still wet.
  float behind = uFront - vUv.x;
  float e = (behind - ${REVEAL_EDGE.toFixed(4)}) / ${(REVEAL_EDGE * 0.5).toFixed(4)};
  c *= smoothstep(0.0, ${REVEAL_EDGE.toFixed(4)}, behind) * (1.0 + 0.35 * exp(-e * e));
  float above = clamp((vUv.y - uBase) / (1.0 - uBase), 0.0, 1.0);
  vec3 sky = mix(uHorizon, uBg, pow(above, 0.7));
  sky += uGlow * exp(-abs(vUv.y - uBase) * 18.0) * 0.35;
  sky += vec3(0.86, 0.9, 1.0) * star(gl_FragCoord.xy, above) * uStars;
  vec3 col = sky + c * uDim * (vec3(1.0) - sky);
  // A soft vignette, felt mostly in the corners.
  vec2 q = (vUv - vec2(0.5, 0.56)) * vec2(1.0, 0.9);
  col *= 1.0 - 0.3 * smoothstep(0.38, 0.9, length(q));
  o = vec4(col, 1.0);
}`;

// ------------------------------------------------------------ programs

interface Program {
  p: WebGLProgram;
  /** Uniform locations, looked up once (arrays under their bare name). */
  u: Record<string, WebGLUniformLocation | null>;
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('WebGL could not create a program.');
  const shaders: WebGLShader[] = [];
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader error');
    gl.attachShader(p, s);
    shaders.push(s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link error');
  for (const s of shaders) {
    gl.detachShader(p, s);
    gl.deleteShader(s);
  }
  return p;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const p = compile(gl, vs, fs);
  const u: Program['u'] = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (info) u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

/** Uniforms that never change, set once per program. */
function setConstants(gl: WebGL2RenderingContext, P: Program): void {
  gl.useProgram(P.p);
  const u = P.u;
  if (u.uSeg !== undefined) gl.uniform1f(u.uSeg, SEGMENTS);
  if (u.uReach !== undefined) gl.uniform3fv(u.uReach, [ARC.sameBook, ARC.near, ARC.far, ARC.testaments].flatMap(rgb));
  if (u.uSpec !== undefined) gl.uniform3fv(u.uSpec, SPECTRUM.flatMap(rgb));
  if (u.uGenre !== undefined) gl.uniform3fv(u.uGenre, GENRE_IDS.map((g) => GENRE[g].color).flatMap(rgb));
  if (u.uTex !== undefined) gl.uniform1i(u.uTex, 0);
  if (u.uHorizon !== undefined) gl.uniform3fv(u.uHorizon, rgb(SKY.horizon));
  if (u.uGlow !== undefined) gl.uniform3fv(u.uGlow, rgb(SKY.glow));
  if (u.uBase !== undefined) gl.uniform1f(u.uBase, 1 - BASELINE);
}

// ------------------------------------------------------------ instances

/** Per-edge instance data: x0, x1, votes, and class (0 same book, 1 same
 *  testament, 2 across testaments) plus 4 × the source book's genre index. */
export function edgeInstances(a: Atlas, xs: Float32Array, edges?: ArrayLike<number>): Float32Array {
  const count = edges ? edges.length : a.xDst.length;
  const out = new Float32Array(count * 4);
  const ntStart = a.books.find((b) => b.testament === 'NT')!.start;
  const genre = a.books.map((b) => Math.max(0, GENRE_IDS.indexOf(b.genre)));
  for (let i = 0; i < count; i++) {
    const e = edges ? edges[i] : i;
    const s = a.xSrc[e];
    const d = a.xDst[e];
    out[4 * i] = xs[s];
    out[4 * i + 1] = xs[d];
    out[4 * i + 2] = a.xVotes[e];
    const cls = a.verseBook[s] === a.verseBook[d] ? 0 : (s < ntStart) === (d < ntStart) ? 1 : 2;
    out[4 * i + 3] = cls + 4 * genre[a.verseBook[s]];
  }
  return out;
}

/** The instances in vote buckets, strongest first, each bucket in canon
 *  order of its arcs' left ends (a stable counting sort: ties keep their
 *  order). `ends[j]` is where bucket j stops. */
function sortForDrawing(src: Float32Array): { data: Float32Array; ends: number[] } {
  const n = src.length >> 2;
  // 2^18 steps across the canon is finer than one verse (about 1/33,700), so
  // every bin holds arcs that start at the same verse.
  const BINS = 1 << 18;
  const key = new Uint32Array(n);
  const start = new Uint32Array(BUCKET_MIN.length * BINS + 1);
  const sizes = BUCKET_MIN.map(() => 0);
  for (let i = 0; i < n; i++) {
    const v = src[4 * i + 2];
    let b = 0;
    while (b < BUCKET_MIN.length - 1 && v < BUCKET_MIN[b]) b++;
    const x = Math.min(src[4 * i], src[4 * i + 1]);
    const q = Math.min(BINS - 1, Math.max(0, Math.floor(x * BINS)));
    key[i] = b * BINS + q;
    start[key[i] + 1]++;
    sizes[b]++;
  }
  for (let k = 1; k < start.length; k++) start[k] += start[k - 1];
  const data = new Float32Array(src.length);
  for (let i = 0; i < n; i++) {
    const d = 4 * start[key[i]]++;
    data[d] = src[4 * i];
    data[d + 1] = src[4 * i + 1];
    data[d + 2] = src[4 * i + 2];
    data[d + 3] = src[4 * i + 3];
  }
  let sum = 0;
  return { data, ends: sizes.map((s) => (sum += s)) };
}

/** A cheap fingerprint of a set of instances, so an identical set (sent again
 *  because some other signal changed) never restarts its animation. */
function fingerprint(f: Float32Array): string {
  let x0 = 0;
  let x1 = 0;
  let votes = 0;
  for (let i = 0; i < f.length; i += 4) {
    x0 += f[i];
    x1 += f[i + 1];
    votes += f[i + 2];
  }
  return `${f.length >> 2}:${x0}:${x1}:${votes}`;
}

/** The per-arc base intensity for a vote filter. Fewer arcs pass at high
 *  thresholds, so each one is brightened to keep roughly the same exposure. */
function baseIntensity(minVotes: number): number {
  return Math.min(0.5, 0.03 * Math.sqrt(Math.max(1, minVotes) / 4));
}

/** How much the faintest arc that passes the filter lifts the sky, after tone mapping (mirrors the shaders). */
function faintestArc(minVotes: number, exposure: number): number {
  const v = Math.max(1, minVotes);
  const w = Math.min(1, Math.log(v) / Math.log(150));
  const a = (0.25 + 0.75 * w) * baseIntensity(minVotes) * DIMMEST_HUE;
  return 1 - Math.exp(-a * exposure);
}

// ------------------------------------------------------------ focus sets

/** What a focus set shows, in the order AtlasMap's focus effect picks it:
 *  the hovered verse, then the path, then the selected verse, then a group
 *  (a theme, a word or a neighborhood). If that order changes there, change it here. */
type Kind = 'hover' | 'path' | 'verse' | 'group';

function focusKind(): Kind {
  if (S.hovered.peek() !== null) return 'hover';
  if (S.path.peek()) return 'path';
  if (S.selected.peek() !== null) return 'verse';
  return 'group';
}

const positions = new WeakMap<Atlas, Float32Array>();

/** Map position of the current path's first verse, if there is a path. */
function pathStart(): number | null {
  const p = S.path.peek();
  const a = S.atlas.peek();
  if (!p || !a || !p.verses.length) return null;
  let xs = positions.get(a);
  if (!xs) positions.set(a, (xs = verseX(a)));
  return xs[p.verses[0]];
}

/** The x every instance shares (the hovered or selected verse), if there is one. */
function sharedEnd(f: Float32Array): number | null {
  for (const c of [f[0], f[1]]) {
    let all = true;
    for (let i = 0; i < f.length && all; i += 4) all = f[i] === c || f[i + 1] === c;
    if (all) return c;
  }
  return null;
}

function swapEnds(f: Float32Array, i: number): void {
  const t = f[4 * i];
  f[4 * i] = f[4 * i + 1];
  f[4 * i + 1] = t;
}

interface Plan {
  /** The instances, turned so each arc's light starts at x0 (the shape and color are unchanged). */
  data: Float32Array;
  /** Per arc: delay and grow time, in seconds. */
  anim: Float32Array;
  /** The shared verse's x, for a verse or a hover. */
  anchor: number | null;
  /** The set's extent on the canon. */
  lo: number;
  hi: number;
  /** When its entrance is over, in seconds from its start. */
  growEnd: number;
}

function plan(src: Float32Array, kind: Kind): Plan {
  const data = src.slice();
  const n = data.length >> 2;
  const anim = new Float32Array(2 * n);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < data.length; i += 4) {
    lo = Math.min(lo, data[i], data[i + 1]);
    hi = Math.max(hi, data[i], data[i + 1]);
  }
  let anchor: number | null = null;
  let growEnd = HOVER_FADE;
  if (kind === 'hover' || kind === 'verse') {
    anchor = sharedEnd(data);
    if (anchor !== null) for (let i = 0; i < n; i++) if (data[4 * i] !== anchor) swapEnds(data, i);
    if (kind === 'verse') {
      // Strongest first: the delay falls with log votes, relative to the set's strongest link.
      let top = 2;
      for (let i = 0; i < n; i++) top = Math.max(top, data[4 * i + 2]);
      for (let i = 0; i < n; i++) {
        anim[2 * i] = (1 - clamp01(Math.log(Math.max(1, data[4 * i + 2])) / Math.log(top))) * VERSE_STAGGER;
        anim[2 * i + 1] = VERSE_GROW;
      }
      growEnd = VERSE_PULSE_AT;
    }
  } else if (kind === 'path') {
    // Instances arrive in path order. Each step grows from the verse it
    // shares with the step before; the first from the path's first verse.
    const first = pathStart();
    if (first !== null) {
      if (data[0] !== first && data[1] === first) swapEnds(data, 0);
    } else if (n > 1 && (data[0] === data[4] || data[0] === data[5])) swapEnds(data, 0);
    for (let i = 1; i < n; i++) {
      const from = data[4 * (i - 1) + 1];
      if (data[4 * i] !== from && data[4 * i + 1] === from) swapEnds(data, i);
    }
    for (let i = 0; i < n; i++) {
      anim[2 * i] = i * PATH_STEP;
      anim[2 * i + 1] = PATH_GROW;
    }
    growEnd = (n - 1) * PATH_STEP + PATH_GROW;
  } else growEnd = SWEEP;
  return { data, anim, anchor, lo, hi, growEnd };
}

/** One of the two focus buffers: the set on show, or the one fading out. */
interface Layer {
  vao: WebGLVertexArrayObject | null;
  edgeBuf: WebGLBuffer | null;
  animBuf: WebGLBuffer | null;
  /** Kept so a restored context can upload them again. */
  data: Float32Array;
  anim: Float32Array;
  count: number;
  key: string;
  kind: Kind;
  /** False for a set seen just before (back from a hover): it only fades in. */
  entrance: boolean;
  anchor: number | null;
  lo: number;
  hi: number;
  growEnd: number;
  /** When it began; null while a verse waits for the opening reveal to reach it. */
  start: number | null;
  /** When its pulse began, if it has one. */
  pulseAt: number | null;
  /** When it began to fade out, and from what opacity. */
  retired: number | null;
  fadeFrom: number;
}

/** How a layer draws on one frame. */
interface Look {
  fade: number;
  grow: number;
  time: number;
  front: number;
  soft: number;
  pulse: number;
}

const STILL: Look = { fade: 1, grow: 0, time: 0, front: 1e3, soft: 1e-3, pulse: -1e3 };

// ------------------------------------------------------------ the page

/** Every field made on this page, so ones whose canvas has gone can be freed. */
const fields = new Set<ArcField>();
/** Only the page's first map plays the long reveal. */
let firstField = true;
let lightPage = false;
let watching = false;

/** Follow the page theme: on the light theme the stars all but vanish. */
function watchPage(): void {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  const dark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const read = () => {
    const t = document.documentElement.dataset.theme;
    return t === 'light' || (t !== 'dark' && !dark?.matches);
  };
  lightPage = read();
  const update = () => {
    const next = read();
    if (next === lightPage) return;
    lightPage = next;
    for (const f of fields) f.request(false);
  };
  dark?.addEventListener?.('change', update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// ------------------------------------------------------------ the field

export interface ArcOptions {
  minVotes: number;
  exposure: number;
  colorMode: ArcColorMode;
  /** Background color in linear 0..1 RGB. */
  background: [number, number, number];
}

interface Reveal {
  duration: number;
  /** When it began: on the field's first frame. */
  start: number | null;
  /** The soft front, in canvas widths (0 at the left edge). */
  front: number;
  /** Per vote bucket, the instances already added to the HDR target. */
  drawn: number[];
}

export class ArcField {
  view: View = { scale: 1, offset: 0 };
  opts: ArcOptions = { minVotes: 8, exposure: 1.15, colorMode: 'spectrum', background: rgb(SKY.top) };
  /** The dim the sky is easing toward (1: none). */
  dim = 1;
  /** Milliseconds the last frame took to issue (CPU side). */
  lastDrawMs = 0;

  private gl: WebGL2RenderingContext;
  private hdr = false;
  private lost = false;
  private disposed = false;
  /** Whether the canvas has been on the page; only then does leaving it free the field. */
  private attached: boolean;
  private accumProg: Program | null = null;
  private focusProg: Program | null = null;
  private toneProg: Program | null = null;
  private allVao: WebGLVertexArrayObject | null = null;
  private allBuf: WebGLBuffer | null = null;
  /** All instances in vote buckets (kept to rebuild a restored context). */
  private data: Float32Array;
  private ends: number[];
  private tex: WebGLTexture | null = null;
  private fbo: WebGLFramebuffer | null = null;
  private targetId = 0;
  private dirtyAccum = true;
  /** What the HDR target holds: an identical accumulate is skipped. */
  private accumKey = '';
  private reveal: Reveal | null = null;
  private layers: Layer[] = [];
  private cur: Layer | null = null;
  private prev: Layer | null = null;
  private dimFx: { from: number; start: number | null } | null = null;
  /** Per kind, the last set that played its entrance (a set coming back only fades in). */
  private played = new Map<Kind, string>();
  private lastSelected: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    instances: Float32Array,
  ) {
    // AtlasMap makes a field on every mount and never frees the last one, so
    // free here every field whose canvas has left the page. This caps the
    // live WebGL contexts at the current map (plus one, while on the Wheel).
    for (const f of [...fields]) {
      if (f.canvas === canvas) f.teardown(false);
      else if (f.attached && !f.canvas.isConnected) f.teardown(true);
    }
    const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false, alpha: false });
    if (!gl) throw new Error('This browser does not support WebGL2.');
    this.gl = gl;
    const sorted = sortForDrawing(instances);
    this.data = sorted.data;
    this.ends = sorted.ends;
    this.attached = canvas.isConnected;
    if (!gl.isContextLost()) this.build();
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    if (this.animated()) this.reveal = { duration: firstField ? REVEAL_FIRST : REVEAL_AGAIN, start: null, front: 0, drawn: [] };
    firstField = false;
    fields.add(this);
    watchPage();
    this.mark('drawn', '0');
  }

  get usesHdr(): boolean {
    return this.hdr;
  }

  /** Show these arcs bright on top, or none. The set's entrance follows what
   *  it is: see focusKind(). */
  setFocus(instances: Float32Array | null): void {
    if (this.disposed) return;
    const t = now();
    const sel = S.selected.peek();
    const picked = sel !== this.lastSelected;
    this.lastSelected = sel;
    if (!instances || instances.length < 4) {
      this.retire(t);
      this.played.clear();
      this.mark('focus', '');
      this.request(false);
      return;
    }
    const key = fingerprint(instances);
    const cur = this.cur;
    if (cur && cur.key === key) {
      // The same arcs, sent again because another signal changed: keep their
      // animation. Clicking the verse that hovering already lit sends one
      // pulse out along its links instead of growing them again.
      if (picked && sel !== null && sel === S.hovered.peek() && cur.anchor !== null && cur.start !== null && this.animated()) {
        cur.pulseAt = t;
        this.played.set('verse', key);
      }
      this.request(false);
      return;
    }
    const kind = focusKind();
    const p = plan(instances, kind);
    this.retire(t);
    const L = this.layers.find((l) => l !== this.prev)!;
    L.data = p.data;
    L.anim = p.anim;
    L.count = p.data.length >> 2;
    L.key = key;
    L.kind = kind;
    L.entrance = kind !== 'hover' && this.played.get(kind) !== key;
    L.anchor = p.anchor;
    L.lo = p.lo;
    L.hi = p.hi;
    L.growEnd = L.entrance ? p.growEnd : HOVER_FADE;
    L.retired = null;
    L.fadeFrom = 1;
    L.pulseAt = null;
    // On the first visit PR #1 selects a verse as the page opens: its links
    // grow when the opening reveal reaches it.
    const wait = L.entrance && kind === 'verse' && L.anchor !== null && !this.revealPassed(L.anchor);
    L.start = null;
    if (!wait) this.begin(L, t);
    this.upload(L);
    this.cur = L;
    this.mark('focus', wait ? `${kind} waiting` : kind);
    this.request(false);
  }

  setView(v: View): void {
    if (this.disposed) return;
    const changed = v.scale !== this.view.scale || v.offset !== this.view.offset;
    this.view = v;
    if (changed) this.interrupt();
    this.request(changed);
  }

  setOptions(o: Partial<ArcOptions>): void {
    if (this.disposed) return;
    const accum = (o.minVotes !== undefined && o.minVotes !== this.opts.minVotes) || (o.colorMode !== undefined && o.colorMode !== this.opts.colorMode);
    this.opts = { ...this.opts, ...o };
    if (accum) this.interrupt();
    this.request(accum);
  }

  setDim(d: number): void {
    if (this.disposed || d === this.dim) return;
    const t = now();
    const from = this.dimAt(t);
    this.dim = d;
    // A verse still waiting for the reveal dims the sky when its links appear.
    this.dimFx = this.animated() ? { from, start: this.cur && this.cur.start === null ? null : t } : null;
    this.request(false);
  }

  resize(): void {
    if (this.disposed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.allocTarget();
      this.interrupt();
      this.request(true);
    }
  }

  /** Schedule a redraw on the next animation frame. */
  request(accum: boolean): void {
    if (this.disposed) return;
    // While the reveal runs it is redrawing pass 1 anyway.
    if (accum && !this.reveal) this.dirtyAccum = true;
    if (!this.lost) wake(this.tick);
  }

  /** Draw one complete, settled frame now: the whole sky, every focused arc
   *  fully lit, the dim at its target. Read the canvas (drawImage, toBlob,
   *  readPixels) before returning to the event loop, since the browser may
   *  clear it once the frame is shown. Animations carry on afterwards. For
   *  Phase 2's share image. */
  renderSettled(): void {
    if (this.disposed || this.lost) return;
    this.finishReveal();
    this.render(now(), true);
  }

  /** Free the WebGL context now. A new field also frees the old ones whose canvas has left the page. */
  dispose(): void {
    this.teardown(true);
  }

  // ---------------------------------------------------------- frames

  private tick = (t: number): boolean => {
    if (this.disposed || this.lost) return false;
    if (this.canvas.isConnected) this.attached = true;
    // A canvas that has left the page needs no more frames.
    else if (this.attached) return false;
    const settled = !this.animated();
    if (settled) this.stopMotion(t);
    this.render(t, settled);
    const more = !settled && this.busy(t);
    this.mark('anim', more ? '1' : '0');
    return more;
  };

  private animated(): boolean {
    return this.hdr && !reducedMotion();
  }

  /** Reduced motion was switched on mid-animation: jump to the finished picture. */
  private stopMotion(t: number): void {
    this.finishReveal();
    if (this.cur) {
      this.cur.start ??= t - 1e3;
      this.cur.pulseAt = null;
    }
    this.prev = null;
    this.dimFx = null;
  }

  /** Draw passes 1 to 3 for time t. Settled: the finished picture, no motion. */
  private render(t: number, settled: boolean): void {
    const gl = this.gl;
    if (!this.accumProg || !this.focusProg || !this.toneProg) return;
    const t0 = performance.now();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    if (this.hdr && this.fbo && this.tex) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      if (this.reveal) this.advanceReveal(t);
      else if (this.dirtyAccum) this.accumulate();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.startWaiting(t);
      gl.disable(gl.BLEND);
      this.tone(settled ? this.dim : this.dimAt(t));
      gl.enable(gl.BLEND);
    } else {
      // No float render targets: draw straight to the screen, without motion.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const [br, bg, bb] = this.opts.background;
      const [hr, hg, hb] = rgb(SKY.horizon);
      gl.clearColor((br + hr) / 2, (bg + hg) / 2, (bb + hb) / 2, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.useArcs(this.accumProg, this.opts.minVotes, baseIntensity(this.opts.minVotes) * 0.6 * this.dim, 0);
      gl.bindVertexArray(this.allVao);
      this.drawRange(0, this.prefixEnd());
      gl.bindVertexArray(null);
      this.mark('drawn', String(this.prefixEnd()));
    }
    // Premultiplied "over" blending keeps each focused arc's true color.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (this.prev && !settled) this.drawFocus(this.prev, this.look(this.prev, t, false));
    if (this.cur) this.drawFocus(this.cur, this.look(this.cur, t, settled));
    this.lastDrawMs = performance.now() - t0;
  }

  /** Whether anything still moves after the frame drawn at time t. */
  private busy(t: number): boolean {
    let more = !!this.reveal;
    if (this.dimFx) {
      if (this.dimFx.start === null || t - this.dimFx.start < DIM_EASE) more = true;
      else this.dimFx = null;
    }
    const c = this.cur;
    if (c && (c.start === null || t - c.start < c.growEnd || (c.pulseAt !== null && t - c.pulseAt < VERSE_PULSE))) more = true;
    if (this.prev) {
      if (this.prev.retired !== null && t - this.prev.retired < RETIRE_FADE) more = true;
      else this.prev = null;
    }
    return more;
  }

  // ---------------------------------------------------------- pass 1

  /** Where the issued instances stop: every bucket down to the one that holds opts.minVotes. */
  private prefixEnd(): number {
    return this.ends[this.prefixBuckets() - 1];
  }

  private prefixBuckets(): number {
    let j = 0;
    while (j < BUCKET_MIN.length - 1 && BUCKET_MIN[j] > this.opts.minVotes) j++;
    return j + 1;
  }

  /** Everything pass 1 depends on. */
  private inputs(): string {
    const v = this.view;
    return `${this.canvas.width}x${this.canvas.height} ${v.scale} ${v.offset} ${this.opts.minVotes} ${this.opts.colorMode} ${this.targetId}`;
  }

  /** Redraw the whole sky into the HDR target, unless it already holds this picture. */
  private accumulate(): void {
    this.dirtyAccum = false;
    const key = this.inputs();
    if (key === this.accumKey) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.useArcs(this.accumProg!, this.opts.minVotes, baseIntensity(this.opts.minVotes), 0);
    gl.bindVertexArray(this.allVao);
    const end = this.prefixEnd();
    this.drawRange(0, end);
    gl.bindVertexArray(null);
    this.accumKey = key;
    this.mark('drawn', String(end));
  }

  /** One frame of the opening reveal: add each bucket's next slice of the canon. */
  private advanceReveal(t: number): void {
    const r = this.reveal!;
    const gl = this.gl;
    const buckets = this.prefixBuckets();
    if (r.start === null) {
      r.start = t;
      r.drawn = this.ends.slice(0, buckets).map((_, j) => (j ? this.ends[j - 1] : 0));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    const q = clamp01((t - r.start) / r.duration);
    r.front = easeInOut(q) * (1 + 3 * REVEAL_EDGE);
    // Everything that starts left of the front, in canon units.
    const canon = this.view.offset + r.front / this.view.scale;
    this.useArcs(this.accumProg!, this.opts.minVotes, baseIntensity(this.opts.minVotes), 0);
    gl.bindVertexArray(this.allVao);
    for (let j = 0; j < buckets; j++) {
      const end = q >= 1 ? this.ends[j] : this.lowerBound(r.drawn[j], this.ends[j], canon);
      if (end > r.drawn[j]) this.drawRange(r.drawn[j], end - r.drawn[j]);
      r.drawn[j] = Math.max(r.drawn[j], end);
    }
    gl.bindVertexArray(null);
    if (q >= 1) {
      this.reveal = null;
      this.dirtyAccum = false;
      this.accumKey = this.inputs();
      this.mark('drawn', String(this.prefixEnd()));
    }
  }

  /** First instance in [lo, hi) whose arc starts at or after canon position x. */
  private lowerBound(lo: number, hi: number, x: number): number {
    const d = this.data;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (Math.min(d[4 * mid], d[4 * mid + 1]) < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** The reveal has drawn the sky at least as far as canon position x (or there is no reveal). */
  private revealPassed(x: number): boolean {
    const r = this.reveal;
    if (!r) return true;
    return r.start !== null && this.view.offset + (r.front - REVEAL_EDGE) / this.view.scale >= x;
  }

  /** Stop the reveal: the next frame draws the whole sky at once. */
  private finishReveal(): void {
    if (!this.reveal) return;
    this.reveal = null;
    this.dirtyAccum = true;
    this.accumKey = '';
  }

  /** The view, the size or the filter changed after the reveal began: show everything now. */
  private interrupt(): void {
    if (this.reveal && this.reveal.start !== null) this.finishReveal();
  }

  /** Start a set's entrance (a verse's pulse follows its grow). */
  private begin(L: Layer, t: number): void {
    L.start = t;
    if (L.entrance) {
      if (L.kind === 'verse') L.pulseAt = t + VERSE_PULSE_AT;
      this.played.set(L.kind, L.key);
    }
  }

  /** Start a verse that waited for the reveal once the reveal reaches it. The
   *  dim waits with it, and eases in as soon as nothing waits any more. */
  private startWaiting(t: number): void {
    const c = this.cur;
    if (c && c.start === null && (c.anchor === null || this.revealPassed(c.anchor))) {
      this.begin(c, t);
      this.mark('focus', c.kind);
    }
    if (this.dimFx && this.dimFx.start === null && !(this.cur && this.cur.start === null)) this.dimFx.start = t;
  }

  /** Re-point the instance attribute at `first` (WebGL2 has no base instance) and draw `count` arcs. */
  private drawRange(first: number, count: number): void {
    if (count <= 0) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.allBuf);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, first * 16);
    gl.drawArraysInstanced(gl.LINE_STRIP, 0, SEGMENTS + 1, count);
  }

  private useArcs(P: Program, minVotes: number, intensity: number, lift: number): void {
    const gl = this.gl;
    const u = P.u;
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth);
    gl.useProgram(P.p);
    gl.uniform2f(u.uView, this.view.scale, this.view.offset);
    gl.uniform2f(u.uSize, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uMinVotes, minVotes);
    gl.uniform1f(u.uIntensity, intensity);
    gl.uniform1f(u.uLift, lift * dpr);
    gl.uniform1i(u.uMode, MODES[this.opts.colorMode]);
  }

  // ---------------------------------------------------------- pass 2

  private tone(dim: number): void {
    const gl = this.gl;
    const u = this.toneProg!.u;
    gl.useProgram(this.toneProg!.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1f(u.uExposure, this.opts.exposure);
    gl.uniform1f(u.uDim, dim);
    const [br, bg, bb] = this.opts.background;
    gl.uniform3f(u.uBg, br, bg, bb);
    gl.uniform1f(u.uPx, this.canvas.width / Math.max(1, this.canvas.clientWidth));
    const stars = Math.min(STAR_MAX, STAR_SHARE * faintestArc(this.opts.minVotes, this.opts.exposure)) * (lightPage ? STARS_ON_LIGHT : 1);
    gl.uniform1f(u.uStars, stars * dim);
    gl.uniform1f(u.uFront, this.reveal ? this.reveal.front : 1e3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private dimAt(t: number): number {
    const fx = this.dimFx;
    if (!fx) return this.dim;
    if (fx.start === null) return fx.from;
    const k = easeOut((t - fx.start) / DIM_EASE);
    return fx.from + (this.dim - fx.from) * k;
  }

  // ---------------------------------------------------------- pass 3

  /** Move the set on show to the fading-out slot. */
  private retire(t: number): void {
    const c = this.cur;
    this.cur = null;
    if (!c || c.start === null || !this.animated()) return;
    const fade = this.look(c, t, false).fade;
    if (fade <= 0.01) return;
    c.fadeFrom = fade;
    c.retired = t;
    this.prev = c;
  }

  private look(L: Layer, t: number, settled: boolean): Look {
    if (settled) return STILL;
    const k = { ...STILL };
    if (L.start === null) return { ...k, fade: 0 };
    const e = t - L.start;
    if (!L.entrance || L.kind === 'hover') k.fade = easeOut(e / HOVER_FADE);
    else if (L.kind === 'group') {
      if (e < SWEEP) {
        const span = Math.max(L.hi - L.lo, 1e-4);
        k.soft = span * SWEEP_EDGE;
        k.front = L.lo + easeInOut(e / SWEEP) * (span + k.soft);
      }
    } else if (e < L.growEnd) {
      k.grow = 1;
      k.time = e;
    }
    if (L.pulseAt !== null) {
      const p = (t - L.pulseAt) / VERSE_PULSE;
      if (p >= 0 && p < 1) k.pulse = -0.15 + 1.3 * p;
    }
    if (L.retired !== null) k.fade = L.fadeFrom * (1 - easeOut((t - L.retired) / RETIRE_FADE));
    return k;
  }

  private drawFocus(L: Layer, k: Look): void {
    if (k.fade <= 0.002 || !L.count) return;
    const gl = this.gl;
    const P = this.focusProg!;
    const u = P.u;
    const strength = L.count > 2000 ? 0.3 : L.count > 300 ? 0.55 : 0.9;
    this.useArcs(P, -1e9, strength, 0);
    gl.uniform1f(u.uTime, k.time);
    gl.uniform1f(u.uGrowOn, k.grow);
    gl.uniform1f(u.uFront, k.front);
    gl.uniform1f(u.uSoft, k.soft);
    gl.uniform1f(u.uPulse, k.pulse);
    gl.uniform1f(u.uFade, k.fade);
    gl.bindVertexArray(L.vao);
    gl.drawArraysInstanced(gl.LINE_STRIP, 0, SEGMENTS + 1, L.count);
    // A second pass lifted by 0.7 px makes the focused lines read thicker.
    gl.uniform1f(u.uIntensity, strength * 0.7);
    gl.uniform1f(u.uLift, 0.7 * (this.canvas.width / Math.max(1, this.canvas.clientWidth)));
    gl.drawArraysInstanced(gl.LINE_STRIP, 0, SEGMENTS + 1, L.count);
    gl.bindVertexArray(null);
  }

  private upload(L: Layer): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, L.edgeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, L.data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, L.animBuf);
    gl.bufferData(gl.ARRAY_BUFFER, L.anim, gl.DYNAMIC_DRAW);
  }

  // ---------------------------------------------------------- GL resources

  /** Create the programs, buffers and HDR target: on construction and after a restored context. */
  private build(): void {
    const gl = this.gl;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    this.accumProg = program(gl, arcVs(false), ACCUM_FS);
    this.focusProg = program(gl, arcVs(true), FOCUS_FS);
    this.toneProg = program(gl, TONE_VS, TONE_FS);
    for (const P of [this.accumProg, this.focusProg, this.toneProg]) setConstants(gl, P);
    this.allVao = gl.createVertexArray();
    this.allBuf = gl.createBuffer();
    gl.bindVertexArray(this.allVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.allBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(0, 1);
    if (!this.layers.length) {
      for (let i = 0; i < 2; i++) {
        this.layers.push({
          vao: null,
          edgeBuf: null,
          animBuf: null,
          data: new Float32Array(0),
          anim: new Float32Array(0),
          count: 0,
          key: '',
          kind: 'group',
          entrance: false,
          anchor: null,
          lo: 0,
          hi: 1,
          growEnd: 0,
          start: null,
          pulseAt: null,
          retired: null,
          fadeFrom: 1,
        });
      }
    }
    for (const L of this.layers) {
      L.vao = gl.createVertexArray();
      L.edgeBuf = gl.createBuffer();
      L.animBuf = gl.createBuffer();
      gl.bindVertexArray(L.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.edgeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, L.data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
      gl.vertexAttribDivisor(0, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.animBuf);
      gl.bufferData(gl.ARRAY_BUFFER, L.anim, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8, 0);
      gl.vertexAttribDivisor(1, 1);
    }
    gl.bindVertexArray(null);
    this.tex = null;
    this.fbo = null;
    this.allocTarget();
  }

  private allocTarget(): void {
    const gl = this.gl;
    if (!this.hdr || this.lost || !this.accumProg) return;
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    this.targetId++;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      // No float target after all: fall back to drawing straight to the screen.
      this.hdr = false;
      this.reveal = null;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private release(): void {
    const gl = this.gl;
    for (const P of [this.accumProg, this.focusProg, this.toneProg]) if (P) gl.deleteProgram(P.p);
    gl.deleteVertexArray(this.allVao);
    gl.deleteBuffer(this.allBuf);
    for (const L of this.layers) {
      gl.deleteVertexArray(L.vao);
      gl.deleteBuffer(L.edgeBuf);
      gl.deleteBuffer(L.animBuf);
    }
    gl.deleteTexture(this.tex);
    gl.deleteFramebuffer(this.fbo);
    this.accumProg = this.focusProg = this.toneProg = null;
    this.tex = this.fbo = null;
  }

  private onLost = (e: Event): void => {
    // Ask the browser to restore the context; until then nothing draws.
    e.preventDefault();
    this.lost = true;
    sleep(this.tick);
    this.mark('anim', '0');
  };

  private onRestored = (): void => {
    if (this.disposed) return;
    this.lost = false;
    try {
      this.build();
    } catch (err) {
      console.error(err);
      return;
    }
    // The visitor has seen this sky already: bring it straight back.
    this.reveal = null;
    this.accumKey = '';
    this.request(true);
  };

  /** Free everything; `lose` also gives the WebGL context back to the browser. */
  private teardown(lose: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    fields.delete(this);
    sleep(this.tick);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    if (!this.gl.isContextLost()) this.release();
    if (lose) this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.data = new Float32Array(0);
    this.layers = [];
    this.cur = this.prev = null;
  }

  private mark(name: 'drawn' | 'anim' | 'focus', value: string): void {
    if (this.canvas.dataset[name] !== value) this.canvas.dataset[name] = value;
  }
}
