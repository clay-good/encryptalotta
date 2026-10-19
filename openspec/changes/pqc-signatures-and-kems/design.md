# Design — Post-Quantum Crypto (ML-KEM / ML-DSA)

## Context

FIPS 203 and FIPS 204 are built almost entirely out of Keccak: ML-KEM uses SHA3-256, SHA3-512, SHAKE128 (matrix sampling), and SHAKE256 (PRF, implicit-rejection KDF); ML-DSA uses SHAKE128 (matrix expansion) and SHAKE256 (everything else). The page already has `keccak(input, rateBytes, suffix, outLen)` with `shake128` / `shake256` wrappers, verified against FIPS 202 vectors and `@noble/hashes`. What remains is integer arithmetic: an NTT over Z_3329 (ML-KEM) and Z_8380417 (ML-DSA), compression, and byte packing. Everything fits in 32-bit integer JavaScript; ML-DSA products need `Math.imul`-free care because 23-bit × 23-bit exceeds 2^53 only when accumulated, so Montgomery reduction with split multiplication is used.

No stable browser exposes either algorithm through Web Crypto. The WICG "Modern Algorithms" draft (editor's draft 14 September 2026) defines the names `ML-KEM-512/768/1024`, `ML-DSA-44/65/87`, hybrids `MLKEM768-X25519` / `MLKEM768-P256` / `MLKEM1024-P384`, and a `SubtleCrypto.supports()` probe; Chrome's June 2026 origin trial has ended; Cloudflare Workers exposes it server-side. The TLS hybrid X25519MLKEM768 is widely deployed but is a key-share layout plus concatenation, not a Web Crypto primitive.

## Goals / Non-Goals

**Goals:**
- Byte-exact FIPS 203 / 204 output, demonstrable from the page itself via a deterministic-seed input and the published known-answer tests.
- Both algorithms usable interactively with sub-second latency on a 2020 laptop and a mid-range phone.
- Clear labelling of which engine produced a result (pure JS vs Web Crypto) and which hybrid definition a combined secret follows.
- A single "Quantum-safe" row that readers of Key Info and the certificate parser understand without a glossary.

**Non-Goals:**
- SLH-DSA (FIPS 205): deferred. SLH-DSA-SHAKE-128s signing is ~10^9 Keccak permutations' worth of hashing in the small variants; pure JS lands in multi-second territory on phones, and §7.6 rules out WASM until a user asks.
- ML-KEM-512 and ML-DSA-44: omitted on purpose; BSI TR-02102-1 2025 and CNSA 2.0 start at the 768 / 65 level. Adding them later is a parameter-table row.
- HashML-DSA (pre-hash mode), external-mu signing, seed-only key formats beyond the FIPS seed, and any certificate / CMS / JOSE wrapping of PQC keys (those belong to the X.509 / JOSE changes once the IETF drafts settle).
- PQC PGP key generation: RFC 9980 exists but OpenPGP.js 6.3.2 does not implement it; the generator says so and offers nothing.
- Any file-encryption format built on ML-KEM. No invented formats.

## Decisions

1. **Pure JS on the existing Keccak, Web Crypto when probed present (§7.6).** Rationale: the only alternatives are a vendored library (noble-post-quantum is ~60 KB minified and would be the fifth vendored file) or WASM. The arithmetic is ~1,100 lines and the Keccak already exists. At startup the tool calls `crypto.subtle.supports?.('ML-DSA-65')` and `supports?.('ML-KEM-768')` inside try/catch; when true, keygen / sign / verify / encaps / decaps use `crypto.subtle` with the draft's `raw-public` / `raw-seed` formats and the result row reads "engine: Web Crypto". Rejected alternative: Web Crypto only (nothing would work in any shipping browser today).
2. **Deterministic-seed input for KATs.** ML-KEM.KeyGen_internal(d, z) and ML-DSA.KeyGen_internal(ξ) take fixed 32-byte seeds; ML-KEM.Encaps_internal(ek, m) takes a fixed 32-byte m; ML-DSA.Sign_internal takes a fixed 32-byte rnd (all-zero = deterministic signing, FIPS 204 §3.4). An "Advanced: fixed seed (test vectors only)" field, hidden by default and labelled as unsafe for real keys, feeds these so the Playwright spec and a sceptical user can reproduce the NIST ACVP vectors in-page. Rejected: vendoring full KAT JSON into index.html (hundreds of KB; the vectors live in the test file).
3. **Hybrid combiner = concatenation, labelled as TLS X25519MLKEM768.** The TLS key-share draft defines the hybrid shared secret as ML-KEM-768 ss (32) ‖ X25519 ss (32) and leaves KDF-ing to TLS 1.3's key schedule, so the panel outputs the 64 raw bytes plus an optional HKDF-SHA-256 (salt and info fields, reusing the X25519 tool's HKDF path) and names the draft on the row. A second selectable combiner implements the X-Wing / draft-irtf-cfrg-hybrid-kems construction (SHA3-256 over ss_M ‖ ss_X ‖ ct_X ‖ pk_X ‖ label) and is labelled with that draft's name and version at implementation time. Rejected: a single unlabelled "hybrid" output; the two definitions are not interchangeable and the drafts are still moving.
4. **Decapsulation and signing keys are secret fields.** `#pqc-dk` and `#pqc-sk` are masked textareas, registered with `clearSensitiveFields()` (cleared on `beforeunload`), never written to the URL or `localStorage`, and the generated `Uint8Array`s are zero-filled after export. Same treatment as HMAC keys and KDF passwords.
5. **ML-KEM implicit rejection is preserved, not surfaced as an error.** A tampered ciphertext decapsulates to a pseudorandom 32-byte secret by design (FIPS 203 §7.3). The tool shows the secret and, when the user also pasted the expected secret, a constant-time comparison row "shared secrets differ"; it never reports "invalid ciphertext" except for length / modulus-check failures, which FIPS 203 mandates.
6. **ML-DSA verification is strict, signatures are hex or Base64.** Verify rejects on length, hint-count, and z-bound checks exactly as FIPS 204 Algorithm 8; the result row says "signature verifies under ML-DSA-65 against the supplied public key". Context strings are UTF-8 encoded, max 255 bytes, empty by default.
7. **Readiness row logic lives in one function.** `pqcReadiness(algorithmName, keySizeBits, isHybrid)` returns `{status: 'no' | 'yes' | 'hybrid', reason}` and is called by Key Info (`key-info`) and `tlsRenderCert()`. The reason text carries the IR 8547 draft dates (deprecated after 2030, disallowed after 2035) and says "draft". Rejected: a per-tool copy of the wording.
8. **Performance budget as a tested requirement.** Expectations in pure JS on a 2020 laptop: ML-KEM-768 keygen / encaps / decaps ≈ 2–5 ms each; ML-DSA-65 keygen ≈ 10 ms, verify ≈ 10–20 ms, sign ≈ 20–60 ms (rejection loop averages ~4 iterations); ML-DSA-87 roughly 1.6×. The Playwright spec asserts sign + verify < 1,000 ms in CI to catch an O(n^2) regression without flaking.

## Risks / Trade-offs

- **Correctness of hand-rolled lattice code.** A subtle NTT or packing bug produces keys that interoperate with nothing. Mitigation: the KAT requirement covers keygen, encaps, decaps, sign, and verify for every parameter set from the NIST ACVP vectors; cross-checked once at implementation against `@noble/post-quantum` in Node (dev dependency only, like the existing `@noble/hashes` cross-check for BLAKE).
- **Side channels.** Pure JS cannot promise constant time; the THREAT-MODEL.md paragraph on JS side channels already applies. The decapsulation path uses the FIPS 203 constant-time select for implicit rejection, and nothing branches on secret data in the sign loop beyond what the algorithm specifies, but the tool's info panel repeats the caveat.
- **Draft churn.** Web Crypto names, the hybrid-KEM draft, and IR 8547 are all drafts. Every label carries the document and date; a constant table at the top of the engine is the single place to update.
- **Misreading "Quantum-safe: no".** Users may think an RSA certificate is broken today. The row wording is "no — RSA / ECC; NIST IR 8547 (draft) deprecates after 2030, disallows after 2035" and links to the tool; it never says "insecure".
- **Page weight.** ~14 KB gzipped against the 2 MB budget; no new vendored file.
