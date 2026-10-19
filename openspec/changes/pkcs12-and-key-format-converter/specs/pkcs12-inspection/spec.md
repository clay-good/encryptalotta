# Spec Delta — pkcs12-inspection

## Purpose

Inspect a PKCS#12 / PFX file (RFC 7292) in the browser: list its structure before any password is entered, verify the MAC with the PKCS#12 KDF, decrypt PBES2 bags via Web Crypto, label legacy PBE bags that are not decrypted, and hand certificates and keys to the existing tools.

## ADDED Requirements

### Requirement: Structure listing without a password
The tool SHALL parse a loaded `.p12` / `.pfx` per RFC 7292 §4–§5 and, before any password is entered, SHALL list version, MacData (digest algorithm, salt length, iterations), each AuthenticatedSafe part (`data` or `encryptedData` with its PBES algorithm and parameters), and for readable parts each SafeBag's type OID name and bag attributes (friendlyName, localKeyId).

#### Scenario: OpenSSL 3 default PFX
- **WHEN** a PFX from `openssl pkcs12 -export` (OpenSSL 3 defaults) is loaded
- **THEN** the rows show version 3, MAC HMAC-SHA-256 with 2048 iterations, one `encryptedData` part (PBES2 / PBKDF2 2048 / AES-256-CBC) and one `data` part, and the shrouded key bag's algorithm PBES2 / AES-256-CBC

#### Scenario: Legacy PFX structure
- **WHEN** a PFX from `openssl pkcs12 -export -legacy` is loaded
- **THEN** the parts read `pbeWithSHAAnd40BitRC2-CBC` (certificates) and `pbeWithSHAAnd3-KeyTripleDES-CBC` (key), each labelled "legacy PBE (RFC 7292 Appendix C)"

#### Scenario: No MacData
- **WHEN** the PFX omits MacData
- **THEN** a ⚠ row reads "no MAC — integrity cannot be checked" and parsing continues

### Requirement: MAC verification
Given the password, the tool SHALL derive the MAC key with the PKCS#12 KDF (RFC 7292 Appendix B, ID = 3, UTF-16BE password with trailing NUL) over SHA-256 or SHA-1, compute HMAC over the AuthenticatedSafe content bytes, and compare in constant time with the stored digest.

#### Scenario: Correct password
- **WHEN** the correct password is entered for the default PFX
- **THEN** the MAC row is ✓ "HMAC-SHA-256 verifies (PKCS12KDF, 2048 iterations)"

#### Scenario: Wrong password
- **WHEN** a wrong password is entered
- **THEN** the MAC row is ✗ "MAC does not verify — wrong password or modified file" and no decryption is attempted

#### Scenario: SHA-1 MAC
- **WHEN** the MacData digest algorithm is SHA-1
- **THEN** the MAC is verified over SHA-1 and the row carries the label "SHA-1 MAC (legacy; integrity only)"

### Requirement: Bag decryption
The tool SHALL decrypt `encryptedData` parts and `pkcs8ShroudedKeyBag` contents encrypted with PBES2 (PBKDF2 + AES-CBC) via Web Crypto using the same password, SHALL list the resulting certBags (subject, issuer, serial, SHA-256 fingerprint) and keyBags (type, size or curve, SPKI fingerprint), and SHALL pair keys with certificates by localKeyId or by matching SPKI.

#### Scenario: Default PFX unlocked
- **WHEN** the correct password is entered
- **THEN** one certificate row and one key row appear, paired by localKeyId, with the friendlyName shown

#### Scenario: Two pairs
- **WHEN** a PFX with two key / certificate pairs and a CA certificate is unlocked
- **THEN** two pairs and one unpaired certificate are listed, the unpaired one marked "no matching key (CA / chain certificate)"

### Requirement: Legacy PBE handling
Bags or parts encrypted with `pbeWithSHAAnd3-KeyTripleDES-CBC` or `pbeWithSHAAnd40BitRC2-CBC` SHALL be decoded (algorithm, salt, iterations) and reported as "legacy PBE — not decrypted in this slice", with the migration command named; RC2 SHALL never be implemented, and 3DES is scheduled for slice 2.

#### Scenario: Legacy bag reported
- **WHEN** the `-legacy` PFX is unlocked with the correct password
- **THEN** the MAC row is ✓, the key bag reads "pbeWithSHAAnd3-KeyTripleDES-CBC — legacy PBE, not decrypted in this slice (slice 2: 3DES)", and the certificate part reads "RC2-40 — not supported; convert with `openssl pkcs12 -legacy -in old.p12 -nodes | openssl pkcs12 -export`"

### Requirement: Hand-off to existing tools
The tool SHALL open any listed certificate in the TLS Certificate Parser and load any decrypted key into the converter panel by function call, without the user copying PEM.

#### Scenario: Open certificate
- **WHEN** the user clicks "open in certificate parser" on a certBag
- **THEN** the TLS Certificate Parser view renders that certificate's details

#### Scenario: Use key
- **WHEN** the user clicks "use in converter" on a decrypted key
- **THEN** the converter record is populated and the target-format select is enabled; no key bytes appear in the PKCS#12 results

### Requirement: Offline operation and secret handling
Parsing, KDF, MAC, and decryption SHALL run in the page; the PFX bytes and password SHALL never be sent anywhere; the password field SHALL be masked, registered with `clearSensitiveFields()`, and never placed in the URL or `localStorage`.

#### Scenario: Input never leaves the page
- **WHEN** a PFX is loaded and unlocked while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Password cleared on unload
- **WHEN** the page is unloaded after a password was entered
- **THEN** `#keyconv-p12-password` is empty afterwards

### Requirement: Verdict language
A verified MAC and successful decryption SHALL be reported as integrity and decryption facts and SHALL NOT describe the file, its certificates, or its keys as trusted or valid.

#### Scenario: Clean result wording
- **WHEN** the MAC verifies and every bag decrypts
- **THEN** the summary reads "MAC verifies and all bags decrypt with this password (RFC 7292). This does not establish that the certificates chain to a root you trust — validate them in the certificate parser."
