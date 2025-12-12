# encryptalotta

**PGP Key Generation, File Encryption & Decryption**

A completely client-side PGP encryption tool for generating keys and encrypting/decrypting files. No server uploads, 100% private and open source.

**Inspired by [Kevin Qiu](https://www.linkedin.com/in/kevinmqiu)**


---

## Features

- **Generate PGP Keys** - Create ECC or RSA key pairs with customizable settings
- **Encrypt Files** - Encrypt files with PGP public keys
- **Decrypt Files** - Decrypt files with your private key
- **100% Client-Side** - All operations happen in your browser
- **No Server Uploads** - Your files and keys never leave your device
- **Open Source** - Audit the code yourself

---

## Security Architecture

Encryptalotta was designed from the ground up with security as the primary concern. This application implements defense-in-depth with multiple layers of protection.

### Zero Network Communication

**Your data never leaves your device.** This isn't just a promise - it's cryptographically enforced:

- **Content Security Policy (CSP)** with `connect-src 'none'` - The browser physically cannot make outbound network requests
- **No external API calls** - All cryptographic operations happen locally
- **No analytics or tracking** - Zero telemetry of any kind
- **Works completely offline** - Download and use without any internet connection

### Modern Cryptography

Built on [OpenPGP.js](https://openpgpjs.org/) v5.11.1, a well-audited cryptographic library:

| Algorithm | Type | Security Level |
|-----------|------|----------------|
| **ECC Curve25519** (Default) | Elliptic Curve | High - Modern standard |
| RSA 3072-bit | Traditional | High |
| RSA 4096-bit | Traditional | Very High |

**Why ECC Curve25519 is the default:**
- Designed by Daniel J. Bernstein, a renowned cryptographer
- Resistant to timing attacks by design
- Smaller keys with equivalent security to RSA 3072
- Faster key generation and encryption/decryption operations

### Supply Chain Protection

**No CDN dependencies. No npm packages. No build process.**

- **Vendored OpenPGP.js** - The cryptographic library is saved directly in the repository, not fetched from a CDN
- **SHA-384 Integrity Hash** - `Mlq9yV9fsqU41CJA7E1LEbuJQx9REDo5S+jqu1+nyQebPFEY2jBD2PHKvhWPYNyT` for verification
- **Single-file application** - No complex dependency chains that could be compromised
- **No build tools** - What you see in the repository is exactly what runs in your browser

This eliminates entire categories of supply chain attacks that have affected other security tools.

### Memory Security

Sensitive data is cleared from memory after use:

- **Automatic passphrase clearing** - Passphrase fields are wiped after decryption operations
- **Page unload protection** - Private keys and sensitive fields are cleared when you close or navigate away from the page
- **JavaScript variable clearing** - Sensitive string variables are overwritten when no longer needed

### Strict Content Security Policy

The application enforces a strict CSP that prevents common web attacks:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'none';
form-action 'self';
base-uri 'self';
frame-ancestors 'none';
```

**What this means:**
- `connect-src 'none'` - **No network requests allowed** (data exfiltration impossible)
- `frame-ancestors 'none'` - Cannot be embedded in iframes (prevents clickjacking)
- `form-action 'self'` - Forms cannot submit to external servers
- `base-uri 'self'` - Prevents base tag injection attacks

### HTTP Security Headers

When deployed to Cloudflare Pages (or any server respecting the `_headers` file):

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Block iframe embedding |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Referrer-Policy` | `no-referrer` | Don't leak URLs |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolate browsing context |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Prevent cross-origin leaks |
| `Cross-Origin-Resource-Policy` | `same-origin` | Block cross-origin reads |
| `Cache-Control` | `no-store, no-cache, must-revalidate` | Prevent caching sensitive pages |

### Permissions Policy

Browser features that could be abused are explicitly disabled:

- No camera or microphone access
- No geolocation
- No payment APIs
- No USB access
- No screen capture
- No accelerometer/gyroscope data

### Strong Passphrase Requirements

Private keys are protected with enforced passphrase requirements:

- Minimum 12 characters
- Must include uppercase letter
- Must include lowercase letter
- Must include number
- Must include special character
- Passphrase confirmation required
- Warning system for weak passphrases (can be overridden if needed)

### Input Security

- Password fields use `type="password"` to hide input
- `autocomplete="off"` prevents browser password saving for sensitive fields
- No sensitive data stored in localStorage, sessionStorage, or cookies

---

## Technology

- Pure HTML, CSS, and JavaScript
- [OpenPGP.js](https://openpgpjs.org/) v5.11.1 for encryption (vendored locally)
- No frameworks, no build process
- Single file deployment

---

## Key Generation Options

| Option | Values | Notes |
|--------|--------|-------|
| **Algorithm** | ECC (Curve25519), RSA 3072, RSA 4096 | ECC recommended |
| **Expiration** | Never, 1, 2, or 5 years | Choose based on use case |
| **Passphrase** | User-defined | Strong requirements enforced |

---

## File Size Recommendations

| Size | Performance | Recommendation |
|------|-------------|----------------|
| Under 100MB | Optimal | Recommended |
| 100MB - 500MB | May be slow | Use with patience |
| Over 500MB | Risk of browser crashes | Split files first |
| Over 1GB | Not recommended | Use desktop PGP tools |

---

## Comparison with Other Tools

| Feature | Encryptalotta | Web-based PGP Tools | Desktop PGP |
|---------|---------------|---------------------|-------------|
| No server uploads | Yes | Often No | Yes |
| No CDN dependencies | Yes | Usually No | Yes |
| Works offline | Yes | Usually No | Yes |
| No installation | Yes | Yes | No |
| Open source | Yes | Varies | Usually Yes |
| Modern ECC default | Yes | Varies | Varies |
| Enforced CSP | Yes | Rarely | N/A |

---

## Development

This is a single-file application. Simply open `index.html` in a web browser or deploy to any static hosting service.

### Local Development

```bash
git clone https://github.com/clay-good/encryptalotta.git
cd encryptalotta
# Open index.html in your browser - that's it!
```

### Verifying Integrity

To verify the OpenPGP.js library hasn't been tampered with:

```bash
# Generate SHA-384 hash
openssl dgst -sha384 -binary openpgp.min.js | openssl base64 -A
# Should output: Mlq9yV9fsqU41CJA7E1LEbuJQx9REDo5S+jqu1+nyQebPFEY2jBD2PHKvhWPYNyT
```

---

## Deployment

### Any Static Host

1. Clone the repository
2. Deploy the entire directory to your static hosting provider
3. Ensure all files are served with proper MIME types

### Cloudflare Pages (Recommended)

This site is optimized for Cloudflare Pages deployment with automatic security headers:

1. Fork or clone this repository
2. Connect to Cloudflare Pages
3. Deploy - no build command needed (static HTML)
4. Security headers from `_headers` file are automatically applied

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main application (single-file, self-contained) |
| `openpgp.min.js` | Vendored cryptographic library |
| `_headers` | HTTP security headers for Cloudflare Pages |
| `encryptalotta.png` | Logo |
| `favicon-*.png` | Favicon files |
| `apple-touch-icon.png` | iOS home screen icon |
| `site.webmanifest` | Web app manifest |
| `robots.txt` | Search engine directives |
| `sitemap.xml` | Site map for SEO |

---

## Important Security Notes

**Key Backup:** If you lose your private key, you cannot decrypt your files. Ever. There is no recovery mechanism.

**Key Security:** Never share your private key with anyone. Your public key is safe to share.

**Browser Security:** This tool is only as secure as your browser environment. Use an updated browser on a trusted device.

**Passphrase Strength:** Use a strong, unique passphrase. Consider using a passphrase generator.

**Offline Use:** For maximum security, download the repository and use it offline on an air-gapped machine.

---

## Security Audit

This application is open source specifically so security researchers can audit it. Key areas to review:

- `index.html` - All application logic (CSP meta tags, JavaScript cryptographic calls, memory clearing)
- `_headers` - HTTP security headers
- `openpgp.min.js` - Compare against official OpenPGP.js release

Found a vulnerability? Please report it via [GitHub Issues](https://github.com/clay-good/encryptalotta/issues) or contact the maintainer directly.

