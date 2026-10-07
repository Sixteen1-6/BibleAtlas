//! The 66-book Protestant canon with every naming scheme the sources use.
//!
//! - `osis`: OSIS abbreviations, used by the OpenBible.info cross-references.
//! - `step`: STEPBible abbreviations, used by TAHOT/TAGNT and the lexicons.
//! - `aliases`: lowercase, space-free forms accepted when a person types a reference.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Testament {
    Old,
    New,
}

/// Traditional groupings, used to color the book bands on the map.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Genre {
    Law,
    History,
    Wisdom,
    MajorProphets,
    MinorProphets,
    Gospels,
    Acts,
    PaulineLetters,
    GeneralLetters,
    Apocalyptic,
}

impl Genre {
    pub fn key(self) -> &'static str {
        match self {
            Genre::Law => "law",
            Genre::History => "history",
            Genre::Wisdom => "wisdom",
            Genre::MajorProphets => "major-prophets",
            Genre::MinorProphets => "minor-prophets",
            Genre::Gospels => "gospels",
            Genre::Acts => "acts",
            Genre::PaulineLetters => "pauline",
            Genre::GeneralLetters => "general",
            Genre::Apocalyptic => "apocalyptic",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Book {
    pub osis: &'static str,
    pub step: &'static str,
    pub name: &'static str,
    pub testament: Testament,
    pub genre: Genre,
    pub aliases: &'static [&'static str],
}

macro_rules! book {
    ($osis:expr, $step:expr, $name:expr, $t:ident, $g:ident, [$($a:expr),*]) => {
        Book { osis: $osis, step: $step, name: $name, testament: Testament::$t, genre: Genre::$g, aliases: &[$($a),*] }
    };
}

pub const BOOKS: [Book; 66] = [
    book!("Gen", "Gen", "Genesis", Old, Law, ["gen", "ge", "gn"]),
    book!("Exod", "Exo", "Exodus", Old, Law, ["exod", "exo", "ex"]),
    book!("Lev", "Lev", "Leviticus", Old, Law, ["lev", "le", "lv"]),
    book!("Num", "Num", "Numbers", Old, Law, ["num", "nu", "nm"]),
    book!("Deut", "Deu", "Deuteronomy", Old, Law, ["deut", "deu", "dt"]),
    book!("Josh", "Jos", "Joshua", Old, History, ["josh", "jos", "jsh"]),
    book!("Judg", "Jdg", "Judges", Old, History, ["judg", "jdg", "jg"]),
    book!("Ruth", "Rut", "Ruth", Old, History, ["ruth", "rut", "ru"]),
    book!("1Sam", "1Sa", "1 Samuel", Old, History, ["1sam", "1sa", "1sm"]),
    book!("2Sam", "2Sa", "2 Samuel", Old, History, ["2sam", "2sa", "2sm"]),
    book!("1Kgs", "1Ki", "1 Kings", Old, History, ["1kgs", "1ki", "1kg"]),
    book!("2Kgs", "2Ki", "2 Kings", Old, History, ["2kgs", "2ki", "2kg"]),
    book!("1Chr", "1Ch", "1 Chronicles", Old, History, ["1chr", "1ch", "1chron"]),
    book!("2Chr", "2Ch", "2 Chronicles", Old, History, ["2chr", "2ch", "2chron"]),
    book!("Ezra", "Ezr", "Ezra", Old, History, ["ezra", "ezr"]),
    book!("Neh", "Neh", "Nehemiah", Old, History, ["neh", "ne"]),
    book!("Esth", "Est", "Esther", Old, History, ["esth", "est", "es"]),
    book!("Job", "Job", "Job", Old, Wisdom, ["job", "jb"]),
    book!("Ps", "Psa", "Psalms", Old, Wisdom, ["ps", "psa", "psalm", "pss", "psm"]),
    book!("Prov", "Pro", "Proverbs", Old, Wisdom, ["prov", "pro", "pr", "prv"]),
    book!("Eccl", "Ecc", "Ecclesiastes", Old, Wisdom, ["eccl", "ecc", "ec", "qoh"]),
    book!("Song", "Sng", "Song of Solomon", Old, Wisdom, ["song", "sng", "sos", "songofsongs", "canticles"]),
    book!("Isa", "Isa", "Isaiah", Old, MajorProphets, ["isa", "is"]),
    book!("Jer", "Jer", "Jeremiah", Old, MajorProphets, ["jer", "je", "jr"]),
    book!("Lam", "Lam", "Lamentations", Old, MajorProphets, ["lam", "la"]),
    book!("Ezek", "Ezk", "Ezekiel", Old, MajorProphets, ["ezek", "ezk", "eze"]),
    book!("Dan", "Dan", "Daniel", Old, MajorProphets, ["dan", "da", "dn"]),
    book!("Hos", "Hos", "Hosea", Old, MinorProphets, ["hos", "ho"]),
    book!("Joel", "Jol", "Joel", Old, MinorProphets, ["joel", "jol", "jl"]),
    book!("Amos", "Amo", "Amos", Old, MinorProphets, ["amos", "amo", "am"]),
    book!("Obad", "Oba", "Obadiah", Old, MinorProphets, ["obad", "oba", "ob"]),
    book!("Jonah", "Jon", "Jonah", Old, MinorProphets, ["jonah", "jon", "jnh"]),
    book!("Mic", "Mic", "Micah", Old, MinorProphets, ["mic", "mc"]),
    book!("Nah", "Nam", "Nahum", Old, MinorProphets, ["nah", "nam", "na"]),
    book!("Hab", "Hab", "Habakkuk", Old, MinorProphets, ["hab", "hb"]),
    book!("Zeph", "Zep", "Zephaniah", Old, MinorProphets, ["zeph", "zep", "zp"]),
    book!("Hag", "Hag", "Haggai", Old, MinorProphets, ["hag", "hg"]),
    book!("Zech", "Zec", "Zechariah", Old, MinorProphets, ["zech", "zec", "zc"]),
    book!("Mal", "Mal", "Malachi", Old, MinorProphets, ["mal", "ml"]),
    book!("Matt", "Mat", "Matthew", New, Gospels, ["matt", "mat", "mt"]),
    book!("Mark", "Mrk", "Mark", New, Gospels, ["mark", "mrk", "mk", "mr"]),
    book!("Luke", "Luk", "Luke", New, Gospels, ["luke", "luk", "lk"]),
    book!("John", "Jhn", "John", New, Gospels, ["john", "jhn", "jn", "joh"]),
    book!("Acts", "Act", "Acts", New, Acts, ["acts", "act", "ac"]),
    book!("Rom", "Rom", "Romans", New, PaulineLetters, ["rom", "ro", "rm"]),
    book!("1Cor", "1Co", "1 Corinthians", New, PaulineLetters, ["1cor", "1co"]),
    book!("2Cor", "2Co", "2 Corinthians", New, PaulineLetters, ["2cor", "2co"]),
    book!("Gal", "Gal", "Galatians", New, PaulineLetters, ["gal", "ga"]),
    book!("Eph", "Eph", "Ephesians", New, PaulineLetters, ["eph", "ephes"]),
    book!("Phil", "Php", "Philippians", New, PaulineLetters, ["phil", "php", "pp"]),
    book!("Col", "Col", "Colossians", New, PaulineLetters, ["col"]),
    book!("1Thess", "1Th", "1 Thessalonians", New, PaulineLetters, ["1thess", "1th", "1thes"]),
    book!("2Thess", "2Th", "2 Thessalonians", New, PaulineLetters, ["2thess", "2th", "2thes"]),
    book!("1Tim", "1Ti", "1 Timothy", New, PaulineLetters, ["1tim", "1ti", "1tm"]),
    book!("2Tim", "2Ti", "2 Timothy", New, PaulineLetters, ["2tim", "2ti", "2tm"]),
    book!("Titus", "Tit", "Titus", New, PaulineLetters, ["titus", "tit"]),
    book!("Phlm", "Phm", "Philemon", New, PaulineLetters, ["phlm", "phm", "philem"]),
    book!("Heb", "Heb", "Hebrews", New, GeneralLetters, ["heb"]),
    book!("Jas", "Jas", "James", New, GeneralLetters, ["jas", "jm", "jam"]),
    book!("1Pet", "1Pe", "1 Peter", New, GeneralLetters, ["1pet", "1pe", "1pt"]),
    book!("2Pet", "2Pe", "2 Peter", New, GeneralLetters, ["2pet", "2pe", "2pt"]),
    book!("1John", "1Jn", "1 John", New, GeneralLetters, ["1john", "1jn", "1jo"]),
    book!("2John", "2Jn", "2 John", New, GeneralLetters, ["2john", "2jn", "2jo"]),
    book!("3John", "3Jn", "3 John", New, GeneralLetters, ["3john", "3jn", "3jo"]),
    book!("Jude", "Jud", "Jude", New, GeneralLetters, ["jude", "jud"]),
    book!("Rev", "Rev", "Revelation", New, Apocalyptic, ["rev", "re", "rv", "apocalypse"]),
];

pub fn by_osis(s: &str) -> Option<u8> {
    BOOKS.iter().position(|b| b.osis == s).map(|i| i as u8)
}

pub fn by_step(s: &str) -> Option<u8> {
    BOOKS.iter().position(|b| b.step == s).map(|i| i as u8)
}

/// Index of the first New Testament book (Matthew).
pub const FIRST_NT_BOOK: u8 = 39;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_unique() {
        for (i, a) in BOOKS.iter().enumerate() {
            for b in &BOOKS[i + 1..] {
                assert_ne!(a.osis, b.osis);
                assert_ne!(a.step, b.step);
                for x in a.aliases {
                    assert!(!b.aliases.contains(x), "alias {x} used twice");
                }
            }
        }
        assert_eq!(BOOKS[FIRST_NT_BOOK as usize].osis, "Matt");
    }
}
