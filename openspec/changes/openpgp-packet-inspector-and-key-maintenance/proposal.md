# Proposal — OpenPGP packet inspector and key maintenance

## Why

**Key Info** shows a PGP key the way a mail client does: fingerprint, user IDs, algorithm, size, dates. It does not show the key the way **RFC 9580** describes it — a sequence of packets — so when a key fails to import somewhere, nobody can see *which* packet or subpacket is the problem: a SHA-1 self-signature, a v6 key an older client rejects, a missing key-flags subpacket, an Argon2 S2K the recipient's software does not know. Today that means `gpg --list-packets` or `pgpdump` on a command line, or pasting the key into a hosted dumper.

Maintenance is worse. Extending an expiry, changing a passphrase, or adding an encryption subkey requires GnuPG's interactive `--edit-key`, and the browser-based alternatives upload the private key. **OpenPGP.js 6.3.2** — already vendored — can do every one of these operations (`reformatKey`, `decryptKey` / `encryptKey`, `addSubkey`, `revokeKey`, user and subkey revocation) in the tab.

Two small discovery helpers round it out: **Web Key Directory** URLs (draft-koch-openpgp-webkey-service) for an address, computed but never fetched, and **Autocrypt** (Level 1) header decode / encode, which is how keys travel in mail headers.

## What Changes

- **A "Packets" tab and a "Maintain" tab in Key Info** (`key-info`), plus a "WKD / Autocrypt" sub-panel; Generate PGP Keys gains a "maintain this key" handoff. **No new top-level tool**; this extends the shipped Key Info and Generate PGP Keys tools, for which no OpenSpec baseline exists yet.
- **Packet dump**: any armored or binary key / message / signature → RFC 9580 packet list with tag, version, header format and length encoding, hex offsets, and per-packet fields (algorithms, sizes, creation time, S2K, AEAD mode, signature type, hashed / unhashed subpackets with names, literal-data header, compression algorithm).
- **Deep key view**: subkeys with usage flags and expiries, user IDs with certification status, revocation status per component, preferred algorithms and features, "weak" gates in the ✓ / ✗ house style, and the quantum-safe row shared with `pqc-readiness-indicator` (change `pqc-signatures-and-kems`).
- **Key maintenance** on a pasted private key, in-page: extend or set expiration, change passphrase, add user ID, revoke a user ID, revoke a subkey, add an encryption subkey (Curve25519 or RSA), export the updated armored key — every operation with a before / after Key Info diff; passphrase fields auto-clear.
- **WKD and Autocrypt**: advanced and direct WKD URLs for an email address (z-base-32 of SHA-1 of the lowercased local part); `Autocrypt:` header → Key Info; Autocrypt header generation from a public key.

Out of scope (and the §7 non-goal it respects): no keyserver, WKD, or DANE lookups (§7.5 — URLs are computed, never fetched); no RFC 9980 post-quantum key generation or verification (OpenPGP.js 6.3.2 does not implement it; the packet walker reports the algorithm IDs so such keys are at least visible — generation belongs to `pqc-signatures-and-kems` when the library catches up); no smart-card / gpg-agent operations; no key storage between sessions (§7.9); no third-party certification signing ("sign someone's key") — a web-of-trust feature with social consequences the page should not casually enable.

## Capabilities

### New Capabilities
- `openpgp-packet-dump`: RFC 9580 packet-level view of any OpenPGP object using OpenPGP.js's packet list plus a header-only offset walker — tags, versions, lengths, offsets, per-packet fields, named signature subpackets.
- `key-info-deep-view`: per-component view of a key (subkeys, user IDs, certifications, revocations, preferences) with weak-algorithm and expiry gates per RFC 9580 §9 and BSI TR-02102-1, and the shared quantum-safe row.
- `key-maintenance`: in-page OpenPGP.js operations on a pasted private key — expiration, passphrase, user IDs, subkeys, revocations — with a before / after diff and an armored export.
- `web-key-directory-and-autocrypt`: WKD URL derivation (draft-koch-openpgp-webkey-service), `Autocrypt:` header decoding into Key Info, and Autocrypt header generation (Autocrypt Level 1).

### Modified Capabilities
- none (the existing Key Info summary and Generate PGP Keys flow are unchanged; the new tabs and handoff are additions).

## Impact

- `index.html`: tab strip in `#key-info-view`, ~600 lines of inline JS (header-offset walker ~50 lines, packet field renderers, subpacket name table, deep-view walker, gates, maintenance operations with diff, WKD z-base-32, Autocrypt parse / build), ~65 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: `openpgp.min.js` 6.3.2 (`readKey` / `readPrivateKey` / `readMessage` / `readSignature`, `toPacketList()`, `reformatKey`, `decryptKey` / `encryptKey`, `addSubkey`, `revokeKey`, user / subkey `revoke`, `armor()`), the existing Key Info renderer (reused for both halves of the diff), the SEPA / UBL gate renderer, `crypto.subtle.digest('SHA-1')`, the encoder tool's Base64 tables, `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`, the Decrypt tool's passphrase auto-clear pattern.
- No new vendored file, no CSP change, page weight +~16 KB gzipped.
- Tests: new `tests/specs/33-pgp-packets.spec.js` (number assigned at implementation) — a v4 Curve25519 key and a v6 key generated by OpenPGP.js (packet tags 6 / 13 / 2 / 14 / 2 in order, offsets contiguous and summing to the binary length), a legacy-format RSA key with a SHA-1 self-signature (weak gate ✗), each maintenance operation with its diff assertion and a re-import through `readKey`, passphrase auto-clear, the WKD vector from the draft (`Joe.Doe@Example.ORG` → `iy9q119eutrkn8s1mk4r39qejnbu3n5q`), an Autocrypt header round trip, and the network-silence assertion.
