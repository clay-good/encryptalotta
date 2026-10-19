# Design — E-invoice readable view, conformance reports, XRechnung gates, hybrid-PDF listing

## Context

The UBL walker and the CII walker both produce the same decoded invoice model (header, parties, lines, allowances / charges, VAT breakdown, totals, payment means, attachments) before the inspector renders rows and runs gates. That model is the natural input for a second renderer. The gate functions all push `{ok, label, detail, clause}` rows into one array per run; the SEPA inspector and the payment-QR tool use the identical shape, so one serialiser covers four tools. The Factur-X path already finds the PDF's `/EmbeddedFiles` entry, follows the `/EF /F` stream, and inflates it with `DecompressionStream`; listing every entry instead of the first XML is a loop over the same name tree. XMP is RDF/XML in a `/Metadata` stream and parses with `DOMParser`.

XRechnung is a CIUS of EN 16931: it adds BR-DE rules and a Leitweg-ID (routing id of the German public buyer) in BT-10. The Leitweg-ID is `coarse-fine-check`: a coarse part (2–12 digits), an optional fine part (up to 30 alphanumerics), and two check digits computed with ISO 7064 MOD 97-10 over the coarse and fine parts with letters mapped A=10 … Z=35 — the same arithmetic the site already runs for IBAN and ISO 11649.

No cryptography is involved in this change.

## Goals / Non-Goals

**Goals:**
- A bookkeeper can open an e-invoice, read it like paper, and print it from the browser with no site chrome on the page.
- A developer can attach the gate list to a ticket in the format their tracker likes.
- A German supplier learns before sending that an XRechnung lacks a Leitweg-ID or has a bad check digit.
- A Factur-X receiver sees what else is embedded in the PDF and whether the PDF's own claims match the XML.

**Non-Goals:**
- No invoice authoring, no PDF generation (the print dialog does that), no Schematron interpreter.
- No full UN/ECE Rec 20 list (~1,900 codes); a curated table of the codes seen in EN 16931 practice, raw code shown for the rest.
- No validation of attachment *contents* beyond the invoice XML; other attachments are listed and offered for download, not parsed.
- No signature verification of PAdES-signed Factur-X PDFs here (the TLS certificate tool's PAdES path covers that and is linked).

## Decisions

1. **Paper view renders from the decoded model, not from the DOM again.** Rationale: UBL and CII differ in element names but the model is already unified; one renderer serves both syntaxes. Rejected alternative: an XSLT stylesheet per syntax (`XSLTProcessor` exists in browsers but would duplicate the walkers' logic and is awkward to i18n).
2. **Print via `@media print` on the paper tab only.** The rule set hides `#nav`, the tool header, the gate list, and all buttons, sets `@page { size: auto; margin: 15mm }` so A4 and Letter both work, and forces black-on-white. Rejected alternative: opening a new window with a copy of the markup — breaks the single-page model and the CSP `connect-src 'none'` makes no difference either way.
3. **Unit codes decode via a curated inline table** keyed by UN/ECE Rec 20 common code (`C62` piece, `HUR` hour, `KGM` kilogram, `MTR` metre, `LTR` litre, `DAY` day, `MON` month, `E48` service unit, `XPP` piece (Rec 21), …), STRINGS keys for names. Rejected alternative: vendoring the full Rec 20 spreadsheet — large and mostly irrelevant to invoices.
4. **Amounts always in the invoice currency (BT-5), not the UI locale's currency**, formatted with `Intl.NumberFormat(lang, {style:'currency', currency})`; VAT accounting currency (BT-6) shown as a second column when present. Arithmetic stays with the existing integer-cent gates; the renderer only displays.
5. **One report serialiser, three formats, one row shape.** JSON is an array of `{id, rule, clause, ok, label, detail}` plus a header `{tool, standard, documentId, date, siteVersion}`; CSV follows RFC 4180 with a UTF-8 BOM for spreadsheet import; Markdown is a two-column table under a heading. Downloads are `Blob` + `URL.createObjectURL` + a synthetic anchor click, the pattern the Document Metadata Cleaner uses, filename `<tool>-<documentId>-<YYYY-MM-DD>.<ext>` with the id sanitised to `[A-Za-z0-9._-]`. Rejected alternative: PDF export of the report — needs a PDF writer the site does not have.
6. **Gate ids become stable.** Each gate function gains a string id (e.g. `ubl.brCo10`) so a report row can be diffed between runs. Existing gates already have STRINGS keys of this shape; the id is the key stem. No behaviour change for the on-screen list.
7. **XRechnung detection by CustomizationID prefix match** on `urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0` (also `_2.3`, `_2.2`, `_2.1`, and the `#conformant#…extension` variants); the BR-DE family only runs when detected, so PEPPOL and Factur-X documents are not penalised. Rejected alternative: always running BR-DE as ⚠ — noise for every non-German invoice.
8. **Leitweg-ID checker is pure JS on BigInt-free MOD 97-10** (digit-by-digit modulo, as `ibanValidate()` does): split on `-`, validate part lengths and character classes, map letters, compute 98 − (n × 100 mod 97) and compare. Rejected alternative: regex-only syntax check — the check digits are the whole point.
9. **Attachment listing walks the `/EmbeddedFiles` name tree fully** (`/Names` arrays and `/Kids` recursion), reading each filespec's `/F` / `/UF`, `/AFRelationship`, `/EF /F` stream `/Params /Size`, `/Subtype` MIME; falls back to scanning for `/Type /Filespec` objects when the catalog lacks `/Names`. Decoding stays with `DecompressionStream` for `/FlateDecode`; other filters are listed with "filter not supported, download raw". Rejected alternative: a vendored PDF library (§7.7, page weight).
10. **XMP cross-check is a single gate**: `fx:ConformanceLevel` (MINIMUM / BASIC WL / BASIC / EN 16931 / EXTENDED / XRECHNUNG) must equal the profile the CII walker detected from the `GuidelineSpecifiedDocumentContextParameter/ID` URN; `pdfaid:part` must be 3 (PDF/A-3) for Factur-X 1.0 and ZUGFeRD 2.x, or 4 for the PDF/A-4f variant, `fx:DocumentType` must be `INVOICE` (or `ORDER` for Order-X), `fx:DocumentFileName` must name the embedded XML.
11. **Pure JS throughout; no Web Crypto.** Nothing to decide on the crypto axis.

## Risks / Trade-offs

- **Print fidelity across browsers.** Page-break handling of long line tables differs; `break-inside: avoid` on table rows and repeated `<thead>` cover the common cases. The view is a readable page, not a pixel-perfect layout engine.
- **Unit-code coverage.** Unknown codes show raw; a footnote names Rec 20 so the reader can look them up. The table can grow by adding rows to one constant.
- **XRechnung version drift.** KoSIT publishes a new minor roughly every six months; the URN carries the version. Mitigation: prefix match on `xrechnung_` and a constant naming the versions implemented; BR-DE rule texts rarely change between minors.
- **XMP parsing of malformed packets.** Some producers emit XMP that is not well-formed XML. Mitigation: `DOMParser` errors degrade to "XMP packet not parseable" with the raw text offered, and the cross-check gate is skipped rather than ✗.
- **Encrypted PDFs.** Attachment streams of an encrypted PDF cannot be inflated. The listing still shows names and sizes from the unencrypted dictionary strings where readable, and says why download is unavailable.
- **False confidence.** A printable, all-✓ invoice is syntactically conformant; nothing here establishes that the seller is who the invoice says or that the amounts are owed. The paper view carries the same footer line as the inspector's verdict.
