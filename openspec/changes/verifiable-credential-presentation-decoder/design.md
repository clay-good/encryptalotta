# Design — Verifiable-credential presentation decoder

## Context

A verifier receives an OpenID4VP 1.0 authorization response: `vp_token` is a JSON object keyed by DCQL credential-query id, each value an array of presentations; the credential format decides the string shape — `dc+sd-jwt` is `<jwt>~<disc>~…~[kb-jwt]`, `mso_mdoc` is base64url CBOR of a `DeviceResponse`, `jwt_vc_json` is a compact JWS whose `vp` claim wraps `verifiableCredential[]`, `ldp_vc` is a JSON-LD document with a `proof`. Over the W3C Digital Credentials API the same object arrives as the response `data`; when `response_mode` is `dc_api.jwt` it is a JWE.

Primitive availability:

| Primitive | Where | Web Crypto / pure JS |
|---|---|---|
| CBOR, tag 24, COSE_Sign1 | `cborDecode()` | pure JS (existing) |
| SD-JWT split / `_sd` digests / KB-JWT | `sdJwtSplit()`, `sdJwtRender()` | existing + Web Crypto SHA |
| mdoc MSO walk, x5chain | `mdocTryDecode()`, `mdocRender()`, `tls-cert` | existing |
| ES256 / 384 / 512 verify over Sig_structure | `crypto.subtle.verify` | Web Crypto (COSE signatures are raw `r‖s`, RFC 9053 §2.1) |
| Ed25519 verify | `crypto.subtle.verify` | Web Crypto (banner when absent) |
| ZLIB inflate (status list) | `DecompressionStream('deflate')` | native |
| SHA-256 / 384 / 512 | `crypto.subtle.digest` | Web Crypto |
| BLAKE3 (CID option) | `blake3()` | pure JS (existing) |
| Base58-btc, Base32, base64url | encoder tool tables | pure JS (existing) |
| Varint, multicodec, multihash | new, ~40 lines | pure JS |
| JCS canonicalization | new, ~60 lines | pure JS |

## Goals / Non-Goals

**Goals:**
- One paste, many credentials: the router never asks the user which format they have.
- Every "the verifier would now fetch X" step is rendered as a URL string and a paste field, never a request.
- Real verification where the inputs allow it: MSO signature against `x5chain[0]`, device signature with a pasted SessionTranscript, value digests, SD-JWT digests (existing), JCS Data Integrity proofs, status bits.
- Verdicts name exactly which key or certificate the math was checked against.

**Non-Goals:**
- No RDF canonicalization; `-rdfc-` and BBS suites are reported unsupported with the suite name.
- No trust: `x5chain[0]` is not chained to any IACA root unless the user pastes one into the TLS Certificate Parser; the did:web document is not fetched; `vct#integrity` is checked only when the user pastes the type-metadata document.
- No session-transcript construction from scratch for the DC API / OpenID4VP handover (it needs the client_id, nonce, origin, and jwk thumbprint; slice 1 accepts the CBOR the user has).

## Decisions

1. **Router by shape, then by `format` when a DCQL / submission hint is present.** `~` in the string → SD-JWT; valid base64url decoding to CBOR starting with a map containing `documents` → DeviceResponse; three-part JWS with `vp` claim → `jwt_vc_json`; JSON with `@context` and `proof` → `ldp_vc`. The `format` from `presentation_submission.descriptor_map` or from a pasted DCQL query overrides the guess and is reported when they disagree. Rejected: format dropdown.
2. **Encrypted responses hand off, not decrypt here.** A JWE (`response=` JWE or five-part string) is passed to `jwe-encryption` (change `jose-token-builder-and-jwe`) when present; otherwise the panel says "encrypted response — decrypt with the verifier's private key in the Build / Encrypt tab".
3. **SD-JWT VC rows sit on top of the existing SD-JWT decode.** `typ` must be `dc+sd-jwt` (draft-16 §3.2.1; `vc+sd-jwt` accepted as legacy with a ⚠); `vct` shown with its `vct#integrity` SRI string; issuer metadata URL `https://<iss host>/.well-known/jwt-vc-issuer<iss path>` derived per draft-16 §5; `status.status_list.{idx, uri}` rendered as the pointer (draft-ietf-oauth-status-list-20 §6.1).
4. **Status list lookup from a pasted token.** JWT (`typ: statuslist+jwt`) or CWT (`statuslist+cwt`, via `cborDecode()`); `status_list.bits` ∈ {1, 2, 4, 8}; `lst` base64url → ZLIB (RFC 1950) → `DecompressionStream('deflate')`; the status is the `bits`-wide value at bit offset `idx × bits`, least-significant bit first within each byte (draft-20 §4.1); values 0x00 VALID, 0x01 INVALID, 0x02 SUSPENDED, 0x03 APPLICATION_SPECIFIC (§7). `sub` must equal the credential's `uri` (§6.3). Signature via `jwkVerify()` with a pasted key. Rejected: hand-rolled inflate — the native stream is already the Factur-X path.
5. **DeviceResponse walker extends `mdocTryDecode()`** rather than replacing it: `{version, documents:[{docType, issuerSigned, deviceSigned, errors}], documentErrors, status}` (ISO/IEC 18013-5 §8.3.2.1.2.2). `issuerSigned` is handed to the existing MSO renderer; `deviceSigned.nameSpaces` is a tag-24 `DeviceNameSpacesBytes`; `deviceAuth` is `deviceSignature` (COSE_Sign1, detached payload) or `deviceMac` (COSE_Mac0 — structure only, the ECDH-derived MAC key needs the reader's ephemeral private key).
6. **COSE_Sign1 verification builds Sig_structure in-page**: `["Signature1", protected, external_aad = h'', payload]` (RFC 9052 §4.4), CBOR-encoded by a small encoder (~30 lines: arrays, byte strings, text, small ints — the page has only a decoder today). For the MSO, payload is the tag-24 `MobileSecurityObjectBytes`; the key comes from the `x5chain` leaf (header label 33, RFC 9360) via `asn1Parse()` → SPKI → `importKey('spki')`. For the device signature, payload is `DeviceAuthenticationBytes` = tag 24 of `["DeviceAuthentication", SessionTranscript, docType, DeviceNameSpacesBytes]` (18013-5 §9.1.3.4) and the key is `deviceKeyInfo.deviceKey` from the MSO. Rejected: asking the user for the device key — it is already in the MSO.
7. **Value digests**: for every `IssuerSignedItem`, hash the tag-24 `IssuerSignedItemBytes` exactly as received (never re-encoded) with the MSO `digestAlgorithm` and compare to `valueDigests[nameSpace][digestID]` (18013-5 §9.1.2.5). Same "slice the original bytes" rule as the CSR tool.
8. **DID decoders are tables, not resolvers.** `did:key`: strip `z`, Base58-btc decode, read the multicodec varint (0xed Ed25519, 0xec X25519, 0x1200 P-256, 0x1201 P-384, 0x1205 RSA), split the key, build the JWK (compressed P-256 / P-384 points decompressed with BigInt modular square root — ~25 lines pure JS, the only arithmetic in this change), PEM via `jwkToPem()`. `did:jwk`: base64url → JWK. `did:web`: method-specific id → `https://` URL with `:` → `/`, `%3A` → `:`, `/.well-known/did.json` for a bare host, `/did.json` otherwise (did:web spec §3.2) — URL only.
9. **Multiformats as one module.** Multibase prefix table (`z`, `f`, `F`, `b`, `B`, `u`, `U`, `m`, `M`), unsigned varint (LEB128), multicodec names for the codes the page meets (0x12 sha2-256, 0x13 sha2-512, 0xb220 blake2b-256, 0x1e blake3, 0x55 raw, 0x70 dag-pb, 0x71 dag-cbor, 0x0129 dag-json, 0xed / 0xec / 0x1200 / 0x1201 / 0x1205 keys). CIDv0 = Base58-btc of a sha2-256 multihash (`Qm…`, 46 chars); CIDv1 = multibase(varint 1 ‖ codec ‖ multihash). CIDv1 for a file: `raw` codec, sha2-256 (or blake3 via the page's engine), base32 lower — labelled "single-block raw CID; IPFS chunked DAG CIDs for files over 256 KiB will differ".
10. **JCS is hand-rolled from RFC 8785** (~60 lines): property sort by UTF-16 code units, number serialization per ECMAScript `Number.prototype.toString` (which RFC 8785 §3.2.2.3 adopts), string escaping per §3.2.2.2, no whitespace; checked against the RFC 8785 §3.2.3 example. Rejected: vendoring `canonicalize` — the page needs 60 lines, not a package.
11. **Data Integrity verification per vc-di-eddsa / vc-di-ecdsa.** Proof options = `proof` minus `proofValue`, plus the document's `@context`; hash data = `H(JCS(proofOptions)) ‖ H(JCS(document minus proof))`; `eddsa-jcs-2022` uses SHA-256 and Ed25519; `ecdsa-jcs-2019` uses SHA-256 with P-256 or SHA-384 with P-384 (chosen by the key). `proofValue` is multibase (`z` Base58-btc). The verification key comes from `verificationMethod` when it is a `did:key` (decoded by decision 8) or a pasted JWK / multikey. `created`, `expires`, `proofPurpose`, `challenge`, `domain` are shown; `expires` is gated.
12. **Gate rows reuse the SEPA / UBL `{ok, label, detail, clause}` framework.**

## Risks / Trade-offs

- **Draft churn.** SD-JWT VC and the status list are not yet RFCs; `typ` values and the `status` claim shape have changed before. Mitigation: constants carry the draft number; legacy values decode with a ⚠ instead of failing.
- **CBOR re-encoding.** Any byte of a COSE `protected` header or `IssuerSignedItemBytes` re-encoded differently breaks a digest. Mitigation: the decoder keeps `{start, end}` offsets so verification slices the original buffer; the only encoder output is the Sig_structure array, which is built, not reproduced.
- **P-256 point decompression** in did:key is the one piece of hand-rolled arithmetic; it is deterministic and checked against a known uncompressed key.
- **Status-list bit order** is easy to get backwards; the fixture carries indices at both ends of a byte for both `bits: 1` and `bits: 2`.
- **False confidence.** An mdoc whose MSO verifies against its own `x5chain[0]` is self-consistent, not issued by a government; every verdict says "against the certificate embedded in the credential — not chained to any IACA root".
