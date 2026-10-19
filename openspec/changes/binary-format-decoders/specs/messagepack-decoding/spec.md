# Spec Delta — messagepack-decoding

## Purpose

Decode MessagePack bytes to JSON and encode JSON to MessagePack per the MessagePack specification (msgpack/msgpack `spec.md`), including the timestamp extension, rendered through the page's JSON pretty-printer.

## ADDED Requirements

### Requirement: Full format-table decode
The tool SHALL decode every format in the specification's overview table — positive / negative fixint, fixmap, fixarray, fixstr, nil, false, true, bin 8/16/32, ext 8/16/32, float 32/64, uint 8/16/32/64, int 8/16/32/64, fixext 1/2/4/8/16, str 8/16/32, array 16/32, map 16/32 — and SHALL render the result with `jsonPretty()`; `bin` SHALL render as `{"$bin": "<hex>"}`, unknown `ext` as `{"$ext": <type>, "data": "<hex>"}`, and integers beyond 2^53 as strings with a note.

#### Scenario: Specification example
- **WHEN** the input is `82 A7 63 6F 6D 70 61 63 74 C3 A6 73 63 68 65 6D 61 00`
- **THEN** the output is `{"compact": true, "schema": 0}` (the msgpack.org front-page example, 18 bytes)

#### Scenario: Binary field
- **WHEN** the input is `C4 02 FF 00`
- **THEN** the output is `{"$bin": "ff00"}`

#### Scenario: Trailing bytes
- **WHEN** two top-level values are concatenated
- **THEN** both are decoded into a list and a note states the input held 2 values

### Requirement: Timestamp extension
The tool SHALL decode extension type −1 in its 32-bit, 64-bit and 96-bit forms per the specification's "Timestamp extension type" section to an ISO 8601 string with nanoseconds preserved.

#### Scenario: 32-bit timestamp
- **WHEN** the input is `D6 FF 00 00 00 00`
- **THEN** the output is `"1970-01-01T00:00:00Z"`

### Requirement: JSON to MessagePack
The tool SHALL encode a JSON document to MessagePack choosing the smallest format for each value (fixint before uint 8, fixstr before str 8, and so on), emitting strings as `str` never `bin`, and SHALL show the bytes as hex and Base64 with a byte count; decode(encode(x)) SHALL equal x for any JSON value.

#### Scenario: Round trip of the example
- **WHEN** `{"compact": true, "schema": 0}` is encoded
- **THEN** the output is the 18 bytes of the specification example and decoding them reproduces the input

#### Scenario: Size comparison
- **WHEN** a JSON document is encoded
- **THEN** the result shows the JSON byte count beside the MessagePack byte count

### Requirement: Offline operation
The codec SHALL be pure JavaScript in the page.

#### Scenario: Input never leaves the page
- **WHEN** MessagePack is decoded or encoded while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
