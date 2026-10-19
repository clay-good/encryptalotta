# Spec Delta — sigstore-bundle-inspection

## Purpose

Decode a Sigstore bundle (protobuf-specs `Bundle`, media type `application/vnd.dev.sigstore.bundle.v0.3+json`) — certificate or key hint, Rekor transparency-log entries with inclusion proof and checkpoint, RFC 3161 timestamps, and the signed content — and run the five offline verification steps against root material the user pastes.

## ADDED Requirements

### Requirement: Bundle decoding
The tool SHALL parse `mediaType` (v0.3 ✓; v0.1 / v0.2 ⚠ older), `verificationMaterial.certificate` or `.publicKey.hint`, `tlogEntries[]` (`logIndex`, `logId.keyId`, `kindVersion`, `integratedTime` localized, `inclusionProof` with `logIndex` / `rootHash` / `treeSize` / `hashes[]` / `checkpoint.envelope`, `canonicalizedBody`), `rfc3161Timestamps[]`, and `messageSignature` (`messageDigest`, `signature`) or `dsseEnvelope`.

#### Scenario: Fixture bundle decodes
- **WHEN** the hand-built v0.3 fixture bundle is pasted
- **THEN** every section renders, the Rekor body kind reads `hashedrekord v0.0.1` with its data hash and public key decoded, and the checkpoint note shows origin, tree size and root hash

#### Scenario: Older bundle
- **WHEN** a v0.2 bundle with only `inclusionPromise` is pasted
- **THEN** the media-type gate is ⚠ and verification rows (c) and (d) read "not available in this bundle version"

### Requirement: Certificate and identity rendering
The tool SHALL pass the leaf certificate to the page's X.509 parser and SHALL decode the Fulcio extensions `1.3.6.1.4.1.57264.1.1` and `.8` (issuer), `.9`–`.22` (build signer URI and digest, runner environment, source repository URI / digest / ref / identifier / owner URI / owner identifier, build config URI / digest, build trigger, run invocation URI, source repository visibility), and SHALL show the SAN `rfc822Name` or URI as the signing identity, displayed and never judged.

#### Scenario: GitHub Actions identity
- **WHEN** the leaf carries a SAN URI `https://github.com/org/repo/.github/workflows/release.yml@refs/tags/v1.2.3` and issuer `https://token.actions.githubusercontent.com`
- **THEN** both are rendered with the Fulcio OID names, and the summary says the identity is shown for the user to judge

#### Scenario: RFC 3161 timestamp
- **WHEN** `rfc3161Timestamps[]` is present
- **THEN** each `TimeStampToken` is decoded through the timestamp decoder from `eidas-signature-cryptographic-verification` and its `genTime` shown

### Requirement: Artifact and signature rows
The tool SHALL display row (a): SHA-256 of the dropped artifact equals `messageSignature.messageDigest` (or the DSSE subject digest); and row (b): the signature verifies with the leaf certificate's public key (or the pasted key for a `publicKey` hint) via Web Crypto ECDSA / Ed25519 / RSA with DER → raw conversion.

#### Scenario: Matching artifact
- **WHEN** the fixture artifact is dropped with the fixture bundle
- **THEN** rows (a) and (b) are ✓

#### Scenario: Wrong artifact
- **WHEN** a different file is dropped
- **THEN** row (a) is ✗ showing both digests and row (b) still evaluates against `messageDigest`

### Requirement: Transparency-log rows
The tool SHALL display row (c): the RFC 6962 §2.1 inclusion proof (`leafHash = SHA-256(0x00 ‖ canonicalizedBody)`, interior nodes `SHA-256(0x01 ‖ left ‖ right)` folded by the `logIndex` / `treeSize` path) recomputes to `rootHash` and to the root in the checkpoint note; and row (d): the checkpoint signed-note signature (4-byte key hint ‖ signature) verifies with a pasted Rekor public key whose SHA-256 prefix matches the hint.

#### Scenario: Two-leaf fixture
- **WHEN** the fixture bundle (tree size 2, one sibling hash) and the fixture Rekor key are supplied
- **THEN** rows (c) and (d) are ✓ and the recomputed root is shown

#### Scenario: Altered proof
- **WHEN** one byte of `hashes[0]` is changed
- **THEN** row (c) is ✗ showing the recomputed and expected roots

### Requirement: Chain and time row
The tool SHALL display row (e): the leaf chains through any bundle intermediates to a pasted Fulcio root (signature over `tbsCertificate`, basicConstraints and validity; a minimal path check until `x509-chain-and-lint` lands), and the signing time (`integratedTime` or RFC 3161 `genTime`) lies within the leaf's `notBefore` / `notAfter`.

#### Scenario: Time outside validity
- **WHEN** the `integratedTime` is altered to one day after `notAfter`
- **THEN** row (e) is ✗ "signing time outside the certificate's validity (Fulcio leaves are short-lived by design)"

### Requirement: Offline operation and verdict language
The tool SHALL fetch nothing from Rekor, Fulcio or the Sigstore TUF repository — the user pastes the Rekor key and Fulcio root — and an all-✓ result SHALL read "verifies against the root material you supplied — this does not establish that the identity shown is the publisher you expect".

#### Scenario: Input never leaves the page
- **WHEN** a bundle is verified while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** rows (a)–(e) are ✓
- **THEN** the summary carries that wording and shows the identity beside it
