// The map on the page: a canvas the MapView draws on, and three buttons to
// zoom in, zoom out and go back to this verse's places.

import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { BaseFile } from './model';
import { MapView, type Marker, geometry } from './view';

export interface MapCanvasProps {
  base: BaseFile;
  markers: Marker[];
  /** A new key fits the map to these projected points. */
  fitKey: string;
  fitPoints: [number, number][];
  /** A new key brings these points into view, moving as little as needed. */
  revealKey: string;
  revealPoints: [number, number][];
  onTap: (place: number) => void;
  /** What the map shows, for screen readers. */
  label: string;
}

export function MapCanvas(props: MapCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<MapView | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useLayoutEffect(() => {
    const el = canvas.current;
    const wrap = box.current;
    if (!el || !wrap) return;
    let live = true;
    const v = new MapView(el, geometry(props.base), (p) => latest.current.onTap(p));
    view.current = v;
    v.setMarkers(latest.current.markers);
    v.fit(latest.current.fitPoints, false);
    const size = () => {
      if (!live) return;
      // Names and fitted places keep clear of the zoom buttons.
      const z = wrap.querySelector<HTMLElement>('.x-real-map-zoom');
      v.reserve(z ? [z.offsetLeft - 4, z.offsetTop - 4, z.offsetLeft + z.offsetWidth + 4, z.offsetTop + z.offsetHeight + 4] : null);
      v.resize(wrap.clientWidth, wrap.clientHeight);
    };
    size();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
    ro?.observe(wrap);
    window.addEventListener('resize', size);
    // The theme can change while the panel is open: the app's switch sets
    // data-theme, and the system can switch between light and dark.
    const retheme = () => live && v.readTheme();
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(retheme) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    mq?.addEventListener('change', retheme);
    // On a first visit the fonts may arrive after the first drawing.
    document.fonts?.ready.then(retheme, () => {});
    return () => {
      live = false;
      ro?.disconnect();
      window.removeEventListener('resize', size);
      mo?.disconnect();
      mq?.removeEventListener('change', retheme);
      v.destroy();
      view.current = null;
    };
  }, [props.base]);

  useLayoutEffect(() => {
    view.current?.setMarkers(props.markers);
  }, [props.markers]);

  const fitted = useRef(props.fitKey);
  useLayoutEffect(() => {
    if (fitted.current === props.fitKey) return;
    fitted.current = props.fitKey;
    view.current?.fit(props.fitPoints, true);
  }, [props.fitKey]);

  const revealed = useRef(props.revealKey);
  useEffect(() => {
    if (revealed.current === props.revealKey) return;
    revealed.current = props.revealKey;
    view.current?.reveal(props.revealPoints);
  }, [props.revealKey]);

  return (
    <div class="x-real-map-frame" ref={box}>
      <canvas ref={canvas} class="x-real-map-canvas" role="img" aria-label={props.label} />
      <div class="x-real-map-zoom">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => view.current?.zoomAt(1.8, undefined, undefined, true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => view.current?.zoomAt(1 / 1.8, undefined, undefined, true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" aria-label="Back to this verse's places" title="Back to this verse's places" onClick={() => view.current?.refit()}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.4" />
            <circle cx="7" cy="7" r="1.4" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
