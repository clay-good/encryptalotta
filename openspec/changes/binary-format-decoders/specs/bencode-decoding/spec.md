# Spec Delta — bencode-decoding

## Purpose

Decode bencoded data per BitTorrent BEP 3, summarise a `.torrent` metainfo file, and compute its v1 (BEP 3) and v2 (BEP 52) info-hashes and magnet link (BEP 9) over the original bytes, without contacting any tracker or peer.

## ADDED Requirements

### Requirement: BEP 3 decoding
The tool SHALL decode integers `i…e` (flagging leading zeros and `-0`), byte strings `<len>:…` (shown as UTF-8 when valid, otherwise hex), lists `l…e` and dictionaries `d…e` (flagging unsorted keys, BEP 3 "keys must be strings and appear in sorted order"), SHALL record the byte range of every value, and SHALL report a parse failure with its offset.

#### Scenario: Reference example
- **WHEN** the input is `d3:bar4:spam3:fooi42ee`
- **THEN** the output is `{"bar": "spam", "foo": 42}`

#### Scenario: Unsorted dictionary
- **WHEN** the input is `d3:foo1:a3:bar1:be`
- **THEN** the value decodes and a ⚠ row states the keys are not in sorted order

### Requirement: Torrent summary
When the top-level dictionary contains `info`, the tool SHALL render name, piece length, piece count (`pieces` length ÷ 20 for v1), total size, the file list (`files[]` paths and lengths or single-file `length`), `announce` and `announce-list`, `url-list` (BEP 19), `creation date` via `Intl.DateTimeFormat`, `created by`, `comment`, and `private` flag (BEP 27).

#### Scenario: Multi-file torrent
- **WHEN** a fixture metainfo with two files and three trackers is loaded
- **THEN** the summary lists both paths with sizes, a total, the three tracker URLs as text, and the creation date in the active locale

### Requirement: Info-hash over original bytes
The tool SHALL compute the v1 info-hash as SHA-1 (Web Crypto) over `buf.subarray(info.start, info.end)` of the input exactly as given — never over a re-encoding — and, when `info["meta version"]` is 2, the v2 info-hash as SHA-256 over the same slice; hybrid torrents SHALL show both.

#### Scenario: Fixture hash matches openssl
- **WHEN** the fixture `.torrent` is loaded
- **THEN** the v1 info-hash equals the value precomputed with `openssl sha1` over the sliced `info` dictionary, uppercase and lowercase hex both shown

#### Scenario: Unsorted info dictionary still hashes the original bytes
- **WHEN** the `info` dictionary keys are unsorted
- **THEN** the info-hash is still computed over the bytes as given and the ⚠ row notes clients may disagree

### Requirement: Magnet derivation and verdict language
The tool SHALL derive `magnet:?xt=urn:btih:<v1 hex>` (and `xt=urn:btmh:1220<v2 hex>` when present) with `dn` and `tr` parameters per BEP 9, rendered as copyable text and never as a hyperlink, and SHALL phrase the result as "info-hash computed from the file as given — this does not establish what the swarm serves or whether downloading it is lawful".

#### Scenario: Magnet is text only
- **WHEN** the summary is rendered
- **THEN** the magnet string appears in a read-only field with a copy button and no `<a>` element

### Requirement: Offline operation
Decoding and hashing SHALL involve no tracker, DHT or peer contact.

#### Scenario: Input never leaves the page
- **WHEN** a `.torrent` is decoded while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
