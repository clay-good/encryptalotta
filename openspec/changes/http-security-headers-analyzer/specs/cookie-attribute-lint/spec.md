# Spec Delta — cookie-attribute-lint

## Purpose

Check every `Set-Cookie` header in a pasted response-header block against the attribute rules of RFC 6265bis (draft-ietf-httpbis-rfc6265bis), so a reader sees which cookies a browser will protect, downgrade or reject.

## ADDED Requirements

### Requirement: Set-Cookie parsing and masking
The tool SHALL parse each `Set-Cookie` header with the RFC 6265bis §5.6 "parse a set-cookie string" algorithm (case-insensitive attribute names, last duplicate wins), SHALL render one table row per cookie with its name, attributes and byte size, and SHALL mask the value to its first four characters because pasted blocks often contain live session cookies.

#### Scenario: Two cookies, two rows
- **WHEN** the block contains `Set-Cookie: sid=abc123…; Path=/; Secure; HttpOnly; SameSite=Lax` and `Set-Cookie: theme=dark; Path=/`
- **THEN** two rows are rendered, the `sid` value reads `abc1…`, and the export contains the attribute gates but not the value

### Requirement: Security attribute gates
The tool SHALL display per-cookie rows for: `Secure` present (✗ absent); `HttpOnly` present (⚠ absent, ✗ absent when the name suggests a session — `sess`, `sid`, `token`, `auth`); `SameSite` present (⚠ absent with "browsers default to Lax"); `SameSite=None` without `Secure` (✗ "rejected by browsers", RFC 6265bis §5.6.7).

#### Scenario: None without Secure
- **WHEN** the cookie reads `tracker=1; SameSite=None`
- **THEN** the SameSite row is ✗ citing RFC 6265bis §5.6.7 and the Secure row is ✗

#### Scenario: Missing SameSite
- **WHEN** the cookie has Secure and HttpOnly but no SameSite
- **THEN** the SameSite row is ⚠ reading "not set; Chromium and Firefox default to Lax, Safari to None for some paths — set it explicitly"

### Requirement: Scope gates
The tool SHALL display per-cookie rows for `Domain` breadth — ⚠ when set to a registrable domain or broader, ✗ when it names a public suffix — judged against a short inline public-suffix subset (about 40 entries: ICANN TLDs plus common second-level suffixes such as `co.uk`, `com.au`, `github.io`; not the full PSL), and for `Path` (informational; ⚠ when absent on a session cookie).

#### Scenario: Public-suffix Domain
- **WHEN** the cookie carries `Domain=co.uk`
- **THEN** the Domain row is ✗ reading "names a public suffix — browsers reject this cookie (RFC 6265bis §5.6.3)"

#### Scenario: Broad Domain
- **WHEN** the cookie carries `Domain=example.com` on a response from `app.example.com`
- **THEN** the Domain row is ⚠ reading "shared with every subdomain of example.com"

### Requirement: Lifetime and size gates
The tool SHALL display per-cookie rows for `Max-Age` / `Expires` sanity (⚠ when the lifetime exceeds 400 days, RFC 6265bis §5.5, or when `Expires` fails to parse) and for total `Set-Cookie` size above 4096 bytes (✗, RFC 6265bis §6.1).

#### Scenario: Over-long lifetime
- **WHEN** the cookie carries `Max-Age=63072000`
- **THEN** the lifetime row is ⚠ reading "2 years; browsers cap at 400 days (RFC 6265bis §5.5)"

#### Scenario: Oversized cookie
- **WHEN** a single `Set-Cookie` header exceeds 4096 bytes
- **THEN** the size row is ✗ reporting the byte count

### Requirement: Prefix gates
The tool SHALL check cookies whose name starts with `__Host-` for `Secure`, no `Domain`, and `Path=/`, and cookies starting with `__Secure-` for `Secure`, per RFC 6265bis §4.1.3, reporting a ✗ row with the violated condition.

#### Scenario: Host prefix with Domain
- **WHEN** the cookie reads `__Host-sid=…; Secure; Path=/; Domain=example.com`
- **THEN** the prefix row is ✗ reading "`__Host-` cookies must not set Domain (RFC 6265bis §4.1.3.2) — browsers reject this cookie"

#### Scenario: Correct Host prefix
- **WHEN** the cookie reads `__Host-sid=…; Secure; Path=/; HttpOnly; SameSite=Strict`
- **THEN** every row for that cookie is ✓

### Requirement: Offline operation and verdict language
The tool SHALL evaluate cookies from the pasted text only and SHALL phrase an all-✓ cookie as "attributes conform to RFC 6265bis", never as the session being secure.

#### Scenario: Input never leaves the page
- **WHEN** cookies are linted while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every row for every cookie is ✓
- **THEN** the section summary reads "Cookie attributes conform to RFC 6265bis — this does not establish that the session handling behind them is sound."
