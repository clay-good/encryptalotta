# Spec Delta — transport-and-isolation-headers

## Purpose

Gate the transport, isolation, referrer, permissions and disclosure headers of a pasted response-header block — HSTS (RFC 6797), COOP / COEP / CORP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection, Server / X-Powered-By — each with the clause it is judged against.

## ADDED Requirements

### Requirement: HSTS gates
The tool SHALL parse `Strict-Transport-Security` per RFC 6797 §6.1 and display rows for: header present (✗ when absent); `max-age` ≥ 31536000 (✗ below one year, with the value rendered via `Intl.RelativeTimeFormat`); `includeSubDomains` present (⚠ when absent); preload eligibility = max-age ≥ 31536000 and includeSubDomains and `preload` all present (informational, noting the hstspreload.org submission rules the header alone cannot prove).

#### Scenario: Site's own HSTS
- **WHEN** the value is `max-age=31536000; includeSubDomains; preload`
- **THEN** all HSTS rows are ✓ and the eligibility row reads "structurally eligible for the preload list — submission also requires the apex to redirect to HTTPS"

#### Scenario: Short max-age
- **WHEN** the value is `max-age=300`
- **THEN** the max-age row is ✗ reading "5 minutes; RFC 6797 §6.1.1 — one year (31536000) is the accepted minimum for durable protection"

### Requirement: Cross-origin isolation gates
The tool SHALL parse `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy` and `Cross-Origin-Resource-Policy` (HTML Living Standard §7.1.3 / §7.1.4 and the Fetch standard §3.6) and display rows for each header's value plus a combination row that reads "cross-origin isolated" only when COOP is `same-origin` and COEP is `require-corp` or `credentialless`.

#### Scenario: Site's own isolation trio
- **WHEN** COOP is `same-origin`, COEP `require-corp`, CORP `same-origin`
- **THEN** all three rows are ✓ and the combination row reads "cross-origin isolated"

#### Scenario: COOP only
- **WHEN** COOP is `same-origin-allow-popups` and COEP is absent
- **THEN** the COOP row is ⚠ naming the weaker value, the COEP row is ⚠ absent, and the combination row reads "not cross-origin isolated"

### Requirement: Referrer-Policy ladder
The tool SHALL place `Referrer-Policy` on a ladder: `unsafe-url` ✗, `no-referrer-when-downgrade` ✗, `origin-when-cross-origin` ⚠, `strict-origin-when-cross-origin` / `strict-origin` / `same-origin` / `origin` / `no-referrer` ✓, absent ⚠ "browser default strict-origin-when-cross-origin applies"; when several comma-separated values are present the last recognised one applies (W3C Referrer Policy §4.1).

#### Scenario: Site's own referrer header
- **WHEN** the block contains `Referrer-Policy: no-referrer`
- **THEN** the row is ✓

#### Scenario: Leaky referrer policy
- **WHEN** the value is `no-referrer-when-downgrade`
- **THEN** the row is ✗ reading "leaks the full URL to cross-origin destinations"

### Requirement: Content-type and permissions gates
The tool SHALL display a row for `X-Content-Type-Options: nosniff` (✗ when absent or any other value, Fetch standard §2.2.5) and SHALL parse `Permissions-Policy` as a structured-field dictionary (W3C Permissions Policy §5), listing each feature with its allowlist and a ⚠ per feature whose allowlist is `*`.

#### Scenario: Site's own permissions header
- **WHEN** the site's Permissions-Policy (every feature `()` except `clipboard-write=(self)`) is pasted
- **THEN** the permissions table lists 23 features with no ⚠ and the nosniff row is ✓

#### Scenario: Wildcard feature
- **WHEN** the value contains `camera=*`
- **THEN** the camera row is ⚠ reading "allowed for every origin, including cross-origin iframes"

### Requirement: Obsolete and disclosure gates
The tool SHALL display a ⚠ row when `X-XSS-Protection` is present with any value other than `0` ("obsolete; the auditor was removed from Chromium and Edge and introduced side-channel leaks — set `0` or remove"), and ⚠ rows when `Server` or `X-Powered-By` contains a version number (regex `\d+\.\d+`).

#### Scenario: Site's own legacy header
- **WHEN** the block contains `X-XSS-Protection: 1; mode=block`
- **THEN** the row is ⚠ with the obsolescence wording and the summary counts it

#### Scenario: Version disclosure
- **WHEN** the block contains `X-Powered-By: PHP/8.1.2`
- **THEN** the row is ⚠ naming the disclosed version

### Requirement: Offline operation and verdict language
The tool SHALL evaluate the pasted text only and SHALL phrase an all-✓ section as "no weaknesses visible in these headers".

#### Scenario: Input never leaves the page
- **WHEN** a header block is analyzed while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every row in this section is ✓
- **THEN** the summary reads "No weaknesses visible in these headers — headers may differ per path, method or error page, and nothing here speaks for the application."
