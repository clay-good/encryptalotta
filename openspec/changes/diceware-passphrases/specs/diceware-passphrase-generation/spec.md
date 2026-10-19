# Spec Delta — diceware-passphrase-generation

## Purpose

Generate Diceware passphrases (Reinhold's method) from the vendored EFF long list (7,776 words) and EFF short list #1 (1,296 words) with uniform, rejection-sampled word selection, formatting options, and an honest entropy and crack-time display, entirely in the browser.

## ADDED Requirements

### Requirement: Vendored word lists
The generator SHALL ship the EFF long list and EFF short list #1 as inline newline-separated strings in dice order, split once at startup, SHALL expose exactly 7,776 and 1,296 words, and the long list SHALL satisfy the EFF's published properties (3–9 letters, no word a prefix of another).

#### Scenario: List sizes and example entries
- **WHEN** the page loads
- **THEN** the long list has 7,776 entries with index 0 = `abacus` and index 7,775 = `zoom`, and the short list has 1,296 entries with index 0 = `acid`

#### Scenario: Prefix-free long list
- **WHEN** every pair of long-list words is checked
- **THEN** no word is a prefix of another, and every word is 3–9 letters

### Requirement: Uniform word selection
The generator SHALL choose each word index by drawing a 16-bit value from `crypto.getRandomValues`, accepting it only when below `floor(65536 / N) × N` (62,208 for the long list, 64,800 for the short list) and reducing modulo N, redrawing otherwise; it SHALL NOT use plain modulo reduction or `Math.random`.

#### Scenario: Rejection threshold
- **WHEN** the sampler is inspected (unit check)
- **THEN** the acceptance bound is 62,208 for N = 7,776 and 64,800 for N = 1,296, and a stubbed draw of 65,000 for the long list is rejected and redrawn

#### Scenario: Uniformity smoke test
- **WHEN** 50,000 indices are drawn for the long list in the Playwright browser
- **THEN** every index is in 0–7,775 and a chi-square over 36 buckets does not reject uniformity at p = 0.001

### Requirement: Passphrase composition
The generator SHALL accept a word count of 4–10, a separator (space, hyphen, period, none, or a random digit drawn by the same sampler with N = 10), optional capitalise-each-word, and optional append-a-digit, and SHALL render the passphrase in the existing output field with the existing copy button.

#### Scenario: Six words with hyphens
- **WHEN** the user selects the long list, 6 words, hyphen separator
- **THEN** the output is six long-list words joined by `-` and nothing else

#### Scenario: Word count bounds
- **WHEN** the user enters 3 or 11 words
- **THEN** the control clamps to 4 or 10 and says so

### Requirement: Entropy and crack-time display
The generator SHALL display bits = words × log2(N) (12.9 per long-list word, 10.3 per short-list word), SHALL add a labelled line for the random-digit separator (3.3 bits each) and appended digit (3.3 bits), SHALL count capitalisation as 0 bits, and SHALL show the crack time at 10^10 guesses/s using the Passphrase Strength Estimator's own function so the two tools agree.

#### Scenario: Six long-list words
- **WHEN** six long-list words are generated with a space separator and no extras
- **THEN** the entropy row reads "77.5 bits (6 × 12.9)" and the crack-time row equals what the estimator shows for 77.5 bits

#### Scenario: Extras are itemised
- **WHEN** the random-digit separator and append-a-digit are both on for 5 words
- **THEN** the rows read "64.6 bits (5 × 12.9)", "+ 13.3 bits (4 digit separators)", "+ 3.3 bits (appended digit)", and capitalisation is listed as "+ 0 bits (deterministic)"

### Requirement: Offline operation
Generation SHALL use only the inline lists and `crypto.getRandomValues`; nothing SHALL be fetched and the passphrase SHALL never be placed in the URL or `localStorage`.

#### Scenario: Input never leaves the page
- **WHEN** passphrases are generated while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
The entropy display SHALL be presented as the entropy of the selection process and SHALL NOT describe the passphrase as unbreakable, safe, or secure.

#### Scenario: Clean result wording
- **WHEN** a passphrase is generated
- **THEN** the note reads "77.5 bits of selection entropy (Diceware, EFF long list). This assumes the words were chosen uniformly by this page; it says nothing about where you store or reuse the passphrase."
