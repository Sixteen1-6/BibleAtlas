//! Lexicon definitions arrive as loose HTML (`<b>`, `<i>`, `<BR>`,
//! `<ref='Jhn.13.35'>`). Rather than ship HTML to the browser, they are
//! converted here into plain segments: (text, style bits, verse index).
//! The web app renders segments with `textContent` only, so nothing in a
//! source file can ever inject markup.

use atlas_core::{canon, Versification};
use serde_json::{json, Value};

pub const BOLD: u8 = 1;
pub const ITALIC: u8 = 2;

fn decode_entities(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        let end = tail.find(';').filter(|&e| e <= 8);
        let decoded = end.and_then(|e| match &tail[1..e] {
            "amp" => Some("&".to_string()),
            "lt" => Some("<".to_string()),
            "gt" => Some(">".to_string()),
            "quot" => Some("\"".to_string()),
            "apos" | "#39" => Some("'".to_string()),
            "nbsp" => Some(" ".to_string()),
            n if n.starts_with('#') => n[1..].parse::<u32>().ok().and_then(char::from_u32).map(String::from),
            _ => None,
        });
        match (decoded, end) {
            (Some(d), Some(e)) => {
                out.push_str(&d);
                rest = &tail[e + 1..];
            }
            _ => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

fn ref_target(attr: &str, vz: &Versification) -> i64 {
    let r = attr.trim().trim_start_matches("ref").trim_start_matches(['=', ' ']).trim_matches(['\'', '"']);
    let r = r.split(['-', ',', ';']).next().unwrap_or("");
    let mut it = r.split('.');
    let parsed = (|| {
        let b = canon::by_step(it.next()?)?;
        let c: u16 = it.next()?.parse().ok()?;
        let v: u16 = it.next().unwrap_or("1").parse().ok()?;
        vz.index(b, c, v)
    })();
    parsed.map(i64::from).unwrap_or(-1)
}

/// Convert one definition into `[[text, style, verse], ...]`.
pub fn segments(html: &str, vz: &Versification) -> Value {
    let mut segs: Vec<(String, u8, i64)> = Vec::new();
    let mut style = 0u8;
    let mut cur_ref = -1i64;
    let push = |segs: &mut Vec<(String, u8, i64)>, text: &str, style: u8, r: i64| {
        if text.is_empty() {
            return;
        }
        let text = decode_entities(&text.replace("__", ""));
        match segs.last_mut() {
            Some(last) if last.1 == style && last.2 == r && r < 0 && last.0 != "\n" && text != "\n" => last.0.push_str(&text),
            _ => segs.push((text, style, r)),
        }
    };
    let mut rest = html;
    while let Some(lt) = rest.find('<') {
        push(&mut segs, &rest[..lt], style, cur_ref);
        let Some(gt) = rest[lt..].find('>') else {
            push(&mut segs, &rest[lt..], style, cur_ref);
            rest = "";
            break;
        };
        let tag = rest[lt + 1..lt + gt].trim();
        let lower = tag.to_ascii_lowercase();
        let name = lower.trim_start_matches('/').split([' ', '=', '/']).next().unwrap_or("");
        let closing = lower.starts_with('/');
        match (name, closing) {
            ("b" | "strong", false) => style |= BOLD,
            ("b" | "strong", true) => style &= !BOLD,
            ("i" | "em", false) => style |= ITALIC,
            ("i" | "em", true) => style &= !ITALIC,
            ("br" | "p", _) => push(&mut segs, "\n", 0, -1),
            ("ref", false) => cur_ref = ref_target(tag, vz),
            ("ref", true) => cur_ref = -1,
            _ => {}
        }
        rest = &rest[lt + gt + 1..];
    }
    push(&mut segs, rest, style, cur_ref);
    // Collapse runs of blank lines and trim the ends.
    let mut out: Vec<Value> = Vec::new();
    let mut last_nl = true;
    for (t, s, r) in segs {
        if t == "\n" {
            if !last_nl {
                out.push(json!(["\n", 0, -1]));
            }
            last_nl = true;
            continue;
        }
        let t = if last_nl { t.trim_start().to_string() } else { t };
        if t.is_empty() {
            continue;
        }
        last_nl = false;
        out.push(json!([t, s, r]));
    }
    while out.last().is_some_and(|v| v[0] == "\n") {
        out.pop();
    }
    Value::Array(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_markup_safely() {
        let mut counts = vec![vec![1u16]; 66];
        counts[42] = vec![1; 13];
        counts[42][12] = 40;
        let vz = Versification::from_counts(&counts);
        let v = segments("<b>love</b>, goodwill<BR />__1. Of men: <ref='Jhn.13.35'>Jhn.13:35;</ref> &amp; <script>x</script>", &vz);
        let a = v.as_array().unwrap();
        assert_eq!(a[0], json!(["love", 1, -1]));
        assert_eq!(a[1], json!([", goodwill", 0, -1]));
        assert_eq!(a[2], json!(["\n", 0, -1]));
        assert_eq!(a[3], json!(["1. Of men: ", 0, -1]));
        let target = vz.index(42, 13, 35).unwrap() as i64;
        assert_eq!(a[4], json!(["Jhn.13:35;", 0, target]));
        // The script tag is dropped; only its text survives, as plain text.
        assert_eq!(a[5], json!([" & x", 0, -1]));
    }
}
