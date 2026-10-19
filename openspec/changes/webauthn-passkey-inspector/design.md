# Design — WebAuthn / Passkey Inspector

## Context

A WebAuthn ceremony produces three binary structures (WebAuthn Level 3, W3C Recommendation 25 August 2026):

| Structure | Encoding | Spec clause |
|---|---|---|
| `clientDataJSON` | UTF-8 JSON (`type`, `challenge`, `origin`, `crossOrigin`, `topOrigin`) | §5.8.1 CollectedClientData |
| `attestationObject` | CBOR map `{fmt, attStmt, authData}` | §6.5 Attestation |
| `authenticatorData` | `rpIdHash(32) ‖ flags(1) ‖ signCount(4) ‖ [attestedCredentialData] ‖ [extensions CBOR]` | §6.1 |

Flags: UP 0x01, UV 0x04, BE 0x08, BS 0x10, AT 0x40, ED 0x80 (bits 1 and 5 reserved). Attested credential data is `aaguid(16) ‖ credentialIdLength(2, big-endian) ‖ credentialId ‖ credentialPublicKey` where the key is a COSE_Key (RFC 9052 §7, algorithms RFC 9053). Assertion signatures cover `authenticatorData ‖ SHA-256(clientDataJSON)` (§6.3.4). `packed` attestation signatures cover the same concatenation (§8.2).

The page's `cborDecode()` already handles maps, byte strings, negative integer labels, and trailing-byte reporting — the latter matters because the COSE key is followed directly by the extensions map with no length prefix.

## Goals / Non-Goals

**Goals:**
- Decode anything the browser's `toJSON()` emits, or the two raw base64url fields, without the user knowing which they have.
- Name every flag with its Level 3 name and bit, every COSE label with its RFC 9053 meaning, every attestation format with its §8 clause.
- Real signature verification where the data allows it (assertion with a supplied key; `packed` with `x5c` or self-attestation).
- Every gate row cites the clause.

**Non-Goals:**
- No attestation *trust*: no MDS, no root store, no chain building beyond rendering the `x5c` certificates in the existing parser. The user can paste a root into the TLS Certificate Parser; this tool only states whether the leaf's key verifies the statement.
- No `android-safetynet` JWS validation, no `fido-u2f` legacy ceremony replay, no TPM `certInfo` signature verification beyond structure (TPM 2.0 Part 2 §10.12.8 field rendering only).
- No calling `navigator.credentials` from the page.

## Decisions

1. **One tool with two panels (Registration / Assertion) and an AAGUID side table** — not three tools. Rationale: the inputs overlap (both carry `authenticatorData` and `clientDataJSON`); a developer debugging a relying party moves between them in one session. Rejected: folding it into the JWT / credential Inspector — that tool is already the SD-JWT + mdoc decoder and its input field is a single token textarea; WebAuthn needs three fields and a key.
2. **Input auto-detection by shape.** A JSON object with `response.clientDataJSON` is the `toJSON()` form (`PublicKeyCredential.toJSON()`, Level 3 §5.1); a JSON with `response.attestationObject` is a registration, with `response.signature` an assertion; two bare base64url strings are taken as the field pairs in panel order. Rejected: a format dropdown — the shapes are unambiguous.
3. **CBOR via the existing `cborDecode()`, extended to return the byte offset where it stopped.** The COSE key inside `authData` has no length prefix; the only way to find the extensions map is to know how many bytes the key consumed. The decoder gains an optional `{consumed}` return; the format tool's behaviour is unchanged. Rejected: a second CBOR parser (house rule: one engine per format).
4. **COSE → JWK mapping as a 40-line table**, then everything downstream (PEM export, Web Crypto import) goes through `jwkToPem()` and `crypto.subtle.importKey('jwk', …)`. EC2 `kty 2` → `EC` with `crv` -1 (1 = P-256, 2 = P-384, 3 = P-521), `x` -2, `y` -3; RSA `kty 3` → `n` -1, `e` -2; OKP `kty 1` → `Ed25519` with `crv` 6, `x` -2. `alg` -7 ES256, -35 ES384, -36 ES512, -257 RS256, -8 EdDSA (RFC 9053 §2.1, §2.2; RFC 8812 §2 for RS256). Rejected: importing COSE directly into Web Crypto (no such import format exists).
5. **Signatures via Web Crypto, DER → raw conversion reused from the CSR tool.** WebAuthn ES256 signatures are DER `ECDSA-Sig-Value` (§6.5.5 / RFC 3279); Web Crypto wants raw `r‖s`. The CSR decoder already has that routine. RS256 verifies as `RSASSA-PKCS1-v1_5`, EdDSA as `Ed25519` (with the existing unsupported-browser banner from the Ed25519 tool). Pure JS is used for nothing cryptographic.
6. **`rpIdHash` check requires the user to type the RP ID.** The hash is one-way; the tool computes `SHA-256(rpId)` and compares. It also offers the origin's host from `clientDataJSON.origin` as the default suggestion, because the RP ID is that host or a registrable suffix of it (§5.1.3 step 7). Rejected: a rainbow table of common RP IDs.
7. **`packed` verification covers three cases** (§8.2 verification procedure): `x5c` present → verify with the leaf certificate's SubjectPublicKeyInfo and check the `id-fido-gen-ce-aaguid` extension (1.3.6.1.4.1.45724.1.1.4) equals the authData AAGUID when present; no `x5c` → self-attestation verified with the credential public key itself and the `alg` must match the credential's; `ecdaaKeyId` → reported as removed in Level 2 and not verified.
8. **`tpm`, `android-key`, `apple` are decoded structurally, not verified.** `tpm`: `pubArea` / `certInfo` TPMS_ATTEST fields (magic `0xFF544347`, type `TPM_ST_ATTEST_CERTIFY`, `extraData` compared to `SHA-256(authData ‖ clientDataHash)` — that single equality is cheap and is checked); `android-key` and `apple`: `x5c` rendered, the nonce extension (`1.2.840.113635.100.8.2` for Apple) decoded and compared to `SHA-256(authData ‖ clientDataHash)`. Signature-over-cert verification needs the vendor roots and is a trust decision the page does not make.
9. **AAGUID table is hand-maintained and short (~20 rows).** The community list (github `passkeydeveloper/passkey-authenticator-aaguids`) has an unverified licence as of 2026-10-19; it is not vendored. If MIT / CC0 is confirmed at implementation the table can grow with README credit; otherwise it stays a curated subset with each row's source noted in a code comment.
10. **Gate rows reuse the SEPA / UBL `{ok, label, detail, clause}` framework** and the same renderer.

## Risks / Trade-offs

- **Flag semantics drift.** Level 3 renamed nothing but added BE / BS; a Level 4 could add bits 1 / 5. Mitigation: reserved bits are shown as "reserved (bit n) = 1" rather than ignored, so a future flag is visible before the table is updated.
- **COSE key edge cases.** Some authenticators emit RSA keys with 3-byte `e`; some emit EC2 keys without `alg`. The mapping treats `alg` as optional for display and requires it only for self-attestation verification (§8.2 step 3).
- **CBOR trailing bytes.** Authenticators occasionally emit `authData` with padding after the extensions map; the decoder reports "n trailing bytes after extensions" as a ⚠ row, not an error.
- **False confidence.** A verified assertion proves possession of the private key matching the key *the user pasted*. Nothing proves that key belongs to a given person or device; the summary line says so and the AAGUID row says "self-reported by the authenticator; only attestation ties it to a vendor".
- **Ed25519 in Web Crypto** is unavailable in older browsers; EdDSA assertions fall back to the existing capability banner from the Ed25519 tool.
