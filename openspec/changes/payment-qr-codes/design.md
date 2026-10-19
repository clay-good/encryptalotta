# Design — Payment QR codes

## Context

The page already has every primitive: `qrcode.js` renders a payload to a canvas (QR Share), the draft-301 hand-rolled decoder turns a PNG/JPEG/WebP back into text (QR Decoder), and the SEPA inspector carries `ibanValidate()`, the BIC structure check, the IBAN ↔ BIC country-parity check, the EPC restricted character set, and an inline ISO 11649 MOD 97-10 check. The two payment payloads are plain text records separated by LF / CRLF; parsing is string splitting plus per-field rules. There is no cryptography in this change.

Both source documents are public PDFs: EPC069-12 v3.0 (13 Sept 2022, 5 pages) and SIX "Implementation Guidelines QR-bill" v2.3 (valid from 21 Nov 2025) with v2.4 (valid from 14 Nov 2026, removes combined address fields entirely).

## Goals / Non-Goals

**Goals:**
- One view, two formats, auto-detected from the first line (`BCD` → EPC, `SPC` → Swiss).
- Decode from text *or* image, encode to text *and* image, identical gate list on both paths.
- Every rejection names the field, the rule, and the source document clause.
- Amounts rendered with `Intl.NumberFormat` in the active locale but parsed strictly per spec (`EUR12.3` / `12.30`).

**Non-Goals:**
- No merchant / point-of-interaction formats (EPC024-22), no Bezahlcode, no Stuzza, no PayPal / Twint deep links.
- No payment initiation, no `bank://` or `twint://` URL handoff.
- No printing layout engine for the full Swiss payment part (the A6 receipt + payment-part sheet). The tool emits the QR with the Swiss cross and the print size hint; page layout stays with the invoicing software.
- No QR-IBAN ↔ IID bank lookup table beyond the structural rule (IID 30000–31999 marks a QR-IBAN).

## Decisions

1. **One tool, format auto-detection** — rather than two tools. Rationale: the user's mental model is "payment QR on an invoice"; the formats never co-occur and share 80% of the gate code (IBAN, amount, reference, lengths). The first-line service tag is unambiguous.
2. **Reuse the image decoder by function call, not by navigation.** The QR Decoder's `qrDecodeImage(file) → string` becomes the shared entry point; `payqr` calls it and then feeds the text path. No duplicated decoder.
3. **Swiss cross overlay drawn on the canvas, not a vendored image.** A 7 × 7 mm white square with a black cross (SIX IG §5.3, "Swiss cross 7 mm") is a few `fillRect` calls on the existing canvas after `qrcode.js` paints the modules. Error level M tolerates the obscured centre modules by construction — the IG mandates level M for exactly this reason.
4. **Strict parse, tolerant display.** EPC amounts must match `^EUR\d{1,9}(\.\d{1,2})?$` and be in `[0.01, 999999999.99]`; Swiss amounts `^\d{1,9}\.\d{2}$` with currency `CHF|EUR`. Display uses `Intl.NumberFormat(lang, {style:'currency'})`. Parsing never uses `parseFloat` on the raw string — integer-cent arithmetic as in the SEPA `CtrlSum` gates.
5. **ISO 11649 as a shared capability.** The existing inline check is promoted to `rfCreditorReferenceValidate(ref)` / `rfCreditorReferenceGenerate(body)` and given its own sub-panel. The SEPA / UBL inspectors call the same function, so one implementation serves four call sites.
6. **QRR check digit = mod-10 recursive** (the Swiss "Modulo 10, rekursiv" table used by ESR / QRR, 26 digits + 1 check). Implemented as the 10-entry transition table; verified against the SIX sample `21 00000 00003 13947 14300 09017`.
7. **Byte-length gates use `TextEncoder`**, not `.length`: the EPC cap is 331 *bytes*, the Swiss cap 997 characters; UTF-8 multibyte names (`Mustermänn`) are the common trap.
8. **Pure JS throughout; no Web Crypto involved.** Nothing to decide on the crypto axis.

## Risks / Trade-offs

- **Version drift.** SIX publishes a new IG roughly yearly (v2.3 → v2.4 within 15 months). Mitigation: the gate list carries the IG version it implements in a constant and the UI footnote; v2.4's removal of combined addresses is implemented as a date-aware gate (warning before 14 Nov 2026, error after), the same pattern the SEPA inspector uses for the 15 Nov 2026 structured-address cutover.
- **Character sets 2–8 (ISO 8859-x) on the EPC side.** `TextDecoder` supports all eight labels in every evergreen browser; the encoder only ever emits charset 1 (UTF-8) or 2 (Latin-1) because the others have no practical use and some banking apps mis-handle them. Decoding accepts all eight.
- **QR image quality.** Phone photos of a printed invoice are skewed; the draft-301 decoder is scoped to flat, axis-aligned images and says so. The payqr tool inherits that limitation and the same error message; it is not a camera scanner.
- **False confidence.** A ✓ list means "a bank app will accept this payload", not "this payee is legitimate". The info panel says exactly that, and the Link Safety Inspector is the related tool for the "is this invoice a scam" question.
