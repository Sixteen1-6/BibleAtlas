//! Places: the places each verse names, where they were and how sure that is,
//! for the map behind the reader's "Places:" line.
//!
//! - Places, the verses that name them, the modern sites proposed for each and
//!   how confident scholarship is in each site: OpenBible.info Bible Geocoding
//!   Data (CC BY 4.0). Coordinates the dataset credits to OpenStreetMap (ODbL)
//!   or takes from a Palestine Grid reference (`epsg_28191`) are left out, and
//!   where it gives an independently made position for a site
//!   (`custom_lonlat`) that one is used.
//! - People tied to a place (born there, died there, or was there): Theographic
//!   Bible Metadata (CC BY-SA 4.0), so people.json is shared under CC BY-SA 4.0.
//! - Coastlines, lakes, rivers, sea names and modern countries: Natural Earth
//!   (public domain), cut to the Bible lands and simplified.
//!
//! The geocoding data tags verses from ten other English translations, so a
//! place is listed under a verse only where the BSB text of that verse (or,
//! where the verse breaks differ, the verse next to it) names it.
//!
//! Outputs, under web/public/data:
//! - extras/real-map.json: each verse's places in reading order and each
//!   place's name. Small, because it loads the first time a verse is selected.
//! - extras/real-map/places.json: each place's kind and proposed sites.
//! - extras/real-map/base.json: the map itself.
//! - extras/real-map/people.json: people tied to each place (CC BY-SA 4.0).
//!
//! The last three load only when the map panel opens.

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::Versification;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::Path;

const OUT: &str = "extras/real-map.json";
const OUT_PLACES: &str = "extras/real-map/places.json";
const OUT_BASE: &str = "extras/real-map/base.json";
const OUT_PEOPLE: &str = "extras/real-map/people.json";

const GEO: &str = "openbible-geo";
const THEO: &str = "theographic";
const NE: &str = "natural-earth";

/// The Bible lands the map covers: west, south, east, north, in degrees.
const BOX: [f64; 4] = [10.0, 15.0, 60.0, 42.0];
/// Base-map coordinates are whole thousandths of a degree (about 100 m).
const Q: f64 = 1000.0;
/// Coastlines, lakes and rivers stay within this many degrees of the source
/// (about 400 m).
const TOLERANCE: f64 = 0.004;
/// Land and lake rings smaller than this many square degrees (about 4 km²)
/// are left out.
const MIN_AREA: f64 = 0.0004;
/// The most proposed sites kept for one place.
const MAX_SITES: usize = 8;
/// Proposed sites this close (km) are one spot by two names: a tell and the
/// village beside it (Ras el Kharruba and Anata, for Anathoth).
const SAME_SPOT_KM: f64 = 1.0;
/// The most people kept for one place.
const MAX_PEOPLE: usize = 60;
/// Past this distance from Jerusalem (km) the panel names the modern country.
const FAR_KM: f64 = 300.0;
/// A site at least this confident (out of 1000) is drawn on the map by default.
const CONFIDENT: i64 = 500;
/// Lakes made or refilled in modern times, which the map leaves out.
const MODERN_LAKES: [&str; 2] = ["Lake Razazah", "Sarygamysh Köli"];
/// Natural Earth river names, and the name the map gives them.
const RIVERS: [(&str, &str); 9] = [
    ("Jordan", "Jordan"),
    ("Nile", "Nile"),
    ("Damietta Branch", "Nile"),
    ("Rosetta Branch", "Nile"),
    ("Euphrates", "Euphrates"),
    ("Firat", "Euphrates"),
    ("Al Furat", "Euphrates"),
    ("Tigris", "Tigris"),
    ("Dicle", "Tigris"),
];

/// (longitude, latitude) in degrees.
type Pt = (f64, f64);

// ------------------------------------------------------------------ geometry

/// Cut a closed ring to BOX (Sutherland–Hodgman). Parts outside become a run
/// along the box edge, which is off the map's edge anyway.
fn clip_ring(ring: &[Pt]) -> Vec<Pt> {
    let [w, s, e, n] = BOX;
    let mut pts = ring.to_vec();
    if pts.len() > 1 && pts.first() == pts.last() {
        pts.pop();
    }
    let at_x = |x: f64| move |a: Pt, b: Pt| (x, a.1 + (b.1 - a.1) * (x - a.0) / (b.0 - a.0));
    let at_y = |y: f64| move |a: Pt, b: Pt| (a.0 + (b.0 - a.0) * (y - a.1) / (b.1 - a.1), y);
    pts = clip_edge(&pts, |p| p.0 >= w, at_x(w));
    pts = clip_edge(&pts, |p| p.0 <= e, at_x(e));
    pts = clip_edge(&pts, |p| p.1 >= s, at_y(s));
    clip_edge(&pts, |p| p.1 <= n, at_y(n))
}

fn clip_edge(pts: &[Pt], inside: impl Fn(Pt) -> bool, cut: impl Fn(Pt, Pt) -> Pt) -> Vec<Pt> {
    let mut out = Vec::with_capacity(pts.len());
    let Some(&last) = pts.last() else {
        return out;
    };
    let mut prev = last;
    for &cur in pts {
        match (inside(prev), inside(cur)) {
            (true, true) => out.push(cur),
            (true, false) => out.push(cut(prev, cur)),
            (false, true) => {
                out.push(cut(prev, cur));
                out.push(cur);
            }
            (false, false) => {}
        }
        prev = cur;
    }
    out
}

fn in_box(p: Pt) -> bool {
    p.0 >= BOX[0] && p.0 <= BOX[2] && p.1 >= BOX[1] && p.1 <= BOX[3]
}

/// The parts of an open line that lie inside BOX.
fn clip_line(line: &[Pt]) -> Vec<Vec<Pt>> {
    let mut parts = Vec::new();
    let mut cur: Vec<Pt> = Vec::new();
    for &p in line {
        if in_box(p) {
            cur.push(p);
        } else if cur.len() > 1 {
            parts.push(std::mem::take(&mut cur));
        } else {
            cur.clear();
        }
    }
    if cur.len() > 1 {
        parts.push(cur);
    }
    parts
}

/// East–west distances are scaled for the middle of the map (32°N), so a
/// tolerance or clearance means about the same on the ground in every direction.
fn scaled(a: Pt) -> Pt {
    (a.0 * 32f64.to_radians().cos(), a.1)
}

fn seg_dist(p: Pt, a: Pt, b: Pt) -> f64 {
    let (p, a, b) = (scaled(p), scaled(a), scaled(b));
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let len = dx * dx + dy * dy;
    let t = if len == 0.0 {
        0.0
    } else {
        (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / len).clamp(0.0, 1.0)
    };
    (p.0 - a.0 - t * dx).hypot(p.1 - a.1 - t * dy)
}

/// Douglas–Peucker: the points of an open line needed to stay within `tol`.
fn simplify(pts: &[Pt], tol: f64) -> Vec<Pt> {
    if pts.len() < 3 {
        return pts.to_vec();
    }
    let mut keep = vec![false; pts.len()];
    keep[0] = true;
    keep[pts.len() - 1] = true;
    let mut stack = vec![(0, pts.len() - 1)];
    while let Some((i, j)) = stack.pop() {
        let (mut far, mut at) = (0.0, i);
        for (m, &p) in pts.iter().enumerate().take(j).skip(i + 1) {
            let d = seg_dist(p, pts[i], pts[j]);
            if d > far {
                far = d;
                at = m;
            }
        }
        if far > tol {
            keep[at] = true;
            stack.push((i, at));
            stack.push((at, j));
        }
    }
    pts.iter()
        .zip(keep)
        .filter(|(_, k)| *k)
        .map(|(p, _)| *p)
        .collect()
}

/// Douglas–Peucker for a closed ring (given without its closing point).
fn simplify_ring(ring: &[Pt], tol: f64) -> Vec<Pt> {
    if ring.len() < 4 {
        return ring.to_vec();
    }
    let mut closed = ring.to_vec();
    closed.push(ring[0]);
    let mut out = simplify(&closed, tol);
    out.pop();
    out
}

/// Area in square degrees (shoelace; the sign gives the direction).
fn area(ring: &[Pt]) -> f64 {
    let n = ring.len();
    (0..n)
        .map(|i| ring[(i + n - 1) % n].0 * ring[i].1 - ring[i].0 * ring[(i + n - 1) % n].1)
        .sum::<f64>()
        / 2.0
}

/// Even–odd point-in-polygon over a set of rings (outer rings and holes).
fn inside(rings: &[Vec<Pt>], p: Pt) -> bool {
    let mut odd = false;
    for r in rings {
        let Some(&last) = r.last() else { continue };
        let mut prev = last;
        for &cur in r {
            if (cur.1 > p.1) != (prev.1 > p.1)
                && p.0 < (prev.0 - cur.0) * (p.1 - cur.1) / (prev.1 - cur.1) + cur.0
            {
                odd = !odd;
            }
            prev = cur;
        }
    }
    odd
}

/// Distance from a point to the nearest edge of a set of rings, in scaled degrees.
fn clearance(rings: &[Vec<Pt>], p: Pt) -> f64 {
    let mut best = f64::INFINITY;
    for r in rings {
        let Some(&last) = r.last() else { continue };
        let mut prev = last;
        for &cur in r {
            best = best.min(seg_dist(p, prev, cur));
            prev = cur;
        }
    }
    best
}

/// Points deep inside a shape, for its label: a grid of candidates, the most
/// open first, each at least `sep` (scaled degrees) from those before it.
fn label_points(rings: &[Vec<Pt>], step: f64, sep: f64, max: usize) -> Vec<(Pt, f64)> {
    let (mut w, mut s, mut e, mut n) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
    for &(x, y) in rings.iter().flatten() {
        (w, s, e, n) = (w.min(x), s.min(y), e.max(x), n.max(y));
    }
    let mut cands = Vec::new();
    let mut y = s + step / 2.0;
    while y < n {
        let mut x = w + step / 2.0;
        while x < e {
            if inside(rings, (x, y)) {
                cands.push(((x, y), clearance(rings, (x, y))));
            }
            x += step;
        }
        y += step;
    }
    cands.sort_by(|a, b| b.1.total_cmp(&a.1));
    let mut out: Vec<(Pt, f64)> = Vec::new();
    for c in cands {
        if out.len() >= max {
            break;
        }
        if out.iter().all(|o| {
            let (a, b) = (scaled(o.0), scaled(c.0));
            (a.0 - b.0).hypot(a.1 - b.1) >= sep
        }) {
            out.push(c);
        }
    }
    out
}

/// Great-circle distance in km.
fn km(a: Pt, b: Pt) -> f64 {
    let (la, lb) = (a.1.to_radians(), b.1.to_radians());
    let h = ((lb - la) / 2.0).sin().powi(2)
        + la.cos() * lb.cos() * ((b.0 - a.0).to_radians() / 2.0).sin().powi(2);
    2.0 * 6371.0 * h.sqrt().min(1.0).asin()
}

/// Quantize to thousandths of a degree and delta-encode: [x0, y0, dx1, dy1, ...].
/// Points that fall on the same quantized spot as the one before are dropped.
fn encode(pts: &[Pt]) -> Vec<i64> {
    let mut out = Vec::with_capacity(pts.len() * 2);
    let mut prev: Option<(i64, i64)> = None;
    for &(x, y) in pts {
        let q = ((x * Q).round() as i64, (y * Q).round() as i64);
        match prev {
            Some(p) if p == q => continue,
            Some(p) => out.extend([q.0 - p.0, q.1 - p.1]),
            None => out.extend([q.0, q.1]),
        }
        prev = Some(q);
    }
    out
}

/// The inverse of `encode`, for verify().
fn decode(v: &[Value]) -> Vec<Pt> {
    let mut out = Vec::with_capacity(v.len() / 2);
    let (mut x, mut y) = (0i64, 0i64);
    for (i, pair) in v.chunks_exact(2).enumerate() {
        let (dx, dy) = (pair[0].as_i64().unwrap_or(0), pair[1].as_i64().unwrap_or(0));
        (x, y) = if i == 0 { (dx, dy) } else { (x + dx, y + dy) };
        out.push((x as f64 / Q, y as f64 / Q));
    }
    out
}

fn round(x: f64, places: i32) -> f64 {
    let k = 10f64.powi(places);
    (x * k).round() / k
}

// ------------------------------------------------------------------ reading

fn read(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))
}

fn read_json(path: &Path) -> Result<Value, String> {
    serde_json::from_str(&read(path)?).map_err(|e| format!("parsing {}: {e}", path.display()))
}

fn read_jsonl(path: &Path) -> Result<Vec<Value>, String> {
    read(path)?
        .lines()
        .enumerate()
        .filter(|(_, l)| !l.trim().is_empty())
        .map(|(i, l)| {
            serde_json::from_str(l)
                .map_err(|e| format!("parsing {} line {}: {e}", path.display(), i + 1))
        })
        .collect()
}

fn ring_of(v: &Value) -> Vec<Pt> {
    let Some(a) = v.as_array() else {
        return Vec::new();
    };
    a.iter()
        .filter_map(|p| Some((p.get(0)?.as_f64()?, p.get(1)?.as_f64()?)))
        .filter(|p| p.0.is_finite() && p.1.is_finite())
        .collect()
}

/// A GeoJSON geometry's polygons, each as its rings.
fn polygons(g: &Value) -> Vec<Vec<Vec<Pt>>> {
    let rings = |p: &Value| {
        p.as_array()
            .map(|rs| rs.iter().map(ring_of).collect())
            .unwrap_or_default()
    };
    match g["type"].as_str() {
        Some("Polygon") => vec![rings(&g["coordinates"])],
        Some("MultiPolygon") => g["coordinates"]
            .as_array()
            .map(|ps| ps.iter().map(rings).collect())
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

/// A GeoJSON geometry's lines.
fn lines(g: &Value) -> Vec<Vec<Pt>> {
    match g["type"].as_str() {
        Some("LineString") => vec![ring_of(&g["coordinates"])],
        Some("MultiLineString") => g["coordinates"]
            .as_array()
            .map(|ls| ls.iter().map(ring_of).collect())
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

fn features(path: &Path) -> Result<Vec<Value>, String> {
    match read_json(path)? {
        Value::Object(mut o) => match o.remove("features") {
            Some(Value::Array(a)) => Ok(a),
            _ => Err(format!("{} has no features", path.display())),
        },
        _ => Err(format!("{} is not a GeoJSON object", path.display())),
    }
}

/// RFC 4180 rows: commas, double quotes ("" inside quotes), newlines inside quotes.
fn csv(text: &str) -> Vec<Vec<String>> {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    let (mut rows, mut row, mut field) = (Vec::new(), Vec::new(), String::new());
    let mut quoted = false;
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if quoted {
            if c != '"' {
                field.push(c);
            } else if chars.peek() == Some(&'"') {
                field.push('"');
                chars.next();
            } else {
                quoted = false;
            }
            continue;
        }
        match c {
            '"' => quoted = true,
            ',' => row.push(std::mem::take(&mut field)),
            '\r' => {}
            '\n' => {
                row.push(std::mem::take(&mut field));
                rows.push(std::mem::take(&mut row));
            }
            _ => field.push(c),
        }
    }
    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }
    rows
}

/// A CSV file with a header row, read by column name.
struct Table {
    cols: HashMap<String, usize>,
    rows: Vec<Vec<String>>,
}

impl Table {
    fn open(path: &Path, need: &[&str]) -> Result<Self, String> {
        let mut rows = csv(&read(path)?);
        if rows.is_empty() {
            return Err(format!("{} is empty", path.display()));
        }
        let head = rows.remove(0);
        let cols: HashMap<String, usize> = head
            .iter()
            .enumerate()
            .map(|(i, h)| (h.trim().to_string(), i))
            .collect();
        if let Some(missing) = need.iter().find(|c| !cols.contains_key(**c)) {
            return Err(format!("{} has no column {missing}", path.display()));
        }
        Ok(Self { cols, rows })
    }

    fn get<'a>(&self, row: &'a [String], col: &str) -> &'a str {
        self.cols
            .get(col)
            .and_then(|&i| row.get(i))
            .map(|s| s.trim())
            .unwrap_or("")
    }
}

fn list(s: &str) -> impl Iterator<Item = &str> {
    s.split(',').map(str::trim).filter(|x| !x.is_empty())
}

/// "Isa.40.3" as a verse number in the BSB, if the BSB has that verse.
fn osis_verse(osis: &str, vz: &Versification) -> Option<u32> {
    let mut it = osis.trim().split('.');
    let book = atlas_core::canon::by_osis(it.next()?)?;
    let chapter: u16 = it.next()?.parse().ok()?;
    let verse: u16 = it.next()?.parse().ok()?;
    if it.next().is_some() {
        return None;
    }
    vz.index(book, chapter, verse)
}

fn same_chapter(vz: &Versification, a: u32, b: u32) -> bool {
    match (vz.locate(a), vz.locate(b)) {
        (Some(x), Some(y)) => x.0 == y.0 && x.1 == y.1,
        _ => false,
    }
}

// ------------------------------------------------------------------ names in the text

fn alike(a: char, b: char) -> bool {
    let dash = |c: char| matches!(c, '-' | ' ' | '\u{2010}' | '\u{2011}');
    let apos = |c: char| matches!(c, '\'' | '\u{2019}');
    a == b || (dash(a) && dash(b)) || (apos(a) && apos(b))
}

/// Where `form` first appears in `text` as a whole name: not inside a longer
/// word ("Bethlehem" is not found in "Bethlehemite", but is in "Bethlehem’s").
/// Hyphens and spaces count as the same, and so do straight and curly
/// apostrophes. Names in capitals ("BABYLON THE GREAT") are found too, and
/// names of two words or more are matched without regard to case.
fn find_name(text: &[char], form: &[char]) -> Option<usize> {
    find_name_where(text, form, |_| true)
}

/// find_name, taking only a place where `ok(start)` holds.
fn find_name_where(text: &[char], form: &[char], ok: impl Fn(usize) -> bool) -> Option<usize> {
    if form.is_empty() || form.len() > text.len() {
        return None;
    }
    let words = form.iter().filter(|c| **c == ' ' || **c == '-').count() + 1;
    let modes: &[u8] = if words >= 2 { &[0, 1, 2] } else { &[0, 1] };
    for &mode in modes {
        let eq = |t: char, f: char| match mode {
            0 => alike(t, f),
            1 => f.to_uppercase().eq(std::iter::once(t)) || alike(t, f),
            _ => t.to_lowercase().eq(f.to_lowercase()) || alike(t, f),
        };
        for start in 0..=text.len() - form.len() {
            if start > 0 && text[start - 1].is_alphabetic() {
                continue;
            }
            if !form.iter().zip(&text[start..]).all(|(&f, &t)| eq(t, f)) {
                continue;
            }
            let after = text.get(start + form.len());
            let whole = match after {
                None => true,
                Some(c) if mode == 0 => !c.is_lowercase(),
                Some(c) => !c.is_alphabetic(),
            };
            if whole && ok(start) {
                return Some(start);
            }
        }
    }
    None
}

/// Names of peoples ("Bethlehemite", "Philistines", "Arameans", "Jews"), which
/// are never shown as a place's name.
fn people_word(form: &str, base: &str) -> bool {
    const PLURAL: [&str; 6] = ["ites", "ians", "eans", "enes", "ines", "ans"];
    const SINGULAR: [&str; 6] = ["ite", "ian", "ean", "ene", "ine", "an"];
    const IRREGULAR: [&str; 6] = ["Jew", "Jews", "Mede", "Medes", "Greek", "Greeks"];
    let (f, b) = (form.to_lowercase(), base.to_lowercase());
    // The place's own name, or a word of it ("Jordan" for "Jordan River").
    if f == b || b.split(|c: char| !c.is_alphabetic()).any(|w| w == f) {
        return false;
    }
    // A singular ending counts only on a word made from the place's name,
    // since places end that way too ("Midian", "Canaan").
    let shared = f.chars().zip(b.chars()).take_while(|(x, y)| x == y).count();
    IRREGULAR.contains(&form)
        || PLURAL.iter().any(|e| f.ends_with(e))
        || (SINGULAR.iter().any(|e| f.ends_with(e)) && shared >= b.chars().count().min(4))
}

/// Single common words some translations print as a name ("the Sea", "the
/// River"), never used on their own to find a place in the BSB.
const GENERIC: [&str; 24] = [
    "sea",
    "river",
    "lower",
    "upper",
    "south",
    "north",
    "east",
    "west",
    "valley",
    "mount",
    "mountain",
    "desert",
    "wilderness",
    "city",
    "gate",
    "lake",
    "brook",
    "wadi",
    "plain",
    "hill",
    "land",
    "island",
    "coast",
    "field",
];

/// A spelling compared loosely: lower case, hyphens as spaces, straight apostrophes.
fn loose(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '-' | '\u{2010}' | '\u{2011}' => ' ',
            '\u{2019}' => '\'',
            c => c,
        })
        .flat_map(char::to_lowercase)
        .collect()
}

// ------------------------------------------------------------------ places

#[derive(Clone, Debug)]
struct Site {
    at: Pt,
    score: i64,
    name: String,
}

#[derive(Debug)]
struct Place {
    id: String,
    slug: String,
    /// The dataset's name without its number: "Bethlehem 1" -> "Bethlehem".
    base: String,
    /// The spellings the translations use, longest first.
    forms: Vec<Vec<char>>,
    /// Each spelling's share of the places where the translations name it.
    shares: Vec<f64>,
    kind: String,
    /// Proposed modern sites with coordinates, most confident first.
    sites: Vec<Site>,
    /// The strongest proposed site, with its score, when the map cannot draw
    /// it: the dataset's only position for it is one this app leaves out
    /// (credited to OpenStreetMap, or from a Palestine Grid reference).
    off: Option<(String, i64)>,
    /// How sure the dataset is of where the strongest site is: its score,
    /// with those of other sites within SAME_SPOT_KM of it, since they are
    /// the same spot by another name (Rhodes, and the Acropolis of Rhodes).
    sure: i64,
    /// The strongest "special" reading (for example "not_a_place"), with its
    /// score, whether it is the strongest reading overall, and the dataset's
    /// words for it ("not a place (person)").
    special: Option<(String, i64, bool, String)>,
    /// The strongest identification that is not a special reading.
    how: Option<How>,
    /// The dataset's note on the place, with its markup.
    comment: String,
    /// (OSIS reference, translations that name it there as a place, and
    /// translations that name its people there instead).
    verses: Vec<(String, u64, u64)>,
}

/// An identification in OpenBible.info's own words, with its markup:
/// `within 8 km of <ancient id="a15257a">Jerusalem</ancient>`.
#[derive(Debug, Clone, Default)]
struct How {
    html: String,
    /// The first ancient place it names ("a15257a" for Jerusalem).
    target: Option<String>,
    /// Whether it names only ancient places, which a reader of the Bible
    /// knows, and no modern ones ("Wadi Gharandal").
    ancient_only: bool,
}

#[derive(Default)]
struct Tally {
    places: usize,
    mentions: usize,
    unmapped: usize,
    not_named: usize,
    moved: usize,
    not_in_bsb: usize,
    not_a_place: usize,
    withheld_sites: usize,
    no_coordinates: usize,
}

fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut tag = false;
    for c in s.chars() {
        match c {
            '<' => tag = true,
            '>' => tag = false,
            _ if !tag => out.push(c),
            _ => {}
        }
    }
    out.trim().to_string()
}

fn lonlat(s: &str) -> Option<Pt> {
    let (a, b) = s.split_once(',')?;
    let p: Pt = (a.trim().parse().ok()?, b.trim().parse().ok()?);
    (p.0.is_finite() && p.1.is_finite() && p.0.abs() <= 180.0 && p.1.abs() <= 90.0).then_some(p)
}

/// Modern locations: their coordinates, unless the dataset credits them to
/// OpenStreetMap (ODbL) or takes them from a Palestine Grid (EPSG:28191)
/// reference; this app uses neither. `None` means "no usable coordinates".
fn moderns(rows: &[Value], t: &mut Tally) -> HashMap<String, Option<Pt>> {
    let mut out = HashMap::new();
    for r in rows {
        let Some(id) = r["id"].as_str() else { continue };
        let custom = r["custom_lonlat"].as_str().and_then(lonlat);
        let withheld = matches!(
            r["coordinates_source"]["type"].as_str(),
            Some("osm" | "epsg_28191")
        );
        let at = match (custom, withheld) {
            (Some(p), _) => Some(p),
            (None, true) => {
                t.withheld_sites += 1;
                None
            }
            (None, false) => r["lonlat"].as_str().and_then(lonlat),
        };
        out.insert(id.to_string(), at);
    }
    out
}

fn score_of(identification: &Value) -> i64 {
    identification["score"]["time_total"].as_i64().unwrap_or(0)
}

fn places(rows: &[Value], moderns: &HashMap<String, Option<Pt>>, t: &mut Tally) -> Vec<Place> {
    let mut out = Vec::new();
    for r in rows {
        let (Some(id), Some(fid)) = (r["id"].as_str(), r["friendly_id"].as_str()) else {
            continue;
        };
        let base = match fid.rsplit_once(' ') {
            Some((b, n)) if !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()) => b.to_string(),
            _ => fid.to_string(),
        };
        // The place's own name, and the spellings that make up at least one
        // in a hundred of the places where the translations name it (which
        // leaves out one translation's paraphrase, such as "Judah" for Jerusalem).
        let mut forms: Vec<(String, f64)> = vec![(base.clone(), 1.0)];
        if let Some(o) = r["translation_name_counts"].as_object() {
            let total = o.values().filter_map(Value::as_u64).sum::<u64>().max(1) as f64;
            forms.extend(
                o.iter()
                    .filter_map(|(k, n)| Some((k.clone(), n.as_u64()? as f64 / total)))
                    .filter(|(_, share)| *share >= 0.01),
            );
        }
        forms.retain(|(f, _)| f.chars().any(char::is_alphabetic));
        forms.sort_by(|a, b| {
            b.0.chars()
                .count()
                .cmp(&a.0.chars().count())
                .then_with(|| a.0.cmp(&b.0))
                .then_with(|| b.1.total_cmp(&a.1))
        });
        forms.dedup_by(|a, b| a.0 == b.0);

        let ids: &[Value] = r["identifications"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let best = ids.iter().max_by_key(|i| score_of(i));
        let is_special = |i: &Value| i["id_source"].as_str() == Some("special");
        let types_of = |v: &Value| -> Vec<String> {
            v.as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|x| x.as_str().map(str::to_string))
                        .collect()
                })
                .unwrap_or_default()
        };
        let kind = ids
            .iter()
            .filter(|i| !is_special(i))
            .max_by_key(|i| score_of(i))
            .map(|i| types_of(&i["types"]))
            .unwrap_or_default()
            .into_iter()
            .chain(types_of(&r["types"]))
            .find(|k| k != "special")
            .unwrap_or_else(|| "place".to_string());
        let special = ids
            .iter()
            .filter(|i| is_special(i))
            .max_by_key(|i| score_of(i))
            .map(|i| {
                let name = i["special"].as_str().unwrap_or("").to_string();
                let words = i["description"].as_str().unwrap_or("").to_string();
                (
                    name,
                    score_of(i),
                    best.is_some_and(|b| std::ptr::eq(b, i)),
                    words,
                )
            });
        let how = ids
            .iter()
            .filter(|i| !is_special(i))
            .max_by_key(|i| score_of(i))
            .map(|i| {
                let html = i["description"].as_str().unwrap_or("").to_string();
                How {
                    target: ancient_ids(&html).into_iter().next(),
                    ancient_only: html.contains("<ancient") && !html.contains("<modern"),
                    html,
                }
            });

        let mut sites = Vec::new();
        let mut off: Option<(String, i64)> = None;
        if let Some(assoc) = r["modern_associations"].as_object() {
            for (mid, a) in assoc {
                let score = a["score"].as_i64().unwrap_or(0).min(1000);
                if score <= 0 {
                    continue;
                }
                let name = strip_tags(a["name"].as_str().unwrap_or(""));
                match moderns.get(mid) {
                    Some(Some(at)) => sites.push(Site {
                        at: *at,
                        score,
                        name,
                    }),
                    _ => {
                        t.no_coordinates += 1;
                        if off.as_ref().is_none_or(|o| score > o.1) {
                            off = Some((name, score));
                        }
                    }
                }
            }
        }
        sites.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.name.cmp(&b.name)));
        sites.truncate(MAX_SITES);
        // Only a site stronger than every one the map can draw matters here.
        let off = off.filter(|o| sites.first().is_none_or(|s| o.1 > s.score));
        let sure = sites.first().map_or(0, |b| {
            sites
                .iter()
                .filter(|s| km(b.at, s.at) <= SAME_SPOT_KM)
                .map(|s| s.score)
                .sum::<i64>()
                .min(1000)
        });

        let verses = r["verses"]
            .as_array()
            .map(|vs| {
                vs.iter()
                    .filter_map(|v| {
                        let it = &v["instance_types"];
                        let named = ["name", "combined", "partial"]
                            .iter()
                            .map(|k| it[*k].as_u64().unwrap_or(0))
                            .sum();
                        let group = it["people_group"].as_u64().unwrap_or(0);
                        Some((v["osis"].as_str()?.to_string(), named, group))
                    })
                    .collect()
            })
            .unwrap_or_default();
        out.push(Place {
            id: id.to_string(),
            slug: r["url_slug"].as_str().unwrap_or("").to_string(),
            base,
            forms: forms.iter().map(|(f, _)| f.chars().collect()).collect(),
            shares: forms.iter().map(|(_, share)| *share).collect(),
            kind,
            sites,
            off,
            sure,
            special,
            how,
            comment: r["comment"].as_str().unwrap_or("").to_string(),
            verses,
        });
    }
    t.places = out.len();
    out
}

/// The ids of the ancient places a piece of the dataset's markup links to,
/// in order.
fn ancient_ids(html: &str) -> Vec<String> {
    html.split("<ancient id=\"")
        .skip(1)
        .filter_map(|s| s.split('"').next())
        .map(str::to_string)
        .collect()
}

/// "Bethel 1" -> "Bethel": the dataset's name for a place without the number
/// that tells places of one name apart.
fn unnumbered(name: &str) -> &str {
    match name.rsplit_once(' ') {
        Some((b, n)) if !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()) => b,
        _ => name,
    }
}

/// The dataset's markup as plain words. Each ancient place it links to is
/// called by `name_of` (the name the BSB gives it), or else by the dataset's
/// name without its number; other links become their text.
fn plain(html: &str, name_of: &dyn Fn(&str) -> Option<String>) -> String {
    let mut out = String::new();
    let mut rest = html;
    while let Some(i) = rest.find('<') {
        out.push_str(&rest[..i]);
        rest = &rest[i..];
        let Some(j) = rest.find('>') else {
            rest = "";
            break;
        };
        let tag = &rest[1..j];
        rest = &rest[j + 1..];
        let name = tag.split_whitespace().next().unwrap_or("");
        if name.is_empty() || name.starts_with('/') {
            continue;
        }
        let close = format!("</{name}>");
        let Some(k) = rest.find(&close) else { continue };
        let inner = strip_tags(&rest[..k]);
        let id = tag.split("id=\"").nth(1).and_then(|s| s.split('"').next());
        match (name, id) {
            ("ancient", Some(id)) => {
                out.push_str(&name_of(id).unwrap_or_else(|| unnumbered(&inner).to_string()))
            }
            _ => out.push_str(&inner),
        }
        rest = &rest[k + close.len()..];
    }
    out.push_str(rest);
    let out = out
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "’")
        .replace('\'', "’");
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// One place named in one verse: where in the verse, which spelling, how
/// long it is there, and the name as the BSB prints it there when that can
/// stand as the place's name.
struct Mention {
    verse: u32,
    pos: usize,
    len: usize,
    name: Option<String>,
}

/// The words at `pos` as a name, unless they are in capitals ("BABYLON") or
/// start in lower case.
fn surface(words: &[char], pos: usize, len: usize) -> Option<String> {
    let s: String = words.get(pos..pos + len)?.iter().collect();
    let first_upper = s.chars().next().is_some_and(char::is_uppercase);
    let has_lower = s.chars().any(char::is_lowercase);
    (first_upper && has_lower).then_some(s)
}

/// Where the BSB names this place, verse by verse.
fn mentions(
    p: &Place,
    vz: &Versification,
    text: &[Vec<char>],
    tagged: &HashMap<u32, HashSet<String>>,
    t: &mut Tally,
) -> Vec<Mention> {
    let own = loose(&p.base);
    let keys: Vec<String> = p
        .forms
        .iter()
        .map(|f| loose(&f.iter().collect::<String>()))
        .collect();
    let find = |v: u32| -> Option<Mention> {
        let words = text.get(v as usize)?;
        let others = tagged.get(&v);
        // Earliest position; at the same position the longer spelling (listed
        // first). A spelling that is the name of another place the sources find
        // in the same verse ("Tubal" among Meshech's) belongs to that place.
        let (pos, form) = p
            .forms
            .iter()
            .enumerate()
            .filter(|(i, _)| keys[*i] == own || !others.is_some_and(|o| o.contains(&keys[*i])))
            .filter_map(|(i, f)| find_name(words, f).map(|pos| (pos, i)))
            .min()?;
        let len = p.forms[form].len();
        Some(Mention {
            verse: v,
            pos,
            len,
            name: surface(words, pos, len).filter(|s| !people_word(s, &p.base)),
        })
    };
    let mut out: Vec<Mention> = Vec::new();
    for (osis, named, group) in &p.verses {
        let Some(v) = osis_verse(osis, vz) else {
            t.unmapped += 1;
            continue;
        };
        if *named == 0 || named < group {
            t.not_named += 1;
            continue;
        }
        if let Some(m) = find(v) {
            out.push(m);
            continue;
        }
        // Most translations name it here, but the BSB breaks the verses
        // differently: look in the verse after, then the verse before.
        let near = if *named >= 5 {
            [v.checked_add(1), v.checked_sub(1)]
                .into_iter()
                .flatten()
                .filter(|&w| same_chapter(vz, v, w))
                .find_map(find)
        } else {
            None
        };
        match near {
            Some(m) => {
                t.moved += 1;
                out.push(m);
            }
            None => t.not_in_bsb += 1,
        }
    }
    out.sort_by_key(|m| (m.verse, m.pos));
    out.dedup_by_key(|m| m.verse);
    out
}

/// The name to show: the spelling the BSB prints most often for this place
/// ("Pi-hahiroth", "Negev"), or the dataset's name if the BSB only ever names
/// its people ("Bethlehemite") or prints it in capitals.
fn display_name(p: &Place, ms: &[Mention]) -> String {
    let mut count: BTreeMap<&str, usize> = BTreeMap::new();
    for m in ms {
        if let Some(n) = &m.name {
            *count.entry(n.as_str()).or_default() += 1;
        }
    }
    let base: Vec<char> = p.base.chars().collect();
    let is_base = |n: &str| {
        let c: Vec<char> = n.chars().collect();
        c.len() == base.len()
            && c.iter()
                .zip(&base)
                .all(|(a, b)| alike(*a, *b) || a.to_lowercase().eq(b.to_lowercase()))
    };
    count
        .iter()
        .max_by(|a, b| {
            a.1.cmp(b.1)
                .then_with(|| is_base(a.0).cmp(&is_base(b.0)))
                .then_with(|| a.0.len().cmp(&b.0.len()))
        })
        .map(|(n, _)| n.to_string())
        .unwrap_or_else(|| p.base.clone())
}

// ------------------------------------------------------------------ the base map

struct Base {
    json: Value,
    /// The Dead Sea's rings, for the Jerusalem line ("about 20 km west of the Dead Sea").
    dead_sea: Vec<Vec<Pt>>,
    /// Each named river's lines, by the map's name for it ("Euphrates").
    rivers: HashMap<String, Vec<Vec<Pt>>>,
}

fn base_map(inputs: &Inputs) -> Result<Base, String> {
    let ring_out = |rings: &mut Vec<Value>, r: &[Pt]| -> Option<Vec<Pt>> {
        let c = clip_ring(r);
        if c.len() < 3 || area(&c).abs() < MIN_AREA {
            return None;
        }
        let s = simplify_ring(&c, TOLERANCE);
        if s.len() < 3 {
            return None;
        }
        let e = encode(&s);
        if e.len() < 6 {
            return None;
        }
        rings.push(json!(e));
        Some(c)
    };

    let mut land = Vec::new();
    for f in features(&inputs.path(NE, "land"))? {
        for poly in polygons(&f["geometry"]) {
            for r in &poly {
                ring_out(&mut land, r);
            }
        }
    }

    let mut lakes = Vec::new();
    let mut lake_names = Vec::new();
    let mut dead_sea: Vec<Vec<Pt>> = Vec::new();
    for f in features(&inputs.path(NE, "lakes"))? {
        let pr = &f["properties"];
        let name = pr["name"].as_str().unwrap_or("").trim().to_string();
        if !matches!(pr["featurecla"].as_str(), Some("Lake" | "Alkaline Lake"))
            || MODERN_LAKES.contains(&name.as_str())
        {
            continue;
        }
        let mut kept = Vec::new();
        for poly in polygons(&f["geometry"]) {
            for r in &poly {
                if let Some(c) = ring_out(&mut lakes, r) {
                    kept.push(c);
                }
            }
        }
        if kept.is_empty() || name.is_empty() {
            continue;
        }
        if name == "Dead Sea" {
            dead_sea.extend(kept.iter().cloned());
        }
        // Label the largest part (the Dead Sea's northern basin, not its southern pans).
        kept.sort_by(|a, b| area(b).abs().total_cmp(&area(a).abs()));
        let main = &kept[..1];
        let step = ((area(&main[0]).abs()).sqrt() / 12.0).max(0.004);
        if let Some(((x, y), _)) = label_points(main, step, 0.0, 1).first() {
            let rank = pr["scalerank"].as_f64().unwrap_or(9.0);
            if !lake_names.iter().any(|l: &Value| l[0] == json!(name)) {
                lake_names.push(json!([name, round(*x, 3), round(*y, 3), rank]));
            }
        }
    }

    let mut river_names: Vec<&str> = Vec::new();
    let mut courses: HashMap<String, Vec<Vec<Pt>>> = HashMap::new();
    let mut rivers = Vec::new();
    let mut river_labels = Vec::new();
    for f in features(&inputs.path(NE, "rivers"))? {
        let pr = &f["properties"];
        let ne_name = pr["name"].as_str().unwrap_or("");
        if pr["featurecla"].as_str() != Some("River")
            || ne_name.contains("Canal")
            || ne_name.contains("Channel")
        {
            continue;
        }
        let name = RIVERS.iter().find(|(n, _)| *n == ne_name).map(|(_, d)| *d);
        let idx: i64 = match name {
            Some(n) => match river_names.iter().position(|x| *x == n) {
                Some(i) => i as i64,
                None => {
                    river_names.push(n);
                    river_names.len() as i64 - 1
                }
            },
            None => -1,
        };
        for line in lines(&f["geometry"]) {
            for part in clip_line(&line) {
                let s = simplify(&part, TOLERANCE);
                let e = encode(&s);
                if e.len() < 4 {
                    continue;
                }
                let mut row = vec![json!(idx)];
                row.extend(e.into_iter().map(Value::from));
                rivers.push(Value::Array(row));
                if let Some(n) = name {
                    courses.entry(n.to_string()).or_default().push(s.clone());
                }
                if idx >= 0 {
                    // A label spot about every 0.6 degrees along the river.
                    let mut run = 0.3;
                    for w in s.windows(2) {
                        let (a, b) = (scaled(w[0]), scaled(w[1]));
                        run += (a.0 - b.0).hypot(a.1 - b.1);
                        if run >= 0.6 {
                            run = 0.0;
                            river_labels.push(json!([idx, round(w[1].0, 3), round(w[1].1, 3)]));
                        }
                    }
                }
            }
        }
    }

    let mut seas = Vec::new();
    for f in features(&inputs.path(NE, "seas"))? {
        let pr = &f["properties"];
        let name = pr["name"].as_str().unwrap_or("").trim();
        if name.is_empty() || !matches!(pr["featurecla"].as_str(), Some("sea" | "gulf" | "bay")) {
            continue;
        }
        let mut rings: Vec<Vec<Pt>> = Vec::new();
        for poly in polygons(&f["geometry"]) {
            rings.extend(
                poly.iter()
                    .map(|r| clip_ring(r))
                    .filter(|c| c.len() >= 3 && area(c).abs() > MIN_AREA),
            );
        }
        if rings.is_empty() {
            continue;
        }
        // Spots deep inside the water for its name, most open first, on a
        // finer grid for a narrow gulf.
        let size: f64 = rings.iter().map(|r| area(r).abs()).sum();
        let step = (size.sqrt() / 12.0).clamp(0.02, 0.2);
        let spots: Vec<Value> = label_points(&rings, step, 2.5, 8)
            .into_iter()
            .filter(|(_, c)| *c >= 0.04)
            .map(|((x, y), c)| json!([round(x, 3), round(y, 3), round(c, 3)]))
            .collect();
        if !spots.is_empty() {
            seas.push(json!([
                name,
                pr["scalerank"].as_f64().unwrap_or(9.0),
                spots
            ]));
        }
    }

    let json = json!({
        "format": 1,
        "q": Q,
        "box": BOX,
        "land": land,
        "lakes": lakes,
        "lakeNames": lake_names,
        "rivers": rivers,
        "riverNames": river_names,
        "riverLabels": river_labels,
        "seas": seas,
    });
    Ok(Base {
        json,
        dead_sea,
        rivers: courses,
    })
}

/// Land whose modern country is disputed, where the panel names none:
/// Crimea (west, south, east, north).
const DISPUTED: [[f64; 4]; 1] = [[32.4, 44.3, 36.7, 46.3]];

/// Modern countries, for "in modern Turkey".
struct Countries(Vec<(String, [f64; 4], Vec<Vec<Pt>>)>);

impl Countries {
    fn open(path: &Path) -> Result<Self, String> {
        let mut out = Vec::new();
        for f in features(path)? {
            let pr = &f["properties"];
            let admin = pr["ADMIN"].as_str().unwrap_or("");
            // The island's name, not a disputed state's.
            let name = if admin.contains("Cyprus") {
                "Cyprus"
            } else {
                pr["NAME_EN"]
                    .as_str()
                    .or(pr["NAME"].as_str())
                    .unwrap_or(admin)
            };
            let rings: Vec<Vec<Pt>> = polygons(&f["geometry"]).into_iter().flatten().collect();
            let mut b = [f64::MAX, f64::MAX, f64::MIN, f64::MIN];
            for &(x, y) in rings.iter().flatten() {
                b = [b[0].min(x), b[1].min(y), b[2].max(x), b[3].max(y)];
            }
            if !name.is_empty() && !rings.is_empty() {
                out.push((name.to_string(), b, rings));
            }
        }
        Ok(Self(out))
    }

    /// The country a point is in, or, for a point on the shore that the
    /// simplified borders leave just offshore (New Paphos), the country with
    /// a border point within 10 km.
    fn at(&self, p: Pt) -> Option<&str> {
        let within = |b: &[f64; 4], m: f64| {
            p.0 >= b[0] - m && p.0 <= b[2] + m && p.1 >= b[1] - m && p.1 <= b[3] + m
        };
        if DISPUTED.iter().any(|b| within(b, 0.0)) {
            return None;
        }
        if let Some((n, _, _)) = self
            .0
            .iter()
            .find(|(_, b, rings)| within(b, 0.0) && inside(rings, p))
        {
            return Some(n.as_str());
        }
        self.0
            .iter()
            .filter(|(_, b, _)| within(b, 0.2))
            .map(|(n, _, rings)| {
                let d = rings
                    .iter()
                    .flatten()
                    .map(|&q| km(p, q))
                    .fold(f64::MAX, f64::min);
                (d, n)
            })
            .filter(|&(d, _)| d <= 10.0)
            .min_by(|a, b| a.0.total_cmp(&b.0))
            .map(|(_, n)| n.as_str())
    }

    /// Whether a point is on any country's land.
    fn land(&self, q: Pt) -> bool {
        self.0.iter().any(|(_, b, rings)| {
            q.0 >= b[0] && q.0 <= b[2] && q.1 >= b[1] && q.1 <= b[3] && inside(rings, q)
        })
    }

    /// Whether the way from `p` to `q` stays on land, so a border across the
    /// sea is not near (Greek islands across the sea from Turkey, Egypt
    /// across the Gulf of Aqaba from Arabia).
    fn over_land(&self, p: Pt, q: Pt) -> bool {
        [1.0 / 3.0, 2.0 / 3.0]
            .iter()
            .all(|t| self.land((p.0 + (q.0 - p.0) * t, p.1 + (q.1 - p.1) * t)))
    }

    /// The other country whose land border passes within `limit` km of a
    /// point in `own`, measured to the border's lines, not only its corners
    /// (the simplified border past Carchemish is a long straight line). A
    /// state too small to place anything by is left out (Vatican City,
    /// within Rome).
    fn border_with(&self, p: Pt, own: &str, limit: f64) -> Option<&str> {
        let deg = limit / 80.0;
        // The point of the line a-b nearest to p, on a flat map around p.
        let (kx, ky) = (111.32 * p.1.to_radians().cos(), 110.57);
        let nearest = |a: Pt, b: Pt| -> Pt {
            let (ax, ay) = ((a.0 - p.0) * kx, (a.1 - p.1) * ky);
            let (dx, dy) = ((b.0 - a.0) * kx, (b.1 - a.1) * ky);
            let l = dx * dx + dy * dy;
            let t = if l > 0.0 {
                (-(ax * dx + ay * dy) / l).clamp(0.0, 1.0)
            } else {
                0.0
            };
            (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t)
        };
        self.0
            .iter()
            .filter(|(n, b, _)| {
                n != own
                    && (b[2] - b[0]) + (b[3] - b[1]) > SMALL_STATE_DEG
                    && p.0 >= b[0] - deg
                    && p.0 <= b[2] + deg
                    && p.1 >= b[1] - deg
                    && p.1 <= b[3] + deg
            })
            .flat_map(|(n, _, rings)| {
                rings
                    .iter()
                    .flat_map(|r| r.windows(2))
                    .map(move |w| (n.as_str(), nearest(w[0], w[1])))
            })
            .map(|(n, q)| (n, q, km(p, q)))
            .filter(|&(_, q, d)| d <= limit && self.over_land(p, q))
            .min_by(|a, b| a.2.total_cmp(&b.2))
            .map(|(n, _, _)| n)
    }
}

/// "Turkey, Syria and Iraq"
fn and_list(items: &[&str]) -> String {
    match items {
        [] => String::new(),
        [one] => one.to_string(),
        [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
    }
}

/// The countries each named river runs through on the map, north to south,
/// leaving out any with less than a tenth of its length there (the Tigris
/// only skirts Syria): "Turkey, Syria and Iraq" for the Euphrates.
fn river_courses(
    rivers: &HashMap<String, Vec<Vec<Pt>>>,
    countries: &Countries,
) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for (river, parts) in rivers {
        // (country, km of the river in it, km × latitude)
        let mut by: Vec<(&str, f64, f64)> = Vec::new();
        for w in parts.iter().flat_map(|p| p.windows(2)) {
            let mid = ((w[0].0 + w[1].0) / 2.0, (w[0].1 + w[1].1) / 2.0);
            let Some(c) = countries.at(mid) else { continue };
            let len = km(w[0], w[1]);
            match by.iter_mut().find(|x| x.0 == c) {
                Some(x) => {
                    x.1 += len;
                    x.2 += len * mid.1;
                }
                None => by.push((c, len, len * mid.1)),
            }
        }
        let total: f64 = by.iter().map(|x| x.1).sum();
        by.retain(|x| x.1 >= total / 10.0);
        by.sort_by(|a, b| (b.2 / b.1).total_cmp(&(a.2 / a.1)));
        let names: Vec<&str> = by.iter().map(|x| x.0).collect();
        if !names.is_empty() {
            out.insert(river.clone(), and_list(&names));
        }
    }
    out
}

// ------------------------------------------------------------------ where, in plain words

/// Kinds drawn as an area (a name across the map) rather than a dot.
const AREAS: [&str; 9] = [
    "region",
    "river",
    "body of water",
    "mountain range",
    "natural area",
    "people group",
    "wadi",
    "mountain ridge",
    "forest",
];

/// Kinds built by people, which can stand "in Jerusalem".
const BUILT: [&str; 8] = [
    "gate",
    "structure",
    "pool",
    "room",
    "altar",
    "hall",
    "district in settlement",
    "fortification",
];

/// Places whose kind in the dataset does not fit the BSB's name for them, or
/// fits only one proposed site: Ezion-geber was a port town (1 Kings 9:26),
/// whatever its site, En-gedi a town (Joshua 15:62) as well as an oasis, and
/// Perez-uzzah "that place" where Uzzah died (2 Samuel 6:8) and the Tower of
/// Eder a landmark Jacob camped beyond (Genesis 35:21), not towns.
const KIND_BY_NAME: [(&str, &str); 7] = [
    ("Kidron Valley", "valley"),
    ("Valley of Acacias", "valley"),
    ("Most Holy Place", "room"),
    ("Ezion-geber", "settlement"),
    ("En-gedi", "settlement"),
    ("Perez-uzzah", "place"),
    ("Tower of Eder", "place"),
];

/// Places whose kind is set by their OpenBible.info id: the Etam of Judges
/// 15:8 is "the rock of Etam", as the dataset's own note says.
const KIND_BY_ID: [(&str, &str); 1] = [("ae05348", "rock")];

/// Great cities of their day that the Bible names too seldom to be called
/// "a city" by count alone.
const GREAT_CITIES: [&str; 14] = [
    "Rome",
    "Nineveh",
    "Susa",
    "Memphis",
    "Thebes",
    "Alexandria",
    "Antioch",
    "Athens",
    "Corinth",
    "Ephesus",
    "Sidon",
    "Ur",
    "Caesarea",
    "Thessalonica",
];

/// Within this many km of another country's land border, a far region is not
/// said to be "in what is now" one country (Macedonia was in Greece as well).
const BORDER_KM: f64 = 50.0;

/// A far site this close to another country's land border is said to be near
/// that border, not "in what is now" either country: the mound of Carchemish
/// lies on the border of Turkey and Syria, and the simplified borders are
/// only good to a few km.
const NEAR_BORDER_KM: f64 = 5.0;

/// A state whose width and height add up to less than this many degrees is
/// too small to place anything by (Vatican City, within Rome).
const SMALL_STATE_DEG: f64 = 0.2;

/// Regions that took in Jerusalem although the dataset's one point for them
/// lies far from it: Canaan's is in Galilee, but Jerusalem was a Canaanite
/// city (Ezekiel 16:3), so Canaan is not "north of Jerusalem".
const AROUND_JERUSALEM: [&str; 1] = ["Canaan"];

/// "a town", "a river": the kind of place, for a reader.
fn kind_words(kind: &str, name: &str, mentions: usize) -> &'static str {
    match kind {
        "settlement" if mentions >= 50 || GREAT_CITIES.contains(&name) => "a city",
        "settlement" => "a town",
        "structure" if name.contains("Tower") => "a tower",
        "structure" if name.contains("Wall") => "a wall",
        "structure" if name.contains("House") || name.contains("Palace") => "a building",
        "structure" | "fortification" => "a structure",
        "region" => "a region",
        "river" => "a river",
        "mountain range" => "a range of mountains",
        "body of water" => "a body of water",
        "mountain" => "a mountain",
        "hill" => "a hill",
        "campsite" => "a camping place",
        "valley" => "a valley",
        "gate" => "a gate",
        "natural area" => "an area",
        "island" => "an island",
        "spring" => "a spring",
        "road" => "a road",
        "altar" => "an altar",
        "pool" => "a pool",
        "well" => "a well",
        "wadi" => "a stream bed",
        "tree" => "a tree",
        "garden" => "a garden",
        "district in settlement" => "a part of a city",
        "field" => "a field",
        "room" => "a room",
        "stone heap" => "a heap of stones",
        "cliff" => "a cliff",
        "rock" => "a rock",
        "mountain pass" => "a pass",
        "canal" => "a canal",
        "promontory" => "a headland",
        "forest" => "a forest",
        "hall" => "a hall",
        "mountain ridge" => "a ridge",
        "people group" => "the land of a people",
        _ => "a place",
    }
}

/// Which way `b` lies from `a`: "south", "northeast".
fn direction(a: Pt, b: Pt) -> &'static str {
    const DIRS: [&str; 8] = [
        "north",
        "northeast",
        "east",
        "southeast",
        "south",
        "southwest",
        "west",
        "northwest",
    ];
    DIRS[(bearing(a, b) / 45.0).round() as usize % 8]
}

/// The compass bearing from a to b, in degrees clockwise from north.
fn bearing(a: Pt, b: Pt) -> f64 {
    let (la, lb, dl) = (a.1.to_radians(), b.1.to_radians(), (b.0 - a.0).to_radians());
    let y = dl.sin() * lb.cos();
    let x = la.cos() * lb.sin() - la.sin() * lb.cos() * dl.cos();
    (y.atan2(x).to_degrees() + 360.0) % 360.0
}

/// "about 9 km", "about 1,250 km": rounded the way people say distances.
fn about_km(d: f64) -> String {
    let step = match d {
        d if d < 12.0 => 1.0,
        d if d < 60.0 => 5.0,
        d if d < 250.0 => 10.0,
        d if d < 1000.0 => 50.0,
        _ => 100.0,
    };
    let n = ((d / step).round() * step).max(1.0) as u64;
    let s = if n >= 1000 {
        format!("{},{:03}", n / 1000, n % 1000)
    } else {
        n.to_string()
    };
    format!("about {s} km")
}

/// What the where-line needs to know about the map.
struct Geo<'a> {
    jerusalem: Pt,
    dead_sea: Pt,
    countries: &'a Countries,
    /// The countries each named river runs through (river_courses).
    courses: &'a HashMap<String, String>,
}

/// Where a point lies, after the kind of place: "about 8 km south of
/// Jerusalem", "in what is now Turkey", "that included Jerusalem".
fn place_phrase(g: &Geo, at: Pt, kind: &str, name: &str) -> String {
    let area = AREAS.contains(&kind);
    if area && AROUND_JERUSALEM.contains(&name) {
        return "that included Jerusalem".to_string();
    }
    let d = km(g.jerusalem, at);
    let dir = direction(g.jerusalem, at);
    let way = || {
        if area {
            format!("{dir} of Jerusalem")
        } else {
            format!("{} {dir} of Jerusalem", about_km(d))
        }
    };
    if d > FAR_KM {
        if kind == "body of water" {
            return way();
        }
        let Some(c) = g.countries.at(at) else {
            return way();
        };
        if letters(c) == letters(name) {
            // Not "Egypt: a region in what is now Egypt".
            return way();
        }
        if kind == "river" {
            let c = g.courses.get(name).map_or(c, String::as_str);
            return format!("running through what is now {c}");
        }
        if area && g.countries.border_with(at, c, BORDER_KM).is_some() {
            return way();
        }
        if !area {
            if let Some(o) = g.countries.border_with(at, c, NEAR_BORDER_KM) {
                let (a, b) = if c < o { (c, o) } else { (o, c) };
                return format!("near what is now the border of {a} and {b}");
            }
        }
        return format!("in what is now {c}");
    }
    if d < 1.0 && kind == "hill" {
        // Mount Zion and the Ophel stood within the city's walls; the Mount
        // of Olives, across the Kidron, is over a kilometre away.
        return "in Jerusalem".to_string();
    }
    if d < 0.5 {
        if name == "Jerusalem" && kind == "settlement" {
            return format!(
                "{} {} of the Dead Sea",
                about_km(km(g.dead_sea, at)),
                direction(g.dead_sea, at)
            );
        }
        return if area {
            "that included Jerusalem".to_string()
        } else if BUILT.contains(&kind) || kind == "settlement" {
            "in Jerusalem".to_string()
        } else {
            "at Jerusalem".to_string()
        };
    }
    if d < 2.0 {
        return if BUILT.contains(&kind) {
            "in Jerusalem".to_string()
        } else {
            format!("just {dir} of Jerusalem")
        };
    }
    way()
}

/// The panel's one line about a place, after its name: "a town about 8 km
/// south of Jerusalem", "another name for Jerusalem", "a hill within 8 km of
/// Jerusalem". It never says more than the dataset does: an uncertain place
/// gets no distance from a single proposed site, and a place the dataset
/// relates to another one is put in its words.
struct WhereIn<'a> {
    p: &'a Place,
    name: &'a str,
    kind: &'a str,
    mentions: usize,
    /// The dataset's identification as plain words, if it relates this place
    /// to a biblical one ("within 8 km of Jerusalem").
    relation: Option<String>,
    /// Whether that relation's place is Jerusalem.
    to_jerusalem: bool,
    /// Whether another place the BSB names has the same name.
    shared_name: bool,
}

fn where_line(g: &Geo, w: &WhereIn) -> String {
    let what = kind_words(w.kind, w.name, w.mentions);
    if let Some((k, _, true, _)) = &w.p.special {
        match k.as_str() {
            "multiple_locations" => return format!("{what} that stood in more than one place"),
            "nonspecific_place" => return format!("{what} that may not be a single real place"),
            "not_a_place" | "not_a_proper_name" => {
                return "perhaps not the name of a place here".to_string()
            }
            // "unknown_place": the label says the location is unknown.
            _ => return what.to_string(),
        }
    }
    if let Some((site, score)) = &w.p.off {
        // The map cannot draw the strongest site; name it if it is likely,
        // unless its name is only the place's own ("Ulai canal", but not
        // "Tel Azekah").
        return if *score >= CONFIDENT && !letters(site).starts_with(&letters(w.name)) {
            format!("{what} at the site called {site}")
        } else {
            what.to_string()
        };
    }
    let Some(best) = w.p.sites.first() else {
        // Placed only within another place that has no single site of its
        // own ("in the Holy Place" of the tabernacle).
        return match &w.relation {
            Some(rel) if rel.starts_with("in ") => format!("{what} {rel}"),
            _ => what.to_string(),
        };
    };
    if w.p.sure < CONFIDENT {
        // The dataset's best guess, hedged, when it is that this is another
        // name for a place the BSB names ("Gob: a town, perhaps another name
        // for Gezer"). Not when the BSB's name is not the dataset's: the BSB's
        // "Euphrates" in Genesis 36:37 translates "the River".
        let alias = w
            .relation
            .as_deref()
            .and_then(|r| r.strip_prefix("another name for "));
        if let Some(t) = alias {
            let bare = t.strip_prefix("the ").unwrap_or(t);
            if letters(bare) != letters(w.name) && letters(&w.p.base) == letters(w.name) {
                return format!("{what}, perhaps another name for {}", with_the(t));
            }
        }
        return uncertain_line(g, w, what);
    }
    // After a relation, where its place lies ("in the Valley of Hinnom, just
    // southwest of Jerusalem"); a point there is a town's, not a gate's.
    let then = |target: &str| -> String {
        let kind = if AREAS.contains(&w.kind) {
            w.kind
        } else {
            "settlement"
        };
        let at = place_phrase(g, best.at, kind, "");
        match at.strip_prefix("in what is now ") {
            Some(c) if letters(c) == letters(target) => String::new(),
            _ => format!(", {at}"),
        }
    };
    if let Some(rel) = &w.relation {
        let here = if w.shared_name { "here " } else { "" };
        if let Some(target) = rel.strip_prefix("another name for ") {
            let bare = target.strip_prefix("the ").unwrap_or(target);
            if letters(bare) != letters(w.name) {
                let target = with_the(target);
                return if w.to_jerusalem {
                    format!("{here}another name for {target}")
                } else {
                    format!("{here}another name for {target}{}", then(bare))
                };
            }
        } else if w.kind == "district in settlement" && rel.starts_with("in ") {
            return format!("a part of {}", &rel[3..]);
        } else if rel.starts_with("within ") || w.to_jerusalem {
            return format!("{what} {rel}");
        } else {
            return format!("{what} {rel}{}", then(""));
        }
    }
    let at = place_phrase(g, best.at, w.kind, w.name);
    if at == "in Jerusalem" && w.kind == "settlement" {
        return "a part of Jerusalem".to_string();
    }
    format!("{what} {at}")
}

/// The small label after the line ("location uncertain"), or "" when the
/// site is well established. `symbolic`: a strong reading of the place as a
/// symbol; `within_multi`: placed only within a place that stood in more
/// than one place (the tabernacle's Most Holy Place).
fn label(p: &Place, symbolic: bool, within_multi: bool) -> &'static str {
    if let Some((k, _, true, _)) = &p.special {
        return match k.as_str() {
            "multiple_locations" => "more than one place",
            "nonspecific_place" => "may be symbolic",
            "unknown_place" => "location unknown",
            _ => "may not be a place",
        };
    }
    if symbolic {
        return "may be symbolic";
    }
    if let Some((_, score)) = &p.off {
        return if *score >= CONFIDENT {
            "not on this map"
        } else {
            "location uncertain"
        };
    }
    match p.sites.first() {
        None if within_multi => "more than one place",
        None => "location unknown",
        Some(_) if p.sure < CONFIDENT => "location uncertain",
        Some(_) if p.sure < 800 => "likely site",
        Some(_) => "",
    }
}

/// "the Wilderness of Zin", "the City of David", but "Mount Hermon": a place
/// named by a common noun takes "the" in a sentence.
fn with_the(name: &str) -> String {
    const NOUNS: [&str; 14] = [
        "Wilderness ",
        "Desert ",
        "Valley ",
        "Sea ",
        "River ",
        "Brook ",
        "Plain ",
        "Hill ",
        "Field ",
        "Pool ",
        "Gate ",
        "Tower ",
        "House ",
        "City ",
    ];
    if NOUNS.iter().any(|n| name.starts_with(n)) {
        format!("the {name}")
    } else {
        name.to_string()
    }
}

/// For a place whose location is uncertain: where the proposed sites lie, if
/// they agree on the area ("whose proposed sites lie about 5 km northeast of
/// Jerusalem", "whose proposed sites lie in what is now Egypt and Israel"),
/// or only on a direction ("whose proposed sites lie west of Jerusalem").
fn uncertain_line(g: &Geo, w: &WhereIn, what: &str) -> String {
    let sites = &w.p.sites;
    if sites.len() < 2 {
        return what.to_string();
    }
    let far = sites.iter().all(|s| km(g.jerusalem, s.at) > FAR_KM);
    if far {
        let mut cs: Vec<&str> = Vec::new();
        for s in sites {
            match g.countries.at(s.at) {
                Some(c) if !cs.contains(&c) => cs.push(c),
                Some(_) => {}
                None => return what.to_string(),
            }
        }
        if cs.len() > 2 || (cs.len() == 1 && letters(cs[0]) == letters(w.name)) {
            return what.to_string();
        }
        return format!(
            "{what} whose proposed sites lie in what is now {}",
            cs.join(" and ")
        );
    }
    let n = sites.len() as f64;
    let mid = (
        sites.iter().map(|s| s.at.0).sum::<f64>() / n,
        sites.iter().map(|s| s.at.1).sum::<f64>() / n,
    );
    let spread = sites.iter().map(|s| km(mid, s.at)).fold(0.0, f64::max);
    let d = km(g.jerusalem, mid);
    if spread > 12.0 || d > FAR_KM {
        return what.to_string();
    }
    let from = |s: &Site| km(g.jerusalem, s.at);
    if sites.iter().all(|s| from(s) <= 5.0) {
        return format!("{what} whose proposed sites lie near Jerusalem");
    }
    // Not "about 11 km north" for one site 21 km north and another 9 km west.
    let toward = bearing(g.jerusalem, mid);
    let off = |s: &Site| {
        let a = (bearing(g.jerusalem, s.at) - toward).abs();
        a.min(360.0 - a)
    };
    if sites.iter().any(|s| from(s) > 2.0 && off(s) > 45.0) {
        return what.to_string();
    }
    let dir = direction(g.jerusalem, mid);
    if spread > d / 3.0 {
        // Sites at quite different distances (Emmaus: 7, 12 and 24 km west)
        // share only a direction.
        return format!("{what} whose proposed sites lie {dir} of Jerusalem");
    }
    format!(
        "{what} whose proposed sites lie {} {dir} of Jerusalem",
        about_km(d)
    )
}

/// The dataset's identification, as the where-line puts it after the kind of
/// place, if it is one the line can use: "another name for Jerusalem",
/// "within 8 km of Jerusalem", "in the Valley of Hinnom", "around Gordion"
/// (for "about 200 km around Gordion").
fn relation_words(how: &str) -> Option<String> {
    if let Some(rest) = how.strip_prefix("region around ") {
        return Some(format!("around {rest}"));
    }
    if let Some(rest) = how.strip_prefix("about ") {
        return rest
            .split_once(" around ")
            .map(|(_, x)| format!("around {x}"));
    }
    [
        "another name for ",
        "within ",
        "in ",
        "on ",
        "along ",
        "between ",
    ]
    .iter()
    .any(|p| how.starts_with(p))
    .then(|| how.to_string())
}

/// The dataset's note on a place, as plain words for Deep ("In Benjamin"),
/// leaving out notes about its own sources: quotations from dictionaries,
/// Wikipedia and Wikidata, and the compiler's own working notes ("I tagged…").
fn note_words(html: &str, own: &str, name_of: &dyn Fn(&str) -> Option<String>) -> String {
    let own_work = html.split(|c: char| !c.is_alphanumeric()).any(|w| w == "I");
    // "Approximately equivalent to Cush", said of Cush.
    let itself = ancient_ids(html)
        .iter()
        .any(|id| name_of(id).is_some_and(|n| letters(&n) == letters(own)));
    if html.trim().is_empty()
        || own_work
        || itself
        || [
            "<source",
            "Wikipedia",
            "Wikidata",
            "wikipedia",
            "wikidata",
            "http",
            "www.",
            ".net",
            ".com",
            ".org",
            "this point",
            "these remains",
            "this wadi",
            "photo",
            "image",
        ]
        .iter()
        .any(|x| html.contains(x))
    {
        return String::new();
    }
    let s = plain(html, name_of);
    let mut c = s.chars();
    match c.next() {
        Some(f) => f.to_uppercase().chain(c).collect(),
        None => String::new(),
    }
}

// ------------------------------------------------------------------ people

/// Theographic people left out of "people tied to this place".
const NOT_PEOPLE: [&str; 3] = ["God", "Holy Spirit", "Satan"];

/// Edit distance between two words.
fn edits(a: &[char], b: &[char]) -> usize {
    let mut row: Vec<usize> = (0..=b.len()).collect();
    for (i, ca) in a.iter().enumerate() {
        let mut diag = row[0];
        row[0] = i + 1;
        for (j, cb) in b.iter().enumerate() {
            let up = row[j + 1];
            row[j + 1] = (diag + usize::from(ca != cb)).min(row[j] + 1).min(up + 1);
            diag = up;
        }
    }
    row[b.len()]
}

/// Lower-case letters only: "Baal-hanan" -> "baalhanan".
fn letters(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphabetic())
        .flat_map(char::to_lowercase)
        .collect()
}

/// The capitalized names in a verse ("Peter", "Baal-hanan").
fn capitalized(words: &[char]) -> Vec<String> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < words.len() {
        if !words[i].is_uppercase() || (i > 0 && words[i - 1].is_alphabetic()) {
            i += 1;
            continue;
        }
        let mut j = i + 1;
        while j < words.len()
            && (words[j].is_alphabetic()
                || (words[j] == '-' && words.get(j + 1).is_some_and(|c| c.is_alphabetic())))
        {
            j += 1;
        }
        out.push(words[i..j].iter().collect());
        i = j;
    }
    out
}

/// Words in a Theographic title that are not a name the text calls anyone by.
const NUMERALS: [&str; 4] = ["I", "II", "III", "IV"];

/// Ties that Theographic records but the text itself rules out, left out:
/// (Theographic place, person or "" for everyone, ties: 1 born, 2 died, why).
const NOT_TIES: [(&str, &str, u8, &str); 7] = [
    (
        "eden_354",
        "",
        3,
        "Adam and Eve were made, not born, and the first births and death came after they left the garden (Genesis 3:23–4:8)",
    ),
    (
        "jerusalem_636",
        "naamah_2119",
        1,
        "1 Kings 14:21, the verse naming her and Jerusalem, says she was an Ammonite",
    ),
    (
        "jerusalem_636",
        "maachah_1841",
        1,
        "2 Chronicles 13:2: she was from Gibeah",
    ),
    (
        "jerusalem_636",
        "ahaziah_121",
        2,
        "2 Kings 9:27: he fled to Megiddo and died there",
    ),
    (
        "jerusalem_636",
        "amaziah_214",
        2,
        "2 Kings 14:19: he was killed at Lachish",
    ),
    (
        "egypt_362",
        "joseph_1710",
        1,
        "Genesis 30:22–25: he was born before Jacob left Paddan-aram",
    ),
    (
        "damascus_322",
        "barnabas_1722",
        4,
        "Acts 9:27, the verse naming him and Damascus, has him in Jerusalem telling what Saul did there",
    ),
];

/// Verses that tell of a death in words the rule in telling() cannot read
/// (Theographic person, verse, whose death it is): never shown for that
/// person's death.
const NOT_VERSES: [(&str, &str, &str); 1] = [("herod_1506", "Acts.12.19", "the guards'")];

/// Verses either side of one Theographic lists a person in that count as
/// the same passage.
const PASSAGE: u32 = 3;

/// A Theographic person as a BSB reader meets them.
struct Person {
    /// Theographic's title in the BSB's spelling: "Simon Peter", "Oholiab"
    /// (not the KJV's "Aholiab"), "Timothy" (not "Timotheus"), "Mary (Mother
    /// of Jesus)".
    name: String,
    /// The verses of the passages Theographic lists them in: each verse it
    /// lists, and up to PASSAGE verses either side in the same chapter. Its
    /// lists leave verses out (Paul in Acts 16:1, Barnabas in Acts 13:4).
    listed: HashSet<u32>,
    /// The names the BSB calls them by, each with whether it is from their
    /// title ("Paul") rather than another name they go by ("Saul").
    forms: Vec<(Vec<char>, bool)>,
    /// Their title's names, lower case, as the text spells them ("simon", "peter").
    words: Vec<String>,
}

impl Person {
    /// Where verse `v` names them, if it does: Theographic lists them in its
    /// passage and the BSB calls them there by one of their names (so the
    /// "Mark" of "Mark out one road", Ezekiel 21:20, is not John Mark). Gives
    /// whether that is their title's name, and where in the verse it is (the
    /// title first, then the earliest). A name inside a place's name ("David"
    /// in "the City of David") does not count: `places` are the spans of the
    /// places the verse names.
    fn named_at(
        &self,
        v: u32,
        text: &[Vec<char>],
        places: &[(usize, usize)],
    ) -> Option<(bool, usize)> {
        if !self.listed.contains(&v) {
            return None;
        }
        let t = text.get(v as usize)?;
        let free = |pos: usize| !places.iter().any(|&(s, len)| pos >= s && pos < s + len);
        self.forms
            .iter()
            .filter_map(|(f, own)| find_name_where(t, f, free).map(|pos| (*own, pos)))
            .max_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)))
    }
}

/// Words Theographic lists among the names a person is "also called" that
/// are titles, not names (most of them for Jesus).
const TITLES: [&str; 18] = [
    "Lord", "God", "Son", "Lamb", "Saviour", "Savior", "Holy", "Word", "Light", "Prince", "Master",
    "Branch", "Judge", "King", "Christ", "Messiah", "Immanuel", "Emmanuel",
];

/// Whether a verse speaks of going somewhere only as a plan, a hope or a
/// vision ("Paul resolved... After I have been there, I must see Rome").
fn planned(t: &[char]) -> bool {
    const PLAN: [&str; 9] = [
        "resolved",
        "decided",
        "past",
        "vision",
        "telling",
        "must",
        "planned",
        "intending",
        "hoping",
    ];
    words_of(t)
        .iter()
        .any(|w| PLAN.contains(&w.text.to_lowercase().as_str()))
}

/// A word in a verse: where it starts, its letters, the sentence it is in,
/// and the word before it.
struct Word {
    start: usize,
    text: String,
    sentence: usize,
    after: String,
}

/// The words of a verse, each with the sentence it is in (a sentence ends at
/// ".", "?" or "!"). Hyphens stay inside a name ("Baal-hanan"); a possessive
/// ending is dropped ("Zedekiah’s" -> "Zedekiah").
fn words_of(t: &[char]) -> Vec<Word> {
    let mut out: Vec<Word> = Vec::new();
    let (mut i, mut sentence) = (0, 0);
    while i < t.len() {
        if !t[i].is_alphabetic() {
            if matches!(t[i], '.' | '?' | '!') {
                sentence += 1;
            }
            i += 1;
            continue;
        }
        let start = i;
        while i < t.len()
            && (t[i].is_alphabetic()
                || (matches!(t[i], '-' | '\'' | '\u{2019}')
                    && t.get(i + 1).is_some_and(|c| c.is_alphabetic())))
        {
            i += 1;
        }
        let mut text: String = t[start..i].iter().collect();
        for end in ["\u{2019}s", "'s"] {
            if let Some(x) = text.strip_suffix(end) {
                text = x.to_string();
            }
        }
        let after = out
            .last()
            .filter(|w| w.sentence == sentence)
            .map_or(String::new(), |w| w.text.to_lowercase());
        out.push(Word {
            start,
            text,
            sentence,
            after,
        });
    }
    out
}

/// Capitalized words that open a sentence without being a name.
const NOT_NAMES: [&str; 20] = [
    "Then", "And", "So", "But", "Now", "When", "After", "There", "The", "This", "These", "In",
    "On", "At", "From", "To", "For", "If", "Because", "As",
];

/// Pronouns, which the BSB capitalizes for God and for Jesus ("He must be
/// killed"): never a name, and never between a name and its verb.
const PRONOUNS: [&str; 22] = [
    "I", "He", "His", "Him", "Himself", "Me", "My", "Mine", "You", "Your", "Yours", "She", "Her",
    "They", "Them", "Their", "We", "Us", "Our", "It", "Its", "Who",
];

/// Whether a verse tells of this person's birth (ties 1) or death (ties 2),
/// not someone else's in the same verse. In one sentence the word for it
/// must come after the person's name with no other name between ("Terah
/// lived 205 years, and he died in Haran"; "And Josiah was buried"; but not
/// "Joseph had buried his father"), or a word for killing or burying must
/// come just before the name ("killed their brother Asahel"), or, for a
/// birth, the name must follow ("born to him in Jerusalem: Shammua, Shobab,
/// Nathan, Solomon"). A name after "of", "to" or "by" is someone's parent
/// ("born to Joseph in Egypt"), and a name inside a place's name (`places`)
/// is the place's.
fn telling(t: &[char], ties: u8, forms: &[(Vec<char>, bool)], places: &[(usize, usize)]) -> bool {
    const BIRTH: [&str; 5] = ["born", "bore", "birth", "firstborn", "conceived"];
    const DEATH: [&str; 16] = [
        "died",
        "die",
        "dies",
        "dying",
        "death",
        "dead",
        "buried",
        "killed",
        "kill",
        "slain",
        "slew",
        "executed",
        "crucified",
        "perish",
        "fallen",
        "breathed",
    ];
    const ACTS: [&str; 7] = [
        "killed",
        "kill",
        "slew",
        "executed",
        "crucified",
        "buried",
        "struck",
    ];
    let ws = words_of(t);
    let in_place = |w: &Word| {
        places
            .iter()
            .any(|&(s, len)| w.start >= s && w.start < s + len)
    };
    let first = |k: usize| k == 0 || ws[k - 1].sentence != ws[k].sentence;
    let is_name = |k: usize| {
        let w = &ws[k];
        w.text.starts_with(char::is_uppercase)
            && !in_place(w)
            && !PRONOUNS.contains(&w.text.as_str())
            && !(first(k) && NOT_NAMES.contains(&w.text.as_str()))
    };
    let mine = |k: usize| {
        let l = letters(&ws[k].text);
        is_name(k)
            && !["of", "to", "by"].contains(&ws[k].after.as_str())
            && forms.iter().any(|(f, _)| {
                letters(&f.iter().collect::<String>())
                    .split(' ')
                    .any(|x| x == l)
                    || letters(&f.iter().collect::<String>()) == l
            })
    };
    for (k, w) in ws.iter().enumerate() {
        let lw = w.text.to_lowercase();
        let birth = ties & 1 != 0 && BIRTH.contains(&lw.as_str());
        let death = ties & 2 != 0
            && DEATH.contains(&lw.as_str())
            && (lw != "breathed" || ws.get(k + 2).is_some_and(|x| x.text == "last"));
        if !birth && !death {
            continue;
        }
        let same = |j: &usize| ws[*j].sentence == w.sentence;
        // The nearest name before it in the sentence, unless it is a deed
        // done to someone else ("Joseph had buried his father").
        let passive = (k.saturating_sub(2)..k)
            .any(|j| ["was", "were", "be", "been", "is", "are"].contains(&ws[j].text.as_str()));
        if (!ACTS.contains(&lw.as_str()) || passive)
            && (0..k)
                .rev()
                .take_while(same)
                .find(|&j| is_name(j))
                .is_some_and(mine)
        {
            return true;
        }
        // "killed their brother Asahel"
        if death
            && ACTS.contains(&lw.as_str())
            && (k + 1..ws.len()).take_while(same).take(3).any(mine)
        {
            return true;
        }
        if birth && (k + 1..ws.len()).take_while(same).any(mine) {
            return true;
        }
    }
    false
}

/// Whether another name stands between a person's name at `a` and a place's
/// at `b` in a verse, so that the verse may tell of someone else there ("Paul
/// and his companions came to Perga in Pamphylia, where John left them to
/// return to Jerusalem"). Places' names (`places`), pronouns, the person's
/// own names (`forms`) and a companion's after "and" ("Paul and Barnabas
/// remained at Antioch") do not count.
fn name_between(
    t: &[char],
    a: usize,
    b: usize,
    forms: &[(Vec<char>, bool)],
    places: &[(usize, usize)],
) -> bool {
    let (lo, hi) = (a.min(b), a.max(b));
    // "Simon Peter" counts as "simon", "peter" and "simonpeter".
    let own: HashSet<String> = forms
        .iter()
        .flat_map(|(f, _)| {
            let f: String = f.iter().collect();
            let mut v: Vec<String> = f.split(' ').map(letters).collect();
            v.push(letters(&f));
            v
        })
        .collect();
    let ws = words_of(t);
    let mut theirs = vec![false; ws.len()];
    for k in 0..ws.len() {
        theirs[k] = own.contains(&letters(&ws[k].text))
            || (k >= 2 && ws[k].after == "and" && theirs[k - 2]);
    }
    ws.iter().enumerate().any(|(k, w)| {
        let first = k == 0 || ws[k - 1].sentence != w.sentence;
        w.start > lo
            && w.start < hi
            && w.text.starts_with(char::is_uppercase)
            && !PRONOUNS.contains(&w.text.as_str())
            && !(first && NOT_NAMES.contains(&w.text.as_str()))
            && !places
                .iter()
                .any(|&(s, len)| w.start >= s && w.start < s + len)
            && !theirs[k]
    })
}

fn person(pe: &Table, r: &[String], vz: &Versification, text: &[Vec<char>]) -> Person {
    let title = pe.get(r, "displayTitle");
    let title = if title.is_empty() {
        pe.get(r, "name")
    } else {
        title
    };
    let (outside, inside) = match title.split_once(" (") {
        Some((o, i)) => (o.trim(), format!(" ({i}")),
        None => (title.trim(), String::new()),
    };
    let listed: HashSet<u32> = list(pe.get(r, "verses"))
        .filter_map(|o| osis_verse(o, vz))
        .flat_map(|v| {
            (v.saturating_sub(PASSAGE)..=v + PASSAGE).filter(move |&w| same_chapter(vz, v, w))
        })
        .collect();
    let verses: Vec<u32> = list(pe.get(r, "verses"))
        .filter_map(|o| osis_verse(o, vz))
        .take(400)
        .collect();
    let in_verses = |w: &str| -> usize {
        let f: Vec<char> = w.chars().collect();
        verses
            .iter()
            .filter(|&&v| {
                text.get(v as usize)
                    .is_some_and(|t| find_name(t, &f).is_some())
            })
            .count()
    };
    // The other personal names Theographic says they go by ("Saul" for Paul,
    // "Timothy" for Timotheus), not titles ("Lord", "Prince") or God's names.
    let others: Vec<&str> = list(pe.get(r, "alsoCalled"))
        .filter(|a| {
            a.starts_with(char::is_uppercase)
                && a.chars().any(char::is_lowercase)
                && !a.contains(' ')
                && !TITLES.contains(a)
                && !NOT_PEOPLE.contains(a)
        })
        .collect();
    // Each capitalized word of the title, in the BSB's spelling where the
    // BSB spells it differently: another of their names that the BSB uses
    // in their verses ("Timotheus" -> "Timothy"), or else the closest name in
    // their verses within two letters ("Aholiab" -> "Oholiab", "Achsah" -> "Acsah").
    let mut counts: HashMap<String, usize> = HashMap::new();
    for &v in &verses {
        let mut seen = HashSet::new();
        for w in capitalized(text.get(v as usize).map(Vec::as_slice).unwrap_or(&[])) {
            if seen.insert(w.clone()) {
                *counts.entry(w).or_default() += 1;
            }
        }
    }
    let mut parts: Vec<String> = Vec::new();
    let mut prev = "";
    for w in outside.split(' ').filter(|w| !w.is_empty()) {
        // "the Evangelist", "the Apostle": a title's epithet, not a name to respell.
        let epithet = prev == "the";
        prev = w;
        if !w.starts_with(char::is_uppercase) || NUMERALS.contains(&w) || epithet {
            parts.push(w.to_string());
            continue;
        }
        let mut word = w.to_string();
        if in_verses(w) == 0 {
            let other = others
                .iter()
                .map(|a| (in_verses(a), *a))
                .filter(|(n, _)| *n > 0)
                .max_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(a.1)));
            let wl: Vec<char> = letters(w).chars().collect();
            let limit = (wl.len() / 3).min(2);
            let close = counts
                .iter()
                .map(|(c, n)| (edits(&letters(c).chars().collect::<Vec<_>>(), &wl), *n, c))
                .filter(|(d, _, _)| *d <= limit)
                .min_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)).then(a.2.cmp(b.2)));
            if let Some((_, a)) = other {
                word = a.to_string();
            } else if let Some((_, _, c)) = close {
                word = c.clone();
            }
        }
        parts.push(word);
    }
    let named: Vec<&String> = parts
        .iter()
        .filter(|w| w.starts_with(char::is_uppercase) && !NUMERALS.contains(&w.as_str()))
        .collect();
    let words: Vec<String> = named.iter().map(|w| letters(w)).collect();
    let mut forms: Vec<(Vec<char>, bool)> =
        named.iter().map(|w| (w.chars().collect(), true)).collect();
    for a in others {
        let f: Vec<char> = a.chars().collect();
        if !forms.iter().any(|(g, _)| *g == f) {
            forms.push((f, false));
        }
    }
    Person {
        name: format!("{}{inside}", parts.join(" ")),
        listed,
        forms,
        words,
    }
}

/// What people() found, for the build's report.
#[derive(Default)]
struct PeopleTally {
    joined: usize,
    /// Places joined to a Theographic place that another place shares more
    /// verses with.
    shared: usize,
    tied: usize,
    unconfirmed: usize,
    /// Born and died ties left out because the text rules them out (NOT_TIES).
    ruled_out: usize,
    /// People whose name is told apart by a parent ("Michael (son of Jehoshaphat)").
    told_apart: usize,
}

/// People Theographic ties to each place: born there (1), died there (2) or
/// was there (4), each with a verse that names both the place and the person
/// (-1 if none). A verse names a person when Theographic lists them in its
/// passage and the BSB calls them there by one of their names (see
/// Person::named_at).
/// Theographic's "was there" comes from whole events (everyone on Paul's first
/// journey "was" at Seleucia), so it is kept only where such a verse exists,
/// and only for names that are not also place names ("Canaan", "Asshur"). A
/// birth or death keeps its verse only if the verse speaks of a birth or a
/// death, so that "died here" never points to a verse about something else.
fn people(
    inputs: &Inputs,
    kept: &[(&Place, Vec<(u32, usize)>)],
    spans: &HashMap<u32, Vec<(usize, usize)>>,
    names: &[String],
    vz: &Versification,
    text: &[Vec<char>],
) -> Result<(Value, PeopleTally), String> {
    let tp = Table::open(
        &inputs.path(THEO, "places"),
        &[
            "placeLookup",
            "kjvName",
            "esvName",
            "displayTitle",
            "aliases",
            "verses",
            "peopleBorn",
            "peopleDied",
            "hasBeenHere",
        ],
    )?;
    let pe = Table::open(
        &inputs.path(THEO, "people"),
        &[
            "personLookup",
            "name",
            "displayTitle",
            "alsoCalled",
            "gender",
            "father",
            "mother",
            "birthPlace",
            "deathPlace",
            "verseCount",
            "verses",
        ],
    )?;
    let verses_of =
        |s: &str| -> HashSet<u32> { list(s).filter_map(|o| osis_verse(o, vz)).collect() };

    // Theographic places, found by any of their names.
    let mut by_name: HashMap<String, Vec<usize>> = HashMap::new();
    let tverses: Vec<HashSet<u32>> = tp
        .rows
        .iter()
        .map(|r| verses_of(tp.get(r, "verses")))
        .collect();
    for (i, r) in tp.rows.iter().enumerate() {
        let all = [
            tp.get(r, "kjvName"),
            tp.get(r, "esvName"),
            tp.get(r, "displayTitle"),
        ]
        .into_iter()
        .chain(list(tp.get(r, "aliases")));
        for n in all {
            let k = letters(n);
            if !k.is_empty() && !by_name.get(&k).is_some_and(|v| v.contains(&i)) {
                by_name.entry(k).or_default().push(i);
            }
        }
    }

    // Relations by Theographic place.
    let mut rel: HashMap<&str, BTreeMap<&str, u8>> = HashMap::new();
    let lookup_of: Vec<&str> = tp.rows.iter().map(|r| tp.get(r, "placeLookup")).collect();
    for r in &pe.rows {
        let who = pe.get(r, "personLookup");
        for (col, bit) in [("birthPlace", 1u8), ("deathPlace", 2u8)] {
            for at in list(pe.get(r, col)) {
                *rel.entry(at).or_default().entry(who).or_default() |= bit;
            }
        }
    }
    for r in &tp.rows {
        let at = tp.get(r, "placeLookup");
        for (col, bit) in [
            ("peopleBorn", 1u8),
            ("peopleDied", 2u8),
            ("hasBeenHere", 4u8),
        ] {
            for who in list(tp.get(r, col)) {
                *rel.entry(at).or_default().entry(who).or_default() |= bit;
            }
        }
    }
    let row_of: HashMap<&str, &Vec<String>> = pe
        .rows
        .iter()
        .map(|r| (pe.get(r, "personLookup"), r))
        .collect();
    let place_words: HashSet<String> = kept
        .iter()
        .flat_map(|(p, _)| {
            p.forms
                .iter()
                .map(|f| letters(&f.iter().collect::<String>()))
        })
        .collect();
    // How many Theographic people share each title, to tell them apart.
    let mut titles: HashMap<String, usize> = HashMap::new();
    for r in &pe.rows {
        let t = pe.get(r, "displayTitle");
        *titles
            .entry(letters(if t.is_empty() { pe.get(r, "name") } else { t }))
            .or_default() += 1;
    }

    let not_verses: HashSet<(&str, u32)> = NOT_VERSES
        .iter()
        .filter_map(|(who, osis, _)| Some((*who, osis_verse(osis, vz)?)))
        .collect();
    let mut cache: HashMap<&str, Person> = HashMap::new();
    let mut t = PeopleTally::default();
    let mut out_names: Vec<String> = Vec::new();
    let mut name_idx: HashMap<String, usize> = HashMap::new();
    // The Theographic place for each place: first among those with the
    // place's own name, then among those with any of its spellings; the one
    // that shares the most verses, if at least half the verses of the
    // shorter list.
    let joins: Vec<Option<(usize, usize)>> = kept
        .iter()
        .zip(names)
        .map(|((p, vs), name)| {
            let vset: HashSet<u32> = vs.iter().map(|&(v, _)| v).collect();
            let own: HashSet<String> = [letters(&p.base), letters(name)].into_iter().collect();
            let any: HashSet<String> = p
                .forms
                .iter()
                .map(|f| letters(&f.iter().collect::<String>()))
                .collect();
            let pick = |keys: &HashSet<String>| -> Option<(usize, usize)> {
                keys.iter()
                    .flat_map(|k| by_name.get(k).map(Vec::as_slice).unwrap_or(&[]))
                    .map(|&i| (tverses[i].intersection(&vset).count(), i))
                    .filter(|&(shared, i)| {
                        shared > 0 && shared * 2 >= tverses[i].len().min(vset.len()).max(1)
                    })
                    .max_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)))
                    .map(|(shared, i)| (i, shared))
            };
            pick(&own).or_else(|| pick(&any))
        })
        .collect();
    // A Theographic place lends its people to one place only: the one that
    // shares the most verses with it. Theographic counts the Bethlehem of
    // Judges 12 as Ruth's and Babylon in Revelation as Nebuchadnezzar's;
    // OpenBible.info sets them apart, and Jesus was not born in Zebulun.
    let mut owner: HashMap<usize, (usize, usize)> = HashMap::new();
    for (k, j) in joins.iter().enumerate() {
        if let Some((ti, shared)) = *j {
            let e = owner.entry(ti).or_insert((k, shared));
            if shared > e.1 {
                *e = (k, shared);
            }
        }
    }

    let mut per_place = Vec::with_capacity(kept.len());
    for (k, (_, vs)) in kept.iter().enumerate() {
        let Some((ti, _)) = joins[k] else {
            per_place.push(json!(0));
            continue;
        };
        if owner.get(&ti).map(|o| o.0) != Some(k) {
            t.shared += 1;
            per_place.push(json!(0));
            continue;
        }
        t.joined += 1;
        let mut rows: Vec<(i64, String, u8, i64)> = Vec::new();
        for (&who, &bits) in rel.get(lookup_of[ti]).into_iter().flatten() {
            let Some(&r) = row_of.get(who) else { continue };
            if NOT_PEOPLE.contains(&pe.get(r, "name")) {
                continue;
            }
            let mut bits = bits;
            for (at, person, ties, _why) in NOT_TIES {
                if at == lookup_of[ti] && (person.is_empty() || person == who) && bits & ties != 0 {
                    bits &= !ties;
                    t.ruled_out += 1;
                }
            }
            let pr = cache.entry(who).or_insert_with(|| person(&pe, r, vz, text));
            // The verse to show: one that tells of the birth or death when
            // that is the tie, then by the person's own name ("Paul", not
            // "Saul"), then one naming both in one sentence, then one with no
            // other name between them ("where John left them to return to
            // Jerusalem" is John's), then one that is not about a plan or a
            // vision ("Paul resolved... I must see Rome"), then the first
            // (often the arrival: "Paul left Athens and went to Corinth").
            let best = vs
                .iter()
                .filter_map(|&(v, at)| {
                    let (own, pos) =
                        pr.named_at(v, text, spans.get(&v).map_or(&[][..], Vec::as_slice))?;
                    let t = &text[v as usize];
                    let together = !t[pos.min(at)..pos.max(at).min(t.len())]
                        .iter()
                        .any(|c| matches!(c, '.' | '?' | '!'));
                    let places = spans.get(&v).map_or(&[][..], Vec::as_slice);
                    let tells = bits & 3 != 0
                        && telling(&text[v as usize], bits & 3, &pr.forms, places)
                        && !not_verses.contains(&(who, v));
                    let clear = !name_between(t, pos, at, &pr.forms, places);
                    Some((
                        (
                            tells,
                            own,
                            together,
                            clear,
                            !planned(t),
                            std::cmp::Reverse(v),
                        ),
                        v,
                    ))
                })
                .max_by(|a, b| a.0.cmp(&b.0))
                .map(|(key, v)| (key.0, v));
            if bits & 4 != 0 && (best.is_none() || pr.words.iter().any(|w| place_words.contains(w)))
            {
                bits &= !4;
                t.unconfirmed += 1;
            }
            if bits == 0 {
                continue;
            }
            let verse = match best {
                Some((tells, v)) if tells || bits & 4 != 0 => i64::from(v),
                _ => -1,
            };
            let mut name = pr.name.clone();
            let title = pe.get(r, "displayTitle");
            let title = if title.is_empty() {
                pe.get(r, "name")
            } else {
                title
            };
            if !name.contains('(') && titles.get(&letters(title)).copied().unwrap_or(0) > 1 {
                let female = pe.get(r, "gender") == "Female";
                let parent = [pe.get(r, "father"), pe.get(r, "mother")]
                    .into_iter()
                    .filter(|p| !p.is_empty() && !p.starts_with("god_"))
                    .find_map(|p| row_of.get(p).copied());
                if let Some(pr2) = parent {
                    let pname = person(&pe, pr2, vz, text).name;
                    let pname = pname.split(" (").next().unwrap_or(&pname).to_string();
                    name = format!(
                        "{name} ({} of {pname})",
                        if female { "daughter" } else { "son" }
                    );
                    t.told_apart += 1;
                }
            }
            let weight = pe.get(r, "verseCount").parse::<i64>().unwrap_or(0);
            rows.push((weight, name, bits, verse));
        }
        rows.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
        // Two people with the same name at one place read as one line.
        let mut merged: Vec<(i64, String, u8, i64)> = Vec::new();
        for row in rows {
            match merged.iter_mut().find(|m| m.1 == row.1) {
                Some(m) => {
                    m.2 |= row.2;
                    if m.3 < 0 {
                        m.3 = row.3;
                    }
                }
                None => merged.push(row),
            }
        }
        let mut rows = merged;
        rows.truncate(MAX_PEOPLE);
        if rows.is_empty() {
            per_place.push(json!(0));
            continue;
        }
        t.tied += 1;
        let list: Vec<Value> = rows
            .into_iter()
            .map(|(_, n, bits, verse)| {
                let i = *name_idx.entry(n.clone()).or_insert_with(|| {
                    out_names.push(n);
                    out_names.len() - 1
                });
                json!([i, bits, verse])
            })
            .collect();
        per_place.push(Value::Array(list));
    }
    let doc = json!({
        "format": 1,
        "license": "CC BY-SA 4.0",
        "source": "Theographic Bible Metadata by Robert Rouse (viz.bible), CC BY-SA 4.0",
        "names": out_names,
        "places": per_place,
    });
    Ok((doc, t))
}

// ------------------------------------------------------------------ build

/// The files to write under web/public/data, as (path, bytes).
pub fn build(
    inputs: &Inputs,
    vz: &Versification,
    bsb: &[String],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut t = Tally::default();
    let moderns = moderns(&read_jsonl(&inputs.path(GEO, "modern"))?, &mut t);
    let mut all = places(&read_jsonl(&inputs.path(GEO, "ancient"))?, &moderns, &mut t);
    // A common word ("Sea") is never used to find a place.
    for p in &mut all {
        let (forms, shares): (Vec<_>, Vec<_>) = p
            .forms
            .drain(..)
            .zip(p.shares.drain(..))
            .filter(|(f, _)| !GENERIC.contains(&loose(&f.iter().collect::<String>()).as_str()))
            .unzip();
        p.forms = forms;
        p.shares = shares;
    }
    // The places the sources find in each verse, by name.
    let mut tagged: HashMap<u32, HashSet<String>> = HashMap::new();
    for p in &all {
        for (osis, _, _) in &p.verses {
            if let Some(v) = osis_verse(osis, vz) {
                tagged.entry(v).or_default().insert(loose(&p.base));
            }
        }
    }
    let text: Vec<Vec<char>> = bsb.iter().map(|s| s.chars().collect()).collect();

    // Places the BSB names, and where, leaving out words the sources mostly
    // read as something other than a place's name.
    let mut kept: Vec<(&Place, Vec<Mention>)> = Vec::new();
    for p in &all {
        let ms = mentions(p, vz, &text, &tagged, &mut t);
        if ms.is_empty() {
            continue;
        }
        if let Some((kind, score, true, _)) = &p.special {
            if (kind == "not_a_place" || kind == "not_a_proper_name") && *score >= CONFIDENT {
                t.not_a_place += ms.len();
                continue;
            }
        }
        t.mentions += ms.len();
        kept.push((p, ms));
    }
    // The places named most often get the smallest numbers.
    kept.sort_by(|a, b| b.1.len().cmp(&a.1.len()).then_with(|| a.0.id.cmp(&b.0.id)));

    let names: Vec<String> = kept.iter().map(|(p, ms)| display_name(p, ms)).collect();

    // Each verse's places in reading order: [verse step, count, places...]. A
    // place the verse calls by another of its names ("Syria" for Aram) is
    // written -(k + 1), where alts[k] is [the place, that name]. Where two
    // places are found in the same words ("Kadesh" in "Kadesh-barnea"), only
    // the longer name counts.
    let mut alts: Vec<(usize, String)> = Vec::new();
    let mut alt_of: HashMap<(usize, String), usize> = HashMap::new();
    let mut by_verse: BTreeMap<u32, Vec<(usize, usize, usize, i64)>> = BTreeMap::new();
    for (i, (_, ms)) in kept.iter().enumerate() {
        for m in ms {
            let tok = match &m.name {
                Some(n) if *n != names[i] => {
                    let k = *alt_of.entry((i, n.clone())).or_insert_with(|| {
                        alts.push((i, n.clone()));
                        alts.len() - 1
                    });
                    -(k as i64) - 1
                }
                _ => i as i64,
            };
            by_verse
                .entry(m.verse)
                .or_default()
                .push((m.pos, usize::MAX - m.len, i, tok));
        }
    }
    let mut at: Vec<i64> = Vec::new();
    let mut prev = 0u32;
    let mut overlapped = 0usize;
    for (&v, ps) in by_verse.iter_mut() {
        ps.sort_unstable();
        let mut end = 0usize;
        let mut seen = HashSet::new();
        ps.retain(|&(pos, rlen, p, _)| {
            let inside = pos < end;
            end = end.max(pos + (usize::MAX - rlen));
            overlapped += usize::from(inside);
            !inside && seen.insert(p)
        });
        at.extend([i64::from(v - prev), ps.len() as i64]);
        at.extend(ps.iter().map(|&(_, _, _, tok)| tok));
        prev = v;
    }
    let alts_json: Vec<Value> = alts.iter().map(|(p, n)| json!([p, n])).collect();
    let index = json!({ "format": 1, "names": names, "alts": alts_json, "at": at });

    // The map, the panel's place data, and who is tied to each place.
    let base = base_map(inputs)?;
    let countries = Countries::open(&inputs.path(NE, "countries"))?;
    let jerusalem = kept
        .iter()
        .filter(|(p, _)| p.base == "Jerusalem")
        .max_by_key(|(_, ms)| ms.len())
        .and_then(|(p, _)| p.sites.first())
        .map(|s| s.at)
        .ok_or("real-map: no site for Jerusalem in the geocoding data")?;
    let dead_sea = base
        .dead_sea
        .iter()
        .flatten()
        .copied()
        .min_by(|a, b| km(*a, jerusalem).total_cmp(&km(*b, jerusalem)))
        .ok_or("real-map: Natural Earth has no Dead Sea")?;
    let courses = river_courses(&base.rivers, &countries);
    let geo = Geo {
        jerusalem,
        dead_sea,
        countries: &countries,
        courses: &courses,
    };
    // Places that stood in more than one place (the tabernacle's Holy Place).
    let multi: HashSet<&str> = all
        .iter()
        .filter(|p| matches!(&p.special, Some((k, _, true, _)) if k == "multiple_locations"))
        .map(|p| p.id.as_str())
        .collect();
    // The name the BSB gives each place it names, for the dataset's words
    // about places ("in the Holy Place 2" -> "in the Holy Place").
    let name_by_id: HashMap<&str, &str> = kept
        .iter()
        .zip(&names)
        .map(|((p, _), n)| (p.id.as_str(), n.as_str()))
        .collect();
    let name_of = |id: &str| name_by_id.get(id).map(|n| n.to_string());
    let jerusalem_id = kept
        .iter()
        .filter(|(p, _)| p.base == "Jerusalem")
        .max_by_key(|(_, ms)| ms.len())
        .map(|(p, _)| p.id.clone())
        .unwrap_or_default();
    let mut name_count: HashMap<&str, usize> = HashMap::new();
    for n in &names {
        *name_count.entry(n.as_str()).or_default() += 1;
    }
    let mut kinds: Vec<String> = Vec::new();
    let mut place_rows = Vec::with_capacity(kept.len());
    let (mut confident, mut far, mut related, mut noted) = (0usize, 0usize, 0usize, 0usize);
    let mut off_map = 0usize;
    for ((p, ms), name) in kept.iter().zip(&names) {
        let kind_name = KIND_BY_NAME
            .iter()
            .find(|(n, _)| n == name)
            .or_else(|| KIND_BY_ID.iter().find(|(id, _)| *id == p.id))
            .map_or(p.kind.as_str(), |(_, k)| *k);
        let kind = match kinds.iter().position(|k| k == kind_name) {
            Some(i) => i,
            None => {
                kinds.push(kind_name.to_string());
                kinds.len() - 1
            }
        };
        let best = p.sites.first();
        confident += (best.is_some() && p.off.is_none() && p.sure >= CONFIDENT) as usize;
        far += best.is_some_and(|s| km(s.at, jerusalem) > FAR_KM) as usize;
        // The identification in the dataset's words, when it places this
        // one by another ("within 8 km of Jerusalem") rather than naming a
        // site ("Tel Avdon").
        let how = p.how.clone().unwrap_or_default();
        let direct = how.html.trim().starts_with('<') && how.html.matches('<').count() == 2;
        let how_words = if direct || how.html.is_empty() {
            String::new()
        } else {
            plain(&how.html, &name_of)
        };
        let relation = (how.ancient_only && !how_words.is_empty())
            .then(|| relation_words(&how_words))
            .flatten();
        related += relation.is_some() as usize;
        let w = WhereIn {
            p,
            name,
            kind: kind_name,
            mentions: ms.len(),
            to_jerusalem: how.target.as_deref() == Some(jerusalem_id.as_str()),
            relation,
            shared_name: name_count.get(name.as_str()).copied().unwrap_or(0) > 1,
        };
        let line = where_line(&geo, &w);
        let sites: Vec<Value> = p
            .sites
            .iter()
            .map(|s| {
                json!([
                    (s.at.0 * 1e4).round() as i64,
                    (s.at.1 * 1e4).round() as i64,
                    s.score,
                    s.name
                ])
            })
            .collect();
        let special = match &p.special {
            Some((k, s, best, words)) if *s >= 100 || *best => {
                json!([k, s, u8::from(*best), plain(words, &name_of)])
            }
            _ => json!(0),
        };
        let symbolic = matches!(&p.special, Some((k, s, _, words))
            if *s >= 100 && (k == "nonspecific_place" || ["symbolic", "poetic", "cipher"].iter().any(|x| words.contains(x))));
        // Placed by another place's point ("in Jerusalem", "within 8 km of
        // Bethlehem"), so the map marks only roughly where it was.
        let rough = !direct
            && !how.html.is_empty()
            && !how.html.starts_with("another name for")
            && best.is_some();
        let note = note_words(&p.comment, name, &name_of);
        noted += !note.is_empty() as usize;
        let within_multi = how.target.as_deref().is_some_and(|t| multi.contains(t));
        let label = label(p, symbolic, within_multi);
        let off = match &p.off {
            Some((site, score)) => {
                off_map += 1;
                json!([site, score])
            }
            None => json!(0),
        };
        let flags = u8::from(rough) | (u8::from(symbolic) << 1);
        // "another name for Bethlehem", said of a Bethlehem, tells a reader
        // nothing (the dataset joins two entries of one name).
        let self_alias = how_words
            .strip_prefix("another name for ")
            .is_some_and(|t| letters(t.trim_start_matches("the ")) == letters(name));
        let shown_how = if self_alias { "" } else { how_words.as_str() };
        place_rows.push(json!([
            p.id, p.slug, kind, line, sites, special, shown_how, note, flags, label, off, p.sure
        ]));
    }
    let places_doc = json!({
        "format": 2,
        "jerusalem": [round(jerusalem.0, 4), round(jerusalem.1, 4)],
        "confident": CONFIDENT,
        "kinds": kinds,
        "places": place_rows,
    });

    let verse_lists: Vec<(&Place, Vec<(u32, usize)>)> = kept
        .iter()
        .map(|(p, ms)| (*p, ms.iter().map(|m| (m.verse, m.pos)).collect()))
        .collect();
    // Where each verse names its places, so that a person's name inside a
    // place's name ("the City of David") is not taken for the person.
    let mut spans: HashMap<u32, Vec<(usize, usize)>> = HashMap::new();
    for (_, ms) in &kept {
        for m in ms {
            spans.entry(m.verse).or_default().push((m.pos, m.len));
        }
    }
    let (people_doc, pt) = people(inputs, &verse_lists, &spans, &names, vz, &text)?;

    eprintln!(
        "real-map: {} places in the geocoding data, {} named in the BSB in {} verses ({} mentions); {} have a confident site, {} far from Jerusalem",
        t.places,
        kept.len(),
        by_verse.len(),
        t.mentions,
        confident,
        far
    );
    eprintln!(
        "real-map: dropped {} references not in the BSB numbering, {} where most translations name no place or only its people, {} where the BSB does not name it, {} read as not a place, {} inside a longer name; moved {} to the next or previous verse; {} other names used for a place",
        t.unmapped, t.not_named, t.not_in_bsb, t.not_a_place, overlapped, t.moved, alts.len()
    );
    eprintln!(
        "real-map: {} places placed in the dataset's words by another place, {} with a note; left out {} sites credited to OpenStreetMap or placed by a Palestine Grid reference ({} links to them), so {} places have their strongest site off the map",
        related, noted, t.withheld_sites, t.no_coordinates, off_map
    );
    eprintln!(
        "real-map: {} places joined to Theographic ({} more left without people because another place shares more verses with theirs), {} with people tied to them; {} \"was there\" ties left out as unconfirmed, {} births and deaths the text rules out, {} names told apart by a parent",
        pt.joined, pt.shared, pt.tied, pt.unconfirmed, pt.ruled_out, pt.told_apart
    );

    let bytes = |v: &Value| serde_json::to_vec(v).map_err(|e| e.to_string());
    Ok(vec![
        (OUT.to_string(), bytes(&index)?),
        (OUT_PLACES.to_string(), bytes(&places_doc)?),
        (OUT_BASE.to_string(), bytes(&base.json)?),
        (OUT_PEOPLE.to_string(), bytes(&people_doc)?),
    ])
}

// ------------------------------------------------------------------ verify

fn load(d: &Loaded, rel: &str) -> Result<Value, String> {
    read_json(&d.dir.join(rel))
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let index = load(d, OUT)?;
    let places = load(d, OUT_PLACES)?;
    let base = load(d, OUT_BASE)?;
    let people = load(d, OUT_PEOPLE)?;
    let size = fs::metadata(d.dir.join(OUT))
        .map(|m| m.len())
        .unwrap_or(u64::MAX);
    let n = d.vz.verse_count();
    let names: Vec<&str> = index["names"]
        .as_array()
        .ok_or("real-map.json has no names")?
        .iter()
        .map(|x| x.as_str().unwrap_or(""))
        .collect();
    let alts: Vec<(usize, &str)> = index["alts"]
        .as_array()
        .ok_or("real-map.json has no alts")?
        .iter()
        .map(|a| {
            let p = a[0].as_u64().and_then(|p| usize::try_from(p).ok());
            (p.unwrap_or(usize::MAX), a[1].as_str().unwrap_or(""))
        })
        .collect();
    let at: Vec<i64> = index["at"]
        .as_array()
        .ok_or("real-map.json has no at")?
        .iter()
        .map(|x| x.as_i64().unwrap_or(i64::MIN))
        .collect();

    // Decode [verse step, count, places...] into (place, the name the verse uses).
    let mut by_verse: BTreeMap<u32, Vec<(usize, &str)>> = BTreeMap::new();
    let (mut i, mut v, mut well_formed) = (0usize, 0i64, true);
    while i + 1 < at.len() {
        v += at[i];
        let k = usize::try_from(at[i + 1]).unwrap_or(0);
        if at[i] < 0 || k == 0 || i + 2 + k > at.len() || v >= i64::from(n) {
            well_formed = false;
            break;
        }
        let mut ps = Vec::with_capacity(k);
        for &tok in &at[i + 2..i + 2 + k] {
            let got = match usize::try_from(tok) {
                Ok(p) => names.get(p).map(|name| (p, *name)),
                Err(_) => usize::try_from(-(tok + 1))
                    .ok()
                    .and_then(|k| alts.get(k).copied()),
            };
            match got {
                Some((p, name)) if p < names.len() && !name.is_empty() => ps.push((p, name)),
                _ => well_formed = false,
            }
        }
        by_verse.insert(v as u32, ps);
        i += 2 + k;
    }
    well_formed &= i == at.len();
    // The names a verse uses, in reading order.
    let named = |r: &str| -> Result<Vec<String>, String> {
        let (v, _) = d.resolve(r)?;
        Ok(by_verse
            .get(&v)
            .map(|ps| ps.iter().map(|&(_, name)| name.to_string()).collect())
            .unwrap_or_default())
    };
    // The place a verse names, by the name it uses there or its usual name.
    let place_in = |r: &str, name: &str| -> Result<Option<usize>, String> {
        let (v, _) = d.resolve(r)?;
        Ok(by_verse.get(&v).and_then(|ps| {
            ps.iter()
                .find(|&&(p, used)| used == name || names[p] == name)
                .map(|&(p, _)| p)
        }))
    };
    let rows = places["places"]
        .as_array()
        .ok_or("places.json has no places")?;
    let best = |p: usize| -> Option<(Pt, i64)> {
        let s = rows.get(p)?.get(4)?.get(0)?;
        Some(((s[0].as_f64()? / 1e4, s[1].as_f64()? / 1e4), s[2].as_i64()?))
    };
    let jer = (
        places["jerusalem"][0].as_f64().unwrap_or(0.0),
        places["jerusalem"][1].as_f64().unwrap_or(0.0),
    );

    let mut out = vec![
        (
            well_formed,
            "real-map.json: every verse is in the BSB and every place has a name".to_string(),
        ),
        (
            names.len() > 900,
            format!("only {} places are named in the BSB", names.len()),
        ),
        (
            by_verse.len() > 4000,
            format!("only {} verses name a place", by_verse.len()),
        ),
        (
            size < 200_000,
            format!("real-map.json is {size} bytes; it should stay under 200 KB"),
        ),
        (
            rows.len() == names.len(),
            "places.json has a row for every place".to_string(),
        ),
    ];
    let has = |r: &str, want: &[&str]| -> Result<(bool, String), String> {
        let mut ok = true;
        for w in want {
            ok &= place_in(r, w)?.is_some();
        }
        Ok((
            ok,
            format!("{r} names {}: got {:?}", want.join(", "), named(r)?),
        ))
    };
    out.push(has("Ruth 1:1", &["Bethlehem", "Moab"])?);
    out.push(has("Matt 2:1", &["Bethlehem", "Judea", "Jerusalem"])?);
    out.push((
        !named("Matt 2:1")?
            .iter()
            .any(|g| g.eq_ignore_ascii_case("east")),
        "Matthew 2:1: \"the east\" is not a place name".to_string(),
    ));
    out.push(has("Mic 5:2", &["Bethlehem"])?);
    out.push(has("John 4:5", &["Sychar", "Samaria"])?);
    out.push(has("Gen 12:6", &["Shechem"])?);
    out.push(has("Gen 12:8", &["Bethel", "Ai"])?);
    out.push(has("Gen 12:9", &["Negev"])?);
    out.push(has("Exod 14:2", &["Pi-hahiroth", "Migdol", "Baal-zephon"])?);
    let syria = named("Acts 15:41")?;
    out.push((
        syria.iter().any(|g| g == "Syria") && syria.iter().any(|g| g == "Cilicia"),
        format!("Acts 15:41 uses the names it prints, Syria and Cilicia: {syria:?}"),
    ));
    out.push((
        alts.iter()
            .all(|&(p, name)| p < names.len() && names[p] != name),
        "every other name belongs to a place and differs from its usual name".to_string(),
    ));
    out.push(has("Acts 14:6", &["Lystra", "Derbe"])?);
    out.push(has("Acts 13:4", &["Seleucia", "Cyprus"])?);
    out.push((
        named("Gen 1:1")?.is_empty(),
        "Genesis 1:1 names no place".to_string(),
    ));
    let order = named("Acts 13:13")?;
    out.push((
        order.first().map(String::as_str) == Some("Paphos"),
        format!("Acts 13:13 lists its places in reading order, Paphos first: {order:?}"),
    ));

    let bethlehem = place_in("Ruth 1:1", "Bethlehem")?;
    let dist = bethlehem.and_then(best).map(|(p, _)| km(p, jer));
    out.push((
        dist.is_some_and(|k| (7.0..12.0).contains(&k)),
        format!("Bethlehem is about 9 km from Jerusalem: {dist:?} km"),
    ));
    out.push((
        bethlehem.and_then(best).is_some_and(|(_, s)| s >= 800),
        "Bethlehem's site is not in doubt".to_string(),
    ));
    let red_sea = place_in("Exod 13:18", "Red Sea")?;
    out.push((
        red_sea.and_then(best).is_some_and(|(_, s)| s < CONFIDENT),
        "where Israel crossed the sea is uncertain (Exodus 13:18, Red Sea)".to_string(),
    ));
    let pi = place_in("Exod 14:2", "Pi-hahiroth")?;
    out.push((
        pi.and_then(best).is_none_or(|(_, s)| s < CONFIDENT),
        "Pi-hahiroth's location is uncertain".to_string(),
    ));
    let in_range = rows
        .iter()
        .filter_map(|r| r.get(4)?.as_array())
        .flatten()
        .all(|s| {
            s[0].as_f64().is_some_and(|x| x.abs() <= 1.8e6)
                && s[1].as_f64().is_some_and(|y| y.abs() <= 9e5)
        });
    out.push((in_range, "every site has real coordinates".to_string()));
    let lystra = place_in("Acts 14:6", "Lystra")?;

    // The line about each place, and its label.
    const LABELS: [&str; 8] = [
        "",
        "likely site",
        "location uncertain",
        "location unknown",
        "not on this map",
        "more than one place",
        "may be symbolic",
        "may not be a place",
    ];
    let text_at = |p: Option<usize>, i: usize| -> String {
        p.and_then(|p| rows.get(p))
            .and_then(|r| r.get(i))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    };
    let rows_ok = rows.iter().all(|r| {
        let line = r.get(3).and_then(Value::as_str).unwrap_or("");
        r.as_array().is_some_and(|a| a.len() == 12)
            && !line.is_empty()
            && !line.contains("probably")
            && r.get(9)
                .and_then(Value::as_str)
                .is_some_and(|l| LABELS.contains(&l))
    });
    out.push((
        rows_ok,
        "every place has a line and a known label, and no line guesses (\"probably\")".to_string(),
    ));
    let line_is =
        |r: &str, name: &str, want: &str, label: &str| -> Result<(bool, String), String> {
            let p = place_in(r, name)?;
            let (line, got) = (text_at(p, 3), text_at(p, 9));
            Ok((
                line == want && got == label,
                format!("{r}: \"{name}: {want}\" [{label}]; got \"{line}\" [{got}]"),
            ))
        };
    out.push(line_is(
        "Ruth 1:1",
        "Bethlehem",
        "a town about 8 km south of Jerusalem",
        "",
    )?);
    out.push(line_is(
        "Matt 2:1",
        "Judea",
        "a region that included Jerusalem",
        "",
    )?);
    out.push(line_is("Ps 2:6", "Zion", "another name for Jerusalem", "")?);
    out.push(line_is(
        "Acts 14:6",
        "Lystra",
        "a town in what is now Turkey",
        "",
    )?);
    out.push(line_is("Neh 3:26", "Ophel", "a hill in Jerusalem", "")?);
    out.push(line_is(
        "Jer 31:39",
        "Goah",
        "a hill within 8 km of Jerusalem",
        "",
    )?);
    out.push(line_is(
        "Rev 18:2",
        "Babylon",
        "here another name for Rome, in what is now Italy",
        "may be symbolic",
    )?);
    out.push(line_is(
        "Jer 46:2",
        "Euphrates",
        "a river running through what is now Turkey, Syria and Iraq",
        "",
    )?);
    out.push(line_is("Gen 2:8", "Eden", "a garden", "location unknown")?);
    out.push(line_is(
        "1 Sam 17:1",
        "Azekah",
        "a town at the site called Tel Azekah",
        "not on this map",
    )?);
    out.push(line_is(
        "Exod 26:33",
        "Most Holy Place",
        "a room in the Holy Place",
        "more than one place",
    )?);
    out.push(line_is(
        "Acts 21:1",
        "Rhodes",
        "an island in what is now Greece",
        "",
    )?);
    out.push(line_is(
        "Luke 24:13",
        "Emmaus",
        "a town whose proposed sites lie west of Jerusalem",
        "location uncertain",
    )?);
    out.push(line_is(
        "Gen 11:31",
        "Canaan",
        "a region that included Jerusalem",
        "",
    )?);
    out.push(line_is(
        "Jer 46:2",
        "Carchemish",
        "a town near what is now the border of Syria and Turkey",
        "",
    )?);
    let bethphage = text_at(place_in("Matt 21:1", "Bethphage")?, 3);
    out.push((
        bethphage.starts_with("a town just east of Jerusalem"),
        format!("Matthew 21:1: Bethphage is just east of Jerusalem: {bethphage:?}"),
    ));
    let macedonia = text_at(place_in("Acts 16:9", "Macedonia")?, 3);
    out.push((
        !macedonia.is_empty() && !macedonia.contains("North Macedonia"),
        format!("Acts 16:9: Macedonia is not put in one modern country: {macedonia:?}"),
    ));

    // The base map.
    let decode_all = |k: &str, skip: usize| -> Vec<Vec<Pt>> {
        base[k]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|r| r.as_array())
                    .map(|r| decode(&r[skip.min(r.len())..]))
                    .collect()
            })
            .unwrap_or_default()
    };
    let land = decode_all("land", 0);
    out.push((
        land.len() > 20 && inside(&land, jer),
        "Jerusalem stands on the map's land".to_string(),
    ));
    out.push((
        !inside(&land, (33.0, 33.0)) && !inside(&land, (37.0, 23.0)),
        "the Mediterranean and the Red Sea are water".to_string(),
    ));
    out.push((
        inside(&land, (33.0, 35.0)) && inside(&land, (24.9, 35.2)),
        "Cyprus and Crete are land".to_string(),
    ));
    let lake_names: Vec<&str> = base["lakeNames"]
        .as_array()
        .map(|a| a.iter().filter_map(|l| l[0].as_str()).collect())
        .unwrap_or_default();
    out.push((
        lake_names.contains(&"Sea of Galilee") && lake_names.contains(&"Dead Sea"),
        format!("the Sea of Galilee and the Dead Sea are on the map: {lake_names:?}"),
    ));
    let galilee = base["lakeNames"]
        .as_array()
        .and_then(|a| a.iter().find(|l| l[0] == "Sea of Galilee"))
        .and_then(|l| Some((l[1].as_f64()?, l[2].as_f64()?)));
    out.push((
        galilee.is_some_and(|g| km(g, (35.59, 32.82)) < 10.0),
        format!("the Sea of Galilee is where it should be: {galilee:?}"),
    ));
    let rivers: Vec<&str> = base["riverNames"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    out.push((
        ["Jordan", "Nile", "Euphrates", "Tigris"]
            .iter()
            .all(|r| rivers.contains(r)),
        format!("the Jordan, Nile, Euphrates and Tigris are on the map: {rivers:?}"),
    ));
    let seas: Vec<&str> = base["seas"]
        .as_array()
        .map(|a| a.iter().filter_map(|s| s[0].as_str()).collect())
        .unwrap_or_default();
    out.push((
        seas.contains(&"Mediterranean Sea") && seas.contains(&"Red Sea"),
        format!("the seas are named: {seas:?}"),
    ));

    // People.
    let pnames: Vec<&str> = people["names"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    let tied = |p: Option<usize>, who: &str, bit: u64| -> bool {
        p.and_then(|p| people["places"].get(p))
            .and_then(Value::as_array)
            .is_some_and(|l| {
                l.iter().any(|x| {
                    x[0].as_u64()
                        .and_then(|i| pnames.get(i as usize))
                        .is_some_and(|n| n.starts_with(who))
                        && x[1].as_u64().unwrap_or(0) & bit != 0
                })
            })
    };
    out.push((
        tied(bethlehem, "Jesus", 1),
        "Theographic: Jesus was born in Bethlehem".to_string(),
    ));
    out.push((
        tied(lystra, "Paul", 4),
        "Theographic: Paul was in Lystra".to_string(),
    ));
    let ur = place_in("Gen 11:31", "Ur")?;
    out.push((
        tied(ur, "Abraham", 4) && !tied(ur, "Canaan", 4),
        "Abraham was in Ur, and Canaan in Genesis 11:31 is the land, not the man".to_string(),
    ));
    // Theographic puts everyone on the first journey at Seleucia; only a
    // verse naming both keeps a "was there".
    let seleucia = place_in("Acts 13:4", "Seleucia")?;
    let paphos = place_in("Acts 13:6", "Paphos")?;
    out.push((
        tied(seleucia, "Barnabas", 4)
            && !tied(seleucia, "Elymas", 4)
            && !tied(seleucia, "Sergius", 4)
            && tied(paphos, "Paul", 4),
        "Barnabas was at Seleucia (Acts 13:4), and Paul at Paphos (Acts 13:13); Elymas and Sergius, whom no verse names with Seleucia, were not"
            .to_string(),
    ));
    // A place Theographic puts elsewhere lends this one no people.
    let ibzan = place_in("Judg 12:8", "Bethlehem")?;
    let rev = place_in("Rev 18:2", "Babylon")?;
    out.push((
        ibzan.is_some()
            && ibzan != bethlehem
            && !tied(ibzan, "Jesus", 1)
            && rev.is_some()
            && !tied(rev, "Zedekiah", 2),
        "the Bethlehem of Judges 12:8 and the Babylon of Revelation 18:2 borrow no people"
            .to_string(),
    ));
    // Names as the BSB spells them, and no title's epithet respelled.
    let lystra_people: Vec<&str> = lystra
        .and_then(|p| people["places"].get(p))
        .and_then(Value::as_array)
        .map(|l| {
            l.iter()
                .filter_map(|x| x[0].as_u64().and_then(|i| pnames.get(i as usize).copied()))
                .collect()
        })
        .unwrap_or_default();
    out.push((
        lystra_people.contains(&"Timothy")
            && !pnames.iter().any(|n| n.contains("Timotheus") || n.contains("Boanerges")),
        format!("people are named as the BSB names them (Timothy, not Timotheus; John the Apostle): {lystra_people:?}"),
    ));
    // Births and deaths the text rules out are left out.
    let egypt = place_in("Gen 50:26", "Egypt")?;
    out.push((
        tied(egypt, "Joseph (son of Jacob)", 2) && !tied(egypt, "Joseph (son of Jacob)", 1),
        "Joseph died in Egypt but was not born there (Genesis 30:22–25)".to_string(),
    ));
    // The verse shown for a death tells of that person's death.
    let shown_for = |p: Option<usize>, who: &str| -> Option<i64> {
        p.and_then(|p| people["places"].get(p))
            .and_then(Value::as_array)?
            .iter()
            .find(|x| {
                x[0].as_u64()
                    .and_then(|i| pnames.get(i as usize))
                    .is_some_and(|n| *n == who)
            })
            .and_then(|x| x[2].as_i64())
    };
    let jerusalem_p = place_in("Matt 2:1", "Jerusalem")?;
    let acts_21_13 = i64::from(d.resolve("Acts 21:13")?.0);
    let matt_16_21 = i64::from(d.resolve("Matt 16:21")?.0);
    let jesus = shown_for(jerusalem_p, "Jesus Christ");
    out.push((
        jesus == Some(matt_16_21) && jesus != Some(acts_21_13),
        format!("Jesus died in Jerusalem: Matthew 16:21, not Acts 21:13 (Paul's words about his own death): {jesus:?}"),
    ));
    // Every verse shown with a person names the place.
    let mut verses_of: HashMap<usize, HashSet<i64>> = HashMap::new();
    for (&v, ps) in &by_verse {
        for &(p, _) in ps {
            verses_of.entry(p).or_default().insert(i64::from(v));
        }
    }
    let shown_ok = people["places"].as_array().is_some_and(|ps| {
        ps.iter().enumerate().all(|(p, l)| {
            l.as_array().into_iter().flatten().all(|x| {
                let v = x[2].as_i64().unwrap_or(-1);
                v == -1 || verses_of.get(&p).is_some_and(|s| s.contains(&v))
            })
        })
    });
    out.push((
        shown_ok,
        "every verse shown with a person names the place".to_string(),
    ));
    out.push((
        !pnames.iter().any(|n| NOT_PEOPLE.contains(n)),
        format!("people.json leaves out {}", NOT_PEOPLE.join(", ")),
    ));
    let rows_ok = people["places"].as_array().is_some_and(|ps| {
        ps.len() == names.len()
            && ps.iter().filter_map(Value::as_array).flatten().all(|x| {
                x[0].as_u64().is_some_and(|i| (i as usize) < pnames.len())
                    && x[1].as_u64().is_some_and(|b| (1..8).contains(&b))
                    && x[2]
                        .as_i64()
                        .is_some_and(|v| v == -1 || (0..i64::from(n)).contains(&v))
            })
    });
    out.push((
        rows_ok,
        "people.json has a row for every place, and every person and verse in it exists"
            .to_string(),
    ));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chars(s: &str) -> Vec<char> {
        s.chars().collect()
    }

    #[test]
    fn names_are_found_whole() {
        let t = chars("And Jesse the Bethlehemite went to Bethlehem’s gate, by Beth-horon.");
        assert_eq!(find_name(&t, &chars("Bethlehem")), Some(35));
        assert_eq!(find_name(&t, &chars("Beth horon")), Some(56));
        assert_eq!(
            find_name(&chars("from Bethlehemite"), &chars("Bethlehem")),
            None
        );
        assert_eq!(
            find_name(&chars("BABYLON THE GREAT"), &chars("Babylon")),
            Some(0)
        );
        assert_eq!(find_name(&chars("the east"), &chars("East")), None);
        assert_eq!(
            find_name(
                &chars("near the Valley of Iphtah-el"),
                &chars("valley of Iphtah El")
            ),
            Some(9)
        );
        assert_eq!(find_name(&chars("Ai"), &chars("Ai")), Some(0));
        assert_eq!(find_name(&chars("Said"), &chars("Ai")), None);
    }

    #[test]
    fn positions_from_openstreetmap_or_the_palestine_grid_are_left_out() {
        let rows: Vec<Value> = [
            r#"{"id":"m1","lonlat":"35.2,31.7","coordinates_source":{"type":"wikidata"}}"#,
            r#"{"id":"m2","lonlat":"35.2,31.7","coordinates_source":{"type":"osm"}}"#,
            r#"{"id":"m3","lonlat":"35.2,31.7","coordinates_source":{"type":"epsg_28191"}}"#,
            r#"{"id":"m4","lonlat":"35.2,31.7","custom_lonlat":"35.3,31.8","coordinates_source":{"type":"osm"}}"#,
        ]
        .iter()
        .map(|r| serde_json::from_str(r).unwrap())
        .collect();
        let mut t = Tally::default();
        let m = moderns(&rows, &mut t);
        assert_eq!(m["m1"], Some((35.2, 31.7)));
        assert_eq!(m["m2"], None);
        assert_eq!(m["m3"], None);
        assert_eq!(m["m4"], Some((35.3, 31.8)));
        assert_eq!(t.withheld_sites, 2);
    }

    #[test]
    fn csv_reads_quotes_and_newlines() {
        let rows = csv("\u{feff}a,b,c\n1,\"two, \"\"2\"\"\nlines\",3\r\n");
        assert_eq!(
            rows,
            vec![vec!["a", "b", "c"], vec!["1", "two, \"2\"\nlines", "3"]]
        );
    }

    #[test]
    fn rings_are_cut_to_the_box() {
        // A square from 5E to 15E, half outside the west edge at 10E.
        let sq = [
            (5.0, 20.0),
            (15.0, 20.0),
            (15.0, 30.0),
            (5.0, 30.0),
            (5.0, 20.0),
        ];
        let c = clip_ring(&sq);
        assert!(c.iter().all(|p| p.0 >= 10.0 - 1e-9));
        assert!((area(&c).abs() - 50.0).abs() < 1e-9);
        assert!(clip_ring(&[(0.0, 0.0), (1.0, 0.0), (1.0, 1.0)]).is_empty());
    }

    #[test]
    fn simplify_keeps_corners_only() {
        let line = [(0.0, 0.0), (1.0, 0.0001), (2.0, 0.0), (2.0, 1.0)];
        assert_eq!(
            simplify(&line, 0.01),
            vec![(0.0, 0.0), (2.0, 0.0), (2.0, 1.0)]
        );
    }

    #[test]
    fn encode_round_trips() {
        let pts = [
            (35.2, 31.7),
            (35.2004, 31.7001),
            (35.21, 31.75),
            (34.0, 30.0),
        ];
        let e: Vec<Value> = encode(&pts).into_iter().map(Value::from).collect();
        let d = decode(&e);
        assert_eq!(d.len(), 3); // the second point lands on the first after rounding
        assert!((d[2].0 - 34.0).abs() < 1e-9 && (d[2].1 - 30.0).abs() < 1e-9);
    }

    #[test]
    fn inside_and_distance() {
        let sq = vec![vec![(0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0)]];
        assert!(inside(&sq, (1.0, 1.0)));
        assert!(!inside(&sq, (3.0, 1.0)));
        let d = km((35.2137, 31.7683), (35.2076, 31.7043));
        assert!((d - 7.1).abs() < 0.5, "{d}");
        // The first spot is about as far from the edges as the square allows
        // (0.85 scaled degrees from the sides); the second keeps its distance.
        let spots = label_points(&sq, 0.1, 0.5, 2);
        assert_eq!(spots.len(), 2);
        assert!(spots[0].1 > 0.8, "{:?}", spots[0]);
        let (a, b) = (scaled(spots[0].0), scaled(spots[1].0));
        assert!((a.0 - b.0).hypot(a.1 - b.1) >= 0.5);
    }

    #[test]
    fn display_name_prefers_the_bsb_spelling() {
        let p = Place {
            id: "a".into(),
            slug: "a".into(),
            base: "Negeb".into(),
            forms: vec![chars("Negev"), chars("Negeb")],
            shares: vec![0.5, 0.5],
            kind: "region".into(),
            sites: Vec::new(),
            off: None,
            sure: 0,
            special: None,
            how: None,
            comment: String::new(),
            verses: Vec::new(),
        };
        let at = |verse: u32, text: &str| {
            let t = chars(text);
            let pos = find_name(&t, &chars("Negev")).unwrap();
            Mention {
                verse,
                pos,
                len: 5,
                name: surface(&t, pos, 5),
            }
        };
        let ms = vec![at(1, "into the Negev."), at(2, "the NEGEV"), at(3, "Negev")];
        assert_eq!(ms[1].name, None);
        assert_eq!(display_name(&p, &ms), "Negev");
        assert_eq!(display_name(&p, &ms[1..2]), "Negeb");
        assert!(people_word("Bethlehemite", "Bethlehem") && !people_word("Bethlehem", "Bethlehem"));
        assert!(people_word("Philistines", "Philistia") && people_word("Cretans", "Crete"));
        assert!(people_word("Jews", "Judea") && !people_word("Midian", "Midian"));
        assert!(!people_word("Laish", "Dan") && !people_word("Canaan", "Canaan"));
        assert!(people_word("Arameans", "Syria") && !people_word("Jordan", "Jordan River"));
        assert_eq!(loose("Beth\u{2011}horon’s"), "beth horon's");
    }

    #[test]
    fn markup_becomes_plain_words() {
        let name_of = |id: &str| (id == "a1").then(|| "Jerusalem".to_string());
        assert_eq!(
            plain(
                "within 8 km of <ancient id=\"a1\">Jerusalem 1</ancient>",
                &name_of
            ),
            "within 8 km of Jerusalem"
        );
        assert_eq!(
            plain("in the <ancient id=\"a9\">Holy Place 1</ancient> &amp; <modern id=\"m\">Tel X</modern>", &name_of),
            "in the Holy Place & Tel X"
        );
        assert_eq!(
            relation_words("region around Gordion").as_deref(),
            Some("around Gordion")
        );
        assert_eq!(
            relation_words("about 200 km around Gordion").as_deref(),
            Some("around Gordion")
        );
        assert_eq!(
            relation_words("another name for Jerusalem").as_deref(),
            Some("another name for Jerusalem")
        );
        assert_eq!(relation_words("Tel Avdon"), None);
        assert_eq!(with_the("Wilderness of Zin"), "the Wilderness of Zin");
        assert_eq!(with_the("Mount Hermon"), "Mount Hermon");
        assert_eq!(
            and_list(&["Turkey", "Syria", "Iraq"]),
            "Turkey, Syria and Iraq"
        );
        assert_eq!(and_list(&["Egypt"]), "Egypt");
    }

    #[test]
    fn notes_leave_out_working_notes_and_sources() {
        let name_of = |id: &str| (id == "c1").then(|| "Cush".to_string());
        assert_eq!(
            note_words(
                "in <ancient id=\"b\">Benjamin 1</ancient>",
                "Gibeah",
                &name_of
            ),
            "In Benjamin"
        );
        assert_eq!(note_words("I tagged these verses", "Gibeah", &name_of), "");
        assert_eq!(
            note_words(
                "see <source id=\"s\">a dictionary</source>",
                "Gibeah",
                &name_of
            ),
            ""
        );
        assert_eq!(note_words("see Bibleorigins.net", "Shur", &name_of), "");
        assert_eq!(
            note_words(
                "approximately equivalent to <ancient id=\"c1\">Ethiopia</ancient>",
                "Cush",
                &name_of
            ),
            ""
        );
    }

    #[test]
    fn a_site_on_a_modern_border_is_said_to_be_near_it() {
        let sq = |n: &str, b: [f64; 4]| {
            let ring = vec![
                (b[0], b[1]),
                (b[2], b[1]),
                (b[2], b[3]),
                (b[0], b[3]),
                (b[0], b[1]),
            ];
            (n.to_string(), b, vec![ring])
        };
        let c = Countries(vec![
            // One long straight border, with no corner near Carchemish.
            sq("Turkey", [36.0, 36.83, 40.0, 38.0]),
            sq("Syria", [36.0, 35.0, 40.0, 36.83]),
            sq("Vatican City", [37.0, 35.5, 37.01, 35.51]),
            // An island about 3 km off Turkey's coast.
            sq("Greece", [26.0, 37.5, 26.9, 38.5]),
            sq("Turkey", [26.94, 37.0, 30.0, 39.0]),
        ]);
        let near = |p: Pt, own: &str| c.border_with(p, own, NEAR_BORDER_KM);
        assert_eq!(near((38.015, 36.8297), "Syria"), Some("Turkey"));
        assert_eq!(near((38.015, 36.65), "Syria"), None);
        assert_eq!(near((37.02, 35.505), "Syria"), None, "a tiny state");
        assert_eq!(near((26.89, 38.0), "Greece"), None, "across the sea");
        let courses = HashMap::new();
        let g = Geo {
            jerusalem: (35.2345, 31.7767),
            dead_sea: (35.5, 31.5),
            countries: &c,
            courses: &courses,
        };
        assert_eq!(
            place_phrase(&g, (38.015, 36.8297), "settlement", "Carchemish"),
            "near what is now the border of Syria and Turkey"
        );
        assert_eq!(
            place_phrase(&g, (38.015, 36.5), "settlement", "Arpad"),
            "in what is now Syria"
        );
        // A region near a border is placed from Jerusalem instead.
        assert_eq!(
            place_phrase(&g, (38.015, 36.8297), "region", "Aram"),
            "northeast of Jerusalem"
        );
    }

    #[test]
    fn uncertain_sites_are_placed_only_as_far_as_they_agree() {
        let at = |sites: &[Pt]| -> String {
            let p = Place {
                id: "a".into(),
                slug: "a".into(),
                base: "A".into(),
                forms: vec![chars("A")],
                shares: vec![1.0],
                kind: "settlement".into(),
                sites: sites
                    .iter()
                    .map(|&at| Site {
                        at,
                        score: 300,
                        name: "Tel A".into(),
                    })
                    .collect(),
                off: None,
                sure: 300,
                special: None,
                how: None,
                comment: String::new(),
                verses: Vec::new(),
            };
            let (countries, courses) = (Countries(Vec::new()), HashMap::new());
            let g = Geo {
                jerusalem: (35.2345, 31.7767),
                dead_sea: (35.5, 31.5),
                countries: &countries,
                courses: &courses,
            };
            let w = WhereIn {
                p: &p,
                name: "A",
                kind: "settlement",
                mentions: 1,
                relation: None,
                to_jerusalem: false,
                shared_name: false,
            };
            uncertain_line(&g, &w, "a town")
        };
        // Emmaus: about 7, 12 and 24 km away, all to the west.
        assert_eq!(
            at(&[(35.164, 31.793), (34.989, 31.839), (35.137, 31.840)]),
            "a town whose proposed sites lie west of Jerusalem"
        );
        // One site 21 km north, the other 9 km west.
        assert_eq!(at(&[(35.2345, 31.9666), (35.139, 31.7767)]), "a town");
        assert_eq!(
            at(&[(35.25, 31.79), (35.26, 31.80)]),
            "a town whose proposed sites lie near Jerusalem"
        );
        // Ai: et-Tell and Khirbet el-Maqatir, about a kilometre apart.
        assert_eq!(
            at(&[(35.2617, 31.9164), (35.2525, 31.9197)]),
            "a town whose proposed sites lie about 15 km north of Jerusalem"
        );
    }

    #[test]
    fn a_verse_about_someone_else_there_is_shown_last() {
        let paul = vec![(chars("Paul"), true)];
        let at = |t: &str, place: &str| -> bool {
            let t = chars(t);
            let s: String = t.iter().collect();
            let a = s.find("Paul").unwrap();
            let b = s.find(place).unwrap();
            let (a, b) = (s[..a].chars().count(), s[..b].chars().count());
            name_between(&t, a, b, &paul, &[(b, place.chars().count())])
        };
        assert!(at(
            "After setting sail from Paphos, Paul and his companions came to Perga in Pamphylia, where John left them to return to Jerusalem.",
            "Jerusalem"
        ));
        assert!(!at(
            "But Paul and Barnabas remained at Antioch, along with many others.",
            "Antioch"
        ));
        assert!(!at(
            "So when Paul went up to Jerusalem, He was glad.",
            "Jerusalem"
        ));
    }

    #[test]
    fn distances_are_said_plainly() {
        assert_eq!(about_km(8.4), "about 8 km");
        assert_eq!(about_km(57.0), "about 55 km");
        assert_eq!(about_km(1249.0), "about 1,200 km");
        assert_eq!(about_km(0.2), "about 1 km");
        assert_eq!(direction((35.2, 31.7), (35.2, 31.0)), "south");
        assert_eq!(direction((35.2, 31.7), (36.0, 32.5)), "northeast");
    }

    #[test]
    fn a_verse_tells_whose_birth_or_death() {
        let f = |names: &[&str]| -> Vec<(Vec<char>, bool)> {
            names.iter().map(|n| (chars(n), true)).collect()
        };
        let tells = |t: &str, ties: u8, who: &[&str]| telling(&chars(t), ties, &f(who), &[]);
        assert!(tells(
            "Terah lived 205 years, and he died in Haran.",
            2,
            &["Terah"]
        ));
        assert!(tells(
            "And Josiah was buried in the tombs of his fathers.",
            2,
            &["Josiah"]
        ));
        assert!(!tells(
            "After Joseph had buried his father, he returned to Egypt.",
            2,
            &["Joseph"]
        ));
        assert!(tells(
            "because he had killed their brother Asahel in the battle at Gibeon.",
            2,
            &["Asahel"]
        ));
        assert!(!tells(
            "Then Paul answered, “Why are you weeping? I am ready to die in Jerusalem for the name of the Lord Jesus.”",
            2,
            &["Jesus"]
        ));
        assert!(tells(
            "These are the names of the children born to him in Jerusalem: Shammua, Shobab, Nathan, Solomon,",
            1,
            &["Solomon"]
        ));
        assert!(!tells(
            "the two sons who had been born to Joseph in Egypt",
            1,
            &["Joseph"]
        ));
        assert!(planned(&chars(
            "Paul resolved in the Spirit to go to Jerusalem"
        )));
        assert!(!planned(&chars(
            "After this, Paul left Athens and went to Corinth."
        )));
        // A name inside a place's name is the place's.
        let t = chars("buried in the City of David");
        assert_eq!(
            find_name_where(&t, &chars("David"), |p| !(14..27).contains(&p)),
            None
        );
        assert_eq!(find_name(&t, &chars("David")), Some(22));
    }

    #[test]
    fn labels_say_how_sure() {
        let place = |sites: Vec<Site>,
                     sure: i64,
                     off: Option<(String, i64)>,
                     special: Option<(String, i64, bool, String)>| Place {
            id: "a".into(),
            slug: "a".into(),
            base: "A".into(),
            forms: vec![chars("A")],
            shares: vec![1.0],
            kind: "settlement".into(),
            sites,
            off,
            sure,
            special,
            how: None,
            comment: String::new(),
            verses: Vec::new(),
        };
        let site = |score| Site {
            at: (35.0, 31.0),
            score,
            name: "Tel A".into(),
        };
        assert_eq!(
            label(&place(vec![site(900)], 900, None, None), false, false),
            ""
        );
        assert_eq!(
            label(&place(vec![site(450)], 650, None, None), false, false),
            "likely site"
        );
        assert_eq!(
            label(&place(vec![site(300)], 300, None, None), false, false),
            "location uncertain"
        );
        assert_eq!(
            label(
                &place(Vec::new(), 0, Some(("Tel Azekah".into(), 772)), None),
                false,
                false
            ),
            "not on this map"
        );
        assert_eq!(
            label(&place(Vec::new(), 0, None, None), false, true),
            "more than one place"
        );
        assert_eq!(
            label(&place(Vec::new(), 0, None, None), false, false),
            "location unknown"
        );
        let multi = Some(("multiple_locations".to_string(), 1000, true, String::new()));
        assert_eq!(
            label(&place(vec![site(900)], 900, None, multi), false, false),
            "more than one place"
        );
        assert_eq!(
            label(&place(vec![site(900)], 900, None, None), true, false),
            "may be symbolic"
        );
    }

    #[test]
    fn people_get_the_bsb_spelling() {
        assert_eq!(edits(&chars("aholiab"), &chars("oholiab")), 1);
        assert_eq!(edits(&chars("achsah"), &chars("acsah")), 1);
        assert_eq!(edits(&chars(""), &chars("abc")), 3);
        assert_eq!(letters("Baal-hanan"), "baalhanan");
        assert_eq!(
            capitalized(&chars("Then Simon Peter and Baal-hanan son of Achbor went")),
            vec!["Then", "Simon", "Peter", "Baal-hanan", "Achbor"]
        );
    }
}
