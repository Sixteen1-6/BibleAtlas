//! Every form of each root, and its family of related words.
//!
//! - Forms: a root's uses grouped by grammar (ἀγάπη, ἀγάπης, ἀγάπην are one
//!   root in three cases), each shown as it is most often spelled, and which
//!   form each of the root's postings is, so the site can light one form.
//! - Family: the words a root comes from and the words that come from it.
//!   Derivations come from the "derivation" line of Strong's dictionaries
//!   (Open Scriptures JSON): ἀγάπη is "from G25 (ἀγαπάω)", so ἀγάπη, ἀγαπάω and
//!   ἀγαπητός ("from G25") are one family. Senses, spellings, forms and the
//!   Aramaic twin of a word come from STEPBible's lexicons (TBESH, TBESG).
//!
//! A wrong relative misleads and a missing one does not, so only plain
//! statements count. Left out: guesses ("perhaps", "probably", "akin to"),
//! comparisons ("formed like", "as X is of"), contrasts ("whereas", "in
//! distinction from"), compounds of two words (except a Greek word built on a
//! prefix, as ἐξέρχομαι on ἔρχομαι), a primitive root's cross-references, and
//! names. Hebrew links that rest on a sense the reader cannot see ("in the
//! sense of", "original meaning") are left out too; Greek ones are kept, as
//! ἐκλέγω from λέγω "in the sense of choosing". A spelling or by-form ("for
//! H2088", "a variation of") and a word from "the base of" a Greek noun only
//! share a root, with no direction. Strong's own slips, folk etymologies and
//! two-way loops are corrected or dropped (REMAP, NO_PARENT, cycles below).
//!
//! Strong's numbers often hold several words that STEPBible's lexicons tell
//! apart (אַיִל ram, pillar, leader, terebinth). A derivation is linked to the
//! number's main word only, and not at all when look-alike words share the
//! number and none of them holds nine in ten of its uses, unless CHILD_SENSE
//! says which one is meant.
//!
//! A family is one step around the word (where it comes from, what comes from
//! it, words from the same parent), never a chain of chains, which in Strong's
//! quickly reaches unrelated words. The one exception is a feminine or plural
//! of a word that plainly comes from another (אַהֲבָה, love, through אַהַב to
//! אָהֵב, to love).
//!
//! Output: `forms/<shard>.json`, one entry per root as the lexicon shards are:
//! `{"f": [[spelling, grammar, count, [other spellings]?], ...], "o": [form per posting], "r": [[root, relation, word], ...]}`
//! with "o" left out when the root has one form (-1 marks a use the source's
//! parts don't line up for) and "r" when it has no family. In "r", `word` is
//! the most used root of the relative's dictionary word, so the site shows one
//! row per word while lighting and underlining every sense. Relations: "f"
//! another form of the same word (φαγεῖν of ἐσθίω), "p" comes from (parent),
//! "c" comes from this (child), "s" shares its root, "a" the same word in the
//! other language (Hebrew and Aramaic), "n" another sense of the same word.
//!
//! Three more fields say which links are not Strong's own, so the word study
//! never credits them to him: "h" lists the `word` of each relative linked
//! only through a hand-listed correction of a slip in Strong's number
//! (`REMAP_G`, `REMAP_H`, `HEAD_REMAP_G`), and "t" each Aramaic twin STEPBible
//! pairs that Strong's does not tie (`TWINS`, `TWINS_MORE`). "x" is 1 on a root
//! whose own derivation was corrected that way, and 2 on one whose derivation
//! the hand lists leave out (`NO_PARENT_G`, `NO_PARENT_H`); the themes can read
//! it too, before they quote a derivation as Strong's.
//!
//! Strong's own entry for each number (derivation and definition, without the
//! King James renderings) is read here as well, by `strongs_line`, and shipped
//! with the lexicon entry (`lex/<shard>.json`, "k"), where the word study shows
//! it before the fuller lexicon.

use crate::parse::Word;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::Path;

/// Strong's number as the roots key it: "G26" -> "G0026".
fn base(lang: char, digits: &str) -> String {
    format!("{lang}{:0>4}", digits)
}

/// The Strong's number of a roots key: "H7673A" -> "H7673", "G20447" -> "G20447".
fn number(key: &str) -> &str {
    key.trim_end_matches(|c: char| c.is_ascii_alphabetic())
}

/// Words that make a derivation a guess rather than a statement (whole words).
const GUESSES: [&str; 9] = ["perhaps", "probably", "akin", "apparent", "apparently", "uncertain", "possibly", "doubtful", "compare"];

/// Greek prefixes (prepositions, the negative alpha, εὖ, δυσ-) that a compound
/// is built from: ἐξέρχομαι is "from G1537 (ἐκ) and G2064 (ἔρχομαι)".
const PREFIXES: [&str; 20] =
    ["G0001", "G0303", "G0473", "G0575", "G1223", "G1418", "G1519", "G1537", "G1722", "G1909", "G2095", "G2596", "G3326", "G3844", "G4012", "G4253", "G4314", "G4862", "G5228", "G5259"];

/// Strong's own slips that no text rule can tell from a plain derivation
/// (checked against the Greek lexicons): the word's real parent.
const REMAP_G: [(&str, &str); 10] = [
    ("G5043", "G5088"), // τέκνον: "the base of G5098 (τιμωρία)" is a typo for τίκτω
    ("G4159", "G4226"), // πόθεν comes from ποῦ, not πόσις, drink
    ("G4006", "G3982"), // πεποίθησις comes from πείθω, not πάσχω
    ("G5050", "G5048"), // τελείωσις from τελειόω, not φυσιόω
    ("G3929", "G3935"), // πάρεσις from παρίημι, not κτήτωρ
    ("G3968", "G3962"), // πατρίς from πατήρ, not παράσημος
    ("G4715", "G2476"), // στατήρ from ἵστημι, not καύχησις
    ("G0971", "G0970"), // βιάζω from βία, not βίος
    ("G3147", "G3148"), // μαστίζω from μάστιξ, not μαστός
    ("G0507", "G0303"), // ἄνω from ἀνά, not ἀντί
];
/// μετάγω is ἄγω with μετά, not ἁρμόζω.
const HEAD_REMAP_G: [(&str, &str); 1] = [("G3329", "G0071")];
/// Strong's numbers with no root of their own: STEPBible files them as a form
/// of another number (ἄρχομαι under ἄρχω, ὤν under εἰμί, ἅπτομαι under ἅπτω).
const ALIAS_G: [(&str, &str); 3] = [("G0756", "G0757"), ("G5607", "G1510"), ("G0680", "G0681")];
/// Words whose Strong's derivation is a folk etymology, a merged homonym or a
/// slip with no right answer: no parent, prefix head or shared root.
const NO_PARENT_G: [&str; 58] = [
    "G4983", // σῶμα is not from σῴζω
    "G0740", "G0706", "G0759", "G0741", // ἄρτος, ἀριθμός, ἄρωμα, ἀρτύω are not from αἴρω
    "G1401", "G1218", "G1189", "G1163", // δοῦλος, δῆμος, δέομαι, δεῖ: δέω "bind" and δέω "lack" are merged
    "G3319", // μέσος is not from μετά
    "G5045", "G5078", "G5115", // τέκτων, τέχνη, τόξον
    "G5204", "G5200", // ὕδωρ, ὑγρός are not from ὑετός
    "G3709", // ὀργή is not from ὀρέγω
    "G0417", "G0105", "G0833", "G0836", "G0822", // ἄνεμος, ἀετός, αὐλή, αὐλός, ἀτμίς are not from ἀήρ
    "G3586", // ξύλον is not from ξέστης (Latin sextarius)
    "G0726", // ἁρπάζω is not from αἱρέω
    "G0901", // βαθύς is not from βάσις
    "G2811", // κλέος is not from καλέω
    "G4642", // σκληρός is not from σκέλος
    "G4741", "G4738", "G4719", "G4731", // στηρίζω, στῆθος, στάχυς, στερεός are not from ἵστημι
    "G5522", // χόος is not from χειμών
    "G3149", // μαστός is not from μασσάομαι
    "G2970", "G2966", // κῶμος, κῶλον
    "G3576", // νωθρός is not from νόθος
    "G4987", // σωρεύω is not from σορός
    "G0788", // ἆσσον is the comparative of ἄγχι
    "G0869", // ἄφνω is not from ἀφανής
    "G2950", // κύμβαλον is not from κῦμα
    "G0957", // βελτίων is not from βάλλω
    "G0703", // ἀρετή does not share a root with ἄρσην
    "G2608", // κατάγνυμι does not share a root with ῥήγνυμι
    "G4437", // πυκνός: "clasped" is a folk etymology
    "G5306", "G5196", // ὕστερος, ὕβρις are not from ὑπό, ὑπέρ
    "G1729", "G2366", "G5448", // ἐνδεής, θύελλα, φυσιόω come from the homonym (δέω lack, θύω rush, φυσάω blow)
    "G2233", "G1188", "G0086", // ἡγέομαι, δεξιός, ᾍδης: disputed
    "G5501", "G2276", // χείρων, ἥσσων are comparatives from other roots, used for κακός
    "G4711", // σπυρίς basket ("as woven") belongs to σπεῖρα coil, not σπείρω sow
    "G5199", // ὑγιής is not from αὐξάνω
    "G3601", "G3602", // ὀδύνη, ὀδυρμός are not from δύνω
    "G4807", // συκάμινος is a Hebrew loanword, only "in imitation of" συκομωραία
];
/// Hebrew slips: the number in the line is a typo for the word's real parent.
const REMAP_H: [(&str, &str); 7] = [
    ("H6806", "H6805"), // צַעַד step from צָעַד, not "pipe"
    ("H0889", "H0887"), // בְּאֹשׁ stench from בָּאַשׁ, not "cistern"
    ("H4295", "H5186"), // מַטָּה beneath from נָטָה, not "to blind"
    ("H4165", "H3332"), // מוּצָק casting from יָצַק, not "ring"
    ("H0232", "H0247"), // אֵזוֹר girdle from אָזַר, not "chains"
    ("H0650", "H0662"), // אָפִיק channel from אָפַק, not "to gather"
    ("H3547", "H3548"), // כָּהַן "used only as denominative from" כֹּהֵן
];
const NO_PARENT_H: [&str; 44] = [
    "H1992", // הֵם they: "from H1981" is a typo, and the print edition's הוּא is a paradigm
    "H4712", // מֵצַר: the right number is split into homonyms
    "H4480", // מִן from is not from מֵן string
    "H5971", "H5973", "H5980", // עַם, עִם, עֻמָּה are not from עָמַם darken
    "H5892", // עִיר city is not from עוּר rouse
    "H3713", "H3715", "H3723", // bowl, lion, village are not from כָּפַר atone
    "H3701", // כֶּסֶף silver is not from כָּסַף long
    "H6716", // צִי ship is a loanword
    "H6155", // willow is not from עָרַב pledge
    "H6256", // עֵת time is not from עַד
    "H0259", // אֶחָד one: אָחַד comes from it
    "H0582", // אֱנוֹשׁ is not from אָנַשׁ be incurable
    "H0410", // אֵל God is not from אַיִל ram
    "H0068", // אֶבֶן stone is not from בָּנָה build
    "H8147", // שְׁנַיִם two is not from שֵׁנִי second
    "H8336", // שֵׁשׁ linen and שַׁיִשׁ alabaster point at each other
    "H3548", // כֹּהֵן priest: כָּהַן comes from it
    "H2344", "H6697", "H6735", "H6864", // sand, rock, envoy, flint are not from חוּל whirl and צוּר confine
    "H2770", "H2779", "H5750", "H7454", // sickle, autumn, עוֹד still, thought: Strong's chose the wrong homonym
    "H6499", "H6510", "H8574", "H1257", // bull and heifer from "breaking", oven from "lamp", fowl from "grain"
    "H3599", // כִּיס purse is not a form of כּוֹס cup
    "H0168", "H6310", "H7794", // tent, mouth, ox are not from "shine", "cleave", "travel"
    "H3678", "H5785", "H2220", // throne (a loanword), skin, arm are not from "cover", "be bare", "sow"
    "H5601", // סַפִּיר sapphire is a loanword, not from "to count"
    "H3915", "H3222", // night is not "a twist", nor hot springs from day's "to be hot"
    "H3202", // יְכִל is the Aramaic of יָכֹל (Strong's leaves out "corresponding")
];
/// Senses that stay out of every family: names filed as common words, and
/// homonyms of a word whose derivation is about the other (henna and village
/// are not "ransom" from כָּפַר).
const NO_FAMILY: [&str; 17] =
    ["H3724C", "H3724D", "H3723G", "H4428I", "H4428J", "H4428L", "H1516K", "H1516P", "H6010J", "H4629G", "H6828H", "H7704A", "H6154A", "H5697B", "H1575", "H5522", "H6713"];
/// Senses STEPBible files under a number that are other words, with other
/// roots (קֹל frivolity under קוֹל voice, עוּן dwell under עָנָה answer): not
/// siblings of the number's words, and not given its parent.
const SPLIT: [&str; 19] = [
    "H6963B", "H6030A", "H7311B", "H3559B", "H2491B", "H6869A", "H2342B", "H6211B", "H5606B", "H2529B", "H1933A", "H6979B", "H6979C", "H5132A", "H3856B", "H2256B", "H2256D", "H7771B", "H2131B",
];
/// Which of a split parent's words a child comes from, where the numbers alone
/// can't tell (שָׁלוֹם from שָׁלֵם "to complete", not "to repay").
const CHILD_SENSE: [(&str, &str); 53] = [
    // The sword "from its destructive effect" (BDB: "to slay" is made from the sword).
    ("H2719", "H2717B"),
    ("H7965", "H7999A"),
    ("H8416", "H1984B"),
    ("H6607", "H6605A"),
    ("H7451", "H7489A"),
    ("H4557", "H5608A"),
    ("H5612", "H5608A"),
    ("H8451", "H3384B"),
    ("H1616", "H1481A"),
    ("H2617", "H2616A"),
    ("H7453", "H7462C"),
    ("H8145", "H8138B"),
    ("H1947", "H1984C"), // madness from "to be foolish", not "to praise"
    ("H1948", "H1984C"),
    ("H2096", "H2094A"), // brightness from "to shine", not "to warn"
    ("H2428", "H2342B"), // strength from "be firm", not "to whirl"
    ("H2471", "H2490A"), // bun, flute, slain, hole from "to bore", not "to profane"
    ("H2485", "H2490A"),
    ("H2491", "H2490A"),
    ("H4247", "H2490A"),
    ("H3295", "H3293B"),
    ("H3894", "H3898B"), // food from "to eat", not "to fight"
    ("H4239", "H4229B"),
    ("H5257", "H5258B"), // prince from "to install", not "to pour"
    ("H5402", "H5401B"), // weapon from "to handle", not "to kiss"
    ("H6045", "H6031A"),
    ("H6603", "H6605B"), // engraving from "to engrave", not "to open"
    ("H7463", "H7462C"),
    ("H2506", "H2505A"), // portion and division from "to divide"
    ("H4256", "H2505A"),
    ("H2513", "H2505A"),
    ("H7105", "H7114B"), // harvest from "to reap", not "be short"
    ("H6869", "H6862B"),
    ("H5038", "H5034B"),
    ("H5703", "H5710A"),
    ("H4611", "H5953A"),
    ("H4405", "H4448A"),
    ("H2758", "H2790A"), // plowing and craftsman from "to plow", deaf from "be quiet"
    ("H2796", "H2790A"),
    ("H2799", "H2790A"),
    ("H4281", "H2790A"),
    ("H4282", "H2790A"),
    ("H2795", "H2790B"),
    ("H2623", "H2616A"),
    ("H4932", "H8138B"),
    ("H5521", "H5526B"), // booth and covering from "to cover"
    ("H4539", "H5526B"),
    ("H5104", "H5102A"), // river from "to flow"
    ("H8003", "H7999A"),
    ("H8002", "H7999A"),
    ("H7998", "H7997B"),
    ("H5771", "H5753B"), // iniquity from "to pervert"
    ("H2483", "H2470H"),
];
/// Hebrew and Aramaic words that STEPBible pairs as one word and Strong's does
/// not tie by number, checked by hand: the true cognates. Other unbacked pairs
/// are words used in the same role (עֲבַד and עָשָׂה), not the same word.
const TWINS: [(&str, &str); 62] = [
    ("H0153", "H2220"),
    ("H0310", "H0318"),
    ("H0312", "H0317"),
    ("H0312", "H0321"),
    ("H0411", "H0459"),
    ("H0411", "H0479"),
    ("H0576", "H0595"),
    ("H0586", "H5168"),
    ("H0608", "H0859"),
    ("H0802", "H5389"),
    ("H0873", "H0887"),
    ("H0924", "H0926"),
    ("H1158", "H1159"),
    ("H1397", "H1400"),
    ("H1397", "H1401"),
    ("H1399", "H1401"),
    ("H1791", "H2088"),
    ("H1797", "H2088"),
    ("H1836", "H2088"),
    ("H1921", "H1923"),
    ("H1946", "H1980"),
    ("H2269", "H2270"),
    ("H2270", "H2273"),
    ("H2376", "H2377"),
    ("H2377", "H2379"),
    ("H2399", "H2408"),
    ("H2416", "H2417"),
    ("H2416", "H2423"),
    ("H2418", "H2425"),
    ("H2472", "H2493"),
    ("H2506", "H2508"),
    ("H2816", "H4285"),
    ("H2868", "H3190"),
    ("H2940", "H2942"),
    ("H3004", "H3007"),
    ("H3346", "H3350"),
    ("H3676", "H3764"),
    ("H4056", "H4196"),
    ("H4484", "H4488"),
    ("H4776", "H4777"),
    ("H5094", "H5102"),
    ("H5103", "H5104"),
    ("H5452", "H7663"),
    ("H5608", "H5613"),
    ("H5609", "H5612"),
    ("H5649", "H5650"),
    ("H5656", "H5673"),
    ("H5921", "H5924"),
    ("H6133", "H6136"),
    ("H6211", "H6212"),
    ("H6591", "H6623"),
    ("H7212", "H7299"),
    ("H7227", "H7260"),
    ("H7227", "H7261"),
    ("H7264", "H7266"),
    ("H7312", "H7314"),
    ("H7595", "H7596"),
    ("H7922", "H7924"),
    ("H7970", "H8533"),
    ("H7992", "H8523"),
    ("H7992", "H8531"),
    ("H8213", "H8215"),
];
/// Pairs TBESH files as twins whose Strong's lines tie them only by a guess
/// (שְׁמַשׁ "to serve" is not the Aramaic of שֶׁמֶשׁ sun, nor שְׁכַח "find" of שָׁכַח "forget").
const NOT_TWINS: [(&str, &str); 6] = [("H8121", "H8120"), ("H7911", "H7912"), ("H8199", "H8614"), ("H7364", "H7365"), ("H6760", "H6739"), ("H5362", "H5368")];
/// More twins from the hand check (kept apart only to keep lines short).
const TWINS_MORE: [(&str, &str); 4] = [("H8255", "H8625"), ("H8271", "H8281"), ("H0776", "H0778"), ("H3201", "H3202")];

/// What one Strong's derivation line says about its word.
#[derive(Debug, PartialEq)]
pub enum Link {
    /// It comes from this word. `form_of`: it is a feminine, masculine, plural
    /// or dual of it. `plain`: the line says nothing but "from X".
    Parent { of: String, form_of: bool, plain: bool },
    /// It shares a root with this word ("from the same as X").
    Same(String),
    /// A Greek compound of a prefix and this word.
    Head(String),
    /// Another form of this word, used for it in some tenses (ὀπτάνομαι of ὁράω).
    Alt(String),
}

/// The derivation links of both Strong's dictionaries, by Strong's number.
#[derive(Default)]
pub struct Derivations {
    pub parent: HashMap<String, String>,
    pub head: HashMap<String, String>,
    pub same: Vec<(String, String)>,
    pub alt: Vec<(String, String)>,
    pub form_of: HashSet<String>,
    pub plain: HashSet<String>,
    /// Greek words "from the base of" their parent: siblings when the parent
    /// is not itself a verb (βῆμα and βάσις both come from βαίνω).
    pub base_of: HashSet<String>,
    /// The Hebrew numbers each Hebrew line mentions, to back Aramaic twins.
    pub cites: HashMap<String, Vec<String>>,
    /// Strong's own entry for each number, as `strongs_line` reads it.
    pub strongs: HashMap<String, String>,
    /// Numbers whose parent or prefix head comes from the hand lists, which
    /// correct a slip in Strong's number (`REMAP_G`, `REMAP_H`, `HEAD_REMAP_G`).
    pub remapped: HashSet<String>,
    /// Numbers whose derivation the hand lists leave out (`NO_PARENT_G`, `NO_PARENT_H`).
    pub dropped: HashSet<String>,
}

impl Derivations {
    /// Strong's own entry for a root ("H7225G" reads H7225's), if he has one.
    pub fn strongs(&self, key: &str) -> Option<&str> {
        self.strongs.get(number(key)).map(String::as_str)
    }
}

/// The JSON edition's notes on spellings its editors corrected, as
/// "lemma אי missing vowel, corrected to אִי" or "xlit baqbûk corrected to
/// baqbuq", which sit inside Strong's text. The corrected form is already in
/// the text (or, for a transliteration, not shown), so the note goes.
fn without_notes(s: &str) -> String {
    let mut s = s.to_string();
    while let Some(note) = next_note(&s) {
        s.replace_range(note, " ");
    }
    s
}

/// Where the first such note is.
fn next_note(s: &str) -> Option<std::ops::Range<usize>> {
    for (at, _) in s.match_indices(['l', 'x']) {
        let rest = &s[at..];
        if !(rest.starts_with("lemma ") || rest.starts_with("xlit ")) {
            continue;
        }
        let Some(c) = rest.find("corrected to ").filter(|&c| c < 120 && !rest[..c].contains(';')) else {
            continue;
        };
        let after = at + c + "corrected to ".len();
        // The corrected form: as much of what follows as the text just before
        // the note already reads, else the next word.
        let before = &s[..at];
        let tail = &s[after..];
        let mut take = tail.char_indices().map(|(i, ch)| i + ch.len_utf8()).rfind(|&k| before.ends_with(&tail[..k])).unwrap_or(0);
        if take == 0 {
            take = tail.find(|ch: char| ch.is_whitespace() || matches!(ch, ';' | ')' | ',')).unwrap_or(tail.len());
            for stop in ["xlit", "lemma"] {
                if let Some(k) = tail[..take].find(stop) {
                    take = k;
                }
            }
        }
        return Some(at..after + take);
    }
    None
}

/// Strong's entry in his own words: the derivation, then the definition,
/// without the King James renderings that follow them. Definitions in braces
/// are left out: the JSON edition's editors supplied them where Strong gave
/// none (most repeat the definition of the Hebrew word an Aramaic word
/// corresponds to). So are their notes on corrected spellings.
pub fn strongs_line(der: &str, def: &str) -> String {
    let mut der = without_notes(der);
    let mut def = without_notes(def);
    // Braces the edition opens inside the derivation and closes in the
    // definition (H3969 מְאָה, given H3967's "properly, a primitive numeral; a
    // hundred ..."): Strong's own words end with the derivation's first clause.
    if let Some(b) = def.find('}').filter(|&b| !def[..b].contains('{')) {
        def.replace_range(..=b, " ");
        if let Some(c) = der.find(';') {
            der.truncate(c + 1);
        }
    }
    while let (Some(a), Some(b)) = (def.find('{'), def.find('}')) {
        if b < a {
            break;
        }
        def.replace_range(a..=b, " ");
    }
    let tidy = |s: &str| s.split_whitespace().collect::<Vec<_>>().join(" ").replace(" ;", ";").replace(" ,", ",").replace(" )", ")").replace(";;", ";");
    let der = tidy(&der);
    let def = tidy(&def);
    let end = |s: &str| s.trim().trim_end_matches([';', ':', ',']).trim().to_string();
    let line = match (der.is_empty(), def.is_empty()) {
        (true, _) => def,
        (false, true) => der,
        (false, false) if der.ends_with([';', ',', ':']) => format!("{der} {def}"),
        (false, false) => format!("{der}; {def}"),
    };
    end(&line)
}

pub fn derivations(path: &Path, lang: char, d: &mut Derivations) -> Result<usize, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let start = text.find("Dictionary = ").map(|i| i + "Dictionary = ".len()).ok_or_else(|| format!("{}: no dictionary object", path.display()))?;
    let end = text.rfind('}').ok_or_else(|| format!("{}: unterminated dictionary", path.display()))?;
    let dict: BTreeMap<String, Value> = serde_json::from_str(&text[start..=end]).map_err(|e| format!("parsing {}: {e}", path.display()))?;
    let known: HashSet<String> = dict.keys().filter_map(|k| k.strip_prefix(lang).map(|n| base(lang, n))).collect();
    // Verbs whose line says they are "used only as denominative" from a noun.
    let mut denominative: HashSet<String> = HashSet::new();
    // ... and the noun, however the rest of the line hedges (עָשַׂר tithe from עֶשֶׂר ten).
    let mut made_from: Vec<(String, String)> = Vec::new();
    let mut parents: HashMap<String, String> = HashMap::new();
    for (k, e) in &dict {
        let Some(n) = k.strip_prefix(lang) else {
            continue;
        };
        let me = base(lang, n);
        let der = e["derivation"].as_str().unwrap_or("");
        let def = e["strongs_def"].as_str().unwrap_or("");
        let line = strongs_line(der, def);
        if !line.is_empty() {
            d.strongs.insert(me.clone(), line);
        }
        let lower = der.to_ascii_lowercase();
        if ["only as denominative", "only as a denominative", "used as denominative", "used as a denominative"].iter().any(|p| lower.contains(p)) {
            denominative.insert(me.clone());
        }
        // Not when the note is an aside about one sense: שָׁעַר "(literally, but only as denominative from H8179)".
        let bare = strip_parens(der);
        if let Some(i) = ["only as denominative", "only as a denominative"].iter().filter_map(|p| bare.to_ascii_lowercase().find(p)).min() {
            if let Some(x) = refs_in(&bare[i..], lang).into_iter().find(|x| *x != me && known.contains(x)) {
                made_from.push((me.clone(), x));
            }
        }
        if lang == 'H' {
            d.cites.insert(me.clone(), refs_in(der, 'H'));
        }
        match classify(lang, &me, der, def, &known) {
            Some(Link::Parent { of, form_of, plain }) => {
                if form_of {
                    d.form_of.insert(me.clone());
                }
                if plain {
                    d.plain.insert(me.clone());
                }
                if lang == 'G' && numbers_after(&strip_parens(der).to_ascii_lowercase(), "base of ", 'G').contains(&of) {
                    d.base_of.insert(me.clone());
                }
                parents.insert(me, of);
            }
            Some(Link::Same(x)) => d.same.push((me, x)),
            Some(Link::Head(x)) => {
                d.head.insert(me, x);
            }
            Some(Link::Alt(x)) => d.alt.push((me, x)),
            None => {}
        }
    }
    // "A primitive root; also as denominative from X": the noun's own "from
    // <verb>" would make each the other's parent, so both only share a root.
    let shared: HashSet<(String, String)> = d.same.iter().filter(|(a, _)| a.starts_with(lang)).cloned().collect();
    parents.retain(|c, p| !shared.contains(&(p.clone(), c.clone())));
    for (verb, noun) in made_from {
        if parents.get(&noun) == Some(&verb) {
            parents.remove(&noun);
        }
        parents.insert(verb, noun);
    }
    // Other two-way loops: a verb "used only as denominative" keeps its noun as
    // parent; any other pair says nothing reliable about direction.
    let cycles: Vec<(String, String)> = parents.iter().filter(|(c, p)| parents.get(*p) == Some(*c) && c < p).map(|(c, p)| (c.clone(), p.clone())).collect();
    for (a, b) in cycles {
        let (keep_a, keep_b) = (denominative.contains(&a) && !denominative.contains(&b), denominative.contains(&b) && !denominative.contains(&a));
        if !keep_a {
            parents.remove(&a);
        }
        if !keep_b {
            parents.remove(&b);
        }
    }
    d.parent.extend(parents);
    if lang == 'G' {
        for (from, to) in ALIAS_G {
            for v in d.parent.values_mut().chain(d.head.values_mut()).chain(d.same.iter_mut().map(|x| &mut x.1)) {
                if v == from {
                    *v = to.to_string();
                }
            }
        }
        for (from, to) in REMAP_G {
            d.parent.insert(from.to_string(), to.to_string());
            d.plain.remove(from);
            d.base_of.remove(from);
            d.remapped.insert(from.to_string());
        }
        for (from, to) in HEAD_REMAP_G {
            d.head.insert(from.to_string(), to.to_string());
            d.remapped.insert(from.to_string());
        }
        for w in NO_PARENT_G {
            unlink(d, w);
            d.dropped.insert(w.to_string());
        }
    } else {
        // A typo'd number keeps the line's plainness, so a feminine of the
        // word still reaches the right grandparent (צְעָדָה through צַעַד).
        for (from, to) in REMAP_H {
            d.parent.insert(from.to_string(), to.to_string());
            d.remapped.insert(from.to_string());
        }
        for w in NO_PARENT_H {
            unlink(d, w);
            d.dropped.insert(w.to_string());
        }
    }
    Ok(dict.len())
}

/// A word with no parent, prefix head or shared root.
fn unlink(d: &mut Derivations, w: &str) {
    d.parent.remove(w);
    d.head.remove(w);
    d.same.retain(|(a, _)| a != w);
    d.base_of.remove(w);
}

/// Read one derivation line. `def` is the definition, where the Greek JSON
/// sometimes carries the rest of a compound (" and G3739 (ὅς)...").
pub fn classify(lang: char, me: &str, der: &str, def: &str, known: &HashSet<String>) -> Option<Link> {
    // The definition continues the line's last clause: κάθημαι is "from G2596
    // (κατά);" + " and (to sit; ...", a compound of two words.
    let mut text = der.trim_end().trim_end_matches(';').to_string();
    if lang == 'G' && def.starts_with(char::is_whitespace) && def.trim_start().starts_with("and ") {
        text.push(' ');
        text.push_str(def.split(';').next().unwrap_or(""));
    }
    // Text after a contrast is about another word: μή "(whereas G3756 (οὐ) ...)".
    let lower = text.to_ascii_lowercase();
    let cut = ["whereas", "in distinction from", "but not so"].iter().filter_map(|p| lower.find(p)).min().unwrap_or(lower.len());
    let text = &text[..cut];
    let lower = &lower[..cut];
    if lower.split(|c: char| !c.is_ascii_alphabetic()).any(|w| GUESSES.contains(&w)) || lower.contains("through the idea") {
        return None;
    }
    // "A presumed derivative" is the Greek formula for a plain one; in Hebrew it is a guess (אוֹ or from "desire").
    if lang == 'H' && lower.contains("presumed") {
        return None;
    }
    // A sense the reader can't see links words that look unrelated (gate from "to calculate").
    const SENSES: [&str; 8] = ["sense of", "original sense", "original meaning", "through the meaning", "second. sense", "secondary sense", "primary sense", "denominative sense"];
    if lang == 'H' && SENSES.iter().any(|p| lower.contains(p)) {
        return None;
    }
    if lang == 'G' && lower.contains("derivative") && lower.contains("(meaning") {
        return None;
    }
    // A collateral form is a neighbouring word, not this one's source (חֹרֶב drought, חֶרֶב sword).
    if lang == 'H' && lower.contains("collateral") {
        return None;
    }
    // Numbers inside brackets are quotations and asides, not the derivation;
    // nor is a cross-reference ("see H4940").
    let bare = drop_see(&strip_parens(text), lang);
    let ls = bare.to_ascii_lowercase();
    let flat = ls.split_whitespace().collect::<Vec<_>>().join(" ");
    let primitive = lower.contains("primitive") || (lower.contains("primary") && !lower.contains("primary sense"));
    // "A primitive root; also as denominative from X" is about one sense only.
    let also_denominative = primitive && lower.find("denominativ").is_some_and(|i| ["also", "by implication", "rather"].iter().any(|p| lower[..i].contains(p)));
    // Another word that stands in for this one in some tenses: ὀπτάνομαι
    // "as alternate of G3708 (ὁράω)", φάγω "(used as an alternate of G2068)".
    // "From the alternate of" is a plain derivation and falls through.
    if lang == 'G' {
        let alt: Vec<String> = ["as alternate of ", "as an alternate of "].iter().flat_map(|p| numbers_after(lower, p, 'G')).filter(|r| r != me && known.contains(r)).collect();
        if let [x] = alt.as_slice() {
            return Some(Link::Alt(x.clone()));
        }
    }
    if primitive && !(lower.contains("denominativ") || flat.contains("corresponding to")) {
        return None;
    }
    // A comparison, not a derivation: מִי "as H4100 (מָה) is of things", "formed like H6842".
    if lang == 'H' && (["formed like ", "similar to ", "like "].iter().any(|p| follows_number(&flat, p, 'h')) || as_is(&flat)) {
        return None;
    }
    if lang == 'G' {
        if let Some(link) = head_compound(&ls, known) {
            return Some(link);
        }
    }
    let refs: Vec<String> = refs_in(&bare, lang).into_iter().filter(|r| r != me && known.contains(r)).collect();
    if refs.len() != 1 || (lang == 'G' && refs[0] == "G0001") {
        return None;
    }
    let x = refs[0].clone();
    if also_denominative {
        return Some(Link::Same(x));
    }
    // A compound whose other part has no number: "from G575 (ἀπό) and (to slay)".
    let clause = ls.split(';').find(|c| refs_in(&c.to_uppercase(), lang).contains(&x)).unwrap_or(&ls);
    if !clause.contains("and mean") {
        let words: Vec<&str> = clause.split(|c: char| !c.is_ascii_alphanumeric()).filter(|w| !w.is_empty()).collect();
        let from = words.iter().position(|w| *w == "from").or_else(|| words.windows(2).position(|p| p[1] == "of" && (p[0] == "compound" || p[0] == "comparative")));
        if from.is_some_and(|f| words[f..].contains(&"and")) {
            return None;
        }
    }
    if flat.contains("corresponding to") {
        // The same word in the other language is linked from TBESH; only a
        // shared root is said here.
        if ["root corresponding to", "a form corresponding to", "masculine corresponding to"].iter().any(|p| flat.contains(p)) {
            return Some(Link::Same(x));
        }
        return None;
    }
    // "Identical (in origin and formation) with", or "but really" another word.
    if lower.contains("identical with") || flat.contains("identical with") || lower.contains("but really") {
        return None;
    }
    if ["the same as", "same root as", "same base as", "same form as"].iter().any(|p| lower.contains(p)) {
        return Some(Link::Same(x));
    }
    // Another spelling or by-form: one word, with no direction between them.
    if lang == 'H' && by_form(&flat) {
        return Some(Link::Same(x));
    }
    let form_of = ["feminine of", "masculine of", "plural of", "dual of"].iter().any(|p| lower.contains(p))
        && !lower.contains("irregular")
        && !lower.contains("a form of")
        && !ls.contains(&format!(" for {}", lang.to_ascii_lowercase()));
    Some(Link::Parent { plain: is_plain(&quoted_words_out(lower), lang), of: x, form_of })
}

/// Text with every bracketed aside removed; an unclosed bracket runs to the
/// end of its clause.
fn strip_parens(s: &str) -> String {
    let mut out = String::new();
    let mut depth = 0usize;
    for c in s.chars() {
        match c {
            '(' => depth += 1,
            ')' if depth > 0 => depth -= 1,
            ';' if depth > 0 => {
                depth = 0;
                out.push(c);
            }
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out
}

/// Text without the numbers it only points the reader to: "see H4940".
fn drop_see(s: &str, lang: char) -> String {
    let lower = s.to_ascii_lowercase();
    let l = lang.to_ascii_lowercase();
    let mut out = String::new();
    let mut last = 0;
    for (i, _) in lower.match_indices("see ") {
        if i < last || (i > 0 && lower.as_bytes()[i - 1].is_ascii_alphabetic()) {
            continue;
        }
        let rest = &lower[i + 4..];
        let at = i + 4 + (rest.len() - rest.trim_start().len());
        let Some(num) = lower[at..].strip_prefix(l) else {
            continue;
        };
        let digits = num.bytes().take_while(u8::is_ascii_digit).count();
        if digits > 0 {
            out.push_str(&s[last..at]);
            last = at + 1 + digits;
        }
    }
    out.push_str(&s[last..]);
    out
}

/// Whether `phrase` (starting a word) comes right before a number: "like h2671".
fn follows_number(s: &str, phrase: &str, lang: char) -> bool {
    s.match_indices(phrase)
        .any(|(i, _)| (i == 0 || !s.as_bytes()[i - 1].is_ascii_alphabetic()) && s[i + phrase.len()..].strip_prefix(lang).is_some_and(|n| n.starts_with(|c: char| c.is_ascii_digit())))
}

/// "as h4100 is of things": a comparison with another word.
fn as_is(s: &str) -> bool {
    s.match_indices("as h").any(|(i, _)| {
        (i == 0 || !s.as_bytes()[i - 1].is_ascii_alphabetic()) && {
            let rest = &s[i + 4..];
            let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
            digits > 0 && rest[digits..].starts_with(" is ")
        }
    })
}

/// Hebrew lines that give another spelling or a by-form of a word: "for H2088",
/// "a variation of", "another form of", "a form of", "by transposition for".
fn by_form(flat: &str) -> bool {
    let mut t = flat.trim();
    while let Some(rest) = t.strip_prefix("or ") {
        match rest.find(';') {
            Some(i) => t = rest[i + 1..].trim(),
            None => break,
        }
    }
    follows_number(t, "for ", 'h') && t.starts_with("for ")
        || ["variation of", "variation for", "variation from", "another form", "a form of", "a form for", "transposition", "transmutation", "permutation"].iter().any(|p| t.contains(p))
}

/// The numbers right after each `phrase`: "base of g939" -> ["G0939"].
fn numbers_after(s: &str, phrase: &str, lang: char) -> Vec<String> {
    let l = lang.to_ascii_lowercase();
    s.match_indices(phrase)
        .filter_map(|(i, _)| {
            let n = s[i + phrase.len()..].strip_prefix(l)?;
            let digits = n.bytes().take_while(u8::is_ascii_digit).count();
            (digits > 0).then(|| base(lang, n[..digits].trim_start_matches('0')))
        })
        .collect()
}

/// Text without the bracketed words a number quotes ("G25 (ἀγαπάω)"), but
/// with every bracketed aside in English.
fn quoted_words_out(s: &str) -> String {
    let mut out = String::new();
    let mut rest = s;
    while let Some(i) = rest.find('(') {
        let Some(j) = rest[i..].find(')') else { break };
        let inner = &rest[i + 1..i + j];
        out.push_str(&rest[..i]);
        if inner.chars().any(|c| c.is_ascii_alphabetic()) {
            out.push_str(&rest[i..=i + j]);
        }
        rest = &rest[i + j + 1..];
    }
    out.push_str(rest);
    out
}

/// "from H157;" and nothing else, perhaps after other spellings ("or X;").
fn is_plain(ls: &str, lang: char) -> bool {
    let mut t = ls.trim();
    while let Some(rest) = t.strip_prefix("or ") {
        match rest.find(';') {
            Some(i) => t = rest[i + 1..].trim(),
            None => return false,
        }
    }
    let Some(rest) = t.strip_prefix("from ") else {
        return false;
    };
    let rest = rest.trim_start();
    let Some(num) = rest.strip_prefix(lang.to_ascii_lowercase()) else {
        return false;
    };
    let digits = num.find(|c: char| !c.is_ascii_digit()).unwrap_or(num.len());
    digits > 0 && matches!(num[digits..].trim(), "" | ";")
}

/// "from [a compound of] G<prefix> and [a derivative of | the base of] G<x>",
/// a Greek word built on a prefix: linked to the word it is built on.
fn head_compound(ls: &str, known: &HashSet<String>) -> Option<Link> {
    let t = ls.split_whitespace().collect::<Vec<_>>().join(" ");
    let t = t.trim_end_matches(';').trim_end();
    let t = t.strip_prefix("middle voice ").or_else(|| t.strip_prefix("passive voice ")).unwrap_or(t);
    let t = t.strip_prefix("from ")?;
    let t = t.strip_prefix("a compound of ").unwrap_or(t);
    let (p, rest) = t.split_once(' ')?;
    let rest = rest.strip_prefix("and ")?;
    let (shared, rest) = match rest.strip_prefix("the base of ") {
        Some(r) => (true, r),
        None => (false, rest.strip_prefix("a derivative of ").or_else(|| rest.strip_prefix("a presumed derivative of ")).unwrap_or(rest)),
    };
    let num = |s: &str| -> Option<String> { s.strip_prefix('g').filter(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit())).map(|n| base('G', n.trim_start_matches('0'))) };
    let (p, x) = (num(p)?, num(rest.trim())?);
    if !PREFIXES.contains(&p.as_str()) || !known.contains(&p) || !known.contains(&x) {
        return None;
    }
    Some(if shared { Link::Same(x) } else { Link::Head(x) })
}

/// Distinct Strong's numbers of one language mentioned in a derivation line.
fn refs_in(s: &str, lang: char) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let cs: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < cs.len() {
        if cs[i] == lang && (i == 0 || !cs[i - 1].is_alphanumeric()) {
            let mut j = i + 1;
            while j < cs.len() && cs[j].is_ascii_digit() {
                j += 1;
            }
            if j > i + 1 && (j == cs.len() || !cs[j].is_alphanumeric()) {
                let r = base(lang, cs[i + 1..j].iter().collect::<String>().trim_start_matches('0'));
                if !out.contains(&r) {
                    out.push(r);
                }
            }
            i = j;
        } else {
            i += 1;
        }
    }
    out
}

pub struct Root<'a> {
    pub key: &'a str,
    pub count: u32,
    /// A name (a person, place or title): no family, and in none.
    pub name: bool,
    /// The lexicon headword and its word type, to tell homonyms apart.
    pub word: &'a str,
    pub morph: &'a str,
    pub gloss: &'a str,
    /// TBESH/TBESG entry, relation and target (see parse::LexEntry).
    pub estrong: &'a str,
    pub relation: &'a str,
    pub target: &'a str,
}

/// Most relatives (dictionary words, not senses) listed for one word.
const MAX_FAMILY: usize = 32;
/// A sense split off a Strong's number that holds no more than this share of
/// its uses is a homonym that Strong's derivations are not about (מָלַךְ "to
/// advise" beside מָלַךְ "to reign").
const MINOR: f64 = 0.02;
/// The share of a number's uses its main word needs for a derivation to be
/// read as about it when look-alike words share the number.
const CLEAR: f64 = 0.9;

/// A sense that is part of a name: "Valley (of Achor)", "(Huram)-abi", "Ir-".
fn name_piece(gloss: &str) -> bool {
    let b = gloss.as_bytes();
    gloss.contains("-(")
        || gloss.ends_with('-')
        || gloss.match_indices('(').any(|(i, _)| {
            (i == 0 || b[i - 1] == b' ') && {
                let rest = &gloss[i + 1..];
                rest.starts_with(|c: char| c.is_ascii_uppercase()) || rest.starts_with("of ") || rest.starts_with("Of ") || rest.starts_with("the ")
            }
        })
}

/// The letters of a headword, to tell homonyms (same letters, same word type)
/// from different words filed under one number.
fn letters(word: &str) -> String {
    word.chars().filter(|c| matches!(c, '\u{05D0}'..='\u{05EA}') || (c.is_alphabetic() && !matches!(c, '\u{0591}'..='\u{05C7}'))).collect()
}

/// A headword's consonants as a look-alike would share them: Hebrew without
/// vowel letters after the first (עִיר, עִר) and with final letters plain.
fn skeleton(word: &str) -> String {
    let l = letters(word);
    if !l.starts_with(|c: char| matches!(c, '\u{05D0}'..='\u{05EA}')) {
        return l;
    }
    l.chars()
        .enumerate()
        .filter(|&(i, c)| i == 0 || !matches!(c, 'ו' | 'י'))
        .map(|(_, c)| match c {
            'ך' => 'כ',
            'ם' => 'מ',
            'ן' => 'נ',
            'ף' => 'פ',
            'ץ' => 'צ',
            c => c,
        })
        .collect()
}

/// The word class of a lexicon morph: "H:N-M" -> "H:N".
fn class(morph: &str) -> &str {
    morph.split('-').next().unwrap_or("")
}

/// A root's forms in posting order: (grammar, uses, spellings without an
/// ending, spellings with one).
type FormGroup = (String, u32, HashMap<String, u32>, HashMap<String, u32>);

fn most_used(m: &HashMap<String, u32>, ok: impl Fn(&str) -> bool) -> Option<&str> {
    m.iter().filter(|x| ok(x.0)).max_by(|a, b| a.1.cmp(b.1).then(b.0.cmp(a.0))).map(|x| x.0.as_str())
}

/// Hebrew points that are vowels (sheva through qamats qatan).
fn vowel(c: char) -> bool {
    matches!(c, '\u{05B0}'..='\u{05BB}' | '\u{05C7}')
}

/// Whether a Hebrew spelling's first letter has its vowel: a point, a shureq
/// (וּ), or a holem or shureq on a following vav (יוֹם, רוּחַ). A prefix can
/// take the first letter's vowel (לֵאמֹר, וִידַעְתֶּם), leaving אמֹר.
fn first_vowel(s: &str) -> bool {
    let cs: Vec<char> = s.chars().collect();
    let letter = |c: &char| matches!(c, '\u{05D0}'..='\u{05EA}');
    let Some(first) = cs.iter().position(letter) else {
        return true;
    };
    let next = cs[first + 1..].iter().position(letter).map_or(cs.len(), |i| first + 1 + i);
    let marks = &cs[first + 1..next];
    if marks.iter().any(|&c| vowel(c)) || (cs[first] == 'ו' && marks.contains(&'\u{05BC}')) {
        return true;
    }
    let after = cs.get(next + 1..).unwrap_or(&[]);
    let after = &after[..after.iter().position(letter).unwrap_or(after.len())];
    cs.get(next) == Some(&'ו') && !after.is_empty() && after.iter().all(|&c| matches!(c, '\u{05B9}' | '\u{05BA}' | '\u{05BC}'))
}

/// A Hebrew spelling whose prefix took its first vowel, with it restored: a
/// yod takes a sheva (יְדַעְתֶּם); a guttural of a noun takes the headword's
/// (אֱדַיִן). Other letters are left as they are.
fn restore_vowel(s: &str, code: &str, headword: &str) -> String {
    if first_vowel(s) {
        return s.to_string();
    }
    let mut cs = s.chars();
    let Some(first) = cs.next() else {
        return s.to_string();
    };
    let rest: String = cs.collect();
    if first == 'י' {
        return format!("{first}\u{05B0}{rest}");
    }
    let verb = code.get(1..2) == Some("V");
    if matches!(first, 'א' | 'ה' | 'ח' | 'ע') && !verb {
        let hw: Vec<char> = headword.chars().collect();
        if hw.first() == Some(&first) {
            let marks: String = hw[1..].iter().take_while(|c| !matches!(c, '\u{05D0}'..='\u{05EA}')).filter(|&&c| vowel(c)).collect();
            if !marks.is_empty() {
                return format!("{first}{marks}{rest}");
            }
        }
    }
    s.to_string()
}

/// A Greek letter without its accents and breathings, lower case.
fn greek_base(c: char) -> char {
    match c as u32 {
        0x1F00..=0x1F0F | 0x1F70 | 0x1F71 | 0x1F80..=0x1F8F | 0x1FB0..=0x1FBC | 0x0386 | 0x03AC => 'α',
        0x1F10..=0x1F1D | 0x1F72 | 0x1F73 | 0x1FC8 | 0x1FC9 | 0x0388 | 0x03AD => 'ε',
        0x1F20..=0x1F2F | 0x1F74 | 0x1F75 | 0x1F90..=0x1F9F | 0x1FC2..=0x1FC7 | 0x1FCA..=0x1FCC | 0x0389 | 0x03AE => 'η',
        0x1F30..=0x1F3F | 0x1F76 | 0x1F77 | 0x1FD0..=0x1FDB | 0x038A | 0x03AF | 0x0390 | 0x03CA => 'ι',
        0x1F40..=0x1F4D | 0x1F78 | 0x1F79 | 0x1FF8 | 0x1FF9 | 0x038C | 0x03CC => 'ο',
        0x1F50..=0x1F5F | 0x1F7A | 0x1F7B | 0x1FE0..=0x1FE3 | 0x1FE6..=0x1FEB | 0x038E | 0x03CD | 0x03B0 | 0x03CB => 'υ',
        0x1F60..=0x1F6F | 0x1F7C | 0x1F7D | 0x1FA0..=0x1FAF | 0x1FF2..=0x1FF7 | 0x1FFA..=0x1FFC | 0x038F | 0x03CE => 'ω',
        0x1FE4 | 0x1FE5 | 0x1FEC => 'ρ',
        _ => c.to_lowercase().next().unwrap_or(c),
    }
}

/// What tells two spellings of one form apart for the reader: Hebrew
/// consonants, Greek letters (accents and breathings aside).
/// Whether a name's spelling is a piece of its main one rather than another
/// way of writing it: the other half of a name written as two words (Hebrew:
/// two letters or more cut off one end; Greek: another first letter).
fn name_half(k: &str, main: &str) -> bool {
    if main.chars().any(|c| matches!(c, '\u{05D0}'..='\u{05EA}')) {
        let (short, long) = if k.chars().count() < main.chars().count() { (k, main) } else { (main, k) };
        long.chars().count() >= short.chars().count() + 2 && (long.starts_with(short) || long.ends_with(short))
    } else {
        k.chars().next() != main.chars().next()
    }
}

/// A Hebrew or Aramaic grammar code for the form a lexicon headword takes.
fn dictionary_form(code: &str) -> bool {
    code.get(1..) == Some("Vqp3ms") || (matches!(code.get(1..2), Some("N" | "A")) && code.ends_with("sa")) || matches!(code.get(1..2), Some("R" | "D" | "T" | "C"))
}

/// A Hebrew spelling without accents or meteg, qamats qatan as qamats.
fn unaccented(s: &str) -> String {
    s.trim().chars().filter(|c| !matches!(c, '\u{0591}'..='\u{05AF}' | '\u{05BD}')).map(|c| if c == '\u{05C7}' { '\u{05B8}' } else { c }).collect()
}

/// A Hebrew infinitive construct whose stem begins with ה (Hiphil הַ, Niphal
/// הִ, Hithpael הִתְ, Hophal הָ), which a prefix can swallow.
fn lost_he(code: &str) -> bool {
    let c: Vec<char> = code.chars().collect();
    c.len() >= 5 && c[0] == 'H' && c[1] == 'V' && "hNtHrfzuv".contains(c[2]) && c[3] == 'c' && !c[4].is_ascii_digit()
}

/// Puts back the ה a prefix swallowed: Hiphil הַ (הָ before a full vowel,
/// as הָעִיר), Niphal הִ (הֵ before a guttural), others הִ (Hophal הָ).
fn with_he(s: &str, code: &str) -> String {
    let cs: Vec<char> = s.chars().collect();
    let Some(first) = cs.iter().position(|c| matches!(c, '\u{05D0}'..='\u{05EA}')) else { return s.to_string() };
    let marks: Vec<char> = cs[first + 1..].iter().take_while(|c| !matches!(c, '\u{05D0}'..='\u{05EA}')).copied().collect();
    let reduced = marks.iter().any(|&c| matches!(c, '\u{05B0}'..='\u{05B3}'));
    let vowel = match code.chars().nth(2) {
        Some('h') if reduced => '\u{05B7}',
        Some('h') | Some('H') => '\u{05B8}',
        Some('N') if "אהחער".contains(cs[first]) => '\u{05B5}',
        _ => '\u{05B4}',
    };
    format!("ה{vowel}{s}")
}

fn spelling_key(s: &str) -> String {
    if s.chars().any(|c| matches!(c, '\u{05D0}'..='\u{05EA}')) {
        s.chars().filter(|c| matches!(c, '\u{05D0}'..='\u{05EA}')).collect()
    } else {
        s.chars().filter(|c| c.is_alphabetic()).map(greek_base).collect()
    }
}

/// One `forms/<shard>.json` entry per root.
pub fn build(roots: &[Root], words: &[Vec<Word>], l_off: &[u32], l_verse: &[u32], l_pos: &[u16], d: &Derivations) -> Vec<Value> {
    let n = roots.len();
    for k in CHILD_SENSE.iter().map(|x| x.1).chain(NO_FAMILY).chain(SPLIT) {
        if !roots.iter().any(|r| r.key == k) {
            eprintln!("word families: warning: {k} is not a root");
        }
    }
    let families = Families::new(roots, d);
    (0..n)
        .map(|i| {
            // Forms, read from the postings themselves so "o" lines up with them.
            let uses: Vec<&crate::parse::Form> = (l_off[i] as usize..l_off[i + 1] as usize).map(|k| &words[l_verse[k] as usize][l_pos[k] as usize].form).collect();
            // The source tags a Hebrew numeral now as a noun, now as a number,
            // spelled alike: one code for the root, the one most of its uses have.
            let tagged = |p: &str| uses.iter().filter(|f| f.code.get(1..3) == Some(p)).count();
            let fold = if tagged("Ac") >= tagged("Nc") { ("Nc", "Ac") } else { ("Ac", "Nc") };
            // A number's gender shows in its spelling (אֶחָד, אַחַת; שָׁלֹשׁ, שְׁלֹשָׁה)
            // whatever the tag says (the source tags every אֶחָד feminine), where
            // it has both: not שְׁמֹנֶה, whose two genders both end in ה.
            let gender = |f: &crate::parse::Form| -> Option<char> {
                // (Hebrew only: Aramaic תְּלָת ends in a root ת.)
                let number = fold.1 == "Ac" && f.code.starts_with('H') && matches!(f.code.get(1..3), Some("Ac" | "Nc")) && f.code.get(4..5) == Some("s");
                let last = f.plain.chars().rev().find(|c| matches!(c, '\u{05D0}'..='\u{05EA}'))?;
                number.then_some(if last == 'ה' || last == 'ת' { 'f' } else { 'm' })
            };
            let by_spelling = uses.iter().filter_map(|f| gender(f)).collect::<HashSet<char>>().len() == 2;
            let code = |f: &crate::parse::Form| -> String {
                let c = match f.code.get(1..3) {
                    Some(p) if p == fold.0 => format!("{}{}{}", &f.code[..1], fold.1, &f.code[3..]),
                    _ => f.code.clone(),
                };
                match gender(f).filter(|_| by_spelling) {
                    Some(g) => format!("{}{g}{}", &c[..3], &c[4..]),
                    None => c,
                }
            };
            // A form never written without a pronoun ending is told apart by
            // its ending (אָחִיו, אָחִיךָ), so each row is spelled as its grammar says.
            let mut bare: HashSet<String> = HashSet::new();
            for f in &uses {
                if !f.code.is_empty() && !f.ending {
                    bare.insert(code(f));
                }
            }
            let mut g: Vec<FormGroup> = Vec::new();
            let mut posting: Vec<Option<usize>> = Vec::new();
            for f in &uses {
                if f.code.is_empty() {
                    posting.push(None);
                    continue;
                }
                let mut c = code(f);
                if !bare.contains(&c) && !f.suffix.is_empty() {
                    c = format!("{c}/{}", f.suffix);
                }
                let at = g.iter().position(|x| x.0 == c).unwrap_or_else(|| {
                    g.push((c, 0, HashMap::new(), HashMap::new()));
                    g.len() - 1
                });
                g[at].1 += 1;
                if f.ending {
                    *g[at].3.entry(f.full.clone()).or_default() += 1;
                } else {
                    *g[at].2.entry(f.plain.clone()).or_default() += 1;
                }
                posting.push(Some(at));
            }
            let mut order: Vec<usize> = (0..g.len()).collect();
            order.sort_by(|&x, &y| g[y].1.cmp(&g[x].1).then(g[x].0.cmp(&g[y].0)));
            let mut rank = vec![0i64; g.len()];
            for (k, &x) in order.iter().enumerate() {
                rank[x] = k as i64;
            }
            let forms: Vec<Value> = order
                .iter()
                .map(|&x| {
                    // The word on its own where it ever stands alone in this form,
                    // else with its ending (מִמֶּנּוּ, never the bare מִמֶּ), and with its
                    // first vowel where a prefix took it (אֱמֹר, not the אמֹר of לֵאמֹר).
                    let (code, uses, alone, with) = &g[x];
                    let m = if alone.is_empty() { with } else { alone };
                    // A Hiphil or Niphal infinitive after ל, ב or כ loses its ה to
                    // the prefix (לַמְרוֹת for לְהַמְרוֹת): spelled with it.
                    let he = lost_he(code);
                    let has_he = |s: &str| !he || letters(s).starts_with('ה');
                    // In the headword's own form (a noun's absolute singular, a
                    // particle, a verb's Qal perfect "he"), the headword's spelling
                    // where a tenth of the uses have it: כֹּל and אֵת, not the כָּל
                    // and אֶת joined to the next word that most uses have.
                    let headword = |s: &str| roots[i].key.starts_with('H') && dictionary_form(code) && roots[i].word.split(',').any(|w| unaccented(w) == unaccented(s));
                    let spelling = most_used(m, |s| headword(s) && m[s] * 10 >= *uses)
                        .or_else(|| most_used(m, |s| first_vowel(s) && has_he(s)))
                        .or_else(|| most_used(m, first_vowel))
                        .or_else(|| most_used(m, |_| true))
                        .unwrap_or("");
                    let spelling = if has_he(spelling) { spelling.to_string() } else { with_he(spelling, code) };
                    let spelling = restore_vowel(&spelling, code, roots[i].word);
                    // Other spellings a tenth of its uses have (οὐκ, οὐ, οὐχ), but
                    // not half of a name written as two words (אֵל of עֲשָׂהאֵל,
                    // Ἄρειον of Ἄρειος Πάγος).
                    let main = spelling_key(&spelling);
                    let mut keys = vec![main.clone()];
                    let mut others: Vec<(&String, &u32)> = m.iter().filter(|(s, c)| **c * 10 >= *uses && first_vowel(s) && has_he(s)).collect();
                    others.sort_by(|a, b| b.1.cmp(a.1).then(a.0.cmp(b.0)));
                    let mut also: Vec<&str> = Vec::new();
                    for (s, _) in others {
                        let k = spelling_key(s);
                        if !keys.contains(&k) && also.len() < 2 && !(roots[i].name && name_half(&k, &main)) {
                            keys.push(k);
                            also.push(s);
                        }
                    }
                    if also.is_empty() {
                        json!([spelling, code, uses])
                    } else {
                        json!([spelling, code, uses, also])
                    }
                })
                .collect();
            let mut o = serde_json::Map::new();
            o.insert("f".into(), Value::Array(forms));
            if g.len() > 1 || posting.iter().any(Option::is_none) {
                o.insert("o".into(), json!(posting.iter().map(|p| p.map_or(-1, |x| rank[x])).collect::<Vec<_>>()));
            }
            let rel = families.of(i);
            if !rel.is_empty() {
                o.insert("r".into(), json!(rel.iter().map(|(j, c, w)| json!([j, c.to_string(), w])).collect::<Vec<_>>()));
                let (linked, twins) = families.hand_made(i, &rel);
                if !linked.is_empty() {
                    o.insert("h".into(), json!(linked));
                }
                if !twins.is_empty() {
                    o.insert("t".into(), json!(twins));
                }
            }
            let n = number(roots[i].key);
            if d.remapped.contains(n) {
                o.insert("x".into(), json!(1));
            } else if d.dropped.contains(n) {
                o.insert("x".into(), json!(2));
            }
            Value::Object(o)
        })
        .collect()
}

type Links = HashMap<usize, Vec<usize>>;

fn link(m: &mut Links, from: usize, to: usize) {
    if from != to {
        let v = m.entry(from).or_default();
        if !v.contains(&to) {
            v.push(to);
        }
    }
}

/// Dictionary words (senses grouped) and the links between them.
struct Families<'a> {
    roots: &'a [Root<'a>],
    /// Each root's dictionary word (index into `members`), when it can be in a family.
    word: Vec<Option<usize>>,
    /// Each word's senses, most used first, and their total uses.
    members: Vec<Vec<u32>>,
    total: Vec<u32>,
    /// Words under each Strong's number, most used first.
    by_number: HashMap<&'a str, Vec<usize>>,
    /// Word-level links: the word a word comes from ("from X"), and through a
    /// prefix or a feminine's parent; the words that come from a word, all of
    /// them and only those through "from X" (for siblings).
    up: Links,
    up_more: Links,
    down: Links,
    down_direct: Links,
    same: Links,
    /// The other language's twin, and other forms of one word.
    twins: Links,
    forms_of: Links,
    /// Links that only the hand lists make, as (smaller word, larger word):
    /// a parent set where Strong's number is a slip (`REMAP_*`), and an
    /// Aramaic twin STEPBible pairs that Strong's does not tie (`TWINS`).
    by_hand: HashSet<(usize, usize)>,
    twins_by_hand: HashSet<(usize, usize)>,
}

fn pair(a: usize, b: usize) -> (usize, usize) {
    (a.min(b), a.max(b))
}

impl<'a> Families<'a> {
    fn new(roots: &'a [Root<'a>], d: &'a Derivations) -> Self {
        let n = roots.len();
        let index: HashMap<&str, usize> = roots.iter().enumerate().map(|(i, r)| (r.key, i)).collect();
        let named = |r: &Root| r.name || name_piece(r.gloss) || NO_FAMILY.contains(&r.key);
        // Senses of one dictionary word: the same lexicon entry, or a meaning
        // or spelling of another sense.
        let mut uf: Vec<usize> = (0..n).collect();
        fn find(uf: &mut [usize], mut x: usize) -> usize {
            while uf[x] != x {
                uf[x] = uf[uf[x]];
                x = uf[x];
            }
            x
        }
        let mut by_entry: HashMap<&str, usize> = HashMap::new();
        for (i, r) in roots.iter().enumerate() {
            if !r.estrong.is_empty() {
                let first = *by_entry.entry(r.estrong).or_insert(i);
                let (a, b) = (find(&mut uf, i), find(&mut uf, first));
                uf[a] = b;
            }
            // Within one language: σάββατον is "a Spelling of" שַׁבָּת, a loanword,
            // not a sense of it. Nor does a name join two words (פָּנָה "to turn"
            // and פִּנָּה "corner" through the Corner Gate).
            if r.relation.contains("Meaning of") || r.relation.contains("Spelling of") {
                let same_lang = |t: usize| roots[t].key[..1] == r.key[..1] && roots[t].morph.get(..2) == r.morph.get(..2);
                if let Some(&t) = index.get(r.target).filter(|&&t| same_lang(t) && !named(r) && !named(&roots[t])) {
                    let (a, b) = (find(&mut uf, i), find(&mut uf, t));
                    uf[a] = b;
                }
            }
        }
        let mut slot: HashMap<usize, usize> = HashMap::new();
        let mut members: Vec<Vec<u32>> = Vec::new();
        let mut word = vec![None; n];
        let mut order: Vec<usize> = (0..n).collect();
        order.sort_by(|&x, &y| roots[y].count.cmp(&roots[x].count).then(x.cmp(&y)));
        for i in order {
            if named(&roots[i]) {
                continue;
            }
            let g = find(&mut uf, i);
            let w = *slot.entry(g).or_insert_with(|| {
                members.push(Vec::new());
                members.len() - 1
            });
            members[w].push(i as u32);
            word[i] = Some(w);
        }
        let total: Vec<u32> = members.iter().map(|m| m.iter().map(|&i| roots[i as usize].count).sum()).collect();
        let mut by_number: HashMap<&str, Vec<usize>> = HashMap::new();
        for (w, m) in members.iter().enumerate() {
            let v = by_number.entry(number(roots[m[0] as usize].key)).or_default();
            if !v.contains(&w) {
                v.push(w);
            }
        }
        for v in by_number.values_mut() {
            v.sort_by(|&x, &y| total[y].cmp(&total[x]).then(x.cmp(&y)));
        }
        let mut f = Families {
            roots,
            word,
            members,
            total,
            by_number,
            up: Links::new(),
            up_more: Links::new(),
            down: Links::new(),
            down_direct: Links::new(),
            same: Links::new(),
            twins: Links::new(),
            forms_of: Links::new(),
            by_hand: HashSet::new(),
            twins_by_hand: HashSet::new(),
        };

        // Derivations, decided once per pair of numbers so both pages agree.
        let mut pairs: Vec<(&str, &str)> = d.same.iter().map(|(a, b)| (a.as_str(), b.as_str())).collect();
        // (child word, parent word, from "from X" itself, made by the hand lists)
        let mut edges: Vec<(usize, usize, bool, bool)> = Vec::new();
        for (c, p) in &d.parent {
            // "From the base of" a noun: both come from the root the noun is built on.
            if d.base_of.contains(c) && f.all(p).first().is_some_and(|&w| f.head(w).morph.starts_with("G:") && !f.head(w).morph.starts_with("G:V")) {
                pairs.push((c.as_str(), p.as_str()));
                continue;
            }
            for cw in f.kin(c) {
                for pw in f.parent_words(c, p) {
                    edges.push((cw, pw, true, d.remapped.contains(c)));
                }
            }
        }
        for (c, h) in &d.head {
            for cw in f.kin(c) {
                for pw in f.parent_words(c, h) {
                    edges.push((cw, pw, false, d.remapped.contains(c)));
                }
            }
        }
        // A feminine or plural of a word that plainly comes from another comes from it too.
        for w in &d.form_of {
            let Some(m) = d.parent.get(w).filter(|m| d.plain.contains(*m) && !f.parent_words(w, m).is_empty()) else {
                continue;
            };
            if let Some(g) = d.parent.get(m) {
                for cw in f.kin(w) {
                    for pw in f.parent_words(m, g) {
                        edges.push((cw, pw, false, d.remapped.contains(w) || d.remapped.contains(m)));
                    }
                }
            }
        }
        let mut from_strongs: HashSet<(usize, usize)> = HashSet::new();
        for &(cw, pw, direct, hand) in &edges {
            link(if direct { &mut f.up } else { &mut f.up_more }, cw, pw);
            link(&mut f.down, pw, cw);
            if direct {
                link(&mut f.down_direct, pw, cw);
            }
            if hand {
                f.by_hand.insert(pair(cw, pw));
            } else {
                from_strongs.insert(pair(cw, pw));
            }
        }
        // A link Strong's own line also makes is his, not the hand list's.
        f.by_hand.retain(|x| !from_strongs.contains(x));
        for (a, b) in pairs {
            for aw in f.pick(a) {
                for bw in f.pick(b) {
                    link(&mut f.same, aw, bw);
                    link(&mut f.same, bw, aw);
                }
            }
        }
        for (a, b) in &d.alt {
            for aw in f.pick(a) {
                for bw in f.pick(b) {
                    link(&mut f.forms_of, aw, bw);
                    link(&mut f.forms_of, bw, aw);
                }
            }
        }
        // The lexicons' word-level links. An Aramaic twin counts only where
        // Strong's ties the two numbers or the pair was checked by hand.
        // Some(true) where only the hand lists back the pair.
        let backed = |a: &str, b: &str| -> Option<bool> {
            let (a, b) = (number(a), number(b));
            let cites = |x: &str, y: &str| d.cites.get(x).is_some_and(|v| v.iter().any(|z| z == y));
            let listed = |l: &[(&str, &str)]| l.iter().any(|&(x, y)| (x, y) == (a, b) || (x, y) == (b, a));
            if listed(&NOT_TWINS) {
                None
            } else if cites(a, b) || cites(b, a) {
                Some(false)
            } else if listed(&TWINS) || listed(&TWINS_MORE) {
                Some(true)
            } else {
                None
            }
        };
        let mut twins_by_strongs: HashSet<(usize, usize)> = HashSet::new();
        for (i, r) in roots.iter().enumerate() {
            let twin = r.relation.contains("in Aramaic of") || r.relation.contains("in Hebrew of");
            if !twin && !r.relation.contains("Form of") {
                continue;
            }
            let Some(&t) = index.get(r.target).filter(|&&t| roots[t].key[..1] == r.key[..1]) else {
                continue;
            };
            let hand = if twin {
                match backed(r.key, r.target) {
                    Some(hand) => hand,
                    None => continue,
                }
            } else {
                false
            };
            if let (Some(a), Some(b)) = (f.word[i], f.word[t]) {
                let map = if twin { &mut f.twins } else { &mut f.forms_of };
                link(map, a, b);
                link(map, b, a);
                if twin && hand {
                    f.twins_by_hand.insert(pair(a, b));
                } else if twin {
                    twins_by_strongs.insert(pair(a, b));
                }
            }
        }
        f.twins_by_hand.retain(|x| !twins_by_strongs.contains(x));
        f
    }

    fn head(&self, w: usize) -> &Root<'a> {
        &self.roots[self.members[w][0] as usize]
    }

    fn all(&self, n: &str) -> Vec<usize> {
        self.by_number.get(n).cloned().unwrap_or_default()
    }

    /// The words under a number that hold more than a tiny share of its uses.
    fn major(&self, n: &str) -> Vec<usize> {
        let ws = self.all(n);
        let sum: u32 = ws.iter().map(|&w| self.total[w]).sum();
        ws.iter().enumerate().filter(|&(k, &w)| k == 0 || self.total[w] as f64 > MINOR * sum as f64).map(|(_, &w)| w).collect()
    }

    /// Two words of one number that look alike (same consonants, same word
    /// class) but STEPBible keeps apart: different words, as אַיִל ram and אַיִל pillar.
    fn look_alike(&self, x: usize, y: usize) -> bool {
        let (a, b) = (self.head(x), self.head(y));
        skeleton(a.word) == skeleton(b.word) && class(a.morph) == class(b.morph)
    }

    /// The words a number's Strong's line is about: its main word, and the
    /// others that are not look-alikes of it (another spelling, a participle).
    fn kin(&self, n: &str) -> Vec<usize> {
        let ws: Vec<usize> = self.all(n).into_iter().filter(|&w| !self.split(w)).collect();
        let Some(&top) = ws.first() else {
            return Vec::new();
        };
        ws.into_iter().filter(|&w| w == top || !self.look_alike(top, w)).collect()
    }

    /// Another word filed under its number (SPLIT).
    fn split(&self, w: usize) -> bool {
        self.members[w].iter().any(|&j| SPLIT.contains(&self.roots[j as usize].key))
    }

    /// The one word a link to number `n` means: its main word, unless a
    /// look-alike shares the number and the main word holds under nine in ten
    /// of its uses, when no word can be said.
    fn pick(&self, n: &str) -> Vec<usize> {
        let ws = self.all(n);
        let Some(&top) = ws.first() else {
            return Vec::new();
        };
        let sum: u32 = ws.iter().map(|&w| self.total[w]).sum();
        let unclear = self.major(n).iter().any(|&w| w != top && self.look_alike(top, w));
        if unclear && (self.total[top] as f64) < CLEAR * sum as f64 {
            Vec::new()
        } else {
            vec![top]
        }
    }

    /// The parent words of child number `c` under parent number `p`.
    fn parent_words(&self, c: &str, p: &str) -> Vec<usize> {
        let chosen = CHILD_SENSE.iter().find(|&&(x, k)| x == c && number(k) == p).and_then(|&(_, k)| self.roots.iter().position(|r| r.key == k)).and_then(|i| self.word[i]);
        match chosen {
            Some(w) => vec![w],
            None => self.pick(p),
        }
    }

    /// Homonyms: two words filed under one number with the same letters and
    /// word type (a noun's gender aside: כּוֹס cup and כּוֹס owl).
    fn homonyms(&self, x: usize, y: usize) -> bool {
        let (a, b) = (self.head(x), self.head(y));
        let noun = |m: &str| m.ends_with(":N-M") || m.ends_with(":N-F");
        letters(a.word) == letters(b.word) && (a.morph == b.morph || (noun(a.morph) && noun(b.morph) && class(a.morph) == class(b.morph)))
    }

    /// Root i's relatives: (root, relation, the root heading its word).
    fn of(&self, i: usize) -> Vec<(u32, char, u32)> {
        let Some(me) = self.word[i] else {
            return Vec::new();
        };
        let get = |m: &Links| m.get(&me).cloned().unwrap_or_default();
        let f = get(&self.forms_of);
        let p: Vec<usize> = get(&self.up).into_iter().chain(get(&self.up_more)).collect();
        let c = get(&self.down);
        let mut s: Vec<usize> = Vec::new();
        for pw in get(&self.up) {
            s.extend(self.down_direct.get(&pw).into_iter().flatten().filter(|&&w| w != me));
        }
        s.extend(get(&self.same));
        if !self.split(me) {
            s.extend(self.all(number(self.roots[i].key)).into_iter().filter(|&w| w != me && !self.homonyms(me, w) && !self.split(w)));
        }
        let a = get(&self.twins);

        let mut seen: HashSet<usize> = HashSet::from([me]);
        let mut out: Vec<(u32, char, u32)> = Vec::new();
        let mut words = 0;
        for (mut ws, rel) in [(f, 'f'), (p, 'p'), (c, 'c'), (s, 's'), (a, 'a')] {
            ws.retain(|w| seen.insert(*w));
            ws.sort_by(|&x, &y| self.total[y].cmp(&self.total[x]).then(x.cmp(&y)));
            for w in ws {
                if words == MAX_FAMILY {
                    break;
                }
                words += 1;
                let head = self.members[w][0];
                out.extend(self.members[w].iter().map(|&j| (j, rel, head)));
            }
        }
        let head = self.members[me][0];
        out.extend(self.members[me].iter().filter(|&&j| j as usize != i).map(|&j| (j, 'n', head)));
        out
    }

    /// Of root i's relatives (as `of` gives them), the heads of the words
    /// that only the hand lists link to it: through a parent that corrects a
    /// slip in Strong's number, and as an Aramaic twin STEPBible pairs that
    /// Strong's does not tie.
    fn hand_made(&self, i: usize, rel: &[(u32, char, u32)]) -> (Vec<u32>, Vec<u32>) {
        let Some(me) = self.word[i] else {
            return (Vec::new(), Vec::new());
        };
        let hand = |a: usize, b: usize| self.by_hand.contains(&pair(a, b));
        let up = self.up.get(&me).cloned().unwrap_or_default();
        let same = self.same.get(&me).cloned().unwrap_or_default();
        // A sibling is the hand lists' only when every way to it runs through one of their links.
        let sibling_by_hand = |w: usize| {
            let by_number = !self.split(me) && number(self.head(w).key) == number(self.roots[i].key);
            let routes: Vec<bool> = up.iter().filter(|pw| self.down_direct.get(pw).is_some_and(|v| v.contains(&w))).map(|&pw| hand(me, pw) || hand(w, pw)).collect();
            !by_number && !same.contains(&w) && !routes.is_empty() && routes.iter().all(|&h| h)
        };
        let (mut linked, mut twins) = (Vec::new(), Vec::new());
        let mut seen: HashSet<u32> = HashSet::new();
        for &(_, how, head) in rel {
            if !seen.insert(head) {
                continue;
            }
            let Some(w) = self.word[head as usize] else { continue };
            match how {
                'p' | 'c' if hand(me, w) => linked.push(head),
                's' if sibling_by_hand(w) => linked.push(head),
                'a' if self.twins_by_hand.contains(&pair(me, w)) => twins.push(head),
                _ => {}
            }
        }
        (linked, twins)
    }
}

/// `atlas verify`: the word study's credits. Each shipped definition says
/// whose words it is, and the counts stay within 1% of those measured when the
/// credits were first checked against the entries (21 October 2026, STEPBible
/// at 1f3423d4); the lexicons' end marks are gone from the shown text; Strong's
/// own lines carry none of the JSON editors' braces or notes; and the roots
/// whose derivation this app corrected or left out say so.
pub fn verify(d: &crate::loaded::Loaded) -> Result<Vec<(bool, String)>, String> {
    use crate::parse::{ORIGIN_ABBOTT_SMITH as AS, ORIGIN_BDB as BDB, ORIGIN_MIDDLE_LIDDELL as ML, ORIGIN_STEP_GREEK as SG, ORIGIN_STEP_HEBREW as SH, ORIGIN_STEP_THEN_BDB as SN};
    let keys: Vec<&str> = d.lemmas["key"].as_array().ok_or("lemmas.json has no key")?.iter().map(|k| k.as_str().unwrap_or("")).collect();
    let shard = d.meta["lexShard"].as_u64().ok_or("meta.json has no lexShard")? as usize;
    let read = |dir: &str, s: usize| -> Result<Vec<Value>, String> {
        let p = d.dir.join(format!("{dir}/{s}.json"));
        let t = fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?;
        match serde_json::from_str(&t).map_err(|e| format!("parsing {}: {e}", p.display()))? {
            Value::Array(v) => Ok(v),
            _ => Err(format!("{} is not a list", p.display())),
        }
    };
    let mut n: HashMap<String, usize> = HashMap::new();
    let (mut wrong, mut marked, mut strongs, mut edited, mut split) = (0, 0, 0, 0, 0);
    let mut lines: HashMap<&str, String> = HashMap::new();
    let mut flags: HashMap<&str, i64> = HashMap::new();
    let (mut by_hand, mut twins) = (0, 0);
    for s in 0..keys.len().div_ceil(shard) {
        let (lex, forms) = (read("lex", s)?, read("forms", s)?);
        for (i, e) in lex.iter().enumerate() {
            let key = keys.get(s * shard + i).copied().unwrap_or("");
            if e.is_null() {
                continue;
            }
            let o = e["o"].as_str().unwrap_or("");
            let greek = e["s"].as_str() == Some("tbesg");
            wrong += usize::from(!(if greek { [AS, ML, SG].contains(&o) } else { [BDB, SN, SH].contains(&o) }));
            *n.entry(o.to_string()).or_default() += 1;
            let text: String = e["d"].as_array().into_iter().flatten().filter_map(|x| x[0].as_str()).collect();
            marked += usize::from(text.trim_end().ends_with("(AS)") || text.trim_end().ends_with("(ML)"));
            split += usize::from(o == SN && !text.contains('§'));
            if let Some(k) = e["k"].as_str() {
                strongs += 1;
                edited += usize::from(k.contains(['{', '}']) || k.contains("corrected to"));
                if ["H0001G", "G0026", "G2316", "H0002"].contains(&key) {
                    lines.insert(key, k.to_string());
                }
            }
        }
        for (i, f) in forms.iter().enumerate() {
            let key = keys.get(s * shard + i).copied().unwrap_or("");
            if let Some(x) = f["x"].as_i64() {
                flags.insert(key, x);
            }
            by_hand += usize::from(f.get("h").is_some());
            twins += usize::from(f.get("t").is_some());
        }
    }
    let c = |o: &str| n.get(o).copied().unwrap_or(0);
    let near = |got: usize, want: usize| (got as f64 - want as f64).abs() <= (want as f64 * 0.01).max(1.0);
    Ok(vec![
        (wrong == 0, format!("{wrong} lexicon entries name a writer from the other language's lexicon")),
        (near(c(AS), 5_464), format!("{} Greek definitions from Abbott-Smith, expected about 5,464", c(AS))),
        (near(c(ML), 66), format!("{} Greek definitions from Middle Liddell, expected about 66", c(ML))),
        (near(c(SG), 20), format!("{} Greek definitions STEPBible's own, expected about 20", c(SG))),
        (near(c(BDB), BDB_EXPECTED), format!("{} Hebrew definitions abridged from BDB, expected about {BDB_EXPECTED}", c(BDB))),
        (near(c(SN), SN_EXPECTED), format!("{} Hebrew definitions with STEPBible's note before BDB's, expected about {SN_EXPECTED}", c(SN))),
        (near(c(SH), SH_EXPECTED), format!("{} Hebrew definitions STEPBible's own, expected about {SH_EXPECTED}", c(SH))),
        (marked == 0, format!("{marked} shown definitions still end in (AS) or (ML)")),
        (split == 0, format!("{split} entries with STEPBible's note before BDB's have no § to split at")),
        (strongs > 16_500, format!("only {strongs} roots have Strong's own line")),
        (edited == 0, format!("{edited} of Strong's lines keep the JSON editors' braces or notes")),
        (lines.get("H0001G").is_some_and(|k| k == "a primitive word; father, in a literal and immediate, or figurative and remote application"), "Strong's line for אָב (H1)".to_string()),
        (lines.get("G0026").is_some_and(|k| k.starts_with("from G25 (ἀγαπάω); love, i.e. affection")), "Strong's line for ἀγάπη (G26)".to_string()),
        (lines.get("G2316").is_some_and(|k| k.contains("a deity") && k.ends_with("by Hebraism, very")), "Strong's line for θεός (G2316) keeps both halves".to_string()),
        (lines.get("H0002").is_some_and(|k| k == "(Aramaic) corresponding to H1 (אָב)"), "Strong's line for Aramaic אַב (H2) leaves out the editors' {father}".to_string()),
        (flags.get("G5043") == Some(&1), "τέκνον (G5043) is marked: its derivation corrects a slip in Strong's".to_string()),
        (flags.get("G4983") == Some(&2), "σῶμα (G4983) is marked: its derivation is left out".to_string()),
        (by_hand > 0 && twins > 0, format!("{by_hand} roots name a relative linked only by this app, {twins} an Aramaic twin only STEPBible pairs")),
    ])
}

/// The Hebrew counts measured on 21 October 2026 (STEPBible at 1f3423d4).
const BDB_EXPECTED: usize = 8_147;
const SN_EXPECTED: usize = 3_190;
const SH_EXPECTED: usize = 85;

#[cfg(test)]
mod tests {
    use super::*;

    fn known(keys: &[&str]) -> HashSet<String> {
        keys.iter().map(|s| s.to_string()).collect()
    }

    fn parent(of: &str) -> Option<Link> {
        Some(Link::Parent { of: of.into(), form_of: false, plain: true })
    }

    #[test]
    fn strongs_own_lines() {
        assert_eq!(strongs_line("a primitive word;", "father, in a literal and immediate, or figurative and remote application"), "a primitive word; father, in a literal and immediate, or figurative and remote application");
        assert_eq!(strongs_line("from G25 (ἀγαπάω);", " love, i.e. affection or benevolence; specially (plural) a love-feast"), "from G25 (ἀγαπάω); love, i.e. affection or benevolence; specially (plural) a love-feast");
        // The JSON edition splits θεός's definition across its two fields.
        assert_eq!(
            strongs_line("of uncertain affinity; a deity, especially (with G3588 (ὁ)) the supreme Divinity;", " figuratively, a magistrate; by Hebraism, very"),
            "of uncertain affinity; a deity, especially (with G3588 (ὁ)) the supreme Divinity; figuratively, a magistrate; by Hebraism, very"
        );
        // A definition in braces is the editors' (here אָב's), not Strong's.
        assert_eq!(strongs_line("(Aramaic) corresponding to H1 (אָב)", "{father}"), "(Aramaic) corresponding to H1 (אָב)");
        assert_eq!(strongs_line("from the plural of H2716 (חֶרֶא); probably a kind of vegetable", "excrements of doves {or a vegetable}"), "from the plural of H2716 (חֶרֶא); probably a kind of vegetable; excrements of doves");
        // The editors' notes on corrected spellings go.
        assert_eq!(
            strongs_line("from H58 (אָבֵל) and H4246 (מְחֹלָה)xlit mᵉchôwlâh corrected to mᵉchôlâh; meadow of dancing;", "Abel-Mecholah, a place in Palestine"),
            "from H58 (אָבֵל) and H4246 (מְחֹלָה); meadow of dancing; Abel-Mecholah, a place in Palestine"
        );
        assert_eq!(strongs_line("from H336 (אִי)lemma אי missing vowel, corrected to אִי and H2083 (זְבֻל);", "Izebel, the wife of king Ahab"), "from H336 (אִי) and H2083 (זְבֻל); Izebel, the wife of king Ahab");
        assert_eq!(
            strongs_line("or (shorter) בֵּית מְעוֹןlemma בֵּית מעוֹן missing vowel, corrected to בֵּית מְעוֹן; house of habitation of (Baal);", "Beth-Baal-Meon, a place in Palestine"),
            "or (shorter) בֵּית מְעוֹן; house of habitation of (Baal); Beth-Baal-Meon, a place in Palestine"
        );
        assert_eq!(
            strongs_line("(Aramaic) from H3321 (יְצַב)lemma יְצב missing vowel, corrected to יְצַבxlit yᵉtsêb corrected to yᵉtsab;", "fixed, sure; concretely, certainty"),
            "(Aramaic) from H3321 (יְצַב); fixed, sure; concretely, certainty"
        );
        // Braces opened in the derivation and closed in the definition (H3969).
        assert_eq!(
            strongs_line("(Aramaic) corresponding to H3967 (מֵאָה); properly, a primitive numeral", "a hundred; also as a multiplicative and a fraction}"),
            "(Aramaic) corresponding to H3967 (מֵאָה)"
        );
        assert_eq!(strongs_line("from G1909 (ἐπί) and (to pour);", " "), "from G1909 (ἐπί) and (to pour)");
        assert_eq!(strongs_line("", ""), "");
    }

    #[test]
    fn reads_strongs_numbers() {
        assert_eq!(refs_in("from G25 (ἀγαπάω);", 'G'), vec!["G0025"]);
        assert_eq!(refs_in("from G1537 (ἐκ) and G5055 (τελέω);", 'G'), vec!["G1537", "G5055"]);
        assert_eq!(refs_in("of Hebrew origin (H08012);", 'G'), Vec::<String>::new());
        assert_eq!(refs_in("intensive from H7673 (שָׁבַת);", 'H'), vec!["H7673"]);
        assert_eq!(refs_in("from H157 or H157", 'H'), vec!["H0157"]);
        assert_eq!(number("H7673A"), "H7673");
        assert_eq!(number("G20447"), "G20447");
    }

    #[test]
    fn leaves_out_hedged_identities() {
        let k = known(&["H0784", "H0786", "H0176", "H0185", "H0929", "H0930"]);
        assert_eq!(classify('H', "H0786", "identical (in origin and formation) with H784 (אֵשׁ);", "", &k), None);
        assert_eq!(classify('H', "H0176", "presumed to be the 'constructive' or genitival form of אַו ; short for H185 (אַוָּה);", "", &k), None);
        assert_eq!(classify('H', "H0930", "in form a plural or H929 (בְּהֵמָה), but really a singular of Egyptian derivation;", "", &k), None);
    }

    #[test]
    fn reads_derivations() {
        let k = known(&["G0001", "G0025", "G0026", "G0080", "G0575", "G0615", "G2596", "G2530", "G3739", "G3361", "G3756", "G1537", "G2064", "G1831", "G0939", "G0305", "G0305"]);
        assert_eq!(classify('G', "G0026", "from G25 (ἀγαπάω);", "", &k), parent("G0025"));
        // Compounds whose other half has no number, or sits in the definition.
        assert_eq!(classify('G', "G0080", "from G1 (Α) (as a connective particle) and (the womb);", "", &k), None);
        assert_eq!(classify('G', "G0615", "from G575 (ἀπό) and (to slay);", "", &k), None);
        assert_eq!(classify('G', "G2530", "from G2596 (κατά);", " and G3739 (ὅς) and G5100 (τὶς); according to which", &k), None);
        assert_eq!(classify('G', "G2521", "from G2596 (κατά);", " and (to sit; akin to the base of G1476 (ἑδραῖος)); to sit down", &k), None);
        // A contrast is not a derivation.
        assert_eq!(classify('G', "G3361", "a primary particle of qualified negation (whereas G3756 (οὐ) expresses an absolute denial);", "", &k), None);
        // A word built on a prefix.
        assert_eq!(classify('G', "G1831", "from G1537 (ἐκ) and G2064 (ἔρχομαι);", "", &k), Some(Link::Head("G2064".into())));
        assert_eq!(classify('G', "G0305", "from G303 (ἀνά) and the base of G939 (βάσις);", "", &k), None);
        let k = known(&["G0303", "G0939", "G0305"]);
        assert_eq!(classify('G', "G0305", "from G303 (ἀνά) and the base of G939 (βάσις);", "", &k), Some(Link::Same("G0939".into())));
        let k = known(&["G2596", "G3695", "G2528"]);
        assert_eq!(classify('G', "G2528", "from G2596 (κατά);", " and G3695 (ὁπλίζω); to equip fully", &k), Some(Link::Head("G3695".into())));
        let k = known(&["G3700", "G3708"]);
        assert_eq!(
            classify('G', "G3700", "a (middle voice) prolonged form of the primary (middle voice) ; which is used for it in certain tenses; and both as alternate of G3708 (ὁράω);", "", &k),
            Some(Link::Alt("G3708".into()))
        );
        let k = known(&["G5315", "G2068", "G4221", "G4095", "G4198", "G4197"]);
        assert_eq!(classify('G', "G5315", "a primary verb (used as an alternate of G2068 (ἐσθίω) in certain tenses);", "", &k), Some(Link::Alt("G2068".into())));
        // "From the alternate of" is a derivation.
        assert!(matches!(classify('G', "G4221", "neuter of a derivative of the alternate of G4095 (πίνω);", "", &k), Some(Link::Parent { .. })));

        let k = known(&["H0157", "H0158", "H0160", "H4467", "H4468", "H8179", "H8176", "H3027", "H3709", "H0559", "H0560", "H5375", "H0007"]);
        assert_eq!(classify('H', "H0160", "feminine of H158 (אַהַב) and meaning the same", "", &k), Some(Link::Parent { of: "H0158".into(), form_of: true, plain: false }));
        assert_eq!(classify('H', "H0158", "from H157 (אָהַב);", "", &k), parent("H0157"));
        assert_eq!(classify('H', "H4468", "a form of H4467 (מַמְלָכָה) and equiv. to it", "", &k), Some(Link::Same("H4467".into())));
        assert_eq!(classify('H', "H8179", "from H8176 (שָׁעַר) in its original sense;", "", &k), None);
        assert_eq!(classify('H', "H3027", "a primitive word; in distinction from H3709 (כַּף)", "", &k), None);
        assert_eq!(classify('H', "H0560", "(Aramaic) corresponding to H559 (אָמַר)", "", &k), None);
        assert_eq!(classify('H', "H5375", "a primitive root; (Psalm 4:6 (H7 (אֲבַד)))", "", &k), None);
        // "akin" only as a whole word.
        let k = known(&["H7038", "H4733"]);
        assert_eq!(classify('H', "H4733", "from H7038 in the sense of taking in", "", &k), None);
        let k = known(&["G2192", "G1836"]);
        assert_eq!(classify('G', "G1836", "from G2192 (ἔχω) (in the sense of taking hold of);", "", &k), Some(Link::Parent { of: "G2192".into(), form_of: false, plain: false }));
        // Comparisons, cross-references and guesses.
        let k = known(&["H4310", "H4100", "H6843", "H6842", "H8198", "H4940", "H0853", "H0226", "H2142", "H2145", "H8450", "H7794", "H2088", "H2090", "H2721", "H2719", "H4175", "H3384", "H3138"]);
        assert_eq!(classify('H', "H4310", "an interrogative pronoun of persons, as H4100 (מָה) is of things,", "", &k), None);
        assert_eq!(classify('H', "H6843", "feminine formed like H6842 (צָפִיר);", "", &k), None);
        assert_eq!(classify('H', "H8198", "feminine from an unused root meaning to spread out (as a family; see H4940 (מִשְׁפָּחָה));", "", &k), None);
        assert_eq!(classify('H', "H0853", "apparent contracted from H226 (אוֹת) in the demonstrative sense of entity;", "", &k), None);
        assert_eq!(classify('H', "H4175", "from H3384 (יָרָה) (see H3138 (יוֹרֶה));", "", &k), Some(Link::Parent { of: "H3384".into(), form_of: false, plain: false }));
        // One sense of a primitive verb from a noun: they share a root.
        assert_eq!(classify('H', "H2142", "a primitive root; also as denominative from H2145 (זָכָר)", "", &k), Some(Link::Same("H2145".into())));
        assert_eq!(classify('H', "H8450", "(Aramaic) corresponding (by permutation) to H7794 (שׁוֹר);", "", &k), None);
        // By-forms share a root; a collateral form is left out.
        assert_eq!(classify('H', "H2090", "for H2088 (זֶה);", "", &k), Some(Link::Same("H2088".into())));
        assert_eq!(classify('H', "H2721", "a collaterally form of H2719 (חֶרֶב);", "", &k), None);
    }

    #[test]
    fn spots_name_pieces() {
        for g in ["Valley (of Achor)", "(Huram)-abi", "Lebo-(Hamath)", "Fish (Gate)", "Ir-"] {
            assert!(name_piece(g), "{g}");
        }
        for g in ["if: except", "queen", "to do/make: spend(TIME)", "eye: before(the eyes)", "son"] {
            assert!(!name_piece(g), "{g}");
        }
    }

    #[test]
    fn restores_first_vowels() {
        assert!(first_vowel("אֱמֹר"));
        assert!(!first_vowel("אמֹר"));
        assert!(first_vowel("יוֹם"));
        assert!(first_vowel("וּמֶלֶךְ"));
        assert_eq!(restore_vowel("ידַעְתֶּם", "HVqq2mp", "יָדַע"), "יְדַעְתֶּם");
        assert_eq!(restore_vowel("אדַיִן", "ANcmsa", "אֱדַיִן"), "אֱדַיִן");
        assert_eq!(restore_vowel("אמֹר", "HVqcc", "אָמַר"), "אמֹר");
        assert_eq!(skeleton("עִיר"), skeleton("עִר"));
        assert_eq!(spelling_key("ἐλέησόν"), spelling_key("ἐλέησον"));
        assert_ne!(spelling_key("οὐκ"), spelling_key("οὐ"));
    }

    #[test]
    fn puts_back_a_swallowed_he() {
        assert!(lost_he("HVhcc") && lost_he("HVNcc"));
        assert!(!lost_he("HVqcc") && !lost_he("HVhc1cs") && !lost_he("AVhcc"));
        assert_eq!(with_he("מְרוֹת", "HVhcc"), "הַמְרוֹת");
        assert_eq!(with_he("עִיר", "HVhcc"), "הָעִיר");
        assert_eq!(with_he("עָנֹת", "HVNcc"), "הֵעָנֹת");
        assert_eq!(with_he("כָּשְׁלוֹ", "HVNcc"), "הִכָּשְׁלוֹ");
    }

    #[test]
    fn tells_name_halves_from_spellings() {
        let k = |s: &str| spelling_key(s);
        assert!(name_half(&k("אֵל"), &k("עֲשָׂהאֵל")));
        assert!(name_half(&k("כְּדָרְ"), &k("כְּדָרְלָעֹמֶר")));
        assert!(!name_half(&k("אֲבִיגַל"), &k("אֲבִיגַיִל")));
        assert!(name_half(&k("Ἄρειον"), &k("πάγον")));
        assert!(!name_half(&k("Ἀρείου"), &k("Ἄρειος")));
        assert!(dictionary_form("HNcmsa") && dictionary_form("HR") && dictionary_form("HVqp3ms"));
        assert!(!dictionary_form("HNcmsc") && !dictionary_form("HVqv2ms"));
        assert_eq!(unaccented("אֶ֫רֶץ"), "אֶרֶץ");
    }
}
