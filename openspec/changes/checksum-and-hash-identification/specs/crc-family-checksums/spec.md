# Spec Delta — crc-family-checksums

## Purpose

Compute cyclic redundancy checks over text or files with a single parametrized engine in the CRC RevEng catalogue model (width, poly, init, refin, refout, xorout), offering the ten common presets and custom parameters, each verified against the catalogue's `check` value for `123456789`.

## ADDED Requirements

### Requirement: Parametrized engine
The tool SHALL compute a CRC from the parameters width (1–64), polynomial (normal form), initial value, reflect-input, reflect-output and final XOR exactly as the CRC RevEng catalogue defines them, using a 256-entry table for reflected widths ≥ 8 and a bitwise loop otherwise, and SHALL render the result as zero-padded hex of width ÷ 4 digits together with the reflected-form polynomial.

#### Scenario: Custom parameters reproduce a preset
- **WHEN** the user enters width 32, poly `04C11DB7`, init `FFFFFFFF`, refin and refout on, xorout `FFFFFFFF` and the text `123456789`
- **THEN** the result is `CBF43926` and the reflected polynomial is shown as `EDB88320`

#### Scenario: Invalid parameter
- **WHEN** the polynomial has more hex digits than the width allows
- **THEN** the computation is refused with a message naming the field and the expected digit count

### Requirement: Catalogue presets
The tool SHALL offer the presets CRC-8, CRC-16/CCITT-FALSE, CRC-16/MODBUS, CRC-16/XMODEM, CRC-16/ARC, CRC-32, CRC-32C, CRC-32/BZIP2, CRC-64/ECMA-182 and CRC-64/XZ with the RevEng parameters, SHALL display each preset's `check` value, and the computed CRC of `123456789` SHALL equal that value: F4, 29B1, 4B37, 31C3, BB3D, CBF43926, E3069283, FC891918, 6C40DF5F0B497347, 995DC9BBDF1939FA.

#### Scenario: CRC-32C check value
- **WHEN** CRC-32C (Castagnoli, poly `1EDC6F41`, reflected `82F63B78`) is selected and the text is `123456789`
- **THEN** the result is `E3069283`

#### Scenario: CRC-16/MODBUS check value
- **WHEN** CRC-16/MODBUS is selected and the text is `123456789`
- **THEN** the result is `4B37` and the detail notes the little-endian byte order Modbus frames carry

#### Scenario: CRC-64/XZ check value
- **WHEN** CRC-64/XZ is selected and the text is `123456789`
- **THEN** the result is `995DC9BBDF1939FA`

### Requirement: Text and file input
The tool SHALL compute the selected CRC over the UTF-8 bytes of the text field or over the bytes of a chosen file using the view's existing input path, SHALL show the byte count, and SHALL show a progress indicator and a ⚠ above 512 MiB.

#### Scenario: Empty input
- **WHEN** the input is empty and CRC-32 is selected
- **THEN** the result is `00000000` and the detail reads "0 bytes"

#### Scenario: File CRC matches zlib
- **WHEN** a file is chosen and CRC-32 selected
- **THEN** the result equals the CRC-32 that `python3 -c "import zlib"` / `crc32` reports for that file (ISO 3309 / RFC 1952 §8)

### Requirement: Integrity-only wording
Every CRC result SHALL carry the banner "integrity only — detects corruption, not tampering" and SHALL NOT describe a matching CRC as proof of authenticity.

#### Scenario: Banner present
- **WHEN** any CRC is displayed
- **THEN** the banner is visible in the result block and links to the PGP Verify and HMAC tools for authentication

### Requirement: Offline operation
CRC computation SHALL run in the page.

#### Scenario: Input never leaves the page
- **WHEN** a file CRC is computed while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)
