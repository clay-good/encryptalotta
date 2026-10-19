# Tasks — Unicode Inspector

## 1. Classification engine

- [ ] 1.1 Promote `LINKCHECK_SCRIPTS` / `LINKCHECK_SCRIPT_RE` / `LINKCHECK_CJK_OK` / `LINKCHECK_CONFUSABLE` to shared `UNICODE_*` constants; repoint the linkcheck call sites; confirm `25-linkcheck.spec.js` passes unchanged.
- [ ] 1.2 `unicodeClassify(cp) → {category, script, name, hazard}` using `\p{gc=…}` / `\p{Script=…}` property escapes plus the compact display tables (category labels Cf / Cc / Zs / Mn / Co / Cn / other; 12 scripts + Common / Inherited).
- [ ] 1.3 `UNICODE_HAZARD_NAMES` (~120 entries: bidi controls, zero-width, tag characters, variation selectors, soft hyphen, NBSP family, ideographic space, combining-mark range, BOM, interlinear annotation, U+FFFC / U+FFFD).
- [ ] 1.4 `unicodeSegment(text) → rows[]` via `Intl.Segmenter('und', {granularity: 'grapheme'})` with the code-point fallback; UTF-8 bytes via `TextEncoder`, UTF-16 bytes as `str.length * 2`.
- [ ] 1.5 Extend `UNICODE_CONFUSABLE` with the Latin-lookalike subset of UTS #39 `confusables.txt` (~200 entries); `unicodeSkeleton(text)`.

## 2. Gate and normalization engine

- [ ] 2.1 `unicodeBidiCheck(text)` — UAX #9 §3.3.2 stack walker: embeddings / overrides vs isolates, PDF / PDI pairing, newline reset; returns unterminated and mismatched positions.
- [ ] 2.2 `unicodeRestrictionLevel(text)` — UTS #39 §5.2 levels over the shared script set, ignoring Common / Inherited; fixed inline Recommended-script list.
- [ ] 2.3 Gate functions (SEPA-gate style, each `{ok, label, detail, clause}`): bidi controls, bidi termination, bidi marks (⚠), zero-width, tag characters, other Cf, private-use, unassigned, non-NFC, restriction level, whole-script confusable, oversized combining runs (> 4 marks on one base, ⚠).
- [ ] 2.4 `unicodeCleanCopy(text) → {clean, removed[]}` and the code-point-level diff through the Diff tool's LCS.
- [ ] 2.5 `unicodeNormalizationTable(text)` — four forms, lengths, changed flag.

## 3. Punycode and escapes

- [ ] 3.1 `punycodeEncodeLabel(label)` per RFC 3492 §6.3 sharing the decoder's `adapt()`; `domainToAscii(name)` / `domainToUnicode(name)` over the four UTS #46 dot separators.
- [ ] 3.2 IDNA structural gates: `xn--` only on A-labels, `--` at positions 3–4, leading / trailing hyphen, label ≤ 63 octets, name ≤ 253, leading combining mark, NFC (RFC 5891 §4.2.3; RFC 1035 §2.3.4).
- [ ] 3.3 Verify against all eleven RFC 3492 §7.1 sample strings (A–K), decode and encode.
- [ ] 3.4 `unicodeEscape(text, form)` / `unicodeUnescape(text)` for JS, HTML, URL and Python forms; unparseable sequences left literal and flagged.

## 4. View

- [ ] 4.1 `#unicode-view`: `#unicode-input` textarea, mode tabs (inspect / normalize / punycode / escapes), `#btn-unicode-inspect`, `#btn-unicode-clean`, `#btn-unicode-copy-clean`, `#btn-unicode-encode` / `#btn-unicode-decode`, `#unicode-escape-form` select, `#unicode-results` (counts header + per-grapheme table), `#unicode-gates`, `#unicode-clean-output`, `#unicode-diff`, `#unicode-normalize-table`, `#unicode-idna-table`.
- [ ] 4.2 Table cells render via `createElement` / `textContent`; invisible characters are shown as their `U+XXXX` label with a dotted placeholder glyph, never as the raw character inside the table.
- [ ] 4.3 Verdict wording per the detection spec; link rows to Link Safety Inspector, Base64 / Hex, URL Parser, Diff; "inspect this label" link added in the Link Safety Inspector results.

## 5. Tests

- [ ] 5.1 `tests/specs/NN-unicode.spec.js` (number assigned at implementation; 29+): Trojan Source early-return sample (RLO / LRI / PDI inside a comment) → bidi ✗ with positions; `ab​cd` → zero-width ✗ and clean copy `abcd`; tag-character payload `U+E0001 U+E0068 U+E0069 U+E007F` → tag ✗ and decoded tag text `hi`; `pаypal` (Cyrillic а) → mixed-script + confusable `paypal`; `ﬁ` and `각` normalization rows; RFC 3492 §7.1 A–K; escape round trips incl. `U+1F600`; empty input; clean-result wording; network-silence assertion; XSS payload rendered inert.
- [ ] 5.2 Register `unicode` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters.

## 6. Wiring and gates

- [ ] 6.1 ~45 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; CLDR plural group for "n hidden characters removed".
- [ ] 6.2 TOOL_ORDER (after `encode`), TOOL_TO_GROUP utilities, TOOL_SYNONYMS (`unicode hidden zero-width bidi trojan source homoglyph confusable normalize nfc nfkc punycode idn escape codepoint invisible`), RELATED_TOOLS both directions, JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 6.3 README: Features list, standards cheat sheet rows (UAX #9, UAX #15, UAX #29, UTS #39, UTS #46, RFC 3492, RFC 5891), Per-Tool Security Notes paragraph; SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
