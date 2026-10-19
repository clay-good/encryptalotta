# Spec Delta — hexdump-and-entropy-view

## Purpose

Show any byte sequence as an `xxd`-style hexdump with byte statistics — frequency histogram, windowed Shannon entropy, extracted strings and a magic-byte hint — so a reader can tell text from structure from ciphertext before choosing a decoder.

## ADDED Requirements

### Requirement: Input acceptance
The tool SHALL accept hex (with or without spaces, `0x`, or colons), Base64 and Base64url (RFC 4648 §4 / §5), a `data:` URI, or a dropped file, SHALL detect the form by alphabet with a manual override, and SHALL report the resulting byte count.

#### Scenario: Base64 auto-detected
- **WHEN** the user pastes `CJYB`
- **THEN** the input is read as 3 bytes `08 96 01` and the detection label reads Base64

#### Scenario: Ambiguous short input
- **WHEN** the user pastes `CAFE`
- **THEN** both hex (2 bytes) and Base64 (3 bytes) readings are offered and the hex reading is used until the user picks

### Requirement: Hexdump layout
The tool SHALL render rows of 16 bytes (8 selectable) with an 8-digit hex offset, two-digit hex bytes grouped as `xxd` does, and an ASCII column where bytes 0x20–0x7E print and all others show `.`; rows above 64 KiB SHALL be rendered on demand.

#### Scenario: Canonical row
- **WHEN** the input is the 16 ASCII bytes `hello, world!\n\0\xff`
- **THEN** the single row reads offset `00000000`, hex `6865 6c6c 6f2c 2077 6f72 6c64 210a 00ff`, ASCII `hello, world!...`

#### Scenario: One-megabyte input stays responsive
- **WHEN** a 1 MiB random file is dropped
- **THEN** the first screen of rows renders within the 08-stress budget and scrolling reveals further rows

### Requirement: Entropy and histogram
The tool SHALL compute Shannon entropy in bits per byte over consecutive 256-byte windows and the whole input, SHALL render the windows as a strip aligned with the dump labelled low (≤ 4), medium, or high (≥ 7.5, "compressed / encrypted / random"), and SHALL render a 256-bar byte-frequency histogram.

#### Scenario: Random versus text
- **WHEN** the input is 4 KiB from `crypto.getRandomValues`
- **THEN** every window is labelled high and the whole-input entropy is ≥ 7.9; for 4 KiB of English text every window is labelled low or medium

### Requirement: Strings and magic hint
The tool SHALL list ASCII runs (0x20–0x7E) and UTF-16LE runs of at least 4 characters with their offsets, as `strings -a` / `strings -el` do, capped at 10,000 hits, and SHALL show the File Type Identifier's magic-byte verdict for the leading bytes.

#### Scenario: UTF-16 string found
- **WHEN** the input contains `h\0i\0!\0!\0`
- **THEN** the strings list shows `hi!!` tagged UTF-16LE at its offset

#### Scenario: Magic hint
- **WHEN** the input begins `89 50 4E 47 0D 0A 1A 0A`
- **THEN** the hint reads PNG and links to the File Type Identifier

### Requirement: Offline operation
The dump and statistics SHALL be computed in the page.

#### Scenario: Input never leaves the page
- **WHEN** a file is dumped while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)
