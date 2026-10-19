# Tasks — Payment QR codes

## 1. Shared creditor-reference engine

- [ ] 1.1 Promote the inline ISO 11649 check used by the SEPA inspector to `rfCreditorReferenceValidate(ref)` returning `{valid, expected, normalized, grouped, reason}`; add `rfCreditorReferenceGenerate(body)`.
- [ ] 1.2 Point the SEPA `CdtrRefInf` gate and the UBL BT-83 check at the shared function; confirm existing Playwright cases still pass unchanged.
- [ ] 1.3 Node-side unit check against `RF18539007547034` (valid), `RF19539007547034` (invalid, expects 18), and a 26-character over-long input.

## 2. EPC QR payload engine

- [ ] 2.1 `epcQrParse(text) → {fields, gates}` with LF / CRLF splitting, trailing-separator detection, and the twelve-element order from EPC069-12 §2.2.
- [ ] 2.2 Gate functions (one per rule, SEPA-gate style, each returning `{ok, label, detail, clause}`): service tag, version, charset, identification, BIC presence by version, BIC structure, BIC ↔ IBAN country parity, IBAN MOD-97 + structure, name length, amount format and range (integer-cent arithmetic), purpose, remittance exclusivity, reference length + ISO 11649, text length, info length, 331-byte payload cap via `TextEncoder` / the declared ISO 8859-x via `TextDecoder`.
- [ ] 2.3 `epcQrSerialize(form)` emitting charset 1 or 2 only, line-break scrubbing, no trailing separator.
- [ ] 2.4 Verify against the §2.3 V1 example (96 bytes, QR version 6) and V2 example (103 bytes ISO 8859-1).

## 3. Swiss QR-bill payload engine

- [ ] 3.1 `swissQrParse(text)` over the IG v2.3 §4 element order (header, CdtrInf, Cdtr, UltmtCdtr placeholders, CcyAmt, UltmtDbtr, RmtInf, AddInf, AltPmt).
- [ ] 3.2 Gates: header triple, CH/LI IBAN MOD-97, QR-IID 30000–31999 detection, reference-type ↔ IBAN-kind consistency, QRR mod-10-recursive check digit (transition table `0946827135`), SCOR via the shared ISO 11649 engine, NON empty, amount two-decimals + range, currency CHF/EUR, address type S with the dated K-address gate (⚠ before 14 Nov 2026, ✗ after), address length caps, `EPD` trailer, 140-character AddInf cap, 997-character payload cap, empty ultimate-creditor block.
- [ ] 3.3 `swissQrSerialize(form)` — structured addresses only.
- [ ] 3.4 Verify against the SIX v2.3 sample payloads and the QRR vector `210000000003139471430009017`.

## 4. View and rendering

- [ ] 4.1 `#payqr-view`: decode panel (`#payqr-input` textarea + `#payqr-file` image input + `#btn-payqr-decode`), encode panel (format toggle, form fields prefixed `#payqr-epc-*` / `#payqr-ch-*`, `#btn-payqr-encode`, `#btn-payqr-download`), results (`#payqr-results` key/value rows, `#payqr-gates` gate list, `#payqr-canvas`).
- [ ] 4.2 Reuse the QR Decoder's image → text entry point; reuse the QR Share canvas renderer at error level M; add the Swiss-cross overlay (`fillRect` white square + black cross, 7 mm at the 46 mm print scale) after module painting.
- [ ] 4.3 Amount display via `Intl.NumberFormat(lang, {style:'currency', currency})`; IBAN displayed in groups of four.
- [ ] 4.4 Summary line wording per the verdict-language requirements; link rows to IBAN, SEPA XML, QR Decoder, Link Safety Inspector.

## 5. Tests

- [ ] 5.1 `tests/specs/28-payqr.spec.js`: EPC V1 / V2 examples (fields + byte counts + QR version), oversized amount, dual remittance, >331-byte payload, bad IBAN, encode → PNG → decode round trip, Swiss sample decode, QRR check-digit failure, QR-IBAN / NON mismatch, K-address dated gate (clock-injected), network-silence assertion, XSS payload in the name field rendered inert.
- [ ] 5.2 Register `payqr` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters.

## 6. Wiring and gates

- [ ] 6.1 ~40 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; CLDR plural group for "n gates failed".
- [ ] 6.2 TOOL_ORDER (after `iban`), TOOL_TO_GROUP utilities, TOOL_SYNONYMS (`girocode epc qr sepa qr-bill qr-rechnung swiss twint-less rf reference iso11649 payment`), RELATED_TOOLS both directions, JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 6.3 README: Features list, standards cheat sheet rows (EPC069-12 v3.0; SIX IG v2.3 / v2.4; ISO 11649), Per-Tool Security Notes paragraph; SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
