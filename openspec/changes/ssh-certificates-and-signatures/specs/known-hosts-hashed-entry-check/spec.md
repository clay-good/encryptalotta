# Spec Delta — known-hosts-hashed-entry-check

## Purpose

Read `known_hosts` lines — including the hashed `|1|salt|hash` form (HMAC-SHA-1, `sshd(8)` SSH_KNOWN_HOSTS FILE FORMAT) — and answer whether they belong to a given hostname; produce hashed entries; and lint `authorized_keys` option strings against the `sshd(8)` AUTHORIZED_KEYS FILE FORMAT grammar.

## ADDED Requirements

### Requirement: known_hosts line decoding
The tool SHALL parse a `known_hosts` line into optional marker (`@cert-authority`, `@revoked`), hostname field (plain comma-separated patterns with `*` / `?` / `!`, `[host]:port`, or hashed `|1|base64salt|base64hash`), key type, key blob (reusing the public-key parser for fingerprint), and comment.

#### Scenario: Hashed line
- **WHEN** a line produced by `ssh-keygen -H` is pasted
- **THEN** the rows read "hashed hostname (HMAC-SHA-1, 20-byte salt)", the key type, and the key's `SHA256:` fingerprint

#### Scenario: Certificate authority marker
- **WHEN** the line starts with `@cert-authority *.example.com`
- **THEN** a row reads "marker: @cert-authority — this key signs host certificates for the pattern" and the pattern is listed

### Requirement: Hostname matching
Given a hostname and optional port, the tool SHALL test hashed entries by computing HMAC-SHA-1(salt, hostname) via Web Crypto and comparing in constant time (trying `[host]:port` when the port is not 22), and plain entries by `sshd(8)` pattern rules including negation, and SHALL report match or no match.

#### Scenario: Hashed match
- **WHEN** the hashed fixture line for `github.com` is pasted and `github.com` entered
- **THEN** the row reads "matches: this line is the entry for github.com"

#### Scenario: Non-standard port
- **WHEN** the entry was hashed for `[git.example.com]:2222` and the user enters host `git.example.com` port 2222
- **THEN** the match row is ✓ and names the `[host]:port` form that matched

#### Scenario: No match
- **WHEN** the hostname differs
- **THEN** the row reads "no match for <hostname> (as typed or as [host]:port)"

### Requirement: Hashed entry generation
The tool SHALL produce the hashed hostname field `|1|salt|hash` for a given hostname with a fresh 20-byte salt from `crypto.getRandomValues`, verifiable by `ssh-keygen -F`.

#### Scenario: Generate hashed field
- **WHEN** the user enters `example.org` and clicks Hash hostname
- **THEN** a `|1|…|…` field is shown and feeding it back with `example.org` reports a match

### Requirement: authorized_keys option linting
The tool SHALL parse an `authorized_keys` line's option list with quoting and SHALL display gate rows for: unknown option name; unbalanced quotes; `expiry-time=` syntax (`YYYYMMDD[HHMM[SS]]`) and whether it has passed; `from=` pattern syntax; `command=` without `restrict` (⚠); conflicting options (`restrict` combined with `no-*`); `permitopen=` / `permitlisten=` host:port syntax; `cert-authority` on a certificate-signing key line; and the key itself parsed as a public key.

#### Scenario: Restricted deploy key
- **WHEN** `restrict,command="/usr/bin/rrsync /srv",from="10.0.0.0/8" ssh-ed25519 AAAA… deploy` is pasted
- **THEN** every gate row is ✓ and the key fingerprint is shown

#### Scenario: Expired key
- **WHEN** the line carries `expiry-time="20240101"`
- **THEN** the expiry row is ✗ "expired on 1 January 2024 (sshd local time) — sshd ignores this key"

#### Scenario: Command without restrict
- **WHEN** `command="…"` is present without `restrict`
- **THEN** a ⚠ row reads "command= without restrict — forwarding and pty remain allowed unless disabled"

#### Scenario: Unknown option
- **WHEN** an option `allow-everything` is present
- **THEN** the row is ✗ "unknown option — sshd rejects the line"

### Requirement: Offline operation
All hashing and matching SHALL run in the page; no host is contacted and no key is fetched.

#### Scenario: Input never leaves the page
- **WHEN** a hostname is matched while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
A match SHALL be reported as the line corresponding to the hostname and an all-✓ lint as conforming to the `sshd(8)` grammar; neither SHALL be described as the host or key being trusted or secure.

#### Scenario: Clean result wording
- **WHEN** a hashed line matches and the key parses
- **THEN** the summary reads "This known_hosts line is the entry for <hostname> (HMAC-SHA-1 match). This does not establish that the key belongs to the real host — compare the fingerprint out of band."
