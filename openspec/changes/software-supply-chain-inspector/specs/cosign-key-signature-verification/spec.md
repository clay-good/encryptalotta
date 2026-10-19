# Spec Delta — cosign-key-signature-verification

## Purpose

Verify a cosign key-based blob signature (`cosign sign-blob --key`, a Base64 ECDSA P-256 signature over SHA-256 of the file) against a pasted `cosign.pub`, in the browser; keyless signatures are handled by the Sigstore bundle capability.

## ADDED Requirements

### Requirement: Signature and key parsing
The tool SHALL accept the `.sig` content as Base64 (one line, optional trailing newline) decoding to a DER-encoded ECDSA signature (or a 64-byte Ed25519 / RSA-length signature when the key is of that type), and SHALL accept `cosign.pub` as PEM SPKI, importing it with Web Crypto and showing the key type and curve.

#### Scenario: P-256 key
- **WHEN** a `cosign.pub` PEM containing a P-256 public key is pasted
- **THEN** the key row reads ECDSA P-256 and its SHA-256 fingerprint is shown

#### Scenario: Not a key
- **WHEN** the pasted text is not PEM SPKI
- **THEN** the key row is ✗ "expected a PEM public key (cosign.pub)"

### Requirement: Verification
The tool SHALL compute SHA-256 of the dropped blob, convert the DER ECDSA signature to raw `r ‖ s` via the ASN.1 reader, and verify with `crypto.subtle.verify` (ECDSA SHA-256; RSASSA-PKCS1-v1_5 SHA-256 for RSA keys; Ed25519 for Ed25519 keys), reporting ✓ or ✗ with the blob digest shown.

#### Scenario: Valid signature
- **WHEN** the fixture blob, its fixture `.sig` and the fixture `cosign.pub` are supplied
- **THEN** the signature row is ✓ and the blob's SHA-256 is displayed

#### Scenario: Modified blob
- **WHEN** a blob differing by one byte is dropped
- **THEN** the signature row is ✗ "signature does not verify with the key you supplied"

### Requirement: Verdict language
An all-✓ result SHALL read "verifies against the key you supplied — this does not establish that the key belongs to the publisher" and SHALL point to the Sigstore bundle capability for identity-bound (keyless) signatures.

#### Scenario: Clean result wording
- **WHEN** the signature verifies
- **THEN** the summary carries that wording

### Requirement: Offline operation
Verification SHALL involve no registry or Rekor lookup.

#### Scenario: Input never leaves the page
- **WHEN** a cosign signature is verified while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
