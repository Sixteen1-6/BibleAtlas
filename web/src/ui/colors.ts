// Colors shared by the SVG overlay, the wheel and the legend. The arc colors
// match the constants in gl/arcs.ts.

export const ARC = {
  sameBook: '#45cdad',
  near: '#7399ff',
  far: '#fabd5c',
  testaments: '#e673a8',
  lamp: '#ffe2a0',
};

export const GENRE: Record<string, { color: string; label: string }> = {
  law: { color: '#6f8fe0', label: 'Law' },
  history: { color: '#4fae9b', label: 'History' },
  wisdom: { color: '#cfa65c', label: 'Wisdom and poetry' },
  'major-prophets': { color: '#cf6f8f', label: 'Major prophets' },
  'minor-prophets': { color: '#a585d6', label: 'Minor prophets' },
  gospels: { color: '#e8c77c', label: 'Gospels' },
  acts: { color: '#84bde0', label: 'Acts' },
  pauline: { color: '#6cc292', label: 'Paul’s letters' },
  general: { color: '#c29872', label: 'General letters' },
  apocalyptic: { color: '#e07a63', label: 'Revelation' },
};
