# Spec Delta — securities-identifier-validation

## Purpose

Validate ISIN (ISO 6166), CUSIP (ANSI X9.6), and SEDOL check digits, check the ISIN country prefix, and derive an ISIN from a CUSIP or SEDOL, entirely in the browser.

## ADDED Requirements

### Requirement: ISIN structure and prefix
The tool SHALL require an ISIN of 12 characters: a two-letter prefix, a nine-character alphanumeric NSIN, and one check digit, and SHALL display a ✓ / ✗ row that the prefix is an ISO 3166-1 alpha-2 code or one of the ISO 6166 special prefixes `XS`, `EU`, `QS`, `QT`.

#### Scenario: Prefix check
- **WHEN** the user enters `ZZ0378331005`
- **THEN** the prefix row is ✗ ("ZZ is not an ISO 3166-1 code or an ISO 6166 special prefix") and the check-digit row still evaluates

### Requirement: ISIN check digit
The tool SHALL verify the ISIN check digit with the Luhn algorithm applied after expanding each letter to its two-digit value (A=10 … Z=35) as described in ISO 6166, and SHALL show the expected digit on failure. Test vector: `US0378331005` is valid.

#### Scenario: Apple ISIN
- **WHEN** the user enters `US0378331005`
- **THEN** the check-digit row is ✓ "Luhn over expanded digits verifies (ISO 6166)"

#### Scenario: Altered digit
- **WHEN** the user enters `US0378331006`
- **THEN** the check-digit row is ✗ and names the expected `5`

### Requirement: CUSIP check digit
The tool SHALL verify a 9-character CUSIP per ANSI X9.6: values 0–9 for digits, 10–35 for letters, 36 / 37 / 38 for `*` / `@` / `#`; every second value doubled; digit-sum of each value accumulated; check = (10 − sum mod 10) mod 10. Test vector: `037833100` is valid.

#### Scenario: Apple CUSIP
- **WHEN** the user enters `037833100`
- **THEN** the check-digit row is ✓ and the derived ISIN `US0378331005` is shown

#### Scenario: Bad CUSIP
- **WHEN** the user enters `037833101`
- **THEN** the row is ✗ naming the expected `0`

### Requirement: SEDOL check digit
The tool SHALL verify a 7-character SEDOL with weights 1, 3, 1, 7, 3, 9 over the first six characters (letters A=10 … Z=35; vowels not permitted), check = (10 − sum mod 10) mod 10, per the London Stock Exchange SEDOL Masterfile specification. Test vector: `B0YBKJ7` is valid.

#### Scenario: Valid SEDOL
- **WHEN** the user enters `B0YBKJ7`
- **THEN** the row is ✓ and the derived ISIN `GB00B0YBKJ77` is shown

#### Scenario: Vowel in SEDOL
- **WHEN** the user enters `B0YBKE7`
- **THEN** a ✗ row states that SEDOLs do not contain vowels, before the weighted sum is reported

### Requirement: ISIN derivation
The tool SHALL derive an ISIN from a valid CUSIP as `US` + CUSIP + Luhn check digit, and from a valid SEDOL as `GB00` + SEDOL + Luhn check digit, and SHALL conversely extract and validate the embedded CUSIP or SEDOL from a `US` or `GB` ISIN whose NSIN has the matching shape (ISO 6166, national numbering agency conventions).

#### Scenario: ISIN to CUSIP
- **WHEN** the user enters `US0378331005`
- **THEN** the result shows "embedded CUSIP `037833100` — check digit valid"

#### Scenario: ISIN to SEDOL
- **WHEN** the user enters `GB00B0YBKJ77`
- **THEN** the result shows "embedded SEDOL `B0YBKJ7` — check digit valid"

### Requirement: Offline operation and verdict language
The tool SHALL make no network request and SHALL state that a verifying check digit does not establish that the security exists, is listed, or is the one the user expects; the national numbering agency or ANNA is the source.

#### Scenario: Input never leaves the page
- **WHEN** an ISIN, CUSIP, or SEDOL is checked while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every row is ✓
- **THEN** the summary reads "Check digits verify (ISO 6166 / ANSI X9.6 / SEDOL) — this does not establish that the instrument exists or is the one you expect"
