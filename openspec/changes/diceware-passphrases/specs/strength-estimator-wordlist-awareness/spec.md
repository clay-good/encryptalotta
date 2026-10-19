# Spec Delta — strength-estimator-wordlist-awareness

## Purpose

Make the Passphrase Strength Estimator recognise passphrases built from EFF Diceware list words and score them by word count × log2(list size) instead of character-class entropy, so a six-word passphrase is reported at ~77.5 bits rather than an inflated character estimate.

## ADDED Requirements

### Requirement: List-word recognition
The estimator SHALL tokenise the input on space, hyphen, period, underscore, and digit runs and SHALL recognise a Diceware passphrase when every token is a word of the EFF long list or of the EFF short list #1; for input without separators it SHALL attempt a greedy left-to-right segmentation against the prefix-free long list only.

#### Scenario: Separated long-list words
- **WHEN** `abacus-zoom-acid-wafer-kiosk-plaza` style input of six long-list words is entered
- **THEN** the model row reads "word-list model: 6 EFF long-list words"

#### Scenario: Unseparated long-list words
- **WHEN** six long-list words are concatenated without separators
- **THEN** the greedy segmentation recovers the six words (the long list is prefix-free) and the model row is the same

#### Scenario: Mixed input falls back
- **WHEN** one token is not on either list
- **THEN** the estimator uses its existing character-class model and no word-list row is shown

### Requirement: Word-count scoring
When recognised, the estimator SHALL set bits = words × 12.9 (long list) or words × 10.3 (short list), SHALL add 3.3 bits per digit run used as a separator or suffix, SHALL ignore capitalisation, and SHALL apply the existing repeat and sequence penalties to the token list.

#### Scenario: Six words scored
- **WHEN** six distinct long-list words are entered with spaces
- **THEN** the bits row reads "77.5 bits (6 × 12.9)" and the crack time matches the generator's display for the same passphrase

#### Scenario: Repeated word penalised
- **WHEN** the same list word appears three times in a five-word input
- **THEN** the repeat penalty row applies and the bits are reduced below 64.6 with the reason stated

### Requirement: Explanatory note
The estimator SHALL show a note explaining that the score assumes the words were chosen uniformly at random from the list, that character-class entropy would overstate the strength, and which list was matched.

#### Scenario: Note text
- **WHEN** a Diceware passphrase is recognised
- **THEN** the note reads "Recognised as 6 EFF long-list words — scored as 6 × 12.9 bits, not by character classes. The score assumes uniform random selection; a passphrase you composed yourself is weaker."

### Requirement: Offline operation
Recognition SHALL use only the inline lists; the passphrase SHALL never leave the page.

#### Scenario: Input never leaves the page
- **WHEN** a passphrase is scored while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
The word-list score SHALL be presented as an estimate under a stated model and SHALL NOT describe the passphrase as safe or uncrackable.

#### Scenario: Clean result wording
- **WHEN** a recognised passphrase scores 4 of 4
- **THEN** the summary reads "Strong under the word-list model (77.5 bits, ~10^10 guesses/s). This does not account for reuse, phishing, or where the passphrase is stored."
