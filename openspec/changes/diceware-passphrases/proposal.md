# Proposal — Diceware passphrases (EFF word lists, physical dice, wordlist-aware strength)

## Why

The Strong Password Generator makes random character strings; the Passphrase Strength Estimator scores what you type. Neither can do the thing security guidance from the EFF, NIST SP 800-63B (memorized secrets), and every password-manager vendor actually recommends for the few passwords a human must remember: a Diceware passphrase (Arnold Reinhold's method) of five or six words drawn uniformly from a published list. The EFF long list (7,776 words, 12.9 bits each, five dice, 3–9 letters, no word a prefix of another) and the EFF short list #1 (1,296 words, four dice) are the de-facto lists; both are CC BY. People currently use online generators — which choose their master password for them on someone else's server — or roll dice and look words up in a 100-page PDF. The page already has `crypto.getRandomValues`, the entropy / crack-time arithmetic in `strengthEstimate()` and `strengthCrackTime()`, `Intl.NumberFormat`, and a 2 MB gzipped budget with room for a 30 KB word list.

## What Changes

- **Extends the shipped Strong Password Generator (`passwords`) and Passphrase Strength Estimator (`strength`); no new top-level tool.** No OpenSpec baseline exists for either yet, so the additions are written as new capabilities.
- **Diceware generation**: a "Passphrase (Diceware)" mode next to the character mode; EFF long list and EFF short list #1 vendored as inline newline-separated strings split at startup (no fetch); 4–10 words; separator (space, hyphen, period, none, random digit); optional capitalise-each-word and append-a-digit; entropy shown as bits = words × log2(list size) and as crack time at 10^10 guesses/s via the estimator's own function; word indices drawn with `crypto.getRandomValues` and rejection sampling, never modulo.
- **Physical dice entry**: type real dice rolls (1–6), five per word for the long list or four for the short list; the page maps rolls to words with zero software randomness and shows each roll group beside its word so the user can check it against the printed EFF list.
- **Wordlist-aware strength**: the Passphrase Strength Estimator recognises a passphrase made of list words (separated, or unseparated for the prefix-free long list) and scores it as word count × 12.9 bits (long) or × 10.3 bits (short) instead of character-class entropy, with a note explaining why.
- README gains the CC BY attribution for the EFF lists; `sbom.json` lists them as vendored data.

Out of scope, and the §7 non-goal each respects: no other languages' word lists in this change (translation quality > breadth, §7.4 — a French or German list ships only with a native reviewer's sign-off on the list itself); no breach-list lookup (§0.1 / §0.2 — the estimator stays fully offline, as its README entry promises); no "save my passphrase" (§7.9); no PGP / age passphrase auto-fill from the generator (clipboard hygiene is the user's; the existing copy button is enough); no password-manager export format.

## Capabilities

### New Capabilities
- `diceware-passphrase-generation`: Diceware passphrases from the vendored EFF long and short lists with uniform, rejection-sampled word selection, formatting options, and entropy / crack-time display.
- `physical-dice-entry`: deterministic roll-to-word mapping for user-entered dice rolls with a verifiable lookup display and no software randomness.
- `strength-estimator-wordlist-awareness`: list-word recognition in the Passphrase Strength Estimator with per-word entropy scoring and an explanatory note.

### Modified Capabilities
- none (the character-mode generator and the estimator's existing scoring are unchanged for inputs that are not list passphrases).

## Impact

- `index.html`: ~250 lines of inline JS (list constants, rejection sampler, formatter, dice mapper, greedy prefix-free segmenter, estimator hook) plus two inline string constants: the EFF long list (~62 KB raw, ~30 KB gzipped) and short list #1 (~7 KB raw, ~4 KB gzipped); ~30 STRINGS keys × 5 locales (no new SEO keys — no new tool). Word lists themselves are English and not translated.
- Reuses: `crypto.getRandomValues` (via the generator's existing random path), `strengthEstimate()` / `strengthCrackTime()` and the 10^10 guesses/s constant, `Intl.NumberFormat` for bits and large numbers, `Intl.ListFormat` for the roll groups, STRINGS i18n table, the SEPA / UBL gate-row style for the dice-entry validation rows.
- No new vendored script, no CSP change; page weight +~35 KB gzipped against the 2 MB budget (current build is well under 1 MB).
- Tests: new `tests/specs/34-diceware.spec.js` (number assigned at implementation) — list sizes 7,776 and 1,296, every long-list word 3–9 letters and prefix-free, the EFF's own example roll `11111 → abacus` and short-list `1111 → acid`, uniformity smoke test over 50,000 draws (chi-square sanity, no index ≥ list length), rejection threshold check, entropy arithmetic, dice-entry validation (bad digit, wrong count), estimator scoring of a six-word passphrase at 77.5 bits with the note, and the network-silence assertion the suite already uses.
