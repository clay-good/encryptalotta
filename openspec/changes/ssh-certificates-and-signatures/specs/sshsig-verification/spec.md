# Spec Delta — sshsig-verification

## Purpose

Parse and verify OpenSSH SSHSIG signatures (PROTOCOL.sshsig; IETF draft-josefsson-sshsig-format-04, July 2026) over a pasted message or loaded file, and compare the embedded key with a user-supplied allowed-signers key, because the embedded key proves nothing by itself.

## ADDED Requirements

### Requirement: Armor and structure parsing
The tool SHALL detect `-----BEGIN SSH SIGNATURE-----` armor, Base64-decode it, and decode the structure: magic `SSHSIG`, version 1, public key, namespace, reserved, hash algorithm (`sha256` or `sha512`), and the signature blob with its algorithm name; unsupported versions or magic SHALL be reported.

#### Scenario: ssh-keygen file signature
- **WHEN** a signature made with `ssh-keygen -Y sign -n file -f id_ed25519 README` is pasted
- **THEN** the rows show version 1, namespace `file`, hash `sha512`, the embedded `ssh-ed25519` key with its `SHA256:` fingerprint, and the signature algorithm

#### Scenario: Git namespace
- **WHEN** a signature from a git commit (`gpgsig` block) is pasted
- **THEN** the namespace row reads `git` and the info text names the `git cat-file commit <sha>` one-liner for obtaining the exact signed bytes

### Requirement: Signature verification
The tool SHALL hash the message (pasted UTF-8 text, optionally with an appended trailing newline, or the loaded file bytes) with the declared hash algorithm, build the signed blob `SSHSIG ‖ string namespace ‖ string reserved ‖ string hash_algorithm ‖ string H(message)` per PROTOCOL.sshsig, and verify it with the embedded key via Web Crypto (Ed25519 raw, ECDSA fixed-width r ‖ s, RSASSA-PKCS1-v1_5 SHA-256 / 512).

#### Scenario: File verifies
- **WHEN** the signed file is loaded and the fixture signature pasted
- **THEN** the signature row is ✓ "signature verifies with the embedded key over SHA-512 of the file"

#### Scenario: Tampered message
- **WHEN** one byte of the file differs
- **THEN** the signature row is ✗ "signature does not verify" and the structure rows remain

#### Scenario: Trailing newline
- **WHEN** the pasted text lacks the file's trailing newline and the "append trailing newline" box is checked
- **THEN** the signature verifies, and unchecked it does not, with a note explaining the byte difference

### Requirement: RSA algorithm rule
For RSA keys the tool SHALL require the signature algorithm to be `rsa-sha2-256` or `rsa-sha2-512` (PROTOCOL.sshsig) and SHALL mark `ssh-rsa` as ✗ even if the mathematics would verify.

#### Scenario: Legacy RSA SSHSIG
- **WHEN** an SSHSIG carries an `ssh-rsa` (SHA-1) signature blob
- **THEN** the algorithm row is ✗ "ssh-rsa not permitted in SSHSIG; rsa-sha2-256 / rsa-sha2-512 required"

### Requirement: Allowed-signers comparison
The tool SHALL accept an allowed-signers line (`principals [options] keytype base64 [comment]`, options `cert-authority`, `namespaces=`, `valid-after=`, `valid-before=`), SHALL compare its key byte-for-byte with the embedded key, SHALL check the namespace against `namespaces=` and the current time against the validity options, and SHALL warn that the embedded key alone establishes nothing.

#### Scenario: Matching allowed signer
- **WHEN** the allowed-signers line carries the same Ed25519 key with `namespaces="git,file"`
- **THEN** the rows read "embedded key matches your allowed-signers key for principal <p>" and "namespace `file` permitted"

#### Scenario: Different key
- **WHEN** the allowed-signers key differs
- **THEN** the row is ✗ "embedded key does not match — the signature was made by a key you have not listed" and the summary does not claim a known signer

#### Scenario: No allowed signer given
- **WHEN** the allowed-signers field is empty
- **THEN** the warning row reads "The key inside the signature is informational only (PROTOCOL.sshsig). Paste the signer's key from your allowed_signers file to establish who signed."

### Requirement: Offline operation
Hashing, blob construction, and verification SHALL run in the page; no key is fetched from GitHub, a keyserver, or anywhere else.

#### Scenario: Input never leaves the page
- **WHEN** a file is loaded and verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
A verified signature with a matching allowed-signers key SHALL be summarised as the signature verifying with a key the user listed, and SHALL NOT be described as proving identity or trust beyond that list.

#### Scenario: Clean result wording
- **WHEN** the signature verifies and the allowed-signers key matches
- **THEN** the summary reads "Signature verifies (SSHSIG, namespace `file`) with the key you listed for <principal>. This does not establish who controls that key beyond your own allowed_signers entry."
