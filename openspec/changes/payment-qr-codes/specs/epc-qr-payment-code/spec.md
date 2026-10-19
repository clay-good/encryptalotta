# Spec Delta — epc-qr-payment-code

## Purpose

Decode, validate, and encode the EPC QR code ("GiroCode") payload that initiates a SEPA Credit Transfer, as defined in EPC069-12 v3.0 "Quick Response Code — Guidelines to Enable the Data Capture for the Initiation of a SEPA Credit Transfer", entirely in the browser.

## ADDED Requirements

### Requirement: Payload decoding
The tool SHALL parse an EPC QR payload consisting of up to twelve elements separated by LF or CRLF, in the fixed order service tag, version, character set, identification code, BIC, beneficiary name, IBAN, amount, purpose, structured remittance (creditor reference), unstructured remittance, and beneficiary-to-originator information, and SHALL render each populated element with its EPC attribute label (AT-23 BIC, AT-21 Name, AT-20 IBAN, AT-04 Amount, AT-44 Purpose, AT-05 Remittance).

#### Scenario: EPC069-12 §2.3 V1 example decodes
- **WHEN** the user pastes the V1 example payload (`BCD` / `001` / `1` / `SCT` / `BHBLDEHHXXX` / `Franz Mustermänn` / `DE71110220330123456789` / `EUR12.3` / `GDDS` / `RF18539007547034` / empty / `Information`)
- **THEN** the result shows version 001, character set UTF-8, BIC `BHBLDEHHXXX`, name `Franz Mustermänn`, IBAN `DE71 1102 2033 0123 4567 89`, amount €12.30, purpose GDDS, creditor reference `RF18539007547034`, and every gate row is ✓

#### Scenario: EPC069-12 §2.3 V2 example decodes with empty BIC
- **WHEN** the user pastes the V2 example (version `002`, character set `2`, empty BIC, name `François D'Alsace S.A.`, IBAN `FR1420041010050500013M02606`, `EUR12.3`, unstructured text `Client:Marie Louise La Lune`)
- **THEN** the BIC row reads "not provided (optional for EEA payments in version 002)", the payload byte count reads 103, and every gate row is ✓

#### Scenario: Trailing separator after the last element is flagged
- **WHEN** the payload ends with a line feed after the last populated element
- **THEN** a ✗ gate row names EPC069-12 §2.2 ("the last populated element is not followed by any element separator") and the rest of the decode still renders

### Requirement: Decoding from a QR image
The tool SHALL accept a PNG, JPEG, or WebP image of an EPC QR code, decode it with the page's own QR image decoder without uploading it, and feed the recovered text through the same payload decoder.

#### Scenario: Image round trip
- **WHEN** the user encodes the V1 example to a QR image, downloads it, and loads that image into the decode panel
- **THEN** the decoded table is identical to the text-path decode of the same payload

#### Scenario: Input never leaves the page
- **WHEN** an image or payload is decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Header and identifier gates
The tool SHALL display independent ✓ / ✗ rows for: service tag equals `BCD`; version is `001` or `002`; character set is a digit 1–8; identification code equals `SCT`; BIC present when version is `001`; BIC, when present, has valid 8- or 11-character ISO 9362 structure; BIC country equals IBAN country; IBAN passes MOD-97 and per-country structure (EPC069-12 §2.2).

#### Scenario: Version 001 without BIC
- **WHEN** the version element is `001` and the BIC element is empty
- **THEN** the BIC-presence gate is ✗ citing "V1: M" in EPC069-12 §2.2, while the same payload with version `002` passes that gate

#### Scenario: Bad IBAN check digits
- **WHEN** the IBAN element is `DE70110220330123456789`
- **THEN** the IBAN gate is ✗ with the MOD-97 reason, and the BIC ↔ IBAN parity gate still evaluates the country letters

### Requirement: Field-content gates
The tool SHALL display independent ✓ / ✗ rows for: beneficiary name 1–70 characters; amount (when present) `EUR` + decimal with at most two fraction digits within 0.01–999999999.99, compared in integer cents; purpose (when present) 1–4 alphanumerics; at most one of structured / unstructured remittance populated; structured remittance ≤ 35 characters and, when it starts with `RF`, valid per ISO 11649; unstructured remittance ≤ 140 characters; beneficiary-to-originator information ≤ 70 characters.

#### Scenario: Oversized amount
- **WHEN** the amount element is `EUR1000000000.00`
- **THEN** the amount gate is ✗ and names the 999999999.99 cap (EPC069-12 §2.2, AT-04)

#### Scenario: Both remittance forms populated
- **WHEN** both the creditor-reference element and the unstructured-text element are non-empty
- **THEN** a ✗ gate row states that only one of the two remittance elements may be populated

### Requirement: Payload-size gate
The tool SHALL measure the payload in bytes of the declared character set (UTF-8 for `1`, the ISO 8859 part for `2`–`8`) and SHALL flag a payload above 331 bytes, the EPC069-12 §2.1 cap that corresponds to QR version 13 at error level M.

#### Scenario: Payload over 331 bytes
- **WHEN** the UTF-8 encoding of the payload exceeds 331 bytes although every individual field is within its character cap
- **THEN** the payload-size gate is ✗ and reports the byte count and the cap

#### Scenario: Multibyte names count as bytes, not characters
- **WHEN** the name `Franz Mustermänn` is present in a UTF-8 payload
- **THEN** the reported payload size counts `ä` as two bytes (the §2.3 V1 example totals 96 bytes for 95 characters)

### Requirement: Payload encoding
The tool SHALL provide a form (version, character set UTF-8 or ISO 8859-1, BIC, name, IBAN, amount, purpose, reference or text, information) that serialises to a conformant payload, runs the same gates, and renders a QR code at error-correction level M with QR version at most 13, offering the payload text and a PNG download.

#### Scenario: Encoding the V1 example reproduces the published sizes
- **WHEN** the user fills the form with the EPC069-12 §2.3 V1 example values
- **THEN** the payload is reported as 96 bytes UTF-8 and the rendered QR is version 6 (41 × 41 modules), matching the document's stated result

#### Scenario: Encoder refuses a non-conformant payload
- **WHEN** any gate is ✗ after serialisation
- **THEN** no QR image is rendered, the payload text is still shown for inspection, and the failing gate rows are listed

#### Scenario: Whitespace normalisation
- **WHEN** a form field contains a line break
- **THEN** it is replaced by a space before serialisation and the user is told, because an embedded separator would shift every following element

### Requirement: Verdict language
The tool SHALL present an all-✓ result as "payload conforms to EPC069-12 v3.0" and SHALL NOT describe the payee, the IBAN, or the payment as safe, verified, or legitimate.

#### Scenario: Clean result wording
- **WHEN** every gate row is ✓
- **THEN** the summary line reads "Conforms to EPC069-12 v3.0 — a SEPA banking app will accept this payload. This does not verify who the payee is." and links to the Link Safety Inspector and IBAN tools
