// WebGL2 arc field.
//
// Pass 1 (accumulate): all ~344,000 cross-references are drawn as instanced
// line strips into a half-float framebuffer with additive blending, so light
// from overlapping arcs adds up instead of saturating.
// Pass 2 (tone map): the summed light is compressed with 1 - exp(-k·x), like
// an HDR photo, and composited over the night-sky background.
// Pass 3 (focus): the selected verse's or theme's arcs are drawn bright on top.
//
// Pass 1 only reruns when the view or the vote filter changes; hovering and
// selecting only rerun passes 2 and 3.

import type { Atlas } from '../data/atlas';
import { BASELINE, HEIGHT, SHAPE, type View } from './layout';

const SEGMENTS = 28;

const ARC_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aEdge;   // x0, x1 (normalized), votes, class
uniform vec2 uView;                   // scale, offset
uniform vec2 uSize;                   // canvas size in pixels
uniform float uSeg;
uniform float uMinVotes;
uniform float uIntensity;
uniform float uLift;                  // vertical offset in pixels (for thicker focus lines)
out vec4 vColor;
const float PI = 3.14159265;
const vec3 SAME_BOOK = vec3(0.27, 0.80, 0.68);
const vec3 NEAR = vec3(0.45, 0.60, 1.00);
const vec3 FAR = vec3(0.98, 0.74, 0.36);
const vec3 TESTAMENTS = vec3(0.90, 0.45, 0.66);
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
  vec3 c = aEdge.w < 0.5 ? SAME_BOOK : (aEdge.w < 1.5 ? mix(NEAR, FAR, reach) : TESTAMENTS);
  float w = clamp(log(max(aEdge.z, 1.0)) / log(150.0), 0.0, 1.0);
  float a = (0.25 + 0.75 * w) * uIntensity;
  vColor = vec4(c * a, a);
}`;

const ARC_FS = `#version 300 es
precision highp float;
in vec4 vColor;
out vec4 o;
void main() { o = vColor; }`;

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
uniform vec3 uBg;
out vec4 o;
void main() {
  // Hue-preserving tone map: compress the brightest channel and scale the
  // others with it, so dense regions glow in their own color instead of
  // washing out to white. Only the very densest cores get a touch of white.
  vec3 a = texture(uTex, vUv).rgb * uExposure;
  float peak = max(max(a.r, a.g), a.b);
  vec3 c = peak > 0.0 ? a / peak * (1.0 - exp(-peak)) : vec3(0.0);
  c = mix(c, vec3(1.0), smoothstep(2.5, 9.0, peak) * 0.35);
  o = vec4(uBg + c * uDim * (vec3(1.0) - uBg), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  return p;
}

/** Per-edge instance data: x0, x1, votes, class (0 same book, 1 same testament, 2 across testaments). */
export function edgeInstances(a: Atlas, xs: Float32Array, edges?: ArrayLike<number>): Float32Array {
  const count = edges ? edges.length : a.xDst.length;
  const out = new Float32Array(count * 4);
  const ntStart = a.books.find((b) => b.testament === 'NT')!.start;
  for (let i = 0; i < count; i++) {
    const e = edges ? edges[i] : i;
    const s = a.xSrc[e];
    const d = a.xDst[e];
    out[4 * i] = xs[s];
    out[4 * i + 1] = xs[d];
    out[4 * i + 2] = a.xVotes[e];
    out[4 * i + 3] = a.verseBook[s] === a.verseBook[d] ? 0 : (s < ntStart) === (d < ntStart) ? 1 : 2;
  }
  return out;
}

export interface ArcOptions {
  minVotes: number;
  exposure: number;
  /** Background color in linear 0..1 RGB. */
  background: [number, number, number];
}

export class ArcField {
  private gl: WebGL2RenderingContext;
  private arcProg: WebGLProgram;
  private toneProg: WebGLProgram;
  private allVao: WebGLVertexArrayObject;
  private focusVao: WebGLVertexArrayObject;
  private focusBuf: WebGLBuffer;
  private allCount: number;
  private focusCount = 0;
  private fbo: WebGLFramebuffer | null = null;
  private tex: WebGLTexture | null = null;
  private hdr: boolean;
  private dirtyAccum = true;
  private frame = 0;
  view: View = { scale: 1, offset: 0 };
  opts: ArcOptions = { minVotes: 8, exposure: 1.1, background: [0.047, 0.078, 0.157] };
  dim = 1;
  /** Milliseconds spent issuing the last full redraw (CPU side). */
  lastDrawMs = 0;

  constructor(private canvas: HTMLCanvasElement, instances: Float32Array) {
    const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false, alpha: false });
    if (!gl) throw new Error('This browser does not support WebGL2.');
    this.gl = gl;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    this.arcProg = compile(gl, ARC_VS, ARC_FS);
    this.toneProg = compile(gl, TONE_VS, TONE_FS);
    const make = (data: Float32Array | null, usage: number) => {
      const vao = gl.createVertexArray()!;
      const buf = gl.createBuffer()!;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      if (data) gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
      gl.vertexAttribDivisor(0, 1);
      gl.bindVertexArray(null);
      return { vao, buf };
    };
    this.allVao = make(instances, gl.STATIC_DRAW).vao;
    this.allCount = instances.length / 4;
    const f = make(null, gl.DYNAMIC_DRAW);
    this.focusVao = f.vao;
    this.focusBuf = f.buf;
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
  }

  get usesHdr(): boolean {
    return this.hdr;
  }

  setFocus(instances: Float32Array | null): void {
    const gl = this.gl;
    this.focusCount = instances ? instances.length / 4 : 0;
    if (instances && this.focusCount) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.focusBuf);
      gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW);
    }
    this.request(false);
  }

  setView(v: View): void {
    this.view = v;
    this.request(true);
  }

  setOptions(o: Partial<ArcOptions>): void {
    const accum = o.minVotes !== undefined && o.minVotes !== this.opts.minVotes;
    this.opts = { ...this.opts, ...o };
    this.request(accum || o.background !== undefined);
  }

  setDim(d: number): void {
    if (d !== this.dim) {
      this.dim = d;
      this.request(false);
    }
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.allocTarget();
      this.request(true);
    }
  }

  private allocTarget(): void {
    const gl = this.gl;
    if (!this.hdr) return;
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
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
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.hdr = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Schedule a redraw on the next animation frame. */
  request(accum: boolean): void {
    this.dirtyAccum ||= accum;
    if (!this.frame) this.frame = requestAnimationFrame(() => this.draw());
  }

  private drawArcs(vao: WebGLVertexArrayObject, count: number, intensity: number, lift = 0): void {
    const gl = this.gl;
    gl.useProgram(this.arcProg);
    const u = (n: string) => gl.getUniformLocation(this.arcProg, n);
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth);
    gl.uniform2f(u('uView'), this.view.scale, this.view.offset);
    gl.uniform2f(u('uSize'), this.canvas.width, this.canvas.height);
    gl.uniform1f(u('uSeg'), SEGMENTS);
    gl.uniform1f(u('uMinVotes'), vao === this.allVao ? this.opts.minVotes : -1e9);
    gl.uniform1f(u('uIntensity'), intensity);
    gl.uniform1f(u('uLift'), lift * dpr);
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.LINE_STRIP, 0, SEGMENTS + 1, count);
    gl.bindVertexArray(null);
  }

  private draw(): void {
    this.frame = 0;
    const t0 = performance.now();
    const gl = this.gl;
    const [br, bg, bb] = this.opts.background;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    // Fewer arcs pass the vote filter at high thresholds; brighten each one
    // so the overall picture keeps roughly the same exposure.
    const base = Math.min(0.5, 0.03 * Math.sqrt(Math.max(1, this.opts.minVotes) / 4));
    if (this.hdr && this.fbo && this.tex) {
      if (this.dirtyAccum) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.drawArcs(this.allVao, this.allCount, base);
        this.dirtyAccum = false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(this.toneProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(gl.getUniformLocation(this.toneProg, 'uTex'), 0);
      gl.uniform1f(gl.getUniformLocation(this.toneProg, 'uExposure'), this.opts.exposure);
      gl.uniform1f(gl.getUniformLocation(this.toneProg, 'uDim'), this.dim);
      gl.uniform3f(gl.getUniformLocation(this.toneProg, 'uBg'), br, bg, bb);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else {
      // No float render targets: draw straight to the screen.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(br, bg, bb, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.drawArcs(this.allVao, this.allCount, base * 0.6 * this.dim);
    }
    if (this.focusCount) {
      // Premultiplied "over" blending keeps each focused arc's true color.
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const strength = this.focusCount > 2000 ? 0.3 : this.focusCount > 300 ? 0.55 : 0.9;
      this.drawArcs(this.focusVao, this.focusCount, strength, 0);
      this.drawArcs(this.focusVao, this.focusCount, strength * 0.7, 0.7);
    }
    this.lastDrawMs = performance.now() - t0;
  }
}
