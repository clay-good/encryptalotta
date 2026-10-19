# Design — HTTP Security Headers Analyzer

## Context

A response-header block is a list of `Name: value` lines with optional folding, duplicates (several `Set-Cookie`, several `Content-Security-Policy`), and sometimes a leading status line. The Email Header Analyzer (draft 311) already tokenizes exactly this shape for RFC 5322 and handles folding and repeats; this tool reuses that splitter and adds per-header grammars: CSP Level 3 §2 (directive list, source expressions), RFC 6797 §6.1 (HSTS), the HTML Living Standard sections for COOP / COEP / CORP, the W3C Referrer Policy and Permissions Policy drafts, RFC 6265bis §4.1 (Set-Cookie), RFC 9111 (Cache-Control). There is no cryptography in this change. Nothing is fetched: the user pastes what their own `curl -I` or DevTools showed them.

## Goals / Non-Goals

**Goals:**
- One paste → one combined gate list in the house ✓ / ⚠ / ✗ style, grouped by header, every row citing its source (CSP3 section, RFC clause, csp-evaluator check name).
- CSP findings that match Google's csp-evaluator on its documented checks, so a user comparing the two sees the same verdicts.
- Honest treatment of the site's own headers as the worked example, including the rows that are not ✓.

**Non-Goals:**
- No fetching, no "enter a URL" field (§0.1). The input control is a textarea only.
- No score or grade. No "A+".
- No CSP *generation* wizard. The tool explains an existing policy; writing one is a different product.
- No parsing of request headers or cookie *values*; `Set-Cookie` values are shown masked (first 4 characters) because pasted blocks often contain live session cookies.
- No browser-version compatibility matrix per header.

## Decisions

1. **Tokenizer reused from the Email Header Analyzer.** `mailhdrSplit(text)` already yields `[{name, value}]` with folding unfolded and order preserved; it is promoted to a shared `headerBlockSplit()` and the mailhdr call site repointed. A leading `HTTP/1.1 200 OK` or `HTTP/2 200` status line is detected and shown as metadata. Rejected: a second splitter — would drift from the first on folding edge cases.
2. **CSP parsed per policy, then evaluated per policy.** Each `Content-Security-Policy` header value is one policy; comma-separated values inside one header are split into policies as CSP3 §4.1 permits; `-Report-Only` policies are evaluated with the same gates but every ✗ is downgraded to ⚠ and labelled "report-only, not enforced". Directive fallback (`script-src` → `default-src`) follows CSP3 §6.1.1 and the table shows the *effective* source list with the directive it fell back to.
3. **Nonce / hash semantics applied before judging `'unsafe-inline'`.** Per CSP3 §6.7.2.3, a `'nonce-…'` or `'sha256-…'` in the same source list makes the browser ignore `'unsafe-inline'`; the gate then reads ⚠ "`'unsafe-inline'` present but ignored by CSP3-capable browsers because a nonce / hash is present (kept for CSP1 fallback)" instead of ✗. Rejected: flagging ✗ regardless — would contradict csp-evaluator and mislead users who followed the strict-CSP recipe.
4. **`'strict-dynamic'` reported as informational.** When present in `script-src`, host and scheme allowlists in that directive are ignored (CSP3 §6.7.2.3); the gate says so and suppresses the wildcard / scheme / bypass-host rows for that directive rather than reporting findings the browser will not act on.
5. **Bypass-host list is short and inline.** The csp-evaluator `angular` and `jsonp` host lists are long and partly stale; the tool ships ~25 entries (the Google APIs, `*.googleapis.com`, `ajax.googleapis.com`, `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com`, `*.yandex.ru`, `www.google.com` / `recaptcha`, `*.doubleclick.net`, `accounts.google.com`, `apis.google.com`) with the finding "host known to serve JSONP or an AngularJS build — allowlisting it permits CSP bypass (csp-evaluator `ANGULAR_BYPASS` / `JSONP_BYPASS`)". Rejected: vendoring csp-evaluator (Apache-2, ~90 KB after build, TypeScript, needs a bundler — §7.7).
6. **HSTS preload eligibility is the hstspreload.org rule set, stated structurally:** `max-age` ≥ 31536000, `includeSubDomains` present, `preload` present. The tool cannot know whether the apex redirects or whether subdomains serve HTTPS, and the detail says "list submission also requires …". Rejected: calling it "preload-ready".
7. **Cross-origin isolation computed as the combination** COOP `same-origin` + COEP `require-corp` or `credentialless` ⇒ "cross-origin isolated (SharedArrayBuffer / high-resolution timers available)"; any other combination lists which header falls short. CORP is judged on its own (`same-origin` / `same-site` / `cross-origin`).
8. **Referrer-Policy as a ladder**, leakiest first: `unsafe-url` ✗, `no-referrer-when-downgrade` ✗ (pre-2020 default, leaks full URL cross-origin), `origin-when-cross-origin` ⚠, `strict-origin-when-cross-origin` ✓ (current default), `same-origin` / `strict-origin` / `no-referrer` ✓. Multiple comma-separated values: the last recognised one wins (Referrer Policy §4.1) and the table says which one applied.
9. **Set-Cookie parsing follows RFC 6265bis §5.6 (the "parse a set-cookie string" algorithm),** attribute names case-insensitive, duplicates last-wins. `SameSite` missing ⇒ note "browsers default to Lax" (⚠ not ✗); `SameSite=None` without `Secure` ⇒ ✗ "rejected by browsers". `__Host-` requires Secure, no Domain, Path=/; `__Secure-` requires Secure (RFC 6265bis §4.1.3). Cookie size > 4096 bytes ⇒ ✗ (§6.1 minimum limits). Values are masked in the table.
10. **Cache gate is conditional.** `Cache-Control: no-store` is expected only when the response sets a cookie, carries `Authorization`-related `Vary`, or the user ticks "this response was authenticated"; otherwise the row is informational. Rejected: demanding `no-store` everywhere (wrong for static assets, including this site's own `sw.js` which uses `no-cache`).
11. **Export via the shared exporter** from `einvoice-readable-view-and-reports` (`reportExport(rows, {format: 'json' | 'markdown'})`): the gate rows already carry `{ok, label, detail, clause}`, so no adapter is needed. The JSON schema is that exporter's; this tool adds `header` and `policyIndex` fields.
12. **Pure JS throughout; no Web Crypto involved.** CSP hash sources are checked for shape (`sha256-` + 44 base64 chars, `sha384-` + 64, `sha512-` + 88) only; there is no script body to hash.

## Risks / Trade-offs

- **The worked example is not all-✓.** The site's own `_headers` block carries `script-src 'self' 'unsafe-inline'` (single-file inline-script site on a static host without nonces), `style-src 'unsafe-inline'`, and a legacy `X-XSS-Protection: 1; mode=block`. The tool must report those rows as ✗ / ⚠ / ⚠ respectively; the spec fixes the expected rows and the README note explains the trade-off instead of hiding it. Making the tool flatter its own host would be exactly the overclaiming THREAT-MODEL.md warns against.
- **csp-evaluator drift.** Google adjusts its checks; the tool names the check it mirrors and the version date (csp-evaluator as of 2026-10) in the detail so divergence is attributable.
- **Pasted secrets.** Header blocks pasted from DevTools often contain live `Set-Cookie` values. Values are masked in the table, never placed in the export, and the textarea is cleared on view unload like the TOTP tool's secret field.
- **Multiple policies.** Browsers enforce *every* delivered CSP; the intersection is what applies. The tool evaluates each policy separately and states that all of them must pass for a resource to load, rather than attempting to compute the intersection.
- **False confidence.** "No weaknesses visible in these headers" means the headers present read well — it says nothing about headers that differ per path, per method, or on error pages, and nothing about the application. The summary says so.
