# Spec Delta — jwk-generation

## Purpose

Generate JSON Web Keys (RFC 7517) of every JOSE key type with Web Crypto, assign RFC 7638 thumbprints as `kid`, and export them as JWK, JWKS, and PEM through the existing JWK ↔ PEM engine, entirely in the browser.

## ADDED Requirements

### Requirement: Key types and sizes
The tool SHALL generate RSA keys of 2048, 3072, or 4096 bits with public exponent 65537 (RFC 7518 §6.3), EC keys on P-256, P-384, or P-521 (RFC 7518 §6.2), OKP keys Ed25519 and X25519 (RFC 8037 §2), and `oct` keys of 16–64 bytes from `crypto.getRandomValues` (RFC 7518 §6.4), via `crypto.subtle.generateKey` with `extractable: true` for the asymmetric types.

#### Scenario: EC P-256 generation
- **WHEN** the user selects EC P-256 and clicks Generate
- **THEN** a private JWK with `kty`, `crv`, `x`, `y`, `d` and a public JWK without `d` are shown, both with the same `kid`

#### Scenario: X25519 without browser support
- **WHEN** `crypto.subtle.generateKey` rejects `X25519`
- **THEN** the option is disabled with the X25519 tool's capability banner rather than failing silently

### Requirement: RFC 7638 thumbprint as kid
The tool SHALL compute the JWK thumbprint over the canonical JSON of the required public members only, in lexical order — EC `crv, kty, x, y`; RSA `e, kty, n`; OKP `crv, kty, x`; oct `k, kty` — hashed with SHA-256 and base64url-encoded (RFC 7638 §3; RFC 8037 §2 for OKP), and SHALL set it as `kid` unless the user types one.

#### Scenario: RFC 7638 §3.1 vector
- **WHEN** the RSA public key from RFC 7638 §3.1 is pasted into the thumbprint check field
- **THEN** the computed thumbprint is `NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs`

#### Scenario: Optional members ignored
- **WHEN** the pasted JWK also carries `kid`, `use`, and `alg`
- **THEN** the thumbprint is unchanged, because only the required members are hashed

### Requirement: JWKS and PEM output
The tool SHALL render a `{"keys":[…]}` JWKS containing the public JWK (RFC 7517 §5), SHALL offer PEM export of the public key as SPKI through `jwkToPem()` and of the private key as PKCS#8 via `crypto.subtle.exportKey('pkcs8')`, and SHALL set `use` (`sig` or `enc`) and `alg` from the user's choice.

#### Scenario: PEM round trip
- **WHEN** the generated public JWK is exported to PEM and that PEM is pasted into the JWK ↔ PEM tool
- **THEN** the converter returns a JWK with identical `kty`, `crv` / `n`, and `x` / `y` / `e` members

#### Scenario: JWKS loads into the Inspector
- **WHEN** the generated JWKS is pasted into the Inspector's verification-key field and a token signed with the private key is inspected
- **THEN** the verifier selects the key by `kid` and verification succeeds

### Requirement: Private key handling
The tool SHALL show the private JWK and PKCS#8 PEM once with copy and download controls, SHALL not re-render them after leaving the tab, SHALL never write them to `localStorage`, and SHALL label them "test key — generated in this browser tab".

#### Scenario: Not re-rendered
- **WHEN** the user leaves the Keys tab and returns
- **THEN** the private-key panels are empty and a note says the key was shown once

### Requirement: Offline operation and verdict language
The tool SHALL generate keys without any network request and SHALL not describe a generated key as "secure" beyond stating its algorithm and size.

#### Scenario: Input never leaves the page
- **WHEN** keys are generated while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Result wording
- **WHEN** an RSA-2048 key is generated
- **THEN** the status reads "RSA 2048-bit, e = 65537, generated with Web Crypto" and the size note cites NIST IR 8547's 2030 deprecation path for RSA without calling the key safe
