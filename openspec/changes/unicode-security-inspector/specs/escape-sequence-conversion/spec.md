# Spec Delta — escape-sequence-conversion

## Purpose

Render any string in the escape notations developers paste into source code and URLs — JavaScript, HTML numeric entities, URL percent-encoding, Python — and parse those notations back to text, so hidden characters can be written down unambiguously.

## ADDED Requirements

### Requirement: Escaping to four notations
The tool SHALL render the input in each of: JavaScript `\u{XXXX}` (ECMAScript code-point escapes) and `\uXXXX` with surrogate pairs for code points above U+FFFF; HTML `&#xXXXX;` and `&#DDDD;` numeric character references (HTML Living Standard §13.1.4); URL percent-encoding of the UTF-8 bytes (RFC 3986 §2.1); Python `\uXXXX` / `\UXXXXXXXX`. A toggle SHALL choose whether ASCII printable characters are escaped too or left literal.

#### Scenario: Astral character in every notation
- **WHEN** the input is U+1F600
- **THEN** the outputs read `\u{1F600}`, `😀`, `&#x1F600;`, `&#128512;`, `%F0%9F%98%80`, and `\U0001F600`

#### Scenario: Only non-ASCII escaped by default
- **WHEN** the input is `a` U+200B `b` with the ASCII toggle off
- **THEN** the JavaScript output reads `a​b`

### Requirement: Unescaping
The tool SHALL parse a string containing any mix of the four notations back to text, SHALL leave an unparseable sequence as literal text, and SHALL list each such sequence in a notice rather than failing.

#### Scenario: Mixed notations round trip
- **WHEN** the input is `é&#x202E;%E2%80%8B\U0001F600`
- **THEN** the output is `é` U+202E U+200B U+1F600 and the inspect panel can be opened on it

#### Scenario: Invalid escape preserved
- **WHEN** the input contains `\uZZZZ`
- **THEN** the output keeps `\uZZZZ` literally and the notice names it as unparseable

### Requirement: Round-trip property
Escaping then unescaping SHALL reproduce the input exactly for every notation, including lone surrogates (reported, not silently replaced).

#### Scenario: Round trip over the hazardous table
- **WHEN** every character in the hazardous-name table is escaped in each notation and parsed back
- **THEN** the result is code-point-identical to the input

### Requirement: Offline operation
Escape conversion SHALL be table-free arithmetic in the page.

#### Scenario: Input never leaves the page
- **WHEN** escapes are converted while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
