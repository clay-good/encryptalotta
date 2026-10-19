# Spec Delta — creditor-reference-iso11649

## Purpose

Validate and generate ISO 11649 structured creditor references ("RF" references, MOD 97-10 per ISO/IEC 7064) as one shared behaviour used by the payment-QR tool, the SEPA ISO 20022 inspector, and the UBL / CII invoice inspector.

## ADDED Requirements

### Requirement: Validation
The system SHALL accept a candidate reference with or without spaces, SHALL require the form `RF` + two check digits + 1–21 alphanumeric characters (25 characters maximum), and SHALL verify the check digits by moving `RF` + check digits to the end, replacing letters with 10–35, and confirming the integer is ≡ 1 (mod 97).

#### Scenario: EPC069-12 example reference validates
- **WHEN** the reference `RF18539007547034` is checked
- **THEN** the result is valid and the reference is displayed grouped in fours (`RF18 5390 0754 7034`)

#### Scenario: Wrong check digits
- **WHEN** the reference `RF19539007547034` is checked
- **THEN** the result is invalid and the message names ISO 11649 MOD 97-10 and the expected check digits `18`

#### Scenario: Over-long body
- **WHEN** the body after the check digits exceeds 21 characters
- **THEN** the result is invalid with a length reason before any checksum arithmetic

### Requirement: Generation
The system SHALL compute the check digits for a user-supplied 1–21 character alphanumeric body and return the complete `RF` reference, using the same arithmetic as validation.

#### Scenario: Generate from body
- **WHEN** the body `539007547034` is supplied
- **THEN** the generated reference is `RF18539007547034` and validating it immediately returns valid

#### Scenario: Non-alphanumeric body rejected
- **WHEN** the body contains a hyphen or a space
- **THEN** generation is refused and the message lists the permitted character set (A–Z, 0–9; lowercase is upper-cased, not rejected)

### Requirement: Offline operation
Validation and generation SHALL run entirely in the page; the reference SHALL NOT be sent anywhere or stored.

#### Scenario: Input never leaves the page
- **WHEN** a reference is validated or generated while the network log is observed
- **THEN** no request is issued and no storage key is written

### Requirement: Single implementation across tools
The payment-QR tool, the SEPA inspector's `CdtrRefInf` gate, and the UBL inspector's `PaymentID` / `BT-83` check SHALL all produce identical validity results for the same reference.

#### Scenario: Cross-tool agreement
- **WHEN** the same invalid reference is pasted into the payment-QR tool and placed in a pain.001 `<CdtrRefInf><Ref>` element in the SEPA inspector
- **THEN** both report invalid with the same expected check digits
