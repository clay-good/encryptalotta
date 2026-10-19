# Spec Delta — protobuf-wire-decoding

## Purpose

Decode a Protocol Buffers message without its `.proto` schema, following the Protocol Buffers "Encoding" documentation, and show every plausible interpretation of each field so the reader can recover the structure.

## ADDED Requirements

### Requirement: Tag and wire-type parsing
The tool SHALL read each field tag as a varint, split it into field number (tag ≫ 3) and wire type (tag & 7), SHALL render one row per field with number, wire type name (VARINT 0, I64 1, LEN 2, SGROUP 3, EGROUP 4, I32 5), byte offset and length, SHALL report wire types 3 and 4 as deprecated groups, 6 and 7 as invalid, and SHALL flag field numbers 19000–19999 as reserved.

#### Scenario: Documentation vector
- **WHEN** the input is `08 96 01`
- **THEN** one row reads field 1, VARINT, value 150 (the "Encoding" documentation's first example)

#### Scenario: Truncated message
- **WHEN** the input is `12 07 74 65 73`
- **THEN** the LEN row reports "expected 7 bytes, 3 available" at offset 2 and the hexdump highlights offset 2

### Requirement: Scalar interpretations
For VARINT fields the tool SHALL show unsigned, zigzag-signed (`sint32` / `sint64`) and, when 0 or 1, bool; for I64 fields `fixed64`, `sfixed64` and IEEE 754 double; for I32 fields `fixed32`, `sfixed32` and float; 64-bit values SHALL use BigInt and display via `Intl.NumberFormat`.

#### Scenario: Negative zigzag
- **WHEN** a VARINT field holds `03`
- **THEN** the row shows unsigned 3, zigzag −2, and no bool reading

#### Scenario: Double
- **WHEN** an I64 field holds `00 00 00 00 00 00 F0 3F`
- **THEN** the double reading is 1 and the fixed64 reading is 4607182418800017408

### Requirement: Length-delimited heuristics
For LEN fields the tool SHALL try, in order, nested message (a recursive parse that consumes every byte with valid tags), UTF-8 string (valid UTF-8 without C0 controls other than whitespace), packed repeated varints, and bytes, SHALL label the chosen reading "heuristic", and SHALL keep the hex bytes reachable in every case.

#### Scenario: String vector
- **WHEN** the input is `12 07 74 65 73 74 69 6E 67`
- **THEN** the row reads field 2, LEN, string `testing` (the documentation's second example)

#### Scenario: Nested message
- **WHEN** the input is `1A 03 08 96 01`
- **THEN** field 3 is shown as a nested message containing field 1 VARINT 150, with the alternatives string / bytes available

#### Scenario: Schema import is out of scope
- **WHEN** the user looks for a place to paste a `.proto` definition
- **THEN** the info panel states that schema-driven decoding is out of scope and the decoder is schema-less by design

### Requirement: Offline operation
Decoding SHALL be pure JavaScript in the page.

#### Scenario: Input never leaves the page
- **WHEN** a message is decoded while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
