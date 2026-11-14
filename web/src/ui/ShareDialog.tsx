// The share picture's window: a preview of the picture, a choice of size (a
// phone story, a square post, a wide card for messages), and one button to
// share it where the device can, or to save it.

import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { type Atlas, label } from "../data/atlas";
import * as S from "../state";
import {
  FORMATS,
  type Format,
  canShareFiles,
  drawPicture,
  fileName,
  sendPicture,
  toBlob,
} from "./share";
import "./share.css";

/** Whether the share window is open. */
export const shareOpen = signal(false);

const NATIVE =
  typeof HTMLDialogElement === "function" &&
  typeof HTMLDialogElement.prototype.showModal === "function";
const ORDER: Format[] = ["story", "square", "wide"];
let last: Format = S.TOUCH ? "story" : "square";

export function ShareDialog({ a }: { a: Atlas }) {
  const box = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<Format>(last);
  const [pic, setPic] = useState<{
    url: string;
    blob: Blob;
    format: Format;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const v = S.selected.value;
  const share = canShareFiles();

  useEffect(() => {
    const dlg = box.current;
    if (NATIVE && dlg && !dlg.open) dlg.showModal();
  }, []);

  useEffect(() => {
    let live = true;
    let url = "";
    void drawPicture(a, format, v)
      .then(toBlob)
      .then((blob) => {
        if (!live || !blob) return;
        url = URL.createObjectURL(blob);
        setPic({ url, blob, format });
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [a, format, v]);

  const close = () => (shareOpen.value = false);
  const pick = (f: Format) => {
    last = f;
    setFormat(f);
  };
  const send = async () => {
    if (!pic || busy) return;
    setBusy(true);
    try {
      await sendPicture(
        pic.blob,
        fileName(a, v, pic.format),
        v === null ? "Bible Atlas" : label(a, v),
        share,
      );
    } finally {
      setBusy(false);
    }
  };
  const { w, h } = FORMATS[format];

  const body = (
    <dialog
      ref={box}
      class="sh-dialog"
      aria-labelledby="sh-h"
      data-fallback={NATIVE ? undefined : ""}
      onClose={close}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === box.current && close()}
    >
      <div class="sh-top">
        <h2 id="sh-h">Share as a picture</h2>
        <button class="sh-x" onClick={close} aria-label="Close">
          ×
        </button>
      </div>
      <div
        class="sh-view"
        style={{ aspectRatio: `${w} / ${h}`, "--sh-ratio": String(w / h) }}
      >
        {pic && pic.format === format ? (
          <img
            src={pic.url}
            alt={
              v === null
                ? "Every cross-reference in the Bible"
                : `${label(a, v)} with its links on the map`
            }
            width={w}
            height={h}
          />
        ) : (
          <span class="sh-wait">Drawing the picture</span>
        )}
      </div>
      <div class="seg sh-sizes" role="group" aria-label="Picture size">
        {ORDER.map((f) => (
          <button
            key={f}
            aria-pressed={f === format}
            onClick={() => pick(f)}
            title={FORMATS[f].about}
          >
            {FORMATS[f].name}
          </button>
        ))}
      </div>
      <p class="sh-about">{FORMATS[format].about}</p>
      <div class="sh-act">
        <button
          class="sh-go"
          onClick={send}
          disabled={!pic || pic.format !== format || busy}
        >
          {share ? "Share" : "Save the picture"}
        </button>
      </div>
    </dialog>
  );
  return NATIVE ? body : <div class="sh-veil">{body}</div>;
}
