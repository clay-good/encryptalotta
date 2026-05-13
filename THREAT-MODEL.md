# Threat model

A short, honest statement of what encryptalotta does and does not protect
against. Overclaiming is dangerous — users decide what to type into the tool
based on what they think it defends against, so this document is conservative
on purpose.

## What encryptalotta is

A single-page web application that runs entirely in the browser. Every tool —
PGP key generation, symmetric and asymmetric encryption, signing, hashing,
KDFs, parsers, encoders, regulator-preset key generation, IBAN / VAT / BIC
checks, and the rest — executes in JavaScript inside the page that the
user loaded. Nothing is sent anywhere. No server processes your data because
there is no server beyond the static-file host.

The site enforces this with a Content Security Policy that includes
`connect-src 'none'`. The browser refuses to open any outbound connection
from the page. This is the load-bearing technical invariant of the project.

## What it protects against

**A passive network observer.** Someone watching the wire between your
browser and the static host can see that you loaded encryptalotta.com.
They cannot see what you typed into any tool, what files you opened, what
keys you generated, or what you copied to the clipboard. That state never
leaves your browser.

**A curious or compromised static host.** The host serves the same bytes
to every visitor. It receives no per-tool telemetry, no inputs, no outputs,
no error reports. A compromise of the static host can replace future page
loads with a malicious build (see "what it does not protect against" below)
but cannot retroactively read past sessions, because past sessions
generated no remote state at all.

**Accidental exfiltration via the page itself.** No `fetch`, no
`XMLHttpRequest`, no `WebSocket`, no `EventSource`, no `navigator.sendBeacon`,
no third-party fonts, no analytics, no CDN. The audit script enforces this
on every release.

**Common cryptographic footguns inside the tools.**
- Hash and HMAC comparisons use constant-time equality where applicable.
- Random material comes from `crypto.getRandomValues` (or, for OpenPGP key
  generation, from the OpenPGP.js library which uses the same Web Crypto
  source).
- Sensitive buffers (HMAC keys, passphrases, derived KDF outputs) are
  zeroized after use where the API allows it.
- "For test data only" labels appear on tools that generate
  syntactically-valid-but-not-real identifiers (IBAN generator, test BIC
  detection).

## What it does not protect against

**A compromised endpoint.** A malicious browser extension, a keylogger, a
clipboard hijacker, a screen recorder, a rootkit, or an attacker with
filesystem access to your machine can read everything you type and
everything the page renders. The site cannot defend against this and you
should not assume otherwise.

**A compromised page load.** The browser fetches the HTML, JS, and icons
from a static host. HTTPS authenticates the host; it does not protect you
against an attacker who has compromised the host itself, or against an
attacker with a valid mis-issued TLS certificate. If a sophisticated
adversary substitutes the page bytes at load time, no defense inside the
page can detect that — by the time your JavaScript runs, the JavaScript
is whatever the attacker supplied.

Mitigations available to high-risk users:
- Download the single-file portable build (`encryptalotta-portable.html`)
  once, verify its SHA-256 against the value in `RELEASES.md`, and run it
  from `file://` thereafter. The portable build is self-contained — no
  external script tags, no remote fonts, no images fetched at runtime.
- Clone the repo, verify commit signatures and the SBOM, and serve
  locally.

**A compromised browser.** A browser vulnerability that allows arbitrary
code execution or DOM tampering defeats the site's defenses, because the
site lives inside that browser.

**Quantum adversaries against today's PGP keys.** RSA and elliptic-curve
PGP keys generated today (including with the regulator presets) are not
post-quantum. None of the regulator preset sources currently mandate a
PQ algorithm for general use; when they do, the presets will be updated.
Material encrypted today is recorded today and is decryptable later if
the algorithm falls — "store now, decrypt later" is a real adversary
model for some users.

**Side channels in the JavaScript engine.** Timing attacks, cache attacks,
Spectre-class attacks, and similar microarchitectural side channels can
in principle leak secret material from a JS process. The site uses
constant-time comparisons where it can but cannot guarantee constant-time
execution end-to-end — that is a property of the JS engine, not the page.

**Trust in upstream cryptographic libraries.** OpenPGP.js, the
hand-rolled BLAKE2b implementation, the qrcode and js-yaml libraries,
the secrets.js library, and the browser's own Web Crypto implementation
are trusted to be correct. The site pins each vendored library by
SHA-384 in three places (HTML comment, README manifest, SBOM) and the
audit script cross-checks them. It does not re-audit the libraries
themselves.

**Operator error.** Choosing a weak passphrase, pasting a private key
into the wrong tool, posting a "cleartext signed" message and thinking
it's encrypted, ignoring an "expired key" warning, sharing the wrong
QR code, exporting a private key and emailing it — these are out of
scope for any tool. Read the labels.

**Coercion.** The site cannot help you if someone with physical access
to your unlocked machine demands you decrypt something. Plausible
deniability is not a feature here.

## Out of scope by design

- **No accounts, no cloud sync.** A "save my keys to my account" feature
  would make the site dramatically more attractive to attackers and is a
  permanent non-goal.
- **No telemetry.** Including "anonymous usage metrics" and "error
  reporting." If something breaks, file an issue with a transcript.
- **No country auto-detection.** Locale comes from `navigator.language`
  and `localStorage` only. The site does not infer country from IP,
  timezone, or any other signal.
- **No PII validators.** National identity numbers (Codice Fiscale,
  PESEL, DNI, NIR, BSN, NINO, SSN) are explicitly rejected as out of
  scope. Commercial identifiers (IBAN, VAT, BIC, GS1) are fine.

## Recommendations by user type

**Casual user testing a hash, decoding a JWT, validating an IBAN.**
The hosted site is fine. The threat model in practice is "I want to
not paste this into a random web tool that might log it."

**Developer integrating a tool's output into a workflow.**
Verify the tool's output independently before trusting it for
production data. The site's tools are pure functions of their inputs;
nothing is "personalized," so the same input always produces the same
output.

**Journalist, activist, or anyone whose threat model includes a
state-level adversary.** Download the portable build over Tor or from a
trusted clone, verify the SHA-256 against `RELEASES.md` from a different
network path, and run it from `file://` on a freshly-installed OS with no
non-essential extensions. Assume any network you load the site over is
hostile until proven otherwise. Consider an air-gapped device for the
highest-stakes operations.

**Compliance / procurement reviewer.** See SECURITY.md, the SBOM
(`sbom.json`), the audit script's check list (`scripts/audit-release.js`),
and the spec (`SPEC-INTERNATIONAL.md`). The site has no server-side
component; data-residency questions answer themselves.

---

This document is intentionally specific about what the project does not
protect against, because the inverse claims (the site is "secure" or
"private") are too vague to act on. If you spot a gap — something this
document promises that the code does not deliver, or something the
code does that this document doesn't acknowledge — please open an issue
or follow the disclosure policy in [SECURITY.md](SECURITY.md).
