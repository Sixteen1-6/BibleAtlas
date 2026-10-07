//! `.atlas` binary container: named, typed, 8-byte-aligned arrays in one file.
//!
//! Layout (all integers little-endian):
//!
//! ```text
//! 0   magic  b"ATLS"
//! 4   u32    format version
//! 8   u32    section count (n)
//! 12  u32    reserved (0)
//! 16  n x 32-byte section records:
//!       [u8; 16] name (ASCII, zero padded)
//!       u32      dtype (see DType)
//!       u32      element count
//!       u32      byte offset from start of file (multiple of 8)
//!       u32      reserved (0)
//! ..  payloads, each starting on an 8-byte boundary
//! ```
//!
//! The browser maps each section straight onto a typed array view over the
//! fetched `ArrayBuffer` (no parsing, no copies). The WebAssembly engine and
//! the CLI decode the same bytes through [`Container`].

use alloc::string::String;
use alloc::vec::Vec;

pub const MAGIC: &[u8; 4] = b"ATLS";
pub const VERSION: u32 = 1;
const HEADER: usize = 16;
const RECORD: usize = 32;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum DType {
    U8 = 0,
    U16 = 1,
    U32 = 2,
    I16 = 3,
    F32 = 4,
    I32 = 5,
}

impl DType {
    pub fn size(self) -> usize {
        match self {
            DType::U8 => 1,
            DType::U16 | DType::I16 => 2,
            DType::U32 | DType::F32 | DType::I32 => 4,
        }
    }
    fn from_u32(v: u32) -> Option<Self> {
        Some(match v {
            0 => DType::U8,
            1 => DType::U16,
            2 => DType::U32,
            3 => DType::I16,
            4 => DType::F32,
            5 => DType::I32,
            _ => return None,
        })
    }
    pub fn name(self) -> &'static str {
        match self {
            DType::U8 => "u8",
            DType::U16 => "u16",
            DType::U32 => "u32",
            DType::I16 => "i16",
            DType::F32 => "f32",
            DType::I32 => "i32",
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum ContainerError {
    BadMagic,
    BadVersion(u32),
    Truncated,
    BadSection,
    Missing(&'static str),
    WrongType(&'static str),
}

#[derive(Clone, Debug)]
pub struct Section {
    pub name: String,
    pub dtype: DType,
    pub count: usize,
    pub offset: usize,
}

/// Zero-copy reader over a container's bytes.
pub struct Container<'a> {
    bytes: &'a [u8],
    pub sections: Vec<Section>,
}

fn rd_u32(b: &[u8], at: usize) -> Result<u32, ContainerError> {
    let s = b.get(at..at + 4).ok_or(ContainerError::Truncated)?;
    Ok(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
}

impl<'a> Container<'a> {
    pub fn parse(bytes: &'a [u8]) -> Result<Self, ContainerError> {
        if bytes.get(0..4) != Some(MAGIC.as_slice()) {
            return Err(ContainerError::BadMagic);
        }
        let version = rd_u32(bytes, 4)?;
        if version != VERSION {
            return Err(ContainerError::BadVersion(version));
        }
        let n = rd_u32(bytes, 8)? as usize;
        let mut sections = Vec::with_capacity(n);
        for i in 0..n {
            let at = HEADER + i * RECORD;
            let raw = bytes.get(at..at + 16).ok_or(ContainerError::Truncated)?;
            let len = raw.iter().position(|&c| c == 0).unwrap_or(16);
            let name = core::str::from_utf8(&raw[..len]).map_err(|_| ContainerError::BadSection)?;
            let dtype = DType::from_u32(rd_u32(bytes, at + 16)?).ok_or(ContainerError::BadSection)?;
            let count = rd_u32(bytes, at + 20)? as usize;
            let offset = rd_u32(bytes, at + 24)? as usize;
            let end = offset.checked_add(count * dtype.size()).ok_or(ContainerError::BadSection)?;
            if !offset.is_multiple_of(8) || end > bytes.len() {
                return Err(ContainerError::BadSection);
            }
            sections.push(Section { name: String::from(name), dtype, count, offset });
        }
        Ok(Self { bytes, sections })
    }

    pub fn section(&self, name: &str) -> Option<&Section> {
        self.sections.iter().find(|s| s.name == name)
    }

    fn raw(&self, name: &'static str, dtype: DType) -> Result<&'a [u8], ContainerError> {
        let s = self.section(name).ok_or(ContainerError::Missing(name))?;
        if s.dtype != dtype {
            return Err(ContainerError::WrongType(name));
        }
        Ok(&self.bytes[s.offset..s.offset + s.count * dtype.size()])
    }

    pub fn u8s(&self, name: &'static str) -> Result<Vec<u8>, ContainerError> {
        Ok(self.raw(name, DType::U8)?.to_vec())
    }
    pub fn u16s(&self, name: &'static str) -> Result<Vec<u16>, ContainerError> {
        Ok(self.raw(name, DType::U16)?.as_chunks::<2>().0.iter().map(|c| u16::from_le_bytes(*c)).collect())
    }
    pub fn i16s(&self, name: &'static str) -> Result<Vec<i16>, ContainerError> {
        Ok(self.raw(name, DType::I16)?.as_chunks::<2>().0.iter().map(|c| i16::from_le_bytes(*c)).collect())
    }
    pub fn u32s(&self, name: &'static str) -> Result<Vec<u32>, ContainerError> {
        Ok(self.raw(name, DType::U32)?.as_chunks::<4>().0.iter().map(|c| u32::from_le_bytes(*c)).collect())
    }
    pub fn f32s(&self, name: &'static str) -> Result<Vec<f32>, ContainerError> {
        Ok(self.raw(name, DType::F32)?.as_chunks::<4>().0.iter().map(|c| f32::from_le_bytes(*c)).collect())
    }
}

/// Builds a container in memory.
#[derive(Default)]
pub struct ContainerWriter {
    entries: Vec<(String, DType, usize, Vec<u8>)>,
}

impl ContainerWriter {
    pub fn new() -> Self {
        Self::default()
    }

    fn push(&mut self, name: &str, dtype: DType, count: usize, bytes: Vec<u8>) {
        assert!(!name.is_empty() && name.len() <= 16 && name.is_ascii(), "bad section name {name}");
        assert!(self.entries.iter().all(|e| e.0 != name), "duplicate section {name}");
        self.entries.push((String::from(name), dtype, count, bytes));
    }

    pub fn u8s(&mut self, name: &str, v: &[u8]) {
        self.push(name, DType::U8, v.len(), v.to_vec());
    }
    pub fn u16s(&mut self, name: &str, v: &[u16]) {
        self.push(name, DType::U16, v.len(), v.iter().flat_map(|x| x.to_le_bytes()).collect());
    }
    pub fn i16s(&mut self, name: &str, v: &[i16]) {
        self.push(name, DType::I16, v.len(), v.iter().flat_map(|x| x.to_le_bytes()).collect());
    }
    pub fn u32s(&mut self, name: &str, v: &[u32]) {
        self.push(name, DType::U32, v.len(), v.iter().flat_map(|x| x.to_le_bytes()).collect());
    }
    pub fn f32s(&mut self, name: &str, v: &[f32]) {
        self.push(name, DType::F32, v.len(), v.iter().flat_map(|x| x.to_le_bytes()).collect());
    }

    pub fn finish(self) -> Vec<u8> {
        let n = self.entries.len();
        let mut offset = align8(HEADER + n * RECORD);
        let mut out = Vec::with_capacity(offset + self.entries.iter().map(|e| align8(e.3.len())).sum::<usize>());
        out.extend_from_slice(MAGIC);
        out.extend_from_slice(&VERSION.to_le_bytes());
        out.extend_from_slice(&(n as u32).to_le_bytes());
        out.extend_from_slice(&0u32.to_le_bytes());
        let mut offsets = Vec::with_capacity(n);
        for (name, dtype, count, bytes) in &self.entries {
            let mut raw = [0u8; 16];
            raw[..name.len()].copy_from_slice(name.as_bytes());
            out.extend_from_slice(&raw);
            out.extend_from_slice(&(*dtype as u32).to_le_bytes());
            out.extend_from_slice(&(*count as u32).to_le_bytes());
            out.extend_from_slice(&(offset as u32).to_le_bytes());
            out.extend_from_slice(&0u32.to_le_bytes());
            offsets.push(offset);
            offset = align8(offset + bytes.len());
        }
        for ((_, _, _, bytes), off) in self.entries.iter().zip(offsets) {
            out.resize(off, 0);
            out.extend_from_slice(bytes);
        }
        let end = align8(out.len());
        out.resize(end, 0);
        out
    }
}

fn align8(x: usize) -> usize {
    (x + 7) & !7
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_and_alignment() {
        let mut w = ContainerWriter::new();
        w.u8s("bytes", &[1, 2, 3]);
        w.u32s("words", &[7, 8, 9]);
        w.i16s("signed", &[-5, 6]);
        w.f32s("floats", &[0.5]);
        let buf = w.finish();
        let c = Container::parse(&buf).unwrap();
        for s in &c.sections {
            assert_eq!(s.offset % 8, 0);
        }
        assert_eq!(c.u8s("bytes").unwrap(), [1, 2, 3]);
        assert_eq!(c.u32s("words").unwrap(), [7, 8, 9]);
        assert_eq!(c.i16s("signed").unwrap(), [-5, 6]);
        assert_eq!(c.f32s("floats").unwrap(), [0.5]);
        assert_eq!(c.u32s("bytes"), Err(ContainerError::WrongType("bytes")));
        assert_eq!(c.u32s("nope").unwrap_err(), ContainerError::Missing("nope"));
    }

    #[test]
    fn rejects_corruption() {
        let mut w = ContainerWriter::new();
        w.u32s("a", &[1, 2]);
        let mut buf = w.finish();
        assert_eq!(Container::parse(&buf[..20]).err(), Some(ContainerError::Truncated));
        buf[0] = b'X';
        assert_eq!(Container::parse(&buf).err(), Some(ContainerError::BadMagic));
    }
}
