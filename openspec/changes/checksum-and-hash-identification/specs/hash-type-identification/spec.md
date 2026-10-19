# Spec Delta — hash-type-identification

## Purpose

Tell a reader what a pasted digest or password-hash string is likely to be — by length, alphabet and prefix — and decode the parameters that structured formats (PHC, bcrypt, Unix crypt, LDAP, SRI, OpenSSH, Base58Check) carry, without ever attempting to reverse the hash.

## ADDED Requirements

### Requirement: Password-hash format recognition
The tool SHALL recognise and decode PHC strings (PHC string format specification — `$argon2id$` / `$argon2i$` / `$argon2d$` / `$scrypt$` / `$pbkdf2-sha256$` / `$pbkdf2-sha512$` with `v=`, parameters, salt, hash), bcrypt `$2a$` / `$2b$` / `$2y$` with cost, Unix crypt `$1$`, `$5$`, `$6$` (with `rounds=`), `$7$`, `$y$`, LDAP `{SSHA}`, `{SHA}`, `{CRYPT}`, `{MD5}`, `{SMD5}`, Django `<alg>$<iter>$<salt>$<hash>` and Drupal `$S$`.

#### Scenario: Argon2id PHC string
- **WHEN** the input is `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`
- **THEN** the result names Argon2id (RFC 9106), version 19, memory 64 MiB, 3 iterations, 4 lanes, and the salt and hash lengths in bytes

#### Scenario: bcrypt
- **WHEN** the input is `$2b$12$` followed by 53 Base64-crypt characters
- **THEN** the result names bcrypt (`$2b$` revision), cost 12 (4096 rounds), and the 22-character salt

### Requirement: Fingerprint and integrity-string recognition
The tool SHALL recognise OpenSSH `SHA256:<43 Base64>` fingerprints (OpenSSH `ssh-keygen -l` format), SRI `sha256-` / `sha384-` / `sha512-` strings (W3C Subresource Integrity), and Base58Check strings (decoded via the encoder's SHA-256d check, version byte named).

#### Scenario: OpenSSH fingerprint
- **WHEN** the input is `SHA256:` followed by 43 Base64 characters
- **THEN** the result names an OpenSSH key fingerprint and links to the SSH Key Parser

#### Scenario: SRI string
- **WHEN** the input is `sha384-` followed by 64 Base64 characters
- **THEN** the result names a Subresource Integrity hash (SHA-384) and shows the hex form

### Requirement: Digest candidates by length and alphabet
For an unstructured string the tool SHALL list every candidate matching its byte length and alphabet — 16 bytes MD5 / MD4 / NTLM; 20 bytes SHA-1 / RIPEMD-160 / Git SHA-1 object id; 28 bytes SHA-224; 32 bytes SHA-256 / SHA3-256 / BLAKE2s / BLAKE3 / Git SHA-256 object id; 48 bytes SHA-384; 64 bytes SHA-512 / SHA3-512 / BLAKE2b-512 — for hex, Base64 and Base64url encodings, and SHALL phrase them as candidates in catalogue order, never as a single answer.

#### Scenario: Bare 64-hex string
- **WHEN** the input is 64 hex characters
- **THEN** the result reads "candidates (32 bytes, hex)" and lists SHA-256, SHA3-256, BLAKE2s-256, BLAKE3-256 and Git SHA-256 object id, with a note that the encoding alone cannot distinguish them

#### Scenario: Base64 digest
- **WHEN** the input is 44 Base64 characters ending `=`
- **THEN** the result reads "32 bytes, Base64" with the same candidate list and a link to re-encode as hex

### Requirement: Parameter judgement
For Argon2 PHC strings the tool SHALL compare `m`, `t`, `p` with the Argon2 tool's OWASP preset (m = 19 MiB, t = 2, p = 1; OWASP Password Storage Cheat Sheet) and for PBKDF2 / bcrypt / crypt the iteration count or cost with the PBKDF2 tool's NIST / OWASP preset, reporting only "at or above" or "below" the minimum.

#### Scenario: Below OWASP minimum
- **WHEN** the input is `$argon2id$v=19$m=4096,t=1,p=1$…`
- **THEN** the judgement row is ⚠ reading "below the OWASP minimum (19 MiB, t = 2)" and links to the Argon2 tool

#### Scenario: Low bcrypt cost
- **WHEN** the input is a bcrypt string with cost 4
- **THEN** the judgement row is ⚠ reading "cost 4 is below the commonly recommended 10"

### Requirement: No reversal and verdict language
The tool SHALL perform no dictionary, rainbow-table or brute-force attempt, SHALL contain no "crack" or "reverse" control, and SHALL phrase results as "candidates" or "format recognised", never as the hash being weak, strong, safe or cracked.

#### Scenario: Wording
- **WHEN** any string is identified
- **THEN** the summary reads "format recognised — this says what the string looks like, not what it hashes or whether it is secure" and links to the Passphrase Strength Estimator for questions about the password

### Requirement: Offline operation
Identification SHALL be a rule table evaluated in the page.

#### Scenario: Input never leaves the page
- **WHEN** a hash string is identified while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
