# Tasks — SSH certificates, SSHSIG, private-key inspection, known_hosts / authorized_keys

## 1. Wire-format and signature engine

- [ ] 1.1 Extend the SSH reader with `sshReadUint32` / `sshReadUint64` (BigInt) / `sshReadMpint` / `sshReadStringList` (packed `string`s) and byte-offset tracking so signed regions can be sliced from the original blob.
- [ ] 1.2 `sshSigBlobToWebCrypto(blob, pubkey)` — `ssh-ed25519` raw 64 bytes; `ecdsa-sha2-nistp256/384/521` mpint `r` / `s` → fixed-width raw; `rsa-sha2-256` / `rsa-sha2-512` / legacy `ssh-rsa` → RSASSA-PKCS1-v1_5 with SHA-256 / 512 / SHA-1 (legacy label); RSA key import as JWK from `e`, `n`; `sk-*` → "not verified here".
- [ ] 1.3 Input auto-detection by prefix / armor / line shape (key, certificate, SSHSIG, openssh-key-v1, known_hosts, authorized_keys).

## 2. Certificate decoder

- [ ] 2.1 `sshCertParse(blob)` per PROTOCOL.certkeys for `ssh-rsa-cert-v01`, `ecdsa-sha2-nistp*-cert-v01`, `ssh-ed25519-cert-v01` (and `sk-*-cert-v01` display-only): nonce, key fields, serial, type (1 user / 2 host), key id, principals, valid-after / valid-before (`0xFFFFFFFFFFFFFFFF` = forever), critical options and extensions (name / value pairs), reserved, signature key, signature, plus the signed-region offsets.
- [ ] 2.2 Option / extension table (`force-command`, `source-address`, `verify-required`; `permit-X11-forwarding`, `permit-agent-forwarding`, `permit-port-forwarding`, `permit-pty`, `permit-user-rc`, `no-touch-required`) with "unknown critical option" flagging.
- [ ] 2.3 CA signature verification over the signed region via 1.2; CA key `SHA256:` fingerprint row; validity status against the browser clock via `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`.
- [ ] 2.4 Node-side check against `ssh-keygen -s` fixtures (user and host, each key type, with options and extensions, SHA-1 CA, tampered principal).

## 3. SSHSIG verifier

- [ ] 3.1 `sshsigParse(armor)` — magic `SSHSIG`, version 1, publickey, namespace, reserved, hash_algorithm (`sha256` / `sha512`), signature blob; armor line handling.
- [ ] 3.2 `sshsigVerify(sig, messageBytes)` — `H(message)` via Web Crypto, signed blob `SSHSIG ‖ string ns ‖ string "" ‖ string hash_alg ‖ string H`, verification via 1.2; ✗ row when an RSA signature is not `rsa-sha2-256` / `-512`.
- [ ] 3.3 Allowed-signers line parser (`principals [options] keytype base64 [comment]`; `cert-authority`, `namespaces=`, `valid-after=`, `valid-before=`), byte-equal key comparison, namespace / validity rows; trailing-newline checkbox.
- [ ] 3.4 Node-side check against `ssh-keygen -Y sign` fixtures (`file` and `git` namespaces, each key type), `ssh-keygen -Y verify` parity, tampered message and wrong-namespace cases.

## 4. openssh-key-v1 inspector

- [ ] 4.1 `opensshKeyV1Parse(armor)` — magic, ciphername, kdfname, kdfoptions (`string salt ‖ uint32 rounds`), nkeys, public keys with fingerprints, encrypted block length.
- [ ] 4.2 Cipher `none`: private block parse (checkint equality, key type, comment, padding 1..n) with scalars never rendered; other ciphers: deferral row with cipher and rounds.
- [ ] 4.3 Secret-field handling: input masked when this format is detected, registered with `clearSensitiveFields()`.

## 5. known_hosts and authorized_keys

- [ ] 5.1 `knownHostsParse(line)` — markers, hashed form (`|1|salt|hash`), plain patterns (`,` list, `*` / `?`, `!`), `[host]:port`, key type and blob; `knownHostsMatch(line, hostname, port)` via HMAC-SHA-1 (Web Crypto) with constant-time compare; `knownHostsHash(hostname)` with a fresh 20-byte salt.
- [ ] 5.2 `authorizedKeysParse(line)` — option grammar with quoting; gate rows per the sshd(8) option table (unknown option, quotes, `expiry-time=` parse and comparison, `from=` syntax, `command=` without `restrict` ⚠, conflicting options, `permitopen=` / `permitlisten=` syntax, `cert-authority` placement).
- [ ] 5.3 Node-side check against `ssh-keygen -H` output for several hostnames and ports, and an authorized_keys fixture per option.

## 6. View

- [ ] 6.1 In `#ssh-key-view`: the existing input gains auto-detection; add `#ssh-key-message` (text + file) and `#ssh-key-newline` for SSHSIG, `#ssh-key-allowed-signers`, `#ssh-key-hostname` and `#ssh-key-port` for known_hosts, `#btn-ssh-key-verify`, `#btn-ssh-key-hash-host`; results in `#ssh-key-results`, gate rows in `#ssh-key-gates`.
- [ ] 6.2 Summary wording per the verdict-language requirements; info-panel text for the git one-liner, the embedded-key warning, and the decryption deferral; links to Ed25519 tool, Key Format Converter when shipped, HMAC tool.

## 7. Tests

- [ ] 7.1 Fixtures under `tests/fixtures/ssh/` from a documented `ssh-keygen` script (OpenSSH 9.9).
- [ ] 7.2 `tests/specs/33-ssh-cert-sig.spec.js` (number assigned at implementation): each certificate fixture's fields and ✓ CA row, tampered principal ✗, SHA-1 CA legacy label, forever sentinel, expired certificate status, SSHSIG verify and allowed-signers match / mismatch / namespace mismatch, RSA SHA-1 SSHSIG ✗, openssh-key-v1 unencrypted comment and encrypted deferral row, known_hosts hashed match and non-match with port, authorized_keys gate rows, masked private-key field cleared on unload, network-silence assertion, XSS payload in a key id rendered inert.

## 8. Wiring and gates

- [ ] 8.1 ~45 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts); no new SEO keys (no new tool); CLDR plural groups for "n principals" and "n keys in file".
- [ ] 8.2 TOOL_SYNONYMS additions on `ssh-key` (`certificate cert-v01 ca principals sshsig git commit signature allowed_signers known_hosts authorized_keys hashed id_ed25519 openssh-key-v1`), RELATED_TOOLS (`ssh-key` ↔ `ed25519` ↔ `hmac` ↔ `keyconv`), JSON-LD featureList text update; audit gate 20 tool count unchanged at 57.
- [ ] 8.3 README: SSH Key Parser paragraph extended, standards cheat sheet rows (RFC 4253, PROTOCOL.certkeys, PROTOCOL.sshsig + draft-josefsson-sshsig-format-04, PROTOCOL.key, sshd(8)), Per-Tool Security Notes paragraph; SPEC-INTERNATIONAL.md status note.
- [ ] 8.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
