# Spec Delta — punycode-and-idna-conversion

## Purpose

Convert internationalized domain names between their Unicode (U-label) and ASCII-compatible (`xn--` A-label) forms per RFC 3492, in both directions, and report the structural IDNA 2008 / UTS #46 label rules the name meets or breaks.

## ADDED Requirements

### Requirement: Punycode encoding and decoding
The tool SHALL encode a Unicode label to Punycode and decode a Punycode label to Unicode per RFC 3492 §6.3 / §6.2 with the parameters of §5 (base 36, tmin 1, tmax 26, skew 38, damp 700, initial bias 72, initial n 128), reusing the decoder shipped in the Link Safety Inspector and adding the encoder beside it.

#### Scenario: RFC 3492 §7.1 sample strings
- **WHEN** each of the eleven sample strings A–K of RFC 3492 §7.1 is encoded and its published Punycode decoded
- **THEN** every encoding equals the published Punycode (for example sample J, the Japanese "3B" string, encodes to `3B-ww4c5e180e575a65lsy2b`) and every decode reproduces the sample code points

#### Scenario: Case-insensitive decode
- **WHEN** the input label is `XN--MAANA-PTA`
- **THEN** it decodes to `mañana` and the output notes that Punycode digits are case-insensitive (RFC 3492 §5)

### Requirement: Whole domain names
The tool SHALL accept a full domain name, split it on `.` and the UTS #46 §4 dot equivalents U+3002, U+FF0E, U+FF61, NFC-normalize and lower-case each label, pass ASCII labels through unchanged, prefix encoded labels with `xn--`, and SHALL offer the reverse direction producing the Unicode form.

#### Scenario: Mixed name to ASCII
- **WHEN** the input is `bücher.example`
- **THEN** the ASCII form reads `xn--bcher-kva.example` and the Unicode form of that result reads `bücher.example`

#### Scenario: Full-width dot and letters
- **WHEN** the input is `ｅｘａｍｐｌｅ。com`
- **THEN** the labels are NFKC-mapped to `example.com` and the result notes the UTS #46 mapping step

### Requirement: Structural IDNA gates
The tool SHALL display independent ✓ / ✗ rows per label for: `xn--` prefix only on labels whose body decodes (RFC 5891 §4.2.3.1); no hyphens in positions 3–4 of a U-label and no leading or trailing hyphen (RFC 5891 §4.2.3.1); label ≤ 63 octets and name ≤ 253 octets (RFC 1035 §2.3.4); first character not a combining mark (RFC 5891 §4.2.3.2); label in NFC (RFC 5891 §4.1).

#### Scenario: Over-long encoded label
- **WHEN** a Unicode label encodes to an A-label of 64 or more octets
- **THEN** the length gate is ✗ reporting the octet count and the 63 cap

#### Scenario: Leading combining mark
- **WHEN** a label begins with U+0301
- **THEN** the gate is ✗ citing RFC 5891 §4.2.3.2

### Requirement: Hand-off to the Link Safety Inspector
The Unicode form SHALL be shown with the restriction level and confusable skeleton of each label, and the result SHALL link to the Link Safety Inspector for a URL-level check.

#### Scenario: Confusable A-label
- **WHEN** the input is `xn--80ak6aa92e.com`
- **THEN** the Unicode form is shown, its label is marked Cyrillic with skeleton `apple`, and the link to the Link Safety Inspector is present

### Requirement: Offline operation
Conversion SHALL involve no DNS, WHOIS or registry lookup.

#### Scenario: Input never leaves the page
- **WHEN** a domain name is converted while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
