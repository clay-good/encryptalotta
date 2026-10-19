# Spec Delta — generic-check-digit-calculators

## Purpose

Compute and verify check digits for arbitrary input with Luhn, ISO/IEC 7064 MOD 11-2, MOD 37-2, MOD 97-10, MOD 11,10, Verhoeff, and Damm, as the shared engines behind the identifier validators and as a fixture tool for developers, entirely in the browser.

## ADDED Requirements

### Requirement: Luhn
The calculator SHALL compute and verify the Luhn check digit (ISO/IEC 7812-1 Annex B) over a digit string. Test vector: body `7992739871` → `3`.

#### Scenario: Compute
- **WHEN** the user selects Luhn and enters `7992739871`
- **THEN** the computed check digit is `3` and the full value `79927398713` is shown

#### Scenario: Verify
- **WHEN** the user verifies `79927398714`
- **THEN** the result is ✗ naming the expected `3`

### Requirement: ISO 7064 pure systems
The calculator SHALL implement ISO/IEC 7064:2003 MOD 11-2 (digits, check `0–9` or `X`), MOD 37-2 (alphanumerics, check `0–9`, `A–Z`, or `*`), and MOD 97-10 (two-digit check), using the recursive single-pass method so no BigInt is needed. Test vectors from the standard's examples: `079` → `X` (MOD 11-2), `G123489654321` → `Y` (MOD 37-2), `794` → `44` (MOD 97-10).

#### Scenario: MOD 11-2
- **WHEN** the user selects MOD 11-2 and enters `079`
- **THEN** the computed check character is `X`

#### Scenario: MOD 37-2
- **WHEN** the user selects MOD 37-2 and enters `G123489654321`
- **THEN** the computed check character is `Y`

#### Scenario: MOD 97-10
- **WHEN** the user selects MOD 97-10 and enters `794`
- **THEN** the computed check digits are `44`, and the same engine is the one the LEI and IBAN validators call

### Requirement: ISO 7064 hybrid system MOD 11,10
The calculator SHALL implement ISO/IEC 7064:2003 MOD 11,10 (the hybrid system used by the German VAT number and Steuer-ID — the latter is not validated on this site, §7.1). Test vector from the standard: `079` → `2`.

#### Scenario: MOD 11,10
- **WHEN** the user selects MOD 11,10 and enters `079`
- **THEN** the computed check digit is `2`, and the result carries the note that the VAT tool already applies this algorithm for DE / HR

### Requirement: Verhoeff and Damm
The calculator SHALL implement the Verhoeff algorithm (dihedral group D5 multiplication, permutation, and inverse tables) and the Damm algorithm (the published 10 × 10 totally anti-symmetric quasigroup table), compute and verify. Test vectors: Verhoeff `236` → `3`; Damm `572` → `4`.

#### Scenario: Verhoeff
- **WHEN** the user selects Verhoeff and enters `236`
- **THEN** the computed check digit is `3` and verifying `2363` is ✓

#### Scenario: Damm
- **WHEN** the user selects Damm and enters `572`
- **THEN** the computed check digit is `4` and verifying `5724` is ✓

### Requirement: Input handling and personal-identifier boundary
The calculator SHALL accept input with spaces and hyphens (stripped), SHALL reject characters outside the selected algorithm's alphabet with a message naming the alphabet, and SHALL carry a fixed note that it never identifies or labels a national identity number (SPEC-INTERNATIONAL §7.1), even when the arithmetic would apply.

#### Scenario: Alphabet mismatch
- **WHEN** the user selects Luhn and enters `12A4`
- **THEN** the result is refused with "Luhn accepts digits only"

#### Scenario: Boundary note is always present
- **WHEN** any calculator result is rendered
- **THEN** the panel shows the §7.1 note and no national-ID name appears in any label

### Requirement: Offline operation and verdict language
The calculator SHALL make no network request and SHALL phrase a successful verification as "check digit verifies", never as the underlying number being valid, issued, or genuine.

#### Scenario: Input never leaves the page
- **WHEN** a value is computed or verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** verification succeeds
- **THEN** the row reads "Check digit verifies (<algorithm>, ISO/IEC 7064 / Luhn / Verhoeff / Damm) — arithmetic only; this does not establish that the number is assigned or what it identifies"
