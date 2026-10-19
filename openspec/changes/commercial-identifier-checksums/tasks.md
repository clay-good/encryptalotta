# Tasks — Business Identifier Checksums

## 1. Shared check-digit engines

- [ ] 1.1 Promote the IBAN tool's digit-by-digit MOD 97-10 to `mod97_10(s)` / `mod97_10Check(body)` with A=10 … Z=35 mapping; switch the IBAN and ISO 11649 call sites; existing Playwright cases unchanged.
- [ ] 1.2 Generic engines `{compute, verify}`: Luhn, ISO 7064 MOD 11-2, MOD 37-2, MOD 11,10, Verhoeff (d / p / inv tables), Damm (quasigroup table); Node-side checks against `079→X`, `G123489654321→Y`, `794→44`, `079→2`, `7992739871→3`, `236→3`, `572→4`.
- [ ] 1.3 Parameterise the GS1 tool's alternating 1-3 mod-10 by length (13 / 14 / 17 / 18).

## 2. Identifier validators and derivations

- [ ] 2.1 `leiValidate(s)` — 20 chars, LOU prefix (4), entity part (14), check (2) via MOD 97-10; vector `969500KSV493XWY0PS` → `33`.
- [ ] 2.2 `isinValidate(s)` — 12 chars, prefix in `ISO_3166_1_ALPHA2` ∪ {XS, EU, QS, QT}, Luhn over letter-expanded digits; `cusipValidate(s)` (ANSI X9.6 with `*` `@` `#`); `sedolValidate(s)` (weights 1,3,1,7,3,9, no vowels); `isinFromCusip`, `isinFromSedol`.
- [ ] 2.3 `isbn10Validate`, `isbn13Validate`, `ismnValidate`, `isbn10To13`, `isbn13To10` (978 only), hyphenation table (~20 groups, snapshot-dated); `issnValidate`, `issnToEan13(seq)`.
- [ ] 2.4 GS1 tool: GLN, GRAI, GSRN, GSIN types; `eoriFormat(s)` with country check and no-checksum note.
- [ ] 2.5 Shape detector with the §7.1 negative list first (SSN, NINO, PESEL, Steuer-ID, NIR, BSN, DNI / NIE, Codice Fiscale shapes), then prefix disambiguation, then candidate list.

## 3. View

- [ ] 3.1 `#bizid-view`: `#bizid-input` (single or one-per-line), `#bizid-type` selector (auto + each type), `#btn-bizid-check`, `#bizid-results` rows (type, normalised value, check-digit verdict, expected digit, derivations, registry note), `#bizid-gates` for the per-type structural gates, bulk table for multi-line input.
- [ ] 3.2 Calculator sub-panel: `#bizid-calc-alg`, `#bizid-calc-input`, `#btn-bizid-calc-compute` / `#btn-bizid-calc-verify`, result row with the algorithm's ISO clause.
- [ ] 3.3 Bulk summary via `Intl.ListFormat` / CLDR plural ("12 valid, 2 invalid, 1 rejected"); copy-as-CSV button.
- [ ] 3.4 Verdict wording per the specs; §7.1 refusal message; related-tool links (IBAN, BIC, VAT, GS1, UBL inspector).

## 4. Tests

- [ ] 4.1 `tests/specs/NN-bizid.spec.js` (number assigned at implementation): LEI vector ✓ / altered digit ✗; ISIN `US0378331005` ✓ / `US0378331006` ✗ / prefix `ZZ` ✗; CUSIP `037833100` ✓ → ISIN `US0378331005`; SEDOL `B0YBKJ7` ✓ → ISIN `GB00B0YBKJ77`, vowel ✗; ISBN-13 `9780306406157` ✓ ↔ ISBN-10 `0306406152`; `979` ISBN-13 has no ISBN-10; ISSN `0378-5955` ✓ → `9770378595002`; GLN ✓ / ✗; EORI format row text contains "no check digit"; each generic calculator vector; bulk mixed lines; SSN-shaped `123-45-6789` and NINO-shaped input refused with the §7.1 message; network-silence assertion; XSS payload in a bulk line rendered inert.
- [ ] 4.2 Register `bizid` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters; GS1 spec cases extended for the four new types.

## 5. Wiring and gates

- [ ] 5.1 ~45 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; ~10 keys for the GS1 additions; CLDR plurals for bulk counts.
- [ ] 5.2 TOOL_ORDER (after `gs1`), TOOL_TO_GROUP utilities, TOOL_SYNONYMS (`lei isin cusip sedol isbn issn ismn gln grai gsrn gsin eori check digit luhn verhoeff damm mod97 iso7064 legal entity identifier securities`), RELATED_TOOLS both directions, JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 5.3 README: Features list entry, standards cheat-sheet rows (ISO 17442, ISO 6166, ANSI X9.6, SEDOL, ISO 2108, ISO 10957, ISO 3297, GS1 GenSpecs §7.9, ISO/IEC 7064, EORI Annex 12-01), Per-Tool Security Notes paragraph restating §7.1; SPEC-INTERNATIONAL.md status note.
- [ ] 5.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
