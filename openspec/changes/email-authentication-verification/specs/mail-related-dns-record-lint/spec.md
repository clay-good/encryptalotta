# Spec Delta — mail-related-dns-record-lint

## Purpose

Lint pasted MTA-STS, TLSRPT, BIMI, TLSA, CAA, DNSKEY, and DS records with their RFC grammars and cross-checks (DS ↔ DNSKEY key tag and digest), entirely in the browser with no DNS.

## ADDED Requirements

### Requirement: Record classification
The shared records textarea SHALL classify each pasted line (bare record or `dig` presentation format) as DKIM key, SPF, DMARC, MTA-STS TXT, MTA-STS policy file, TLSRPT, BIMI, TLSA, CAA, DNSKEY, or DS by its leading tag or RDATA shape, and SHALL list unrecognised lines without failing the run.

#### Scenario: Mixed paste classified
- **WHEN** the textarea holds a `v=STSv1` TXT, a `_smtp._tls` TLSRPT TXT, and a `DNSKEY 257 3 13 …` line
- **THEN** three panels appear (MTA-STS, TLSRPT, DNSKEY) and nothing is marked ✗ for being unrelated

### Requirement: MTA-STS and TLSRPT
The tool SHALL lint the `_mta-sts` TXT (`v=STSv1; id=` with a 1–32 alphanumeric id; RFC 8461 §3.1) and a pasted policy file (`version: STSv1`, `mode: enforce | testing | none`, one or more `mx:` patterns with at most a leading `*.`, `max_age` ≤ 31557600 with a ⚠ below 604800; §3.2), and SHALL lint the `_smtp._tls` TXT (`v=TLSRPTv1; rua=` one or more `mailto:` or `https:` URIs; RFC 8460 §3).

#### Scenario: Enforce mode
- **WHEN** the policy has `mode: enforce`, two `mx:` lines, and `max_age: 1209600`
- **THEN** the MTA-STS rows are ✓ and the mode row reads "enforce — senders must refuse to deliver over untrusted TLS"

#### Scenario: Testing mode and short max_age
- **WHEN** `mode: testing` and `max_age: 86400`
- **THEN** the mode row is ⚠ "testing — failures are reported, not enforced" and the max_age row is ⚠ citing the ≥ 604800 s recommendation

### Requirement: BIMI
The tool SHALL lint a `default._bimi` TXT (`v=BIMI1; l=` an `https:` URL to an SVG Tiny PS logo, optional `a=` an `https:` URL to a Verified Mark Certificate; draft-brand-indicators-for-message-identification), SHALL display both URLs as text, and SHALL note that the VMC is an X.509 certificate the user can paste into the TLS Certificate Parser, and that BIMI display requires DMARC `p=quarantine` or `reject`.

#### Scenario: BIMI record
- **WHEN** the record is `v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem`
- **THEN** both URLs are shown as plain text (not links), the VMC note appears, and if the DMARC panel shows `p=none` a ⚠ says BIMI will not display

### Requirement: TLSA and CAA
The tool SHALL decode a TLSA record (RFC 6698 §2.1: usage 0 PKIX-TA / 1 PKIX-EE / 2 DANE-TA / 3 DANE-EE, selector 0 full certificate / 1 SPKI, matching 0 exact / 1 SHA-256 / 2 SHA-512, hex data length 32 or 64 bytes for matching 1 / 2), and SHALL decode a CAA record (RFC 8659 §4: flags with the critical bit 128, tags `issue`, `issuewild`, `iodef`, and the `contactemail` / `contactphone` / `issuemail` extensions, value with `;`-separated parameters).

#### Scenario: DANE-EE SPKI SHA-256
- **WHEN** the record is `3 1 1 <64 hex chars>`
- **THEN** the row reads "DANE-EE, SPKI, SHA-256 — the server's public key must hash to this value (RFC 7671 recommended for SMTP)"

#### Scenario: Critical CAA tag
- **WHEN** the record is `128 unknowntag "x"`
- **THEN** the row is ⚠ "critical flag set on an unrecognised tag — CAs must refuse issuance (RFC 8659 §4.1)"

### Requirement: DNSKEY decoding and key tag
The tool SHALL decode a DNSKEY record (RFC 4034 §2: flags 256 ZSK / 257 KSK with the SEP bit, protocol 3, algorithm number with name, base64 key) and SHALL compute its key tag per RFC 4034 Appendix B (Appendix B.1 for algorithm 1) in pure JS.

#### Scenario: Key tag computed
- **WHEN** a DNSKEY `257 3 13 <key>` is pasted with its owner name
- **THEN** the row shows "KSK, ECDSA P-256 SHA-256 (13), key tag <n>" with `<n>` computed per Appendix B

### Requirement: DS decoding and DNSKEY match
The tool SHALL decode a DS record (RFC 4034 §5: key tag, algorithm, digest type 1 SHA-1 / 2 SHA-256 / 4 SHA-384, digest hex length) and, when a DNSKEY is also pasted, SHALL display a ✓ / ✗ row that the DS key tag and algorithm match it and, for digest type 2, that SHA-256(owner name in wire format ‖ DNSKEY RDATA) equals the DS digest (Web Crypto).

#### Scenario: DS matches
- **WHEN** a DS `<n> 13 2 <digest>` is pasted whose digest equals the recomputed SHA-256
- **THEN** the match row is ✓ "DS matches DNSKEY (key tag, algorithm, SHA-256 digest)"

#### Scenario: DS mismatch
- **WHEN** the DS digest differs by one hex digit
- **THEN** the match row is ✗ naming the computed digest

### Requirement: Offline operation and verdict language
All record lints SHALL run without any network request, and a ✓ SHALL be phrased as the record conforming to its RFC grammar or the cross-check verifying, never as the domain's mail being secure or the chain being trusted to the root.

#### Scenario: Input never leaves the page
- **WHEN** records are linted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every record row is ✓
- **THEN** the panel summary reads "Records conform to RFC 8461 / 8460 / 6698 / 8659 / 4034 as pasted — this does not establish that they are what the DNS actually serves, nor a DNSSEC chain to the root"
