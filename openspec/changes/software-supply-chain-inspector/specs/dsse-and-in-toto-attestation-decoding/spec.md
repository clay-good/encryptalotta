# Spec Delta — dsse-and-in-toto-attestation-decoding

## Purpose

Decode a DSSE envelope (secure-systems-lab DSSE v1.0) carrying an in-toto Statement v1 — typically SLSA provenance v1 — render its subjects, predicate and signatures, and verify the signatures over the Pre-Authentication Encoding with a public key the user pastes.

## ADDED Requirements

### Requirement: Envelope decoding
The tool SHALL parse a DSSE envelope (`payloadType`, Base64 `payload`, `signatures[]` with `keyid` and Base64 `sig`), SHALL decode the payload and, when `payloadType` is `application/vnd.in-toto+json`, pretty-print it with the page's JSON printer, and SHALL list each signature's keyid and byte length.

#### Scenario: in-toto envelope
- **WHEN** a DSSE envelope with `payloadType: application/vnd.in-toto+json` and one signature is pasted
- **THEN** the decoded Statement is shown, the signature row lists the keyid and 64 bytes (Ed25519) or the DER length (ECDSA)

#### Scenario: Unknown payload type
- **WHEN** `payloadType` is not in-toto
- **THEN** the payload is shown as text (if UTF-8) or hex and the Statement renderer is skipped

### Requirement: Statement and SLSA rendering
The tool SHALL render in-toto Statement v1 fields `_type` (gate ✓ when `https://in-toto.io/Statement/v1`), `subject[]` (name and each digest algorithm / value) and `predicateType`; for `https://slsa.dev/provenance/v1` it SHALL render `buildDefinition.buildType`, `externalParameters`, `internalParameters`, `resolvedDependencies[]` (uri, digest) and `runDetails.builder.id`, `runDetails.metadata.invocationId` / `startedOn` / `finishedOn` (localized via `Intl.DateTimeFormat`).

#### Scenario: SLSA provenance
- **WHEN** the predicate type is SLSA provenance v1
- **THEN** the builder id, build type and every resolved dependency with its digest are rendered as a table

#### Scenario: Subject digest matches dropped file
- **WHEN** the user drops a file whose SHA-256 equals a `subject[].digest.sha256`
- **THEN** that subject row is ✓ "digest matches dropped file"; other subjects read "no file dropped"

### Requirement: PAE signature verification
The tool SHALL build PAE as `"DSSEv1" SP len(payloadType) SP payloadType SP len(payload) SP payload` with decimal ASCII lengths (DSSE v1.0 protocol section), SHALL verify each signature with a pasted public key (PEM SPKI, raw Ed25519, or OpenSSH line) via Web Crypto Ed25519, ECDSA P-256 / P-384 (DER → raw conversion) or RSA, and SHALL compare `keyid` with the SHA-256 of the pasted key's SPKI DER when present.

#### Scenario: Valid Ed25519 signature
- **WHEN** the fixture envelope signed with the test Ed25519 key is pasted together with that public key
- **THEN** the signature row is ✓ and the keyid row reads "matches SHA-256 of the pasted key"

#### Scenario: Wrong key
- **WHEN** a different public key is pasted
- **THEN** the signature row is ✗ "signature does not verify with the key you supplied"

### Requirement: Offline operation and verdict language
Verification SHALL use only the pasted key, and an all-✓ result SHALL read "verifies against the key you supplied — this does not establish that the key belongs to the publisher".

#### Scenario: Input never leaves the page
- **WHEN** an envelope is verified while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every row is ✓
- **THEN** the summary carries that wording
