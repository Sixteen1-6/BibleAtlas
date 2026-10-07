ATLAS := cargo run --release -q -p atlas-cli --

.PHONY: all data fetch build-data verify wasm install web dev serve test clean

## Everything: download sources, build and verify data, build the engine and the site.
all: data wasm web

## Download the pinned sources, build the data, and check it.
data: fetch build-data verify

fetch:
	$(ATLAS) fetch

build-data:
	$(ATLAS) build

verify:
	$(ATLAS) verify

## Compile the Rust graph engine to WebAssembly (needs: rustup target add wasm32-unknown-unknown).
wasm:
	scripts/build-wasm.sh

install:
	cd web && npm install

## Production build of the site into web/dist.
web: install
	cd web && npm run build

## Development server with hot reload on http://localhost:5173
dev: install
	cd web && npm run dev

## Serve web/dist plus the ESV proxy on http://localhost:8080
serve:
	node server/serve.mjs

test:
	cargo test --workspace
	cd web && npm run typecheck

clean:
	rm -rf target web/dist web/public/data web/src/engine/atlas.wasm
