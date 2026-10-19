# Spec Delta — ml-kem-key-encapsulation

## Purpose

Generate ML-KEM-768 and ML-KEM-1024 key pairs, encapsulate and decapsulate shared secrets per FIPS 203 (August 2024), and optionally combine the ML-KEM-768 secret with an X25519 secret in the TLS X25519MLKEM768 layout, entirely in the browser.

## ADDED Requirements

### Requirement: Key generation
The tool SHALL generate an ML-KEM-768 or ML-KEM-1024 key pair per FIPS 203 Algorithm 19 (ML-KEM.KeyGen) with the seeds d and z drawn from `crypto.getRandomValues`, and SHALL display the encapsulation key and decapsulation key as hex and Base64 with byte lengths of 1184 / 2400 (768) or 1568 / 3168 (1024).

#### Scenario: ML-KEM-768 key sizes
- **WHEN** the user selects ML-KEM-768 and clicks Generate
- **THEN** the encapsulation key row reports 1184 bytes, the decapsulation key row reports 2400 bytes, both are offered as hex and Base64, and the decapsulation key field is masked

#### Scenario: Deterministic seed reproduces the FIPS 203 KAT
- **WHEN** the advanced fixed-seed field holds the d ‖ z seed of a NIST ACVP ML-KEM-1024 keyGen vector and the user clicks Generate
- **THEN** the produced encapsulation and decapsulation keys are byte-identical to that vector's ek and dk, and the result carries the label "fixed seed — test vectors only"

### Requirement: Encapsulation
The tool SHALL encapsulate to a pasted encapsulation key per FIPS 203 Algorithm 20 (ML-KEM.Encaps), SHALL perform the mandated modulus check on the encapsulation key, and SHALL display the ciphertext (1088 or 1568 bytes) and the 32-byte shared secret.

#### Scenario: Encapsulation output sizes
- **WHEN** a valid ML-KEM-768 encapsulation key is pasted and the user clicks Encapsulate
- **THEN** the ciphertext row reports 1088 bytes and the shared-secret row reports 32 bytes, both as hex and Base64

#### Scenario: Encapsulation key fails the modulus check
- **WHEN** a pasted encapsulation key has the right length but a coefficient ≥ 3329 after ByteDecode_12
- **THEN** encapsulation is refused with "encapsulation key fails the FIPS 203 §7.2 modulus check" and no ciphertext is shown

#### Scenario: Deterministic message reproduces the KAT ciphertext
- **WHEN** the fixed-seed field holds the m value of a NIST ACVP ML-KEM-768 encapsulation vector
- **THEN** the ciphertext and shared secret are byte-identical to that vector's c and K

### Requirement: Decapsulation with implicit rejection
The tool SHALL decapsulate a pasted ciphertext with a pasted decapsulation key per FIPS 203 Algorithm 21 (ML-KEM.Decaps), SHALL perform the mandated ciphertext-length and decapsulation-key hash checks, and SHALL return the implicit-rejection secret for a non-matching ciphertext without reporting an error (FIPS 203 §7.3).

#### Scenario: Round trip
- **WHEN** the user generates a key pair, encapsulates to it, and decapsulates the resulting ciphertext
- **THEN** the decapsulated shared secret equals the encapsulated one and the comparison row reads "shared secrets match (constant-time compare)"

#### Scenario: Tampered ciphertext
- **WHEN** one byte of the ciphertext is changed before decapsulation and the expected secret is pasted in the compare field
- **THEN** a 32-byte secret is still produced, the comparison row reads "shared secrets differ", and no "invalid ciphertext" error appears

#### Scenario: Decapsulation key hash check
- **WHEN** the pasted decapsulation key's embedded H(ek) does not match its embedded encapsulation key
- **THEN** decapsulation is refused citing the FIPS 203 §7.3 hash check

### Requirement: Hybrid shared-secret combination
The tool SHALL offer a hybrid panel that combines an ML-KEM-768 shared secret with an X25519 shared secret (from the X25519 tool's Web Crypto path) as ML-KEM ss ‖ X25519 ss (64 bytes) in the order used by the TLS X25519MLKEM768 key share, SHALL label the output with that construction's name, SHALL offer HKDF-SHA-256 post-processing, and SHALL label the alternative X-Wing / draft-irtf-cfrg-hybrid-kems combiner separately when selected.

#### Scenario: TLS-style concatenation
- **WHEN** both secrets are present and the TLS combiner is selected
- **THEN** the result is 64 bytes whose first 32 bytes equal the ML-KEM secret and last 32 bytes equal the X25519 secret, labelled "X25519MLKEM768 (TLS key-share concatenation)"

#### Scenario: Combiner is named
- **WHEN** the X-Wing combiner is selected instead
- **THEN** the result row names draft-irtf-cfrg-hybrid-kems / X-Wing and its version constant, and states that the two combiners are not interchangeable

### Requirement: Known-answer self-test
The tool SHALL provide a self-test button that runs one FIPS 203 known-answer vector per parameter set (keygen, encaps, decaps) from the NIST ACVP set and reports pass or fail per step with wall-clock time.

#### Scenario: Self-test passes
- **WHEN** the user clicks Self-test
- **THEN** six rows (768 and 1024 × keygen / encaps / decaps) are ✓ and each shows its elapsed time formatted by `Intl.NumberFormat`

### Requirement: Engine selection and performance
The tool SHALL use the page's pure-JS implementation on the inline Keccak by default, SHALL prefer Web Crypto when `crypto.subtle.supports('ML-KEM-768')` returns true, SHALL name the engine in the result, and SHALL complete each ML-KEM operation in well under 100 ms in pure JS on a 2020-class laptop.

#### Scenario: Engine row in a current browser
- **WHEN** the browser does not expose ML-KEM in Web Crypto
- **THEN** the result row reads "engine: pure JavaScript (FIPS 203 on the page's SHA-3 / SHAKE)"

#### Scenario: Latency budget
- **WHEN** keygen, encapsulation, and decapsulation run in the Playwright browser
- **THEN** the three combined complete in under 1,000 ms (CI budget; the design expectation is 2–5 ms each)

### Requirement: Offline operation and secret handling
The tool SHALL perform every operation locally, SHALL never place keys, ciphertexts, or secrets in the URL or `localStorage`, SHALL mask the decapsulation key, and SHALL clear decapsulation-key and seed fields on `beforeunload` like the page's other secret fields.

#### Scenario: Input never leaves the page
- **WHEN** a key pair is generated and a ciphertext decapsulated while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Secrets cleared on unload
- **WHEN** the page is unloaded after a decapsulation key is present in the field
- **THEN** `clearSensitiveFields()` empties `#pqc-dk` and `#pqc-seed`

### Requirement: Verdict language
A matching decapsulation SHALL be reported as "shared secrets match" and SHALL NOT be described as proving the identity of the encapsulating party or the security of a protocol built on it.

#### Scenario: Clean result wording
- **WHEN** the comparison row is ✓
- **THEN** the summary reads "Shared secrets match — ML-KEM-768 per FIPS 203. This does not establish who produced the ciphertext; ML-KEM is unauthenticated on its own."
