# Spec Delta — non-cryptographic-hashes

## Purpose

Compute the checksums and fast hashes found in compression formats, hash tables and runtimes — Adler-32, Fletcher-16 / 32, FNV-1 / FNV-1a, xxHash32 / 64, MurmurHash3 x86_32, SipHash-2-4 — as hand-rolled pure JavaScript verified against their published vectors, labelled as integrity functions and not security primitives.

## ADDED Requirements

### Requirement: Checksum family
The tool SHALL compute Adler-32 (RFC 1950 §8.2), Fletcher-16 and Fletcher-32 (Fletcher 1982, modulo 255 / 65535 with the standard block handling) over the input bytes and SHALL render each as zero-padded hex.

#### Scenario: Adler-32 vectors
- **WHEN** the text is `123456789`
- **THEN** Adler-32 reads `091E01DE`; for the text `Wikipedia` it reads `11E60398`

#### Scenario: Fletcher vectors
- **WHEN** the text is `abcde`
- **THEN** Fletcher-16 reads `C8F0` and Fletcher-32 reads `F04FC729`

### Requirement: FNV family
The tool SHALL compute FNV-1 and FNV-1a at 32 and 64 bits (Fowler / Noll / Vo, offset basis `811C9DC5` / `CBF29CE484222325`, primes `01000193` / `100000001B3`), using BigInt for 64 bits.

#### Scenario: FNV vectors
- **WHEN** the text is `a`
- **THEN** FNV-1a 32 reads `E40C292C` and FNV-1a 64 reads `AF63DC4C8601EC8C`; for empty input FNV-1 32 reads `811C9DC5`

### Requirement: Seeded fast hashes
The tool SHALL compute xxHash32 and xxHash64 (Collet, xxHash specification) and MurmurHash3 x86_32 (Appleby, SMHasher reference) with a user-supplied 32-bit (or 64-bit for xxHash64) seed defaulting to 0.

#### Scenario: xxHash vectors
- **WHEN** the input is empty and the seed 0
- **THEN** xxHash32 reads `02CC5D05` and xxHash64 reads `EF46DB3751D8E999` (the `xxhsum` reference values)

#### Scenario: Murmur vector
- **WHEN** the text is `hello` and the seed 0
- **THEN** MurmurHash3 x86_32 reads `248BFA47`, and changing the seed changes the result

### Requirement: SipHash as a keyed PRF
The tool SHALL compute SipHash-2-4 (Aumasson & Bernstein 2012) over the input with a required 128-bit hex key, SHALL render the 64-bit output in hex, and SHALL present it under a "keyed function" heading explaining it is a MAC-like PRF against hash flooding — not a checksum, and not a replacement for the HMAC tool.

#### Scenario: Paper vector
- **WHEN** the key is `000102030405060708090A0B0C0D0E0F` and the input bytes are `00 01 02 … 0E` (15 bytes)
- **THEN** the result is `A129CA6149BE45E5` (SipHash paper, Appendix A)

#### Scenario: Missing key
- **WHEN** the key field is empty
- **THEN** SipHash is not computed and the message says a 16-byte key is required

### Requirement: Not-for-security banner
Every result in this panel SHALL carry the banner "not for security — these functions detect corruption, not tampering, and are not collision-resistant" and SHALL NOT describe any match as proof of integrity against an adversary.

#### Scenario: Banner present
- **WHEN** any fast hash is displayed
- **THEN** the banner is visible and links to SHA-256 / BLAKE3 in the same view and to the HMAC tool

### Requirement: Offline operation
All functions SHALL be pure JavaScript in the page.

#### Scenario: Input never leaves the page
- **WHEN** a fast hash is computed while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
