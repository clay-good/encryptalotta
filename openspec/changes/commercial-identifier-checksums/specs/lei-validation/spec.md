# Spec Delta — lei-validation

## Purpose

Validate the structure and ISO 7064 MOD 97-10 check digits of an ISO 17442 Legal Entity Identifier, singly or one per line, entirely in the browser, without consulting the GLEIF registry.

## ADDED Requirements

### Requirement: Structure
The tool SHALL accept a candidate LEI with or without spaces and in any letter case, SHALL require exactly 20 characters from `A–Z 0–9`, and SHALL split it into the LOU prefix (characters 1–4), the entity-specific part (5–18), and the check digits (19–20), per ISO 17442-1:2020 §5.

#### Scenario: Parts are shown
- **WHEN** the user enters `969500KSV493XWY0PS33`
- **THEN** the result shows prefix `9695`, entity part `00KSV493XWY0PS`, check digits `33`

#### Scenario: Wrong length
- **WHEN** the input has 19 or 21 alphanumerics
- **THEN** the result is invalid with a length reason citing ISO 17442 and no checksum arithmetic is attempted

### Requirement: Check digits
The tool SHALL verify the check digits with ISO/IEC 7064 MOD 97-10 over the full 20 characters (letters mapped A=10 … Z=35; the integer must be ≡ 1 mod 97), SHALL compute the expected digits from the first 18 characters as 98 − (N × 100 mod 97), and SHALL show them on failure. Test vector: payload `969500KSV493XWY0PS` → `33`.

#### Scenario: Valid LEI
- **WHEN** the user enters `969500KSV493XWY0PS33`
- **THEN** the check-digit row is ✓ "MOD 97-10 verifies (ISO 17442 / ISO 7064)"

#### Scenario: Altered digit
- **WHEN** the user enters `969500KSV493XWY0PS34`
- **THEN** the check-digit row is ✗ and names the expected `33`

#### Scenario: Compute from payload
- **WHEN** the user enters the 18-character payload `969500KSV493XWY0PS` in the calculator with MOD 97-10 selected
- **THEN** the computed check digits are `33`

### Requirement: Bulk mode
The tool SHALL accept several identifiers separated by line breaks and SHALL return one table row per line with the normalised value, verdict, and expected check digits on failure, plus a summary count via `Intl.PluralRules`.

#### Scenario: Mixed list
- **WHEN** the input has three lines, two valid LEIs and one with a bad check digit
- **THEN** the table has three rows, the failing row shows its expected digits, and the summary reads "2 valid, 1 invalid"

### Requirement: Registry status is not checked
The result SHALL state that the LEI's registration status (issued, lapsed, retired) and the legal entity behind it are not checked, that the Global LEI Index at GLEIF is the authoritative source, and the tool SHALL make no network request.

#### Scenario: Input never leaves the page
- **WHEN** an LEI is checked while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** the check digits verify
- **THEN** the summary reads "Check digits verify (ISO 17442, MOD 97-10) — this does not establish that the LEI is issued, active, or belongs to the entity you expect; look it up in the GLEIF index"
