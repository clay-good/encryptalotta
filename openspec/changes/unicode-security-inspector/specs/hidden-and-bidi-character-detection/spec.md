# Spec Delta — hidden-and-bidi-character-detection

## Purpose

Flag the character classes that make text read differently from how it is processed — bidirectional controls, zero-width and tag characters, other format, private-use and unassigned code points, non-NFC input, mixed scripts and confusables — as ✓ / ✗ gates, and offer a cleaned copy with a diff of what was removed.

## ADDED Requirements

### Requirement: Bidi control gates
The tool SHALL display independent gate rows for: presence of bidi embeddings / overrides / isolates (U+202A–U+202E, U+2066–U+2069) as ✗ citing UAX #9 and CVE-2021-42574; presence of implicit marks U+200E, U+200F, U+061C as ⚠; and termination, walking a stack per UAX #9 §3.3.2 (PDF closes embeddings and overrides, PDI closes isolates, a line break resets) with any unterminated or cross-terminated control reported as ✗ with its position.

#### Scenario: Trojan Source early-return sample
- **WHEN** the input is a C comment containing U+202E then U+2066 then `}` then U+2069 then U+2066 `if (isAdmin)` U+2069 `begin admins only` (the paper's "early return" pattern)
- **THEN** the embeddings gate is ✗ naming RIGHT-TO-LEFT OVERRIDE at its position, the termination gate is ✗ because the RLO is never closed by a PDF, and the summary line names CVE-2021-42574

#### Scenario: Correct Arabic punctuation is not an error
- **WHEN** the input is Arabic text containing U+200F before a trailing full stop and no embeddings
- **THEN** the embeddings gate is ✓, the marks gate is ⚠ reading "bidi marks present (common in correct Arabic / Hebrew punctuation)", and the termination gate is ✓

### Requirement: Hidden character gates
The tool SHALL display independent gate rows for: zero-width characters U+200B, U+200C, U+200D, U+2060 and U+FEFF at any position other than offset 0; tag characters U+E0000–U+E007F, with the tag payload decoded to ASCII (code point − 0xE0000) and shown; any other Cf code point; private-use code points (Co); unassigned code points (Cn); surrogate halves (Cs).

#### Scenario: Zero-width space inside a word
- **WHEN** the input is `ab` U+200B `cd`
- **THEN** the zero-width gate is ✗ listing U+200B at offset 2, and a leading U+FEFF on a different input is reported as "BOM at start" (⚠) rather than ✗

#### Scenario: Tag-character payload decoded
- **WHEN** the input contains U+E0001 U+E0068 U+E0069 U+E007F
- **THEN** the tag gate is ✗ and the detail reads "tag characters carry the hidden text `hi`" citing Unicode core spec §23.9

### Requirement: Normalization and script gates
The tool SHALL display a gate row ✗ when the input differs from its NFC form (UAX #15), a gate row showing the UTS #39 §5.2 restriction level of the input (ASCII-only, single-script, highly restrictive, moderately restrictive, minimally restrictive, unrestricted; Common and Inherited ignored) with levels below highly restrictive as ✗, and a whole-script confusable gate ✗ when the skeleton (UTS #39 §4, Latin-lookalike subset) of a non-ASCII input is pure ASCII.

#### Scenario: Cyrillic a inside a Latin word
- **WHEN** the input is `p` U+0430 `ypal`
- **THEN** the restriction-level gate reads "unrestricted (Latin + Cyrillic)" ✗ and the confusable gate is ✗ with "looks like `paypal`"

#### Scenario: Japanese text is highly restrictive
- **WHEN** the input mixes Han, Hiragana and Katakana with Latin digits
- **THEN** the restriction-level gate reads "highly restrictive" ✓ citing UTS #39 §5.2

#### Scenario: Decomposed input flagged
- **WHEN** the input is `e` U+0301
- **THEN** the NFC gate is ✗ reading "input is not in NFC (NFC form is 1 code point shorter)" and links to the normalization panel

### Requirement: Clean copy with diff
The tool SHALL offer a cleaned copy from which Cf (including bidi controls and tag characters), Cc other than TAB / LF / CR, Co, Cn and Cs code points are removed, SHALL leave the visible text otherwise byte-identical (no normalization), and SHALL show a code-point-level diff listing each removed character with its name and offset.

#### Scenario: Cleaning removes only hidden characters
- **WHEN** the input is `a` U+200B `ﬁ` U+202E `b`
- **THEN** the clean copy is `aﬁb`, the diff lists U+200B at offset 1 and U+202E at offset 3, and `ﬁ` is unchanged

### Requirement: Verdict language
The tool SHALL phrase an all-✓ result as "no hidden or mixed-script characters found — every code point is visible, assigned, single-script and in NFC" and SHALL NOT describe the text as safe, trusted or clean of injection.

#### Scenario: Clean result wording
- **WHEN** every gate row is ✓
- **THEN** the summary line reads "No hidden or mixed-script characters found. This does not establish that the text is safe to run, paste or trust." and links to the Link Safety Inspector for URLs

### Requirement: Offline operation
The tool SHALL evaluate every gate and produce the clean copy in the page.

#### Scenario: Input never leaves the page
- **WHEN** gates are evaluated while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
