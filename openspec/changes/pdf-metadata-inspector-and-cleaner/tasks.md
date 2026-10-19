# Tasks — PDF Metadata Inspector & Cleaner

## 1. PDF object reader (shared engine)

- [ ] 1.1 Tokenizer for ISO 32000-2 §7.2 / §7.3 (strings with escapes and hex, names with `#xx`, numbers, arrays, dictionaries, `R`, streams with `/Length` resolution and `endstream` fallback).
- [ ] 1.2 Trailer chain: `startxref` → xref table (§7.5.4) or xref stream (§7.5.8, `/W`, `/Index`, PNG predictors) → `/Prev` / `/XRefStm`; revision count; rebuild-by-scan fallback with ⚠.
- [ ] 1.3 Object-stream expansion (§7.5.7) via `DecompressionStream`; lazy `resolve(ref)` with cache.
- [ ] 1.4 Switch the PAdES `/Contents` and Factur-X `/EmbeddedFiles` scanners to the reader, keeping regex fallbacks; existing Playwright cases unchanged.

## 2. Inspection

- [ ] 2.1 `/Info` walker with §7.9.4 date decoding; XMP reader (`DOMParser`) for `dc:`, `xmp:`, `pdf:`, `xmpMM:` incl. `History`, `pdfaid:`; `/ID` pair hex; `/PieceInfo` keys; `/Lang`; `/Encrypt` summary.
- [ ] 2.2 Annotation walk (`/Annots` per page): `/Subtype`, `/T`, `/M`, `/CreationDate`, `/Popup`; embedded files via the name tree; `/OpenAction`, `/AA`, `/Names /JavaScript` presence.
- [ ] 2.3 Three-state verdict (leaky / review / clean) with docmeta strings; per-carrier `{ok,label,detail,clause}` rows; revision-count row with the recoverability warning; signature count via the PAdES path.

## 3. Cleaner

- [ ] 3.1 Live-object set from the final xref; serializer writing header, objects in number order (object streams expanded), raw stream bytes with corrected `/Length`, classic xref table, trailer (`/Size`, `/Root`, new `/ID` from `crypto.getRandomValues`, `/Info` with only `/Title`), `startxref`, single `%%EOF`.
- [ ] 3.2 Catalog edits: `/Metadata` removed or replaced by the minimal packet (PDF/A case); `/PieceInfo` removed; `/Linearized` dictionary and hint streams dropped.
- [ ] 3.3 Annotation edits: `/T` → empty string (and `/Popup` `/T`), `/M` / `/CreationDate` removed, `/NM` kept.
- [ ] 3.4 Refusals: `/Encrypt` present; any live object unparseable; signature-breaking confirmation note.
- [ ] 3.5 Blob download named `<original>-clean.pdf`; optional SHA-256 of the output in the summary.

## 4. Active-content report

- [ ] 4.1 Walk catalog / page / annotation / AcroForm actions; type by `/S`; rows with §12.6.4 sub-clause and one-line explanation; `/FileAttachment` and external `/F` streams.
- [ ] 4.2 Disabled "remove active content" toggle labelled slice 2.

## 5. View

- [ ] 5.1 `#pdfmeta-view`: `#pdfmeta-file` input, `#pdfmeta-results` (verdict banner, header card, Info table, XMP table, ID / PieceInfo / Lang rows, annotation table, revision row, encryption row), `#pdfmeta-gates`, `#pdfmeta-active` list, `#pdfmeta-xmp-mode` (remove / minimal), `#btn-pdfmeta-clean`, `#btn-pdfmeta-download`.
- [ ] 5.2 Dates via `Intl.DateTimeFormat`; sizes via the existing byte formatter; verdict and footer wording per the specs; related-tool links.

## 6. Tests

- [ ] 6.1 Fixtures built with Python `pypdf` in `tests/fixtures/pdf/` (leaky with two incremental saves + annotation author + XMP; clean; encrypted; xref-stream + object-stream; OpenAction + JavaScript + URI; PDF/A-claimed; PAdES-signed sample reused).
- [ ] 6.2 `tests/specs/NN-pdfmeta.spec.js` (number assigned at implementation): leaky verdict lists Author / Producer / CreatorTool / History / annotation author / 3 revisions; clean fixture → clean; xref-stream fixture parses with no rebuild ⚠; cleaned output re-opened with `pypdf` (skipped if Python absent, as 27-docmeta does): only `/Title` in Info, no `/Metadata` (remove mode) or minimal packet (PDF/A fixture), one `%%EOF`, `/ID` changed, page content streams byte-identical, annotation `/T` empty; encrypted fixture refused; active-content rows for OpenAction / JavaScript / URI; network-silence assertion; XSS payload in `/Author` and annotation `/T` rendered inert.
- [ ] 6.3 Register `pdfmeta` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters.

## 7. Wiring and gates

- [ ] 7.1 ~55 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; CLDR plurals for "n revisions", "n annotations", "n signatures".
- [ ] 7.2 TOOL_ORDER (after `docmeta`), TOOL_TO_GROUP privacy, TOOL_SYNONYMS (`pdf metadata author producer xmp remove clean strip incremental revisions pieceinfo javascript openaction`), RELATED_TOOLS both directions (exif, docmeta, tls-cert, ubl), JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 7.3 README: Features list entry, standards cheat-sheet rows (ISO 32000-2 §7.5 / §14.3 / §12.6, ISO 16684-1), Per-Tool Security Notes paragraph (what a clean verdict does not cover); SPEC-INTERNATIONAL.md status note.
- [ ] 7.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
