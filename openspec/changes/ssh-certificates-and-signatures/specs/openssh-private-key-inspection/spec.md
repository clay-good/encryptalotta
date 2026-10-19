# Spec Delta — openssh-private-key-inspection

## Purpose

Inspect an `openssh-key-v1` private-key file (OpenSSH PROTOCOL.key) in the browser: report cipher, KDF, bcrypt parameters, key count, and public keys; parse the private section of unencrypted files; and state plainly that encrypted files are not decrypted.

## ADDED Requirements

### Requirement: Header decoding
The tool SHALL detect `-----BEGIN OPENSSH PRIVATE KEY-----` armor, verify the `openssh-key-v1\0` magic, and display ciphername, kdfname, kdfoptions (bcrypt salt as hex and rounds), number of keys, and each public key with its type and `SHA256:` fingerprint.

#### Scenario: Encrypted Ed25519 file
- **WHEN** an `id_ed25519` created with `ssh-keygen -t ed25519 -a 64` and a passphrase is pasted
- **THEN** the rows read cipher `aes256-ctr`, KDF `bcrypt` with 64 rounds and a 16-byte salt, 1 key, and the `ssh-ed25519` public key fingerprint

#### Scenario: Unencrypted file
- **WHEN** a file created without a passphrase is pasted
- **THEN** the rows read cipher `none`, KDF `none`, and the private section is parsed

#### Scenario: Wrong magic
- **WHEN** the decoded bytes do not start with `openssh-key-v1\0`
- **THEN** the tool reports "not an openssh-key-v1 file" and suggests the Key Format Converter for PKCS#8 / PKCS#1 input

### Requirement: Unencrypted private section
For cipher `none` the tool SHALL parse the private block: the two checkints (reported as equal or not), key type, the comment, and the 1..n padding bytes (reported as valid or not), and SHALL never display private scalars or seeds.

#### Scenario: Comment shown, scalars hidden
- **WHEN** the unencrypted fixture with comment `alice@laptop` is pasted
- **THEN** the comment row reads `alice@laptop`, the checkint row reads "consistent", the padding row "valid", and no row contains the private key bytes

#### Scenario: Corrupted private block
- **WHEN** the checkints differ
- **THEN** the row reads "checkints differ — file corrupted or (for an encrypted file) wrong passphrase" and parsing of the remainder stops

### Requirement: Encrypted files are reported, not decrypted
For any cipher other than `none` the tool SHALL state "encrypted with <cipher> / <kdf> (<rounds> rounds) — decryption needs bcrypt_pbkdf (Blowfish) and is deferred" and SHALL offer no passphrase field.

#### Scenario: Deferral row
- **WHEN** the encrypted fixture is pasted
- **THEN** the deferral row is shown with cipher `aes256-ctr` and 64 rounds, and no passphrase input is rendered

#### Scenario: Other ciphers
- **WHEN** the cipher is `aes256-gcm@openssh.com` or `chacha20-poly1305@openssh.com`
- **THEN** the same deferral row names that cipher

### Requirement: Offline operation and secret handling
Parsing SHALL run in the page; the input field SHALL be masked when this format is detected, registered with `clearSensitiveFields()` (cleared on `beforeunload`), and never placed in the URL or `localStorage`.

#### Scenario: Input never leaves the page
- **WHEN** a private-key file is pasted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Cleared on unload
- **WHEN** the page is unloaded with a private-key file in the input
- **THEN** the field is empty afterwards

### Requirement: Verdict language
A well-formed file SHALL be reported as "parses as openssh-key-v1" and SHALL NOT be described as secure, strong, or safe, whether or not it is encrypted.

#### Scenario: Clean result wording
- **WHEN** the encrypted fixture parses
- **THEN** the summary reads "Parses as openssh-key-v1 (PROTOCOL.key): 1 key, encrypted with aes256-ctr / bcrypt 64 rounds. This does not assess the passphrase or the key's strength."
