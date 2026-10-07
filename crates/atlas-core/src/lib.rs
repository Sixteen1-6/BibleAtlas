//! atlas-core: the shared engine behind the Bible Atlas.
//!
//! The same code runs in two places:
//! - natively inside the `atlas` CLI, which turns the raw source datasets into
//!   the binary files the web app loads, and
//! - as WebAssembly inside a Web Worker in the browser, where it answers the
//!   heavy graph queries (connection paths, neighborhoods, theme links).
//!
//! Sharing one crate means the on-disk format and the query semantics cannot
//! drift between build time and run time.
//!
//! Identity scheme (think "symbol IDs" in a code index):
//! - every verse has a dense `u32` index in canonical order (Gen 1:1 = 0),
//! - every word token is addressed as (verse index, position),
//! - every Hebrew/Aramaic/Greek root ("lemma") has a dense `u32` index,
//! - every cross-reference is an edge in a CSR adjacency over verse indices.
#![no_std]

extern crate alloc;

pub mod canon;
pub mod container;
pub mod graph;
pub mod refs;
pub mod versification;

pub use canon::{Book, Genre, Testament, BOOKS};
pub use container::{Container, ContainerError, ContainerWriter, DType};
pub use graph::{Adjacency, XrefGraph};
pub use versification::Versification;
