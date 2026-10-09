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
        // Nothing is banned, so this copy of the search has no ban check at
        // all and runs as fast as it did before roads existed.
        self.dijkstra_by(a, b, min_votes, |_, _| false)
    }

    /// Up to `k` roads from `a` to `b`: chains of links that share no verse
    /// except their two ends, cheapest first.
    ///
    /// Road 1 is [`Self::shortest_path`]. Each next road is the cheapest chain
    /// that never enters an inner verse of the roads before it, and never
    /// takes the direct `a`–`b` link once a road has used it. Every search runs
    /// on a smaller graph than the one before, so costs never decrease. Stops
    /// at `k` roads, or sooner when no road is left. `a == b` is one road of a
    /// single verse; a verse out of range gives none.
    pub fn roads(&self, a: u32, b: u32, min_votes: i16, k: usize) -> Vec<Path> {
        let n = self.verse_count();
        if a >= n || b >= n || k == 0 {
            return Vec::new();
        }
        if a == b {
            return vec![Path { verses: vec![a], edges: Vec::new(), cost: 0 }];
        }
        let mut banned = vec![false; n as usize];
        let mut direct = None;
        let mut roads = Vec::new();
        while roads.len() < k {
            let Some(p) = self.dijkstra_avoiding(a, b, min_votes, &banned, direct) else { break };
            let inner = &p.verses[1..p.verses.len() - 1];
            if inner.is_empty() {
                // The adjacency holds a twin entry per direction (and one per
                // duplicate source row), so the link is banned by its verse
                // pair, never by an edge index.
                direct = Some((a, b));
            }
            for &v in inner {
                banned[v as usize] = true;
            }
            roads.push(p);
        }
        roads
    }

    /// Dijkstra from `a` to `b` over edges with at least `min_votes` votes,
    /// never entering a verse marked in `banned` (an empty slice bans none;
    /// `b` itself is always allowed) and never crossing the unordered verse
    /// pair `banned_pair`. The heap pops by (cost, verse), so ties go to the
    /// lower verse index and the result is deterministic.
    fn dijkstra_avoiding(&self, a: u32, b: u32, min_votes: i16, banned: &[bool], banned_pair: Option<(u32, u32)>) -> Option<Path> {
        self.dijkstra_by(a, b, min_votes, |v, u| {
            (u != b && banned.get(u as usize).copied().unwrap_or(false)) || banned_pair.is_some_and(|(x, y)| (v, u) == (x, y) || (v, u) == (y, x))
        })
    }

    /// The Dijkstra search itself: it never crosses from `v` to `u` when
    /// `blocked(v, u)`. Generic, so each caller gets its own compiled copy
    /// and [`Self::shortest_path`]'s has no check left in its inner loop.
    fn dijkstra_by(&self, a: u32, b: u32, min_votes: i16, blocked: impl Fn(u32, u32) -> bool) -> Option<Path> {
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
                if blocked(v, u) {
                    continue;
                }
                let nd = d + hop_cost(self.votes[i]);
                if nd < dist[u as usize] {
                    dist[u as usize] = nd;
                    prev[u as usize] = v;
                    prev_edge[u as usize] = self.edge[i];
                    heap.push(Reverse((nd, u)));
                }
            }
        }
        trace(a, b, &dist, &prev, &prev_edge)
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

/// Walk a finished search back from `b` to `a`. Kept out of the generic
/// search, so its copies share one.
fn trace(a: u32, b: u32, dist: &[u32], prev: &[u32], prev_edge: &[u32]) -> Option<Path> {
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

    /// A deterministic tangle of `n` verses: a weak ring (so most pairs are
    /// joined) plus random chords with random votes, some disputed, some
    /// repeated in the other direction or with another span.
    fn tangle(n: u32, chords: usize, seed: u64) -> XrefGraph {
        let mut s = seed;
        let mut next = move || {
            s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (s >> 33) as u32
        };
        let mut edges: Vec<RawEdge> = (0..n).map(|v| e(v, (v + 1) % n, 1)).collect();
        for _ in 0..chords {
            let (x, y) = (next() % n, next() % n);
            let votes = (next() % 90) as i16 - 10;
            edges.push(e(x, y, votes));
            match next() % 6 {
                0 => edges.push(e(y, x, votes / 2)),
                1 => edges.push(RawEdge { src: x, dst: y, span: 3, votes }),
                _ => {}
            }
        }
        XrefGraph::build(n, edges)
    }

    /// Checks every road from `a` to `b` is a real chain of links in `g`,
    /// costs what it says, and that the roads together keep their promises.
    fn check_roads(g: &XrefGraph, a: u32, b: u32, min_votes: i16, roads: &[Path]) {
        let sources = g.sources();
        let mut inner_seen = alloc::collections::BTreeSet::new();
        for (i, p) in roads.iter().enumerate() {
            assert_eq!(p.verses.first(), Some(&a));
            assert_eq!(p.verses.last(), Some(&b));
            assert_eq!(p.edges.len() + 1, p.verses.len());
            // Loopless: no verse twice.
            let mut vs = p.verses.clone();
            vs.sort_unstable();
            vs.dedup();
            assert_eq!(vs.len(), p.verses.len(), "road {i} repeats a verse: {:?}", p.verses);
            // Each edge joins its two verses (either way round) and is strong enough.
            let mut cost = 0;
            for (j, &edge) in p.edges.iter().enumerate() {
                let (x, y) = (p.verses[j], p.verses[j + 1]);
                let (src, dst) = (sources[edge as usize], g.dst[edge as usize]);
                assert!((src, dst) == (x, y) || (src, dst) == (y, x), "edge {edge} does not join {x} and {y}");
                assert!(g.votes[edge as usize] >= min_votes.max(1));
                cost += hop_cost(g.votes[edge as usize]);
            }
            assert_eq!(cost, p.cost);
            // Disjoint: no inner verse is shared with an earlier road.
            for &v in &p.verses[1..p.verses.len() - 1] {
                assert!(inner_seen.insert(v), "verse {v} is on two roads");
            }
            if i > 0 {
                assert!(p.cost >= roads[i - 1].cost, "costs went down");
                assert_ne!(p.verses, roads[i - 1].verses);
            }
        }
        // At most one direct road, however many twin entries the link has.
        assert!(roads.iter().filter(|p| p.verses.len() == 2).count() <= 1);
    }

    #[test]
    fn first_road_is_the_shortest_path() {
        let g = sample();
        let adj = Adjacency::from_graph(&g);
        for (a, b, mv) in [(0, 2, 1), (2, 0, 50), (0, 4, 1), (0, 3, 1), (1, 1, 1)] {
            assert_eq!(adj.roads(a, b, mv, 1), adj.shortest_path(a, b, mv).into_iter().collect::<Vec<_>>());
        }
        let g = tangle(240, 900, 7);
        let adj = Adjacency::from_graph(&g);
        for a in (0..240).step_by(17) {
            for b in (3..240).step_by(23) {
                for mv in [1, 5, 40] {
                    let roads = adj.roads(a, b, mv, 3);
                    assert_eq!(roads.first(), adj.shortest_path(a, b, mv).as_ref(), "{a} -> {b} at {mv}");
                    assert_eq!(adj.roads(a, b, mv, 1).first(), roads.first());
                }
            }
        }
    }

    #[test]
    fn roads_are_disjoint_loopless_and_never_cheaper() {
        for seed in [1, 2, 3] {
            let g = tangle(300, 1500, seed);
            let adj = Adjacency::from_graph(&g);
            let mut many = 0;
            for a in (0..300).step_by(29) {
                for b in (5..300).step_by(31) {
                    for mv in [1, 10] {
                        let roads = adj.roads(a, b, mv, 4);
                        check_roads(&g, a, b, mv, &roads);
                        if roads.len() >= 3 {
                            many += 1;
                        }
                    }
                }
            }
            // The tangle is dense enough that most pairs have several roads.
            assert!(many > 50, "only {many} pairs had 3 or more roads");
        }
    }

    #[test]
    fn twin_and_duplicate_links_make_one_road() {
        // 0 and 5 are linked three times over: both directions, and a second
        // row with another span. One more road goes round through 1, 2, 3.
        let g = XrefGraph::build(
            6,
            vec![e(0, 5, 40), e(5, 0, 12), RawEdge { src: 0, dst: 5, span: 2, votes: 9 }, e(0, 1, 30), e(1, 2, 30), e(2, 3, 30), e(3, 5, 30)],
        );
        let adj = Adjacency::from_graph(&g);
        // Six adjacency entries join 0 and 5.
        assert_eq!(adj.neighbors(0).filter(|&i| adj.nbr[i] == 5).count(), 3);
        let roads = adj.roads(0, 5, 1, 5);
        assert_eq!(roads.len(), 2);
        assert_eq!(roads[0].verses, [0, 5]);
        assert_eq!(roads[1].verses, [0, 1, 2, 3, 5]);
        check_roads(&g, 0, 5, 1, &roads);
        // The same from the other end.
        let back = adj.roads(5, 0, 1, 5);
        assert_eq!(back.len(), 2);
        assert_eq!(back[0].verses, [5, 0]);
        assert_eq!(back[1].verses, [5, 3, 2, 1, 0]);
    }

    #[test]
    fn sparse_graphs_have_fewer_roads() {
        let g = sample();
        let adj = Adjacency::from_graph(&g);
        // 0 -> 2 has the strong chain through 1 and the weak direct link.
        let roads = adj.roads(0, 2, 1, 3);
        assert_eq!(roads.iter().map(|p| p.verses.clone()).collect::<Vec<_>>(), [vec![0, 1, 2], vec![0, 2]]);
        check_roads(&g, 0, 2, 1, &roads);
        // A higher threshold leaves only the strong chain.
        assert_eq!(adj.roads(0, 2, 50, 3).len(), 1);
        // Nothing reaches the isolated verse or crosses the disputed link.
        assert!(adj.roads(0, 3, 1, 3).is_empty());
        assert!(adj.roads(0, 4, 1, 3).is_empty());
        // A bare chain is a single road.
        let chain = XrefGraph::build(4, vec![e(0, 1, 9), e(1, 2, 9), e(2, 3, 9)]);
        assert_eq!(Adjacency::from_graph(&chain).roads(0, 3, 1, 3).len(), 1);
    }

    #[test]
    fn roads_edge_cases() {
        let g = sample();
        let adj = Adjacency::from_graph(&g);
        // One verse is its own single road.
        let same = adj.roads(3, 3, 1, 3);
        assert_eq!(same, [Path { verses: vec![3], edges: Vec::new(), cost: 0 }]);
        // Out of range, or no roads asked for.
        assert!(adj.roads(0, 5, 1, 3).is_empty());
        assert!(adj.roads(9, 0, 1, 3).is_empty());
        assert!(adj.roads(0, 2, 1, 0).is_empty());
        assert!(adj.roads(2, 2, 1, 0).is_empty());
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
