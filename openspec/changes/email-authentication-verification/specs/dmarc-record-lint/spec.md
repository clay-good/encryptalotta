# Spec Delta — dmarc-record-lint

## Purpose

Parse and lint a DMARC record per RFC 9989 (May 2026), explain the tags RFC 9989 deprecated from RFC 7489, rank the policy, and check alignment against the message's From domain, entirely in the browser.

## ADDED Requirements

### Requirement: Tag parsing
The tool SHALL parse a pasted `v=DMARC1` record into tag / value pairs (RFC 9989 §5.3: `v`, `p`, `sp`, `np`, `adkim`, `aspf`, `rua`, `ruf`, `fo`, `psd`, `t`) and the RFC 7489 tags `pct`, `rf`, `ri`, SHALL require `v=DMARC1` first and `p` present (§5.3 / §6.6.3), and SHALL list unknown tags as ignored.

#### Scenario: Record parsed
- **WHEN** the record is `v=DMARC1; p=quarantine; sp=reject; adkim=s; rua=mailto:dmarc@example.com`
- **THEN** the panel shows each tag with its RFC 9989 meaning and the `rua` destination

#### Scenario: Missing policy
- **WHEN** the record has no `p` tag
- **THEN** the lint result is ✗ "no `p` tag — the record is invalid for policy purposes (RFC 9989 §6.6.3)"

### Requirement: Policy gates
The tool SHALL display independent rows for: `p` on the ladder `none` ⚠ ("monitoring only") → `quarantine` ✓ → `reject` ✓; `sp` or `np` weaker than `p` ⚠ (§5.3); `adkim` / `aspf` `r` relaxed (default) or `s` strict, explained; `t=y` testing ⚠ ("receivers treat the policy as `none`", the RFC 9989 replacement for `pct=0`); `psd=y` / `n` / `u` explained (§5.3); `fo` options decoded.

#### Scenario: Monitoring-only policy
- **WHEN** `p=none`
- **THEN** the policy row is ⚠ "no enforcement — spoofed mail is delivered; use for monitoring, then move to quarantine or reject"

#### Scenario: Weaker subdomain policy
- **WHEN** `p=reject` and `sp=none`
- **THEN** a ⚠ row states that subdomains are unprotected relative to the organizational domain

### Requirement: Deprecated tags
The tool SHALL recognise `pct`, `rf`, and `ri`, SHALL show each with its RFC 7489 meaning, and SHALL mark it ⚠ "deprecated in RFC 9989 — receivers may ignore it", pointing `pct` users to `t=y` or staged `p` changes.

#### Scenario: pct shown as deprecated
- **WHEN** the record contains `pct=50`
- **THEN** the row reads "pct=50 — RFC 7489: apply policy to 50% of failing mail; deprecated in RFC 9989, receivers may apply the policy to all mail"

### Requirement: Reporting URIs
The tool SHALL validate `rua` and `ruf` as comma-separated `mailto:` URIs with optional size limit suffix (`!10m`; RFC 9989 §5.3 / §6.3), SHALL flag non-`mailto:` schemes ✗, and when a report address's domain differs from the policy domain SHALL add an informational row naming the `<policy-domain>._report._dmarc.<report-domain>` TXT record the report receiver must publish (§7.1), which the user may paste for a ✓.

#### Scenario: External report destination
- **WHEN** the policy domain is `example.com` and `rua=mailto:reports@dmarc-vendor.example`
- **THEN** the panel names `example.com._report._dmarc.dmarc-vendor.example` and, when a pasted TXT with `v=DMARC1` at that name is present, marks the destination ✓ authorised

#### Scenario: Bad scheme
- **WHEN** `ruf=https://example.com/report`
- **THEN** the row is ✗ "only mailto: URIs are defined for DMARC reports"

### Requirement: Alignment against the message
When a raw message is present, the tool SHALL determine the RFC 5322 From domain, SHALL compare it with the DKIM `d=` of each passing signature and the SPF-evaluated domain (Return-Path / HELO) under `adkim` / `aspf` (strict = exact; relaxed = same organizational domain using mailhdr's approximation), and SHALL report whether DMARC would pass (§4.4), stating the approximation.

#### Scenario: Relaxed alignment passes
- **WHEN** From is `news.example.com`, a passing DKIM `d=` is `example.com`, and `adkim=r`
- **THEN** the alignment row is ✓ "DKIM aligned (relaxed: same organizational domain, approximated without a Public Suffix List)"

#### Scenario: Strict alignment fails
- **WHEN** the same message is evaluated with `adkim=s`
- **THEN** the alignment row is ✗ and the DMARC result reflects the `p` policy

### Requirement: Offline operation and verdict language
The lint SHALL make no network request and SHALL phrase a DMARC pass as alignment between an authenticated identifier and the From domain, with the mailhdr sentence that this "shows who sent it, not that the content is safe".

#### Scenario: Input never leaves the page
- **WHEN** a DMARC record is linted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Pass wording
- **WHEN** DKIM is aligned and `p=reject`
- **THEN** the summary reads "DMARC would pass (DKIM aligned; policy reject) — the From domain's owner authorised this sending path. That shows who sent it, not that the content is safe."
