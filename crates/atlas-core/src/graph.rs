//! Cross-reference graph and the queries that run on it.
//!
//! [`XrefGraph`] is the directed graph exactly as published: one edge per
//! cross-reference, stored in CSR form (compressed sparse rows). Edges leaving
//! a verse are contiguous and sorted strongest-first, so "references from this
//! verse" is a slice and "the top 10" is the first 10 elements.
//!
//! [`Adjacency`] is an undirected view over the positively voted edges, used
//! for traversal (connection paths, neighborhoods). Each entry remembers the
//! id of the original edge so results can be highlighted on the map.

use alloc::collections::BinaryHeap;
use alloc::vec;
use alloc::vec::Vec;
use core::cmp::Reverse;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct XrefGraph {
    /// `off[v]..off[v + 1]` are the edges leaving verse `v`; `len = n + 1`.
    pub off: Vec<u32>,
    /// First verse of the referenced passage.
    pub dst: Vec<u32>,
    /// Number of verses in the referenced passage (1 for a single verse).
    pub span: Vec<u16>,
    /// OpenBible.info community votes; can be negative for disputed links.
    pub votes: Vec<i16>,
}

/// One raw cross-reference before packing.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RawEdge {
    pub src: u32,
    pub dst: u32,
    pub span: u16,
    pub votes: i16,
}

impl XrefGraph {
    /// Pack raw edges for a graph with `n` verses. Duplicate (src, dst, span)
    /// triples keep the highest vote count. Edges are ordered per source by
    /// votes descending, then by destination.
    pub fn build(n: u32, mut edges: Vec<RawEdge>) -> Self {
        edges.retain(|e| e.src < n && e.dst < n);
        edges.sort_unstable_by(|a, b| {
            (a.src, a.dst, a.span, Reverse(a.votes)).cmp(&(b.src, b.dst, b.span, Reverse(b.votes)))
        });
        edges.dedup_by(|later, kept| later.src == kept.src && later.dst == kept.dst && later.span == kept.span);
        edges.sort_by_key(|a| (a.src, Reverse(a.votes), a.dst));

        let mut off = vec![0u32; n as usize + 1];
        for e in &edges {
            off[e.src as usize + 1] += 1;
        }
        for i in 0..n as usize {
            off[i + 1] += off[i];
        }
        Self {
            off,
            dst: edges.iter().map(|e| e.dst).collect(),
            span: edges.iter().map(|e| e.span).collect(),
            votes: edges.iter().map(|e| e.votes).collect(),
        }
    }

    pub fn verse_count(&self) -> u32 {
        (self.off.len() - 1) as u32
    }

    pub fn edge_count(&self) -> usize {
        self.dst.len()
    }

    pub fn out(&self, v: u32) -> core::ops::Range<usize> {
        self.off[v as usize] as usize..self.off[v as usize + 1] as usize
    }

    /// Source verse of every edge (the inverse of `off`), computed once.
    pub fn sources(&self) -> Vec<u32> {
        let mut src = Vec::with_capacity(self.edge_count());
        for v in 0..self.verse_count() {
            for _ in self.out(v) {
                src.push(v);
            }
        }
        src
    }

    /// Structural checks used by tests and by `atlas verify`.
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.off.is_empty() || self.off[0] != 0 {
            return Err("offsets must start at 0");
        }
        if self.off.windows(2).any(|w| w[0] > w[1]) {
            return Err("offsets must be non-decreasing");
        }
        let m = *self.off.last().unwrap() as usize;
        if m != self.dst.len() || m != self.span.len() || m != self.votes.len() {
            return Err("edge arrays disagree in length");
        }
        let n = self.verse_count();
        if self.dst.iter().any(|&d| d >= n) {
            return Err("edge points past the last verse");
        }
        for v in 0..n {
            let r = self.out(v);
            if self.votes[r].windows(2).any(|w| w[0] < w[1]) {
                return Err("edges must be sorted by votes descending");
            }
        }
        Ok(())
    }

    /// Weighted PageRank over positively voted edges (weight = votes).
    /// Returned scores sum to 1.
    pub fn pagerank(&self, damping: f32, iterations: u32) -> Vec<f32> {
        let n = self.verse_count() as usize;
        if n == 0 {
            return Vec::new();
        }
        let out_w: Vec<f32> = (0..n as u32)
            .map(|v| self.out(v).filter(|&e| self.votes[e] > 0).map(|e| self.votes[e] as f32).sum())
            .collect();
        let base = 1.0 / n as f32;
        let mut rank = vec![base; n];
        let mut next = vec![0f32; n];
        for _ in 0..iterations {
            let mut dangling = 0f32;
            for v in 0..n {
                if out_w[v] == 0.0 {
                    dangling += rank[v];
                }
            }
            let fill = (1.0 - damping) * base + damping * dangling * base;
            next.iter_mut().for_each(|x| *x = fill);
            for v in 0..n {
                if out_w[v] == 0.0 {
                    continue;
                }
                let share = damping * rank[v] / out_w[v];
                for e in self.out(v as u32) {
                    if self.votes[e] > 0 {
                        next[self.dst[e] as usize] += share * self.votes[e] as f32;
                    }
                }
            }
            core::mem::swap(&mut rank, &mut next);
        }
        rank
    }

    /// Edges whose source and destination both have `mask[v] != 0`.
    pub fn links_within(&self, mask: &[u8], min_votes: i16) -> Vec<u32> {
        let mut out = Vec::new();
        for v in 0..self.verse_count() {
            if mask.get(v as usize).copied().unwrap_or(0) == 0 {
                continue;
            }
            for e in self.out(v) {
                if self.votes[e] >= min_votes && mask.get(self.dst[e] as usize).copied().unwrap_or(0) != 0 {
                    out.push(e as u32);
                }
            }
        }
        out
    }

    /// Edge counts between books: `flow[a * books + b]` counts positively
    /// voted references from book `a` to book `b`. `book_of` maps a verse
    /// index to its book.
    pub fn book_flow(&self, books: usize, book_of: impl Fn(u32) -> u8) -> Vec<u32> {
        let mut flow = vec![0u32; books * books];
        for v in 0..self.verse_count() {
            let a = book_of(v) as usize;
            for e in self.out(v) {
                if self.votes[e] > 0 {
                    flow[a * books + book_of(self.dst[e]) as usize] += 1;
                }
            }
        }
        flow
    }
}

/// Undirected adjacency over positively voted edges.
#[derive(Clone, Debug, Default)]
pub struct Adjacency {
    pub off: Vec<u32>,
    pub nbr: Vec<u32>,
    /// Votes of the underlying edge (always > 0).
    pub votes: Vec<i16>,
    /// Index of the underlying edge in the [`XrefGraph`].
    pub edge: Vec<u32>,
}

/// Cost of crossing one edge. Every hop costs at least 1000, and weakly voted
/// links cost up to 4x as much, so paths prefer few, well-attested steps.
/// Integer math only (no float `ln` in `core`).
pub fn hop_cost(votes: i16) -> u32 {
    let v = votes.max(1) as u32;
    1000 + 3000 / (1 + v.ilog2())
}

/// A connection path: verses in order, plus the edge used to reach each one
/// after the first.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Path {
    pub verses: Vec<u32>,
    pub edges: Vec<u32>,
    pub cost: u32,
}

impl Adjacency {
    pub fn from_graph(g: &XrefGraph) -> Self {
        let n = g.verse_count() as usize;
        let mut deg = vec![0u32; n + 1];
        for v in 0..g.verse_count() {
            for e in g.out(v) {
                if g.votes[e] > 0 && g.dst[e] != v {
                    deg[v as usize + 1] += 1;
                    deg[g.dst[e] as usize + 1] += 1;
                }
            }
        }
        for i in 0..n {
            deg[i + 1] += deg[i];
        }
        let m = deg[n] as usize;
        let mut cursor = deg.clone();
        let mut nbr = vec![0u32; m];
        let mut votes = vec![0i16; m];
        let mut edge = vec![0u32; m];
        for v in 0..g.verse_count() {
            for e in g.out(v) {
                let d = g.dst[e];
                if g.votes[e] > 0 && d != v {
                    for (a, b) in [(v, d), (d, v)] {
                        let at = cursor[a as usize] as usize;
                        nbr[at] = b;
                        votes[at] = g.votes[e];
                        edge[at] = e as u32;
                        cursor[a as usize] += 1;
                    }
                }
            }
        }
        Self { off: deg, nbr, votes, edge }
    }

    pub fn neighbors(&self, v: u32) -> core::ops::Range<usize> {
        self.off[v as usize] as usize..self.off[v as usize + 1] as usize
    }

    pub fn verse_count(&self) -> u32 {
        (self.off.len() - 1) as u32
    }

    /// Cheapest chain of cross-references from `a` to `b` using only edges
    /// with at least `min_votes` votes (Dijkstra with [`hop_cost`]).
    pub fn shortest_path(&self, a: u32, b: u32, min_votes: i16) -> Option<Path> {
        let n = self.verse_count();
        if a >= n || b >= n {
            return None;
        }
        if a == b {
            return Some(Path { verses: vec![a], edges: Vec::new(), cost: 0 });
        }
        let mut dist = vec![u32::MAX; n as usize];
        let mut prev = vec![u32::MAX; n as usize];
        let mut prev_edge = vec![u32::MAX; n as usize];
        let mut heap = BinaryHeap::new();
        dist[a as usize] = 0;
        heap.push(Reverse((0u32, a)));
        while let Some(Reverse((d, v))) = heap.pop() {
            if d > dist[v as usize] {
                continue;
            }
            if v == b {
                break;
            }
            for i in self.neighbors(v) {
                if self.votes[i] < min_votes {
                    continue;
                }
                let u = self.nbr[i];
                let nd = d + hop_cost(self.votes[i]);
                if nd < dist[u as usize] {
                    dist[u as usize] = nd;
                    prev[u as usize] = v;
                    prev_edge[u as usize] = self.edge[i];
                    heap.push(Reverse((nd, u)));
                }
            }
        }
        if dist[b as usize] == u32::MAX {
            return None;
        }
        let mut verses = vec![b];
        let mut edges = Vec::new();
        let mut cur = b;
        while cur != a {
            edges.push(prev_edge[cur as usize]);
            cur = prev[cur as usize];
            verses.push(cur);
        }
        verses.reverse();
        edges.reverse();
        Some(Path { verses, edges, cost: dist[b as usize] })
    }

    /// Verses within `hops` steps of `seed` (breadth-first, strongest links
    /// first), stopping after `limit` verses. Returns (verse, hop) pairs and
    /// the edges that discovered them.
    pub fn neighborhood(&self, seed: u32, hops: u8, min_votes: i16, limit: usize) -> (Vec<(u32, u8)>, Vec<u32>) {
        let n = self.verse_count();
        if seed >= n || limit == 0 {
            return (Vec::new(), Vec::new());
        }
        let mut seen = vec![false; n as usize];
        seen[seed as usize] = true;
        let mut nodes = vec![(seed, 0u8)];
        let mut edges = Vec::new();
        let mut frontier = vec![seed];
        for hop in 1..=hops {
            let mut candidates: Vec<(i16, u32, u32)> = Vec::new();
            for &v in &frontier {
                for i in self.neighbors(v) {
                    if self.votes[i] >= min_votes && !seen[self.nbr[i] as usize] {
                        candidates.push((self.votes[i], self.nbr[i], self.edge[i]));
                    }
                }
            }
            candidates.sort_unstable_by(|x, y| y.0.cmp(&x.0).then(x.1.cmp(&y.1)));
            let mut next = Vec::new();
            for (_, u, e) in candidates {
                if nodes.len() >= limit {
                    return (nodes, edges);
                }
                if !seen[u as usize] {
                    seen[u as usize] = true;
                    nodes.push((u, hop));
                    edges.push(e);
                    next.push(u);
                }
            }
            if next.is_empty() {
                break;
            }
            frontier = next;
        }
        (nodes, edges)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn e(src: u32, dst: u32, votes: i16) -> RawEdge {
        RawEdge { src, dst, span: 1, votes }
    }

    fn sample() -> XrefGraph {
        // 0 -> 1 (strong) -> 2 (strong); 0 -> 2 (weak); 3 isolated; 4 <- 2 (disputed)
        XrefGraph::build(5, vec![e(0, 2, 1), e(0, 1, 90), e(1, 2, 80), e(2, 4, -3), e(0, 1, 10)])
    }

    #[test]
    fn build_sorts_and_dedupes() {
        let g = sample();
        g.validate().unwrap();
        assert_eq!(g.edge_count(), 4);
        let r = g.out(0);
        assert_eq!(&g.dst[r.clone()], &[1, 2]);
        assert_eq!(&g.votes[r], &[90, 1]);
        assert_eq!(g.sources(), [0, 0, 1, 2]);
    }

    #[test]
    fn path_prefers_strong_links() {
        let g = sample();
        let adj = Adjacency::from_graph(&g);
        let p = adj.shortest_path(0, 2, 1).unwrap();
        // One weak hop (cost 4000) vs two strong hops (~1500 each).
        assert_eq!(p.verses, [0, 1, 2]);
        assert_eq!(p.edges.len(), 2);
        // Disputed edge is not traversable.
        assert!(adj.shortest_path(0, 4, 1).is_none());
        assert!(adj.shortest_path(0, 3, 1).is_none());
        // Raising the threshold removes the weak shortcut but keeps the strong chain.
        assert_eq!(adj.shortest_path(2, 0, 50).unwrap().verses, [2, 1, 0]);
    }

    #[test]
    fn pagerank_sums_to_one_and_ranks_hub() {
        let g = sample();
        let r = g.pagerank(0.85, 50);
        let s: f32 = r.iter().sum();
        assert!((s - 1.0).abs() < 1e-4, "sum {s}");
        assert!(r[2] > r[3]);
    }

    #[test]
    fn neighborhood_and_links_within() {
        let g = sample();
        let adj = Adjacency::from_graph(&g);
        let (nodes, edges) = adj.neighborhood(0, 2, 1, 10);
        assert_eq!(nodes[0], (0, 0));
        assert_eq!(nodes.len(), 3);
        assert_eq!(edges.len(), 2);
        let mask = [1u8, 1, 0, 0, 0];
        assert_eq!(g.links_within(&mask, 1), [0]);
        let flow = g.book_flow(2, |v| if v < 2 { 0 } else { 1 });
        assert_eq!(flow, [1, 2, 0, 0]);
    }
}
