# Tasks — Diceware passphrases

## 1. Word-list data

- [ ] 1.1 Download the EFF long list and short list #1, strip the `dice<TAB>` prefixes, verify 7,776 / 1,296 lines, the prefix-free property of the long list, and letter-length ranges; record SHA-256 of each joined list in a comment and in the test.
- [ ] 1.2 Inline constants `EFF_LONG_WORDS` / `EFF_SHORT_WORDS` (newline-separated, dice order) split once at startup into `EFF_LONG` / `EFF_SHORT` arrays; `sbom.json` entries for the two data lists with license and source URL.

## 2. Generation engine

- [ ] 2.1 `dicewareIndex(listSize)` — 16-bit `crypto.getRandomValues` draws with rejection below `floor(65536 / N) × N`; `dicewareWords(list, count)`.
- [ ] 2.2 `dicewareFormat(words, {separator, capitalize, appendDigit})` with digit draws through the same sampler (N = 10); `dicewareBits(count, listSize, extras)`; crack time via `strengthCrackTime()`.
- [ ] 2.3 `dicewareFromRolls(rolls, list)` — validate digits 1–6, group size 5 / 4, 4–10 words; map base-6 index → word; return gate rows and the `roll → word` table; never calls `getRandomValues`.
- [ ] 2.4 Node-side check: list sizes, `11111 → abacus`, `66666 → zoom`, short `1111 → acid`, 50,000-draw uniformity smoke test, rejection-threshold constant, entropy arithmetic (6 words long = 77.5 bits; 8 words short = 82.7 bits).

## 3. Estimator hook

- [ ] 3.1 `strengthRecogniseDiceware(pw)` — separator tokenisation (space, hyphen, period, underscore, digit runs) against both lists; separator-less greedy segmentation against the long list only; returns `{list, words}` or null.
- [ ] 3.2 In `strengthEstimate()`: when recognised, bits = words × log2(N) with repeat / sequence penalties applied to the token list; add the explanatory note; leave non-matching inputs unchanged.
- [ ] 3.3 Node-side check: six long-list words scored 77.5 bits with note; `correcthorsebatterystaple`-style unseparated input segmented when all parts are list words; mixed input falls back to the character model.

## 4. View

- [ ] 4.1 In `#passwords-view`: mode toggle `#passwords-mode` (characters / Diceware); Diceware panel with `#passwords-wordlist` (long / short), `#passwords-wordcount` (4–10), `#passwords-separator`, `#passwords-capitalize`, `#passwords-digit`, `#btn-passwords-generate` (shared), output in the existing field with the existing copy button, entropy and crack-time rows in `#passwords-results`.
- [ ] 4.2 Dice panel: `#passwords-dice` textarea, `#btn-passwords-dice-lookup`, gate rows in `#passwords-gates`, lookup table (`Intl.ListFormat` for roll groups) in `#passwords-results`.
- [ ] 4.3 In `#strength-view`: the Diceware note row and the model label ("word-list model" vs "character model") in the existing results block.
- [ ] 4.4 Info panel: Diceware method (Reinhold), EFF list facts, CC BY attribution line, uniform-sampling note, offline statement.

## 5. Tests

- [ ] 5.1 `tests/specs/34-diceware.spec.js` (number assigned at implementation): list sizes and SHA-256, prefix-free property, EFF example rolls, uniformity smoke test, rejection constant, generation with each separator and option, entropy and crack-time rows, dice-entry validation rows (bad digit, wrong count, too many words), `getRandomValues` spy asserting zero calls on the dice path, estimator scoring and note, mixed-input fallback, network-silence assertion, XSS payload in the dice field rendered inert.
- [ ] 5.2 Existing `passwords` / `strength` entries in 00-introspect, 05-a11y, 08-stress, 11-xss rosters extended with the new controls.

## 6. Wiring and gates

- [ ] 6.1 ~30 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts); no new SEO keys (no new tool); CLDR plural groups for "n words" and "n bits".
- [ ] 6.2 TOOL_SYNONYMS additions on `passwords` (`diceware passphrase eff wordlist dice words`) and `strength` (`diceware wordlist`), RELATED_TOOLS (`passwords` ↔ `strength` ↔ `bip39`), JSON-LD featureList text update; audit gate 20 tool count unchanged at 57; audit size gate records the +~35 KB.
- [ ] 6.3 README: Strong Password Generator and Passphrase Strength Estimator paragraphs extended, CC BY attribution for the EFF word lists in the credits / licenses section, standards cheat sheet row (Diceware / EFF lists / NIST SP 800-63B memorized secrets); SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
