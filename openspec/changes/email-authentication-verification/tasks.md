# Tasks — Email authentication verification

## 1. DKIM engine

- [ ] 1.1 Raw-message splitter (headers / body at the first empty line; bare LF → CRLF); `.eml` file input.
- [ ] 1.2 DKIM-Signature tag parser (RFC 6376 §3.5: `v a b bh c d h i l q s t x z`), defaults, FWS stripping; DNS TXT key parser (§3.6.1: `v k p h t s n`), owner-name extraction from `dig` lines, key ↔ signature association.
- [ ] 1.3 Canonicalizers: body simple / relaxed with `l=`; header simple / relaxed; header selection per §5.4.2 (last-unused-from-bottom, oversigning); `b=` emptied in the final header.
- [ ] 1.4 Verification: `bh=` via Web Crypto SHA-256 (SHA-1 reported historic); RSA via `RSASSA-PKCS1-v1_5` SPKI import; Ed25519 via SPKI-wrapped raw key with unavailable-fallback; modulus length via the ASN.1 reader; `t=` / `x=` / `t=y` handling.
- [ ] 1.5 Node-side check against RFC 6376 Appendix A and RFC 8463 Appendix A examples before wiring the view.

## 2. SPF and DMARC engines

- [ ] 2.1 SPF tokenizer (qualifier, mechanism, value / CIDR, modifiers `redirect=` / `exp=`); lint gates (version, `all` placement and qualifier, `ptr`, duplicates, lookup count ≤ 10 with pasted-include recursion, 255-octet string splitting, unknown mechanisms).
- [ ] 2.2 SPF evaluator against a sender IP (RFC 7208 §4.6) using the CIDR tool's IPv4 / IPv6 parsing; "needs DNS" and "unexpanded include" states; result pass / fail / softfail / neutral / none / permerror / temperror-as-unknown.
- [ ] 2.3 DMARC tag parser (RFC 9989 §5.3 + RFC 7489 historic tags); lint gates (version, `p` ladder, `sp` / `np` weaker than `p`, `adkim` / `aspf`, `rua` / `ruf` mailto syntax and external-destination note, deprecated `pct` / `rf` / `ri`, `t=y`, `psd`, unknown tags); alignment against the message `From` using mailhdr's organizational-domain function.

## 3. ARC engine

- [ ] 3.1 Group ARC-Seal / ARC-Message-Signature / ARC-Authentication-Results by `i=`; gaps and duplicates flagged (RFC 8617 §4.2).
- [ ] 3.2 AMS verification reusing the DKIM engine; AS verification over the ordered ARC header set (§5.1.1); `cv=` evaluation; chain verdict and explanation text.

## 4. DNS record linters

- [ ] 4.1 Record classifier for the shared textarea (DKIM / SPF / DMARC / MTA-STS TXT and policy / TLSRPT / BIMI / TLSA / CAA / DNSKEY / DS).
- [ ] 4.2 MTA-STS (RFC 8461 §3.1 TXT, §3.2 policy: mode, mx, max_age ≥ 604800 recommendation); TLSRPT (RFC 8460 §3); BIMI (`l=` https, `a=` VMC note linking to the TLS Certificate Parser).
- [ ] 4.3 TLSA (RFC 6698 §2.1 usage / selector / matching names, digest length); CAA (RFC 8659 §4 flags, tags, parameter syntax); DNSKEY key tag (RFC 4034 Appendix B / B.1), flags, algorithm names; DS fields and digest-type-2 recomputation (SHA-256 over owner wire format ‖ RDATA); DS ↔ DNSKEY match gate.

## 5. View

- [ ] 5.1 `#mailhdr-view` additions: `#mailhdr-eml` file input, `#mailhdr-dns` records textarea, `#mailhdr-sender-ip`, `#btn-mailhdr-verify`; panels `#mailhdr-dkim` (per-signature rows), `#mailhdr-spf`, `#mailhdr-dmarc`, `#mailhdr-arc`, `#mailhdr-dns-lint`; gate rows appended to `#mailhdr-gates`.
- [ ] 5.2 Per-signature state rendering (pass / body-hash-mismatch / signature-fail / key-unparseable / expired / unavailable) with the "what to check" line; timestamps via `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat`.
- [ ] 5.3 Verdict sentence unchanged ("shows who sent it, not that the content is safe"); DMARC alignment row as the bridge to the visible From; `dig` command hints with the selector and domain filled in.

## 6. Tests

- [ ] 6.1 Fixtures: RFC 6376 Appendix A message + key; RFC 8463 Appendix A message + Ed25519 key; a site-generated RSA-2048 signed `.eml` (relaxed/relaxed, with `l=`), its body-altered and header-altered variants; SPF / DMARC / MTA-STS / TLSRPT / BIMI / TLSA / CAA / DNSKEY / DS record texts.
- [ ] 6.2 `tests/specs/NN-mailauth.spec.js` (number assigned at implementation): DKIM pass (both appendix examples), body-hash mismatch, signature fail, key unparseable, expired `x=`, 1024-bit ⚠ / 512-bit ✗, `t=y` note, Ed25519 unavailable state (capability-mocked); SPF 9 vs 11 lookups, `+all` ✗, `ptr` ⚠, IP match pass / `-all` fail / unexpanded include "unknown"; DMARC `p=none` ⚠, `p=reject` ✓, `pct=50` deprecated ⚠, `sp=none` under `p=reject` ⚠, alignment pass / fail; ARC `cv=pass` chain with keys ✓, tampered seal ✗; MTA-STS enforce ✓ / none ⚠ / max_age short ⚠; TLSA `3 1 1` decode; CAA critical flag; DNSKEY key tag equals pasted DS and mismatched DS ✗; network-silence assertion; XSS payload in `From` display name and DMARC `rua` rendered inert.
- [ ] 6.3 Existing 26-mailhdr cases pass unchanged.

## 7. Wiring and gates

- [ ] 7.1 ~110 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts); refresh the 5 en SEO prose keys for `mailhdr` (now "verifies DKIM from a pasted key"); CLDR plurals for "n signatures", "n lookups".
- [ ] 7.2 TOOL_SYNONYMS add `dkim verify spf lint dmarc rfc 9989 arc mta-sts tlsrpt bimi tlsa dane caa dnskey ds key tag selector`; RELATED_TOOLS mailhdr ↔ tls-cert (VMC / TLSA) and mailhdr ↔ cidr both directions; JSON-LD featureList text updated; audit gate 20 tool count stays 57.
- [ ] 7.3 README: mailhdr feature paragraph (remove "does not re-verify", add "re-verifies from a pasted record"), standards cheat-sheet rows (RFC 6376, 8463, 8301, 7208, 9989–9991, 8617, 8461, 8460, 6698, 8659, 4034), Per-Tool Security Notes; THREAT-MODEL note that DNS records are user-supplied; SPEC-INTERNATIONAL.md status note.
- [ ] 7.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
