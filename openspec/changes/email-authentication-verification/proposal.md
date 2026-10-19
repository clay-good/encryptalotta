# Proposal — Email authentication verification (DKIM / ARC re-verification, SPF / DMARC / DNS record lint)

## Why

The shipped **Email Header Analyzer** (`mailhdr`) parses headers, reads the topmost `Authentication-Results`, aligns the DKIM `d=` with `From`, and says plainly that it does *not* re-verify, because verification needs DNS and the page makes no network calls. That is the right boundary for a tool that works from headers alone. But it leaves the people who most need it with nothing: the mail admin who has the DNS record in front of them and wants to know *why* a DKIM signature fails; the person who received a forwarded message and wants to check the signature without trusting the forwarder's `Authentication-Results`; the domain owner writing an SPF or DMARC record who wants a lint before publishing. All of that is possible offline if the user pastes the DNS record — the same pattern the site uses for trust lists and OCSP (§7.5): "paste what the lookup would return".

Two standards moved this year. DMARC is now **RFC 9989** (20 May 2026, Standards Track; RFC 9990 aggregate reports, RFC 9991 failure reports), replacing RFC 7489, deprecating `pct` / `rf` / `ri` and adding `np` / `psd`. Most DMARC records on the internet were written against the old RFC; a lint that explains the delta is timely.

## What Changes

- Extends the shipped Email Header Analyzer (`mailhdr`); **no new top-level tool** (57 stays 57). No OpenSpec baseline exists for the tool yet, so every capability below is a new capability.
- **DKIM signature verification** — paste the full raw message and the selector's DNS TXT record (fetched by the user with `dig TXT <selector>._domainkey.<domain>`); the tool canonicalizes per `c=`, recomputes `bh=`, rebuilds the signed header set, and verifies RSA-SHA256 (RFC 6376) or Ed25519-SHA256 (RFC 8463) with Web Crypto; per-signature verdicts, key-length gate, timestamps, testing flag.
- **SPF record lint** — parse `v=spf1`, count DNS-lookup mechanisms (the user pastes included records to count recursively), flag `+all` / `?all` / missing `all` / `ptr` / duplicates, and evaluate a sender IP against the pasted records without DNS (RFC 7208).
- **DMARC record lint** — RFC 9989 tags, policy ladder, alignment against the message's `From` domain, deprecated-tag explanation, `rua` / `ruf` syntax and external-destination note.
- **ARC chain decoding** — RFC 8617 instances, `cv=` state, seal verification from pasted keys, and a plain statement of what ARC does and does not prove.
- **Mail-related DNS record lint** — MTA-STS (RFC 8461), TLSRPT (RFC 8460), BIMI (draft), TLSA (RFC 6698), CAA (RFC 8659), DNSKEY key tag and DS check (RFC 4034 Appendix B).
- The verdict language stays as in mailhdr: a pass "shows who sent it, not that the content is safe".

Out of scope (and the §7 non-goal it respects): **no DNS lookups** — nothing is fetched; every record is pasted (§7.5 / §0.1); no DNSSEC chain validation to the root (a DS ↔ DNSKEY match is as far as pasted data goes); no S/MIME or PGP body verification (the Verify tool covers PGP); no reputation, blocklist, or "is this sender trustworthy" scoring (THREAT-MODEL verdict language); no sending of test messages or DMARC report parsing (RFC 9990 / 9991 XML — a possible follow-up); no mailbox or IMAP access of any kind (§7.9).

## Capabilities

### New Capabilities
- `dkim-signature-verification`: canonicalize, hash, and verify DKIM-Signature headers (RFC 6376, RFC 8463) from a pasted message and a pasted DNS TXT record.
- `spf-record-lint`: parse and lint `v=spf1` records and evaluate a sender IP against pasted records (RFC 7208).
- `dmarc-record-lint`: parse and lint DMARC records per RFC 9989 with alignment against the message From domain.
- `arc-chain-decoding`: decode and verify ARC sets (RFC 8617) from pasted keys and explain the chain state.
- `mail-related-dns-record-lint`: lint MTA-STS, TLSRPT, BIMI, TLSA, CAA, DNSKEY / DS records (RFC 8461, 8460, 6698, 8659, 4034).

### Modified Capabilities
- none (the existing header parsing, Authentication-Results reading, hop timeline, and spoofing findings keep their behaviour; the new panels sit below them).

## Impact

- `index.html`: ~850 lines of inline JS in the mailhdr section — DKIM canonicalizers (relaxed / simple, header and body), DKIM-Signature tag parser, DNS TXT key parser (`p=` base64 → SPKI import), signature verification via `crypto.subtle.verify`, SPF tokenizer and evaluator (CIDR match reusing the CIDR tool's IPv4 / IPv6 parsing), DMARC tag parser, ARC set grouping and seal verification, six small record linters, DNSKEY key-tag arithmetic; ~110 STRINGS keys × 5 locales (explanations translate; tag names do not). Refreshed `tool.mailhdr.about.*` prose.
- Reuses: the RFC 5322 header parser and unfolding (mailhdr), the organizational-domain approximation (mailhdr), Web Crypto RSA-PSS / RSASSA-PKCS1-v1_5 and Ed25519 import / verify (JWT, CSR tools), SHA-256 via Web Crypto, the hand-rolled ASN.1 / DER reader for SPKI inspection and RSA modulus length (tls-cert), the CIDR tool's address parsing, base64 helpers, the gate framework, `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` for `t=` / `x=`.
- No new vendored file, no CSP change, page weight +~20 KB gzipped.
- Governing documents: RFC 6376 (DKIM), RFC 8463 (Ed25519-SHA256), RFC 8301 (key size), RFC 7208 (SPF), RFC 9989 / 9990 / 9991 (DMARC), RFC 7489 (historic DMARC), RFC 8617 (ARC), RFC 8461 (MTA-STS), RFC 8460 (TLSRPT), draft-brand-indicators-for-message-identification (BIMI), RFC 6698 / 7671 (TLSA / DANE), RFC 8659 (CAA), RFC 4034 (DNSKEY / DS), RFC 5321 / 5322.
- Tests: new `tests/specs/NN-mailauth.spec.js` (number assigned at implementation; 29+). Confirm/flag pairs: a DKIM-signed fixture message with its public key (pass) and the same with one body byte changed (body-hash mismatch) and one header byte changed (signature fail); the RFC 6376 Appendix A example (RSA, simple/simple) and an Ed25519 example (RFC 8463 Appendix A); SPF records with 9 vs 11 lookups, `+all`, `ptr`; a sender IP that matches `ip4:` vs one that falls to `-all`; DMARC `p=none` ⚠ vs `p=reject` ✓, `pct=50` deprecated ⚠; ARC chain `cv=pass` with keys vs `cv=fail`; MTA-STS `mode=enforce` ✓ vs `mode=none` ⚠; TLSA `3 1 1` decode; CAA `issue` / `iodef`; DNSKEY key tag matching a pasted DS; network-silence assertion.
