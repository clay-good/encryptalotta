# Tasks — HTTP Security Headers Analyzer

## 1. Header-block tokenizer

- [ ] 1.1 Promote the Email Header Analyzer's RFC 5322 splitter to `headerBlockSplit(text) → {statusLine, headers: [{name, value, index}]}`; repoint mailhdr; confirm `26-mailhdr.spec.js` passes unchanged.
- [ ] 1.2 Status-line detection (`HTTP/1.1 200 OK`, `HTTP/2 200`, `HTTP/3 200`), case-insensitive header grouping, duplicate preservation (`Set-Cookie`, CSP), comma-split for CSP and Permissions-Policy only where the grammar allows.

## 2. CSP engine

- [ ] 2.1 `cspParse(value) → policies[]` per CSP3 §4.1 / §2; `cspEffective(policy, directive)` fallback per §6.1.1; nonce / hash shape check.
- [ ] 2.2 Gate functions (one per check, each `{ok, label, detail, clause}`): unsafe-inline (with nonce / hash override), unsafe-eval, wildcard, plain schemes (`https:` `http:` `data:` `blob:` `filesystem:`), missing object-src `'none'`, missing base-uri, missing script-src, strict-dynamic informational + suppression, bypass hosts (inline list ~25), deprecated directives (`block-all-mixed-content`, `referrer`, `plugin-types`), `report-uri` vs `report-to`, `frame-ancestors` ↔ `X-Frame-Options` agreement, `upgrade-insecure-requests`; report-only downgrade.
- [ ] 2.3 Verify against csp-evaluator's published sample policies and the site's own CSP (expected rows per spec).

## 3. Transport, isolation, cookie and cache engines

- [ ] 3.1 `hstsParse(value)` (RFC 6797 §6.1) with ≥ 31536000 / includeSubDomains / preload rows; `Intl.RelativeTimeFormat` for the max-age label.
- [ ] 3.2 COOP / COEP / CORP parser and the cross-origin-isolation combination; X-Content-Type-Options; Referrer-Policy ladder (last recognised value wins); Permissions-Policy structured-header parse with `*` allowlist warnings; X-XSS-Protection obsolete row; Server / X-Powered-By version-disclosure regex.
- [ ] 3.3 `setCookieParse(value)` per RFC 6265bis §5.6; gates: Secure, HttpOnly, SameSite (missing ⇒ Lax note; None without Secure ✗), Domain breadth (eTLD+1 or broader ⚠, judged against a new ~40-entry inline public-suffix subset — not the full PSL), Path, Max-Age / Expires sanity, `__Host-` / `__Secure-` rules, size > 4096; value masking.
- [ ] 3.4 Cache-Control (RFC 9111) conditional `no-store` gate, `private` / `public`, `Content-Type` charset, `Content-Disposition` for downloads, `Clear-Site-Data` directives.

## 4. View and export

- [ ] 4.1 `#headers-view`: `#headers-input` textarea, `#headers-authenticated` checkbox, `#btn-headers-analyze`, `#headers-results` (status + grouped tables: CSP directives, cookies, other headers), `#headers-gates`, `#btn-headers-export-json`, `#btn-headers-export-md`.
- [ ] 4.2 Masked cookie values; `createElement` / `textContent` only; textarea cleared on view unload.
- [ ] 4.3 Summary line wording per the verdict-language requirement; link rows to URL Parser, Email Header Analyzer, TLS Certificate Parser, Link Safety Inspector.
- [ ] 4.4 Hook the gate rows into the shared `reportExport()` from `einvoice-readable-view-and-reports` with `header` / `policyIndex` fields.

## 5. Tests

- [ ] 5.1 `tests/specs/NN-headers.spec.js` (number assigned at implementation; 29+): the site's `_headers` block (expected ✗ / ⚠ rows exactly as specified), csp-evaluator samples (`'unsafe-inline'` with and without nonce, `'strict-dynamic'`, `data:` in script-src, missing object-src), HSTS 300 s, HSTS preload-eligible, COOP+COEP isolation, `Referrer-Policy: unsafe-url`, `SameSite=None` without Secure, `__Host-` with Domain, cookie > 4096 bytes, Set-Cookie + no `no-store`, report-only downgrade, JSON / Markdown export shape, clean-result wording, network-silence assertion, XSS payload in a header value rendered inert.
- [ ] 5.2 Register `headers` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters.

## 6. Wiring and gates

- [ ] 6.1 ~70 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; CLDR plural group for "n findings".
- [ ] 6.2 TOOL_ORDER (after `url`), TOOL_TO_GROUP utilities, TOOL_SYNONYMS (`csp content security policy hsts cookie samesite httponly coop coep corp referrer permissions-policy x-frame-options security headers curl`), RELATED_TOOLS both directions, JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 6.3 README: Features list, standards cheat sheet rows (CSP Level 3, RFC 6797, RFC 6265bis, RFC 9111, Referrer Policy, Permissions Policy), Per-Tool Security Notes paragraph including the site's own `'unsafe-inline'` trade-off; SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
