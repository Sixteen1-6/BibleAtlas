#!/usr/bin/env bash
# Compile atlas-core to WebAssembly and place it where the web app imports it.
#
# Normal setup (once):   rustup target add wasm32-unknown-unknown
# Offline fallback:      ATLAS_BUILD_STD=1 scripts/build-wasm.sh
#   (compiles core/alloc from the rust-src component instead of using the
#    prebuilt wasm32 standard library; needs rust-src installed)
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET=wasm32-unknown-unknown
OUT=web/src/engine/atlas.wasm

if [[ "${ATLAS_BUILD_STD:-0}" == "1" ]]; then
  RUSTC_BOOTSTRAP=1 cargo build -q -p atlas-wasm --lib --target "$TARGET" --profile wasm -Zbuild-std=core,alloc
else
  if ! rustup target list --installed 2>/dev/null | grep -qx "$TARGET"; then
    echo "The $TARGET target is not installed. Run: rustup target add $TARGET" >&2
    exit 1
  fi
  cargo build -q -p atlas-wasm --lib --target "$TARGET" --profile wasm
fi

mkdir -p "$(dirname "$OUT")"
cp "target/$TARGET/wasm/atlas_wasm.wasm" "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
