# Design — Unicode Inspector

## Context

The browser already does the heavy lifting: `String.prototype.normalize` implements UAX #15, `Intl.Segmenter` yields extended grapheme clusters (UAX #29), `\p{Script=…}` and `\p{General_Category=…}` regex escapes give per-code-point classification without shipping the UCD, and `TextEncoder` gives UTF-8 lengths. The Link Safety Inspector (draft 310) already carries an RFC 3492 decoder (`punycodeDecodeLabel`), a UTS #39 "highly restrictive" script-mix check (`LINKCHECK_CJK_OK`) and a Cyrillic / Greek → Latin skeleton map (`LINKCHECK_CONFUSABLE`). What is missing is a view that applies these to arbitrary text, a bidi-termination checker, a punycode encoder, and escape converters. There is no cryptography in this change.

## Goals / Non-Goals

**Goals:**
- Explain any pasted string character by character, with hazards as ✓ / ✗ gates and a cleaned copy.
- Classification that is correct for the hazard classes (Cf, Cc, Zs, Mn, Co, Cn, bidi, tag, variation selectors) and honest about everything else ("category not in the compact table").
- Punycode encode + decode for whole domain names, verified against the RFC 3492 §7.1 sample strings.
- Every gate names its clause: UAX #9, UAX #15, UTS #39, RFC 3492, RFC 5891.

**Non-Goals:**
- No full UCD: no names for ordinary letters, no decomposition mappings beyond what `normalize()` does, no line-break or word-break properties.
- No full UTS #46 mapping table (only the structural rules: `xn--` prefix, 63-octet label, NFC, hyphen positions, full-width → NFKC via `normalize`).
- No confusable detection for non-Latin targets (Cyrillic-vs-Cyrillic skeletons are out; the Latin-lookalike set covers the phishing case).
- No sanitizer guarantee. "Clean copy" removes the hidden classes listed; it is not an XSS or injection filter.

## Decisions

1. **Classification via regex property escapes, not a shipped UCD.** `\p{Script=Cyrillic}` and `\p{gc=Cf}` are evaluated by the engine's own Unicode tables, so the tool is always as current as the browser and ships zero data for categories. Rejected: vendoring `UnicodeData.txt` (1.9 MB) — breaks the 2 MB page budget and §7.7. Trade-off: the compact script-range table is still needed for the display label; property escapes drive the gates.
2. **Hazardous-name table of ~120 entries, hand-maintained.** Names for bidi controls, zero-width, tag characters (U+E0001, U+E0020–U+E007E, U+E007F), variation selectors (U+FE00–FE0F, U+E0100–E01EF), soft hyphen, NBSP family (U+00A0, U+2007, U+202F), ideographic space U+3000, combining marks U+0300–036F (as a range label), BOM, interlinear annotations U+FFF9–FFFB, object replacement U+FFFC, replacement character U+FFFD. Rejected: a full names list (≈ 1.5 MB).
3. **Bidi termination checked with an explicit stack** per UAX #9 §3.3.2: LRE / RLE / LRO / RLO push and PDF pops; LRI / RLI / FSI push and PDI pops; isolates and embeddings may not cross-terminate; a newline resets. Unterminated or mismatched controls are a ✗ (the Trojan Source pattern leaves them open on purpose inside a comment or string).
4. **UTS #39 restriction level computed from the Link Safety Inspector's script set,** extended with the "moderately" and "minimally" levels: ASCII-only → single-script → highly restrictive (Latin + {Han, Hiragana, Katakana} / Latin + {Han, Hangul} / Latin + {Han, Bopomofo}) → moderately restrictive (highly, plus Latin with any single other Recommended script except Cyrillic, Greek, Cheroke) → minimally restrictive (any mix, no Limited-Use scripts) → unrestricted. Common / Inherited are ignored for the count as the spec requires. The linkcheck tables are renamed `UNICODE_SCRIPTS` / `UNICODE_CJK_OK` and the linkcheck call sites point at them; behaviour there is unchanged.
5. **Confusable skeleton = existing map + the Latin-lookalike subset of UTS #39 `confusables.txt`.** ~200 entries covering Cyrillic, Greek, Armenian, Cherokee, Lisu, mathematical alphanumerics and fullwidth forms that map to a–z / 0–9. Whole-script confusable is reported when the skeleton is ASCII and the input was not. Rejected: the full `confusables.txt` (≈ 6,000 entries): mostly non-Latin targets the tool does not report.
6. **Clean copy removes Cf, Cc (except TAB / LF / CR), Co and Cn code points and NFC-normalizes nothing** — normalization is a separate, explicit action because it changes visible text. The diff is rendered with the Diff tool's existing LCS at code-point granularity, so each removed `U+200B` appears as its own deletion. Rejected: silently normalizing in the clean copy (would alter `ﬁ` into `fi`, which a user did not ask for).
7. **Punycode encoder as the direct RFC 3492 §6.3 algorithm,** reusing the shipped decoder's `base = 36, tmin = 1, tmax = 26, skew = 38, damp = 700, initial_bias = 72, initial_n = 128` adaptation function. Whole domain names split on `.` and U+3002 / U+FF0E / U+FF61 (UTS #46 §4 dot mapping); labels are NFC-normalized and lower-cased before encoding; an already-ASCII label is passed through. IDNA 2008 rules reported structurally: `xn--` prefix on A-labels only (RFC 5891 §4.2.3.1), hyphen in positions 3–4 (`--`) forbidden in U-labels, leading / trailing hyphen forbidden, label ≤ 63 octets and name ≤ 253 (RFC 1035 §2.3.4), combining mark as first character forbidden (RFC 5891 §4.2.3.2). Rejected: full UTS #46 `IdnaMappingTable.txt` (≈ 300 KB).
8. **Escape conversion is table-free.** JS `\u{1F600}` / surrogate-pair `😀`, HTML `&#x1F600;` / `&#128512;`, URL `%F0%9F%98%80` (UTF-8 bytes, RFC 3986 §2.1), Python `\U0001F600` / `\uXXXX`. Parsing accepts all forms mixed. Unparseable escapes are left as literal text and flagged, never thrown.
9. **Pure JS throughout; no Web Crypto involved.** Nothing to decide on the crypto axis.

## Risks / Trade-offs

- **Engine Unicode version drift.** Safari, Chrome and Firefox may lag the current Unicode release by a version; a newly assigned code point reads as Cn ("unassigned") in an older browser. Mitigation: the Cn gate says "unassigned in this browser's Unicode tables" and the view footer prints `Intl.Segmenter` availability; the test asserts against stable code points only.
- **`Intl.Segmenter` availability.** Shipped in Chrome 87, Safari 14.1, Firefox 125. Fallback: iterate code points (`for…of`) and treat each as its own row with a notice; grapheme count then equals code-point count.
- **Restriction-level honesty.** UTS #39 §5.2 depends on the Recommended / Limited-Use script lists (`IdentifierStatus.txt`), which the page does not ship. The classifier uses a fixed inline Recommended list (the 30 scripts in UAX #31 Table 4 at Unicode 16) and says so in the gate detail.
- **False confidence.** "No hidden or mixed-script characters found" means the code points are all visible, assigned, single-script and NFC — not that the text is safe to execute or paste. The info panel states this; the related-tool row points to the Link Safety Inspector for URLs.
- **RTL users.** The tool must not strip or flag legitimate RTL text. RLM / LRM marks (U+200E / U+200F) and ALM (U+061C) are reported as "bidi marks (common in correct Arabic / Hebrew punctuation)" with ⚠, not ✗; only embeddings / overrides / isolates and unterminated runs are ✗.
