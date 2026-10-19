# Spec Delta — key-maintenance

## Purpose

Perform the routine OpenPGP key-maintenance operations — expiration, passphrase, user IDs, subkeys, component revocation — on a pasted private key inside the browser tab with OpenPGP.js 6.3.2, showing a before / after Key Info diff and exporting the updated armored key, per RFC 9580.

## ADDED Requirements

### Requirement: Private key ingestion and passphrase handling
The tool SHALL accept an armored or binary private key (RFC 9580 §10.2), SHALL take the passphrase in a masked field, SHALL decrypt the key once per operation and discard the decrypted object afterwards, SHALL clear the passphrase field after each operation and on `pagehide`, and SHALL never write key material to `localStorage`.

#### Scenario: Wrong passphrase
- **WHEN** the passphrase does not decrypt the key
- **THEN** the operation is refused with "passphrase does not unlock this key" and the field is cleared

#### Scenario: Passphrase cleared
- **WHEN** an operation completes or a `pagehide` event fires
- **THEN** the passphrase field is empty

### Requirement: Expiration and user-ID operations
The tool SHALL set or extend the key expiration (`reformatKey` with `keyExpirationTime`, producing new self-signatures per RFC 9580 §5.2.3.13), SHALL add a user ID (`reformatKey` with the extended list, RFC 9580 §5.11 format `Name (Comment) <email>`), and SHALL revoke a user ID with a 0x30 Certification Revocation signature and reason code (§5.2.3.31), telling the user that `reformatKey` re-signs every user ID and refreshes preference subpackets.

#### Scenario: Extend expiry by two years
- **WHEN** the user selects "set expiry" with two years from today
- **THEN** the diff shows the expiration row changing to the new date, the self-signature dates changing to today, and the exported key re-imports with `getExpirationTime()` equal to the new date

#### Scenario: Revoke a user ID
- **WHEN** the user revokes `old@example.com` with reason "no longer valid"
- **THEN** the diff marks that user ID revoked, the others unchanged, and the exported key still carries the revoked user ID with its revocation signature

### Requirement: Passphrase change
The tool SHALL change the passphrase via `decryptKey` followed by `encryptKey` (RFC 9580 §3.7.2.1 S2K protection as applied by OpenPGP.js), SHALL allow an empty new passphrase only behind an explicit ⚠ confirmation, and SHALL report the resulting S2K specifier and cipher / AEAD in the diff.

#### Scenario: New passphrase
- **WHEN** a new passphrase is entered twice and applied
- **THEN** the exported key decrypts with the new passphrase and not the old, and the diff's secret-key protection row shows the S2K and cipher used

#### Scenario: Empty passphrase refused by default
- **WHEN** the new passphrase is empty and the confirmation box is unchecked
- **THEN** the operation is refused with "this would store the secret key unencrypted"

### Requirement: Subkey operations
The tool SHALL add an encryption subkey (`addSubkey`; Curve25519 — X25519 on v6 keys, ECDH Curve25519 on v4 — or RSA 3072 / 4096, with key flags encrypt communications + storage, RFC 9580 §5.2.3.29) with an optional expiry, and SHALL revoke a subkey with a 0x28 Subkey Revocation signature and reason code (superseded, compromised, retired — §5.2.3.31).

#### Scenario: Add Curve25519 subkey
- **WHEN** "add encryption subkey, Curve25519, 2 years" is applied to a v4 key
- **THEN** the diff shows one added subkey row (ECDH Curve25519, encrypt flags, expiry) and the packet dump of the export shows a new Public-Subkey / Secret-Subkey packet followed by a 0x18 binding signature

#### Scenario: Revoke compromised subkey
- **WHEN** a subkey is revoked with reason "compromised"
- **THEN** the diff marks it revoked with reason 0x02 and the deep view's encryption-capability gate re-evaluates against the remaining subkeys

### Requirement: Diff and export
The tool SHALL render Key Info for the original and the result side by side with changed, added, and removed rows highlighted, SHALL show both fingerprints (unchanged by every operation), SHALL offer the updated private key and its public key as armored text and `.asc` downloads, and SHALL leave the original input untouched.

#### Scenario: Fingerprint unchanged
- **WHEN** any operation completes
- **THEN** both columns show the same primary fingerprint and the diff header reads "same key — n rows changed"

#### Scenario: Re-import self-check
- **WHEN** an operation's output fails to re-import through `readPrivateKey`
- **THEN** no export is offered and the message names the OpenPGP.js error

### Requirement: Offline operation and verdict language
The tool SHALL perform every operation without any network request and SHALL describe the result as "key updated in this tab — publish the public key yourself; nothing was sent to a keyserver", never as the key being safe or trusted.

#### Scenario: Input never leaves the page
- **WHEN** a private key is modified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Result wording
- **WHEN** an operation completes
- **THEN** the status line is the sentence above and contains neither "secure" nor "safe"
