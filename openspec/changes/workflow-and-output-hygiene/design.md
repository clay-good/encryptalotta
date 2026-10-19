# Design — Workflow and output hygiene

## Context

Navigation is hash-based (`#<tool>`), each view is a static DOM fragment with stable control ids, and the command palette already ranks tools by `tool-id + localized label + TOOL_SYNONYMS`. `clearSensitiveFields()` exists but carries its own hand-maintained selector list; `beforeunload` calls it. Results are rendered with `createElement` / `textContent` through shared helpers (`tlsRenderRow` has ~800 call sites). Clipboard writes use `navigator.clipboard.writeText` in 13 places with no central helper. The site stores exactly two things in `localStorage` (locale, theme) and must keep it that way.

## Goals / Non-Goals

**Goals:**
- Paste anything on the home page and be one click from the right tool with the input filled.
- Move a typed artifact from one result pane to another tool's input without the clipboard.
- Validate hundreds of identifiers at once and export the verdicts.
- Make secret display, clipboard lifetime, and clearing consistent and auditable from one registry.

**Non-Goals:**
- No CyberChef-style recipe chaining or saved pipelines.
- No persistence of inputs, outputs, or handoff buffers across page loads.
- No shareable URLs carrying inputs.
- No detection of *file* contents beyond the existing File Type Identifier magic bytes (drop-to-detect delegates to it).

## Decisions

1. **Detection is a table of pure predicates, not a parser cascade.** `CONTENT_DETECTORS = [{type, test(text) → 0..1, tools: [...]}]`. Each `test` is a regex or a cheap structural check (e.g. three Base64url segments separated by dots; `-----BEGIN`; MOD-97 passes; 26-char Crockford Base32). Confidence lets ambiguous inputs (a 64-hex string is a SHA-256 *or* an Ed25519 key *or* a CBOR blob) list several tools ordered by confidence, never auto-navigate. Rejected alternative: running every tool's parser on paste — slow, and it would run OpenPGP.js on arbitrary text.
2. **Handoff buffer is a single in-memory object cleared on consumption.** `HANDOFF = {type, value, from}`; the target view reads it in its `show()` hook, fills its input, and clears the buffer. Nothing in the URL, nothing in storage, so a handoff cannot outlive the tab. Rejected alternative: `sessionStorage` — survives reloads and is readable by extensions at rest.
3. **Handoff types are a closed registry.** `HANDOFF_TYPES = {pem_certificate: {accepts: ['tls-cert','asn1','pem-der'], selector: id => '#'+id+'-input'}, jwk: [...], hex_digest: [...], xml_ubl: [...], iban: [...], …}`. A result pane declares `data-handoff-type` on its container; the `Send to` menu is built from the registry. Adding a tool means adding it to the registry, which the audit script can check for dangling ids (same pattern as `TOOL_ORDER` ↔ view parity).
4. **Bulk mode reuses the CSV engine, not a new parser.** Input is split by lines; if a line contains the detected delimiter the user picks a column. Output table rows reuse the key/value renderer; export uses the existing RFC 4180 serializer. Verdict per row is the validator's existing result object — no second validation path.
5. **One sensitivity registry.** `TOOL_SENSITIVITY = {<tool>: {inputs: ['#…'], outputs: ['#…'], mask: true|false}}` replaces the selector list inside `clearSensitiveFields()`; the mask toggle, the global clear, the clipboard timer prompt, and the sensitivity badge all read it. Audit gate: every `type="password"` input and every element with `data-secret` must be registered (grep-verifiable, like the `innerHTML` gate).
6. **Clipboard overwrite, not "clear".** Browsers expose no clipboard-clear API; the timer writes a single space, which is the documented behaviour of password managers (KeePassXC, Bitwarden). Off by default (an unexpected overwrite is a worse surprise than a lingering copy); when on, each copy of a registered secret shows a countdown chip. The timer is a `setTimeout` keyed per copy; a new copy cancels the previous timer. Only secret-typed copies are timed — copying a public key or a hash is not.
7. **Masking is CSS + a boolean, never a different string.** Masked rendering uses a `.masked` class with `-webkit-text-security: disc` fallback to a `●` overlay element; the underlying `textContent` is the real value so copy and handoff keep working. Rejected alternative: replacing the text with bullets — breaks copy and introduces a second state to keep in sync.
8. **Global clear is the existing function.** `Esc Esc` (two presses within 500 ms, ignored while a dialog or IME composition is active) and a toolbar button both call `clearSensitiveFields()`, then blank the handoff buffer and cancel clipboard timers. No new clearing logic.
9. **Pure JS; no Web Crypto involved.** Nothing to decide on the crypto axis; the change is UI plumbing.

## Risks / Trade-offs

- **Detector false positives** annoy more than they help if they auto-navigate; hence suggestions only, ranked, dismissible with `Esc`. The vector set includes known ambiguities (hex-64, Base64 that is also valid Base58, a UUID that is also a valid hex string).
- **Handoff registry drift** as tools are added — mitigated by the audit parity check and by making the `Send to` menu degrade to "no compatible tool" rather than throwing.
- **Clipboard permissions.** `writeText` requires a user gesture in some browsers; the timer's overwrite runs without one and may be refused. The chip then says "could not overwrite clipboard — clear it manually" instead of silently failing.
- **Bulk input size.** 10,000 IBAN lines validate in well under a second; the table renderer caps at 2,000 visible rows with a "download the full CSV" note, matching the UUID tool's 1,000-per-click precedent.
- **Masking and screen readers.** Masked outputs carry `aria-label="hidden secret, press to reveal"` on the toggle; the value itself is not announced until revealed. Covered in the a11y spec.
