# Spec Delta — normalization-forms

## Purpose

Show the four Unicode normalization forms of a string side by side (UAX #15) so a reader can see whether two strings that look alike are the same after normalization, and which form changes what.

## ADDED Requirements

### Requirement: Four forms side by side
The tool SHALL compute NFC, NFD, NFKC and NFKD of the input with `String.prototype.normalize` (UAX #15) and SHALL render a table with one row per form showing the result, its code-point count, its UTF-8 byte count, and a changed / unchanged indicator relative to the input.

#### Scenario: Ligature under compatibility forms
- **WHEN** the input is `ﬁ` (U+FB01)
- **THEN** NFC and NFD read unchanged (1 code point), NFKC and NFKD read `fi` (2 code points) marked changed, citing UAX #15 compatibility decomposition

#### Scenario: Hangul syllable decomposition
- **WHEN** the input is `각` (U+AC01)
- **THEN** NFD and NFKD read U+1100 U+1161 U+11A8 (3 code points) marked changed, NFC and NFKC read U+AC01 unchanged, citing UAX #15 §3.12 Hangul algorithmic decomposition

#### Scenario: Already-NFC input
- **WHEN** the input is ASCII `hello`
- **THEN** all four rows read unchanged with identical counts

### Requirement: Copy and hand-off
Each form SHALL have a copy button, and the inspect panel SHALL be able to load any form as its new input so the per-grapheme table can be re-run on the normalized string.

#### Scenario: Re-inspect NFKC
- **WHEN** the user chooses "inspect NFKC" for the input `ﬁ`
- **THEN** the inspect panel shows two rows `U+0066` and `U+0069`

### Requirement: Offline operation
Normalization SHALL run in the page via the engine's built-in tables.

#### Scenario: Input never leaves the page
- **WHEN** the normalization table is computed while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
