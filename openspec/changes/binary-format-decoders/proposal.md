# Proposal — Binary Decoder (Protobuf / MessagePack / bencode / hexdump)

## Why

Developers constantly meet opaque binary blobs: a gRPC body in a HAR file, a Redis or Kafka value serialized with **MessagePack**, a `.torrent` file (**bencode**, BEP 3), or a **Protocol Buffers** message whose `.proto` is not at hand. The usual move is to paste the Base64 into an online decoder, which means handing it to someone else's server — and these blobs often *are* the secret: the single most common case is the **Google Authenticator export QR** (`otpauth-migration://offline?data=…`), a protobuf that contains every 2FA seed on a phone, which people decode on random websites to migrate to another app. The site already has the surrounding pieces — a CBOR decoder in the formatter, a QR image decoder, a File Type Identifier with magic bytes, SHA-1 / SHA-256 via Web Crypto, Base32 in the encoder, and a TOTP tool that reads `otpauth://` URIs — but no hexdump, no protobuf, no MessagePack, no bencode.

## What Changes

- **New tool `bindec` — "Binary Decoder (Protobuf / MessagePack / bencode / hexdump)"** in Utilities, next to the JSON / YAML / XML / CBOR Formatter. Tool count **57 → 58**.
- **Hexdump and entropy view**: `xxd`-style offset / hex / ASCII columns (8 or 16 bytes per row), byte-frequency histogram, Shannon entropy per 256-byte window to spot compressed or encrypted regions, strings extraction (ASCII and UTF-16LE runs ≥ 4), and the magic-byte hint from the File Type Identifier.
- **Protobuf wire-format decode without a schema** (Protocol Buffers "Encoding" documentation): field number and wire type, varint shown as unsigned / zigzag signed / bool, fixed64 / sfixed64 / double, fixed32 / float, length-delimited heuristically as UTF-8 string / nested message / bytes / packed repeated, with the deprecated group wire types 3 / 4 reported.
- **MessagePack decode and encode** (msgpack.org specification): every type family including `ext` and the timestamp extension −1, rendered through the existing JSON pretty-printer; JSON → MessagePack as the inverse.
- **bencode decode** (BEP 3) with a `.torrent` view — name, piece length, piece count, files, trackers, creation date, **info-hash v1** (SHA-1 over the `info` dictionary bytes exactly as sliced from the input) and **v2** (SHA-256, BEP 52) — plus magnet-link derivation (BEP 9).
- **Authenticator export decoding** inside the shipped **TOTP / 2FA tool**: paste or scan a Google Authenticator migration URI → protobuf decode of `MigrationPayload` → one `otpauth://` URI per account with Base32 secret, "load into TOTP" and "render as QR" actions, batch index / size for multi-QR exports, secrets masked by default and cleared on unload.
- Related-tool links: Binary Decoder ↔ Formatter (CBOR) ↔ File Type Identifier ↔ Base64 / Hex ↔ Hash & Checksum ↔ TOTP.

Out of scope (and the §7 non-goal it respects): no user-supplied `.proto` schema compilation (a protobuf compiler is a build system, §7.7 — the decoder stays schema-less and says so); no BitTorrent client behaviour, no tracker or DHT contact, no magnet resolution (§0.1 / §7.5); no decoding of Microsoft Authenticator, Authy or Aegis proprietary backups (encrypted, format undocumented); no Thrift, Avro, FlatBuffers or Cap'n Proto in this change. The TOTP extension decodes a payload the user already holds; it does not export, sync or store secrets (§7.9).

## Capabilities

### New Capabilities
- `hexdump-and-entropy-view`: offset / hex / ASCII dump, byte histogram, windowed Shannon entropy, strings extraction, magic-byte hint.
- `protobuf-wire-decoding`: schema-less Protocol Buffers wire-format tree with per-wire-type alternative interpretations.
- `messagepack-decoding`: full MessagePack specification decode to JSON and JSON encode to MessagePack.
- `bencode-decoding`: BEP 3 decode, `.torrent` summary, v1 / v2 info-hash and magnet link.
- `authenticator-export-decoding`: Google Authenticator `otpauth-migration` payload → per-account `otpauth://` URIs in the TOTP tool.

### Modified Capabilities
- none (the TOTP tool gains an import panel; its RFC 6238 / RFC 4226 generation behaviour is unchanged and has no OpenSpec baseline yet).

## Impact

- `index.html`: one new view plus a TOTP sub-panel, ~700 lines of inline JS (hexdump renderer, entropy, strings scanner, protobuf reader, MessagePack codec, bencode reader with byte-range tracking, torrent summary, migration-payload mapper), ~60 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: the hand-rolled CBOR decoder's byte-cursor helpers (format tool), `filetypeIdentify()` for the magic hint, `jsonPretty()` for rendering, Base32 encode from the Base64 / 32 / 58 encoder, `qrDecodeImage()` and `qrcode.js` for scan / render, SHA-1 / SHA-256 via Web Crypto `digest`, `Intl.DateTimeFormat` for timestamps, STRINGS i18n.
- No new vendored file, no CSP change, page weight +~14 KB gzipped.
- Tests: new `tests/specs/NN-bindec.spec.js` (number assigned at implementation; 29+) — the protobuf documentation vectors (`08 96 01` → field 1 varint 150; `12 07 74 65 73 74 69 6e 67` → field 2 string `testing`), MessagePack specification examples, a minimal `.torrent` fixture with a precomputed info-hash, a synthetic `MigrationPayload` built from the reconstructed schema, and the "no network" assertion the suite already uses.
