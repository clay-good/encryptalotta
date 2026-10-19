# Spec Delta — webauthn-registration-decoding

## Purpose

Decode a WebAuthn registration response (`navigator.credentials.create()`) — CollectedClientData, attestation object, authenticator data, COSE credential public key, and extensions — and verify what the data alone allows, per WebAuthn Level 3 (W3C Recommendation, 25 August 2026), entirely in the browser.

## ADDED Requirements

### Requirement: Input ingestion
The tool SHALL accept a registration as the JSON emitted by `PublicKeyCredential.toJSON()` (Level 3 §5.1, `response.clientDataJSON` / `response.attestationObject` base64url), as a bare `{response: …}` fragment, or as two separately pasted fields, each in base64url, base64, or hex; it SHALL detect the form from the input shape and SHALL report a malformed input with the failing field name rather than throwing.

#### Scenario: toJSON() output decodes
- **WHEN** the user pastes the full JSON object with `id`, `rawId`, `type: "public-key"`, `response.clientDataJSON`, and `response.attestationObject`
- **THEN** both fields are extracted, `rawId` is shown as hex and compared to the credential ID inside authenticator data, and decoding proceeds

#### Scenario: Bare fields decode
- **WHEN** the user pastes only `clientDataJSON` and `attestationObject` into the two field inputs, one as base64url and one as hex
- **THEN** each is normalised to bytes and decoding proceeds identically

### Requirement: CollectedClientData rendering
The tool SHALL UTF-8-decode and JSON-parse `clientDataJSON` and SHALL render `type`, `challenge` (base64url and decoded byte length), `origin`, `crossOrigin`, and `topOrigin` per Level 3 §5.8.1, listing any additional members verbatim, and SHALL show the SHA-256 of the exact bytes as the client data hash used by attestation.

#### Scenario: Registration client data
- **WHEN** the client data is `{"type":"webauthn.create","challenge":"…","origin":"https://example.com","crossOrigin":false}`
- **THEN** the rows read type `webauthn.create`, the challenge as pasted plus its byte length, origin `https://example.com`, crossOrigin `false`, topOrigin "absent", and a client-data-hash row with 64 hex characters

### Requirement: Attestation object and authenticator data parsing
The tool SHALL CBOR-decode the attestation object with the page's CBOR engine into `fmt`, `attStmt`, `authData` (Level 3 §6.5) and SHALL parse `authData` per §6.1 as `rpIdHash` (32 bytes), flags byte, `signCount` (32-bit big-endian), attested credential data when AT is set (`aaguid` 16, `credentialIdLength` 2, `credentialId`, COSE key), and extensions when ED is set, reporting any trailing bytes.

#### Scenario: Flag byte decodes with Level 3 names
- **WHEN** the flags byte is `0x5D`
- **THEN** the flags table shows UP (bit 0) set, UV (bit 2) set, BE (bit 3) set, BS (bit 4) set, AT (bit 6) set, ED (bit 7) clear, and reserved bits 1 and 5 clear, each with its Level 3 name

#### Scenario: AAGUID and credential ID
- **WHEN** attested credential data is present
- **THEN** the AAGUID is rendered as a hyphenated lowercase UUID, the credential ID as hex and base64url with its length, and the AAGUID row links to the lookup panel

#### Scenario: Extensions after the COSE key
- **WHEN** ED is set and a CBOR map follows the credential public key
- **THEN** the COSE key's consumed length is used to locate the extensions, which render as a labelled tree (e.g. `credProtect`, `credBlob`), and any bytes remaining afterwards are reported as a ⚠ row

### Requirement: COSE public key rendering
The tool SHALL render the credential public key's COSE labels with their RFC 9052 §7 / RFC 9053 names (`kty`, `alg`, `crv`, `x`, `y`, `n`, `e`), SHALL convert EC2 / RSA / OKP keys to a JWK, and SHALL export SPKI PEM through the page's JWK ↔ PEM engine.

#### Scenario: ES256 key
- **WHEN** the COSE key is `{1: 2, 3: -7, -1: 1, -2: x, -3: y}`
- **THEN** the rows read kty EC2, alg ES256 (-7), crv P-256, and the JWK is `{"kty":"EC","crv":"P-256","x":…,"y":…}` with a PEM beginning `-----BEGIN PUBLIC KEY-----`

#### Scenario: RS256 key
- **WHEN** the COSE key has `kty 3`, `alg -257`, `n`, `e`
- **THEN** the JWK has `kty RSA` with base64url `n` and `e`, and the modulus length in bits is shown

### Requirement: RP ID hash check
The tool SHALL accept a user-entered RP ID, default it to the host of `clientDataJSON.origin`, compute `SHA-256(rpId)` via Web Crypto, and show a ✓ / ✗ gate comparing it to `rpIdHash` (Level 3 §7.1 step 13).

#### Scenario: Matching RP ID
- **WHEN** the RP ID entered is `localhost` and the fixture was created for `localhost`
- **THEN** the gate is ✓ and shows both 32-byte hashes

#### Scenario: Wrong RP ID
- **WHEN** the RP ID entered is `example.org` for the same fixture
- **THEN** the gate is ✗ and the detail suggests that the RP ID must equal the origin's host or a registrable suffix of it (§5.1.3)

### Requirement: Packed attestation verification
The tool SHALL verify `packed` attestations per Level 3 §8.2: with `x5c`, the signature over `authData ‖ clientDataHash` against the leaf certificate's public key, plus the `id-fido-gen-ce-aaguid` (1.3.6.1.4.1.45724.1.1.4) cross-check when present; without `x5c`, self-attestation with the credential key, requiring `alg` to match the credential's.

#### Scenario: Packed with certificate chain
- **WHEN** `fmt` is `packed` with `alg -7`, `sig`, and `x5c`
- **THEN** the DER ECDSA signature is converted to raw `r‖s`, verified with the leaf's SubjectPublicKeyInfo, each certificate renders through the TLS Certificate Parser, and the gate reads "attestation signature verifies with the leaf certificate — chain not checked against any root"

#### Scenario: Packed self-attestation
- **WHEN** `fmt` is `packed` without `x5c` and `alg` equals the credential key's `alg`
- **THEN** the signature is verified with the credential public key and labelled self-attestation (§8.2 step 4)

### Requirement: Other attestation formats
The tool SHALL report `none` as "no attestation — self-asserted" (§8.7); SHALL decode `tpm` (§8.3), `android-key` (§8.4), and `apple` (§8.8) structurally and check the `extraData` / nonce equality with `SHA-256(authData ‖ clientDataHash)`; and SHALL report `fido-u2f` (§8.6) and `android-safetynet` (§8.5) as decoded but not verified, with the reason.

#### Scenario: None attestation
- **WHEN** `fmt` is `none`
- **THEN** the statement row reads "no attestation — self-asserted" and no signature gate is shown

#### Scenario: Apple attestation
- **WHEN** `fmt` is `apple`
- **THEN** the `x5c` chain renders, the nonce extension `1.2.840.113635.100.8.2` is compared to `SHA-256(authData ‖ clientDataHash)` as a ✓ / ✗ row, and the statement is labelled "structure decoded; Apple root not checked"

### Requirement: Offline operation and verdict language
The tool SHALL decode and verify without any network request and SHALL phrase a fully ✓ result as "structure conforms to WebAuthn Level 3 §6.1 / §6.5; signature verifies for the certificate or key shown — this does not establish which authenticator model or which user created the credential".

#### Scenario: Input never leaves the page
- **WHEN** a registration is decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓
- **THEN** the summary does not contain "safe", "trusted", or "genuine", and the AAGUID row reads "self-reported by the authenticator"
