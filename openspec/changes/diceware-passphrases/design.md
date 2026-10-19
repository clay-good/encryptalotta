# Design — Diceware passphrases

## Context

The Strong Password Generator (`passwords`) draws characters with `generateSecurePassword(charset, length)` over `crypto.getRandomValues`. The Passphrase Strength Estimator (`strength`) computes `bits ≈ length × log2(alphabet)` in `strengthEstimate()`, applies blocklist and pattern penalties, and converts bits to a crack time at ~10^10 guesses/s in `strengthCrackTime()`. Both already format numbers through `Intl`. There is no word list anywhere on the page.

The EFF lists (2016): the long list has 7,776 entries indexed by five dice (`11111` … `66666`), words of 3–9 letters, no word a prefix of another, average length ≈ 7 letters; short list #1 has 1,296 entries indexed by four dice, words of 3–5 letters. Both files are plain text `dice<TAB>word` lines and are published under CC BY (attribution required; the exact license version is copied from the EFF page at vendoring time). Diceware (Reinhold) assigns each word log2(list size) bits when words are chosen uniformly: 12.925 bits (long), 10.340 bits (short).

## Goals / Non-Goals

**Goals:**
- Uniform word selection with no modulo bias, demonstrably (the sampler is a tested function).
- The dice path is a pure lookup — a sceptical user can reproduce every word from the printed list.
- The estimator stops over-scoring Diceware passphrases by character-class entropy (a six-word lowercase passphrase is ~77.5 bits, not "length 40 × log2(27)").
- The lists ship inline, start-up cost is one `split('\n')`, and the gzipped delta stays around 35 KB.

**Non-Goals:**
- No non-English lists in this change (§7.4: a list is a translation artefact and needs native review).
- No custom user-supplied word lists (the entropy claim depends on list size and uniformity, which the page cannot vouch for).
- No "memorable" tricks (acronyms, substitutions) that reduce entropy while looking stronger.
- No breach-list or dictionary-attack simulation beyond what the estimator already does offline.

## Decisions

1. **Vendor the lists as two inline string constants, newline-separated, in dice order.** `EFF_LONG_WORDS = "abacus\nabdomen\n…"` split once at startup into an array whose index *is* the dice number in base 6 (index = Σ (roll_i − 1) × 6^(k−1−i)). The `dice<TAB>` prefixes are dropped because they are derivable. Rationale: smallest representation, no JSON parse, no fetch, no CSP change. Rejected: a separate `.txt` loaded at runtime (needs `fetch`, forbidden), or a JSON array (quotes and commas cost ~20 KB).
2. **Rejection sampling, 16-bit draws.** For list size N, draw a `Uint16` from `crypto.getRandomValues`, accept if `v < Math.floor(65536 / N) × N` (62,208 for N = 7,776; 64,800 for N = 1,296), return `v % N`; otherwise redraw. Expected rejections: 5.1 % and 1.1 %. Rejected: `v % N` directly (bias of up to 1 in 8.4 for the long list — exactly the bug the proposal exists to avoid) and `Math.random` (not a CSPRNG).
3. **Separator and extras are formatting, not entropy.** The bits shown are words × log2(N) only; the optional capitalisation and appended digit add a labelled "+ up to 3.3 bits (digit)" line and nothing for capitalisation (deterministic). The "random digit" separator option is counted at 3.3 bits per separator because each digit is drawn by the same sampler with N = 10. Rejected: inflating the figure with separator choice — attackers know the format.
4. **Crack-time via the estimator's own function.** `strengthCrackTime(bits)` is called so both tools show identical numbers for identical bits, at the 10^10 guesses/s already documented in the README. Rejected: a second constant.
5. **Dice entry is validated as gate rows and mapped with no randomness.** Input accepts digits 1–6 with optional spaces; rows: digit range, roll count is a multiple of 5 (long) or 4 (short), word count within 4–10. The lookup table shows `roll group → word` using `Intl.ListFormat` for the groups. `crypto.getRandomValues` is never called on this path (asserted by a Playwright spy). Rejected: auto-completing a short roll with software randomness.
6. **Wordlist awareness in the estimator uses the prefix-free property.** Tokenise on the known separators (space, hyphen, period, underscore, digit runs); if every token is a long-list or short-list word, score `tokens × log2(N)`. If there are no separators, run a greedy left-to-right segmentation against the long list — valid because no word is a prefix of another, so a segmentation is unique if it exists. The short list is not prefix-free and is only matched with separators. When recognised, the existing character-class estimate is replaced, not minimised with, and the note reads "recognised as n EFF Diceware words — scored as n × 12.9 bits, not by character classes". Rejected: `Math.min(charEstimate, wordEstimate)` (hides which model applied).
7. **Long passphrases still get the existing penalties.** Repeated words (`correct correct correct`) and sequential dice indices are penalised by the estimator's repeat / sequence checks, applied to the token list rather than characters.
8. **Pure JS throughout; no Web Crypto beyond `getRandomValues`.** Nothing else to decide on the crypto axis.

## Risks / Trade-offs

- **Page weight.** +~35 KB gzipped is the largest data addition since the GS1 prefix table. Measured against the 2 MB budget it is small; the audit script's size gate reports it.
- **List fidelity.** A dropped or reordered line silently changes every dice mapping after it. Mitigation: the Playwright spec asserts list lengths, the EFF's published example rolls, the prefix-free property, and SHA-256 of the joined list against the value computed from the EFF files at vendoring time.
- **License.** CC BY requires attribution; README credit plus an `sbom.json` entry; the exact license version is copied from the EFF page when vendoring (the brief did not confirm it).
- **Over-trust in the estimator's word recognition.** A passphrase of list words with a predictable structure (`password password`) is still weak; the repeat penalty covers the obvious case and the note says the score assumes uniform random selection.
- **Users typing passphrases into the estimator.** Unchanged risk — the estimator is already offline and the README says so; the note about no-network is repeated in the Diceware mode too.
