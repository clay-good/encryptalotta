# Spec Delta — gs1-location-and-logistics-identifiers

## Purpose

Extend the shipped GS1 / EAN / GTIN tool with the GS1 location and logistics keys GLN, GRAI, GSRN, and GSIN (GS1 General Specifications mod-10 family), and add an EORI format check that states plainly that EORI has no check digit, entirely in the browser.

## ADDED Requirements

### Requirement: GLN
The GS1 tool SHALL accept a 13-digit Global Location Number and verify its check digit with the GS1 General Specifications §7.9 alternating 1-3 mod-10 algorithm (identical to EAN-13), showing the GS1 company-prefix region from the existing inline prefix registry.

#### Scenario: Valid GLN
- **WHEN** the user enters `4012345000009`
- **THEN** the row is ✓ "GLN check digit verifies (GS1 GenSpecs §7.9)" and the prefix region is shown

#### Scenario: Altered GLN
- **WHEN** the user enters `4012345000008`
- **THEN** the row is ✗ naming the expected `9`

### Requirement: GRAI, GSRN, GSIN
The GS1 tool SHALL verify a GRAI (a 14-digit asset-type part with leading `0` plus optional serial up to 16 alphanumerics; mod-10 over the 14 digits), a GSRN (18 digits, mod-10), and a GSIN (17 digits, mod-10), each per GS1 General Specifications §7.9 and the key definitions in §3.

#### Scenario: GSRN
- **WHEN** the user enters an 18-digit value whose mod-10 check digit is correct
- **THEN** the type reads "GSRN (Global Service Relation Number)" and the row is ✓

#### Scenario: GRAI with serial
- **WHEN** the user enters a 14-digit asset part followed by the serial `ABC123`
- **THEN** the check digit is verified over the 14 digits and the serial is shown separately

### Requirement: Type disambiguation with the bizid tool
When a 13-digit input reaches the GS1 tool it SHALL be labelled "GTIN-13 / GLN (same check digit; the GS1 key type depends on where it is used)", and the Business Identifier Checksums tool SHALL link to the GS1 tool for GLN input.

#### Scenario: Shared shape explained
- **WHEN** the user enters 13 digits in the GS1 tool
- **THEN** the result names both GTIN-13 and GLN and the single mod-10 verdict applies to both

### Requirement: EORI format check
The GS1 tool SHALL accept an EORI number, SHALL verify the format as a 2-letter ISO 3166-1 alpha-2 code (or `XI`) followed by 1–15 alphanumerics (EU Implementing Regulation 2015/2447 Annex 12-01), and SHALL state in the result that EORI numbers have no check digit and that registration is not looked up.

#### Scenario: Well-formed EORI
- **WHEN** the user enters `DE123456789012345`
- **THEN** the row is ✓ "format matches Annex 12-01 (DE + 15 alphanumerics) — EORI has no check digit; registration is not checked here"

#### Scenario: Too long
- **WHEN** the user enters a country code followed by 16 alphanumerics
- **THEN** the row is ✗ naming the 15-character cap

### Requirement: Offline operation and verdict language
The GS1 tool SHALL make no network request for the new key types and SHALL phrase a ✓ as the check digit verifying, never as the location, asset, or trader being registered or genuine.

#### Scenario: Input never leaves the page
- **WHEN** a GLN or EORI is checked while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** a GLN check digit verifies
- **THEN** the summary reads "Check digit verifies (GS1 GenSpecs §7.9) — this does not establish that the location is registered with GS1 or who operates it"
