# Spec Delta — physical-dice-entry

## Purpose

Let a user who rolled real dice type the rolls and have the page map them to EFF list words with no software randomness at all, showing every lookup so the result can be checked against the printed list (Diceware, Reinhold; EFF long list five dice per word, short list #1 four dice per word).

## ADDED Requirements

### Requirement: Roll input validation
The tool SHALL accept a sequence of digits 1–6 with optional whitespace, SHALL display gate rows for: only digits 1–6 present; the count is a multiple of 5 (long list) or 4 (short list); the resulting word count is between 4 and 10; and SHALL refuse to map when any row is ✗.

#### Scenario: Valid long-list rolls
- **WHEN** the user enters `11111 66666 31234 45612 23456` with the long list selected
- **THEN** all three rows are ✓ and five words are mapped

#### Scenario: Digit out of range
- **WHEN** the input contains a `7` or a `0`
- **THEN** the digit row is ✗ "dice show 1–6 only" and no word is shown

#### Scenario: Incomplete group
- **WHEN** 23 digits are entered for the long list
- **THEN** the count row is ✗ "23 rolls is not a multiple of 5 — 2 more rolls needed" and no word is shown

### Requirement: Deterministic mapping
The tool SHALL map each group of rolls to the list index Σ (roll_i − 1) × 6^(k−1−i) and display the word at that index, and SHALL NOT call `crypto.getRandomValues` or any other randomness on this path.

#### Scenario: EFF example rolls
- **WHEN** `11111` is entered for the long list and `1111` for the short list
- **THEN** the words are `abacus` and `acid` respectively, matching the EFF files' first lines

#### Scenario: Last entry
- **WHEN** `66666` is entered for the long list
- **THEN** the word is `zoom`

#### Scenario: No software randomness
- **WHEN** the mapping runs with `crypto.getRandomValues` instrumented by the test
- **THEN** the function is called zero times

### Requirement: Verifiable lookup display
The tool SHALL show a table with one row per word: the roll group as typed and the mapped word, so the user can compare each against the printed EFF list, and SHALL show the assembled passphrase with the selected separator and formatting options.

#### Scenario: Lookup table
- **WHEN** five valid groups are mapped
- **THEN** five rows read `<rolls> → <word>` in order, followed by the assembled passphrase

#### Scenario: Entropy note for dice
- **WHEN** the dice passphrase is assembled
- **THEN** the entropy row reads "n × 12.9 bits if the dice were fair and rolled honestly — the page did not choose these words"

### Requirement: Offline operation
The mapping SHALL use only the inline lists; rolls and words SHALL never be placed in the URL or `localStorage` and nothing SHALL be fetched.

#### Scenario: Input never leaves the page
- **WHEN** rolls are mapped while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
The tool SHALL present the result as a lookup and SHALL NOT describe the passphrase as secure or safe.

#### Scenario: Clean result wording
- **WHEN** the lookup completes
- **THEN** the note reads "Mapped from your rolls by table lookup (EFF long list). This does not assess how or where you use the passphrase."
