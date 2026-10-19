# Proposal — Verifiable-credential presentation decoder (OpenID4VP, SD-JWT VC, mdoc DeviceResponse, DIDs, Data Integrity)

## Why

Under eIDAS 2.0 every EU member state must offer a **European Digital Identity Wallet by 24 December 2026**, and relying parties in regulated sectors must accept it by **24 December 2027** (ARF v3.x). The protocol stack is now stable: **OpenID4VP 1.0** and **OpenID4VCI 1.0** are Final (July 2025), **HAIP 1.0** was finalised in December 2025, **SD-JWT is RFC 9901** (November 2025), SD-JWT VC (draft-ietf-oauth-sd-jwt-vc-16) and the Token Status List (draft-ietf-oauth-status-list-20) are in the RFC Editor queue, and mdoc is ISO/IEC 18013-5. The shipped JWT / credential Inspector decodes one SD-JWT or one mdoc *issuer-signed* structure. It cannot read what a wallet actually sends a verifier — a `vp_token` carrying several credentials in different formats — nor the device-bound half of an mdoc (`deviceSigned`, `deviceAuth`), nor a status-list token, nor the `did:key` / `did:jwk` identifiers that W3C credentials use for issuers and holders.

Everything needed is in the page: the CBOR decoder with tag-24 recursion, the SD-JWT splitter and digest matcher, the mdoc MSO walker, `jwkVerify()`, the X.509 renderer for `x5chain`, SHA-256 / BLAKE3, Base58 and Base32 tables, `DecompressionStream('deflate')`, and ECDSA / Ed25519 via Web Crypto.

## What Changes

- **New panels inside the JWT / credential Inspector** (`jwt`), reached by the existing auto-detection plus a "Presentation" input. **No new top-level tool**; this extends the shipped JWT / credential Inspector, for which no OpenSpec baseline exists yet.
- **OpenID4VP response decode**: paste a `vp_token` (DCQL-keyed object), a full authorization response, or a Digital Credentials API response → one card per credential, each routed by format (`dc+sd-jwt`, `mso_mdoc`, `jwt_vc_json`, `ldp_vc`) to the right decoder; legacy `presentation_submission` / `descriptor_map` rendered when present.
- **SD-JWT VC**: `typ`, `vct`, `vct#integrity`, issuer-metadata URL (shown, never fetched), `status.status_list` pointer; paste the status list token → decompress, index, and report the credential's status bits.
- **mdoc DeviceResponse**: version, `documents[]`, `deviceSigned` namespaces, `deviceAuth`, `status`; MSO signature verified against the `x5chain` leaf; device signature verified when the user pastes the SessionTranscript; value digests recomputed per `IssuerSignedItem`.
- **DIDs and multiformats**: `did:key` → key type / JWK / PEM; `did:jwk` → JWK; `did:web` → derived URL; multibase, multihash, CIDv0 / CIDv1 decode; CIDv1 for a pasted file.
- **Data Integrity proofs**: verify `eddsa-jcs-2022` and `ecdsa-jcs-2019` via JCS (RFC 8785); `-rdfc-` suites reported as unsupported.

Out of scope (and the §7 non-goal it respects): no fetching of issuer metadata, `vct` type metadata, status lists, DID documents, trust lists, or IPFS gateways (§7.5 — every URL is shown, the user pastes what the verifier would fetch); no RDF Dataset Canonicalization (RDFC-1.0) and hence no `eddsa-rdfc-2022` / `ecdsa-rdfc-2019` / BBS proofs (too large for one inline file — §7.6 spirit); no wallet, no issuance (OpenID4VCI), no holder key storage (§7.9); no response-encryption JWE decrypt here — that is `jwe-encryption` in change `jose-token-builder-and-jwe`, called when present.

## Capabilities

### New Capabilities
- `openid4vp-presentation-decoding`: split an OpenID4VP 1.0 `vp_token` / authorization response / DC API response per credential format and route each to its decoder, rendering the DCQL query echo and any legacy Presentation Exchange submission.
- `sd-jwt-vc-decoding`: SD-JWT VC header and claim semantics (draft-ietf-oauth-sd-jwt-vc-16) on top of RFC 9901, plus Token Status List (draft-ietf-oauth-status-list-20) pointer decoding and status lookup from a pasted status-list token.
- `mdoc-device-response-decoding`: ISO/IEC 18013-5 `DeviceResponse` structure, MSO issuer-signature verification, device-authentication verification with a pasted SessionTranscript, and value-digest recomputation.
- `did-and-multiformats-decoding`: `did:key`, `did:jwk`, `did:web` resolution-free decoding; multibase, multihash, CIDv0 / CIDv1 decoding; CIDv1 computation for a file.
- `data-integrity-jcs-proof-verification`: W3C Data Integrity 1.0 proof verification for the JCS cryptosuites `eddsa-jcs-2022` and `ecdsa-jcs-2019`, with RDFC suites reported as unsupported.

### Modified Capabilities
- none (existing SD-JWT and mdoc issuer-signed decoding keep their behaviour; the new panels call the same functions).

## Impact

- `index.html`: ~900 lines of inline JS (presentation router, SD-JWT VC rows, status-list bit indexing, DeviceResponse walker, COSE_Sign1 verification, SessionTranscript / DeviceAuthentication builder, DID decoders, multiformat tables, JCS canonicalizer ~60 lines, proof verifier), ~70 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: `cborDecode()` (tag 24, COSE_Sign1), `sdJwtSplit()` / `sdJwtRender()` / `sdJwtImportJwk()`, `mdocTryDecode()` / `mdocRender()`, `jwkVerify()`, `jwkToPem()`, the `tls-cert` X.509 renderer for `x5chain`, `base58ToBytes()` and the Base32 / base64url tables from the encoder tool, `blake3()`, `crypto.subtle.digest` / `verify`, `DecompressionStream('deflate')`, `Intl.DateTimeFormat`, the SEPA / UBL gate renderer.
- No new vendored file, no CSP change, page weight +~24 KB gzipped.
- Tests: new `tests/specs/32-vc-presentation.spec.js` (number assigned at implementation) — a two-credential `vp_token` fixture (one `dc+sd-jwt`, one `mso_mdoc`), the RFC 9901 Appendix examples through the VC rows, a status-list token fixture with `bits: 1` and `bits: 2` and known indices, an 18013-5 DeviceResponse fixture with a self-issued `x5chain` and a SessionTranscript, the did:key spec Ed25519 example `did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK`, the CIDv0 / CIDv1 pair `QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG` / `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`, the RFC 8785 §3.2.3 canonicalization example, an `eddsa-jcs-2022` test vector from the W3C vc-di-eddsa test suite, and the network-silence assertion.
