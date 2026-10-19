# Tasks — E-invoice readable view, conformance reports, XRechnung gates, hybrid-PDF listing

## 1. Shared gate-row ids and report serialiser

- [ ] 1.1 Give every UBL, CII, SEPA, and payment-QR gate function a stable string id (STRINGS key stem) carried on the `{ok,label,detail,clause}` row; no on-screen change.
- [ ] 1.2 `conformanceReportSerialize(run, format)` for `json` / `csv` / `md` from one run object `{tool, standard, documentId, date, rows}`; RFC 4180 quoting and UTF-8 BOM for CSV.
- [ ] 1.3 `downloadBlob(name, mime, bytes)` shared helper (promote the Document Metadata Cleaner's download code); filename sanitiser.

## 2. Paper-view renderer

- [ ] 2.1 `einvoiceRenderPaper(model, container)` over the unified UBL / CII decoded model: seller / buyer blocks, document header (BT-1, BT-2, BT-3 label from UNCL 1001, BT-9, BT-10, BT-12, BT-13, BT-72 delivery date, BT-73/74 period), line table, allowance / charge rows, VAT breakdown table, totals block, payment means, attachment list, note (BT-22).
- [ ] 2.2 UN/ECE Rec 20 inline table (~60 codes) with STRINGS names; raw-code fallback with footnote.
- [ ] 2.3 Amounts via `Intl.NumberFormat` in BT-5 (and BT-6 column when present); dates via `Intl.DateTimeFormat`; IBAN grouped in fours; payment-means grouping by IBAN.
- [ ] 2.4 CSS: paper tab layout; `@media print` block hiding `#nav`, tool header, gate list, buttons; `@page` margins; black-on-white; `break-inside: avoid`; repeated table header.

## 3. XRechnung gates

- [ ] 3.1 CustomizationID detection (`xrechnung_3.0`, `_2.x`, `#conformant#…extension` variants) in both UBL and CII walkers; version shown in the header card.
- [ ] 3.2 `leitwegIdCheck(id)` — split, part-length and charset checks, MOD 97-10 check digits (letters A=10…Z=35), returns `{valid, coarse, fine, check, expected}`.
- [ ] 3.3 Gates BR-DE-1, -2, -5, -6, -7, -15 (presence + Leitweg-ID syntax when the value matches the pattern), -17, -18 (skonto line format `#SKONTO#TAGE=n#PROZENT=n.nn#` when payment terms contain `#SKONTO#`), each with rule id and XRechnung clause.

## 4. Hybrid-PDF attachment listing

- [ ] 4.1 Walk the `/EmbeddedFiles` name tree (`/Names`, `/Kids`) and `/AF` array; fallback scan for `/Type /Filespec`; collect `/F`, `/UF`, `/AFRelationship`, `/EF /F` stream `/Subtype`, `/Params /Size`, `/Filter`.
- [ ] 4.2 `/Metadata` XMP packet via `DOMParser`: `pdfaid:part` / `pdfaid:conformance`, `fx:DocumentType`, `fx:DocumentFileName`, `fx:Version`, `fx:ConformanceLevel`; graceful failure on malformed XMP.
- [ ] 4.3 Cross-check gate XMP conformance level vs XML profile; PDF/A part gate; document-type gate; filename gate.
- [ ] 4.4 Per-attachment download (inflate `/FlateDecode` via `DecompressionStream`, raw otherwise); encrypted-PDF message.

## 5. View wiring

- [ ] 5.1 `#ubl-view`: results tab strip (Inspector / Paper), `#ubl-paper` container, `#btn-ubl-print`, `#btn-ubl-export-json` / `-csv` / `-md`, `#ubl-attachments` list with `#btn-ubl-attachment-download-<n>`.
- [ ] 5.2 `#sepa-view` and `#payqr-view`: `#btn-<tool>-export-json` / `-csv` / `-md` next to the gate list.
- [ ] 5.3 Paper-view footer and summary wording per the verdict-language requirements; link to the TLS certificate tool for PAdES-signed PDFs.

## 6. Tests

- [ ] 6.1 `tests/specs/NN-einvoice-view.spec.js` (number assigned at implementation): paper view of a PEPPOL BIS 3.0 sample (totals, unit names, grouped IBAN); print media emulation hides chrome; JSON export equals on-screen rows for UBL and SEPA runs; CSV parses back to the same count; Markdown table shape; XRechnung valid Leitweg-ID ✓ / wrong check digit ✗ / missing BT-10 ✗ / type code 383 ✗; BR-DE gates absent on a PEPPOL document; Factur-X PDF attachment list (name, size, MIME, AFRelationship); XMP vs XML level mismatch ✗; malformed XMP degrades without ✗; network-silence assertion; XSS payload in seller name and attachment filename rendered inert in the paper view.
- [ ] 6.2 Existing UBL / CII / SEPA spec cases pass unchanged.

## 7. Wiring and gates

- [ ] 7.1 ~70 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts); refresh the 5 en SEO prose keys for `ubl`; CLDR plural for "n attachments".
- [ ] 7.2 TOOL_SYNONYMS add `xrechnung leitweg-id print invoice readable report export csv zugferd attachments pdf/a`; RELATED_TOOLS ubl ↔ tls-cert (PAdES) both directions; JSON-LD featureList text updated; audit gate 20 tool count stays 57.
- [ ] 7.3 README: inspector feature paragraph, standards cheat-sheet rows (XRechnung 3.0.x, Leitweg-ID, UN/ECE Rec 20, Factur-X XMP, ISO 19005-3), Per-Tool Security Notes; SPEC-INTERNATIONAL.md status note.
- [ ] 7.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js` (confirm the Blob download adds no network call site); full Playwright suite green.
