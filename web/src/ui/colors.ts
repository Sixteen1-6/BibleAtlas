// Colors shared by the WebGL arc field, the SVG overlay, the wheel and the
// legend. Everything the shader draws comes from here, so the map and its
// legend can never disagree.

export type ArcColorMode = 'spectrum' | 'reach' | 'genre';

export const ARC = {
  sameBook: '#2ee6c4',
  near: '#6b84ff',
  far: '#ffb547',
  testaments: '#ff5c9d',
  lamp: '#ffd27a',
};

/** Spectrum mode: hue follows where an arc starts in the canon, Genesis to Revelation. */
export const SPECTRUM = ['#ff5f6d', '#ff9a4a', '#ffd34e', '#8be36f', '#2fd6c5', '#4b9bff', '#8c6dff', '#e86bff'];

export const GENRE: Record<string, { color: string; label: string }> = {
  law: { color: '#5b8def', label: 'Law' },
  history: { color: '#2fbfa5', label: 'History' },
  wisdom: { color: '#e8b44c', label: 'Wisdom and poetry' },
  'major-prophets': { color: '#f06b8e', label: 'Major prophets' },
  'minor-prophets': { color: '#a77bf0', label: 'Minor prophets' },
  gospels: { color: '#ffcf5c', label: 'Gospels' },
  acts: { color: '#4cc6f0', label: 'Acts' },
  pauline: { color: '#5fd38d', label: 'Paul’s letters' },
  general: { color: '#e5925a', label: 'General letters' },
  apocalyptic: { color: '#ff6b5a', label: 'Revelation' },
};

export const GENRE_IDS = Object.keys(GENRE);

/** Night-sky gradient behind the arcs: zenith, horizon, and the glow along the baseline. */
export const SKY = { top: '#04060e', horizon: '#0e1430', glow: '#2a2350' };

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** CSS gradient of the spectrum, for the legend. */
export const SPECTRUM_CSS = `linear-gradient(90deg, ${SPECTRUM.join(', ')})`;
