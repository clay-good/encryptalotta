# Spec Delta — authenticator-export-decoding

## Purpose

Inside the shipped TOTP / 2FA tool, decode a Google Authenticator export (`otpauth-migration://offline?data=…`, a Base64 protobuf `MigrationPayload` with a community-reconstructed schema) into one `otpauth://` URI per account, keeping the live secrets in the page and masked by default.

## ADDED Requirements

### Requirement: Payload input
The tool SHALL accept the migration URI as pasted text or as a QR image decoded with the page's QR image decoder, SHALL URL-decode and then Base64-decode (standard alphabet, RFC 4648 §4) the `data` parameter, and SHALL hand the bytes to the schema-less protobuf reader.

#### Scenario: QR image path
- **WHEN** a PNG of an export QR code is dropped
- **THEN** the recovered URI is shown and decoded exactly as a pasted URI would be

#### Scenario: Wrong scheme
- **WHEN** the pasted text is a plain `otpauth://totp/…` URI
- **THEN** the panel says this is a single-account URI and offers to load it directly into the TOTP field

### Requirement: Reconstructed schema mapping
The tool SHALL map the protobuf fields through the reconstructed schema (`otp_parameters` 1 repeated, `version` 2, `batch_size` 3, `batch_index` 4, `batch_id` 5; per account `secret` 1 bytes, `name` 2, `issuer` 3, `algorithm` 4, `digits` 5, `type` 6, `counter` 7), SHALL label the schema "reconstructed, not published by Google", and SHALL show unknown fields raw rather than dropping them.

#### Scenario: Synthetic payload decodes
- **WHEN** a payload built from the same field table with issuer `Example`, name `alice@example.com`, a 20-byte secret, algorithm SHA1, digits 6, type TOTP is pasted
- **THEN** one account row shows those values and the batch line reads "batch 1 of 1"

#### Scenario: Multi-QR export
- **WHEN** a payload with `batch_size` 3 and `batch_index` 1 is decoded
- **THEN** the batch line reads "batch 2 of 3 — scan the remaining QR codes to see every account"

### Requirement: otpauth URI reconstruction
For each account the tool SHALL build `otpauth://totp/<issuer>:<name>?secret=<Base32>&issuer=<issuer>&algorithm=<SHA1|SHA256|SHA512>&digits=<6|8>` (or `otpauth://hotp/…&counter=<n>` for type HOTP) with the secret Base32-encoded per RFC 4648 §6 without padding, and SHALL offer "load into TOTP" (fills the existing `#totp-input`) and "render as QR" (`qrcode.js`, level M) per account.

#### Scenario: Loaded account produces the right code
- **WHEN** the synthetic account's secret equals the RFC 6238 Appendix B seed and "load into TOTP" is pressed at the Appendix B time step 59
- **THEN** the TOTP tool shows `94287082`

#### Scenario: HOTP account
- **WHEN** an account has type HOTP and counter 5
- **THEN** the URI uses `otpauth://hotp/` and carries `counter=5`

### Requirement: Secret handling
Secrets SHALL be masked (`••••`) until the user presses reveal, SHALL never be written to `localStorage`, `sessionStorage` or IndexedDB, and the input, decoded rows and generated QR canvases SHALL be cleared when the user leaves the TOTP view; a prominent banner SHALL read "this payload contains live 2FA secrets".

#### Scenario: Masked by default
- **WHEN** a payload is decoded
- **THEN** no Base32 secret is present in the DOM text until reveal is pressed, and the banner is visible

#### Scenario: Cleared on unload
- **WHEN** the user navigates to another tool and back
- **THEN** the migration input and results are empty

### Requirement: Offline operation and verdict language
Decoding SHALL happen in the page, and the result SHALL be phrased as "decoded from the payload you supplied", never as the accounts being verified or backed up.

#### Scenario: Input never leaves the page
- **WHEN** a migration payload is decoded while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)

#### Scenario: Wording
- **WHEN** decoding succeeds
- **THEN** the summary reads "n accounts decoded from the payload you supplied — nothing was stored; this does not establish that the secrets are still valid at the issuer."
