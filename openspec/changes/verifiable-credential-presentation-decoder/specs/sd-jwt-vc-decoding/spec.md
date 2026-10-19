# Spec Delta — sd-jwt-vc-decoding

## Purpose

Render the SD-JWT VC profile (draft-ietf-oauth-sd-jwt-vc-16, RFC Editor queue) on top of the shipped RFC 9901 SD-JWT decode, and decode Token Status List (draft-ietf-oauth-status-list-20) pointers and tokens to report a credential's status, entirely in the browser.

## ADDED Requirements

### Requirement: SD-JWT VC header and type rows
The tool SHALL check `typ` equals `dc+sd-jwt` (draft-16 §3.2.1) with `vc+sd-jwt` accepted as legacy (⚠), SHALL render `vct` (§3.2.2.1.1) and `vct#integrity` as a W3C SRI string (§6), SHALL render `iss`, `iat`, `nbf`, `exp`, `cnf`, `sub`, and `status` with `Intl.DateTimeFormat` for instants, and SHALL leave the existing RFC 9901 disclosure matching and KB-JWT verification unchanged.

#### Scenario: Current typ
- **WHEN** the header is `{"alg":"ES256","typ":"dc+sd-jwt","kid":"…"}`
- **THEN** the typ gate is ✓ citing draft-16 §3.2.1

#### Scenario: Legacy typ
- **WHEN** the header `typ` is `vc+sd-jwt`
- **THEN** the gate is ⚠ "legacy media type from drafts before -09; current value is dc+sd-jwt"

#### Scenario: vct#integrity shown
- **WHEN** the claims carry `"vct#integrity":"sha256-…"`
- **THEN** the row shows the algorithm and digest and offers a paste field for the type-metadata document to recompute it, without fetching `vct`

### Requirement: Issuer metadata URL derivation
The tool SHALL derive the issuer-metadata URL from `iss` per draft-16 §5 — `https://<host>/.well-known/jwt-vc-issuer` for a bare origin, `https://<host>/.well-known/jwt-vc-issuer<path>` when `iss` has a path — SHALL display it as text with a paste field for the metadata JSON, and SHALL, when metadata is pasted, require its `issuer` to equal `iss` and select the verification key from its `jwks` by `kid`.

#### Scenario: Issuer with path
- **WHEN** `iss` is `https://example.com/tenant/a`
- **THEN** the row reads `https://example.com/.well-known/jwt-vc-issuer/tenant/a` and no request occurs

#### Scenario: Pasted metadata mismatch
- **WHEN** the pasted metadata's `issuer` differs from `iss`
- **THEN** the gate is ✗ citing draft-16 §5.2 and the key is not used

### Requirement: Status list pointer
The tool SHALL render `status.status_list.idx` and `status.status_list.uri` (draft-ietf-oauth-status-list-20 §6.1) as the referenced-token pointer, SHALL show the `uri` as text with a paste field for the status-list token, and SHALL report a `status` claim with an unknown mechanism by name.

#### Scenario: Pointer rendered
- **WHEN** the claims contain `"status":{"status_list":{"idx":1234,"uri":"https://example.com/statuslists/1"}}`
- **THEN** the card shows index 1234 and the URI as text, with the note "the verifier fetches this; paste the token here instead"

### Requirement: Status list token decoding
The tool SHALL decode a pasted status-list token as JWT (`typ: statuslist+jwt`, draft-ietf-oauth-status-list-20 §5.1) or CWT (`statuslist+cwt`, §5.2, via the CBOR engine), SHALL require `sub` to equal the credential's `uri` (§6.3), SHALL render `iat`, `exp`, and `ttl`, and SHALL verify the signature through the existing JWT verifier when a key is pasted.

#### Scenario: Wrong list
- **WHEN** the token's `sub` differs from the credential's `uri`
- **THEN** the gate is ✗ citing §6.3 and no status is reported

#### Scenario: CWT form
- **WHEN** the pasted token is a COSE_Sign1 with `typ` `statuslist+cwt`
- **THEN** the claims are read from the CBOR map with the same `status_list` structure and the signature is reported as not verified unless a key is supplied

### Requirement: Status bit lookup
The tool SHALL read `status_list.bits` ∈ {1, 2, 4, 8}, inflate `lst` (base64url → ZLIB, RFC 1950) with `DecompressionStream('deflate')`, extract the `bits`-wide value at bit offset `idx × bits` with the least-significant bit first within each byte (§4.1), and name the status: 0x00 VALID, 0x01 INVALID, 0x02 SUSPENDED, 0x03 APPLICATION_SPECIFIC (§7).

#### Scenario: Two-bit list lookup
- **WHEN** a token with `bits: 2` and an `lst` whose decompressed first byte is `0b10010100` is pasted for a credential with `idx` 1
- **THEN** the status reads `0x01 INVALID` (bits 2–3 of byte 0, LSB-first) and the gate is ✗ "credential revoked"

#### Scenario: Index beyond the list
- **WHEN** `idx × bits` exceeds the decompressed length in bits
- **THEN** the gate is ✗ "index outside the status list" and no status value is invented

#### Scenario: Stale list
- **WHEN** `iat + ttl` is in the past
- **THEN** a ⚠ row reads "status list is stale — the verifier should fetch a fresh one" with the age via `Intl.RelativeTimeFormat`

### Requirement: Offline operation and verdict language
The tool SHALL decode without any network request and SHALL phrase a fully ✓ card as "issuer signature verifies for the key you supplied; status VALID per the list you pasted — this does not establish that the issuer is trusted".

#### Scenario: Input never leaves the page
- **WHEN** a credential with `iss`, `vct`, and `status_list.uri` URLs is decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓
- **THEN** the summary is the sentence above and contains neither "safe" nor "trusted issuer"
