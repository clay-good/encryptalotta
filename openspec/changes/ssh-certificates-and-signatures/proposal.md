# Proposal — SSH certificates, SSHSIG signatures, private-key inspection, known_hosts / authorized_keys

## Why

The SSH Key Parser reads one public key line (RFC 4253 wire format) and prints its type, size, fingerprint, and comment. Everything else in the OpenSSH ecosystem is still opaque in the browser: a `-cert.pub` from an SSH CA (PROTOCOL.certkeys) hides its principals, validity window, and forced command in Base64; a `git log --show-signature` failure on an SSH-signed commit leaves the user staring at a `-----BEGIN SSH SIGNATURE-----` block (PROTOCOL.sshsig; IETF draft-josefsson-sshsig-format-04, July 2026); an `id_ed25519` file does not say whether it is encrypted or with what; a hashed `known_hosts` line (`|1|salt|hash`) cannot be read at all without `ssh-keygen -F`. Each of these is a wire-format walk plus, for the first two, a signature check — and the page already has the SSH string reader, Web Crypto RSA / ECDSA / Ed25519 verification, HMAC-SHA-1, and the `Intl` date formatting. Nobody should paste a CA-issued certificate or a signed commit into a web page that logs it.

## What Changes

- **Extends the shipped SSH Key Parser (`ssh-key`); no new top-level tool.** No OpenSpec baseline exists for it yet, so every behaviour below is a new capability. The single input auto-detects a public key, a certificate, an SSHSIG armor block, an `openssh-key-v1` armor block, a `known_hosts` line, or an `authorized_keys` line.
- **SSH certificate decoding** (PROTOCOL.certkeys): nonce, public key, serial, type (user / host), key id, principals, valid-after / valid-before with `Intl` dates and "forever" for the all-ones sentinel, critical options (`force-command`, `source-address`, `verify-required`), extensions (`permit-*`, `no-touch-required`), signature key fingerprint, and verification of the CA signature via Web Crypto for `rsa-sha2-256` / `rsa-sha2-512`, `ecdsa-sha2-nistp256` / `384` / `521`, and `ssh-ed25519`.
- **SSHSIG verification**: parse the armor, show namespace (e.g. `git`, `file`), hash algorithm, and embedded public key; verify over a pasted message or loaded file; compare the embedded key against a user-supplied allowed-signers key and warn, as PROTOCOL.sshsig does, that the embedded key proves nothing on its own.
- **`openssh-key-v1` inspection**: cipher, KDF, bcrypt rounds and salt, number of keys, public key(s); for unencrypted files the private section's checkints, key type, and comment; for encrypted files "encrypted with <cipher> / bcrypt — decryption needs bcrypt_pbkdf (Blowfish) and is deferred".
- **known_hosts and authorized_keys**: compute `|1|salt|HMAC-SHA-1` hashed hostnames and tell whether a given hostname (with `[host]:port` form) matches a pasted line, including `@cert-authority` / `@revoked` markers; lint `authorized_keys` options (`from=`, `command=`, `no-pty`, `restrict`, `expiry-time=`, `permitopen=`, …).

Out of scope, and the §7 non-goal each respects: no decryption of encrypted private keys (bcrypt_pbkdf needs a hand-rolled Blowfish; deferred until a real request, §7.6 spirit — no WASM either); no SSH agent, no connection, no host-key fetching (§0.1 / §7.5); no reconstruction of git commit objects for `git` namespace verification (the user supplies the exact signed bytes — see design); no key generation (the Ed25519 tool and `ssh-keygen` cover it); no FIDO `sk-` key verification (requires the authenticator's attestation flow).

## Capabilities

### New Capabilities
- `ssh-certificate-decoding`: PROTOCOL.certkeys decoding of all fields with human-readable validity, options, and extensions, plus CA signature verification via Web Crypto.
- `sshsig-verification`: PROTOCOL.sshsig / draft-josefsson-sshsig-format-04 armor parsing, signature verification over a message or file, and allowed-signers key comparison with the embedded-key warning.
- `openssh-private-key-inspection`: `openssh-key-v1` header and public-section decoding, unencrypted private-section parsing, and explicit deferral of encrypted-file decryption.
- `known-hosts-hashed-entry-check`: `|1|salt|hash` HMAC-SHA-1 computation and hostname matching for `known_hosts` lines, plus `authorized_keys` option linting.

### Modified Capabilities
- none (public-key parsing is unchanged; the new decoders sit behind the same input via auto-detection).

## Impact

- `index.html`: ~650 lines of inline JS — certificate walker, SSH signature-blob → Web Crypto adapter (RSA PKCS#1 v1.5 with SHA-256 / 512, ECDSA mpint `r` / `s` → raw, Ed25519 raw), SSHSIG armor and signed-blob builder, `openssh-key-v1` walker, known_hosts / authorized_keys line grammar and option table; ~45 STRINGS keys × 5 locales (no new SEO keys — no new tool).
- Reuses: `sshReadString()` and the RFC 4253 public-key parser, `SHA256:` fingerprint code, Web Crypto `verify` (RSASSA-PKCS1-v1_5, ECDSA, Ed25519) and `digest` (SHA-256 / 512 for SSHSIG message hashing) and HMAC-SHA-1, `ecDerSigToRaw()`-style fixed-width conversion, Base64 codecs, `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`, the SEPA / UBL gate framework for the `authorized_keys` lint, STRINGS i18n table.
- No new vendored file, no CSP change, page weight +~7 KB gzipped.
- Tests: new `tests/specs/33-ssh-cert-sig.spec.js` (number assigned at implementation) — fixtures from `ssh-keygen` (user and host certificates for RSA / ECDSA / Ed25519 with options and extensions, a certificate signed by an `ssh-rsa` SHA-1 CA, SSHSIG files in the `file` and `git` namespaces for each key type, encrypted and unencrypted `openssh-key-v1` files, hashed `known_hosts` lines from `ssh-keygen -H`, `authorized_keys` lines with each option), tampered variants, and the network-silence assertion the suite already uses.
