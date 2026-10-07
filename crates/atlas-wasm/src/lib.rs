//! WebAssembly build of the graph engine.
//!
//! No wasm-bindgen: the API is a handful of `extern "C"` functions over
//! linear memory, so the JavaScript side is ~80 lines and there is no
//! generated glue to keep in sync. Results are written to an output buffer
//! that JavaScript reads as a `Uint32Array` view (see web/src/engine/).
//!
//! Protocol:
//! 1. `atlas_alloc(n)` -> pointer; JS copies `atlas.bin` there.
//! 2. `atlas_load(ptr, n)` parses it, builds the traversal index, frees nothing
//!    the caller owns (call `atlas_free` afterwards).
//! 3. Query functions return a count (or a negative error) and fill the
//!    output buffer at `atlas_out_ptr()`.
#![cfg_attr(target_arch = "wasm32", no_std)]

extern crate alloc;

use alloc::vec::Vec;
use atlas_core::{Adjacency, Container, Versification, XrefGraph};
use core::cell::UnsafeCell;

#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOC: dlmalloc::GlobalDlmalloc = dlmalloc::GlobalDlmalloc;

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

struct State {
    vz: Versification,
    graph: XrefGraph,
    adj: Adjacency,
}

/// Single-threaded engine state. A Web Worker owns exactly one instance and
/// calls into it sequentially, so plain interior mutability is sound here.
struct Global {
    state: UnsafeCell<Option<State>>,
    out: UnsafeCell<Vec<u32>>,
}
unsafe impl Sync for Global {}

static G: Global = Global { state: UnsafeCell::new(None), out: UnsafeCell::new(Vec::new()) };

fn state() -> Option<&'static State> {
    unsafe { (*G.state.get()).as_ref() }
}

fn out() -> &'static mut Vec<u32> {
    unsafe { &mut *G.out.get() }
}

pub const ERR_NOT_LOADED: i32 = -1;
pub const ERR_BAD_DATA: i32 = -2;
pub const ERR_NOT_FOUND: i32 = -3;
pub const ERR_BAD_INPUT: i32 = -4;

#[no_mangle]
pub extern "C" fn atlas_alloc(len: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(len);
    let p = v.as_mut_ptr();
    core::mem::forget(v);
    p
}

/// # Safety
/// `ptr` must come from `atlas_alloc(len)` and not have been freed.
#[no_mangle]
pub unsafe extern "C" fn atlas_free(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len));
}

#[no_mangle]
pub extern "C" fn atlas_out_ptr() -> *const u32 {
    out().as_ptr()
}

#[no_mangle]
pub extern "C" fn atlas_out_len() -> usize {
    out().len()
}

fn load(bytes: &[u8]) -> Result<State, ()> {
    let c = Container::parse(bytes).map_err(|_| ())?;
    let vz = Versification::from_arrays(c.u32s("vz_bchap").map_err(|_| ())?, c.u32s("vz_chap").map_err(|_| ())?).ok_or(())?;
    let graph = XrefGraph {
        off: c.u32s("x_off").map_err(|_| ())?,
        dst: c.u32s("x_dst").map_err(|_| ())?,
        span: c.u16s("x_span").map_err(|_| ())?,
        votes: c.i16s("x_votes").map_err(|_| ())?,
    };
    graph.validate().map_err(|_| ())?;
    let adj = Adjacency::from_graph(&graph);
    Ok(State { vz, graph, adj })
}

/// Parse an `atlas.bin` image. Returns the verse count, or a negative error.
///
/// # Safety
/// `ptr..ptr + len` must be readable.
#[no_mangle]
pub unsafe extern "C" fn atlas_load(ptr: *const u8, len: usize) -> i32 {
    let bytes = core::slice::from_raw_parts(ptr, len);
    match load(bytes) {
        Ok(s) => {
            let n = s.vz.verse_count() as i32;
            *G.state.get() = Some(s);
            n
        }
        Err(()) => ERR_BAD_DATA,
    }
}

/// Connection path from verse `a` to verse `b`.
/// Output: `[verses..., edges...]`; returns the number of verses.
#[no_mangle]
pub extern "C" fn atlas_path(a: u32, b: u32, min_votes: i32) -> i32 {
    let Some(s) = state() else { return ERR_NOT_LOADED };
    let o = out();
    o.clear();
    match s.adj.shortest_path(a, b, min_votes.clamp(i16::MIN as i32, i16::MAX as i32) as i16) {
        Some(p) => {
            o.extend_from_slice(&p.verses);
            o.extend_from_slice(&p.edges);
            p.verses.len() as i32
        }
        None => ERR_NOT_FOUND,
    }
}

/// Neighborhood of `seed`. Output: `[verse, hop]` pairs, then one edge per
/// discovered verse (the first verse, the seed, has no edge). Returns the
/// number of verses.
#[no_mangle]
pub extern "C" fn atlas_near(seed: u32, hops: u32, min_votes: i32, limit: u32) -> i32 {
    let Some(s) = state() else { return ERR_NOT_LOADED };
    let o = out();
    o.clear();
    let (nodes, edges) = s.adj.neighborhood(seed, hops.min(6) as u8, min_votes as i16, limit as usize);
    for (v, h) in &nodes {
        o.push(*v);
        o.push(*h as u32);
    }
    o.extend_from_slice(&edges);
    nodes.len() as i32
}

/// Edges whose two ends are both marked in `mask` (one byte per verse).
/// Output: edge ids; returns how many.
///
/// # Safety
/// `mask..mask + len` must be readable.
#[no_mangle]
pub unsafe extern "C" fn atlas_links_within(mask: *const u8, len: usize, min_votes: i32) -> i32 {
    let Some(s) = state() else { return ERR_NOT_LOADED };
    let mask = core::slice::from_raw_parts(mask, len);
    let o = out();
    o.clear();
    o.extend(s.graph.links_within(mask, min_votes as i16));
    o.len() as i32
}

/// Parse a typed reference ("jn 3:16", "1 Cor 13:4-7", "Psalm 23").
/// Output: `[first verse, last verse]`; returns 2, or a negative error.
///
/// # Safety
/// `ptr..ptr + len` must be readable UTF-8.
#[no_mangle]
pub unsafe extern "C" fn atlas_parse_ref(ptr: *const u8, len: usize) -> i32 {
    let Some(s) = state() else { return ERR_NOT_LOADED };
    let Ok(text) = core::str::from_utf8(core::slice::from_raw_parts(ptr, len)) else { return ERR_BAD_INPUT };
    let o = out();
    o.clear();
    let Some(q) = atlas_core::refs::parse(text) else { return ERR_BAD_INPUT };
    let Some((a, b)) = atlas_core::refs::resolve(q, &s.vz) else { return ERR_NOT_FOUND };
    o.push(a);
    o.push(b);
    2
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_core::graph::RawEdge;
    use atlas_core::ContainerWriter;

    /// Exercise the exact FFI surface the browser uses, natively.
    #[test]
    fn ffi_round_trip() {
        let mut counts = alloc::vec![alloc::vec![1u16]; 66];
        counts[0] = alloc::vec![3, 3];
        let vz = Versification::from_counts(&counts);
        let n = vz.verse_count();
        let g = XrefGraph::build(n, alloc::vec![
            RawEdge { src: 0, dst: 4, span: 1, votes: 50 },
            RawEdge { src: 4, dst: 70, span: 1, votes: 20 },
        ]);
        let mut w = ContainerWriter::new();
        w.u32s("vz_bchap", &vz.book_chapter_start);
        w.u32s("vz_chap", &vz.chapter_start);
        w.u32s("x_off", &g.off);
        w.u32s("x_dst", &g.dst);
        w.u16s("x_span", &g.span);
        w.i16s("x_votes", &g.votes);
        let bin = w.finish();
        unsafe {
            assert_eq!(atlas_path(0, 1, 1), ERR_NOT_LOADED);
            let p = atlas_alloc(bin.len());
            core::ptr::copy_nonoverlapping(bin.as_ptr(), p, bin.len());
            assert_eq!(atlas_load(p, bin.len()), n as i32);
            atlas_free(p, bin.len());

            assert_eq!(atlas_path(0, 70, 1), 3);
            let res = core::slice::from_raw_parts(atlas_out_ptr(), atlas_out_len());
            assert_eq!(&res[..3], &[0, 4, 70]);
            assert_eq!(atlas_path(0, 2, 1), ERR_NOT_FOUND);

            let q = "Gen 2:2";
            assert_eq!(atlas_parse_ref(q.as_ptr(), q.len()), 2);
            let res = core::slice::from_raw_parts(atlas_out_ptr(), 2);
            assert_eq!(res, &[4, 4]);

            assert_eq!(atlas_near(0, 2, 1, 10), 3);
            let mask = alloc::vec![1u8; n as usize];
            assert_eq!(atlas_links_within(mask.as_ptr(), mask.len(), 1), 2);
        }
    }
}
