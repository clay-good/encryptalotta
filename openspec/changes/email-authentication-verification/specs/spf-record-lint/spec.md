# Spec Delta — spf-record-lint

## Purpose

Parse and lint `v=spf1` records and evaluate a sender IP against them from pasted records only, with the DNS-lookup budget counted recursively over the records the user pastes (RFC 7208).

## ADDED Requirements

### Requirement: Record parsing
The tool SHALL tokenize a pasted SPF record into version, terms with qualifier (`+` default, `-`, `~`, `?`), mechanism name (`all`, `include`, `a`, `mx`, `ptr`, `ip4`, `ip6`, `exists`), value and CIDR length, and modifiers (`redirect=`, `exp=`), per RFC 7208 §4.6 and §5, SHALL join multiple quoted strings of one TXT record (§3.3), and SHALL reject unknown mechanisms as permerror (§4.6.1).

#### Scenario: Multi-string record joined
- **WHEN** the pasted TXT record is `"v=spf1 ip4:192.0.2.0/24 " "include:_spf.example.net -all"`
- **THEN** the record is parsed as one string with three terms and a note that the two strings were concatenated

#### Scenario: Unknown mechanism
- **WHEN** a term is `ipv4:192.0.2.1`
- **THEN** the lint result is permerror naming the unknown mechanism `ipv4`

### Requirement: Lint gates
The tool SHALL display independent ✓ / ⚠ / ✗ rows for: record starts with `v=spf1`; an `all` term is present and is the last mechanism (§5.1); `+all` ✗ and `?all` ⚠ (§5.1 and §10.1); `ptr` deprecated ⚠ (§5.5); duplicate `include` targets ⚠; `redirect=` combined with `all` ⚠ (the redirect is ignored); each TXT string ≤ 255 octets and the whole record ≤ 450 octets ⚠ (§3.3 / §3.4); more than one `v=spf1` record pasted for the same domain ✗ (§3.2).

#### Scenario: Permissive all
- **WHEN** the record ends in `+all`
- **THEN** the row is ✗ "any host may send as this domain (RFC 7208 §10.1)"

#### Scenario: Deprecated ptr
- **WHEN** the record contains `ptr`
- **THEN** the row is ⚠ citing §5.5 "SHOULD NOT be used"

### Requirement: DNS-lookup budget
The tool SHALL count terms that cause DNS lookups (`include`, `a`, `mx`, `ptr`, `exists`, `redirect=`; §4.6.4) across the pasted record and every pasted record it includes or redirects to, SHALL display the count against the limit of 10 as ✓ / ✗, and SHALL list includes whose records were not pasted as "not expanded — counts as 1, its own lookups unknown".

#### Scenario: Within budget
- **WHEN** the record has 3 includes whose records are pasted and together contain 6 further lookups
- **THEN** the budget row reads "9 of 10 DNS lookups" ✓

#### Scenario: Over budget
- **WHEN** the recursive count reaches 11
- **THEN** the budget row is ✗ "permerror — receivers stop evaluating after 10 lookups (RFC 7208 §4.6.4)"

### Requirement: Sender-IP evaluation
Given a sender IP in `#mailhdr-sender-ip`, the tool SHALL evaluate the record left to right per RFC 7208 §4.6.2: `ip4` / `ip6` by CIDR match (IPv4 and IPv6, via the CIDR tool's parser), `include` by recursing into a pasted record (match → the include's qualifier applies), `all` as the terminal match; `a`, `mx`, `exists`, `ptr`, and unexpanded includes SHALL be reported as "needs DNS — unknown" and the result SHALL then be "undetermined before `all`" rather than a guessed verdict.

#### Scenario: IP matches ip4
- **WHEN** the sender IP is `192.0.2.17` and the record is `v=spf1 ip4:192.0.2.0/24 -all`
- **THEN** the evaluation reads "pass — matched `ip4:192.0.2.0/24`"

#### Scenario: IP falls to -all
- **WHEN** the sender IP is `198.51.100.1` and the same record is evaluated
- **THEN** the evaluation reads "fail — no mechanism matched; `-all`"

#### Scenario: Unexpanded include before all
- **WHEN** the record is `v=spf1 include:_spf.example.net -all` and no record for `_spf.example.net` is pasted
- **THEN** the evaluation reads "undetermined — `include:_spf.example.net` needs DNS; paste its record to continue" and no pass / fail is claimed

### Requirement: Offline operation and verdict language
The lint and evaluation SHALL make no DNS or network request and SHALL phrase a pass as the IP being authorised by the pasted records, never as the message being legitimate.

#### Scenario: Input never leaves the page
- **WHEN** an SPF record is linted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Pass wording
- **WHEN** the sender IP matches
- **THEN** the summary reads "SPF pass per the pasted records — this IP may send for the domain; that shows who sent it, not that the content is safe"
