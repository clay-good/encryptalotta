# OpenSpec — expansion programme (October 2026)

This directory holds **change proposals** for extending encryptalotta beyond the tools shipped through draft 313 (58 as of this writing; the proposals were drafted against the 57-tool baseline of draft 312). They are specifications only; nothing here is implemented yet. Each change follows the OpenSpec `spec-driven` schema (`proposal.md` → `specs/<capability>/spec.md` → `design.md` → `tasks.md`) and validates with `openspec validate <name> --strict`.

`config.yaml` restates the project constraints every proposal must respect (client-side only, `connect-src 'none'`, no build step, pure JS first, no PII validators, conservative verdict language). Read it before proposing anything new. The long-form rationale lives in `SPEC-INTERNATIONAL.md` §0 and §7 and in `THREAT-MODEL.md`.

## How the changes were chosen

Three questions decided inclusion:

1. **Does it stay inside the product?** Every change decodes, validates, converts, or verifies something the user already has in hand — a file, a token, an XML document, a key — with no lookup the browser cannot do offline. Trust anchors (roots, trust lists, DNS records) are pasted by the user, never fetched.
2. **Is there a published standard with test vectors?** Each spec names the RFC / ETSI / ISO / EPC / NIST / W3C document and the vector it is checked against, so an implementer can pin a green test before the feature lands (the four-part unit the SEPA / UBL gates established).
3. **Does it close a real gap next to a shipped tool?** The changes extend families that exist — X.509 / CMS, JOSE / EUDI, SEPA / e-invoicing, hashes, PGP, SSH, metadata hygiene — rather than opening new product lines. Rejected on that basis: cryptocurrency wallets (BIP-32 derivation), compliance generators, anything needing a server.

## Changes by theme

23 changes in total. **11 add a top-level tool** (58 → 69 if all land); the other 12 extend shipped tools. Each proposal states its own delta as "57 → 58" against the draft-312 baseline it was written on; the real number is assigned in implementation order.

### Trust and cryptography
| Change | New tool? | Summary |
|---|---|---|
| `pqc-signatures-and-kems` | yes | ML-KEM-768/1024 and ML-DSA-65/87 (FIPS 203 / 204) in pure JS, hybrid X25519MLKEM768, "quantum-safe?" row in Key Info / cert parser per NIST IR 8547 and BSI TR-02102-1 (2025). |
| `eidas-signature-cryptographic-verification` | no | CAdES / PAdES signature math, RFC 3161 timestamps, chain-to-pasted-trust-list, then XML-DSig with hand-rolled C14N. |
| `x509-chain-and-lint` | no | RFC 5280 path validation to a pasted anchor, CA/B Forum BR lint gates (SC-081 lifetime ladder), CRL / OCSP decoding, key ↔ cert ↔ CSR matching. |
| `pkcs12-and-key-format-converter` | yes | PKCS#1 ↔ PKCS#8 ↔ OpenSSH ↔ JWK, encrypted PKCS#8, PKCS#12 / PFX inspection (RFC 7292). |
| `ssh-certificates-and-signatures` | no | OpenSSH certificates, SSHSIG verification (git commit signatures), openssh-key-v1 inspection, hashed known_hosts check. |
| `openpgp-packet-inspector-and-key-maintenance` | no | RFC 9580 packet dump, deep Key Info, in-page key maintenance (expiry, passphrase, UIDs, subkeys), WKD URL and Autocrypt. |
| `diceware-passphrases` | no | EFF wordlists, physical-dice entry, strength estimator aware of wordlist passphrases. |

### Identity and authentication
| Change | New tool? | Summary |
|---|---|---|
| `webauthn-passkey-inspector` | yes | Decode registration / assertion payloads (WebAuthn Level 3 flags, AAGUID, COSE key), verify assertion signatures. |
| `jose-token-builder-and-jwe` | no | Sign JWTs, generate JWK / JWKS, JWE encrypt / decrypt (RFC 7516), RFC 8725 lint, PKCE. |
| `saml-and-federation-token-decoder` | yes | SAML request / response decoding and lint, OIDC `at_hash` / `nonce` checks, PASETO. |
| `verifiable-credential-presentation-decoder` | no | OpenID4VP presentations, SD-JWT VC + status lists, mdoc DeviceResponse verification, DID / multiformats, JCS Data Integrity proofs. |

### EU payments and commerce
| Change | New tool? | Summary |
|---|---|---|
| `payment-qr-codes` | yes | EPC QR (GiroCode, EPC069-12 v3.0) and Swiss QR-bill (SIX IG v2.3 / v2.4) decode / validate / encode, ISO 11649 references. |
| `sepa-status-reports-and-notifications` | no | pain.002 status reports with EPC reason codes, camt.054 / camt.052, MT940, structured-address gates for 15 November 2026. |
| `einvoice-readable-view-and-reports` | no | Printable "paper" view of UBL / CII invoices, conformance-report export, XRechnung BR-DE gates, hybrid-PDF attachment listing. |
| `commercial-identifier-checksums` | yes | LEI, ISIN, CUSIP, SEDOL, ISBN, ISSN, GLN, EORI format, generic check-digit calculators (business identifiers only — §7.1). |

### Privacy and security hygiene
| Change | New tool? | Summary |
|---|---|---|
| `unicode-security-inspector` | yes | Hidden / bidi / confusable character detection (UTS #39, Trojan Source), normalization forms, punycode both ways, escapes. |
| `http-security-headers-analyzer` | yes | CSP evaluation, HSTS / COOP / COEP / Referrer-Policy / Permissions-Policy, cookie attribute lint — from pasted headers. |
| `pdf-metadata-inspector-and-cleaner` | yes | PDF Info / XMP / ID / PieceInfo / incremental-update inspection and a single-revision cleaned rewrite. |
| `email-authentication-verification` | no | DKIM verification from a pasted DNS record, SPF / DMARC (RFC 9989) / ARC lint, MTA-STS / TLSRPT / BIMI / TLSA / CAA / DS. |

### Developer decoders and platform
| Change | New tool? | Summary |
|---|---|---|
| `binary-format-decoders` | yes | Hexdump + entropy, schema-less Protobuf, MessagePack, bencode / torrent, Google Authenticator export decoding. |
| `checksum-and-hash-identification` | no | Parametrized CRC family, non-cryptographic hashes, hash-type identification, `sha256sum -c`-style manifest check. |
| `software-supply-chain-inspector` | yes | SBOM viewing with hash cross-check, DSSE / in-toto / SLSA, Sigstore bundles verified offline, minisign / signify / cosign. |
| `workflow-and-output-hygiene` | no | Smart paste routing, `Send to` handoff, bulk validation, masked secrets, timed clipboard overwrite, global clear. |

## Suggested order

1. `workflow-and-output-hygiene` first — its registries (sensitivity, handoff, detectors) are what every later tool plugs into.
2. Payments and commerce next (`payment-qr-codes`, `sepa-status-reports-and-notifications`, `einvoice-readable-view-and-reports`): dated regulatory deadlines (15 November 2026 SEPA addresses; France receiving e-invoices from 1 September 2026).
3. Trust work (`x509-chain-and-lint`, `eidas-signature-cryptographic-verification`, `software-supply-chain-inspector`) — they share the chain-validation and RFC 3161 code.
4. Identity (`webauthn-passkey-inspector`, `verifiable-credential-presentation-decoder`) ahead of the 24 December 2026 EUDI wallet deadline.
5. Everything else as bandwidth allows; `pqc-signatures-and-kems` can start any time since it is self-contained.

## Verify before implementing

These specs were researched against primary sources where possible (EPC069-12 v3.0 text, SIX IG v2.3 / v2.4, NIST IR 8547 draft, WICG Modern Algorithms draft, RFC 9901, RFC 9989, CA/B Forum SC-081v3, Sigstore bundle v0.3). Some details were written from knowledge rather than re-read, and the first task of each change should confirm them:

| Area | What to confirm | Change |
|---|---|---|
| Clause numbers | CA/B Forum BR sub-clauses (§6.1.5, §7.1.2.7.x, §7.1.4.3); RFC 5280 §6.1.x letters | `x509-chain-and-lint` |
| Clause numbers | OIDC Core §3.x, RFC 8725 §3.x, ISO 18013-5 §8–9, RFC 9580 subpacket sections, status-list / SD-JWT VC draft sections | identity changes |
| Clause numbers | RFC 9989 tag sections (`t=`, `psd`, external-destination §); ISO 32000-2 action / PieceInfo clauses | `email-authentication-verification`, `pdf-metadata-inspector-and-cleaner` |
| Code lists | ISO 20022 status codes and bank-transaction-code subset; MT940 `:86:` sub-tags (DK convention); Leitweg-ID length limits | `sepa-status-reports-and-notifications`, `einvoice-readable-view-and-reports` |
| Vectors | xxHash32/64 empty-input, MurmurHash3 `hello`, RFC 3492 sample J, PASETO `4-S-1`, IPFS CID pair, WKD `Joe.Doe@Example.ORG` hash, iCloud Keychain AAGUID | various (each is cited in the spec) |
| Licences | EFF wordlist CC BY version; community AAGUID list licence before vendoring more than a hand-kept subset | `diceware-passphrases`, `webauthn-passkey-inspector` |
| Browser APIs | `crypto.subtle.supports()` and the WICG key-format names; Ed25519 private-JWK export containing `x` | `pqc-signatures-and-kems`, `pkcs12-and-key-format-converter` |

Arithmetic vectors in the identifier, CRC, Adler, Fletcher, FNV, SipHash, LEI, ISIN, CUSIP, SEDOL, ISBN, ISSN, ISO 7064, Luhn, Verhoeff, Damm, and Leitweg-ID specs were computed and checked during drafting.

**Known finding about the site itself:** `http-security-headers-analyzer` grades the site's own `_headers` honestly. Today that means `script-src 'self' 'unsafe-inline'` (no nonce or hash) is reported ✗ and the legacy `X-XSS-Protection` header ⚠. The spec keeps those expectations instead of special-casing the host. Tightening the site's CSP is a separate piece of work.

## Working a change

```bash
openspec status --change <name>        # artifact completion
openspec validate <name> --strict      # must be clean before implementation starts
openspec instructions apply --change <name>
openspec archive <name>                # after the tasks are done; merges specs into openspec/specs/
```

Implementation must still follow the repo's release ritual (`node scripts/audit-release.js`, variant and portable rebuilds, Playwright suite) described in `README.md`.
