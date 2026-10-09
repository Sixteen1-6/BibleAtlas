// The overlay slot on the arc map. While a map is on the page this holds its
// element, so a panel that draws over the map (Word sky's echoes) appends a
// positioned child there and removes it when done, instead of looking the
// map up by its classes. Null while no map is shown (the Wheel, say).

import { signal } from '@preact/signals';

export const mapSlot = signal<HTMLElement | null>(null);
