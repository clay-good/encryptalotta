# Proposal — E-invoice readable view, conformance reports, XRechnung gates, hybrid-PDF listing

## Why

Since 1 January 2025 every German business must be able to *receive* an EN 16931 e-invoice; Belgium's Peppol B2B mandate started 1 January 2026; France requires all businesses to receive from 1 September 2026. The invoice arrives as UBL or CII XML, or as a Factur-X / ZUGFeRD PDF with the XML inside. A small business that opens it sees angle brackets. The shipped **PEPPOL / UBL + Factur-X / ZUGFeRD Invoice Inspector** decodes both syntaxes, runs 118 UBL and 24 CII gates, and extracts the XML from hybrid PDFs, but it renders the result as inspector rows for a developer, not as an invoice a bookkeeper can read, print, and file. Four gaps follow from that:

- **No human-readable view.** The data is already decoded; it is not laid out like the paper invoice it replaces.
- **No report export.** A ✓ / ✗ list on screen cannot be attached to a ticket or sent back to the supplier. The SEPA inspector and the payment-QR tool have the same gap.
- **No XRechnung gates.** German public-sector invoices must carry the KoSIT CustomizationID and satisfy the BR-DE rules (payment instructions, seller contact, Leitweg-ID); the inspector recognises the profile URN but checks none of them. The Peppol German National Ruleset has enforced the same rules at every German access point since 17 February 2025.
- **No attachment listing for hybrid PDFs.** The inspector extracts the one XML it needs and ignores the rest: other attachments, the PDF/A conformance claim, and the Factur-X XMP extension that must agree with the XML profile.

## What Changes

- Extends the shipped UBL / CII inspector (`ubl`) and, for report export only, the SEPA inspector (`sepa`) and the payment-QR tool from the `payment-qr-codes` change; **no new top-level tool** (57 stays 57). No OpenSpec baseline exists for either inspector yet, so each capability is written as a new capability.
- **Human-readable "paper" view** — a second results tab laid out like a printed invoice, with UN/ECE Recommendation 20 unit codes decoded, amounts via `Intl.NumberFormat` in the invoice currency, and an `@media print` stylesheet that yields a clean A4 / Letter page.
- **Conformance-report export** — the gate list of any inspector run as JSON, CSV, or Markdown via a Blob URL download.
- **XRechnung CIUS gates** — detect the KoSIT CustomizationID (3.0.x and 2.x) and run BR-DE-1, -2, -5, -6, -7, -15 (with Leitweg-ID syntax and check digits), -17, -18 in the house gate style.
- **Hybrid-PDF attachment listing** — every embedded file with name, size, MIME type, and `AFRelationship`; PDF/A and Factur-X XMP claims; XMP-vs-XML conformance-level cross-check; per-attachment download.

Out of scope (and the §7 non-goal it respects): no invoice *creation* or editing; no Schematron engine (the BR-DE family is hand-coded like every other gate); no e-invoice sending, Peppol access-point lookup, or SML/SMP resolution (§7.5 / §0.1 — no network); no tax or legal advice on whether an invoice is deductible (§7.2 — no compliance theater); no PDF rendering of the paper view (the browser's own print dialog produces the PDF).

## Capabilities

### New Capabilities
- `einvoice-human-readable-view`: render a decoded UBL / CII invoice as a printable paper-style page with decoded unit codes, grouped payment means, and a print stylesheet.
- `conformance-report-export`: export any inspector's gate list (UBL, CII, SEPA, payment QR) as JSON, CSV, or Markdown, offline.
- `xrechnung-cius-gates`: detect the XRechnung CustomizationID and run the BR-DE rule family, including Leitweg-ID syntax and check digits.
- `hybrid-pdf-attachment-listing`: list embedded files and XMP conformance claims in Factur-X / ZUGFeRD / Order-X PDFs and cross-check them against the XML profile.

### Modified Capabilities
- none (the existing 118 UBL and 24 CII gates and the SEPA gate list keep their behaviour; they gain an export button, which is not a requirement change).

## Impact

- `index.html`: ~650 lines of inline JS — paper-view renderer over the existing decoded invoice model, UN/ECE Rec 20 table (~60 common codes), report serialisers (three formats, one gate-row shape), BR-DE gate functions and the Leitweg-ID checker, PDF `/EmbeddedFiles` name-tree walker and XMP reader over the existing attachment extractor; ~50 lines of CSS including the `@media print` block; ~70 STRINGS keys × 5 locales (unit names and paper-view labels translate; rule ids do not).
- Reuses: the CII and UBL walkers and their decoded model, the Factur-X PDF attachment extractor with `DecompressionStream`, `DOMParser` for XMP, the `{ok,label,detail,clause}` gate framework, `ibanValidate()`, `ISO_4217`, `Intl.NumberFormat` / `Intl.DateTimeFormat`, the MOD 97-10 arithmetic already used for ISO 11649.
- No new vendored file, no CSP change, page weight +~16 KB gzipped.
- Governing documents: EN 16931-1:2017; OASIS UBL 2.1; UN/CEFACT CII D16B; Peppol BIS Billing 3.0 and the Peppol German National Ruleset; XRechnung Specification 3.0.x (KoSIT) and the Leitweg-ID specification (KoSIT); UN/ECE Recommendation 20; Factur-X / ZUGFeRD 2.x specification and its XMP extension schema; ISO 19005-3 (PDF/A-3); ISO 32000-2 §7.11.4 (embedded file streams) and §14.3 (metadata); RFC 4180 (CSV).
- Tests: new `tests/specs/NN-einvoice-view.spec.js` (number assigned at implementation; 29+). Confirm/flag pairs: paper view of a PEPPOL BIS sample renders totals equal to the XML; print stylesheet hides `#nav` and tool chrome; export JSON round-trips the on-screen gate rows for UBL and SEPA; an XRechnung with a valid Leitweg-ID (✓) and one with a wrong check digit (✗); a Factur-X PDF whose XMP says `EN 16931` while the XML says `BASIC` (✗); plus the network-silence assertion.
