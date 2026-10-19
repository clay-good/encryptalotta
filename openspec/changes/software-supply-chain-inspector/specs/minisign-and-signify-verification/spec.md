# Spec Delta — minisign-and-signify-verification

## Purpose

Parse minisign (`.minisig`) and OpenBSD signify signature files and their `RWS…` public keys, and verify them in the browser — legacy `Ed` (Ed25519 over the file) and prehashed `ED` (Ed25519 over BLAKE2b-512 of the file) plus the trusted-comment global signature — so the site's own `RELEASES.md` can be checked without a Node script.

## ADDED Requirements

### Requirement: Signature and key parsing
The tool SHALL parse the minisign format (`untrusted comment:` line; Base64 of alg `Ed` or `ED` ‖ 8-byte key id ‖ 64-byte signature; `trusted comment:` line; Base64 64-byte global signature) and the signify two-line form, and SHALL parse a public key (`untrusted comment:` line; Base64 of `Ed` ‖ key id ‖ 32-byte key, 42 bytes), displaying the key id as the little-endian uppercase hex minisign prints.

#### Scenario: Pinned release key
- **WHEN** the key `RWSF2o7wI6QqGgABIako11R3e1+V9trHpv6k0b4vNPw/Q/qXnRXTtVX0` is pasted
- **THEN** the key id reads `1A2AA423F08EDA85` as in SECURITY.md

#### Scenario: Malformed signature
- **WHEN** the signature's Base64 decodes to other than 74 bytes
- **THEN** the result is ✗ "malformed signature" with the byte count

### Requirement: Verification
The tool SHALL verify with Web Crypto Ed25519: for `ED` the signature over BLAKE2b-512 (RFC 7693, inline engine) of the file, for `Ed` over the raw file; SHALL verify the global signature over signature ‖ trusted comment; SHALL fail with a key-id mismatch gate when the signature's key id differs from the key's; and SHALL report `prehashed`, key id and trusted comment on success, mirroring `scripts/verify-release-signature.js`.

#### Scenario: Site's release manifest verifies
- **WHEN** `RELEASES.md`, `RELEASES.md.minisig` and the pinned key are supplied
- **THEN** every row is ✓, the mode reads prehashed (`ED`), and the trusted comment is shown

#### Scenario: Reference fixtures
- **WHEN** the `tests/fixtures/minisign/` files produced by `minisign 0.12` are supplied
- **THEN** `msg.txt` verifies prehashed with key id `922C5652E9187228` and trusted comment `trusted test comment`; `msg-legacy.txt` verifies with `prehashed: false`

#### Scenario: Tampered file
- **WHEN** one byte of the file is changed
- **THEN** the file-signature row is ✗ "file signature does not verify" and the trusted-comment row is not evaluated

#### Scenario: Edited trusted comment
- **WHEN** the trusted-comment line is altered
- **THEN** the file-signature row is ✓ and the global-signature row is ✗ "trusted-comment signature does not verify"

#### Scenario: Wrong key
- **WHEN** a key whose id differs from the signature's is pasted
- **THEN** the key-id row is ✗ "signed by key X, expected Y" before any Ed25519 operation

### Requirement: Release-key preset and verdict language
The tool SHALL offer a one-click preset that fills the SECURITY.md release key, labelled "encryptalotta release key as pinned in SECURITY.md — still a key you choose to trust", and an all-✓ result SHALL read "verifies against the key you supplied — this does not establish that the key belongs to the publisher".

#### Scenario: Preset wording
- **WHEN** the preset is used and `RELEASES.md` verifies
- **THEN** the summary carries the verdict wording and links to SECURITY.md's key-pinning paragraph and to the Node script as the independent cross-check

### Requirement: Offline operation
Verification SHALL run in the page with no key or file fetched.

#### Scenario: Input never leaves the page
- **WHEN** a signature is verified while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
