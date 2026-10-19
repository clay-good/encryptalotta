# Spec Delta — did-and-multiformats-decoding

## Purpose

Decode resolution-free Decentralized Identifiers (`did:key`, `did:jwk`, `did:web` URL derivation) and the multiformats they build on — multibase, unsigned varint, multicodec, multihash, CIDv0 / CIDv1 — and compute a CIDv1 for a pasted file, entirely in the browser.

## ADDED Requirements

### Requirement: did:key decoding
The tool SHALL decode `did:key:z…` by Base58-btc-decoding the multibase payload and reading the multicodec varint — 0xed Ed25519, 0xec X25519, 0x1200 P-256, 0x1201 P-384, 0x1205 RSA (did:key method spec §3.1.1; multicodec table) — SHALL render the key type, raw bytes, JWK (decompressing P-256 / P-384 points), SPKI PEM via the existing JWK ↔ PEM engine, and the derived verification-method id `did:key:z…#z…`.

#### Scenario: did:key spec Ed25519 example
- **WHEN** `did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK` is pasted
- **THEN** the result reads Ed25519 (multicodec 0xed), a 32-byte key, a JWK with `kty OKP`, `crv Ed25519`, and a PEM beginning `-----BEGIN PUBLIC KEY-----`

#### Scenario: Unknown multicodec
- **WHEN** the varint is not in the table
- **THEN** the result shows the code in hex and the remaining byte count, with "not a key type this tool knows"

### Requirement: did:jwk and did:web
The tool SHALL decode `did:jwk:<base64url>` to its JWK (did:jwk method spec §3) and SHALL derive the `did:web` document URL (did:web method spec §3.2): `did:web:example.com` → `https://example.com/.well-known/did.json`; `did:web:example.com:user:alice` → `https://example.com/user/alice/did.json`; `%3A` in the host → `:` for a port — as text only, never fetched.

#### Scenario: did:web with path
- **WHEN** `did:web:example.com:user:alice` is pasted
- **THEN** the URL row reads `https://example.com/user/alice/did.json` and no request occurs

#### Scenario: did:web with port
- **WHEN** `did:web:localhost%3A8443` is pasted
- **THEN** the URL row reads `https://localhost:8443/.well-known/did.json`

### Requirement: Multibase, varint, and multihash
The tool SHALL decode multibase strings by prefix — `z` base58-btc, `f` / `F` base16, `b` / `B` base32, `u` / `U` base64url, `m` / `M` base64 (multibase spec table) — SHALL decode unsigned LEB128 varints, and SHALL decode a multihash as `varint code ‖ varint length ‖ digest` naming 0x12 sha2-256, 0x13 sha2-512, 0xb220 blake2b-256, 0x1e blake3 (multihash spec; multicodec table).

#### Scenario: Multihash of sha2-256
- **WHEN** the hex `1220` followed by 32 bytes is pasted as a multihash
- **THEN** the result reads code 0x12 sha2-256, length 32, and the digest in hex

### Requirement: CID decoding and computation
The tool SHALL decode CIDv0 (`Qm…`, 46 characters, Base58-btc of a sha2-256 multihash) and CIDv1 (multibase of `varint 1 ‖ codec ‖ multihash`) into version, codec name (0x55 raw, 0x70 dag-pb, 0x71 dag-cbor, 0x0129 dag-json), multihash, and the equivalent CIDv1 base32 form for a v0 input (CID spec), and SHALL compute a single-block `raw` CIDv1 for a pasted file with sha2-256 (Web Crypto) or blake3 (page engine), labelled as differing from IPFS chunked DAG CIDs for files over 256 KiB.

#### Scenario: v0 to v1 equivalence
- **WHEN** `QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG` is pasted
- **THEN** the result reads version 0, dag-pb, sha2-256, and the CIDv1 row reads `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`

#### Scenario: CIDv1 for a file
- **WHEN** a 12-byte file is loaded and sha2-256 is selected
- **THEN** the result is a `bafkrei…` CID (raw codec 0x55, base32) and the note about chunked DAGs is shown

### Requirement: Offline operation and verdict language
The tool SHALL decode without any network request, SHALL render every derived URL and IPFS path as text, and SHALL describe a decoded DID only as "decoded — not resolved; the controller and key binding are not verified".

#### Scenario: Input never leaves the page
- **WHEN** a `did:web` is decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Result wording
- **WHEN** a did:key decodes
- **THEN** the status reads "decoded — a did:key is self-certifying for the key bytes only; it identifies no person or organisation"
