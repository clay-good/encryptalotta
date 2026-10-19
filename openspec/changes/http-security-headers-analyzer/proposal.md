# Proposal — HTTP Security Headers Analyzer

## Why

Whether a site is protected against script injection, clickjacking, cookie theft and cross-site leaks is decided by a dozen response headers: `Content-Security-Policy` (W3C CSP Level 3), `Strict-Transport-Security` (RFC 6797), the `Cross-Origin-*` isolation trio, `Referrer-Policy`, `Permissions-Policy`, the `Set-Cookie` attributes (RFC 6265bis) and `Cache-Control`. Reading them by eye is error-prone — a CSP with `'unsafe-inline'` *and* a nonce behaves differently from one without, `SameSite=None` without `Secure` is silently dropped, and `max-age=300` on HSTS protects nobody. The established checkers (securityheaders.com, Google's csp-evaluator, Mozilla Observatory) all fetch the target URL from their servers, which means telling a third party which internal hostnames you are hardening. The site already ships every parser pattern this needs (RFC 5322 header splitting in the Email Header Analyzer, the ✓ / ⚠ / ✗ gate framework, the URL Parser) but has no tool for response headers.

## What Changes

- **New tool `headers` — "HTTP Security Headers Analyzer"** in Utilities, next to the URL Parser. Tool count **57 → 58**.
- **Input**: a raw response-header block pasted from `curl -I` / `curl -D -` or the DevTools Network panel (status line optional, header folding and duplicates handled). **Nothing is fetched** — the user pastes what their own client received (§0.1).
- **CSP evaluation**: both `Content-Security-Policy` and `-Report-Only` headers (several headers combine as separate policies), a per-directive table, and gates modelled on Google's csp-evaluator: `'unsafe-inline'` / `'unsafe-eval'`, wildcard and plain-scheme sources, missing `object-src` / `base-uri` / `script-src`, `'strict-dynamic'` semantics, known JSONP / Angular bypass hosts, deprecated directives, `report-uri` vs `report-to`, `frame-ancestors` vs `X-Frame-Options`, `upgrade-insecure-requests`.
- **Transport and isolation**: HSTS max-age / includeSubDomains / preload eligibility, COOP / COEP / CORP and the cross-origin-isolation combination, `X-Content-Type-Options`, `Referrer-Policy` ladder, `Permissions-Policy` parsing, `X-XSS-Protection` flagged obsolete, `Server` / `X-Powered-By` version disclosure.
- **Cookie lint**: every `Set-Cookie` checked for Secure, HttpOnly, SameSite, Domain breadth, Path, Max-Age / Expires sanity, `__Host-` / `__Secure-` prefix rules, 4096-byte size.
- **Cache and content headers**: `Cache-Control` for responses that set cookies or answer an `Authorization` request, `Content-Type` charset, `Content-Disposition`, `Clear-Site-Data`.
- **Report export**: the gate list as JSON or Markdown through the shared exporter introduced by the `einvoice-readable-view-and-reports` change.
- Related-tool links: HTTP Headers ↔ URL Parser ↔ Email Header Analyzer ↔ TLS Certificate Parser ↔ Link Safety Inspector.

Out of scope (and the §7 non-goal it respects): no fetching of the target URL, no "scan my site" (§0.1 / §7.5 — the page cannot and must not connect); no letter grade or score (a single grade is compliance theater, §7.2 — the tool reports rows, not a badge); no request-header analysis (`Cookie`, `Authorization` values are never parsed, only their presence is used as a hint); no TLS configuration analysis (that is the TLS Certificate Parser's domain). The analyzer reports what the headers *say*; whether the application behind them is safe is not knowable from headers.

## Capabilities

### New Capabilities
- `csp-policy-evaluation`: parse and gate Content-Security-Policy / -Report-Only per CSP Level 3 with csp-evaluator-style findings.
- `transport-and-isolation-headers`: HSTS, COOP / COEP / CORP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection, version-disclosure gates.
- `cookie-attribute-lint`: per-`Set-Cookie` attribute gates per RFC 6265bis.
- `cache-and-content-headers`: Cache-Control, Content-Type, Content-Disposition, Clear-Site-Data gates.
- `header-report-export`: JSON / Markdown export of the gate list via the shared report exporter.

### Modified Capabilities
- none (the Email Header Analyzer's RFC 5322 splitter is reused as a function; its behaviour does not change).

## Impact

- `index.html`: one new view, ~600 lines of inline JS (header-block tokenizer, CSP directive / source-expression parser, HSTS / COOP / Referrer / Permissions parsers, Set-Cookie attribute parser, gate functions), ~70 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: the RFC 5322 header splitter (mailhdr) for folding and duplicate handling, `URL` parsing for source expressions and Domain attributes, the SEPA / UBL gate framework (`{ok,label,detail,clause}` rows), the shared JSON / Markdown exporter (`einvoice-readable-view-and-reports`), `Intl.NumberFormat` / `Intl.RelativeTimeFormat` for max-age display, STRINGS i18n.
- No new vendored file, no CSP change, page weight +~12 KB gzipped.
- Worked example: the site's own `_headers` block, pasted from `curl -I https://encryptalotta.com`, is the fixture; the expected rows are listed in the specs (see the `'unsafe-inline'` and `X-XSS-Protection` rows, which the tool must report honestly).
- Tests: new `tests/specs/NN-headers.spec.js` (number assigned at implementation; 29+) — the site's own headers, csp-evaluator's published sample policies, an HSTS block below one year, a `SameSite=None` cookie without `Secure`, a `__Host-` prefix violation, and the "no network" assertion the suite already uses.
