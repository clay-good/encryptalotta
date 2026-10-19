# Design — OpenPGP packet inspector and key maintenance

## Context

An OpenPGP object (RFC 9580) is a sequence of packets, each `header ‖ body`. The header is a tag byte — OpenPGP format (bit 6 set, tag in bits 0–5) or legacy format (tag in bits 2–5, length-type in bits 0–1) — followed by a length encoding (§4.2.1: one-octet, two-octet, five-octet, or partial-body). A transferable public key (§10.1) is Public-Key (6), User ID (13), Signature (2), Public-Subkey (14), Signature (2), …; a message is PKESK (1) / SKESK (3), then SEIPD (18, v1 with MDC or v2 AEAD), containing Compressed (8) and Literal (11).

OpenPGP.js 6.3.2 parses all of this: `(await openpgp.readKey({armoredKey})).toPacketList()` yields typed packet objects (`PublicKeyPacket`, `SignaturePacket` with `signatureType`, `hashAlgorithm`, hashed / unhashed subpackets, `UserIDPacket`, …). What it does not keep is each packet's byte offset in the original stream, and it throws on algorithm IDs it does not know (RFC 9980 PQC). A ~50-line header-only walker — tag, length encoding, offsets, nothing else — fills both gaps: it is zipped with the OpenPGP.js packet list by position, and when OpenPGP.js refuses the whole object the walker still lists tags, lengths, and (for key packets) the algorithm ID byte.

Key editing in OpenPGP.js: `reformatKey({privateKey, userIDs, keyExpirationTime, passphrase})` re-creates self-signatures (expiry, user IDs); `decryptKey` + `encryptKey` change the passphrase; `privateKey.addSubkey({curve | rsaBits, sign: false})` adds an encryption subkey; `revokeKey` for the whole key (already used by the Revocation Certificate tool); `User.revoke` and `Subkey.revoke` for components.

## Goals / Non-Goals

**Goals:**
- Packet dump readable by someone holding RFC 9580 open: every number is named (tag, algorithm, subpacket type, signature type, S2K, AEAD mode).
- Deep view answers "why does this key fail to import / encrypt": weak algorithm, expired component, missing flags, unknown algorithm.
- Maintenance operations are reversible in the user's hands: the original is never modified in place; the output is a new armored block beside a diff.
- Private material: masked, auto-cleared, never persisted.

**Non-Goals:**
- No second OpenPGP parser; the header walker reads tags and lengths only.
- No RFC 9980 generation or verification; no certification of other people's keys; no keyserver / WKD / DANE fetch; no smart cards.
- No message decryption in the packet tab (SEIPD bodies are shown as opaque ciphertext with their mode; the Decrypt tool decrypts).

## Decisions

1. **Tabs inside Key Info, not a new tool.** Rationale: the input is the same key; "Packets" and "Maintain" are views of it. Generate PGP Keys gets a handoff button because a freshly generated key is the most common maintenance subject. Rejected: an "OpenPGP Packet Dumper" tool — the §10 "fewer, deeper tools" instinct from the exemplar applies.
2. **OpenPGP.js for bodies, hand-rolled walker for headers and offsets.** Pure JS, ~50 lines: new-format and legacy-format tags, the four length encodings, partial-body chaining (§4.2.1.4). Output `[{tag, formatLegacy, lengthEncoding, headerLen, bodyLen, offset}]`. Zipped by index with `toPacketList()`; a length mismatch between the two is itself a ⚠ row. Rejected: re-serializing each OpenPGP.js packet with `write()` to compute offsets — it normalizes encodings and would misreport legacy-format keys.
3. **Field rendering tables, one per packet class.** Public-key algorithms §9.1 (1 RSA, 16 ElGamal, 17 DSA, 18 ECDH, 19 ECDSA, 22 EdDSALegacy, 25 X25519, 26 X448, 27 Ed25519, 28 Ed448); hash §9.5; symmetric §9.3; AEAD §9.6 (1 EAX, 2 OCB, 3 GCM); compression §9.4; S2K §3.7.1 (0 simple, 1 salted, 3 iterated-salted with the decoded count, 4 Argon2 with t / p / m); signature types §5.2.1; subpacket types §5.2.3.7 (2 creation, 3 expiration, 9 key expiration, 11 / 21 / 22 / 39 preferences, 16 issuer key ID, 20 notation, 23 key server prefs, 27 key flags with each bit named, 30 features, 32 embedded signature — rendered recursively, 33 issuer fingerprint, 35 intended recipient). Unknown IDs render as "unknown (n)" with RFC 9980 named as the likely source for 29–50.
4. **Deep view is a walk of OpenPGP.js's object model, not of packets.** `key.getSubkeys()`, `subkey.getExpirationTime()`, key flags from the binding signature, `key.users[]` with `selfCertifications`, `otherCertifications` (count only), `revocationSignatures`; `key.isRevoked()` and per-component revocation. Gates (SEPA / UBL `{ok, label, detail, clause}`): no SHA-1 / MD5 in any self-signature (RFC 9580 §9.5 — SHA-1 MUST NOT be used for new signatures); no DSA / ElGamal (§9.1 deprecated); RSA ≥ 3072 (BSI TR-02102-1, 2025); no expired component; an encryption-capable subkey exists; primary key does not carry the encrypt flag; v3 / v4 / v6 version row; preferred algorithms do not list 3DES / IDEA / CAST5 first; features include SEIPD v2 (⚠ otherwise, not ✗).
5. **Quantum-safe row comes from the shared `pqc-readiness-indicator`** (change `pqc-signatures-and-kems`), called with the primary and subkey algorithms; until that change lands the row reads "RSA / ECC — not post-quantum (NIST IR 8547: deprecated after 2030)" from a local fallback with the same wording.
6. **Maintenance operations are pure functions `(privateKey, params) → newPrivateKey`**, each implemented with a single OpenPGP.js call where one exists: expiry → `reformatKey` with `keyExpirationTime` (re-signs all user IDs; the user is told the self-signature dates change); passphrase → `decryptKey` then `encryptKey` (empty passphrase allowed with a ⚠); add user ID → `reformatKey` with the extended `userIDs`; revoke user ID → `user.revoke()` with reason 0x20 "no longer valid"; revoke subkey → `subkey.revoke()` with reason 0x01 superseded / 0x02 compromised / 0x03 retired; add subkey → `addSubkey({curve: 'curve25519Legacy' | 'ed25519'...})` for v4 keys (`x25519` on v6) or `{rsaBits: 3072 | 4096}`. Rejected: hand-building signature packets — OpenPGP.js owns signing.
7. **Diff = two Key Info renders side by side, with changed rows highlighted** by comparing the existing renderer's row model (label → value). Same renderer, no new formatter.
8. **Export only the new key**; the original stays in its textarea. The armored output is also offered as the public key alone (`toPublic().armor()`) because that is what the user publishes.
9. **WKD** (draft-koch-openpgp-webkey-service §3.1): `hash = zbase32(SHA-1(lowercase(localpart)))`, z-base-32 alphabet `ybndrfg8ejkmcpqxot1uwisza345h769` (RFC 6189 §5.1.6); advanced `https://openpgpkey.<domain>/.well-known/openpgpkey/<domain>/hu/<hash>?l=<localpart>`; direct `https://<domain>/.well-known/openpgpkey/hu/<hash>?l=<localpart>`; `l=` carries the local part as written, percent-encoded; domain lowercased. SHA-1 via `crypto.subtle.digest('SHA-1')`; z-base-32 is ~15 lines pure JS. Also the policy-file URL.
10. **Autocrypt Level 1**: parse `addr=`, `prefer-encrypt=` (`mutual` | `nopreference`), `keydata=` (Base64 of a binary transferable public key; whitespace / folding stripped); hand the bytes to `readKey({binaryKey})` → Key Info; gate `addr` against the key's user IDs. Generate: build a minimal key — primary, the matching user ID, its self-signature, one encryption subkey and its binding signature — as a `PacketList`, `write()`, Base64, fold at 76 columns with leading space. Rejected: emitting the full key — Autocrypt asks for the minimal key to keep headers small.
11. **Passphrase hygiene.** Passphrase fields are `type="password"`, cleared after each operation and on `pagehide`; decrypted key objects are dropped after the operation; nothing is written to `localStorage`.

## Risks / Trade-offs

- **OpenPGP.js API surface.** `User.revoke` / `Subkey.revoke` are exported classes' methods but less documented than `revokeKey`; if a 6.x minor changes them, the two operations degrade to "not available in this build" rather than breaking the tab. Pinned version is 6.3.2.
- **`reformatKey` rewrites all self-signatures**, so an expiry change also refreshes preference subpackets to OpenPGP.js defaults. The diff makes this visible; the info text states it.
- **Partial-body lengths** appear in messages, not keys; the walker handles them but the fixture coverage is thinner there.
- **WKD local-part case.** The hash uses the lowercased local part but `l=` carries the original; getting this backwards yields a URL servers will 404 on. Mitigation: the draft's own example as the test vector.
- **Operator error.** Adding a subkey or extending expiry on the wrong key is the user's call; the before / after diff and the fingerprint in both columns are the guard. A compromised endpoint sees the passphrase regardless (THREAT-MODEL.md).
