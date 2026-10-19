# Proposal — Unicode Inspector (hidden characters, bidi, confusables)

## Why

Text that looks harmless can carry characters nobody sees. **Trojan Source** (CVE-2021-42574) hides bidirectional override controls (UAX #9, U+202A–U+202E, U+2066–U+2069) in source code so that what the reviewer reads differs from what the compiler parses; CVE-2021-42694 does the same with homoglyphs. Zero-width characters (U+200B–U+200D, U+2060, a stray U+FEFF BOM) break string comparisons and password pastes, and the Unicode **tag characters** U+E0000–U+E007F are an invisible channel used for hidden payloads and prompt injection in copied text. Developers currently paste suspicious text into random web tools to find out what is in it. The site already ships the pieces — a UTS #39 mixed-script check and a Cyrillic / Greek → Latin confusable skeleton in the Link Safety Inspector, an RFC 3492 punycode *decoder* (no encoder), and a Base64 / Hex encoder — but no tool that explains an arbitrary string character by character.

## What Changes

- **New tool `unicode` — "Unicode Inspector (hidden characters, bidi, confusables)"** in Utilities, next to the Base64 / Hex encoder. Tool count **57 → 58**.
- **Code-point breakdown**: one row per grapheme cluster (`Intl.Segmenter`) with code points `U+XXXX`, UTF-8 and UTF-16 byte lengths, general category (compact inline table for Cf / Cc / Zs / Mn / Co / Cn), script (compact range table, 12 scripts + Common), and a human name for ~120 hazardous characters; grapheme / code-point / byte counts in the header.
- **Hidden and bidi detection**: ✓ / ✗ gates in the SEPA / UBL house style — bidi controls and their termination (Trojan Source), zero-width characters, tag characters, other Cf, private-use, unassigned, non-NFC input, UTS #39 restriction level, whole-script confusables — plus a **clean copy** with hidden characters removed and a diff of what was removed.
- **Normalization forms**: NFC / NFD / NFKC / NFKD side by side (UAX #15, `String.prototype.normalize`) with lengths and a changed / unchanged indicator.
- **Punycode / IDNA**: RFC 3492 *encoder* added beside the shipped decoder; whole domain names in both directions; IDNA 2008 / UTS #46 label rules reported structurally (RFC 5891).
- **Escape conversion**: any string ↔ JS `\u{…}` / `\uXXXX`, HTML numeric entities, URL percent-encoding, Python `\uXXXX`.
- Related-tool links: Unicode Inspector ↔ Link Safety Inspector ↔ Base64 / Hex ↔ URL Parser ↔ Diff.

Out of scope (and the §7 non-goal it respects): no full Unicode Character Database (names, categories and scripts come from compact inline tables — §7.7, no build step, 2 MB page budget); no spell-checking, language detection or "is this text malicious" classifier; no fetching of UCD or confusables data (§0.2); no font-rendering simulation. The tool reports what the characters *are*; whether a given editor or compiler is affected stays with the reader.

## Capabilities

### New Capabilities
- `code-point-breakdown`: per-grapheme table (code points, byte lengths, category, script, name) and grapheme / code-point / byte counts.
- `hidden-and-bidi-character-detection`: gate list for bidi controls, zero-width, tag, other format, private-use, unassigned, non-NFC, UTS #39 restriction level and confusables; clean-copy output with diff.
- `normalization-forms`: NFC / NFD / NFKC / NFKD comparison per UAX #15.
- `punycode-and-idna-conversion`: RFC 3492 encode and decode of labels and whole domain names with structural IDNA 2008 / UTS #46 checks.
- `escape-sequence-conversion`: render and parse JS, HTML, URL and Python escape forms.

### Modified Capabilities
- none (the Link Safety Inspector keeps its mixed-script and confusable behaviour unchanged; it gains a "inspect this label" link, which is not a requirement change).

## Impact

- `index.html`: one new view, ~550 lines of inline JS (segmenter table, category / script range tables, hazardous-name table, bidi stack checker, UTS #39 restriction-level classifier, punycode encoder, escape converters), ~45 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: `punycodeDecodeLabel()` and `hostToUnicode()` (linkcheck), `LINKCHECK_CONFUSABLE` and `LINKCHECK_CJK_OK` (promoted to shared `UNICODE_*` tables), the Diff tool's LCS for the clean-copy diff, `TextEncoder` for byte counts, `Intl.Segmenter`, the SEPA / UBL gate framework (`{ok,label,detail,clause}` rows), STRINGS i18n.
- No new vendored file, no CSP change, page weight +~14 KB gzipped (the hazardous-name table is the largest item).
- Tests: new `tests/specs/NN-unicode.spec.js` (number assigned at implementation; 29+) — Trojan Source early-return sample from the paper, tag-character payload, `ﬁ` and Hangul normalization, RFC 3492 §7.1 sample strings, escape round trips, and the "no network" assertion the suite already uses.
