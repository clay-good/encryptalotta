# Spec Delta — cache-and-content-headers

## Purpose

Gate the caching and content-description headers of a pasted response — Cache-Control (RFC 9111), Content-Type charset, Content-Disposition (RFC 6266), Clear-Site-Data (W3C) — with the expectation adjusted to whether the response carried credentials.

## ADDED Requirements

### Requirement: Cache-Control gates
The tool SHALL parse `Cache-Control` per RFC 9111 §5.2 and display rows for: `no-store` present when the response is credentialed (✗ absent) — credentialed meaning a `Set-Cookie` header is present, `Vary` names `Authorization` or `Cookie`, or the user ticked "this response was authenticated"; `private` vs `public` (✗ `public` on a credentialed response); `Pragma: no-cache` / `Expires: 0` noted as HTTP/1.0 legacy (informational).

#### Scenario: Site's own cache headers
- **WHEN** the block contains `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, `Expires: 0` and no Set-Cookie
- **THEN** the no-store row is ✓ (informational, not required), and the legacy row notes Pragma / Expires are redundant with RFC 9111 directives

#### Scenario: Credentialed response without no-store
- **WHEN** the block contains a `Set-Cookie` header and `Cache-Control: max-age=3600`
- **THEN** the no-store row is ✗ citing RFC 9111 §5.2.2.5 and the risk of shared-cache disclosure

### Requirement: Content-Type and disposition gates
The tool SHALL display rows for: `Content-Type` present with a `charset` parameter on `text/*` and `application/json`-like types (⚠ absent, RFC 9110 §8.3); `Content-Disposition: attachment` when the user marks the response as a download, with the `filename*` RFC 8187 encoding noted; `Content-Type` of `text/html` combined with `X-Content-Type-Options` absent (cross-referenced from the transport gates).

#### Scenario: HTML without charset
- **WHEN** the block contains `Content-Type: text/html`
- **THEN** the charset row is ⚠ reading "no charset; declare `charset=utf-8` to prevent encoding-based XSS"

#### Scenario: Download with filename star
- **WHEN** the block contains `Content-Disposition: attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`
- **THEN** the row is ✓ and the decoded file name `résumé.pdf` is shown

### Requirement: Clear-Site-Data
The tool SHALL parse `Clear-Site-Data` (W3C Clear Site Data §3) and list the directives `"cache"`, `"cookies"`, `"storage"`, `"executionContexts"`, `"*"` present, flagging unquoted or unknown directives as ⚠.

#### Scenario: Logout response
- **WHEN** the block contains `Clear-Site-Data: "cookies", "storage"`
- **THEN** both directives are listed ✓ and the detail notes the header is honoured only over HTTPS

### Requirement: Offline operation and verdict language
The tool SHALL evaluate the pasted text only and SHALL phrase an all-✓ section as "no weaknesses visible in these headers".

#### Scenario: Input never leaves the page
- **WHEN** cache headers are analyzed while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every row in this section is ✓
- **THEN** the summary reads "No weaknesses visible in these headers." with no claim about the response body
