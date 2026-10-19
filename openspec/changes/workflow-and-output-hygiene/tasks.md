# Tasks — Workflow and output hygiene

## 1. Registries

- [ ] 1.1 `TOOL_SENSITIVITY` — move the selector list out of `clearSensitiveFields()` into the registry; the function iterates the registry. Add `data-secret` to every secret output pane.
- [ ] 1.2 `HANDOFF_TYPES` — artifact type → `{accepts: [toolIds], fill: (toolId, value) => void}`; tag existing result containers with `data-handoff-type`.
- [ ] 1.3 `CONTENT_DETECTORS` — ~40 `{type, test, tools}` entries; confidence 0–1; unit-tested in Node against a vector file (one positive per type, the hex-64 / Base64-vs-Base58 / UUID-vs-hex ambiguities, and ten random-prose negatives).
- [ ] 1.4 Audit gates: (a) every `type="password"` / `data-secret` element is registered; (b) every `HANDOFF_TYPES.accepts` id exists in `TOOL_ORDER`; (c) every detector's `tools` ids exist.

## 2. Smart paste

- [ ] 2.1 Home search box and palette input: `paste` and `drop` handlers → detector run → ranked suggestion list (reuse the palette's `role="listbox"` results and keyboard handling).
- [ ] 2.2 Secret-type matches render masked in the suggestion list; search box cleared on choose / dismiss.
- [ ] 2.3 Drop-to-detect: leading-bytes identification through the File Type Identifier's engine; file held in memory and passed through the handoff buffer as a `File`.
- [ ] 2.4 Selection → `HANDOFF = {type, value}` → `location.hash = '#<tool>'` → target `show()` consumes and fills.

## 3. Send to

- [ ] 3.1 Shared `renderSendTo(container, type, value)` that builds the menu from `HANDOFF_TYPES`; invoked by the result renderers that already know their artifact type (cert parser, JWT inspector, JWK ↔ PEM, hash, encode, CSR, SSH, SEPA / UBL header rows, QR decoder, age keygen, PGP generate).
- [ ] 3.2 Buffer lifecycle: consumed on fill; cleared on navigation to any other view and on `beforeunload`.
- [ ] 3.3 Target focuses its primary action button after fill; no automatic execution.

## 4. Bulk mode

- [ ] 4.1 Shared `bulkValidate(toolId, text, validateFn)` → rows; CSV / TSV delimiter detection and column picker via the existing RFC 4180 parser; 10,000-row cap; 2,000-row inline cap.
- [ ] 4.2 Verdict table renderer (shared key/value rows) + summary line with CLDR plurals; CSV and JSON export via Blob download.
- [ ] 4.3 Wire into IBAN, BIC, VAT, GS1 (and the identifiers from `commercial-identifier-checksums` when that change lands).

## 5. Hygiene

- [ ] 5.1 Masked rendering: `.masked` class + reveal toggle with `aria-label`; applied from the registry; re-mask on view hide.
- [ ] 5.2 `copySecret(text)` helper replacing the 13 direct `writeText` calls; timer chip; cancel-on-new-copy; refusal message path.
- [ ] 5.3 Settings entry for the clipboard timer (off / 15–300 s) stored in `localStorage` as the single new preference key.
- [ ] 5.4 Toolbar "Clear all secrets" button and `Esc Esc` handler (500 ms window, skip during `isComposing` and open dialogs) → `clearSensitiveFields()` + buffer clear + timer cancel + confirmation toast.

## 6. Tests

- [ ] 6.1 `tests/specs/NN-workflow.spec.js` (number assigned at implementation): detector vectors through the UI, secret-match masking, IBAN pre-fill with hash-only URL and unchanged `localStorage`, three `Send to` pairs, buffer cleared on reload, bulk IBAN mixed rows + CSV column pick + export round trip, masked-by-default PBKDF2 output, clipboard timer with fake timers (secret timed, public not, refusal path), `Esc Esc` clear on Text Messages with Verify results surviving, final storage-key audit.
- [ ] 6.2 Extend 05-a11y for the suggestion list, masked toggle, and toast; 11-xss with a detector input containing a script tag.

## 7. Wiring and gates

- [ ] 7.1 ~35 STRINGS keys × 5 locales (suggestion labels per type, `Send to`, bulk headers and summary plurals, mask / reveal, timer chip, clear toast) + no SEO keys (no new tool).
- [ ] 7.2 README: Navigation & UX section (smart paste, Send to, bulk mode, hygiene), Memory Security section updated to describe the registry and the opt-in clipboard timer; SPEC-INTERNATIONAL.md status note; THREAT-MODEL.md unchanged in claims (the timer is best-effort and documented as such).
- [ ] 7.3 Audit gates from 1.4 added to `scripts/audit-release.js`; `build-i18n-variants.js`, `build-portable.js`, `audit-release.js`; full Playwright suite green.
