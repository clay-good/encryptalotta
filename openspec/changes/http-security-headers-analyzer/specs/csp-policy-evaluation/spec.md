# Spec Delta — csp-policy-evaluation

## Purpose

Parse every Content-Security-Policy and Content-Security-Policy-Report-Only header in a pasted response-header block per W3C CSP Level 3 and report, per policy and per directive, the weaknesses that Google's csp-evaluator checks for, without fetching anything.

## ADDED Requirements

### Requirement: Policy and directive parsing
The tool SHALL treat each `Content-Security-Policy` or `-Report-Only` header value as one policy (splitting comma-separated values into further policies per CSP3 §4.1), SHALL parse directives and source expressions per CSP3 §2.3, and SHALL render a per-directive table showing the effective source list with the fallback directive named when `script-src`, `style-src`, `img-src`, `connect-src` or `frame-src` is absent (CSP3 §6.1.1).

#### Scenario: Site's own policy parsed
- **WHEN** the user pastes the `_headers` block of encryptalotta.com
- **THEN** the table lists `default-src`, `script-src`, `style-src`, `img-src`, `connect-src 'none'`, `form-action`, `base-uri`, `frame-ancestors 'none'`, `upgrade-insecure-requests`, and the `object-src` row reads "falls back to default-src 'self'"

#### Scenario: Two headers, two policies
- **WHEN** the block contains one enforced CSP and one `-Report-Only` CSP
- **THEN** two policy sections are rendered, the report-only section's ✗ rows are shown as ⚠ "report-only, not enforced", and a note states that all enforced policies must allow a resource for it to load

### Requirement: Inline and eval gates
The tool SHALL display gate rows for `'unsafe-inline'` and `'unsafe-eval'` in the effective `script-src` (and `'unsafe-inline'` in `style-src`): `'unsafe-inline'` in script-src is ✗ unless a `'nonce-…'` or `'sha256/384/512-…'` source is present in the same list, in which case it is ⚠ "ignored by CSP3 browsers because a nonce / hash is present" (CSP3 §6.7.2.3); `'unsafe-eval'` is ✗; `'unsafe-inline'` in style-src is ⚠.

#### Scenario: Site's own script-src
- **WHEN** the effective script-src is `'self' 'unsafe-inline'` with no nonce or hash
- **THEN** the row is ✗ citing csp-evaluator `SCRIPT_UNSAFE_INLINE` and CSP3 §6.7.2.3, and the detail suggests nonces or hashes

#### Scenario: Strict-CSP recipe
- **WHEN** script-src is `'nonce-r4nd0m' 'unsafe-inline' 'strict-dynamic' https:`
- **THEN** the unsafe-inline row is ⚠ (ignored), the `https:` row is suppressed with the note that `'strict-dynamic'` makes host and scheme allowlists ignored, and no ✗ row is produced for this directive

### Requirement: Source-list gates
The tool SHALL display gate rows for the effective script-src and object-src: wildcard `*` (✗); plain schemes `https:`, `http:`, `data:`, `blob:`, `filesystem:` (✗ in script-src, ⚠ elsewhere); hosts from the inline bypass list (✗ citing csp-evaluator `ANGULAR_BYPASS` / `JSONP_BYPASS`); missing `object-src 'none'` (✗ when neither object-src nor default-src restricts it); missing `base-uri` (⚠); no `script-src` and no `default-src` (✗ "scripts unrestricted").

#### Scenario: data in script-src
- **WHEN** script-src contains `data:`
- **THEN** the row is ✗ citing csp-evaluator `SCRIPT_ALLOWLIST_BYPASS` / plain-scheme check

#### Scenario: Allowlisted JSONP host
- **WHEN** script-src contains `ajax.googleapis.com`
- **THEN** the row is ✗ naming the host and explaining the JSONP / AngularJS bypass

### Requirement: Structural and framing gates
The tool SHALL display gate rows for deprecated directives `block-all-mixed-content`, `referrer`, `plugin-types` (⚠, CSP3 §Changes from Level 2); `report-uri` without `report-to` (⚠ deprecated); `frame-ancestors` present (✓) and its agreement with `X-Frame-Options` when both are present (`'none'` ↔ `DENY`, `'self'` ↔ `SAMEORIGIN`, otherwise ⚠ "browsers prefer frame-ancestors"); `upgrade-insecure-requests` present (informational).

#### Scenario: Site's own framing headers agree
- **WHEN** the block contains `frame-ancestors 'none'` and `X-Frame-Options: DENY`
- **THEN** the agreement row is ✓ and the X-Frame-Options row notes it is the legacy fallback

#### Scenario: Deprecated directive
- **WHEN** the policy contains `block-all-mixed-content`
- **THEN** a ⚠ row cites its deprecation in CSP3 and recommends `upgrade-insecure-requests`

### Requirement: Offline operation and verdict language
The tool SHALL evaluate policies from the pasted text only and SHALL phrase an all-✓ CSP as "no weaknesses visible in this policy", never as the site being secure.

#### Scenario: Input never leaves the page
- **WHEN** a header block is analyzed while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every CSP gate row is ✓
- **THEN** the section summary reads "No weaknesses visible in this policy — this does not establish that the application is free of injection."
