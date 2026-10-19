# Proposal — Workflow and output hygiene (cross-cutting)

## Why

With 57 tools (and the ~15 more proposed alongside this change) the bottleneck is no longer "is there a tool for this" but "which one, and how do I get my data from one to the next". Today a user who pastes a PEM block on the home page gets nothing; one who decodes a JWT and wants the embedded JWK as PEM copies text by hand into another view; one who has 400 IBANs to check pastes them one at a time; and someone decrypting on a shared screen leaves plaintext and a copied private key in the clipboard with no timer. None of these needs a new tool — they need the tools to behave like one toolbox. This change adds the four cross-cutting behaviours the comparison set (CyberChef's chaining, DevToys' smart detection) has and this site lacks, without a recipe engine and without storing anything.

## What Changes

- **Smart paste on the home page and in the command palette.** Pasting or dropping anything into the home search box classifies it (PEM / armored PGP / JWT / SD-JWT / IBAN / BIC / VAT / UUID / ULID / epoch / ISO date / hex / Base64 / CBOR hex / XML of a known document type / JSON / CIDR / IP / URL / `otpauth://` / `age1…` / SSH key / EPC QR payload …) and offers the matching tools ranked, pre-filled on selection. Detection is local pattern matching; nothing is decoded until the user picks a tool.
- **"Send to…" handoff on results.** Every result pane that yields a well-typed artifact (a PEM, a JWK, a hex digest, a decoded payload, an IBAN, an XML fragment, a certificate) gets a `Send to` menu listing the tools that accept that type; selection navigates and pre-fills via an in-memory handoff buffer (never the URL, never `localStorage`).
- **Bulk mode on validators.** IBAN, BIC, VAT, GS1, and the identifiers proposed in `commercial-identifier-checksums` accept one value per line (or a CSV column) and return a table with per-row verdicts and a CSV / JSON export — the offline answer to "validate this spreadsheet column".
- **Sensitive-output hygiene.** A copy-to-clipboard timer that overwrites the clipboard after a configurable interval (default 60 s, off by default), a masked-by-default rendering for private keys / passphrases / derived secrets with an eye toggle, a "clear everything" action (toolbar button and `Esc Esc`) that invokes the existing `clearSensitiveFields()` path, and a per-tool sensitivity badge driven by one registry so the behaviours cannot drift apart.

No new top-level tool (tool count unchanged). Out of scope, and the §7 non-goal each respects: no recipe / pipeline engine (a different product; keeps "no abstractions for single-use" and the single-file budget), no history or saved sessions (§7.9 no sync / storage of user data — the handoff buffer is in-memory and cleared on navigation away or unload), no URL-encoded inputs for sharing (would put secrets in browser history), no telemetry about which detections fire (§7.8).

## Capabilities

### New Capabilities
- `smart-paste-routing`: classify pasted or dropped content on the home page / palette and offer matching tools, pre-filled.
- `cross-tool-handoff`: a typed in-memory "Send to" mechanism between a result pane and another tool's input.
- `bulk-validation`: one-value-per-line (or CSV column) mode with tabular verdicts and export for the identifier validators.
- `sensitive-output-hygiene`: masked secret rendering, timed clipboard overwrite, global clear, and a single sensitivity registry.

### Modified Capabilities
- none (no OpenSpec baseline exists for the shipped tools yet; the four capabilities above are the baseline for these cross-cutting behaviours).

## Impact

- `index.html`: a `CONTENT_DETECTORS` table (~40 regex / structural detectors with a `confidence` score), a `HANDOFF_TYPES` registry mapping artifact types → accepting tools + input selectors, a `TOOL_SENSITIVITY` registry (which views contain secret inputs / outputs; replaces the ad-hoc selector list inside `clearSensitiveFields()`), a bulk-mode toggle and table renderer shared by five validators, a clipboard-timer utility, ~35 STRINGS keys × 5 locales.
- Reuses: command palette modal and ranking, `TOOL_ORDER` / `RELATED_TOOLS`, `tlsRenderRow` key/value rows, the CSV engine (RFC 4180) for bulk input and export, `clearSensitiveFields()`, Blob download helper.
- No new vendored file; no CSP change; the Clipboard API is already in use (13 `writeText` call sites); page weight +~10 KB gzipped.
- Tests: `tests/specs/NN-workflow.spec.js` — detector vectors (one per type, plus ambiguous cases), palette pre-fill, three handoff pairs (JWT → JWK↔PEM, cert → ASN.1, hash → encode), bulk IBAN with mixed valid / invalid rows + CSV export, masked rendering default, clipboard timer (fake timers), `Esc Esc` clear, and the "nothing persisted" assertion (`localStorage` keys unchanged after a handoff).
