# Spec Delta — publication-identifier-validation

## Purpose

Validate ISBN-10, ISBN-13, ISMN, and ISSN check digits, convert between ISBN forms, derive the ISSN EAN-13, and hint at ISBN hyphenation, entirely in the browser.

## ADDED Requirements

### Requirement: ISBN-13 and ISMN
The tool SHALL accept an ISBN-13 (prefix `978` or `979`) or an ISMN (`979-0`) with or without hyphens and SHALL verify the EAN mod-10 check digit (weights 1, 3 alternating; ISO 2108:2017 Annex, ISO 10957:2009). Test vector: `9780306406157` is valid.

#### Scenario: Valid ISBN-13
- **WHEN** the user enters `978-0-306-40615-7`
- **THEN** the row is ✓ and the normalised value `9780306406157` is shown

#### Scenario: Altered ISBN-13
- **WHEN** the user enters `9780306406158`
- **THEN** the row is ✗ naming the expected `7`

#### Scenario: ISMN recognised
- **WHEN** the user enters `9790060115615`
- **THEN** the type reads "ISMN (music publication, ISO 10957)" and the EAN check digit is verified

### Requirement: ISBN-10
The tool SHALL accept an ISBN-10 with or without hyphens, SHALL verify the mod-11 check digit (weights 10 … 2, check `X` for 10; ISO 2108 pre-2007 form), and SHALL show the expected character on failure. Test vector: `0306406152` is valid.

#### Scenario: Valid ISBN-10
- **WHEN** the user enters `0-306-40615-2`
- **THEN** the row is ✓ and the converted ISBN-13 `9780306406157` is shown

#### Scenario: X check character
- **WHEN** the user enters an ISBN-10 whose correct check character is `X` with a digit in its place
- **THEN** the row is ✗ naming the expected `X`

### Requirement: ISBN conversion and hyphenation hint
The tool SHALL convert ISBN-10 → ISBN-13 (`978` + nine digits + EAN check) and ISBN-13 → ISBN-10 only when the prefix is `978` (ISO 2108 §5: `979` ISBNs have no ten-digit form), and SHALL show a hyphenated form when the registration group and publisher range are in the inline range table, otherwise "hyphenation not determined".

#### Scenario: 979 has no ISBN-10
- **WHEN** the user enters `9791032305690`
- **THEN** the conversion row reads "no ISBN-10 equivalent (979 prefix)"

#### Scenario: Hyphenation known
- **WHEN** the user enters `9780306406157`
- **THEN** the hint reads `978-0-306-40615-7` with the registration group named "English language (0)"

### Requirement: ISSN
The tool SHALL accept an ISSN as `nnnn-nnnX` or eight characters, SHALL verify the mod-11 check digit (weights 8 … 2, `X` for 10; ISO 3297:2020), and SHALL derive the EAN-13 as `977` + the seven ISSN digits + a two-digit sequence variant (default `00`, editable) + EAN check. Test vector: `0378-5955` is valid; its EAN-13 with variant `00` is `9770378595002`.

#### Scenario: Valid ISSN
- **WHEN** the user enters `0378-5955`
- **THEN** the row is ✓ and the EAN-13 row shows `9770378595002`

#### Scenario: Altered ISSN
- **WHEN** the user enters `0378-5956`
- **THEN** the row is ✗ naming the expected `5`

#### Scenario: EAN-13 back to ISSN
- **WHEN** the user enters `9770378595002`
- **THEN** the type reads "ISSN as EAN-13" and the embedded ISSN `0378-5955` is shown as valid

### Requirement: Offline operation and verdict language
The tool SHALL make no network request and SHALL state that a verifying check digit does not establish that the publication exists or that the number was assigned by an ISBN / ISSN agency.

#### Scenario: Input never leaves the page
- **WHEN** an ISBN or ISSN is checked while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every row is ✓
- **THEN** the summary reads "Check digit verifies (ISO 2108 / ISO 3297) — this does not establish that the number was assigned or which publication it names"
