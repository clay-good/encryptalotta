# Spec Delta — ml-dsa-signatures

## Purpose

Generate ML-DSA-65 and ML-DSA-87 key pairs, sign messages, and verify signatures per FIPS 204 (August 2024) in the browser, preferring Web Crypto when a browser exposes the algorithm and otherwise using a pure-JS implementation on the page's SHAKE128 / SHAKE256.

## ADDED Requirements

### Requirement: Key generation
The tool SHALL generate an ML-DSA-65 or ML-DSA-87 key pair per FIPS 204 Algorithm 1 (ML-DSA.KeyGen) with the 32-byte seed ξ from `crypto.getRandomValues`, and SHALL display the public key (1952 / 2592 bytes) and private key (4032 / 4896 bytes) as hex and Base64 with byte lengths, the private key masked.

#### Scenario: ML-DSA-65 key sizes
- **WHEN** the user selects ML-DSA-65 and clicks Generate
- **THEN** the public key row reports 1952 bytes and the masked private key row reports 4032 bytes

#### Scenario: Deterministic seed reproduces the FIPS 204 KAT
- **WHEN** the advanced fixed-seed field holds the ξ of a NIST ACVP ML-DSA-87 keyGen vector
- **THEN** the public and private keys are byte-identical to that vector's pk and sk

### Requirement: Signing
The tool SHALL sign a text or file message with a pasted private key per FIPS 204 Algorithm 2 (ML-DSA.Sign) in pure (non-prehashed) mode, SHALL accept an optional UTF-8 context string of at most 255 bytes (FIPS 204 §5.2), SHALL use fresh randomness for rnd by default and all-zero rnd when the fixed-seed field is set (deterministic variant, §3.4), and SHALL display the signature (3309 / 4627 bytes) as hex and Base64.

#### Scenario: Signature size
- **WHEN** a message is signed with an ML-DSA-65 private key
- **THEN** the signature row reports 3309 bytes

#### Scenario: Deterministic signing reproduces the KAT
- **WHEN** the fixed-seed field is set, the message and private key of a NIST ACVP ML-DSA-65 sigGen (deterministic) vector are pasted, and the context is empty
- **THEN** the signature is byte-identical to the vector

#### Scenario: Over-long context
- **WHEN** the context string exceeds 255 bytes in UTF-8
- **THEN** signing is refused with "context must be at most 255 bytes (FIPS 204 §5.2)"

### Requirement: Verification
The tool SHALL verify a pasted signature against a pasted public key and message per FIPS 204 Algorithm 3 (ML-DSA.Verify), SHALL reject on wrong length, hint count above ω, out-of-bound z, or challenge mismatch, and SHALL report the result as a plain verifies / does not verify row.

#### Scenario: Round trip verifies
- **WHEN** the user signs a message and verifies the signature with the matching public key and the same context
- **THEN** the result row reads "signature verifies under ML-DSA-65 against the supplied public key"

#### Scenario: Tampered signature
- **WHEN** one byte of the signature is altered
- **THEN** the result row reads "signature does not verify" and names the first failed check (length, hints, z bound, or challenge mismatch)

#### Scenario: Wrong context
- **WHEN** the signature was made with context `A` and verified with context `B`
- **THEN** the result is "does not verify" and a note explains that the context string is part of the signed message

#### Scenario: NIST sigVer vector
- **WHEN** a NIST ACVP ML-DSA-87 sigVer vector with `testPassed: false` is pasted
- **THEN** the tool reports "does not verify", and a `testPassed: true` vector reports "verifies"

### Requirement: Engine selection
The tool SHALL probe `crypto.subtle.supports('ML-DSA-65')` (and -87) inside try/catch at tool open, SHALL route keygen / sign / verify through Web Crypto when the probe returns true, SHALL otherwise use the pure-JS engine on the page's SHAKE128 / SHAKE256, and SHALL name the engine in every result.

#### Scenario: No Web Crypto support
- **WHEN** the browser lacks the probe or it returns false
- **THEN** the result row reads "engine: pure JavaScript (FIPS 204 on the page's SHAKE128 / SHAKE256)"

#### Scenario: Web Crypto present
- **WHEN** the probe returns true (Playwright injects a stub `supports` and `subtle` shim)
- **THEN** the tool calls Web Crypto with the draft's `raw-public` / `raw-seed` formats and the result row reads "engine: Web Crypto"

### Requirement: Known-answer self-test and performance
The tool SHALL provide a self-test that runs one NIST ACVP vector per parameter set for keygen, deterministic sign, and verify with per-step timing, and the pure-JS sign and verify SHALL each complete well under 100 ms on a 2020-class laptop.

#### Scenario: Self-test passes
- **WHEN** the user clicks Self-test
- **THEN** six rows (65 and 87 × keygen / sign / verify) are ✓ with elapsed times

#### Scenario: Latency budget
- **WHEN** an ML-DSA-65 sign followed by verify runs in the Playwright browser
- **THEN** the pair completes in under 1,000 ms (CI budget; design expectation is 20–60 ms sign, 10–20 ms verify)

### Requirement: Offline operation and secret handling
The tool SHALL perform every operation locally, SHALL never place keys or signatures in the URL or `localStorage`, SHALL mask the private key field and clear it with the seed field on `beforeunload`, and SHALL zero-fill generated private-key buffers after export.

#### Scenario: Input never leaves the page
- **WHEN** a file is signed while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Private key cleared on unload
- **WHEN** the page is unloaded with a private key in `#pqc-sk`
- **THEN** `clearSensitiveFields()` has emptied the field

### Requirement: Verdict language
A successful verification SHALL be phrased as the signature verifying against the supplied key and SHALL NOT be described as proving who signed or that the key is trustworthy.

#### Scenario: Clean result wording
- **WHEN** verification succeeds
- **THEN** the summary reads "Signature verifies under ML-DSA-65 (FIPS 204) against the key you supplied. This does not establish who holds that key."
