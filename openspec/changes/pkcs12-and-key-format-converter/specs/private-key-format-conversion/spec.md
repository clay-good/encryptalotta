# Spec Delta — private-key-format-conversion

## Purpose

Convert private and public keys between PKCS#1 (RFC 8017), SEC1 EC, PKCS#8 (RFC 5958, encrypted per RFC 8018 PBES2), OpenSSH `openssh-key-v1` / RFC 4253 public lines, and JWK (RFC 7517 / 7518 / 8037) for RSA, EC P-256 / 384 / 521, Ed25519, and X25519, with the private material never leaving the page.

## ADDED Requirements

### Requirement: Input detection and key record
The tool SHALL detect the input format from the PEM label, the `openssh-key-v1` magic, a JSON `kty`, or an SSH public-line prefix, SHALL parse it into one key record (RSA n / e / d / p / q / dp / dq / qi; EC curve / x / y / d; OKP curve / public / private), and SHALL display type, size or curve, the SHA-256 SPKI fingerprint, and the `SHA256:` OpenSSH fingerprint without displaying any private component.

#### Scenario: PKCS#1 RSA detected
- **WHEN** a `BEGIN RSA PRIVATE KEY` block for a 2048-bit key is pasted
- **THEN** the result rows read "PKCS#1 (RFC 8017) — RSA 2048" with both fingerprints and no modulus or exponent values

#### Scenario: OpenSSH Ed25519 detected
- **WHEN** an unencrypted `BEGIN OPENSSH PRIVATE KEY` for an Ed25519 key with comment `user@host` is pasted
- **THEN** the rows read "openssh-key-v1 — ssh-ed25519", the comment, and the checkint pair is reported as consistent

#### Scenario: Unsupported type
- **WHEN** a DSA key or an unknown PKCS#8 algorithm OID is pasted
- **THEN** the tool reports the OID and "not converted — unsupported key type" with the ASN.1 Decoder as the fallback link

### Requirement: Output formats
The tool SHALL re-encode the key record as PKCS#1 (RSA) or SEC1 (EC), PKCS#8, OpenSSH private (cipher `none`, kdf `none`, random equal checkints, per-type field order from `sshkey.c`, 8-byte padding), JWK (private members per RFC 7518 §6 / RFC 8037 §2), SPKI PEM, or an OpenSSH public line, as applicable to the key type, and SHALL state which outputs do not apply (PKCS#1 for non-RSA, SEC1 for non-EC).

#### Scenario: PKCS#8 → OpenSSH RSA byte structure
- **WHEN** an RSA PKCS#8 key is converted to OpenSSH private
- **THEN** the private block carries n, e, d, iqmp, p, q in that order and `ssh-keygen -y -f` on the download yields the same public line the tool displays

#### Scenario: OpenSSH → PKCS#8 is byte-identical to OpenSSL
- **WHEN** the `ssh-keygen` P-256 fixture is converted to PKCS#8
- **THEN** the DER equals the `openssl pkey` output for the same key byte for byte

#### Scenario: JWK round trip
- **WHEN** a P-384 PKCS#8 key is converted to JWK and the JWK back to PKCS#8
- **THEN** the final DER equals the original and the JWK carries `kty`, `crv`, `x`, `y`, `d` as base64url without padding

#### Scenario: Ed25519 public derivation
- **WHEN** an Ed25519 PKCS#8 key without the optional `[1] publicKey` is converted to OpenSSH
- **THEN** the public key is derived through Web Crypto where supported; otherwise the tool names the missing browser support (Safari 17 / Chrome 113 / Firefox 130) and does not guess

### Requirement: Encrypted PKCS#8 decryption
The tool SHALL decrypt `BEGIN ENCRYPTED PRIVATE KEY` input encrypted with PBES2 (RFC 8018 §6.2) using PBKDF2 (HMAC-SHA-1 / 256 / 384 / 512) and AES-128 / 192 / 256-CBC via Web Crypto, SHALL display the KDF parameters before decryption, and SHALL report PBES1 or unknown schemes as not decrypted with their OIDs.

#### Scenario: OpenSSL 3 default
- **WHEN** a key encrypted with `openssl pkcs8 -topk8` (PBKDF2-HMAC-SHA-256, 2048 iterations, AES-256-CBC) is pasted with the correct passphrase
- **THEN** the parameter rows show those values and the key record is populated

#### Scenario: Wrong passphrase
- **WHEN** the passphrase is wrong
- **THEN** the tool reports "decryption failed — wrong passphrase or corrupted data" from padding / ASN.1 failure and shows nothing else

#### Scenario: PBES1 input
- **WHEN** the scheme is `pbeWithMD5AndDES-CBC`
- **THEN** the row reads "PBES1 (RFC 8018 §6.1) — not decrypted; re-wrap with `openssl pkcs8 -topk8 -v2 aes-256-cbc`"

### Requirement: Encrypted PKCS#8 output
The tool SHALL optionally encrypt PKCS#8 output with PBES2 / PBKDF2-HMAC-SHA-256 / AES-256-CBC, random 16-byte salt and IV, iterations defaulting to 2,048 (OpenSSL 3 interoperability default, labelled low) with a floor of 1,000 and a warning below 100,000.

#### Scenario: Encrypted output opens in OpenSSL
- **WHEN** a key is exported encrypted with 100,000 iterations
- **THEN** the PEM decrypts with `openssl pkey -in … -passin` and the AlgorithmIdentifier declares PBKDF2 / hmacWithSHA256 / 100000 / aes256-CBC

#### Scenario: Low iteration warning
- **WHEN** the iteration field is set to 2,048
- **THEN** a ⚠ row reads "2,048 iterations is the OpenSSL default and low; OWASP recommends far more for new files"

### Requirement: Public-key conversion
The tool SHALL convert SPKI PEM ↔ OpenSSH public line (RFC 4253 encoding, RFC 4716 block accepted) ↔ public JWK for the same key types, reusing the JWK ↔ PEM tool's OKP prefix.

#### Scenario: SPKI → OpenSSH line
- **WHEN** an Ed25519 SPKI PEM is pasted with target "OpenSSH public"
- **THEN** the output is `ssh-ed25519 AAAA… comment` and equals the `ssh-keygen` fixture's `.pub` line

### Requirement: Offline operation and secret handling
Every conversion SHALL run in the page; input, output, and passphrase fields SHALL be masked by default, registered with `clearSensitiveFields()` (cleared on `beforeunload`), never placed in the URL or `localStorage`, and key buffers SHALL be zero-filled after each operation.

#### Scenario: Input never leaves the page
- **WHEN** a private key is converted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Masked output and unload clear
- **WHEN** a conversion completes and the page is then unloaded
- **THEN** the output was masked until the reveal toggle was used, and `#keyconv-input`, `#keyconv-output`, and `#keyconv-passphrase` are empty afterwards

### Requirement: Verdict language
A successful conversion SHALL be reported as the formats being equivalent encodings of one key and SHALL NOT describe the key as secure, strong, or trusted.

#### Scenario: Clean result wording
- **WHEN** a conversion succeeds
- **THEN** the summary reads "Re-encoded as <format>; same key (SPKI SHA-256 <hex>). This does not assess the key's strength or who holds it."
