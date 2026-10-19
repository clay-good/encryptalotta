# Proposal — Payment QR codes (EPC QR / GiroCode + Swiss QR-bill)

## Why

Every German, Austrian, Belgian, Dutch, and Finnish invoice that carries a "GiroCode" is an **EPC QR code** (EPC069-12 v3.0): twelve newline-separated fields — IBAN, name, amount, reference — that the payer's banking app pre-fills. Switzerland's equivalent, the **Swiss QR-bill** (SIX Implementation Guidelines v2.3, mandatory structured addresses since 21 November 2025; v2.4 effective 14 November 2026), is printed on practically every CHF invoice. Both are payment instructions, and people decode them today on random web generators that see the IBAN, the amount, and the payee. The site already ships the three primitives involved — a QR generator, a hand-rolled QR image decoder, and the IBAN / BIC / ISO 11649 validators used by the SEPA inspector — but no tool joins them. Nobody should have to upload an invoice QR to learn where the money goes.

## What Changes

- **New tool `payqr` — "Payment QR (EPC / Swiss QR-bill)"** in Utilities, next to IBAN and SEPA XML. Tool count **57 → 58**.
- **Decode**: paste the payload text or load a QR *image* (reusing the existing QR decoder) → structured, labelled table (payee, IBAN, BIC, amount, purpose, reference, remittance text) plus a conformance-gate list in the SEPA / UBL house style (✓ / ✗ rows: service tag, version, charset, IBAN MOD-97, BIC ↔ IBAN country parity, amount range, field-length caps, 331-byte payload cap, ISO 11649 check digits, QRR mod-10-recursive check digit, structured-address-only rule).
- **Encode**: a form that produces the payload text and renders it as a QR image (EPC: error level M, version ≤ 13; Swiss: error level M, 46 × 46 mm print hint, Swiss cross overlay) with a download button. Encoding runs the same gates before rendering, so the tool cannot emit a code a bank app would reject.
- **ISO 11649 creditor reference** validate / generate surfaced as a sub-panel (it is already implemented inline for the SEPA inspector's `CdtrRefInf`; this exposes it).
- Related-tool links: IBAN ↔ payqr ↔ SEPA XML ↔ QR Share / QR Decoder.

Out of scope (and the §7 non-goal it respects): no bank lookup, no "pay now" deep link, no point-of-interaction codes (EPC024-22, which carry merchant URLs and would invite network calls — §7.5 / §0.1); no Bezahlcode / Stuzza legacy formats; no PII — the payee is a business counterparty, not an identity number (§7.1).

## Capabilities

### New Capabilities
- `epc-qr-payment-code`: decode, validate, and encode EPC069-12 v3.0 SCT payment QR payloads (versions 001 and 002, character sets 1–8).
- `swiss-qr-bill`: decode, validate, and encode the Swiss QR Code payload (SPC 0200) per SIX IG v2.3 / v2.4, including QRR / SCOR / NON reference types and QR-IBAN detection.
- `creditor-reference-iso11649`: validate and generate ISO 11649 "RF" structured creditor references (MOD 97-10), shared by both payment-QR formats and the SEPA / UBL inspectors.

### Modified Capabilities
- none (the SEPA / UBL inspectors keep their existing ISO 11649 behaviour; they gain a link to the new tool, which is not a requirement change).

## Impact

- `index.html`: one new view, ~450 lines of inline JS (payload parser / serializer for two formats, gate functions, Swiss-cross overlay drawn on the existing QR canvas), ~40 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: `qrcode.js` (generation), the hand-rolled QR image decoder (drafts 301), `ibanValidate()`, BIC checks, `ISO_3166_1_ALPHA2`, the inline ISO 11649 check, `Intl.NumberFormat` for amount display.
- No new vendored file, no CSP change, page weight +~12 KB gzipped.
- Tests: new `tests/specs/28-payqr.spec.js` — EPC v1 and v2 examples from EPC069-12 §2.3 (payload byte counts 96 / 103, resulting QR version 6), the SIX IG v2.3 sample bills, a QRR check-digit vector, encode → decode round trip through the image decoder, and the "no network" assertion the suite already uses.
