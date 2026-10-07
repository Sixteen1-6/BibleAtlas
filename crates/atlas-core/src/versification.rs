//! Dense verse indexing.
//!
//! Every verse gets a `u32` index in canonical order. Three prefix-sum arrays
//! are enough to convert between (book, chapter, verse) and that index in
//! O(1) one way and O(log n) the other. The arrays are stored in the
//! container so the browser and the CLI share the exact same numbering.

use alloc::vec::Vec;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Versification {
    /// First chapter index of each book; `len = books + 1`.
    pub book_chapter_start: Vec<u32>,
    /// First verse index of each chapter; `len = chapters + 1`.
    pub chapter_start: Vec<u32>,
}

impl Versification {
    /// Build from verse counts: `counts[book][chapter - 1] = number of verses`.
    pub fn from_counts<C: AsRef<[u16]>>(counts: &[C]) -> Self {
        let mut book_chapter_start = Vec::with_capacity(counts.len() + 1);
        let mut chapter_start = Vec::new();
        let mut v = 0u32;
        for book in counts {
            book_chapter_start.push(chapter_start.len() as u32);
            for &n in book.as_ref() {
                chapter_start.push(v);
                v += n as u32;
            }
        }
        book_chapter_start.push(chapter_start.len() as u32);
        chapter_start.push(v);
        Self { book_chapter_start, chapter_start }
    }

    pub fn from_arrays(book_chapter_start: Vec<u32>, chapter_start: Vec<u32>) -> Option<Self> {
        if book_chapter_start.is_empty() || chapter_start.is_empty() {
            return None;
        }
        let last = *book_chapter_start.last()? as usize;
        if last + 1 != chapter_start.len() {
            return None;
        }
        if book_chapter_start.windows(2).any(|w| w[0] > w[1]) || chapter_start.windows(2).any(|w| w[0] > w[1]) {
            return None;
        }
        Some(Self { book_chapter_start, chapter_start })
    }

    pub fn book_count(&self) -> usize {
        self.book_chapter_start.len() - 1
    }

    pub fn chapter_count(&self) -> usize {
        self.chapter_start.len() - 1
    }

    pub fn verse_count(&self) -> u32 {
        *self.chapter_start.last().unwrap_or(&0)
    }

    pub fn chapters_in(&self, book: u8) -> u16 {
        let b = book as usize;
        if b >= self.book_count() {
            return 0;
        }
        (self.book_chapter_start[b + 1] - self.book_chapter_start[b]) as u16
    }

    /// Global chapter index for (book, 1-based chapter).
    pub fn chapter_index(&self, book: u8, chapter: u16) -> Option<u32> {
        if chapter == 0 || chapter > self.chapters_in(book) {
            return None;
        }
        Some(self.book_chapter_start[book as usize] + chapter as u32 - 1)
    }

    pub fn verses_in(&self, book: u8, chapter: u16) -> Option<u16> {
        let c = self.chapter_index(book, chapter)? as usize;
        Some((self.chapter_start[c + 1] - self.chapter_start[c]) as u16)
    }

    /// Dense index of (book, chapter, verse); chapter and verse are 1-based.
    pub fn index(&self, book: u8, chapter: u16, verse: u16) -> Option<u32> {
        let c = self.chapter_index(book, chapter)? as usize;
        let start = self.chapter_start[c];
        let n = self.chapter_start[c + 1] - start;
        if verse == 0 || verse as u32 > n {
            return None;
        }
        Some(start + verse as u32 - 1)
    }

    pub fn book_start(&self, book: u8) -> u32 {
        self.chapter_start[self.book_chapter_start[book as usize] as usize]
    }

    /// Global chapter index containing a verse index.
    pub fn chapter_of(&self, idx: u32) -> usize {
        // Largest c with chapter_start[c] <= idx.
        match self.chapter_start.binary_search(&idx) {
            Ok(mut c) => {
                // Skip empty chapters (none in practice, but stay correct).
                while c + 1 < self.chapter_start.len() && self.chapter_start[c + 1] == idx {
                    c += 1;
                }
                c
            }
            Err(c) => c - 1,
        }
    }

    pub fn book_of_chapter(&self, chapter: usize) -> u8 {
        match self.book_chapter_start.binary_search(&(chapter as u32)) {
            Ok(mut b) => {
                while b + 1 < self.book_chapter_start.len() && self.book_chapter_start[b + 1] == chapter as u32 {
                    b += 1;
                }
                b as u8
            }
            Err(b) => (b - 1) as u8,
        }
    }

    /// (book, 1-based chapter, 1-based verse) for a verse index.
    pub fn locate(&self, idx: u32) -> Option<(u8, u16, u16)> {
        if idx >= self.verse_count() {
            return None;
        }
        let c = self.chapter_of(idx);
        let b = self.book_of_chapter(c);
        let ch = c as u32 - self.book_chapter_start[b as usize] + 1;
        let v = idx - self.chapter_start[c] + 1;
        Some((b, ch as u16, v as u16))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    #[test]
    fn round_trip() {
        let vz = Versification::from_counts(&[vec![3u16, 2], vec![4u16]]);
        assert_eq!(vz.verse_count(), 9);
        assert_eq!(vz.index(0, 1, 1), Some(0));
        assert_eq!(vz.index(0, 2, 2), Some(4));
        assert_eq!(vz.index(1, 1, 4), Some(8));
        assert_eq!(vz.index(1, 1, 5), None);
        assert_eq!(vz.index(0, 3, 1), None);
        for i in 0..9 {
            let (b, c, v) = vz.locate(i).unwrap();
            assert_eq!(vz.index(b, c, v), Some(i));
        }
        assert_eq!(vz.locate(9), None);
    }
}
